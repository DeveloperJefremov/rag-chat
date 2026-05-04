@AGENTS.md

# CLAUDE.md — RAG Chat

Universal RAG chat application with authentication. Users sign in with Google, upload
documents (PDF, TXT, DOCX), and chat with them — questions are answered by Gemini 2.5 Flash
grounded strictly in the uploaded documents. Built as a portfolio/interview project
demonstrating full RAG pipeline, Onion Architecture, LLMOps observability, and ownership-based
multi-user isolation.

---

## Stack

| Layer          | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| Framework      | Next.js 16, React 19, TypeScript                            |
| Styling        | Tailwind CSS v4, shadcn/ui                                  |
| Auth           | NextAuth v5 (Auth.js) with Google provider + Prisma adapter |
| ORM            | Prisma 7 + PostgreSQL (Neon)                                |
| Vector storage | pgvector on Neon — `vector(768)`                            |
| Embeddings     | Google `text-embedding-004` via `@google/generative-ai`     |
| Reranking      | Cohere `rerank-v3.5` via `cohere-ai`                        |
| LLM            | Gemini 2.5 Flash via `@google/generative-ai`                |
| File parsing   | `pdf-parse` (PDF), `mammoth` (DOCX), built-in (TXT)         |
| State          | Zustand                                                     |
| Testing        | Vitest + @testing-library/react                             |
| Deploy         | Vercel monolith + Neon PostgreSQL                           |

All external AI services use free tiers.

---

## Architecture

Onion Architecture. Dependency rule: `presentation → client → domain ← server-application ← server-infrastructure`.

```
domain/
  entities/         User.ts, ChatSession.ts, Document.ts, Chunk.ts,
                    Message.ts, LLMLog.ts, UserUsage.ts
  value-objects/    FileType.ts, ChunkingStrategy.ts
  services/         ChunkingService.ts, SimilarityService.ts

server/
  application/
    repositories/   IUserRepository.ts, IChatSessionRepository.ts,
                    IDocumentRepository.ts, IChunkRepository.ts,
                    IMessageRepository.ts, ILLMLogRepository.ts,
                    IUserUsageRepository.ts
    ports/          ILLMClient.ts, IEmbeddingClient.ts, IRerankClient.ts,
                    IFileParser.ts, IAuthContext.ts
    ingestion/      IngestionService.ts
    retrieval/      RetrievalService.ts
    session/        SessionService.ts       ← handles ChatSession + UserUsage limits
    llmops/         LLMOpsService.ts
  infrastructure/
    prisma-orm/     Prisma*Repository.ts
    google/         GoogleEmbeddingClient.ts, GeminiClient.ts
    cohere/         CohereRerankClient.ts
    parsers/        PdfParser.ts, TxtParser.ts, DocxParser.ts
    auth/           NextAuthContext.ts       ← implements IAuthContext
    http/           container.ts

client/
  application/
    api/            ISessionApi.ts, IIngestionApi.ts, IChatApi.ts, ILLMOpsApi.ts
    services/       ChatSessionService.ts, IngestionClientService.ts
  infrastructure/
    http/           SessionApi.ts, IngestionApi.ts, ChatApi.ts, LLMOpsApi.ts
    container.ts
  stores/           sessionStore.ts, uploadStore.ts, chatStore.ts  ← UI state ONLY

presentation/
  web/
    layout/         Sidebar/, AppLayout/
    pages/          Chat/, Documents/, Stats/, SignIn/
    components/     MessageList/, MessageInput/, FileDropzone/,
                    LimitBadge/, UploadProgress/, UserMenu/

app/
  page.tsx                      ← Chat UI
  documents/page.tsx            ← Documents (ingestion)
  stats/page.tsx                ← LLMOps dashboard (admin only)
  signin/page.tsx               ← Google OAuth entry
  layout.tsx                    ← wraps children with NextAuth SessionProvider
  api/
    auth/[...nextauth]/route.ts ← NextAuth handlers
    chat/route.ts               ← SSE streaming
    ingest/route.ts             ← multipart file upload
    session/route.ts            ← create/get ChatSession
    llmops/route.ts             ← aggregate stats (admin)

auth.ts                         ← NextAuth config (top-level, imported by routes + middleware)
middleware.ts                   ← auth gate + IP rate limit

shared/
  dtos/             ChatRequestDto.ts, ChatResponseDto.ts, IngestResponseDto.ts,
                    MessageDto.ts, SessionDto.ts, CitationDto.ts
  lib/              utils.ts, rateLimit.ts
  config/           constants.ts, limits.ts
```

