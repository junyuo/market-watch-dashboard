import type { MarketItem } from "../data/marketData";
import type { ReactNode } from "react";
import { MarketTable } from "./MarketTable";

type MarketSectionProps = {
  title: string;
  description: string;
  items: MarketItem[];
  showRiskSignals?: boolean;
  hideNotes?: boolean;
  hideRelatedAsset?: boolean;
  showTechnicalMetrics?: boolean;
  showTechnicalRiskHint?: boolean;
  alignChangeColumns?: boolean;
  formatPriceWithThousandsSeparator?: boolean;
  children?: ReactNode;
};

export function MarketSection({
  title,
  description,
  items,
  showRiskSignals = false,
  hideNotes = false,
  hideRelatedAsset = false,
  showTechnicalMetrics = false,
  showTechnicalRiskHint = false,
  alignChangeColumns = false,
  formatPriceWithThousandsSeparator = false,
  children,
}: MarketSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
      <MarketTable
        items={items}
        showRiskSignals={showRiskSignals}
        hideNotes={hideNotes}
        hideRelatedAsset={hideRelatedAsset}
        showTechnicalMetrics={showTechnicalMetrics}
        showTechnicalRiskHint={showTechnicalRiskHint}
        alignChangeColumns={alignChangeColumns}
        formatPriceWithThousandsSeparator={formatPriceWithThousandsSeparator}
      />
    </section>
  );
}
