import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveJpyTwd } from "./lib/fx.mjs";
import { fetchForeignInvestorFlowSeries } from "./lib/twse.mjs";
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
const outputDir = resolveProjectPath(process.env.MARKET_DATA_OUTPUT_DIR, path.join("public", "data"));
const previousDir = resolveProjectPath(process.env.MARKET_DATA_PREVIOUS_DIR, outputDir);
const marketJsonPath = path.join(outputDir, "market.json");
const chartDataJsonPath = path.join(outputDir, "chartData.json");
const previousMarketJsonPath = path.join(previousDir, "market.json");
const previousChartDataJsonPath = path.join(previousDir, "chartData.json");
const strictMode = process.env.MARKET_DATA_STRICT === "1";

const updatedAt = formatTaipeiDateTime();
const foreignFlowSymbol = "Foreign Flow";

const symbols = {
  tw0050: "0050.TW",
  us00646: "00646.TW",
  cht: "2412.TW",
  tsmc: "2330.TW",
  mediatek: "2454.TW",
  delta: "2308.TW",
  honhai: "2317.TW",
  ase: "3711.TW",
  quanta: "2382.TW",
  wistron: "3231.TW",
  wiwynn: "6669.TW",
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
  tsla: "TSLA",
  micron: "MU",
  samsung: "005930.KS",
  skHynix: "000660.KS",
  amkor: "AMKR",
  smci: "SMCI",
  dell: "DELL",
  mpwr: "MPWR",
  onSemi: "ON",
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
    technicalItem("元大台灣50", symbols.tw0050, "ETF", "0050", "追蹤台灣大型權值股表現"),
    technicalItem("台積電", symbols.tsmc, "0050 核心權重", "0050", "0050 主要波動來源"),
    technicalItem("聯發科", symbols.mediatek, "IC 設計", "0050"),
    technicalItem("台達電", symbols.delta, "電源與工業自動化", "0050"),
    technicalItem("鴻海", symbols.honhai, "電子代工", "0050"),
    technicalItem("日月光投控", symbols.ase, "封測", "0050"),
    technicalItem("台積電 ADR", symbols.tsmAdr, "ADR", "0050", "美股交易時段常牽動隔日台積電與 0050 情緒"),
    technicalItem("加權指數", symbols.taiex, "台股指數", "0050", "若 Yahoo Finance 暫無資料，圖表會自動略過", "TAIEX"),
  ],
  us00646Items: [
    technicalItem("元大 S&P 500", symbols.us00646, "ETF", "00646"),
    technicalItem("S&P 500 ETF", symbols.spy, "SPX proxy", "00646", "以 SPY 作為 S&P 500 proxy"),
    technicalItem("Nasdaq 100 ETF", symbols.qqq, "NDX proxy", "00646", "以 QQQ 作為 Nasdaq 100 proxy"),
    technicalItem("Alphabet", symbols.googl, "搜尋與雲端", "00646"),
    technicalItem("NVIDIA", symbols.nvda, "AI 晶片", "00646"),
    technicalItem("Microsoft", symbols.msft, "雲端與軟體", "00646"),
    technicalItem("Apple", symbols.aapl, "消費科技", "00646"),
    technicalItem("Amazon", symbols.amzn, "電商與雲端", "00646"),
    technicalItem("Meta", symbols.meta, "社群與廣告", "00646"),
    technicalItem("Broadcom", symbols.avgo, "半導體", "00646"),
    technicalItem("Tesla", symbols.tsla, "電動車與能源", "00646"),
  ],
  aiSupplyChainItems: [
    technicalItem("Micron", symbols.micron, "HBM", "AI", "HBM 與記憶體景氣觀察代表"),
    technicalItem("Samsung Electronics", symbols.samsung, "HBM", "AI", "韓國記憶體與 HBM 供應鏈代表"),
    technicalItem("SK Hynix", symbols.skHynix, "HBM", "AI", "HBM 供應鏈代表"),
    technicalItem("台積電", symbols.tsmc, "CoWoS / 先進封裝", "AI", "CoWoS 與先進製程核心觀察"),
    technicalItem("台積電 ADR", symbols.tsmAdr, "CoWoS / 先進封裝", "AI"),
    technicalItem("日月光投控", symbols.ase, "CoWoS / 先進封裝", "AI"),
    technicalItem("Amkor", symbols.amkor, "CoWoS / 先進封裝", "AI"),
    technicalItem("鴻海", symbols.honhai, "AI Server", "AI"),
    technicalItem("廣達", symbols.quanta, "AI Server", "AI"),
    technicalItem("緯創", symbols.wistron, "AI Server", "AI"),
    technicalItem("緯穎", symbols.wiwynn, "AI Server", "AI"),
    technicalItem("Super Micro Computer", symbols.smci, "AI Server", "AI"),
    technicalItem("Dell", symbols.dell, "AI Server", "AI"),
    technicalItem("台達電", symbols.delta, "Power Electronics", "AI", "AI server 電源與散熱供應鏈觀察"),
    technicalItem("Monolithic Power", symbols.mpwr, "Power Electronics", "AI"),
    technicalItem("ON Semiconductor", symbols.onSemi, "Power Electronics", "AI"),
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
      symbol: foreignFlowSymbol,
      displaySymbol: foreignFlowSymbol,
      category: "台股資金面",
      relatedAsset: "Macro",
      note: "TWSE 三大法人買賣金額統計表，單位：億元",
      unavailableNote: "資料暫缺",
    },
  ],
};

