# RAG Chat

> **Chat with your documents.** Upload a PDF, ask a question in plain English, get an answer grounded in the file — with citations, not hallucinations.

[![Live Demo](https://img.shields.io/badge/Live_Demo-rag--chat--sable.vercel.app-black?style=for-the-badge&logo=vercel)](https://rag-chat-sable.vercel.app)
[![Source](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/DeveloperJefremov/rag-chat)

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?logo=postgresql&logoColor=white)
![NextAuth](https://img.shields.io/badge/NextAuth-v5-green?logo=auth0&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)

---

## TL;DR

A production-style **Retrieval-Augmented Generation (RAG)** web app. Sign in with Google, upload your own PDF/DOCX/TXT files, and chat with them. The system finds the most relevant chunks of your documents on every question, feeds them to Gemini 2.5 Flash, and streams the answer back token-by-token with source citations.

Built **from scratch** as a portfolio project — no LangChain, no LlamaIndex, no hosted vector DB. The full RAG pipeline (chunking → embedding → vector search → reranking → streaming) is implemented end-to-end on top of Postgres and pgvector.

---

## Try it

**Live demo:** [https://rag-chat-sable.vercel.app](https://rag-chat-sable.vercel.app)

1. Sign in with Google
2. Upload a document on the **Documents** page (PDF, DOCX or TXT — up to 10 MB)
3. Open a chat, attach the document, ask a question
4. The answer streams in with a citation pointing back to the source file

Every user sees only their own data — sessions, documents and chunks are isolated at the database level.

---

## Engineering Highlights

- **Onion / Clean Architecture in TypeScript** — domain core has zero dependencies; application layer talks only to interfaces (ports); swapping LLM, embedder or DB is a one-line change in the DI container.
- **Full RAG pipeline written by hand** — no LangChain. Four chunking strategies (fixed-size, sentence, paragraph, semantic), pgvector cosine search, optional reranking (Cohere `rerank-v3.5` or local `bge-reranker-base`), augmented prompt construction.
- **Compile-time multi-tenant isolation** — every repository method requires `userId: string`. Forgetting it is a TypeScript error, not a security incident.
- **SSE streaming end-to-end** — Server-Sent Events stream Gemini tokens to the client as they're generated; citations arrive as the first event so the UI can render them before the answer finishes.
- **LLMOps observability** — per-query latency, prompt/completion tokens, estimated USD cost, citation flag, rerank flag and chunking strategy are logged for an admin dashboard.
- **Three-layer rate limiting** — per-IP (middleware), per-user daily quota (separate `UserUsage` table to avoid hot-row writes on `User`), and ownership filtering on every query.
- **GDPR-aware retention** — on account deletion, `LLMLog` rows are _anonymized_ (PII blanked, `userId` nulled) instead of cascaded, so aggregate analytics survive.

---

## Features

| For end users                       | For operators / admins             |
| ----------------------------------- | ---------------------------------- |
| Google OAuth sign-in                | Admin-only `/stats` dashboard      |
| Upload PDF, DOCX, TXT (≤ 10 MB)     | Per-query latency / tokens / cost  |
| Attach multiple docs to a session   | Role-based limits (USER vs ADMIN)  |
| Streaming answers with citations    | Per-IP and per-user rate limiting  |
| Persistent chat history per session | Audit trail via `LLMLog`           |
| 4 selectable chunking strategies    | Anonymized logs after user deletes |

---

## Tech Stack

| Layer          | Technology                                                                |
| -------------- | ------------------------------------------------------------------------- |
| Framework      | **Next.js 16** (App Router), **React 19**, **TypeScript 5.9**             |
| Styling        | **Tailwind CSS v4**, **shadcn/ui**, Radix primitives                      |
| Authentication | **NextAuth v5** (Auth.js) — Google provider, JWT sessions, Prisma adapter |
| ORM / DB       | **Prisma 7** + **PostgreSQL** (Neon serverless)                           |
| Vector storage | **pgvector** on the same Postgres — `vector(768)` + IVFFlat index         |
| Embeddings     | Google `gemini-embedding-001` via `@google/genai`                         |
| Reranking      | Cohere `rerank-v3.5` (cloud) or `Xenova/bge-reranker-base` (local)        |
| LLM            | **Gemini 2.5 Flash** — streaming responses                                |
| File parsing   | `pdf-parse` (PDF), `mammoth` (DOCX), built-in (TXT)                       |
| Client state   | **Zustand** — UI state only, no fetch logic                               |
| Forms          | `react-hook-form` + `zod` validation                                      |
| Rate limiting  | **Upstash Redis** + `@upstash/ratelimit` (sliding window)                 |
| Testing        | **Vitest** + `@testing-library/react`                                     |
| Quality        | ESLint, Prettier, Husky, lint-staged                                      |
| Deployment     | **Vercel** (app) + **Neon** (Postgres) — both serverless, free-tier       |

All AI services run on their free tiers.

---

## Architecture

The codebase follows **Onion Architecture**. Dependencies point inward — the domain core knows nothing about HTTP, Prisma, Google, or NextAuth.

```
┌────────────────────────────────────────────────────────────────┐
│  presentation/   React components, pages (Chat, Docs, Stats)   │
│       │                                                        │
│  client/         API clients (I*Api), services, Zustand stores │
│       │                                                        │
│  app/api/        Next.js route handlers (HTTP boundary)        │
│       │                                                        │
│  server/                                                       │
│    infrastructure/  Prisma, Google GenAI, Cohere, NextAuth     │
│       │             ─ implements the ports below                │
│    application/     IngestionService, RetrievalService,        │
│       │             SessionService, LLMOpsService              │
│       │             + ports: ILLMClient, IEmbeddingClient,     │
│       │               IRerankClient, IFileParser, IAuthContext │
│  domain/         Entities, value objects, ChunkingService      │
│                  ─ pure TypeScript, zero dependencies          │
└────────────────────────────────────────────────────────────────┘
```

**The dependency rule:** `presentation → client → application ← infrastructure`. Application code references only interfaces. Concrete implementations are wired in **one file** — [`server/infrastructure/http/container.ts`](server/infrastructure/http/container.ts) — so swapping Gemini for Claude, or pgvector for Pinecone, touches a single line.

The client mirrors the same discipline:

- **Stores** (`client/stores/*`) hold UI state only — no `fetch`, no `FormData`, no SSE parsing.
- **API clients** (`client/infrastructure/http/*Api.ts`) implement `I*Api` interfaces and own all HTTP.
- **Services** (`client/application/services/*Service.ts`) orchestrate flows via callbacks; they don't know Zustand exists.

---

## How RAG Works Here

### Ingestion pipeline

```
POST /api/ingest  (multipart: file + sessionId + chunkingStrategy)
       │
       ▼
  authContext.requireUser()          ← 401 if not signed in
       │
       ▼
  validate ownership of session       ← 404 if not the owner
       │
       ▼
  enforce maxDocumentsPerSession       ← 403 if limit reached
       │
       ▼
  IFileParser.parse(buffer)            ← PDF / DOCX / TXT → text
       │
       ▼
  ChunkingService.chunk(text, strategy)  ← fixed / sentence / paragraph / semantic
       │
       ▼
  IEmbeddingClient.embedBatch(chunks)    ← Google text-embedding (768d)
       │
       ▼
  save Document + Chunks (userId denormalized for fast filtering)
```

### Retrieval & chat pipeline (SSE)

```
POST /api/chat  { message, sessionId, documentId, topK, rerankingEnabled }
       │
       ▼
  authContext.requireUser()                    ← 401
       │
       ▼
  SessionService.validateLimit(user.id, role)  ← 403 if daily quota hit
       │
       ▼
  IEmbeddingClient.embed(message)              ← query → 768d vector
       │
       ▼
  IChunkRepository.similaritySearch({          ← pgvector cosine, scoped by userId
    queryVector, documentId, userId, topK*4
  })
       │
       ▼
  IRerankClient.rerank(query, candidates, topN)  ← Cohere / local
       │
       ▼
  yield { sources: CitationDto[] }              ← first SSE event
       │
       ▼
  buildAugmentedPrompt(rerankedChunks, message, history)
       │
       ▼
  ILLMClient.streamMessage(prompt)              ← Gemini 2.5 Flash, streamed
       │
       ▼
  SessionService.incrementUsage(user.id)        ← UserUsage upsert
  MessageRepository.saveMany([userMsg, assistantMsg])
  LLMOpsService.log(...)                        ← fire-and-forget metrics
```

The two-stage **retrieve → rerank** pattern matters: the embedding model is fast and recall-friendly but coarse, so we over-fetch (`topK * 4` candidates), then a cross-encoder reranker re-scores those candidates against the actual query to surface the truly relevant ones.

---

## Engineering Deep-Dive

### Multi-tenant isolation enforced by the type system

Every repository method takes `userId: string` as a **required** parameter, and every Prisma query includes `WHERE userId = ?` (or joins through a parent that carries it). The patterns:

- `ChatSession` and `Document` carry `userId` directly.
- `Chunk` is joined through `document.userId` — and `Document.userId` is **denormalized** to avoid a join on the hot vector-search path.
- `Message` is joined through `session.userId`.

A developer who forgets the `userId` argument gets a TypeScript error. A cross-tenant data leak would require deliberately bypassing both the type signature and the SQL `WHERE` clause.

### Role-based limits as configuration, not code

```ts
LIMITS_BY_ROLE.USER  = { queriesPerDay: 100,      maxDocumentsPerSession: 5,  maxChatSessions: 10 };
LIMITS_BY_ROLE.ADMIN = { queriesPerDay: Infinity, maxDocumentsPerSession: ∞,  maxChatSessions: ∞  };
```

Services look up the limit by `user.role`, never hardcode it. Adding a new tier (e.g. `PRO`) is a config edit.

### Daily usage counter on its own table

`UserUsage(userId, date) @unique` records query counts per user per day, isolated from the hot `User` row. Daily quota check is one indexed lookup; usage increment is one upsert. The `User` row stays cold and never gets contention from quota updates.

### Observability without blocking the user

`LLMOpsService.log()` is invoked fire-and-forget (`void this.llmOpsService.log(...)`) so the chat stream never waits on metrics. The `LLMLog` table records latency, token counts, estimated cost, citation/rerank flags, and chunking strategy — enough to detect regressions and price the product.

Cost estimates use pay-as-you-go rates even on the free tier, so the dashboard reflects what production would cost:

```
embeddingCost   = (promptTokens / 1e6) * $0.01
geminiInputCost = (promptTokens / 1e6) * $0.075
geminiOutputCost = (completionTokens / 1e6) * $0.30
```

### GDPR-aware retention

`LLMLog` deliberately has **no foreign keys** to `User`, `ChatSession`, or `Document`. When a user deletes their account:

- Their sessions, documents, chunks and messages cascade-delete (`onDelete: Cascade`).
- Their `LLMLog` rows are **anonymized**, not deleted: `userId` nulled, `query`/`response` blanked, `anonymizedAt` set.
- Aggregate per-user totals are frozen into a `DeletedUserAudit` row before the user disappears.

The result: PII is removed on request, but aggregate platform analytics remain consistent across time.

### Three-layer rate limiting

1. **IP-level** — 60 req/min per IP in `middleware.ts` (also protects `/api/auth/*` from credential-stuffing).
2. **Per-user daily quota** — `SessionService.validateLimit(userId, role)`; returns `403 limit_reached`.
3. **Ownership filter** — `WHERE userId = ?` on every query is the third line of defense if the first two fail.

---

## Getting Started

```bash
git clone https://github.com/DeveloperJefremov/rag-chat
cd rag-chat
npm install

cp .env.example .env.local    # fill in the values below

npx prisma migrate dev         # creates schema + runs pgvector setup
npm run dev                    # http://localhost:3000
```

### Required environment variables

```env
DATABASE_URL=postgresql://...        # Neon pooled connection
DIRECT_URL=postgresql://...          # Neon direct connection (migrations)
GOOGLE_AI_KEY=...                    # aistudio.google.com
COHERE_API_KEY=...                   # dashboard.cohere.com (optional if using local reranker)
AUTH_SECRET=...                      # openssl rand -base64 32
AUTH_GOOGLE_ID=...                   # Google Cloud Console OAuth client
AUTH_GOOGLE_SECRET=...
NEXTAUTH_URL=http://localhost:3000   # production URL when deployed
```

### Useful commands

```bash
npm run dev          # start dev server
npm run typecheck    # tsc --noEmit
npm run test         # vitest
npm run lint         # eslint
npm run ci           # typecheck + format + lint + test (run before pushing)
```

---

## Project Structure

```
domain/                    Pure business types (User, Document, Chunk, …) + ChunkingService
server/
  application/             IngestionService, RetrievalService, SessionService, LLMOpsService
    repositories/          I*Repository interfaces (ports)
    ports/                 ILLMClient, IEmbeddingClient, IRerankClient, IFileParser, IAuthContext
  infrastructure/          Prisma repos, Google/Cohere clients, NextAuthContext, DI container
client/
  application/             API client interfaces + orchestration services
  infrastructure/http/     Concrete fetch / SSE implementations
  stores/                  Zustand stores (UI state only)
presentation/web/          Layout, pages, feature components
app/                       Next.js routes — pages + /api handlers
prisma/                    schema.prisma + migrations
shared/                    DTOs, config (limits, constants), small utilities
```

For a thorough technical walkthrough (in Russian) see [`docs/PROJECT_GUIDE.md`](docs/PROJECT_GUIDE.md). The full design spec and implementation plan live in [`docs/`](docs/).

---

## Roadmap & Known Limitations

- **IVFFlat index tuning** — currently `lists = 10`, sized for a few thousand chunks. Will need `lists ≈ sqrt(rows)` rebuild past ~10k chunks.
- **Session TTL cleanup** — schema supports `expiresAt`; a cron job to actually delete expired sessions is on the list.
- **No multi-document cross-querying yet** — chat is currently scoped to one attached document per question; multi-doc fan-out is the next milestone.
- **Embeddings are not re-used across sessions** — if the same file is uploaded twice it's re-embedded. A content-hash dedupe layer is the easy win.

---

## Author

**Artjoms Jefremovs**
[developerjefremov@gmail.com](mailto:developerjefremov@gmail.com) · [GitHub](https://github.com/DeveloperJefremov)

Built as a portfolio project to demonstrate full-stack TypeScript, Clean Architecture, and applied LLM engineering. Open to opportunities — feel free to reach out.
