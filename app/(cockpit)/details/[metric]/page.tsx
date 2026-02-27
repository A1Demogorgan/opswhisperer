import Link from "next/link";
import { MetricProgressChart } from "@/components/Charts";
import { FulfillmentMatrix } from "@/components/FulfillmentMatrix";
import { getCsvQuarterOverview } from "@/lib/csv-quarter";
import { formatCurrency, formatNumber } from "@/lib/metrics";

type MetricKey = "revenue" | "bpm" | "net-bpm" | "ru-bpm" | "rd-bpm";

export default async function MetricDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ metric: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { metric: rawMetric } = await params;
  const metric = normalizeMetric(rawMetric);
  const resolvedSearchParams = await searchParams;
  const sectorId = pickOne(resolvedSearchParams.sectorId);
  const serviceLineId = pickOne(resolvedSearchParams.serviceLineId);
  const overview = await getCsvQuarterOverview({ sectorId, serviceLineId });

  const details = buildMetricDetails(metric, overview);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Metric Detail</p>
            <h1 className="mt-1 text-2xl font-semibold">{details.title}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {overview.quarter} | Actuals through {overview.assumptions.asOfDate}
            </p>
          </div>
          <Link
            href={buildBackHref(sectorId, serviceLineId)}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Back to Present View
          </Link>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Target" value={details.targetValue} format={details.format} />
          <SummaryCard label="Sold" value={details.soldValue} format={details.format} />
          <SummaryCard label="Forecast" value={details.forecastValue} format={details.format} />
          <SummaryCard label="Actual (QTD)" value={details.actualValue} format={details.format} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <MetricProgressChart
            title={`${details.title}: Target vs Sold vs Forecast vs Actual`}
            data={details.series}
            targetKey="target"
            soldKey="sold"
            forecastKey="forecast"
            actualKey="actual"
            projectedKey="projected"
            format={details.format}
          />

          <FulfillmentMatrix rows={overview.fulfillment.rows} options={overview.fulfillment.options} />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: "currency" | "number";
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">
        {format === "currency" ? formatCurrency(value) : formatNumber(value)}
      </p>
    </div>
  );
}

function buildMetricDetails(metric: MetricKey, overview: Awaited<ReturnType<typeof getCsvQuarterOverview>>) {
  const totalDays = Math.max(1, overview.timeline.length);
  const ratioFor = (index: number) => (index + 1) / totalDays;

  if (metric === "revenue") {
    return {
      title: "Revenue",
      format: "currency" as const,
      targetValue: overview.revenue.target,
      soldValue: overview.revenue.sold,
      forecastValue: overview.revenue.forecast,
      actualValue: overview.revenue.actual,
      series: overview.timeline.map((row, index) => ({
        date: row.date,
        target: overview.revenue.target * ratioFor(index),
        sold: overview.revenue.sold * ratioFor(index),
        forecast: row.forecastRevenue,
        actual: row.actualRevenue,
        projected: row.projectedRevenue,
      })),
    };
  }

  if (metric === "bpm") {
    return {
      title: "BPM",
      format: "number" as const,
      targetValue: overview.bpm.target,
      soldValue: overview.bpm.sold,
      forecastValue: overview.bpm.forecast,
      actualValue: overview.bpm.actual,
      series: overview.timeline.map((row, index) => ({
        date: row.date,
        target: overview.bpm.target * ratioFor(index),
        sold: overview.bpm.sold * ratioFor(index),
        forecast: row.forecastBpm,
        actual: row.actualBpm,
        projected: row.projectedBpm,
      })),
    };
  }

  if (metric === "net-bpm") {
    return {
      title: "Net BPM",
      format: "number" as const,
      targetValue: overview.kpis.netBpmTarget,
      soldValue: overview.kpis.netBpmSold,
      forecastValue: overview.kpis.netBpmBudget,
      actualValue: overview.kpis.netBpmActual,
      series: overview.timeline.map((row, index) => ({
        date: row.date,
        target: overview.kpis.netBpmTarget * ratioFor(index),
        sold: overview.kpis.netBpmSold * ratioFor(index),
        forecast: row.forecastNetBpm,
        actual: row.actualNetBpm,
        projected: row.projectedNetBpm,
      })),
    };
  }

  if (metric === "ru-bpm") {
    return {
      title: "RU BPM",
      format: "number" as const,
      targetValue: overview.kpis.ruBpmTarget,
      soldValue: overview.kpis.ruBpmSold,
      forecastValue: overview.kpis.ruBpmBudget,
      actualValue: overview.kpis.ruBpmActual,
      series: overview.timeline.map((row, index) => ({
        date: row.date,
        target: overview.kpis.ruBpmTarget * ratioFor(index),
        sold: overview.kpis.ruBpmSold * ratioFor(index),
        forecast: row.forecastRuBpm,
        actual: row.actualRuBpm,
        projected: row.projectedRuBpm,
      })),
    };
  }

  return {
    title: "RD BPM",
    format: "number" as const,
    targetValue: overview.kpis.rdBpmTarget,
    soldValue: overview.kpis.rdBpmSold,
    forecastValue: overview.kpis.rdBpmBudget,
    actualValue: overview.kpis.rdBpmActual,
    series: overview.timeline.map((row, index) => ({
      date: row.date,
      target: overview.kpis.rdBpmTarget * ratioFor(index),
      sold: overview.kpis.rdBpmSold * ratioFor(index),
      forecast: row.forecastRdBpm,
      actual: row.actualRdBpm,
      projected: row.projectedRdBpm,
    })),
  };
}

function normalizeMetric(metric: string): MetricKey {
  if (metric === "revenue" || metric === "bpm" || metric === "net-bpm" || metric === "ru-bpm" || metric === "rd-bpm") {
    return metric;
  }
  return "revenue";
}

function buildBackHref(sectorId?: string, serviceLineId?: string): string {
  const params = new URLSearchParams();
  params.set("view", "this-quarter");
  if (sectorId) params.set("sectorId", sectorId);
  if (serviceLineId) params.set("serviceLineId", serviceLineId);
  return `/?${params.toString()}`;
}

function pickOne(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
