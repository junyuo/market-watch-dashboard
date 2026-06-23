import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const outputDir = process.env.MARKET_DATA_OUTPUT_DIR;
const previousDir = process.env.MARKET_DATA_PREVIOUS_DIR;

if (!outputDir || !previousDir) {
  throw new Error("Test fetch fixture requires output and previous directories");
}

await mkdir(outputDir, { recursive: true });
await Promise.all([
  copyFile(path.join(previousDir, "market.json"), path.join(outputDir, "market.json")),
  copyFile(path.join(previousDir, "chartData.json"), path.join(outputDir, "chartData.json")),
]);
