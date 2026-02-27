import { config, scenarioMultiplier, type Scenario } from "@/config";
import { generateDataset, type Dataset } from "@/lib/data";
import {
  addDays,
  diffDays,
  inRange,
  nextQuarter,
  overlapDays,
  quarterProgress,
  quarterStartEnd,
  toISODate,
} from "@/lib/date";
import type { ActionRecommendation, FilterState, KpiSet, QuarterKey } from "@/lib/models";

const BPM_DAYS = 30;
const DEFAULT_BLENDED_RATE = config.blendedRateByServiceLine.Applications ?? 10080;

export interface DashboardModel {
  filters: FilterState;
  todayISO: string;
  dataset: Dataset;
  kpis: KpiSet;
  confidenceBand: "Low" | "Medium" | "High";
  shouldMeetTarget: boolean;
  attainmentSplit: { label: string; valueUsd: number }[];
  topRisks: string[];
  topLevers: string[];
  revenueBridge: { step: string; valueUsd: number }[];
  diagnosticRows: {
    targetVsActual: { metric: string; value: number; pct?: number }[];
    bpmChain: { metric: string; value: number; pct?: number }[];
    demandCoverage: { metric: string; value: number; pct?: number }[];
    fulfillmentPipeline: { stage: string; bpm: number; count: number }[];
    axnbAging: { bucket: string; count: number }[];
    ttfByServiceLine: { serviceLine: string; avgTtf: number; breachPct: number; count: number }[];
    ttfBySkill: { skill: string; count: number; bpm: number; revImpact: number; breachPct: number }[];
  };
  actions: ActionRecommendation[];
  accountMetrics: Array<{
    accountId: string;
    accountName: string;
    sectorId: string;
    serviceLineId: string;
    sdluId: string;
    soldRevenueUsd: number;
    qtdRevenueUsd: number;
    forecastRevenueUsd: number;
    revenueGapUsd: number;
    ruGapBpm: number;
    demandShortfallBpm: number;
    axnbCount: number;
    ttfBreaches: number;
  }>;
  planning: {
    nextQuarter: QuarterKey;
    revenueForecast: number;
    bpmForecast: number;
    ruForecast: number;
    rdForecast: number;
    byScenario: Array<{ scenario: Scenario; revenue: number; bpm: number }>;
  };
}

