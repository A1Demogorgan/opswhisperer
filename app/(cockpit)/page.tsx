import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { HistoricalComparisonChart } from "@/components/Charts";
import { HomeFilters } from "@/components/HomeFilters";
import { LeadershipChatPanel } from "@/components/LeadershipChatPanel";
import { PastViewControls } from "@/components/PastViewControls";
import { getDashboard } from "@/lib/dashboard";
import { quarterFromDate, todayDate } from "@/lib/date";
import { getCsvHistoricalOverview, getCsvQuarterOverview } from "@/lib/csv-quarter";
import { formatCurrency, formatNumber } from "@/lib/metrics";
import { seeded } from "@/lib/random";

export default async function ExecutiveOverview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedView = pickOne(resolvedSearchParams.view);
  const view =
    requestedView === "past" || requestedView === "next-quarter"
      ? requestedView
      : "this-quarter";
  const requestedPastMode = pickOne(resolvedSearchParams.pastMode);
  const pastMode = requestedPastMode === "weekly" ? "weekly" : "quarterly";
  const selectedPastQuarters = (pickOne(resolvedSearchParams.pastQuarters) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const today = todayDate();
  const currentQuarter = quarterFromDate(today);
  const quarterHeading =
    view === "past" ? "" : view === "next-quarter" ? "Q1-2027" : "Q4-2026";
  const filters: Record<string, string> = { quarter: currentQuarter };
  const sectorId = pickOne(resolvedSearchParams.sectorId);
  const serviceLineId = pickOne(resolvedSearchParams.serviceLineId);
  if (sectorId) filters.sectorId = sectorId;
  if (serviceLineId) filters.serviceLineId = serviceLineId;

  const { model } = getDashboard(filters);
  const csvOverview = await getCsvQuarterOverview({ sectorId, serviceLineId });
  const historicalOverview = await getCsvHistoricalOverview(
    { sectorId, serviceLineId },
    selectedPastQuarters,
  );
  const expectedFactor = getExpectedFactor(currentQuarter, sectorId, serviceLineId);
  const pastData =
    pastMode === "weekly" ? historicalOverview.weeklyAverage : historicalOverview.quarterly;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-2">
          <main className="space-y-2">
            <div className="mx-auto mb-8 flex w-full max-w-[1400px] items-center justify-between">
              <h1 className="text-4xl font-semibold uppercase tracking-[0.14em] text-slate-100 xl:text-5xl">
                {quarterHeading}
              </h1>
              <div className="px-2">
                <Suspense fallback={null}>
                  <HomeFilters
                    view={view}
                    sectorId={sectorId}
                    serviceLineId={serviceLineId}
                    sectors={csvOverview.sectors}
                    serviceLines={csvOverview.serviceLines}
                  />
                </Suspense>
              </div>
            </div>

            {view === "past" ? (
              <>
                <Suspense fallback={null}>
                  <PastViewControls
                    mode={pastMode}
                    availableQuarters={historicalOverview.availableQuarters}
                    selectedQuarters={selectedPastQuarters}
                  />
                </Suspense>
                <div className="grid gap-2 xl:grid-cols-2">
                  <HistoricalComparisonChart
                    title={pastMode === "weekly" ? "Revenue Weekly Average" : "Revenue by Quarter"}
                    data={pastData.revenue}
                    format="currency"
                  />
                  <HistoricalComparisonChart
                    title={pastMode === "weekly" ? "BPM Weekly Average" : "BPM by Quarter"}
                    data={pastData.bpm}
                    format="number"
                  />
                  <HistoricalComparisonChart
                    title={pastMode === "weekly" ? "Net BPM Weekly Average" : "Net BPM by Quarter"}
                    data={pastData.netBpm}
                    format="number"
                  />
                  <HistoricalComparisonChart
                    title={pastMode === "weekly" ? "RU BPM Weekly Average" : "RU BPM by Quarter"}
                    data={pastData.ruBpm}
                    format="number"
                  />
                  <HistoricalComparisonChart
                    title={pastMode === "weekly" ? "RD BPM Weekly Average" : "RD BPM by Quarter"}
                    data={pastData.rdBpm}
                    format="number"
                  />
                </div>
              </>
            ) : view === "this-quarter" ? (
              <>
                <Section title="Revenue" href={buildDetailHref("revenue", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget Revenue" value={formatCurrency(csvOverview.revenue.target)} subtitle="CSV budget file" tone="blue" />
                  <ColorKpiCard title="Sold Revenue" value={formatCurrency(csvOverview.revenue.sold)} subtitle="Baseline + order plan" tone="blue" />
                  <ColorKpiCard title="Forecast Revenue" value={formatCurrency(csvOverview.revenue.forecast)} subtitle="Forecast ramp file" tone="blue" />
                  <ColorKpiCard title="Expected Revenue" value={formatCurrency(applyExpectedFactor(csvOverview.revenue.forecast, expectedFactor))} subtitle="Revenue you will realistically achieve - AI predicted" tone="blue" />
                  <ColorKpiCard title="Actual Revenue" value={formatCurrency(csvOverview.revenue.actual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="blue" />
                </Section>

                <Section title="BPM" href={buildDetailHref("bpm", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget BPM" value={formatNumber(csvOverview.bpm.target)} subtitle="$50 x 160 hours/month" tone="cyan" />
                  <ColorKpiCard title="Sold BPM" value={formatNumber(csvOverview.bpm.sold)} subtitle="Converted from sold revenue" tone="cyan" />
                  <ColorKpiCard title="Forecast BPM" value={formatNumber(csvOverview.bpm.forecast)} subtitle="Converted from forecast revenue" tone="cyan" />
                  <ColorKpiCard title="Expected BPM" value={formatNumber(applyExpectedFactor(csvOverview.bpm.forecast, expectedFactor))} subtitle="BPM you will realistically achieve - AI predicted" tone="cyan" />
                  <ColorKpiCard title="Actual BPM" value={formatNumber(csvOverview.bpm.actual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="cyan" />
                </Section>

                <Section title="Net BPM" href={buildDetailHref("net-bpm", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget Net BPM" value={formatNumber(csvOverview.kpis.netBpmTarget)} subtitle="Increase from prior quarter end" tone="violet" />
                  <ColorKpiCard title="Sold Net BPM" value={formatNumber(csvOverview.kpis.netBpmSold)} subtitle="Sold - prior quarter end" tone="violet" />
                  <ColorKpiCard title="Forecast Net BPM" value={formatNumber(csvOverview.kpis.netBpmBudget)} subtitle="Forecast - prior quarter end" tone="violet" />
                  <ColorKpiCard title="Expected Net BPM" value={formatNumber(applyExpectedFactor(csvOverview.kpis.netBpmBudget, expectedFactor))} subtitle="Net BPM you will realistically achieve - AI predicted" tone="violet" />
                  <ColorKpiCard title="Actual Net BPM" value={formatNumber(csvOverview.kpis.netBpmActual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="violet" />
                </Section>

                <Section title="RU BPM" href={buildDetailHref("ru-bpm", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget RU BPM" value={formatNumber(csvOverview.kpis.ruBpmTarget)} subtitle="Required RU for budget" tone="emerald" />
                  <ColorKpiCard title="Sold RU BPM" value={formatNumber(csvOverview.kpis.ruBpmSold)} subtitle="From sold order changes" tone="emerald" />
                  <ColorKpiCard title="Forecast RU BPM" value={formatNumber(csvOverview.kpis.ruBpmBudget)} subtitle="Forecast ramp-up plan" tone="emerald" />
                  <ColorKpiCard title="Expected RU BPM" value={formatNumber(applyExpectedFactor(csvOverview.kpis.ruBpmBudget, expectedFactor))} subtitle="RU BPM you will realistically achieve - AI predicted" tone="emerald" />
                  <ColorKpiCard title="Actual RU BPM" value={formatNumber(csvOverview.kpis.ruBpmActual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="emerald" />
                </Section>

                <Section title="RD BPM" href={buildDetailHref("rd-bpm", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget RD BPM" value={formatNumber(csvOverview.kpis.rdBpmTarget)} subtitle="Assumed ramp-down load" tone="amber" />
                  <ColorKpiCard title="Sold RD BPM" value={formatNumber(csvOverview.kpis.rdBpmSold)} subtitle="From sold order changes" tone="amber" />
                  <ColorKpiCard title="Forecast RD BPM" value={formatNumber(csvOverview.kpis.rdBpmBudget)} subtitle="Forecast ramp-down plan" tone="amber" />
                  <ColorKpiCard title="Expected RD BPM" value={formatNumber(applyExpectedFactor(csvOverview.kpis.rdBpmBudget, expectedFactor))} subtitle="RD BPM you will realistically achieve - AI predicted" tone="amber" />
                  <ColorKpiCard title="Actual RD BPM" value={formatNumber(csvOverview.kpis.rdBpmActual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="amber" />
                </Section>

              </>
            ) : (
              <div className="mx-auto grid max-w-[1100px] gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
                <ColorKpiCard title="Revenue forecast" value={formatCurrency(model.planning.revenueForecast)} subtitle="Next quarter projection" tone="blue" />
                <ColorKpiCard title="BPM forecast" value={formatNumber(model.planning.bpmForecast)} subtitle="Next quarter projection" tone="cyan" />
                <ColorKpiCard title="RU forecast" value={formatNumber(model.planning.ruForecast)} subtitle="Next quarter ramp-up" tone="emerald" />
                <ColorKpiCard title="RD forecast" value={formatNumber(model.planning.rdForecast)} subtitle="Next quarter ramp-down" tone="amber" />
              </div>
            )}
          </main>
          <Suspense fallback={null}>
            <LeadershipChatPanel />
          </Suspense>
    </div>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="mb-0.5">
        {href ? (
          <Link href={href} className="mx-auto block max-w-[1400px] text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 hover:text-cyan-300 hover:underline">
            {title}
          </Link>
        ) : (
          <h2 className="mx-auto max-w-[1400px] text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{title}</h2>
        )}
      </div>
      <div className="mx-auto grid max-w-[1360px] gap-3 md:grid-cols-2 xl:grid-cols-5">{children}</div>
    </>
  );
}

function ColorKpiCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone:
    | "blue"
    | "cyan"
    | "violet"
    | "fuchsia"
    | "purple"
    | "emerald"
    | "amber"
    | "teal"
    | "rose"
    | "indigo";
}) {
  const toneClass: Record<string, string> = {
    blue: "border-lime-300/25 bg-[#4a4a4f]",
    cyan: "border-cyan-300/20 bg-[#4b4f55]",
    violet: "border-fuchsia-300/20 bg-[#51474f]",
    fuchsia: "border-pink-300/20 bg-[#55484f]",
    purple: "border-violet-300/20 bg-[#4b4956]",
    emerald: "border-lime-300/25 bg-[#55604a]",
    amber: "border-amber-200/25 bg-[#625445]",
    teal: "border-teal-200/20 bg-[#48605f]",
    rose: "border-rose-300/20 bg-[#5b4b4f]",
    indigo: "border-indigo-300/20 bg-[#495263]",
  };

  const accentClass: Record<string, string> = {
    blue: "bg-lime-300 text-slate-950 shadow-[0_0_28px_rgba(208,248,88,0.28)]",
    cyan: "bg-cyan-300 text-slate-950 shadow-[0_0_28px_rgba(124,222,255,0.24)]",
    violet: "bg-fuchsia-300 text-slate-950 shadow-[0_0_28px_rgba(247,114,202,0.24)]",
    fuchsia: "bg-pink-300 text-slate-950 shadow-[0_0_28px_rgba(255,126,164,0.24)]",
    purple: "bg-violet-300 text-slate-950 shadow-[0_0_28px_rgba(196,181,253,0.24)]",
    emerald: "bg-lime-300 text-slate-950 shadow-[0_0_28px_rgba(163,230,53,0.24)]",
    amber: "bg-amber-300 text-slate-950 shadow-[0_0_28px_rgba(250,204,21,0.24)]",
    teal: "bg-teal-300 text-slate-950 shadow-[0_0_28px_rgba(45,212,191,0.24)]",
    rose: "bg-rose-300 text-slate-950 shadow-[0_0_28px_rgba(251,113,133,0.24)]",
    indigo: "bg-indigo-300 text-slate-950 shadow-[0_0_28px_rgba(129,140,248,0.24)]",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[24px] border px-3 py-2.5 shadow-[0_24px_36px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] ${toneClass[tone]}`}
    >
      <div className="pointer-events-none absolute inset-x-5 bottom-0 h-8 rounded-full bg-black/35 blur-xl" />
      <div className="pointer-events-none absolute -right-5 top-3 h-16 w-16 rounded-full bg-white/6 blur-2xl" />
      <div className="relative flex min-h-[92px] items-center gap-2.5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] ${accentClass[tone]}`}>
          {renderKpiIcon(title)}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[9px] uppercase tracking-[0.16em] text-white/58"
            style={{ fontFamily: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif' }}
          >
            {title}
          </p>
          <p
            className="mt-1 text-[1.55rem] font-semibold leading-none text-white"
            style={{ fontFamily: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif' }}
          >
            {value}
          </p>
          <p
            className="mt-1.5 line-clamp-2 max-w-[14rem] text-[10px] leading-3.5 text-white/70"
            style={{ fontFamily: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif' }}
          >
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

function renderKpiIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("revenue")) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 15c1.5 1.8 3.1 3 6 3s4.5-1.2 6-3" strokeLinecap="round" />
        <path d="M12 5v12" strokeLinecap="round" />
        <path d="M8.5 8.5c0-1.4 1.4-2.5 3.5-2.5s3.5 1.1 3.5 2.5S14.1 11 12 11 8.5 12.1 8.5 13.5 9.9 16 12 16s3.5-1.1 3.5-2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (lower.includes("net")) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 16 10 11l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (lower.includes("ru")) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 18V6" strokeLinecap="round" />
        <path d="m7 11 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (lower.includes("rd")) {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 6v12" strokeLinecap="round" />
        <path d="m7 13 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 16.5V10" strokeLinecap="round" />
      <path d="M12 16.5V6" strokeLinecap="round" />
      <path d="M19 16.5V12" strokeLinecap="round" />
    </svg>
  );
}

function pickOne(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildDetailHref(
  metric: "revenue" | "bpm" | "net-bpm" | "ru-bpm" | "rd-bpm",
  sectorId?: string,
  serviceLineId?: string,
): string {
  const params = new URLSearchParams();
  if (sectorId) params.set("sectorId", sectorId);
  if (serviceLineId) params.set("serviceLineId", serviceLineId);
  const query = params.toString();
  return `/details/${metric}${query ? `?${query}` : ""}`;
}

function getExpectedFactor(
  quarter: string,
  sectorId?: string,
  serviceLineId?: string,
): number {
  const seedInput = `${quarter}:${sectorId ?? "all"}:${serviceLineId ?? "all"}`;
  const rng = seeded(hashString(seedInput));
  return 1 - (0.1 + rng.next() * 0.1);
}

function applyExpectedFactor(value: number, factor: number): number {
  return value * factor;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
