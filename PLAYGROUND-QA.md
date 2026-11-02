# NikNote Infinite Playground — QA Record

Date: 2026-11-03 (Asia/Calcutta)

## Verification summary

| Check | Result | Evidence |
| --- | --- | --- |
| Full regression suite | PASS | 42 test files, 706 tests passed |
| TypeScript | PASS | `npm run typecheck` |
| Touched-file ESLint | PASS | No errors or warnings |
| Production build | PASS | Vite build + 35 prerendered route HTML files |
| Playground route | PASS | Development server returns HTTP 200 at `/playground` |
| Supabase schema | PASS | `public.playgrounds` exists; RLS enabled; 4 owner-scoped policies verified |

## Final acceptance tests

| # | Acceptance test | Result | Verification |
| --- | --- | --- | --- |
| 1 | User can create a new canvas | PASS | Composed page test creates an empty “Untitled playground”. |
| 2 | User can write anywhere on the canvas | PASS | Pointer-driven text-tool test writes at a canvas point; text is editable. |
| 3 | User can drag text and images | PASS | DOM pointer tests move both object types and assert changed geometry. |
| 4 | User can resize and rotate images | PASS | Image pointer tests assert increased width and non-zero rotation. |
| 5 | User can create and connect nodes | PASS | Two nodes are inserted and connected through their ports; SVG edge is asserted. |
| 6 | User can create sticky notes | PASS | Quick-insert smoke test creates an editable sticky object. |
| 7 | User can add shapes and connectors | PASS | Shape-library insertion and node-connection tests pass. |
| 8 | User can use the right-click context menu | PASS | Context-menu duplicate action produces a second real object. |
| 9 | User can switch white/black playground themes | PASS | Composed theme test switches the canvas without forcing the app theme. |
| 10 | Theme preferences persist | PASS | App/canvas preferences are asserted in localStorage; document theme also survives reload. |
| 11 | Canvas content persists after refresh | PASS | Unmount/remount test restores title, objects, geometry, rotation, edges, viewport and theme. |
| 12 | Undo and redo work | PASS | Complete document-state history test passes. |
| 13 | Documents and canvas objects can reference each other | PASS | Existing-note link insertion and selected-text document handoff tests pass. |
| 14 | Mobile layout works without overflow | PASS | 390px composed smoke test verifies the same canvas-list/library controls with no separate Playground mobile navigation; page/canvas containers use bounded overflow layouts. |
| 15 | No major browser console errors remain | PASS | Playground composed and interaction tests complete without runtime errors; production build and route startup pass. Existing unrelated suites retain their offline/test-environment warnings. |
| 16 | Existing NikNote features continue working | PASS | Full 706-test regression suite and production build pass. |

## Honest workflow/AI behavior

- Playground node connections are explicitly marked **Visual only**.
- No execution result, metric or success status is fabricated.
- The legacy workflow runner no longer uses a timer to pretend completion. It requires a real async runner; without one it reports that execution is not configured.
- The AI block opens the existing NikAI assistant rather than returning fake AI content.

## Persistence behavior

- Guests and offline users: user/device-scoped localStorage persistence.
- Signed-in users: local draft first, then Supabase upsert; “Cloud saved” appears only after a successful response.
- A newer local draft is not overwritten by an older cloud row.
- Cloud failure leaves a visible device-saved message instead of false cloud success.
- Schema: `supabase/migrations/20261102190000_create_playgrounds.sql`.
