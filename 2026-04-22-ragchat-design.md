# RAG Chat — Design Spec

**Date:** 2026-04-22  
**Status:** Approved

---

## Context

Universal RAG chat application. Users upload documents (PDF, TXT, DOCX), which are chunked, embedded, and stored in a vector database. Users then ask questions in a chat interface and receive answers grounded in their uploaded documents — not hallucinated from model weights.

Key constraints:

- **Core pipeline self-written** (the valuable part): ingestion, chunking, embeddings, retrieval, reranking, prompt assembly
- LangChain/LlamaIndex optional as orchestration layer on top — not in core
- Architecture mirrors [tense-master](https://github.com/Wolferner/tense-master): Onion Architecture, Next.js monolith
- Anonymous sessions (no auth)
- 20 queries per session + IP rate limiting
- **LLMOps** built in: logging, latency, cost-per-request, answer evaluation

---

## Stack

| Layer          | Technology                                                      |
| -------------- | --------------------------------------------------------------- |
| Framework      | Next.js 16, React 19, TypeScript                                |
| Styling        | Tailwind CSS v4, shadcn/ui                                      |
| ORM            | Prisma 7 + PostgreSQL (Neon)                                    |
| Vector storage | pgvector extension on Neon                                      |
| Embeddings     | Google `text-embedding-004` (768 dims) — free                   |
| Reranking      | Cohere Rerank API (`rerank-v3.5`) — free tier                   |
| LLM            | Google Gemini 2.5 Flash via `@google/generative-ai` — free tier |
| File parsing   | `pdf-parse`, `mammoth` (DOCX), built-in (TXT)                   |
| State          | Zustand (client)                                                |
| Testing        | Vitest + @testing-library/react                                 |
| Linting        | ESLint + Prettier + Husky                                       |

---

## Architecture

Onion Architecture adapted for fullstack Next.js (same as tense-master).

**Dependency rule:** `presentation → client → domain ← server`

```
domain/
  entities/         Document.ts, Chunk.ts, Message.ts, Session.ts, LLMLog.ts
  value-objects/    FileType.ts (PDF | TXT | DOCX), ChunkingStrategy.ts
  services/         ChunkingService.ts (multi-strategy), SimilarityService.ts

server/
  application/
    ingestion/      IngestionService.ts
    retrieval/      RetrievalService.ts
    session/        SessionService.ts
    repositories/   IDocumentRepository.ts, IChunkRepository.ts
                    IMessageRepository.ts, ISessionRepository.ts
  infrastructure/
    http/           IngestionController.ts, ChatController.ts
    prisma-orm/     PrismaDocumentRepository.ts, PrismaChunkRepository.ts
                    PrismaMessageRepository.ts, PrismaSessionRepository.ts
                    PrismaLLMLogRepository.ts, prismaClient.ts
    google/         GoogleEmbeddingClient.ts, GeminiClient.ts
    cohere/         CohereRerankClient.ts
    parsers/        PdfParser.ts, TxtParser.ts, DocxParser.ts

client/
  application/
    api/            IChatApi.ts, IIngestionApi.ts
    services/       ChatSessionService.ts
  stores/           chatStore.ts, uploadStore.ts, sessionStore.ts
  infrastructure/
    http/           ChatApi.ts, IngestionApi.ts
    container.ts

presentation/
  web/
    pages/          Chat/, Upload/
    components/     MessageList/, MessageInput/, FileDropzone/
                    LimitBadge/, UploadProgress/

app/
  api/
    chat/           route.ts        ← SSE streaming
    ingest/         route.ts        ← multipart file upload
    session/        route.ts        ← create / get session
  page.tsx                          ← main chat UI
  layout.tsx

shared/
  dtos/             ChatRequestDto.ts, ChatResponseDto.ts
                    IngestResponseDto.ts, MessageDto.ts, SessionDto.ts
  lib/              utils.ts, rateLimit.ts
  config/           constants.ts
```

---

## Data Model

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "prisma/generated/prisma"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id            String        @id @default(uuid())
  email         String        @unique
  name          String?
  image         String?
  role          UserRole      @default(USER)
  emailVerified DateTime?
  createdAt     DateTime      @default(now())

  chatSessions  ChatSession[]
  accounts      Account[]
  authSessions  AuthSession[]

  @@map("users")
}

// NextAuth models (standard Auth.js / @auth/prisma-adapter shape)
model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("accounts")
}

