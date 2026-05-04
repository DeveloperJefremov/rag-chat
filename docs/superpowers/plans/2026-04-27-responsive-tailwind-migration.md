# Responsive UI + Tailwind Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire `presentation/web/**` layer from inline `style={{}}` to Tailwind utility classes, and add a single-breakpoint (`desk = 900px`) responsive layout. Desktop appearance must be byte-for-byte unchanged at ≥ 900px.

**Architecture:** Tailwind v4 `@theme` exposes the existing palette as utilities (`bg-cobalt-800`, `font-mono`, `animate-pulse-dot`, ...). Mobile-first base classes describe `< 900px`; `desk:` modifiers describe ≥ 900px. Sidebar becomes an off-canvas drawer on mobile, opened via a per-page burger button. `useIsMobile` hook (matchMedia) drives the small number of cases where we render different DOM (Documents table vs. card list).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Zustand, `clsx` (already installed), `prettier-plugin-tailwindcss` (already installed).

**Spec:** `docs/superpowers/specs/2026-04-27-responsive-tailwind-migration-design.md`

---

## Conventions Used Throughout

- After **every** task, run `npx tsc --noEmit` and ensure it passes.
- All commits use the `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` footer (lint-staged + prettier run automatically).
- The conversion table from spec §4 governs all mechanical replacements:
  - `style={{ background: 'var(--cobalt-800)' }}` → `bg-cobalt-800`
  - `style={{ color: 'var(--powder-300)' }}` → `text-powder-300`
  - `onMouseEnter`/`onMouseLeave` setting background → `hover:bg-…`
  - `MONO`/`SERIF` constants → `font-mono` / `font-serif` classes; **delete the constants**.
  - `WebkitLineClamp` → `line-clamp-N`
  - `animation: 'pulse-dot …'` → `animate-pulse-dot`
  - SVG `stroke='currentColor'` stays; ancestor sets `text-…`.
  - Conditional classes: use `clsx(...)` from the already-installed `clsx` dep.
- Pixel-to-token rounding uses Tailwind's default scale (`p-3 = 12px`, `p-4 = 16px`, `gap-2 = 8px`, ...). When no token is within ±1px of the original, use arbitrary `[14px]` only as last resort.

---

## Task 1: Foundation — `@theme` tokens + `useIsMobile` hook + `sidebarStore` extension

**Files:**

- Modify: `app/globals.css`
- Create: `client/hooks/useIsMobile.ts`
- Modify: `client/stores/sidebarStore.ts`

### Step 1.1: Add design tokens to `@theme inline` in `app/globals.css`

- [ ] Open `app/globals.css`. Inside the existing `@theme inline { … }` block (already present, just before `}`), append the new tokens:

```css
@theme inline {
	/* … existing entries … */

	/* Design palette — exposes bg-/text-/border- utilities */
	--color-cobalt-950: #0a1428;
	--color-cobalt-900: #12203f;
	--color-cobalt-800: #1a2e5c;
	--color-cobalt-700: #284685;
	--color-cobalt-500: #4b6cb7;
	--color-powder-600: #6b8cae;
	--color-powder-400: #9db5cc;
	--color-powder-300: #b8cbdd;
	--color-powder-200: #d4e0ec;
	--color-powder-100: #e8eff6;
	--color-terracotta-700: #a84a1f;
	--color-terracotta-600: #c85a2c;
	--color-terracotta-500: #e06b38;
	--color-terracotta-300: #f2b090;
	--color-sand: #f4ede0;
	--color-paper: #faf6ed;
	--color-ink: #0f1419;
	--color-smoke: #6b7280;

	/* Fonts — enables font-serif / font-mono */
	--font-serif: var(--font-fraunces);
	--font-mono: var(--font-jetbrains-mono);

	/* Animations — enables animate-pulse-dot etc. */
	--animate-pulse-dot: pulse-dot 2.5s ease-in-out infinite;
	--animate-fade-up: fade-up 0.35s ease both;
	--animate-slide-in: slide-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;

	/* Custom breakpoint — enables desk: variant */
	--breakpoint-desk: 900px;
}
```

### Step 1.2: Remove the duplicate palette declarations from `:root`

- [ ] In `app/globals.css`, delete only the `--cobalt-*`, `--powder-*`, `--terracotta-*`, `--sand`, `--paper`, `--ink`, `--smoke` lines from the `:root { … }` block. Keep all `--background`, `--foreground`, `--card`, `--primary`, `--sidebar*`, `--chart-*`, `--radius` lines intact. (`@theme inline` already exports these palette vars, so removing the duplicates avoids drift.)

### Step 1.3: Verify build still works

- [ ] Run: `npx tsc --noEmit`
- [ ] Expected: no errors.

### Step 1.4: Create `useIsMobile` hook

- [ ] Create `client/hooks/useIsMobile.ts`:

```ts
'use client';
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 899.98px)';

export function useIsMobile(): boolean {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const mql = window.matchMedia(QUERY);
		setIsMobile(mql.matches);
		const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	}, []);

	return isMobile;
}
```

(SSR returns `false` to match desktop server render; client `useEffect` syncs the real value on mount. The one-frame flash on mobile is acknowledged in spec §9.)

### Step 1.5: Extend `sidebarStore` with mobile drawer state

- [ ] Replace `client/stores/sidebarStore.ts` with:

