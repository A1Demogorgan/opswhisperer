"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Option = { id: string; name: string };

export function GlobalFilters({
  quarters,
  sectors,
  serviceLines,
  sdlus,
  accounts,
}: {
  quarters: string[];
  sectors: Option[];
  serviceLines: Option[];
  sdlus: string[];
  accounts: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (!value) p.delete(key);
    else p.set(key, value);
    router.push(`${pathname}?${p.toString()}`);
  };

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3 lg:grid-cols-5">
      <Select label="Quarter" value={searchParams.get("quarter") ?? quarters[0]} onChange={(v) => set("quarter", v)} options={quarters.map((q) => ({ id: q, name: q }))} />
      <Select label="Sector" value={searchParams.get("sectorId") ?? ""} onChange={(v) => set("sectorId", v)} options={[{ id: "", name: "All" }, ...sectors]} />
      <Select label="Service Line" value={searchParams.get("serviceLineId") ?? ""} onChange={(v) => set("serviceLineId", v)} options={[{ id: "", name: "All" }, ...serviceLines]} />
      <Select label="SDLU" value={searchParams.get("sdluId") ?? ""} onChange={(v) => set("sdluId", v)} options={[{ id: "", name: "All" }, ...sdlus.map((s) => ({ id: s, name: s }))]} />
      <Select label="Account" value={searchParams.get("accountId") ?? ""} onChange={(v) => set("accountId", v)} options={[{ id: "", name: "All" }, ...accounts]} />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <select
        className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.id || "all"} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
