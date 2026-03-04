import { promises as fs } from "node:fs";
import path from "node:path";
import { formatQuarterDisplay, quarterFromDate, todayDate, toISODate } from "@/lib/date";
import { normalizeCsvServiceLineRow } from "@/lib/service-line";

const DATA_DIR = path.join(process.cwd(), "data");
const BLENDED_RATE_PER_HOUR = 50;
const HOURS_PER_MONTH = 160;
const QUARTER_MONTHS = 3;
const REVENUE_PER_BPM = BLENDED_RATE_PER_HOUR * HOURS_PER_MONTH;
const REVENUE_PER_RESOURCE_PER_DAY = REVENUE_PER_BPM / 30;
const REVENUE_PER_RESOURCE_PER_QUARTER = REVENUE_PER_BPM * QUARTER_MONTHS;

type Filters = {
  sectorId?: string;
  serviceLineId?: string;
};

type CsvRow = Record<string, string>;

export type CsvQuarterOverview = {
  quarter: string;
  sectors: Array<{ id: string; name: string }>;
  serviceLines: Array<{ id: string; name: string }>;
  fulfillment: {
    rows: Array<{
      sector: string;
      sdlu: string;
      account: string;
      skillset: string;
      volume: number;
      timeToFulfillDays: number;
    }>;
    options: {
      sectors: string[];
      sdlus: string[];
      accounts: string[];
      skillsets: string[];
    };
  };
  timeline: Array<{
    date: string;
    forecastRevenue: number;
    actualRevenue: number | null;
    projectedRevenue: number;
    forecastBpm: number;
    actualBpm: number | null;
    projectedBpm: number;
    forecastRuBpm: number;
    actualRuBpm: number | null;
    projectedRuBpm: number;
    forecastRdBpm: number;
    actualRdBpm: number | null;
    projectedRdBpm: number;
    forecastNetBpm: number;
    actualNetBpm: number | null;
    projectedNetBpm: number;
  }>;
  history: Array<{
    quarter: string;
    revenue: number;
    bpm: number;
    people: number;
  }>;
  revenue: {
    target: number;
    sold: number;
    forecast: number;
    actual: number;
  };
  bpm: {
    target: number;
    sold: number;
    forecast: number;
    actual: number;
  };
  resources: {
    target: number;
    sold: number;
    forecast: number;
    actual: number;
  };
  assumptions: {
    asOfDate: string;
    blendedRatePerHour: number;
    hoursPerMonth: number;
    revenuePerBpm: number;
  };
  kpis: {
    revenueActualQtd: number;
    revenueBudget: number;
    bpmActualQtd: number;
    bpmBudget: number;
    netBpmToTarget: number;
    ruBpmBudget: number;
    rdBpmBudget: number;
    netBpmTarget: number;
    netBpmSold: number;
    netBpmBudget: number;
    netBpmActual: number;
    ruBpmTarget: number;
    ruBpmSold: number;
    ruBpmActual: number;
    rdBpmTarget: number;
    rdBpmSold: number;
    rdBpmActual: number;
  };
};

export type HistoricalSeriesPoint = {
  label: string;
  quarter: string;
  budget: number;
  sold: number;
  forecast: number;
  expected: number;
  actual: number;
};

export type CsvHistoricalOverview = {
  availableQuarters: string[];
  quarterly: {
    revenue: HistoricalSeriesPoint[];
    bpm: HistoricalSeriesPoint[];
    netBpm: HistoricalSeriesPoint[];
    ruBpm: HistoricalSeriesPoint[];
    rdBpm: HistoricalSeriesPoint[];
  };
  weeklyAverage: {
    revenue: HistoricalSeriesPoint[];
    bpm: HistoricalSeriesPoint[];
    netBpm: HistoricalSeriesPoint[];
    ruBpm: HistoricalSeriesPoint[];
    rdBpm: HistoricalSeriesPoint[];
  };
};

