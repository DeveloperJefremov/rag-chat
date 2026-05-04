# Global Documents with Multi-Select Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `Document` from per-session to per-user (global library), introduce `SessionDocument` N:N junction, and let chat retrieval search across multiple attached documents at once.

**Architecture:**

- `Document` becomes a global per-user resource. `Document.sessionId` is removed; a new `SessionDocument(sessionId, documentId)` join table tracks which documents are attached to each chat.
- The chat API accepts `documentIds: string[]` instead of `documentId: string`. `IChunkRepository.similaritySearch` filters by `documentId IN (...)` and ownership via `userId`. Citations carry the document name they came from.
- The client gains a `attachmentStore` (Set of active `documentIds` per session). The chat header shows a multi-select chip list with “+ Add from library”. The `/documents` page becomes a global library, decoupled from the active chat session. Auto-attach happens on upload-from-chat.
- Old data is wiped (`TRUNCATE documents, chunks` via the destructive Prisma migration that drops `Document.sessionId`).
- Per-role limits add `maxDocumentsPerUser` (was `maxDocumentsPerSession`) and a new cap `maxAttachedPerSession`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + Postgres (Neon) + pgvector, NextAuth v5, Zustand, Vitest, TypeScript strict.

---

## File Structure

### Server — application

- **Modify** `domain/entities/Document.ts` — drop `sessionId` field.
- **Modify** `server/application/repositories/IDocumentRepository.ts` — drop `sessionId` from `CreateDocumentData`, replace `findBySessionId` with `findAttachedToSession`, add `findAllByUser`, `attachToSession`, `detachFromSession`, `deleteById(id, userId)` with required ownership.
- **Modify** `server/application/repositories/IChunkRepository.ts` — `similaritySearch` accepts `documentIds: string[]` instead of `documentId: string`.
- **Modify** `server/application/ingestion/IngestionService.ts` — drop `sessionId` from input; new `attachToSession?: string` param for auto-attach.
- **Modify** `server/application/retrieval/RetrievalService.ts` — accept `documentIds` and `documentNames` (parallel arrays), pass through to similarity search and citations.
- **Modify** `server/application/session/SessionService.ts` — add `validateDocumentsLimit(userId, role)` and `validateAttachedLimit(sessionId, role)` helpers (called from ingest/attach routes).
- **Modify** `shared/config/limits.ts` — rename `maxDocumentsPerSession` → `maxDocumentsPerUser`, add `maxAttachedPerSession`.

### Server — infrastructure

- **Modify** `prisma/schema.prisma` — drop `Document.sessionId` + relation, add `SessionDocument` model; add `documents SessionDocument[]` back-relation on `ChatSession`.
- **Create** `prisma/migrations/<ts>_global_documents/migration.sql` — truncates `chunks` + `documents`, drops `Document.sessionId`, creates `session_documents` table.
- **Modify** `server/infrastructure/prisma-orm/PrismaDocumentRepository.ts` — implement new interface; add helpers for join table.
- **Modify** `server/infrastructure/prisma-orm/PrismaChunkRepository.ts` — `similaritySearch` filters with `c."documentId" = ANY($1)`.

### Server — HTTP

- **Modify** `app/api/ingest/route.ts` — drop `sessionId` requirement; accept optional `attachToSession` form field; validate user `maxDocumentsPerUser` limit.
- **Modify** `app/api/documents/route.ts` — `GET /api/documents` (no params) returns all user docs.
- **Create** `app/api/documents/[id]/route.ts` — `DELETE /api/documents/:id` removes from library + chunks + all attachments.
- **Create** `app/api/session/[id]/documents/route.ts` — `GET` lists attached, `POST { documentId }` attaches, both validate ownership + cap.
- **Create** `app/api/session/[id]/documents/[documentId]/route.ts` — `DELETE` detaches.
- **Modify** `app/api/chat/route.ts` — read `documentIds: string[]`, validate ownership of all and that all are attached to the session.

### Shared DTOs

- **Modify** `shared/dtos/ChatRequestDto.ts` — `documentId: string` → `documentIds: string[]`.
- **Modify** `shared/dtos/IngestResponseDto.ts` — no change needed (already has `documentId`).

### Client — application

- **Modify** `client/application/api/IIngestionApi.ts` — `IngestParams.sessionId?` becomes optional `attachToSession?`; `getDocuments()` no params; new methods `deleteDocument(id)`, `getAttached(sessionId)`, `attachToSession(sessionId, documentId)`, `detachFromSession(sessionId, documentId)`.
- **Modify** `client/application/api/IChatApi.ts` — `StreamChatParams.documentId` → `documentIds: string[]`.
- **Modify** `client/infrastructure/http/IngestionApi.ts` — implement new methods.
- **Modify** `client/infrastructure/http/ChatApi.ts` — adjust types only (already serializes whole body).
- **Modify** `client/application/services/IngestionClientService.ts` — pass new param.

### Client — stores

- **Modify** `client/stores/uploadStore.ts` — `documents` becomes user-global; remove `loadedSessionId`; `fetchDocuments()` no arg; `upload(file, options)` with optional auto-attach; new `removeDocument(id)`.
- **Create** `client/stores/attachmentStore.ts` — `attachedBySession: Record<sessionId, IngestResponseDto[]>`, `activeBySession: Record<sessionId, Set<documentId>>`, actions `loadAttached(sessionId)`, `attach(sessionId, documentId)`, `detach(sessionId, documentId)`, `toggleActive(sessionId, documentId)`, `setAllActive(sessionId)`.

### Client — presentation

- **Modify** `presentation/web/pages/Chat/index.tsx` — drop `selectedDocumentId` local state; read attachments from `attachmentStore`; pass `documentIds: Array.from(activeSet)` to `sendMessage`. Show multi-select chips + “Add from library” button.
- **Create** `presentation/web/pages/Chat/AttachmentChips/index.tsx` — chip row with toggle.
- **Create** `presentation/web/pages/Chat/AddFromLibraryDialog/index.tsx` — modal listing all user docs with checkboxes, attaches selected to current session.
- **Modify** `presentation/web/pages/Chat/KnowledgePanel/index.tsx` — list session-attached docs (not all user docs); add link to library.
- **Modify** `presentation/web/pages/Documents/index.tsx` — global view; `handleFile` no longer needs a session.
- **Modify** `client/stores/chatStore.ts` — `SendMessageParams.documentId` → `documentIds: string[]`.

### Tests

- **Modify** `server/application/ingestion/__tests__/IngestionService.test.ts` — drop `sessionId`, add auto-attach test.
- **Modify** `server/application/retrieval/__tests__/RetrievalService.test.ts` — exercise `documentIds`.
- **Create** `server/application/session/__tests__/SessionService.test.ts` (or extend) — `validateDocumentsLimit` and `validateAttachedLimit`.

---

# Tasks

## Task 1: Update Prisma schema and write migration

**Files:**

- Modify: `prisma/schema.prisma:83-97` (Document model), `prisma/schema.prisma:68-81` (ChatSession model)
- Create: `prisma/migrations/<timestamp>_global_documents/migration.sql`

- [ ] **Step 1.1: Edit `prisma/schema.prisma` — change `Document` and `ChatSession` and add `SessionDocument`**

Replace the `ChatSession` model (currently lines 68–81) with:

```prisma
model ChatSession {
  id               String            @id @default(uuid())
  title            String?
  userId           String
  user             User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt        DateTime          @default(now())
  expiresAt        DateTime
  messages         Message[]
  attachedDocuments SessionDocument[]

  @@index([userId, createdAt])
  @@index([expiresAt])
  @@map("chat_sessions")
}
```

Replace the `Document` model (currently lines 83–97) with:

```prisma
model Document {
  id               String            @id @default(uuid())
  name             String
  fileType         FileType
  chunkingStrategy ChunkingStrategy
  userId           String
  createdAt        DateTime          @default(now())
  chunks           Chunk[]
  sessions         SessionDocument[]

  @@index([userId, createdAt])
  @@map("documents")
}

model SessionDocument {
  sessionId  String
  documentId String
  attachedAt DateTime    @default(now())
  session    ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  document   Document    @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@id([sessionId, documentId])
  @@index([documentId])
  @@map("session_documents")
}
```

- [ ] **Step 1.2: Generate migration with destructive truncate**

Run: `npx prisma migrate dev --name global_documents --create-only`

Then **edit the generated** `prisma/migrations/<timestamp>_global_documents/migration.sql` so it begins with a truncate (Prisma will not include this; we add it manually) and ends with the schema changes Prisma generated. The file should look like:

