import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";
const Body = z.object({ question: z.string().min(2) });

export async function POST(req: Request) {
  const t0 = Date.now();
  const { question } = Body.parse(await req.json());

  const qEmb = await openai.embeddings.create({
    model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
    input: question,
  });

  const { data: matches, error } = await supabaseAdmin.rpc("match_chunks", {
    query_embedding: qEmb.data[0].embedding,
    match_count: 10,
    similarity_threshold: 0.0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sources = (matches ?? []).map((m: any) => ({
  chunk_id: m.id,
  document_id: m.document_id,
  title: m.title ?? m.metadata?.title ?? "Untitled",
  snippet: String(m.content).slice(0, 1500),
  score: m.similarity,          
  similarity: m.similarity,     
}));


  if (!sources.length) {
    const answer =
      "I can’t find that in the provided documents. Please upload relevant docs or ask a different question.";
    await supabaseAdmin.from("queries").insert({
      question,
      answer,
      top_sources: sources,
      latency_ms: Date.now() - t0,
    });
    return NextResponse.json({ answer, sources });
  }

  type Source = { snippet: string; title?: string; url?: string };

const context = (sources as Source[])
  .map((s, i) => `Source ${i + 1}:\n${s.snippet}\n`)
  .join("\n");


  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Answer ONLY using the provided sources. If not in sources, say you cannot find it in the documents. End with 'Sources: Source 1, Source 2...' based on what you used.",
      },
      { role: "user", content: `Question: ${question}\n\n${context}` },
    ],
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "No answer";

  await supabaseAdmin.from("queries").insert({
    question,
    answer,
    top_sources: sources,
    latency_ms: Date.now() - t0,
  });

  return NextResponse.json({ answer, sources });
}