export async function getCsvQuarterOverview(filters: Filters): Promise<CsvQuarterOverview> {
  const asOfDate = todayDate();
  const currentQuarter = quarterFromDate(asOfDate);
  const csvQuarter = currentQuarter.replace("-Q", "Q");
  const previousQuarter = getPreviousQuarter(csvQuarter);

  const [targets, orders, forecastRows, actualRows, historicalRows, fulfillmentRows] = await Promise.all([
    readCsv("targets_2026Q1_900M.csv"),
    readCsv("sow_plan_orders.csv"),
    readCsv("daily_forecast_ramp_2026Q1.csv"),
    readCsv("daily_actual_ramp_2026Q1.csv"),
    readCsv("historical_quarterly_last8q.csv"),
    readCsv("demand_fulfillment.csv"),
  ]);

  const sectors = toOptions(
    uniqueValues(targets.map((row) => row.sector).filter(Boolean)),
  );
  const serviceLines = toOptions(
    sortServiceLineValues(uniqueValues(targets.map((row) => row.service_line).filter(Boolean))),
  );

  const matches = (row: CsvRow) => {
    if (filters.sectorId && row.sector !== filters.sectorId) return false;
    if (filters.serviceLineId && row.service_line !== filters.serviceLineId) return false;
    return true;
  };

  const filteredTargets = targets.filter((row) => row.quarter_id === csvQuarter && matches(row));
  const filteredOrders = orders.filter(matches);
  const filteredForecastRows = forecastRows.filter((row) => row.quarter_id === csvQuarter && matches(row));
  const filteredActualRows = actualRows.filter((row) => row.quarter_id === csvQuarter && matches(row));
  const filteredHistoricalRows = historicalRows.filter((row) => row.quarter_id === previousQuarter && matches(row));
  const history = buildHistory(historicalRows.filter(matches));

  const baselineResources = sum(filteredHistoricalRows.map((row) => toNumber(row.people_end_of_quarter)));
  const soldResources = baselineResources + sum(filteredOrders.map((row) => toNumber(row.people_this_quarter)));
  const forecastResources = averageQuarterResources(
    baselineResources,
    filteredForecastRows,
    "forecast_ramp_up_people",
    "forecast_ramp_down_people",
  );
  const actualQtd = summarizeActualQtdResources(
    baselineResources,
    filteredActualRows,
    "actual_ramp_up_people",
    "actual_ramp_down_people",
    asOfDate,
  );
  const timeline = buildQuarterTimeline({
    baselineResources,
    forecastRows: filteredForecastRows,
    actualRows: filteredActualRows,
    asOfDate,
  });
  // Keep fulfillment matrix options globally populated; local matrix filters handle slicing.
  const fulfillment = buildFulfillmentData(fulfillmentRows);

  const targetRevenue = sum(filteredTargets.map((row) => toNumber(row.revenue_target_usd)));
  const soldRevenue = soldResources * REVENUE_PER_RESOURCE_PER_QUARTER;
  const forecastRevenue = forecastResources * REVENUE_PER_RESOURCE_PER_QUARTER;
  const actualRevenue = actualQtd.resourceDays * REVENUE_PER_RESOURCE_PER_DAY;
  const targetBpm = targetRevenue / REVENUE_PER_BPM;
  const previousQuarterRevenue = sum(
    filteredHistoricalRows.map((row) => toNumber(row.quarterly_revenue_usd)),
  );
  const previousQuarterEndBpm = previousQuarterRevenue / REVENUE_PER_BPM;
  const soldBpm = soldRevenue / REVENUE_PER_BPM;
  const budgetBpm = forecastRevenue / REVENUE_PER_BPM;
  const actualBpm = actualRevenue / REVENUE_PER_BPM;
  const netGrowthFromTarget = targetBpm - previousQuarterEndBpm;
  const netGrowthFromBudget = budgetBpm - previousQuarterEndBpm;
  const netBpmTarget = Math.max(1, netGrowthFromTarget, netGrowthFromBudget);
  const netBpmSold = soldBpm - previousQuarterEndBpm;
  const netBpmBudget = budgetBpm - previousQuarterEndBpm;
  const ruBpmBudget = sum(filteredForecastRows.map((row) => toNumber(row.forecast_ramp_up_people)));
  const rdBpmBudget = sum(filteredForecastRows.map((row) => toNumber(row.forecast_ramp_down_people)));
  const soldRuBpm = sum(filteredOrders.map((row) => Math.max(0, toNumber(row.people_this_quarter))));
  const soldRdBpm = sum(filteredOrders.map((row) => Math.max(0, -toNumber(row.people_this_quarter))));
  const actualRuBpm = sum(
    filteredActualRows
      .filter((row) => new Date(row.date) <= asOfDate)
      .map((row) => toNumber(row.actual_ramp_up_people)),
  );
  const actualRdBpm = sum(
    filteredActualRows
      .filter((row) => new Date(row.date) <= asOfDate)
      .map((row) => toNumber(row.actual_ramp_down_people)),
  );
  const netBpmActual = actualRuBpm - actualRdBpm;
  const ruBpmTarget = Math.max(0, netBpmTarget + rdBpmBudget);
  const rdBpmTarget = Math.max(0, ruBpmTarget - netBpmTarget);

  return {
    quarter: currentQuarter,
    sectors,
    serviceLines,
    fulfillment,
    timeline,
    history,
    revenue: {
      target: targetRevenue,
      sold: soldRevenue,
      forecast: forecastRevenue,
      actual: actualRevenue,
    },
    bpm: {
      target: targetBpm,
      sold: soldBpm,
      forecast: budgetBpm,
      actual: actualBpm,
    },
    resources: {
      target: targetRevenue / REVENUE_PER_RESOURCE_PER_QUARTER,
      sold: soldResources,
      forecast: forecastResources,
      actual: actualQtd.averageResources,
    },
    assumptions: {
      asOfDate: toISODate(actualQtd.asOfDate),
      blendedRatePerHour: BLENDED_RATE_PER_HOUR,
      hoursPerMonth: HOURS_PER_MONTH,
      revenuePerBpm: REVENUE_PER_BPM,
    },
    kpis: {
      revenueActualQtd: actualRevenue,
      revenueBudget: forecastRevenue,
      bpmActualQtd: actualBpm,
      bpmBudget: budgetBpm,
      netBpmToTarget: netBpmTarget,
      ruBpmBudget,
      rdBpmBudget,
      netBpmTarget,
      netBpmSold,
      netBpmBudget,
      netBpmActual,
      ruBpmTarget,
      ruBpmSold: soldRuBpm,
      ruBpmActual: actualRuBpm,
      rdBpmTarget,
      rdBpmSold: soldRdBpm,
      rdBpmActual: actualRdBpm,
    },
  };
}

