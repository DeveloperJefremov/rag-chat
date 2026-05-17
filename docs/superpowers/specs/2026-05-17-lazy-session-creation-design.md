# Lazy Chat Session Creation — Design

**Date:** 2026-05-17
**Branch:** `bugfix`
**Status:** Draft

## Problem

Clicking `+ New chat` in the sidebar calls `POST /api/session` immediately and writes a new `ChatSession` row to the database. A user can spam the button and create many empty sessions (rapidly hitting `maxChatSessions = 10` for the `USER` role). The server-side `maxChatSessions` limit documented in `CLAUDE.md` is also not enforced in `SessionService.getOrCreate`, so the only effect of spam today is DB bloat and exhausting the cap with empty rows.

## Goal

Make new-chat creation **lazy** — like Claude. The DB row is created only when the user commits to the chat (attaches a document or sends a message). The `+ New chat` button is purely a client-side state reset.

Server-side: enforce `maxChatSessions` as a defense-in-depth so the lazy creation path still respects the cap.

## Non-goals

- Draft attachments held entirely in memory before session creation. Attaching a document triggers lazy session creation (chosen variant 1 from brainstorming). The user can still create an empty (no-message) session in DB by attaching a doc and leaving — this is acceptable because attach is a deliberate action, not a spammable button.
- Rewriting the attachment API to be session-less.
- Centralized API error mapping. We add a minimal targeted fix for the new error code only.

## Architecture overview

```
Sidebar.handleNewChat()
    │
    ▼
sessionStore.startNewChat()      ← NEW: pure local reset, no API
    │
    ├─ chatStore.reset()
    └─ set activeSessionId = null
                                 ─── user is now in "draft" chat ───

ChatPage.handleSend / handleOpenLibrary
    │
    ▼
ensureSession()                  ← NEW: helper, lazy-creates if needed
    │
    ├─ if (sessionId) → return sessionId
    └─ else → sessionStore.createSession() → API call → return new id

POST /api/session
    │
    ▼
SessionService.getOrCreate(userId, null, role)
    │
    └─ if (creating new) → validateChatSessionsLimit(userId, role)
                              │
                              └─ throws ChatSessionsLimitReached if count >= limit
```

The `activeSessionId === null` state replaces the eager-creation pattern. The existing fallback `sessions[0]?.id` in `ChatPage` is removed so this null state is honored.

## Server-side changes

### `shared/errors/AppError.ts`

Add a new error code:

```ts
'chat_sessions_limit_reached';

export const ChatSessionsLimitReached = () => new AppError('chat_sessions_limit_reached', 403);
```

### `server/application/session/SessionService.ts`

Update signature and add limit check:

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

async validateChatSessionsLimit(userId: string, role: UserRole): Promise<void> {
  const limit = LIMITS_BY_ROLE[role].maxChatSessions;
  if (limit === Infinity) return;
  const count = await this.chatSessionRepo.countByUser(userId);
  if (count >= limit) throw ChatSessionsLimitReached();
}
```

`IChatSessionRepository.countByUser` already exists — no repository change needed.

### `app/api/session/route.ts`

Pass the user's role:

```ts
const session = await sessionService.getOrCreate(user.id, null, user.role);
```

## Client-side changes

### `client/stores/sessionStore.ts`

Add `startNewChat` to `SessionState` interface and implement it:

```ts
interface SessionState {
  // ... existing fields ...
  startNewChat: () => void;
  // ... existing actions ...
}

startNewChat: () => {
  useChatStore.getState().reset();
  set({ activeSessionId: null });
},
```

`createSession` stays as is (still used by `ensureSession` for the lazy path).

### `client/infrastructure/http/SessionApi.ts`

`createSession` currently throws a generic `Error('session_create_failed')`, losing the server's error code. Parse the body on error to surface the real code:

```ts
async createSession(): Promise<SessionDto> {
  const res = await apiFetch('/api/session', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const code = body?.error ?? 'session_create_failed';
    throw new Error(code);
  }
  return res.json();
}
```

### `client/stores/sessionStore.ts` — friendly toast for the new code

In the `createSession` catch block, map the known code to a friendlier message:

```ts
catch (e: unknown) {
  if (isAuthRedirect(e)) throw e;
  const code = e instanceof Error ? e.message : undefined;
  const friendly =
    code === 'chat_sessions_limit_reached'
      ? `Chat limit reached (${LIMITS_BY_ROLE.USER.maxChatSessions} chats). Delete an existing chat to start a new one.`
      : code;
  toast.error('Could not create chat', friendly);
  throw e;
}
```

(`LIMITS_BY_ROLE.USER.maxChatSessions` is used for the user-facing copy — admins don't hit the limit so this is a USER-facing message.)

### `presentation/web/layout/Sidebar/index.tsx`

Replace `handleNewChat`:

```ts
const { startNewChat /* ... */ } = useSessionStore();

