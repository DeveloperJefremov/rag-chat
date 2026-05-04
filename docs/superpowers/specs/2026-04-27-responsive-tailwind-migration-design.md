# Responsive UI + Tailwind Migration — Design

**Date:** 2026-04-27
**Scope:** Make the entire RAG Chat web UI adaptive for screens ≥ 480px while preserving the current desktop appearance unchanged at ≥ 900px. As a prerequisite, fully migrate the presentation layer from inline `style={{}}` props to Tailwind utility classes.

---

## 1. Goals & Non-Goals

### Goals

- Single responsive layout that works from 480px viewport width up.
- Desktop appearance at ≥ 900px must be visually identical to today.
- Eliminate inline styles (`style={{ … }}`) from `presentation/web/**`. UI is expressed via Tailwind utility classes.
- Replace `onMouseEnter`/`onMouseLeave` hover hacks with Tailwind `hover:` variants.
- Off-canvas sidebar drawer on `< 900px`, opened by a burger button in each page header.

### Non-Goals

- No phone-only layout below 480px.
- No dark-mode work (existing `.dark` block stays untouched).
- No rewrite of shadcn primitives (already Tailwind).
- No new pages, no new features, no behavioral/business-logic changes.
- No new design tokens beyond what is needed to expose the existing palette to Tailwind.

---

## 2. Breakpoint Strategy

One custom breakpoint: **`desk` = 900px**.

- `< 900px` → mobile/tablet layout (drawer sidebar, stacked grids, card lists).
- `≥ 900px` → today's desktop layout, untouched.
- Mobile-first: base classes describe the mobile state, `desk:` modifiers describe desktop.

Tailwind v4 `@theme` declaration:

```css
@theme inline {
	--breakpoint-desk: 900px;
}
```

The default `sm`/`md`/`lg`/`xl` breakpoints remain available but are not used by this project.

---

## 3. Design Tokens → Tailwind Theme

The palette currently lives in `:root` as bare CSS variables, so Tailwind cannot generate utilities for them. Move palette tokens into `@theme inline` so v4 generates `bg-cobalt-800`, `text-powder-300`, `border-terracotta-500/35`, `font-serif`, `font-mono`, `animate-pulse-dot`, etc., automatically.

```css
@theme inline {
	/* colors */
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

	/* fonts */
	--font-serif: var(--font-fraunces);
	--font-mono: var(--font-jetbrains-mono);

	/* animations (keyframes stay in @keyframes blocks below) */
	--animate-pulse-dot: pulse-dot 2.5s ease-in-out infinite;
	--animate-fade-up: fade-up 0.35s ease both;
	--animate-slide-in: slide-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;

	/* breakpoint */
	--breakpoint-desk: 900px;
}
```

`:root` keeps the shadcn base tokens (`--background`, `--primary`, etc.). The `--cobalt-*` style variables are removed from `:root` since `@theme inline` already exposes them as CSS vars too.

---

## 4. Inline → Tailwind Conversion Rules

| Inline pattern                                                                   | Tailwind replacement                                                                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `style={{ background: 'var(--cobalt-800)' }}`                                    | `bg-cobalt-800`                                                                                                                        |
| `style={{ color: 'var(--powder-300)' }}`                                         | `text-powder-300`                                                                                                                      |
| `onMouseEnter`/`onMouseLeave` setting `background`                               | `hover:bg-cobalt-800`                                                                                                                  |
| `style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}` (`MONO` const) | `font-mono`                                                                                                                            |
| `style={{ fontFamily: 'var(--font-fraunces), serif' }}` (`SERIF` const)          | `font-serif`                                                                                                                           |
| Conditional active/open `background` set in JS                                   | `clsx('…', isActive && 'bg-cobalt-800 border-l-2 border-terracotta-500')`                                                              |
| `animation: 'pulse-dot …'`                                                       | `animate-pulse-dot`                                                                                                                    |
| `WebkitLineClamp: 2` + `WebkitBoxOrient: 'vertical'`                             | `line-clamp-2`                                                                                                                         |
| `style={{ scrollMarginTop: 24 }}`                                                | `scroll-mt-6`                                                                                                                          |
| Inline SVG with `stroke='currentColor'`                                          | unchanged; color flows from `text-…` on a parent                                                                                       |
| Numeric pixel paddings/margins                                                   | nearest Tailwind token (`p-3`, `px-5`, `gap-2`, `gap-2.5`, etc.); arbitrary values like `px-[14px]` allowed only when no token matches |

