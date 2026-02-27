"use client";

import { useMemo, useState } from "react";

export function WhatIfSimulator({
  baseRevenue,
  baseBpm,
  blendedRate,
}: {
  baseRevenue: number;
  baseBpm: number;
  blendedRate: number;
}) {
  const [axnbDays, setAxnbDays] = useState(0);
  const [ttfDays, setTtfDays] = useState(0);
  const [coveragePct, setCoveragePct] = useState(0);
  const [pipelinePct, setPipelinePct] = useState(0);
  const [externalBpm, setExternalBpm] = useState(0);

  const projected = useMemo(() => {
    const upliftBpm = axnbDays * 0.4 + ttfDays * 0.3 + coveragePct * 0.2 + pipelinePct * 0.25 + externalBpm;
    const bpm = baseBpm + upliftBpm;
    return {
      bpm,
      revenue: baseRevenue + upliftBpm * blendedRate,
    };
  }, [axnbDays, ttfDays, coveragePct, pipelinePct, externalBpm, baseBpm, baseRevenue, blendedRate]);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-sm font-semibold text-slate-100">What-if Simulator</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Slider label="Reduce AXNB aging by days" value={axnbDays} min={0} max={15} onChange={setAxnbDays} />
        <Slider label="Improve TTF by days" value={ttfDays} min={0} max={15} onChange={setTtfDays} />
        <Slider label="Increase demand coverage (%)" value={coveragePct} min={0} max={30} onChange={setCoveragePct} />
        <Slider label="Increase pipeline conversion (%)" value={pipelinePct} min={0} max={30} onChange={setPipelinePct} />
        <Slider label="Add external capacity (BPM)" value={externalBpm} min={0} max={50} onChange={setExternalBpm} />
      </div>
      <div className="mt-4 rounded border border-blue-800 bg-blue-950/40 p-3 text-sm text-blue-200">
        <p>Simulated Forecast Revenue: {usd(projected.revenue)}</p>
        <p>Simulated Forecast BPM: {projected.bpm.toFixed(1)}</p>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (x: number) => void;
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}: <span className="font-semibold">{value}</span>
      <input
        className="mt-1 w-full"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function usd(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}
