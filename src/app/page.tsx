"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ChatSource = {
  title?: string;
  chunk_id?: string;
  document_id?: string;
  score?: number;
  snippet?: string;
};

type ChatResponse = {
  answer: string;
  sources?: ChatSource[];
  latency_ms?: number;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [error, setError] = useState<string>("");

  const canSend = useMemo(() => question.trim().length > 0 && !loading, [question, loading]);

  async function onAsk() {
    setLoading(true);
    setError("");
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as ChatResponse;
      setAnswer(data.answer || "");
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="font-semibold">RAG Docs Demo</div>
          <nav className="flex gap-4 text-sm">
            <Link className="hover:underline" href="/">Chat</Link>
            <Link className="hover:underline" href="/documents">Documents</Link>
            <Link className="hover:underline" href="/logs">Logs</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Chat with your docs</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ask a question — the answer should include sources from your uploaded docs.
        </p>

        <div className="mt-6 rounded-xl border bg-white p-4">
          <label className="text-sm font-medium">Question</label>
          <textarea
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring"
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., What is the refund policy mentioned in the docs?"
          />

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={onAsk}
              disabled={!canSend}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Asking..." : "Ask"}
            </button>
            <span className="text-xs text-zinc-500">
              Tip: upload a PDF/text in Documents first.
            </span>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {answer && (
            <div className="mt-6">
              <div className="text-sm font-semibold">Answer</div>
              <div className="mt-2 whitespace-pre-wrap rounded-lg border bg-zinc-50 p-3 text-sm">
                {answer}
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="mt-6">
              <div className="text-sm font-semibold">Sources</div>
              <ul className="mt-2 space-y-2">
                {sources.map((s, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium">
                        {s.title || "Untitled document"}
                      </div>
                      {typeof s.score === "number" && (
                        <div className="text-xs text-zinc-500">score: {s.score.toFixed(3)}</div>
                      )}
                    </div>
                    {(s.snippet || s.chunk_id || s.document_id) && (
                      <div className="mt-1 text-xs text-zinc-600">
                        {s.snippet ? <div className="italic">{s.snippet}</div> : null}
                        <div className="mt-1">
                          {s.document_id ? <>doc: {s.document_id} </> : null}
                          {s.chunk_id ? <>chunk: {s.chunk_id}</> : null}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