export function buildDashboardModel(filters: FilterState, todayISO: string): DashboardModel {
  const dataset = generateDataset(filters.quarter, todayISO);
  const filtered = applyFilters(dataset, filters);
  const q = quarterStartEnd(filters.quarter);
  const today = new Date(todayISO);
  const progress = quarterProgress(filters.quarter, today);
  const dominantServiceLine = getDominantServiceLine(filtered.bookings);
  const blendedRate = config.blendedRateByServiceLine[dominantServiceLine] ?? DEFAULT_BLENDED_RATE;

  const soldRevenueUsd = sum(filtered.bookings.map((b) => b.soldRevenueUsd));
  const targetRevenueUsd = config.revenueTargetUsdByQuarter[filters.quarter] ?? soldRevenueUsd * 1.1;
  const qtdActualRevenueUsd = computeQtdRevenue(filtered, q.start, today);
  const forecastRevenueUsd = progress.ratio > 0 ? qtdActualRevenueUsd / progress.ratio : qtdActualRevenueUsd;
  const soldBpm = soldRevenueUsd / blendedRate;
  const forecastBpm = forecastRevenueUsd / blendedRate;

  const ruBpmQtd = computeRuBpm(filtered, q.start, today);
  const rdBpmQtd = computeRdBpm(filtered, q.start, today);
  const actualBpmNetQtd = ruBpmQtd - rdBpmQtd;

  const demandOpenBpm = computeOpenDemandBpm(filtered, today, q.end);
  const fulfilledBpm = computeFulfilledBpm(filtered, q.start, q.end);
  const axnb = filtered.demands.filter((d) => {
    const f = filtered.fulfillmentEventsMap.get(d.demandId);
    const b = filtered.billingEventsMap.get(d.demandId);
    return !!f?.allocatedDate && !b?.billableStartDate;
  });
  const axnbCount = axnb.length;

  const ttfRows = filtered.demands.map((d) => {
    const b = filtered.billingEventsMap.get(d.demandId);
    const start = new Date(d.demandStartDate);
    if (b?.billableStartDate) {
      return {
        demandId: d.demandId,
        serviceLineId: d.serviceLineId,
        skill: d.skill,
        ttf: diffDays(start, new Date(b.billableStartDate)),
        breached: false,
        quantity: d.quantity,
      };
    }
    return {
      demandId: d.demandId,
      serviceLineId: d.serviceLineId,
      skill: d.skill,
      ttf: diffDays(start, today),
      breached: false,
      quantity: d.quantity,
    };
  });

  const avgBySl = new Map<string, number>();
  for (const sl of dataset.serviceLines) {
    const values = ttfRows.filter((x) => x.serviceLineId === sl.id).map((x) => x.ttf);
    avgBySl.set(sl.id, values.length ? sum(values) / values.length : 0);
  }
  ttfRows.forEach((r) => {
    const avg = avgBySl.get(r.serviceLineId) ?? 0;
    r.breached = r.ttf > avg + config.ttfThresholdDays;
  });
  const avgTtfDays = ttfRows.length ? sum(ttfRows.map((x) => x.ttf)) / ttfRows.length : 0;
  const ttfBreachedPct = ttfRows.length
    ? (100 * ttfRows.filter((x) => x.breached).length) / ttfRows.length
    : 0;

  const gapToTargetUsd = targetRevenueUsd - forecastRevenueUsd;
  const gapToTargetPct = targetRevenueUsd ? (100 * gapToTargetUsd) / targetRevenueUsd : 0;

  const bookingWithoutDemand = filtered.bookings.filter(
    (b) => !filtered.demands.some((d) => d.sowId === b.id.replace("book", "sow")),
  ).length;

  const fulfillmentRate = filtered.demands.length
    ? filtered.demands.filter((d) => !!filtered.fulfillmentEventsMap.get(d.demandId)?.allocatedDate).length /
      filtered.demands.length
    : 0;

  const demandShortfallBpm = Math.max(0, soldBpm - demandOpenBpm - fulfilledBpm);
  const confidenceBand =
    Math.abs(gapToTargetPct) < 4 ? "High" : Math.abs(gapToTargetPct) < 11 ? "Medium" : "Low";

  const kpis: KpiSet = {
    targetRevenueUsd,
    soldRevenueUsd,
    qtdActualRevenueUsd,
    forecastRevenueUsd,
    gapToTargetUsd,
    gapToTargetPct,
    soldBpm,
    actualBpmNetQtd,
    forecastBpm,
    demandOpenBpm,
    fulfilledBpm,
    axnbCount,
    avgTtfDays,
    ttfBreachedPct,
    ruBpmQtd,
    rdBpmQtd,
  };

  const attainmentSplit = [
    {
      label: "Project run-rate continuation (minus ramp-down)",
      valueUsd: soldRevenueUsd * 0.44 - rdBpmQtd * blendedRate,
    },
    { label: "Incremental SOW expansions", valueUsd: soldRevenueUsd * 0.24 },
    { label: "New projects in new accounts", valueUsd: soldRevenueUsd * 0.2 },
    {
      label: "New orders converted to demand/fulfillment",
      valueUsd: Math.max(0, soldRevenueUsd * 0.12 - demandShortfallBpm * blendedRate * 0.3),
    },
  ];

  const axnbAging = bucketAxnbAging(axnb, filtered.fulfillmentEventsMap, today);

  const ttfByServiceLine = dataset.serviceLines
    .map((sl) => {
      const rows = ttfRows.filter((x) => x.serviceLineId === sl.id);
      const breach = rows.filter((x) => x.breached).length;
      return {
        serviceLine: sl.name,
        avgTtf: rows.length ? sum(rows.map((x) => x.ttf)) / rows.length : 0,
        breachPct: rows.length ? (100 * breach) / rows.length : 0,
        count: rows.length,
      };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.breachPct - a.breachPct);

  const ttfBySkill = toTopSkills(ttfRows, blendedRate);

  const accountMetrics = buildAccountMetrics(filtered, dataset, targetRevenueUsd);

  const topRisks = [
    `${formatPct(ttfBreachedPct)} TTF breaches delaying billable starts`,
    `${axnbCount} demands in AXNB state`,
    `${formatNumber(demandShortfallBpm)} BPM demand shortfall vs sold plan`,
    `${formatPct(100 - fulfillmentRate * 100)} fulfillment leakage`,
  ];

  const topLevers = [
    `Convert AXNB pool within 7 days to unlock ${formatCurrency(axnbCount * blendedRate * 0.6)}`,
    `Close demand creation gap on bookings (${bookingWithoutDemand} bookings without demand)`,
    `Reduce TTF by ${config.ttfThresholdDays} days in top 3 skills`,
    `Increase pipeline conversion by 10% for shortfall service lines`,
  ];

  const actions = buildActions(kpis, demandShortfallBpm, bookingWithoutDemand, blendedRate);

  const nextQuarterKey = nextQuarter(filters.quarter);
  const nextQ = quarterStartEnd(nextQuarterKey);
  const endQuarterRunRate = forecastRevenueUsd / 3;
  const nextQuarterRampDownUsd = filtered.existingRuns
    .filter((r) => inRange(r.billingEndDate, nextQ.start, nextQ.end))
    .reduce((acc, r) => {
      const sl = dataset.serviceLines.find((x) => x.id === r.serviceLineId);
      const rate = config.blendedRateByServiceLine[sl?.name ?? dominantServiceLine] ?? blendedRate;
      return acc + r.quantity * rate;
    }, 0);
  const nextQuarterRampUpBpm = filtered.demands
    .filter((d) => {
      const ds = new Date(d.demandStartDate);
      return ds >= nextQ.start && ds <= nextQ.end;
    })
    .reduce((acc, d) => acc + d.quantity, 0);

  const convertedOppRevenue = filtered.opportunities.reduce((acc, o) => {
    const sl = dataset.serviceLines.find((s) => s.id === o.serviceLineId);
    const base = config.pipelineConversionRates.byServiceLine[sl?.name ?? ""] ?? config.pipelineConversionRates.global;
    return acc + o.valueUsd * base;
  }, 0);

  const baseRevenue = endQuarterRunRate * 3 - nextQuarterRampDownUsd + nextQuarterRampUpBpm * blendedRate + convertedOppRevenue;

  const planning = {
    nextQuarter: nextQuarterKey,
    revenueForecast: baseRevenue,
    bpmForecast: baseRevenue / blendedRate,
    ruForecast: nextQuarterRampUpBpm,
    rdForecast: nextQuarterRampDownUsd / blendedRate,
    byScenario: (Object.keys(scenarioMultiplier) as Scenario[]).map((scenario) => {
      const m = scenarioMultiplier[scenario];
      const revenue = endQuarterRunRate * 3 - nextQuarterRampDownUsd + nextQuarterRampUpBpm * blendedRate + convertedOppRevenue * m;
      return {
        scenario,
        revenue,
        bpm: revenue / blendedRate,
      };
    }),
  };

  return {
    filters,
    todayISO,
    dataset,
    kpis,
    confidenceBand,
    shouldMeetTarget: gapToTargetUsd <= 0,
    attainmentSplit,
    topRisks,
    topLevers,
    revenueBridge: [
      { step: "Target", valueUsd: targetRevenueUsd },
      { step: "QTD Actual", valueUsd: qtdActualRevenueUsd },
      { step: "Projected", valueUsd: forecastRevenueUsd },
      { step: "Gap", valueUsd: gapToTargetUsd },
    ],
    diagnosticRows: {
      targetVsActual: [
        { metric: "Target Revenue", value: targetRevenueUsd },
        { metric: "Sold Revenue", value: soldRevenueUsd, pct: pctOf(soldRevenueUsd, targetRevenueUsd) },
        { metric: "QTD Actual Revenue", value: qtdActualRevenueUsd, pct: pctOf(qtdActualRevenueUsd, targetRevenueUsd) },
        { metric: "Forecast Revenue", value: forecastRevenueUsd, pct: pctOf(forecastRevenueUsd, targetRevenueUsd) },
        { metric: "Gap to Target", value: gapToTargetUsd, pct: gapToTargetPct },
      ],
      bpmChain: [
        { metric: "Sold BPM", value: soldBpm },
        { metric: "Actual BPM (Net) QTD", value: actualBpmNetQtd, pct: pctOf(actualBpmNetQtd, soldBpm) },
        { metric: "Forecast BPM", value: forecastBpm, pct: pctOf(forecastBpm, soldBpm) },
        { metric: "Demand Open BPM", value: demandOpenBpm },
      ],
      demandCoverage: [
        { metric: "Shortfall BPM", value: demandShortfallBpm },
        { metric: "Open Demand BPM", value: demandOpenBpm, pct: pctOf(demandOpenBpm, soldBpm) },
        {
          metric: "Bookings Without Demand Coverage",
          value: bookingWithoutDemand,
          pct: pctOf(bookingWithoutDemand, filtered.bookings.length),
        },
      ],
      fulfillmentPipeline: [
        { stage: "Demanded", bpm: sum(filtered.demands.map((d) => d.quantity)), count: filtered.demands.length },
        {
          stage: "Reserved",
          bpm: sum(
            filtered.demands
              .filter((d) => !!filtered.fulfillmentEventsMap.get(d.demandId)?.reservedDate)
              .map((d) => d.quantity),
          ),
          count: filtered.demands.filter((d) => !!filtered.fulfillmentEventsMap.get(d.demandId)?.reservedDate).length,
        },
        {
          stage: "Allocated",
          bpm: sum(
            filtered.demands
              .filter((d) => !!filtered.fulfillmentEventsMap.get(d.demandId)?.allocatedDate)
              .map((d) => d.quantity),
          ),
          count: filtered.demands.filter((d) => !!filtered.fulfillmentEventsMap.get(d.demandId)?.allocatedDate).length,
        },
        {
          stage: "Billed",
          bpm: sum(
            filtered.demands
              .filter((d) => !!filtered.billingEventsMap.get(d.demandId)?.billableStartDate)
              .map((d) => d.quantity),
          ),
          count: filtered.demands.filter((d) => !!filtered.billingEventsMap.get(d.demandId)?.billableStartDate).length,
        },
      ],
      axnbAging,
      ttfByServiceLine,
      ttfBySkill,
    },
    actions,
    accountMetrics,
    planning,
  };
}

export function parseFilters(query: Record<string, string | string[] | undefined>, defaultQuarter: QuarterKey): FilterState {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return {
    quarter: (one(query.quarter) as QuarterKey) ?? defaultQuarter,
    sectorId: one(query.sectorId),
    serviceLineId: one(query.serviceLineId),
    sdluId: one(query.sdluId),
    accountId: one(query.accountId),
  };
}

function applyFilters(dataset: Dataset, filters: FilterState) {
  const accountSet = new Set(
    dataset.accounts
      .filter((a) => {
        if (filters.accountId && a.id !== filters.accountId) return false;
        if (filters.sectorId && a.sectorId !== filters.sectorId) return false;
        if (filters.serviceLineId && a.primaryServiceLineId !== filters.serviceLineId) return false;
        if (filters.sdluId && a.sdluId !== filters.sdluId) return false;
        return true;
      })
      .map((a) => a.id),
  );

  const bookings = dataset.bookings.filter((b) => accountSet.has(b.accountId));
  const demands = dataset.demands.filter((d) => accountSet.has(d.accountId));
  const fulfillmentEvents = dataset.fulfillmentEvents.filter((f) => demands.some((d) => d.demandId === f.demandId));
  const billingEvents = dataset.billingEvents.filter((b) => demands.some((d) => d.demandId === b.demandId));
  const opportunities = dataset.opportunities.filter((o) => accountSet.has(o.accountId));
  const existingRuns = dataset.existingRuns.filter((r) => accountSet.has(r.accountId));

  return {
    ...dataset,
    bookings,
    demands,
    fulfillmentEvents,
    billingEvents,
    opportunities,
    existingRuns,
    fulfillmentEventsMap: new Map(fulfillmentEvents.map((x) => [x.demandId, x])),
    billingEventsMap: new Map(billingEvents.map((x) => [x.demandId, x])),
  };
}

function computeQtdRevenue(filtered: ReturnType<typeof applyFilters>, qStart: Date, today: Date): number {
  return filtered.demands.reduce((acc, d) => {
    const b = filtered.billingEventsMap.get(d.demandId);
    if (!b?.billableStartDate) return acc;
    const billEnd = b.billableEndDate ? new Date(b.billableEndDate) : today;
    const days = overlapDays(b.billableStartDate, toISODate(billEnd > today ? today : billEnd), qStart, today);
    if (days <= 0) return acc;
    const sl = filtered.serviceLines.find((x) => x.id === d.serviceLineId)?.name ?? "Applications";
    const rate = config.blendedRateByServiceLine[sl] ?? DEFAULT_BLENDED_RATE;
    return acc + (d.quantity * days * rate) / BPM_DAYS;
  }, 0);
}

function computeRuBpm(filtered: ReturnType<typeof applyFilters>, qStart: Date, today: Date): number {
  return filtered.demands.reduce((acc, d) => {
    const b = filtered.billingEventsMap.get(d.demandId);
    if (!b?.billableStartDate) return acc;
    const start = new Date(b.billableStartDate);
    if (start < qStart || start > today) return acc;
    const days = overlapDays(b.billableStartDate, toISODate(today), qStart, today);
    return acc + (d.quantity * Math.min(days, BPM_DAYS)) / BPM_DAYS;
  }, 0);
}

function computeRdBpm(filtered: ReturnType<typeof applyFilters>, qStart: Date, today: Date): number {
  return filtered.existingRuns
    .filter((r) => inRange(r.billingEndDate, qStart, today))
    .reduce((acc, r) => acc + r.quantity, 0);
}

function computeOpenDemandBpm(filtered: ReturnType<typeof applyFilters>, today: Date, qEnd: Date): number {
  return filtered.demands.reduce((acc, d) => {
    const bill = filtered.billingEventsMap.get(d.demandId);
    if (bill?.billableStartDate) return acc;
    const start = new Date(d.demandStartDate) > today ? new Date(d.demandStartDate) : today;
    const end = new Date(d.demandEndDate) > qEnd ? qEnd : new Date(d.demandEndDate);
    if (end < start) return acc;
    return acc + (d.quantity * (diffDays(start, end) + 1)) / BPM_DAYS;
  }, 0);
}

function computeFulfilledBpm(filtered: ReturnType<typeof applyFilters>, qStart: Date, qEnd: Date): number {
  return filtered.demands.reduce((acc, d) => {
    const bill = filtered.billingEventsMap.get(d.demandId);
    if (!bill?.billableStartDate || !bill.billableEndDate) return acc;
    const days = overlapDays(bill.billableStartDate, bill.billableEndDate, qStart, qEnd);
    return acc + (d.quantity * days) / BPM_DAYS;
  }, 0);
}

function bucketAxnbAging(
  axnb: ReturnType<typeof applyFilters>["demands"],
  fulfillmentMap: ReturnType<typeof applyFilters>["fulfillmentEventsMap"],
  today: Date,
): { bucket: string; count: number }[] {
  const out = {
    "0-7": 0,
    "8-14": 0,
    "15-30": 0,
    ">30": 0,
  };
  axnb.forEach((d) => {
    const a = fulfillmentMap.get(d.demandId)?.allocatedDate;
    const days = a ? diffDays(new Date(a), today) : 0;
    if (days <= 7) out["0-7"] += 1;
    else if (days <= 14) out["8-14"] += 1;
    else if (days <= 30) out["15-30"] += 1;
    else out[">30"] += 1;
  });
  return Object.entries(out).map(([bucket, count]) => ({ bucket, count }));
}

function toTopSkills(
  rows: Array<{ skill: string; breached: boolean; quantity: number }>,
  blendedRate: number,
): { skill: string; count: number; bpm: number; revImpact: number; breachPct: number }[] {
  const bySkill = new Map<string, { total: number; breach: number; qty: number }>();
  rows.forEach((r) => {
    const x = bySkill.get(r.skill) ?? { total: 0, breach: 0, qty: 0 };
    x.total += 1;
    x.qty += r.quantity;
    if (r.breached) x.breach += 1;
    bySkill.set(r.skill, x);
  });
  return [...bySkill.entries()]
    .map(([skill, x]) => {
      const bpm = x.qty;
      return {
        skill,
        count: x.total,
        bpm,
        revImpact: bpm * blendedRate,
        breachPct: x.total ? (100 * x.breach) / x.total : 0,
      };
    })
    .sort((a, b) => b.revImpact - a.revImpact)
    .slice(0, 12);
}

function buildActions(
  kpis: KpiSet,
  shortfallBpm: number,
  bookingWithoutDemand: number,
  blendedRate: number,
): ActionRecommendation[] {
  return [
    {
      id: "act-1",
      title: "Convert aged AXNB into billable starts",
      rationale: `AXNB volume ${kpis.axnbCount} with visible aging buckets is suppressing QTD recognition.`,
      impactedMetric: "QTD Actual Revenue",
      estimatedUpliftBpm: kpis.axnbCount * 0.9,
      estimatedUpliftRevenueUsd: kpis.axnbCount * blendedRate * 0.65,
      confidence: "High",
      ownerType: "Delivery",
      deepLink: "/diagnostics#axnb",
      track: "revenue",
    },
    {
      id: "act-2",
      title: "Close booking-to-demand creation gap",
      rationale: `${bookingWithoutDemand} bookings still lack demand records; this blocks funnel conversion.`,
      impactedMetric: "Demand BPM Open",
      estimatedUpliftBpm: Math.max(6, bookingWithoutDemand * 0.6),
      estimatedUpliftRevenueUsd: bookingWithoutDemand * blendedRate * 0.4,
      confidence: "Medium",
      ownerType: "Sales lead",
      deepLink: "/diagnostics#demand-coverage",
      track: "revenue",
    },
    {
      id: "act-3",
      title: "Reduce TTF for breached skills",
      rationale: `TTF breach at ${formatPct(kpis.ttfBreachedPct)} can be recovered by pre-allocating scarce skills.`,
      impactedMetric: "Forecast BPM",
      estimatedUpliftBpm: 8,
      estimatedUpliftRevenueUsd: 8 * blendedRate,
      confidence: "Medium",
      ownerType: "Staffing",
      deepLink: "/diagnostics#ttf",
      track: "bpm",
    },
    {
      id: "act-4",
      title: "Pipeline conversion push on at-risk opportunities",
      rationale: `Shortfall BPM is ${formatNumber(shortfallBpm)} and can be offset by tighter opportunity conversion governance.`,
      impactedMetric: "Sold BPM",
      estimatedUpliftBpm: Math.max(5, shortfallBpm * 0.35),
      estimatedUpliftRevenueUsd: Math.max(5, shortfallBpm * 0.35) * blendedRate,
      confidence: "Low",
      ownerType: "Account lead",
      deepLink: "/planning",
      track: "bpm",
    },
    {
      id: "act-5",
      title: "Re-phase ramp-down exits with finance operations",
      rationale: `RD is ${formatNumber(kpis.rdBpmQtd)} BPM QTD; smoothing exits protects forecast attainment.`,
      impactedMetric: "Gap to Target",
      estimatedUpliftBpm: kpis.rdBpmQtd * 0.15,
      estimatedUpliftRevenueUsd: kpis.rdBpmQtd * 0.15 * blendedRate,
      confidence: "Low",
      ownerType: "Finance ops",
      deepLink: "/planning",
      track: "revenue",
    },
  ];
}

function buildAccountMetrics(
  filtered: ReturnType<typeof applyFilters>,
  dataset: Dataset,
  targetRevenueUsd: number,
) {
  const byAccount = new Map<string, {
    soldRevenueUsd: number;
    qtdRevenueUsd: number;
    forecastRevenueUsd: number;
    demandQty: number;
    fulfilledQty: number;
    axnbCount: number;
    ttfBreaches: number;
  }>();

  for (const a of filtered.accounts) {
    byAccount.set(a.id, {
      soldRevenueUsd: 0,
      qtdRevenueUsd: 0,
      forecastRevenueUsd: 0,
      demandQty: 0,
      fulfilledQty: 0,
      axnbCount: 0,
      ttfBreaches: 0,
    });
  }

  filtered.bookings.forEach((b) => {
    const x = byAccount.get(b.accountId);
    if (x) x.soldRevenueUsd += b.soldRevenueUsd;
  });

  const today = new Date(filtered.refreshDate);
  const progress = quarterProgress(filtered.bookings[0]?.quarter ?? "2026-Q1", today).ratio || 1;
  filtered.demands.forEach((d) => {
    const x = byAccount.get(d.accountId);
    if (!x) return;
    x.demandQty += d.quantity;
    const bill = filtered.billingEventsMap.get(d.demandId);
    const sl = dataset.serviceLines.find((s) => s.id === d.serviceLineId)?.name ?? "Applications";
    const rate = config.blendedRateByServiceLine[sl] ?? DEFAULT_BLENDED_RATE;
    if (bill?.billableStartDate) {
      const billedDays = overlapDays(
        bill.billableStartDate,
        bill.billableEndDate ?? toISODate(today),
        addDays(today, -90),
        today,
      );
      x.qtdRevenueUsd += (d.quantity * Math.max(0, billedDays) * rate) / BPM_DAYS;
      x.fulfilledQty += d.quantity;
      const ttf = diffDays(new Date(d.demandStartDate), new Date(bill.billableStartDate));
      if (ttf > 21) x.ttfBreaches += 1;
    } else if (filtered.fulfillmentEventsMap.get(d.demandId)?.allocatedDate) {
      x.axnbCount += 1;
    }
  });

  const accountTarget = targetRevenueUsd / Math.max(1, filtered.accounts.length);
  return filtered.accounts.map((a) => {
    const x = byAccount.get(a.id)!;
    const forecastRevenueUsd = progress > 0 ? x.qtdRevenueUsd / progress : x.qtdRevenueUsd;
    return {
      accountId: a.id,
      accountName: a.name,
      sectorId: a.sectorId,
      serviceLineId: a.primaryServiceLineId,
      sdluId: a.sdluId,
      soldRevenueUsd: x.soldRevenueUsd,
      qtdRevenueUsd: x.qtdRevenueUsd,
      forecastRevenueUsd,
      revenueGapUsd: accountTarget - forecastRevenueUsd,
      ruGapBpm: Math.max(0, (x.soldRevenueUsd - x.qtdRevenueUsd) / DEFAULT_BLENDED_RATE),
      demandShortfallBpm: Math.max(0, x.soldRevenueUsd / DEFAULT_BLENDED_RATE - x.demandQty),
      axnbCount: x.axnbCount,
      ttfBreaches: x.ttfBreaches,
    };
  });
}

function getDominantServiceLine(bookings: { serviceLineId: string }[]): string {
  const count = new Map<string, number>();
  bookings.forEach((b) => count.set(b.serviceLineId, (count.get(b.serviceLineId) ?? 0) + 1));
  const max = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!max) return "Applications";
  const idx = Number(max.replace("sl-", "")) - 1;
  return config.serviceLines[idx] ?? "Applications";
}

export function formatCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export function formatNumber(v: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(v);
}

export function formatPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function pctOf(v: number, total: number): number {
  return total ? (100 * v) / total : 0;
}
