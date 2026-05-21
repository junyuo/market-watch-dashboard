import type { MarketItem } from "../data/marketData";
import { MarketTable } from "./MarketTable";

type MarketSectionProps = {
  title: string;
  description: string;
  items: MarketItem[];
  showRiskSignals?: boolean;
  hideNotes?: boolean;
  hideRelatedAsset?: boolean;
  showTechnicalMetrics?: boolean;
};

export function MarketSection({
  title,
  description,
  items,
  showRiskSignals = false,
  hideNotes = false,
  hideRelatedAsset = false,
  showTechnicalMetrics = false,
}: MarketSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <MarketTable
        items={items}
        showRiskSignals={showRiskSignals}
        hideNotes={hideNotes}
        hideRelatedAsset={hideRelatedAsset}
        showTechnicalMetrics={showTechnicalMetrics}
      />
    </section>
  );
}
