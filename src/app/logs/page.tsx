"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LogItem = {
  id: string;
  question: string;
  answer: string;
  latency_ms?: number;
  created_at?: string;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [error, setError] = useState("");

  async function loadLogs() {
    setError("");
    const res = await fetch("/api/logs");
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    const data = await res.json();
    setLogs(Array.isArray(data?.logs) ? data.logs : []);
  }

  useEffect(() => {
    loadLogs().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Unknown error");
    });
  }, []);

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
        <h1 className="text-2xl font-semibold">Logs</h1>
        <p className="mt-1 text-sm text-zinc-600">Recent questions/answers saved to the database.</p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {logs.length === 0 ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600">
              No logs yet. Ask something in Chat.
            </div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">Q:</div>
                  <div className="text-xs text-zinc-500">
                    {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                    {typeof l.latency_ms === "number" ? ` • ${l.latency_ms}ms` : ""}
                  </div>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm">{l.question}</div>

                <div className="mt-3 text-sm font-semibold">A:</div>
                <div className="mt-1 whitespace-pre-wrap rounded-lg border bg-zinc-50 p-3 text-sm">
                  {l.answer}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
