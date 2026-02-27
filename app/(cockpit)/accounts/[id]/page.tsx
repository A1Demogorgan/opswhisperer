import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { getDashboard } from "@/lib/dashboard";
import { formatCurrency, formatNumber } from "@/lib/metrics";

export default async function AccountDetailPage({
  searchParams,
  params,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ id: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const resolvedParams = await params;
  const scoped = { ...resolvedSearchParams, accountId: resolvedParams.id };
  const { model, options } = getDashboard(scoped);
  const account = model.dataset.accounts.find((a) => a.id === resolvedParams.id);
  const metric = model.accountMetrics.find((a) => a.accountId === resolvedParams.id);
  const demands = model.dataset.demands.filter((d) => d.accountId === resolvedParams.id);

  if (!account || !metric) {
    return <div className="p-6">Account not found.</div>;
  }

  return (
    <AppShell context={{ refreshed: model.todayISO, quarters: options.quarters, sectors: options.sectors, serviceLines: options.serviceLines, sdlus: options.sdlus, accounts: options.accounts }}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm text-slate-500">Account Narrative</p>
          <p className="text-lg font-semibold text-slate-100">{account.name}</p>
          <p className="mt-2 text-sm text-slate-300">
            Forecast is {formatCurrency(metric.forecastRevenueUsd)} vs sold {formatCurrency(metric.soldRevenueUsd)}; blockers are demand shortfall {formatNumber(metric.demandShortfallBpm)} BPM, AXNB {metric.axnbCount}, and TTF breaches {metric.ttfBreaches}. Priority actions are faster AXNB conversion and skill-focused fulfillment.
          </p>
        </div>

        <DataTable
          columns={["Demand", "Skill", "Qty", "Start", "End", "Status", "TTF/AXNB"]}
          rows={demands.map((d) => {
            const f = model.dataset.fulfillmentEvents.find((x) => x.demandId === d.demandId);
            const b = model.dataset.billingEvents.find((x) => x.demandId === d.demandId);
            const status = b?.billableStartDate ? "Billed" : f?.allocatedDate ? "AXNB" : f?.reservedDate ? "Reserved" : "Open";
            const detail = b?.billableStartDate
              ? `TTF ${Math.max(0, Math.round((new Date(b.billableStartDate).getTime() - new Date(d.demandStartDate).getTime()) / 86400000))}d`
              : f?.allocatedDate
                ? `AXNB since ${f.allocatedDate}`
                : "Not billed";
            return [d.demandId, d.skill, String(d.quantity), d.demandStartDate, d.demandEndDate, status, detail];
          })}
        />

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold">Ramp-up / Ramp-down timeline (quarter)</p>
            <p className="mt-2 text-sm text-slate-300">RU gap BPM: {formatNumber(metric.ruGapBpm)} | Revenue gap: {formatCurrency(metric.revenueGapUsd)}</p>
            <p className="text-sm text-slate-300">Open demand BPM: {formatNumber(metric.demandShortfallBpm)} | AXNB: {metric.axnbCount}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-sm font-semibold">Account-specific actions</p>
            <ul className="mt-2 list-disc pl-4 text-sm text-slate-300">
              <li>Prioritize top two delayed skills for immediate staffing pull.</li>
              <li>Convert AXNB allocations older than 14 days to billed starts this week.</li>
              <li>Create missing demands for pending bookings and track with daily governance.</li>
            </ul>
            <Link href="/actions" className="mt-2 inline-block text-blue-300 hover:underline">
              Open Action Center
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
