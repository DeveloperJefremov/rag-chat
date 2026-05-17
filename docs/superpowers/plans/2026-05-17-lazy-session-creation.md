# Lazy Chat Session Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `+ New chat` purely a client-side state reset (no API call). Lazy-create the DB `ChatSession` only on first commit (attach or send). Enforce `maxChatSessions` server-side as defense-in-depth.

**Architecture:** `activeSessionId === null` represents a "draft" chat. Sidebar's `+ New chat` button calls a new local-only action `startNewChat()`. `ChatPage` introduces an `ensureSession()` helper that lazy-creates the session when the user attaches a document or sends a message. The server-side `SessionService.getOrCreate` gains a new `role` parameter and validates `LIMITS_BY_ROLE[role].maxChatSessions` before creating a row.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React 19, Zustand, Vitest, Prisma 7.

**Spec:** `docs/superpowers/specs/2026-05-17-lazy-session-creation-design.md`.

---

## File map

| File                                                          | Action | Purpose                                                                                                      |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `shared/errors/AppError.ts`                                   | Modify | Add `chat_sessions_limit_reached` code + factory                                                             |
| `server/application/session/SessionService.ts`                | Modify | New `role` param on `getOrCreate`; new `validateChatSessionsLimit`                                           |
| `server/application/session/__tests__/SessionService.test.ts` | Modify | Update existing cases to pass role; add limit cases                                                          |
| `app/api/session/route.ts`                                    | Modify | Pass `user.role` to `getOrCreate`                                                                            |
| `app/api/session/__tests__/route.test.ts`                     | Modify | Update mock signature; add 403 limit case                                                                    |
| `client/infrastructure/http/SessionApi.ts`                    | Modify | Parse error body in `createSession` to expose server error code                                              |
| `client/infrastructure/http/__tests__/SessionApi.test.ts`     | Create | Cover error body parsing                                                                                     |
| `client/stores/sessionStore.ts`                               | Modify | Add `startNewChat()`; map limit error to friendly toast text                                                 |
| `client/stores/__tests__/sessionStore.test.ts`                | Create | Cover `startNewChat` and friendly toast for limit code                                                       |
| `presentation/web/layout/Sidebar/index.tsx`                   | Modify | `handleNewChat` calls `startNewChat()` (no API)                                                              |
| `presentation/web/pages/Chat/index.tsx`                       | Modify | Remove `sessions[0]` fallback; add `ensureSession` for attach + send; undisable `+ Add from library` buttons |

---

## Task 1: Add `chat_sessions_limit_reached` error code

**Files:**

- Modify: `shared/errors/AppError.ts`

- [ ] **Step 1: Add the new code to the union and a factory function**

In `shared/errors/AppError.ts`, change the `AppErrorCode` union and add a new factory at the bottom of the file.

Replace the existing `AppErrorCode` union with:

```ts
export type AppErrorCode =
	| 'unauthenticated'
	| 'forbidden'
	| 'user_not_found'
	| 'session_not_found'
	| 'document_not_found'
	| 'documents_limit_reached'
	| 'attached_limit_reached'
	| 'chat_sessions_limit_reached'
	| 'limit_reached'
	| 'empty_document';
```

Then append this factory after the existing `LimitReached` factory line:

```ts
export const ChatSessionsLimitReached = () => new AppError('chat_sessions_limit_reached', 403);
```

