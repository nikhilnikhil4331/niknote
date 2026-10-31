# NikNote — Sunset Plum redesign

**Branch:** `arena/a239e906-niknote`
**Status:** implemented, typechecked, production-built and tested.
**Live preview:** `npm run preview` is serving the production build on port `4173`.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` | ✅ 0 errors |
| Production build | `npm run build` (sitemap → vite build → prerender) | ✅ built in **33.3 s**, 35 route HTML files prerendered |
| Test suite | `npx vitest run` | ✅ **39 files / 694 tests passed** |
| Route smoke test | `curl` against `vite preview` (`/`, `/money`, `/habits`, `/desktop`, `/admin`, `/login`, `/premium`, `/pdf-editor`, `/blog`) | ✅ all `200` |
| Legacy palette scan | `grep` for `bg|text|border-(indigo|violet|purple|pink|sky|cyan|…)` in `src/**/*.tsx` | ✅ 0 matches |

---

## 1. Palette & tokens (Phase 1)

`src/styles/theme.css` is the single source of truth. Every colour the UI renders is derived from it.

**Core palette**

| Token | Light | Dark | Notes |
| --- | --- | --- | --- |
| `--nk-midnight` | `#1B1931` | `#121020` background | structure, scrims |
| `--nk-purple` | `#44174E` | `#44174E` | deep purple surfaces, gradients |
| `--nk-burgundy` | `#662249` | `#662249` | cards, headings, premium |
| `--nk-rose` | `#A34054` | `#A34054` | primary actions |
| `--nk-amber` | `#ED9E59` | `#ED9E59` | selected highlights, important actions |
| `--nk-blush` | `#E9BCB9` | `#E9BCB9` | soft accents, illustration |

**Semantic tokens** — `--background-primary/secondary/tertiary`, `--surface-primary/secondary/elevated/hover`, `--text-primary/secondary/muted/inverse`, `--border-subtle/active/strong`, `--accent-primary/secondary/rose/warm/cool/cool-solid`, `--success/warning/error/info`, `--focus-ring`, `--paper*` (writing surfaces stay paper-light for legibility and export).

Each token ships as a pair: `--x` (raw hex, for canvas/export JS) and `--x-hsl` (bare `H S% L%` slot). Tailwind consumes the slots:

```css
:root { --primary: var(--primary-hsl); }  /* anything Tailwind reads as hsl(var(--…)) */
```

`tailwind.config.ts` exposes the semantic API: `bg-background{,-primary,…}`, `bg-surface{,…,-hover}`, `text-fg-*`, `border-{subtle,active,strong}`, `bg-primary` + `hover:bg-primary-hover`, `bg-accent-{primary,secondary,rose,warm,cool,cool-solid}`, `bg-nk-*`, `shadow-nk-*`, `bg-nk-{primary,secondary,accent,soft,hero,sheen}`, `duration-nk`, `ease-nk-*`. Core tokens are alpha-aware (`bg-primary/20` works).

**Bug fixed in this pass (build-blocking at runtime):** `theme.css` defined the Tailwind slot names (`--primary`, `--paper`, `--success`, …) as literal hex. Because the legacy bridge in `index.css` lives inside `@layer base`, the unlayered hex definitions won the cascade, so `hsl(#a34054)` was invalid and large areas of the UI would have rendered transparent. The hex values are now `*-hex`, the slot names alias the `-hsl` variables, and a repo-wide audit asserts that **no `hsl(var(--x))` in any CSS/TSX file resolves to a literal colour** (0 offenders).

---

## 2. Signature gradients (Phase 4)

Declared once and consumed through utilities:

| Use | Definition |
| --- | --- |
| Primary | `180deg #ED9E59 0% → #A34054 40% → #662249 72% → #44174E 100%` |
| Secondary | `135deg #1B1931 0% → #44174E 45% → #662249 100%` |
| Accent | `135deg #A34054 0% → #ED9E59 100%` |
| Soft | `135deg #E9BCB9 0% → #ED9E59 100%` |

Utilities: `.nk-gradient-primary|secondary|accent|soft|hero`, `bg-nk-primary|secondary|accent|soft|hero|sheen`, `--nk-grad-*`.
Gradients are used for the editor toolbar CTA, desktop create tile, premium paywall, achievements, habit “streak” moments and nav hero — not on the notes canvas.

---

## 3. Component library (Phase 5)

`src/components/nk/` — 21 files behind `@/components/nk`:

`NKButton`, `NKIconButton`, `NKCard`, `NKGlassCard` (in `NKCard`), `NKInput`, `NKSearch`, `NKDropdown`, `NKModal`, `NKTooltip`, `NKBadge`, `NKProgressBar`, `NKCircularProgress`, `NKNavigation`, `NKSidebar`, `NKToast`/`NKToaster`, `NKSkeleton`, `NKEmptyState`, `NKCalendar`, `NKChart`, `NKFloatingActionButton`.

