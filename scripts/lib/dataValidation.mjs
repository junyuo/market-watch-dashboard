const ALLOWED_RELATED_ASSETS = new Set(["0050", "00646", "2412", "FX", "Macro", "Risk", "AI"]);

const MARKET_GROUP_RULES = {
  summaryItems: { minItems: 4, minAvailability: 0.75 },
  riskIndicators: { minItems: 5, minAvailability: 0.6 },
  tw0050Items: { minItems: 8, minAvailability: 0.6 },
  us00646Items: { minItems: 11, minAvailability: 0.6 },
  aiSupplyChainItems: { minItems: 16, minAvailability: 0.5 },
  cht2412Items: { minItems: 3, minAvailability: 0.4 },
  fxMacroItems: { minItems: 4, minAvailability: 0.5 },
};

const REQUIRED_CHART_SERIES = {
  tw0050: ["0050.TW", "2330.TW"],
  us00646: ["00646.TW", "SPY", "USD/TWD"],
  usdTwd: ["USD/TWD"],
  jpyTwd: ["JPY/TWD"],
  cht2412: ["2412.TW"],
  risk: ["VIX", "TNX", "GLD"],
};

const REQUIRED_ITEM_FIELDS = [
  "name",
  "symbol",
  "category",
  "price",
  "change",
  "changePercent",
  "period5d",
  "period1m",
  "relatedAsset",
  "updatedAt",
];

