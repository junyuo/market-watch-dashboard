import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveJpyTwd } from "./lib/fx.mjs";
import { fetchYahooCharts } from "./lib/yahooFinance.mjs";
import {
  buildMarketItem,
  buildSeries,
  calculateChange,
  periodChange,
  round,
  unavailableMarketItem,
} from "./lib/transform.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "public", "data");
const marketJsonPath = path.join(outputDir, "market.json");
const chartDataJsonPath = path.join(outputDir, "chartData.json");

const updatedAt = new Date().toISOString();

const symbols = {
  tw0050: "0050.TW",
  us00646: "00646.TW",
  cht: "2412.TW",
  tsmc: "2330.TW",
  mediatek: "2454.TW",
  delta: "2308.TW",
  honhai: "2317.TW",
  ase: "3711.TW",
  taiwanMobile: "3045.TW",
  fet: "4904.TW",
  tsmAdr: "TSM",
  spy: "SPY",
  qqq: "QQQ",
  nvda: "NVDA",
  msft: "MSFT",
  aapl: "AAPL",
  amzn: "AMZN",
  meta: "META",
  googl: "GOOGL",
  avgo: "AVGO",
  gld: "GLD",
  uso: "USO",
  tip: "TIP",
  vix: "^VIX",
  tnx: "^TNX",
  dxy: "DX-Y.NYB",
  usdTwd: "USDTWD=X",
  usdJpy: "JPY=X",
  taiex: "^TWII",
};

const definitions = {
  summaryItems: [
    item("元大台灣50", symbols.tw0050, "台股 ETF", "0050", "觀察台股大型權值股整體表現"),
    item("元大 S&P 500", symbols.us00646, "美股 ETF", "00646", "受美股指數與匯率共同影響"),
    item("中華電信", symbols.cht, "電信股", "2412", "偏防禦型現金流與殖利率觀察"),
    item("美元兌台幣", symbols.usdTwd, "匯率", "FX", "影響海外 ETF 換匯與台股資金面", "USD/TWD"),
  ],
  riskIndicators: [
    item("市場波動率指數", symbols.vix, "市場情緒", "Risk", "反映美股市場恐慌與波動程度；主要影響 00646、美股科技股與整體風險偏好", "VIX"),
    item("10年期美債殖利率", symbols.tnx, "美債殖利率", "Risk", "反映資金成本與成長股估值壓力；主要影響 00646、科技股、AI 股與美元走勢", "TNX"),
    item("美國原油 ETF", symbols.uso, "能源成本", "Risk", "作為油價與能源成本的代理指標；主要影響通膨壓力、企業成本與總經情緒"),
    item("抗通膨債券 ETF", symbols.tip, "通膨預期", "Risk", "作為通膨預期與實質利率變化的觀察指標；主要影響利率預期、債券市場與科技股估值"),
    item("黃金 ETF", symbols.gld, "避險情緒", "Risk", "反映市場避險需求、美元與實質利率壓力；主要影響 Risk-off 情緒、美元與利率預期"),
  ],
  tw0050Items: [
    item("元大台灣50", symbols.tw0050, "ETF", "0050", "追蹤台灣大型權值股表現"),
    item("台積電", symbols.tsmc, "0050 核心權重", "0050", "0050 主要波動來源"),
    item("聯發科", symbols.mediatek, "IC 設計", "0050"),
    item("台達電", symbols.delta, "電源與工業自動化", "0050"),
    item("鴻海", symbols.honhai, "電子代工", "0050"),
    item("日月光投控", symbols.ase, "封測", "0050"),
    item("台積電 ADR", symbols.tsmAdr, "ADR", "0050", "美股交易時段常牽動隔日台積電與 0050 情緒"),
    item("加權指數", symbols.taiex, "台股指數", "0050", "若 Yahoo Finance 暫無資料，圖表會自動略過", "TAIEX"),
  ],
  us00646Items: [
    item("元大 S&P 500", symbols.us00646, "ETF", "00646"),
    item("S&P 500 ETF", symbols.spy, "SPX proxy", "00646", "以 SPY 作為 S&P 500 proxy"),
    item("Nasdaq 100 ETF", symbols.qqq, "NDX proxy", "00646", "以 QQQ 作為 Nasdaq 100 proxy"),
    item("NVIDIA", symbols.nvda, "AI 晶片", "00646"),
    item("Microsoft", symbols.msft, "雲端與軟體", "00646"),
    item("Apple", symbols.aapl, "消費科技", "00646"),
    item("Amazon", symbols.amzn, "電商與雲端", "00646"),
    item("Meta", symbols.meta, "社群與廣告", "00646"),
    item("Alphabet", symbols.googl, "搜尋與雲端", "00646"),
    item("Broadcom", symbols.avgo, "半導體", "00646"),
  ],
  cht2412Items: [
    item("中華電信", symbols.cht, "電信股", "2412", "觀察股價、殖利率與穩定現金流"),
    item("台灣大", symbols.taiwanMobile, "同業比較", "2412"),
    item("遠傳", symbols.fet, "同業比較", "2412"),
  ],
  fxMacroItems: [
    item("美元兌台幣", symbols.usdTwd, "匯率", "FX", undefined, "USD/TWD"),
    item("日圓兌台幣", "JPY/TWD", "匯率", "FX", "由 USD/TWD 與 USD/JPY 交叉計算", "JPY/TWD"),
    item("美元指數", symbols.dxy, "美元強弱", "Macro", "美元走強可能影響匯率與國際資金流向", "DXY"),
    {
      name: "外資買賣超",
      symbol: "Foreign Flow",
      displaySymbol: "Foreign Flow",
      category: "台股資金面",
      relatedAsset: "Macro",
      note: "第一版尚未串接 TWSE 外資買賣超資料",
      unavailableNote: "資料暫缺",
    },
  ],
};

