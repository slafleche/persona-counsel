import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

type CommandStatus = "success" | "preflight_error" | "runtime_error";

type CommandResult = {
  command: "openTerminal" | "doctor" | "setup";
  status: CommandStatus;
  message: string;
  at: string;
};

type ExtensionApi = {
  getLastCommandResult: () => CommandResult | null;
};

const EXTENSION_ID = "persona-counsel.persona-counsel-vscode";

function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "Expected at least one workspace folder");
  return folder.uri.fsPath;
}

async function waitForResult(
  api: ExtensionApi,
  command: CommandResult["command"],
  timeoutMs = 12_000,
): Promise<CommandResult> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = api.getLastCommandResult();
    if (value && value.command === command) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for command result: ${command}`);
}

type E2ETestCase = {
  name: string;
  run: (api: ExtensionApi, root: string) => Promise<void>;
};

async function resetState(root: string): Promise<void> {
  for (const dirname of ["personas", "counsels", "sessions"]) {
    fs.rmSync(path.join(root, dirname), { recursive: true, force: true });
  }
  await vscode.workspace
    .getConfiguration("personaCounsel")
    .update("backendPath", "", vscode.ConfigurationTarget.Workspace);
}

const tests: E2ETestCase[] = [
  {
    name: "setup command creates baseline directories",
    run: async (api, root) => {
      await vscode.commands.executeCommand("personaCounsel.setup");
      const result = await waitForResult(api, "setup");
      assert.equal(result.status, "success");

      for (const dirname of ["personas", "counsels", "sessions"]) {
        assert.ok(
          fs.existsSync(path.join(root, dirname)),
          `Expected setup-created directory: ${dirname}`,
        );
      }
    },
  },
  {
    name: "doctor command succeeds after setup",
    run: async (api) => {
      await vscode.commands.executeCommand("personaCounsel.setup");
      await waitForResult(api, "setup");
      await vscode.commands.executeCommand("personaCounsel.doctor");
      const result = await waitForResult(api, "doctor");
      assert.equal(result.status, "success");
      assert.ok(result.message.includes("status=ok"));
    },
  },
  {
    name: "open terminal command succeeds",
    run: async (api) => {
      await vscode.commands.executeCommand("personaCounsel.openTerminal");
      const result = await waitForResult(api, "openTerminal");
      assert.equal(result.status, "success");
    },
  },
  {
    name: "invalid backendPath triggers preflight failure",
    run: async (api) => {
      const fakePath = process.platform === "win32"
        ? "C:\\definitely\\missing\\counsel.exe"
        : "/definitely/missing/counsel";
      await vscode.workspace
        .getConfiguration("personaCounsel")
        .update("backendPath", fakePath, vscode.ConfigurationTarget.Workspace);

      await vscode.commands.executeCommand("personaCounsel.doctor");
      const result = await waitForResult(api, "doctor");
      assert.equal(result.status, "preflight_error");
    },
  },
];

export async function runE2ETests(): Promise<void> {
  const extension = vscode.extensions.getExtension<ExtensionApi>(EXTENSION_ID);
  assert.ok(extension, `Extension not found: ${EXTENSION_ID}`);
  const api = await extension.activate();
  const root = workspaceRoot();

  for (const t of tests) {
    await resetState(root);
    try {
      await t.run(api, root);
      console.log(`[e2e] PASS: ${t.name}`);
    } catch (error) {
      console.error(`[e2e] FAIL: ${t.name}`);
      throw error;
    }
  }
}
