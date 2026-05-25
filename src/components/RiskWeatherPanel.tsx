import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { DashboardChartData, TimeRange, TimeSeriesPoint } from "../data/chartData";
import type { DashboardMarketData } from "../data/marketData";
import {
  filterByRange,
  formatScore,
  marketItem,
  numericValue,
  timeRanges,
  weatherForScore,
} from "../utils/marketInsights";

type RiskWeatherPanelProps = {
  marketData: DashboardMarketData;
  chartData: DashboardChartData;
};

type RiskIndicator = {
  symbol: string;
  score: number;
  note: string;
  sparkline: TimeSeriesPoint[];
};

export function RiskWeatherPanel({ marketData, chartData }: RiskWeatherPanelProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1M");
  const risk = useMemo(() => buildRiskWeather(marketData, chartData, selectedRange), [marketData, chartData, selectedRange]);

  return (
    <div className="risk-weather-panel">
      <div className="chart-card__header">
        <div>
          <h3>市場風險天氣</h3>
          <p>以 VIX、TNX、DXY、GLD、USO、TIP 的公開市場變化估算 Risk Score。</p>
        </div>
        <div className="range-control" aria-label="市場風險天氣時間範圍">
          {timeRanges.map((range) => (
            <button
              key={range}
              className={selectedRange === range ? "is-active" : ""}
              type="button"
              onClick={() => setSelectedRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="risk-weather">
        <div className={`risk-score risk-score--${risk.weather.level}`}>
          <span>Risk Score</span>
          <strong>{formatScore(risk.score)}</strong>
          <em>{risk.weather.label}</em>
        </div>
        <div className="sparkline-grid">
          {risk.indicators.map((indicator) => (
            <SparklineCard key={indicator.symbol} indicator={indicator} />
          ))}
        </div>
      </div>
      <div className="insight-summary">
        <strong>{risk.summary}</strong>
        <div>
          {risk.metrics.map((metric) => (
            <span key={metric.label}>
              {metric.label}：{metric.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SparklineCard({ indicator }: { indicator: RiskIndicator }) {
  return (
    <div className="sparkline-card">
      <div>
        <span>{indicator.symbol}</span>
        <strong>{indicator.score} 分</strong>
      </div>
      <ResponsiveContainer width="100%" height={48}>
        <LineChart data={indicator.sparkline}>
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <small>{indicator.note}</small>
    </div>
  );
}

function buildRiskWeather(marketData: DashboardMarketData, chartData: DashboardChartData, range: TimeRange) {
  const riskDefinitions = [
    { symbol: "VIX", weight: 0.25, score: scoreVix },
    { symbol: "TNX", weight: 0.2, score: scoreChange },
    { symbol: "DXY", weight: 0.15, score: scoreChange },
    { symbol: "GLD", weight: 0.15, score: scoreChange },
    { symbol: "USO", weight: 0.15, score: scoreChange },
    { symbol: "TIP", weight: 0.1, score: scoreTip },
  ];

  const indicators: RiskIndicator[] = riskDefinitions.map((definition) => {
    const item = marketItem(marketData, definition.symbol);
    const value = numericValue(item?.price ?? "N/A");
    const period1m = numericValue(item?.period1m ?? "N/A");
    const score = definition.score(value, period1m);
    return {
      symbol: definition.symbol,
      score,
      note: item ? `${item.category}：${item.period1m}%` : "資料不足",
      sparkline: filterByRange(getAnySeries(chartData, definition.symbol), range),
    };
  });

  const score = indicators.length
    ? indicators.reduce((sum, indicator, index) => sum + indicator.score * riskDefinitions[index].weight, 0)
    : null;
  const weather = weatherForScore(score);

  return {
    score,
    weather,
    indicators,
    summary: score === null ? "資料不足，不產生判讀" : `市場風險天氣為「${weather.label}」，Risk Score 約 ${Math.round(score)}。`,
    metrics: [
      { label: "Risk Score", value: formatScore(score) },
      { label: "市場天氣", value: weather.label },
    ],
  };
}

function getAnySeries(chartData: DashboardChartData, symbol: string) {
  return chartData.charts.flatMap((chart) => chart.series).find((series) => series.symbol === symbol)?.data ?? [];
}

function scoreVix(value: number | null) {
  if (value === null) return 50;
  if (value >= 25) return 90;
  if (value >= 15) return 55;
  return 20;
}

function scoreChange(_value: number | null, period1m: number | null) {
  if (period1m === null) return 50;
  if (period1m >= 5) return 75;
  if (period1m <= -5) return 35;
  return 50;
}

function scoreTip(_value: number | null, period1m: number | null) {
  if (period1m === null) return 50;
  if (period1m >= 1) return 65;
  if (period1m <= -1) return 45;
  return 50;
}
