import { quarterFromDate, todayDate, toISODate } from "@/lib/date";
import { buildDashboardModel, parseFilters } from "@/lib/metrics";

export function getDashboard(searchParams: Record<string, string | string[] | undefined>) {
  const today = todayDate();
  const defaultQuarter = quarterFromDate(today);
  const filters = parseFilters(searchParams, defaultQuarter);
  const model = buildDashboardModel(filters, toISODate(today));
  const options = {
    quarters: [filters.quarter],
    sectors: model.dataset.sectors,
    serviceLines: model.dataset.serviceLines,
    sdlus: [...new Set(model.dataset.accounts.map((a) => a.sdluId))].sort(),
    accounts: model.dataset.accounts.map((a) => ({ id: a.id, name: a.name })),
  };
  return { model, options };
}