---

## Authentication & Authorization

**NextAuth v5 with Google provider + Prisma adapter**, JWT session strategy.

- `auth.ts` at project root exports `auth`, `handlers`, `signIn`, `signOut`.
- JWT contains `userId` and `role` (`USER` | `ADMIN`) — populated from DB on sign-in.
- `session.user.role` is typed via module augmentation.
- `middleware.ts` redirects unauthenticated UI traffic to `/signin`, applies IP rate limit to `/api/*`.
- API routes call `authContext.requireUser()` / `requireAdmin()` at the top.

### `IAuthContext` port

The application layer doesn't know NextAuth exists. It uses:

```ts
export interface IAuthContext {
	getUser(): Promise<AuthenticatedUser | null>;
	requireUser(): Promise<AuthenticatedUser>; // throws 'unauthenticated'
	requireAdmin(): Promise<AuthenticatedUser>; // throws 'forbidden'
}
```

`NextAuthContext` implements it by calling `auth()` from NextAuth.

### Roles & limits

Roles stored on `User.role`. First sign-in → `USER`. Promotion to admin is a manual
DB operation:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

User must re-login for the new role to reach their JWT.

Limits live in `shared/config/limits.ts` — looked up by role, never hardcoded in services:

```ts
export const LIMITS_BY_ROLE: Record<UserRole, RoleLimits> = {
	USER: { queriesPerDay: 100, maxDocumentsPerSession: 5, maxChatSessions: 10 },
	ADMIN: {
		queriesPerDay: Infinity,
		maxDocumentsPerSession: Infinity,
		maxChatSessions: Infinity,
	},
};
```

### Ownership enforcement (critical)

Every repository method touching user data takes `userId` as a **required** parameter.
Omitting it is a compile error. All Prisma queries include `WHERE userId = ?` (or join
through a parent that carries `userId`). Attempts to access another user's data return
`null` or `404`, never a silent leak.

Patterns:

- `ChatSession`, `Document` → direct `userId` column
- `Chunk` → joined via `document.userId`
- `Message` → joined via `session.userId`

---

## Server Port Interfaces

```ts
ILLMClient.streamMessage(prompt): AsyncGenerator<string>
IEmbeddingClient.{embed, embedBatch}
IRerankClient.rerank({ query, candidates, topN })
IFileParser.parse(buffer): Promise<string>
IAuthContext.{getUser, requireUser, requireAdmin}
```

Concrete implementations live in `server/infrastructure/` and implement these interfaces.
Swapping any provider only touches `container.ts`.

---

## Client Architecture

Mirrors server. Three strict layers:

- **Stores** = UI state only. No `fetch`, no SSE parsing, no `FormData`.
- **HTTP** = `client/infrastructure/http/*Api.ts` implements `I*Api` interfaces.
- **Orchestration** = `client/application/services/*Service.ts`, Zustand-unaware, uses callbacks.

UI components never call `fetch` directly. They read stores and either call store actions
or import an API client for read-only data (e.g. `llmOpsApi.getStats()` in `StatsPage`).

---

## Data Model

See design doc for full Prisma schema. Key points:

- **`User`** owns everything. `role: UserRole @default(USER)`.
- **`Account`, `AuthSession`, `VerificationToken`** — NextAuth's tables via Prisma adapter.
  `AuthSession` is renamed from NextAuth's default `Session` to avoid colliding with our domain `ChatSession`.
- **`ChatSession`** (was `Session`) — one chat thread + its documents. Has `userId` FK.
- **`Document.userId`** is denormalized for fast ownership filtering without a join.
- **`Chunk.embedding`** is `vector(768)` — Google text-embedding-004 dimension.
- **`UserUsage(userId, date) @unique`** — per-day query counter, isolated from hot `User` rows.
- **`LLMLog`** has `userId`, `sessionId`, `documentId` but NO FKs — logs survive deletion of
  the referenced sessions/documents. On account deletion the row is **anonymized**, not
  deleted: `userId` is nulled, `query`/`response` are blanked, `anonymizedAt` is set. Per-query
  observability (latency, tokens, cost, citation/rerank flags, chunking strategy) is preserved
  for the LLMOps dashboard; PII is removed.
