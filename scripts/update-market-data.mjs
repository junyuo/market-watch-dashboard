import { appendFile, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  latestChartDate,
  repairSnapshot,
  snapshotsEqual,
  validateSnapshot,
} from "./lib/dataValidation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDataDir = path.join(projectRoot, "public", "data");
const workDir = resolveProjectPath(process.env.MARKET_DATA_WORK_DIR ?? ".market-data-work");
const previousDir = path.join(workDir, "previous");
const candidateDir = path.join(workDir, "candidate");
const maxAttempts = positiveInteger(process.env.MARKET_DATA_MAX_ATTEMPTS, 3);
const retryDelayMs = nonNegativeInteger(process.env.MARKET_DATA_RETRY_DELAY_MS, 120000);
const pagesDataUrl = process.env.MARKET_DATA_PAGES_URL
  ?? "https://junyuo.github.io/market-watch-dashboard/data";

const runReport = {
  status: "failed",
  changed: false,
  attempts: 0,
  repairs: 0,
  previousUpdatedAt: "unknown",
  candidateUpdatedAt: "unknown",
  latestMarketDate: "unknown",
  messages: [],
};

try {
  await prepareWorkDirectory();
  const previous = await loadPreviousSnapshot();
  runReport.previousUpdatedAt = previous.marketData.updatedAt ?? "unknown";
  await writeSnapshot(previousDir, previous);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    runReport.attempts = attempt;
    console.log(`[update-loop] attempt ${attempt}/${maxAttempts}`);
    await rm(candidateDir, { recursive: true, force: true });
    await mkdir(candidateDir, { recursive: true });

    const fetchSucceeded = await runRawFetch();
    if (!fetchSucceeded) {
      runReport.messages.push(`Attempt ${attempt}: remote fetch failed`);
      if (attempt < maxAttempts) await waitBeforeRetry();
      continue;
    }

    try {
      const candidate = await readSnapshot(candidateDir);
      runReport.repairs += countInheritedMarketItems(candidate.marketData);
      const repaired = repairSnapshot(candidate, previous);
      runReport.repairs += repaired.repairs.length;
      await writeSnapshot(candidateDir, repaired);

      const validation = validateSnapshot({
        ...repaired,
        previous,
        enforceFreshness: process.env.MARKET_DATA_ALLOW_STALE !== "1",
      });

      validation.warnings.forEach((warning) => console.warn(`[update-loop] warning: ${warning}`));
      if (!validation.valid) {
        validation.errors.forEach((error) => console.error(`[update-loop] validation: ${error}`));
        runReport.messages.push(`Attempt ${attempt}: validation failed (${validation.errors.length} errors)`);
        if (attempt < maxAttempts) await waitBeforeRetry();
        continue;
      }

      runReport.candidateUpdatedAt = repaired.marketData.updatedAt ?? "unknown";
      runReport.latestMarketDate = latestChartDate(repaired.chartData) ?? "unknown";

      const repairedSnapshot = {
        marketData: repaired.marketData,
        chartData: repaired.chartData,
      };
      if (snapshotsEqual(repairedSnapshot, previous)) {
        runReport.status = "unchanged";
        runReport.changed = false;
        runReport.messages.push(`Attempt ${attempt}: no semantic data changes`);
        await finishRun();
        process.exit(0);
      }

      await promoteCandidate();
      runReport.status = "updated";
      runReport.changed = true;
      runReport.messages.push(`Attempt ${attempt}: candidate validated and promoted`);
      await finishRun();
      process.exit(0);
    } catch (error) {
      console.error(`[update-loop] attempt ${attempt} failed: ${error.message}`);
      runReport.messages.push(`Attempt ${attempt}: ${error.message}`);
      if (attempt < maxAttempts) await waitBeforeRetry();
    }
  }

  throw new Error(`Market data update failed after ${maxAttempts} attempts`);
} catch (error) {
  runReport.status = "failed";
  runReport.changed = false;
  runReport.messages.push(error.message);
  await finishRun();
  console.error(`[update-loop] ${error.message}`);
  process.exitCode = 1;
}

async function prepareWorkDirectory() {
  await rm(workDir, { recursive: true, force: true });
  await mkdir(previousDir, { recursive: true });
}

async function loadPreviousSnapshot() {
  try {
    const snapshot = await downloadPagesSnapshot();
    console.log(`[update-loop] using Pages snapshot: ${snapshot.marketData.updatedAt}`);
    runReport.messages.push("Previous snapshot source: GitHub Pages");
    return snapshot;
  } catch (error) {
    console.warn(`[update-loop] Pages snapshot unavailable: ${error.message}`);
    const snapshot = await readSnapshot(publicDataDir);
    console.log(`[update-loop] using repository snapshot: ${snapshot.marketData.updatedAt}`);
    runReport.messages.push("Previous snapshot source: repository fallback");
    return snapshot;
  }
}

