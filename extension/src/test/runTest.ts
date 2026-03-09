import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../..");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const testWorkspace = path.resolve(__dirname, "../../../test-fixture/workspace");

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testWorkspace, "--disable-workspace-trust"],
    });
  } catch (error) {
    console.error("Failed to run extension tests");
    console.error(error);
    process.exit(1);
  }
}

void main();