```sql
-- Wipe all existing documents and chunks (clean-start migration per design decision 1b)
TRUNCATE TABLE "chunks", "documents" RESTART IDENTITY CASCADE;

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_sessionId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "documents_sessionId_idx";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "sessionId";

-- CreateTable
CREATE TABLE "session_documents" (
    "sessionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_documents_pkey" PRIMARY KEY ("sessionId","documentId")
);

-- CreateIndex
CREATE INDEX "session_documents_documentId_idx" ON "session_documents"("documentId");

-- AddForeignKey
ALTER TABLE "session_documents" ADD CONSTRAINT "session_documents_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_documents" ADD CONSTRAINT "session_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

If the autogenerated SQL differs (different constraint names), keep its statements but make sure (1) the leading `TRUNCATE` is added and (2) `documents.sessionId` is dropped (foreign key + index first).

- [ ] **Step 1.3: Apply the migration**

Run: `npx prisma migrate dev`
Expected: migration applies cleanly, Prisma client regenerates. Confirm the new tables with `npx prisma studio` (optional).

- [ ] **Step 1.4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): make Document global per-user; add SessionDocument join table"
```

---

## Task 2: Domain entity + repository interfaces

**Files:**

- Modify: `domain/entities/Document.ts`
- Modify: `server/application/repositories/IDocumentRepository.ts`
- Modify: `server/application/repositories/IChunkRepository.ts`

- [ ] **Step 2.1: Drop `sessionId` from `Document` entity**

Replace the entire content of `domain/entities/Document.ts`:

```ts
import { FileType } from '../value-objects/FileType';
import { ChunkingStrategy } from '../value-objects/ChunkingStrategy';

export interface Document {
	id: string;
	name: string;
	fileType: FileType;
	chunkingStrategy: ChunkingStrategy;
	userId: string;
	createdAt: Date;
}
```

- [ ] **Step 2.2: Update `IDocumentRepository`**

Replace the entire content of `server/application/repositories/IDocumentRepository.ts`:

```ts
import { Document } from '../../../domain/entities/Document';
import { FileType } from '../../../domain/value-objects/FileType';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface CreateDocumentData {
	name: string;
	fileType: FileType;
	chunkingStrategy: ChunkingStrategy;
	userId: string;
}

export interface IDocumentRepository {
	create(data: CreateDocumentData): Promise<Document>;
	findById(id: string, userId: string): Promise<Document | null>;
	findByIds(ids: string[], userId: string): Promise<Document[]>;
	findAllByUser(userId: string): Promise<Document[]>;
	findAttachedToSession(sessionId: string, userId: string): Promise<Document[]>;
	countByUser(userId: string): Promise<number>;
	countAttached(sessionId: string): Promise<number>;
	attachToSession(sessionId: string, documentId: string): Promise<void>;
	detachFromSession(sessionId: string, documentId: string): Promise<void>;
	deleteById(id: string, userId: string): Promise<void>;
}
```

- [ ] **Step 2.3: Update `IChunkRepository.similaritySearch` signature**

Replace `server/application/repositories/IChunkRepository.ts`:

```ts
import { Chunk } from '../../../domain/entities/Chunk';

export interface CreateChunkData {
	content: string;
	embedding: number[];
	documentId: string;
}

export interface IChunkRepository {
	saveMany(chunks: CreateChunkData[]): Promise<void>;
	similaritySearch(params: {
		queryVector: number[];
		documentIds: string[];
		userId: string;
		topK: number;
	}): Promise<Chunk[]>;
}
```

- [ ] **Step 2.4: Run typecheck (expect failures elsewhere — they will be fixed in later tasks)**

Run: `npx tsc --noEmit`
Expected: errors in `PrismaDocumentRepository.ts`, `PrismaChunkRepository.ts`, `IngestionService.ts`, `RetrievalService.ts`, `app/api/...` — these are the call sites we update next.

- [ ] **Step 2.5: Commit (interface change, no fix yet)**

```bash
git add domain/entities/Document.ts server/application/repositories
git commit -m "refactor: update Document entity and repo interfaces for global ownership"
```

---

## Task 3: Update `PrismaDocumentRepository`

**Files:**

- Modify: `server/infrastructure/prisma-orm/PrismaDocumentRepository.ts`

- [ ] **Step 3.1: Replace the file with the new implementation**

```ts
import { prisma } from './prismaClient';
import { Document } from '../../../domain/entities/Document';
import { FileType } from '../../../domain/value-objects/FileType';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import {
	CreateDocumentData,
	IDocumentRepository,
} from '../../application/repositories/IDocumentRepository';

type Row = {
	id: string;
	name: string;
	fileType: string;
	chunkingStrategy: string;
	userId: string;
	createdAt: Date;
};

const toEntity = (row: Row): Document => ({
	id: row.id,
	name: row.name,
	fileType: row.fileType as FileType,
	chunkingStrategy: row.chunkingStrategy as ChunkingStrategy,
	userId: row.userId,
	createdAt: row.createdAt,
});

export class PrismaDocumentRepository implements IDocumentRepository {
	async create(data: CreateDocumentData): Promise<Document> {
		const doc = await prisma.document.create({ data });
		return toEntity(doc);
	}

	async findById(id: string, userId: string): Promise<Document | null> {
		const doc = await prisma.document.findFirst({ where: { id, userId } });
		return doc ? toEntity(doc) : null;
	}

	async findByIds(ids: string[], userId: string): Promise<Document[]> {
		if (ids.length === 0) return [];
		const docs = await prisma.document.findMany({
			where: { id: { in: ids }, userId },
		});
		return docs.map(toEntity);
	}

	async findAllByUser(userId: string): Promise<Document[]> {
		const docs = await prisma.document.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
		});
		return docs.map(toEntity);
	}

	async findAttachedToSession(sessionId: string, userId: string): Promise<Document[]> {
		const docs = await prisma.document.findMany({
			where: {
				userId,
				sessions: { some: { sessionId } },
			},
			orderBy: { createdAt: 'desc' },
		});
		return docs.map(toEntity);
	}

	async countByUser(userId: string): Promise<number> {
		return prisma.document.count({ where: { userId } });
	}

	async countAttached(sessionId: string): Promise<number> {
		return prisma.sessionDocument.count({ where: { sessionId } });
	}

	async attachToSession(sessionId: string, documentId: string): Promise<void> {
		await prisma.sessionDocument.upsert({
			where: { sessionId_documentId: { sessionId, documentId } },
			create: { sessionId, documentId },
			update: {},
		});
	}

	async detachFromSession(sessionId: string, documentId: string): Promise<void> {
		await prisma.sessionDocument
			.delete({ where: { sessionId_documentId: { sessionId, documentId } } })
			.catch(() => {});
	}

	async deleteById(id: string, userId: string): Promise<void> {
		await prisma.document.deleteMany({ where: { id, userId } });
	}
}
```

- [ ] **Step 3.2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `PrismaChunkRepository.ts`, `IngestionService.ts`, `RetrievalService.ts`, API routes — to be fixed in later tasks.

- [ ] **Step 3.3: Commit**

```bash
git add server/infrastructure/prisma-orm/PrismaDocumentRepository.ts
git commit -m "feat(repo): PrismaDocumentRepository supports global docs and attach/detach"
```

---

## Task 4: Update `PrismaChunkRepository.similaritySearch`

**Files:**

- Modify: `server/infrastructure/prisma-orm/PrismaChunkRepository.ts`

- [ ] **Step 4.1: Replace `similaritySearch` to filter by `documentIds`**

Replace the `similaritySearch` method body (the whole method) with:

```ts
async similaritySearch(params: {
	queryVector: number[];
	documentIds: string[];
	userId: string;
	topK: number;
}): Promise<Chunk[]> {
	if (params.documentIds.length === 0) return [];
	if (params.queryVector.some(v => !Number.isFinite(v))) {
		throw new Error('Invalid query vector: contains non-finite values');
	}
	const vectorLiteral = `[${params.queryVector.join(',')}]`;
	const topK = Math.max(1, Math.floor(params.topK));

	const results = await prisma.$queryRaw<
		Array<{ id: string; content: string; documentId: string }>
	>`
		SELECT c.id, c.content, c."documentId"
		FROM chunks c
		JOIN documents d ON d.id = c."documentId"
		WHERE c."documentId" = ANY(${params.documentIds}::text[])
		  AND d."userId" = ${params.userId}
		ORDER BY c.embedding <=> ${vectorLiteral}::vector
		LIMIT ${topK}
	`;

	return results.map(r => ({
		id: r.id,
		content: r.content,
		embedding: [],
		documentId: r.documentId,
	}));
}
```

- [ ] **Step 4.2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors now only in `IngestionService.ts`, `RetrievalService.ts`, and API routes.

- [ ] **Step 4.3: Commit**

```bash
git add server/infrastructure/prisma-orm/PrismaChunkRepository.ts
git commit -m "feat(repo): similaritySearch filters by documentIds[] using ANY"
```

---

## Task 5: Update limits config

**Files:**

- Modify: `shared/config/limits.ts`

- [ ] **Step 5.1: Replace file**

