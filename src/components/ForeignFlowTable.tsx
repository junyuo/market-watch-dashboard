import type { MarketItem } from "../data/marketData";

type ForeignFlowTableProps = {
  item?: MarketItem;
};

const trendClass = (value: number | string | undefined) => {
  if (typeof value === "number") {
    return value >= 0 ? "trend-up" : "trend-down";
  }

  const text = String(value ?? "");
  if (text.startsWith("-") || text.includes("賣超")) {
    return "trend-down";
  }

  if (text.startsWith("+") || text.includes("買超")) {
    return "trend-up";
  }

  return "trend-neutral";
};

export function ForeignFlowTable({ item }: ForeignFlowTableProps) {
  if (!item) {
    return (
      <section className="foreign-flow-panel" aria-label="外資買賣超">
        <div className="foreign-flow-panel__header">
          <h3>外資買賣超</h3>
          <p>TWSE 三大法人買賣金額統計表，單位：億元。</p>
        </div>
        <div className="empty-chart foreign-flow-empty">資料暫缺</div>
      </section>
    );
  }

  return (
    <section className="foreign-flow-panel" aria-label="外資買賣超">
      <div className="foreign-flow-panel__header">
        <h3>外資買賣超</h3>
        <p>TWSE 三大法人買賣金額統計表，單位：億元。正值代表買超，負值代表賣超。</p>
      </div>
      <div className="table-shell" role="region" aria-label="外資買賣超資料表格" tabIndex={0}>
        <table className="market-table foreign-flow-table">
          <thead>
            <tr>
              <th>項目</th>
              <th>當日買賣超</th>
              <th>較前日增減</th>
              <th>近 5 日累計</th>
              <th>近 1 月累計</th>
              <th>資料日期 / 更新時間</th>
              <th>資料說明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="market-table__name">{item.name}</td>
              <td className={`${trendClass(item.price)} market-table__numeric`}>{item.price}</td>
              <td className={`${trendClass(item.change)} market-table__numeric`}>{item.change}</td>
              <td className={`${trendClass(item.period5d)} market-table__numeric`}>{item.period5d}</td>
              <td className={`${trendClass(item.period1m)} market-table__numeric`}>{item.period1m}</td>
              <td>{item.updatedAt}</td>
              <td className="market-table__note">{item.note ?? "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
