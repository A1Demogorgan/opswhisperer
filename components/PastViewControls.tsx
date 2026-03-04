"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatQuarterDisplay } from "@/lib/date";

type PastMode = "quarterly" | "weekly";

export function PastViewControls({
  mode,
  availableQuarters,
  selectedQuarters,
}: {
  mode: PastMode;
  availableQuarters: string[];
  selectedQuarters: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const updateParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    next.set("view", "past");
    mutate(next);
    router.push(`${pathname}?${next.toString()}`);
  };

  const setMode = (nextMode: PastMode) => {
    updateParams((next) => {
      next.set("pastMode", nextMode);
      if (nextMode !== "weekly") {
        next.delete("pastQuarters");
      }
    });
  };

  const toggleQuarter = (quarter: string) => {
    updateParams((next) => {
      const current = new Set(
        (next.get("pastQuarters") ?? "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      );

      if (current.has(quarter)) current.delete(quarter);
      else current.add(quarter);

      if (!current.size || current.size === availableQuarters.length) {
        next.delete("pastQuarters");
      } else {
        next.set("pastQuarters", Array.from(current).sort((a, b) => a.localeCompare(b)).join(","));
      }
    });
  };

  const selectAll = () => {
    updateParams((next) => {
      next.delete("pastQuarters");
    });
  };

  return (
    <div className="mx-auto mb-4 flex max-w-[1400px] flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div>
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1">
          {(["quarterly", "weekly"] as PastMode[]).map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                mode === option
                  ? "bg-cyan-800 text-cyan-50"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {option === "quarterly" ? "Quarterly" : "Weekly"}
            </button>
          ))}
        </div>
      </div>

      {mode === "weekly" ? (
        <div className="max-w-[900px]">
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Quarters</p>
            <button
              onClick={selectAll}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              All
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableQuarters.map((quarter) => {
              const selected =
                !selectedQuarters.length || selectedQuarters.includes(quarter);
              return (
                <button
                  key={quarter}
                  onClick={() => toggleQuarter(quarter)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selected
                      ? "border-cyan-700 bg-cyan-900/60 text-cyan-100"
                      : "border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {formatQuarterDisplay(quarter, 3)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
