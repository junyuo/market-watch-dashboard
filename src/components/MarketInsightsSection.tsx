import { useMemo } from "react";
import type { DashboardMarketData, MarketItem } from "../data/marketData";
import {
  formatPercent,
  numericValue,
  round,
  type InsightCardData,
  type InsightMetric,
} from "../utils/marketInsights";

type MarketInsightsSectionProps = {
  marketData: DashboardMarketData;
};

export function MarketInsightsSection({ marketData }: MarketInsightsSectionProps) {
  const aiHeatmap = useMemo(() => buildAiSupplyChainHeatmap(marketData.aiSupplyChainItems ?? []), [marketData.aiSupplyChainItems]);
  const foreignFlow = useMemo(() => buildForeignFlowInfographic(marketData), [marketData]);

  const insightCards: InsightCardData[] = [
    aiHeatmap.card,
    foreignFlow.card,
  ];

  return (
    <section className="dashboard-section insights-section">
      <div className="section-heading section-heading--with-control">
        <div>
          <h2>市場訊號 infographic</h2>
          <p>用公開市場資料整理供應鏈熱度與資金方向。</p>
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