Add `clsx` (already a small dep) for conditional class composition. `tailwind-merge` is **not** added — Tailwind v4 deduplicates utilities itself, and the codebase doesn't compose classes deep enough to need it.

The `MONO` and `SERIF` `React.CSSProperties` constants are deleted.

---

## 5. Architectural Changes

### 5.1 Sidebar Drawer

A new piece of UI state controls drawer visibility.

- Extend the existing `client/stores/sidebarStore.ts` with `mobileOpen: boolean`, `openMobile()`, `closeMobile()`, `toggleMobile()`. (No new store file — the existing one already handles sidebar concerns like `todayStats`.)
- `Sidebar` component:
  - Wrapper `<aside>` becomes `fixed inset-y-0 left-0 z-40 w-[280px] -translate-x-full transition-transform duration-200 ease-out desk:static desk:w-[260px] desk:translate-x-0 desk:flex-shrink-0`.
  - Adds `data-open={mobileOpen}` and a Tailwind variant `data-[open=true]:translate-x-0` to slide in.
  - Adds an `×` close button next to the logo, visible only `desk:hidden`.
- Backdrop: a sibling `<button aria-label="Close sidebar" />` rendered when `mobileOpen` is true on `< 900px`. `fixed inset-0 z-30 bg-cobalt-950/40 desk:hidden`. Click closes the drawer.
- Closing triggers: backdrop click, `Esc` key, route change (subscribed via `usePathname` effect that calls `closeMobile()`).

### 5.2 Burger Button Per Page Header

Each page (Chat, Documents, Stats, Settings) gets a burger at the start of its header strip:

```tsx
<button type='button' aria-label='Open sidebar' onClick={openMobile} className='desk:hidden …'>
	<svg>{/* burger */}</svg>
</button>
```

Hidden on desktop (`desk:hidden`), so desktop appearance is unchanged.

### 5.3 `useIsMobile()` Hook (Optional, JS-Only Path)

Where layout differences require **different DOM** (not just different classes), we use a JS hook backed by `matchMedia('(max-width: 899.98px)')`. The hook lives at `client/hooks/useIsMobile.ts` and returns `boolean`.

Used by:

- `presentation/web/pages/Documents/index.tsx` — picks `<DocumentTable />` vs `<DocumentCardList />`.

Pure CSS-driven differences (paddings, grids, flex direction) do **not** use the hook — they use `desk:` modifiers.

---

## 6. Per-Area Adaptations

### 6.1 `app/(app)/layout.tsx`

```tsx
<>
	<Sidebar />
	<main className='flex-1 overflow-hidden'>{children}</main>
</>
```

The structural markup stays. The `flex` is on `<body>` in `app/layout.tsx` and remains. Sidebar's own `fixed`/`static` switch handles drawer behavior — this file has no inline styles today, so no conversion is required. The only addition (if any) is mounting the backdrop element next to the sidebar; the backdrop can also live inside `Sidebar` itself, which is preferred so the layout stays untouched.

### 6.2 Sidebar (`presentation/web/layout/Sidebar/index.tsx`)

- Convert all inline styles to Tailwind classes. Functionality unchanged.
- Add drawer behavior described in §5.1.
- Width: `w-[280px] desk:w-[260px]`.
- Hover states (`onMouseEnter`/`onMouseLeave`) → `hover:` classes.
- `UserMenu` popover: `bottom-[calc(100%+8px)] left-0 right-0 absolute …`.

### 6.3 Chat (`presentation/web/pages/Chat/index.tsx`)

