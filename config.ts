export const config = {
  businessUnitName: "COO Ops Cockpit",
  blendedRateUsdPerHour: 60,
  billableHoursPerMonth: 168,
  sectors: [
    "Sector A",
    "Sector B",
    "Sector C",
    "Sector D",
    "Sector E",
    "Sector F",
  ],
  serviceLines: [
    "Advisory",
    "Applications",
    "Data",
    "Cloud",
    "Cyber",
    "Managed Services",
  ],
  blendedRateByServiceLine: {
    Advisory: 11290,
    Applications: 10080,
    Data: 10580,
    Cloud: 10920,
    Cyber: 11650,
    "Managed Services": 9580,
  } as Record<string, number>,
  ttfThresholdDays: 7,
  pipelineConversionRates: {
    global: 0.52,
    byServiceLine: {
      Advisory: 0.45,
      Applications: 0.58,
      Data: 0.56,
      Cloud: 0.6,
      Cyber: 0.48,
      "Managed Services": 0.62,
    } as Record<string, number>,
  },
  revenueTargetUsdByQuarter: {
    "2026-Q1": 850000000,
    "2026-Q2": 865000000,
    "2026-Q3": 880000000,
    "2026-Q4": 895000000,
  } as Record<string, number>,
  todayOverride: undefined as string | undefined,
  refreshCadenceDays: 1,
};

export type Scenario = "conservative" | "base" | "aggressive";

export const scenarioMultiplier: Record<Scenario, number> = {
  conservative: 0.8,
  base: 1,
  aggressive: 1.2,
};