```ts
export type UserRole = 'USER' | 'ADMIN';

export interface RoleLimits {
	queriesPerDay: number;
	maxDocumentsPerUser: number;
	maxChatSessions: number;
	maxAttachedPerSession: number;
}

export const LIMITS_BY_ROLE: Record<UserRole, RoleLimits> = {
	USER: {
		queriesPerDay: 100,
		maxDocumentsPerUser: 20,
		maxChatSessions: 10,
		maxAttachedPerSession: 10,
	},
	ADMIN: {
		queriesPerDay: Infinity,
		maxDocumentsPerUser: Infinity,
		maxChatSessions: Infinity,
		maxAttachedPerSession: Infinity,
	},
};
```

- [ ] **Step 5.2: Commit**

```bash
git add shared/config/limits.ts
git commit -m "feat(limits): replace maxDocumentsPerSession with maxDocumentsPerUser; add maxAttachedPerSession"
```

---

## Task 6: Update `IngestionService` (drop sessionId, add optional auto-attach)

**Files:**

- Modify: `server/application/ingestion/IngestionService.ts`
- Modify: `server/application/ingestion/__tests__/IngestionService.test.ts`

- [ ] **Step 6.1: Update the existing test for the new shape (TDD)**

Open `server/application/ingestion/__tests__/IngestionService.test.ts` and:

1. In `makeRepo`, remove `sessionId` from the resolved-doc value and add `attachToSession: vi.fn().mockResolvedValue(undefined)`.
2. Replace the first `it('parses, chunks, embeds, and stores a TXT file', ...)` body so the call no longer passes `sessionId`:

```ts
const result = await service.ingest({
	buffer,
	fileName: 'test.txt',
	fileType: 'TXT',
	userId: 'user-1',
});
```

And drop `sessionId: 'sess-1'` from the second test similarly.

3. Add a new test:

```ts
it('attaches the new document to the given session when attachToSession is provided', async () => {
	const mocks = makeRepo();
	const service = new IngestionService({
		documentRepo: mocks.documentRepo as unknown as IDocumentRepository,
		chunkRepo: mocks.chunkRepo as unknown as IChunkRepository,
		parsers: {
			TXT: mocks.txtParser as unknown as IFileParser,
			PDF: {} as unknown as IFileParser,
			DOCX: {} as unknown as IFileParser,
		},
		embeddingClient: mocks.embeddingClient as unknown as IEmbeddingClient,
		chunkingService: mocks.chunkingService as unknown as ChunkingService,
	});

	await service.ingest({
		buffer: Buffer.from('x'),
		fileName: 'x.txt',
		fileType: 'TXT',
		userId: 'user-1',
		attachToSession: 'sess-1',
	});

	expect(mocks.documentRepo.attachToSession).toHaveBeenCalledWith('sess-1', 'doc-1');
});
```

- [ ] **Step 6.2: Run tests (expect failures)**

Run: `npx vitest run server/application/ingestion/__tests__/IngestionService.test.ts`
Expected: type errors / failures because `IngestionService` still requires `sessionId`.

- [ ] **Step 6.3: Replace `IngestionService` implementation**

```ts
import { ChunkingService } from '../../../domain/services/ChunkingService';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import { FileType } from '../../../domain/value-objects/FileType';
import { IDocumentRepository } from '../repositories/IDocumentRepository';
import { IChunkRepository } from '../repositories/IChunkRepository';
import { IEmbeddingClient } from '../ports/IEmbeddingClient';
import { IFileParser } from '../ports/IFileParser';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';

interface IngestParams {
	buffer: Buffer;
	fileName: string;
	fileType: FileType;
	userId: string;
	chunkingStrategy?: ChunkingStrategy;
	attachToSession?: string;
}

interface IngestionServiceDeps {
	documentRepo: IDocumentRepository;
	chunkRepo: IChunkRepository;
	parsers: Record<FileType, IFileParser>;
	embeddingClient: IEmbeddingClient;
	chunkingService: ChunkingService;
}

export class IngestionService {
	private documentRepo: IDocumentRepository;
	private chunkRepo: IChunkRepository;
	private parsers: Record<FileType, IFileParser>;
	private embeddingClient: IEmbeddingClient;
	private chunkingService: ChunkingService;

	constructor(deps: IngestionServiceDeps) {
		this.documentRepo = deps.documentRepo;
		this.chunkRepo = deps.chunkRepo;
		this.parsers = deps.parsers;
		this.embeddingClient = deps.embeddingClient;
		this.chunkingService = deps.chunkingService;
	}

	async ingest(params: IngestParams): Promise<IngestResponseDto> {
		const strategy = params.chunkingStrategy ?? 'RECURSIVE';
		const parser = this.parsers[params.fileType];
		const text = await parser.parse(params.buffer);

		const chunkTexts = this.chunkingService.chunk(text, strategy);
		const embeddings = await this.embeddingClient.embedBatch(chunkTexts);

		const document = await this.documentRepo.create({
			name: params.fileName,
			fileType: params.fileType,
			chunkingStrategy: strategy,
			userId: params.userId,
		});

		try {
			await this.chunkRepo.saveMany(
				chunkTexts.map((content, i) => ({
					content,
					embedding: embeddings[i],
					documentId: document.id,
				})),
			);
		} catch (err) {
			await this.documentRepo.deleteById(document.id, params.userId).catch(() => {});
			throw err;
		}

		if (params.attachToSession) {
			await this.documentRepo.attachToSession(params.attachToSession, document.id);
		}

		return { documentId: document.id, chunkCount: chunkTexts.length, name: params.fileName };
	}
}
```

- [ ] **Step 6.4: Run tests (expect pass)**

Run: `npx vitest run server/application/ingestion/__tests__/IngestionService.test.ts`
Expected: PASS, including the new `attachToSession` test.

- [ ] **Step 6.5: Commit**

```bash
git add server/application/ingestion
git commit -m "feat(ingestion): drop sessionId; add optional attachToSession auto-attach"
```

---

## Task 7: Update `RetrievalService` for `documentIds`

**Files:**

- Modify: `server/application/retrieval/RetrievalService.ts`
- Modify: `server/application/retrieval/__tests__/RetrievalService.test.ts`

- [ ] **Step 7.1: Update the test (TDD)**

In `server/application/retrieval/__tests__/RetrievalService.test.ts`, the existing tests only exercise `buildAugmentedPrompt` (which is unchanged). Add a new test below the existing `describe('buildAugmentedPrompt', ...)` block:

```ts
describe('stream', () => {
	it('passes documentIds[] to similaritySearch', async () => {
		const chunkRepo = {
			similaritySearch: vi.fn().mockResolvedValue([]),
		} as unknown as IChunkRepository;
		const llmClient = {
			streamMessage: async function* () {},
			generateText: vi.fn().mockResolvedValue(''),
		} as unknown as ILLMClient;
		const service = new RetrievalService(makeDeps({ chunkRepo, llmClient }));

		const gen = service.stream({
			message: 'q',
			sessionId: 's',
			documentIds: ['doc-a', 'doc-b'],
			documentNames: { 'doc-a': 'A.pdf', 'doc-b': 'B.pdf' },
			userId: 'u',
			userRole: 'USER',
			rerankingEnabled: false,
		});
		// drain
		for await (const _ of gen) {
			void _;
		}

		expect(chunkRepo.similaritySearch).toHaveBeenCalledWith(
			expect.objectContaining({ documentIds: ['doc-a', 'doc-b'], userId: 'u' }),
		);
	});
});
```

- [ ] **Step 7.2: Run tests (expect failure on the new test)**

Run: `npx vitest run server/application/retrieval/__tests__/RetrievalService.test.ts`
Expected: existing tests pass, new test fails (signature mismatch).

- [ ] **Step 7.3: Update `RetrievalService.stream`**

In `server/application/retrieval/RetrievalService.ts`:

1. Replace the `StreamParams` interface:

```ts
interface StreamParams {
	message: string;
	sessionId: string;
	documentIds: string[];
	documentNames: Record<string, string>;
	userId: string;
	userRole: 'USER' | 'ADMIN';
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}
```

2. Inside `stream(...)`:
   - Replace the existing `chunkRepo.similaritySearch(...)` call with `documentIds: params.documentIds`.
   - Replace the citation construction so each citation uses the chunk's source document:

```ts
const sources: CitationDto[] = reranked.map((chunk, i) => ({
	index: i + 1,
	content: chunk.content.slice(0, 200),
	documentName: params.documentNames[chunk.documentId] ?? 'Unknown',
}));
```

- In the LLM-Ops log call, replace `documentId: params.documentId` with `documentId: params.documentIds[0] ?? ''` (we keep one ID for log compatibility — see Task 9 for log column note). Also remove the now-unused `params.documentName` reference. Keep the rest of the method intact.

- [ ] **Step 7.4: Run tests (expect pass)**

Run: `npx vitest run server/application/retrieval/__tests__/RetrievalService.test.ts`
Expected: PASS.

- [ ] **Step 7.5: Commit**

