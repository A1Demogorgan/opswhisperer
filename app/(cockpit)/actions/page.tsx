import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { WhatIfSimulator } from "@/components/WhatIfSimulator";
import { config } from "@/config";
import { getDashboard } from "@/lib/dashboard";
import { formatCurrency, formatNumber } from "@/lib/metrics";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const { model, options } = getDashboard(resolvedSearchParams);
  const tab = (Array.isArray(resolvedSearchParams.tab) ? resolvedSearchParams.tab[0] : resolvedSearchParams.tab) ?? "revenue";
  const rows = model.actions.filter((a) => a.track === tab);
  const dominant = config.serviceLines[0];
  const rate = config.blendedRateByServiceLine[dominant] ?? 10080;

  return (
    <AppShell context={{ refreshed: model.todayISO, quarters: options.quarters, sectors: options.sectors, serviceLines: options.serviceLines, sdlus: options.sdlus, accounts: options.accounts }}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <div className="flex gap-2 text-sm">
            <Link href="/actions?tab=revenue" className={`rounded px-3 py-1 ${tab === "revenue" ? "bg-blue-700 text-white" : "border border-slate-600"}`}>
              Actions to achieve sold revenue
            </Link>
            <Link href="/actions?tab=bpm" className={`rounded px-3 py-1 ${tab === "bpm" ? "bg-blue-700 text-white" : "border border-slate-600"}`}>
              Actions to achieve sold BPM
            </Link>
          </div>
          <div className="mt-3">
            <DataTable
              columns={["Title", "Rationale", "Impacted Metric", "Uplift BPM", "Uplift Revenue", "Confidence", "Owner", "Drill"]}
              rows={rows.map((a) => [
                a.title,
                a.rationale,
                a.impactedMetric,
                formatNumber(a.estimatedUpliftBpm),
                formatCurrency(a.estimatedUpliftRevenueUsd),
                a.confidence,
                a.ownerType,
                <Link key={a.id} className="text-blue-300 hover:underline" href={a.deepLink}>
                  Open
                </Link>,
              ])}
            />
          </div>
        </div>

        <WhatIfSimulator
          baseRevenue={model.kpis.forecastRevenueUsd}
          baseBpm={model.kpis.forecastBpm}
          blendedRate={rate}
        />
      </div>
    </AppShell>
  );
}