- [ ] **Step 2: Type-check the whole repo**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add shared/errors/AppError.ts
git commit -m "feat(errors): add chat_sessions_limit_reached error code"
```

---

## Task 2: Add `validateChatSessionsLimit` to `SessionService` (TDD)

**Files:**

- Modify: `server/application/session/__tests__/SessionService.test.ts`
- Modify: `server/application/session/SessionService.ts`

- [ ] **Step 1: Add failing tests**

In `server/application/session/__tests__/SessionService.test.ts`, append a new `describe` block at the bottom of the outer `describe('SessionService', () => { ... })`, just before its closing `})`:

```ts
describe('validateChatSessionsLimit', () => {
	it('throws ChatSessionsLimitReached when USER count >= maxChatSessions (10)', async () => {
		const sessionRepo = makeSessionRepo({
			countByUser: vi.fn().mockResolvedValue(10),
		});
		const service = new SessionService(sessionRepo, makeUsageRepo());

		await expect(service.validateChatSessionsLimit('user-1', 'USER')).rejects.toThrow(
			'chat_sessions_limit_reached',
		);
	});

	it('does not throw when USER is below the limit', async () => {
		const sessionRepo = makeSessionRepo({
			countByUser: vi.fn().mockResolvedValue(9),
		});
		const service = new SessionService(sessionRepo, makeUsageRepo());

		await expect(service.validateChatSessionsLimit('user-1', 'USER')).resolves.toBeUndefined();
	});

	it('never throws for ADMIN role and does not call countByUser', async () => {
		const countByUser = vi.fn();
		const sessionRepo = makeSessionRepo({ countByUser });
		const service = new SessionService(sessionRepo, makeUsageRepo());

		await expect(service.validateChatSessionsLimit('admin-1', 'ADMIN')).resolves.toBeUndefined();
		expect(countByUser).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/application/session/__tests__/SessionService.test.ts`
Expected: 3 new tests FAIL with "validateChatSessionsLimit is not a function" or similar.

- [ ] **Step 3: Implement the new method**

In `server/application/session/SessionService.ts`:

(a) Add the import — modify the existing import line for AppError:

```ts
import {
	LimitReached,
	DocumentsLimitReached,
	AttachedLimitReached,
	ChatSessionsLimitReached,
	SessionNotFound,
} from '../../../shared/errors/AppError';
```

(b) Add the new method inside the `SessionService` class, immediately after `validateAttachedLimit`:

```ts
	async validateChatSessionsLimit(userId: string, role: UserRole): Promise<void> {
		const limit = LIMITS_BY_ROLE[role].maxChatSessions;
		if (limit === Infinity) return;
		const count = await this.chatSessionRepo.countByUser(userId);
		if (count >= limit) throw ChatSessionsLimitReached();
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/application/session/__tests__/SessionService.test.ts`
Expected: PASS (all tests in the file, including the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add server/application/session/SessionService.ts server/application/session/__tests__/SessionService.test.ts
git commit -m "feat(session): add validateChatSessionsLimit to SessionService"
```

---

## Task 3: Plumb `role` through `getOrCreate` and enforce the limit (TDD)

**Files:**

- Modify: `server/application/session/__tests__/SessionService.test.ts`
- Modify: `server/application/session/SessionService.ts`

- [ ] **Step 1: Update existing `getOrCreate` tests to pass role; add limit-enforcement test**

In `server/application/session/__tests__/SessionService.test.ts`, replace the existing `describe('getOrCreate', () => { ... })` block with this version (updates existing calls to pass `'USER'`/`'ADMIN'` and adds 2 new cases):

```ts
describe('getOrCreate', () => {
	it('creates new session when sessionId is null', async () => {
		const newSession = makeSession({ id: 'new-id' });
		const sessionRepo = makeSessionRepo({
			create: vi.fn().mockResolvedValue(newSession),
			countByUser: vi.fn().mockResolvedValue(0),
		});
		const service = new SessionService(sessionRepo, makeUsageRepo());

		const result = await service.getOrCreate('user-1', null, 'USER');

		expect(sessionRepo.create).toHaveBeenCalledOnce();
		expect(result.id).toBe('new-id');
	});

	it('returns existing valid session without limit check', async () => {
		const existing = makeSession({
			id: 'existing-id',
			expiresAt: new Date(Date.now() + 3600000),
		});
		const countByUser = vi.fn();
		const sessionRepo = makeSessionRepo({
			findById: vi.fn().mockResolvedValue(existing),
			countByUser,
		});
		const service = new SessionService(sessionRepo, makeUsageRepo());

		const result = await service.getOrCreate('user-1', 'existing-id', 'USER');

		expect(result.id).toBe('existing-id');
		expect(countByUser).not.toHaveBeenCalled();
	});

	it('creates new session when existing is expired (and re-checks limit)', async () => {
		const expired = makeSession({ id: 'old', expiresAt: new Date(Date.now() - 1000) });
		const fresh = makeSession({ id: 'fresh' });
		const countByUser = vi.fn().mockResolvedValue(0);
		const sessionRepo = makeSessionRepo({
			findById: vi.fn().mockResolvedValue(expired),
			create: vi.fn().mockResolvedValue(fresh),
			countByUser,
		});
		const service = new SessionService(sessionRepo, makeUsageRepo());

		const result = await service.getOrCreate('user-1', 'old', 'USER');

		expect(countByUser).toHaveBeenCalledOnce();
		expect(sessionRepo.create).toHaveBeenCalledOnce();
		expect(result.id).toBe('fresh');
	});

	it('throws ChatSessionsLimitReached for USER at the cap', async () => {
		const sessionRepo = makeSessionRepo({
			countByUser: vi.fn().mockResolvedValue(10),
			create: vi.fn(),
		});
		const service = new SessionService(sessionRepo, makeUsageRepo());

		await expect(service.getOrCreate('user-1', null, 'USER')).rejects.toThrow(
			'chat_sessions_limit_reached',
		);
		expect(sessionRepo.create).not.toHaveBeenCalled();
	});

	it('does not enforce the cap for ADMIN', async () => {
		const newSession = makeSession({ id: 'admin-new' });
		const countByUser = vi.fn();
		const sessionRepo = makeSessionRepo({
			create: vi.fn().mockResolvedValue(newSession),
			countByUser,
		});
		const service = new SessionService(sessionRepo, makeUsageRepo());

		const result = await service.getOrCreate('admin-1', null, 'ADMIN');

		expect(countByUser).not.toHaveBeenCalled();
		expect(result.id).toBe('admin-new');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/application/session/__tests__/SessionService.test.ts`
Expected: FAIL — TypeScript error about extra argument, plus runtime failures on the new cases.

- [ ] **Step 3: Update `getOrCreate` signature and logic**

In `server/application/session/SessionService.ts`, replace the existing `getOrCreate` method with:

```ts
	async getOrCreate(
		userId: string,
		sessionId: string | null,
		role: UserRole,
	): Promise<ChatSession> {
		if (sessionId) {
			const existing = await this.chatSessionRepo.findById(sessionId, userId);
			if (existing && existing.expiresAt > new Date()) {
				return existing;
			}
		}
		await this.validateChatSessionsLimit(userId, role);
		const expiresAt = new Date();
		expiresAt.setHours(expiresAt.getHours() + SESSION_TTL_HOURS);
		return this.chatSessionRepo.create({ userId, expiresAt });
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/application/session/__tests__/SessionService.test.ts`
Expected: PASS (all `getOrCreate` cases plus the unchanged `validateLimit`, `validateDocumentsLimit`, `validateAttachedLimit`, `validateChatSessionsLimit` blocks).

- [ ] **Step 5: Type-check the repo to catch downstream callers**

Run: `npx tsc --noEmit`
Expected: ONE failure pointing to `app/api/session/route.ts` (the route still calls `getOrCreate` with the 2-arg signature). This is fixed in Task 4. Leave it failing for now — do NOT commit yet.

- [ ] **Step 6: (defer commit)**

We'll commit Task 3 + Task 4 together once the route is updated, so `tsc` stays green at the commit boundary.

---

## Task 4: Pass `user.role` from the session route (TDD)

**Files:**

- Modify: `app/api/session/__tests__/route.test.ts`
- Modify: `app/api/session/route.ts`

- [ ] **Step 1: Update existing POST test for the new signature; add a 403 case**

In `app/api/session/__tests__/route.test.ts`, replace the entire `describe('POST', () => { ... })` block with:

```ts
describe('POST', () => {
	it('creates session and returns 201 with DTO', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({
			id: 'u',
			email: 'e',
			role: 'USER',
		});
		const created = new Date('2026-02-01T00:00:00.000Z');
		const expires = new Date('2026-02-02T00:00:00.000Z');
		mockSessionService.getOrCreate.mockResolvedValueOnce({
			id: 's2',
			title: null,
			userId: 'u',
			createdAt: created,
			expiresAt: expires,
		});

		const res = await POST(makeReq(), { params: Promise.resolve({}) });

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			id: 's2',
			title: null,
			createdAt: '2026-02-01T00:00:00.000Z',
			expiresAt: '2026-02-02T00:00:00.000Z',
		});
		expect(mockSessionService.getOrCreate).toHaveBeenCalledWith('u', null, 'USER');
	});

	it('returns 403 when the chat sessions limit is reached', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({
			id: 'u',
			email: 'e',
			role: 'USER',
		});
		const { ChatSessionsLimitReached } = await import('@/shared/errors/AppError');
		mockSessionService.getOrCreate.mockRejectedValueOnce(ChatSessionsLimitReached());

		const res = await POST(makeReq(), { params: Promise.resolve({}) });

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'chat_sessions_limit_reached' });
	});

	it('maps internal failure to 500', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({
			id: 'u',
			email: 'e',
			role: 'USER',
		});
		mockSessionService.getOrCreate.mockRejectedValueOnce(new Error('boom'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const res = await POST(makeReq(), { params: Promise.resolve({}) });

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: 'internal_error' });
		consoleSpy.mockRestore();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/session/__tests__/route.test.ts`
Expected: FAIL — the assertion `toHaveBeenCalledWith('u', null, 'USER')` fails because the route only passes 2 args.

- [ ] **Step 3: Update the route to pass `user.role`**

In `app/api/session/route.ts`, replace the `POST` handler body with:

```ts
export const POST = withAuth(async (_req, { user }) => {
	const session = await sessionService.getOrCreate(user.id, null, user.role);
	return NextResponse.json(toSessionDto(session), { status: 201 });
}, 'session.create');
```

(Only `user.id, null` → `user.id, null, user.role` changes; keep imports, decorator, log tag.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/session/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check the repo (should be clean now)**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 6: Commit (covers Task 3 + Task 4 together)**

```bash
git add server/application/session/SessionService.ts server/application/session/__tests__/SessionService.test.ts app/api/session/route.ts app/api/session/__tests__/route.test.ts
git commit -m "feat(session): enforce maxChatSessions cap in getOrCreate"
```

---

## Task 5: Parse server error body in `SessionApi.createSession` (TDD)

**Files:**

- Create: `client/infrastructure/http/__tests__/SessionApi.test.ts`
- Modify: `client/infrastructure/http/SessionApi.ts`

- [ ] **Step 1: Write the new test file**

Create `client/infrastructure/http/__tests__/SessionApi.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionApi } from '../SessionApi';

describe('SessionApi.createSession', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('returns the DTO on 201', async () => {
		global.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: 's1',
					title: null,
					createdAt: '2026-05-17T00:00:00.000Z',
					expiresAt: '2026-05-18T00:00:00.000Z',
				}),
				{ status: 201, headers: { 'Content-Type': 'application/json' } },
			),
		);

		const api = new SessionApi();
		const dto = await api.createSession();

		expect(dto.id).toBe('s1');
	});

	it('throws Error with the server error code when body has { error: code }', async () => {
		global.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'chat_sessions_limit_reached' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const api = new SessionApi();

		await expect(api.createSession()).rejects.toThrow('chat_sessions_limit_reached');
	});

	it('falls back to session_create_failed when body is not parseable', async () => {
		global.fetch = vi.fn().mockResolvedValue(
			new Response('<<not json>>', {
				status: 500,
				headers: { 'Content-Type': 'text/plain' },
			}),
		);

		const api = new SessionApi();

		await expect(api.createSession()).rejects.toThrow('session_create_failed');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run client/infrastructure/http/__tests__/SessionApi.test.ts`
Expected: 2 tests FAIL — both error cases throw `session_create_failed` because the current implementation never reads the body.

- [ ] **Step 3: Update `SessionApi.createSession` to parse the error body**

In `client/infrastructure/http/SessionApi.ts`, replace the `createSession` method with:

```ts
	async createSession(): Promise<SessionDto> {
		const res = await apiFetch('/api/session', { method: 'POST' });
		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { error?: string } | null;
			throw new Error(body?.error ?? 'session_create_failed');
		}
		return res.json();
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/infrastructure/http/__tests__/SessionApi.test.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add client/infrastructure/http/SessionApi.ts client/infrastructure/http/__tests__/SessionApi.test.ts
git commit -m "feat(session-api): surface server error code on createSession failure"
```

---

## Task 6: Add `startNewChat()` to `sessionStore` and map limit code to friendly toast (TDD)

**Files:**

- Create: `client/stores/__tests__/sessionStore.test.ts`
- Modify: `client/stores/sessionStore.ts`

- [ ] **Step 1: Write the new test file**

Create `client/stores/__tests__/sessionStore.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSessionApi, mockToast } = vi.hoisted(() => ({
	mockSessionApi: {
		getSessions: vi.fn(),
		createSession: vi.fn(),
		deleteSession: vi.fn(),
	},
	mockToast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('../../infrastructure/container', () => ({
	sessionApi: mockSessionApi,
}));

vi.mock('../toastStore', () => ({
	toast: mockToast,
}));

import { useSessionStore } from '../sessionStore';
import { useChatStore } from '../chatStore';

beforeEach(() => {
	vi.clearAllMocks();
	useSessionStore.setState({
		sessions: [],
		activeSessionId: null,
		isLoading: false,
		error: null,
	});
});

describe('sessionStore.startNewChat', () => {
	it('does not call sessionApi.createSession', () => {
		useSessionStore.getState().startNewChat();
		expect(mockSessionApi.createSession).not.toHaveBeenCalled();
	});

	it('sets activeSessionId to null', () => {
		useSessionStore.setState({ activeSessionId: 'existing-id' });
		useSessionStore.getState().startNewChat();
		expect(useSessionStore.getState().activeSessionId).toBeNull();
	});

	it('resets chatStore messages', () => {
		useChatStore.setState({
			messages: [
				{
					id: 'm1',
					sessionId: 's1',
					role: 'user',
					content: 'hi',
					createdAt: new Date().toISOString(),
				},
			] as never,
			citationsByMessageId: {},
		});

		useSessionStore.getState().startNewChat();

		expect(useChatStore.getState().messages).toEqual([]);
	});
});

describe('sessionStore.createSession', () => {
	it('shows friendly toast text when server returns chat_sessions_limit_reached', async () => {
		mockSessionApi.createSession.mockRejectedValueOnce(new Error('chat_sessions_limit_reached'));

		await expect(useSessionStore.getState().createSession()).rejects.toThrow(
			'chat_sessions_limit_reached',
		);

		expect(mockToast.error).toHaveBeenCalledOnce();
		const [title, body] = mockToast.error.mock.calls[0];
		expect(title).toBe('Could not create chat');
		expect(body).toMatch(/Chat limit reached/);
		expect(body).toMatch(/10 chats/);
	});

	it('falls back to raw error message for unknown codes', async () => {
		mockSessionApi.createSession.mockRejectedValueOnce(new Error('weird_error'));

		await expect(useSessionStore.getState().createSession()).rejects.toThrow('weird_error');

		const [, body] = mockToast.error.mock.calls[0];
		expect(body).toBe('weird_error');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run client/stores/__tests__/sessionStore.test.ts`
Expected: FAIL — `startNewChat` is not defined on the store; the friendly-text test fails because the current toast just shows `'weird_error'`-style messages.

- [ ] **Step 3: Update `sessionStore.ts`**

In `client/stores/sessionStore.ts`:

(a) Add the imports near the top of the file. The file already imports `useChatStore` from `./chatStore` — keep it. Add the limits import below the existing imports:

```ts
import { LIMITS_BY_ROLE } from '../../shared/config/limits';
```

(b) Add `startNewChat: () => void;` to the `SessionState` interface, between `fetchSessions` and `createSession`:

```ts
interface SessionState {
	sessions: SessionDto[];
	activeSessionId: string | null;
	isLoading: boolean;
	error: string | null;
	fetchSessions: () => Promise<void>;
	startNewChat: () => void;
	createSession: () => Promise<SessionDto>;
	deleteSession: (id: string) => Promise<void>;
	setActiveSession: (id: string) => void;
	updateSessionTitle: (id: string, title: string) => void;
}
```

(c) Inside the `create<SessionState>(set => ({ ... }))` body, add the new action right after the existing `fetchSessions` block (before `createSession`):

```ts
	startNewChat: () => {
		useChatStore.getState().reset();
		set({ activeSessionId: null });
	},
```

(d) Replace the existing `createSession` action with this version that maps the limit code:

```ts
	createSession: async () => {
		try {
			const session = await sessionApi.createSession();
			useChatStore.getState().reset();
			set(state => ({ sessions: [session, ...state.sessions], activeSessionId: session.id }));
			return session;
		} catch (e: unknown) {
			if (!isAuthRedirect(e)) {
				const code = e instanceof Error ? e.message : undefined;
				const friendly =
					code === 'chat_sessions_limit_reached'
						? `Chat limit reached (${LIMITS_BY_ROLE.USER.maxChatSessions} chats). Delete an existing chat to start a new one.`
						: code;
				toast.error('Could not create chat', friendly);
			}
			throw e;
		}
	},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/stores/__tests__/sessionStore.test.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Run the full server test suite to be sure nothing regressed**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/stores/sessionStore.ts client/stores/__tests__/sessionStore.test.ts
git commit -m "feat(session-store): add startNewChat and friendly limit-reached toast"
```

---

## Task 7: Wire `+ New chat` button to `startNewChat`

**Files:**

- Modify: `presentation/web/layout/Sidebar/index.tsx`

No unit test — UI component, manual verification at the end.

- [ ] **Step 1: Update the `ChatSection` to use `startNewChat`**

In `presentation/web/layout/Sidebar/index.tsx`, inside the `ChatSection` function:

(a) Replace the `useSessionStore()` destructure (swap `createSession` → `startNewChat`):

```ts
const {
	sessions,
	activeSessionId,
	setActiveSession,
	startNewChat,
	fetchSessions,
	deleteSession,
	isLoading,
} = useSessionStore();
```

(b) Replace `handleNewChat` with:

```ts
const handleNewChat = () => {
	startNewChat();
	if (!onChatPage) router.push('/');
};
```

The `Button`'s `onClick={handleNewChat}` JSX needs no change — the prop name and reference stay the same, only the handler implementation changed.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add presentation/web/layout/Sidebar/index.tsx
git commit -m "feat(sidebar): + New chat no longer hits the API"
```

---

## Task 8: `ChatPage` — `ensureSession` for attach + send, drop `sessions[0]` fallback

**Files:**

- Modify: `presentation/web/pages/Chat/index.tsx`

No unit test — manual verification at the end.

- [ ] **Step 1: Make `sessionId` honor `activeSessionId === null` and add `ensureSession`**

In `presentation/web/pages/Chat/index.tsx`:

(a) Replace the existing `sessionId` derivation:

```ts
// before
const sessionId = activeSessionId ?? sessions[0]?.id ?? null;
// after
const sessionId = activeSessionId;
```

Since `sessions` is now only used for the fallback we just removed, also remove it from the destructure to avoid an unused warning. Update the `useSessionStore()` destructure:

```ts
const { activeSessionId, fetchSessions, createSession } = useSessionStore();
```

(b) Add `ensureSession` directly above `handleSend`:

```ts
const ensureSession = async (): Promise<string> => {
	if (sessionId) return sessionId;
	const ns = await createSession();
	return ns.id;
};
```

(c) Replace `handleSend` with:

```ts
const handleSend = async (message: string) => {
	if (activeIds.length === 0) return;
	let sid: string;
	try {
		sid = await ensureSession();
	} catch {
		return; // toast already shown by sessionStore
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
```

(d) Add a new handler for opening the library dialog, right after `handleSend`:

```ts
const handleOpenLibrary = async () => {
	try {
		await ensureSession();
		setLibraryOpen(true);
	} catch {
		// toast already shown by sessionStore
	}
};
```

(e) Wire `handleOpenLibrary` to both `+ Add from library` buttons. There are exactly two in this file.

The header button currently looks like:

```tsx
<Button
	type='button'
	variant='ghost'
	onClick={() => setLibraryOpen(true)}
	disabled={!sessionId}
	className='text-cobalt-700 hover:text-cobalt-700 h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs font-normal underline hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-50'
>
	+ Add from library
</Button>
```

Replace it with:

```tsx
<Button
	type='button'
	variant='ghost'
	onClick={handleOpenLibrary}
	className='text-cobalt-700 hover:text-cobalt-700 h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs font-normal underline hover:bg-transparent'
>
	+ Add from library
</Button>
```

(removed: `disabled`, `disabled:` classes; changed: `onClick`)

The empty-state button currently looks like:

```tsx
<Button
	type='button'
	variant='ghost'
	onClick={() => setLibraryOpen(true)}
	className='h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs font-normal underline hover:bg-transparent'
>
	+ Add from library
</Button>
```

Replace its `onClick` only:

```tsx
<Button
	type='button'
	variant='ghost'
	onClick={handleOpenLibrary}
	className='h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs font-normal underline hover:bg-transparent'
>
	+ Add from library
</Button>
```

(`sessionId &&` gating at the bottom of the file for `<AddFromLibraryDialog />` stays — the dialog only mounts once `ensureSession` populates `activeSessionId`.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Start the dev server: `npm run dev`. Sign in as a `USER`. Open DevTools → Network, filter to `session`.

Verify each in turn:

1. **Spam:** click `+ New chat` 10× rapidly. Network shows zero `POST /api/session`. Sidebar shows no new rows.
2. **Lazy on send:** with no `activeSessionId` (after `+ New chat`), attach an existing document from library (this should trigger a `POST /api/session` ONCE; sidebar shows the new row), type a message, send. Message streams; sources event arrives.
3. **Lazy on attach into empty state:** click `+ New chat`, then `+ Add from library` from the header. Single `POST /api/session`; dialog opens; attach a doc; close dialog; verify chat shows the attached doc.
4. **Initial load:** reload the page. `activeSessionId` falls back to the most recently created session (via `fetchSessions`'s existing logic). Active session is highlighted; history loads.
5. **Server cap:** temporarily edit `shared/config/limits.ts` and set `USER.maxChatSessions = 2`. Reload. Send a first message in a fresh draft. After 2 lazy creations, the 3rd attempt to send (in a fresh draft) → toast "Chat limit reached (2 chats). Delete an existing chat to start a new one." Restore the limit to `10` before committing.

If anything misbehaves, fix inline before commit.

- [ ] **Step 5: Commit**

```bash
git add presentation/web/pages/Chat/index.tsx
git commit -m "feat(chat-page): lazy-create session on attach or send"
```

---

## Final verification

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: PASS, including the new files:

- `client/infrastructure/http/__tests__/SessionApi.test.ts`
- `client/stores/__tests__/sessionStore.test.ts`
  And updated:
- `server/application/session/__tests__/SessionService.test.ts`
- `app/api/session/__tests__/route.test.ts`

- [ ] **Step 3: Final manual smoke (re-run Task 8 Step 4 once end-to-end)**

Same checklist as Task 8 Step 4 — confirm nothing regressed across the now-committed changes.