```bash
git add server/application/retrieval
git commit -m "feat(retrieval): accept documentIds[] and per-doc citation names"
```

---

## Task 8: Update `SessionService` with new validators

**Files:**

- Modify: `server/application/session/SessionService.ts`
- Create or modify: `server/application/session/__tests__/SessionService.test.ts`

- [ ] **Step 8.1: Update `SessionService`**

Append two methods to the existing class (replace the file body around `validateLimit` to also include these):

```ts
async validateDocumentsLimit(userId: string, role: UserRole, currentCount: number): Promise<void> {
	const limit = LIMITS_BY_ROLE[role].maxDocumentsPerUser;
	if (limit === Infinity) return;
	if (currentCount >= limit) throw new Error('documents_limit_reached');
}

async validateAttachedLimit(role: UserRole, currentCount: number): Promise<void> {
	const limit = LIMITS_BY_ROLE[role].maxAttachedPerSession;
	if (limit === Infinity) return;
	if (currentCount >= limit) throw new Error('attached_limit_reached');
}
```

- [ ] **Step 8.2: Add tests**

Open (or create) `server/application/session/__tests__/SessionService.test.ts`. If it already exists, append; otherwise create with this minimal content:

```ts
import { describe, it, expect, vi } from 'vitest';
import { SessionService } from '../SessionService';
import type { IChatSessionRepository } from '../../repositories/IChatSessionRepository';
import type { IUserUsageRepository } from '../../repositories/IUserUsageRepository';

const makeService = () =>
	new SessionService(
		{} as unknown as IChatSessionRepository,
		{ getTodayCount: vi.fn(), increment: vi.fn() } as unknown as IUserUsageRepository,
	);

describe('SessionService.validateDocumentsLimit', () => {
	it('throws when USER reaches maxDocumentsPerUser (20)', async () => {
		const s = makeService();
		await expect(s.validateDocumentsLimit('u', 'USER', 20)).rejects.toThrow(
			'documents_limit_reached',
		);
	});
	it('passes when below limit', async () => {
		const s = makeService();
		await expect(s.validateDocumentsLimit('u', 'USER', 5)).resolves.toBeUndefined();
	});
	it('does not throw for ADMIN', async () => {
		const s = makeService();
		await expect(s.validateDocumentsLimit('u', 'ADMIN', 99999)).resolves.toBeUndefined();
	});
});

describe('SessionService.validateAttachedLimit', () => {
	it('throws when USER reaches maxAttachedPerSession (10)', async () => {
		const s = makeService();
		await expect(s.validateAttachedLimit('USER', 10)).rejects.toThrow('attached_limit_reached');
	});
	it('passes when below limit', async () => {
		const s = makeService();
		await expect(s.validateAttachedLimit('USER', 3)).resolves.toBeUndefined();
	});
});
```

- [ ] **Step 8.3: Run tests**

Run: `npx vitest run server/application/session`
Expected: all tests pass.

- [ ] **Step 8.4: Commit**

```bash
git add server/application/session
git commit -m "feat(session): add documents and attached count limit validators"
```

---

## Task 9: Update `/api/ingest` route

**Files:**

- Modify: `app/api/ingest/route.ts`

- [ ] **Step 9.1: Replace route handler**

```ts
import { NextRequest, NextResponse } from 'next/server';
import {
	authContext,
	ingestionService,
	chatSessionRepo,
	documentRepo,
	sessionService,
} from '@/server/infrastructure/http/container';
import { FileType } from '@/domain/value-objects/FileType';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';
import { MAX_FILE_SIZE_MB, SUPPORTED_FILE_TYPES } from '@/shared/config/constants';

const EXT_TO_FILE_TYPE: Record<string, FileType> = {
	pdf: 'PDF',
	txt: 'TXT',
	docx: 'DOCX',
};

export async function POST(req: NextRequest) {
	try {
		const user = await authContext.requireUser();

		const formData = await req.formData();
		const file = formData.get('file') as File | null;
		const attachToSession = (formData.get('attachToSession') as string | null) || undefined;
		const chunkingStrategy =
			(formData.get('chunkingStrategy') as ChunkingStrategy | null) ?? 'RECURSIVE';

		if (!file) {
			return NextResponse.json({ error: 'no_file' }, { status: 400 });
		}

		if (attachToSession) {
			const session = await chatSessionRepo.findById(attachToSession, user.id);
			if (!session) {
				return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
			}
			const attachedCount = await documentRepo.countAttached(attachToSession);
			await sessionService.validateAttachedLimit(user.role, attachedCount);
		}

		const docCount = await documentRepo.countByUser(user.id);
		await sessionService.validateDocumentsLimit(user.id, user.role, docCount);

		const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
		if (!SUPPORTED_FILE_TYPES.includes(ext as (typeof SUPPORTED_FILE_TYPES)[number])) {
			return NextResponse.json(
				{ error: 'unsupported_file_type', supported: SUPPORTED_FILE_TYPES },
				{ status: 400 },
			);
		}

		const sizeMB = file.size / (1024 * 1024);
		if (sizeMB > MAX_FILE_SIZE_MB) {
			return NextResponse.json(
				{ error: 'file_too_large', maxMB: MAX_FILE_SIZE_MB },
				{ status: 400 },
			);
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const fileType = EXT_TO_FILE_TYPE[ext];

		const result = await ingestionService.ingest({
			buffer,
			fileName: file.name,
			fileType,
			userId: user.id,
			chunkingStrategy,
			attachToSession,
		});

		return NextResponse.json(result, { status: 201 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		if (err instanceof Error && err.message === 'documents_limit_reached') {
			return NextResponse.json({ error: 'documents_limit_reached' }, { status: 403 });
		}
		if (err instanceof Error && err.message === 'attached_limit_reached') {
			return NextResponse.json({ error: 'attached_limit_reached' }, { status: 403 });
		}
		// eslint-disable-next-line no-console
		console.error('[ingest] failed:', err);
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: 'internal_error', message }, { status: 500 });
	}
}
```

- [ ] **Step 9.2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `app/api/ingest/route.ts`.

- [ ] **Step 9.3: Commit**

```bash
git add app/api/ingest/route.ts
git commit -m "feat(api): /api/ingest is global; attachToSession optional"
```

---

## Task 10: Update `/api/documents` route + add DELETE

**Files:**

- Modify: `app/api/documents/route.ts`
- Create: `app/api/documents/[id]/route.ts`

- [ ] **Step 10.1: Replace `app/api/documents/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { authContext } from '@/server/infrastructure/http/container';
import { prisma } from '@/server/infrastructure/prisma-orm/prismaClient';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

export async function GET() {
	try {
		const user = await authContext.requireUser();

		const docs = await prisma.document.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			include: { _count: { select: { chunks: true } } },
		});

		const dtos: IngestResponseDto[] = docs.map(d => ({
			documentId: d.id,
			name: d.name,
			chunkCount: d._count.chunks,
			chunkingStrategy: d.chunkingStrategy,
		}));

		return NextResponse.json(dtos);
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[documents.list] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
```

- [ ] **Step 10.2: Create `app/api/documents/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { authContext, documentRepo } from '@/server/infrastructure/http/container';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;

		const doc = await documentRepo.findById(id, user.id);
		if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });

		await documentRepo.deleteById(id, user.id);
		return new NextResponse(null, { status: 204 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[documents.delete] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
```

- [ ] **Step 10.3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in these two files.

- [ ] **Step 10.4: Commit**

```bash
git add app/api/documents
git commit -m "feat(api): /api/documents lists per-user; add DELETE /api/documents/:id"
```

---

## Task 11: Add `/api/session/[id]/documents` (attach/list/detach)

**Files:**

- Create: `app/api/session/[id]/documents/route.ts`
- Create: `app/api/session/[id]/documents/[documentId]/route.ts`

- [ ] **Step 11.1: Create list/attach route**

`app/api/session/[id]/documents/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import {
	authContext,
	chatSessionRepo,
	documentRepo,
	sessionService,
} from '@/server/infrastructure/http/container';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

		const docs = await documentRepo.findAttachedToSession(id, user.id);
		const dtos: IngestResponseDto[] = docs.map(d => ({
			documentId: d.id,
			name: d.name,
			chunkCount: 0,
			chunkingStrategy: d.chunkingStrategy,
		}));
		return NextResponse.json(dtos);
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[session.docs.list] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;
		const body = (await req.json()) as { documentId?: string };
		if (!body.documentId) {
			return NextResponse.json({ error: 'missing_document_id' }, { status: 400 });
		}

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

		const doc = await documentRepo.findById(body.documentId, user.id);
		if (!doc) return NextResponse.json({ error: 'document_not_found' }, { status: 404 });

		const attachedCount = await documentRepo.countAttached(id);
		await sessionService.validateAttachedLimit(user.role, attachedCount);

		await documentRepo.attachToSession(id, body.documentId);
		return new NextResponse(null, { status: 204 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		if (err instanceof Error && err.message === 'attached_limit_reached') {
			return NextResponse.json({ error: 'attached_limit_reached' }, { status: 403 });
		}
		// eslint-disable-next-line no-console
		console.error('[session.docs.attach] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
```