async function main() {
  await mkdir(outputDir, { recursive: true });
  const previousMarketData = await readJsonIfExists(previousMarketJsonPath);
  const previousChartData = await readJsonIfExists(previousChartDataJsonPath);

  const yahooSymbols = Object.values(symbols);
  const yahooResults = await fetchYahooCharts(yahooSymbols, { range: "1y", interval: "1d" });
  const foreignFlowSeries = await fetchForeignInvestorFlowSeries().catch((error) => {
    console.warn(`[market-data] TWSE foreign investor flow failed: ${error.message}`);
    return [];
  });
  const successCount = Object.values(yahooResults).filter((result) => result.ok).length;

  if (successCount === 0 && strictMode) {
    throw new Error("All remote market data sources failed");
  }

  if (successCount === 0 && previousJsonFilesPresent()) {
    console.warn("[market-data] All remote fetches failed. Keeping existing public/data/*.json files.");
    return;
  }

  if (successCount === 0) {
    console.warn("[market-data] All remote fetches failed and no existing JSON was found. Writing N/A fallback JSON.");
  }

  const jpyTwdSeries = buildJpyTwdSeries(yahooResults);
  const marketData = buildMarketData(yahooResults, jpyTwdSeries, foreignFlowSeries, previousMarketData);
  const chartData = buildChartData(yahooResults, jpyTwdSeries, previousChartData);

  await writeJson(marketJsonPath, marketData);
  await writeJson(chartDataJsonPath, chartData);

  console.log(`[market-data] Wrote ${path.relative(projectRoot, marketJsonPath)}`);
  console.log(`[market-data] Wrote ${path.relative(projectRoot, chartDataJsonPath)}`);
  console.log(`[market-data] Yahoo symbols fetched: ${successCount}/${yahooSymbols.length}`);
}

