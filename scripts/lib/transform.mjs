export function round(value, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return value;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function latestPoint(series = []) {
  return [...series].reverse().find((point) => typeof point?.value === "number");
}

export function previousPoint(series = []) {
  const usable = series.filter((point) => typeof point?.value === "number");
  return usable.length >= 2 ? usable[usable.length - 2] : undefined;
}

export function calculateChange(series = []) {
  const latest = latestPoint(series);
  const previous = previousPoint(series);

  if (!latest || !previous || !previous.value) {
    return { price: "N/A", change: "N/A", changePercent: "N/A" };
  }

  const change = latest.value - previous.value;

  return {
    price: round(latest.value, 4),
    change: round(change, 4),
    changePercent: round((change / previous.value) * 100, 2),
  };
}

export function periodChange(series = [], sessionsBack) {
  const usable = series.filter((point) => typeof point?.value === "number");
  if (usable.length < 2) {
    return "N/A";
  }

  const latest = usable[usable.length - 1];
  const base = usable[Math.max(0, usable.length - 1 - sessionsBack)];

  if (!base?.value) {
    return "N/A";
  }

  return round(((latest.value - base.value) / base.value) * 100, 2);
}

export function normalizeSeries(series = []) {
  const first = series.find((point) => typeof point?.value === "number" && point.value !== 0);
  if (!first) {
    return [];
  }

  return series
    .filter((point) => typeof point?.value === "number")
    .map((point) => ({
      date: point.date,
      value: round((point.value / first.value) * 100, 2),
    }));
}

export function alignSeriesByDate(seriesList) {
  const maps = seriesList.map((series) => new Map(series.map((point) => [point.date, point.value])));
  const dates = [...maps[0].keys()].filter((date) => maps.every((map) => map.has(date)));

  return dates.map((date) => ({
    date,
    values: maps.map((map) => map.get(date)),
  }));
}

export function buildMarketItem(definition, chartResult, updatedAt) {
  if (!chartResult?.ok) {
    return unavailableMarketItem(definition, updatedAt);
  }

  const series = chartResult.chart.data ?? [];
  const metrics = calculateChange(series);

  return {
    name: definition.name,
    symbol: definition.displaySymbol ?? definition.symbol,
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

export function unavailableMarketItem(definition, updatedAt) {
  return {
    name: definition.name,
    symbol: definition.displaySymbol ?? definition.symbol,
    category: definition.category,
    price: "N/A",
    change: "N/A",
    changePercent: "N/A",
    period5d: "N/A",
    period1m: "N/A",
    relatedAsset: definition.relatedAsset,
    updatedAt,
    note: definition.unavailableNote ?? "資料暫缺",
  };
}

export function buildSeries(definition, chartResult, options = {}) {
  if (definition.data) {
    return {
      name: definition.name,
      symbol: definition.displaySymbol ?? definition.symbol,
      relatedAsset: definition.relatedAsset,
      data: options.normalized ? normalizeSeries(definition.data) : definition.data,
      yAxisId: definition.yAxisId,
    };
  }

  if (!chartResult?.ok) {
    return {
      name: definition.name,
      symbol: definition.displaySymbol ?? definition.symbol,
      relatedAsset: definition.relatedAsset,
      data: [],
      yAxisId: definition.yAxisId,
    };
  }

  const rawData = chartResult.chart.data ?? [];

  return {
    name: definition.name,
    symbol: definition.displaySymbol ?? definition.symbol,
    relatedAsset: definition.relatedAsset,
    data: options.normalized ? normalizeSeries(rawData) : rawData,
    yAxisId: definition.yAxisId,
  };
}
