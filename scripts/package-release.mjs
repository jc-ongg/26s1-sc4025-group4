import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Git command failed.");
  return result.stdout.trim();
}
const commit = git("rev-parse", "HEAD");
const evidence = JSON.parse(
  await readFile(new URL("../tmp/ci/evidence.json", import.meta.url)),
);
if (
  !evidence.passed ||
  !evidence.cleanCheckout ||
  evidence.commit !== commit ||
  git("status", "--porcelain") !== "" ||
  !["HTTP authentication", "Dining integration", "Real-model discovery"].every((check) =>
    evidence.checks?.includes(check),
  )
) {
  throw new Error(
    "Release requires a clean checkout and passing integration evidence for HEAD.",
  );
}
const output = new URL("../tmp/release/", import.meta.url);
await mkdir(output, { recursive: true });
const archive = new URL("source.zip", output);
// Only tracked application files are released; reports, caches and local credentials stay out.
git(
  "archive",
  "--format=zip",
  `--output=${fileURLToPath(archive)}`,
  commit,
  "frontend",
  "backend",
  "database",
  "scripts",
  "docker-compose.yml",
  "package.json",
  "package-lock.json",
  ".dockerignore",
  ".prettierrc.json",
  ".editorconfig",
  "README.md",
  "docs",
);
const sourceSha256 = createHash("sha256")
  .update(await readFile(archive))
  .digest("hex");
const runUrl = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null;
await writeFile(
  new URL("release.json", output),
  `${JSON.stringify({ commit, sourceSha256, runUrl, createdAt: new Date().toISOString(), integration: evidence }, null, 2)}\n`,
);
await copyFile(new URL("deploy.ps1", import.meta.url), new URL("deploy.ps1", output));
await copyFile(
  new URL("../docs/CI_CD.md", import.meta.url),
  new URL("DEPLOYMENT.md", output),
);
console.log(`Release prepared: ${commit} (SHA-256 ${sourceSha256})`);