async function main() {
  await mkdir(outputDir, { recursive: true });

  const yahooSymbols = Object.values(symbols);
  const yahooResults = await fetchYahooCharts(yahooSymbols, { range: "1y", interval: "1d" });
  const successCount = Object.values(yahooResults).filter((result) => result.ok).length;

  if (successCount === 0 && existingJsonFilesPresent()) {
    console.warn("[market-data] All remote fetches failed. Keeping existing public/data/*.json files.");
    return;
  }

  if (successCount === 0) {
    console.warn("[market-data] All remote fetches failed and no existing JSON was found. Writing N/A fallback JSON.");
  }

  const jpyTwdSeries = buildJpyTwdSeries(yahooResults);
  const marketData = buildMarketData(yahooResults, jpyTwdSeries);
  const chartData = buildChartData(yahooResults, jpyTwdSeries);

  await writeJson(marketJsonPath, marketData);
  await writeJson(chartDataJsonPath, chartData);

  console.log(`[market-data] Wrote ${path.relative(projectRoot, marketJsonPath)}`);
  console.log(`[market-data] Wrote ${path.relative(projectRoot, chartDataJsonPath)}`);
  console.log(`[market-data] Yahoo symbols fetched: ${successCount}/${yahooSymbols.length}`);
}

function buildMarketData(yahooResults, jpyTwdSeries) {
  const withYahoo = (definition) => buildMarketItem(definition, yahooResults[definition.symbol], updatedAt);

  return {
    updatedAt,
    summaryItems: definitions.summaryItems.map(withYahoo),
    riskIndicators: definitions.riskIndicators.map(withYahoo),
    tw0050Items: definitions.tw0050Items.map(withYahoo),
    us00646Items: definitions.us00646Items.map(withYahoo),
    cht2412Items: [
      ...definitions.cht2412Items.map(withYahoo),
      mockItem("EPS", "EPS", "獲利能力", "2412", 4.92, "近四季 EPS 第一版暫用 mock data"),
      mockItem("現金股利", "Dividend", "股利政策", "2412", 4.75, "現金股利第一版暫用 mock data"),
      mockItem("殖利率", "Yield", "收益率", "2412", "N/A", "殖利率資料暫缺，未來可由股利與股價計算"),
      mockItem("月營收年增率", "Revenue YoY", "營收", "2412", "N/A", "月營收資料暫缺，未來可串接公開資訊觀測站或公司月營收資料"),
    ],
    fxMacroItems: definitions.fxMacroItems.map((definition) => {
      if (definition.symbol === "JPY/TWD") {
        return buildDerivedFxItem(definition, jpyTwdSeries);
      }

      if (!yahooResults[definition.symbol]) {
        return unavailableMarketItem(definition, updatedAt);
      }

      return withYahoo(definition);
    }),
  };
}

