export function KpiCard({
  title,
  value,
  subtitle,
  tooltip,
}: {
  title: string;
  value: string;
  subtitle?: string;
  tooltip: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-sm" title={tooltip}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
