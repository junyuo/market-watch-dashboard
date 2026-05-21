export type RiskStatusLevel =
  | "calm"
  | "neutral"
  | "warning"
  | "stress"
  | "rising"
  | "falling"
  | "flat"
  | "unavailable";

export type RiskSignal = {
  symbol: string;
  name: string;
  value: number | null;
  period5dChangePercent?: number | null;
  period1mChangePercent?: number | null;
  period1mChangePoint?: number | null;
  status: string;
  level: RiskStatusLevel;
  description: string;
};

type RiskSignalInput = Omit<RiskSignal, "status" | "level" | "description">;

const isValidNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

const unavailableSignal = (input: RiskSignalInput): RiskSignal => ({
  ...input,
  value: isValidNumber(input.value) ? input.value : null,
  status: "資料暫缺",
  level: "unavailable",
  description: "資料不足，暫時無法判斷市場風險狀態。",
});

export function getVixSignal(input: RiskSignalInput): RiskSignal {
  if (!isValidNumber(input.value) || !isValidNumber(input.period5dChangePercent)) {
    return unavailableSignal(input);
  }

  let status = "平穩";
  let level: RiskStatusLevel = "calm";
  let description = "VIX 處於相對平穩區間，市場波動壓力較低。";

  if (input.value >= 25) {
    status = "恐慌";
    level = "stress";
    description = "VIX 處於高檔區間，市場波動壓力升高。";
  } else if (input.value >= 15) {
    status = "緊張";
    level = "warning";
    description = "VIX 處於中性偏緊張區間，市場波動需要留意。";
  }

  if (input.period5dChangePercent >= 20) {
    description = `${description} 近 5 日 VIX 快速升溫。`;
  } else if (input.period5dChangePercent <= -20) {
    description = `${description} 近 5 日 VIX 明顯降溫。`;
  }

  return { ...input, status, level, description };
}

export function getTnxSignal(input: RiskSignalInput): RiskSignal {
  if (!isValidNumber(input.value) || !isValidNumber(input.period1mChangePoint)) {
    return unavailableSignal(input);
  }

  if (input.period1mChangePoint >= 0.2) {
    return {
      ...input,
      status: "利率壓力上升",
      level: "rising",
      description: "10 年期美債殖利率近 1 月明顯上行，資金成本與成長股估值壓力升高。",
    };
  }

  if (input.period1mChangePoint <= -0.2) {
    return {
      ...input,
      status: "利率壓力下降",
      level: "falling",
      description: "10 年期美債殖利率近 1 月明顯下行，利率壓力相對下降。",
    };
  }

  return {
    ...input,
    status: "利率壓力持平",
    level: "flat",
    description: "10 年期美債殖利率近 1 月變化有限，利率壓力大致持平。",
  };
}

export function getUsoSignal(input: RiskSignalInput): RiskSignal {
  if (!isValidNumber(input.value) || !isValidNumber(input.period1mChangePercent)) {
    return unavailableSignal(input);
  }

  if (input.period1mChangePercent >= 5) {
    return {
      ...input,
      status: "能源成本上升",
      level: "rising",
      description: "USO 近 1 月上漲，油價與能源成本壓力升高。",
    };
  }

  if (input.period1mChangePercent <= -5) {
    return {
      ...input,
      status: "能源成本下降",
      level: "falling",
      description: "USO 近 1 月下跌，油價與能源成本壓力降溫。",
    };
  }

  return {
    ...input,
    status: "能源成本持平",
    level: "flat",
    description: "USO 近 1 月變化有限，能源成本環境大致持平。",
  };
}

export function getTipSignal(input: RiskSignalInput): RiskSignal {
  if (!isValidNumber(input.value) || !isValidNumber(input.period1mChangePercent)) {
    return unavailableSignal(input);
  }

  if (input.period1mChangePercent >= 1) {
    return {
      ...input,
      status: "通膨預期升溫",
      level: "rising",
      description: "TIP 近 1 月上漲，通膨預期 / 實質利率環境出現升溫訊號。",
    };
  }

  if (input.period1mChangePercent <= -1) {
    return {
      ...input,
      status: "通膨預期降溫",
      level: "falling",
      description: "TIP 近 1 月下跌，通膨預期 / 實質利率環境出現降溫訊號。",
    };
  }

  return {
    ...input,
    status: "通膨預期持平",
    level: "flat",
    description: "TIP 近 1 月變化有限，通膨預期 / 實質利率環境大致持平。",
  };
}

export function getGldSignal(input: RiskSignalInput): RiskSignal {
  if (!isValidNumber(input.value) || !isValidNumber(input.period1mChangePercent)) {
    return unavailableSignal(input);
  }

  if (input.period1mChangePercent >= 3) {
    return {
      ...input,
      status: "避險需求增加",
      level: "rising",
      description: "GLD 近 1 月上漲，可作為避險需求增加的代理觀察，也需留意美元與實質利率影響。",
    };
  }

  if (input.period1mChangePercent <= -3) {
    return {
      ...input,
      status: "避險需求降溫",
      level: "falling",
      description: "GLD 近 1 月下跌，可作為避險需求降溫的代理觀察，也需留意美元與實質利率影響。",
    };
  }

  return {
    ...input,
    status: "避險需求持平",
    level: "flat",
    description: "GLD 近 1 月變化有限，避險需求代理指標大致持平。",
  };
}
