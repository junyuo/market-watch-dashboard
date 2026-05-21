const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

const requestHeaders = {
  "User-Agent": "market-watch-dashboard/1.0",
  Accept: "application/json",
};

export async function fetchYahooChart(symbol, options = {}) {
  const range = options.range ?? "1mo";
  const interval = options.interval ?? "1d";
  const url = new URL(`${YAHOO_CHART_BASE_URL}/${encodeURIComponent(symbol)}`);

  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "history");

  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok) {
    throw new Error(`Yahoo Finance ${symbol} failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const error = payload?.chart?.error;

  if (error) {
    throw new Error(`Yahoo Finance ${symbol} error: ${error.description ?? error.code}`);
  }

  if (!result?.timestamp?.length) {
    throw new Error(`Yahoo Finance ${symbol} returned no chart data`);
  }

  const quote = result.indicators?.quote?.[0] ?? {};
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const closes = quote.close ?? [];
  const timestamps = result.timestamp ?? [];

  const data = timestamps
    .map((timestamp, index) => {
      const close = adjClose[index] ?? closes[index];
      if (typeof close !== "number" || Number.isNaN(close)) {
        return null;
      }

      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        value: round(close, 4),
      };
    })
    .filter(Boolean);

  if (!data.length) {
    throw new Error(`Yahoo Finance ${symbol} returned no usable close prices`);
  }

  const previousClose = result.meta?.chartPreviousClose;

  return {
    source: "Yahoo Finance",
    symbol,
    currency: result.meta?.currency,
    exchangeName: result.meta?.exchangeName,
    regularMarketPrice: result.meta?.regularMarketPrice,
    previousClose,
    data,
  };
}

export async function fetchYahooCharts(symbols, options = {}) {
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const chart = await fetchYahooChart(symbol, options);
        return [symbol, { ok: true, chart }];
      } catch (error) {
        console.warn(`[market-data] Yahoo fetch failed for ${symbol}: ${error.message}`);
        return [symbol, { ok: false, error: error.message }];
      }
    }),
  );

  return Object.fromEntries(entries);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
