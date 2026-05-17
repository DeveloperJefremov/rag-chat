# RAG Chat — полное техническое руководство

Документ написан для того, чтобы автор проекта мог:

1. **Объяснить приложение целиком** другому человеку (коллеге, рекрутеру, инвестору).
2. **Уверенно отвечать на любой вопрос на собеседовании** — от «что такое RAG» до «почему именно pgvector, а не Pinecone».
3. **Вернуться к проекту через полгода** и быстро вспомнить, как он устроен.

Документ длинный намеренно: лучше один раз прочитать и понять _все_ системные связи, чем потом вспоминать на лету.

---

## Содержание

1. [Что такое приложение и какую задачу решает](#1-что-такое-приложение-и-какую-задачу-решает)
2. [Что такое RAG и зачем он нужен](#2-что-такое-rag-и-зачем-он-нужен)
3. [Технологический стек](#3-технологический-стек)
4. [Архитектура: Onion / Clean Architecture](#4-архитектура-onion--clean-architecture)
5. [Аутентификация и авторизация](#5-аутентификация-и-авторизация)
6. [Модель данных (Prisma + PostgreSQL + pgvector)](#6-модель-данных-prisma--postgresql--pgvector)
7. [Pipeline 1: Ingestion (загрузка документов)](#7-pipeline-1-ingestion-загрузка-документов)
8. [Pipeline 2: Retrieval & Chat (RAG)](#8-pipeline-2-retrieval--chat-rag)
9. [Векторный поиск через pgvector](#9-векторный-поиск-через-pgvector)
10. [Reranking — что это и зачем](#10-reranking--что-это-и-зачем)
11. [Streaming через Server-Sent Events (SSE)](#11-streaming-через-server-sent-events-sse)
12. [Безопасность и rate limiting (три уровня)](#12-безопасность-и-rate-limiting-три-уровня)
13. [LLMOps и observability](#13-llmops-и-observability)
14. [Лимиты, квоты и роли](#14-лимиты-квоты-и-роли)
15. [Cleanup, retention и GDPR (анонимизация)](#15-cleanup-retention-и-gdpr-анонимизация)
16. [Frontend (клиентская архитектура)](#16-frontend-клиентская-архитектура)
17. [Чанкинг: 4 стратегии](#17-чанкинг-4-стратегии)
18. [Расчёт стоимости запроса](#18-расчёт-стоимости-запроса)
19. [Деплой и инфраструктура](#19-деплой-и-инфраструктура)
20. [Известные ограничения и что бы я улучшил](#20-известные-ограничения-и-что-бы-я-улучшил)
21. [FAQ для собеседования](#21-faq-для-собеседования)

---

## 1. Что такое приложение и какую задачу решает

**RAG Chat** — это веб-приложение, в котором пользователь:

1. Заходит через **Google OAuth**.
2. **Загружает свои документы** (PDF, TXT, DOCX).
3. **Прикрепляет** один или несколько документов к чат-сессии.
4. **Задаёт вопросы на естественном языке**, и LLM (Gemini 2.5 Flash) отвечает, опираясь именно на эти документы (а не на свою тренировочную базу).

Это типичный сценарий **«chat with your documents»**: студент задаёт вопросы по конспекту, юрист — по контракту, разработчик — по технической документации. Приложение работает как универсальный «семантический поиск + объяснение» поверх произвольного набора файлов.

### Отличие от обычного ChatGPT

ChatGPT отвечает на основе того, что увидел при тренировке. Он **не знает** про конкретный PDF, который только что загрузил пользователь. Поместить весь PDF в prompt тоже нельзя — там может быть 100 страниц, а контекстное окно не резиновое (и каждый токен стоит денег и времени).

RAG (Retrieval-Augmented Generation) решает это: **система сама находит нужные куски** документа под конкретный вопрос и кладёт в prompt только их. Ответ привязан к источнику — модель цитирует имя файла.

### Зачем этот проект существует

Технически это **portfolio / interview project**, который демонстрирует:

- полный RAG-пайплайн, написанный с нуля (без LangChain / LlamaIndex);
- **Onion / Clean Architecture** на TypeScript;
- LLMOps: метрики, стоимость, наблюдаемость;
- multi-user изоляция данных (cross-tenant safety);
- работа с векторными БД (pgvector);
- SSE-стриминг ответов LLM;
- современный стек (Next.js 16, React 19, NextAuth v5, Prisma 7, Tailwind v4).

---

## 2. Что такое RAG и зачем он нужен

**RAG = Retrieval-Augmented Generation**. Дословно: «генерация, дополненная извлечением».

### Базовая идея

LLM хорошо умеет _рассуждать_ и _генерировать связный текст_, но плохо знает _твои конкретные данные_. Решение:

1. Заранее разбить документы на куски (**chunks**).
2. Превратить каждый кусок в **вектор** (embedding) — массив чисел, описывающий смысл текста.
3. Сохранить векторы в БД с поддержкой векторного поиска.
4. Когда пользователь задаёт вопрос:
   - превращаем **вопрос** в вектор тем же способом;
   - ищем в БД **самые близкие куски** по косинусной/евклидовой близости;
   - кладём эти куски в prompt вместе с вопросом;
   - LLM отвечает уже с этим контекстом.

### Почему это работает

Векторные представления (embeddings) от современных моделей **сохраняют семантическую близость**: «как уволиться» и «процедура расторжения трудового договора» окажутся близко в векторном пространстве, хотя слова разные. Поэтому поиск находит нужный кусок даже без точного совпадения слов.

### Где здесь «augmented»

Generation **дополняется** retrieved-контекстом: вместо «LLM придумывай из головы» получается «вот тебе релевантные куски документа — ответь, опираясь на них». Это резко снижает галлюцинации и даёт **возможность цитирования** (мы знаем, какой кусок из какого документа использовался).

### Почему так делают, а не просто кладут весь документ в prompt

- **Контекстное окно ограничено**. У Gemini 2.5 Flash оно 1M токенов, но это абстрактный максимум — на практике с большим контекстом качество падает.
- **Каждый токен — деньги и время**. Класть 100 страниц на каждый запрос финансово безумно.
- **Точность падает**. LLM теряет важное на длинных контекстах (явление известно как «lost in the middle»).
- **Multi-document**. Если у пользователя 10 документов — никакого контекстного окна не хватит.

RAG = «дай LLM только то, что ему действительно нужно для ответа».

---

## 3. Технологический стек

| Слой               | Технология                                                                 | Почему именно она                                                                     |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Framework          | **Next.js 16** (App Router)                                                | один проект на frontend + backend, серверные компоненты, deploy на Vercel в один клик |
| UI                 | **React 19**, TypeScript                                                   | стандарт индустрии, типизация важна для Onion                                         |
| Styling            | **Tailwind CSS v4**, **shadcn/ui**                                         | быстрая разработка UI без CSS-файлов, готовые доступные компоненты                    |
| Auth               | **NextAuth v5 (Auth.js)** + Google provider + Prisma adapter               | OAuth «из коробки», JWT-сессии, не надо городить свою auth                            |
| ORM                | **Prisma 7**                                                               | типизированные query-объекты, миграции, declarative schema                            |
| Database           | **PostgreSQL (Neon)**                                                      | serverless Postgres, дешёвый free-tier, поддержка extensions                          |
| Vector storage     | **pgvector** на той же БД                                                  | не плодим отдельный сервис (Pinecone/Weaviate), один Postgres решает всё              |
| Embeddings         | **Google `gemini-embedding-001`** (768 dim)                                | бесплатно через AI Studio API                                                         |
| Reranking          | **Cohere `rerank-v3.5`** (cloud) или локально **Xenova/bge-reranker-base** | можно переключаться: облачный точнее, локальный бесплатный                            |
| LLM                | **Gemini 2.5 Flash**                                                       | быстрый, бесплатный free-tier, поддерживает streaming                                 |
| File parsing       | `pdf-parse`, `mammoth`, нативный TXT                                       | стандартные npm-библиотеки                                                            |
| State (frontend)   | **Zustand**                                                                | минималистично, без boilerplate Redux                                                 |
| Forms / validation | `react-hook-form`, `zod`                                                   | тип-безопасные формы                                                                  |
| Rate limiting      | **Upstash Redis** + `@upstash/ratelimit`                                   | serverless Redis, sliding window из коробки                                           |
| Tests              | **Vitest** + `@testing-library/react`                                      | быстрые unit-тесты, нативный ESM                                                      |
| Lint / format      | ESLint, Prettier, Husky                                                    | стандартный набор для качества кода                                                   |
| Deploy             | **Vercel** + **Neon**                                                      | оба serverless, оба с free-tier                                                       |

**Все внешние AI-сервисы — на бесплатных квотах.** Это сделано специально для портфолио: проект можно запустить и показать, не платя ни доллара.

---

## 4. Архитектура: Onion / Clean Architecture

Проект построен по **Onion Architecture**. Это разновидность Clean Architecture: код организован концентрическими слоями, и **зависимости направлены строго внутрь — к domain-слою**.

### Зачем это нужно

Если завтра потребуется:

- сменить Gemini на OpenAI;
- сменить Cohere на свой reranker;
- сменить Google embeddings на OpenAI embeddings;
- поменять PostgreSQL на MongoDB+Pinecone;
- запустить тот же бизнес-код в CLI-утилите без HTTP;

то **должен поменяться только один файл — `container.ts`** (и одна реализация infrastructure-класса). Бизнес-логика, лежащая в `application/` и `domain/`, не должна знать ни про HTTP, ни про Prisma, ни про Google.

### Слои (от внешнего к внутреннему)

```
┌─────────────────────────────────────────────────────┐
│ presentation/  ← React-компоненты, страницы          │
│   ↓                                                  │
│ client/        ← Zustand store, API-клиенты          │
│   ↓                                                  │
│ app/api/       ← HTTP-роуты Next.js                  │
│   ↓                                                  │
│ server/                                              │
│   infrastructure/  ← Prisma, Google API, Cohere,     │
│   ↓                  pdf-parse, NextAuth wrapper     │
│   application/     ← бизнес-сервисы и порты          │
│   ↓                  (IngestionService и т.д.)       │
│ domain/        ← entities, value objects, чистая     │
│                  бизнес-логика без зависимостей      │
└─────────────────────────────────────────────────────┘
```

### Правило зависимостей

`presentation → client → application ← infrastructure`, и в центре `domain`, на который смотрят все.

Application-слой объявляет **порты** — TypeScript-интерфейсы (`ILLMClient`, `IEmbeddingClient`, `IRerankClient`, `IFileParser`, `IAuthContext`, все `I*Repository`). Конкретные реализации лежат в `infrastructure/` и пробрасываются через **DI-контейнер** (`server/infrastructure/http/container.ts`).

Application-слой **не импортирует** ничего из infrastructure напрямую. Он работает только с интерфейсами.

### Пример — RetrievalService

```ts
constructor(deps: {
  chunkRepo: IChunkRepository;        // интерфейс
  embeddingClient: IEmbeddingClient;  // интерфейс
  llmClient: ILLMClient;              // интерфейс
  rerankClient: IRerankClient;        // интерфейс
  ...
}) { ... }
```

`RetrievalService` не знает, что embeddings приходят от Google, что LLM — Gemini, что rerank — Cohere. Он знает только контракты. Это:

- упрощает unit-тесты (мокаем интерфейсы);
- упрощает миграцию провайдеров;
- защищает бизнес-логику от vendor lock-in.

### Структура папок

```
domain/                       ← чистый core
  entities/                   ← User, Document, Chunk, Message, ChatSession, LLMLog
  value-objects/              ← FileType, ChunkingStrategy
  services/                   ← ChunkingService (алгоритмы чанкования)

server/
  application/                ← бизнес-логика
    repositories/             ← интерфейсы I*Repository
    ports/                    ← интерфейсы внешних сервисов
    ingestion/                ← IngestionService
    retrieval/                ← RetrievalService
    session/                  ← SessionService (квоты)
    llmops/                   ← LLMOpsService
    account/                  ← AccountService (удаление)
    cleanup/                  ← CleanupService (cron-задачи)
  infrastructure/             ← конкретные реализации
    prisma-orm/               ← Prisma*Repository
    google/                   ← GoogleEmbeddingClient, GeminiClient
    cohere/                   ← CohereRerankClient
    local/                    ← LocalRerankClient (Xenova/bge)
    parsers/                  ← PdfParser, TxtParser, DocxParser
    auth/                     ← NextAuthContext (реализует IAuthContext)
    http/                     ← container.ts (DI)

client/
  application/
    api/                      ← I*Api интерфейсы
    services/                 ← оркестрация (ChatSessionService)
  infrastructure/
    http/                     ← *Api implementations + apiFetch
    container.ts              ← клиентский DI
  stores/                     ← Zustand stores (UI state only)
  hooks/                      ← React-хуки

presentation/
  web/
    pages/                    ← Chat, Documents, Stats, SignIn
    layout/                   ← Sidebar, AppLayout
    components/               ← MessageList, MessageInput, FileDropzone, ...
  components/ui/              ← shadcn-сгенерированные компоненты

app/                          ← Next.js App Router
  (app)/                      ← защищённые маршруты (auth required)
  signin/                     ← публичная страница входа
  api/                        ← все backend-роуты

shared/                       ← код, видимый всем слоям
  dtos/                       ← Data Transfer Objects (типы для wire-формата)
  config/                     ← constants, limits, docFilter
  errors/                     ← AppError + httpErrorResponse
  http/                       ← withAuth (HOF для роутов)
  lib/                        ← rateLimit, fileSignature, utils

prisma/                       ← schema.prisma + миграции
auth.ts, auth.config.ts       ← NextAuth
middleware.ts                 ← Edge-middleware (auth gate + IP rate limit)
```

---

## 5. Аутентификация и авторизация

### Конфигурация NextAuth v5

В корне два файла:

- **`auth.config.ts`** — конфигурация (разделена ради edge-совместимости middleware).
- **`auth.ts`** — экспортирует `auth`, `handlers`, `signIn`, `signOut` (использует Prisma-адаптер, который не работает в edge).

Почему два файла: middleware Next.js работает на edge runtime, где Prisma и многие npm-модули недоступны. Поэтому **edge-safe конфиг** (только провайдер + JWT-callback'и) лежит в `auth.config.ts`, а **полный конфиг с Prisma-адаптером** — в `auth.ts`. Middleware подключает только `auth.config.ts`.

### Стратегия сессии — JWT

Не серверные сессии в БД, а JSON Web Token в cookie. Преимущество: сессию можно прочитать без обращения к БД — это важно для middleware (rate limit на каждый запрос), и подходит к serverless-модели Vercel.

### Что лежит в JWT

```ts
{
  id: string,                  // user.id из БД
  role: 'USER' | 'ADMIN',      // роль
  // плюс стандартные NextAuth-поля
}
```

В `jwt({ token, user })` callback — при первом входе в токен записываем `id` и `role` из объекта `user` (NextAuth подгрузил его из БД через PrismaAdapter). На последующих запросах callback уже не вызывает БД, читает из токена.

В `session({ session, token })` callback — переносим `id` и `role` из токена в `session.user`, чтобы они были доступны в коде.

### Module augmentation для типизации

В `auth.config.ts`:

```ts
declare module 'next-auth' {
	interface Session {
		user: { id; email; name; image; role: 'USER' | 'ADMIN' };
	}
	interface User {
		role?: 'USER' | 'ADMIN';
	}
}
```

Это TypeScript-расширение типов NextAuth: теперь `session.user.role` строго типизирован, а не `any`.

### Промоушен в админы

Роль хранится в `User.role`. Первый вход → `USER`. Повышение делается **вручную в БД**:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'me@example.com';
```

После этого пользователь должен **перелогиниться** — JWT кешируется, новый role попадёт в новый токен только после нового sign-in.

### Middleware — auth gate + IP rate limit

`middleware.ts` выполняется **до** любого роута:

```ts
export default auth(async request => {
	// 1. IP rate limit на /api/* (кроме /api/auth/*)
	if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
		const { allowed, remaining } = await checkIpRateLimit(ip);
		if (!allowed) return 429;
	}

	// 2. Auth gate на UI-роуты (кроме /signin и /api/auth)
	if (!isPublic && !session) {
		return NextResponse.redirect('/signin');
	}
});
```

Заметь: rate limit срабатывает **до** auth-проверки. Это специально — атакующий не должен иметь возможность задосить нас, кидая невалидные cookies.

### IAuthContext — порт application-слоя

Application-слой не должен знать про NextAuth. Поэтому объявлен порт:

```ts
interface IAuthContext {
	getUser(): Promise<AuthenticatedUser | null>;
	requireUser(): Promise<AuthenticatedUser>; // throws AppError('unauthenticated')
	requireAdmin(): Promise<AuthenticatedUser>; // throws AppError('forbidden')
}
```

Реализован он в `server/infrastructure/auth/NextAuthContext.ts` — там вызывается `auth()` от NextAuth и результат преобразуется в `AuthenticatedUser`.

### withAuth — обёртка для API-роутов

В каждом роуте в начале вызывается `requireUser()`. Чтобы не повторять это везде, есть HOF:

```ts
export const POST = withAuth(async (req, { user }) => {
	// user уже гарантированно есть
	// если не было сессии — withAuth вернул 401 до вызова handler'а
}, 'chat');
```

Если требуется ADMIN — есть аналогичный `withAdmin`.

### Ownership enforcement (изоляция пользователей)

**Самое критичное место в безопасности.** Каждый repository-метод, который трогает пользовательские данные, принимает `userId` **обязательным параметром**:

```ts
chatSessionRepo.findById(id, userId)        // ← userId required
documentRepo.findByIds(ids, userId)         // ← userId required
chunkRepo.similaritySearch({ userId, ... }) // ← userId required
```

Все Prisma-запросы добавляют `WHERE userId = ?`, либо JOIN-ятся через родителя, который несёт `userId`.

Шаблоны:

- `ChatSession`, `Document` — есть прямая колонка `userId`.
- `Chunk` — изолируется через `JOIN documents d ON d.userId = ?`.
- `Message` — изолируется через `Session.userId`.

В `RetrievalService.stream()` есть **двойная проверка**: после similarity search мы дополнительно проверяем, что **каждый возвращённый chunk** принадлежит документу из allowed-списка. Если нет — кидаем ошибку и пишем в лог:

```ts
for (const c of candidates) {
  if (!allowedDocIds.has(c.documentId)) {
    console.error('[chat] chunk leaked from foreign document', ...);
    throw DocumentNotFound();
  }
}
```

Это на случай, если SQL-запрос ошибётся (например, программист забыл фильтр) — на втором уровне утечка всё равно ловится.

---

## 6. Модель данных (Prisma + PostgreSQL + pgvector)

Файл: `prisma/schema.prisma`. Все таблицы используют UUID как primary key, snake_case в БД (`@@map("...")`), camelCase в коде.

### User — корень всего

```prisma
model User {
  id            String        @id @default(uuid())
  email         String        @unique
  name          String?
  image         String?
  role          UserRole      @default(USER)   // USER | ADMIN
  emailVerified DateTime?
  createdAt     DateTime      @default(now())
  chatSessions  ChatSession[]
  accounts      Account[]
  sessions      Session[]
}
```

`email @unique` — индекс для OAuth-lookup. `role` — для разграничения квот и доступа к admin-роутам.

### Account, Session, VerificationToken — таблицы NextAuth

Это требуемые **PrismaAdapter**-ом NextAuth таблицы. Самое заметное:

- `Account` хранит OAuth-связку (`provider='google'` + `providerAccountId`).
- `Session` — это **NextAuth session**, но в схеме маппится на таблицу `auth_sessions`, чтобы не путаться с нашей доменной `ChatSession`.

### ChatSession — один тред чата

```prisma
model ChatSession {
  id                String
  title             String?
  userId            String
  createdAt         DateTime
  expiresAt         DateTime  // TTL 24 часа
  messages          Message[]
  attachedDocuments SessionDocument[]

  @@index([userId, createdAt])  // список сессий пользователя
  @@index([expiresAt])          // cron-cleanup
}
```

`title` сначала `null` — потом LLM-ом генерируется из первого вопроса (3–5 слов). `expiresAt` — TTL 24 часа, удаляется ночным cron'ом.

### Document — загруженный файл

```prisma
model Document {
  id               String
  name             String
  fileType         FileType            // PDF | TXT | DOCX
  chunkingStrategy ChunkingStrategy    // FIXED | SENTENCE | PARAGRAPH | RECURSIVE
  userId           String              // ← денормализован
  createdAt        DateTime
  chunks           Chunk[]
  sessions         SessionDocument[]   // many-to-many с ChatSession

  @@index([userId, createdAt])
}
```

**Важная деталь:** `userId` денормализован прямо на `Document`. Это позволяет фильтровать документы пользователя без `JOIN`-а на `ChatSession`. Документ — собственность пользователя, а не сессии: один файл можно прикрепить к нескольким сессиям.

### SessionDocument — связь many-to-many

```prisma
model SessionDocument {
  sessionId  String
  documentId String
  attachedAt DateTime
  @@id([sessionId, documentId])
}
```

Пользователь сначала загружает документ глобально, потом «прикрепляет» (attach) его к нужным сессиям.

### Chunk — кусок текста + embedding

```prisma
model Chunk {
  id         String
  content    String
  embedding  Unsupported("vector(768)")   // ← pgvector
  documentId String

  @@index([documentId])
}
```

`Unsupported("vector(768)")` — Prisma не имеет встроенного типа для pgvector. Мы объявляем колонку как `Unsupported` (Prisma не пишет в неё через `prisma.chunk.create`), а сами вставляем через **raw SQL** в репозитории.

768 — это **размерность Google `gemini-embedding-001`**. Менять её нельзя без перезагрузки всех документов.

**pgvector index** создаётся миграцией вручную:

```sql
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 10);
```

`ivfflat` — приближённый ANN-индекс. `lists ≈ √(total_rows)` — эмпирическая формула; для тысяч строк lists=10 нормально, для миллионов нужно бампать.

### Message — сообщения в чате

```prisma
model Message {
  id        String
  role      Role           // USER | ASSISTANT
  content   String
  citations Json?          // CitationDto[] — только у ассистента
  sessionId String
  createdAt DateTime

  @@index([sessionId, createdAt])
}
```

`citations` — JSON-массив `CitationDto[]`. Для USER-сообщений `null`, для ASSISTANT — список использованных источников.

### UserUsage — счётчик запросов в день

```prisma
model UserUsage {
  id      String
  userId  String
  date    DateTime @db.Date  // ← @db.Date, без времени
  queries Int      @default(0)
  @@unique([userId, date])
}
```

Отдельная таблица сделана сознательно: писать счётчик в `User` на каждый запрос — это «горячая» строка с лок-конкуренцией. Здесь же на каждого пользователя на каждый день своя строка, апсертится через `INCREMENT`.

### LLMLog — observability

```prisma
model LLMLog {
  id               String
  userId           String?            // nullable — анонимизируется
  sessionId        String             // НЕТ FK
  documentId       String             // НЕТ FK
  query            String             // обнуляется при анонимизации
  response         String             // обнуляется при анонимизации
  latencyMs        Int
  promptTokens     Int
  completionTokens Int
  estimatedCostUsd Float
  hasCitation      Boolean
  rerankingUsed    Boolean
  chunkingStrategy ChunkingStrategy   // именно enum, не String
  retrievedChunks  Json?              // [{ chunkId, documentId, similarity, rerankScore, rank }]
  createdAt        DateTime
  anonymizedAt     DateTime?
}
```

Важное:

- `sessionId`, `documentId` **без FK** — лог должен пережить удаление сессии/документа.
- При удалении аккаунта строка **анонимизируется**, а не удаляется (см. секцию GDPR).
- `chunkingStrategy` — enum (как и в `Document`), а не строка.

### DeletedUserAudit — compliance-журнал

```prisma
model DeletedUserAudit {
  id                    String
  originalUserId        String
  registeredAt          DateTime
  deletedAt             DateTime
  role                  UserRole
  totalQueries          Int
  totalDocuments        Int
  totalChatSessions     Int
  totalCostUsd          Float
  totalPromptTokens     Int
  totalCompletionTokens Int
}
```

Когда пользователь удаляет аккаунт, мы:

1. Считаем агрегаты из его LLMLog (сколько он сделал запросов, сколько токенов потратил).
2. Записываем в DeletedUserAudit (без email, без имени — только агрегаты).
3. Анонимизируем LLMLog (см. секцию 15).
4. Удаляем User (cascade чистит всё его).

Так мы сохраняем общий учёт «было N удалённых юзеров с такой-то нагрузкой» без хранения PII.

### Все relations с `onDelete: Cascade`

Удаление User → каскадно удаляет ChatSession, Account, Session.
Удаление ChatSession → каскадно удаляет Message и SessionDocument-связки.
Удаление Document → каскадно удаляет Chunk и SessionDocument-связки.

LLMLog в этой цепочке **не участвует** — у него нет FK.

### Индексы — как покрыты hot-path queries

| Запрос                         | Индекс                                         |
| ------------------------------ | ---------------------------------------------- |
| OAuth lookup                   | `User.email @unique`                           |
| NextAuth Account match         | `Account(provider, providerAccountId) @unique` |
| Список сессий пользователя     | `ChatSession(userId, createdAt)`               |
| Cleanup expired сессий         | `ChatSession(expiresAt)`                       |
| Список документов пользователя | `Document(userId, createdAt)`                  |
| Чанки документа                | `Chunk(documentId)`                            |
| Векторный поиск                | `pgvector ivfflat(embedding)`                  |
| История чата                   | `Message(sessionId, createdAt)`                |
| Дневной счётчик upsert         | `UserUsage(userId, date) @unique`              |
| Stats dashboard                | `LLMLog(createdAt)`                            |
| Per-user analytics             | `LLMLog(userId, createdAt)`                    |

**Всё, что выбирается по hot-path — покрыто индексом.** Это сознательное решение, а не «авось ляжет».

---

## 7. Pipeline 1: Ingestion (загрузка документов)

Endpoint: `POST /api/ingest` (`multipart/form-data`).

### Шаги в `IngestionService.ingest()`

```
1. authContext.requireUser()
   → 401 если нет сессии

2. Валидация файла:
   - тип ∈ {pdf, txt, docx}
   - размер ≤ 10 MB
   - file signature: проверяем magic bytes (PDF: "%PDF", DOCX: ZIP-header,
     TXT: отсутствие бинарных сигнатур и null-байтов в первых 8 KB)

3. Если attachToSession:
   - chatSessionRepo.findById(sessionId, userId) → 404 если не владелец
   - проверка лимита прикреплённых: ≤ maxAttachedPerSession для роли
   - проверка лимита документов в системе у пользователя:
     ≤ maxDocumentsPerUser

4. Парсинг текста:
   - PDF → PdfParser (pdf-parse) → text
   - DOCX → DocxParser (mammoth.extractRawText) → text
   - TXT → TxtParser (buffer.toString('utf-8'))

5. Если text пустой/слишком короткий (≤10 символов) → throw EmptyDocument()

6. Чанкование:
   const chunks = chunkingService.chunk(text, strategy)
   // strategy ∈ {FIXED, SENTENCE, PARAGRAPH, RECURSIVE}
   // дефолт: RECURSIVE

7. Embeddings (батчем):
   const vectors = await embeddingClient.embedBatch(chunkTexts)
   // Google API, taskType='RETRIEVAL_DOCUMENT', dim=768

8. Создание Document в транзакции:
   - INSERT INTO documents (id, name, fileType, chunkingStrategy, userId, ...)
   - INSERT INTO chunks (id, content, embedding, documentId)
     (через raw SQL, потому что embedding — vector(768))
   - Если attachToSession: INSERT INTO session_documents

9. Возврат IngestResponseDto:
   { id, name, fileType, chunkingStrategy, chunkCount, createdAt }
```

### Почему `taskType='RETRIEVAL_DOCUMENT'`

Google рекомендует разные `taskType` для разных целей:

- `RETRIEVAL_DOCUMENT` — для документов в индексе.
- `RETRIEVAL_QUERY` — для поисковых запросов.

Они тренируются с лёгкой асимметрией: вектора документа и вектора запроса оптимально близки, когда индексировались правильным `taskType`. Это даёт прирост recall.

### Почему чанкование делается на стороне сервера

Можно было бы и на клиенте, но:

- На клиенте слабее процессор и память.
- Клиент не должен видеть «сырые» правила бизнес-логики чанкования.
- Это операция с состоянием БД (надо коммитить chunks вместе с document) — естественно делать на сервере в транзакции.

---

## 8. Pipeline 2: Retrieval & Chat (RAG)

Endpoint: `POST /api/chat`. Body — `ChatRequestDto`. Response — **SSE stream**.

### Запрос

```ts
{
  message: string;              // вопрос пользователя
  sessionId: string;            // куда писать чат
  documentIds: string[];        // какие документы искать
  chunkingStrategy?: ChunkingStrategy;  // дефолт RECURSIVE
  topK?: number;                // дефолт 5
  rerankingEnabled?: boolean;   // дефолт true
}
```

### Шаги (`RetrievalService.stream()`)

```
1. sessionService.validateLimit(userId, role)
   → throws LimitReached если queries сегодня >= queriesPerDay

2. Валидация ownership:
   const ownedDocs = await documentRepo.findByIds(documentIds, userId)
   if (ownedDocs.length !== documentIds.length) throw DocumentNotFound()

3. Document filter (filterDocumentsByQuery):
   - Если documentIds.length > 1, фильтруем по совпадению токенов запроса
     с именами файлов (стоп-слова исключены, длина токена ≥ 3).
   - Если есть документы с максимальным score > 0 — оставляем только их.
   - Если все score=0 — оставляем все.
   Идея: если пользователь написал "по контракту X скажи...", и среди файлов
   есть "контракт_X.pdf" и "договор_аренды.pdf", второй можно не трогать.
   Это не замена векторного поиска — это очень дешёвый pre-filter.

4. Embed query:
   const queryVector = await embeddingClient.embed(message)
   // taskType='RETRIEVAL_QUERY', dim=768

5. Similarity search (raw SQL pgvector):
   topK = rerankingEnabled ? topK*3 : topK
   // больше кандидатов берём, чтобы reranker имел из чего выбрать

   SELECT c.id, c.content, c."documentId",
          (c.embedding <=> $queryVector) AS distance
   FROM chunks c
   JOIN documents d ON d.id = c."documentId"
   WHERE c."documentId" = ANY($filteredDocIds)
     AND d."userId" = $userId            -- ← ownership!
   ORDER BY c.embedding <=> $queryVector  -- ANN
   LIMIT $topK

   similarity = 1 - distance

6. Двойная проверка ownership:
   for chunk of candidates:
     if chunk.documentId not in allowedDocIds:
       throw DocumentNotFound()

7. Reranking (если включён и кандидатов > 0):
   const results = await rerankClient.rerank({
     query: message,
     candidates: candidates.map(c => ({ content, originalIndex })),
     topN: topK
   })
   reranked = results.map(r => candidates[r.originalIndex])
   // если rerank упадёт — fallback: candidates.slice(0, topK)

8. Подготовка sources (CitationDto[]):
   { index: i+1, content: chunk.content.slice(0, 200), documentName }

9. yield { sources }   ← первый SSE-event клиенту

10. Загрузка истории:
    const history = await messageRepo.findRecentBySessionId(sessionId, 10)

11. buildAugmentedPrompt:
    "You are a helpful assistant with access to the user's uploaded documents.

    How to answer:
    1. If the answer is in the provided context, use it as the primary source.
       When citing, use the document's file name (e.g. "report.pdf"). Do NOT
       use numeric references like [1], [2].
    2. If the context does NOT contain the answer, you may still answer using
       your general knowledge. In that case, your VERY FIRST output token must
       be the literal sentinel "[GENERAL_KNOWLEDGE]" on its own line, followed
       by a newline, then the answer.
    3. If you genuinely cannot answer at all, say so plainly without the sentinel.

    Always reply in the same language as the user's question (the sentinel
    itself stays in English).

    Context:
    ---
    Source: file1.pdf
    [chunk 1 content]
    ---
    Source: file2.pdf
    [chunk 2 content]
    ---

    Chat history:
    User: ...
    Assistant: ...

    Current question: ${message}"

12. LLM streaming:
    for await (const text of llmClient.streamMessage(prompt)):
      fullResponse += text
      completionTokens += text.split(/\s+/).length
      yield text         ← каждый кусочек уходит клиенту как { type: 'chunk' }

13. В finally (выполняется и при успехе, и при ошибке):
    - sessionService.incrementUsage(userId)
      → upsert UserUsage(userId, today).queries += 1
    - messageRepo.saveMany([
        { role: 'USER', content: message, sessionId },
        { role: 'ASSISTANT', content: fullResponse, sessionId, citations: sources }
      ])
    - estimatedCostUsd = ...    (см. секцию 18)
    - llmOpsService.log({...}) ← FIRE-AND-FORGET (.catch для ошибок)

14. Если это первый обмен (history.length === 0):
    - generateTitle(sessionId, userId, message)
      - LLM генерирует короткий title (3-5 слов)
      - очищаем от кавычек, точек, ограничиваем 80 символами
      - chatSessionRepo.update(sessionId, { title })
    - yield { title, sessionId }
```

### Почему `finally` важен

Метрики и сохранение сообщений должны произойти **даже если стриминг прервался** (пользователь закрыл вкладку, сеть отвалилась). Иначе мы:

- не учтём запрос в счётчике (читы);
- потеряем половину диалога;
- не залогируем дорогую операцию для observability.

### Почему `llmOpsService.log()` — fire-and-forget

LLMOps-лог не должен блокировать ответ пользователю. Если логирование сломается, пользователь должен всё равно получить ответ. Поэтому:

```ts
this.llmOpsService.log({...}).catch(err => console.error(...))
```

(без `await`). Промис просто исполнится в фоне.

---

## 9. Векторный поиск через pgvector

### Что такое pgvector

PostgreSQL-extension, добавляющий тип `vector(N)` и операторы:

- `<->` — евклидово расстояние (L2)
- `<=>` — косинусное расстояние (1 − cos similarity)
- `<#>` — отрицательный inner product

Мы используем `<=>` (cosine), потому что Google embeddings нормализованы и косинус — самая стандартная метрика для семантической близости.

### Почему именно pgvector, а не Pinecone/Weaviate

**Pinecone, Weaviate, Qdrant** — это отдельные сервисы. Они быстрее на больших масштабах (миллиарды векторов) и имеют развитые ANN-алгоритмы (HNSW и т.д.).

**Но в этом проекте они избыточны:**

- У нас тысячи чанков на пользователя, не миллиарды.
- Лишний сервис = лишняя точка отказа, лишний счёт, лишний секрет.
- Postgres у нас уже есть — он хранит и пользователей, и сессии.
- `WHERE userId = ?` гораздо проще делать в одной БД, чем синхронизировать pgvector + основную БД.
- Транзакционность: документ и его чанки коммитятся атомарно.

Когда переезжать на отдельный vector store: когда на одном пользователе десятки миллионов чанков, или когда нужны фичи (filtered ANN с десятками атрибутов, сложные ANN-индексы).

### Почему `ivfflat`, а не `hnsw`

pgvector поддерживает оба:

- `ivfflat` — кластеризует векторы и ищет в ближайших кластерах. Меньше памяти, но требует rebuild при больших изменениях.
- `hnsw` — графовый ANN, быстрее и точнее, но больше памяти.

Для текущего масштаба (тысячи чанков) разница незначительна, ivfflat хватает.

### Approximate vs exact

`ivfflat` — это **приближённый** поиск (ANN, Approximate Nearest Neighbours). Он может пропустить релевантный chunk, если тот лежит в другом кластере. Параметр `lists` контролирует точность/скорость:

- `lists = 10` (наш дефолт) — мало кластеров, быстрый поиск, recall может страдать.
- `lists = √(rows)` — рекомендация документации pgvector.

При росте корпуса нужно бампать `lists` и пересоздавать индекс.

---

## 10. Reranking — что это и зачем

### Проблема с одним только embedding-search

Embeddings обучаются на огромных корпусах и хорошо передают **общую семантику**, но:

- они одно-векторные (вся фраза → один вектор), много нюансов теряется;
- они симметричны (порядок слов часто игнорируется);
- в одном векторе сжаты разные аспекты (тема, тон, временной контекст).

В результате топ-K из embedding-search содержит релевантные куски, но **порядок может быть неоптимальным**: реально лучший chunk может оказаться 4-м, а не 1-м.

### Что делает reranker

Reranker — это **отдельная модель**, которая получает на вход пару `(запрос, кандидат)` и выдаёт **score релевантности**. В отличие от embedding-моделей (би-энкодер), reranker — это **cross-encoder**: запрос и кандидат скармливаются одной модели одновременно, и она может «обращать внимание» на их взаимодействие. Это медленнее, но точнее.

Pipeline:

1. Embedding-search возвращает **много кандидатов** (мы берём `topK × 3`).
2. Reranker оценивает их попарно с запросом.
3. Берём топ-K по reranker-score.

В итоге у LLM на входе **более релевантные куски**, и качество ответов растёт.

### Две реализации

**`CohereRerankClient`** — облачный API:

- Модель: `rerank-v3.5`
- $0.002 за вызов (в реальности у нас free-tier).
- Качество: SOTA для reranking.

**`LocalRerankClient`** — локальная модель через `@huggingface/transformers`:

- Модель: `Xenova/bge-reranker-base` (квантованная q8 для меньшей памяти).
- Бесплатно, работает без интернета.
- Медленнее (CPU-bound), хуже качество, но достаточно для small-scale.
- Lazy-loaded singleton — модель загружается один раз и переиспользуется.

Какую использовать — выбирается в `container.ts`. В текущей конфигурации — Local.

### Что reranker НЕ учитывает

- Метаданные документа (имя, дата, тип) — только текст chunk'а.
- Историю чата.
- Контекст пользователя.
- Diversity (может вернуть 5 почти идентичных чанков).

Если бы захотел улучшить — добавил бы MMR (Maximal Marginal Relevance) для diversity.

---

## 11. Streaming через Server-Sent Events (SSE)

### Зачем стримить

LLM генерирует токены последовательно. Если ждать конца — пользователь смотрит на спиннер 5–15 секунд. Стримим — он видит первые слова через 500мс. UX категорически лучше.

### Почему SSE, а не WebSocket

- SSE — простее: HTTP-запрос с заголовком `Content-Type: text/event-stream`, сервер просто продолжает писать в response.
- Однонаправленно (server → client), нам того и надо.
- Работает через прокси и CDN (WebSocket с этим иногда мучается).
- В Next.js / Edge Runtime поддерживается из коробки через `ReadableStream`.

### Формат SSE

Каждое событие — строка вида:

```
data: <JSON>\n\n
```

Двойной `\n\n` — обязателен (это разделитель событий по спецификации SSE).

### Типы событий

```ts
{ type: 'sources', sources: CitationDto[] }    // первое событие, после retrieval
{ type: 'chunk', text: string }                 // куски ответа LLM
{ type: 'title', sessionId, title }             // только в первом обмене
{ error: string }                               // на ошибке
```

И финал:

```
data: [DONE]\n\n
```

### Серверный код

```ts
return new Response(new ReadableStream({
  async start(controller) {
    try {
      for await (const event of retrievalService.stream({...})) {
        if ('sources' in event) controller.enqueue(`data: ${JSON.stringify({type:'sources', ...})}\n\n`);
        else if ('title' in event) ...;
        else /* string */ controller.enqueue(`data: ${JSON.stringify({type:'chunk', text})}\n\n`);
      }
      controller.enqueue('data: [DONE]\n\n');
    } catch (err) {
      controller.enqueue(`data: ${JSON.stringify({error: err.code})}\n\n`);
    } finally {
      controller.close();
    }
  }
}), { headers: { 'Content-Type': 'text/event-stream' } });
```

### Клиентский парсер (`ChatApi.streamChat`)

Стандартный `fetch` с `body.getReader()`. Читаем в цикле, накапливаем буфер, режем по `\n\n`, парсим JSON, диспатчим события через async-generator.

Поддерживается `AbortSignal` — пользователь может нажать «Stop» и реально прервать запрос (не только UI скрыть, но и стрим закрыть).

### Что попадёт в БД даже если пользователь прервал

В `RetrievalService.stream()` сохранение сообщений и инкремент счётчика — внутри `try/finally`. Поэтому:

- Закрыл вкладку на полпути → ассистент-сообщение сохранится с тем, что успело сгенерироваться.
- Запрос всё равно зачислится в дневной счётчик (предотвращает абуз).
- LLMLog пишется (fire-and-forget) с реальной latency и стоимостью того, что успело сгенерироваться.

---

## 12. Безопасность и rate limiting (три уровня)

### Уровень 1: IP rate limit (60 запросов/мин на IP)

В `middleware.ts`, до auth-проверки. Использует `@upstash/ratelimit` со sliding-window-алгоритмом и Upstash Redis.

```ts
const ratelimit = new Ratelimit({
	redis: upstashRedis,
	limiter: Ratelimit.slidingWindow(60, '1m'),
});
```

Зачем sliding window, а не fixed window: fixed window даёт «обмен 120 запросов за 2 секунды на границе минуты». Sliding учитывает скользящее окно, более ровный rate.

**Fail-open**: если Redis отвалился, запрос всё равно проходит (логируем warning). Это сознательный trade-off: лучше пропустить пару запросов сверх лимита, чем уронить весь сервис.

`/api/auth/*` исключён — NextAuth и так имеет свои антибот-меры.

### Уровень 2: Ownership enforcement

См. секцию 5. Каждый repo-метод требует `userId`, каждый SQL-запрос содержит `WHERE userId = ?`. Нарушение → compile error или runtime 404.

В `RetrievalService` — двойная проверка: на уровне SQL и на уровне приложения после similarity search.

### Уровень 3: Per-user daily quota

В `SessionService.validateLimit(userId, role)`:

```ts
const today = await userUsageRepo.getTodayCount(userId);
if (today >= LIMITS_BY_ROLE[role].queriesPerDay) {
	throw LimitReached();
}
```

Лимиты:

- `USER`: 100 запросов/день, 20 документов всего, 10 сессий, 10 документов на сессию.
- `ADMIN`: `Infinity` всё.

Лимиты живут в `shared/config/limits.ts` и читаются из enum `UserRole`. **Нигде не хардкодятся в сервисах.**

### Дополнительные меры безопасности

- **CSP**, **X-Frame-Options**, **HSTS**, **Permissions-Policy** в `next.config.ts`.
- **File signature verification** — проверка magic bytes на ingestion (нельзя подсунуть `.exe` под именем `.pdf`).
- **MAX_FILE_SIZE_MB = 10** — защита от DoS через гигабайтные файлы.
- **MAX_CHAT_MESSAGE_CHARS = 4000** — защита от prompt injection через гигантские сообщения.
- **CRON_SECRET** для cron-эндпоинта — иначе любой мог бы его триггерить.
- **JWT в HTTP-only secure cookie** — не доступен JS, защищён от XSS.
- **OAuth-only sign-in** — нет своих паролей, нет утечки credentials.

---

## 13. LLMOps и observability

LLMOps = «DevOps для LLM-приложений»: метрики качества, стоимости, latency, надёжности.

### Что логируется на каждый RAG-запрос

```ts
{
  userId: string | null,
  sessionId: string,
  documentId: string,
  query: string,                   // вопрос
  response: string,                // ответ LLM
  latencyMs: number,               // от начала retrieval до конца стрима
  promptTokens: number,            // приблизительно (split по whitespace)
  completionTokens: number,        // аналогично
  estimatedCostUsd: number,        // см. секцию 18
  hasCitation: boolean,            // были ли извлечены источники
  rerankingUsed: boolean,
  chunkingStrategy: ChunkingStrategy,
  retrievedChunks: [{               // что именно было найдено
    chunkId, documentId, similarity, rerankScore?, rank
  }],
  createdAt: DateTime,
}
```

### Endpoint `/api/llmops` (admin only)

`GET /api/llmops?limit=100` возвращает:

```ts
{
  totalRequests: number,
  avgLatencyMs: number,
  p95LatencyMs: number,
  totalCostUsd: number,
  citationRate: number,          // доля запросов с citations
  logs: LLMLog[],
}
```

p95 latency — индустриальная метрика «худший опыт у 5% пользователей». Считается на сервере по выборке из логов.

### Stats-страница

`app/(app)/stats/page.tsx` доступна только админам (`requireAdmin()` в роуте, плюс UI спрятан если `role !== 'ADMIN'`). Показывает агрегаты + таблицу последних запросов.

### Почему точность токенов приблизительная

Реальный подсчёт токенов требует токенизатора конкретной модели (у Gemini свой, у GPT свой, и т.д.). Для простоты и универсальности мы считаем по словам (`split(/\s+/)`). Это завышает или занижает на 10–30%, но для трендов и относительных сравнений достаточно.

Если бы делал production-ready — подключил бы токенизатор от Google для Gemini (для embeddings — отдельный).

---

## 14. Лимиты, квоты и роли

```ts
// shared/config/limits.ts
LIMITS_BY_ROLE = {
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

### Где какой лимит проверяется

| Лимит                   | Где                                                                       | Когда                         |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------- |
| `queriesPerDay`         | `SessionService.validateLimit()`                                          | в начале `/api/chat`          |
| `maxDocumentsPerUser`   | `SessionService.validateDocumentsLimit()`                                 | в `/api/ingest`               |
| `maxChatSessions`       | `SessionService.validateAttachedLimit()` (косвенно) и `POST /api/session` | при создании сессии           |
| `maxAttachedPerSession` | `SessionService.validateAttachedLimit()`                                  | при attach документа к сессии |

### Где смотреть свой остаток

`GET /api/usage` → `{ remaining: number | null }`. Возвращает остаток на сегодня (для админа `null`, отображается как «безлимит»).

UI — `LimitBadge`-компонент в сайдбаре.

---

## 15. Cleanup, retention и GDPR (анонимизация)

### Cron на Vercel

`vercel.json`:

```json
{
	"crons": [{ "path": "/api/cron/cleanup", "schedule": "0 0 * * *" }]
}
```

Запускается каждую полночь UTC. Защищён `Bearer ${CRON_SECRET}` — Vercel-cron сам шлёт этот заголовок.

`CleanupService.runAll()`:

1. **Удаление просроченных ChatSession** (`expiresAt < now`). Cascade удаляет messages и session_documents.
2. **Удаление LLMLog старше 90 дней** (`LLMLOG_RETENTION_DAYS`).

### Удаление аккаунта (`DELETE /api/account`)

`AccountService.deleteUser(userId)`:

```
1. Найти User или throw UserNotFound
2. Агрегировать LLMLog: totalQueries, totalPromptTokens, totalCompletionTokens, totalCostUsd
3. Посчитать totalDocuments, totalChatSessions
4. INSERT в DeletedUserAudit (без email, без имени)
5. Анонимизировать LLMLog:
   UPDATE llm_logs
   SET userId = NULL,
       query = '',
       response = '',
       anonymizedAt = now()
   WHERE userId = ?
6. DELETE User (cascade удаляет всё остальное)
```

### Почему именно так

**GDPR / privacy**: пользователь имеет право на удаление своих данных. Мы это делаем.

**Но**: для бизнеса нужны метрики «сколько было запросов в системе за квартал», «средний cost per query», и т.д. Если просто удалить логи — мы сломаем исторические агрегаты.

Решение: **анонимизировать**, а не удалять. Текст вопросов/ответов (PII!) обнуляется, userId превращается в null, остаются метрики латенси/токенов/стоимости — без привязки к человеку. И + DeletedUserAudit-журнал хранит только агрегаты конкретного пользователя.

**LLMLog без FK-связей** — это специально, чтобы лог пережил удаление сессии/документа/пользователя. Если бы был FK с cascade, удаление User снесло бы и логи.

### Дополнительно

- **ChatSession TTL = 24 часа.** Решение по UX: чат с документами — это «рабочий черновик», не «вечный архив». Если хочется надолго — пользователь скачает диалог.
- **Document не удаляется автоматически** — это собственность пользователя, он сам решает, когда чистить.

---

## 16. Frontend (клиентская архитектура)

Зеркалит серверную: тоже Onion в миниатюре.

### Слои

**Stores (Zustand)** — только UI-state:

- никаких `fetch`,
- никакого парсинга SSE,
- никакого `FormData`.

Они работают с уже-готовыми данными.

**HTTP layer** (`client/infrastructure/http/`) — реализации `I*Api`:

- `ChatApi`, `SessionApi`, `IngestionApi`, `UsageApi`, `LLMOpsApi`.
- Здесь живут `fetch`, парсинг SSE, multipart-сборка.
- `apiFetch` — обёртка с обработкой ошибок и auth.

**Application services** (`client/application/services/`) — оркестрация:

- `ChatSessionService.send(params, callbacks, signal)` — запускает стрим, диспатчит коллбэки `onSources`, `onChunk`, `onTitle`, `onError`, `onDone`.
- Без зависимости от Zustand — чистые функции с коллбэками.

### Сторы

- **`useChatStore`** — messages[], isStreaming, abortController, citations.
- **`useSessionStore`** — sessions[], activeSessionId, автозагрузка attachments+history при switch.
- **`useAttachmentStore`** — `attachedBySession{}` (что прикреплено), `activeBySession{}` (что выбрано как активное в текущем чате) — раздельно, чтобы можно было прикрепить 5 документов, но временно искать только в одном.
- **`useUsageStore`** — remaining queries, оптимистичный decrement на каждом вопросе.

### Почему UI-компоненты НЕ делают `fetch`

Иначе:

- невозможно мокать в тестах;
- логика разбросана между UI и data;
- каждый компонент знает endpoint'ы и формат запросов;
- сложнее менять API.

Вместо этого UI:

- читает из стора,
- вызывает actions стора,
- максимум — импортирует API-клиент для read-only данных (`llmOpsApi.getStats()` в StatsPage).

### Страницы

- `app/signin/page.tsx` — публичная, OAuth-кнопка.
- `app/(app)/page.tsx` — Chat (основной экран).
- `app/(app)/documents/page.tsx` — список документов, загрузка.
- `app/(app)/stats/page.tsx` — admin LLMOps dashboard.

`(app)` — это Route Group, не сегмент URL. Все страницы внутри проходят через общий layout с Sidebar.

### Главные компоненты

- **Sidebar** — список сессий + кнопка «новый чат».
- **MessageList** — рендер сообщений (USER / ASSISTANT с разной стилистикой), citations под ответом.
- **MessageInput** — textarea + Send + Stop (когда стримит).
- **FileDropzone** — drag-n-drop загрузка.
- **CitationList** — список источников (имя файла + первые 200 символов chunk'а).
- **LimitBadge** — «осталось N запросов».
- **UploadProgress** — прогресс загрузки.

---

## 17. Чанкинг: 4 стратегии

`ChunkingService.chunk(text, strategy)`. Все стратегии возвращают `string[]`.

### `FIXED`

Разбивает на слова, идёт окном `CHUNK_SIZE = 512` слов с overlap `CHUNK_OVERLAP = 50` слов.

Плюсы: гарантирует размер.
Минусы: режет посреди предложений, теряет смысл.

### `SENTENCE`

Делит по `[.!?]\s+`, потом собирает предложения в чанки до достижения `CHUNK_SIZE` слов. Перекрытие — последние N предложений предыдущего чанка.

Плюсы: не режет предложения.
Минусы: одно длинное предложение может стать огромным чанком.

### `PARAGRAPH`

Делит по `\n\n+`, собирает параграфы в чанки до `CHUNK_SIZE`. Без overlap.

Плюсы: семантически целостно (параграф = одна мысль).
Минусы: длинные параграфы рвут логику; нет overlap.

### `RECURSIVE` (дефолт)

Сначала делит как PARAGRAPH. Если параграф > 512 слов — внутри него рекурсивно режет как SENTENCE.

Плюсы: максимально сохраняет структуру.
Минусы: сложнее отлаживать.

### Почему дефолт RECURSIVE

В реальных документах параграфы обычно ≤ 200 слов, а длинные (юридический текст, академические работы) хорошо лезут в SENTENCE. RECURSIVE даёт лучший recall на разнородных корпусах.

### Почему overlap = 50 слов

Если ответ на вопрос «сидит» на границе чанков, без overlap его разрежет пополам и оба chunk'а станут неинформативны. 50 слов — это ~3-4 предложения, обычно хватает чтобы захватить контекст.

---

## 18. Расчёт стоимости запроса

В `RetrievalService.stream()` после генерации:

```ts
const queryEmbedTokens = message.split(/\s+/).filter(Boolean).length;
const promptTokens = prompt.split(/\s+/).length;
const completionTokens = response.split(/\s+/).length;

const estimatedCostUsd =
	(queryEmbedTokens / 1e6) * COST_USD_PER_M_EMBED_TOKENS + // 0.01 / 1M
	(promptTokens / 1e6) * COST_USD_PER_M_GEMINI_INPUT_TOKENS + // 0.075 / 1M
	(completionTokens / 1e6) * COST_USD_PER_M_GEMINI_OUTPUT_TOKENS + // 0.30 / 1M
	(rerankApplied ? COST_USD_PER_RERANK_CALL : 0); // 0.002
```

### Почему «estimated»

- **Токенайзер не настоящий** (см. секцию 13).
- **Цены публичные pay-as-you-go**, мы по факту на free-tier (≈ $0).
- **Rerank cost фиксированный** — реально Cohere берёт за документы, но для упрощения 1 рерэнк = $0.002.

Этого достаточно для **тренда** в LLMOps дашборде («запросы дорожают», «стоимость на одного юзера в день»). Для биллинга реальных пользователей — нужны точные токенайзеры провайдеров.

### Что входит в стоимость одного запроса

1. Embedding query (~$0.000001 за нормальный вопрос).
2. Prompt в Gemini (это самое дорогое, потому что в нём контекст из чанков).
3. Completion от Gemini.
4. Rerank (если включён).

Поиск в БД — бесплатен (Postgres compute уже оплачен).

---

## 19. Деплой и инфраструктура

### Vercel

- Next.js project как монолит.
- Edge runtime для middleware.
- Serverless функции для API.
- Environment variables через Vercel Dashboard.

### Neon (PostgreSQL)

- **Pooled connection** через PgBouncer (`DATABASE_URL`) — для приложения, без пер-запросной инициализации.
- **Direct connection** (`DIRECT_URL`) — для миграций Prisma (PgBouncer не дружит с DDL).
- pgvector установлен через `CREATE EXTENSION vector;`.
- Free-tier: 0.5 GB storage, scale-to-zero.

### Upstash Redis

- Сервис для rate-limit-ключей.
- Низкая latency, REST API (нет персистентного коннекта — подходит к serverless).
- Free-tier: 10К команд/день.

### Все нужные env-переменные

```
DATABASE_URL                # Neon pooled
DIRECT_URL                  # Neon direct (для миграций)
GOOGLE_AI_KEY               # AI Studio (embeddings + Gemini)
COHERE_API_KEY              # Cohere (если включён cloud rerank)
AUTH_SECRET                 # openssl rand -base64 32
AUTH_GOOGLE_ID              # Google Cloud Console OAuth
AUTH_GOOGLE_SECRET          # Google Cloud Console OAuth
NEXTAUTH_URL                # production URL (опционально на Vercel)
UPSTASH_REDIS_REST_URL      # Upstash
UPSTASH_REDIS_REST_TOKEN    # Upstash
CRON_SECRET                 # любой случайный — для /api/cron/*
```

### OAuth redirect URIs

В Google Cloud Console надо прописать:

- `http://localhost:3000/api/auth/callback/google` — dev
- `https://<vercel-url>/api/auth/callback/google` — prod

### Команды

```
npm run dev               # локально
npm run build             # production build
npm run start             # production локально
npm run lint              # ESLint
npm run test              # Vitest
npm run ci                # типчек + format-check + lint + test
npx prisma migrate dev    # новая миграция (dev)
npx prisma migrate deploy # применить миграции (prod, на Vercel)
npx prisma studio         # GUI к БД
```

---

## 20. Известные ограничения и что бы я улучшил

Это **обязательная часть** для собеседования. Хороший инженер знает свои слабые места.

### Технические

1. **Токенайзер приблизительный.** В production надо использовать реальный токенайзер от Google для Gemini (через `@google/genai`) и Cohere для embeddings.

2. **`ivfflat` с `lists=10`** — для тысяч чанков ок, но при росте recall пострадает. Решение: increase `lists`, или мигрировать на `hnsw` (более качественный ANN, требует pgvector ≥ 0.5).

3. **Нет MMR при отборе sources.** Возможен случай, когда 5 топ-чанков — почти одинаковые. Diversity-aware reranking (например, MMR) дал бы более полный ответ.

4. **Reranker не учитывает метаданные** (имя файла, дата). Document filter — это costless heuristic, но он отдельный, не влияет на rerank-score.

5. **Нет hybrid search.** Сейчас только dense (embeddings). Добавить BM25 / sparse retrieval (через Postgres `tsvector` или Elasticsearch) и ансамблировать — обычно это +5-15% recall.

6. **Чанкинг наивный.** В реальности у PDF могут быть таблицы, листинги кода, изображения с OCR — это требует структурного парсинга (Unstructured.io, Docling, LlamaParse).

7. **Нет per-document caching embeddings** для запросов. Если пользователь задал «summary этого документа» — реально надо доставать ВСЕ chunks, а не топ-K. Это другой режим работы (full-doc summarization).

8. **Стримим только text.** Нет structured output (JSON-mode), нет tool calling.

9. **Нет E2E тестов.** Vitest покрывает unit-логику; integration нет.

10. **Один PDF parser.** `pdf-parse` плохо справляется со сканированными PDF (нужен OCR). На production — Tesseract/Cloud Vision pipeline.

### Архитектурные

1. **`documentId` в LLMLog** — `String`, без FK. Если пользователь спрашивал по 5 документам, мы пишем только первый. Можно сделать `documentIds: String[]` или JSON.

2. **Cron каждый день** — нет fast-cleanup. Если пользователь массово удалит сессии — orphan rows будут жить до следующей полуночи.

3. **Нет soft delete.** Удаление аккаунта необратимо. На enterprise-продукте делают soft delete с retention period.

4. **Гранулярность ролей маленькая** (USER/ADMIN). На реальном продукте — TEAM, OWNER, MEMBER, и тонкие permissions.

5. **Нет rate limit per-user** на API-уровне (только по IP). Авторизованный юзер с динамическим IP может «крутить» лимит.

### UX / Product

1. **Нет share-link на чат.** Пользователь не может поделиться своим разговором.

2. **Нет full-text search по своим чатам.** В сайдбаре только список по дате.

3. **Нет export в Markdown / PDF.**

4. **Нет «продолжить документ»** — если PDF на 500 страниц, можно было бы показать TOC и навигацию.

5. **Нет inline-предпросмотра PDF** — вместо этого только имя файла в citations.

6. **Нет folder structure** для документов — плоский список.

---

## 21. FAQ для собеседования

### Q: Объясни, как работает RAG в одном предложении.

> Векторный поиск находит самые релевантные куски документов под вопрос пользователя, и они подкладываются в prompt LLM, чтобы ответ был основан на конкретных данных, а не только на тренировочной памяти модели.

### Q: Почему именно Onion Architecture?

> Чтобы бизнес-логика не зависела от инфраструктуры. Если завтра я меняю Gemini на OpenAI или PostgreSQL на Mongo — должен поменяться только один файл (`container.ts`) плюс новая инфраструктурная имплементация интерфейса. Application-слой работает с портами (`ILLMClient`, `IEmbeddingClient` и т.д.), а не с конкретными SDK. Это плюс легко тестируется — мокаются интерфейсы.

### Q: Почему pgvector, а не Pinecone?

> На текущем масштабе (тысячи чанков, не миллиарды) pgvector внутри той же БД, что и юзеры с сессиями, — это просто меньше движущихся частей. Один Postgres вместо «Postgres + Pinecone». Транзакционность: документ и его chunks коммитятся атомарно. `WHERE userId = ?` для multi-tenant изоляции — нативно. Когда стану расти — мигрирую на отдельный vector store, но не раньше.

### Q: Что произойдёт, если в момент стрима упадёт сервер?

> На клиенте стрим оборвётся. На сервере код обёрнут в `try/finally`, в `finally` мы пишем сообщения в БД, инкрементим счётчик, логируем в LLMLog. То, что успело сгенерироваться, сохранится. Но если упал сам процесс — `finally` не успеет выполниться. На production я бы добавил persistent queue (вроде PG NOTIFY или отдельного worker) для гарантированной записи.

### Q: Как ты обеспечиваешь, что один пользователь не увидит данные другого?

> Несколько уровней. (1) JWT в cookie с `userId`, проверяется в middleware и в каждом роуте через `requireUser()`. (2) Каждый repository-метод требует `userId` обязательным параметром — если забыть, TypeScript дает compile error. (3) Все Prisma-запросы и raw SQL содержат `WHERE userId = ?`. (4) Specifically для similarity search — есть JOIN `documents.userId = ?` в SQL, и плюс runtime-проверка после: каждый возвращённый chunk сверяется со списком разрешённых documentIds, утечка кидает ошибку и пишет в лог.

### Q: Зачем нужен reranking, если уже есть векторный поиск?

> Embeddings — это би-энкодер: запрос и документ кодируются в вектор независимо, поиск идёт по dot-product. Это быстро, но теряет нюансы взаимодействия. Reranker — это cross-encoder: он смотрит на пару `(query, candidate)` совместно через attention и выдаёт более точный score. Стоит дороже, поэтому делается только на топ-N кандидатах после dense search. Это стандартный pipeline retrieve→rerank.

### Q: Откуда модель знает, что цитировать?

> В prompt'е я явно прошу: «при ответе из контекста используй имя файла как цитату — например `report.pdf`, не `[1]`». Кроме того, мы возвращаем sources на клиент отдельным SSE-событием **до** начала текста, и UI показывает их под ответом. Сама модель цитирует имя в тексте; UI же дополнительно показывает первые 200 символов каждого использованного chunk'а.

### Q: Что такое `[GENERAL_KNOWLEDGE]`?

> Sentinel в начале ответа, который модель должна вывести, если контекст не содержит ответа и она отвечает из общих знаний. UI клиента может детектировать этот префикс и пометить ответ как «нет в документах, общая информация». Это честность: пользователь должен понимать, верить ответу как факту из его файла или нет.

### Q: Как ты считаешь стоимость запроса?

> Приблизительно. Embedding tokens — длина вопроса в словах. Prompt tokens — длина итогового промпта в словах. Completion tokens — длина ответа в словах. Умножаем на цены провайдера за миллион токенов (`$0.01` embed, `$0.075` Gemini in, `$0.30` Gemini out). Прибавляем `$0.002` за rerank, если был. Это не точные суммы — реальные токенайзеры дали бы разницу до 30%. Для production-биллинга нужны настоящие токенайзеры от каждого провайдера.

### Q: Зачем JWT-сессия, а не db-сессия?

> JWT не требует обращения к БД на каждый запрос — middleware расшифровывает токен из cookie и сразу знает `userId` и `role`. Это критично для serverless на Vercel: каждый запрос — новый процесс, лишние БД-обращения дорого. Минус — нельзя моментально отозвать токен (надо ждать expire). На enterprise-продукте сделал бы revocation list в Redis.

### Q: Что делает middleware?

> Два дела: (1) IP rate limit — 60 запросов/мин на IP через Upstash Redis sliding window. (2) Auth gate — если нет сессии, редирект на `/signin`. Rate limit срабатывает **до** auth-проверки, чтобы атакующий не мог нас задосить невалидными cookies.

### Q: Что если пользователь удалит аккаунт?

> Анонимизация, не удаление. Считаем агрегаты его LLMLog (totalQueries, tokens, cost), пишем в `DeletedUserAudit` (без email/имени, только цифры). LLMLog обновляем: `userId=null, query='', response='', anonymizedAt=now()`. Удаляем User — cascade чистит ChatSessions, Messages, Documents, Chunks, OAuth Accounts. Так удовлетворяем GDPR (PII удалён) и сохраняем бизнес-метрики.

### Q: Как ты выбирал размер chunk и overlap?

> 512 слов / 50 overlap — это эмпирический дефолт. Размер должен быть достаточным, чтобы chunk нёс цельную идею (один или несколько параграфов), но не слишком большим, чтобы embedding не «размывал» смысл. 50 overlap — на случай, когда ответ лежит на границе chunks. По-хорошему надо мерять recall@k offline на размеченном бенчмарке и тюнить.

### Q: Почему 4 стратегии чанкования?

> Разные документы любят разное. PDF-договор — это абзацы, режется PARAGRAPH. Лекция-конспект — длинные параграфы с раздельными темами, лучше SENTENCE. Лог или CSV — FIXED. RECURSIVE — гибрид: пробует PARAGRAPH, на больших абзацах падает в SENTENCE. По умолчанию RECURSIVE — лучшая средняя стратегия.

### Q: Что бы ты улучшил в проекте, если бы был месяц?

> (1) Hybrid search — добавить BM25 поверх vector. (2) Реальные токенайзеры. (3) E2E-тесты на Playwright. (4) HNSW вместо ivfflat. (5) Diversity-aware sources (MMR). (6) Soft delete с retention. (7) Per-user API rate limit. (8) Структурный парсинг PDF (с таблицами).

### Q: Какие ты видишь риски в этом проекте?

> (1) Зависимость от Google AI free-tier — если они отрубят квоту, продукт встанет. На production — fallback провайдер (OpenAI или AWS Bedrock). (2) Approximate ANN индекс может пропустить релевантный chunk. (3) Reranker fallback если упал — но качество просядет молча. (4) Нет per-document permission'ов внутри пользователя — все его документы взаимно видимы (для одного юзера это ок, но для team-режима нужно). (5) PDF-parser слабый на сканах.

### Q: Как ты тестируешь?

> Vitest для unit-тестов: chunking-сервис, document-filter, утилиты. Для интеграционных — нет фреймворка пока (это в улучшениях). На API руками тестировал через Postman/curl. На UI — через браузер. На production я бы добавил Playwright + smoke-suite на основные пайплайны.

### Q: Расскажи про какой-нибудь сложный баг, который ты ловил.

> Edge runtime в Next.js не любит Prisma и многие npm-пакеты. Когда я первый раз настраивал middleware с auth, всё ломалось при сборке: `Cannot resolve "node:fs" in edge runtime`. Решение — разделить NextAuth-конфиг на два файла. `auth.config.ts` (только провайдер + jwt-callback'и, edge-safe) подключается в middleware. `auth.ts` (с PrismaAdapter и всем остальным) — в роутах и серверном коде. Это документировано в Auth.js под `edge-compatible config`.

### Q: Что особенного в этом проекте по сравнению с типичным «chat with documents»?

> (1) Onion architecture с честным dependency rule, не маркетинговым. (2) Multi-user изоляция на 4 уровнях, включая runtime double-check. (3) GDPR-flow с анонимизацией, а не удалением. (4) LLMOps-метрики на каждый запрос с per-chunk telemetry. (5) Два варианта reranker (cloud + local) переключаемых через DI. (6) Reасerve TTL для чатов чтобы не разбухала БД. (7) Полный SSE с custom event types (sources, chunks, title, error, done).

### Q: Что было самым сложным?

> Правильная декомпозиция на слои. Соблазн всегда — «давай Service сразу вызовет Prisma», но тогда сервис захардкожен под Postgres, и тестирование становится пыткой. Дисциплина: всё через интерфейсы, концертные импорты только в `container.ts`, в roоутах — только сборка DTO + вызов сервисов. Окупается на второй-третьей фиче.

### Q: Что ты понял про LLM-приложения, что не очевидно из туториалов?

> (1) Стоимость и latency — это product features, не «оптимизация». Нельзя ждать 10 секунд первого токена — UX мёртвый, поэтому SSE обязателен. (2) Хороший RAG — это не «быстрый dense search», это **retrieve → rerank → grounding в prompt → guardrails**. Каждый шаг важен. (3) Ownership/multi-tenancy надо проектировать **с первой строчки кода**, не «потом доделаем». (4) Observability на каждый запрос — это **минимум**, иначе невозможно ни дебажить, ни понять, что регрессирует.

---

## Шпаргалка: как объяснить за 60 секунд

> Это веб-приложение «chat with your documents». Пользователь логинится через Google, грузит PDF/TXT/DOCX, и задаёт вопросы по содержимому. Под капотом — RAG: документы режутся на чанки, для каждого считается embedding (768-dim) от Google, кладётся в pgvector. На вопрос — embed query, similarity search в Postgres, reranking через Cohere или локальный bge-reranker, retrieved-chunks подкладываем в prompt Gemini 2.5 Flash, стримим ответ через SSE с цитированием имени файла. Архитектура — Onion: domain в центре, application с портами, infrastructure как реализации портов, всё собирается через DI-container. Безопасность — JWT auth, ownership на каждом repo-методе, IP rate limit через Upstash, дневные квоты на пользователя. Каждый запрос пишется в LLMLog с латенси, токенами, стоимостью, citations и retrieved-chunks для LLMOps-дашборда. Удаление аккаунта — анонимизация логов, не delete, для GDPR + business-metrics. Деплой — Vercel + Neon Postgres + Upstash Redis, всё на free-tier.

---

## Шпаргалка: 5 главных трейд-оффов проекта

1. **pgvector vs отдельный vector store** — выбрал pgvector ради простоты (один Postgres). При росте нагрузки → Pinecone/Qdrant.
2. **JWT vs DB session** — выбрал JWT для serverless-производительности. Ценой — нельзя моментально отозвать.
3. **Cohere vs local rerank** — настроено переключаемо в DI. Cohere точнее, local бесплатно.
4. **Anonymize vs delete LLMLog** — выбрал anonymize ради бизнес-метрик при сохранении приватности.
5. **Approximate vs exact vector index** — `ivfflat` ради скорости, ценой — иногда теряем релевантный chunk. Решается бо́льшим candidate-pool перед rerank (`topK × 3`).

---

Документ написан 2026-05-05, отражает состояние ветки `main`.
