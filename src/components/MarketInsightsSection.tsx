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
import type { DashboardMarketData, MarketItem } from "../data/marketData";
import {
  alignByDate,
  formatPercent,
  getSeries,
  normalizeSeries,
  numericValue,
  periodReturn,
  round,
  timeRanges,
  type InsightCardData,
  type InsightMetric,
} from "../utils/marketInsights";

type MarketInsightsSectionProps = {
  marketData: DashboardMarketData;
  chartData: DashboardChartData;
};

const chartColors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#f59e0b"];

export function MarketInsightsSection({ marketData, chartData }: MarketInsightsSectionProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1M");

  const tw0050 = useMemo(() => buildTw0050Insight(chartData, selectedRange), [chartData, selectedRange]);
  const us00646 = useMemo(() => buildUs00646Breakdown(chartData, selectedRange), [chartData, selectedRange]);
  const aiHeatmap = useMemo(() => buildAiSupplyChainHeatmap(marketData.aiSupplyChainItems ?? []), [marketData.aiSupplyChainItems]);
  const foreignFlow = useMemo(() => buildForeignFlowInfographic(marketData), [marketData]);

  const insightCards: InsightCardData[] = [
    tw0050.card,
    us00646.card,
    aiHeatmap.card,
    foreignFlow.card,
  ];

  return (
    <section className="dashboard-section insights-section">
      <div className="section-heading section-heading--with-control">
        <div>
          <h2>市場訊號 infographic</h2>
          <p>用公開市場資料整理主因、背離、供應鏈熱度與資金方向。</p>
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
            title="AI 供應鏈熱度地圖"
            description="依 HBM、CoWoS、AI Server、Power Electronics 分組，觀察區間報酬與 Bias 熱度。"
            updatedAt={marketData.updatedAt}
          />
          {aiHeatmap.hasData ? (
            <>
              <div className="heatmap-grid">
                {aiHeatmap.groups.map((group) => (
                  <div key={group.category} className="heatmap-group">
                    <div className="heatmap-group__header">
                      <strong>{group.category}</strong>
                      <span>平均 {formatPercent(group.averageReturn)}</span>
                    </div>
                    <div className="heatmap-cells">
                      {group.items.map((item) => (
                        <div key={item.symbol} className={`heatmap-cell heatmap-cell--${item.level}`}>
                          <div>
                            <strong>{item.symbol}</strong>
                            <span>{item.name}</span>
                          </div>
                          <b>{formatPercent(item.returnValue)}</b>
                          <small>Bias {formatPercent(item.bias)}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <InsightSummary text={aiHeatmap.summary} metrics={aiHeatmap.metrics} />
            </>
          ) : (
            <EmptyInsight />
          )}
        </article>

        <article className="chart-card insight-panel">
          <PanelHeader
            title="外資資金方向"
            description="把外資買賣超表格轉成 1D、5D、1M 資金方向條，快速觀察資金流向。"
            updatedAt={marketData.updatedAt}
          />
          {foreignFlow.hasData ? (
            <>
              <div className="flow-bars">
                {foreignFlow.bars.map((bar) => (
                  <div key={bar.label} className="flow-bar-row">
                    <span>{bar.label}</span>
                    <div className="flow-bar-track" aria-hidden="true">
                      <i
                        className={bar.value >= 0 ? "flow-bar flow-bar--buy" : "flow-bar flow-bar--sell"}
                        style={{
                          width: `${bar.width}%`,
                          marginLeft: bar.value >= 0 ? "50%" : `${50 - bar.width}%`,
                        }}
                      />
                    </div>
                    <strong className={bar.value >= 0 ? "trend-up" : "trend-down"}>{formatAmount(bar.value)} 億</strong>
                  </div>
                ))}
              </div>
              <InsightSummary text={foreignFlow.summary} metrics={foreignFlow.metrics} />
            </>
          ) : (
            <EmptyInsight />
          )}
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

function buildAiSupplyChainHeatmap(items: MarketItem[]) {
  const validItems = items
    .map((item) => {
      const returnValue = numericValue(item.period1m);
      const bias = numericValue(item.bias ?? "N/A");
      return {
        symbol: item.symbol,
        name: item.name,
        category: item.category,
        returnValue,
        bias,
        level: heatLevel(returnValue, bias),
      };
    })
    .filter((item) => item.returnValue !== null || item.bias !== null);

  const categories = Array.from(new Set(validItems.map((item) => item.category)));
  const groups = categories.map((category) => {
    const groupItems = validItems.filter((item) => item.category === category);
    const returns = groupItems.map((item) => item.returnValue).filter((value): value is number => value !== null);
    return {
      category,
      averageReturn: returns.length ? round(returns.reduce((sum, value) => sum + value, 0) / returns.length) : null,
      items: groupItems,
    };
  });
  const rankedGroups = [...groups].sort((a, b) => (b.averageReturn ?? -Infinity) - (a.averageReturn ?? -Infinity));
  const leader = rankedGroups.find((group) => group.averageReturn !== null);
  const hotItems = validItems.filter((item) => (item.returnValue ?? 0) >= 10 || (item.bias ?? 0) >= 10).length;
  const hasData = validItems.length > 0;

  return {
    hasData,
    groups,
    summary: hasData && leader
      ? `${leader.category} 近 1 月平均表現相對較強；高熱度標的共 ${hotItems} 檔，需搭配 Bias 觀察是否偏熱。`
      : "資料不足，不產生判讀",
    metrics: [
      { label: "最強分類", value: leader ? leader.category : "資料不足" },
      { label: "高熱度檔數", value: hasData ? `${hotItems} 檔` : "資料不足" },
      { label: "觀察標的", value: hasData ? `${validItems.length} 檔` : "資料不足" },
    ],
    card: {
      title: "AI 供應鏈熱度",
      status: leader ? leader.category : "資料不足",
      description: leader ? `${leader.category} 目前在 AI 供應鏈中相對強勢。` : "資料不足，不產生判讀。",
      level: hotItems >= 6 ? "warning" : "neutral",
      metrics: [
        { label: "高熱度檔數", value: hasData ? `${hotItems} 檔` : "資料不足" },
      ],
    } satisfies InsightCardData,
  };
}

function buildForeignFlowInfographic(marketData: DashboardMarketData) {
  const item = marketData.fxMacroItems.find((candidate) => candidate.symbol === "Foreign Flow");
  const rawBars = [
    { label: "當日", value: parseAmount(item?.price) },
    { label: "較前日", value: parseAmount(item?.change) },
    { label: "近 5 日", value: parseAmount(item?.period5d) },
    { label: "近 1 月", value: parseAmount(item?.period1m) },
  ];
  const hasData = rawBars.every((bar) => bar.value !== null);
  const maxAbs = Math.max(...rawBars.map((bar) => Math.abs(bar.value ?? 0)), 1);
  const bars = rawBars.map((bar) => ({
    label: bar.label,
    value: bar.value ?? 0,
    width: Math.max(3, Math.min(50, (Math.abs(bar.value ?? 0) / maxAbs) * 50)),
  }));
  const today = rawBars[0].value;
  const monthly = rawBars[3].value;
  const direction = today === null ? "資料不足" : today >= 0 ? "外資買超" : "外資賣超";

  return {
    hasData,
    bars,
    summary: hasData
      ? `${direction}，近 1 月累計為 ${formatAmount(monthly ?? 0)} 億，資金方向可搭配美元與加權指數觀察。`
      : "資料不足，不產生判讀",
    metrics: [
      { label: "當日", value: today === null ? "資料不足" : `${formatAmount(today)} 億` },
      { label: "近 1 月", value: monthly === null ? "資料不足" : `${formatAmount(monthly)} 億` },
    ],
    card: {
      title: "外資資金方向",
      status: direction,
      description: hasData ? "以 TWSE 外資買賣超觀察台股資金面方向。" : "資料不足，不產生判讀。",
      level: today !== null && today < 0 ? "warning" : "neutral",
      metrics: [
        { label: "當日", value: today === null ? "資料不足" : `${formatAmount(today)} 億` },
      ],
    } satisfies InsightCardData,
  };
}

function heatLevel(returnValue: number | null, bias: number | null) {
  const heat = Math.max(returnValue ?? -Infinity, bias ?? -Infinity);
  if (heat >= 30) return "hot";
  if (heat >= 10) return "warm";
  if ((returnValue ?? 0) < 0) return "cool";
  return "neutral";
}

function parseAmount(value: MarketItem["price"] | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 }).format(value);
}
