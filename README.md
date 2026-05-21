# 投資觀察儀表板

`market-watch-dashboard` 是一個部署到 GitHub Pages 的個人版金融資訊儀表板，用來觀察 0050、00646、2412、匯率與市場風險指標。

目前版本優先讀取每日產生的靜態 JSON；若 JSON 讀取失敗，才使用內建備援資料。不包含個人資產、真實持股、成本或損益資料。

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

## 如何修改備援資料

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
- `usdTwdChart`
- `jpyTwdChart`
- `cht2412Chart`
- `riskChart`
- `dashboardCharts`

## 每日資料更新

第二階段新增每日資料抓取流程，會產生：

```text
public/data/market.json
public/data/chartData.json
```

前端啟動時會先讀取：

```text
${BASE_URL}data/market.json
${BASE_URL}data/chartData.json
```

如果 JSON 讀取失敗，頁面會自動 fallback 到 `src/data/marketData.ts` 與 `src/data/chartData.ts` 的備援資料，並顯示「目前顯示備援資料」。

### 手動執行資料更新

```bash
npm run update:data
```

等同於：

```bash
node scripts/fetch-market-data.mjs
```

執行成功後會更新 `public/data/market.json` 與 `public/data/chartData.json`。

### GitHub Actions 排程

資料更新 workflow 位於：

```text
.github/workflows/update-market-data.yml
```

支援：

- `workflow_dispatch` 手動執行
- 週一到週五台灣時間 08:30 自動執行

GitHub Actions cron 使用 UTC，因此排程為：

```text
30 0 * * 1-5
```

workflow 會依序執行：

1. checkout
2. setup node
3. `npm ci`
4. `node scripts/fetch-market-data.mjs`
5. `npm run build`
6. deploy GitHub Pages

資料抓取步驟使用容錯設計；如果公開資料來源暫時失敗，會顯示 warning，不讓整個部署流程因行情抓取失敗而中斷。

## 資料來源與 Symbol Mapping

目前資料更新以免費、免 API Key、適合個人 Dashboard 的資料來源為主。

目前主要使用 Yahoo Finance chart endpoint，由 GitHub Actions 抓取後寫入靜態 JSON。前端只讀 JSON，不直接呼叫 Yahoo Finance。

主要 symbol mapping：

| 顯示用途 | 資料 symbol |
| --- | --- |
| 0050 元大台灣50 | `0050.TW` |
| 00646 元大 S&P 500 | `00646.TW` |
| 2412 中華電信 | `2412.TW` |
| 台股個股 | `2330.TW`, `2454.TW`, `2308.TW`, `2317.TW`, `3711.TW`, `3045.TW`, `4904.TW` |
| 台積電 ADR | `TSM` |
| S&P 500 proxy | `SPY` |
| Nasdaq 100 proxy | `QQQ` |
| 美股大型科技股 | `NVDA`, `MSFT`, `AAPL`, `AMZN`, `META`, `GOOGL`, `AVGO` |
| 風險與避險 ETF | `GLD`, `USO`, `TIP` |
| VIX | `^VIX` |
| TNX | `^TNX` |
| DXY | `DX-Y.NYB` |
| USD/TWD | `USDTWD=X` |
| USD/JPY | `JPY=X` |
| JPY/TWD | 由 `USD/TWD / USD/JPY` 交叉計算 |
| TAIEX | `^TWII`，若資料來源失敗會自動略過或標示資料暫缺 |

TWSE 與 FRED 的模組已保留在 `scripts/lib/`，後續可逐步把台股資料、外資買賣超、VIX 等來源改成更正式的公開資料。

## 資料抓取限制

- Yahoo Finance 為免費公開資料來源，可能有延遲、缺漏、symbol 變動或暫時不可用。
- 目前不追求即時報價，只適合每日觀察。
- `SPY` 作為 S&P 500 proxy，`QQQ` 作為 Nasdaq 100 proxy。
- 2412 EPS、現金股利、月營收尚未串接正式資料來源；資料更新時會優先沿用前一次 JSON，沒有前值才顯示 `N/A`。
- 2412 殖利率只有在現金股利與股價都可用時才計算；否則沿用前一次 JSON 或顯示 `N/A`。
- 外資買賣超尚未串接正式資料來源；資料更新時會優先沿用前一次 JSON，沒有前值才顯示 `N/A`。

## 為什麼前端不直接抓 API

前端部署在 GitHub Pages，屬於公開靜態網站。若前端直接呼叫行情 API：

- API Key 會暴露在瀏覽器中。
- 第三方 API 可能被使用者端 CORS 擋下。
- 每位訪客都會重複打 API，較不穩定。

因此本專案採用 GitHub Actions 定時抓取資料，產生靜態 JSON，前端只讀取 `public/data/*.json`。

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
