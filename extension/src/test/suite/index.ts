import { runE2ETests } from "./extension.e2e.test";

export async function run(): Promise<void> {
  await runE2ETests();
}
