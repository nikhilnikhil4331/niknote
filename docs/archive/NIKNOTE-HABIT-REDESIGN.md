# Niknote Habit — Premium Motion Redesign

Implementation report for the `/habit` experience (October 2026).
This was an in-place upgrade of the existing application — routes, data, auth and cloud sync were preserved.

---

## 1. Audit (completed before changing code)

| Area | Finding |
| --- | --- |
| Framework | Vite 5 + React 18 + TypeScript, Tailwind + shadcn/ui, framer-motion 11, lucide-react, Capacitor 8 |
| Entry point | `src/App.tsx` → lazy `/habit` route → `src/pages/RoutineApp.tsx` → `src/components/habits/RoutineApp.tsx` |
| Navigation | One shell with tabs + pushed views (add/detail/focus/sleep/exercise/calendar/streaks) |
| State | `RoutineProvider` + `src/lib/routineStore.ts` (localStorage per user, `niknote.habits.v1.<userId>`) |
| Rules | Pure helpers in `src/lib/trackers.ts` (streaks, week completion, water, sleep, focus durations, achievements) |
| Backend | Supabase used only for opt-in Backup & Sync and a one-time legacy restore; app works offline |
| Existing tests | 30 Vitest tests in `src/lib/habit-e2e.test.tsx`, bun-style rule tests in `src/lib/*.test.ts` |

Notable pre-existing issues: the bottom bar overlapped pushed screens (40 px padding vs 78 px bar), the focus
timer counted down with a state-only interval (drift after suspension), the "best streak" metric was actually the
current streak, month analytics counted future days, water/labels used inconsistent tokens in dark mode, and habit
metadata could not be edited.

---

## 2. Screens upgraded

- **Onboarding** — real Niknote wordmark, lake/mountain scene, soft ambient drift, page dots, one clear CTA.
- **Home** — personalised header, swipeable selectable week strip, animated progress ring, 2×2 metric cards,
  real per-day habit check-ins, focus banner, tasks, empty state.
- **Habits** — week summary, streak badges, completion control per habit, archiving, empty state.
- **Add Habit** — live preview, templates, category/icon/colour, schedule presets, typed goal, reminder
  time, validation, success feedback.
- **Habit detail** — water glass with real liquid level, quick-add volumes, 14-day history, reminders,
  weekly progress, edit sheet (name/icon/colour/target/days), archive/delete.
- **Insights** — Week/Month ranges, interactive bars with tooltips, 30-day trend line, per-habit completion,
  category breakdown, 5-week consistency heatmap, water/sleep/exercise analytics.
- **Calendar** — month navigation + swipe, per-day completion markers, month summary (past days only),
  selected-day records with check-in, back-to-today.
- **Streaks & Achievements** — current and best-ever streak, milestones (3/7/30), per-habit streaks,
  locked/unlocked achievements from real activity.
- **Profile** — identity, stats, routine links, theme/notifications, motion state, export, backup & sync.
- **Sleep / Exercise / Water / Focus** — consistent design-system surfaces, dark-mode-safe colours, safe spacing.
- **Desktop** — device frame with a dedicated brand column (≥ 1280 px); the same floating capsule stays inside the
  430 px frame, so there is never a second navigation system or a stretched mobile bar.

---

## 3. Components created / modified

**New**
- `src/components/habits/FloatingNav.tsx` — capsule, central FAB, radial fan, task composer, keyboard/safe-area handling.
- `src/lib/navLayout.ts` — pure radial geometry + duplicate-tap gate.
- `src/components/habits/charts.tsx` — `InteractiveBars`, `TrendLine`, `ConsistencyHeatmap`, `ProgressBar`.
- `src/lib/focusClock.ts` — pure timestamp clock helpers.
- `src/lib/habitUpgrade.test.ts` — bun-convention tests for the new pure helpers.
- `NIKNOTE-HABIT-REDESIGN.md` — this report.

**Reworked**
- `src/components/habits/RoutineApp.tsx` — shell, navigation stack, parent-tab mapping, frame, transitions.
- `src/components/habits/habits.css` — full token system (brand palette, surfaces, radii, elevation, nav).
- `RoutineProvider.tsx` — `toggleHabitDone`, future-day guard.
- All twelve screen components; `ui.tsx` (a11y + removal of the old bottom bar).
- `src/lib/trackers.ts` — `bestHabitStreakEver`, `bestStreakHistory`, `completionForDay`, `rangeCompletion`,
  `categoryBreakdown`, `milestoneProgress`.
