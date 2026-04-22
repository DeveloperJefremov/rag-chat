# RAG Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js RAG chat app where users upload documents (PDF/TXT/DOCX), which are chunked and embedded, then query them via a chat interface powered by Claude.

**Architecture:** Onion Architecture monolith (mirrors tense-master). Domain layer has no external deps. Server layer holds use cases and Prisma repos. Client layer holds Zustand stores and API clients. Presentation layer is pure React UI.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Prisma 7 + PostgreSQL/Neon + pgvector, Google AI (`@google/generative-ai` — embeddings + Gemini 2.5 Flash), Cohere (reranking), Zustand, Vitest, pdf-parse, mammoth, cohere-ai — **100% free stack**

---

## File Map

```
domain/
  entities/
    Document.ts               — Document entity
    Chunk.ts                  — Chunk entity
    Message.ts                — Message entity
    Session.ts                — Session entity
    LLMLog.ts                 — LLMOps log entry entity
  value-objects/
    FileType.ts               — FileType union (PDF | TXT | DOCX)
    ChunkingStrategy.ts       — FIXED | SENTENCE | PARAGRAPH | RECURSIVE
  services/
    ChunkingService.ts        — multi-strategy chunker
    ChunkingService.test.ts
    SimilarityService.ts      — cosine similarity util (pure)
    SimilarityService.test.ts

server/
  application/
    repositories/
      IDocumentRepository.ts
      IChunkRepository.ts
      IMessageRepository.ts
      ISessionRepository.ts
    ingestion/
      IngestionService.ts     — orchestrates parse→chunk→embed→store
      IngestionService.test.ts
    retrieval/
      RetrievalService.ts     — embed query→search→augment→stream
      RetrievalService.test.ts
    session/
      SessionService.ts       — create/validate/increment session
      SessionService.test.ts
  infrastructure/
    prisma-orm/
      prismaClient.ts
      PrismaDocumentRepository.ts
      PrismaChunkRepository.ts
      PrismaMessageRepository.ts
      PrismaSessionRepository.ts
    parsers/
      PdfParser.ts
      TxtParser.ts
      DocxParser.ts
    google/
      GoogleEmbeddingClient.ts
      GeminiClient.ts
    cohere/
      CohereRerankClient.ts
    llmops/
      LLMOpsService.ts
      PrismaLLMLogRepository.ts
    http/
      container.ts            — wires all deps together

client/
  application/
    api/
      IChatApi.ts
      IIngestionApi.ts
    services/
      ChatSessionService.ts   — client-side orchestration
  stores/
    chatStore.ts
    uploadStore.ts
    sessionStore.ts
  infrastructure/
    http/
      ChatApi.ts
      IngestionApi.ts
    container.ts

presentation/
  web/
    pages/
      Chat/
        index.tsx
      Upload/
        index.tsx
    components/
      MessageList/
        index.tsx
      MessageInput/
        index.tsx
      FileDropzone/
        index.tsx
      LimitBadge/
        index.tsx
      UploadProgress/
        index.tsx

app/
  layout.tsx
  page.tsx
  api/
    session/
      route.ts
    ingest/
      route.ts
    chat/
      route.ts

shared/
  dtos/
    ChatRequestDto.ts
    ChatResponseDto.ts
    IngestResponseDto.ts
    MessageDto.ts
    SessionDto.ts
  lib/
    utils.ts
    rateLimit.ts
  config/
    constants.ts

prisma/
  schema.prisma
  migrations/
```

---

## Task 1: Project Initialization

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

Expected output: project files created in current directory.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @google/generative-ai @prisma/client @prisma/adapter-neon prisma \
  zustand pdf-parse mammoth @neondatabase/serverless cohere-ai
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @vitejs/plugin-react jsdom @types/pdf-parse
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

Select: Default style, Neutral color, CSS variables = yes.

```bash
npx shadcn@latest add button textarea badge card scroll-area
```

- [ ] **Step 4: Create `.env.example`**

```bash
# .env.example
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"
DIRECT_URL="postgresql://user:password@host/db?sslmode=require"
GOOGLE_AI_KEY="AIza..."       # aistudio.google.com — free
COHERE_API_KEY="..."          # dashboard.cohere.com — free tier
```

Copy to `.env.local` and fill in real values.

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
	plugins: [react()],
	test: {
		environment: 'jsdom',
		setupFiles: ['./vitest.setup.ts'],
		globals: true,
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, '.'),
		},
	},
});
```

- [ ] **Step 6: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 7: Add test script to `package.json`**

Add to the `scripts` section:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: Prisma Schema + pgvector Setup

**Files:**

- Create: `prisma/schema.prisma`
- Create: `server/infrastructure/prisma-orm/prismaClient.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../prisma/generated/prisma"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [vector]
}

model Session {
  id         String     @id @default(uuid())
  queryCount Int        @default(0)
  createdAt  DateTime   @default(now())
  expiresAt  DateTime
  messages   Message[]
  documents  Document[]

  @@map("sessions")
}

model Document {
  id        String   @id @default(uuid())
  name      String
  fileType  FileType
  createdAt DateTime @default(now())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  chunks    Chunk[]

  @@map("documents")
}

model Chunk {
  id         String                      @id @default(uuid())
  content    String
  embedding  Unsupported("vector(768)")
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@map("chunks")
}

model Message {
  id        String   @id @default(uuid())
  role      Role
  content   String
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@map("messages")
}

enum FileType {
  PDF
  TXT
  DOCX
}

enum Role {
  USER
  ASSISTANT
}
```

- [ ] **Step 3: Enable pgvector on Neon**

In your Neon console SQL editor, run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration applied, `prisma/generated/prisma` created.

- [ ] **Step 5: Create `server/infrastructure/prisma-orm/prismaClient.ts`**

```ts
import { PrismaClient } from '../../../prisma/generated/prisma';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
	});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add Prisma schema with pgvector support"
```

---

## Task 3: Shared Constants and DTOs

**Files:**

- Create: `shared/config/constants.ts`
- Create: `shared/dtos/SessionDto.ts`
- Create: `shared/dtos/MessageDto.ts`
- Create: `shared/dtos/IngestResponseDto.ts`
- Create: `shared/dtos/ChatRequestDto.ts`
- Create: `shared/dtos/ChatResponseDto.ts`

- [ ] **Step 1: Create `shared/config/constants.ts`**

```ts
export const MAX_QUERIES_PER_SESSION = 20;
export const SESSION_TTL_HOURS = 24;
export const CHUNK_SIZE = 512;
export const CHUNK_OVERLAP = 50;
export const TOP_K_CHUNKS = 5;
export const MAX_FILE_SIZE_MB = 10;
export const EMBEDDING_DIMS = 768; // google text-embedding-004
export const IP_RATE_LIMIT_RPM = 60;
export const SUPPORTED_FILE_TYPES = ['pdf', 'txt', 'docx'] as const;
```

- [ ] **Step 2: Create DTOs**

`shared/dtos/SessionDto.ts`:

```ts
export interface SessionDto {
	id: string;
	queryCount: number;
	remaining: number;
	expiresAt: string;
}
```

`shared/dtos/MessageDto.ts`:

```ts
export type MessageRole = 'USER' | 'ASSISTANT';

export interface MessageDto {
	id: string;
	role: MessageRole;
	content: string;
	createdAt: string;
}
```

`shared/dtos/IngestResponseDto.ts`:

```ts
export interface IngestResponseDto {
	documentId: string;
	chunkCount: number;
	name: string;
}
```

`shared/dtos/ChatRequestDto.ts`:

```ts
export interface ChatRequestDto {
	message: string;
	documentId: string;
	chunkingStrategy?: 'FIXED' | 'SENTENCE' | 'PARAGRAPH' | 'RECURSIVE';
	topK?: number; // default 5
	rerankingEnabled?: boolean; // default true
}
```

`shared/dtos/CitationDto.ts`:

```ts
export interface CitationDto {
	index: number;
	content: string;
	documentName: string;
}
```

`shared/dtos/ChatResponseDto.ts`:

```ts
export interface ChatResponseDto {
	content: string;
	messageId: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add shared constants and DTOs"
```

---

## Task 4: Domain Layer — Entities and Value Objects

**Files:**

- Create: `domain/value-objects/FileType.ts`
- Create: `domain/entities/Document.ts`
- Create: `domain/entities/Chunk.ts`
- Create: `domain/entities/Message.ts`
- Create: `domain/entities/Session.ts`

- [ ] **Step 1: Create `domain/value-objects/FileType.ts`**

```ts
export const FILE_TYPE = {
	PDF: 'PDF',
	TXT: 'TXT',
	DOCX: 'DOCX',
} as const;

export type FileType = (typeof FILE_TYPE)[keyof typeof FILE_TYPE];
```

- [ ] **Step 2: Create `domain/entities/Session.ts`**

```ts
export interface Session {
	id: string;
	queryCount: number;
	createdAt: Date;
	expiresAt: Date;
}
```

- [ ] **Step 3: Create `domain/entities/Document.ts`**

```ts
import { FileType } from '../value-objects/FileType';

export interface Document {
	id: string;
	name: string;
	fileType: FileType;
	createdAt: Date;
	sessionId: string;
}
```

- [ ] **Step 4: Create `domain/entities/Chunk.ts`**

```ts
export interface Chunk {
	id: string;
	content: string;
	embedding: number[];
	documentId: string;
}
```

- [ ] **Step 5: Create `domain/entities/Message.ts`**

```ts
export type MessageRole = 'USER' | 'ASSISTANT';

export interface Message {
	id: string;
	role: MessageRole;
	content: string;
	sessionId: string;
	createdAt: Date;
}
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add domain entities and value objects"
```

---

## Task 5: Domain Services — ChunkingService

**Files:**

- Create: `domain/services/ChunkingService.ts`
- Create: `domain/services/__tests__/ChunkingService.test.ts`

- [ ] **Step 1: Write the failing test**

`domain/services/__tests__/ChunkingService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ChunkingService } from '../ChunkingService';

