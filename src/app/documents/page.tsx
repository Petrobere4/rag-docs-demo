"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DocItem = {
  id: string;
  title: string;
  source_type?: string;
  created_at?: string;
};

export default function DocumentsPage() {
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_DOCS = 20;
  const [file, setFile] = useState<File | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function loadDocs() {
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocs(Array.isArray(data?.documents) ? data.documents : []);
  }

  useEffect(() => {
    loadDocs().catch(() => {});
  }, []);

  async function onUpload() {
  if (!file) return;

  if (docs.length >= MAX_DOCS) {
    setMsg(`Limit reached: max ${MAX_DOCS} documents. Delete something first.`);
    return;
  }

  if (file.size > MAX_FILE_BYTES) {
    setMsg(`File too large. Max ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)}MB.`);
    return;
  }

  setLoading(true);
  setMsg("");

  try {
    const form = new FormData();
    form.append("file", file);
    form.append("title", file.name);

    const res = await fetch("/api/ingest", { method: "POST", body: form });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Upload failed (${res.status})`);
    }

    setMsg("Uploaded ✅ Now ingesting/chunking may take a moment.");
    setFile(null);
    await loadDocs();
  } catch (e: unknown) {
    setMsg(e instanceof Error ? e.message : "Upload error");
  } finally {
    setLoading(false);
  }
}

  async function onDelete(id: string) {
    const ok = confirm("Delete this document? Chunks will be removed too.");
    if (!ok) return;

    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Delete failed (${res.status})`);
      }
      await loadDocs();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete error");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="font-semibold">RAG Docs Demo</div>
          <nav className="flex gap-4 text-sm">
            <Link className="hover:underline" href="/">
              Chat
            </Link>
            <Link className="hover:underline" href="/documents">
              Documents
            </Link>
            <Link className="hover:underline" href="/logs">
              Logs
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Upload a file and it will be stored + indexed for chat.
        </p>

        <div className="mt-6 rounded-xl border bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
             type="file"
             accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
             onChange={(e) => setFile(e.target.files?.[0] ?? null)}
             className="text-sm"
             />
            <button
             onClick={onUpload}
             disabled={!file || loading || docs.length >= MAX_DOCS}
             className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
             {loading ? "Uploading..." : "Upload"}
            </button>

          </div>

          {msg && (
            <div className="mt-3 rounded-lg border bg-zinc-50 px-3 py-2 text-sm">
              {msg}
            </div>
          )}
        </div>

        <div className="mt-8">
          <div className="text-sm font-semibold">Uploaded documents</div>
          <div className="mt-3 space-y-2">
            {docs.length === 0 ? (
              <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600">
                No documents yet. Upload one to start.
              </div>
            ) : (
              docs.map((d) => (
                <div key={d.id} className="rounded-lg border bg-white p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{d.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        id: {d.id}
                        {d.source_type ? ` • source: ${d.source_type}` : ""}
                        {d.created_at
                          ? ` • ${new Date(d.created_at).toLocaleString()}`
                          : ""}
                      </div>
                    </div>

                    <button
                      onClick={() => onDelete(d.id)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