- `src/lib/motion.ts` — habit motion tokens (`habitMotion`, `habitSpring`, `motionFor`).
- `src/lib/habit-e2e.test.tsx` — updated navigation tests + new interaction/rule coverage.
- `AGENTS.md` — architecture decisions recorded.

---

## 4. Floating navigation 2.0

**Surface.** One warm-white capsule (`--nnh-nav`, 82 % white + 14 px blur), 1 px fine border, soft violet
elevation, 68 px tall (64 px under 360 px wide), inset 10 px above the safe-area inset, max 352 px wide and
never stretched across a desktop viewport (desktop shows the same capsule inside the 430 px device frame).

**Destinations.** Home, Habits, Insights, Profile. Each is a 44 × 48 px minimum target with icon + label,
`aria-current="page"`, a spring-driven shared-layout halo, an icon scale/lift and a tiny dot. While a pushed
screen is open the capsule keeps highlighting its parent tab. Arrow keys / Home / End rove focus between items.

**Central button.** 64 px purple→pink gradient circle lifted 22 px above the capsule, 3 px surface ring,
press compression and a haptic tick. The plus rotates 135° into a close glyph with a 420/26 spring.

**Radial quick actions.** A compact fan of up to five 48 px bubbles (core radius 116 px, 106 px under 400 px,
96 px under 360 px) at −64°, −32°, 0°, +32°, +64°:
Add Habit · Add Task · Log Activity · Focus Timer · Log Water (only when a water habit exists).
Geometry comes from the pure `radialLayout()` helper; each bubble springs out from the FAB centre with a
28 ms stagger, a soft radial glow widens behind them, and the capsule picks up a slightly stronger shadow.
Labels sit under each bubble (9.5 px, two-line wrap, 60 px column; 9 px under 360 px), nudged downward for the
centre action so the fan stays legible at 320 px without crowding neighbouring bubbles.

**Wiring (all real actions).** Add Habit → add screen, Add Task → task composer, Log Activity → exercise
tracker, Focus Timer → focus screen, Log Water → immediate logged glass + toast. Selecting any action closes
the menu; so do the scrim, Escape, a capsule destination, and a resize/orientation change.

**Keyboard / a11y.** `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`; focus moves to the first action
on open; Arrow/Home/End cycle; Escape closes and returns focus to the FAB; Tab closes and lets focus continue.
The scrim is `tabIndex={-1}` so it never traps focus behind the menu. All quick actions are ≥48 px.

**Duplicate-tap protection.** `createActionGate(320)` rejects a repeated quick action inside 320 ms, the task
composer uses a saving latch, and the menu unmounts synchronously on selection so a second tap cannot queue
another action.

**History.** Tabs are roots, pushed screens form a `View[]` stack (Back/TopBar pops one level, a tab press
clears the stack), and each push writes one reversible `history.pushState` entry so Android/browser back walks
the same stack instead of leaving the app. Back with a menu or dialog open closes the overlay first.

**Keyboard / system.** The whole bar hides (`aria-hidden`, slid down) while a soft keyboard is open and returns
when it closes; the task sheet is pinned with `calc(12px + safe-area-inset-bottom)`; scrolling uses
`overscroll-contain`; `touch-action: manipulation` removes the 300 ms tap delay without blocking vertical scroll.

**Small screens.** Verified structurally (radius, widths and label sizes adapt at 400 px and 360 px breakpoints);
see §8 for the visual-QA limitation.

## 5. Motion & interaction

- Motion tokens: 120–340 ms, Apple-like `[0.22, 1, 0.36, 1]` easing and controlled springs.
- Page transitions: short directional slide + opacity + micro-scale; reduced motion collapses to a fade.
- Habit completion: check spring, ring/bar animation, count-up, light haptic, single confetti burst; reopening is
  quiet. A per-provider 450 ms throttle (`celebrate`) makes sure a completion burst and an achievement-unlock
  burst triggered by the same tap never both fire.
- Calendar day card crossfades on selection instead of waiting for the previous card to exit, so the records for
  the tapped day appear immediately.