Header strip becomes wrap-friendly:

- Outer flex: `flex flex-wrap items-center justify-between gap-3 px-4 py-3 desk:px-6 desk:py-3.5`.
- Left cluster (logo + `AttachmentChips` + "Add from library"): `flex flex-wrap items-center gap-3 min-w-0`.
- Right cluster (`LimitBadge` + sources count): on `< 900px` it wraps below the left cluster naturally.
- `AttachmentChips`: each chip gets `max-w-[160px] truncate desk:max-w-none`.
- Empty state: `p-6 desk:p-10`, headline `text-xl desk:text-2xl`.
- `MessageList`: container `px-3 py-4 desk:px-6 desk:py-6`. Bubble width `max-w-[88%] desk:max-w-[720px]`.
- `MessageInput`: outer padding `p-3 desk:p-4`. Textarea `text-sm` everywhere.
- `AdvancedControls`: stacks vertically with `flex-col gap-3 desk:flex-row desk:gap-4`. No fixed positioning, no bottom sheet — it is rendered inline with the page and simply re-flows on narrow screens.

### 6.4 Documents (`presentation/web/pages/Documents`)

- `Documents/index.tsx` reads `useIsMobile()` and renders either `DocumentTable` (existing) or a new `DocumentCardList` component, both fed from the same data props.
- `DocumentCardList` (new file: `presentation/web/pages/Documents/DocumentCardList/index.tsx`):
  - List of cards, gap-2.
  - Each card: `flex items-start gap-3 rounded-lg border border-powder-200 bg-paper p-4`.
  - Top row: filename (truncate) + extension badge.
  - Sub-row: `text-xs text-smoke font-mono` — chunks · size · uploaded date.
  - Trailing column: delete button (same handler as table row).
- `IngestionSettings` panel: stacked layout with `flex-col gap-3 desk:flex-row desk:gap-4`.

### 6.5 Stats (`presentation/web/pages/Stats`)

- `MetricCards`: `grid grid-cols-2 gap-3 desk:grid-cols-4 desk:gap-4`.
- `ChartsRow`: `flex flex-col gap-4 desk:flex-row desk:gap-6`. Each chart child `min-w-0` so SVGs shrink correctly.
- `InsightBar` + `CitationModel`: wrapping container `grid grid-cols-1 gap-4 desk:grid-cols-2`.
- `QueryLogTable`: wrap in `overflow-x-auto`. First column (timestamp) gets `sticky left-0 bg-paper z-10` plus a subtle right shadow when scrolled (`shadow-[2px_0_4px_rgba(0,0,0,0.04)]`).

### 6.6 Settings (`presentation/web/pages/Settings`)

- `Settings/index.tsx` outer scroll area: `flex-1 overflow-y-auto p-5 pb-16 desk:px-12 desk:py-8 desk:pb-20`.
- Section grid: `grid grid-cols-1 gap-5 desk:gap-8 desk:[grid-template-columns:repeat(auto-fit,minmax(380px,1fr))] mx-auto max-w-[1400px]`.
- Header padding `px-4 py-4 desk:px-7 desk:py-5`.
- `AccountSection` profile card: `flex flex-wrap items-center gap-4`. Role badge wraps to its own line on narrow screens.
- `RetrievalSection` form rows: `flex flex-col gap-2 desk:flex-row desk:items-center desk:gap-4` per setting row.

### 6.7 Other Components

The following also lose inline styles and gain responsive classes where needed:

