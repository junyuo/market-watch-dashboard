import type { MarketItem } from "../data/marketData";

type SummaryCardProps = {
  item: MarketItem;
};

const isPositive = (value: MarketItem["change"]) => {
  if (typeof value === "number") {
    return value >= 0;
  }

  return !value.trim().startsWith("-");
};

const formatSigned = (value: number | string, suffix = "") => {
  if (typeof value === "number") {
    return `${value > 0 ? "+" : ""}${value}${suffix}`;
  }

  return value;
};

export function SummaryCard({ item }: SummaryCardProps) {
  const trendClass = isPositive(item.change) ? "trend-up" : "trend-down";

  return (
    <article className="summary-card">
      <div className="summary-card__topline">
        <span>{item.category}</span>
        <strong>{item.symbol}</strong>
      </div>
      <h3>{item.name}</h3>
      <div className="summary-card__price">{item.price}</div>
      <div className={`summary-card__change ${trendClass}`}>
        <span>{formatSigned(item.change)}</span>
        <span>{formatSigned(item.changePercent, "%")}</span>
      </div>
      <p>更新時間：{item.updatedAt}</p>
    </article>
  );
}
