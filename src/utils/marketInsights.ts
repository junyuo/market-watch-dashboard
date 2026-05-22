import type { DashboardChartData, TimeRange, TimeSeriesPoint } from "../data/chartData";
import type { DashboardMarketData, MarketItem } from "../data/marketData";

export type InsightMetric = {
  label: string;
  value: string;
};

export type InsightCardData = {
  title: string;
  status: string;
  description: string;
  metrics: InsightMetric[];
  level: "calm" | "neutral" | "warning" | "stress";
};

export const timeRanges: TimeRange[] = ["1M", "3M", "6M", "YTD", "1Y"];

export const rangeStartDate = (range: TimeRange, latestDate: string) => {
  const latest = new Date(`${latestDate}T00:00:00`);
  if (Number.isNaN(latest.getTime()) || range === "1Y") {
    return undefined;
  }

  const start = new Date(latest);
  if (range === "YTD") {
    start.setMonth(0, 1);
    return start.toISOString().slice(0, 10);
  }

  const monthsByRange: Partial<Record<TimeRange, number>> = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
  };

  start.setMonth(start.getMonth() - (monthsByRange[range] ?? 12));
  return start.toISOString().slice(0, 10);
};

export const filterByRange = (series: TimeSeriesPoint[], range: TimeRange) => {
  if (!series.length) {
    return [];
  }

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const start = rangeStartDate(range, sorted[sorted.length - 1].date);
  return start ? sorted.filter((point) => point.date >= start) : sorted;
};

export const getSeries = (chartData: DashboardChartData, chartId: string, symbol: string) =>
  chartData.charts
    .find((chart) => chart.id === chartId)
    ?.series.find((series) => series.symbol === symbol)?.data ?? [];

export const getAnySeries = (chartData: DashboardChartData, symbol: string) =>
  chartData.charts.flatMap((chart) => chart.series).find((series) => series.symbol === symbol)?.data ?? [];

export const periodReturn = (series: TimeSeriesPoint[], range: TimeRange) => {
  const visible = filterByRange(series, range).filter((point) => Number.isFinite(point.value));
  const first = visible[0]?.value;
  const last = visible[visible.length - 1]?.value;

  if (visible.length < 2 || !first || typeof last !== "number") {
    return null;
  }

  return ((last - first) / first) * 100;
};

export const periodSpread = (series: TimeSeriesPoint[], range: TimeRange) => {
  const visible = filterByRange(series, range).filter((point) => Number.isFinite(point.value));
  if (visible.length < 2) {
    return null;
  }

  const base = visible[0].value;
  if (!base) {
    return null;
  }

  const returns = visible.map((point) => ((point.value - base) / base) * 100);
  return Math.max(...returns) - Math.min(...returns);
};

export const normalizeSeries = (series: TimeSeriesPoint[], range: TimeRange) => {
  const visible = filterByRange(series, range).filter((point) => Number.isFinite(point.value));
  const first = visible[0]?.value;
  if (!first) {
    return [];
  }

  return visible.map((point) => ({
    date: point.date,
    value: round((point.value / first) * 100),
  }));
};

export const alignByDate = (seriesMap: Record<string, TimeSeriesPoint[]>) => {
  const entries = Object.entries(seriesMap);
  const dates = Array.from(new Set(entries.flatMap(([, series]) => series.map((point) => point.date)))).sort();

  return dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    entries.forEach(([key, series]) => {
      row[key] = series.find((point) => point.date === date)?.value ?? null;
    });
    return row;
  });
};

export const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const formatPercent = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "資料不足";
  }

  const rounded = round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
};

export const formatScore = (value: number | null) =>
  value === null || Number.isNaN(value) ? "資料不足" : `${Math.round(value)}`;

export const marketItem = (marketData: DashboardMarketData, symbol: string): MarketItem | undefined =>
  [
    ...marketData.summaryItems,
    ...marketData.riskIndicators,
    ...marketData.tw0050Items,
    ...marketData.us00646Items,
    ...marketData.cht2412Items,
    ...marketData.fxMacroItems,
  ].find((item) => item.symbol === symbol);

export const numericValue = (value: MarketItem["price"] | MarketItem["period1m"]) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
};

export const weatherForScore = (score: number | null) => {
  if (score === null) {
    return { label: "資料不足", level: "neutral" as const };
  }

  if (score <= 30) {
    return { label: "平穩", level: "calm" as const };
  }

  if (score <= 60) {
    return { label: "中性", level: "neutral" as const };
  }

  if (score <= 80) {
    return { label: "緊張", level: "warning" as const };
  }

  return { label: "恐慌", level: "stress" as const };
};