Conventions: `forwardRef`, `cn()`, `nk-focus-ring`, `motion-safe:`, token-only colours, explicit default / hover / active / focus-visible / disabled (+ `loading`/`aria-busy` on buttons).

**Wired into production screens** (not demo-only):
- `NKToaster` replaces the raw Sonner toaster in `App.tsx` (single app-wide toast surface).
- `NKEmptyState` renders the desktop Home “no notes” state.
- `NKProgressBar` renders the Money budget gauge with tone switching at 70 % / 90 %.
- The full library is also used by the editor workspace chrome.

---

## 4. Screens (Phase 3)

| Area | What changed |
| --- | --- |
| Dashboard / desktop | `DesktopHome/Notes/Tasks/Calendar/Templates/Trash/Shared`, `DesktopShell`, `RightRail`, analytics widgets fully token-bound; empty states, chips, create tiles, folder/cover data arrays on Sunset Plum; active nav = rose wine on a rose tint, amber reserved for highlights. |
| Editor | Toolbar/CTA/selection chrome tokenised (glass now `--nk-glass-bg/-border`, scrims `--nk-scrim`), rose→amber gradient wordmark, focus rings restored on every `outline-none` control, paper canvas stays paper-light with `--paper-foreground` ink. |
| Sidebar / nav | `desktop.css` `--nd-*` vars map to semantic tokens; mobile nav is its own layout (`nn-mobile`), not a shrunken desktop rail. |
| Habit tracker | `habits.css` Daylight + `.nnh-dark` token sets, Sunset Splash illustration (sunset lake, amber sun, plum mountains), fixed 6-week calendar grid with adjacent-month days, contrast-aware check buttons (`readableInk`), streaks/insights charts on palette colours. |
| Money tracker | Cards, budget gauge (`NKProgressBar`), category bars, pie/area charts and account tiles on tokens; success/warning/destructive semantics. |
| Daily tracker / focus | Focus timer category chips, session history and task tags use readable ink on user colours. |
| Search / AI / NikAI | Command palette, quick search and workspace sheets on glass tokens; NikAI gradients moved from `#B845F5/#FF934F/#F266B6` to plum/rose/amber/blush. |
| Handwriting & PDF | Handwriting studio/editor paper tokens unchanged in behaviour; PDF studio chrome tokenised, document page intentionally `#fff`; hover/back controls use `surface-hover`. |
| Settings / profile / auth | New **Appearance** card in `Account`: Light/Dark selection (persisted) + 10 workspace styles, all palette-rebased; `nik-auth-*` gradient (deep purple → rose) and glass form surface tokenised. |
| Premium / payment / admin / notifications | Paywall and pricing popup on brand gradient; admin KPI/activity/error cards on accent tints; toasts themed, dialogs/sheets/drawers use `--nk-scrim`. |
| States | Loading (tokens), error (`ErrorBoundary`), empty (`NKEmptyState`), disabled states via `disabled:opacity-45` + `aria-disabled` where present. |

---

## 5. Theme architecture (Phase 9)

- `public/theme-init.js` (external, CSP-safe) applies the stored theme **before first paint** — no FOUC. Default is Sunset Plum Night.
- `src/hooks/useDarkMode.ts` is the single controller (`localStorage.theme`, `niknote:themechange` event, `color-scheme`, `theme-color` meta), consumed by toasts and toolbars.
- `useUITheme` (`src/utils/uiThemes.ts`) keeps the existing 10-style workspace appearance feature but **re-themes every style onto Sunset Plum** (Sunset Plum glass, Parchment, Blush Soft, Clay Plum, Daylight, Sunset Max, Ink Brutal, Plum Glass, Bento Plum, Midnight Spatial). Only surface texture changes; colour always comes from semantic tokens.
- `src/design-system/tokens.ts` rewritten from the legacy indigo scale to Sunset Plum (palette, gradients, radii, spacing, shadows, motion, chart palette, premium/sidebar tokens) for canvas and export code.
- `src/App.css` and the legacy `.nn-*`, `.ai-*`, `.nik-auth-*`, `.pdfs-*`, `.nd-*`, `.nnh-*` blocks now resolve to the same tokens.

---

## 6. Motion & accessibility (Phases 6 & 8)

- Durations: `--nk-dur-fast|base|slow|slower` = 180 / 220 / 320 / 400 ms with `--nk-ease-out|in-out|spring`; used through `duration-nk`, `.nk-transition*`, component transitions.
- `@media (prefers-reduced-motion: reduce)` neutralises animations, transitions and smooth scrolling globally; interactive components also branch on `useReducedMotion`.
- Focus: global `:focus-visible` outline (2 px `--focus-ring`), `.nk-focus-ring` utility, and every legacy `outline-none` control was given `focus-visible:outline-2 outline-offset-2` with the focus-ring colour.
- **Amber and Soft Blush never carry white text.** New `src/lib/readableInk.ts` picks Midnight Plum or white per fill (AA-checked); used for habit colours, task tags, focus categories, streaks and calendar toggles. Unit-tested in `src/tests/readableInk.test.ts`.
- Measured contrast (WCAG 2.1, worst background in each theme):