- `presentation/web/components/MessageInput` — described in §6.3.
- `presentation/web/components/MessageList` — described in §6.3.
- `presentation/web/components/LimitBadge` — class-only.
- `presentation/web/components/FileDropzone` — `min-h-[120px] desk:min-h-[160px]`, dashed border via `border-dashed border-powder-300`.
- `presentation/web/components/UploadProgress` — class-only.
- `presentation/web/components/CitationList` — class-only.
- `presentation/web/components/ConfirmDialog` — class-only; dialog body width `max-w-[min(420px,calc(100vw-32px))]`.
- `presentation/web/components/Aurora` — class-only (mostly canvas/positioning, no real changes).
- `presentation/web/pages/Chat/AttachmentChips` — described in §6.3.
- `presentation/web/pages/Chat/AddFromLibraryDialog` — dialog uses the same width clamp as `ConfirmDialog`.
- `presentation/web/pages/Chat/KnowledgePanel` — class-only.
- `presentation/web/pages/Chat/AdvancedControls` — described in §6.3.
- `presentation/web/pages/Documents/DocumentTable` — class-only (table itself stays desktop; mobile uses cards).
- `presentation/web/pages/Documents/IngestionSettings` — described in §6.4.
- `presentation/web/pages/Stats/*` — described in §6.5.

---

## 7. Migration Order (One Commit Per Step)

1. **Theme + deps:** add tokens to `@theme`, install `clsx`, add `useIsMobile` hook. `npx tsc --noEmit` clean.
2. **Layout + Sidebar drawer:** extend `sidebarStore`, convert `Sidebar` to Tailwind, add drawer behavior, add burger placeholder hook in pages. Verify desktop unchanged.
3. **Chat page:** convert Chat + AttachmentChips + MessageList + MessageInput.
4. **Documents page:** convert DocumentTable, add DocumentCardList, wire `useIsMobile`.
5. **Stats page:** convert MetricCards, ChartsRow, InsightBar, CitationModel, QueryLogTable (with sticky column).
6. **Settings page:** merge with the in-flight uncommitted changes, then convert AccountSection, RetrievalSection, Settings index.
7. **Remaining components:** LimitBadge, FileDropzone, UploadProgress, CitationList, ConfirmDialog, Aurora, AddFromLibraryDialog, KnowledgePanel, AdvancedControls, IngestionSettings.

Each step:

- Runs `npx tsc --noEmit` before commit.
- Visually verified at viewport widths 480, 640, 800 (mobile range) and ≥ 1024 (desktop, no regressions).

---

## 8. Verification

- **Type-check:** `npx tsc --noEmit` after every step.
- **Visual:** `npm run dev`, manually open `/`, `/documents`, `/stats`, `/settings`, `/signin`. Test desktop (≥ 900px) and three mobile viewports (480, 640, 800).
- **Drawer behavior:** burger opens, backdrop closes, Esc closes, route change closes, focus is not trapped (no modal semantics needed — a drawer is not a modal here).
- **Existing Vitest suite:** `npx vitest run` should remain green; tests do not assert on classes or layout, so no test edits expected.
- No new tests added — visual/responsive correctness is verified manually.

---

## 9. Risks & Decisions

- **Tailwind v4 token exposure.** Moving `--cobalt-*` from `:root` into `@theme` is the v4-idiomatic way; this is what enables `bg-cobalt-800` to exist without registering anything in a config file. There is no `tailwind.config.js` step.
- **Hover on touch devices.** `hover:` classes apply to "any hover-capable" pointer in modern browsers; touch tap behaves correctly (no sticky hover) thanks to Tailwind's `(hover: hover)` media-query gate.
- **Drawer is not a modal.** Intentional — we don't want focus trap, scroll lock can be limited to backdrop. Keeps the implementation small. If accessibility review later requires a true dialog, that's a follow-up.
- **`useIsMobile` SSR.** First render returns `false` to match server (desktop default). On mount, the hook syncs to `matchMedia`. There may be a one-frame flash on mobile of the desktop variant for `Documents`. Acceptable; documented here.
- **In-flight Settings changes.** Three Settings files have uncommitted modifications. Step 6 must rebase its work on whatever state those files end up in — do not blow away the work in progress.

---

## 10. Out of Scope (YAGNI)

- Dark mode.
- Phone layout < 480px.
- Rewriting shadcn primitives.
- Additional breakpoints beyond `desk: 900px`.
- A formal a11y/focus-trap pass on the drawer.
- Storybook or visual regression tests.
