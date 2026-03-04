import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCsvQuarterOverview } from "@/lib/csv-quarter";
import {
  describeTable,
  listTables,
  queryTable,
  type ChatTableName,
  type QueryTableArgs,
} from "@/lib/csv-chat";

type Body = {
  question?: string;
  query?: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
};

type LeadershipChatResponse = {
  summary: string;
  concerns: string[];
  answer: string;
  answerBullets: string[];
};

type AzureOpenAiConfig = {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const params = new URLSearchParams(body.query ?? "");
  const sectorId = params.get("sectorId") ?? undefined;
  const serviceLineId = params.get("serviceLineId") ?? undefined;
  const question = (body.question ?? "").trim() || "summary";
  const history = body.history ?? [];

  const [dataDefinition, overview, tables] = await Promise.all([
    readDataDefinition(),
    getCsvQuarterOverview({ sectorId, serviceLineId }),
    listTables(),
  ]);

  const concerns = [
    `Revenue gap vs budget: ${formatSignedCurrency(overview.revenue.actual - overview.revenue.target)} (QTD through ${overview.assumptions.asOfDate}).`,
    `Revenue gap vs forecast: ${formatSignedCurrency(overview.revenue.actual - overview.revenue.forecast)}.`,
    `Net BPM growth gap vs budget: ${formatSignedNumber(overview.kpis.netBpmActual - overview.kpis.netBpmTarget)}.`,
    `RU/RD balance: actual RU ${formatNumber(overview.kpis.ruBpmActual)} vs actual RD ${formatNumber(overview.kpis.rdBpmActual)}.`,
  ];
  const summary = `Leadership focus for ${overview.quarter}`;

  const fallbackAnswer = buildFallbackAnswer(question, overview);
  const fallbackBullets = buildFallbackBullets(summary, question, overview, concerns);
  const azureConfig = getAzureOpenAiConfig();

  if (!azureConfig) {
    return NextResponse.json(
      buildResponsePayload(summary, concerns, fallbackAnswer, fallbackBullets),
    );
  }

  const generatedQuery = await generateQueryWithLlm({
    config: azureConfig,
    question,
    history,
    dataDefinition,
    tables,
    sectorId,
    serviceLineId,
  });

  let queryResult:
    | {
        query: QueryTableArgs;
        data: Awaited<ReturnType<typeof queryTable>>;
      }
    | undefined;

  if (generatedQuery) {
    const sanitized = await sanitizeQuery(generatedQuery);
    if (sanitized) {
      const scopedQuery = enforceDashboardFilters(sanitized, sectorId, serviceLineId);
      const data = await queryTable(scopedQuery);
      queryResult = { query: scopedQuery, data };
    }
  }

  const answer = await answerWithLlm({
    config: azureConfig,
    question,
    history,
    overview,
    concerns,
    dataDefinition,
    queryResult,
    fallbackAnswer,
  });
  const answerBullets = formatAnswerAsBullets(answer, fallbackBullets);

  return NextResponse.json(
    buildResponsePayload(summary, concerns, answer, answerBullets),
  );
}

async function generateQueryWithLlm(input: {
  config: AzureOpenAiConfig;
  question: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  dataDefinition: string;
  tables: Awaited<ReturnType<typeof listTables>>;
  sectorId?: string;
  serviceLineId?: string;
}): Promise<QueryTableArgs | null> {
  const historyText = input.history
    .slice(-6)
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");
  const tableCatalog = input.tables
    .map((t) => `- ${t.table}: ${t.fileName} (${t.grain})`)
    .join("\n");

  const prompt = [
    "Convert the user question into one JSON query object for CSV analytics.",
    "Return JSON only. No markdown.",
    "Schema:",
    '{"table":"targets|orders|forecast_daily|actual_daily|historical_quarterly|demand_weekly|demand_fulfillment","select":["col"],"filters":[{"column":"name","op":"eq|neq|contains|gt|gte|lt|lte","value":"x"}],"groupBy":["col"],"aggregations":[{"func":"count|sum|avg|min|max","column":"col","as":"alias"}],"orderBy":{"column":"name","direction":"asc|desc"},"limit":25}',
    "Rules:",
    "- Pick one table only.",
    "- Use exact column names from the chosen table.",
    "- Prefer aggregation for totals/trends.",
    "- Keep limit <= 50.",
    `Dashboard scope sector: ${input.sectorId ?? "ALL"}`,
    `Dashboard scope service_line: ${input.serviceLineId ?? "ALL"}`,
    "",
    "Available tables:",
    tableCatalog,
    "",
    "Data definitions:",
    input.dataDefinition || "Not available.",
    "",
    "Recent history:",
    historyText || "none",
    "",
    "User question:",
    input.question,
  ].join("\n");

  const raw = await chatCompletion(input.config, [
    {
      role: "system",
      content:
        "You are a strict query planner for CSV analytics. Output must be valid JSON and only JSON.",
    },
    { role: "user", content: prompt },
  ], 350);

  if (!raw) return null;
  const parsed = tryParseJsonObject(raw);
  if (!parsed || typeof parsed !== "object") return null;
  return parsed as QueryTableArgs;
}