export async function getCsvHistoricalOverview(
  filters: Filters,
  selectedQuarters?: string[],
): Promise<CsvHistoricalOverview> {
  const historicalRows = await readCsv("historical_quarterly_last8q.csv");
  const filteredRows = historicalRows.filter((row) => {
    if (filters.sectorId && row.sector !== filters.sectorId) return false;
    if (filters.serviceLineId && row.service_line !== filters.serviceLineId) return false;
    return true;
  });

  const grouped = aggregateHistoricalRows(filteredRows);
  const allQuarters = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  const activeQuarterSet = new Set(
    (selectedQuarters?.length ? selectedQuarters : allQuarters).filter((quarter) =>
      grouped.has(quarter),
    ),
  );

  const quarterlyPoints = buildHistoricalPoints(allQuarters, grouped);
  const selectedQuarterPoints = quarterlyPoints.filter((point) => activeQuarterSet.has(point.quarter));

  return {
    availableQuarters: allQuarters,
    quarterly: {
      revenue: quarterlyPoints.map((point) => point.revenue),
      bpm: quarterlyPoints.map((point) => point.bpm),
      netBpm: quarterlyPoints.map((point) => point.netBpm),
      ruBpm: quarterlyPoints.map((point) => point.ruBpm),
      rdBpm: quarterlyPoints.map((point) => point.rdBpm),
    },
    weeklyAverage: {
      revenue: buildWeeklyAverageSeries(selectedQuarterPoints.map((point) => point.revenue)),
      bpm: buildWeeklyAverageSeries(selectedQuarterPoints.map((point) => point.bpm)),
      netBpm: buildWeeklyAverageSeries(selectedQuarterPoints.map((point) => point.netBpm)),
      ruBpm: buildWeeklyAverageSeries(selectedQuarterPoints.map((point) => point.ruBpm)),
      rdBpm: buildWeeklyAverageSeries(selectedQuarterPoints.map((point) => point.rdBpm)),
    },
  };
}

async function readCsv(fileName: string): Promise<CsvRow[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
  const [headerLine, ...lines] = raw.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines
    .filter(Boolean)
    .map((line) => {
      const values = line.split(",");
      return normalizeCsvServiceLineRow(
        Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
      );
    });
}

