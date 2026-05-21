import type { MarketItem } from "../data/marketData";
import { MarketTable } from "./MarketTable";

type MarketSectionProps = {
  title: string;
  description: string;
  items: MarketItem[];
  showRiskSignals?: boolean;
};

export function MarketSection({ title, description, items, showRiskSignals = false }: MarketSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <MarketTable items={items} showRiskSignals={showRiskSignals} />
    </section>
  );
}