- **`ChunkingStrategy`** is an enum everywhere (was `String` in `LLMLog` — fixed).
- **All relations** use `onDelete: Cascade`.

### Indexes (every hot-path query is covered)

- `User.email @unique` — OAuth lookup
- `Account(provider, providerAccountId) @unique` — NextAuth adapter
- `ChatSession(userId, createdAt)` — user's chat list newest first
- `ChatSession(expiresAt)` — future cleanup cron
- `Document(sessionId)` — list documents in a session
- `Document(userId, createdAt)` — all user's documents (Documents page)
- `Chunk(documentId)` — filter before vector search
- `Message(sessionId, createdAt)` — ordered chat history
- `UserUsage(userId, date) @unique` — upsert today's counter
- `LLMLog(createdAt)` — `getRecent(limit)` for dashboard
- `LLMLog(userId, createdAt)` — per-user analytics

pgvector index (manual, `Unsupported` type):

```sql
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

`lists ≈ sqrt(total_rows)`; bump up once chunk count grows past a few thousand.

---

## Core Pipelines

### Ingestion

```
POST /api/ingest (multipart: file, sessionId, chunkingStrategy?, chunkSize?, overlap?)
  → authContext.requireUser()                              ← 401 if missing
  → validate session ownership (session.userId === user.id)
  → check docs-per-session limit (LIMITS_BY_ROLE[user.role].maxDocumentsPerSession)
  → validate type + size (max 10MB)
  → IFileParser.parse(buffer)
  → ChunkingService.chunk(text, strategy)
  → IEmbeddingClient.embedBatch(chunks)
  → save Document + Chunks (with userId denormalized on Document)
  → return { documentId, chunkCount }
```

### RAG Chat (SSE streaming)

```
POST /api/chat { message, sessionId, documentId, chunkingStrategy?, topK?, rerankingEnabled? }
  → authContext.requireUser()                              ← 401 if missing
  → SessionService.validateLimit(user.id, user.role)       ← 403 if queries >= daily limit
  → chatSessionRepo.findById(sessionId, user.id)           ← 404 if not owner
  → IEmbeddingClient.embed(message)
  → IChunkRepository.similaritySearch({ queryVector, documentId, userId, topK*4 })
  → IRerankClient.rerank(query, candidates, topN=topK)
  → yield { sources: CitationDto[] }                       ← first SSE event
  → buildAugmentedPrompt(rerankedChunks, message, history)
  → ILLMClient.streamMessage(prompt)                       ← yield text chunks
  → SessionService.incrementUsage(user.id)                 ← UserUsage upsert
  → MessageRepository.saveMany([userMsg, assistantMsg])
  → LLMOpsService.log(...)                                 ← fire-and-forget
