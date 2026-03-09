import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

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

async function runCounsel(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync("counsel", args, {
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      timeout: 30_000,
    });
    return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to run counsel ${args.join(" ")}: ${message}`);
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
  const openTerminal = vscode.commands.registerCommand(
    "personaCounsel.openTerminal",
    () => {
      const terminal = vscode.window.createTerminal("Persona Counsel");
      terminal.show();
      terminal.sendText("counsel --help", false);
    },
  );

  const doctor = vscode.commands.registerCommand(
    "personaCounsel.doctor",
    async () => {
      try {
        const { stdout } = await runCounsel(["doctor", "--json"]);
        const parsed = JSON.parse(stdout) as DoctorJson;
        const summary = summarizeDoctor(parsed);

        if (parsed.status === "ok") {
          void vscode.window.showInformationMessage(`Persona Counsel doctor: ${summary}`);
        } else {
          void vscode.window.showErrorMessage(`Persona Counsel doctor: ${summary}`);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Persona Counsel doctor failed: ${message}`);
      }
    },
  );

  const setup = vscode.commands.registerCommand(
    "personaCounsel.setup",
    async () => {
      try {
        const { stdout } = await runCounsel(["setup"]);
        const msg = stdout.trim() || "setup complete";
        void vscode.window.showInformationMessage(`Persona Counsel setup: ${msg}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`Persona Counsel setup failed: ${message}`);
      }
    },
  );

  context.subscriptions.push(openTerminal, doctor, setup);
}

export function deactivate(): void {
  // No cleanup needed for scaffold.
}