async function answerWithLlm(input: {
  config: AzureOpenAiConfig;
  question: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  overview: Awaited<ReturnType<typeof getCsvQuarterOverview>>;
  concerns: string[];
  dataDefinition: string;
  queryResult?:
    | {
        query: QueryTableArgs;
        data: Awaited<ReturnType<typeof queryTable>>;
      }
    | undefined;
  fallbackAnswer: string;
}): Promise<string> {
  const historyText = input.history
    .slice(-6)
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");

  const prompt = [
    "Answer the question in natural language using the provided query output and dashboard snapshot.",
    "Respond as exactly 5 or 6 concise bullet points.",
    "Each bullet must be one line, start with '- ', and include concrete metrics where relevant.",
    "Do not add headings, intro text, outro text, or paragraphs outside the bullets.",
    "Mention filters/time windows when relevant.",
    "If query output is missing or insufficient, say so and use fallback.",
    "",
    `Question: ${input.question}`,
    "",
    "Dashboard snapshot:",
    `Quarter: ${input.overview.quarter}`,
    `As of: ${input.overview.assumptions.asOfDate}`,
    `Revenue budget: ${formatCurrency(input.overview.revenue.target)}`,
    `Revenue forecast: ${formatCurrency(input.overview.revenue.forecast)}`,
    `Revenue actual QTD: ${formatCurrency(input.overview.revenue.actual)}`,
    `BPM budget: ${formatNumber(input.overview.bpm.target)}`,
    `BPM actual QTD: ${formatNumber(input.overview.bpm.actual)}`,
    `Net BPM budget: ${formatNumber(input.overview.kpis.netBpmTarget)}`,
    `Net BPM actual QTD: ${formatNumber(input.overview.kpis.netBpmActual)}`,
    "",
    "Leadership concerns:",
    ...input.concerns,
    "",
    "Data definition reference:",
    input.dataDefinition || "Not available.",
    "",
    "Generated query:",
    input.queryResult ? JSON.stringify(input.queryResult.query) : "No query generated.",
    "",
    "Query result:",
    input.queryResult ? JSON.stringify(input.queryResult.data) : "No data returned.",
    "",
    "Recent history:",
    historyText || "none",
    "",
    `Fallback answer: ${input.fallbackAnswer}`,
  ].join("\n");

  const raw = await chatCompletion(input.config, [
    {
      role: "system",
      content:
        "You are a COO data copilot. Provide concise, accurate answers grounded in the supplied data only.",
    },
    { role: "user", content: prompt },
  ], 500);

  return raw?.trim() || input.fallbackAnswer;
}

function buildResponsePayload(
  summary: string,
  concerns: string[],
  answer: string,
  answerBullets: string[],
): LeadershipChatResponse {
  return {
    summary,
    concerns,
    answer,
    answerBullets,
  };
}