model AuthSession {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("auth_sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ChatSession = the user's conversation + its uploaded documents.
// A single User can have many ChatSessions (one per topic, like ChatGPT chats).
model ChatSession {
  id         String     @id @default(uuid())
  title      String?
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt  DateTime   @default(now())
  expiresAt  DateTime
  messages   Message[]
  documents  Document[]

  @@index([userId, createdAt])
  @@index([expiresAt])
  @@map("chat_sessions")
}

model Document {
  id               String           @id @default(uuid())
  name             String
  fileType         FileType
  chunkingStrategy ChunkingStrategy
  userId           String           // denormalized for ownership filtering without a join
  sessionId        String
  session          ChatSession      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt        DateTime         @default(now())
  chunks           Chunk[]

  @@index([sessionId])
  @@index([userId, createdAt])
  @@map("documents")
}

model Chunk {
  id         String                    @id @default(uuid())
  content    String
  embedding  Unsupported("vector(768)")
  documentId String
  document   Document                  @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@map("chunks")
}

model Message {
  id        String      @id @default(uuid())
  role      Role
  content   String
  sessionId String
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt DateTime    @default(now())

  @@index([sessionId, createdAt])
  @@map("messages")
}

// Usage counter (per-user per-day). Separate table so the User row
// isn't rewritten on every query.
model UserUsage {
  id        String   @id @default(uuid())
  userId    String
  date      DateTime @db.Date
  queries   Int      @default(0)

  @@unique([userId, date])
  @@index([userId])
  @@map("user_usage")
}

model LLMLog {
  id                String           @id @default(uuid())
  userId            String           // intentionally no FK — survives user deletion for analytics
  sessionId         String           // intentionally no FK — survives session deletion
  documentId        String           // intentionally no FK — survives document deletion
  query             String
  response          String
  latencyMs         Int
  promptTokens      Int
  completionTokens  Int
  estimatedCostUsd  Float
  hasCitation       Boolean
  rerankingUsed     Boolean
  chunkingStrategy  ChunkingStrategy
  createdAt         DateTime         @default(now())

  @@index([createdAt])
  @@index([userId, createdAt])
  @@map("llm_logs")
}
```

```prisma
enum UserRole         { USER ADMIN }
enum FileType         { PDF TXT DOCX }
enum Role             { USER ASSISTANT }
enum ChunkingStrategy { FIXED SENTENCE PARAGRAPH RECURSIVE }
```

### Key schema decisions

- **`ChatSession` replaces the old anonymous `Session`.** Every chat session belongs to a `User`.
- **`Document.userId` is denormalized** — could be derived via `Document → ChatSession → User`,
  but filtering documents by owner is a hot-path operation (every ingestion + retrieval), so
  we pay one extra int-sized column to avoid a join.
- **`Message` has no `userId`** — always accessed through `sessionId`, and the session is
  already owner-checked. Adding it would be triple denormalization.
- **`UserUsage` is a separate table** — incrementing a counter on `User` directly would hit
  the same row on every query. Per-day bucket keeps the write path isolated and makes
  rate-limit aggregation trivial: `SELECT queries FROM user_usage WHERE userId=? AND date=CURRENT_DATE`.
- **`LLMLog` has no FK to User/Session/Document** — intentional, so deleting a user or
  session doesn't wipe audit trail. Matches the prior decision for session/document FK absence.
- **`AuthSession`** — NextAuth's own session table (renamed from its default `Session` to
  avoid colliding with our `ChatSession`). Managed entirely by `@auth/prisma-adapter`.
- **Indexes:** every hot-path query is covered. See "Index rationale" below.

### Index rationale

| Index                                          | Query it covers                            |
| ---------------------------------------------- | ------------------------------------------ |
| `User.email @unique`                           | OAuth login lookup                         |
| `Account(provider, providerAccountId) @unique` | NextAuth adapter lookup                    |
| `ChatSession(userId, createdAt)`               | List user's chat sessions newest first     |
| `ChatSession(expiresAt)`                       | Future cleanup cron                        |
| `Document(sessionId)`                          | List documents in a session                |
| `Document(userId, createdAt)`                  | List all user's documents (Documents page) |
| `Chunk(documentId)`                            | Filter by document before vector search    |
| `Message(sessionId, createdAt)`                | Load chat history in order                 |
| `UserUsage(userId, date) @unique`              | Lookup + upsert today's counter            |
| `LLMLog(createdAt)`                            | `getRecent(limit)` for dashboard           |
| `LLMLog(userId, createdAt)`                    | Per-user usage analytics                   |

**pgvector index** (created manually, Prisma doesn't support indexes on `Unsupported` columns):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

`lists = 10` is sized for MVP (hundreds to low thousands of chunks).
Rule of thumb: `lists ≈ sqrt(total_rows)`; pick higher once chunk count grows.
For very small datasets or if ordering quality matters more than speed, consider `HNSW` instead of `ivfflat`.

---

## Data Flow

### Ingestion Pipeline

```
POST /api/ingest (multipart/form-data: file, sessionId)
  → validate file type and size (max 10MB)
  → PdfParser | TxtParser | DocxParser  → raw text
  → ChunkingService.chunk(text, { size: 512, overlap: 50 })
  → GoogleEmbeddingClient.embedBatch(chunks)
  → PrismaDocumentRepository.create(document)
  → PrismaChunkRepository.saveMany(chunks + vectors)
  → return IngestResponseDto { documentId, chunkCount }
```

### RAG Chat Pipeline

```
POST /api/chat { message, sessionId, documentId }
  → SessionService.validateLimit(sessionId)   ← 403 if queryCount >= 20
  → GoogleEmbeddingClient.embed(message)
  → PrismaChunkRepository.similaritySearch(vector, { topK: 20, documentId }) ← wide net
  → CohereRerankClient.rerank(query, candidates, topN=5)
  → buildAugmentedPrompt(contextChunks, message, chatHistory)
  → GeminiClient.streamMessage(augmentedPrompt)  ← SSE
  → SessionService.incrementUsage(userId)
  → PrismaMessageRepository.saveExchange(userMsg, assistantMsg)
  → stream chunks to client via SSE
```

### Session Lifecycle

```
GET /api/session
  → read cookie session_id
  → if missing or expired: create new Session (expiresAt = now + 24h)
  → set cookie session_id (httpOnly, SameSite=strict)
  → return SessionDto { id, queryCount, remaining: 20 - queryCount }
```

---

## Rate Limiting & Authorization

Three layers:

1. **Per-user daily quota** — `UserUsage(userId, date).queries`, role-scoped caps.
   - Checked before every LLM call in `SessionService.validateLimit(userId, role)`
   - Limits live in `shared/config/limits.ts` and are looked up by `UserRole`:
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
   - Quota exceeded → `403 { error: "limit_reached", limit, remaining: 0 }`
   - UI badge shows `remaining / dailyLimit`

2. **Ownership enforcement** — all repository read/write methods take `userId` as a
   required parameter and include `WHERE userId = ?` in the SQL. Attempting to access
   another user's `ChatSession`, `Document`, or `Message` returns `null`/`404`, never
   a silent data leak. Type-safe: omitting `userId` is a compile error.

3. **IP rate limit** — Next.js middleware (`shared/lib/rateLimit.ts`)
   - Sliding window: 60 requests / minute per IP
   - In-memory Map with TTL (sufficient for single-instance Vercel)
   - `429 Too Many Requests` on breach
   - Protects `/api/auth/*` routes from login abuse

### Admin role provisioning

Roles are stored on `User.role`. The **first** user signing in is always created with
`USER` role. Promotion to `ADMIN` is a manual DB operation:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
```

Role is put into the NextAuth JWT at sign-in. A user promoted to admin must re-login
for the new role to take effect in their JWT. For a pet-project this is acceptable.

---

## Constants (`shared/config/constants.ts`)

```ts
export const MAX_QUERIES_PER_SESSION = 20;
export const SESSION_TTL_HOURS = 24;
export const CHUNK_SIZE = 512; // tokens
export const CHUNK_OVERLAP = 50; // tokens
export const TOP_K_CHUNKS = 5;
export const MAX_FILE_SIZE_MB = 10;
export const EMBEDDING_DIMS = 768; // google text-embedding-004
export const IP_RATE_LIMIT_RPM = 60;
```

---

## Chunking Strategies

Four strategies selectable per document upload:

| Strategy    | Description                                            | Best For                  |
| ----------- | ------------------------------------------------------ | ------------------------- |
| `FIXED`     | Fixed word-count windows with overlap                  | Dense technical docs      |
| `SENTENCE`  | Split on sentence boundaries (`.`, `!`, `?`)           | Narrative text, articles  |
| `PARAGRAPH` | Split on `\n\n` boundaries                             | Structured docs, reports  |
| `RECURSIVE` | Try paragraph → sentence → word, prefer semantic units | General purpose (default) |

`ChunkingService` accepts a `strategy: ChunkingStrategy` param and delegates to the appropriate splitter. All strategies respect `chunkSize` and `overlap` from constants.

```ts
export const CHUNKING_STRATEGY = {
	FIXED: 'FIXED',
	SENTENCE: 'SENTENCE',
	PARAGRAPH: 'PARAGRAPH',
	RECURSIVE: 'RECURSIVE',
} as const;
export type ChunkingStrategy = (typeof CHUNKING_STRATEGY)[keyof typeof CHUNKING_STRATEGY];
```

Default strategy: `RECURSIVE`. Selectable in the UI upload form.

---

## Retrieval Pipeline (Enhanced)

```
embed(query)
  → pgvector similarity search (top-k=20, wide net)
  → CohereRerankClient.rerank(query, candidates, topN=5)
  → buildAugmentedPrompt(reranked chunks)
  → Claude stream
```

**Why reranking:** pgvector uses approximate cosine similarity which is fast but imprecise. Cohere's cross-encoder reads the query and each chunk together, giving much better relevance ranking. Retrieve wide (20), rerank tight (5).

`CohereRerankClient` wraps `cohere-ai` SDK, model `rerank-v3.5`.

---

## Augmented Prompt Structure

```
You are a helpful assistant. Answer questions based ONLY on the provided context.
If the answer is not in the context, say "I don't have enough information in the uploaded documents."

Context:
---
[chunk 1 content]
---
[chunk 2 content]
---
[chunk 3 content]

Chat history:
User: [previous message]
Assistant: [previous response]

Current question: [user message]
```

---

## UI Architecture — 3-Zone Layout

Three dedicated pages reflect the actual system architecture: ingestion, inference, observability. This signals architectural thinking, not a demo.

```
app/
  page.tsx              ← Chat (inference)
  documents/page.tsx    ← Documents (ingestion)
  stats/page.tsx        ← Stats (LLMOps / observability)
```

Shared sidebar navigation (mini SaaS layout):

```
[ Chat ]      ← active knowledge base + chat + controls
[ Documents ] ← upload + ingestion settings + chunk browser
[ Stats ]     ← metrics + query log + cost dashboard
```

---

### Page 1: Chat (`/`)

**Left sidebar (narrow):** Active knowledge panel

- List of uploaded documents for this session: `📂 contract.pdf`, `📂 api_docs.txt`
- Click to set active document for queries
- "Upload more" link → goes to Documents page

**Main panel:** Chat

- `MessageList` — messages with citations rendered below assistant messages
- `MessageInput` — textarea + send

**Citations in assistant messages:**

```
Rate limiting works via middleware... [1][2]

Sources:
[1] rate_limit.ts — "The middleware checks IP against a sliding window..."
[2] api_config.ts — "RPM limit is configurable via constants..."
```

Citations come from the chunks returned by the retrieval API alongside the stream.

**Advanced controls (collapsible panel, right side or bottom):**

- Chunking strategy: `FIXED | SENTENCE | PARAGRAPH | RECURSIVE`
- Top-K: `5 | 10 | 20`
- Reranking: on/off toggle

These controls are sent with each chat request and logged in LLMOps.

---

### Page 2: Documents (`/documents`)

**Upload zone:**

- `FileDropzone` — drag-and-drop, PDF/TXT/DOCX
- Ingestion settings before upload:
  - Chunking strategy selector
  - Chunk size input (default 512)
  - Overlap input (default 50)
- After upload: "Document indexed successfully — 120 chunks created"

**Document table:**
| Name | Chunks | Strategy | Uploaded |
|------|--------|----------|---------|
| api.pdf | 120 | RECURSIVE | today |
| notes.txt | 34 | SENTENCE | yesterday |

**Document detail (click row → expand):**

- Chunk preview: first 3 chunks shown, "Show all" toggle
- Chunk count, file type, strategy used

---

### Page 3: Stats (`/stats`)

**Metrics cards:** totalRequests, avgLatencyMs, p95LatencyMs, totalCostUsd, citationRate

**Query log table:**
| Query | Latency | Cost | Strategy | Citations | Reranked |
|-------|---------|------|----------|-----------|---------|
| "rate limit?" | 1200ms | $0.002 | SENTENCE | ✅ | ✅ |

**Insight bar** (computed from logs):

> "RECURSIVE chunking shows highest citation rate (78%). FIXED has lowest latency (avg 980ms)."

---

### Components Map

```
presentation/
  web/
    layout/
      Sidebar/index.tsx           — nav: Chat | Documents | Stats
      AppLayout/index.tsx         — wraps pages with sidebar
    pages/
      Chat/
        index.tsx                 — assembles chat page
        KnowledgePanel/index.tsx  — active document list
        AdvancedControls/index.tsx — strategy/topK/reranking controls
        CitationList/index.tsx    — renders [1][2] sources below message
      Documents/
        index.tsx                 — assembles documents page
        DocumentTable/index.tsx   — table with click-to-expand
        IngestionSettings/index.tsx — chunk strategy/size/overlap form
        ChunkPreview/index.tsx    — shows chunk content on row expand
      Stats/
        index.tsx                 — assembles stats page
        MetricCards/index.tsx     — 5 KPI cards
        QueryLogTable/index.tsx   — paginated log table
        InsightBar/index.tsx      — computed textual insight
    components/
      MessageList/index.tsx
      MessageInput/index.tsx
      FileDropzone/index.tsx
      LimitBadge/index.tsx
      UploadProgress/index.tsx
```

---

## LLMOps

Every RAG query is logged to a `llm_logs` table. This is what differentiates this from a basic RAG chatbot and is directly relevant to production AI systems (Visma-style requirements).

### What is logged per request

| Field              | Type     | Description                                    |
| ------------------ | -------- | ---------------------------------------------- |
| `id`               | uuid     | Log entry ID                                   |
| `sessionId`        | string   | Which session                                  |
| `documentId`       | string   | Which document was queried                     |
| `query`            | string   | User's question                                |
| `response`         | string   | Full LLM response                              |
| `latencyMs`        | int      | Time from request start to stream end          |
| `promptTokens`     | int      | Estimated prompt token count                   |
| `completionTokens` | int      | Estimated completion token count               |
| `estimatedCostUsd` | float    | Cost estimate (Voyage + Claude pricing)        |
| `hasCitation`      | bool     | Heuristic: does response reference the source? |
| `rerankingUsed`    | bool     | Was Cohere reranking applied?                  |
| `chunkingStrategy` | string   | Which chunking strategy was used               |
| `createdAt`        | DateTime | Timestamp                                      |

### Evaluation heuristic (`hasCitation`)

Simple rule: response contains phrases like "according to", "based on", "the document states", "в документе", "согласно". This is logged automatically — no external eval framework needed.

### Cost estimation

```ts
// google text-embedding-004: free (or $0.00001/1K chars if paid)
// gemini-2.5-flash: free tier (1500 req/day); paid: $0.075 input / $0.30 output per 1M tokens
// We log pay-as-you-go rates for observability realism even on free tier:
function estimateCost(promptTokens: number, completionTokens: number): number {
	const embeddingCost = (promptTokens / 1_000_000) * 0.01; // ~google embedding paid rate
	const geminiInputCost = (promptTokens / 1_000_000) * 0.075;
	const geminiOutputCost = (completionTokens / 1_000_000) * 0.3;
	return embeddingCost + geminiInputCost + geminiOutputCost;
}
```

### LLMOps Dashboard API

`GET /api/llmops` returns aggregate stats:

```json
{
	"totalRequests": 142,
	"avgLatencyMs": 1840,
	"totalCostUsd": 0.0234,
	"citationRate": 0.73,
	"p95LatencyMs": 3200
}
```

### Architecture layer

`LLMOpsService` lives in `server/application/llmops/`. It is called by `RetrievalService` after each successful stream — fire-and-forget (does not block the response stream).

---

## Testing Strategy

- **Unit (Vitest):** `ChunkingService`, `SimilarityService`, `SessionService`, `buildAugmentedPrompt`
- **TDD approach:** write test first for RAG retrieval logic before implementing
- **Integration:** `IngestionService` + `RetrievalService` against Neon test DB
- **UI:** `@testing-library/react` for `MessageList`, `FileDropzone`, `LimitBadge`
- Test files in `__tests__/` folders adjacent to the code

---

## Deployment

- Vercel (single monolith, same as tense-master pattern)
- Neon PostgreSQL with pgvector extension
- Environment variables: `DATABASE_URL`, `DIRECT_URL`, `GOOGLE_AI_KEY`, `COHERE_API_KEY`
- File upload: processed in-memory (no disk storage, no S3 needed for MVP)
