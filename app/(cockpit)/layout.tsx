import type { ReactNode } from "react";
import { CockpitTopNav } from "@/components/CockpitTopNav";

export const dynamic = "force-dynamic";

export default function CockpitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <CockpitTopNav />
      {children}
    </div>
  );
}
