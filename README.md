# RAG Chat

A Retrieval-Augmented Generation chatbot built with Next.js and TypeScript. Indexes a custom knowledge base into an embeddings store and uses an LLM to answer questions grounded in that content.

> Built as a deep-dive into LLM-powered application architecture, with an emphasis on clean separation of concerns rather than a quick prototype.

## Stack

- **Framework:** Next.js (App Router), TypeScript
- **Database & ORM:** PostgreSQL, Prisma
- **UI:** Tailwind CSS, shadcn/ui
- **Testing:** Vitest
- **Tooling:** ESLint, Prettier, Husky, lint-staged
- **AI:** [укажите конкретно: OpenAI / Anthropic / другой LLM provider] for response generation, [укажите: pgvector / Pinecone / другая векторная БД] for embeddings storage and semantic search

## Architecture

The codebase is organised by domain rather than by framework convention. Each top-level folder has a clear responsibility:

```
domain/        # Pure business logic, no framework dependencies
app/           # Application use cases / orchestration
server/        # Server-side adapters (API routes, DB access)
client/        # Client-side state and hooks
presentation/  # UI components (shadcn/ui based)
shared/        # Cross-cutting utilities
test/          # Vitest tests
```

This layout keeps business logic decoupled from Next.js, so the same domain code could be moved to a different framework with minimal rewriting.

## How RAG works here

1. Source documents are split into chunks and converted into vector embeddings.
2. Embeddings are stored in [укажите векторную БД].
3. When a user asks a question, the question is embedded and the nearest chunks are retrieved by semantic similarity.
4. Those chunks are passed to the LLM as context, so answers are grounded in the indexed content rather than the model's general knowledge.

## Getting started

```bash
# install
npm install

# set up environment
cp .env.example .env
# fill in: DATABASE_URL, LLM API key, etc.

# database
npx prisma migrate dev

# run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run test         # run Vitest tests
npm run lint         # ESLint
```

## Status

Active personal project. Built to learn LLM integration patterns, embeddings, and clean architecture in a real Next.js codebase.
