import { AssistantPanel } from "@/components/AssistantPanel";
import { GlobalFilters } from "@/components/GlobalFilters";
import { Sidebar } from "@/components/Sidebar";
import type { ReactNode } from "react";

export function AppShell({
  children,
  context,
}: {
  children: ReactNode;
  context: {
    refreshed: string;
    quarters: string[];
    sectors: Array<{ id: string; name: string }>;
    serviceLines: Array<{ id: string; name: string }>;
    sdlus: string[];
    accounts: Array<{ id: string; name: string }>;
  };
}) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">COO Ops Cockpit</h1>
          <p className="text-xs text-slate-500">Last refreshed: {context.refreshed}</p>
        </div>
        <GlobalFilters
          quarters={context.quarters}
          sectors={context.sectors}
          serviceLines={context.serviceLines}
          sdlus={context.sdlus}
          accounts={context.accounts}
        />
        <div className="mt-4">{children}</div>
      </main>
      <AssistantPanel />
    </div>
  );
}
