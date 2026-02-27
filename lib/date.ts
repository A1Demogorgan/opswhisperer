import type { QuarterKey } from "@/lib/models";
import { config } from "@/config";

export function todayDate(): Date {
  return config.todayOverride ? new Date(config.todayOverride) : new Date();
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function quarterFromDate(d: Date): QuarterKey {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}` as QuarterKey;
}

export function quarterStartEnd(quarter: QuarterKey): { start: Date; end: Date } {
  const [yearRaw, qRaw] = quarter.split("-Q");
  const year = Number(yearRaw);
  const q = Number(qRaw);
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return { start, end };
}

export function quarterProgress(quarter: QuarterKey, asOf: Date): {
  elapsedDays: number;
  totalDays: number;
  remainingDays: number;
  ratio: number;
} {
  const { start, end } = quarterStartEnd(quarter);
  const clamped = new Date(
    Math.min(Math.max(asOf.getTime(), start.getTime()), end.getTime()),
  );
  const totalDays = diffDays(start, end) + 1;
  const elapsedDays = diffDays(start, clamped) + 1;
  return {
    elapsedDays,
    totalDays,
    remainingDays: totalDays - elapsedDays,
    ratio: elapsedDays / totalDays,
  };
}

export function diffDays(a: Date, b: Date): number {
  const ms = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) -
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  return Math.floor(ms / 86400000);
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export function inRange(dateISO: string, start: Date, end: Date): boolean {
  const d = new Date(dateISO);
  return d >= start && d <= end;
}

export function overlapDays(
  aStartISO: string,
  aEndISO: string,
  bStart: Date,
  bEnd: Date,
): number {
  const start = new Date(Math.max(new Date(aStartISO).getTime(), bStart.getTime()));
  const end = new Date(Math.min(new Date(aEndISO).getTime(), bEnd.getTime()));
  if (end < start) return 0;
  return diffDays(start, end) + 1;
}

export function nextQuarter(quarter: QuarterKey): QuarterKey {
  const [yearRaw, qRaw] = quarter.split("-Q");
  const year = Number(yearRaw);
  const q = Number(qRaw);
  if (q === 4) return `${year + 1}-Q1` as QuarterKey;
  return `${year}-Q${q + 1}` as QuarterKey;
}