function averageQuarterResources(
  baselineResources: number,
  rows: CsvRow[],
  upKey: string,
  downKey: string,
): number {
  if (!rows.length) return baselineResources;

  const byDate = new Map<string, { up: number; down: number }>();
  for (const row of rows) {
    const entry = byDate.get(row.date) ?? { up: 0, down: 0 };
    entry.up += toNumber(row[upKey]);
    entry.down += toNumber(row[downKey]);
    byDate.set(row.date, entry);
  }

  let current = baselineResources;
  let total = 0;
  const dates = Array.from(byDate.keys()).sort();
  for (const date of dates) {
    const entry = byDate.get(date)!;
    current += entry.up - entry.down;
    total += current;
  }

  return total / dates.length;
}

function summarizeActualQtdResources(
  baselineResources: number,
  rows: CsvRow[],
  upKey: string,
  downKey: string,
  asOfDate: Date,
): { asOfDate: Date; averageResources: number; resourceDays: number } {
  if (!rows.length) {
    return {
      asOfDate,
      averageResources: baselineResources,
      resourceDays: 0,
    };
  }

  const byDate = new Map<string, { up: number; down: number }>();
  for (const row of rows) {
    if (new Date(row.date) > asOfDate) continue;
    const entry = byDate.get(row.date) ?? { up: 0, down: 0 };
    entry.up += toNumber(row[upKey]);
    entry.down += toNumber(row[downKey]);
    byDate.set(row.date, entry);
  }

  const dates = Array.from(byDate.keys()).sort();
  if (!dates.length) {
    return {
      asOfDate,
      averageResources: baselineResources,
      resourceDays: 0,
    };
  }

  let current = baselineResources;
  let resourceDays = 0;
  for (const date of dates) {
    const entry = byDate.get(date)!;
    current += entry.up - entry.down;
    resourceDays += current;
  }

  return {
    asOfDate: new Date(dates[dates.length - 1]),
    averageResources: resourceDays / dates.length,
    resourceDays,
  };
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function toOptions(values: string[]) {
  return values.map((value) => ({ id: value, name: value }));
}

function sortServiceLineValues(values: string[]): string[] {
  return [...values].sort(compareServiceLines);
}

function compareServiceLines(a: string, b: string): number {
  const aIsTechnologyServices = a.startsWith("Technology Services");
  const bIsTechnologyServices = b.startsWith("Technology Services");

  if (aIsTechnologyServices && !bIsTechnologyServices) return -1;
  if (!aIsTechnologyServices && bIsTechnologyServices) return 1;

  const aLabel = a.replace(/^Technology Services\s*-\s*/, "");
  const bLabel = b.replace(/^Technology Services\s*-\s*/, "");
  return aLabel.localeCompare(bLabel);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function toNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPreviousQuarter(quarter: string): string {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(-1));
  if (q === 1) return `${year - 1}Q4`;
  return `${year}Q${q - 1}`;
}

function buildHistory(rows: CsvRow[]): Array<{
  quarter: string;
  revenue: number;
  bpm: number;
  people: number;
}> {
  const grouped = new Map<string, { revenue: number; peopleStart: number; peopleEnd: number }>();
  for (const row of rows) {
    const current = grouped.get(row.quarter_id) ?? { revenue: 0, peopleStart: 0, peopleEnd: 0 };
    current.revenue += toNumber(row.quarterly_revenue_usd);
    current.peopleStart += toNumber(row.people_start_of_quarter);
    current.peopleEnd += toNumber(row.people_end_of_quarter);
    grouped.set(row.quarter_id, current);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, value]) => {
      const people = (value.peopleStart + value.peopleEnd) / 2;
      return {
        quarter,
        revenue: value.revenue,
        bpm: value.revenue / REVENUE_PER_BPM,
        people,
      };
    });
}

function aggregateHistoricalRows(rows: CsvRow[]) {
  const grouped = new Map<
    string,
    {
      revenueActual: number;
      peopleStart: number;
      peopleEnd: number;
      ruActual: number;
      rdActual: number;
    }
  >();

  for (const row of rows) {
    const quarter = row.quarter_id;
    const peopleStart = toNumber(row.people_start_of_quarter);
    const peopleEnd = toNumber(row.people_end_of_quarter);
    const delta = peopleEnd - peopleStart;
    const current = grouped.get(quarter) ?? {
      revenueActual: 0,
      peopleStart: 0,
      peopleEnd: 0,
      ruActual: 0,
      rdActual: 0,
    };

    current.revenueActual += toNumber(row.quarterly_revenue_usd);
    current.peopleStart += peopleStart;
    current.peopleEnd += peopleEnd;
    current.ruActual += Math.max(delta, 0);
    current.rdActual += Math.max(-delta, 0);
    grouped.set(quarter, current);
  }

  return grouped;
}