```ts
import { create } from 'zustand';

interface TodayStats {
	requests: number;
	avgLatencyMs: number;
	citationRate: number;
}

interface SidebarStore {
	todayStats: TodayStats | null;
	mobileOpen: boolean;
	setTodayStats: (stats: TodayStats) => void;
	openMobile: () => void;
	closeMobile: () => void;
	toggleMobile: () => void;
}

export const useSidebarStore = create<SidebarStore>(set => ({
	todayStats: null,
	mobileOpen: false,
	setTodayStats: stats => set({ todayStats: stats }),
	openMobile: () => set({ mobileOpen: true }),
	closeMobile: () => set({ mobileOpen: false }),
	toggleMobile: () => set(s => ({ mobileOpen: !s.mobileOpen })),
}));
```

### Step 1.6: Verify and commit

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Run: `npm run dev`. Open `http://localhost:3000` at desktop width. The app should look exactly as before. (Tailwind utilities haven't been used yet, so this is purely a no-op verification that the theme refactor didn't break anything.)
- [ ] Commit:

```bash
git add app/globals.css client/hooks/useIsMobile.ts client/stores/sidebarStore.ts
git commit -m "$(cat <<'EOF'
chore(ui): expose design palette via @theme + add mobile state primitives

- Move cobalt/powder/terracotta/paper/etc. palette into @theme inline
  so Tailwind v4 generates bg-/text-/border- utilities for them.
- Define desk=900px breakpoint, font-serif/font-mono, and pulse-dot/
  fade-up/slide-in animation utilities.
- Add useIsMobile() hook and sidebarStore.mobileOpen for the upcoming
  drawer-style sidebar on screens <900px.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sidebar — Tailwind rewrite + drawer behavior

**Files:**

- Modify: `presentation/web/layout/Sidebar/index.tsx` (full rewrite, ~712 lines → smaller)
- Modify: `app/(app)/layout.tsx` (no behavior change — see Step 2.5)

This is the largest single rewrite. Read the existing file, understand each subcomponent (`ChatSection`, `DocumentsSection`, `StatsSection`, `UserMenu`), then rewrite each preserving all functionality.

### Step 2.1: Rewrite `Sidebar` to use Tailwind classes

- [ ] In `presentation/web/layout/Sidebar/index.tsx`:
  - Delete the `MONO` constant (use `font-mono` class instead).
  - Replace every `style={{ … }}` with the equivalent classes per the conversion rules in spec §4.
  - Replace every `onMouseEnter`/`onMouseLeave` background-flip with `hover:bg-…` Tailwind variant.
  - The animated dot (`pulse-dot`) gets `animate-pulse-dot`.
  - Use `clsx` from `'clsx'` for conditional classes.

The new outer `<aside>` uses these classes (this is the drawer-aware shell):

```tsx
<aside
	data-open={mobileOpen}
	className={clsx(
		'fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] flex-col overflow-hidden bg-cobalt-950',
		'-translate-x-full transition-transform duration-200 ease-out',
		'data-[open=true]:translate-x-0',
		'desk:static desk:w-[260px] desk:min-w-[260px] desk:translate-x-0',
	)}
>
```

Where `mobileOpen` comes from `useSidebarStore(s => s.mobileOpen)`.

The header (logo + close button) becomes:

```tsx
<div className='flex items-center justify-between border-b border-white/[0.06] px-5 pt-[22px] pb-[18px]'>
	<div className='flex items-center gap-2.5'>
		<div className='animate-pulse-dot bg-terracotta-500 h-2 w-2 flex-shrink-0 rounded-full' />
		<span className='text-paper font-serif text-[20px] font-light tracking-[-0.01em]'>
			RAG Chat
		</span>
	</div>
	<button
		type='button'
		aria-label='Close sidebar'
		onClick={closeMobile}
		className='text-powder-400 hover:bg-cobalt-800 hover:text-paper desk:hidden -mr-2 rounded p-1.5'
	>
		<svg
			width='16'
			height='16'
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='2'
		>
			<line x1='18' y1='6' x2='6' y2='18' />
			<line x1='6' y1='6' x2='18' y2='18' />
		</svg>
	</button>
</div>
```

Move the existing nav block out of the header div (the spec keeps logo+nav grouped, but the close button only belongs in the header row — keep the structure that exists today, just add the close button on the same row as the logo). The whole nav block then sits in its own padded section, classes:

```tsx
<nav className='flex flex-col gap-0.5 px-5 pb-4'>{/* NAV.map */}</nav>
```

Each nav `<Link>`:

```tsx
<Link
	href={item.href}
	className={clsx(
		'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-[13px] transition-[background,color] duration-150',
		isActive
			? 'border-terracotta-500 bg-cobalt-800 text-paper font-medium'
			: 'text-powder-400 border-transparent hover:bg-white/[0.04]',
	)}
>
	{item.icon}
	{item.label}
