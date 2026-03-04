export function normalizeServiceLine(value: string | undefined): string {
  const serviceLine = value?.trim();
  if (!serviceLine) return "";

  if (serviceLine === "TS - CIS" || serviceLine === "TS - CRS") {
    return "Technology Services - CISS";
  }

  if (serviceLine === "TS - ICD" || serviceLine === "TS - TTMS") {
    return "Technology Services - ICD";
  }

  if (serviceLine.startsWith("TS - ")) {
    return `Technology Services - ${serviceLine.slice(5)}`;
  }

  return serviceLine;
}

export function normalizeCsvServiceLineRow<T extends Record<string, string>>(row: T): T {
  if (!("service_line" in row)) return row;
  return {
    ...row,
    service_line: normalizeServiceLine(row.service_line),
  };
}
