import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "-e",
    "PREPARE_USABILITY_FIXTURES=1",
    "backend",
    "node",
    "dist/prepare-usability.js",
  ],
  { cwd: root, encoding: "utf8" },
);
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}
const manifest = JSON.parse(result.stdout);
mkdirSync(new URL("../tmp/usability/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../tmp/usability/scenarios.json", import.meta.url),
  JSON.stringify(manifest, null, 2),
);
console.log("Table 5 practice scenarios prepared. Login at http://localhost:3000.");
console.log("Practice diner: alex@demo.com | Restaurant account: peacock@business.com");
console.log(
  "Other practice diners: ava@demo.com, beth@demo.com, cara@demo.com, dan@demo.com",
);
console.log(
  "All passwords: password123. See docs/TABLE_5_WALKTHROUGH.md for the task sequence.",
);
console.log(
  "RT2 Thursday:",
  new Date(manifest.dates.RT2).toLocaleString("en-SG", { timeZone: "Asia/Singapore" }),
);
console.log(
  "RT3 Wednesday:",
  new Date(manifest.dates.RT3).toLocaleString("en-SG", { timeZone: "Asia/Singapore" }),
);
