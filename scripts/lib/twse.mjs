const TWSE_STOCK_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";

export async function fetchTwseDailySnapshot() {
  const response = await fetch(TWSE_STOCK_DAY_ALL_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "market-watch-dashboard/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`TWSE snapshot failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
