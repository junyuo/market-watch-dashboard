import assert from "node:assert/strict";
import test from "node:test";
import { repairSnapshot, snapshotsEqual, validateSnapshot } from "./dataValidation.mjs";

test("accepts a complete and fresh snapshot", () => {
  const snapshot = makeSnapshot();
  const result = validateSnapshot({ ...snapshot, enforceFreshness: true });
  assert.equal(result.valid, true, result.errors.join("\n"));
});

test("ignores updatedAt when detecting semantic changes", () => {
  const previous = makeSnapshot("2026-06-22 08:30:00 UTC+8");
  const candidate = structuredClone(previous);
  candidate.marketData.updatedAt = "2026-06-22 17:30:00 UTC+8";
  candidate.chartData.updatedAt = "2026-06-22 17:30:00 UTC+8";
  candidate.marketData.summaryItems.forEach((item) => {
    item.updatedAt = "2026-06-22 17:30:00 UTC+8";
  });
  assert.equal(snapshotsEqual(candidate, previous), true);
});

test("repairs invalid item fields and chart series from previous data", () => {
  const previous = makeSnapshot();
  const candidate = structuredClone(previous);
  candidate.marketData.summaryItems[0].price = null;
  candidate.chartData.charts.find((chart) => chart.id === "risk").series[0].data = [];

  const repaired = repairSnapshot(candidate, previous);
  assert.equal(repaired.marketData.summaryItems[0].price, previous.marketData.summaryItems[0].price);
  assert.deepEqual(
    repaired.chartData.charts.find((chart) => chart.id === "risk").series[0].data,
    previous.chartData.charts.find((chart) => chart.id === "risk").series[0].data,
  );
  assert.ok(repaired.repairs.length >= 2);
  assert.equal(validateSnapshot({ ...repaired, previous, enforceFreshness: false }).valid, true);
});

test("rejects a chart whose latest date regresses", () => {
  const previous = makeSnapshot();
  const candidate = structuredClone(previous);
  const series = candidate.chartData.charts.find((chart) => chart.id === "tw0050").series[0];
  series.data = [
    { date: "2026-01-01", value: 100 },
    { date: "2026-01-02", value: 101 },
  ];

  const result = validateSnapshot({ ...candidate, previous, enforceFreshness: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("latest date regressed")));
});

function makeSnapshot(updatedAt = taipeiTimestamp()) {
  const groups = {
    summaryItems: makeItems(4, "0050"),
    riskIndicators: makeItems(5, "Risk"),
    tw0050Items: makeItems(8, "0050"),
    us00646Items: makeItems(11, "00646"),
    aiSupplyChainItems: makeItems(16, "AI"),
    cht2412Items: makeItems(3, "2412"),
    fxMacroItems: makeItems(4, "FX"),
  };
  Object.values(groups).flat().forEach((item) => {
    item.updatedAt = updatedAt;
  });

  return {
    marketData: { updatedAt, ...groups },
    chartData: {
      updatedAt,
      charts: [
        chart("tw0050", ["0050.TW", "2330.TW"]),
        chart("us00646", ["00646.TW", "SPY", "USD/TWD"]),
        chart("usdTwd", ["USD/TWD"]),
        chart("jpyTwd", ["JPY/TWD"]),
        chart("cht2412", ["2412.TW"]),
        chart("risk", ["VIX", "TNX", "GLD"]),
      ],
    },
  };
}

function makeItems(count, relatedAsset) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${relatedAsset} item ${index}`,
    symbol: `${relatedAsset}-${index}`,
    category: "test",
    price: 100 + index,
    change: 1,
    changePercent: 1,
    period5d: 2,
    period1m: 3,
    relatedAsset,
    updatedAt: taipeiTimestamp(),
  }));
}

function chart(id, symbols) {
  const dates = recentDates();
  return {
    id,
    title: id,
    description: id,
    normalized: false,
    series: symbols.map((symbol) => ({
      name: symbol,
      symbol,
      relatedAsset: "Risk",
      data: [
        { date: dates[0], value: 100 },
        { date: dates[1], value: 101 },
      ],
    })),
  };
}

function recentDates() {
  const latest = new Date();
  const previous = new Date(latest);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return [previous.toISOString().slice(0, 10), latest.toISOString().slice(0, 10)];
}

function taipeiTimestamp() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(" ", " ") + " UTC+8";
}