</Link>
```

Subscribe to route changes inside the component to auto-close drawer on navigation:

```tsx
const closeMobile = useSidebarStore(s => s.closeMobile);
useEffect(() => {
	closeMobile();
}, [pathname, closeMobile]);
```

Subscribe to `Esc` key globally while `mobileOpen` is true:

```tsx
useEffect(() => {
	if (!mobileOpen) return;
	const onKey = (e: KeyboardEvent) => {
		if (e.key === 'Escape') closeMobile();
	};
	document.addEventListener('keydown', onKey);
	return () => document.removeEventListener('keydown', onKey);
}, [mobileOpen, closeMobile]);
```

Render the backdrop **inside** `Sidebar` as a sibling of `<aside>` so the layout file stays untouched:

```tsx
<>
	{mobileOpen && (
		<button
			type='button'
			aria-label='Close sidebar'
			onClick={closeMobile}
			className='fixed inset-0 z-30 bg-cobalt-950/40 desk:hidden'
		/>
	)}
	<aside …>…</aside>
</>
```

The early return for `/signin` stays — return `null` before any of the above.

### Step 2.2: Rewrite `ChatSection`, `DocumentsSection`, `StatsSection`, `UserMenu`

- [ ] Convert each subcomponent's inline styles to Tailwind classes.

Reference patterns:

- "Recent" / "Knowledge Base" / "Today" labels → `font-mono text-[9px] uppercase tracking-[0.15em] text-powder-600/70`.
- New chat button → `flex w-full items-center justify-center gap-2 rounded-md border border-cobalt-700 bg-transparent py-2.5 text-[13px] text-paper transition-colors hover:bg-cobalt-800`.
- Session row → `clsx('group flex cursor-pointer items-start justify-between gap-2 border-l-2 px-5 py-2.5 transition-colors', isActive ? 'border-terracotta-500 bg-cobalt-800' : 'border-transparent hover:bg-white/[0.04]')`.
- Session title → `flex-1 line-clamp-2 text-[13px] leading-[1.4] text-powder-300`.
- Relative-time stamp → `font-mono text-[10px] text-smoke`.
- Delete button (per session row) → `flex items-center border-none bg-transparent p-0.5 text-powder-600 opacity-60 transition-[color,opacity] hover:text-terracotta-500 hover:opacity-100`.
- KB document row → `flex items-center gap-2 py-1.5 text-[12px] text-powder-300 truncate`.
- Stats row label/value → `flex justify-between mb-2 text-[12px]` with `text-powder-400` / `font-mono text-paper font-medium` for value.
- `UserMenu` popover — same structure as today: absolute positioning above the trigger, `bg-cobalt-900 border border-cobalt-800 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.35)] p-1.5`. Settings link / Sign out button inside use `flex items-center gap-2.5 px-2.5 py-2 rounded-md` plus `font-mono text-[11px] uppercase tracking-[0.1em]`. Sign-out gets `text-terracotta-500 hover:bg-terracotta-500/10`.
- `UserMenu` trigger button → `flex w-full items-center gap-2.5 rounded-md border-none bg-transparent px-2.5 py-2 text-left transition-colors` plus `clsx(open ? 'bg-cobalt-800' : 'hover:bg-white/[0.04]')`. Avatar circle: `flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-cobalt-700 font-serif text-[13px] text-paper`. Caret SVG gets `clsx('flex-shrink-0 transition-transform duration-150', open && 'rotate-180')`.

### Step 2.3: Verify Sidebar visually at desktop width

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Run: `npm run dev`. Open the app at ≥ 900px. Verify the sidebar looks visually identical: same colors, same hover states (mouse over a nav item, a chat row), same spacing, same animations (pulsing dot).
- [ ] Resize to ~700px. Verify the sidebar slides off-screen (you can't see it). The `<main>` content fills the full width.

### Step 2.4: Manually trigger drawer to confirm slide-in works

- [ ] Temporarily add `<button onClick={openMobile}>open</button>` somewhere visible (e.g., inside `Chat/index.tsx` header, just for this manual check) and click it at narrow widths. The drawer should slide in from the left, the backdrop should appear, clicking the backdrop / pressing `Esc` / navigating to a different page should close it.
- [ ] Remove the temporary button (the real burger goes in Task 3).

### Step 2.5: Confirm `app/(app)/layout.tsx` needs no edits

- [ ] Open `app/(app)/layout.tsx`. It already contains only Tailwind classes (`flex-1 overflow-hidden`) and no inline styles. Do not modify it.

### Step 2.6: Commit

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Commit:

```bash
git add presentation/web/layout/Sidebar/index.tsx
git commit -m "$(cat <<'EOF'
feat(ui): rewrite Sidebar in Tailwind + add mobile drawer

- Convert all inline styles to Tailwind utility classes; replace mouse
  enter/leave hover hacks with hover: variants; delete the MONO const.
- Wrap aside in fixed/translated drawer shell, anchored to the desk:
  breakpoint so >=900px keeps the existing static layout untouched.
- Render backdrop as sibling of aside; close on backdrop click, Esc,
  and route change.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Burger button shared component + page header wiring

**Files:**

- Create: `presentation/web/components/MobileMenuButton/index.tsx`
- Modify (header sections only): `presentation/web/pages/Chat/index.tsx`, `presentation/web/pages/Documents/index.tsx`, `presentation/web/pages/Stats/index.tsx`, `presentation/web/pages/Settings/index.tsx`

### Step 3.1: Create `MobileMenuButton`

- [ ] Create `presentation/web/components/MobileMenuButton/index.tsx`:

