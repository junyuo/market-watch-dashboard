import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

test("unchanged snapshot exits successfully and reports changed=false", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "market-data-loop-"));
  const githubOutput = path.join(tempDir, "github-output.txt");
  const result = await runCoordinator({
    MARKET_DATA_FETCH_SCRIPT: path.join(projectRoot, "scripts", "test", "fixtures", "copy-previous-fetch.mjs"),
    MARKET_DATA_MAX_ATTEMPTS: "1",
    MARKET_DATA_RETRY_DELAY_MS: "0",
    MARKET_DATA_WORK_DIR: path.join(tempDir, "work"),
    MARKET_DATA_PAGES_URL: "http://127.0.0.1:1",
    GITHUB_OUTPUT: githubOutput,
  });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /status=unchanged changed=false attempts=1/);
  assert.match(await readFile(githubOutput, "utf8"), /changed=false/);
});

test("failed fetch stops at the configured attempt limit", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "market-data-loop-"));
  const githubOutput = path.join(tempDir, "github-output.txt");
  const result = await runCoordinator({
    MARKET_DATA_FETCH_SCRIPT: path.join(projectRoot, "scripts", "test", "fixtures", "fail-fetch.mjs"),
    MARKET_DATA_MAX_ATTEMPTS: "2",
    MARKET_DATA_RETRY_DELAY_MS: "0",
    MARKET_DATA_WORK_DIR: path.join(tempDir, "work"),
    MARKET_DATA_PAGES_URL: "http://127.0.0.1:1",
    GITHUB_OUTPUT: githubOutput,
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.stdout, /attempt 1\/2/);
  assert.match(result.stdout, /attempt 2\/2/);
  assert.doesNotMatch(result.stdout, /attempt 3\/2/);
  assert.match(await readFile(githubOutput, "utf8"), /status=failed/);
});

async function runCoordinator(extraEnv) {
  const child = spawn(process.execPath, [path.join(projectRoot, "scripts", "update-market-data.mjs")], {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  return { exitCode, stdout, stderr };
}