| Text token | Light | Dark |
| --- | --- | --- |
| `text-primary` | 15.5:1 | 13.5:1 |
| `text-secondary` | 6.9:1 | 8.3:1 |
| `text-muted` | 5.2:1 | 5.6:1 |
| `accent-rose` | 6.5:1 | 8.6:1 |
| `accent-warm` | 4.7:1 | 6.7:1 |
| `accent-cool` | 7.5:1 | 6.7:1 |
| `primary-foreground` on `primary` | 5.7:1 | 5.6:1 |
| success / warning / error | 4.7 / 4.7 / 6.5 | 8.8 / 7.7 / 6.9 |

`warning`/`accent-warm` in light mode was darkened from `#A65E12` (31 80% 36%) to `#975611` (31 80% 33%) to clear 4.5:1 on hover surfaces.

---

## 7. Responsive (Phase 7)

- Sidebars collapse to icon rails; the mobile experience keeps its own hamburger/FAB navigation instead of squeezing the desktop rail.
- Desktop grid breakpoints (`grid-cols-2 sm:3 xl:4`), truncating cards, fluid charts (`ResponsiveContainer`) and `max-w` modals with internal scroll.
- Touch targets: 40–44 px on mobile controls, `touch-pan-y` on draggable calendar, safe-area padding via `env(safe-area-inset-*)`.
- No new fixed widths were introduced; all new UI (Appearance card, empty state, progress bar) is fluid.

---

## 8. Remaining issues / notes

1. **No browser automation available in this environment** (no Chromium, empty Playwright cache). Visual QA was done through build output, DOM-level tests, CSS/contrast math and route smoke tests. A human pass on iOS Safari + Android Chrome is still recommended before release.
2. **Intentional literal hexes remain in content palettes**, not UI chrome: pen/ink colours (`lib/pdfStudio.ts`, `DrawingTool`, `Board`), highlighter colours, notebook covers, watermark colours and habit category colours. They are document content (like a pen case) and are documented in `src/design-system/tokens.ts`.
3. **Habit tracker theming**: it keeps its own Daylight default with a Night toggle (Profile → Theme) because it is a self-contained phone-frame experience; both directions are Sunset Plum and the choice persists.
4. **Component migration is incremental**: shadcn `Button`/`Card`/`Input` remain alongside the NK library (toasts, empty states and progress already migrated). No duplicate visual styles were introduced — both resolve to the same tokens.
5. **Bundle size warnings** (`>600 kB` chunks) are pre-existing and unrelated to the theme; no new dependencies were added.
6. `--auth-*` (index.css) and `--nd-*`/`--nnh-*`/`--nn-*`/`--pdfs-*` are compatibility aliases pointing at the shared tokens; they are not a second palette.
7. Some analytics data arrays still hold Sunset Plum hex literals (needed for canvas/SVG props); they are palette-correct but not token expressions.

---

## 9. Files

The complete list of the 248 new/modified files, grouped by area, is in [`docs/SUNSET-PLUM-FILES.md`](docs/SUNSET-PLUM-FILES.md). Highlights:

**Foundation**
`src/styles/theme.css`, `tailwind.config.ts`, `src/index.css`, `src/App.css`, `public/theme-init.js`, `index.html`, `src/design-system/tokens.ts`, `src/utils/uiThemes.ts`, `src/hooks/useDarkMode.ts`, `src/lib/readableInk.ts`

**Library**
`src/components/nk/*` (21 files)

**Screens**
`src/pages/*` (31 files incl. `Account.tsx`, `Index.tsx`, `Desktop*.tsx`, `MoneyTracker.tsx`, `PremiumLanding.tsx`, `AdminPanelNikhil.tsx`), `src/components/desktop/*`, `src/components/habits/*`, `src/components/mobile/*`, `src/components/pdf-studio/*`, `src/components/ui/*`

**Tests**
`src/tests/readableInk.test.ts`, `src/tests/themePersistence.test.ts` (new), plus the full existing suite.

---

## 10. How to run

```bash
npm ci                        # PUPPETEER_SKIP_DOWNLOAD=1 if Chrome download fails
npm run dev                   # http://localhost:5173
npm run typecheck
npm run build                 # sitemap + vite build + prerender
npm test
```

Theme check: open **Account → Appearance** and switch Day/Night or a workspace style; the choice survives reload with no flash (applied by `/theme-init.js` before React boots).