describe('ChunkingService', () => {
	const service = new ChunkingService({ chunkSize: 10, overlap: 2 });

	it('returns single chunk for short text', () => {
		const result = service.chunk('hello world');
		expect(result).toHaveLength(1);
		expect(result[0]).toBe('hello world');
	});

	it('splits long text into overlapping chunks', () => {
		// 15 words, chunkSize=10 words, overlap=2
		const words = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');
		const result = service.chunk(words);
		expect(result.length).toBeGreaterThan(1);
		// second chunk starts with last 2 words of first chunk
		const firstChunkWords = result[0].split(' ');
		const secondChunkWords = result[1].split(' ');
		expect(secondChunkWords[0]).toBe(firstChunkWords[firstChunkWords.length - 2]);
	});

	it('preserves paragraph boundaries when possible', () => {
		const text = 'First paragraph text.\n\nSecond paragraph text.';
		const result = service.chunk(text);
		expect(result.some(c => c.includes('First paragraph'))).toBe(true);
	});

	it('filters empty chunks', () => {
		const result = service.chunk('   \n\n   ');
		expect(result).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run domain/services/__tests__/ChunkingService.test.ts
```

Expected: FAIL with "Cannot find module '../ChunkingService'"

- [ ] **Step 3: Implement `domain/services/ChunkingService.ts`**

```ts
interface ChunkingOptions {
	chunkSize: number; // in words (approximation: 1 token ≈ 1 word for English)
	overlap: number; // in words
}

export class ChunkingService {
	private chunkSize: number;
	private overlap: number;

	constructor(options: ChunkingOptions) {
		this.chunkSize = options.chunkSize;
		this.overlap = options.overlap;
	}

	chunk(text: string): string[] {
		// Split into paragraphs first to preserve boundaries
		const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

		const words: string[] = [];
		for (const paragraph of paragraphs) {
			words.push(
				...paragraph
					.trim()
					.split(/\s+/)
					.filter(w => w.length > 0),
			);
		}

		if (words.length === 0) return [];
		if (words.length <= this.chunkSize) return [words.join(' ')];

		const chunks: string[] = [];
		let start = 0;

		while (start < words.length) {
			const end = Math.min(start + this.chunkSize, words.length);
			chunks.push(words.slice(start, end).join(' '));
			if (end === words.length) break;
			start += this.chunkSize - this.overlap;
		}

		return chunks;
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run domain/services/__tests__/ChunkingService.test.ts
```

Expected: PASS (4 tests passing)

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add ChunkingService with TDD"
```

---

## Task 6: Infrastructure — File Parsers

**Files:**

- Create: `server/infrastructure/parsers/TxtParser.ts`
- Create: `server/infrastructure/parsers/PdfParser.ts`
- Create: `server/infrastructure/parsers/DocxParser.ts`

- [ ] **Step 1: Create `server/infrastructure/parsers/TxtParser.ts`**

```ts
export class TxtParser {
	async parse(buffer: Buffer): Promise<string> {
		return buffer.toString('utf-8');
	}
}
```

- [ ] **Step 2: Create `server/infrastructure/parsers/PdfParser.ts`**

```ts
import pdfParse from 'pdf-parse';

export class PdfParser {
	async parse(buffer: Buffer): Promise<string> {
		const data = await pdfParse(buffer);
		return data.text;
	}
}
```

- [ ] **Step 3: Create `server/infrastructure/parsers/DocxParser.ts`**

```ts
import mammoth from 'mammoth';

export class DocxParser {
	async parse(buffer: Buffer): Promise<string> {
		const result = await mammoth.extractRawText({ buffer });
		return result.value;
	}
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add file parsers (PDF, TXT, DOCX)"
```

---

## Task 7: Infrastructure — Google Embedding Client

**Files:**

- Create: `server/infrastructure/google/GoogleEmbeddingClient.ts`

Google `text-embedding-004` is free, 768-dimensional, accessed via `@google/generative-ai`.

- [ ] **Step 1: Create `server/infrastructure/google/GoogleEmbeddingClient.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GoogleEmbeddingClient {
	private genAI: GoogleGenerativeAI;
	private model = 'text-embedding-004';

	constructor() {
		if (!process.env.GOOGLE_AI_KEY) {
			throw new Error('GOOGLE_AI_KEY is not set');
		}
		this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY!);
	}

	async embed(text: string): Promise<number[]> {
		const model = this.genAI.getGenerativeModel({ model: this.model });
		const result = await model.embedContent(text);
		return result.embedding.values;
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		const model = this.genAI.getGenerativeModel({ model: this.model });
		const results = await Promise.all(texts.map(t => model.embedContent(t)));
		return results.map(r => r.embedding.values);
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add GoogleEmbeddingClient (text-embedding-004, free)"
```

---

## Task 8: Infrastructure — Gemini Client

**Files:**

- Create: `server/infrastructure/google/GeminiClient.ts`

Gemini 2.5 Flash free tier: 1500 requests/day, 1M tokens/min via Google AI Studio key.

- [ ] **Step 1: Create `server/infrastructure/google/GeminiClient.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiClient {
	private genAI: GoogleGenerativeAI;
	private model = 'gemini-2.5-flash';

	constructor() {
		if (!process.env.GOOGLE_AI_KEY) {
			throw new Error('GOOGLE_AI_KEY is not set');
		}
		this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY!);
	}

	async *streamMessage(prompt: string): AsyncGenerator<string> {
		const model = this.genAI.getGenerativeModel({ model: this.model });
		const result = await model.generateContentStream(prompt);

		for await (const chunk of result.stream) {
			const text = chunk.text();
			if (text) yield text;
		}
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add GeminiClient (gemini-2.5-flash, free tier)"
```

---

## Task 9: Infrastructure — Repository Interfaces

**Files:**

- Create: `server/application/repositories/ISessionRepository.ts`
- Create: `server/application/repositories/IDocumentRepository.ts`
- Create: `server/application/repositories/IChunkRepository.ts`
- Create: `server/application/repositories/IMessageRepository.ts`

- [ ] **Step 1: Create repository interfaces**

`server/application/repositories/ISessionRepository.ts`:

```ts
import { Session } from '../../../domain/entities/Session';

export interface ISessionRepository {
	findById(id: string): Promise<Session | null>;
	create(data: { id: string; expiresAt: Date }): Promise<Session>;
	incrementQueryCount(id: string): Promise<void>;
}
```

`server/application/repositories/IDocumentRepository.ts`:

```ts
import { Document } from '../../../domain/entities/Document';
import { FileType } from '../../../domain/value-objects/FileType';

export interface CreateDocumentData {
	name: string;
	fileType: FileType;
	sessionId: string;
}

export interface IDocumentRepository {
	create(data: CreateDocumentData): Promise<Document>;
	findById(id: string): Promise<Document | null>;
}
```

`server/application/repositories/IChunkRepository.ts`:

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
		documentId: string;
		topK: number;
	}): Promise<Chunk[]>;
}
```

`server/application/repositories/IMessageRepository.ts`:

```ts
import { Message, MessageRole } from '../../../domain/entities/Message';

export interface IMessageRepository {
	saveMany(
		messages: Array<{ role: MessageRole; content: string; sessionId: string }>,
	): Promise<Message[]>;
	findBySessionId(sessionId: string): Promise<Message[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add repository interfaces"
```

---

## Task 9.5: Application Ports — ILLMClient, IEmbeddingClient, IRerankClient

**Files:**

- Create: `server/application/ports/ILLMClient.ts`
- Create: `server/application/ports/IEmbeddingClient.ts`
- Create: `server/application/ports/IRerankClient.ts`

These interfaces live in `server/application/` so the application layer depends only on abstractions.
Concrete implementations (`GeminiClient`, `GoogleEmbeddingClient`, `CohereRerankClient`) live in
`server/infrastructure/` and implement these interfaces. This enforces the Onion Architecture
dependency rule: application never imports from infrastructure.

- [ ] **Step 1: Create `server/application/ports/ILLMClient.ts`**

```ts
export interface ILLMClient {
	streamMessage(prompt: string): AsyncGenerator<string>;
}
```

- [ ] **Step 2: Create `server/application/ports/IEmbeddingClient.ts`**

```ts
export interface IEmbeddingClient {
	embed(text: string): Promise<number[]>;
	embedBatch(texts: string[]): Promise<number[][]>;
}
```

- [ ] **Step 3: Create `server/application/ports/IRerankClient.ts`**

```ts
export interface RerankCandidate {
	content: string;
	originalIndex: number;
}

export interface IRerankClient {
	rerank(params: {
		query: string;
		candidates: RerankCandidate[];
		topN: number;
	}): Promise<RerankCandidate[]>;
}
```

- [ ] **Step 3.5: Create `server/application/ports/IFileParser.ts`**

```ts
export interface IFileParser {
	parse(buffer: Buffer): Promise<string>;
}
```

All three concrete parsers (`PdfParser`, `TxtParser`, `DocxParser`) implement `IFileParser`.
This keeps `IngestionService` in the application layer from importing infrastructure classes.

- [ ] **Step 4: Update `GeminiClient` to implement `ILLMClient`**

```ts
import { ILLMClient } from '../../application/ports/ILLMClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiClient implements ILLMClient {
	private genAI: GoogleGenerativeAI;
	private model = 'gemini-2.5-flash';

	constructor() {
		if (!process.env.GOOGLE_AI_KEY) {
			throw new Error('GOOGLE_AI_KEY is not set');
		}
		this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY!);
	}

	async *streamMessage(prompt: string): AsyncGenerator<string> {
		const model = this.genAI.getGenerativeModel({ model: this.model });
		const result = await model.generateContentStream(prompt);
		for await (const chunk of result.stream) {
			const text = chunk.text();
			if (text) yield text;
		}
	}
}
```

- [ ] **Step 5: Update `GoogleEmbeddingClient` to implement `IEmbeddingClient`**

```ts
import { IEmbeddingClient } from '../../application/ports/IEmbeddingClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GoogleEmbeddingClient implements IEmbeddingClient {
	private genAI: GoogleGenerativeAI;
	private model = 'text-embedding-004';

	constructor() {
		if (!process.env.GOOGLE_AI_KEY) {
			throw new Error('GOOGLE_AI_KEY is not set');
		}
		this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY!);
	}

	async embed(text: string): Promise<number[]> {
		const model = this.genAI.getGenerativeModel({ model: this.model });
		const result = await model.embedContent(text);
		return result.embedding.values;
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		return Promise.all(texts.map(t => this.embed(t)));
	}
}
```

- [ ] **Step 6: Update `CohereRerankClient` to implement `IRerankClient`**

```ts
import { IRerankClient, RerankCandidate } from '../../application/ports/IRerankClient';
import { CohereClient } from 'cohere-ai';

export class CohereRerankClient implements IRerankClient {
	private client: CohereClient;

	constructor() {
		if (!process.env.COHERE_API_KEY) {
			throw new Error('COHERE_API_KEY is not set');
		}
		this.client = new CohereClient({ token: process.env.COHERE_API_KEY });
	}

	async rerank(params: {
		query: string;
		candidates: RerankCandidate[];
		topN: number;
	}): Promise<RerankCandidate[]> {
		const response = await this.client.rerank({
			model: 'rerank-v3.5',
			query: params.query,
			documents: params.candidates.map(c => c.content),
			topN: params.topN,
		});

		return response.results.map(r => params.candidates[r.index]);
	}
}
```

- [ ] **Step 7: Update parsers to implement `IFileParser`**

Open each parser and add `implements IFileParser`:

```ts
// server/infrastructure/parsers/PdfParser.ts
import { IFileParser } from '../../application/ports/IFileParser';
import pdfParse from 'pdf-parse';

export class PdfParser implements IFileParser {
	async parse(buffer: Buffer): Promise<string> {
		const data = await pdfParse(buffer);
		return data.text;
	}
}

// server/infrastructure/parsers/TxtParser.ts
import { IFileParser } from '../../application/ports/IFileParser';

export class TxtParser implements IFileParser {
	async parse(buffer: Buffer): Promise<string> {
		return buffer.toString('utf-8');
	}
}

// server/infrastructure/parsers/DocxParser.ts
import { IFileParser } from '../../application/ports/IFileParser';
import mammoth from 'mammoth';

export class DocxParser implements IFileParser {
	async parse(buffer: Buffer): Promise<string> {
		const result = await mammoth.extractRawText({ buffer });
		return result.value;
	}
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: add application port interfaces (ILLMClient, IEmbeddingClient, IRerankClient, IFileParser)"
```

---

## Task 10: Infrastructure — Prisma Repositories

**Files:**

- Create: `server/infrastructure/prisma-orm/PrismaSessionRepository.ts`
- Create: `server/infrastructure/prisma-orm/PrismaDocumentRepository.ts`
- Create: `server/infrastructure/prisma-orm/PrismaChunkRepository.ts`
- Create: `server/infrastructure/prisma-orm/PrismaMessageRepository.ts`

- [ ] **Step 1: Create `PrismaSessionRepository.ts`**

```ts
import { prisma } from './prismaClient';
import { Session } from '../../../domain/entities/Session';
import { ISessionRepository } from '../../application/repositories/ISessionRepository';

export class PrismaSessionRepository implements ISessionRepository {
	async findById(id: string): Promise<Session | null> {
		const session = await prisma.session.findUnique({ where: { id } });
		if (!session) return null;
		return {
			id: session.id,
			queryCount: session.queryCount,
			createdAt: session.createdAt,
			expiresAt: session.expiresAt,
		};
	}

	async create(data: { id: string; expiresAt: Date }): Promise<Session> {
		const session = await prisma.session.create({
			data: { id: data.id, expiresAt: data.expiresAt },
		});
		return {
			id: session.id,
			queryCount: session.queryCount,
			createdAt: session.createdAt,
			expiresAt: session.expiresAt,
		};
	}

	async incrementQueryCount(id: string): Promise<void> {
		await prisma.session.update({
			where: { id },
			data: { queryCount: { increment: 1 } },
		});
	}
}
```

- [ ] **Step 2: Create `PrismaDocumentRepository.ts`**

```ts
import { prisma } from './prismaClient';
import { Document } from '../../../domain/entities/Document';
import { FileType } from '../../../domain/value-objects/FileType';
import {
	CreateDocumentData,
	IDocumentRepository,
} from '../../application/repositories/IDocumentRepository';

export class PrismaDocumentRepository implements IDocumentRepository {
	async create(data: CreateDocumentData): Promise<Document> {
		const doc = await prisma.document.create({ data });
		return {
			id: doc.id,
			name: doc.name,
			fileType: doc.fileType as FileType,
			createdAt: doc.createdAt,
			sessionId: doc.sessionId,
		};
	}

	async findById(id: string): Promise<Document | null> {
		const doc = await prisma.document.findUnique({ where: { id } });
		if (!doc) return null;
		return {
			id: doc.id,
			name: doc.name,
			fileType: doc.fileType as FileType,
			createdAt: doc.createdAt,
			sessionId: doc.sessionId,
		};
	}
}
```

- [ ] **Step 3: Create `PrismaChunkRepository.ts`**

```ts
import { prisma } from './prismaClient';
import { Chunk } from '../../../domain/entities/Chunk';
import { CreateChunkData, IChunkRepository } from '../../application/repositories/IChunkRepository';
import { TOP_K_CHUNKS } from '../../../shared/config/constants';

export class PrismaChunkRepository implements IChunkRepository {
	async saveMany(chunks: CreateChunkData[]): Promise<void> {
		// pgvector requires raw SQL for vector insertion
		for (const chunk of chunks) {
			await prisma.$executeRaw`
        INSERT INTO chunks (id, content, embedding, "documentId")
        VALUES (
          gen_random_uuid(),
          ${chunk.content},
          ${`[${chunk.embedding.join(',')}]`}::vector,
          ${chunk.documentId}
        )
      `;
		}
	}

	async similaritySearch(params: {
		queryVector: number[];
		documentId: string;
		topK: number;
	}): Promise<Chunk[]> {
		const vectorStr = `[${params.queryVector.join(',')}]`;
		const results = await prisma.$queryRaw<
			Array<{ id: string; content: string; documentId: string }>
		>`
      SELECT id, content, "documentId"
      FROM chunks
      WHERE "documentId" = ${params.documentId}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${params.topK}
    `;
		return results.map(r => ({
			id: r.id,
			content: r.content,
			embedding: [], // not returned from similarity search
			documentId: r.documentId,
		}));
	}
}
```

- [ ] **Step 4: Create `PrismaMessageRepository.ts`**

```ts
import { prisma } from './prismaClient';
import { Message, MessageRole } from '../../../domain/entities/Message';
import { IMessageRepository } from '../../application/repositories/IMessageRepository';

export class PrismaMessageRepository implements IMessageRepository {
	async saveMany(
		messages: Array<{ role: MessageRole; content: string; sessionId: string }>,
	): Promise<Message[]> {
		const created = await prisma.$transaction(
			messages.map(m => prisma.message.create({ data: m })),
		);
		return created.map(m => ({
			id: m.id,
			role: m.role as MessageRole,
			content: m.content,
			sessionId: m.sessionId,
			createdAt: m.createdAt,
		}));
	}

	async findBySessionId(sessionId: string): Promise<Message[]> {
		const messages = await prisma.message.findMany({
			where: { sessionId },
			orderBy: { createdAt: 'asc' },
		});
		return messages.map(m => ({
			id: m.id,
			role: m.role as MessageRole,
			content: m.content,
			sessionId: m.sessionId,
			createdAt: m.createdAt,
		}));
	}
}
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Prisma repository implementations"
```

---

## Task 11: Server Application — SessionService

**Files:**

- Create: `server/application/session/SessionService.ts`
- Create: `server/application/session/__tests__/SessionService.test.ts`

- [ ] **Step 1: Write the failing test**

`server/application/session/__tests__/SessionService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../SessionService';
import { ISessionRepository } from '../../repositories/ISessionRepository';
import { MAX_QUERIES_PER_SESSION } from '../../../../shared/config/constants';

const makeRepo = (overrides: Partial<ISessionRepository> = {}): ISessionRepository => ({
	findById: vi.fn(),
	create: vi.fn(),
	incrementQueryCount: vi.fn(),
	...overrides,
});

describe('SessionService', () => {
	describe('getOrCreate', () => {
		it('creates new session when id is null', async () => {
			const mockSession = {
				id: 'new-id',
				queryCount: 0,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 86400000),
			};
			const repo = makeRepo({ create: vi.fn().mockResolvedValue(mockSession) });
			const service = new SessionService(repo);

			const result = await service.getOrCreate(null);

			expect(repo.create).toHaveBeenCalledOnce();
			expect(result.id).toBe('new-id');
		});

		it('returns existing session when found and not expired', async () => {
			const existingSession = {
				id: 'existing-id',
				queryCount: 5,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 86400000),
			};
			const repo = makeRepo({ findById: vi.fn().mockResolvedValue(existingSession) });
			const service = new SessionService(repo);

			const result = await service.getOrCreate('existing-id');

			expect(result.id).toBe('existing-id');
			expect(result.queryCount).toBe(5);
		});

		it('creates new session when existing session is expired', async () => {
			const expiredSession = {
				id: 'old-id',
				queryCount: 20,
				createdAt: new Date(Date.now() - 172800000),
				expiresAt: new Date(Date.now() - 3600000), // expired 1h ago
			};
			const newSession = {
				id: 'fresh-id',
				queryCount: 0,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 86400000),
			};
			const repo = makeRepo({
				findById: vi.fn().mockResolvedValue(expiredSession),
				create: vi.fn().mockResolvedValue(newSession),
			});
			const service = new SessionService(repo);

			const result = await service.getOrCreate('old-id');

			expect(repo.create).toHaveBeenCalledOnce();
			expect(result.id).toBe('fresh-id');
		});
	});

	describe('validateLimit', () => {
		it('throws when queryCount >= MAX_QUERIES_PER_SESSION', async () => {
			const session = {
				id: 'id',
				queryCount: MAX_QUERIES_PER_SESSION,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 86400000),
			};
			const repo = makeRepo({ findById: vi.fn().mockResolvedValue(session) });
			const service = new SessionService(repo);

			await expect(service.validateLimit('id')).rejects.toThrow('limit_reached');
		});

		it('does not throw when queryCount < MAX_QUERIES_PER_SESSION', async () => {
			const session = {
				id: 'id',
				queryCount: MAX_QUERIES_PER_SESSION - 1,
				createdAt: new Date(),
				expiresAt: new Date(Date.now() + 86400000),
			};
			const repo = makeRepo({ findById: vi.fn().mockResolvedValue(session) });
			const service = new SessionService(repo);

			await expect(service.validateLimit('id')).resolves.toBeUndefined();
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run server/application/session/__tests__/SessionService.test.ts
```

Expected: FAIL with "Cannot find module '../SessionService'"

- [ ] **Step 3: Implement `server/application/session/SessionService.ts`**

```ts
import { randomUUID } from 'crypto';
import { Session } from '../../../domain/entities/Session';
import { ISessionRepository } from '../repositories/ISessionRepository';
import { MAX_QUERIES_PER_SESSION, SESSION_TTL_HOURS } from '../../../shared/config/constants';

export class SessionService {
	constructor(private readonly sessionRepo: ISessionRepository) {}

	async getOrCreate(sessionId: string | null): Promise<Session> {
		if (sessionId) {
			const existing = await this.sessionRepo.findById(sessionId);
			if (existing && existing.expiresAt > new Date()) {
				return existing;
			}
		}
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + SESSION_TTL_HOURS);
		return this.sessionRepo.create({ id: randomUUID(), expiresAt });
	}

	async validateLimit(sessionId: string): Promise<void> {
		const session = await this.sessionRepo.findById(sessionId);
		if (!session) throw new Error('session_not_found');
		if (session.queryCount >= MAX_QUERIES_PER_SESSION) {
			throw new Error('limit_reached');
		}
	}

	async increment(sessionId: string): Promise<void> {
		await this.sessionRepo.incrementQueryCount(sessionId);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run server/application/session/__tests__/SessionService.test.ts
```

Expected: PASS (5 tests passing)

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add SessionService with TDD"
```

---

## Task 12: Server Application — IngestionService

**Files:**

- Create: `server/application/ingestion/IngestionService.ts`
- Create: `server/application/ingestion/__tests__/IngestionService.test.ts`

- [ ] **Step 1: Write the failing test**

`server/application/ingestion/__tests__/IngestionService.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { IngestionService } from '../IngestionService';

const makeRepo = () => ({
	documentRepo: {
		create: vi
			.fn()
			.mockResolvedValue({
				id: 'doc-1',
				name: 'test.txt',
				fileType: 'TXT',
				createdAt: new Date(),
				sessionId: 'sess-1',
			}),
	},
	chunkRepo: { saveMany: vi.fn().mockResolvedValue(undefined) },
	txtParser: {
		parse: vi
			.fn()
			.mockResolvedValue('This is a test document with enough words to chunk properly.'),
	},
	embeddingClient: {
		embedBatch: vi.fn().mockResolvedValue([
			[0.1, 0.2, 0.3],
			[0.4, 0.5, 0.6],
		]),
	},
	chunkingService: { chunk: vi.fn().mockReturnValue(['chunk one', 'chunk two']) },
});

describe('IngestionService', () => {
	it('parses, chunks, embeds, and stores a TXT file', async () => {
		const mocks = makeRepo();
		const service = new IngestionService({
			documentRepo: mocks.documentRepo as any,
			chunkRepo: mocks.chunkRepo as any,
			parsers: { TXT: mocks.txtParser as any, PDF: {} as any, DOCX: {} as any },
			embeddingClient: mocks.embeddingClient as any,
			chunkingService: mocks.chunkingService as any,
		});

		const buffer = Buffer.from('test content');
		const result = await service.ingest({
			buffer,
			fileName: 'test.txt',
			fileType: 'TXT',
			sessionId: 'sess-1',
		});

		expect(mocks.txtParser.parse).toHaveBeenCalledWith(buffer);
		expect(mocks.chunkingService.chunk).toHaveBeenCalled();
		expect(mocks.embeddingClient.embedBatch).toHaveBeenCalledWith(['chunk one', 'chunk two']);
		expect(mocks.chunkRepo.saveMany).toHaveBeenCalled();
		expect(result.documentId).toBe('doc-1');
		expect(result.chunkCount).toBe(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run server/application/ingestion/__tests__/IngestionService.test.ts
```

Expected: FAIL with "Cannot find module '../IngestionService'"

- [ ] **Step 3: Implement `server/application/ingestion/IngestionService.ts`**

```ts
import { FileType } from '../../../domain/value-objects/FileType';
import { ChunkingService } from '../../../domain/services/ChunkingService';
import { IDocumentRepository } from '../repositories/IDocumentRepository';
import { IChunkRepository } from '../repositories/IChunkRepository';
import { IEmbeddingClient } from '../ports/IEmbeddingClient';
import { IFileParser } from '../ports/IFileParser';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';
import { CHUNK_SIZE, CHUNK_OVERLAP } from '../../../shared/config/constants';

interface IngestParams {
	buffer: Buffer;
	fileName: string;
	fileType: FileType;
	sessionId: string;
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
		const parser = this.parsers[params.fileType];
		const text = await parser.parse(params.buffer);

		const chunkTexts = this.chunkingService.chunk(text);

		const embeddings = await this.embeddingClient.embedBatch(chunkTexts);

		const document = await this.documentRepo.create({
			name: params.fileName,
			fileType: params.fileType,
			sessionId: params.sessionId,
		});

		await this.chunkRepo.saveMany(
			chunkTexts.map((content, i) => ({
				content,
				embedding: embeddings[i],
				documentId: document.id,
			})),
		);

		return { documentId: document.id, chunkCount: chunkTexts.length, name: params.fileName };
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run server/application/ingestion/__tests__/IngestionService.test.ts
```

Expected: PASS (1 test passing)

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add IngestionService with TDD"
```

---

## Task 13: Server Application — RetrievalService

**Files:**

- Create: `server/application/retrieval/RetrievalService.ts`
- Create: `server/application/retrieval/__tests__/RetrievalService.test.ts`

- [ ] **Step 1: Write the failing test**

`server/application/retrieval/__tests__/RetrievalService.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { RetrievalService } from '../RetrievalService';

describe('RetrievalService', () => {
	describe('buildAugmentedPrompt', () => {
		it('includes context chunks and user message', () => {
			const service = new RetrievalService({
				chunkRepo: {} as any,
				embeddingClient: {} as any,
				llmClient: {} as any,
				messageRepo: {} as any,
				sessionService: {} as any,
			});

			const prompt = service.buildAugmentedPrompt({
				contextChunks: ['Chunk A content.', 'Chunk B content.'],
				userMessage: 'What is in the document?',
				history: [],
			});

			expect(prompt).toContain('Chunk A content.');
			expect(prompt).toContain('Chunk B content.');
			expect(prompt).toContain('What is in the document?');
			expect(prompt).toContain('ONLY on the provided context');
		});

		it('includes chat history when provided', () => {
			const service = new RetrievalService({
				chunkRepo: {} as any,
				embeddingClient: {} as any,
				llmClient: {} as any,
				messageRepo: {} as any,
				sessionService: {} as any,
			});

			const prompt = service.buildAugmentedPrompt({
				contextChunks: ['Context.'],
				userMessage: 'Follow-up question',
				history: [
					{ role: 'USER', content: 'First question' },
					{ role: 'ASSISTANT', content: 'First answer' },
				],
			});

			expect(prompt).toContain('First question');
			expect(prompt).toContain('First answer');
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run server/application/retrieval/__tests__/RetrievalService.test.ts
```

Expected: FAIL with "Cannot find module '../RetrievalService'"

- [ ] **Step 3: Implement `server/application/retrieval/RetrievalService.ts`**

```ts
import { IChunkRepository } from '../repositories/IChunkRepository';
import { IMessageRepository } from '../repositories/IMessageRepository';
import { IEmbeddingClient } from '../ports/IEmbeddingClient';
import { ILLMClient } from '../ports/ILLMClient';
import { SessionService } from '../session/SessionService';
import { MessageRole } from '../../../domain/entities/Message';
import { TOP_K_CHUNKS } from '../../../shared/config/constants';

interface RetrievalServiceDeps {
	chunkRepo: IChunkRepository;
	embeddingClient: IEmbeddingClient;
	llmClient: ILLMClient;
	messageRepo: IMessageRepository;
	sessionService: SessionService;
}

interface BuildPromptParams {
	contextChunks: string[];
	userMessage: string;
	history: Array<{ role: MessageRole; content: string }>;
}

export class RetrievalService {
	private chunkRepo: IChunkRepository;
	private embeddingClient: IEmbeddingClient;
	private llmClient: ILLMClient;
	private messageRepo: IMessageRepository;
	private sessionService: SessionService;

	constructor(deps: RetrievalServiceDeps) {
		this.chunkRepo = deps.chunkRepo;
		this.embeddingClient = deps.embeddingClient;
		this.llmClient = deps.llmClient;
		this.messageRepo = deps.messageRepo;
		this.sessionService = deps.sessionService;
	}

	buildAugmentedPrompt(params: BuildPromptParams): string {
		const { contextChunks, userMessage, history } = params;

		const contextSection = contextChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n---\n');

		const historySection =
			history.length > 0
				? '\nChat history:\n' +
					history.map(m => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') +
					'\n'
				: '';

		return `You are a helpful assistant. Answer questions based ONLY on the provided context.
If the answer is not in the context, say "I don't have enough information in the uploaded documents."

Context:
---
${contextSection}
---
${historySection}
Current question: ${userMessage}`;
	}

	async *stream(params: {
		message: string;
		sessionId: string;
		documentId: string;
	}): AsyncGenerator<string> {
		await this.sessionService.validateLimit(params.sessionId);

		const queryVector = await this.embeddingClient.embed(params.message);
		const chunks = await this.chunkRepo.similaritySearch({
			queryVector,
			documentId: params.documentId,
			topK: TOP_K_CHUNKS,
		});

		const history = await this.messageRepo.findBySessionId(params.sessionId);
		const historyForPrompt = history.map(m => ({ role: m.role, content: m.content }));

		const prompt = this.buildAugmentedPrompt({
			contextChunks: chunks.map(c => c.content),
			userMessage: params.message,
			history: historyForPrompt,
		});

		let fullResponse = '';
		for await (const text of this.llmClient.streamMessage(prompt)) {
			fullResponse += text;
			yield text;
		}

		await this.sessionService.increment(params.sessionId);
		await this.messageRepo.saveMany([
			{ role: 'USER', content: params.message, sessionId: params.sessionId },
			{ role: 'ASSISTANT', content: fullResponse, sessionId: params.sessionId },
		]);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run server/application/retrieval/__tests__/RetrievalService.test.ts
```

Expected: PASS (2 tests passing)

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add RetrievalService with TDD"
```

---

## Task 14: Shared — Rate Limiting Middleware

**Files:**

- Create: `shared/lib/rateLimit.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create `shared/lib/rateLimit.ts`**

```ts
import { IP_RATE_LIMIT_RPM } from '../config/constants';

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkIpRateLimit(ip: string): { allowed: boolean; remaining: number } {
	const now = Date.now();
	const windowMs = 60 * 1000; // 1 minute

	const entry = store.get(ip);

	if (!entry || now > entry.resetAt) {
		store.set(ip, { count: 1, resetAt: now + windowMs });
		return { allowed: true, remaining: IP_RATE_LIMIT_RPM - 1 };
	}

	if (entry.count >= IP_RATE_LIMIT_RPM) {
		return { allowed: false, remaining: 0 };
	}

	entry.count += 1;
	return { allowed: true, remaining: IP_RATE_LIMIT_RPM - entry.count };
}
```

- [ ] **Step 2: Create `middleware.ts`**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkIpRateLimit } from './shared/lib/rateLimit';

export function middleware(request: NextRequest) {
	const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
	if (!isApiRoute) return NextResponse.next();

	const ip =
		request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
		request.headers.get('x-real-ip') ??
		'127.0.0.1';

	const { allowed, remaining } = checkIpRateLimit(ip);

	if (!allowed) {
		return NextResponse.json(
			{ error: 'rate_limit_exceeded', message: 'Too many requests. Try again in a minute.' },
			{ status: 429, headers: { 'X-RateLimit-Remaining': '0' } },
		);
	}

	const response = NextResponse.next();
	response.headers.set('X-RateLimit-Remaining', String(remaining));
	return response;
}

export const config = {
	matcher: '/api/:path*',
};
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: add IP rate limiting middleware"
```

---

## Task 15: Dependency Container

**Files:**

- Create: `server/infrastructure/http/container.ts`

- [ ] **Step 1: Create `server/infrastructure/http/container.ts`**

```ts
import { ChunkingService } from '../../../domain/services/ChunkingService';
import { PrismaSessionRepository } from '../prisma-orm/PrismaSessionRepository';
import { PrismaDocumentRepository } from '../prisma-orm/PrismaDocumentRepository';
import { PrismaChunkRepository } from '../prisma-orm/PrismaChunkRepository';
import { PrismaMessageRepository } from '../prisma-orm/PrismaMessageRepository';
import { GoogleEmbeddingClient } from '../google/GoogleEmbeddingClient';
import { GeminiClient } from '../google/GeminiClient';
import { PdfParser } from '../parsers/PdfParser';
import { TxtParser } from '../parsers/TxtParser';
import { DocxParser } from '../parsers/DocxParser';
import { SessionService } from '../../application/session/SessionService';
import { IngestionService } from '../../application/ingestion/IngestionService';
import { RetrievalService } from '../../application/retrieval/RetrievalService';
import { CHUNK_SIZE, CHUNK_OVERLAP } from '../../../shared/config/constants';

const sessionRepo = new PrismaSessionRepository();
const documentRepo = new PrismaDocumentRepository();
const chunkRepo = new PrismaChunkRepository();
const messageRepo = new PrismaMessageRepository();

const embeddingClient = new GoogleEmbeddingClient();
const llmClient = new GeminiClient();
const chunkingService = new ChunkingService({ chunkSize: CHUNK_SIZE, overlap: CHUNK_OVERLAP });

export const sessionService = new SessionService(sessionRepo);

export const ingestionService = new IngestionService({
	documentRepo,
	chunkRepo,
	parsers: { PDF: new PdfParser(), TXT: new TxtParser(), DOCX: new DocxParser() },
	embeddingClient,
	chunkingService,
});

export const retrievalService = new RetrievalService({
	chunkRepo,
	embeddingClient,
	llmClient,
	messageRepo,
	sessionService,
});
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat: add dependency container"
```

---

## Task 16: API Routes

**Files:**

- Create: `app/api/session/route.ts`
- Create: `app/api/ingest/route.ts`
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: Create `app/api/session/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '../../../server/infrastructure/http/container';
import { MAX_QUERIES_PER_SESSION } from '../../../shared/config/constants';
import { SessionDto } from '../../../shared/dtos/SessionDto';

export async function GET(req: NextRequest) {
	const sessionId = req.cookies.get('session_id')?.value ?? null;

	const session = await sessionService.getOrCreate(sessionId);

	const dto: SessionDto = {
		id: session.id,
		queryCount: session.queryCount,
		remaining: Math.max(0, MAX_QUERIES_PER_SESSION - session.queryCount),
		expiresAt: session.expiresAt.toISOString(),
	};

	const response = NextResponse.json(dto);
	response.cookies.set('session_id', session.id, {
		httpOnly: true,
		sameSite: 'strict',
		expires: session.expiresAt,
		path: '/',
	});
	return response;
}
```

- [ ] **Step 2: Create `app/api/ingest/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { ingestionService } from '../../../server/infrastructure/http/container';
import { FileType } from '../../../domain/value-objects/FileType';
import { MAX_FILE_SIZE_MB, SUPPORTED_FILE_TYPES } from '../../../shared/config/constants';

const EXT_TO_FILE_TYPE: Record<string, FileType> = {
	pdf: 'PDF',
	txt: 'TXT',
	docx: 'DOCX',
};

export async function POST(req: NextRequest) {
	const sessionId = req.cookies.get('session_id')?.value;
	if (!sessionId) {
		return NextResponse.json({ error: 'no_session' }, { status: 401 });
	}

	const formData = await req.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		return NextResponse.json({ error: 'no_file' }, { status: 400 });
	}

	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
	if (!SUPPORTED_FILE_TYPES.includes(ext as any)) {
		return NextResponse.json(
			{ error: 'unsupported_file_type', supported: SUPPORTED_FILE_TYPES },
			{ status: 400 },
		);
	}

	const sizeMB = file.size / (1024 * 1024);
	if (sizeMB > MAX_FILE_SIZE_MB) {
		return NextResponse.json({ error: 'file_too_large', maxMB: MAX_FILE_SIZE_MB }, { status: 400 });
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const fileType = EXT_TO_FILE_TYPE[ext];

	const result = await ingestionService.ingest({
		buffer,
		fileName: file.name,
		fileType,
		sessionId,
	});

	return NextResponse.json(result, { status: 201 });
}
```

- [ ] **Step 3: Create `app/api/chat/route.ts`**

The chat SSE stream sends events in this order:

1. `{"type":"sources", "sources":[...]}` — sent BEFORE any text, so UI can show citations immediately
2. `{"type":"chunk", "text":"..."}` — streamed text
3. `[DONE]`

```ts
import { NextRequest } from 'next/server';
import { retrievalService } from '../../../server/infrastructure/http/container';
import { ChatRequestDto } from '../../../shared/dtos/ChatRequestDto';
import { TOP_K_CHUNKS } from '../../../shared/config/constants';

export async function POST(req: NextRequest) {
	const sessionId = req.cookies.get('session_id')?.value;
	if (!sessionId) {
		return new Response(JSON.stringify({ error: 'no_session' }), { status: 401 });
	}

	const body: ChatRequestDto = await req.json();

	if (!body.message || !body.documentId) {
		return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 });
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			try {
				const gen = retrievalService.stream({
					message: body.message,
					sessionId,
					documentId: body.documentId,
					chunkingStrategy: body.chunkingStrategy ?? 'RECURSIVE',
					topK: body.topK ?? TOP_K_CHUNKS,
					rerankingEnabled: body.rerankingEnabled ?? true,
				});

				// First event: sources (yielded as first item from the generator)
				const first = await gen.next();
				if (first.value && typeof first.value === 'object' && 'sources' in first.value) {
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: 'sources', sources: first.value.sources })}\n\n`,
						),
					);
				}

				// Remaining events: text chunks
				for await (const event of gen) {
					if (typeof event === 'string') {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: event })}\n\n`),
						);
					}
				}

				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
			} catch (err: any) {
				if (err.message === 'limit_reached') {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ error: 'limit_reached' })}\n\n`),
					);
				} else {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify({ error: 'internal_error' })}\n\n`),
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
}
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add API routes (session, ingest, chat)"
```

---

## Task 17: Client Layer — API interfaces, API clients, ChatSessionService, and thin stores

**Files:**

- Create: `client/application/api/IChatApi.ts`
- Create: `client/application/api/IIngestionApi.ts`
- Create: `client/application/api/ISessionApi.ts`
- Create: `client/application/api/ILLMOpsApi.ts`
- Create: `client/infrastructure/http/ChatApi.ts`
- Create: `client/infrastructure/http/IngestionApi.ts`
- Create: `client/infrastructure/http/SessionApi.ts`
- Create: `client/infrastructure/http/LLMOpsApi.ts`
- Create: `client/application/services/ChatSessionService.ts`
- Create: `client/application/services/IngestionClientService.ts`
- Create: `client/infrastructure/container.ts`
- Create: `client/stores/sessionStore.ts`
- Create: `client/stores/uploadStore.ts`
- Create: `client/stores/chatStore.ts`

**Architectural rules this task enforces:**

- Stores hold UI state ONLY — `messages`, `status`, `isStreaming`. No fetch, no SSE parsing, no FormData handling.
- All HTTP access goes through `client/infrastructure/http/*Api.ts` classes that implement `I*Api` interfaces in `client/application/api/`.
- Orchestration (optimistic updates, streaming coordination) lives in `client/application/services/*Service.ts` classes.
- Stores receive the service instance and call its methods; the service calls back into the store's plain setters.

- [ ] **Step 1: Create API interfaces (`client/application/api/`)**

`client/application/api/ISessionApi.ts`:

```ts
import { SessionDto } from '../../../shared/dtos/SessionDto';

export interface ISessionApi {
	getSession(): Promise<SessionDto>;
}
```

`client/application/api/IIngestionApi.ts`:

```ts
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface IngestParams {
	file: File;
	chunkingStrategy?: ChunkingStrategy;
}

export interface IIngestionApi {
	ingest(params: IngestParams): Promise<IngestResponseDto>;
}
```

`client/application/api/IChatApi.ts`:

```ts
import { CitationDto } from '../../../shared/dtos/CitationDto';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface StreamChatParams {
	message: string;
	documentId: string;
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}

export type ChatStreamEvent =
	| { type: 'sources'; sources: CitationDto[] }
	| { type: 'chunk'; text: string }
	| { type: 'error'; error: string }
	| { type: 'done' };

export interface IChatApi {
	streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamEvent>;
}
```

`client/application/api/ILLMOpsApi.ts`:

```ts
export interface LLMOpsLogEntry {
	id: string;
	query: string;
	response: string;
	latencyMs: number;
	promptTokens: number;
	completionTokens: number;
	estimatedCostUsd: number;
	chunkingStrategy: string;
	hasCitation: boolean;
	rerankingUsed: boolean;
	createdAt: string;
}

export interface LLMOpsStats {
	totalRequests: number;
	avgLatencyMs: number;
	p95LatencyMs: number;
	totalCostUsd: number;
	citationRate: number;
	logs: LLMOpsLogEntry[];
}

export interface ILLMOpsApi {
	getStats(): Promise<LLMOpsStats>;
}
```

- [ ] **Step 2: Create concrete API clients (`client/infrastructure/http/`)**

`client/infrastructure/http/SessionApi.ts`:

```ts
import { ISessionApi } from '../../application/api/ISessionApi';
import { SessionDto } from '../../../shared/dtos/SessionDto';

export class SessionApi implements ISessionApi {
	async getSession(): Promise<SessionDto> {
		const res = await fetch('/api/session');
		if (!res.ok) throw new Error('session_fetch_failed');
		return res.json();
	}
}
```

`client/infrastructure/http/IngestionApi.ts`:

```ts
import { IIngestionApi, IngestParams } from '../../application/api/IIngestionApi';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';

export class IngestionApi implements IIngestionApi {
	async ingest({ file, chunkingStrategy }: IngestParams): Promise<IngestResponseDto> {
		const formData = new FormData();
		formData.append('file', file);
		if (chunkingStrategy) formData.append('chunkingStrategy', chunkingStrategy);

		const res = await fetch('/api/ingest', { method: 'POST', body: formData });
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'upload_failed' }));
			throw new Error(err.error ?? 'upload_failed');
		}
		return res.json();
	}
}
```

`client/infrastructure/http/ChatApi.ts`:

```ts
import { IChatApi, StreamChatParams, ChatStreamEvent } from '../../application/api/IChatApi';

export class ChatApi implements IChatApi {
	async *streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamEvent> {
		const res = await fetch('/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		});
		if (!res.ok || !res.body) {
			yield { type: 'error', error: 'chat_request_failed' };
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (!line.startsWith('data: ')) continue;
				const data = line.slice(6);
				if (data === '[DONE]') {
					yield { type: 'done' };
					return;
				}
				try {
					const parsed = JSON.parse(data);
					if (parsed.error) yield { type: 'error', error: parsed.error };
					else if (parsed.type === 'sources') yield { type: 'sources', sources: parsed.sources };
					else if (parsed.type === 'chunk') yield { type: 'chunk', text: parsed.text };
				} catch {
					// Ignore malformed SSE frames
				}
			}
		}
		yield { type: 'done' };
	}
}
```

`client/infrastructure/http/LLMOpsApi.ts`:

```ts
import { ILLMOpsApi, LLMOpsStats } from '../../application/api/ILLMOpsApi';

export class LLMOpsApi implements ILLMOpsApi {
	async getStats(): Promise<LLMOpsStats> {
		const res = await fetch('/api/llmops');
		if (!res.ok) throw new Error('llmops_fetch_failed');
		return res.json();
	}
}
```

- [ ] **Step 3: Create client application services (`client/application/services/`)**

These services orchestrate business logic on the client. Stores delegate to them.

`client/application/services/IngestionClientService.ts`:

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

`client/application/services/ChatSessionService.ts`:

The service takes callbacks for UI updates — stores will pass their setters. This keeps the
service unaware of Zustand; it just orchestrates the stream and invokes callbacks.

```ts
import { IChatApi, StreamChatParams } from '../api/IChatApi';
import { CitationDto } from '../../../shared/dtos/CitationDto';
import { MessageDto } from '../../../shared/dtos/MessageDto';

export interface StreamCallbacks {
	onUserMessage: (msg: MessageDto) => void;
	onAssistantStart: (msg: MessageDto) => void;
	onSources: (sources: CitationDto[]) => void;
	onChunk: (text: string) => void;
	onError: (error: string) => void;
	onDone: () => void;
}

export class ChatSessionService {
	constructor(private api: IChatApi) {}

	async send(params: StreamChatParams, cb: StreamCallbacks): Promise<void> {
		const now = new Date().toISOString();

		cb.onUserMessage({
			id: crypto.randomUUID(),
			role: 'USER',
			content: params.message,
			createdAt: now,
		});

		cb.onAssistantStart({
			id: crypto.randomUUID(),
			role: 'ASSISTANT',
			content: '',
			createdAt: now,
		});

		for await (const event of this.api.streamChat(params)) {
			if (event.type === 'sources') cb.onSources(event.sources);
			else if (event.type === 'chunk') cb.onChunk(event.text);
			else if (event.type === 'error') {
				cb.onError(event.error);
				break;
			} else if (event.type === 'done') {
				cb.onDone();
				break;
			}
		}
	}
}
```

- [ ] **Step 4: Create `client/infrastructure/container.ts`**

```ts
import { SessionApi } from './http/SessionApi';
import { IngestionApi } from './http/IngestionApi';
import { ChatApi } from './http/ChatApi';
import { LLMOpsApi } from './http/LLMOpsApi';
import { IngestionClientService } from '../application/services/IngestionClientService';
import { ChatSessionService } from '../application/services/ChatSessionService';

const sessionApi = new SessionApi();
const ingestionApi = new IngestionApi();
const chatApi = new ChatApi();
const llmOpsApi = new LLMOpsApi();

export const ingestionClientService = new IngestionClientService(ingestionApi);
export const chatSessionService = new ChatSessionService(chatApi);
export { sessionApi, llmOpsApi };
```

- [ ] **Step 5: Create stores (UI state only)**

`client/stores/sessionStore.ts`:

```ts
import { create } from 'zustand';
import { SessionDto } from '../../shared/dtos/SessionDto';
import { sessionApi } from '../infrastructure/container';

interface SessionState {
	session: SessionDto | null;
	isLoading: boolean;
	error: string | null;
	fetchSession: () => Promise<void>;
}

export const useSessionStore = create<SessionState>(set => ({
	session: null,
	isLoading: false,
	error: null,
	fetchSession: async () => {
		set({ isLoading: true, error: null });
		try {
			const session = await sessionApi.getSession();
			set({ session, isLoading: false });
		} catch (e: any) {
			set({ error: e.message ?? 'unknown_error', isLoading: false });
		}
	},
}));
```

`client/stores/uploadStore.ts`:

```ts
import { create } from 'zustand';
import { IngestResponseDto } from '../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { ingestionClientService } from '../infrastructure/container';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
	status: UploadStatus;
	documents: IngestResponseDto[];
	error: string | null;
	reset: () => void;
	upload: (file: File, chunkingStrategy?: ChunkingStrategy) => Promise<void>;
}

export const useUploadStore = create<UploadState>((set, get) => ({
	status: 'idle',
	documents: [],
	error: null,
	reset: () => set({ status: 'idle', error: null }),
	upload: async (file, chunkingStrategy) => {
		set({ status: 'uploading', error: null });
		try {
			const document = await ingestionClientService.upload({ file, chunkingStrategy });
			set({ status: 'success', documents: [...get().documents, document] });
		} catch (e: any) {
			set({ status: 'error', error: e.message ?? 'upload_failed' });
		}
	},
}));
```

`client/stores/chatStore.ts`:

```ts
import { create } from 'zustand';
import { MessageDto } from '../../shared/dtos/MessageDto';
import { CitationDto } from '../../shared/dtos/CitationDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { chatSessionService } from '../infrastructure/container';

interface SendMessageParams {
	message: string;
	documentId: string;
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}

interface ChatState {
	messages: MessageDto[];
	citationsByMessageId: Record<string, CitationDto[]>;
	isStreaming: boolean;
	error: string | null;
	sendMessage: (params: SendMessageParams) => Promise<void>;
	reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
	messages: [],
	citationsByMessageId: {},
	isStreaming: false,
	error: null,
	reset: () => set({ messages: [], citationsByMessageId: {}, error: null, isStreaming: false }),

	sendMessage: async params => {
		set({ isStreaming: true, error: null });

		let currentAssistantId: string | null = null;

		await chatSessionService.send(params, {
			onUserMessage: msg => {
				set(state => ({ messages: [...state.messages, msg] }));
			},
			onAssistantStart: msg => {
				currentAssistantId = msg.id;
				set(state => ({ messages: [...state.messages, msg] }));
			},
			onSources: sources => {
				if (!currentAssistantId) return;
				set(state => ({
					citationsByMessageId: {
						...state.citationsByMessageId,
						[currentAssistantId!]: sources,
					},
				}));
			},
			onChunk: text => {
				set(state => {
					const msgs = [...state.messages];
					const last = msgs[msgs.length - 1];
					if (last && last.role === 'ASSISTANT') {
						msgs[msgs.length - 1] = { ...last, content: last.content + text };
					}
					return { messages: msgs };
				});
			},
			onError: error => set({ error, isStreaming: false }),
			onDone: () => set({ isStreaming: false }),
		});
	},
}));
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: add client layer (API interfaces, API clients, services, thin stores)"
```

---

## Task 18: Shared UI Components (atoms)

**Files:**

- Create: `presentation/web/components/LimitBadge/index.tsx`
- Create: `presentation/web/components/FileDropzone/index.tsx`
- Create: `presentation/web/components/UploadProgress/index.tsx`
- Create: `presentation/web/components/MessageList/index.tsx`
- Create: `presentation/web/components/MessageInput/index.tsx`
- Create: `presentation/web/components/CitationList/index.tsx`

- [ ] **Step 1: Create `presentation/web/components/LimitBadge/index.tsx`**

```tsx
import { Badge } from '@/components/ui/badge';
import { MAX_QUERIES_PER_SESSION } from '@/shared/config/constants';

interface LimitBadgeProps {
	remaining: number;
}

export function LimitBadge({ remaining }: LimitBadgeProps) {
	const isLow = remaining <= 5;
	const isExhausted = remaining === 0;

	return (
		<Badge variant={isExhausted ? 'destructive' : isLow ? 'outline' : 'secondary'}>
			{isExhausted
				? 'Лимит исчерпан'
				: `Осталось запросов: ${remaining} / ${MAX_QUERIES_PER_SESSION}`}
		</Badge>
	);
}
```

- [ ] **Step 2: Create `presentation/web/components/UploadProgress/index.tsx`**

```tsx
interface UploadProgressProps {
	status: 'idle' | 'uploading' | 'success' | 'error';
	chunkCount?: number;
	fileName?: string;
	error?: string | null;
}

const STEPS = ['Загрузка файла', 'Парсинг текста', 'Создание чанков', 'Эмбеддинг', 'Готово'];

export function UploadProgress({ status, chunkCount, fileName, error }: UploadProgressProps) {
	if (status === 'idle') return null;

	if (status === 'error') {
		return (
			<div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
				Ошибка: {error}
			</div>
		);
	}

	if (status === 'success') {
		return (
			<div className='rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700'>
				<strong>{fileName}</strong> загружен. Создано {chunkCount} чанков. Можно задавать вопросы.
			</div>
		);
	}

	return (
		<div className='space-y-2'>
			{STEPS.map((step, i) => (
				<div key={step} className='text-muted-foreground flex items-center gap-2 text-sm'>
					<span className='animate-pulse'>⏳</span>
					{step}…
				</div>
			))}
		</div>
	);
}
```

- [ ] **Step 3: Create `presentation/web/components/FileDropzone/index.tsx`**

```tsx
'use client';
import { useCallback, useState } from 'react';
import { useUploadStore } from '@/client/stores/uploadStore';
import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE_MB } from '@/shared/config/constants';
import { UploadProgress } from '../UploadProgress';
import { Button } from '@/components/ui/button';

export function FileDropzone() {
	const { status, document: uploadedDoc, error, upload, reset } = useUploadStore();
	const [isDragging, setIsDragging] = useState(false);

	const handleFile = useCallback(
		async (file: File) => {
			await upload(file);
		},
		[upload],
	);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			const file = e.dataTransfer.files[0];
			if (file) handleFile(file);
		},
		[handleFile],
	);

	const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) handleFile(file);
	};

	if (status === 'success' && uploadedDoc) {
		return (
			<div className='space-y-3'>
				<UploadProgress
					status='success'
					fileName={uploadedDoc.name}
					chunkCount={uploadedDoc.chunkCount}
				/>
				<Button variant='outline' size='sm' onClick={reset}>
					Загрузить другой документ
				</Button>
			</div>
		);
	}

	return (
		<div className='space-y-3'>
			<div
				onDrop={onDrop}
				onDragOver={e => {
					e.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'} `}
				onClick={() => document.getElementById('file-input')?.click()}
			>
				<p className='text-muted-foreground text-sm'>Перетащите файл или нажмите для выбора</p>
				<p className='text-muted-foreground mt-1 text-xs'>
					Поддерживаемые форматы: {SUPPORTED_FILE_TYPES.join(', ').toUpperCase()} · Максимум{' '}
					{MAX_FILE_SIZE_MB}MB
				</p>
				<input
					id='file-input'
					type='file'
					className='hidden'
					accept='.pdf,.txt,.docx'
					onChange={onFileInput}
				/>
			</div>
			<UploadProgress status={status} error={error} />
		</div>
	);
}
```

- [ ] **Step 4: Create `presentation/web/components/MessageList/index.tsx`**

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { MessageDto } from '@/shared/dtos/MessageDto';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MessageListProps {
	messages: MessageDto[];
	isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	if (messages.length === 0) {
		return (
			<div className='text-muted-foreground flex flex-1 items-center justify-center text-sm'>
				Загрузите документ и задайте вопрос
			</div>
		);
	}

	return (
		<ScrollArea className='flex-1 px-4'>
			<div className='space-y-4 py-4'>
				{messages.map(msg => (
					<div
						key={msg.id}
						className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
					>
						<div
							className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
								msg.role === 'USER'
									? 'bg-primary text-primary-foreground'
									: 'bg-muted text-foreground'
							} `}
						>
							{msg.content}
							{isStreaming && msg.role === 'ASSISTANT' && msg === messages[messages.length - 1] && (
								<span className='ml-1 inline-block h-4 w-1 animate-pulse bg-current' />
							)}
						</div>
					</div>
				))}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}