const handleNewChat = () => {
	startNewChat();
	if (!onChatPage) router.push('/');
};
```

Button is no longer `async` — no API call to await.

### `presentation/web/pages/Chat/index.tsx`

Two changes:

**1. Honor `activeSessionId === null` as "draft chat":**

```ts
// before
const sessionId = activeSessionId ?? sessions[0]?.id ?? null;
// after
const sessionId = activeSessionId;
```

The initial-load fallback to the most recent session is preserved because `sessionStore.fetchSessions` already sets `activeSessionId = sessions[0]?.id` when none is selected.

**2. Add `ensureSession` helper, use it for attach and send:**

```ts
const ensureSession = async (): Promise<string> => {
	if (sessionId) return sessionId;
	const ns = await createSession();
	return ns.id;
};

const handleSend = async (message: string) => {
	if (activeIds.length === 0) return;
	const sid = await ensureSession();
	await sendMessage({
		message,
		sessionId: sid,
		documentIds: activeIds,
		chunkingStrategy,
		topK,
		rerankingEnabled,
	});
};

const handleOpenLibrary = async () => {
	try {
		await ensureSession();
		setLibraryOpen(true);
	} catch {
		// toast already shown by sessionStore
	}
};
```

Wire `handleOpenLibrary` into both `+ Add from library` buttons (the header one and the empty-state one). Remove `disabled={!sessionId}` from both.

### `AddFromLibraryDialog`

Unchanged — it still requires a non-null `sessionId` prop. It only mounts after `ensureSession` succeeds in `handleOpenLibrary`. The conditional `{sessionId && (<AddFromLibraryDialog ... />)}` at the bottom of `ChatPage` continues to gate rendering.

## Data flow examples

### Spam `+ New chat` 20 times

1. Each click → `startNewChat()` → `chatStore.reset()` + `activeSessionId = null`
2. Zero API calls
3. Sidebar shows no highlighted session, no new rows added

### Attach a document in a fresh draft

1. User on `/` with `activeSessionId = null`
2. Clicks `+ Add from library` → `handleOpenLibrary` → `ensureSession()` → `createSession()` → server: `getOrCreate(userId, null, role)` → limit check passes → new row → returned to client → `activeSessionId` set, sidebar shows it
3. Dialog opens with that session id
4. User attaches doc → normal flow

### Send first message in a fresh draft

1. Same as above but skipping the attach dialog — `handleSend` calls `ensureSession()` directly
2. Chat session created, message sent against it

### Spam to hit server limit

1. User has 10 sessions already (the `maxChatSessions` cap)
2. Sends a message in a new draft → `ensureSession` → `createSession` → server returns `403 chat_sessions_limit_reached`
3. `SessionApi.createSession` throws `Error('chat_sessions_limit_reached')`
4. `sessionStore.createSession` shows friendly toast: "Chat limit reached (10 chats). Delete an existing chat to start a new one."
5. `handleSend` catches via `ensureSession` failure (throws) — UI returns to draft state, no message sent

## Edge cases

| Case                                               | Behavior                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `+ New chat` while already in draft                | No-op (`activeSessionId` already null, `chatStore.reset` is idempotent)                                                                                                                                                                                                                                                  |
| `+ New chat` from `/documents` or `/stats`         | `startNewChat()` then `router.push('/')` — landing on Chat page with draft state                                                                                                                                                                                                                                         |
| `fetchSessions` on initial load                    | Sets `activeSessionId = sessions[0]?.id` — behavior preserved, user sees latest existing chat                                                                                                                                                                                                                            |
| Active session deleted                             | Existing `deleteSession` already sets `activeSessionId = sessions[0]?.id ?? null` — works the same                                                                                                                                                                                                                       |
| User attaches doc, then closes tab without sending | Empty session remains in DB (acceptable per non-goals; subject to existing `expiresAt` cleanup)                                                                                                                                                                                                                          |
| Concurrent attach + send race                      | Both call `ensureSession`. First one creates, second sees `sessionId` set in store and returns it. Worst case: two parallel `createSession` calls if state hasn't propagated — server returns two sessions and only one wins as `activeSessionId`. Rare and self-healing (orphan expires). Not handled explicitly in v1. |
| Expired session via `getOrCreate(id, ...)` path    | Hits the `validateChatSessionsLimit` branch we added — correct behavior, prevents creating a replacement when over cap                                                                                                                                                                                                   |

## Tests

### Server

- `server/application/session/__tests__/SessionService.test.ts`
  - `getOrCreate` with `role=USER` and `countByUser >= maxChatSessions` → throws `ChatSessionsLimitReached`
  - `getOrCreate` with `role=ADMIN` and `countByUser = 9999` → returns new session
  - `getOrCreate` with valid `sessionId` (non-expired) → returns existing without limit check (no `countByUser` call)
  - Update existing tests that call `getOrCreate(userId, sessionId)` to pass `role`
- `app/api/session/__tests__/route.test.ts`
  - Update `getOrCreate` mock signature
  - New case: service throws `ChatSessionsLimitReached` → response is `403` with `{ error: 'chat_sessions_limit_reached' }`

### Client

No client-side test files exist in the repo today. Two new files:

- `client/stores/__tests__/sessionStore.test.ts` — new
  - `startNewChat()` does not call `sessionApi.createSession`
  - `startNewChat()` sets `activeSessionId = null` and resets `chatStore` messages
  - `createSession()` rejecting with `chat_sessions_limit_reached` triggers toast with friendly text
- `client/infrastructure/http/__tests__/SessionApi.test.ts` — new
  - On 403 with body `{ error: 'chat_sessions_limit_reached' }`, throws `Error` with that exact message
  - On 403 with no parseable body, throws `Error('session_create_failed')` (fallback)

UI / integration tests are not added — manual smoke test covers them (see Manual verification).

## Manual verification

Run dev server, sign in as a `USER`:

1. **Spam check** — click `+ New chat` 20 times. Open DevTools → Network. Zero `POST /api/session` requests. No new sidebar rows. ✅
2. **Attach-driven creation** — fresh draft, click `+ Add from library`. One `POST /api/session`. Sidebar row appears. Dialog opens. ✅
3. **Send-driven creation** — fresh draft, attach a doc (creates session A), then `+ New chat` (draft, no API), then attach a different doc → session B created. ✅ (alternative: type message and send in fresh draft → session created at send time)
4. **Server limit** — manually insert 10 sessions for the user (or temporarily lower `maxChatSessions = 2`), try to send in a draft → 403, friendly toast. ✅
5. **Existing chats still work** — click on an existing chat in sidebar → loads messages and attachments. ✅
6. **Delete active draft path** — fresh draft, send a message (creates session), delete that chat → sidebar selects another existing chat or empty state. ✅

## Files changed

| File                                                          | Change                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `shared/errors/AppError.ts`                                   | +1 code, +1 factory                                                       |
| `server/application/session/SessionService.ts`                | `getOrCreate` signature + new `validateChatSessionsLimit`                 |
| `app/api/session/route.ts`                                    | Pass `user.role` to `getOrCreate`                                         |
| `client/stores/sessionStore.ts`                               | Add `startNewChat`, map limit code to friendly toast                      |
| `client/infrastructure/http/SessionApi.ts`                    | Parse server error body in `createSession`                                |
| `presentation/web/layout/Sidebar/index.tsx`                   | `handleNewChat` → `startNewChat`                                          |
| `presentation/web/pages/Chat/index.tsx`                       | Remove `sessions[0]` fallback, add `ensureSession`, wire to attach + send |
| `server/application/session/__tests__/SessionService.test.ts` | Update + new cases                                                        |
| `app/api/session/__tests__/route.test.ts`                     | Update mock signature + 403 case                                          |
| `client/stores/__tests__/sessionStore.test.ts`                | New                                                                       |
| `client/infrastructure/http/__tests__/SessionApi.test.ts`     | New                                                                       |

## Open questions

None. Sub-question on attachments (variant 1: lazy-create-on-attach) and server-side limit enforcement (yes) confirmed during brainstorming.
