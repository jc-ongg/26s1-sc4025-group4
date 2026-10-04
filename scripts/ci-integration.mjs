import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../tmp/ci/", import.meta.url);
const project = process.env.CI_COMPOSE_PROJECT ?? `eatigo-ci-${randomUUID()}`;
const port = process.env.EATIGO_PORT ?? "3001";
if (!/^eatigo-ci-[a-z0-9-]+$/.test(project)) {
  throw new Error("Integration projects must start with eatigo-ci-.");
}
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
  throw new Error("EATIGO_PORT must be a port between 1024 and 65535.");
}
const git = (...args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "Git command failed.");
  return result.stdout.trim();
};
const commit = git("rev-parse", "HEAD");
const env = {
  ...process.env,
  EATIGO_PORT: port,
  EATIGO_BIND_ADDRESS: "127.0.0.1",
  EATIGO_RELEASE_SHA: commit,
  DEMO_URL: `http://127.0.0.1:${port}`,
};
const compose = ["compose", "--project-name", project, "-f", "docker-compose.yml"];
const evidence = {
  commit,
  cleanCheckout: git("status", "--porcelain") === "",
  startedAt: new Date().toISOString(),
  passed: false,
  checks: [],
};

function run(command, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let output = "";
    if (capture) {
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(" ")} failed (${code}). ${output}`));
    });
  });
}

await mkdir(output, { recursive: true });
let ownsProject = false;
let failure;
try {
  // Refuse existing resources so cleanup can never remove somebody else's database.
  const label = `label=com.docker.compose.project=${project}`;
  const containers = await run("docker", ["ps", "-aq", "--filter", label], true);
  const volumes = await run("docker", ["volume", "ls", "-q", "--filter", label], true);
  if (containers.trim() || volumes.trim()) throw new Error("CI project already exists.");
  ownsProject = true;
  await run("docker", [...compose, "up", "--build", "--wait", "--wait-timeout", "240"]);
  const version = await fetch(`${env.DEMO_URL}/version.json`).then((r) => r.json());
  if (version.commit !== commit) throw new Error("Running image has the wrong commit.");
  await run(process.execPath, ["scripts/check-auth.mjs"]);
  evidence.checks.push("HTTP authentication");
  await run("docker", [
    ...compose,
    "exec",
    "-T",
    "backend",
    "npm",
    "run",
    "test:integration",
  ]);
  evidence.checks.push("Dining integration");
  await run("docker", [
    ...compose,
    "exec",
    "-T",
    "backend",
    "npm",
    "run",
    "test:discovery",
  ]);
  evidence.checks.push("Real-model discovery");
  evidence.passed = true;
} catch (error) {
  failure = error;
  evidence.error = error.message;
  if (ownsProject) {
    try {
      const logs = await run(
        "docker",
        [...compose, "logs", "--no-color", "--tail", "200"],
        true,
      );
      await writeFile(new URL("docker.log", output), logs);
    } catch (logError) {
      console.error(logError.message);
    }
  }
} finally {
  if (ownsProject) {
    try {
      await run("docker", [
        ...compose,
        "down",
        "--volumes",
        "--remove-orphans",
        "--rmi",
        "local",
      ]);
    } catch (error) {
      failure ??= error;
      evidence.passed = false;
      evidence.error ??= error.message;
    }
  }
  evidence.finishedAt = new Date().toISOString();
  await writeFile(
    new URL("evidence.json", output),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}
if (failure) throw failure;
console.log(`Integration passed for ${commit}. Isolated stack removed.`);
