import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardChartData, TimeRange } from "../data/chartData";
import {
  alignByDate,
  formatPercent,
  getAnySeries,
  getSeries,
  normalizeSeries,
  periodReturn,
  periodSpread,
  round,
  timeRanges,
  type InsightCardData,
  type InsightMetric,
} from "../utils/marketInsights";

type MarketInsightsSectionProps = {
  chartData: DashboardChartData;
};

const chartColors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#f59e0b"];

export function MarketInsightsSection({ chartData }: MarketInsightsSectionProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1M");

  const tw0050 = useMemo(() => buildTw0050Insight(chartData, selectedRange), [chartData, selectedRange]);
  const us00646 = useMemo(() => buildUs00646Breakdown(chartData, selectedRange), [chartData, selectedRange]);
  const telecom = useMemo(() => buildTelecomComparison(chartData, selectedRange), [chartData, selectedRange]);
  const fx = useMemo(() => buildFxMiniCards(chartData, selectedRange), [chartData, selectedRange]);

  const insightCards: InsightCardData[] = [
    tw0050.card,
    us00646.card,
  ];

  return (
    <section className="dashboard-section insights-section">
      <div className="section-heading section-heading--with-control">
        <div>
          <h2>線圖區</h2>
          <p>用公開市場資料整理背離、報酬來源與風險狀態。</p>
        </div>
        <div className="range-control" aria-label="市場洞察時間範圍">
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

      <div className="insight-subsection">
        <h3>今日市場洞察卡</h3>
        <div className="insight-card-grid">
          {insightCards.map((card) => (
            <InsightCard key={card.title} card={card} />
          ))}
        </div>
      </div>

      <div className="insight-layout">
        <article className="chart-card insight-panel insight-panel--wide">
          <PanelHeader
            title="0050 權值主導度"
            description="0050、台積電與加權指數正規化走勢，並觀察台積電相對 0050 超額報酬。"
            updatedAt={chartData.updatedAt}
          />
          {tw0050.hasData ? (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={tw0050.rows} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="#d8dee9" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickLine={false} width={56} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} tickLine={false} width={56} />
                  <Tooltip formatter={(value, name) => [value, name]} labelFormatter={(label) => `日期：${label}`} />
                  <Legend verticalAlign="bottom" height={44} />
                  <Line yAxisId="left" type="monotone" dataKey="0050" name="0050" stroke={chartColors[0]} strokeWidth={2.2} dot={false} connectNulls />
                  <Line yAxisId="left" type="monotone" dataKey="TSMC" name="台積電" stroke={chartColors[1]} strokeWidth={2.2} dot={false} connectNulls />
                  <Line yAxisId="left" type="monotone" dataKey="TAIEX" name="加權指數" stroke={chartColors[2]} strokeWidth={2.2} dot={false} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="excess" name="台積電相對 0050 超額報酬" stroke="#9333ea" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                  <ReferenceLine yAxisId="right" y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                </LineChart>
              </ResponsiveContainer>
              <InsightSummary text={tw0050.summary} metrics={tw0050.metrics} />
            </>
          ) : (
            <EmptyInsight />
          )}
        </article>

        <article className="chart-card insight-panel">
          <PanelHeader
            title="00646 報酬來源拆解"
            description="拆解美股、匯率與追蹤差異對 00646 區間報酬的影響。"
            updatedAt={chartData.updatedAt}
          />
          {us00646.hasData ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={us00646.breakdown} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="#d8dee9" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} width={56} />
                  <Tooltip formatter={(value) => [`${value}%`, "區間報酬"]} />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {us00646.breakdown.map((item) => (
                      <Cell key={item.label} fill={item.value >= 0 ? "#c2392f" : "#0f8a4b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <InsightSummary text={us00646.summary} metrics={us00646.metrics} />
            </>
          ) : (
            <EmptyInsight />
          )}
        </article>

        <article className="chart-card insight-panel">
          <PanelHeader
            title="電信防禦性比較"
            description="比較 2412、3045、4904 與加權指數的區間報酬與波動幅度。"
            updatedAt={chartData.updatedAt}
          />
          {telecom.hasData ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={telecom.rows} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="#d8dee9" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="symbol" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} width={56} />
                  <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                  <Legend verticalAlign="bottom" height={36} />
                  <Bar dataKey="return" name="區間報酬" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="volatility" name="波動幅度" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <InsightSummary text={telecom.summary} metrics={telecom.metrics} />
            </>
          ) : (
            <EmptyInsight />
          )}
        </article>

        <article className="chart-card insight-panel">
          <PanelHeader
            title="美元壓力與匯率小卡"
            description="USD/TWD 保留為 00646 匯率貢獻 proxy；JPY/TWD 降級為小卡觀察。"
            updatedAt={chartData.updatedAt}
          />
          <div className="fx-mini-grid">
            {fx.map((item) => (
              <div key={item.symbol} className="fx-mini-card">
                <span>{item.label}</span>
                <strong>{formatPercent(item.returnValue)}</strong>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function InsightCard({ card }: { card: InsightCardData }) {
  return (
    <article className={`insight-card insight-card--${card.level}`}>
      <span>{card.title}</span>
      <strong>{card.status}</strong>
      <p>{card.description}</p>
      <div>
        {card.metrics.map((metric) => (
          <small key={metric.label}>
            {metric.label}：{metric.value}
          </small>
        ))}
      </div>
    </article>
  );
}

function PanelHeader({ title, description, updatedAt }: { title: string; description: string; updatedAt: string }) {
  return (
    <div className="chart-card__header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="insight-updated">更新：{updatedAt}</span>
    </div>
  );
}

function InsightSummary({ text, metrics }: { text: string; metrics: InsightMetric[] }) {
  return (
    <div className="insight-summary">
      <strong>{text}</strong>
      <div>
        {metrics.map((metric) => (
          <span key={metric.label}>
            {metric.label}：{metric.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyInsight() {
  return <div className="empty-chart">資料不足，不產生判讀</div>;
}

function buildTw0050Insight(chartData: DashboardChartData, range: TimeRange) {
  const tw0050 = normalizeSeries(getSeries(chartData, "tw0050", "0050.TW"), range);
  const tsmc = normalizeSeries(getSeries(chartData, "tw0050", "2330.TW"), range);
  const taiex = normalizeSeries(getSeries(chartData, "tw0050", "TAIEX"), range);
  const rows = alignByDate({ "0050": tw0050, TSMC: tsmc, TAIEX: taiex }).map((row) => ({
    ...row,
    excess: typeof row.TSMC === "number" && typeof row["0050"] === "number" ? round(row.TSMC - row["0050"]) : null,
  }));
  const excess = [...rows].reverse().find((row) => typeof row.excess === "number")?.excess as number | undefined;
  const tsmcReturn = periodReturn(getSeries(chartData, "tw0050", "2330.TW"), range);
  const tw0050Return = periodReturn(getSeries(chartData, "tw0050", "0050.TW"), range);
  const hasData = rows.length > 1 && typeof excess === "number";
  const strong = typeof excess === "number" && excess >= 3;

  return {
    hasData,
    rows,
    summary: hasData
      ? strong
        ? "台積電明顯強於 0050，代表近期 0050 上漲偏由半導體權值股推動。"
        : "台積電相對 0050 未明顯擴大，0050 走勢較接近整體權值股表現。"
      : "資料不足，不產生判讀",
    metrics: [
      { label: "台積電區間報酬", value: formatPercent(tsmcReturn) },
      { label: "0050 區間報酬", value: formatPercent(tw0050Return) },
      { label: "超額報酬", value: typeof excess === "number" ? `${round(excess)} 點` : "資料不足" },
    ],
    card: {
      title: "台股權值主導度",
      status: hasData ? (strong ? "台積電主導" : "權值分散") : "資料不足",
      description: hasData ? (strong ? "台積電相對 0050 表現明顯較強。" : "0050 未明顯由單一權值股拉動。") : "資料不足，不產生判讀。",
      level: hasData ? (strong ? "warning" : "neutral") : "neutral",
      metrics: [
        { label: "超額報酬", value: typeof excess === "number" ? `${round(excess)} 點` : "資料不足" },
      ],
    } satisfies InsightCardData,
  };
}

function buildUs00646Breakdown(chartData: DashboardChartData, range: TimeRange) {
  const etfReturn = periodReturn(getSeries(chartData, "us00646", "00646.TW"), range);
  const spReturn = periodReturn(getSeries(chartData, "us00646", "SPY"), range);
  const usdReturn = periodReturn(getSeries(chartData, "us00646", "USD/TWD"), range);
  const tracking = etfReturn !== null && spReturn !== null && usdReturn !== null ? etfReturn - spReturn - usdReturn : null;
  const hasData = [etfReturn, spReturn, usdReturn, tracking].every((item) => item !== null);
  const mainDriver = hasData && Math.abs(spReturn ?? 0) >= Math.abs(usdReturn ?? 0) ? "美股上漲" : "匯率變化";

  return {
    hasData,
    breakdown: [
      { label: "S&P 500", value: round(spReturn ?? 0) },
      { label: "USD/TWD", value: round(usdReturn ?? 0) },
      { label: "追蹤差異", value: round(tracking ?? 0) },
      { label: "00646", value: round(etfReturn ?? 0) },
    ],
    summary: hasData
      ? mainDriver === "美股上漲"
        ? "00646 區間報酬主要來自美股變化，匯率貢獻相對有限。"
        : "00646 區間報酬中匯率變化影響較明顯。"
      : "資料不足，不產生判讀",
    metrics: [
      { label: "00646", value: formatPercent(etfReturn) },
      { label: "S&P 500 proxy", value: formatPercent(spReturn) },
      { label: "USD/TWD", value: formatPercent(usdReturn) },
      { label: "追蹤差異", value: formatPercent(tracking) },
    ],
    card: {
      title: "美股 ETF 報酬來源",
      status: hasData ? mainDriver : "資料不足",
      description: hasData ? `目前 ${mainDriver} 對 00646 的區間表現較關鍵。` : "資料不足，不產生判讀。",
      level: "neutral",
      metrics: [
        { label: "00646", value: formatPercent(etfReturn) },
        { label: "USD/TWD", value: formatPercent(usdReturn) },
      ],
    } satisfies InsightCardData,
  };
}

function buildTelecomComparison(chartData: DashboardChartData, range: TimeRange) {
  const definitions = [
    { symbol: "2412.TW", label: "2412" },
    { symbol: "3045.TW", label: "3045" },
    { symbol: "4904.TW", label: "4904" },
    { symbol: "TAIEX", label: "加權" },
  ];
  const rows = definitions
    .map((definition) => {
      const series = getAnySeries(chartData, definition.symbol);
      return {
        symbol: definition.label,
        return: round(periodReturn(series, range) ?? 0),
        volatility: round(periodSpread(series, range) ?? 0),
        hasData: periodReturn(series, range) !== null && periodSpread(series, range) !== null,
      };
    })
    .filter((row) => row.hasData);

  const telecomRows = rows.filter((row) => row.symbol !== "加權");
  const market = rows.find((row) => row.symbol === "加權");
  const avgTelecomVolatility = telecomRows.length
    ? telecomRows.reduce((sum, row) => sum + row.volatility, 0) / telecomRows.length
    : null;
  const defensive = avgTelecomVolatility !== null && market ? avgTelecomVolatility < market.volatility : false;

  return {
    hasData: rows.length >= 3,
    rows,
    summary: rows.length >= 3
      ? defensive
        ? "電信股波動低於大盤，具防禦性，但上漲參與度有限。"
        : "電信股波動未明顯低於大盤，防禦性訊號不明顯。"
      : "資料不足，不產生判讀",
    metrics: [
      { label: "電信平均波動", value: avgTelecomVolatility === null ? "資料不足" : `${round(avgTelecomVolatility)}%` },
      { label: "大盤波動", value: market ? `${market.volatility}%` : "資料不足" },
    ],
  };
}

function buildFxMiniCards(chartData: DashboardChartData, range: TimeRange) {
  const usd = periodReturn(getSeries(chartData, "usdTwd", "USD/TWD"), range);
  const jpy = periodReturn(getSeries(chartData, "jpyTwd", "JPY/TWD"), range);
  return [
    {
      symbol: "USD/TWD",
      label: "USD/TWD 美元壓力",
      returnValue: usd,
      description: usd === null ? "資料不足，不產生判讀" : usd > 0 ? "美元相對台幣走強，海外 ETF 匯率貢獻偏正。" : "美元相對台幣走弱，海外 ETF 匯率貢獻偏弱。",
    },
    {
      symbol: "JPY/TWD",
      label: "JPY/TWD 小卡",
      returnValue: jpy,
      description: "日圓兌台幣先作為小型匯率觀察，不佔主要線圖區。",
    },
  ];
}
