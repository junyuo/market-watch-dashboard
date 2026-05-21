# 投資觀察儀表板

`market-watch-dashboard` 是一個部署到 GitHub Pages 的個人版金融資訊儀表板，用來觀察 0050、00646、2412、匯率與市場風險指標。

目前第一版只使用本地 mock data，不包含個人資產、真實持股、成本或損益資料。

## 技術架構

- Vite
- React
- TypeScript
- Recharts
- CSS
- GitHub Pages
- GitHub Actions 自動部署

GitHub Pages base path 已設定為：

```ts
base: "/market-watch-dashboard/"
```

預期部署網址：

https://junyuo.github.io/market-watch-dashboard/

## 如何本機啟動

```bash
npm install
npm run dev
```

啟動後依照終端機顯示的 localhost URL 開啟即可。

## 如何 Build

```bash
npm run build
```

build 成功後會產生 `dist/`，供 GitHub Pages 部署使用。

## 如何部署到 GitHub Pages

專案已包含 GitHub Actions workflow：

```text
.github/workflows/deploy.yml
```

當 `main` branch 有 push 時，workflow 會自動：

1. checkout repository
2. setup Node.js
3. 執行 `npm ci`
4. 執行 `npm run build`
5. configure GitHub Pages
6. upload `dist/` artifact
7. deploy 到 GitHub Pages

GitHub repository 需要在 Pages 設定中啟用 GitHub Actions 作為部署來源。

請到 GitHub repository 執行一次設定：

1. 進入 `Settings`。
2. 進入 `Pages`。
3. 在 `Build and deployment` 的 `Source` 選擇 `GitHub Actions`。
4. 儲存後重新執行 `Deploy to GitHub Pages` workflow，或 push 到 `main` branch。

如果 Pages 尚未啟用，`actions/configure-pages` 會出現類似 `Get Pages site failed` 或 `Not Found` 的錯誤。這不是 Vite build 失敗，而是 repository 的 Pages 尚未設定為使用 GitHub Actions 部署。

## 如何修改 Mock Data

市場觀察資料集中在：

```text
src/data/marketData.ts
```

包含以下分組：

- `summaryItems`
- `riskIndicators`
- `tw0050Items`
- `us00646Items`
- `cht2412Items`
- `fxMacroItems`

線圖資料集中在：

```text
src/data/chartData.ts
```

包含以下圖表：

- `tw0050Chart`
- `us00646Chart`
- `fxChart`
- `cht2412Chart`
- `riskChart`
- `dashboardCharts`

## 未來如何改接 API

建議不要讓前端直接呼叫需要 API Key 的行情服務。較合適的方式是：

1. 使用 GitHub Actions 定時抓取資料。
2. 在 workflow 中使用 repository secrets 保存 API Key。
3. 抓取後產生靜態 JSON，例如 `public/data/market.json`。
4. 前端只讀取 `market.json`。
5. GitHub Pages 只部署已產出的靜態檔案。

## 未來資料來源規劃

### 台股資料

可優先考慮臺灣證券交易所 OpenAPI 或公開資料。

標的包含：

- 0050
- 00646
- 2330
- 2454
- 2308
- 2317
- 3711
- 2412
- 3045
- 4904

### 美股與 ETF 資料

可考慮 Yahoo Finance、Stooq、Alpha Vantage、Twelve Data 或其他行情 API。

標的包含：

- TSM
- SPX
- NDX
- NVDA
- MSFT
- AAPL
- AMZN
- META
- GOOGL
- AVGO
- VIX
- TNX
- USO
- TIP
- GLD
- DXY

### 匯率資料

- USD/TWD 可考慮中央銀行公開資料或金融資料 API。
- JPY/TWD 可考慮金融資料 API，或以 USD/TWD 與 USD/JPY 交叉計算。

### 更新方式

- 建議未來使用 GitHub Actions 定時抓資料。
- 抓取後產生 `public/data/market.json`。
- 前端只讀取 `market.json`。
- 不要在前端暴露 API Key。

## 目前不包含

- AI 摘要
- 新聞分析
- 交易訊號
- 投資建議
- 登入功能
- 後端資料庫
- 個人持股金額
- 真實持股張數
- 真實成本
- 個人損益
- 任何需要在前端暴露 API Key 的設計