async function downloadPagesSnapshot() {
  const cacheBust = Date.now();
  const [marketResponse, chartResponse] = await Promise.all([
    fetch(`${pagesDataUrl}/market.json?update=${cacheBust}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    }),
    fetch(`${pagesDataUrl}/chartData.json?update=${cacheBust}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    }),
  ]);

  if (!marketResponse.ok || !chartResponse.ok) {
    throw new Error(`Pages returned ${marketResponse.status}/${chartResponse.status}`);
  }

  const snapshot = {
    marketData: await marketResponse.json(),
    chartData: await chartResponse.json(),
  };
  if (!isUsablePreviousSnapshot(snapshot)) {
    throw new Error("Pages snapshot structure is invalid");
  }
  return snapshot;
}

async function runRawFetch() {
  const fetchScript = resolveProjectPath(
    process.env.MARKET_DATA_FETCH_SCRIPT ?? path.join("scripts", "fetch-market-data.mjs"),
  );
  const child = spawn(process.execPath, [fetchScript], {
    cwd: projectRoot,
    env: {
      ...process.env,
      MARKET_DATA_OUTPUT_DIR: candidateDir,
      MARKET_DATA_PREVIOUS_DIR: previousDir,
      MARKET_DATA_STRICT: "1",
    },
    stdio: "inherit",
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  return exitCode === 0;
}

async function promoteCandidate() {
  await mkdir(publicDataDir, { recursive: true });
  await Promise.all([
    copyFile(path.join(candidateDir, "market.json"), path.join(publicDataDir, "market.json")),
    copyFile(path.join(candidateDir, "chartData.json"), path.join(publicDataDir, "chartData.json")),
  ]);
}

async function readSnapshot(directory) {
  const [marketData, chartData] = await Promise.all([
    readJson(path.join(directory, "market.json")),
    readJson(path.join(directory, "chartData.json")),
  ]);
  return { marketData, chartData };
}

async function writeSnapshot(directory, snapshot) {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeJson(path.join(directory, "market.json"), snapshot.marketData),
    writeJson(path.join(directory, "chartData.json"), snapshot.chartData),
  ]);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function waitBeforeRetry() {
  if (retryDelayMs === 0) return;
  console.log(`[update-loop] waiting ${Math.round(retryDelayMs / 1000)} seconds before retry`);
  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
}

async function finishRun() {
  await writeGitHubOutputs();
  await writeGitHubSummary();
  console.log(`[update-loop] status=${runReport.status} changed=${runReport.changed} attempts=${runReport.attempts} repairs=${runReport.repairs}`);
}

async function writeGitHubOutputs() {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = [
    `changed=${runReport.changed}`,
    `status=${runReport.status}`,
    `attempts=${runReport.attempts}`,
    `repairs=${runReport.repairs}`,
  ];
  await appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
}

async function writeGitHubSummary() {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const summary = [
    "## Market data update",
    "",
    "| Field | Result |",
    "| --- | --- |",
    `| Status | ${runReport.status} |`,
    `| Changed | ${runReport.changed} |`,
    `| Attempts | ${runReport.attempts}/${maxAttempts} |`,
    `| Repairs | ${runReport.repairs} |`,
    `| Previous updatedAt | ${runReport.previousUpdatedAt} |`,
    `| Candidate updatedAt | ${runReport.candidateUpdatedAt} |`,
    `| Latest market date | ${runReport.latestMarketDate} |`,
    "",
    ...runReport.messages.map((message) => `- ${message}`),
    "",
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary.join("\n"), "utf8");
}

function resolveProjectPath(target) {
  return path.isAbsolute(target) ? target : path.resolve(projectRoot, target);
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function countInheritedMarketItems(marketData) {
  return Object.entries(marketData ?? {})
    .filter(([, value]) => Array.isArray(value))
    .flatMap(([, items]) => items)
    .filter((item) => item?.updatedAt && item.updatedAt !== marketData.updatedAt)
    .length;
}

function isUsablePreviousSnapshot(snapshot) {
  return snapshot?.marketData
    && typeof snapshot.marketData === "object"
    && Array.isArray(snapshot.marketData.summaryItems)
    && snapshot?.chartData
    && typeof snapshot.chartData === "object"
    && Array.isArray(snapshot.chartData.charts);
}
