import type { MarketItem } from "../data/marketData";

type MarketTableProps = {
  items: MarketItem[];
};

const trendClass = (value: MarketItem["change"] | MarketItem["changePercent"]) => {
  if (typeof value === "number") {
    return value >= 0 ? "trend-up" : "trend-down";
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("-") || trimmed.includes("賣超")) {
    return "trend-down";
  }

  if (trimmed.startsWith("+") || trimmed.includes("買超") || trimmed.includes("增加")) {
    return "trend-up";
  }

  return "trend-neutral";
};

const formatValue = (value: number | string, suffix = "") => {
  if (typeof value !== "number") {
    return value;
  }

  return `${value > 0 && suffix ? "+" : ""}${value}${suffix}`;
};

export function MarketTable({ items }: MarketTableProps) {
  return (
    <div className="table-shell" role="region" aria-label="市場資料表格" tabIndex={0}>
      <table className="market-table">
        <thead>
          <tr>
            <th>名稱</th>
            <th>代號</th>
            <th>分類</th>
            <th>最新數值</th>
            <th>漲跌</th>
            <th>漲跌幅</th>
            <th>近 5 日</th>
            <th>近 1 月</th>
            <th>影響標的</th>
            <th>更新時間</th>
            <th>觀察說明</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.relatedAsset}-${item.symbol}-${item.name}`}>
              <td className="market-table__name">{item.name}</td>
              <td>{item.symbol}</td>
              <td>{item.category}</td>
              <td>{item.price}</td>
              <td className={trendClass(item.change)}>{formatValue(item.change)}</td>
              <td className={trendClass(item.changePercent)}>
                {formatValue(item.changePercent, "%")}
              </td>
              <td className={trendClass(item.period5d)}>{formatValue(item.period5d, "%")}</td>
              <td className={trendClass(item.period1m)}>{formatValue(item.period1m, "%")}</td>
              <td>{item.relatedAsset}</td>
              <td>{item.updatedAt}</td>
              <td className="market-table__note">{item.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
