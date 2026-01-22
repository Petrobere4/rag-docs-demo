import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const title = file.name || "Untitled";
  const text = await file.text();

  const { data: doc, error: docErr } = await supabaseAdmin
    .from("documents")
    .insert({ title, source_type: "upload" })
    .select()
    .single();

  if (docErr) {
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  const ingestUrl = new URL("/api/ingest", req.url);
  const ingestRes = await fetch(ingestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: doc.id, text }),
  });

  if (!ingestRes.ok) {
    const errText = await ingestRes.text();
    return NextResponse.json(
      { error: "Ingest failed", details: errText },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, document: doc });
}
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    
    const { error: rpcErr } = await supabaseAdmin.rpc("delete_queries_for_document", {
      doc_id: id,
    });
    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    const { error: docErr } = await supabaseAdmin.from("documents").delete().eq("id", id);
    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 500 }
    );
  }
}

