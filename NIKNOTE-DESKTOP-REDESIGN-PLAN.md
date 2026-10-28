# NIKNOTE — Master Redesign: Audit & Implementation Plan

_Date: 2026-10-28 · Branch: `arena/a742bb6d-niknote` · Reference: supplied dashboard mockup (purple/magenta/pink/orange)_

This document is the Stage-1 audit required by the master prompt. It records what
actually exists in the repository today, what the redesign must add, and the exact
staged plan followed during implementation. Every claim below was verified against
source, not guessed.

---

## 1. Existing architecture (verified)

| Area | Reality in repo |
|---|---|
| Stack | Vite 5 + React 18 + TypeScript, Tailwind 3 + shadcn/Radix, framer-motion 11, recharts 2.15, react-router 7, Supabase (auth+DB), Capacitor 8 (Android). |
| Entry | `src/App.tsx` — desktop routes render the **Desktop workspace** (`pages/Desktop*.tsx` inside `components/desktop/DesktopShell.tsx`); mobile renders `MobileExperience`. Editor opens at `/?editor=1` (`pages/Index.tsx`). |
| Desktop pages | `/` Home, `/notebooks` (+`/notes`), `/templates`, `/calendar`, `/tasks`, `/trash`, `/shared`. **No `/focus` route exists.** |
| Desktop data | Notes: `useDesktopNotes()` (`components/desktop/notes.ts`) merges Supabase `notebooks`/`pages` (cloud) with device localStorage notes (guest) — full CRUD, trash/restore, open-in-editor handoff identical to mobile. Tasks/habits/spaces/note-meta: localStorage stores in `components/desktop/store.ts` with cross-component sync events (deliberate: works for guest AND cloud users without schema changes). |
| Editor | Block editor + handwriting (fabric.js), autosave, PDF studio, OCR (tesseract). Mobile/desktop share the same handoff (`niknote-mobile-open` sessionStorage). Not touched by this redesign. |
| Focus timer | Exists **only** inside the mobile `/habit` app (`components/habits/screens/FocusTimer.tsx`), already timestamp-based per `src/lib/focusClock.ts` (project rule in AGENTS.md). No desktop timer. |
| `SemiCircularDial` | A radial quick-nav fan menu (Home/Money pages) — **not** a timer dial. Must not break it. |
| Charts | recharts present; used by MoneyTracker/RoutineTracker/Admin. Desktop has **zero** analytics charts today. |
| Search | `CommandPalette` (Ctrl+K) in DesktopShell — real navigation/actions. |
| Streaks | `useStreak` (Supabase `user_streaks`, cloud) + local streak computation for guests. |
| Tests | vitest + jsdom; **pure helpers in `src/lib` with tests beside them** is the documented project convention (AGENTS.md). |
| Fonts | Inter, Plus Jakarta Sans, Caveat, Kalam already loaded in `index.html` — handwritten note previews are already styled with Caveat (`desktop.css .nd-paper`). |
| Banner asset | `public/images/home-banner.jpg` exists (used on current Home). |

## 2. Gaps vs the reference mockup / master prompt

1. **No desktop Focus Timer** — no route, no sidebar entry, no circular dial, no stopwatch/laps, no focus-session recording on desktop.
2. **No right rail** on Home (mockup shows timer + today's tasks + habit rings + mini calendar stacked on the right).
3. **No Productivity analytics** (KPI cards, weekly chart, focus-distribution donut) on desktop.
4. Home notes area is "Recently Opened" only — mockup wants a **My Notes** section (tabs: All/Pinned/Recent/Favorites/Shared, search, grid/list, folder strip, create tile).
5. Quick actions lack **Quick Note** and **New Task**; banner is small, not the scenic full-width hero.
6. `NoteMeta` has `fav` but no `pinned`; `NikTask` lacks optional `tag`/`time` shown in the mockup.
7. Sidebar: no Focus Timer entry, no Premium upsell card (mockup shows one).

## 3. Non-negotiables carried into implementation

- Preserve mobile experience, editor, PDF studio, auth, guest mode, pricing, habit app.
- Desktop stores stay localStorage-based (guest parity) — no Supabase schema change.
- Timer math stays **timestamp-based** (AGENTS.md rule); dial angle math and analytics aggregations live as **pure helpers in `src/lib` with vitest tests**.
- No fabricated stats: every KPI/graph renders only from saved notes/tasks/habits/focus sessions; empty states when no data.
- Reduced-motion + keyboard access on every new interaction; `touch-action:none` on the dial.

## 4. Staged implementation plan

| Stage | Deliverable | Files |
|---|---|---|
| B | Brand design tokens + new CSS | `components/desktop/desktop.css` (+tailwind untouched) |
| C | Pure logic + tests: dial geometry, stopwatch, productivity aggregations | `src/lib/dialMath.ts`, `src/lib/stopwatch.ts`, `src/lib/productivity.ts` + `*.test.ts` |
| D | Store extensions: `pinned`, task `tag`/`time`, focus sessions, timer settings/session persistence | `components/desktop/store.ts` |
| E | Draggable circular dial (pointer/touch/keyboard, wraparound-safe) | `components/desktop/focus/CircularDial.tsx` |
| F | Pomodoro / Timer / Stopwatch panel (shared by rail & `/focus`), completion sound behind setting | `components/desktop/focus/FocusTimerPanel.tsx` |
| G | Home redesign: hero banner, 7 quick actions, My Notes tabs, folder strip, right rail | `pages/DesktopHome.tsx`, `components/desktop/RightRail.tsx`, `MiniMonthCalendar` |
| H | Analytics: KPI cards, weekly chart (recharts), focus donut — all from real stores | `components/desktop/analytics/*` |
| I | Sidebar `/focus` entry + Premium card; new `pages/DesktopFocus.tsx` + route | `DesktopShell.tsx`, `App.tsx` |
| J | QA: typecheck, lint, vitest, production build, visual screenshots (puppeteer available) | repo tooling |

## 5. Verification checklist (run after implementation)

- [ ] Dial drag changes the same duration state as preset buttons + custom input (incl. crossing 12 o'clock without jumps).
- [ ] Countdown accurate across background tabs (timestamp-derived).
- [ ] Stopwatch laps correct; sessions saved once.
- [ ] Notes/tasks/habits survive refresh; graphs update after recording a real session.
- [ ] `npm run typecheck`, `npm run lint` (no new errors), `npm run test`, `npm run build` all pass.
- [ ] Existing desktop pages (`/notebooks`, `/tasks`, `/calendar`…) unchanged in behaviour.