function buildMarketData(yahooResults, jpyTwdSeries, foreignFlowSeries, previousMarketData) {
  const withYahoo = (groupName, definition) => {
    const current = buildMarketItem(definition, yahooResults[definition.symbol], updatedAt);
    return isUnavailableItem(current) ? previousItem(previousMarketData, groupName, definition) ?? current : current;
  };

  return {
    updatedAt,
    summaryItems: definitions.summaryItems.map((definition) => withYahoo("summaryItems", definition)),
    riskIndicators: definitions.riskIndicators.map((definition) => withYahoo("riskIndicators", definition)),
    tw0050Items: definitions.tw0050Items.map((definition) => withYahoo("tw0050Items", definition)),
    us00646Items: definitions.us00646Items.map((definition) => withYahoo("us00646Items", definition)),
    aiSupplyChainItems: definitions.aiSupplyChainItems.map((definition) => withYahoo("aiSupplyChainItems", definition)),
    cht2412Items: [
      ...definitions.cht2412Items.map((definition) => withYahoo("cht2412Items", definition)),
      previousItemWithNote(previousMarketData, "cht2412Items", basicItem("EPS", "EPS", "獲利能力", "2412"), "EPS 資料尚未串接正式來源，沿用前一次資料")
        ?? unavailableBasicItem("EPS", "EPS", "獲利能力", "2412", "EPS 資料尚未串接正式來源"),
      previousItemWithNote(previousMarketData, "cht2412Items", basicItem("現金股利", "Dividend", "股利政策", "2412"), "現金股利資料尚未串接正式來源，沿用前一次資料")
        ?? unavailableBasicItem("現金股利", "Dividend", "股利政策", "2412", "現金股利資料尚未串接正式來源"),
      buildYieldItem(previousMarketData, yahooResults[symbols.cht]?.chart?.data ?? []),
      previousItemWithNote(previousMarketData, "cht2412Items", basicItem("月營收年增率", "Revenue YoY", "營收", "2412"), "月營收資料尚未串接正式來源，沿用前一次資料")
        ?? unavailableBasicItem("月營收年增率", "Revenue YoY", "營收", "2412", "月營收資料尚未串接正式來源"),
    ],
    fxMacroItems: definitions.fxMacroItems.map((definition) => {
      if (definition.symbol === "JPY/TWD") {
        const current = buildDerivedFxItem(definition, jpyTwdSeries);
        return isUnavailableItem(current) ? previousItem(previousMarketData, "fxMacroItems", definition) ?? current : current;
      }

      if (definition.symbol === foreignFlowSymbol) {
        return buildForeignFlowItem(definition, foreignFlowSeries, previousMarketData);
      }

      if (!yahooResults[definition.symbol]) {
        return previousItem(previousMarketData, "fxMacroItems", definition) ?? unavailableMarketItem(definition, updatedAt);
      }

      return withYahoo("fxMacroItems", definition);
    }),
  };
}