- [ ] **Step 11.2: Create detach route**

`app/api/session/[id]/documents/[documentId]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { authContext, chatSessionRepo, documentRepo } from '@/server/infrastructure/http/container';

export async function DELETE(
	_req: Request,
	{ params }: { params: Promise<{ id: string; documentId: string }> },
) {
	try {
		const user = await authContext.requireUser();
		const { id, documentId } = await params;

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

		await documentRepo.detachFromSession(id, documentId);
		return new NextResponse(null, { status: 204 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[session.docs.detach] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
```

- [ ] **Step 11.3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in these two files.

- [ ] **Step 11.4: Commit**

```bash
git add app/api/session
git commit -m "feat(api): session attachments — GET/POST list/attach, DELETE detach"
```

---

## Task 12: Update `/api/chat` route for `documentIds[]`

**Files:**

- Modify: `shared/dtos/ChatRequestDto.ts`
- Modify: `app/api/chat/route.ts`

- [ ] **Step 12.1: Update DTO**

Replace `shared/dtos/ChatRequestDto.ts`:

```ts
export interface ChatRequestDto {
	message: string;
	sessionId: string;
	documentIds: string[];
	chunkingStrategy?: 'FIXED' | 'SENTENCE' | 'PARAGRAPH' | 'RECURSIVE';
	topK?: number;
	rerankingEnabled?: boolean;
}
```

- [ ] **Step 12.2: Replace `app/api/chat/route.ts`**

Key changes: validate that every requested `documentId` (a) belongs to the user and (b) is attached to the session. Build `documentNames` map. Pass to `retrievalService.stream`.

```ts
import { NextRequest } from 'next/server';
import {
	authContext,
	retrievalService,
	documentRepo,
	chatSessionRepo,
} from '@/server/infrastructure/http/container';
import { ChatRequestDto } from '@/shared/dtos/ChatRequestDto';
import { TOP_K_CHUNKS } from '@/shared/config/constants';

export async function POST(req: NextRequest) {
	try {
		const user = await authContext.requireUser();
		const body: ChatRequestDto = await req.json();

		if (
			!body.message ||
			!body.sessionId ||
			!Array.isArray(body.documentIds) ||
			body.documentIds.length === 0
		) {
			return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 });
		}

		const session = await chatSessionRepo.findById(body.sessionId, user.id);
		if (!session) {
			return new Response(JSON.stringify({ error: 'session_not_found' }), { status: 404 });
		}

		const attached = await documentRepo.findAttachedToSession(body.sessionId, user.id);
		const attachedById = new Map(attached.map(d => [d.id, d]));
		for (const id of body.documentIds) {
			if (!attachedById.has(id)) {
				return new Response(JSON.stringify({ error: 'document_not_attached' }), { status: 400 });
			}
		}
		const documentNames: Record<string, string> = {};
		for (const id of body.documentIds) {
			documentNames[id] = attachedById.get(id)!.name;
		}

		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				try {
					const gen = retrievalService.stream({
						message: body.message,
						sessionId: body.sessionId,
						documentIds: body.documentIds,
						documentNames,
						userId: user.id,
						userRole: user.role,
						chunkingStrategy: body.chunkingStrategy ?? 'RECURSIVE',
						topK: body.topK ?? TOP_K_CHUNKS,
						rerankingEnabled: body.rerankingEnabled ?? true,
					});

					for await (const event of gen) {
						if (typeof event === 'object' && 'sources' in event) {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({ type: 'sources', sources: event.sources })}\n\n`,
								),
							);
						} else if (typeof event === 'object' && 'title' in event) {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({ type: 'title', sessionId: event.sessionId, title: event.title })}\n\n`,
								),
							);
						} else if (typeof event === 'string') {
							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: event })}\n\n`),
							);
						}
					}

					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				} catch (err: unknown) {
					if (err instanceof Error && err.message === 'limit_reached') {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: 'limit_reached' })}\n\n`),
						);
					} else {
						// eslint-disable-next-line no-console
						console.error('[chat] stream failed:', err);
						const message = err instanceof Error ? err.message : String(err);
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: 'internal_error', message })}\n\n`),
						);
					}
				} finally {
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
		}
		return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
	}
}
```

- [ ] **Step 12.3: Typecheck**

Run: `npx tsc --noEmit`
Expected: only client-side files still red, no server errors.

- [ ] **Step 12.4: Commit**

```bash
git add shared/dtos/ChatRequestDto.ts app/api/chat/route.ts
git commit -m "feat(api): /api/chat accepts documentIds[]; validates ownership + attachment"
```

---

## Task 13: Client API contracts and HTTP impls

**Files:**

- Modify: `client/application/api/IIngestionApi.ts`
- Modify: `client/application/api/IChatApi.ts`
- Modify: `client/infrastructure/http/IngestionApi.ts`
- Modify: `client/application/services/IngestionClientService.ts`

- [ ] **Step 13.1: `IIngestionApi`**

```ts
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface IngestParams {
	file: File;
	chunkingStrategy?: ChunkingStrategy;
	attachToSession?: string;
}

export interface IIngestionApi {
	ingest(params: IngestParams): Promise<IngestResponseDto>;
	getDocuments(): Promise<IngestResponseDto[]>;
	deleteDocument(id: string): Promise<void>;
	getAttached(sessionId: string): Promise<IngestResponseDto[]>;
	attachToSession(sessionId: string, documentId: string): Promise<void>;
	detachFromSession(sessionId: string, documentId: string): Promise<void>;
}
```

- [ ] **Step 13.2: `IChatApi.StreamChatParams`**

In `client/application/api/IChatApi.ts`, change `documentId: string` → `documentIds: string[]`:

```ts
export interface StreamChatParams {
	message: string;
	sessionId: string;
	documentIds: string[];
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}
```

- [ ] **Step 13.3: `IngestionApi` HTTP impl**

```ts
import { IIngestionApi, IngestParams } from '../../application/api/IIngestionApi';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';

export class IngestionApi implements IIngestionApi {
	async ingest({
		file,
		chunkingStrategy,
		attachToSession,
	}: IngestParams): Promise<IngestResponseDto> {
		const formData = new FormData();
		formData.append('file', file);
		if (chunkingStrategy) formData.append('chunkingStrategy', chunkingStrategy);
		if (attachToSession) formData.append('attachToSession', attachToSession);

		const res = await fetch('/api/ingest', { method: 'POST', body: formData });
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'upload_failed' }));
			throw new Error(err.error ?? 'upload_failed');
		}
		return res.json();
	}

	async getDocuments(): Promise<IngestResponseDto[]> {
		const res = await fetch('/api/documents');
		if (!res.ok) throw new Error('documents_fetch_failed');
		return res.json();
	}

	async deleteDocument(id: string): Promise<void> {
		const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('document_delete_failed');
	}

	async getAttached(sessionId: string): Promise<IngestResponseDto[]> {
		const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/documents`);
		if (!res.ok) throw new Error('attached_fetch_failed');
		return res.json();
	}

	async attachToSession(sessionId: string, documentId: string): Promise<void> {
		const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/documents`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ documentId }),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'attach_failed' }));
			throw new Error(err.error ?? 'attach_failed');
		}
	}

	async detachFromSession(sessionId: string, documentId: string): Promise<void> {
		const res = await fetch(
			`/api/session/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(documentId)}`,
			{ method: 'DELETE' },
		);
		if (!res.ok) throw new Error('detach_failed');
	}
}
```

- [ ] **Step 13.4: `IngestionClientService`**

```ts
import { IIngestionApi, IngestParams } from '../api/IIngestionApi';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';

export class IngestionClientService {
	constructor(private api: IIngestionApi) {}

	async upload(params: IngestParams): Promise<IngestResponseDto> {
		return this.api.ingest(params);
	}
}
```

- [ ] **Step 13.5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in stores and pages — fixed in next tasks.

- [ ] **Step 13.6: Commit**

```bash
git add client/application/api client/infrastructure/http/IngestionApi.ts client/application/services/IngestionClientService.ts
git commit -m "feat(client-api): global documents + attach endpoints, documentIds in chat"
```

---

## Task 14: Rework `uploadStore` to be user-global

**Files:**

- Modify: `client/stores/uploadStore.ts`

- [ ] **Step 14.1: Replace the file**

```ts
'use client';
import { create } from 'zustand';
import { IngestResponseDto } from '../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { ingestionClientService, ingestionApi } from '../infrastructure/container';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadOptions {
	chunkingStrategy?: ChunkingStrategy;
	attachToSession?: string;
}