- Water: spring-driven level, travelling waves, bubbles, splash; level always reflects logged intake.
- Focus: ring derived from a wall-clock timestamp, subtle pulse only while running.
- Charts: staggered grow-in, tooltip on hover/focus/tap, animated trend path, heatmap stagger.
- All decorative CSS animations and the new motion components honour `prefers-reduced-motion`.
- Safe areas: top inset on the scroll area, bottom inset on the nav/sheets; content gets a 112 px nav spacer everywhere.

---

## 6. Data, auth and backend preserved

- Same `/habit` route, same lazy entry, same `AuthContext`, guest auto-sign-in and offline banner.
- Same localStorage schema/version — existing users keep their habits, entries, todos, focus sessions and theme.
- Same Supabase backup/restore paths and tables; no new network dependency in the daily loop.
- Seed data is unchanged (first run still demonstrates charts/streaks).
- Completion is keyed `habitId|day`; analytics count one slot per scheduled habit/day; future days are rejected.

---

## 7. Tests executed

- `npm test` (Vitest + Testing Library): **55 passed / 55**, 1 file.
  Coverage includes: guest/offline behaviour, habit create/validate/archive/delete/rename, persistence and
  migration, water/sleep/exercise logging, focus start/pause/resume/reset/skip, single session recording,
  mode/custom durations, floating-nav routing, quick-action open/close (Escape, scrim, navigation),
  logging water, adding a task, home completion toggle, previous-day selection, insights range/chart interaction,
  theme persistence, and the new pure-rule tests (best streak, range completion, category breakdown,
  milestones, timestamp clock).
- Navigation 2.0 coverage: radial geometry (angles, symmetry, radius, single/empty menus), duplicate-tap gating,
  every quick action (Add Habit, Add Task, Log Activity → real Exercise screen, Log Water → persisted glass),
  Escape/scrim/tab dismissal, focus restore to the FAB, arrow-key movement, double-tap performs water once,
  history stack pop from a pushed screen, and parent-tab highlighting.
- Dashboard/interaction coverage added last: one celebration burst per check-in (and none on reopen), and
  calendar check-ins locked for future days (55 tests total).
- `npx tsc --noEmit -p tsconfig.app.json`: **clean**.
- `npm run build`: **success** (≈20 s; only the existing >600 kB vendor-chunk advisory).
- `npx eslint src/components/habits …`: 15 errors remain, all pre-existing `any`/empty-block findings inside
  `RoutineProvider`'s Supabase sync code; no new lint errors in the redesigned screens.
- Dev server compiles `/habit` and all changed modules with HTTP 200 (`vite` on port 8080).

Not run: `bun test` (bun is not installed in this environment; the equivalent assertions run under Vitest),
and pixel/screenshot QA (see limitations).

---

## 8. Known limitations (honest disclosure)

- **Reminders** are stored per habit and can be edited; the web build does not schedule OS notifications.
  Native local-notification scheduling is not implemented.
- **Haptics** work through Capacitor on native builds and `navigator.vibrate` where supported; browsers that
  block vibration silently no-op.
- **Backup & Sync** remains manual/one-way as before; the app never blocks on the network.
- Sheets support scrim/close/Escape; drag-to-dismiss and habit drag-reordering were not added (reordering did
  not exist previously).
- **Reference image mismatch (blocker, reported):** the only image attached in this session
  (`NIKNOTE-AUDIT-DASHBOARD.png`) is a dark audit/analytics dashboard. It contains no circular bottom
  navigation or gradient FAB, so the navigation was built from the written specification and the earlier
  reference description rather than traced against a screenshot.
- No visual regression screenshots were captured: the sandbox has no Chrome/Firefox binary and the headless
  Chromium download is blocked; system libraries (`libnspr4`, `libnss3`) are unavailable without root. Visual
  verification therefore consisted of component rendering/DOM assertions and a running dev server, not pixel review.
- Analytics use only stored records; sleep totals can come from manually entered bed/wake times (existing behaviour).
- Focus "Skip" records a session immediately (preserved from the existing test contract); a future refinement
  would require a minimum elapsed time.

## 9. Remaining work

0. Navigation polish left: the fan closes instantly on selection (chosen for responsiveness over a fade-out),
   no drag-to-open gesture, and no per-device visual pass on 320/360 px hardware.
1. Real browser E2E (Playwright) + screenshot regression in CI.
2. Native local notifications and a quiet-hours setting.
3. Drag-to-dismiss sheets and optional habit reordering.
4. Optional widgets/shortcuts and CSV export alongside JSON.
5. Replace the remaining legacy `any` typings in the Supabase sync path.
