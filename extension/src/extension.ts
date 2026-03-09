import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";

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

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
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

  const bundledPath = getBundledBinaryPath(extensionPath);
  if (isExecutable(bundledPath)) {
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

async function runCounsel(
  extensionPath: string,
  args: string[],
  output: vscode.OutputChannel,
): Promise<{ stdout: string; stderr: string; executable: string }> {
  requireTrustedWorkspaceOrThrow("command execution");
  const executable = resolveCounselExecutable(extensionPath);
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

  const showOutput = vscode.commands.registerCommand(
    "personaCounsel.showOutput",
    () => {
      output.show(true);
    },
  );

  const openTerminal = vscode.commands.registerCommand(
    "personaCounsel.openTerminal",
    () => {
      try {
        requireTrustedWorkspaceOrThrow("terminal launch");
        const terminal = vscode.window.createTerminal("Persona Counsel");
        const executable = resolveCounselExecutable(context.extensionPath);
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
      try {
        const { stdout, executable } = await runCounsel(
          context.extensionPath,
          ["doctor", "--json"],
          output,
        );
        const parsed = JSON.parse(stdout) as DoctorJson;
        const summary = summarizeDoctor(parsed);

        if (parsed.status === "ok") {
          void vscode.window.showInformationMessage(
            `Persona Counsel doctor (${path.basename(executable)}): ${summary}`,
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
      try {
        const { stdout } = await runCounsel(context.extensionPath, ["setup"], output);
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