function buildHistoricalPoints(
  quarters: string[],
  grouped: Map<
    string,
    {
      revenueActual: number;
      peopleStart: number;
      peopleEnd: number;
      ruActual: number;
      rdActual: number;
    }
  >,
): Array<{
  quarter: string;
  revenue: HistoricalSeriesPoint;
  bpm: HistoricalSeriesPoint;
  netBpm: HistoricalSeriesPoint;
  ruBpm: HistoricalSeriesPoint;
  rdBpm: HistoricalSeriesPoint;
}> {
  return quarters.map((quarter, index) => {
    const current = grouped.get(quarter) ?? {
      revenueActual: 0,
      peopleStart: 0,
      peopleEnd: 0,
      ruActual: 0,
      rdActual: 0,
    };
    const quarterLabel = formatQuarterLabel(quarter);
    const revenueActual = current.revenueActual;
    const bpmActual = revenueActual / REVENUE_PER_BPM;
    const netActual = current.ruActual - current.rdActual;
    const revenuePlan = derivePlanValues(revenueActual, quarter, "revenue");
    const bpmPlan = {
      budget: revenuePlan.budget / REVENUE_PER_BPM,
      sold: revenuePlan.sold / REVENUE_PER_BPM,
      forecast: revenuePlan.forecast / REVENUE_PER_BPM,
      expected: revenuePlan.expected / REVENUE_PER_BPM,
      actual: bpmActual,
    };
    const ruPlan = derivePlanValues(current.ruActual, quarter, "ru");
    const rdPlan = derivePlanValues(current.rdActual, quarter, "rd");
    const netPlan = deriveSignedPlanValues(
      netActual,
      quarter,
      index === 0 ? bpmActual : (grouped.get(quarters[index - 1])?.revenueActual ?? 0) / REVENUE_PER_BPM,
    );

    return {
      quarter,
      revenue: { label: quarterLabel, quarter, ...revenuePlan },
      bpm: { label: quarterLabel, quarter, ...bpmPlan },
      netBpm: { label: quarterLabel, quarter, ...netPlan },
      ruBpm: { label: quarterLabel, quarter, ...ruPlan },
      rdBpm: { label: quarterLabel, quarter, ...rdPlan },
    };
  });
}

function derivePlanValues(actual: number, quarter: string, metric: string) {
  const rng = seededValue(`${quarter}:${metric}`);
  const budgetMultiplier = 1.1 + rng * 0.14;
  const soldMultiplier = budgetMultiplier * (0.88 + seededValue(`${quarter}:${metric}:sold`) * 0.1);
  const forecastMultiplier = soldMultiplier * (0.95 + seededValue(`${quarter}:${metric}:forecast`) * 0.08);
  const expectedMultiplier = forecastMultiplier * (0.82 + seededValue(`${quarter}:${metric}:expected`) * 0.08);

  return {
    budget: actual * budgetMultiplier,
    sold: actual * soldMultiplier,
    forecast: actual * forecastMultiplier,
    expected: actual * expectedMultiplier,
    actual,
  };
}

function deriveSignedPlanValues(actual: number, quarter: string, baseline: number) {
  const direction = actual < 0 ? -1 : 1;
  const magnitude = Math.abs(actual);
  const plan = derivePlanValues(Math.max(magnitude, baseline * 0.02), `${quarter}:net`, "net");

  return {
    budget: plan.budget * direction,
    sold: plan.sold * direction,
    forecast: plan.forecast * direction,
    expected: plan.expected * direction,
    actual,
  };
}

function seededValue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash / 4294967295;
}

function formatQuarterLabel(quarter: string): string {
  return formatQuarterDisplay(quarter, 3);
}

