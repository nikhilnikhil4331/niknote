# NikNote Infinite Playground — QA Record

Date: 2026-11-03 (Asia/Calcutta)

## Verification summary

| Check | Result | Evidence |
| --- | --- | --- |
| Full regression suite | PASS | 44 test files, 724 tests passed |
| TypeScript | PASS | `npm run typecheck` |
| Playground change-set ESLint | PASS | Playground components, hooks, helpers and tests report no errors or warnings |
| Production build | PASS | Vite build + 35 prerendered route HTML files |
| Playground route | PASS | Development server returns HTTP 200 at `/playground` |
| Supabase schema | PASS | `public.playgrounds` exists; RLS enabled; 4 owner-scoped policies verified |

## Final acceptance tests

| # | Acceptance test | Result | Verification |
| --- | --- | --- | --- |
| 1 | User can create a new canvas | PASS | Composed page test creates an empty “Untitled playground”. |
| 2 | User can write anywhere on the canvas | PASS | Text/Start writing opens a focused editor; exact click position and auto-growing long-note tests pass. |
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
| 13 | Documents and canvas objects can reference each other | PASS | Live Notes Preview, Notes Taking handoff/return links and reverse note-to-canvas import tests pass without overwriting work. |
| 14 | Mobile layout works without overflow | PASS | 390px composed smoke test verifies the same canvas-list/library controls with no separate Playground mobile navigation; page/canvas containers use bounded overflow layouts. |
| 15 | No major browser console errors remain | PASS | Playground composed and interaction tests complete without runtime errors; production build and route startup pass. Existing unrelated suites retain their offline/test-environment warnings. |
| 16 | Existing NikNote features continue working | PASS | Full 724-test regression suite and production build pass. |

## Zoom, writing and Notes Taking stability follow-up

- Consecutive zoom-in/zoom-out actions always use the latest viewport ref; the two-step 100% → 132% regression test passes.
- Text, Start writing, canvas-point writing and library text insertion focus a real editor immediately.
- Explicit writing points no longer receive the automatic insertion offset.
- Long writing grows the object instead of being clipped at its original fixed height.
- Notes Preview is read-only and generated from current canvas objects; it is not a static mockup.
- Edit in Notes Taking transfers actual content to the existing editor and provides a return link to the same canvas.
- Open in Playground imports current note blocks into a new canvas, once per handoff, without replacing existing canvases.
- Latest local drafts are flushed before Notes Taking navigation and before creating or duplicating another canvas.

## Smoothness and interaction pass

- Pan/zoom uses a dedicated lightweight viewport update; object and edge arrays retain their references.
- Draft updates clone only mutable model branches instead of serializing complete documents and large image data URLs on every keystroke/pointer move.
- Memoized object, connection and minimap layers avoid unnecessary rendering while the viewport moves.
- Mouse, trackpad and line-based wheel input is normalized and bounded to prevent abrupt zoom jumps.
- Zoom controls expose disabled states at the real 20%–250% limits.
- Double-clicking empty canvas space opens an immediately focused text editor at that point.
- Selection and button feedback has restrained transitions, disabled by the existing reduced-motion preference.
- Regression coverage verifies reference stability, nested undo safety, double-click writing, aggressive wheel input and zoom limits.

## Editable plugin blocks and attachments

- The chart plugin creates real bar, line and area graphics from user-entered labels and numeric values; empty charts show an honest data-entry state.
- Chart title, type and data points are editable, including add/remove and negative values; no statistics are fabricated.
- Charts persist locally/cloud through the existing playground document, survive reload, participate in undo and duplicate with the canvas.
- The same actual chart data appears in Notes Preview, Notes Taking text handoff and self-contained SVG export.
- Chart blocks can be inserted from the quick bar/library or dragged to an exact canvas point.
- Existing notes remain reusable note-link attachments; both click insertion and drag/drop preserve a return link to the current canvas.
- Writing, sticky, code, checklist, table, image, link, drawing and workflow blocks remain available in the same modular library.

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
