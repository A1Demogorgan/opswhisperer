import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { getDashboard } from "@/lib/dashboard";
import { formatCurrency, formatNumber, formatPct } from "@/lib/metrics";

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const { model, options } = getDashboard(resolvedSearchParams);
  const d = model.diagnosticRows;

  return (
    <AppShell context={{ refreshed: model.todayISO, quarters: options.quarters, sectors: options.sectors, serviceLines: options.serviceLines, sdlus: options.sdlus, accounts: options.accounts }}>
      <div className="space-y-4">
        <Section title="2.1 to 2.4 Revenue and BPM gaps" blurb="Target vs sold vs actual vs forecast; sold BPM vs actual net BPM vs forecast BPM.">
          <DataTable
            columns={["Metric", "Value", "%"]}
            rows={d.targetVsActual.map((r) => [r.metric, formatCurrency(r.value), r.pct !== undefined ? formatPct(r.pct) : "-"])}
          />
          <div className="mt-3" />
          <DataTable
            columns={["Metric", "Value", "% of Sold BPM"]}
            rows={d.bpmChain.map((r) => [r.metric, formatNumber(r.value), r.pct !== undefined ? formatPct(r.pct) : "-"])}
          />
        </Section>

        <Section title="2.5 and 2.6 Demand sufficiency" blurb="Checks shortfall BPM and booking/opportunity demand creation coverage, including unknown/behavioral gap.">
          <DataTable
            columns={["Metric", "Value", "%"]}
            rows={d.demandCoverage.map((r) => [r.metric, formatNumber(r.value), r.pct !== undefined ? formatPct(r.pct) : "-"])}
          />
        </Section>

        <Section title="2.7 and 2.8 Fulfillment pipeline and AXNB" blurb="Demanded -> reserved -> allocated -> billed stages, plus AXNB aging buckets.">
          <DataTable
            columns={["Stage", "BPM", "Count"]}
            rows={d.fulfillmentPipeline.map((r) => [r.stage, formatNumber(r.bpm), String(r.count)])}
          />
          <div id="axnb" className="mt-3" />
          <DataTable columns={["AXNB Aging", "Count"]} rows={d.axnbAging.map((r) => [r.bucket, String(r.count)])} />
        </Section>

        <Section title="2.9 and 3.0 TTF timeliness and skill delays" blurb="TTF benchmark is service line historical average + threshold. Breaches are flagged with impact.">
          <div id="ttf" />
          <DataTable
            columns={["Service Line", "Avg TTF (d)", "Breach %", "Count"]}
            rows={d.ttfByServiceLine.map((r) => [r.serviceLine, formatNumber(r.avgTtf), formatPct(r.breachPct), String(r.count)])}
          />
          <div className="mt-3" />
          <DataTable
            columns={["Skill", "Count", "BPM", "Revenue Impact", "Breach %"]}
            rows={d.ttfBySkill.map((r) => [r.skill, String(r.count), formatNumber(r.bpm), formatCurrency(r.revImpact), formatPct(r.breachPct)])}
          />
        </Section>

        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
          <p className="font-semibold">Drill links</p>
          <div className="mt-2 flex gap-4">
            <Link className="text-blue-300 hover:underline" href="/accounts?metric=revenueGap">
              Revenue gap contributors
            </Link>
            <Link className="text-blue-300 hover:underline" href="/slices">
              Sector x Service Line matrix
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-base font-semibold text-slate-100">{title}</p>
      <p className="mb-3 text-sm text-slate-400">{blurb}</p>
      {children}
    </section>
  );
}
