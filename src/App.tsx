import { useEffect, useState } from "react";
import { LineChartCard } from "./components/LineChartCard";
import { MarketSection } from "./components/MarketSection";
import { SummaryCard } from "./components/SummaryCard";
import { fallbackChartData, type DashboardChartData } from "./data/chartData";
import { fallbackMarketData, type DashboardMarketData } from "./data/marketData";

type DataSourceStatus = "loading" | "json" | "fallback";

function App() {
  const [marketData, setMarketData] = useState<DashboardMarketData>(fallbackMarketData);
  const [chartData, setChartData] = useState<DashboardChartData>(fallbackChartData);
  const [dataSourceStatus, setDataSourceStatus] = useState<DataSourceStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      try {
        const [marketResponse, chartResponse] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}data/market.json`, { cache: "no-store" }),
          fetch(`${import.meta.env.BASE_URL}data/chartData.json`, { cache: "no-store" }),
        ]);

        if (!marketResponse.ok || !chartResponse.ok) {
          throw new Error("JSON data not available");
        }

        const [marketJson, chartJson] = (await Promise.all([
          marketResponse.json(),
          chartResponse.json(),
        ])) as [DashboardMarketData, DashboardChartData];

        if (!cancelled) {
          setMarketData(marketJson);
          setChartData(chartJson);
          setDataSourceStatus("json");
        }
      } catch (error) {
        console.warn("[dashboard] Fallback to bundled data:", error);
        if (!cancelled) {
          setMarketData(fallbackMarketData);
          setChartData(fallbackChartData);
          setDataSourceStatus("fallback");
        }
      }
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Personal market watch</p>
          <h1>投資觀察儀表板</h1>
        </div>
        <div className="hero__status">
          <span>{dataSourceStatus === "json" ? "每日 JSON" : "備援資料"}</span>
          <strong>{marketData.updatedAt}</strong>
        </div>
      </section>

      {dataSourceStatus === "fallback" ? (
        <div className="fallback-banner" role="status">
          目前顯示備援資料
        </div>
      ) : null}

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>今日總覽卡片</h2>
          <p>快速查看主要觀察標的的最新數值、漲跌與更新時間。</p>
        </div>
        <div className="summary-grid">
          {marketData.summaryItems.map((item) => (
            <SummaryCard key={item.symbol} item={item} />
          ))}
        </div>
      </section>

      <MarketSection
        title="市場風險溫度計"
        description="先觀察整體市場情緒、利率、能源、通膨與避險狀態，再往下檢視個別資產。"
        items={marketData.riskIndicators}
        showRiskSignals
        hideNotes
        hideRelatedAsset
      />

      <MarketSection
        title="0050 觀察區"
        description="觀察 0050 的主要波動來源，包含台股權值股、半導體鏈與加權指數。"
        items={marketData.tw0050Items}
        hideRelatedAsset
        hideNotes
        showTechnicalMetrics
      />

      <MarketSection
        title="00646 觀察區"
        description="觀察 00646 與美股大型科技股、S&P 500、Nasdaq 100 的連動。"
        items={marketData.us00646Items}
        hideRelatedAsset
        hideNotes
        alignChangeColumns
      />

      <MarketSection
        title="匯率與總經觀察區"
        description="觀察美元、日圓、美元指數與台股外資資金面；TNX 已放在市場風險溫度計。"
        items={marketData.fxMacroItems}
      />

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>線圖區</h2>
          <p>使用每日 JSON 或備援資料比較主要標的、匯率與風險指標的相對變化。</p>
        </div>
        <div className="chart-grid">
          {chartData.charts.map((chart) => (
            <LineChartCard key={chart.id} chart={chart} />
          ))}
        </div>
      </section>

      <section className="update-panel" aria-label="資料更新時間">
        <div>
          <h2>資料更新時間</h2>
          <p>
            目前資料來源：
            <strong>
              {" "}
              {dataSourceStatus === "json" ? "每日產生 JSON" : "備援資料"}
            </strong>
            ，資料更新時間為
            <strong> {marketData.updatedAt}</strong>。
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