function buildWeeklyAverageSeries(points: HistoricalSeriesPoint[]): HistoricalSeriesPoint[] {
  const weeklyProfiles = points.map((point) => ({
    quarter: point.quarter,
    budget: buildWeeklyProfile(point.quarter, "budget", point.budget),
    sold: buildWeeklyProfile(point.quarter, "sold", point.sold),
    forecast: buildWeeklyProfile(point.quarter, "forecast", point.forecast),
    expected: buildWeeklyProfile(point.quarter, "expected", point.expected),
    actual: buildWeeklyProfile(point.quarter, "actual", point.actual),
  }));

  return Array.from({ length: 12 }, (_, index) => ({
    label: `W${index + 1}`,
    quarter: "multi",
    budget: average(weeklyProfiles.map((profile) => profile.budget[index] ?? 0)),
    sold: average(weeklyProfiles.map((profile) => profile.sold[index] ?? 0)),
    forecast: average(weeklyProfiles.map((profile) => profile.forecast[index] ?? 0)),
    expected: average(weeklyProfiles.map((profile) => profile.expected[index] ?? 0)),
    actual: average(weeklyProfiles.map((profile) => profile.actual[index] ?? 0)),
  }));
}

function buildWeeklyProfile(quarter: string, metric: string, total: number): number[] {
  const baseWeights = Array.from({ length: 12 }, (_, index) => {
    const seed = seededValue(`${quarter}:${metric}:week:${index + 1}`);
    const seasonal = 0.82 + seed * 0.36;
    const directional = 0.92 + ((index / 11) * 0.16);
    return seasonal * directional;
  });

  const denominator = sum(baseWeights);
  if (!denominator) return Array.from({ length: 12 }, () => 0);
  return baseWeights.map((weight) => (total * weight) / denominator);
}

