import { fetchYahooChart } from "./yahooFinance.mjs";
import { alignSeriesByDate, round } from "./transform.mjs";

export async function fetchUsdTwd(symbol = "USDTWD=X") {
  return fetchYahooChart(symbol, { range: "1y", interval: "1d" });
}

export async function fetchUsdJpy(symbol = "JPY=X") {
  return fetchYahooChart(symbol, { range: "1y", interval: "1d" });
}

export function deriveJpyTwd(usdTwdSeries, usdJpySeries) {
  const aligned = alignSeriesByDate([usdTwdSeries, usdJpySeries]);

  return aligned
    .map((point) => {
      const usdTwd = point.values[0];
      const usdJpy = point.values[1];
      if (!usdTwd || !usdJpy) {
        return null;
      }

      return {
        date: point.date,
        value: round(usdTwd / usdJpy, 5),
      };
    })
    .filter(Boolean);
}
