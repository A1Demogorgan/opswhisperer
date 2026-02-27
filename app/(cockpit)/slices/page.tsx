import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { getDashboard } from "@/lib/dashboard";
import { formatNumber, formatPct } from "@/lib/metrics";

export default async function SlicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const { model, options } = getDashboard(resolvedSearchParams);

  const heatRows = model.dataset.sectors.map((sec) => {
    const metrics = model.dataset.serviceLines.map((sl) => {
      const rows = model.accountMetrics.filter((a) => a.sectorId === sec.id && a.serviceLineId === sl.id);
      const gap = rows.reduce((acc, r) => acc + r.revenueGapUsd, 0);
      const axnb = rows.reduce((acc, r) => acc + r.axnbCount, 0);
      const ttf = rows.reduce((acc, r) => acc + r.ttfBreaches, 0);
      const shortfall = rows.reduce((acc, r) => acc + r.demandShortfallBpm, 0);
      return `${formatNumber(gap / 1000000)}M | AXNB ${axnb} | TTF ${ttf} | SH ${formatNumber(shortfall)}`;
    });
    return [sec.name, ...metrics];
  });

  return (
    <AppShell context={{ refreshed: model.todayISO, quarters: options.quarters, sectors: options.sectors, serviceLines: options.serviceLines, sdlus: options.sdlus, accounts: options.accounts }}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm font-semibold">Sector and Service Line summaries</p>
          <p className="text-xs text-slate-400">Heatmap cell format: revenue gap (M) | AXNB | TTF breaches | demand shortfall BPM.</p>
          <div className="mt-3">
            <DataTable columns={["Sector \\ Service Line", ...model.dataset.serviceLines.map((s) => s.name)]} rows={heatRows} />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold">Sector summary KPIs</p>
            {model.dataset.sectors.map((s) => {
              const rows = model.accountMetrics.filter((a) => a.sectorId === s.id);
              const gap = rows.reduce((acc, r) => acc + r.revenueGapUsd, 0);
              return (
                <p key={s.id} className="mt-2 text-sm text-slate-300">
                  {s.name}: gap {formatNumber(gap / 1000000)}M
                </p>
              );
            })}
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold">Service line summary KPIs</p>
            {model.dataset.serviceLines.map((s) => {
              const rows = model.accountMetrics.filter((a) => a.serviceLineId === s.id);
              const breached = rows.reduce((acc, r) => acc + r.ttfBreaches, 0);
              const total = rows.length || 1;
              return (
                <p key={s.id} className="mt-2 text-sm text-slate-300">
                  {s.name}: TTF breach density {formatPct((100 * breached) / total)}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
