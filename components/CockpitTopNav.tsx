"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function CockpitTopNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const isHome = pathname === "/";
  const view = search.get("view") ?? "this-quarter";
  const sectorId = search.get("sectorId") ?? undefined;
  const serviceLineId = search.get("serviceLineId") ?? undefined;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold tracking-wide text-slate-100">
            <Image src="/logo.png" alt="COO Ops Cockpit" width={104} height={28} priority />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href={buildHomeHref("past", sectorId, serviceLineId)}
              className={`rounded px-3 py-1 text-sm ${isHome && view === "past" ? "bg-blue-900/50 text-blue-200" : "text-slate-300 hover:bg-slate-800"}`}
            >
              Past
            </Link>
            <Link
              href={buildHomeHref("this-quarter", sectorId, serviceLineId)}
              className={`rounded px-3 py-1 text-sm ${isHome && view === "this-quarter" ? "bg-blue-900/50 text-blue-200" : "text-slate-300 hover:bg-slate-800"}`}
            >
              Present
            </Link>
            <Link
              href={buildHomeHref("next-quarter", sectorId, serviceLineId)}
              className={`rounded px-3 py-1 text-sm ${isHome && view === "next-quarter" ? "bg-blue-900/50 text-blue-200" : "text-slate-300 hover:bg-slate-800"}`}
            >
              Future
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function buildHomeHref(
  view: "past" | "this-quarter" | "next-quarter",
  sectorId?: string,
  serviceLineId?: string,
): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (sectorId) params.set("sectorId", sectorId);
  if (serviceLineId) params.set("serviceLineId", serviceLineId);
  return `/?${params.toString()}`;
}