```tsx
'use client';
import { useSidebarStore } from '@/client/stores/sidebarStore';

export function MobileMenuButton() {
	const openMobile = useSidebarStore(s => s.openMobile);
	return (
		<button
			type='button'
			aria-label='Open sidebar'
			onClick={openMobile}
			className='text-cobalt-800 hover:bg-powder-200 desk:hidden -ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md'
		>
			<svg
				width='18'
				height='18'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='2'
			>
				<line x1='3' y1='6' x2='21' y2='6' />
				<line x1='3' y1='12' x2='21' y2='12' />
				<line x1='3' y1='18' x2='21' y2='18' />
			</svg>
		</button>
	);
}
```

### Step 3.2: Insert burger into each page's header

- [ ] In each of the four page files, add `import { MobileMenuButton } from '@/presentation/web/components/MobileMenuButton';` and place `<MobileMenuButton />` as the first child of the page's header strip (the top row containing the title/logo). At this point the header still has inline styles — leave them; insertion only requires JSX. Conversions happen in Tasks 4–7.

  Example placement (Chat header — see file at line 80 area):

  ```tsx
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
  	<MobileMenuButton />
  	<div
  		style={
  			{
  				/* the pulse-dot */
  			}
  		}
  	/>
  	<span
  		style={
  			{
  				/* the title */
  			}
  		}
  	>
  		Knowledge Assistant
  	</span>
  	{/* … */}
  </div>
  ```

### Step 3.3: Verify and commit

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Run: `npm run dev`. Resize to < 900px on each of `/`, `/documents`, `/stats`, `/settings`. The burger appears at top-left of every page header. Clicking it opens the drawer; Esc / backdrop / route change close it. At ≥ 900px the burger is hidden (`desk:hidden`).
- [ ] Commit:

```bash
git add presentation/web/components/MobileMenuButton/index.tsx \
        presentation/web/pages/Chat/index.tsx \
        presentation/web/pages/Documents/index.tsx \
        presentation/web/pages/Stats/index.tsx \
        presentation/web/pages/Settings/index.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add burger button and wire it into all page headers

Adds a shared MobileMenuButton (visible only desk:hidden) that opens
the sidebar drawer. Mounted in Chat/Documents/Stats/Settings page
headers. Header markup otherwise unchanged — full Tailwind conversion
of each page comes in subsequent tasks.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Chat page — Tailwind rewrite + responsive header

**Files:**

- Modify: `presentation/web/pages/Chat/index.tsx`
- Modify: `presentation/web/pages/Chat/AttachmentChips/index.tsx`
- Modify: `presentation/web/pages/Chat/AddFromLibraryDialog/index.tsx`
- Modify: `presentation/web/pages/Chat/KnowledgePanel/index.tsx`
- Modify: `presentation/web/pages/Chat/AdvancedControls/index.tsx`

### Step 4.1: Rewrite `Chat/index.tsx`

- [ ] Replace all inline styles with classes. Delete the `MONO` const.
- [ ] Outer container: `flex h-full flex-col overflow-hidden bg-paper`.
- [ ] Header strip: `flex flex-wrap items-center justify-between gap-3 border-b border-powder-200 bg-paper px-4 py-3 desk:px-6 desk:py-3.5 flex-shrink-0`.
- [ ] Left cluster: `flex flex-wrap items-center gap-3 min-w-0`.
- [ ] Pulse dot: `h-2 w-2 rounded-full bg-terracotta-500 animate-pulse-dot`.
- [ ] Title `Knowledge Assistant`: `font-serif text-lg font-light text-cobalt-800 desk:text-[18px]`.
- [ ] "+ Add from library" button: `cursor-pointer text-xs text-cobalt-700 underline disabled:cursor-not-allowed disabled:opacity-50` (the `cursor-pointer text-xs underline` is already there — just consolidate and add color/disabled).
- [ ] Right cluster: `flex items-center gap-3`.
- [ ] Sources counter: `font-mono text-[10px] uppercase tracking-[0.15em] text-smoke`.
- [ ] Empty state outer: `flex flex-1 flex-col items-center justify-center gap-3 p-6 desk:p-10`.
- [ ] Empty state heading: `font-serif italic text-xl text-cobalt-800/60 desk:text-2xl text-center`.

### Step 4.2: Rewrite `AttachmentChips/index.tsx`

- [ ] Replace inline styles with classes. Each chip on `< 900px` gets `max-w-[160px] truncate desk:max-w-none`. Other classes follow the same color scheme as today (use `bg-cobalt-800` for active, `bg-paper border-powder-300 text-cobalt-800` for inactive — the executor reads the current file to pull the exact palette references and translates 1-for-1).

### Step 4.3: Rewrite `AddFromLibraryDialog/index.tsx`

- [ ] Convert to Tailwind. Dialog body width: `w-[min(420px,calc(100vw-32px))]`. List rows scroll: `max-h-[60vh] overflow-y-auto`. Backdrop: `fixed inset-0 z-50 bg-cobalt-950/40 flex items-center justify-center p-4`.

### Step 4.4: Rewrite `KnowledgePanel/index.tsx`

- [ ] Convert to Tailwind, no responsive changes beyond what naturally falls out of the header conversion. (This panel is shown on the Chat page; if it's a side rail at ≥ 900px and stacks at < 900px, classes are `flex-col desk:flex-row`.)

### Step 4.5: Rewrite `AdvancedControls/index.tsx`

- [ ] Convert to Tailwind. Outer wrapper: `flex flex-col gap-3 desk:flex-row desk:gap-4`. Each control row: `flex items-center justify-between gap-3 desk:flex-col desk:items-stretch desk:gap-2`. (Reads existing structure and follows it; the spec says "stack vertically" on mobile, "row" on desktop.)

### Step 4.6: Verify and commit

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Run: `npm run dev`. Test at desktop ≥ 1024 (header on one line) and at 480/640/800 (header wraps to two lines, chips truncate).
- [ ] Commit:

```bash
git add presentation/web/pages/Chat
git commit -m "$(cat <<'EOF'
feat(ui): convert Chat page to Tailwind + responsive header

