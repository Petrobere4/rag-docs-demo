import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES ?? 2 * 1024 * 1024); // 2MB default
const MAX_DOCS = Number(process.env.MAX_DOCS ?? 20);

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
]);

function chunkTextLocal(
  text: string,
  opts?: { maxChars?: number; overlap?: number }
) {
  const maxChars = opts?.maxChars ?? 900;
  const overlap = opts?.overlap ?? 120;

  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const parts = clean.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);

  const chunks: string[] = [];
  let buf = "";

  const pushBuf = () => {
    const c = buf.trim();
    if (c) chunks.push(c);
    buf = "";
  };

  for (const p of parts) {
    if (p.length > maxChars) {
      pushBuf();
      const step = Math.max(1, maxChars - overlap);
      for (let i = 0; i < p.length; i += step) {
        chunks.push(p.slice(i, i + maxChars));
      }
      continue;
    }

    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length <= maxChars) {
      buf = candidate;
    } else {
      pushBuf();
      buf = p;
    }
  }
  pushBuf();

  return chunks.slice(0, 200);
}

function hasPdfMagic(buf: Buffer) {
  
  return buf.length >= 5 && buf.subarray(0, 5).toString("utf-8") === "%PDF-";
}

function looksLikePdf(file: File, buf: Buffer) {
  const name = (file.name ?? "").toLowerCase();
  return (
    file.type === "application/pdf" ||
    name.endsWith(".pdf") ||
    hasPdfMagic(buf)
  );
}

async function extractTextFromUpload(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());

  const name = (file.name ?? "").toLowerCase();
  const looksPdf = looksLikePdf(file, buf);

  const looksText =
    file.type === "text/plain" ||
    file.type === "text/markdown" ||
    name.endsWith(".txt") ||
    name.endsWith(".md");

  if (!looksPdf && !looksText) {
    return { ok: false as const, error: "Only .txt, .md, or .pdf files are allowed." };
  }

  if (looksPdf) {
    // PDF -> text
    const pdfParseMod: any = await import("pdf-parse");
    const pdfParse = pdfParseMod.default ?? pdfParseMod;

    const parsed = await pdfParse(buf);
    const text = String(parsed?.text ?? "").trim();

    if (!text) {
      return {
        ok: false as const,
        error:
          "PDF has no extractable text (maybe scanned images). Please upload a text-based PDF or use OCR.",
      };
    }

    return { ok: true as const, text };
  }

  // txt/md -> utf8
  const text = buf.toString("utf-8").trim();
  if (!text) return { ok: false as const, error: "Empty file" };
  return { ok: true as const, text };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const seenTitle = form.get("title");
  const title = z.string().min(1).parse(seenTitle ?? "Untitled");

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach .txt, .md, or .pdf file" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB.` },
      { status: 413 }
    );
  }

  const extracted = await extractTextFromUpload(file);
  if (!extracted.ok) {
    return NextResponse.json({ error: extracted.error }, { status: 400 });
  }

  const { count, error: countErr } = await supabaseAdmin
    .from("documents")
    .select("*", { count: "exact", head: true });

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  if ((count ?? 0) >= MAX_DOCS) {
    return NextResponse.json(
      { error: `Documents limit reached (${MAX_DOCS}). Delete something first.` },
      { status: 429 }
    );
  }

  const { data: doc, error: docErr } = await supabaseAdmin
    .from("documents")
    .insert({ title, source_type: "upload" })
    .select("*")
    .single();

  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

  const chunks = chunkTextLocal(extracted.text, { maxChars: 800, overlap: 120 });
  if (!chunks.length) {
    return NextResponse.json({ error: "No chunks produced" }, { status: 500 });
  }

  const emb = await openai.embeddings.create({
    model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
    input: chunks,
  });

  const rows = chunks.map((content, idx) => ({
    document_id: doc.id,
    content,
    metadata: { chunk_index: idx, title, file_name: file.name, file_type: file.type },
    embedding: emb.data[idx].embedding,
  }));

  const { error: chErr } = await supabaseAdmin.from("chunks").insert(rows);
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, document_id: doc.id, chunks: rows.length });
}
