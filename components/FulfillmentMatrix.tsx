"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/metrics";

type Row = {
  sector: string;
  sdlu: string;
  account: string;
  skillset: string;
  volume: number;
  timeToFulfillDays: number;
};

export function FulfillmentMatrix({
  rows,
  options,
}: {
  rows: Row[];
  options: {
    sectors: string[];
    sdlus: string[];
    accounts: string[];
    skillsets: string[];
  };
}) {
  const [sector, setSector] = useState("");
  const [sdlu, setSdlu] = useState("");
  const [account, setAccount] = useState("");
  const [skillset, setSkillset] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (sector && row.sector !== sector) return false;
      if (sdlu && row.sdlu !== sdlu) return false;
      if (account && row.account !== account) return false;
      if (skillset && row.skillset !== skillset) return false;
      return true;
    });
  }, [rows, sector, sdlu, account, skillset]);

  const matrixRows = filtered.length ? filtered : rows;
  const volumeCutoff = median(matrixRows.map((row) => row.volume));
  const timeCutoff = median(matrixRows.map((row) => row.timeToFulfillDays));

  const quadrants = [
    summarizeQuadrant("High Volume / Slow Fulfillment", matrixRows, (row) => row.volume >= volumeCutoff && row.timeToFulfillDays >= timeCutoff),
    summarizeQuadrant("High Volume / Fast Fulfillment", matrixRows, (row) => row.volume >= volumeCutoff && row.timeToFulfillDays < timeCutoff),
    summarizeQuadrant("Low Volume / Slow Fulfillment", matrixRows, (row) => row.volume < volumeCutoff && row.timeToFulfillDays >= timeCutoff),
    summarizeQuadrant("Low Volume / Fast Fulfillment", matrixRows, (row) => row.volume < volumeCutoff && row.timeToFulfillDays < timeCutoff),
  ];

  return (
    <section className="flex h-[420px] flex-col rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm font-semibold text-slate-100">Fulfilled Volume vs Time to Fulfill</p>
      <p className="mt-1 text-xs text-slate-400">
        2x2 matrix on fulfilled demand only (customer billed). Open demand is tracked separately.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        In-scope fulfilled demands: {formatNumber(matrixRows.length)}
      </p>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <FilterSelect label="Sector" value={sector} onChange={setSector} options={options.sectors} />
        <FilterSelect label="SDLU" value={sdlu} onChange={setSdlu} options={options.sdlus} />
        <FilterSelect label="Account" value={account} onChange={setAccount} options={options.accounts} />
        <FilterSelect label="Skillset" value={skillset} onChange={setSkillset} options={options.skillsets} />
        <div className="flex items-end">
          <button
            onClick={() => {
              setSector("");
              setSdlu("");
              setAccount("");
              setSkillset("");
            }}
            className="w-full rounded border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="mt-3 grid flex-1 gap-2 overflow-y-auto md:grid-cols-2">
        {quadrants.map((q) => (
          <div key={q.label} className={`rounded border p-3 ${quadrantTone(q.label)}`}>
            <p className="text-xs uppercase tracking-wide text-slate-400">{q.label}</p>
            <p className="mt-1 text-sm text-slate-200">Demands: {formatNumber(q.count)}</p>
            <p className="text-sm text-slate-200">Total Volume: {formatNumber(q.totalVolume)}</p>
            <p className="text-sm text-slate-200">Avg TTF: {formatNumber(q.avgTime)} days</p>
          </div>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-2 text-xs text-amber-300">
          No rows matched current filters. Showing matrix for all available rows.
        </p>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        Median cutoffs: volume {formatNumber(volumeCutoff)}, time {formatNumber(timeCutoff)} days.
      </p>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function summarizeQuadrant(label: string, rows: Row[], match: (row: Row) => boolean) {
  const items = rows.filter(match);
  const totalVolume = items.reduce((acc, item) => acc + item.volume, 0);
  const avgTime = items.length
    ? items.reduce((acc, item) => acc + item.timeToFulfillDays, 0) / items.length
    : 0;

  return {
    label,
    count: items.length,
    totalVolume,
    avgTime,
  };
}

function quadrantTone(label: string): string {
  if (label === "High Volume / Slow Fulfillment") {
    return "border-rose-800/80 bg-rose-950/25";
  }
  if (label === "High Volume / Fast Fulfillment") {
    return "border-emerald-800/80 bg-emerald-950/25";
  }
  if (label === "Low Volume / Slow Fulfillment") {
    return "border-amber-800/80 bg-amber-950/20";
  }
  return "border-cyan-800/80 bg-cyan-950/20";
}
