import type { MarketItem } from "../data/marketData";
import { MarketTable } from "./MarketTable";

type MarketSectionProps = {
  title: string;
  description: string;
  items: MarketItem[];
};

export function MarketSection({ title, description, items }: MarketSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <MarketTable items={items} />
    </section>
  );
}
