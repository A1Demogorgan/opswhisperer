import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { getDashboard } from "@/lib/dashboard";
import { formatCurrency, formatNumber } from "@/lib/metrics";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const { model, options } = getDashboard(resolvedSearchParams);
  const metric = (Array.isArray(resolvedSearchParams.metric) ? resolvedSearchParams.metric[0] : resolvedSearchParams.metric) ?? "ruGap";

  const getScore = (row: (typeof model.accountMetrics)[number]) => {
    if (metric === "revenueGap") return row.revenueGapUsd;
    if (metric === "demandShortfall") return row.demandShortfallBpm;
    if (metric === "axnb") return row.axnbCount;
    if (metric === "ttf") return row.ttfBreaches;
    return row.ruGapBpm;
  };

  const sorted = [...model.accountMetrics].sort((a, b) => getScore(b) - getScore(a));
  const top = sorted.slice(0, 10);
  const bottom = [...sorted].reverse().slice(0, 10);

  return (
    <AppShell context={{ refreshed: model.todayISO, quarters: options.quarters, sectors: options.sectors, serviceLines: options.serviceLines, sdlus: options.sdlus, accounts: options.accounts }}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm font-semibold">Account leaderboard</p>
          <p className="text-xs text-slate-400">Metric selector via query param: ruGap, revenueGap, demandShortfall, axnb, ttf.</p>
          <div className="mt-3">
            <DataTable
              columns={["Account", "Sold Revenue", "QTD Revenue", "Forecast", "Revenue Gap", "RU Gap BPM", "Demand Shortfall", "AXNB", "TTF Breaches"]}
              rows={sorted.map((r) => [
                <Link key={r.accountId} className="text-blue-300 hover:underline" href={`/accounts/${r.accountId}`}>
                  {r.accountName}
                </Link>,
                formatCurrency(r.soldRevenueUsd),
                formatCurrency(r.qtdRevenueUsd),
                formatCurrency(r.forecastRevenueUsd),
                formatCurrency(r.revenueGapUsd),
                formatNumber(r.ruGapBpm),
                formatNumber(r.demandShortfallBpm),
                String(r.axnbCount),
                String(r.ttfBreaches),
              ])}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <RankCard title="Top 10" rows={top} />
          <RankCard title="Bottom 10" rows={bottom} />
        </div>
      </div>
    </AppShell>
  );
}

function RankCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ accountId: string; accountName: string; revenueGapUsd: number }>;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-300">
        {rows.map((r) => (
          <li key={r.accountId} className="flex justify-between">
            <Link className="text-blue-300 hover:underline" href={`/accounts/${r.accountId}`}>
              {r.accountName}
            </Link>
            <span>{formatCurrency(r.revenueGapUsd)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