Header strip becomes wrap-friendly on <900px so chips, the add-from-
library button, and the sources/active counter line up across two rows
without overflow. Chips truncate at 160px on mobile and grow back to
their natural size on desktop. AdvancedControls stacks vertically on
mobile.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Message components + supporting widgets

**Files:**

- Modify: `presentation/web/components/MessageList/index.tsx`
- Modify: `presentation/web/components/MessageInput/index.tsx`
- Modify: `presentation/web/components/LimitBadge/index.tsx`
- Modify: `presentation/web/components/FileDropzone/index.tsx`
- Modify: `presentation/web/components/UploadProgress/index.tsx`
- Modify: `presentation/web/components/CitationList/index.tsx`
- Modify: `presentation/web/components/ConfirmDialog/index.tsx`
- Modify: `presentation/web/components/Aurora/index.tsx`

### Step 5.1: `MessageList`

- [ ] Convert to Tailwind. Outer scroll container: `flex-1 overflow-y-auto px-3 py-4 desk:px-6 desk:py-6`. Each message bubble: `max-w-[88%] desk:max-w-[720px]` plus the existing color/role styling translated 1-for-1 (assistant vs. user). Message animation: `animate-slide-in`.

### Step 5.2: `MessageInput`

- [ ] Convert to Tailwind. Outer: `border-t border-powder-200 bg-paper p-3 desk:p-4 flex-shrink-0`. Inner row: `flex items-end gap-2 desk:gap-3`. Textarea: `flex-1 resize-none rounded-lg border border-powder-300 bg-paper px-3 py-2 text-sm leading-[1.5] text-cobalt-900 outline-none focus:border-cobalt-700 disabled:opacity-50`. Send button: `font-mono px-3 py-2 text-[11px] uppercase tracking-[0.12em] rounded-md bg-cobalt-800 text-paper disabled:bg-powder-300 disabled:text-smoke disabled:cursor-not-allowed`.

### Step 5.3: `LimitBadge`

- [ ] Convert to Tailwind classes only. No responsive changes.

### Step 5.4: `FileDropzone`

- [ ] Convert. Dropzone box: `flex min-h-[120px] desk:min-h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-powder-300 bg-paper p-4 text-center transition-colors hover:border-cobalt-700`. Active drag state (if present): toggle `border-cobalt-700 bg-cobalt-700/5` via `clsx`.

### Step 5.5: `UploadProgress`

- [ ] Convert to Tailwind. Bar container: `h-1 w-full overflow-hidden rounded-full bg-powder-200`. Bar fill: `h-full bg-cobalt-700 transition-[width] duration-200` with `style={{ width: `${pct}%` }}` (a single inline style is acceptable for dynamic numeric width — Tailwind has no good replacement for arbitrary percentages without arbitrary values per render).

### Step 5.6: `CitationList`

- [ ] Convert. Each citation: `text-[11px] font-mono text-cobalt-700 hover:text-cobalt-800`.

### Step 5.7: `ConfirmDialog`

- [ ] Convert. Backdrop: `fixed inset-0 z-50 flex items-center justify-center bg-cobalt-950/40 p-4`. Dialog body: `w-[min(420px,calc(100vw-32px))] rounded-lg border border-powder-200 bg-paper p-5 shadow-[0_12px_32px_rgba(0,0,0,0.18)]`. Tone-specific button colors: when `tone === 'danger'`, confirm button is `bg-terracotta-500 text-paper hover:bg-terracotta-600`.

### Step 5.8: `Aurora`

- [ ] Read the file. If it's the OGL canvas wrapper from earlier work, just convert positioning inline styles to classes (e.g., `pointer-events-none fixed inset-0 -z-10`). If it has critical inline styles for canvas sizing, leave only those — convert everything else.

### Step 5.9: Verify and commit

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Run: `npm run dev`. Send a message, see the bubble. Open the delete-chat confirm dialog (in sidebar) — confirm width clamps correctly at 480px viewport.
- [ ] Commit:

