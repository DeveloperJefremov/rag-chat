# RAG Chat — Plan Review

**Date:** 2026-04-23  
**Reviewer:** Claude  
**Files reviewed:** `2026-04-22-ragchat-design.md`, `2026-04-22-ragchat-implementation.md`

---

## Summary

The design doc is solid and well-thought-out. The implementation plan, however, appears to have been written against an **older version** of the design (anonymous sessions, no auth) and was never updated to match the current approved spec. There are also a number of technical issues in the code snippets that would surface during implementation.

Issues are grouped into two categories:

1. **Alignment Gaps** — where the implementation plan diverges from the design doc
2. **Technical Issues** — bugs and weaknesses in the code snippets themselves

---

## Part 1: Alignment Gaps

### 1.1 Authentication is completely absent from the implementation plan

The design doc has a full auth system: NextAuth v5 + Google provider + Prisma adapter, `auth.ts` at the project root, `IAuthContext` / `NextAuthContext`, middleware auth gate, and `authContext.requireUser()` at the top of every API route. None of this appears in any implementation task. There is no task for:

- Installing NextAuth and `@auth/prisma-adapter`
- Writing `auth.ts`
- Creating `app/api/auth/[...nextauth]/route.ts`
- Writing `IAuthContext` / `NextAuthContext`
- Updating `middleware.ts` to enforce authentication (Task 14 only adds IP rate limiting)
- Protecting API routes

This is the largest gap — the entire auth layer is missing.

---

### 1.2 Data model in Task 2 is the old anonymous schema

Task 2's `prisma/schema.prisma` snippet uses the old anonymous `Session` model:

```prisma
model Session {
  id         String
  queryCount Int     @default(0)  // ← doesn't exist in approved schema
  ...
}
```

The approved schema uses `ChatSession` (owned by `User`, with `title`, no `queryCount`), plus `User`, `Account`, `AuthSession`, `VerificationToken`, `UserUsage`, and `LLMLog`. Task 2 needs to be replaced entirely with the schema from the design doc.

---

### 1.3 Domain entities are incomplete

Task 4 creates: `Session`, `Document`, `Chunk`, `Message`.

Missing entities that are part of the approved design:

- `domain/entities/User.ts`
- `domain/entities/LLMLog.ts`
- `domain/entities/UserUsage.ts`
- `domain/entities/ChatSession.ts` (replaces `Session.ts`)
- `domain/value-objects/ChunkingStrategy.ts` (referenced in File Map but no task)

---

### 1.4 Rate limiting uses the wrong mechanism

Task 11's `SessionService` enforces a limit of 20 queries per session (`MAX_QUERIES_PER_SESSION`) by reading `session.queryCount`. The approved design uses a completely different approach:

- **`UserUsage(userId, date)`** table — per-user, per-day counter
- Limits are role-based: `LIMITS_BY_ROLE[role].queriesPerDay` (100 for `USER`, `Infinity` for `ADMIN`)
- Validated via `SessionService.validateLimit(userId, role)` — takes `userId` and `role`, not `sessionId`

The tests in Task 11 test the wrong behavior. `SessionService` in the final design doesn't check `queryCount` on a session at all.

---

### 1.5 Repository interfaces are incomplete

Task 9 creates `ISessionRepository`, `IDocumentRepository`, `IChunkRepository`, `IMessageRepository`.

Missing (all required by the approved design):

- `IUserRepository`
- `IChatSessionRepository`
- `ILLMLogRepository`
- `IUserUsageRepository`

Also missing the corresponding Prisma implementations (`PrismaUserRepository`, `PrismaChatSessionRepository`, `PrismaLLMLogRepository`, `PrismaUserUsageRepository`).

---

### 1.6 `Document` model is missing two fields

The approved schema has:

```prisma
model Document {
  chunkingStrategy ChunkingStrategy   // ← missing from Task 2 schema
  userId           String             // ← missing (denormalized for ownership)
  ...
}
```

Task 9's `CreateDocumentData` interface and Task 10's `PrismaDocumentRepository.create()` don't include either field. This means ownership cannot be enforced on documents and chunking strategy is not persisted.

---

### 1.7 `LLMOpsService` has no implementation task

The File Map lists `LLMOpsService.ts` and `PrismaLLMLogRepository.ts`, but there is no task covering their implementation. The design describes this as a core differentiator ("what differentiates this from a basic RAG chatbot"). It should be a dedicated task.

---

### 1.8 `ChunkingService` only implements one strategy

Task 5's `ChunkingService` accepts `{ chunkSize, overlap }` and has a single `chunk()` method that does fixed word-count splitting. The approved design has four strategies: `FIXED`, `SENTENCE`, `PARAGRAPH`, `RECURSIVE`, selectable per document upload.

The `chunk(text, strategy)` signature is missing. There's no dispatch to different splitting logic. `ChunkingStrategy` value object is defined in the File Map but has no implementation task.

---

### 1.9 Reranking is not wired into `RetrievalService`