function average(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function buildFulfillmentData(rows: CsvRow[]) {
  const normalized = rows
    .map((row) => {
      const isFulfilled = row.fulfillment_type === "Customer_Billed" && !!row.billed_date;
      if (!isFulfilled) return null;
      const timeToBill = toNumber(row.time_to_bill_days);
      const timeToFulfillDays = timeToBill;
      if (timeToFulfillDays <= 0) return null;
      const volume = Math.max(0, toNumber(row.volume_of_demand));
      return {
        sector: row.sector,
        sdlu: row.service_line,
        account: row.account,
        skillset: row.skillset,
        volume,
        timeToFulfillDays,
      };
    })
    .filter((row): row is {
      sector: string;
      sdlu: string;
      account: string;
      skillset: string;
      volume: number;
      timeToFulfillDays: number;
    } => row !== null);

  return {
    rows: normalized,
    options: {
      sectors: uniqueValues(normalized.map((row) => row.sector)),
      sdlus: uniqueValues(normalized.map((row) => row.sdlu)),
      accounts: uniqueValues(normalized.map((row) => row.account)),
      skillsets: uniqueValues(normalized.map((row) => row.skillset)),
    },
  };
}

function buildQuarterTimeline(input: {
  baselineResources: number;
  forecastRows: CsvRow[];
  actualRows: CsvRow[];
  asOfDate: Date;
}): Array<{
  date: string;
  forecastRevenue: number;
  actualRevenue: number | null;
  projectedRevenue: number;
  forecastBpm: number;
  actualBpm: number | null;
  projectedBpm: number;
  forecastRuBpm: number;
  actualRuBpm: number | null;
  projectedRuBpm: number;
  forecastRdBpm: number;
  actualRdBpm: number | null;
  projectedRdBpm: number;
  forecastNetBpm: number;
  actualNetBpm: number | null;
  projectedNetBpm: number;
}> {
  const forecastByDate = aggregateDaily(
    input.forecastRows,
    "forecast_ramp_up_people",
    "forecast_ramp_down_people",
  );
  const actualByDate = aggregateDaily(
    input.actualRows,
    "actual_ramp_up_people",
    "actual_ramp_down_people",
  );

  const dates = Array.from(new Set([...forecastByDate.keys(), ...actualByDate.keys()])).sort();
  if (!dates.length) return [];

  let forecastResources = input.baselineResources;
  let actualResources = input.baselineResources;
  let forecastResourceDays = 0;
  let actualResourceDays = 0;
  let cumForecastRu = 0;
  let cumForecastRd = 0;
  let cumActualRu = 0;
  let cumActualRd = 0;

  let elapsedActualDays = 0;
  let asOfRevenue = 0;
  let asOfRu = 0;
  let asOfRd = 0;

  const rows: Array<{
    date: string;
    forecastRevenue: number;
    actualRevenue: number | null;
    forecastRuBpm: number;
    actualRuBpm: number | null;
    forecastRdBpm: number;
    actualRdBpm: number | null;
    forecastNetBpm: number;
    actualNetBpm: number | null;
    dayOffsetFromAsOf: number;
  }> = [];

  for (const date of dates) {
    const forecast = forecastByDate.get(date) ?? { up: 0, down: 0 };
    cumForecastRu += forecast.up;
    cumForecastRd += forecast.down;
    forecastResources += forecast.up - forecast.down;
    forecastResourceDays += forecastResources;

    const currentDate = new Date(date);
    let actualRevenue: number | null = null;
    let actualRuBpm: number | null = null;
    let actualRdBpm: number | null = null;
    let actualNetBpm: number | null = null;
    let dayOffsetFromAsOf = 0;

    if (currentDate <= input.asOfDate) {
      const actual = actualByDate.get(date) ?? { up: 0, down: 0 };
      cumActualRu += actual.up;
      cumActualRd += actual.down;
      actualResources += actual.up - actual.down;
      actualResourceDays += actualResources;
      elapsedActualDays += 1;

      actualRevenue = actualResourceDays * REVENUE_PER_RESOURCE_PER_DAY;
      actualRuBpm = cumActualRu;
      actualRdBpm = cumActualRd;
      actualNetBpm = cumActualRu - cumActualRd;
      asOfRevenue = actualRevenue;
      asOfRu = cumActualRu;
      asOfRd = cumActualRd;
    } else {
      dayOffsetFromAsOf = Math.floor((currentDate.getTime() - input.asOfDate.getTime()) / 86400000);
    }

    rows.push({
      date,
      forecastRevenue: forecastResourceDays * REVENUE_PER_RESOURCE_PER_DAY,
      actualRevenue,
      forecastRuBpm: cumForecastRu,
      actualRuBpm,
      forecastRdBpm: cumForecastRd,
      actualRdBpm,
      forecastNetBpm: cumForecastRu - cumForecastRd,
      actualNetBpm,
      dayOffsetFromAsOf,
    });
  }

  const revenuePace = elapsedActualDays > 0 ? asOfRevenue / elapsedActualDays : 0;
  const ruPace = elapsedActualDays > 0 ? asOfRu / elapsedActualDays : 0;
  const rdPace = elapsedActualDays > 0 ? asOfRd / elapsedActualDays : 0;

  return rows.map((row) => {
    const projectedRevenue =
      row.actualRevenue ?? asOfRevenue + revenuePace * row.dayOffsetFromAsOf;
    const projectedRuBpm =
      row.actualRuBpm ?? asOfRu + ruPace * row.dayOffsetFromAsOf;
    const projectedRdBpm =
      row.actualRdBpm ?? asOfRd + rdPace * row.dayOffsetFromAsOf;
    const projectedNetBpm = projectedRuBpm - projectedRdBpm;
    return {
      date: row.date,
      forecastRevenue: row.forecastRevenue,
      actualRevenue: row.actualRevenue,
      projectedRevenue,
      forecastBpm: row.forecastRevenue / REVENUE_PER_BPM,
      actualBpm: row.actualRevenue !== null ? row.actualRevenue / REVENUE_PER_BPM : null,
      projectedBpm: projectedRevenue / REVENUE_PER_BPM,
      forecastRuBpm: row.forecastRuBpm,
      actualRuBpm: row.actualRuBpm,
      projectedRuBpm,
      forecastRdBpm: row.forecastRdBpm,
      actualRdBpm: row.actualRdBpm,
      projectedRdBpm,
      forecastNetBpm: row.forecastNetBpm,
      actualNetBpm: row.actualNetBpm,
      projectedNetBpm,
    };
  });
}

function aggregateDaily(
  rows: CsvRow[],
  upKey: string,
  downKey: string,
): Map<string, { up: number; down: number }> {
  const byDate = new Map<string, { up: number; down: number }>();
  for (const row of rows) {
    const entry = byDate.get(row.date) ?? { up: 0, down: 0 };
    entry.up += toNumber(row[upKey]);
    entry.down += toNumber(row[downKey]);
    byDate.set(row.date, entry);
  }
  return byDate;
}
