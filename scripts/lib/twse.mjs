const TWSE_STOCK_DAY_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";
const TWSE_INSTITUTIONAL_SUMMARY_URL = "https://www.twse.com.tw/rwd/zh/fund/BFI82U";

const requestHeaders = {
  Accept: "application/json",
  "User-Agent": "market-watch-dashboard/1.0",
};

export async function fetchTwseDailySnapshot() {
  const response = await fetch(TWSE_STOCK_DAY_ALL_URL, {
    headers: requestHeaders,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`TWSE snapshot failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchInstitutionalSummary(date, options = {}) {
  const url = new URL(TWSE_INSTITUTIONAL_SUMMARY_URL);
  url.searchParams.set("dayDate", date);
  url.searchParams.set("type", "day");
  url.searchParams.set("response", "json");

  const response = await fetch(url, {
    headers: requestHeaders,
    signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
  });
  if (!response.ok) {
    throw new Error(`TWSE institutional summary failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload?.stat !== "OK" || !Array.isArray(payload?.data) || payload.data.length === 0) {
    throw new Error(`TWSE institutional summary has no data for ${date}`);
  }

  const foreignRow = payload.data.find((row) => String(row?.[0] ?? "").startsWith("外資及陸資("));
  if (!foreignRow) {
    throw new Error(`TWSE institutional summary missing foreign investor row for ${date}`);
  }

  return {
    source: "TWSE BFI82U",
    date: payload.date ?? date,
    title: payload.title,
    buyAmount: parseTwseNumber(foreignRow[1]),
    sellAmount: parseTwseNumber(foreignRow[2]),
    netAmount: parseTwseNumber(foreignRow[3]),
  };
}

export async function fetchForeignInvestorFlowSeries(options = {}) {
  const lookbackDays = options.lookbackDays ?? 45;
  const totalTimeoutMs = options.totalTimeoutMs ?? 60000;
  const startedAt = Date.now();
  const endDate = options.endDate ? parseDate(options.endDate) : new Date();
  const results = [];

  for (let offset = 0; offset < lookbackDays; offset += 1) {
    if (Date.now() - startedAt >= totalTimeoutMs) {
      console.warn(`[market-data] TWSE foreign flow lookup stopped after ${totalTimeoutMs / 1000} seconds`);
      break;
    }
    const date = new Date(endDate);
    date.setDate(date.getDate() - offset);

    try {
      const remainingMs = Math.max(1000, totalTimeoutMs - (Date.now() - startedAt));
      const summary = await fetchInstitutionalSummary(formatDate(date), { timeoutMs: Math.min(10000, remainingMs) });
      results.push({
        date: toIsoDate(summary.date),
        value: summary.netAmount,
        sourceDate: summary.date,
      });
    } catch {
      // Non-trading days and not-yet-published days are expected here.
    }
  }

  return results.reverse();
}

function parseTwseNumber(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid TWSE numeric value: ${value}`);
  }

  return parsed;
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
}

function parseDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toIsoDate(value) {
  const raw = String(value ?? "");
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }

  return raw;
}