```

### Session Lifecycle

ChatSession is created on demand when user first uploads a document or sends a first message:

```
GET /api/session  → list user's ChatSessions
POST /api/session → create new ChatSession (respects maxChatSessions limit)
```

---

## Constants & Limits

`shared/config/constants.ts`:

```ts
SESSION_TTL_HOURS = 24;
CHUNK_SIZE = 512;
CHUNK_OVERLAP = 50;
TOP_K_CHUNKS = 5;
MAX_FILE_SIZE_MB = 10;
IP_RATE_LIMIT_RPM = 60;
```

`shared/config/limits.ts`:

```ts
LIMITS_BY_ROLE.USER = {
	queriesPerDay: 100,
	maxDocumentsPerSession: 5,
	maxChatSessions: 10,
};
LIMITS_BY_ROLE.ADMIN = {
	queriesPerDay: Infinity,
	maxDocumentsPerSession: Infinity,
	maxChatSessions: Infinity,
};
```

---

## Rate Limiting — Three layers

1. **Per-user daily quota** — `UserUsage` table; `SessionService.validateLimit(userId, role)`
   reads the limit from `LIMITS_BY_ROLE`. Quota exceeded → `403 limit_reached`.
2. **Ownership enforcement** — required `userId` on every repository method; `WHERE userId = ?` in SQL.
3. **IP rate limit** — 60 req/min per IP in `middleware.ts`. Also protects `/api/auth/*`.

---

## LLMOps

Every RAG query logs: `userId`, `sessionId`, `documentId`, `query`, `response`, `latencyMs`,
`promptTokens`, `completionTokens`, `estimatedCostUsd`, `hasCitation`, `rerankingUsed`,
`chunkingStrategy`, `createdAt`.

`GET /api/llmops` is **admin-only** (`authContext.requireAdmin()`). Returns totals and
per-query log entries. Client reads stats via `ILLMOpsApi.getStats()` — no raw fetch.

`LLMOpsService` is called fire-and-forget from `RetrievalService` — never blocks the stream.

Cost estimation (at pay-as-you-go rates even on free tier):

```ts
embeddingCost = (promptTokens / 1e6) * 0.01;
geminiInputCost = (promptTokens / 1e6) * 0.075;
geminiOutputCost = (completionTokens / 1e6) * 0.3;
```

---

## Environment Variables

```
DATABASE_URL        — Neon pooled connection
DIRECT_URL          — Neon direct connection (migrations)
GOOGLE_AI_KEY       — aistudio.google.com
COHERE_API_KEY      — dashboard.cohere.com
AUTH_SECRET         — openssl rand -base64 32
AUTH_GOOGLE_ID      — Google Cloud Console OAuth client ID
AUTH_GOOGLE_SECRET  — Google Cloud Console OAuth client secret
NEXTAUTH_URL        — production URL (optional on Vercel, required self-hosted)
```

Google OAuth redirect URIs:

- `http://localhost:3000/api/auth/callback/google` (dev)
- `https://<your-vercel-url>/api/auth/callback/google` (prod)

---

## Common Commands

```bash
npm run dev
npx tsc --noEmit
npx vitest run
npx prisma migrate dev
npx prisma migrate deploy
npx prisma studio
openssl rand -base64 32           # generate AUTH_SECRET
```

---

## Key Decisions & Constraints

- **Auth: NextAuth v5 JWT strategy** — Google provider + Prisma adapter. Role baked into
  JWT at sign-in; re-login required after promotion to admin.
- **IAuthContext port** — application layer doesn't know NextAuth exists.
- **Ownership via required `userId`** on every repository method — compile-time enforcement
  against cross-user data access.
- **Role-based limits via `LIMITS_BY_ROLE`** — adding a new role is a config change, not a code change.
- **`UserUsage` separate table** — daily counter without writing to `User` on every query.
- **`Document.userId` denormalized** — avoids a join on the hot filter path.
- **`LLMLog` has no FKs** — logs survive deletion of session/document. On account deletion
  the row is anonymized (PII blanked, `userId` nulled, `anonymizedAt` set), not deleted.
  Aggregate per-user totals at deletion time are preserved in `DeletedUserAudit`.
- **`AuthSession` renamed** from NextAuth's default `Session` — avoids clash with `ChatSession`.
- **Admin-only routes**: `/api/llmops`, `/stats` page.
- **Server port interfaces** — `ILLMClient`, `IEmbeddingClient`, `IRerankClient`, `IFileParser`,
  `IAuthContext`. Concrete impls in `server/infrastructure/`.
- **Client mirrors server** — `I*Api` interfaces, `*Api` implementations, `*Service` orchestration,
  thin Zustand stores with UI state only.
- **No `fetch` in stores or UI components** — all HTTP via `client/infrastructure/http/`.
- **Core pipeline is self-written** — no LangChain/LlamaIndex.
- **pgvector on Neon** — no separate vector DB service.
- **`vector(768)`** — Google text-embedding-004 output dimension. Never 1024.
- **`ChunkingStrategy` is an enum everywhere** — including `LLMLog.chunkingStrategy` (was `String`, fixed).
- **All relations `onDelete: Cascade`** — deleting a user wipes their sessions, documents, chunks, messages.
- **LLMOps fire-and-forget** — `void this.llmOpsService.log(...)`.
