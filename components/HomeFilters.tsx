"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function HomeFilters({
  view,
  sectorId,
  serviceLineId,
  sectors,
  serviceLines,
}: {
  view: "past" | "this-quarter" | "next-quarter";
  sectorId?: string;
  serviceLineId?: string;
  sectors: Array<{ id: string; name: string }>;
  serviceLines: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setFilter = (key: "sectorId" | "serviceLineId", value: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("view", view);
    if (!value) p.delete(key);
    else p.set(key, value);
    router.push(`${pathname}?${p.toString()}`);
  };

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      <label className="text-xs text-slate-400">
        Sector
        <select
          value={sectorId ?? ""}
          onChange={(e) => setFilter("sectorId", e.target.value)}
          className="mt-1 w-56 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
        >
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-slate-400">
        Service line
        <select
          value={serviceLineId ?? ""}
          onChange={(e) => setFilter("serviceLineId", e.target.value)}
          className="mt-1 w-56 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
        >
          <option value="">All service lines</option>
          {serviceLines.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