```bash
git add presentation/web/components
git commit -m "$(cat <<'EOF'
feat(ui): convert chat-message and dialog components to Tailwind

MessageList/MessageInput, FileDropzone, ConfirmDialog, LimitBadge,
UploadProgress, CitationList, and Aurora now use utility classes
instead of inline style props. Responsive paddings (p-3 → desk:p-4),
narrower bubbles on mobile, and dialog width clamping ensure they
fit cleanly at 480px viewport while desktop is byte-for-byte
unchanged.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Documents page — Tailwind + DocumentCardList for mobile

**Files:**

- Modify: `presentation/web/pages/Documents/index.tsx`
- Modify: `presentation/web/pages/Documents/DocumentTable/index.tsx`
- Modify: `presentation/web/pages/Documents/IngestionSettings/index.tsx`
- Create: `presentation/web/pages/Documents/DocumentCardList/index.tsx`

### Step 6.1: Rewrite `DocumentTable` to Tailwind classes

- [ ] Convert all inline styles to classes. Table itself remains a `<table>` element. Wrap the table in `<div className="hidden desk:block">…</div>` (we move this `hidden desk:block` decision into `Documents/index.tsx` in Step 6.3 — for now the component just stays a table).

### Step 6.2: Create `DocumentCardList`

- [ ] Read `DocumentTable/index.tsx` to discover the prop shape (e.g., `documents`, `onDelete`).
- [ ] Create `presentation/web/pages/Documents/DocumentCardList/index.tsx` accepting **the exact same props**:

```tsx
'use client';
// import the same types DocumentTable uses

interface Props {
	/* same shape as DocumentTable Props */
}

export function DocumentCardList(props: Props) {
	const { documents, onDelete /* etc. */ } = props;
	if (documents.length === 0) {
		return <div className='text-smoke py-10 text-center text-sm'>No documents yet</div>;
	}
	return (
		<div className='flex flex-col gap-2'>
			{documents.map(d => (
				<div
					key={d.id /* whatever the id field is */}
					className='border-powder-200 bg-paper flex items-start gap-3 rounded-lg border p-4'
				>
					<div className='min-w-0 flex-1'>
						<div className='flex items-center gap-2'>
							<span className='text-cobalt-900 truncate text-sm font-medium'>{d.name}</span>
							<span className='text-smoke font-mono text-[10px] tracking-[0.1em] uppercase'>
								{/* extension or type, e.g. d.type */}
							</span>
						</div>
						<div className='text-smoke mt-1 font-mono text-[11px]'>
							{/* chunks · size · date — exactly the metadata DocumentTable shows in its row */}
						</div>
					</div>
					<button
						type='button'
						aria-label='Delete document'
						onClick={() => onDelete(d.id)}
						className='text-powder-600 hover:bg-terracotta-500/10 hover:text-terracotta-600 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md'
					>
						<svg
							width='14'
							height='14'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='1.8'
						>
							<polyline points='3 6 5 6 21 6' />
							<path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' />
							<path d='M10 11v6M14 11v6' />
							<path d='M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2' />
						</svg>
					</button>
				</div>
			))}
		</div>
	);
}
```

The exact field names inside the card body must match what `DocumentTable` displays — the executor reads the table component to copy the same metadata projection (filename, extension, chunk count, size, upload date, delete handler).

### Step 6.3: Switch table↔cards by viewport in `Documents/index.tsx`

- [ ] Convert page-level inline styles to classes.
- [ ] Replace the single `<DocumentTable …>` render with:

```tsx
<DocumentTable className='hidden desk:block' /* same other props */ />
<DocumentCardList className='desk:hidden' /* same props */ />
```

(`DocumentTable` and `DocumentCardList` both accept `className?: string` and forward it to their root element.) **Or**, if it's cleaner, drive the choice with `useIsMobile()` so only one renders:

```tsx
const isMobile = useIsMobile();
return isMobile ? <DocumentCardList … /> : <DocumentTable … />;
```

The executor picks one approach and uses it consistently. The CSS-driven `hidden desk:block` approach is preferred because it avoids the SSR flash (both components live in the DOM, CSS hides one).

### Step 6.4: `IngestionSettings`

- [ ] Convert inline styles to classes. Outer container: `flex flex-col gap-3 desk:flex-row desk:gap-4 desk:items-end`.

### Step 6.5: Verify and commit

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Run: `npm run dev`. At ≥ 900px, confirm the table renders unchanged. At < 900px, confirm a list of cards appears in its place. Delete a document from each layout to confirm the same handler fires.
- [ ] Commit:

```bash
git add presentation/web/pages/Documents
git commit -m "$(cat <<'EOF'
feat(ui): convert Documents to Tailwind + card list for mobile

DocumentTable keeps its desktop look unchanged at >=900px. Below the
desk: breakpoint a new DocumentCardList renders the same dataset as
stacked cards (filename + metadata + delete) so the layout works at
480px width without a horizontal scrollbar. IngestionSettings stacks
vertically on mobile.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Stats page — Tailwind + responsive grids + sticky table column

**Files:**

- Modify: `presentation/web/pages/Stats/index.tsx`
- Modify: `presentation/web/pages/Stats/MetricCards/index.tsx`
- Modify: `presentation/web/pages/Stats/ChartsRow/index.tsx`
- Modify: `presentation/web/pages/Stats/InsightBar/index.tsx`
- Modify: `presentation/web/pages/Stats/CitationModel/index.tsx`
- Modify: `presentation/web/pages/Stats/QueryLogTable/index.tsx`

### Step 7.1: `MetricCards`

- [ ] Convert. Outer: `grid grid-cols-2 gap-3 desk:grid-cols-4 desk:gap-4`. Each card: `rounded-lg border border-powder-200 bg-paper p-4 desk:p-5 stat-card` (the `stat-card` class is already in `globals.css` for the fade-up animation; keep it).

### Step 7.2: `ChartsRow`

