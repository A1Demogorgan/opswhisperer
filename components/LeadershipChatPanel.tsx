"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type LeadershipReply = {
  summary: string;
  concerns: string[];
  answer: string;
};

type Message = {
  role: "assistant" | "user";
  text: string;
};

export function LeadershipChatPanel() {
  const search = useSearchParams();
  const query = useMemo(() => search.toString(), [search]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    const nextMessages = [...messages, { role: "user" as const, text: trimmed }];
    setMessages(nextMessages);
    setLoading(true);
    const res = await fetch("/api/leadership-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: trimmed, query, history: nextMessages }),
    });
    const data = (await res.json()) as LeadershipReply;
    setConcerns(data.concerns);
    setMessages((prev) => [...prev, { role: "assistant", text: data.answer }]);
    setLoading(false);
    setQuestion("");
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/leadership-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "summary", query, history: [] }),
      });
      const data = (await res.json()) as LeadershipReply;
      if (cancelled) return;
      setConcerns(data.concerns);
      setMessages([{ role: "assistant", text: `${data.summary}\n\n${data.answer}` }]);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  return (
    <>
      {open ? (
        <aside className="fixed bottom-24 right-6 z-40 flex h-[70vh] w-[380px] flex-col rounded-xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Leadership Narrative</p>
              <p className="mt-1 text-sm text-slate-200">Always-on gap briefing and Q&A.</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Key Gaps</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
              {concerns.length ? concerns.map((item) => <li key={item}>{item}</li>) : <li>Loading current gap narrative...</li>}
            </ul>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[95%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "border border-slate-700 bg-slate-800 text-slate-100"
                    : "ml-auto bg-blue-700/80 text-white"
                }`}
              >
                {message.text}
              </div>
            ))}
            {loading ? <p className="text-xs text-slate-400">Thinking...</p> : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-800 px-4 py-3">
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ask(question);
                }}
                placeholder="Ask about revenue, BPM, RU/RD, or growth risk..."
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <button
                onClick={() => ask(question)}
                disabled={loading || !question.trim()}
                className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      <button
        onClick={() => setOpen(true)}
        aria-label="Open leadership chat"
        title="Open leadership chat"
        className="fixed bottom-6 right-6 z-40 rounded-full border border-cyan-700 bg-cyan-900/90 p-3 text-cyan-100 shadow-lg hover:bg-cyan-800"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-6 w-6"
        >
          <path d="M8 10h8M8 14h5" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M12 3c4.97 0 9 3.36 9 7.5 0 2.13-1.07 4.05-2.79 5.42-.55.44-.9 1.09-.9 1.8V21l-3.27-1.64a2.3 2.3 0 0 0-1.79-.1c-.73.22-1.5.34-2.25.34-4.97 0-9-3.36-9-7.5S5.03 3 10 3h2Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}