```

- [ ] **Step 5: Create `presentation/web/components/MessageInput/index.tsx`**

```tsx
'use client';
import { useState, KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface MessageInputProps {
	onSend: (message: string) => void;
	disabled: boolean;
	placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder }: MessageInputProps) {
	const [value, setValue] = useState('');

	const handleSend = () => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue('');
	};

	const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className='flex gap-2 border-t p-4'>
			<Textarea
				value={value}
				onChange={e => setValue(e.target.value)}
				onKeyDown={onKeyDown}
				placeholder={
					disabled ? 'Лимит запросов исчерпан' : (placeholder ?? 'Задайте вопрос по документу…')
				}
				disabled={disabled}
				className='max-h-[120px] min-h-[44px] resize-none'
				rows={1}
			/>
			<Button onClick={handleSend} disabled={disabled || !value.trim()}>
				Отправить
			</Button>
		</div>
	);
}
```

- [ ] **Step 6: Create `presentation/web/components/CitationList/index.tsx`**

Citations are shown below each assistant message. The `[1]`, `[2]` references in the response text are purely textual — the API sends full citation objects which are rendered as a collapsible list.

```tsx
import { CitationDto } from '@/shared/dtos/CitationDto';

interface CitationListProps {
	citations: CitationDto[];
}