Task 13's `RetrievalService.stream()` does:

```
embed → similaritySearch → buildPrompt → stream
```

The approved pipeline is:

```
embed → similaritySearch (topK×4, wide net) → CohereRerankClient.rerank → buildPrompt → stream
```

`CohereRerankClient` is created in `container.ts` (Task 15) but never injected into `RetrievalService`. The `RetrievalServiceDeps` interface has no `rerankClient` field. Reranking is the entire reason Cohere is in the stack.

---

### 1.10 `RetrievalService.stream()` ignores runtime parameters

The design says chat requests send `topK`, `rerankingEnabled`, and `chunkingStrategy` per message (so users can experiment via the Advanced Controls panel). Task 13's `stream()` accepts only `{ message, sessionId, documentId }` and hardcodes `TOP_K_CHUNKS` from constants. These params need to flow through.

---

### 1.11 Citations / sources not returned from `RetrievalService`

The approved pipeline's first SSE event is:

```
→ yield { sources: CitationDto[] }    ← first SSE event, before text
```

Task 13's `stream()` yields only raw text strings. There's no `CitationDto`, no sources event, and no way for the client to render `[1][2]` inline citations.

---

### 1.12 Client layer is entirely absent

The design has a full client layer: `IChatApi`, `IIngestionApi`, `ISessionApi`, `ILLMOpsApi`, concrete `*Api` implementations, `ChatSessionService`, `IngestionClientService`, and three Zustand stores (`chatStore`, `uploadStore`, `sessionStore`). The implementation plan has zero tasks covering any of this.

---

### 1.13 UI / presentation tasks are entirely absent

Three pages (`Chat`, `Documents`, `Stats`) and the full component tree (`MessageList`, `MessageInput`, `FileDropzone`, `KnowledgePanel`, `AdvancedControls`, `CitationList`, `DocumentTable`, `MetricCards`, etc.) are described in the design doc but have no corresponding tasks.

---

### 1.14 `shared/config/limits.ts` is missing

The approved design puts role-based limits in a dedicated `limits.ts` file. The implementation plan puts `MAX_QUERIES_PER_SESSION = 20` in `constants.ts` and has no `limits.ts`. This matters because `SessionService` is supposed to look up the limit by role, not use a hardcoded constant.

---

### 1.15 Stale provider names in design doc data flow

The design doc's data flow sections mention `VoyageEmbeddingClient` and `ClaudeClient` — leftover from an older version before the stack switched to Google Embedding + Gemini. The stack table is correct, but these pseudocode blocks are stale and will confuse anyone reading the design doc. They should be updated to `GoogleEmbeddingClient` and `GeminiClient`.

---

### 1.16 Duplicate pgvector index in design doc (conflicting values)

The design doc lists the pgvector index twice:

- First occurrence: `WITH (lists = 10)` — recommended for MVP
- Second occurrence: `WITH (lists = 100)` — no explanation

One of them should be removed. `lists = 10` is correct for MVP scale.

---

## Part 2: Technical Issues in Code Snippets

### 2.1 `embedBatch` fires N sequential calls, not a true batch

```ts
async embedBatch(texts: string[]): Promise<number[][]> {
    const results = await Promise.all(texts.map(t => model.embedContent(t)));
}
```

`Promise.all` fires all N embedding requests concurrently, not as a batch. For a 100-chunk document, this sends 100 simultaneous API calls. Google's `@google/generative-ai` SDK has `batchEmbedContents()` which handles this in a single request. This should be used instead, both for efficiency and to avoid hitting rate limits.

---

### 2.2 `saveMany` inserts chunks sequentially

```ts
for (const chunk of chunks) {
	await prisma.$executeRaw`INSERT INTO chunks ...`;
}
```

Sequential `await` inside a loop. For a 120-chunk PDF, this makes 120 round-trips. Even with pgvector requiring raw SQL, this can be done with a single multi-row `INSERT ... VALUES (...), (...), (...)` statement. The loop should be replaced.

---

### 2.3 SQL injection risk in `similaritySearch`

```ts
const vectorStr = `[${params.queryVector.join(',')}]`;
const results = await prisma.$queryRaw`
    ...embedding <=> ${vectorStr}::vector...
`;
```

`vectorStr` is a plain JavaScript string that gets interpolated into the tagged template literal. Prisma's `$queryRaw` parameterizes `${}` values as SQL parameters, but the `::vector` cast on a string parameter may cause the driver to inline it. More critically, if `queryVector` contains anything other than numbers (due to a bug or upstream manipulation), this becomes injectable. Validate that every element is a finite number before joining, or use `Prisma.sql` explicitly.

---

### 2.4 `IngestionService` creates the document before saving chunks — no rollback on failure

```ts
const document = await this.documentRepo.create({...});
await this.chunkRepo.saveMany(...);  // if this throws, document exists with no chunks
```

If `saveMany` fails (network error, malformed vector), the document record is left in the database with zero chunks. The user sees a document that will never answer queries. This sequence should be wrapped in a transaction, or the document should only be created after chunks are successfully persisted.