export function validateSnapshot({ marketData, chartData, previous, enforceFreshness = true, now = new Date() }) {
  const errors = [];
  const warnings = [];

  validateMarketData(marketData, errors);
  validateChartData(chartData, errors);

  if (previous?.marketData && previous?.chartData) {
    validateRegression(chartData, previous.chartData, errors, warnings);
  }

  if (enforceFreshness) {
    validateFreshness(chartData, now, errors);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function repairSnapshot(candidate, previous) {
  const marketData = structuredClone(candidate.marketData);
  const chartData = structuredClone(candidate.chartData);
  const repairs = [];

  if (!isValidUpdatedAt(marketData.updatedAt) && isValidUpdatedAt(previous?.marketData?.updatedAt)) {
    marketData.updatedAt = previous.marketData.updatedAt;
    repairs.push("marketData.updatedAt");
  }

  if (!isValidUpdatedAt(chartData.updatedAt) && isValidUpdatedAt(previous?.chartData?.updatedAt)) {
    chartData.updatedAt = previous.chartData.updatedAt;
    repairs.push("chartData.updatedAt");
  }

  for (const groupName of Object.keys(MARKET_GROUP_RULES)) {
    const previousItems = Array.isArray(previous?.marketData?.[groupName]) ? previous.marketData[groupName] : [];
    if (!Array.isArray(marketData[groupName])) {
      marketData[groupName] = structuredClone(previousItems);
      repairs.push(`${groupName}:group`);
      continue;
    }

    const previousByKey = new Map(previousItems.map((item) => [marketItemKey(item), item]));
    const candidateByKey = new Map(marketData[groupName].map((item) => [marketItemKey(item), item]));

    for (const item of marketData[groupName]) {
      const previousItem = previousByKey.get(marketItemKey(item));
      if (!previousItem) continue;

      for (const field of [...REQUIRED_ITEM_FIELDS, "ma60", "bias", "note"]) {
        if (!isValidItemField(field, item[field]) && isValidItemField(field, previousItem[field])) {
          item[field] = structuredClone(previousItem[field]);
          repairs.push(`${groupName}:${item.symbol}:${field}`);
        }
      }
    }

    for (const previousItem of previousItems) {
      const key = marketItemKey(previousItem);
      if (!candidateByKey.has(key)) {
        marketData[groupName].push(structuredClone(previousItem));
        repairs.push(`${groupName}:${previousItem.symbol}:item`);
      }
    }
  }

  const previousCharts = Array.isArray(previous?.chartData?.charts) ? previous.chartData.charts : [];
  if (!Array.isArray(chartData.charts)) {
    chartData.charts = structuredClone(previousCharts);
    repairs.push("charts:group");
  } else {
    const previousById = new Map(previousCharts.map((chart) => [chart.id, chart]));
    const candidateById = new Map(chartData.charts.map((chart) => [chart.id, chart]));

    for (const chart of chartData.charts) {
      const previousChart = previousById.get(chart.id);
      if (!previousChart) continue;
      if (!Array.isArray(chart.series)) chart.series = [];

      const previousSeriesBySymbol = new Map((previousChart.series ?? []).map((series) => [series.symbol, series]));
      const candidateSeriesBySymbol = new Map(chart.series.map((series) => [series.symbol, series]));

      for (const series of chart.series) {
        const previousSeries = previousSeriesBySymbol.get(series.symbol);
        if (previousSeries && shouldReplaceSeries(series, previousSeries)) {
          series.data = structuredClone(previousSeries.data);
          repairs.push(`charts:${chart.id}:${series.symbol}:data`);
        }
      }

      for (const previousSeries of previousChart.series ?? []) {
        if (!candidateSeriesBySymbol.has(previousSeries.symbol)) {
          chart.series.push(structuredClone(previousSeries));
          repairs.push(`charts:${chart.id}:${previousSeries.symbol}:series`);
        }
      }
    }

    for (const previousChart of previousCharts) {
      if (!candidateById.has(previousChart.id)) {
        chartData.charts.push(structuredClone(previousChart));
        repairs.push(`charts:${previousChart.id}:chart`);
      }
    }
  }

  return { marketData, chartData, repairs };
}

export function snapshotsEqual(left, right) {
  return canonicalString(stripVolatileFields(left)) === canonicalString(stripVolatileFields(right));
}

export function latestChartDate(chartData) {
  const dates = (chartData?.charts ?? [])
    .flatMap((chart) => chart.series ?? [])
    .flatMap((series) => series.data ?? [])
    .map((point) => point.date)
    .filter(isIsoDate);
  return dates.sort().at(-1) ?? null;
}

function validateMarketData(marketData, errors) {
  if (!isPlainObject(marketData)) {
    errors.push("market.json must contain an object");
    return;
  }

  if (!isValidUpdatedAt(marketData.updatedAt)) {
    errors.push("market.json updatedAt is invalid");
  }

  for (const [groupName, rule] of Object.entries(MARKET_GROUP_RULES)) {
    const items = marketData[groupName];
    if (!Array.isArray(items)) {
      errors.push(`${groupName} must be an array`);
      continue;
    }

    if (items.length < rule.minItems) {
      errors.push(`${groupName} has ${items.length} items; expected at least ${rule.minItems}`);
    }

    const keys = new Set();
    let availableCount = 0;
    items.forEach((item, index) => {
      const itemErrors = validateMarketItem(item);
      itemErrors.forEach((error) => errors.push(`${groupName}[${index}] ${error}`));
      const key = marketItemKey(item);
      if (keys.has(key)) errors.push(`${groupName} contains duplicate item ${key}`);
      keys.add(key);
      if (!isUnavailableValue(item?.price)) availableCount += 1;
    });

    const availability = items.length ? availableCount / items.length : 0;
    if (availability < rule.minAvailability) {
      errors.push(`${groupName} availability ${(availability * 100).toFixed(0)}% is below ${rule.minAvailability * 100}%`);
    }
  }
}

function validateMarketItem(item) {
  const errors = [];
  if (!isPlainObject(item)) return ["must be an object"];

  for (const field of REQUIRED_ITEM_FIELDS) {
    if (!isValidItemField(field, item[field])) errors.push(`${field} is invalid`);
  }

  if (!ALLOWED_RELATED_ASSETS.has(item.relatedAsset)) errors.push("relatedAsset is unsupported");
  if (item.ma60 !== undefined && !isValidScalar(item.ma60)) errors.push("ma60 is invalid");
  if (item.bias !== undefined && !isValidScalar(item.bias)) errors.push("bias is invalid");
  return errors;
}

function validateChartData(chartData, errors) {
  if (!isPlainObject(chartData)) {
    errors.push("chartData.json must contain an object");
    return;
  }

  if (!isValidUpdatedAt(chartData.updatedAt)) errors.push("chartData.json updatedAt is invalid");
  if (!Array.isArray(chartData.charts)) {
    errors.push("charts must be an array");
    return;
  }

  const chartsById = new Map(chartData.charts.map((chart) => [chart.id, chart]));
  for (const [chartId, requiredSymbols] of Object.entries(REQUIRED_CHART_SERIES)) {
    const chart = chartsById.get(chartId);
    if (!chart || !Array.isArray(chart.series)) {
      errors.push(`required chart ${chartId} is missing`);
      continue;
    }

    const seriesBySymbol = new Map(chart.series.map((series) => [series.symbol, series]));
    for (const symbol of requiredSymbols) {
      const series = seriesBySymbol.get(symbol);
      if (!series) {
        errors.push(`${chartId} required series ${symbol} is missing`);
        continue;
      }
      validateSeries(chartId, series, errors);
    }

    for (const series of chart.series) validateSeries(chartId, series, errors, false);
  }
}

function validateSeries(chartId, series, errors, requireData = true) {
  if (!isPlainObject(series) || typeof series.symbol !== "string" || !series.symbol) {
    errors.push(`${chartId} contains an invalid series`);
    return;
  }
  if (!Array.isArray(series.data)) {
    errors.push(`${chartId}/${series.symbol} data must be an array`);
    return;
  }
  if (requireData && series.data.length < 2) {
    errors.push(`${chartId}/${series.symbol} needs at least 2 points`);
    return;
  }

  let previousDate = "";
  for (const [index, point] of series.data.entries()) {
    if (!isPlainObject(point) || !isIsoDate(point.date) || !isFiniteNumber(point.value)) {
      errors.push(`${chartId}/${series.symbol}[${index}] is invalid`);
      continue;
    }
    if (point.date <= previousDate) errors.push(`${chartId}/${series.symbol} dates must be strictly increasing`);
    previousDate = point.date;
  }
}

function validateRegression(chartData, previousChartData, errors, warnings) {
  const previousSeries = seriesMap(previousChartData);
  for (const [key, candidate] of seriesMap(chartData)) {
    const previous = previousSeries.get(key);
    if (!previous || !isValidSeriesData(previous.data) || !isValidSeriesData(candidate.data)) continue;

    const candidateLatest = candidate.data.at(-1)?.date;
    const previousLatest = previous.data.at(-1)?.date;
    if (candidateLatest < previousLatest) errors.push(`${key} latest date regressed from ${previousLatest} to ${candidateLatest}`);
    if (candidate.data.length < previous.data.length - 10) {
      errors.push(`${key} lost too many history points (${previous.data.length} -> ${candidate.data.length})`);
    } else if (candidate.data.length < previous.data.length) {
      warnings.push(`${key} history shortened (${previous.data.length} -> ${candidate.data.length})`);
    }
  }
}

function validateFreshness(chartData, now, errors) {
  const latest = latestChartDate(chartData);
  if (!latest) {
    errors.push("chart data has no valid market date");
    return;
  }

  const ageDays = Math.floor((startOfUtcDay(now).getTime() - new Date(`${latest}T00:00:00Z`).getTime()) / 86400000);
  if (ageDays > 10) errors.push(`latest market date ${latest} is ${ageDays} days old`);
  if (ageDays < -2) errors.push(`latest market date ${latest} is unexpectedly in the future`);
}

function shouldReplaceSeries(candidate, previous) {
  if (!isValidSeriesData(candidate?.data)) return isValidSeriesData(previous?.data);
  if (!isValidSeriesData(previous?.data)) return false;
  return candidate.data.at(-1).date < previous.data.at(-1).date || candidate.data.length < previous.data.length - 10;
}

function seriesMap(chartData) {
  return new Map(
    (chartData?.charts ?? []).flatMap((chart) =>
      (chart.series ?? []).map((series) => [`${chart.id}/${series.symbol}`, series]),
    ),
  );
}

function isValidSeriesData(data) {
  if (!Array.isArray(data) || data.length < 2) return false;
  let previousDate = "";
  return data.every((point) => {
    const valid = isPlainObject(point) && isIsoDate(point.date) && isFiniteNumber(point.value) && point.date > previousDate;
    previousDate = point?.date ?? previousDate;
    return valid;
  });
}

function marketItemKey(item) {
  return `${item?.symbol ?? ""}::${item?.name ?? ""}`;
}

function isValidItemField(field, value) {
  if (["name", "symbol", "category"].includes(field)) return typeof value === "string" && value.trim().length > 0;
  if (field === "relatedAsset") return typeof value === "string" && ALLOWED_RELATED_ASSETS.has(value);
  if (field === "updatedAt") return isValidUpdatedAt(value);
  if (field === "note") return value === undefined || (typeof value === "string" && value.trim().length > 0);
  return isValidScalar(value);
}

function isValidScalar(value) {
  return isFiniteNumber(value) || (typeof value === "string" && value.trim().length > 0);
}

function isUnavailableValue(value) {
  return typeof value === "string" && ["N/A", "資料暫缺"].includes(value.trim());
}

function isValidUpdatedAt(value) {
  if (typeof value !== "string") return false;
  const taipei = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC\+8$/);
  const parsed = taipei ? new Date(`${taipei[1]}T${taipei[2]}+08:00`) : new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stripVolatileFields(value) {
  if (Array.isArray(value)) return value.map(stripVolatileFields);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "updatedAt")
      .map(([key, child]) => [key, stripVolatileFields(child)]),
  );
}

function canonicalString(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalString).join(",")}]`;
  if (!isPlainObject(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalString(value[key])}`).join(",")}}`;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
