import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
// Expand paths here because Windows shells do not expand the test-file glob.
const files = readdirSync(new URL("../frontend/src/", import.meta.url))
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => `frontend/src/${name}`);
if (!files.length) throw new Error("No frontend tests found.");
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