async function chatCompletion(
  config: AzureOpenAiConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
  maxTokens: number,
): Promise<string | null> {
  const endpoint = config.endpoint.replace(/\/+$/, "");
  const url = `${endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify({
        messages,
        // o-series deployments (like o4-mini) expect max_completion_tokens.
        max_completion_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Azure OpenAI chat completion failed", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });
      return null;
    }
    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?:
            | string
            | Array<{ type?: string; text?: string }>;
        };
      }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const combined = content
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
      return combined || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function sanitizeQuery(raw: QueryTableArgs): Promise<QueryTableArgs | null> {
  if (!raw || !isTableName(raw.table)) return null;
  const desc = await describeTable(raw.table);
  const columns = new Set(desc.columns);

  const select = (raw.select ?? []).filter((c) => columns.has(c));
  const groupBy = (raw.groupBy ?? []).filter((c) => columns.has(c));
  const filters = (raw.filters ?? []).filter(
    (f) =>
      columns.has(f.column) &&
      ["eq", "neq", "contains", "gt", "gte", "lt", "lte"].includes(f.op) &&
      (typeof f.value === "string" || typeof f.value === "number"),
  );
  const aggregations = (raw.aggregations ?? []).filter((a) => {
    if (!["count", "sum", "avg", "min", "max"].includes(a.func)) return false;
    if (a.func === "count") return true;
    return !!a.column && columns.has(a.column);
  });

  const sanitized: QueryTableArgs = {
    table: raw.table,
    select: select.length ? select : undefined,
    filters: filters.length ? filters : undefined,
    groupBy: groupBy.length ? groupBy : undefined,
    aggregations: aggregations.length ? aggregations : undefined,
    orderBy: raw.orderBy?.column ? raw.orderBy : undefined,
    limit: Math.min(Math.max(raw.limit ?? 25, 1), 50),
  };

  if (!sanitized.select && !sanitized.groupBy && !sanitized.aggregations) {
    sanitized.select = desc.columns.slice(0, 8);
  }

  return sanitized;
}

function enforceDashboardFilters(
  query: QueryTableArgs,
  sectorId?: string,
  serviceLineId?: string,
): QueryTableArgs {
  const filters = [...(query.filters ?? [])];
  if (sectorId && !filters.some((f) => f.column === "sector" && f.op === "eq")) {
    filters.push({ column: "sector", op: "eq", value: sectorId });
  }
  if (
    serviceLineId &&
    !filters.some((f) => f.column === "service_line" && f.op === "eq")
  ) {
    filters.push({ column: "service_line", op: "eq", value: serviceLineId });
  }
  return { ...query, filters };
}

function isTableName(value: unknown): value is ChatTableName {
  return (
    value === "targets" ||
    value === "orders" ||
    value === "forecast_daily" ||
    value === "actual_daily" ||
    value === "historical_quarterly" ||
    value === "demand_weekly" ||
    value === "demand_fulfillment"
  );
}

function tryParseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // continue
    }
  }

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function buildFallbackAnswer(
  question: string,
  overview: Awaited<ReturnType<typeof getCsvQuarterOverview>>,
): string {
  const q = question.toLowerCase();
  if (q.includes("revenue")) {
    return `Revenue actual QTD is ${formatCurrency(overview.revenue.actual)} vs budget ${formatCurrency(overview.revenue.target)} and forecast ${formatCurrency(overview.revenue.forecast)}.`;
  }
  if (q.includes("net bpm") || q.includes("growth")) {
    return `Net BPM actual QTD is ${formatNumber(overview.kpis.netBpmActual)} vs budget ${formatNumber(overview.kpis.netBpmTarget)} and forecast ${formatNumber(overview.kpis.netBpmBudget)}.`;
  }
  if (q.includes("ru") || q.includes("ramp up")) {
    return `RU BPM actual QTD is ${formatNumber(overview.kpis.ruBpmActual)} vs budget ${formatNumber(overview.kpis.ruBpmTarget)} and forecast ${formatNumber(overview.kpis.ruBpmBudget)}.`;
  }
  if (q.includes("rd") || q.includes("ramp down")) {
    return `RD BPM actual QTD is ${formatNumber(overview.kpis.rdBpmActual)} vs budget ${formatNumber(overview.kpis.rdBpmTarget)} and forecast ${formatNumber(overview.kpis.rdBpmBudget)}.`;
  }
  return `Current status: revenue ${formatCurrency(overview.revenue.actual)} actual QTD, BPM ${formatNumber(overview.bpm.actual)} actual QTD, Net BPM ${formatNumber(overview.kpis.netBpmActual)} actual QTD.`;
}

function buildFallbackBullets(
  summary: string,
  question: string,
  overview: Awaited<ReturnType<typeof getCsvQuarterOverview>>,
  concerns: string[],
): string[] {
  const focus = question.trim().toLowerCase() === "summary"
    ? "Current operating snapshot"
    : `Question focus: ${question.trim()}`;

  return [
    `${summary}. ${focus}.`,
    `Revenue actual QTD is ${formatCurrency(overview.revenue.actual)} against budget ${formatCurrency(overview.revenue.target)} and forecast ${formatCurrency(overview.revenue.forecast)}.`,
    `BPM actual QTD is ${formatNumber(overview.bpm.actual)} and Net BPM actual QTD is ${formatNumber(overview.kpis.netBpmActual)} versus budget ${formatNumber(overview.kpis.netBpmTarget)}.`,
    concerns[0],
    concerns[2],
    concerns[3],
  ].slice(0, 6);
}

function formatAnswerAsBullets(raw: string, fallbackBullets: string[]): string[] {
  const normalized = raw
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .flatMap((line) => {
      if (!line) return [];
      if (/^[-*•]\s+/.test(line)) return [stripBulletPrefix(line)];
      return splitIntoSentences(line);
    })
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const unique = dedupeBullets(normalized);
  if (unique.length >= 5) {
    return unique.slice(0, 6);
  }

  return dedupeBullets([...unique, ...fallbackBullets]).slice(0, 6);
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^[-*•]\s+/, "").trim();
}

function splitIntoSentences(line: string): string[] {
  const parts = line.match(/[^.!?]+[.!?]?/g) ?? [line];
  return parts.map((part) => part.trim()).filter(Boolean);
}

function dedupeBullets(items: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

async function readDataDefinition(): Promise<string> {
  const filePath = path.join(process.cwd(), "data", "data-definition.md");
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function getAzureOpenAiConfig(): AzureOpenAiConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";

  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, deployment, apiVersion };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatSignedCurrency(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function formatSignedNumber(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;
}
