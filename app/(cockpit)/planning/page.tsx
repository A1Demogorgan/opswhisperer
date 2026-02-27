import { AppShell } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { getDashboard } from "@/lib/dashboard";
import { formatCurrency, formatNumber } from "@/lib/metrics";

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const { model, options } = getDashboard(resolvedSearchParams);

  return (
    <AppShell context={{ refreshed: model.todayISO, quarters: options.quarters, sectors: options.sectors, serviceLines: options.serviceLines, sdlus: options.sdlus, accounts: options.accounts }}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-sm text-slate-500">Next Quarter ({model.planning.nextQuarter}) Forecast</p>
          <div className="mt-2 grid gap-3 md:grid-cols-4">
            <Metric title="Revenue" value={formatCurrency(model.planning.revenueForecast)} />
            <Metric title="BPM" value={formatNumber(model.planning.bpmForecast)} />
            <Metric title="RU" value={formatNumber(model.planning.ruForecast)} />
            <Metric title="RD" value={formatNumber(model.planning.rdForecast)} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="mb-3 text-sm font-semibold">Scenario toggles: conservative / base / aggressive</p>
          <DataTable
            columns={["Scenario", "Revenue", "BPM"]}
            rows={model.planning.byScenario.map((s) => [s.scenario, formatCurrency(s.revenue), formatNumber(s.bpm)])}
          />
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-800 p-3">
      <p className="text-xs uppercase text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
