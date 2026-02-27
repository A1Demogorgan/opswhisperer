import type { ReactNode } from "react";
import Link from "next/link";
import { HistoricalMetricChart } from "@/components/Charts";
import { HomeFilters } from "@/components/HomeFilters";
import { LeadershipChatPanel } from "@/components/LeadershipChatPanel";
import { getDashboard } from "@/lib/dashboard";
import { quarterFromDate, todayDate } from "@/lib/date";
import { getCsvQuarterOverview } from "@/lib/csv-quarter";
import { formatCurrency, formatNumber } from "@/lib/metrics";

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

  const today = todayDate();
  const currentQuarter = quarterFromDate(today);
  const filters: Record<string, string> = { quarter: currentQuarter };
  const sectorId = pickOne(resolvedSearchParams.sectorId);
  const serviceLineId = pickOne(resolvedSearchParams.serviceLineId);
  if (sectorId) filters.sectorId = sectorId;
  if (serviceLineId) filters.serviceLineId = serviceLineId;

  const { model } = getDashboard(filters);
  const csvOverview = await getCsvQuarterOverview({ sectorId, serviceLineId });

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-2">
          <main className="space-y-2">
            <div className="mx-auto mb-8 flex w-full max-w-[1100px] items-center justify-between">
              <h1 className="text-3xl font-semibold uppercase tracking-[0.12em] text-slate-100">Q4-2026</h1>
              <div className="px-2">
                <HomeFilters
                  view={view}
                  sectorId={sectorId}
                  serviceLineId={serviceLineId}
                  sectors={csvOverview.sectors}
                  serviceLines={csvOverview.serviceLines}
                />
              </div>
            </div>

            {view === "past" ? (
              <div className="grid gap-2 xl:grid-cols-3">
                <HistoricalMetricChart
                  title="Revenue by Quarter"
                  data={csvOverview.history}
                  dataKey="revenue"
                  color="#38bdf8"
                  format="currency"
                />
                <HistoricalMetricChart
                  title="BPM by Quarter"
                  data={csvOverview.history}
                  dataKey="bpm"
                  color="#22c55e"
                  format="number"
                />
                <HistoricalMetricChart
                  title="People by Quarter"
                  data={csvOverview.history}
                  dataKey="people"
                  color="#f59e0b"
                  format="number"
                />
              </div>
            ) : view === "this-quarter" ? (
              <>
                <Section title="Revenue" href={buildDetailHref("revenue", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget Revenue" value={formatCurrency(csvOverview.revenue.target)} subtitle="CSV budget file" tone="blue" />
                  <ColorKpiCard title="Sold Revenue" value={formatCurrency(csvOverview.revenue.sold)} subtitle="Baseline + order plan" tone="blue" />
                  <ColorKpiCard title="Forecast Revenue" value={formatCurrency(csvOverview.revenue.forecast)} subtitle="Forecast ramp file" tone="blue" />
                  <ColorKpiCard title="Actual Revenue" value={formatCurrency(csvOverview.revenue.actual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="blue" />
                </Section>

                <Section title="BPM" href={buildDetailHref("bpm", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget BPM" value={formatNumber(csvOverview.bpm.target)} subtitle="$50 x 160 hours/month" tone="cyan" />
                  <ColorKpiCard title="Sold BPM" value={formatNumber(csvOverview.bpm.sold)} subtitle="Converted from sold revenue" tone="cyan" />
                  <ColorKpiCard title="Forecast BPM" value={formatNumber(csvOverview.bpm.forecast)} subtitle="Converted from forecast revenue" tone="cyan" />
                  <ColorKpiCard title="Actual BPM" value={formatNumber(csvOverview.bpm.actual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="cyan" />
                </Section>

                <Section title="Net BPM" href={buildDetailHref("net-bpm", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget Net BPM" value={formatNumber(csvOverview.kpis.netBpmTarget)} subtitle="Increase from prior quarter end" tone="violet" />
                  <ColorKpiCard title="Sold Net BPM" value={formatNumber(csvOverview.kpis.netBpmSold)} subtitle="Sold - prior quarter end" tone="violet" />
                  <ColorKpiCard title="Forecast Net BPM" value={formatNumber(csvOverview.kpis.netBpmBudget)} subtitle="Forecast - prior quarter end" tone="violet" />
                  <ColorKpiCard title="Actual Net BPM" value={formatNumber(csvOverview.kpis.netBpmActual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="violet" />
                </Section>

                <Section title="RU BPM" href={buildDetailHref("ru-bpm", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget RU BPM" value={formatNumber(csvOverview.kpis.ruBpmTarget)} subtitle="Required RU for budget" tone="emerald" />
                  <ColorKpiCard title="Sold RU BPM" value={formatNumber(csvOverview.kpis.ruBpmSold)} subtitle="From sold order changes" tone="emerald" />
                  <ColorKpiCard title="Forecast RU BPM" value={formatNumber(csvOverview.kpis.ruBpmBudget)} subtitle="Forecast ramp-up plan" tone="emerald" />
                  <ColorKpiCard title="Actual RU BPM" value={formatNumber(csvOverview.kpis.ruBpmActual)} subtitle={`QTD through ${csvOverview.assumptions.asOfDate}`} tone="emerald" />
                </Section>

                <Section title="RD BPM" href={buildDetailHref("rd-bpm", sectorId, serviceLineId)}>
                  <ColorKpiCard title="Budget RD BPM" value={formatNumber(csvOverview.kpis.rdBpmTarget)} subtitle="Assumed ramp-down load" tone="amber" />
                  <ColorKpiCard title="Sold RD BPM" value={formatNumber(csvOverview.kpis.rdBpmSold)} subtitle="From sold order changes" tone="amber" />
                  <ColorKpiCard title="Forecast RD BPM" value={formatNumber(csvOverview.kpis.rdBpmBudget)} subtitle="Forecast ramp-down plan" tone="amber" />
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
          <LeadershipChatPanel />
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
          <Link href={href} className="mx-auto block max-w-[1100px] text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 hover:text-cyan-300 hover:underline">
            {title}
          </Link>
        ) : (
          <h2 className="mx-auto max-w-[1100px] text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{title}</h2>
        )}
      </div>
      <div className="mx-auto grid max-w-[1100px] gap-1.5 md:grid-cols-2 xl:grid-cols-4">{children}</div>
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
    blue: "border-blue-800/70 bg-gradient-to-br from-blue-950/70 to-slate-900",
    cyan: "border-cyan-800/70 bg-gradient-to-br from-cyan-950/70 to-slate-900",
    violet: "border-violet-800/70 bg-gradient-to-br from-violet-950/70 to-slate-900",
    fuchsia: "border-fuchsia-800/70 bg-gradient-to-br from-fuchsia-950/70 to-slate-900",
    purple: "border-purple-800/70 bg-gradient-to-br from-purple-950/70 to-slate-900",
    emerald: "border-emerald-800/70 bg-gradient-to-br from-emerald-950/70 to-slate-900",
    amber: "border-amber-800/70 bg-gradient-to-br from-amber-950/70 to-slate-900",
    teal: "border-teal-800/70 bg-gradient-to-br from-teal-950/70 to-slate-900",
    rose: "border-rose-800/70 bg-gradient-to-br from-rose-950/70 to-slate-900",
    indigo: "border-indigo-800/70 bg-gradient-to-br from-indigo-950/70 to-slate-900",
  };

  return (
    <div className={`rounded-lg border px-3 py-2 shadow-sm ${toneClass[tone]}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-0.5 text-base font-semibold text-slate-100">{value}</p>
      <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{subtitle}</p>
    </div>
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
