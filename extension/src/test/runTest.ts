import * as path from "node:path";
import * as fs from "node:fs";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../..");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    const testWorkspace = path.resolve(
      extensionDevelopmentPath,
      "test-fixture/workspace",
    );
    fs.mkdirSync(testWorkspace, { recursive: true });

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testWorkspace],
    });
  } catch (error) {
    console.error("Failed to run extension tests");
    console.error(error);
    process.exit(1);
  }
}

void main();