function buildChartData(yahooResults, jpyTwdSeries, previousChartData) {
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
          .map((definition) => buildSeriesWithPrevious(definition, yahooResults[definition.symbol], previousChartData, "tw0050", { normalized: true }))
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
        ].map((definition) => buildSeriesWithPrevious(definition, yahooResults[definition.symbol], previousChartData, "us00646", { normalized: true })),
      },
      {
        id: "usdTwd",
        title: "USD/TWD 美元兌台幣",
        description: "使用實際匯率數值，觀察美元兌台幣趨勢",
        normalized: false,
        series: [
          buildSeriesWithPrevious(seriesDef("美元兌台幣", symbols.usdTwd, "FX", "USD/TWD"), yahooResults[symbols.usdTwd], previousChartData, "usdTwd"),
        ],
      },
      {
        id: "jpyTwd",
        title: "JPY/TWD 日圓兌台幣",
        description: "使用實際匯率數值，觀察日圓兌台幣趨勢",
        normalized: false,
        series: [
          buildSeriesWithPrevious(seriesDef("日圓兌台幣", "JPY/TWD", "FX", "JPY/TWD", jpyTwdSeries), undefined, previousChartData, "jpyTwd"),
        ],
      },
      {
        id: "cht2412",
        title: "電信防禦性比較",
        description: "比較 2412、3045、4904 與加權指數的相對走勢",
        normalized: true,
        series: [
          seriesDef("中華電信", symbols.cht, "2412", "2412.TW"),
          seriesDef("台灣大", symbols.taiwanMobile, "2412", "3045.TW"),
          seriesDef("遠傳", symbols.fet, "2412", "4904.TW"),
          seriesDef("加權指數", symbols.taiex, "0050", "TAIEX"),
        ].map((definition) => buildSeriesWithPrevious(definition, yahooResults[definition.symbol], previousChartData, "cht2412", { normalized: false })),
      },
      {
        id: "risk",
        title: "市場風險指標：VIX vs TNX vs GLD",
        description: "比較市場恐慌、利率壓力與避險情緒的相對變化",
        normalized: true,
        series: [
          seriesDef("市場波動率指數", symbols.vix, "Risk", "VIX"),
          seriesDef("10年期美債殖利率", symbols.tnx, "Risk", "TNX"),
          seriesDef("美元指數", symbols.dxy, "Macro", "DXY"),
          seriesDef("黃金 ETF", symbols.gld, "Risk"),
          seriesDef("美國原油 ETF", symbols.uso, "Risk"),
          seriesDef("抗通膨債券 ETF", symbols.tip, "Risk"),
        ].map((definition) => buildSeriesWithPrevious(definition, yahooResults[definition.symbol], previousChartData, "risk", { normalized: true })),
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

function buildForeignFlowItem(definition, series, previousMarketData) {
  const usable = series.filter((point) => typeof point?.value === "number");
  const latest = usable[usable.length - 1];
  const previous = usable[usable.length - 2];

  if (!latest) {
    return previousItem(previousMarketData, "fxMacroItems", definition) ?? unavailableMarketItem(definition, updatedAt);
  }

  const latestYi = latest.value / 100000000;
  const previousYi = previous ? previous.value / 100000000 : undefined;
  const changeYi = typeof previousYi === "number" ? latestYi - previousYi : undefined;

  return {
    name: definition.name,
    symbol: definition.displaySymbol,
    category: definition.category,
    price: formatYiAmount(latestYi),
    change: typeof changeYi === "number" ? formatYiAmount(changeYi) : "N/A",
    changePercent: "N/A",
    period5d: formatYiAmount(sumLatest(series, 5) / 100000000),
    period1m: formatYiAmount(sumLatest(series, 21) / 100000000),
    relatedAsset: definition.relatedAsset,
    updatedAt,
    note: `${definition.note}；資料日期：${latest.date}`,
  };
}

function sumLatest(series, count) {
  return series
    .filter((point) => typeof point?.value === "number")
    .slice(-count)
    .reduce((sum, point) => sum + point.value, 0);
}

function formatYiAmount(value) {
  const rounded = round(value, 2);
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded} 億`;
}

function deriveYieldSeries(priceSeries, annualDividend) {
  if (typeof annualDividend !== "number" || Number.isNaN(annualDividend) || annualDividend <= 0) {
    return [];
  }

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

function technicalItem(name, symbol, category, relatedAsset, note, displaySymbol) {
  return {
    ...item(name, symbol, category, relatedAsset, note, displaySymbol),
    includeTechnicalMetrics: true,
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

function basicItem(name, symbol, category, relatedAsset, note) {
  return {
    name,
    symbol,
    displaySymbol: symbol,
    category,
    relatedAsset,
    unavailableNote: note,
  };
}

function unavailableBasicItem(name, symbol, category, relatedAsset, note) {
  return {
    name,
    symbol,
    category,
    price: "N/A",
    change: "N/A",
    changePercent: "N/A",
    period5d: "N/A",
    period1m: "N/A",
    relatedAsset,
    updatedAt,
    note,
  };
}

function buildYieldItem(previousMarketData, priceSeries) {
  const definition = basicItem("殖利率", "Yield", "收益率", "2412", "殖利率資料尚未取得足夠來源");
  const dividend = currentOrPreviousDividend(previousMarketData);
  const latestPrice = priceSeries.findLast?.((point) => typeof point?.value === "number")?.value
    ?? [...priceSeries].reverse().find((point) => typeof point?.value === "number")?.value;

  if (typeof dividend === "number" && typeof latestPrice === "number" && latestPrice > 0) {
    const price = round((dividend / latestPrice) * 100, 2);
    return {
      name: "殖利率",
      symbol: "Yield",
      category: "收益率",
      price: `${price}%`,
      change: "N/A",
      changePercent: "N/A",
      period5d: "N/A",
      period1m: "N/A",
      relatedAsset: "2412",
      updatedAt,
      note: "由現金股利與 2412 股價計算",
    };
  }

  return previousItemWithNote(previousMarketData, "cht2412Items", definition, "殖利率資料尚未取得足夠來源，沿用前一次資料")
    ?? unavailableBasicItem("殖利率", "Yield", "收益率", "2412", "殖利率資料尚未取得足夠來源");
}

function currentOrPreviousDividend(previousMarketData) {
  const dividend = previousItem(previousMarketData, "cht2412Items", basicItem("現金股利", "Dividend", "股利政策", "2412"));
  if (!dividend) {
    return undefined;
  }

  if (typeof dividend.price === "number") {
    return dividend.price;
  }

  const parsed = Number.parseFloat(String(dividend.price).replace("%", ""));
  return Number.isNaN(parsed) ? undefined : parsed;
}

function previousItem(previousMarketData, groupName, definition) {
  const symbol = definition.displaySymbol ?? definition.symbol;
  const item = previousMarketData?.[groupName]?.find((entry) => entry.symbol === symbol);
  return item ? { ...item, updatedAt: normalizeDateTime(item.updatedAt) } : undefined;
}

function previousItemWithNote(previousMarketData, groupName, definition, note) {
  const item = previousItem(previousMarketData, groupName, definition);
  return item && !isUnavailableItem(item) ? { ...item, note } : undefined;
}

function previousChartSeries(previousChartData, chartId, symbol) {
  const chart = previousChartData?.charts?.find((item) => item.id === chartId);
  const legacyFxChart = chartId === "usdTwd" || chartId === "jpyTwd"
    ? previousChartData?.charts?.find((item) => item.id === "fx")
    : undefined;

  return chart?.series?.find((series) => series.symbol === symbol)
    ?? legacyFxChart?.series?.find((series) => series.symbol === symbol);
}

function buildSeriesWithPrevious(definition, chartResult, previousChartData, chartId, options = {}) {
  const current = buildSeries(definition, chartResult, options);
  if (current.data.length > 0) {
    return current;
  }

  const previous = previousChartSeries(previousChartData, chartId, current.symbol);
  return previous ? { ...previous, yAxisId: definition.yAxisId ?? previous.yAxisId } : current;
}

function isUnavailableItem(item) {
  return item.price === "N/A" && item.change === "N/A" && item.changePercent === "N/A";
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.warn(`[market-data] Unable to read previous JSON ${path.relative(projectRoot, filePath)}: ${error.message}`);
    return undefined;
  }
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function previousJsonFilesPresent() {
  return existsSync(previousMarketJsonPath) && existsSync(previousChartDataJsonPath);
}

function resolveProjectPath(configuredPath, fallbackPath) {
  const target = configuredPath || fallbackPath;
  return path.isAbsolute(target) ? target : path.resolve(projectRoot, target);
}

function formatTaipeiDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} UTC+8`;
}

