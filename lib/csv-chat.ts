import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");

export type ChatTableName =
  | "targets"
  | "orders"
  | "forecast_daily"
  | "actual_daily"
  | "historical_quarterly"
  | "demand_weekly"
  | "demand_fulfillment";

type CsvRow = Record<string, string>;

type FilterOp = "eq" | "neq" | "contains" | "gt" | "gte" | "lt" | "lte";

export type TableFilter = {
  column: string;
  op: FilterOp;
  value: string | number;
};

export type TableAggregation = {
  func: "count" | "sum" | "avg" | "min" | "max";
  column?: string;
  as?: string;
};

export type QueryTableArgs = {
  table: ChatTableName;
  select?: string[];
  filters?: TableFilter[];
  groupBy?: string[];
  aggregations?: TableAggregation[];
  orderBy?: { column: string; direction?: "asc" | "desc" };
  limit?: number;
};

const TABLES: Record<
  ChatTableName,
  { fileName: string; description: string; grain: string }
> = {
  targets: {
    fileName: "targets_2026Q1_900M.csv",
    description: "Quarterly budget/target revenue by quarter, sector, service line, and account.",
    grain: "quarter_id + sector + service_line + account",
  },
  orders: {
    fileName: "sow_plan_orders.csv",
    description: "Sold/planned order movements in people by quarter horizons.",
    grain: "order_id",
  },
  forecast_daily: {
    fileName: "daily_forecast_ramp_2026Q1.csv",
    description: "Daily forecast ramp up/down people.",
    grain: "quarter_id + date + sector + service_line + account",
  },
  actual_daily: {
    fileName: "daily_actual_ramp_2026Q1.csv",
    description: "Daily actual ramp up/down people.",
    grain: "quarter_id + date + sector + service_line + account",
  },
  historical_quarterly: {
    fileName: "historical_quarterly_last8q.csv",
    description: "Historical quarter-end people and revenue for last 8 quarters.",
    grain: "quarter_id + sector + service_line + account",
  },
  demand_weekly: {
    fileName: "demand_weekly_positions.csv",
    description: "Weekly demand positions required/fulfilled/remaining.",
    grain: "demand_id + week_number",
  },
  demand_fulfillment: {
    fileName: "demand_fulfillment.csv",
    description: "Demand lifecycle and fulfillment cycle times.",
    grain: "demand_id",
  },
};

export async function listTables() {
  return (Object.keys(TABLES) as ChatTableName[]).map((name) => ({
    table: name,
    fileName: TABLES[name].fileName,
    description: TABLES[name].description,
    grain: TABLES[name].grain,
  }));
}

export async function describeTable(table: ChatTableName) {
  const meta = TABLES[table];
  const rows = await readCsv(meta.fileName);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return {
    table,
    fileName: meta.fileName,
    description: meta.description,
    grain: meta.grain,
    rowCount: rows.length,
    columns,
    sampleRows: rows.slice(0, 3),
  };
}

export async function queryTable(args: QueryTableArgs) {
  const meta = TABLES[args.table];
  const rows = await readCsv(meta.fileName);
  const filtered = applyFilters(rows, args.filters ?? []);
  const groupedOrFlat = args.groupBy?.length
    ? aggregateGrouped(filtered, args.groupBy, args.aggregations ?? [{ func: "count", as: "count" }])
    : aggregateFlatOrProject(filtered, args.select, args.aggregations);

  const sorted = applyOrderBy(groupedOrFlat, args.orderBy);
  const maxLimit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const outputRows = sorted.slice(0, maxLimit);

  return {
    table: args.table,
    fileName: meta.fileName,
    totalRows: rows.length,
    matchedRows: filtered.length,
    returnedRows: outputRows.length,
    rows: outputRows,
  };
}

function applyFilters(rows: CsvRow[], filters: TableFilter[]): CsvRow[] {
  if (!filters.length) return rows;
  return rows.filter((row) =>
    filters.every((filter) => {
      const left = row[filter.column];
      if (left == null) return false;
      return matchFilter(left, filter.op, filter.value);
    }),
  );
}

function matchFilter(leftRaw: string, op: FilterOp, rightRaw: string | number): boolean {
  const leftNum = Number(leftRaw);
  const rightNum = Number(rightRaw);
  const leftLower = leftRaw.toLowerCase();
  const rightLower = String(rightRaw).toLowerCase();
  const numeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);

  if (op === "eq") return leftLower === rightLower;
  if (op === "neq") return leftLower !== rightLower;
  if (op === "contains") return leftLower.includes(rightLower);
  if (numeric && op === "gt") return leftNum > rightNum;
  if (numeric && op === "gte") return leftNum >= rightNum;
  if (numeric && op === "lt") return leftNum < rightNum;
  if (numeric && op === "lte") return leftNum <= rightNum;
  return false;
}

function aggregateFlatOrProject(
  rows: CsvRow[],
  select: string[] | undefined,
  aggregations: TableAggregation[] | undefined,
): Array<Record<string, string | number>> {
  if (aggregations?.length) {
    return [computeAggregations(rows, aggregations)];
  }
  const columns = select?.length ? select : rows.length ? Object.keys(rows[0]) : [];
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of columns) out[col] = row[col] ?? "";
    return out;
  });
}

function aggregateGrouped(
  rows: CsvRow[],
  groupBy: string[],
  aggregations: TableAggregation[],
): Array<Record<string, string | number>> {
  const groups = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = groupBy.map((g) => row[g] ?? "").join("||");
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }

  return Array.from(groups.entries()).map(([key, groupRows]) => {
    const values = key.split("||");
    const out: Record<string, string | number> = {};
    groupBy.forEach((g, i) => {
      out[g] = values[i] ?? "";
    });
    const metrics = computeAggregations(groupRows, aggregations);
    return { ...out, ...metrics };
  });
}

function computeAggregations(rows: CsvRow[], aggregations: TableAggregation[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const agg of aggregations) {
    const alias = agg.as ?? `${agg.func}_${agg.column ?? "rows"}`;
    if (agg.func === "count") {
      out[alias] = rows.length;
      continue;
    }

    const values = rows
      .map((row) => Number(row[agg.column ?? ""]))
      .filter((n) => Number.isFinite(n));

    if (!values.length) {
      out[alias] = 0;
      continue;
    }

    if (agg.func === "sum") out[alias] = values.reduce((a, b) => a + b, 0);
    if (agg.func === "avg") out[alias] = values.reduce((a, b) => a + b, 0) / values.length;
    if (agg.func === "min") out[alias] = Math.min(...values);
    if (agg.func === "max") out[alias] = Math.max(...values);
  }
  return out;
}

function applyOrderBy(
  rows: Array<Record<string, string | number>>,
  orderBy?: { column: string; direction?: "asc" | "desc" },
): Array<Record<string, string | number>> {
  if (!orderBy) return rows;
  const direction = orderBy.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[orderBy.column];
    const bv = b[orderBy.column];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * direction;
    return String(av ?? "").localeCompare(String(bv ?? "")) * direction;
  });
}

async function readCsv(fileName: string): Promise<CsvRow[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
  const [headerLine, ...lines] = raw.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.filter(Boolean).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}
