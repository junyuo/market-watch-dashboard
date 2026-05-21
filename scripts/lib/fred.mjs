const FRED_CSV_BASE_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv";

export async function fetchFredCsv(seriesId) {
  const url = new URL(FRED_CSV_BASE_URL);
  url.searchParams.set("id", seriesId);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FRED ${seriesId} failed: ${response.status} ${response.statusText}`);
  }

  const csv = await response.text();
  const rows = csv.trim().split("\n").slice(1);

  return rows
    .map((row) => {
      const [date, rawValue] = row.split(",");
      const value = Number(rawValue);
      if (!date || rawValue === "." || Number.isNaN(value)) {
        return null;
      }

      return { date, value };
    })
    .filter(Boolean);
}