function normalizeDateTime(value) {
  if (typeof value !== "string") {
    return value;
  }

  if (value.includes("UTC+8")) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatTaipeiDateTime(parsed);
}

main().catch(async (error) => {
  console.warn(`[market-data] Update failed: ${error.message}`);

  if (strictMode) {
    process.exitCode = 1;
    return;
  }

  if (previousJsonFilesPresent()) {
    console.warn("[market-data] Keeping existing public/data/*.json files.");
    return;
  }

  console.warn("[market-data] No existing JSON files found; writing fallback N/A JSON.");
  await mkdir(outputDir, { recursive: true });

  const fallbackUpdatedAt = formatTaipeiDateTime();
  const fallbackMarket = {
    updatedAt: fallbackUpdatedAt,
    summaryItems: definitions.summaryItems.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    riskIndicators: definitions.riskIndicators.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    tw0050Items: definitions.tw0050Items.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    us00646Items: definitions.us00646Items.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    aiSupplyChainItems: definitions.aiSupplyChainItems.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    cht2412Items: definitions.cht2412Items.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
    fxMacroItems: definitions.fxMacroItems.map((definition) => unavailableMarketItem(definition, fallbackUpdatedAt)),
  };

  await writeJson(marketJsonPath, fallbackMarket);
  await writeJson(chartDataJsonPath, { updatedAt: fallbackUpdatedAt, charts: [] });
});
