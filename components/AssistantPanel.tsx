"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Reply = {
  shortAnswer: string;
  explanation: string[];
  nextClicks: { label: string; href: string }[];
  recommendedActions: string[];
};

const prompts = [
  "Will we meet revenue target?",
  "Why are we behind sold BPM?",
  "Do we have enough demand to close shortfall?",
  "Which skills are breaching TTF?",
  "What should I do this week?",
];

export function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [loading, setLoading] = useState(false);
  const search = useSearchParams();
  const query = useMemo(() => search.toString(), [search]);

  const ask = async (q: string) => {
    setLoading(true);
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q, query }),
    });
    const data = (await res.json()) as Reply;
    setReply(data);
    setLoading(false);
  };

  return (
    <aside className="w-84 shrink-0 border-l border-slate-700 bg-slate-900 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">COO Assistant</p>
      <p className="mt-2 text-sm text-slate-300">Rule-based guidance from current metrics and contributors.</p>

      <div className="mt-3 space-y-2">
        {prompts.map((p) => (
          <button key={p} onClick={() => ask(p)} className="block w-full rounded border border-slate-600 px-2 py-1 text-left text-xs text-slate-300 hover:bg-slate-800">
            {p}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded border border-slate-600 px-2 py-2 text-sm"
          placeholder="Ask about target, BPM, demand, TTF..."
        />
        <button
          className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-60"
          disabled={loading || !question.trim()}
          onClick={() => ask(question)}
        >
          Ask
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm">
        {loading ? (
          <p className="text-slate-500">Computing answer...</p>
        ) : reply ? (
          <div className="space-y-2">
            <p className="font-semibold text-slate-100">{reply.shortAnswer}</p>
            <ul className="list-disc pl-4 text-slate-300">
              {reply.explanation.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested next clicks</p>
            <div className="space-y-1">
              {reply.nextClicks.map((n) => (
                <Link key={n.href + n.label} className="block text-xs text-blue-300 hover:underline" href={n.href}>
                  {n.label}
                </Link>
              ))}
            </div>
            <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended actions</p>
            <ul className="list-disc pl-4 text-slate-300">
              {reply.recommendedActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-slate-500">Ask a question to get a concise diagnostic answer with direct drill links.</p>
        )}
      </div>
    </aside>
  );
}
