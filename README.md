# RAG Docs Demo — Chat With Your Documents (Next.js + Supabase)

A lightweight RAG (Retrieval-Augmented Generation) demo app that lets you upload documents, index them into chunks + embeddings, and ask questions with **source-backed answers**.

## What it does

- Upload documents (e.g. `.txt`, `.md`, optionally `.pdf`)
- Server-side ingestion:
  - text extraction
  - chunking
  - embeddings generation
  - store in Supabase Postgres
- Chat endpoint:
  - semantic search over chunks
  - builds an answer with citations (sources)
- Admin UI:
  - **Documents** page: upload + list + delete documents
  - **Logs** page: stores recent Q/A with latency + top sources

## Tech stack

- **Next.js (App Router) + TypeScript**
- **Supabase** (Postgres + Storage optional)
- **OpenAI API** (embeddings + chat)
- Minimal UI (simple admin-style pages)

---

## Getting started (local)

### 1) Install
```bash