---

### 2.5 Chat history grows unbounded

`RetrievalService.stream()` calls `messageRepo.findBySessionId(sessionId)` which returns all messages. For a long conversation, the full history is appended to every prompt. This silently inflates prompt token counts, increases cost, and eventually exceeds Gemini's context window. The history fed to the prompt should be capped (e.g., the last 10 messages).

---

### 2.6 `RetrievalService` imports the concrete `SessionService` class

```ts
import { SessionService } from '../session/SessionService';
```

`RetrievalService` is an application-layer service that directly imports another application-layer service by its concrete class. This violates the dependency inversion principle — `RetrievalService` should depend on an abstraction (`ISessionService` interface or a plain function type), not the concrete class. This also makes unit testing harder, as the test has to pass `{} as any` for `sessionService`.

---

### 2.7 No error handling in `RetrievalService.stream()`

If `llmClient.streamMessage()` throws after partial streaming (network drop, token limit exceeded), the `finally` block is never reached — `sessionService.increment()` and `messageRepo.saveMany()` are skipped. The user's query count is not incremented and the exchange is not saved. Use `try/finally` to guarantee cleanup regardless of stream success or failure.

---

### 2.8 SSE wire format is undefined

`RetrievalService.stream()` yields raw strings. The API route needs to serialize these to SSE format, and the client needs to parse them. The design says the first SSE event should carry `{ sources: CitationDto[] }` and subsequent events carry text. There's no defined event type envelope (e.g., `{ type: 'sources' | 'text', payload: ... }`). This contract needs to be specified in a DTO or the route will be inconsistent with what the client expects.

---

### 2.9 `container.ts` instantiates everything at module load time

```ts
const sessionRepo = new PrismaSessionRepository();
const embeddingClient = new GoogleEmbeddingClient();
// ...
```

All infrastructure clients are created when the module is first imported. In Next.js App Router (and Vercel serverless), this runs on cold start. The embedding and LLM clients only throw if env vars are missing — that's fine. But `new PrismaClient()` should never be instantiated this way; the file delegates to `prismaClient.ts` which handles the singleton pattern correctly. The concern is that the container's flat initialization makes it harder to add lazy loading later. Low priority, but worth being aware of.

---

### 2.10 `ILLMClient` return type is ambiguous

```ts
export interface ILLMClient {
	streamMessage(prompt: string): AsyncGenerator<string>;
}
```

TypeScript's `AsyncGenerator<T>` is actually `AsyncGenerator<T, TReturn, TNext>` — a three-parameter generic. Declaring only `AsyncGenerator<string>` infers `TReturn = any` and `TNext = unknown`. In practice `GeminiClient` implements `async *streamMessage(): AsyncGenerator<string>` which TypeScript accepts, but the interface should be `AsyncIterableIterator<string>` or `AsyncGenerator<string, void, unknown>` to be explicit and avoid subtle type mismatches.

---

### 2.11 `PrismaChunkRepository.similaritySearch` uses `LIMIT` with a raw integer

```ts
LIMIT ${params.topK}
```

In Prisma's `$queryRaw` tagged template, `${}` values are parameterized as `$1`, `$2`, etc. However, some PostgreSQL drivers don't allow `LIMIT $1` with a parameterized integer in all contexts. Safer to use `Prisma.sql` with explicit typing or cast: `LIMIT ${Prisma.raw(String(params.topK))}` — but only after validating `topK` is a safe integer.

---

## Priority Summary

| #                                                           | Area       | Severity |
| ----------------------------------------------------------- | ---------- | -------- |
| Auth layer missing entirely                                 | Alignment  | Critical |
| Prisma schema outdated (wrong model names + missing tables) | Alignment  | Critical |
| Session → ChatSession + User migration                      | Alignment  | Critical |
| Rate limiting wrong mechanism (queryCount vs UserUsage)     | Alignment  | Critical |
| Repository interfaces incomplete                            | Alignment  | High     |
| ChunkingService missing 3 of 4 strategies                   | Alignment  | High     |
| Reranking not wired into RetrievalService                   | Alignment  | High     |
| Client layer + UI tasks absent                              | Alignment  | High     |
| LLMOpsService has no task                                   | Alignment  | High     |
| Chunk insert loop (sequential N round-trips)                | Technical  | High     |
| embedBatch not using batchEmbedContents                     | Technical  | High     |
| No transaction wrapping document + chunk saves              | Technical  | High     |
| Unbounded chat history in prompt                            | Technical  | Medium   |
| SQL injection risk in similaritySearch                      | Technical  | Medium   |
| No error handling in RetrievalService.stream()              | Technical  | Medium   |
| SSE wire format undefined                                   | Technical  | Medium   |
| RetrievalService importing concrete SessionService          | Technical  | Low      |
| ILLMClient return type ambiguity                            | Technical  | Low      |
| Stale provider names in design doc                          | Design doc | Low      |
| Duplicate pgvector index                                    | Design doc | Low      |
