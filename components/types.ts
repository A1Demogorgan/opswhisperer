import type { DashboardModel } from "@/lib/metrics";

export type ShellContext = {
  model: DashboardModel;
  options: {
    quarters: string[];
    sectors: Array<{ id: string; name: string }>;
    serviceLines: Array<{ id: string; name: string }>;
    sdlus: string[];
    accounts: Array<{ id: string; name: string }>;
  };
};
