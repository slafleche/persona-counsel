import * as vscode from "vscode";

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
    () => {
      void vscode.window.showInformationMessage(
        "Step 1 scaffold: backend bridge will be added in Step 2.",
      );
    },
  );

  const setup = vscode.commands.registerCommand(
    "personaCounsel.setup",
    () => {
      void vscode.window.showInformationMessage(
        "Step 1 scaffold: backend bridge will be added in Step 2.",
      );
    },
  );

  context.subscriptions.push(openTerminal, doctor, setup);
}

export function deactivate(): void {
  // No cleanup needed for scaffold.
}