interface UploadState {
	status: UploadStatus;
	documents: IngestResponseDto[];
	loaded: boolean;
	lastDocument: IngestResponseDto | null;
	error: string | null;
	reset: () => void;
	fetchDocuments: () => Promise<void>;
	upload: (file: File, options?: UploadOptions) => Promise<IngestResponseDto | null>;
	removeDocument: (id: string) => Promise<void>;
}

export const useUploadStore = create<UploadState>((set, get) => ({
	status: 'idle',
	documents: [],
	loaded: false,
	lastDocument: null,
	error: null,

	reset: () =>
		set({ status: 'idle', error: null, lastDocument: null, documents: [], loaded: false }),

	fetchDocuments: async () => {
		try {
			const documents = await ingestionApi.getDocuments();
			set({ documents, loaded: true });
		} catch (e: unknown) {
			set({ error: e instanceof Error ? e.message : 'documents_fetch_failed' });
		}
	},

	upload: async (file, options) => {
		set({ status: 'uploading', error: null });
		try {
			const document = await ingestionClientService.upload({
				file,
				chunkingStrategy: options?.chunkingStrategy,
				attachToSession: options?.attachToSession,
			});
			set({
				status: 'success',
				lastDocument: document,
				documents: [document, ...get().documents],
			});
			return document;
		} catch (e: unknown) {
			set({ status: 'error', error: e instanceof Error ? e.message : 'upload_failed' });
			return null;
		}
	},

	removeDocument: async (id: string) => {
		try {
			await ingestionApi.deleteDocument(id);
			set({ documents: get().documents.filter(d => d.documentId !== id) });
		} catch (e: unknown) {
			set({ error: e instanceof Error ? e.message : 'document_delete_failed' });
		}
	},
}));
```

- [ ] **Step 14.2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors now in `Chat/index.tsx`, `Documents/index.tsx`, `KnowledgePanel/index.tsx`, `chatStore.ts`.

- [ ] **Step 14.3: Commit**

```bash
git add client/stores/uploadStore.ts
git commit -m "refactor(uploadStore): user-global document list + delete"
```

---

## Task 15: New `attachmentStore`

**Files:**

- Create: `client/stores/attachmentStore.ts`

- [ ] **Step 15.1: Create the store**

```ts
'use client';
import { create } from 'zustand';
import { IngestResponseDto } from '../../shared/dtos/IngestResponseDto';
import { ingestionApi } from '../infrastructure/container';

interface AttachmentState {
	attachedBySession: Record<string, IngestResponseDto[]>;
	activeBySession: Record<string, Set<string>>;
	loadedSessions: Set<string>;
	error: string | null;

	loadAttached: (sessionId: string) => Promise<void>;
	attach: (sessionId: string, doc: IngestResponseDto) => Promise<void>;
	detach: (sessionId: string, documentId: string) => Promise<void>;
	toggleActive: (sessionId: string, documentId: string) => void;
	setAllActive: (sessionId: string) => void;
	clearForSession: (sessionId: string) => void;
}

export const useAttachmentStore = create<AttachmentState>((set, get) => ({
	attachedBySession: {},
	activeBySession: {},
	loadedSessions: new Set(),
	error: null,

	loadAttached: async (sessionId: string) => {
		try {
			const docs = await ingestionApi.getAttached(sessionId);
			set(state => ({
				attachedBySession: { ...state.attachedBySession, [sessionId]: docs },
				activeBySession: {
					...state.activeBySession,
					[sessionId]: new Set(docs.map(d => d.documentId)),
				},
				loadedSessions: new Set([...state.loadedSessions, sessionId]),
			}));
		} catch (e: unknown) {
			set({ error: e instanceof Error ? e.message : 'attached_fetch_failed' });
		}
	},

	attach: async (sessionId, doc) => {
		try {
			await ingestionApi.attachToSession(sessionId, doc.documentId);
			set(state => {
				const existing = state.attachedBySession[sessionId] ?? [];
				if (existing.some(d => d.documentId === doc.documentId)) return state;
				const newActive = new Set(state.activeBySession[sessionId] ?? []);
				newActive.add(doc.documentId);
				return {
					attachedBySession: {
						...state.attachedBySession,
						[sessionId]: [doc, ...existing],
					},
					activeBySession: { ...state.activeBySession, [sessionId]: newActive },
				};
			});
		} catch (e: unknown) {
			set({ error: e instanceof Error ? e.message : 'attach_failed' });
		}
	},

	detach: async (sessionId, documentId) => {
		try {
			await ingestionApi.detachFromSession(sessionId, documentId);
			set(state => {
				const existing = state.attachedBySession[sessionId] ?? [];
				const newActive = new Set(state.activeBySession[sessionId] ?? []);
				newActive.delete(documentId);
				return {
					attachedBySession: {
						...state.attachedBySession,
						[sessionId]: existing.filter(d => d.documentId !== documentId),
					},
					activeBySession: { ...state.activeBySession, [sessionId]: newActive },
				};
			});
		} catch (e: unknown) {
			set({ error: e instanceof Error ? e.message : 'detach_failed' });
		}
	},

	toggleActive: (sessionId, documentId) => {
		set(state => {
			const current = new Set(state.activeBySession[sessionId] ?? []);
			if (current.has(documentId)) current.delete(documentId);
			else current.add(documentId);
			return { activeBySession: { ...state.activeBySession, [sessionId]: current } };
		});
	},

	setAllActive: (sessionId: string) => {
		const docs = get().attachedBySession[sessionId] ?? [];
		set(state => ({
			activeBySession: {
				...state.activeBySession,
				[sessionId]: new Set(docs.map(d => d.documentId)),
			},
		}));
	},

	clearForSession: (sessionId: string) => {
		set(state => {
			const { [sessionId]: _a, ...attached } = state.attachedBySession;
			const { [sessionId]: _b, ...active } = state.activeBySession;
			return { attachedBySession: attached, activeBySession: active };
		});
	},
}));
```

- [ ] **Step 15.2: Typecheck**

Run: `npx tsc --noEmit`
Expected: same set of errors as before (UI not yet wired).

- [ ] **Step 15.3: Commit**

```bash
git add client/stores/attachmentStore.ts
git commit -m "feat(client): attachmentStore for per-session attached docs and active set"
```

---

## Task 16: Update `chatStore` for `documentIds`

**Files:**

- Modify: `client/stores/chatStore.ts`

- [ ] **Step 16.1: Change `SendMessageParams.documentId` → `documentIds: string[]`**

In `client/stores/chatStore.ts`, replace the `SendMessageParams` interface:

```ts
interface SendMessageParams {
	message: string;
	sessionId: string;
	documentIds: string[];
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}
```

No other changes are needed — the rest of the store passes `params` opaquely to `chatSessionService.send`.

- [ ] **Step 16.2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `Chat/index.tsx`, `Documents/index.tsx`, `KnowledgePanel/index.tsx` — these are wired in the next tasks.

- [ ] **Step 16.3: Commit**

```bash
git add client/stores/chatStore.ts
git commit -m "refactor(chatStore): documentIds[] in send params"
```

---

## Task 17: Build chat UI multi-select chips and Add-from-Library dialog

**Files:**

- Create: `presentation/web/pages/Chat/AttachmentChips/index.tsx`
- Create: `presentation/web/pages/Chat/AddFromLibraryDialog/index.tsx`
- Modify: `presentation/web/pages/Chat/index.tsx`
- Modify: `presentation/web/pages/Chat/KnowledgePanel/index.tsx`

- [ ] **Step 17.1: Create `AttachmentChips`**

```tsx
'use client';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

interface Props {
	docs: IngestResponseDto[];
	active: Set<string>;
	onToggle: (id: string) => void;
	onDetach: (id: string) => void;
}

