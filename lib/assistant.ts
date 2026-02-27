import type { AssistantResponse } from "@/lib/models";
import type { DashboardModel } from "@/lib/metrics";
import { formatCurrency, formatNumber, formatPct } from "@/lib/metrics";

const intents: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: "target",
    patterns: [/meet.*target/i, /will we meet/i, /revenue target/i],
  },
  {
    id: "diagnostics",
    patterns: [/why/i, /gap/i, /sold.*actual/i, /2\.1|2\.2|2\.3|2\.4|2\.5|2\.6|2\.7|2\.8|2\.9|3\.0/i],
  },
  {
    id: "planning",
    patterns: [/next quarter/i, /forecast/i, /ru|rd/i],
  },
  {
    id: "actions",
    patterns: [/action/i, /what should/i, /levers/i, /what-if/i],
  },
  {
    id: "ttf",
    patterns: [/ttf/i, /skill/i, /breach/i, /within time/i],
  },
];

export function assistantAnswer(question: string, model: DashboardModel): AssistantResponse {
  const q = question.trim();
  const intent = classifyIntent(q);
  const topAction = model.actions[0];

  if (intent === "target") {
    return {
      intent,
      shortAnswer: model.shouldMeetTarget
        ? `Yes, forecast is ${formatCurrency(model.kpis.forecastRevenueUsd)} vs target ${formatCurrency(model.kpis.targetRevenueUsd)}.`
        : `Not yet. Forecast is ${formatCurrency(model.kpis.forecastRevenueUsd)} vs target ${formatCurrency(model.kpis.targetRevenueUsd)} (${formatCurrency(model.kpis.gapToTargetUsd)} gap).`,
      explanation: [
        `QTD actual revenue is ${formatCurrency(model.kpis.qtdActualRevenueUsd)} and linear extrapolation gives ${formatCurrency(model.kpis.forecastRevenueUsd)}.`,
        `Actual BPM (Net) QTD is ${formatNumber(model.kpis.actualBpmNetQtd)} against sold BPM ${formatNumber(model.kpis.soldBpm)}.`,
        `Demand open BPM is ${formatNumber(model.kpis.demandOpenBpm)} with AXNB count ${model.kpis.axnbCount}.`,
      ],
      nextClicks: [
        { label: "Open diagnostics", href: "/diagnostics" },
        { label: "Review top accounts", href: "/accounts?metric=revenueGap" },
      ],
      recommendedActions: model.actions.slice(0, 2).map((a) => a.title),
    };
  }

  if (intent === "planning") {
    return {
      intent,
      shortAnswer: `Next quarter base forecast: ${formatCurrency(model.planning.revenueForecast)} revenue, ${formatNumber(model.planning.bpmForecast)} BPM, RU ${formatNumber(model.planning.ruForecast)}, RD ${formatNumber(model.planning.rdForecast)}.`,
      explanation: [
        "Model uses quarter exit run-rate, known ramp-downs from end dates, and ramp-ups from scheduled open demands.",
        `Pipeline conversion assumption is ${formatPct(model.planning.byScenario.find((x) => x.scenario === "base") ? 100 : 0)} baseline by service line configuration.`,
        "Use conservative/base/aggressive scenario toggle for sensitivity.",
      ],
      nextClicks: [
        { label: "Open planning", href: "/planning" },
        { label: "Run what-if", href: "/actions" },
      ],
      recommendedActions: ["Increase conversion on top at-risk service lines", "Smooth planned ramp-down exits"],
    };
  }

  if (intent === "ttf") {
    const topSkill = model.diagnosticRows.ttfBySkill[0];
    return {
      intent,
      shortAnswer: `Top delayed skill is ${topSkill?.skill ?? "N/A"} with ${formatPct(topSkill?.breachPct ?? 0)} breaches and ${formatCurrency(topSkill?.revImpact ?? 0)} revenue impact.`,
      explanation: [
        `Average TTF is ${formatNumber(model.kpis.avgTtfDays)} days; breach threshold is service-line average + 7 days.`,
        `${formatPct(model.kpis.ttfBreachedPct)} of current demands are breaching benchmark.`,
        "Breach concentration is tracked by service line and skill for direct staffing actions.",
      ],
      nextClicks: [
        { label: "TTF diagnostics", href: "/diagnostics#ttf" },
        { label: "Skill slice", href: "/slices" },
      ],
      recommendedActions: model.actions.filter((a) => a.track === "bpm").slice(0, 2).map((a) => a.title),
    };
  }

  if (intent === "actions") {
    return {
      intent,
      shortAnswer: `Top lever: ${topAction?.title ?? "No action"} with estimated uplift ${formatCurrency(topAction?.estimatedUpliftRevenueUsd ?? 0)} (${formatNumber(topAction?.estimatedUpliftBpm ?? 0)} BPM).`,
      explanation: model.actions.slice(0, 4).map((a) => `${a.title}: ${a.rationale}`),
      nextClicks: [
        { label: "Action center", href: "/actions" },
        { label: "AXNB aging", href: "/diagnostics#axnb" },
      ],
      recommendedActions: model.actions.slice(0, 3).map((a) => a.title),
    };
  }

  return {
    intent: "diagnostics",
    shortAnswer: `Primary gap chain: target vs forecast gap ${formatCurrency(model.kpis.gapToTargetUsd)}, sold BPM vs actual BPM gap ${formatNumber(model.kpis.soldBpm - model.kpis.actualBpmNetQtd)}.`,
    explanation: [
      "2.1 Target vs sold gap is visible in target/sold/actual table.",
      "2.2 Sold vs actual QTD depends on demand creation and AXNB conversion.",
      "2.3/2.4 BPM gap tracks RU/RD and pace-based forecast.",
      "2.5/2.6 Demand sufficiency checks shortfall BPM and booking coverage.",
      "2.7/2.8 Fulfillment and AXNB stages show where leakage occurs.",
      "2.9/3.0 TTF section highlights delayed skills by BPM and revenue impact.",
    ],
    nextClicks: [
      { label: "Open diagnostics", href: "/diagnostics" },
      { label: "Account drilldown", href: "/accounts" },
    ],
    recommendedActions: model.actions.slice(0, 3).map((a) => a.title),
  };
}

function classifyIntent(question: string): string {
  for (const intent of intents) {
    if (intent.patterns.some((p) => p.test(question))) return intent.id;
  }
  return "diagnostics";
}
