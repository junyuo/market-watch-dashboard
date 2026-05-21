import type { RelatedAsset } from "./marketData";

export type TimeRange = "1M" | "3M" | "6M" | "YTD" | "1Y";

export type TimeSeriesPoint = {
  date: string;
  value: number;
};

export type ChartSeries = {
  name: string;
  symbol: string;
  relatedAsset: RelatedAsset;
  data: TimeSeriesPoint[];
  yAxisId?: "left" | "right";
};

export type DashboardChart = {
  id: string;
  title: string;
  description: string;
  normalized: boolean;
  series: ChartSeries[];
  dualAxis?: boolean;
};

const dates = ["01/02", "01/16", "02/01", "02/15", "03/01", "03/15", "04/01", "04/15", "05/01", "05/21"];

const series = (values: number[]): TimeSeriesPoint[] =>
  dates.map((date, index) => ({
    date,
    value: values[index],
  }));

export const tw0050Chart: DashboardChart = {
  id: "tw0050-relative",
  title: "0050 vs 台積電 vs 加權指數",
  description: "以起點 100 正規化，比較台股大型權值股與指數相對走勢。",
  normalized: true,
  series: [
    {
      name: "元大台灣50",
      symbol: "0050",
      relatedAsset: "0050",
      data: series([100, 102, 101, 104, 106, 105, 109, 111, 113, 116]),
    },
    {
      name: "台積電",
      symbol: "2330",
      relatedAsset: "0050",
      data: series([100, 103, 102, 106, 111, 108, 113, 117, 121, 126]),
    },
    {
      name: "加權指數",
      symbol: "TAIEX",
      relatedAsset: "0050",
      data: series([100, 101, 100, 103, 105, 104, 107, 109, 111, 113]),
    },
  ],
};

export const us00646Chart: DashboardChart = {
  id: "us00646-relative",
  title: "00646 vs S&P 500 vs USD/TWD",
  description: "以起點 100 正規化，觀察美股本身與匯率對 00646 的相對影響。",
  normalized: true,
  series: [
    {
      name: "元大 S&P 500",
      symbol: "00646",
      relatedAsset: "00646",
      data: series([100, 101, 103, 102, 104, 106, 107, 108, 110, 111]),
    },
    {
      name: "S&P 500",
      symbol: "SPX",
      relatedAsset: "00646",
      data: series([100, 101, 102, 101, 103, 105, 106, 108, 109, 110]),
    },
    {
      name: "美元兌台幣",
      symbol: "USD/TWD",
      relatedAsset: "FX",
      data: series([100, 99.6, 100.4, 101.2, 101.7, 101.1, 102.5, 102.9, 102.3, 101.8]),
    },
  ],
};

export const fxChart: DashboardChart = {
  id: "fx-rates",
  title: "USD/TWD vs JPY/TWD",
  description: "使用實際匯率數值，觀察美元與日圓兌台幣趨勢。",
  normalized: false,
  series: [
    {
      name: "美元兌台幣",
      symbol: "USD/TWD",
      relatedAsset: "FX",
      data: series([31.4, 31.55, 31.68, 31.82, 31.74, 31.95, 32.08, 32.01, 31.98, 31.92]),
    },
    {
      name: "日圓兌台幣",
      symbol: "JPY/TWD",
      relatedAsset: "FX",
      data: series([0.213, 0.211, 0.209, 0.206, 0.208, 0.207, 0.204, 0.203, 0.204, 0.205]),
    },
  ],
};

export const cht2412Chart: DashboardChart = {
  id: "cht-price-yield",
  title: "2412 股價 vs 殖利率",
  description: "左軸顯示股價，右軸顯示現金殖利率。",
  normalized: false,
  dualAxis: true,
  series: [
    {
      name: "中華電信股價",
      symbol: "2412",
      relatedAsset: "2412",
      yAxisId: "left",
      data: series([121.5, 122, 123.5, 123, 124, 125.5, 126, 125, 126.2, 126.5]),
    },
    {
      name: "現金殖利率",
      symbol: "Yield",
      relatedAsset: "2412",
      yAxisId: "right",
      data: series([3.91, 3.89, 3.85, 3.86, 3.83, 3.78, 3.77, 3.8, 3.76, 3.75]),
    },
  ],
};

export const riskChart: DashboardChart = {
  id: "risk-relative",
  title: "市場風險指標：VIX vs TNX vs GLD",
  description: "以起點 100 正規化，比較市場恐慌、利率壓力與避險情緒。",
  normalized: true,
  series: [
    {
      name: "市場波動率指數",
      symbol: "VIX",
      relatedAsset: "Risk",
      data: series([100, 96, 102, 111, 104, 98, 107, 113, 105, 118]),
    },
    {
      name: "10年期美債殖利率",
      symbol: "TNX",
      relatedAsset: "Risk",
      data: series([100, 101, 100, 103, 104, 106, 105, 108, 109, 111]),
    },
    {
      name: "黃金 ETF",
      symbol: "GLD",
      relatedAsset: "Risk",
      data: series([100, 99, 101, 103, 104, 106, 109, 111, 113, 116]),
    },
  ],
};

export const dashboardCharts: DashboardChart[] = [
  tw0050Chart,
  us00646Chart,
  fxChart,
  cht2412Chart,
  riskChart,
];