- [ ] Convert. Outer: `flex flex-col gap-4 desk:flex-row desk:gap-6`. Each chart child gets `min-w-0 flex-1` so SVGs shrink correctly inside flex.

### Step 7.3: `InsightBar` and `CitationModel`

- [ ] Convert each. Wrapping container in `Stats/index.tsx`: `grid grid-cols-1 gap-4 desk:grid-cols-2`.

### Step 7.4: `QueryLogTable`

- [ ] Convert. Wrap the table in `<div className="overflow-x-auto">…</div>`. The first `<th>` and first `<td>` per row get class `sticky left-0 bg-paper z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)]`. Header row also keeps its `bg-paper` so the sticky cell doesn't show table content underneath while scrolling.

### Step 7.5: `Stats/index.tsx`

- [ ] Convert top-level wrapper. Header strip: `flex items-center gap-3 border-b border-powder-200 bg-paper px-4 py-4 desk:px-7 desk:py-5 flex-shrink-0`. Burger already in place from Task 3.
- [ ] Body: `flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 desk:px-7 desk:py-6 desk:gap-8`.

### Step 7.6: Verify and commit

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Run: `npm run dev`. Sign in as admin (or stub). At ≥ 900px the layout matches today. At 640px: metric cards 2×2, charts in a column, query-log table scrolls horizontally with the timestamp column staying pinned to the left.
- [ ] Commit:

```bash
git add presentation/web/pages/Stats
git commit -m "$(cat <<'EOF'
feat(ui): convert Stats to Tailwind + responsive grids

Metric cards collapse to 2 cols on mobile (4 on desktop), charts stack
vertically, and the query-log table gets overflow-x-auto with a sticky
first column so timestamps stay visible while scrolling horizontally.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Settings page — merge with in-flight changes + Tailwind

**Files:**

- Modify: `presentation/web/pages/Settings/index.tsx`
- Modify: `presentation/web/pages/Settings/AccountSection.tsx`
- Modify: `presentation/web/pages/Settings/RetrievalSection.tsx`

These three files have **uncommitted modifications** at the start of the migration (see `git status`). Step 8.1 reads the current state of each before rewriting.

### Step 8.1: Read current state of all three files

- [ ] Open each file; note any in-flight changes that diverge from what was reviewed during planning. Carry those changes through into the rewrite — do not blow them away.

### Step 8.2: Rewrite `Settings/index.tsx`

- [ ] Outer: `flex h-full flex-col overflow-hidden bg-paper`.
- [ ] Header strip: `flex flex-shrink-0 items-center gap-3 border-b border-powder-200 px-4 py-4 desk:px-7 desk:py-5`.
- [ ] Title (`Settings`): `font-serif italic text-xl font-light tracking-[-0.01em] text-cobalt-800 desk:text-[22px] m-0`.
- [ ] Subtitle: `mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-smoke`.
- [ ] Header still wraps the burger from Task 3 as the leftmost element — keep it.
- [ ] Scroll area: `flex-1 overflow-y-auto p-5 pb-16 desk:px-12 desk:py-8 desk:pb-20`.
- [ ] Section grid: `mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-5 desk:gap-8 desk:[grid-template-columns:repeat(auto-fit,minmax(380px,1fr))]`.

### Step 8.3: Rewrite `AccountSection.tsx`

- [ ] Convert all inline styles. Section: `id='account' className='scroll-mt-6'`.
- [ ] Header h2: `font-serif italic font-light text-2xl tracking-[-0.01em] text-cobalt-900 m-0 desk:text-[26px]`.
- [ ] Header subtitle: `mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke`.
- [ ] Profile card: `mb-7 flex flex-wrap items-center gap-4 rounded-lg border border-powder-200 bg-paper p-5`.
- [ ] Avatar circle: `flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-cobalt-700 font-serif text-[22px] text-paper`. (When user image present, the `<img>` inside still gets `h-full w-full object-cover`.)
- [ ] Name: `truncate text-[15px] font-medium text-cobalt-900 mb-0.5`.
- [ ] Email: `truncate text-[13px] text-smoke`.
- [ ] Role badge — use `clsx` for the ADMIN/USER variant:

```tsx
<div
	className={clsx(
		'flex-shrink-0 rounded-md border px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] uppercase',
		user.role === 'ADMIN'
			? 'border-terracotta-500/25 bg-terracotta-500/[0.12] text-terracotta-600'
			: 'border-powder-300 bg-sand text-cobalt-700',
	)}
>
	{user.role}
</div>
```

- [ ] Danger zone container: `rounded-lg border border-terracotta-500/35 bg-terracotta-500/[0.04] p-5`.
- [ ] Inner labels & paragraph: same colors as today, expressed as `font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta-600 mb-2`, etc.
- [ ] Email input: `mb-3.5 w-full max-w-[360px] rounded-md border border-powder-300 bg-paper px-3 py-2 text-[13px] text-cobalt-900 outline-none focus:border-cobalt-700 disabled:opacity-50`.
- [ ] Delete button — `clsx` driven by `emailMatches && !deleting`:

```tsx
<button
	className={clsx(
		'font-mono rounded-md border px-4.5 py-2.5 text-[11px] uppercase tracking-[0.12em] transition-colors',
		emailMatches && !deleting
			? 'cursor-pointer border-terracotta-500 bg-terracotta-500 text-paper hover:bg-terracotta-600'
			: 'cursor-not-allowed border-powder-300 bg-powder-200 text-smoke',
	)}