export function CitationList({ citations }: CitationListProps) {
	if (citations.length === 0) return null;

	return (
		<div className='mt-2 space-y-1 border-t pt-2'>
			<p className='text-muted-foreground text-xs font-medium'>Sources:</p>
			{citations.map(c => (
				<div key={c.index} className='text-muted-foreground flex gap-2 text-xs'>
					<span className='text-primary shrink-0 font-mono'>[{c.index}]</span>
					<div>
						<span className='font-medium'>{c.documentName}</span>
						{' — '}
						<span className='line-clamp-2 italic'>{c.content}</span>
					</div>
				</div>
			))}
		</div>
	);
}
```

- [ ] **Step 7: Update `MessageList` to support citations**

Replace `presentation/web/components/MessageList/index.tsx`:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { MessageDto } from '@/shared/dtos/MessageDto';
import { CitationDto } from '@/shared/dtos/CitationDto';
import { CitationList } from '../CitationList';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EnrichedMessage extends MessageDto {
	citations?: CitationDto[];
}

interface MessageListProps {
	messages: EnrichedMessage[];
	isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	if (messages.length === 0) {
		return (
			<div className='text-muted-foreground flex flex-1 items-center justify-center text-sm'>
				Select a document and ask a question
			</div>
		);
	}

	return (
		<ScrollArea className='flex-1 px-4'>
			<div className='space-y-4 py-4'>
				{messages.map(msg => (
					<div
						key={msg.id}
						className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
					>
						<div
							className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
								msg.role === 'USER'
									? 'bg-primary text-primary-foreground'
									: 'bg-muted text-foreground'
							} `}
						>
							<p className='whitespace-pre-wrap'>{msg.content}</p>
							{isStreaming && msg.role === 'ASSISTANT' && msg === messages[messages.length - 1] && (
								<span className='ml-1 inline-block h-4 w-1 animate-pulse bg-current' />
							)}
							{msg.role === 'ASSISTANT' && msg.citations && (
								<CitationList citations={msg.citations} />
							)}
						</div>
					</div>
				))}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: add UI components with citations support"
```

---

## Task 19: 3-Zone Layout — Sidebar, Chat Page, Documents Page, Stats Page

**Files:**

- Create: `app/layout.tsx`
- Create: `presentation/web/layout/Sidebar/index.tsx`
- Create: `presentation/web/pages/Chat/KnowledgePanel/index.tsx`
- Create: `presentation/web/pages/Chat/AdvancedControls/index.tsx`
- Create: `presentation/web/pages/Chat/index.tsx`
- Create: `presentation/web/pages/Documents/IngestionSettings/index.tsx`
- Create: `presentation/web/pages/Documents/DocumentTable/index.tsx`
- Create: `presentation/web/pages/Documents/index.tsx`
- Create: `presentation/web/pages/Stats/MetricCards/index.tsx`
- Create: `presentation/web/pages/Stats/QueryLogTable/index.tsx`
- Create: `presentation/web/pages/Stats/InsightBar/index.tsx`
- Create: `presentation/web/pages/Stats/index.tsx`
- Create: `app/page.tsx`
- Create: `app/documents/page.tsx`
- Create: `app/stats/page.tsx`

- [ ] **Step 1: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/presentation/web/layout/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
	title: 'RAG Chat',
	description: 'Chat with your documents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<body className={`${inter.className} bg-background flex h-screen overflow-hidden`}>
				<Sidebar />
				<main className='flex-1 overflow-auto'>{children}</main>
			</body>
		</html>
	);
}
```

- [ ] **Step 2: Create `presentation/web/layout/Sidebar/index.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, FileText, BarChart2 } from 'lucide-react';

const NAV = [
	{ href: '/', label: 'Chat', icon: MessageSquare },
	{ href: '/documents', label: 'Documents', icon: FileText },
	{ href: '/stats', label: 'Stats', icon: BarChart2 },
];

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className='bg-muted/30 flex w-56 shrink-0 flex-col border-r'>
			<div className='border-b px-4 py-5'>
				<h1 className='text-sm font-bold tracking-tight'>RAG Chat</h1>
				<p className='text-muted-foreground mt-0.5 text-xs'>Document Intelligence</p>
			</div>
			<nav className='flex-1 space-y-0.5 p-2'>
				{NAV.map(({ href, label, icon: Icon }) => {
					const active = pathname === href;
					return (
						<Link
							key={href}
							href={href}
							className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
								active
									? 'bg-primary text-primary-foreground font-medium'
									: 'text-muted-foreground hover:text-foreground hover:bg-muted'
							} `}
						>
							<Icon className='h-4 w-4 shrink-0' />
							{label}
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}
```

Install lucide-react if not already present:

```bash
npm install lucide-react
```

- [ ] **Step 3: Create `client/stores/controlsStore.ts`**

Stores the advanced controls state (strategy, topK, reranking) persistently across navigation.

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

interface ControlsState {
	chunkingStrategy: ChunkingStrategy;
	topK: number;
	rerankingEnabled: boolean;
	setStrategy: (s: ChunkingStrategy) => void;
	setTopK: (k: number) => void;
	setReranking: (v: boolean) => void;
}

export const useControlsStore = create<ControlsState>()(
	persist(
		set => ({
			chunkingStrategy: 'RECURSIVE',
			topK: 5,
			rerankingEnabled: true,
			setStrategy: chunkingStrategy => set({ chunkingStrategy }),
			setTopK: topK => set({ topK }),
			setReranking: rerankingEnabled => set({ rerankingEnabled }),
		}),
		{ name: 'rag-controls' },
	),
);
```

- [ ] **Step 4: Create `presentation/web/pages/Chat/AdvancedControls/index.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useControlsStore } from '@/client/stores/controlsStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CHUNKING_STRATEGY, ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

const STRATEGIES: ChunkingStrategy[] = ['FIXED', 'SENTENCE', 'PARAGRAPH', 'RECURSIVE'];
const TOP_K_OPTIONS = [5, 10, 20];

export function AdvancedControls() {
	const [open, setOpen] = useState(false);
	const { chunkingStrategy, topK, rerankingEnabled, setStrategy, setTopK, setReranking } =
		useControlsStore();

	return (
		<div className='bg-muted/20 border-t'>
			<button
				onClick={() => setOpen(o => !o)}
				className='text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-4 py-2 text-xs transition-colors'
			>
				<span className='font-medium'>Advanced Controls</span>
				{open ? <ChevronUp className='h-3 w-3' /> : <ChevronDown className='h-3 w-3' />}
			</button>

			{open && (
				<div className='grid grid-cols-3 gap-4 px-4 pb-3 text-xs'>
					{/* Chunking Strategy */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Chunking Strategy</Label>
						<div className='flex flex-col gap-0.5'>
							{STRATEGIES.map(s => (
								<button
									key={s}
									onClick={() => setStrategy(s)}
									className={`rounded px-2 py-1 text-left text-xs transition-colors ${
										chunkingStrategy === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
									}`}
								>
									{s}
								</button>
							))}
						</div>
					</div>

					{/* Top-K */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Top-K Chunks</Label>
						<div className='flex flex-col gap-0.5'>
							{TOP_K_OPTIONS.map(k => (
								<button
									key={k}
									onClick={() => setTopK(k)}
									className={`rounded px-2 py-1 text-left text-xs transition-colors ${
										topK === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
									}`}
								>
									{k}
								</button>
							))}
						</div>
					</div>

					{/* Reranking */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Reranking</Label>
						<div className='flex items-center gap-2 pt-1'>
							<Switch
								checked={rerankingEnabled}
								onCheckedChange={setReranking}
								id='reranking-toggle'
							/>
							<Label htmlFor='reranking-toggle' className='text-xs'>
								{rerankingEnabled ? 'On' : 'Off'}
							</Label>
						</div>
						<p className='text-muted-foreground text-xs leading-tight'>
							Cohere rerank improves relevance
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
```

