import type { MarketItem } from "../data/marketData";
import {
  getGldSignal,
  getTipSignal,
  getTnxSignal,
  getUsoSignal,
  getVixSignal,
  type RiskSignal,
} from "../utils/riskSignals";

type MarketTableProps = {
  items: MarketItem[];
  showRiskSignals?: boolean;
  hideNotes?: boolean;
  hideRelatedAsset?: boolean;
  showTechnicalMetrics?: boolean;
  showTechnicalRiskHint?: boolean;
  alignChangeColumns?: boolean;
  formatPriceWithThousandsSeparator?: boolean;
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

const formatThousands = (value: number | string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }

  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits: 6,
  }).format(value);
};

const toNumber = (value: number | string) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const estimatePointChange = (currentValue: number | null, periodChangePercent: number | null) => {
  if (currentValue === null || periodChangePercent === null || periodChangePercent <= -100) {
    return null;
  }

  const baseValue = currentValue / (1 + periodChangePercent / 100);
  return currentValue - baseValue;
};

const technicalRiskHint = (item: MarketItem) => {
  const price = toNumber(item.price);
  const ma60 = toNumber(item.ma60 ?? "N/A");
  const bias = toNumber(item.bias ?? "N/A");

  if (price === null || ma60 === null || bias === null) {
    return { label: "資料暫缺", level: "unavailable" };
  }

  if (price > ma60 && bias >= 15) {
    return { label: "短期漲幅偏熱", level: "warning" };
  }

  if (price > ma60) {
    return { label: "趨勢偏強", level: "rising" };
  }

  if (price < ma60 && bias <= -15) {
    return { label: "修正壓力", level: "stress" };
  }

  if (price < ma60) {
    return { label: "趨勢偏弱", level: "falling" };
  }

  return { label: "接近均線", level: "flat" };
};

const riskSignalForItem = (item: MarketItem): RiskSignal => {
  const value = toNumber(item.price);
  const period5dChangePercent = toNumber(item.period5d);
  const period1mChangePercent = toNumber(item.period1m);
  const baseInput = {
    symbol: item.symbol,
    name: item.name,
    value,
    period5dChangePercent,
    period1mChangePercent,
    period1mChangePoint: estimatePointChange(value, period1mChangePercent),
  };

  switch (item.symbol) {
    case "VIX":
      return getVixSignal(baseInput);
    case "TNX":
      return getTnxSignal(baseInput);
    case "USO":
      return getUsoSignal(baseInput);
    case "TIP":
      return getTipSignal(baseInput);
    case "GLD":
      return getGldSignal(baseInput);
    default:
      return {
        ...baseInput,
        status: "資料暫缺",
        level: "unavailable",
        description: "此指標尚未設定市場風險狀態判斷規則。",
      };
  }
};

const RiskSignalCell = ({ item }: { item: MarketItem }) => {
  const signal = riskSignalForItem(item);

  return (
    <div className="risk-signal">
      <span className={`risk-signal__badge risk-signal__badge--${signal.level}`}>
        {signal.status}
      </span>
      <span className="risk-signal__description">{signal.description}</span>
    </div>
  );
};

const TechnicalRiskHint = ({ item }: { item: MarketItem }) => {
  const hint = technicalRiskHint(item);

  return (
    <span className={`technical-risk technical-risk--${hint.level}`}>
      {hint.label}
    </span>
  );
};

export function MarketTable({
  items,
  showRiskSignals = false,
  hideNotes = false,
  hideRelatedAsset = false,
  showTechnicalMetrics = false,
  showTechnicalRiskHint = false,
  alignChangeColumns = false,
  formatPriceWithThousandsSeparator = false,
}: MarketTableProps) {
  const alignNumericColumns = showRiskSignals || showTechnicalMetrics;
  const alignChangeMetrics = alignNumericColumns || alignChangeColumns;

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
            {showTechnicalMetrics ? <th>MA60 (均線)</th> : null}
            {showTechnicalMetrics ? <th>乖離率 (Bias)</th> : null}
            {showTechnicalRiskHint ? <th>風險提示</th> : null}
            {showRiskSignals ? <th>市場風險狀態判斷</th> : null}
            {hideRelatedAsset ? null : <th>影響標的</th>}
            <th>更新時間</th>
            {hideNotes ? null : <th>觀察說明</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.relatedAsset}-${item.symbol}-${item.name}`}>
              <td className="market-table__name">{item.name}</td>
              <td>{item.symbol}</td>
              <td>{item.category}</td>
              <td className={alignNumericColumns ? "market-table__numeric" : undefined}>
                {formatPriceWithThousandsSeparator ? formatThousands(item.price) : item.price}
              </td>
              <td className={`${trendClass(item.change)}${alignChangeMetrics ? " market-table__numeric" : ""}`}>
                {formatValue(item.change)}
              </td>
              <td className={`${trendClass(item.changePercent)}${alignChangeMetrics ? " market-table__numeric" : ""}`}>
                {formatValue(item.changePercent, "%")}
              </td>
              <td className={`${trendClass(item.period5d)}${alignChangeMetrics ? " market-table__numeric" : ""}`}>
                {formatValue(item.period5d, "%")}
              </td>
              <td className={`${trendClass(item.period1m)}${alignChangeMetrics ? " market-table__numeric" : ""}`}>
                {formatValue(item.period1m, "%")}
              </td>
              {showTechnicalMetrics ? (
                <td className="market-table__numeric">
                  {formatPriceWithThousandsSeparator
                    ? formatThousands(item.ma60 ?? "N/A")
                    : formatValue(item.ma60 ?? "N/A")}
                </td>
              ) : null}
              {showTechnicalMetrics ? (
                <td className={`${trendClass(item.bias ?? "N/A")} market-table__numeric`}>
                  {formatValue(item.bias ?? "N/A", "%")}
                </td>
              ) : null}
              {showTechnicalRiskHint ? (
                <td>
                  <TechnicalRiskHint item={item} />
                </td>
              ) : null}
              {showRiskSignals ? (
                <td className="market-table__risk-signal">
                  <RiskSignalCell item={item} />
                </td>
              ) : null}
              {hideRelatedAsset ? null : <td>{item.relatedAsset}</td>}
              <td>{item.updatedAt}</td>
              {hideNotes ? null : <td className="market-table__note">{item.note ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