>
```

(Use `px-[18px] py-[9px]` if `px-4.5`/`py-2.5` aren't a perfect match — preserve original spacing exactly.)

- [ ] Error span: `font-mono text-[11px] text-terracotta-600`.

### Step 8.4: Rewrite `RetrievalSection.tsx`

- [ ] Convert. Section: `id='retrieval' className='scroll-mt-6'`. Header h2 / subtitle: same as AccountSection.
- [ ] Outer card: `flex flex-col gap-6 rounded-lg border border-powder-200 bg-paper p-5 desk:p-[22px]`.
- [ ] Strategy grid: `grid grid-cols-1 gap-2 desk:grid-cols-2`.
- [ ] Strategy button — clsx:

```tsx
className={clsx(
	'rounded-md border px-3 py-2.5 text-left transition-colors',
	active
		? 'border-cobalt-800 bg-cobalt-800 text-paper'
		: 'border-powder-300 bg-paper text-cobalt-800 hover:border-cobalt-700',
)}
```

- [ ] Strategy label: `font-mono mb-0.5 text-[11px] uppercase tracking-[0.08em]`.
- [ ] Strategy desc: `text-[11px] ` + `clsx(active ? 'text-paper/70' : 'text-smoke')`.
- [ ] Divider: `h-px bg-powder-200`.
- [ ] Top-K row: `flex flex-wrap gap-2`.
- [ ] Top-K button — clsx, same active/inactive idiom as strategy button.
- [ ] Reranking row: `flex items-center justify-between gap-4 desk:gap-4`.
- [ ] Toggle button (visual switch): `relative h-6 w-11 flex-shrink-0 rounded-full border-none transition-colors` + `clsx(rerankingEnabled ? 'bg-cobalt-800' : 'bg-powder-300')`. Inner thumb: `<span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-paper transition-[left]', rerankingEnabled ? 'left-[22px]' : 'left-0.5')} />`.

### Step 8.5: Verify and commit

- [ ] Run: `npx tsc --noEmit` — expect pass.
- [ ] Run: `npm run dev`. Open `/settings` at ≥ 900px — visual identity check passes. At 480/640px the two sections stack into a single column, the profile card's role badge wraps, the Danger Zone form is full-width, the chunking-strategy grid becomes a single column.
- [ ] Commit:

```bash
git add presentation/web/pages/Settings
git commit -m "$(cat <<'EOF'
feat(ui): convert Settings to Tailwind + responsive layout

Settings/AccountSection/RetrievalSection now express their layout via
utility classes. Section grid collapses to a single column on mobile;
the profile card wraps when the role badge can't fit on one line; the
chunking-strategy buttons go from 2 cols to 1 col below desk:.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Final pass — type check, lint, visual sweep

**Files:** none directly (verification only).

### Step 9.1: Run the full CI script locally

- [ ] Run: `npm run typecheck` — expect pass.
- [ ] Run: `npm run format:check` — expect pass (lint-staged should have kept things formatted, but verify).
- [ ] Run: `npm run lint` — expect pass.
- [ ] Run: `npm run test` — expect existing Vitest suite to remain green (no test files touched in this migration).

### Step 9.2: Visual sweep

- [ ] Run: `npm run dev`. For each viewport width — 480, 640, 800, 1024, 1440 — open every page (`/`, `/documents`, `/stats`, `/settings`, `/signin`) and verify:
  - Desktop ≥ 900px: visually identical to pre-migration screenshots / from memory. No layout shifts. Hover states work.
  - Mobile < 900px: burger appears in each header, opens drawer, drawer slides in/out smoothly, backdrop closes it, Esc closes it, route change closes it. No horizontal page scroll. No clipped text (chips truncate cleanly, role badge wraps cleanly).
- [ ] In DevTools, search the `presentation/web` folder for `style={{` — there should be **only one match left**: the dynamic width inline style in `UploadProgress` (Step 5.5). Any other match is a missed conversion — fix and re-commit.

### Step 9.3: Final cleanup commit (if needed)

- [ ] If Step 9.2 surfaces a missed inline-style or visual regression, fix it and:

```bash
git add <changed files>
git commit -m "fix(ui): residual inline-style cleanup after responsive migration"
```

If nothing needs cleanup, no extra commit is created — Task 9 is verification only.

---

## Self-Review Checklist (executor reads before starting)

- **Spec coverage:** Every spec section maps to a task — §2/§3 → Task 1; §5/§6.1/§6.2 → Tasks 2–3; §6.3 → Task 4; §6.7 (chat-supporting) → Task 4; remaining §6.7 (general components) → Task 5; §6.4 → Task 6; §6.5 → Task 7; §6.6 → Task 8; §8 (verification) → Task 9.
- **No placeholders.** Code blocks contain real classes; commit messages are written; verification steps name commands and expected outcomes.
- **Type consistency.** `mobileOpen` / `openMobile` / `closeMobile` / `toggleMobile` are the only state names used; `useIsMobile()` returns `boolean`; `MobileMenuButton` has no props.
- **`clsx` already installed** (verified in package.json) — no install step.
- **`prettier-plugin-tailwindcss` already installed** — class ordering is automatic; do not hand-sort.