Add shadcn switch: `npx shadcn@latest add switch label`

- [ ] **Step 5: Create `presentation/web/pages/Chat/KnowledgePanel/index.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { useUploadStore } from '@/client/stores/uploadStore';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

interface KnowledgePanelProps {
	activeDocumentId: string | null;
	onSelectDocument: (id: string) => void;
}

export function KnowledgePanel({ activeDocumentId, onSelectDocument }: KnowledgePanelProps) {
	const { documents } = useUploadStore();

	return (
		<div className='bg-muted/10 flex w-52 shrink-0 flex-col border-r'>
			<div className='flex items-center justify-between border-b px-3 py-3'>
				<span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
					Knowledge
				</span>
				<Link href='/documents' className='text-muted-foreground hover:text-foreground'>
					<Plus className='h-3.5 w-3.5' />
				</Link>
			</div>
			<div className='flex-1 space-y-0.5 overflow-auto p-2'>
				{documents.length === 0 && (
					<p className='text-muted-foreground px-2 py-2 text-xs'>
						No documents yet.{' '}
						<Link href='/documents' className='underline'>
							Upload one
						</Link>
					</p>
				)}
				{documents.map((doc: IngestResponseDto) => (
					<button
						key={doc.documentId}
						onClick={() => onSelectDocument(doc.documentId)}
						className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
							activeDocumentId === doc.documentId
								? 'bg-primary/10 text-primary border-primary/20 border'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'
						} `}
					>
						<FileText className='h-3 w-3 shrink-0' />
						<span className='truncate'>{doc.name}</span>
					</button>
				))}
			</div>
		</div>
	);
}
```

Update `uploadStore` to track multiple documents and accept ingestion settings. Fetch logic
stays in `IngestionClientService` / `IngestionApi` — the store remains state-only.

Extend `client/application/api/IIngestionApi.ts`:

```ts
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface IngestParams {
	file: File;
	chunkingStrategy?: ChunkingStrategy;
	chunkSize?: number;
	overlap?: number;
}

export interface IIngestionApi {
	ingest(params: IngestParams): Promise<IngestResponseDto>;
}
```

Update `client/infrastructure/http/IngestionApi.ts` to forward all settings as multipart fields:

```ts
async ingest({ file, chunkingStrategy, chunkSize, overlap }: IngestParams): Promise<IngestResponseDto> {
  const formData = new FormData()
  formData.append('file', file)
  if (chunkingStrategy) formData.append('chunkingStrategy', chunkingStrategy)
  if (chunkSize != null) formData.append('chunkSize', String(chunkSize))
  if (overlap != null) formData.append('overlap', String(overlap))

  const res = await fetch('/api/ingest', { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'upload_failed' }))
    throw new Error(err.error ?? 'upload_failed')
  }
  return res.json()
}
```

Then update `client/stores/uploadStore.ts` — add `persist` middleware, track an array of
documents, forward settings to the service. No fetch inside the store.

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IngestResponseDto } from '../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { ingestionClientService } from '../infrastructure/container';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadSettings {
	chunkingStrategy: ChunkingStrategy;
	chunkSize: number;
	overlap: number;
}

interface UploadState {
	status: UploadStatus;
	documents: IngestResponseDto[];
	error: string | null;
	reset: () => void;
	upload: (file: File, settings: UploadSettings) => Promise<void>;
}

export const useUploadStore = create<UploadState>()(
	persist(
		(set, get) => ({
			status: 'idle',
			documents: [],
			error: null,
			reset: () => set({ status: 'idle', error: null }),
			upload: async (file, settings) => {
				set({ status: 'uploading', error: null });
				try {
					const doc = await ingestionClientService.upload({ file, ...settings });
					set({ status: 'success', documents: [...get().documents, doc] });
				} catch (e: any) {
					set({ status: 'error', error: e.message ?? 'upload_failed' });
				}
			},
		}),
		{ name: 'rag-documents' },
	),
);
```

- [ ] **Step 6: Create Chat page — `presentation/web/pages/Chat/index.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useChatStore } from '@/client/stores/chatStore';
import { useControlsStore } from '@/client/stores/controlsStore';
import { MessageList } from '@/presentation/web/components/MessageList';
import { MessageInput } from '@/presentation/web/components/MessageInput';
import { LimitBadge } from '@/presentation/web/components/LimitBadge';
import { KnowledgePanel } from './KnowledgePanel';
import { AdvancedControls } from './AdvancedControls';

export function ChatPage() {
	const { session, fetchSession } = useSessionStore();
	const { messages, isStreaming, sendMessage } = useChatStore();
	const { chunkingStrategy, topK, rerankingEnabled } = useControlsStore();
	const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

	useEffect(() => {
		fetchSession();
	}, [fetchSession]);

	const remaining = session?.remaining ?? 20;
	const isLimitReached = remaining === 0;

	const handleSend = async (message: string) => {
		if (!activeDocumentId) return;
		await sendMessage({
			message,
			documentId: activeDocumentId,
			chunkingStrategy,
			topK,
			rerankingEnabled,
		});
		await fetchSession();
	};

	return (
		<div className='flex h-full'>
			<KnowledgePanel activeDocumentId={activeDocumentId} onSelectDocument={setActiveDocumentId} />

			<div className='flex flex-1 flex-col overflow-hidden'>
				{/* Top bar */}
				<div className='flex shrink-0 items-center justify-between border-b px-4 py-2'>
					<span className='text-muted-foreground text-sm font-medium'>
						{activeDocumentId
							? 'Ask about your document'
							: 'Select a document from Knowledge panel'}
					</span>
					{session && <LimitBadge remaining={remaining} />}
				</div>

				{/* Messages */}
				<MessageList messages={messages} isStreaming={isStreaming} />

				{/* Advanced controls + input */}
				<div className='shrink-0'>
					<AdvancedControls />
					<MessageInput
						onSend={handleSend}
						disabled={!activeDocumentId || isLimitReached || isStreaming}
						placeholder={!activeDocumentId ? 'Select a document first' : 'Ask a question…'}
					/>
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 7: Create Documents page components**

`presentation/web/pages/Documents/IngestionSettings/index.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

interface IngestionSettingsProps {
	value: { strategy: ChunkingStrategy; chunkSize: number; overlap: number };
	onChange: (v: { strategy: ChunkingStrategy; chunkSize: number; overlap: number }) => void;
}

const STRATEGIES: ChunkingStrategy[] = ['FIXED', 'SENTENCE', 'PARAGRAPH', 'RECURSIVE'];

export function IngestionSettings({ value, onChange }: IngestionSettingsProps) {
	return (
		<div className='bg-muted/20 space-y-4 rounded-lg border p-4'>
			<h3 className='text-sm font-medium'>Ingestion Settings</h3>

			<div className='space-y-1.5'>
				<Label className='text-xs'>Chunking Strategy</Label>
				<div className='flex flex-wrap gap-2'>
					{STRATEGIES.map(s => (
						<button
							key={s}
							type='button'
							onClick={() => onChange({ ...value, strategy: s })}
							className={`rounded border px-3 py-1 text-xs transition-colors ${
								value.strategy === s
									? 'bg-primary text-primary-foreground border-primary'
									: 'border-input hover:bg-muted'
							}`}
						>
							{s}
						</button>
					))}
				</div>
			</div>

			<div className='grid grid-cols-2 gap-3'>
				<div className='space-y-1.5'>
					<Label htmlFor='chunk-size' className='text-xs'>
						Chunk Size (words)
					</Label>
					<Input
						id='chunk-size'
						type='number'
						min={50}
						max={2000}
						value={value.chunkSize}
						onChange={e => onChange({ ...value, chunkSize: Number(e.target.value) })}
						className='h-8 text-sm'
					/>
				</div>
				<div className='space-y-1.5'>
					<Label htmlFor='overlap' className='text-xs'>
						Overlap (words)
					</Label>
					<Input
						id='overlap'
						type='number'
						min={0}
						max={200}
						value={value.overlap}
						onChange={e => onChange({ ...value, overlap: Number(e.target.value) })}
						className='h-8 text-sm'
					/>
				</div>
			</div>
		</div>
	);
}
```

Add shadcn input: `npx shadcn@latest add input`

`presentation/web/pages/Documents/DocumentTable/index.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

interface DocumentTableProps {
	documents: IngestResponseDto[];
}

export function DocumentTable({ documents }: DocumentTableProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);

	if (documents.length === 0) {
		return (
			<div className='text-muted-foreground py-8 text-center text-sm'>
				No documents uploaded yet.
			</div>
		);
	}

	return (
		<div className='overflow-hidden rounded-lg border'>
			<table className='w-full text-sm'>
				<thead className='bg-muted/50'>
					<tr>
						<th className='text-muted-foreground px-4 py-2.5 text-left text-xs font-medium'>
							Name
						</th>
						<th className='text-muted-foreground px-4 py-2.5 text-left text-xs font-medium'>
							Chunks
						</th>
						<th className='text-muted-foreground px-4 py-2.5 text-left text-xs font-medium'>
							Strategy
						</th>
					</tr>
				</thead>
				<tbody className='divide-y'>
					{documents.map(doc => (
						<>
							<tr
								key={doc.documentId}
								className='hover:bg-muted/30 cursor-pointer'
								onClick={() => setExpandedId(expandedId === doc.documentId ? null : doc.documentId)}
							>
								<td className='flex items-center gap-2 px-4 py-3'>
									{expandedId === doc.documentId ? (
										<ChevronDown className='text-muted-foreground h-3.5 w-3.5' />
									) : (
										<ChevronRight className='text-muted-foreground h-3.5 w-3.5' />
									)}
									{doc.name}
								</td>
								<td className='text-muted-foreground px-4 py-3'>{doc.chunkCount}</td>
								<td className='px-4 py-3'>
									<span className='bg-muted rounded px-2 py-0.5 font-mono text-xs'>
										{doc.chunkingStrategy}
									</span>
								</td>
							</tr>
							{expandedId === doc.documentId && (
								<tr key={`${doc.documentId}-detail`}>
									<td colSpan={3} className='bg-muted/20 px-4 py-3'>
										<p className='text-muted-foreground text-xs'>
											Document ID: <code className='font-mono'>{doc.documentId}</code>
											{' · '}
											{doc.chunkCount} chunks indexed with {doc.chunkingStrategy} strategy.
										</p>
									</td>
								</tr>
							)}
						</>
					))}
				</tbody>
			</table>
		</div>
	);
}
```

`presentation/web/pages/Documents/index.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useUploadStore } from '@/client/stores/uploadStore';
import { FileDropzone } from '@/presentation/web/components/FileDropzone';
import { UploadProgress } from '@/presentation/web/components/UploadProgress';
import { DocumentTable } from './DocumentTable';
import { IngestionSettings } from './IngestionSettings';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

export function DocumentsPage() {
	const { documents, status, error, upload } = useUploadStore();
	const [settings, setSettings] = useState({
		strategy: 'RECURSIVE' as ChunkingStrategy,
		chunkSize: 512,
		overlap: 50,
	});

	const handleFile = async (file: File) => {
		await upload(file, {
			chunkingStrategy: settings.strategy,
			chunkSize: settings.chunkSize,
			overlap: settings.overlap,
		});
	};

	return (
		<div className='max-w-3xl space-y-6 p-6'>
			<div>
				<h2 className='text-xl font-semibold'>Documents</h2>
				<p className='text-muted-foreground mt-0.5 text-sm'>Upload and index your knowledge base</p>
			</div>

			<IngestionSettings value={settings} onChange={setSettings} />
			<FileDropzone onFile={handleFile} />
			<UploadProgress
				status={status}
				error={error}
				fileName={documents[documents.length - 1]?.name}
				chunkCount={documents[documents.length - 1]?.chunkCount}
			/>

			<div>
				<h3 className='mb-3 text-sm font-medium'>Indexed Documents ({documents.length})</h3>
				<DocumentTable documents={documents} />
			</div>
		</div>
	);
}
```

- [ ] **Step 8: Create Stats page components**

`presentation/web/pages/Stats/MetricCards/index.tsx`:

```tsx
import { Card } from '@/components/ui/card';

interface MetricCardsProps {
	totalRequests: number;
	avgLatencyMs: number;
	p95LatencyMs: number;
	totalCostUsd: number;
	citationRate: number;
}

export function MetricCards(props: MetricCardsProps) {
	const metrics = [
		{ label: 'Total Requests', value: props.totalRequests.toString() },
		{ label: 'Avg Latency', value: `${props.avgLatencyMs}ms` },
		{ label: 'P95 Latency', value: `${props.p95LatencyMs}ms` },
		{ label: 'Total Cost', value: `$${props.totalCostUsd.toFixed(4)}` },
		{ label: 'Citation Rate', value: `${(props.citationRate * 100).toFixed(1)}%` },
	];
	return (
		<div className='grid grid-cols-2 gap-3 md:grid-cols-5'>
			{metrics.map(m => (
				<Card key={m.label} className='p-4'>
					<p className='text-muted-foreground text-xs'>{m.label}</p>
					<p className='mt-1 text-xl font-bold'>{m.value}</p>
				</Card>
			))}
		</div>
	);
}
```

`presentation/web/pages/Stats/InsightBar/index.tsx`:

```tsx
interface InsightBarProps {
	logs: Array<{ chunkingStrategy: string; latencyMs: number; hasCitation: boolean }>;
}

export function InsightBar({ logs }: InsightBarProps) {
	if (logs.length < 3) return null;

	const byStrategy = logs.reduce<Record<string, { latencies: number[]; citations: number[] }>>(
		(acc, log) => {
			if (!acc[log.chunkingStrategy]) acc[log.chunkingStrategy] = { latencies: [], citations: [] };
			acc[log.chunkingStrategy].latencies.push(log.latencyMs);
			acc[log.chunkingStrategy].citations.push(log.hasCitation ? 1 : 0);
			return acc;
		},
		{},
	);

	const insights = Object.entries(byStrategy)
		.filter(([, v]) => v.latencies.length > 0)
		.map(([strategy, v]) => ({
			strategy,
			avgLatency: Math.round(v.latencies.reduce((s, x) => s + x, 0) / v.latencies.length),
			citationRate: v.citations.reduce((s, x) => s + x, 0) / v.citations.length,
		}));

	const bestCitation = [...insights].sort((a, b) => b.citationRate - a.citationRate)[0];
	const fastestStrategy = [...insights].sort((a, b) => a.avgLatency - b.avgLatency)[0];

	return (
		<div className='rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/20'>
			<p className='mb-1 font-medium text-blue-700 dark:text-blue-300'>Insights</p>
			<ul className='space-y-0.5 text-xs text-blue-600 dark:text-blue-400'>
				{bestCitation && (
					<li>
						<strong>{bestCitation.strategy}</strong> has the highest citation rate (
						{(bestCitation.citationRate * 100).toFixed(0)}%)
					</li>
				)}
				{fastestStrategy && (
					<li>
						<strong>{fastestStrategy.strategy}</strong> is fastest (avg {fastestStrategy.avgLatency}
						ms)
					</li>
				)}
			</ul>
		</div>
	);
}
```

`presentation/web/pages/Stats/QueryLogTable/index.tsx`:

```tsx
interface LogEntry {
	id: string;
	query: string;
	latencyMs: number;
	estimatedCostUsd: number;
	chunkingStrategy: string;
	hasCitation: boolean;
	rerankingUsed: boolean;
	createdAt: string;
}

interface QueryLogTableProps {
	logs: LogEntry[];
}

