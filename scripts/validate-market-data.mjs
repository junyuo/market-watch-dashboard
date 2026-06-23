import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { latestChartDate, validateSnapshot } from "./lib/dataValidation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const options = parseArgs(process.argv.slice(2));

try {
  const snapshot = await readSnapshot(resolvePath(options.dataDir ?? "public/data"));
  const previous = options.previousDir ? await readSnapshot(resolvePath(options.previousDir)) : undefined;
  const result = validateSnapshot({
    ...snapshot,
    previous,
    enforceFreshness: !options.allowStale,
  });

  for (const warning of result.warnings) console.warn(`[validate-data] warning: ${warning}`);
  if (!result.valid) {
    for (const error of result.errors) console.error(`[validate-data] error: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[validate-data] valid; latest market date: ${latestChartDate(snapshot.chartData) ?? "unknown"}`);
  }
} catch (error) {
  console.error(`[validate-data] ${error.message}`);
  process.exitCode = 1;
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--data-dir") parsed.dataDir = args[++index];
    else if (args[index] === "--previous-dir") parsed.previousDir = args[++index];
    else if (args[index] === "--allow-stale") parsed.allowStale = true;
  }
  return parsed;
}

function resolvePath(target) {
  return path.isAbsolute(target) ? target : path.resolve(projectRoot, target);
}

async function readSnapshot(directory) {
  const [marketData, chartData] = await Promise.all([
    readJson(path.join(directory, "market.json")),
    readJson(path.join(directory, "chartData.json")),
  ]);
  return { marketData, chartData };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