function buildChartData(yahooResults, jpyTwdSeries) {
  const yieldSeries = deriveYieldSeries(yahooResults[symbols.cht]?.chart?.data ?? []);

  return {
    updatedAt,
    charts: [
      {
        id: "tw0050",
        title: "0050 vs 台積電 vs 加權指數",
        description: "比較 0050、台積電與台股大盤的相對走勢",
        normalized: true,
        series: [
          seriesDef("元大台灣50", symbols.tw0050, "0050"),
          seriesDef("台積電", symbols.tsmc, "0050"),
          seriesDef("加權指數", symbols.taiex, "0050", "TAIEX"),
        ]
          .map((definition) => buildSeries(definition, yahooResults[definition.symbol], { normalized: true }))
          .filter((chartSeries) => chartSeries.data.length > 0),
      },
      {
        id: "us00646",
        title: "00646 vs S&P 500 vs USD/TWD",
        description: "比較 00646、S&P 500 proxy 與 USD/TWD 的相對走勢",
        normalized: true,
        series: [
          seriesDef("元大 S&P 500", symbols.us00646, "00646"),
          seriesDef("S&P 500 ETF", symbols.spy, "00646", "SPY"),
          seriesDef("美元兌台幣", symbols.usdTwd, "FX", "USD/TWD"),
        ].map((definition) => buildSeries(definition, yahooResults[definition.symbol], { normalized: true })),
      },
      {
        id: "fx",
        title: "USD/TWD vs JPY/TWD",
        description: "使用實際匯率數值，觀察美元與日圓兌台幣趨勢",
        normalized: false,
        series: [
          buildSeries(seriesDef("美元兌台幣", symbols.usdTwd, "FX", "USD/TWD"), yahooResults[symbols.usdTwd]),
          buildSeries(seriesDef("日圓兌台幣", "JPY/TWD", "FX", "JPY/TWD", jpyTwdSeries), undefined),
        ],
      },
      {
        id: "cht2412",
        title: "2412 股價 vs 殖利率",
        description: "左軸顯示股價，右軸顯示殖利率；殖利率第一版暫用估算資料",
        normalized: false,
        dualAxis: true,
        series: [
          buildSeries({ ...seriesDef("中華電信股價", symbols.cht, "2412", "2412.TW"), yAxisId: "left" }, yahooResults[symbols.cht]),
          buildSeries({ ...seriesDef("現金殖利率", "Yield", "2412", "Yield", yieldSeries), yAxisId: "right" }, undefined),
        ],
      },
      {
        id: "risk",
        title: "市場風險指標：VIX vs TNX vs GLD",
        description: "比較市場恐慌、利率壓力與避險情緒的相對變化",
        normalized: true,
        series: [
          seriesDef("市場波動率指數", symbols.vix, "Risk", "VIX"),
          seriesDef("10年期美債殖利率", symbols.tnx, "Risk", "TNX"),
          seriesDef("黃金 ETF", symbols.gld, "Risk"),
        ].map((definition) => buildSeries(definition, yahooResults[definition.symbol], { normalized: true })),
      },
    ],
  };
}

function buildJpyTwdSeries(yahooResults) {
  const usdTwd = yahooResults[symbols.usdTwd]?.chart?.data ?? [];
  const usdJpy = yahooResults[symbols.usdJpy]?.chart?.data ?? [];

  if (!usdTwd.length || !usdJpy.length) {
    console.warn("[market-data] Unable to derive JPY/TWD because USD/TWD or USD/JPY is unavailable.");
    return [];
  }

  return deriveJpyTwd(usdTwd, usdJpy);
}

function buildDerivedFxItem(definition, series) {
  if (!series.length) {
    return unavailableMarketItem(definition, updatedAt);
  }

  const metrics = calculateChange(series);

  return {
    name: definition.name,
    symbol: definition.displaySymbol,
    category: definition.category,
    price: metrics.price,
    change: metrics.change,
    changePercent: metrics.changePercent,
    period5d: periodChange(series, 5),
    period1m: periodChange(series, 21),
    relatedAsset: definition.relatedAsset,
    updatedAt,
    note: definition.note,
  };
}

function deriveYieldSeries(priceSeries) {
  const annualDividend = 4.75;

  return priceSeries
    .filter((point) => typeof point?.value === "number" && point.value > 0)
    .map((point) => ({
      date: point.date,
      value: round((annualDividend / point.value) * 100, 2),
    }));
}

function item(name, symbol, category, relatedAsset, note, displaySymbol) {
  return {
    name,
    symbol,
    displaySymbol: displaySymbol ?? symbol,
    category,
    relatedAsset,
    note,
    unavailableNote: "資料暫缺",
  };
}

function seriesDef(name, symbol, relatedAsset, displaySymbol, data) {
  return {
    name,
    symbol,
    displaySymbol: displaySymbol ?? symbol,
    relatedAsset,
    data,
  };
}

function mockItem(name, symbol, category, relatedAsset, price, note) {
  return {
    name,
    symbol,
    category,
    price,
    change: "N/A",
    changePercent: "N/A",
    period5d: "N/A",
    period1m: "N/A",
    relatedAsset,
    updatedAt,
    note,
  };
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function existingJsonFilesPresent() {
  return existsSync(marketJsonPath) && existsSync(chartDataJsonPath);
}

main().catch(async (error) => {
  console.warn(`[market-data] Update failed: ${error.message}`);

  if (existingJsonFilesPresent()) {
    console.warn("[market-data] Keeping existing public/data/*.json files.");
    return;
  }

  console.warn("[market-data] No existing JSON files found; writing fallback N/A JSON.");
  await mkdir(outputDir, { recursive: true });

  const fallbackUpdatedAt = new Date().toISOString();
  const fallbackMarket = {
    updatedAt: fallbackUpdatedAt,
    summaryItems: definitions.summaryItems.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    riskIndicators: definitions.riskIndicators.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    tw0050Items: definitions.tw0050Items.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    us00646Items: definitions.us00646Items.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    cht2412Items: definitions.cht2412Items.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    fxMacroItems: definitions.fxMacroItems.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
  };

  await writeJson(marketJsonPath, fallbackMarket);
  await writeJson(chartDataJsonPath, { updatedAt: fallbackUpdatedAt, charts: [] });
});
