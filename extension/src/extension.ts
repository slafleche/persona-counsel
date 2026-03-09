import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

const execFileAsync = promisify(execFile);

type DoctorJson = {
  status: "ok" | "error";
  checks?: {
    backend_version?: string;
    python_version?: string;
    platform?: string;
    arch?: string;
    paths?: {
      personas_exists?: boolean;
      counsels_exists?: boolean;
      sessions_exists?: boolean;
    };
  };
};

type BackendManifest = {
  schemaVersion: number;
  targets: Array<{
    target: string;
    filename: string;
    relativePath: string;
    sizeBytes: number;
    sha256: string;
  }>;
};

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function readBundledManifest(extensionPath: string): BackendManifest | null {
  const manifestPath = path.join(extensionPath, "backend", "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BackendManifest;
    if (!Array.isArray(parsed.targets)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getCurrentTarget(): string {
  return `${process.platform}-${process.arch}`;
}

function sha256File(filePath: string): string {
  const hash = createHash("sha256");
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}

function getBundledBinaryPath(extensionPath: string): string {
  const platform = process.platform;
  const arch = process.arch;
  const binaryName = platform === "win32" ? "counsel.exe" : "counsel";
  return path.join(extensionPath, "backend", `${platform}-${arch}`, binaryName);
}

function resolveCounselExecutable(extensionPath: string): string {
  const config = vscode.workspace.getConfiguration("personaCounsel");
  const overridePath = (config.get<string>("backendPath") ?? "").trim();
  const allowPathFallback = config.get<boolean>("allowPathFallback", true);
  const target = getCurrentTarget();
  const manifest = readBundledManifest(extensionPath);

  if (overridePath.length > 0) {
    if (!path.isAbsolute(overridePath)) {
      throw new Error(
        `Configured backendPath must be absolute: ${overridePath}`,
      );
    }
    if (!isExecutable(overridePath)) {
      throw new Error(
        `Configured backendPath is not executable: ${overridePath}`,
      );
    }
    return overridePath;
  }

  if (manifest) {
    const declaredTargets = manifest.targets.map((item) => item.target);
    if (!declaredTargets.includes(target)) {
      throw new Error(
        `Unsupported platform target for bundled backend: ${target}. Bundled targets: ${declaredTargets.join(", ") || "none"}.`,
      );
    }
  }

  const bundledPath = getBundledBinaryPath(extensionPath);
  if (isExecutable(bundledPath)) {
    if (!manifest) {
      throw new Error(
        "Bundled backend found but backend/manifest.json is missing or invalid.",
      );
    }

    const entry = manifest.targets.find((item) => item.target === target);
    if (!entry) {
      throw new Error(
        `Bundled backend target ${target} is not declared in backend/manifest.json.`,
      );
    }

    const expectedRelative = path.join(
      "backend",
      entry.relativePath.split("/").join(path.sep),
    );
    const expectedAbsolute = path.join(extensionPath, expectedRelative);
    if (path.resolve(expectedAbsolute) !== path.resolve(bundledPath)) {
      throw new Error(
        `Bundled backend path mismatch for target ${target}: manifest=${expectedAbsolute} resolved=${bundledPath}`,
      );
    }

    const expectedFile = path.basename(expectedAbsolute);
    if (expectedFile !== path.basename(bundledPath)) {
      throw new Error(
        `Bundled backend filename mismatch for target ${target}: manifest=${expectedFile} resolved=${path.basename(bundledPath)}`,
      );
    }

    const verifyBundledHash = config.get<boolean>("verifyBundledHash", true);
    if (verifyBundledHash) {
      const actualHash = sha256File(bundledPath);
      if (actualHash !== entry.sha256) {
        throw new Error(
          `Bundled backend SHA-256 mismatch for target ${target}.`,
        );
      }
    }

    return bundledPath;
  }

  if (allowPathFallback) {
    return "counsel";
  }

  throw new Error(
    `No bundled backend found at ${bundledPath} and PATH fallback is disabled.`,
  );
}

function requireTrustedWorkspaceOrThrow(operation: string): void {
  const config = vscode.workspace.getConfiguration("personaCounsel");
  const requireTrusted = config.get<boolean>("requireTrustedWorkspace", true);
  if (!requireTrusted) {
    return;
  }

  if (!vscode.workspace.isTrusted) {
    throw new Error(
      `Blocked ${operation}: workspace is not trusted (personaCounsel.requireTrustedWorkspace=true).`,
    );
  }
}

function shellQuote(input: string): string {
  if (!/\s/.test(input)) {
    return input;
  }
  return `"${input.replace(/"/g, '\\"')}"`;
}

function logSection(output: vscode.OutputChannel, title: string, body: string): void {
  output.appendLine(`[persona-counsel] ${title}`);
  if (body.trim().length > 0) {
    output.appendLine(body);
  }
}

async function showBackendBootstrapHelp(
  output: vscode.OutputChannel,
  operation: string,
  message: string,
): Promise<void> {
  const config = vscode.workspace.getConfiguration("personaCounsel");
  const actions: string[] = ["Show Output", "Open Settings"];

  const canEnableFallback = message.includes("No bundled backend found")
    && config.get<boolean>("allowPathFallback", true) === false;
  if (canEnableFallback) {
    actions.push("Enable PATH Fallback");
  }

  const canClearBackendPath = message.includes("backendPath");
  if (canClearBackendPath) {
    actions.push("Clear backendPath");
  }

  const selection = await vscode.window.showErrorMessage(
    `Persona Counsel ${operation} blocked: ${message}`,
    ...actions,
  );

  if (selection === "Show Output") {
    output.show(true);
    return;
  }

  if (selection === "Open Settings") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "personaCounsel",
    );
    return;
  }

  if (selection === "Enable PATH Fallback") {
    await config.update(
      "allowPathFallback",
      true,
      vscode.ConfigurationTarget.Global,
    );
    void vscode.window.showInformationMessage(
      "personaCounsel.allowPathFallback enabled globally.",
    );
    return;
  }

  if (selection === "Clear backendPath") {
    await config.update(
      "backendPath",
      "",
      vscode.ConfigurationTarget.Global,
    );
    void vscode.window.showInformationMessage(
      "personaCounsel.backendPath cleared globally.",
    );
  }
}

async function preflightBackend(
  extensionPath: string,
  output: vscode.OutputChannel,
  operation: string,
): Promise<string | null> {
  try {
    requireTrustedWorkspaceOrThrow(operation);
    return resolveCounselExecutable(extensionPath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logSection(output, `${operation}-preflight-error`, message);
    output.appendLine("");
    await showBackendBootstrapHelp(output, operation, message);
    return null;
  }
}

async function runCounsel(
  executable: string,
  args: string[],
  output: vscode.OutputChannel,
): Promise<{ stdout: string; stderr: string; executable: string }> {
  const timeoutMs = vscode.workspace
    .getConfiguration("personaCounsel")
    .get<number>("commandTimeoutMs", 30_000);
  const startedAt = Date.now();
  logSection(output, "exec", `${executable} ${args.join(" ")}`);

  try {
    const result = await execFileAsync(executable, args, {
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      timeout: timeoutMs,
    });
    const elapsedMs = Date.now() - startedAt;
    logSection(output, "ok", `elapsedMs=${elapsedMs}`);
    if ((result.stdout ?? "").trim().length > 0) {
      logSection(output, "stdout", result.stdout ?? "");
    }
    if ((result.stderr ?? "").trim().length > 0) {
      logSection(output, "stderr", result.stderr ?? "");
    }
    output.appendLine("");
    return { executable, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const elapsedMs = Date.now() - startedAt;
    logSection(output, "error", `elapsedMs=${elapsedMs} ${message}`);
    output.appendLine("");
    throw new Error(
      `Failed to run ${executable} ${args.join(" ")}: ${message}`,
    );
  }
}

function summarizeDoctor(data: DoctorJson): string {
  const checks = data.checks ?? {};
  const paths = checks.paths ?? {};
  const pathsOk = [paths.personas_exists, paths.counsels_exists, paths.sessions_exists]
    .every((value) => value === true);

  return [
    `status=${data.status}`,
    `backend=${checks.backend_version ?? "unknown"}`,
    `python=${checks.python_version ?? "unknown"}`,
    `platform=${checks.platform ?? "unknown"}/${checks.arch ?? "unknown"}`,
    `paths=${pathsOk ? "ok" : "missing"}`,
  ].join(" | ");
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Persona Counsel");
  const manifest = readBundledManifest(context.extensionPath);
  if (manifest) {
    logSection(
      output,
      "backend-manifest",
      `schema=${manifest.schemaVersion} targets=${manifest.targets.length}`,
    );
  } else {
    logSection(output, "backend-manifest", "not found or invalid");
  }

  const showOutput = vscode.commands.registerCommand(
    "personaCounsel.showOutput",
    () => {
      output.show(true);
    },
  );

  const openTerminal = vscode.commands.registerCommand(
    "personaCounsel.openTerminal",
    async () => {
      const executable = await preflightBackend(
        context.extensionPath,
        output,
        "terminal launch",
      );
      if (!executable) {
        return;
      }
      try {
        const terminal = vscode.window.createTerminal("Persona Counsel");
        logSection(output, "terminal", `launch ${executable} --help`);
        terminal.show();
        terminal.sendText(`${shellQuote(executable)} --help`, false);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logSection(output, "terminal-error", message);
        void vscode.window.showErrorMessage(
          `Persona Counsel terminal launch failed: ${message}`,
        );
      }
    },
  );

  const doctor = vscode.commands.registerCommand(
    "personaCounsel.doctor",
    async () => {
      const resolvedExecutable = await preflightBackend(
        context.extensionPath,
        output,
        "doctor",
      );
      if (!resolvedExecutable) {
        return;
      }
      try {
        const { stdout, executable: usedExecutable } = await runCounsel(
          resolvedExecutable,
          ["doctor", "--json"],
          output,
        );
        const parsed = JSON.parse(stdout) as DoctorJson;
        const summary = summarizeDoctor(parsed);

        if (parsed.status === "ok") {
          void vscode.window.showInformationMessage(
            `Persona Counsel doctor (${path.basename(usedExecutable)}): ${summary}`,
          );
        } else {
          void vscode.window.showErrorMessage(`Persona Counsel doctor: ${summary}`);
          output.show(true);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Persona Counsel doctor failed: ${message}`);
        output.show(true);
      }
    },
  );

  const setup = vscode.commands.registerCommand(
    "personaCounsel.setup",
    async () => {
      const executable = await preflightBackend(
        context.extensionPath,
        output,
        "setup",
      );
      if (!executable) {
        return;
      }
      try {
        const { stdout } = await runCounsel(executable, ["setup"], output);
        const msg = stdout.trim() || "setup complete";
        void vscode.window.showInformationMessage(`Persona Counsel setup: ${msg}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Persona Counsel setup failed: ${message}`);
        output.show(true);
      }
    },
  );

  context.subscriptions.push(output, showOutput, openTerminal, doctor, setup);
}

export function deactivate(): void {
  // No cleanup needed for scaffold.
}