export function AttachmentChips({ docs, active, onToggle, onDetach }: Props) {
	return (
		<div className='flex flex-wrap items-center gap-1.5'>
			{docs.map(d => {
				const isActive = active.has(d.documentId);
				return (
					<span
						key={d.documentId}
						className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
							isActive
								? 'border-primary/40 bg-primary/10 text-primary'
								: 'border-border bg-muted text-muted-foreground'
						}`}
					>
						<button
							type='button'
							onClick={() => onToggle(d.documentId)}
							className='cursor-pointer'
							title={isActive ? 'Deactivate (will not be searched)' : 'Activate'}
						>
							{d.name}
						</button>
						<button
							type='button'
							onClick={() => onDetach(d.documentId)}
							className='text-muted-foreground hover:text-destructive cursor-pointer'
							title='Detach from chat'
						>
							×
						</button>
					</span>
				);
			})}
		</div>
	);
}
```

- [ ] **Step 17.2: Create `AddFromLibraryDialog`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useUploadStore } from '@/client/stores/uploadStore';
import { useAttachmentStore } from '@/client/stores/attachmentStore';

interface Props {
	sessionId: string;
	open: boolean;
	onClose: () => void;
}

export function AddFromLibraryDialog({ sessionId, open, onClose }: Props) {
	const { documents, loaded, fetchDocuments } = useUploadStore();
	const { attachedBySession, attach } = useAttachmentStore();
	const attachedIds = new Set((attachedBySession[sessionId] ?? []).map(d => d.documentId));
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		if (open && !loaded) void fetchDocuments();
	}, [open, loaded, fetchDocuments]);

	if (!open) return null;

	const handleAttach = async (id: string) => {
		const doc = documents.find(d => d.documentId === id);
		if (!doc) return;
		setBusyId(id);
		try {
			await attach(sessionId, doc);
		} finally {
			setBusyId(null);
		}
	};

	return (
		<div
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
			onClick={onClose}
		>
			<div
				className='bg-background w-[420px] max-w-[92vw] rounded-md border p-4 shadow-lg'
				onClick={e => e.stopPropagation()}
			>
				<div className='mb-3 flex items-center justify-between'>
					<h3 className='text-sm font-semibold'>Add from library</h3>
					<button onClick={onClose} className='text-muted-foreground hover:text-foreground text-xs'>
						Close
					</button>
				</div>
				{documents.length === 0 ? (
					<p className='text-muted-foreground py-6 text-center text-xs'>
						No documents in your library yet.
					</p>
				) : (
					<ul className='max-h-[60vh] space-y-1 overflow-auto'>
						{documents.map(d => {
							const already = attachedIds.has(d.documentId);
							return (
								<li
									key={d.documentId}
									className='hover:bg-muted flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs'
								>
									<span className='truncate'>{d.name}</span>
									<button
										disabled={already || busyId === d.documentId}
										onClick={() => handleAttach(d.documentId)}
										className='text-primary disabled:text-muted-foreground cursor-pointer disabled:cursor-default'
									>
										{already ? 'Attached' : busyId === d.documentId ? '…' : 'Attach'}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
```

- [ ] **Step 17.3: Replace `presentation/web/pages/Chat/index.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useChatStore } from '@/client/stores/chatStore';
import { useControlsStore } from '@/client/stores/controlsStore';
import { useAttachmentStore } from '@/client/stores/attachmentStore';
import { useUploadStore } from '@/client/stores/uploadStore';
import { MessageList } from '@/presentation/web/components/MessageList';
import { MessageInput } from '@/presentation/web/components/MessageInput';
import { LimitBadge } from '@/presentation/web/components/LimitBadge';
import { AttachmentChips } from './AttachmentChips';
import { AddFromLibraryDialog } from './AddFromLibraryDialog';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

export function ChatPage() {
	const { sessions, activeSessionId, fetchSessions, createSession } = useSessionStore();
	const { messages, citationsByMessageId, isStreaming, sendMessage } = useChatStore();
	const { chunkingStrategy, topK, rerankingEnabled } = useControlsStore();
	const { fetchDocuments } = useUploadStore();
	const { attachedBySession, activeBySession, loadAttached, toggleActive, detach } =
		useAttachmentStore();
	const [libraryOpen, setLibraryOpen] = useState(false);

	const sessionId = activeSessionId ?? sessions[0]?.id ?? null;
	const attached = sessionId ? (attachedBySession[sessionId] ?? []) : [];
	const active = sessionId ? (activeBySession[sessionId] ?? new Set<string>()) : new Set<string>();
	const activeIds = Array.from(active);

	useEffect(() => {
		fetchSessions();
		fetchDocuments();
	}, [fetchSessions, fetchDocuments]);

	useEffect(() => {
		if (sessionId) void loadAttached(sessionId);
	}, [sessionId, loadAttached]);

	const handleSend = async (message: string) => {
		if (activeIds.length === 0) return;
		let sid = sessionId;
		if (!sid) {
			const ns = await createSession();
			sid = ns.id;
		}
		await sendMessage({
			message,
			sessionId: sid,
			documentIds: activeIds,
			chunkingStrategy,
			topK,
			rerankingEnabled,
		});
	};

	const sourcesCount = Object.values(citationsByMessageId).reduce((s, c) => s + c.length, 0);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: 'var(--paper)',
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					padding: '14px 24px',
					borderBottom: '1px solid var(--powder-200)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					background: 'var(--paper)',
					flexShrink: 0,
					gap: 12,
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
					<div
						style={{
							width: 8,
							height: 8,
							borderRadius: '50%',
							background: 'var(--terracotta-500)',
							animation: 'pulse-dot 2.5s ease-in-out infinite',
						}}
					/>
					<span
						style={{
							fontFamily: 'var(--font-fraunces), serif',
							fontSize: 18,
							fontWeight: 300,
							color: 'var(--cobalt-800)',
						}}
					>
						Knowledge Assistant
					</span>

					<AttachmentChips
						docs={attached}
						active={active}
						onToggle={id => sessionId && toggleActive(sessionId, id)}
						onDetach={id => sessionId && detach(sessionId, id)}
					/>

					<button
						onClick={() => setLibraryOpen(true)}
						disabled={!sessionId}
						className='cursor-pointer text-xs underline'
						style={{ color: 'var(--cobalt-700)' }}
					>
						+ Add from library
					</button>
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<LimitBadge remaining={null} />
					<div
						style={{
							...MONO,
							fontSize: 10,
							letterSpacing: '0.15em',
							textTransform: 'uppercase',
							color: 'var(--smoke)',
						}}
					>
						{sourcesCount} sources · {activeIds.length} active
					</div>
				</div>
			</div>

			{attached.length === 0 ? (
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 12,
						padding: 40,
					}}
				>
					<div
						style={{
							fontFamily: 'var(--font-fraunces), serif',
							fontStyle: 'italic',
							fontSize: 24,
							color: 'var(--cobalt-800)',
							opacity: 0.6,
						}}
					>
						No documents attached to this chat
					</div>
					<button onClick={() => setLibraryOpen(true)} className='cursor-pointer text-xs underline'>
						+ Add from library
					</button>
				</div>
			) : (
				<MessageList
					messages={messages}
					citationsByMessageId={citationsByMessageId}
					isStreaming={isStreaming}
				/>
			)}

			<MessageInput
				onSend={handleSend}
				disabled={activeIds.length === 0}
				isStreaming={isStreaming}
				placeholder={
					activeIds.length === 0
						? 'Attach or activate a document first…'
						: 'Ask anything about your knowledge base…'
				}
			/>

			{sessionId && (
				<AddFromLibraryDialog
					sessionId={sessionId}
					open={libraryOpen}
					onClose={() => setLibraryOpen(false)}
				/>
			)}
		</div>
	);
}
```

- [ ] **Step 17.4: Update `KnowledgePanel`**

`presentation/web/pages/Chat/KnowledgePanel/index.tsx` — replace with:

```tsx
'use client';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { useAttachmentStore } from '@/client/stores/attachmentStore';

interface KnowledgePanelProps {
	sessionId: string | null;
	activeIds: Set<string>;
	onToggle: (id: string) => void;
}

export function KnowledgePanel({ sessionId, activeIds, onToggle }: KnowledgePanelProps) {
	const { attachedBySession } = useAttachmentStore();
	const docs = sessionId ? (attachedBySession[sessionId] ?? []) : [];

	return (
		<div className='bg-muted/10 flex w-52 shrink-0 flex-col border-r'>
			<div className='flex items-center justify-between border-b px-3 py-3'>
				<span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
					Attached
				</span>
				<Link href='/documents' className='text-muted-foreground hover:text-foreground'>
					<Plus className='h-3.5 w-3.5' />
				</Link>
			</div>

			<div className='flex-1 space-y-0.5 overflow-auto p-2'>
				{docs.length === 0 && (
					<p className='text-muted-foreground px-2 py-2 text-xs'>
						No documents attached.{' '}
						<Link href='/documents' className='underline'>
							Library
						</Link>
					</p>
				)}
				{docs.map(doc => {
					const isActive = activeIds.has(doc.documentId);
					return (
						<button
							key={doc.documentId}
							onClick={() => onToggle(doc.documentId)}
							className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
								isActive
									? 'bg-primary/10 text-primary border-primary/20 border'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'
							}`}
						>
							<FileText className='h-3 w-3 shrink-0' />
							<span className='truncate'>{doc.name}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
```

If `KnowledgePanel` is not currently rendered from `Chat/index.tsx` (it isn't in the version above), no further wiring is needed; this keeps the component buildable for the rest of the layout.

- [ ] **Step 17.5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors remaining only in `Documents/index.tsx`.

- [ ] **Step 17.6: Commit**

```bash
git add presentation/web/pages/Chat
git commit -m "feat(ui): chat header multi-select chips + add-from-library dialog"
```

---

## Task 18: Update `/documents` page to be global

**Files:**

- Modify: `presentation/web/pages/Documents/index.tsx`

- [ ] **Step 18.1: Replace `DocumentsPage` body**

Replace the `DocumentsPage` function (lines starting `export function DocumentsPage()`) with:

```tsx
export function DocumentsPage() {
	const { documents, status, upload, fetchDocuments, removeDocument } = useUploadStore();
	const [strategy, setStrategy] = useState<ChunkingStrategy>('RECURSIVE');
	const [selected, setSelected] = useState<IngestResponseDto | null>(null);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		fetchDocuments();
	}, [fetchDocuments]);

	const handleFile = async (file: File) => {
		setProgress(10);
		const progressInterval = setInterval(() => {
			setProgress(p => Math.min(p + Math.random() * 12, 90));
		}, 200);

		try {
			await upload(file, { chunkingStrategy: strategy });
			setProgress(100);
		} finally {
			clearInterval(progressInterval);
			setTimeout(() => setProgress(0), 600);
		}
	};

	const totalChunks = documents.reduce((a, d) => a + d.chunkCount, 0);
	const uploading = status === 'uploading';

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: 'var(--paper)',
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					padding: '18px 28px',
					borderBottom: '1px solid var(--powder-200)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexShrink: 0,
					background: 'var(--paper)',
				}}
			>
				<div>
					<h1
						style={{
							fontFamily: 'var(--font-fraunces), serif',
							fontWeight: 300,
							fontSize: 22,
							color: 'var(--cobalt-800)',
							letterSpacing: '-0.01em',
							fontStyle: 'italic',
						}}
					>
						Documents
					</h1>
					<div
						style={{
							...MONO,
							fontSize: 10,
							color: 'var(--smoke)',
							letterSpacing: '0.1em',
							textTransform: 'uppercase',
							marginTop: 2,
						}}
					>
						{documents.length} files · {totalChunks} chunks indexed
					</div>
				</div>
				<div style={{ display: 'flex', gap: 8 }}>
					{STRATEGIES.map(s => (
						<button
							key={s.id}
							onClick={() => setStrategy(s.id)}
							title={s.desc}
							style={{
								padding: '7px 14px',
								background: strategy === s.id ? 'var(--cobalt-800)' : 'var(--paper)',
								color: strategy === s.id ? 'var(--paper)' : 'var(--smoke)',
								border: `1px solid ${strategy === s.id ? 'var(--cobalt-800)' : 'var(--powder-300)'}`,
								borderRadius: 7,
								fontFamily: 'inherit',
								fontSize: 12,
								cursor: 'pointer',
								transition: 'all 0.15s',
							}}
						>
							{s.label}
						</button>
					))}
				</div>
			</div>

			<div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
				<div
					style={{
						flex: 1,
						overflowY: 'auto',
						padding: '24px 28px',
						display: 'flex',
						flexDirection: 'column',
						gap: 20,
					}}
				>
					<FileDropzone
						onFile={handleFile}
						disabled={uploading}
						uploading={uploading}
						progress={Math.round(progress)}
					/>

					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 12,
							padding: '10px 16px',
							background: 'var(--sand)',
							borderRadius: 8,
						}}
					>
						<div
							style={{
								width: 6,
								height: 6,
								borderRadius: 1,
								background: 'var(--terracotta-500)',
								flexShrink: 0,
							}}
						/>
						<span
							style={{
								...MONO,
								fontSize: 10,
								letterSpacing: '0.12em',
								textTransform: 'uppercase',
								color: 'var(--terracotta-700)',
							}}
						>
							Strategy:
						</span>
						<span
							style={{
								fontFamily: 'inherit',
								fontSize: 12,
								color: 'var(--cobalt-800)',
								fontWeight: 500,
							}}
						>
							{STRATEGIES.find(s => s.id === strategy)?.label}
						</span>
						<span style={{ ...MONO, fontSize: 11, color: 'var(--smoke)' }}>
							— {STRATEGIES.find(s => s.id === strategy)?.desc}
						</span>
					</div>

					<DocumentTable
						documents={documents}
						selectedId={selected?.documentId ?? null}
						onSelect={setSelected}
						onDelete={removeDocument}
					/>
				</div>

				{selected && <ChunkPreviewPanel doc={selected} onClose={() => setSelected(null)} />}
			</div>
		</div>
	);
}
```

Also add `useEffect` to the existing `useState` import line:

```tsx
import { useEffect, useState } from 'react';
```

And remove the now-unused `useSessionStore` import (top of file).

- [ ] **Step 18.2: Add `onDelete` to `DocumentTable`**

Open `presentation/web/pages/Documents/DocumentTable/index.tsx` and add an optional `onDelete?: (id: string) => Promise<void> | void` prop to the props interface, and a small "delete" button per row:

If you don't want to over-edit, the minimum change is:

1. Add `onDelete?: (id: string) => Promise<void> | void;` to the props interface.
2. In the row render, add at the end:

```tsx
{
	onDelete && (
		<button
			onClick={e => {
				e.stopPropagation();
				void onDelete(doc.documentId);
			}}
			title='Delete document'
			className='text-muted-foreground hover:text-destructive ml-2 cursor-pointer'
		>
			×
		</button>
	);
}
```

(Adapt to the existing JSX structure of `DocumentTable`. If the component already supports a delete via a different prop name, reuse that.)

- [ ] **Step 18.3: Typecheck and run dev server smoke**

```
npx tsc --noEmit
```

Expected: 0 errors.

```
npm run dev
```

Then in the browser:

1. Sign in.
2. Open `/documents` (with no active session) → upload a TXT — works without picking a chat.
3. Create a new chat session → header is empty, "+ Add from library" → attach the doc → it appears as an active chip.
4. Send a message → response cites the attached doc.
5. Click a chip to deactivate → next message uses fewer docs (or none → input disabled).
6. Detach (×) → doc disappears from the chat header but stays in `/documents`.
7. Delete in `/documents` → row gone; if it was attached anywhere it's gone there too (cascade).

If anything is broken, fix in this task before committing.

- [ ] **Step 18.4: Commit**

```bash
git add presentation/web/pages/Documents
git commit -m "feat(ui): /documents is a global library; supports delete"
```

---

## Task 19: Wire upload-from-chat auto-attach (optional polish)

**Files:**

- Modify: `presentation/web/pages/Chat/index.tsx` (only if you want a chat-side upload widget)

This task is only needed if there's a place on the Chat page that calls `useUploadStore().upload(...)` directly. The current `Chat/index.tsx` does not — uploads happen on `/documents`. If your branch has any `FileDropzone` rendered inside Chat, change its handler to:

```ts
await upload(file, { chunkingStrategy, attachToSession: sessionId ?? undefined });
if (sessionId) await loadAttached(sessionId);
```

If no chat-side dropzone exists, **skip this task** (the explicit “+ Add from library” path is sufficient).

- [ ] **Step 19.1: If applicable, edit the chat-side dropzone handler as above.**
- [ ] **Step 19.2: Commit only if changes were made.**

```bash
git add presentation/web/pages/Chat
git commit -m "feat(ui): chat-side uploads auto-attach to current session"
```

---

## Task 20: Final typecheck, tests, and manual smoke

**Files:** none (verification only)

- [ ] **Step 20.1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 20.2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 20.3: Browser smoke (golden path)**

1. Sign out / sign in fresh.
2. Navigate to `/documents` — upload `a.txt` and `b.txt`.
3. Open a new chat — header is empty. Click `+ Add from library`, attach both. Both chips appear active.
4. Ask a question with content present in `a.txt` — verify citation references `a.txt`.
5. Ask a question with content present in `b.txt` — verify citation references `b.txt`.
6. Click chip for `b.txt` to deactivate. Ask a `b.txt`-specific question — model should answer "I don't have enough information…".
7. Detach `b.txt` — chip disappears. Reload page — it does not come back.
8. Delete `b.txt` from `/documents` — row removed. The chat that had it attached no longer has the chip (because cascade removes the join row).
9. Open old/new chats — every chat sees only its own attachments. New chats start empty.

- [ ] **Step 20.4: Commit anything that needed a final tweak**

```bash
git status
# if dirty:
git add -A
git commit -m "chore: post-rollout fixes for global documents"
```

---

# Notes for the engineer

- The Prisma client uses a custom output path (`prisma/generated/prisma`), so make sure to regenerate after Step 1.3 if the IDE shows stale types: `npx prisma generate`.
- The `Document` entity is now narrower (no `sessionId`); any code that read `doc.sessionId` is dead and must be removed (the typecheck will surface it).
- `LLMLog` keeps a single `documentId` column; we log the first item from `documentIds`. Don't widen the schema for this — out of scope.
- The chat history prompt construction is unchanged; the only retrieval-side change is the `IN`-style filter and per-doc citation names.
- Limit error semantics:
  - 403 `documents_limit_reached` — user library already at cap.
  - 403 `attached_limit_reached` — session attachment cap reached.
  - 403 `limit_reached` — daily query cap (existing).
- Cascade behavior: deleting a `Document` deletes its `Chunk`s (existing) and `SessionDocument` rows (new). Deleting a `ChatSession` deletes its `SessionDocument` rows (the docs themselves remain in the user's library).
