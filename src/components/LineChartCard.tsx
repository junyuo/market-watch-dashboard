import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardChart, TimeRange } from "../data/chartData";

type LineChartCardProps = {
  chart: DashboardChart;
};

const timeRanges: TimeRange[] = ["1M", "3M", "6M", "YTD", "1Y"];

const chartColors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b"];

export function LineChartCard({ chart }: LineChartCardProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("3M");

  const data = useMemo(() => {
    const dates = chart.series[0]?.data.map((point) => point.date) ?? [];

    return dates.map((date, index) => {
      const row: Record<string, string | number> = { date };

      chart.series.forEach((item) => {
        row[item.symbol] = item.data[index]?.value ?? 0;
      });

      return row;
    });
  }, [chart.series]);

  return (
    <article className="chart-card">
      <div className="chart-card__header">
        <div>
          <h3>{chart.title}</h3>
          <p>{chart.description}</p>
        </div>
        <div className="range-control" aria-label={`${chart.title} 時間篩選`}>
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

      <div className="chart-card__meta">
        <span>{chart.normalized ? "正規化起點：100" : "實際數值"}</span>
        <span>目前期間：{selectedRange}</span>
        {chart.dualAxis ? <span>左軸：股價 / 右軸：殖利率</span> : null}
      </div>

      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#d8dee9" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickLine={false}
              width={56}
              domain={chart.normalized ? ["dataMin - 4", "dataMax + 4"] : ["auto", "auto"]}
            />
            {chart.dualAxis ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                width={56}
                domain={["auto", "auto"]}
              />
            ) : null}
            <Tooltip
              formatter={(value, name) => [value, name]}
              labelFormatter={(label) => `日期：${label}`}
            />
            <Legend verticalAlign="bottom" height={36} />
            {chart.series.map((item, index) => (
              <Line
                key={item.symbol}
                yAxisId={item.yAxisId ?? "left"}
                type="monotone"
                dataKey={item.symbol}
                name={`${item.name} (${item.symbol})`}
                stroke={chartColors[index % chartColors.length]}
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
