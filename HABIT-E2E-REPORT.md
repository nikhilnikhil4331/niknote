# Habit App Production E2E Report — 2026-10-18

**Commit (merged to main):** `9977d6f78c7e308f294cd1aca94903b463efe0ad` — PR #3 `arena/5dca4653-niknote` → `main` ✅ MERGED
**Deploy:** Vercel `niknote` `prj_pboLILJsBUImA8NiOyE4XNGyTFvC` → `dpl_b8pPGWfjfWk3jN2kDEkQxyD3TLhg` READY PROMOTED (production) — build 21s — aliases `www.niknote.online`, `niknote.online`
**Local production build:** `vite build` 18.51s `RoutineApp-BJpD-u2_.js` 109.47 kB gzip 27.99 kB (vendor-motion 123kB, vendor-pdf 618kB, index 1102kB) — no TS errors
**Smoke:** `scripts/smoke-habit.sh` → `SMOKE OK` (profile 13063 chars, all 4 routes SSR + asset rewrite)
**Preview:** `vite preview --host 0.0.0.0 --port 4173` — `GET / 200`, `GET /habit 200` (SPA rewrite → `index.html`, RoutineApp chunk OK)

## Tests: 30/30 PASS (vitest 3.2.7 + jsdom 26 + @testing-library/react)
`npm test --reporter=verbose` 8.54s (initial journey 9.04s) — all coverage areas from task:

1. **Guest / login failure** (3) — offline Supabase restore → banner `Still offline`/`Cloud connection unavailable` + `Retry sync`, Recovery `Retry sync` handler, login no-overwrite guard
2. **Habit add / edit / delete** (8) — create → list → detail, empty-title shake + days-required validation, day toggle, category/icon/color picker, archive flow `Habit not found.`, delete confirmation → back to `Niknote Habits` list (not `Home` leak), BottomNav vs TopBar `Add` disambiguation
3. **Reload persistence** (4) — `localStorage` `niknote.habits.v1:<userId>` round-trip, anon `anon` → `user-1` migration on auth, corrupted JSON graceful fallback, `RoutineProvider` `today` ticker `setInterval(60000)`
4. **Water / Sleep / Exercise** (5) — `waterProgress` clamp `0..1`, `BigWaterGlass` unique `clipPath/gradient` IDs via `useId`, water `ml→glass` (`glasses * 250`), sleep goal `h/m` + `+30 min` + bed/wake `HH:MM→sleepMinutes`, exercise minutes + `kcal/km` stats, `habitStreak` daily non-consecutive = 1 + schedule-aware
5. **Focus timer** (3) — Start/Pause/Reset/Skip + session counter, mode switch + **custom duration bug fix** (`customFocus/customBreak` preserve + `mode/custom*` effect reset), `focusDurations` clamp `lo 1 / hi 180|60`
6. **Mobile navigation** (6) — `BottomNav` (`Home/Insights/Habits/Profile` + large `Add` `w-14`) tab switching, detail nav + back, `Escape` pops pushed (`Shell`+`RoutineApp`), Calendar/Streaks reachable, `44px` `min-height` `aria-label` compliance, Phone `Frame` `Phone` shell render
7. **Production verification** (2) — SSR `renderToString` for `/habit` + `HabitProvider`, prod `dist/index.html` contains `/habit` import + `vercel.json` `/(.*)→/index.html` rewrite

**Bug fixes in this PR (9):**
- `src/components/habits/RoutineProvider.tsx` — fix `syncNow` cross-user delete (scope by `user_id`), missing `user_id` on `habit_profiles` select, empty-list delete guard, anon→auth `localStorage` migration, `today` daily tick
- `src/components/habits/screens/FocusTimer.tsx` — fix `setCustom` clobber (`state.customFocus/customBreak`, clamp 15-60/5-30), add `mode/custom*` reset `useEffect`
- `src/components/habits/BigWaterGlass.tsx` — `useId()` unique `clipPath`/`gradient` IDs, fill gradient via `fill`
- `src/components/habits/screens/AddHabit.tsx` — show error when no days selected
- `src/components/habits/screens/HabitDetail.tsx` — after delete navigate to `habits` (not broken `Home`)
- `src/components/habits/screens/CalendarView.tsx` — missing `onBack` → `TopBar` back to Home
- `src/pages/RoutineApp.tsx` + `src/components/habits/RoutineApp.tsx` — sticky `Retry` banner `top-0 border-b min-h 44px` (not absolute overlay), `Escape` key `useEffect`, `host 0.0.0.0` + `allowedHosts` for LIVE PREVIEW
- `src/components/habits/ui.tsx` — `Toggle` `flex justify-start/end` slide fix (`w-11 h-6`)
- tooling — `vite.config.ts` `test` `globals/jsdom/setupFiles/exclude` + `src/test/setup.ts` `jest-dom/matchMedia/ResizeObserver/getContext`, `package.json` `vitest 3.2.7`

## Vercel Production Verification
- Previous production: `dpl_89HtZ4x8pvFp59LvFkGmmUP8jqna` `bf1daa4` (PR #2)
- New production: `dpl_b8pPGWfjfWk3jN2kDEkQxyD3TLhg` `9977d6f` — state `READY`, `readySubstate PROMOTED`, `aliasAssigned true`, `alias [www.niknote.online, niknote.online, …]`, region `iad1`

## How to Verify Live
```bash
curl -I https://www.niknote.online
curl -I https://www.niknote.online/habit  # 200 via vercel.json rewrite
```
Browser: open `https://www.niknote.online/habit` — guest banner → add habit → reload persists → water/sleep/exercise → Focus Timer custom 15/5 → mobile nav + Escape

## Next
All requested scope done. No further action unless new bugs reported.
