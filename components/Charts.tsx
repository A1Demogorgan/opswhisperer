"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function RevenueBridgeChart({ data }: { data: Array<{ step: string; valueUsd: number }> }) {
  return (
    <div className="h-64 rounded-lg border border-slate-700 bg-slate-900 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-800">Target to Forecast Decomposition</p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="step" />
          <YAxis />
          <Tooltip formatter={(v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)} />
          <Bar dataKey="valueUsd" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HistoricalMetricChart({
  title,
  data,
  dataKey,
  color,
  format,
}: {
  title: string;
  data: Array<{ quarter: string; revenue: number; bpm: number; people: number }>;
  dataKey: "revenue" | "bpm" | "people";
  color: string;
  format: "currency" | "number";
}) {
  return (
    <div className="h-72 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-100">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 6, bottom: 6 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis dataKey="quarter" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value: number) => formatCompactNumber(value)}
          />
          <Tooltip
            formatter={(value: number) => formatTooltipValue(value, format)}
            contentStyle={{ backgroundColor: "#020617", border: "1px solid #334155", borderRadius: 12 }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TimelineComparisonChart({
  title,
  data,
  forecastKey,
  actualKey,
  projectedKey,
  format,
}: {
  title: string;
  data: Array<Record<string, string | number | null>>;
  forecastKey: string;
  actualKey: string;
  projectedKey: string;
  format: "currency" | "number";
}) {
  return (
    <div className="h-72 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-100">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 6, bottom: 6 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value: string) => value.slice(5)}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value: number) => formatCompactNumber(value)}
          />
          <Tooltip
            formatter={(value: number) => formatTooltipValue(value, format)}
            contentStyle={{ backgroundColor: "#020617", border: "1px solid #334155", borderRadius: 12 }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Line type="monotone" dataKey={forecastKey} stroke="#22c55e" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey={actualKey} stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls={false} />
          <Line
            type="monotone"
            dataKey={projectedKey}
            stroke="#f59e0b"
            strokeWidth={2.5}
            strokeDasharray="6 6"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] text-slate-400">Green: Forecast | Blue: Actual to date | Orange dashed: Projected actual to quarter end</p>
    </div>
  );
}

export function MetricProgressChart({
  title,
  data,
  targetKey,
  soldKey,
  forecastKey,
  actualKey,
  projectedKey,
  format,
}: {
  title: string;
  data: Array<Record<string, string | number | null>>;
  targetKey: string;
  soldKey: string;
  forecastKey: string;
  actualKey: string;
  projectedKey?: string;
  format: "currency" | "number";
}) {
  return (
    <div className="h-[420px] rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-100">{title}</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 14, left: 8, bottom: 10 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value: string) => value.slice(5)}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(value: number) => formatCompactNumber(value)}
          />
          <Tooltip
            formatter={(value: number) => formatTooltipValue(value, format)}
            contentStyle={{ backgroundColor: "#020617", border: "1px solid #334155", borderRadius: 12 }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Line type="monotone" dataKey={targetKey} stroke="#a78bfa" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey={soldKey} stroke="#f59e0b" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey={forecastKey} stroke="#22c55e" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey={actualKey} stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls={false} />
          {projectedKey ? (
            <Line type="monotone" dataKey={projectedKey} stroke="#f97316" strokeWidth={2.5} strokeDasharray="6 6" dot={false} />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] text-slate-400">
        Purple: Target | Amber: Sold | Green: Forecast | Blue: Actual (QTD)
        {projectedKey ? " | Orange dashed: Actual projection" : ""}
      </p>
    </div>
  );
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTooltipValue(value: number, format: "currency" | "number"): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}
