import { LineChartCard } from "./components/LineChartCard";
import { MarketSection } from "./components/MarketSection";
import { SummaryCard } from "./components/SummaryCard";
import { dashboardCharts } from "./data/chartData";
import {
  cht2412Items,
  fxMacroItems,
  mockUpdatedAt,
  riskIndicators,
  summaryItems,
  tw0050Items,
  us00646Items,
} from "./data/marketData";

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Personal market watch</p>
          <h1>投資觀察儀表板</h1>
          <p>0050 / 00646 / 2412 / 匯率與市場風險觀察</p>
        </div>
        <div className="hero__status">
          <span>Mock data</span>
          <strong>{mockUpdatedAt}</strong>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>今日總覽卡片</h2>
          <p>快速查看主要觀察標的的最新數值、漲跌與更新時間。</p>
        </div>
        <div className="summary-grid">
          {summaryItems.map((item) => (
            <SummaryCard key={item.symbol} item={item} />
          ))}
        </div>
      </section>

      <MarketSection
        title="市場風險溫度計"
        description="先觀察整體市場情緒、利率、能源、通膨與避險狀態，再往下檢視個別資產。"
        items={riskIndicators}
      />

      <MarketSection
        title="0050 觀察區"
        description="觀察 0050 的主要波動來源，包含台股權值股、半導體鏈與加權指數。"
        items={tw0050Items}
      />

      <MarketSection
        title="00646 觀察區"
        description="觀察 00646 與美股大型科技股、S&P 500、Nasdaq 100 的連動。"
        items={us00646Items}
      />

      <MarketSection
        title="2412 中華電信觀察區"
        description="觀察中華電信股價、殖利率、營收與同業比較。"
        items={cht2412Items}
      />

      <MarketSection
        title="匯率與總經觀察區"
        description="觀察美元、日圓、美元指數與台股外資資金面；TNX 已放在市場風險溫度計。"
        items={fxMacroItems}
      />

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>線圖區</h2>
          <p>使用 mock time series 比較主要標的、匯率與風險指標的相對變化。</p>
        </div>
        <div className="chart-grid">
          {dashboardCharts.map((chart) => (
            <LineChartCard key={chart.id} chart={chart} />
          ))}
        </div>
      </section>

      <section className="update-panel" aria-label="資料更新時間">
        <div>
          <h2>資料更新時間</h2>
          <p>
            目前版本使用本地 mock data，所有觀察資料更新時間為
            <strong> {mockUpdatedAt}</strong>。
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