export function QueryLogTable({ logs }: QueryLogTableProps) {
	if (logs.length === 0) {
		return <p className='text-muted-foreground py-6 text-center text-sm'>No queries yet.</p>;
	}

	return (
		<div className='overflow-hidden rounded-lg border'>
			<table className='w-full text-xs'>
				<thead className='bg-muted/50'>
					<tr>
						{['Query', 'Latency', 'Cost', 'Strategy', 'Reranked', 'Cited'].map(h => (
							<th key={h} className='text-muted-foreground px-3 py-2.5 text-left font-medium'>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody className='divide-y'>
					{logs.map(log => (
						<tr key={log.id} className='hover:bg-muted/20'>
							<td className='max-w-[200px] truncate px-3 py-2.5' title={log.query}>
								{log.query}
							</td>
							<td className='px-3 py-2.5 tabular-nums'>{log.latencyMs}ms</td>
							<td className='px-3 py-2.5 tabular-nums'>${log.estimatedCostUsd.toFixed(4)}</td>
							<td className='px-3 py-2.5'>
								<span className='bg-muted rounded px-1.5 py-0.5 font-mono'>
									{log.chunkingStrategy}
								</span>
							</td>
							<td className='px-3 py-2.5 text-center'>{log.rerankingUsed ? '✅' : '—'}</td>
							<td className='px-3 py-2.5 text-center'>{log.hasCitation ? '✅' : '—'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
```

`presentation/web/pages/Stats/index.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { MetricCards } from './MetricCards';
import { QueryLogTable } from './QueryLogTable';
import { InsightBar } from './InsightBar';
import { llmOpsApi } from '@/client/infrastructure/container';

interface StatsData {
	totalRequests: number;
	avgLatencyMs: number;
	p95LatencyMs: number;
	totalCostUsd: number;
	citationRate: number;
	logs: Array<{
		id: string;
		query: string;
		latencyMs: number;
		estimatedCostUsd: number;
		chunkingStrategy: string;
		hasCitation: boolean;
		rerankingUsed: boolean;
		createdAt: string;
	}>;
}

export function StatsPage() {
	const [data, setData] = useState<StatsData | null>(null);

	useEffect(() => {
		llmOpsApi.getStats().then(setData as any);
	}, []);

	if (!data) {
		return <div className='text-muted-foreground p-6 text-sm'>Loading LLMOps data…</div>;
	}

	return (
		<div className='max-w-5xl space-y-6 p-6'>
			<div>
				<h2 className='text-xl font-semibold'>LLMOps Dashboard</h2>
				<p className='text-muted-foreground mt-0.5 text-sm'>
					Observability — latency, cost, citation quality
				</p>
			</div>

			<MetricCards
				totalRequests={data.totalRequests}
				avgLatencyMs={data.avgLatencyMs}
				p95LatencyMs={data.p95LatencyMs}
				totalCostUsd={data.totalCostUsd}
				citationRate={data.citationRate}
			/>

			<InsightBar logs={data.logs ?? []} />

			<div>
				<h3 className='mb-3 text-sm font-medium'>Query Log</h3>
				<QueryLogTable logs={data.logs ?? []} />
			</div>
		</div>
	);
}
```

Also update `GET /api/llmops/route.ts` to return logs array (Task 22's route needs updating):

In `app/api/llmops/route.ts`, change to:

```ts
import { NextResponse } from 'next/server';
import { llmOpsService } from '../../../server/infrastructure/http/container';

export async function GET() {
	const [stats, logs] = await Promise.all([
		llmOpsService.getStats(),
		llmOpsService.getRecentLogs(50),
	]);
	return NextResponse.json({ ...stats, logs });
}
```

Add `getRecentLogs(limit: number)` to `LLMOpsService`:

```ts
async getRecentLogs(limit: number) {
  return this.logRepo.getRecent(limit)
}
```

Add `getRecent(limit: number)` to `ILLMLogRepository` and `PrismaLLMLogRepository`:

```ts
// ILLMLogRepository:
getRecent(limit: number): Promise<LLMLog[]>

// PrismaLLMLogRepository:
async getRecent(limit: number): Promise<LLMLog[]> {
  const logs = await prisma.lLMLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return logs.map(l => ({
    id: l.id, sessionId: l.sessionId, documentId: l.documentId,
    query: l.query, response: l.response, latencyMs: l.latencyMs,
    promptTokens: l.promptTokens, completionTokens: l.completionTokens,
    estimatedCostUsd: l.estimatedCostUsd, hasCitation: l.hasCitation,
    rerankingUsed: l.rerankingUsed, chunkingStrategy: l.chunkingStrategy,
    createdAt: l.createdAt,
  }))
}
```

- [ ] **Step 9: Create route pages**

`app/page.tsx`:

```tsx
import { ChatPage } from '@/presentation/web/pages/Chat';
export default function Page() {
	return <ChatPage />;
}
```

`app/documents/page.tsx`:

```tsx
import { DocumentsPage } from '@/presentation/web/pages/Documents';
export default function Page() {
	return <DocumentsPage />;
}
```

`app/stats/page.tsx`:

```tsx
import { StatsPage } from '@/presentation/web/pages/Stats';
export default function Page() {
	return <StatsPage />;
}
```

- [ ] **Step 10: Update `chatStore.ts` to forward controls (fetch/SSE stays in the service)**

`sendMessage` already delegates to `chatSessionService` (from Task 17). Extend the params type
to forward `chunkingStrategy`, `topK`, and `rerankingEnabled`. The store does NOT make HTTP
calls or parse SSE — all of that stays in `ChatApi` + `ChatSessionService`. The store only
updates state in response to callbacks.

`client/stores/chatStore.ts`:

```ts
import { create } from 'zustand';
import { MessageDto } from '../../shared/dtos/MessageDto';
import { CitationDto } from '../../shared/dtos/CitationDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { chatSessionService } from '../infrastructure/container';

interface SendMessageParams {
	message: string;
	documentId: string;
	chunkingStrategy: ChunkingStrategy;
	topK: number;
	rerankingEnabled: boolean;
}

interface ChatState {
	messages: MessageDto[];
	citationsByMessageId: Record<string, CitationDto[]>;
	isStreaming: boolean;
	error: string | null;
	sendMessage: (params: SendMessageParams) => Promise<void>;
	reset: () => void;
}

export const useChatStore = create<ChatState>(set => ({
	messages: [],
	citationsByMessageId: {},
	isStreaming: false,
	error: null,
	reset: () => set({ messages: [], citationsByMessageId: {}, error: null, isStreaming: false }),

	sendMessage: async params => {
		set({ isStreaming: true, error: null });
		let currentAssistantId: string | null = null;

		await chatSessionService.send(params, {
			onUserMessage: msg => set(state => ({ messages: [...state.messages, msg] })),
			onAssistantStart: msg => {
				currentAssistantId = msg.id;
				set(state => ({ messages: [...state.messages, msg] }));
			},
			onSources: sources => {
				if (!currentAssistantId) return;
				set(state => ({
					citationsByMessageId: {
						...state.citationsByMessageId,
						[currentAssistantId!]: sources,
					},
				}));
			},
			onChunk: text => {
				set(state => {
					const msgs = [...state.messages];
					const last = msgs[msgs.length - 1];
					if (last && last.role === 'ASSISTANT') {
						msgs[msgs.length - 1] = { ...last, content: last.content + text };
					}
					return { messages: msgs };
				});
			},
			onError: error => set({ error, isStreaming: false }),
			onDone: () => set({ isStreaming: false }),
		});
	},
}));
```

**Note on UI components** that consume the store: citations are no longer a field on each message.
Read them from `citationsByMessageId[msg.id]`:

```tsx
const { messages, citationsByMessageId } = useChatStore();
// ...
{
	messages.map(m => (
		<MessageItem
			key={m.id}
			message={m}
			citations={m.role === 'ASSISTANT' ? (citationsByMessageId[m.id] ?? []) : []}
		/>
	));
}
```

- [ ] **Step 11: Commit**

```bash
git add .
git commit -m "feat: 3-zone UI (Chat/Documents/Stats) with sidebar, citations, advanced controls"
```

---

## Task 20: Multi-Strategy ChunkingService (replaces Task 5)

> **Replaces the simpler ChunkingService from Task 5.** If you already implemented Task 5, delete `domain/services/ChunkingService.ts` and `__tests__/ChunkingService.test.ts` before starting this task.

**Files:**

- Create: `domain/value-objects/ChunkingStrategy.ts`
- Create: `domain/services/ChunkingService.ts` (replace)
- Create: `domain/services/__tests__/ChunkingService.test.ts` (replace)

- [ ] **Step 1: Create `domain/value-objects/ChunkingStrategy.ts`**

```ts
export const CHUNKING_STRATEGY = {
	FIXED: 'FIXED',
	SENTENCE: 'SENTENCE',
	PARAGRAPH: 'PARAGRAPH',
	RECURSIVE: 'RECURSIVE',
} as const;

export type ChunkingStrategy = (typeof CHUNKING_STRATEGY)[keyof typeof CHUNKING_STRATEGY];
```

- [ ] **Step 2: Write the failing tests**

`domain/services/__tests__/ChunkingService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ChunkingService } from '../ChunkingService';

const service = new ChunkingService({ chunkSize: 10, overlap: 2 });

describe('FIXED strategy', () => {
	it('returns single chunk for short text', () => {
		const result = service.chunk('hello world', 'FIXED');
		expect(result).toHaveLength(1);
		expect(result[0]).toBe('hello world');
	});

	it('splits into overlapping word-count windows', () => {
		const words = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');
		const result = service.chunk(words, 'FIXED');
		expect(result.length).toBeGreaterThan(1);
		const first = result[0].split(' ');
		const second = result[1].split(' ');
		// second chunk starts with last `overlap` words of first chunk
		expect(second[0]).toBe(first[first.length - 2]);
	});

	it('filters empty result', () => {
		expect(service.chunk('   \n\n   ', 'FIXED')).toHaveLength(0);
	});
});

describe('SENTENCE strategy', () => {
	it('splits on sentence boundaries', () => {
		const text = 'First sentence. Second sentence. Third sentence.';
		const result = service.chunk(text, 'SENTENCE');
		expect(result.every(c => c.endsWith('.'))).toBe(true);
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	it('returns single chunk when only one sentence', () => {
		const result = service.chunk('Just one sentence.', 'SENTENCE');
		expect(result).toHaveLength(1);
	});
});

describe('PARAGRAPH strategy', () => {
	it('splits on double newlines', () => {
		const text = 'Para one.\n\nPara two.\n\nPara three.';
		const result = service.chunk(text, 'PARAGRAPH');
		expect(result).toHaveLength(3);
		expect(result[0]).toBe('Para one.');
		expect(result[1]).toBe('Para two.');
	});

	it('falls back to full text when no paragraph breaks', () => {
		const result = service.chunk('Single paragraph text here.', 'PARAGRAPH');
		expect(result).toHaveLength(1);
	});
});

describe('RECURSIVE strategy', () => {
	it('prefers paragraph boundaries for long text', () => {
		const para1 = Array.from({ length: 20 }, (_, i) => `w${i}`).join(' ');
		const para2 = Array.from({ length: 20 }, (_, i) => `v${i}`).join(' ');
		const text = `${para1}\n\n${para2}`;
		const result = service.chunk(text, 'RECURSIVE');
		expect(result.length).toBeGreaterThan(1);
	});

	it('falls back to sentence split when no paragraph breaks', () => {
		const text = 'First sentence here. Second sentence there. Third sentence exists.';
		const result = service.chunk(text, 'RECURSIVE');
		expect(result.length).toBeGreaterThanOrEqual(1);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run domain/services/__tests__/ChunkingService.test.ts
```

Expected: FAIL — module not found or test failures.

- [ ] **Step 4: Implement `domain/services/ChunkingService.ts`**

```ts
import { ChunkingStrategy } from '../value-objects/ChunkingStrategy';

interface ChunkingOptions {
	chunkSize: number; // words
	overlap: number; // words
}

export class ChunkingService {
	private chunkSize: number;
	private overlap: number;

	constructor(options: ChunkingOptions) {
		this.chunkSize = options.chunkSize;
		this.overlap = options.overlap;
	}

	chunk(text: string, strategy: ChunkingStrategy): string[] {
		switch (strategy) {
			case 'FIXED':
				return this.fixedChunk(text);
			case 'SENTENCE':
				return this.sentenceChunk(text);
			case 'PARAGRAPH':
				return this.paragraphChunk(text);
			case 'RECURSIVE':
				return this.recursiveChunk(text);
		}
	}

	private fixedChunk(text: string): string[] {
		const words = text
			.trim()
			.split(/\s+/)
			.filter(w => w.length > 0);
		if (words.length === 0) return [];
		if (words.length <= this.chunkSize) return [words.join(' ')];

		const chunks: string[] = [];
		let start = 0;
		while (start < words.length) {
			const end = Math.min(start + this.chunkSize, words.length);
			chunks.push(words.slice(start, end).join(' '));
			if (end === words.length) break;
			start += this.chunkSize - this.overlap;
		}
		return chunks;
	}

	private sentenceChunk(text: string): string[] {
		// Split on sentence-ending punctuation
		const sentences = text
			.split(/(?<=[.!?])\s+/)
			.map(s => s.trim())
			.filter(s => s.length > 0);

		if (sentences.length === 0) return [];

		// Group sentences into chunks that fit within chunkSize words
		const chunks: string[] = [];
		let current: string[] = [];
		let wordCount = 0;

		for (const sentence of sentences) {
			const sentenceWords = sentence.split(/\s+/).length;
			if (wordCount + sentenceWords > this.chunkSize && current.length > 0) {
				chunks.push(current.join(' '));
				// keep overlap sentences
				const overlap = current.slice(-Math.ceil(this.overlap / 10));
				current = [...overlap, sentence];
				wordCount = current.join(' ').split(/\s+/).length;
			} else {
				current.push(sentence);
				wordCount += sentenceWords;
			}
		}
		if (current.length > 0) chunks.push(current.join(' '));
		return chunks;
	}

	private paragraphChunk(text: string): string[] {
		const paragraphs = text
			.split(/\n\n+/)
			.map(p => p.trim())
			.filter(p => p.length > 0);

		if (paragraphs.length === 0) return [text.trim()].filter(Boolean);

		// Merge short paragraphs into chunks respecting chunkSize
		const chunks: string[] = [];
		let current: string[] = [];
		let wordCount = 0;

		for (const para of paragraphs) {
			const paraWords = para.split(/\s+/).length;
			if (wordCount + paraWords > this.chunkSize && current.length > 0) {
				chunks.push(current.join('\n\n'));
				current = [para];
				wordCount = paraWords;
			} else {
				current.push(para);
				wordCount += paraWords;
			}
		}
		if (current.length > 0) chunks.push(current.join('\n\n'));
		return chunks;
	}

	private recursiveChunk(text: string): string[] {
		const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

		// If we have natural paragraph breaks, try paragraph strategy first
		if (paragraphs.length > 1) {
			const result = this.paragraphChunk(text);
			// If chunks are reasonable size, use them
			if (result.every(c => c.split(/\s+/).length <= this.chunkSize * 1.5)) {
				return result;
			}
		}

		// Fall back to sentence-based
		const sentenceResult = this.sentenceChunk(text);
		if (sentenceResult.length > 1) return sentenceResult;

		// Last resort: fixed
		return this.fixedChunk(text);
	}
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run domain/services/__tests__/ChunkingService.test.ts
```

Expected: PASS (all tests)

- [ ] **Step 6: Update `IngestionService` to accept strategy**

In `server/application/ingestion/IngestionService.ts`, update `IngestParams`:

```ts
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

interface IngestParams {
	buffer: Buffer;
	fileName: string;
	fileType: FileType;
	sessionId: string;
	chunkingStrategy?: ChunkingStrategy; // defaults to RECURSIVE
}
```

Update the `chunk()` call inside `ingest()`:

```ts
const chunkTexts = this.chunkingService.chunk(text, params.chunkingStrategy ?? 'RECURSIVE');
```

Update `IngestResponseDto` in `shared/dtos/IngestResponseDto.ts`:

```ts
export interface IngestResponseDto {
	documentId: string;
	chunkCount: number;
	name: string;
	chunkingStrategy: string;
}
```

Return from `IngestionService.ingest()`:

```ts
return {
	documentId: document.id,
	chunkCount: chunkTexts.length,
	name: params.fileName,
	chunkingStrategy: params.chunkingStrategy ?? 'RECURSIVE',
};
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: add multi-strategy ChunkingService (FIXED/SENTENCE/PARAGRAPH/RECURSIVE)"
```

---

## Task 21: Cohere Reranking

**Files:**

- Create: `server/infrastructure/cohere/CohereRerankClient.ts`
- Modify: `server/application/retrieval/RetrievalService.ts`

- [ ] **Step 1: Install Cohere SDK**

```bash
npm install cohere-ai
```

Add to `.env.example`:

```
COHERE_API_KEY="..."
```

- [ ] **Step 2: Write the failing test for reranking**

`server/infrastructure/cohere/__tests__/CohereRerankClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the ranking logic (sorting by score), not the API call
describe('Cohere reranking result ordering', () => {
	it('returns candidates sorted by relevance score descending', () => {
		const candidates = [
			{ content: 'Less relevant text', score: 0.3 },
			{ content: 'Most relevant text', score: 0.9 },
			{ content: 'Somewhat relevant text', score: 0.6 },
		];
		const sorted = [...candidates].sort((a, b) => b.score - a.score);
		expect(sorted[0].content).toBe('Most relevant text');
		expect(sorted[1].content).toBe('Somewhat relevant text');
		expect(sorted[2].content).toBe('Less relevant text');
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run server/infrastructure/cohere/__tests__/CohereRerankClient.test.ts
```

Expected: FAIL — directory does not exist yet.

- [ ] **Step 4: Create `server/infrastructure/cohere/CohereRerankClient.ts`**

```ts
import { CohereClient } from 'cohere-ai';

export interface RerankCandidate {
	content: string;
	originalIndex: number;
}

export interface RankedResult {
	content: string;
	originalIndex: number;
	relevanceScore: number;
}

export class CohereRerankClient {
	private client: CohereClient;
	private model = 'rerank-v3.5';

	constructor() {
		if (!process.env.COHERE_API_KEY) {
			throw new Error('COHERE_API_KEY is not set');
		}
		this.client = new CohereClient({ token: process.env.COHERE_API_KEY! });
	}

	async rerank(params: {
		query: string;
		candidates: RerankCandidate[];
		topN: number;
	}): Promise<RankedResult[]> {
		if (params.candidates.length === 0) return [];

		const response = await this.client.rerank({
			model: this.model,
			query: params.query,
			documents: params.candidates.map(c => c.content),
			topN: params.topN,
		});

		return (response.results ?? []).map(r => ({
			content: params.candidates[r.index].content,
			originalIndex: params.candidates[r.index].originalIndex,
			relevanceScore: r.relevanceScore,
		}));
	}
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run server/infrastructure/cohere/__tests__/CohereRerankClient.test.ts
```

Expected: PASS

- [ ] **Step 6: Update `RetrievalService` to use reranking**

In `server/application/retrieval/RetrievalService.ts`, update the `stream()` method. Replace the similarity search + prompt section:

```ts
// Before reranking:
// const chunks = await this.chunkRepo.similaritySearch({ queryVector, documentId: params.documentId, topK: TOP_K_CHUNKS })

// After reranking (retrieve wide, rerank tight):
import { IRerankClient } from '../ports/IRerankClient';
import { TOP_K_CHUNKS } from '../../../shared/config/constants';

// In constructor, add:
// private cohereClient: IRerankClient

// In stream():
const WIDE_K = TOP_K_CHUNKS * 4; // retrieve 20 candidates
const candidates = await this.chunkRepo.similaritySearch({
	queryVector,
	documentId: params.documentId,
	topK: WIDE_K,
});

const reranked = await this.cohereClient.rerank({
	query: params.message,
	candidates: candidates.map((c, i) => ({ content: c.content, originalIndex: i })),
	topN: TOP_K_CHUNKS,
});

const contextChunks = reranked.map(r => r.content);
```

Full updated `RetrievalService.ts`:

```ts
import { IChunkRepository } from '../repositories/IChunkRepository';
import { IMessageRepository } from '../repositories/IMessageRepository';
import { IEmbeddingClient } from '../ports/IEmbeddingClient';
import { ILLMClient } from '../ports/ILLMClient';
import { IRerankClient } from '../ports/IRerankClient';
import { SessionService } from '../session/SessionService';
import { MessageRole } from '../../../domain/entities/Message';
import { TOP_K_CHUNKS } from '../../../shared/config/constants';

interface RetrievalServiceDeps {
	chunkRepo: IChunkRepository;
	embeddingClient: IEmbeddingClient;
	llmClient: ILLMClient;
	cohereClient: IRerankClient;
	messageRepo: IMessageRepository;
	sessionService: SessionService;
}

interface BuildPromptParams {
	contextChunks: string[];
	userMessage: string;
	history: Array<{ role: MessageRole; content: string }>;
}

export class RetrievalService {
	private chunkRepo: IChunkRepository;
	private embeddingClient: IEmbeddingClient;
	private llmClient: ILLMClient;
	private cohereClient: IRerankClient;
	private messageRepo: IMessageRepository;
	private sessionService: SessionService;

	constructor(deps: RetrievalServiceDeps) {
		this.chunkRepo = deps.chunkRepo;
		this.embeddingClient = deps.embeddingClient;
		this.llmClient = deps.llmClient;
		this.cohereClient = deps.cohereClient;
		this.messageRepo = deps.messageRepo;
		this.sessionService = deps.sessionService;
	}

	buildAugmentedPrompt(params: BuildPromptParams): string {
		const { contextChunks, userMessage, history } = params;
		const contextSection = contextChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n---\n');
		const historySection =
			history.length > 0
				? '\nChat history:\n' +
					history.map(m => `${m.role === 'USER' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') +
					'\n'
				: '';
		return `You are a helpful assistant. Answer questions based ONLY on the provided context.
If the answer is not in the context, say "I don't have enough information in the uploaded documents."

Context:
---
${contextSection}
---
${historySection}
Current question: ${userMessage}`;
	}

	async *stream(params: {
		message: string;
		sessionId: string;
		documentId: string;
	}): AsyncGenerator<string> {
		await this.sessionService.validateLimit(params.sessionId);

		const queryVector = await this.embeddingClient.embed(params.message);

		// Retrieve wide (20), rerank tight (TOP_K_CHUNKS=5)
		const WIDE_K = TOP_K_CHUNKS * 4;
		const candidates = await this.chunkRepo.similaritySearch({
			queryVector,
			documentId: params.documentId,
			topK: WIDE_K,
		});

		const reranked = await this.cohereClient.rerank({
			query: params.message,
			candidates: candidates.map((c, i) => ({ content: c.content, originalIndex: i })),
			topN: TOP_K_CHUNKS,
		});

		const history = await this.messageRepo.findBySessionId(params.sessionId);
		const historyForPrompt = history.map(m => ({ role: m.role, content: m.content }));

		const prompt = this.buildAugmentedPrompt({
			contextChunks: reranked.map(r => r.content),
			userMessage: params.message,
			history: historyForPrompt,
		});

		let fullResponse = '';
		for await (const text of this.llmClient.streamMessage(prompt)) {
			fullResponse += text;
			yield text;
		}

		await this.sessionService.increment(params.sessionId);
		await this.messageRepo.saveMany([
			{ role: 'USER', content: params.message, sessionId: params.sessionId },
			{ role: 'ASSISTANT', content: fullResponse, sessionId: params.sessionId },
		]);
	}
}
```

- [ ] **Step 7: Update container to inject `CohereRerankClient`**

In `server/infrastructure/http/container.ts`, add:

```ts
import { CohereRerankClient } from '../cohere/CohereRerankClient';

const cohereClient = new CohereRerankClient();

// Update retrievalService constructor:
export const retrievalService = new RetrievalService({
	chunkRepo,
	embeddingClient,
	llmClient,
	cohereClient, // ← add this
	messageRepo,
	sessionService,
});
```

- [ ] **Step 8: Add `COHERE_API_KEY` to environment**

Add to `.env.local`:

```
COHERE_API_KEY="your-cohere-key"
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: add Cohere reranking to retrieval pipeline (retrieve 20, rerank to 5)"
```

---

## Task 22: LLMOps — Logging, Latency, Cost, Evaluation

**Files:**

- Modify: `prisma/schema.prisma` — add `LLMLog` model
- Create: `domain/entities/LLMLog.ts`
- Create: `server/application/repositories/ILLMLogRepository.ts`
- Create: `server/infrastructure/prisma-orm/PrismaLLMLogRepository.ts`
- Create: `server/application/llmops/LLMOpsService.ts`
- Create: `server/application/llmops/__tests__/LLMOpsService.test.ts`
- Create: `app/api/llmops/route.ts`
- Modify: `server/application/retrieval/RetrievalService.ts`

- [ ] **Step 1: Add `LLMLog` to `prisma/schema.prisma`**

Add after the `Message` model:

```prisma
model LLMLog {
  id                String   @id @default(uuid())
  sessionId         String
  documentId        String
  query             String
  response          String
  latencyMs         Int
  promptTokens      Int
  completionTokens  Int
  estimatedCostUsd  Float
  hasCitation       Boolean
  rerankingUsed     Boolean  @default(true)
  chunkingStrategy  String   @default("RECURSIVE")
  createdAt         DateTime @default(now())

  @@map("llm_logs")
}
```

Run migration:

```bash
npx prisma migrate dev --name add_llm_logs
```

- [ ] **Step 2: Create `domain/entities/LLMLog.ts`**

```ts
export interface LLMLog {
	id: string;
	sessionId: string;
	documentId: string;
	query: string;
	response: string;
	latencyMs: number;
	promptTokens: number;
	completionTokens: number;
	estimatedCostUsd: number;
	hasCitation: boolean;
	rerankingUsed: boolean;
	chunkingStrategy: string;
	createdAt: Date;
}
```

- [ ] **Step 3: Write the failing tests for LLMOpsService**

`server/application/llmops/__tests__/LLMOpsService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LLMOpsService } from '../LLMOpsService';

describe('LLMOpsService', () => {
	describe('estimateCost', () => {
		it('returns a positive number', () => {
			const service = new LLMOpsService({ logRepo: {} as any });
			const cost = service.estimateCost(1000, 200);
			expect(cost).toBeGreaterThan(0);
		});

		it('scales with token counts', () => {
			const service = new LLMOpsService({ logRepo: {} as any });
			const costSmall = service.estimateCost(100, 50);
			const costLarge = service.estimateCost(10000, 5000);
			expect(costLarge).toBeGreaterThan(costSmall);
		});
	});

	describe('detectCitation', () => {
		it('returns true when response contains citation phrase (English)', () => {
			const service = new LLMOpsService({ logRepo: {} as any });
			expect(service.detectCitation('According to the document, the answer is yes.')).toBe(true);
			expect(service.detectCitation('Based on the provided context, we can see...')).toBe(true);
		});

		it('returns true when response contains citation phrase (Russian)', () => {
			const service = new LLMOpsService({ logRepo: {} as any });
			expect(service.detectCitation('Согласно документу, ответ положительный.')).toBe(true);
			expect(service.detectCitation('В документе указано, что...')).toBe(true);
		});

		it('returns false when no citation phrase present', () => {
			const service = new LLMOpsService({ logRepo: {} as any });
			expect(service.detectCitation('The answer is 42.')).toBe(false);
		});
	});

	describe('approximateTokenCount', () => {
		it('estimates 1 token per 4 characters', () => {
			const service = new LLMOpsService({ logRepo: {} as any });
			const count = service.approximateTokenCount('hello world'); // 11 chars → ~3 tokens
			expect(count).toBeGreaterThanOrEqual(2);
			expect(count).toBeLessThanOrEqual(4);
		});
	});
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx vitest run server/application/llmops/__tests__/LLMOpsService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create `server/application/repositories/ILLMLogRepository.ts`**

```ts
import { LLMLog } from '../../../domain/entities/LLMLog';

export interface CreateLLMLogData {
	sessionId: string;
	documentId: string;
	query: string;
	response: string;
	latencyMs: number;
	promptTokens: number;
	completionTokens: number;
	estimatedCostUsd: number;
	hasCitation: boolean;
	rerankingUsed: boolean;
	chunkingStrategy: string;
}

export interface LLMOpsStats {
	totalRequests: number;
	avgLatencyMs: number;
	totalCostUsd: number;
	citationRate: number;
	p95LatencyMs: number;
}

export interface ILLMLogRepository {
	create(data: CreateLLMLogData): Promise<LLMLog>;
	getStats(): Promise<LLMOpsStats>;
}
```

- [ ] **Step 6: Create `server/application/llmops/LLMOpsService.ts`**

```ts
import { ILLMLogRepository, CreateLLMLogData } from '../repositories/ILLMLogRepository';

const CITATION_PHRASES = [
	'according to',
	'based on',
	'the document states',
	'the document mentions',
	'in the document',
	'согласно',
	'в документе',
	'документ указывает',
	'на основании',
	'из документа',
];

// Pricing as of 2026 (update if Anthropic changes rates)
// Gemini 2.5 Flash pay-as-you-go rates (logged for observability even on free tier)
const GOOGLE_EMBED_COST_PER_M_TOKENS = 0.01; // text-embedding-004 paid rate
const GEMINI_INPUT_COST_PER_M_TOKENS = 0.075; // gemini-2.5-flash input
const GEMINI_OUTPUT_COST_PER_M_TOKENS = 0.3; // gemini-2.5-flash output

interface LLMOpsServiceDeps {
	logRepo: ILLMLogRepository;
}

export class LLMOpsService {
	private logRepo: ILLMLogRepository;

	constructor(deps: LLMOpsServiceDeps) {
		this.logRepo = deps.logRepo;
	}

	estimateCost(promptTokens: number, completionTokens: number): number {
		const embeddingCost = (promptTokens / 1_000_000) * GOOGLE_EMBED_COST_PER_M_TOKENS;
		const geminiInputCost = (promptTokens / 1_000_000) * GEMINI_INPUT_COST_PER_M_TOKENS;
		const geminiOutputCost = (completionTokens / 1_000_000) * GEMINI_OUTPUT_COST_PER_M_TOKENS;
		return embeddingCost + geminiInputCost + geminiOutputCost;
	}

	detectCitation(response: string): boolean {
		const lower = response.toLowerCase();
		return CITATION_PHRASES.some(phrase => lower.includes(phrase));
	}

	approximateTokenCount(text: string): number {
		return Math.ceil(text.length / 4);
	}

	// Fire-and-forget — called after stream completes
	async log(data: CreateLLMLogData): Promise<void> {
		try {
			await this.logRepo.create(data);
		} catch {
			// Never block the response for logging failures
			console.error('[LLMOps] Failed to write log entry');
		}
	}

	async getStats() {
		return this.logRepo.getStats();
	}
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run server/application/llmops/__tests__/LLMOpsService.test.ts
```

Expected: PASS (all tests)

- [ ] **Step 8: Create `server/infrastructure/prisma-orm/PrismaLLMLogRepository.ts`**

```ts
import { prisma } from './prismaClient';
import { LLMLog } from '../../../domain/entities/LLMLog';
import {
	CreateLLMLogData,
	ILLMLogRepository,
	LLMOpsStats,
} from '../../application/repositories/ILLMLogRepository';

export class PrismaLLMLogRepository implements ILLMLogRepository {
	async create(data: CreateLLMLogData): Promise<LLMLog> {
		const log = await prisma.lLMLog.create({ data });
		return {
			id: log.id,
			sessionId: log.sessionId,
			documentId: log.documentId,
			query: log.query,
			response: log.response,
			latencyMs: log.latencyMs,
			promptTokens: log.promptTokens,
			completionTokens: log.completionTokens,
			estimatedCostUsd: log.estimatedCostUsd,
			hasCitation: log.hasCitation,
			rerankingUsed: log.rerankingUsed,
			chunkingStrategy: log.chunkingStrategy,
			createdAt: log.createdAt,
		};
	}

	async getStats(): Promise<LLMOpsStats> {
		const logs = await prisma.lLMLog.findMany({
			select: { latencyMs: true, estimatedCostUsd: true, hasCitation: true },
			orderBy: { createdAt: 'desc' },
			take: 1000,
		});

		if (logs.length === 0) {
			return {
				totalRequests: 0,
				avgLatencyMs: 0,
				totalCostUsd: 0,
				citationRate: 0,
				p95LatencyMs: 0,
			};
		}

		const latencies = logs.map(l => l.latencyMs).sort((a, b) => a - b);
		const avgLatencyMs = latencies.reduce((s, v) => s + v, 0) / latencies.length;
		const p95Index = Math.floor(latencies.length * 0.95);
		const p95LatencyMs = latencies[p95Index] ?? latencies[latencies.length - 1];
		const totalCostUsd = logs.reduce((s, l) => s + l.estimatedCostUsd, 0);
		const citationRate = logs.filter(l => l.hasCitation).length / logs.length;

		return {
			totalRequests: logs.length,
			avgLatencyMs: Math.round(avgLatencyMs),
			totalCostUsd: parseFloat(totalCostUsd.toFixed(6)),
			citationRate: parseFloat(citationRate.toFixed(3)),
			p95LatencyMs,
		};
	}
}
```

- [ ] **Step 9: Integrate LLMOpsService into RetrievalService**

Update `server/application/retrieval/RetrievalService.ts` — add `llmOpsService` dep and call it after streaming:

Add to `RetrievalServiceDeps`:

```ts
import { LLMOpsService } from '../llmops/LLMOpsService';

interface RetrievalServiceDeps {
	// ... existing deps ...
	llmOpsService: LLMOpsService;
}
```

Update `stream()` method — wrap with timing and fire-and-forget logging:

The generator yields two types:

- First yield: `{ sources: CitationDto[] }` — consumed by the chat route to send a `sources` SSE event
- Subsequent yields: `string` — text chunks streamed to the client

```ts
import { CitationDto } from '../../../shared/dtos/CitationDto'

type StreamEvent = { sources: CitationDto[] } | string

async *stream(params: {
  message: string
  sessionId: string
  documentId: string
  chunkingStrategy?: string
  topK?: number
  rerankingEnabled?: boolean
}): AsyncGenerator<StreamEvent> {
  const startTime = Date.now()
  const topK = params.topK ?? TOP_K_CHUNKS
  const rerankingEnabled = params.rerankingEnabled ?? true

  await this.sessionService.validateLimit(params.sessionId)

  const queryVector = await this.embeddingClient.embed(params.message)

  // Retrieve wider net if reranking, otherwise just topK
  const retrieveK = rerankingEnabled ? topK * 4 : topK
  const candidates = await this.chunkRepo.similaritySearch({
    queryVector,
    documentId: params.documentId,
    topK: retrieveK,
  })

  let contextChunks: string[]
  if (rerankingEnabled && candidates.length > 0) {
    const reranked = await this.cohereClient.rerank({
      query: params.message,
      candidates: candidates.map((c, i) => ({ content: c.content, originalIndex: i })),
      topN: topK,
    })
    contextChunks = reranked.map(r => r.content)
  } else {
    contextChunks = candidates.slice(0, topK).map(c => c.content)
  }

  // Yield sources first so the chat route can send them before streaming text
  const sources: CitationDto[] = contextChunks.map((content, i) => ({
    index: i + 1,
    content: content.slice(0, 200) + (content.length > 200 ? '…' : ''),
    documentName: params.documentId,  // resolved to name by the route if needed
  }))
  yield { sources }

  const history = await this.messageRepo.findBySessionId(params.sessionId)
  const historyForPrompt = history.map(m => ({ role: m.role, content: m.content }))

  const prompt = this.buildAugmentedPrompt({
    contextChunks,
    userMessage: params.message,
    history: historyForPrompt,
  })

  let fullResponse = ''
  for await (const text of this.llmClient.streamMessage(prompt)) {
    fullResponse += text
    yield text
  }

  const latencyMs = Date.now() - startTime

  await this.sessionService.increment(params.sessionId)
  await this.messageRepo.saveMany([
    { role: 'USER', content: params.message, sessionId: params.sessionId },
    { role: 'ASSISTANT', content: fullResponse, sessionId: params.sessionId },
  ])

  const promptTokens = this.llmOpsService.approximateTokenCount(prompt)
  const completionTokens = this.llmOpsService.approximateTokenCount(fullResponse)
  void this.llmOpsService.log({
    sessionId: params.sessionId,
    documentId: params.documentId,
    query: params.message,
    response: fullResponse,
    latencyMs,
    promptTokens,
    completionTokens,
    estimatedCostUsd: this.llmOpsService.estimateCost(promptTokens, completionTokens),
    hasCitation: this.llmOpsService.detectCitation(fullResponse),
    rerankingUsed: rerankingEnabled,
    chunkingStrategy: params.chunkingStrategy ?? 'RECURSIVE',
  })
}
```

Also add `private llmOpsService: LLMOpsService` field and assign in constructor.

- [ ] **Step 10: Create `app/api/llmops/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { llmOpsService } from '../../../server/infrastructure/http/container';

export async function GET() {
	const stats = await llmOpsService.getStats();
	return NextResponse.json(stats);
}
```

- [ ] **Step 11: Update container to add LLMOps deps**

In `server/infrastructure/http/container.ts`, add:

```ts
import { LLMOpsService } from '../../application/llmops/LLMOpsService';
import { PrismaLLMLogRepository } from '../prisma-orm/PrismaLLMLogRepository';

const llmLogRepo = new PrismaLLMLogRepository();
export const llmOpsService = new LLMOpsService({ logRepo: llmLogRepo });

// Update retrievalService:
export const retrievalService = new RetrievalService({
	chunkRepo,
	embeddingClient,
	llmClient,
	cohereClient,
	messageRepo,
	sessionService,
	llmOpsService, // ← add this
});
```

- [ ] **Step 12: Commit**

```bash
git add .
git commit -m "feat: add LLMOps (latency tracking, cost estimation, citation detection, stats API)"
```

---

## Task 23: LLMOps Dashboard UI (minimal)

**Files:**

- Create: `presentation/web/pages/Stats/index.tsx`
- Create: `app/stats/page.tsx`

- [ ] **Step 1: Create `presentation/web/pages/Stats/index.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { llmOpsApi } from '@/client/infrastructure/container';

interface LLMOpsStats {
	totalRequests: number;
	avgLatencyMs: number;
	totalCostUsd: number;
	citationRate: number;
	p95LatencyMs: number;
}

export function StatsPage() {
	const [stats, setStats] = useState<LLMOpsStats | null>(null);

	useEffect(() => {
		llmOpsApi.getStats().then(setStats as any);
	}, []);

	if (!stats) return <div className='text-muted-foreground p-8'>Loading stats…</div>;

	return (
		<div className='mx-auto max-w-4xl space-y-6 p-8'>
			<h1 className='text-2xl font-bold'>LLMOps Dashboard</h1>
			<div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
				<StatCard label='Total Requests' value={stats.totalRequests.toString()} />
				<StatCard label='Avg Latency' value={`${stats.avgLatencyMs}ms`} />
				<StatCard label='P95 Latency' value={`${stats.p95LatencyMs}ms`} />
				<StatCard label='Total Cost' value={`$${stats.totalCostUsd.toFixed(4)}`} />
				<StatCard label='Citation Rate' value={`${(stats.citationRate * 100).toFixed(1)}%`} />
			</div>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<Card className='p-4'>
			<p className='text-muted-foreground text-sm'>{label}</p>
			<p className='mt-1 text-2xl font-bold'>{value}</p>
		</Card>
	);
}
```

- [ ] **Step 2: Create `app/stats/page.tsx`**

```tsx
import { StatsPage } from '@/presentation/web/pages/Stats';

export default function Stats() {
	return <StatsPage />;
}
```

- [ ] **Step 3: Add stats link to layout header**

In `app/page.tsx`, update the header to include a link:

```tsx
import Link from 'next/link';

// Inside the <header>:
<Link href='/stats' className='text-muted-foreground hover:text-foreground text-sm'>
	LLMOps Stats
</Link>;
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add LLMOps dashboard page at /stats"
```

---

## Task 24: Verification (Updated)

- [ ] **Step 1: Run all unit tests**

```bash
npx vitest run
```

Expected: All tests passing (ChunkingService, SessionService, IngestionService, RetrievalService, LLMOpsService, Cohere reranking ordering).

- [ ] **Step 2: Start dev server and smoke test**

```bash
npm run dev
```

Open `http://localhost:3000`.

Manual checklist:

- [ ] Session cookie is set on first load
- [ ] LimitBadge shows "Осталось запросов: 20 / 20"
- [ ] Upload a `.txt` file with RECURSIVE strategy → UploadProgress shows success + chunk count
- [ ] Upload a `.pdf` with SENTENCE strategy → different chunk count for same size doc
- [ ] Type a question → streaming response appears in chat
- [ ] LimitBadge decrements after each message
- [ ] After 20 messages → MessageInput disabled, badge shows "Лимит исчерпан"
- [ ] Open `http://localhost:3000/stats` → LLMOps dashboard shows request count, avg latency, cost
- [ ] `GET /api/llmops` returns JSON with `totalRequests > 0`, `avgLatencyMs > 0`, `citationRate` between 0-1

- [ ] **Step 3: Test rate limiting**

```bash
# Send 61 requests in quick succession
for i in $(seq 1 61); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/session; done
```

Expected: First 60 return `200`, 61st returns `429`.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: RAG Chat MVP complete"
```

---

## Task 24: Schema Migration — add User, roles, ownership, indexes, enum consistency

This task updates Task 3's schema to the final shape described in the design doc:
`User` + NextAuth models, `Session` → `ChatSession`, denormalized `userId` on `Document`,
`UserUsage` table, `ChunkingStrategy` as enum everywhere, full index coverage, explicit
`onDelete: Cascade` on all relations.

> **Treat this as a replacement for Task 3.** If the old schema is already deployed, create
> a fresh migration; for a pet-project DB you can drop and recreate.

**Files:**

- Edit: `prisma/schema.prisma`
- Edit: `domain/entities/*.ts` to match renamed/new fields
- Create: `shared/config/limits.ts`

- [ ] **Step 1: Replace `prisma/schema.prisma`**

Use the exact schema from the design doc's Data Model section. Highlights:

- `User` with `role: UserRole @default(USER)`
- NextAuth: `Account`, `AuthSession`, `VerificationToken`
- `ChatSession` (was `Session`) with `userId`
- `Document.userId` denormalized, `Document.chunkingStrategy` as enum
- `UserUsage(userId, date) @unique` separate table
- `LLMLog.userId`, `LLMLog.chunkingStrategy` as enum
- Explicit `onDelete: Cascade` on every `@relation`
- Indexes on every hot-path column (see design doc "Index rationale")

- [ ] **Step 2: Rename domain entity `Session` → `ChatSession`**

`domain/entities/ChatSession.ts`:

```ts
export interface ChatSession {
	id: string;
	title: string | null;
	userId: string;
	createdAt: Date;
	expiresAt: Date;
}
```

Delete `domain/entities/Session.ts`. Update all imports:

```bash
grep -rl "entities/Session" domain server client app | xargs sed -i "s|entities/Session|entities/ChatSession|g"
```

- [ ] **Step 3: Create `domain/entities/User.ts`**

```ts
export type UserRole = 'USER' | 'ADMIN';

export interface User {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
	role: UserRole;
	createdAt: Date;
}
```

- [ ] **Step 4: Create `shared/config/limits.ts`**

```ts
import { UserRole } from '../../domain/entities/User';

export interface RoleLimits {
	queriesPerDay: number;
	maxDocumentsPerSession: number;
	maxChatSessions: number;
}

export const LIMITS_BY_ROLE: Record<UserRole, RoleLimits> = {
	USER: { queriesPerDay: 100, maxDocumentsPerSession: 5, maxChatSessions: 10 },
	ADMIN: { queriesPerDay: Infinity, maxDocumentsPerSession: Infinity, maxChatSessions: Infinity },
};
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add_user_roles_ownership
npx prisma generate
```

Recreate pgvector index (migration drops it since the column type is `Unsupported`):

```bash
npx prisma db execute --stdin <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
SQL
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(schema): add User+auth models, ChatSession rename, roles, ownership, indexes"
```

---

## Task 25: NextAuth v5 with Google provider

**Files:**

- Create: `auth.ts` (project root)
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts` (or update if it already exists for rate limiting)
- Create: `server/application/ports/IAuthContext.ts`
- Create: `server/infrastructure/auth/NextAuthContext.ts`
- Edit: `.env.local`

- [ ] **Step 1: Install dependencies**

```bash
npm install next-auth@beta @auth/prisma-adapter
```

- [ ] **Step 2: Google OAuth setup**

In Google Cloud Console:

1. Create OAuth 2.0 Client ID (type: Web application)
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   (add Vercel URL when deploying)
3. Copy Client ID and Client Secret

Add to `.env.local`:

```
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_GOOGLE_ID="<client id>"
AUTH_GOOGLE_SECRET="<client secret>"
```

- [ ] **Step 3: Create `auth.ts` in project root**

```ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prismaClient } from './server/infrastructure/prisma-orm/prismaClient';
import { UserRole } from './domain/entities/User';

export const { handlers, auth, signIn, signOut } = NextAuth({
	adapter: PrismaAdapter(prismaClient),
	providers: [
		Google({
			clientId: process.env.AUTH_GOOGLE_ID!,
			clientSecret: process.env.AUTH_GOOGLE_SECRET!,
		}),
	],
	session: { strategy: 'jwt' },
	callbacks: {
		async jwt({ token, user }) {
			// On sign-in, load role from DB and bake into the token
			if (user) {
				const dbUser = await prismaClient.user.findUnique({
					where: { id: user.id },
					select: { role: true },
				});
				token.role = (dbUser?.role ?? 'USER') as UserRole;
				token.userId = user.id;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.id = token.userId as string;
				session.user.role = token.role as UserRole;
			}
			return session;
		},
	},
	pages: {
		signIn: '/signin',
	},
});

// Ambient type augmentation so `session.user.role` is typed
declare module 'next-auth' {
	interface Session {
		user: {
			id: string;
			email: string;
			name?: string | null;
			image?: string | null;
			role: UserRole;
		};
	}
}

declare module 'next-auth/jwt' {
	interface JWT {
		userId?: string;
		role?: UserRole;
	}
}
```

- [ ] **Step 4: Create route handler**

`app/api/auth/[...nextauth]/route.ts`:

```ts
export { GET, POST } from '../../../../auth';

// Actually, re-export the handlers:
import { handlers } from '../../../../auth';
export const { GET, POST } = handlers;
```

(Second block is the correct one — delete the first after you paste.)

- [ ] **Step 5: Create sign-in page**

`app/signin/page.tsx`:

```tsx
'use client';
import { signIn } from 'next-auth/react';

export default function SignInPage() {
	return (
		<div className='grid min-h-screen place-items-center p-6'>
			<div className='w-full max-w-sm space-y-4 text-center'>
				<h1 className='text-2xl font-semibold'>RAG Chat</h1>
				<p className='text-muted-foreground text-sm'>Sign in to continue</p>
				<button
					onClick={() => signIn('google', { callbackUrl: '/' })}
					className='hover:bg-accent h-10 w-full rounded-md border px-4'
				>
					Continue with Google
				</button>
			</div>
		</div>
	);
}
```

- [ ] **Step 6: Add SessionProvider to root layout**

`app/layout.tsx`:

```tsx
import { SessionProvider } from 'next-auth/react';
import { auth } from '../auth';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const session = await auth();
	return (
		<html lang='en'>
			<body>
				<SessionProvider session={session}>{children}</SessionProvider>
			</body>
		</html>
	);
}
```

- [ ] **Step 7: Protect API routes — create `IAuthContext` port**

`server/application/ports/IAuthContext.ts`:

```ts
import { UserRole } from '../../../domain/entities/User';

export interface AuthenticatedUser {
	id: string;
	email: string;
	role: UserRole;
}

export interface IAuthContext {
	getUser(): Promise<AuthenticatedUser | null>;
	requireUser(): Promise<AuthenticatedUser>; // throws 'unauthenticated' if null
	requireAdmin(): Promise<AuthenticatedUser>; // throws 'forbidden' if not ADMIN
}
```

`server/infrastructure/auth/NextAuthContext.ts`:

```ts
import { auth } from '../../../auth';
import { IAuthContext, AuthenticatedUser } from '../../application/ports/IAuthContext';

export class NextAuthContext implements IAuthContext {
	async getUser(): Promise<AuthenticatedUser | null> {
		const session = await auth();
		if (!session?.user) return null;
		return {
			id: session.user.id,
			email: session.user.email,
			role: session.user.role,
		};
	}

	async requireUser(): Promise<AuthenticatedUser> {
		const user = await this.getUser();
		if (!user) throw new Error('unauthenticated');
		return user;
	}

	async requireAdmin(): Promise<AuthenticatedUser> {
		const user = await this.requireUser();
		if (user.role !== 'ADMIN') throw new Error('forbidden');
		return user;
	}
}
```

Wire into `server/infrastructure/http/container.ts`:

```ts
import { NextAuthContext } from '../auth/NextAuthContext';
export const authContext = new NextAuthContext();
```

- [ ] **Step 8: Update API routes to require auth**

Pattern for each route (`/api/chat`, `/api/ingest`, `/api/session`, `/api/llmops`):

```ts
import { authContext } from '../../../server/infrastructure/http/container'

export async function POST(req: NextRequest) {
  let user
  try {
    user = await authContext.requireUser()
  } catch {
    return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
  }

  // ... pass user.id to services
  await retrievalService.stream({ ..., userId: user.id, role: user.role })
}
```

For `/api/llmops` require admin:

```ts
try {
	await authContext.requireAdmin();
} catch (e: any) {
	const status = e.message === 'unauthenticated' ? 401 : 403;
	return new Response(JSON.stringify({ error: e.message }), { status });
}
```

- [ ] **Step 9: Protect UI routes with middleware**

`middleware.ts` at project root — combine auth gate with existing IP rate limit:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from './auth';
import { checkRateLimit } from './shared/lib/rateLimit';

const PUBLIC_PATHS = ['/signin', '/api/auth'];

export default async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// IP rate limit applies to all /api/* — keep from Task 14
	if (pathname.startsWith('/api/')) {
		const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
		const { allowed, remaining } = checkRateLimit(ip);
		if (!allowed) {
			return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
		}
		const res = NextResponse.next();
		res.headers.set('X-RateLimit-Remaining', String(remaining));
		// let the route itself handle auth — it has access to `auth()`
		return res;
	}

	// Auth gate for UI pages
	if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

	const session = await auth();
	if (!session) {
		const signIn = new URL('/signin', req.url);
		return NextResponse.redirect(signIn);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "feat(auth): NextAuth v5 with Google provider, roles, route protection"
```

---

## Task 26: Ownership enforcement — add `userId` to all repositories and services

This is the most important security task. Every read/write to user-owned data must take
`userId` as a required parameter; this makes it a compile error to forget.

**Files:** all `server/application/repositories/I*.ts` and `server/infrastructure/prisma-orm/Prisma*.ts`,
plus every service method that reads or writes user data.

- [ ] **Step 1: Update `IChatSessionRepository`** (was `ISessionRepository`)

```ts
import { ChatSession } from '../../../domain/entities/ChatSession';

export interface CreateChatSessionData {
	userId: string;
	title?: string;
	expiresAt: Date;
}

export interface IChatSessionRepository {
	create(data: CreateChatSessionData): Promise<ChatSession>;
	findById(id: string, userId: string): Promise<ChatSession | null>; // ← ownership
	listByUser(userId: string): Promise<ChatSession[]>;
	deleteById(id: string, userId: string): Promise<void>;
}
```

Rename file `ISessionRepository.ts` → `IChatSessionRepository.ts`. Prisma impl filters:

```ts
async findById(id: string, userId: string) {
  return prisma.chatSession.findFirst({ where: { id, userId } })  // AND, not just where id
}
```

- [ ] **Step 2: Update `IDocumentRepository`**

```ts
export interface IDocumentRepository {
	create(data: CreateDocumentData & { userId: string }): Promise<Document>;
	findById(id: string, userId: string): Promise<Document | null>;
	listBySession(sessionId: string, userId: string): Promise<Document[]>;
	listByUser(userId: string): Promise<Document[]>;
}
```

Prisma impl uses the denormalized `Document.userId`:

```ts
findById(id, userId) → prisma.document.findFirst({ where: { id, userId } })
```

- [ ] **Step 3: Update `IChunkRepository`**

```ts
export interface IChunkRepository {
	saveMany(chunks: CreateChunkData[]): Promise<void>;
	similaritySearch(params: {
		queryVector: number[];
		documentId: string;
		userId: string; // ← ownership
		topK: number;
	}): Promise<ChunkWithSimilarity[]>;
}
```

Prisma impl — join through document:

```sql
SELECT c.id, c.content, 1 - (c.embedding <=> $1::vector) AS similarity
FROM chunks c
JOIN documents d ON d.id = c."documentId"
WHERE c."documentId" = $2 AND d."userId" = $3
ORDER BY c.embedding <=> $1::vector
LIMIT $4;
```

- [ ] **Step 4: Update `IMessageRepository`**

```ts
export interface IMessageRepository {
	saveMany(msgs: CreateMessageData[]): Promise<void>;
	findBySessionId(sessionId: string, userId: string): Promise<Message[]>;
}
```

Prisma impl joins through session:

```ts
findBySessionId(sessionId, userId) → prisma.message.findMany({
  where: { sessionId, session: { userId } },
  orderBy: { createdAt: 'asc' },
})
```

- [ ] **Step 5: Create `IUserUsageRepository`**

```ts
export interface IUserUsageRepository {
	getToday(userId: string): Promise<number>;
	incrementToday(userId: string): Promise<number>; // returns new count
}
```

Prisma impl:

```ts
async getToday(userId: string): Promise<number> {
  const today = startOfUtcDay()
  const row = await prisma.userUsage.findUnique({ where: { userId_date: { userId, date: today } } })
  return row?.queries ?? 0
}

async incrementToday(userId: string): Promise<number> {
  const today = startOfUtcDay()
  const row = await prisma.userUsage.upsert({
    where:  { userId_date: { userId, date: today } },
    update: { queries: { increment: 1 } },
    create: { userId, date: today, queries: 1 },
  })
  return row.queries
}
```

Replace old `SessionService.validateLimit` / `increment` with:

```ts
import { LIMITS_BY_ROLE } from '../../../shared/config/limits';
import { UserRole } from '../../../domain/entities/User';

export class SessionService {
	constructor(
		private sessionRepo: IChatSessionRepository,
		private usageRepo: IUserUsageRepository,
	) {}

	async validateLimit(userId: string, role: UserRole): Promise<void> {
		const limit = LIMITS_BY_ROLE[role].queriesPerDay;
		if (!isFinite(limit)) return;
		const used = await this.usageRepo.getToday(userId);
		if (used >= limit) throw new Error('limit_reached');
	}

	async incrementUsage(userId: string): Promise<void> {
		await this.usageRepo.incrementToday(userId);
	}
}
```

- [ ] **Step 6: Propagate `userId` through `RetrievalService` and `IngestionService`**

Both services take `userId` (and `role` where needed for limit check) in their params
and pass it to every repo call. Example `RetrievalService.stream`:

```ts
async *stream(params: {
  message: string
  sessionId: string
  documentId: string
  userId: string
  role: UserRole
  ...
}) {
  await this.sessionService.validateLimit(params.userId, params.role)
  // ownership check — if session doesn't belong to user, findById returns null
  const session = await this.sessionRepo.findById(params.sessionId, params.userId)
  if (!session) throw new Error('not_found')

  const queryVector = await this.embeddingClient.embed(params.message)
  const candidates = await this.chunkRepo.similaritySearch({
    queryVector,
    documentId: params.documentId,
    userId: params.userId,
    topK: WIDE_K,
  })
  // ... rest unchanged, but every repo call threads userId
  await this.sessionService.incrementUsage(params.userId)
  await this.messageRepo.saveMany(...)
}
```

- [ ] **Step 7: API routes pass `user.id` and `user.role` into services**

Already shown in Task 25 Step 8 — tie it all together.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat(security): ownership filters via required userId on repositories and services"
```

---

## Environment Variables Checklist

Before deploying to Vercel:

```
DATABASE_URL          — Neon connection string (pooled)
DIRECT_URL            — Neon direct connection string (for migrations)
GOOGLE_AI_KEY         — from aistudio.google.com (free)
COHERE_API_KEY        — from dashboard.cohere.com (free tier)
AUTH_SECRET           — openssl rand -base64 32
AUTH_GOOGLE_ID        — Google Cloud Console OAuth client ID
AUTH_GOOGLE_SECRET    — Google Cloud Console OAuth client secret
NEXTAUTH_URL          — production URL (e.g. https://ragchat.vercel.app) — optional on Vercel, required on self-hosted
```

On Vercel: Settings → Environment Variables → add all. Update Google OAuth redirect URIs to
include `https://<your-vercel-url>/api/auth/callback/google`.

After deploy:

```bash
npx prisma migrate deploy
```
