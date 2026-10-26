# NikNote PDF Editor 2.0 — Audit, Redesign & QA Report

_Date: 2026-10-25 · Branch: `arena/973d3585-niknote` · Scope: `/pdf-editor` (and `/pdf` alias)_

## 1. Executive summary

The old PDF Studio was functionally rich (annotations, page ops, export) but had a broken
rendering core and broken touch model: pages rendered at CSS resolution (blurry on every
retina/phone screen), the editor opened with the pen active and `touch-action: none`
(so the document could not be scrolled or swiped on mobile at all), and mobile users had
no zoom control. PDF Editor 2.0 fixes the rendering/navigation foundations first, then
rebuilds the surface as a read-first, document-focused workspace with a circular tool
launcher, lazy retina thumbnails, safe page management, pinch/swipe gestures, text
search, password handling and honest error states. The existing annotation model and
pdf-lib exporter (original bytes preserved, no rasterization) were kept.

## 2. Existing architecture (audit findings)

| Area | Finding |
|---|---|
| Stack | React 18 + TypeScript + Vite 5, Tailwind, Capacitor 8 (web + Android/iOS shells) |
| Routes | `/pdf-editor`, `/pdf` → `src/components/pdf-studio/PdfStudio.tsx`; `/pdf-tools` is a separate utility page (unchanged) |
| Rendering | pdf.js `pdfjs-dist@4.10.38` (bundled worker via `?url`), single `<canvas>` per document (only the current page) + one overlay canvas for annotations |
| Annotation model | `src/lib/pdfStudio.ts` — normalized 0..1 page coordinates, drawn on overlay live, flattened as a PNG layer per page on export |
| Export | `pdf-lib@1.17` `copyPages` from the **original bytes** (vector content preserved) + annotation layer |
| Storage | Signatures in localStorage; PDF itself never uploaded (on-device by design) |
| Auth/premium | Not involved in the editor path; untouched |

## 3. Confirmed bugs, root causes, fixes

| # | Severity | Bug | Root cause (evidence) | Fix in 2.0 |
|---|---|---|---|---|
| B1 | Critical | PDF text/graphics blurry | Canvas backing = CSS pixels; `devicePixelRatio` never used (`canvas.width = viewport.width` with a fit-width scale) | `planPageRender()` sizes backing = CSS × DPR (capped), CSS size independent; pdf.js viewport scale = backing ÷ page points |
| B2 | Critical | Blurry at high zoom | Hard caps: fit width ≤ 980px, backing ≤ 2400px → canvas stretched at 200–300% | Fit width up to real stage width (cap 1024 CSS), backing up to 3200px edge / 12 MP budget; zoom commits re-render sharply (preview transform during pinch/wheel) |
| B3 | Critical | Page up/down & scroll broken on touch | Default tool was `pen`, overlay `touchAction:'none'` + pointer capture — every touch drew ink, scrolling from the PDF was impossible | Default tool is **Read**; `touch-action` is tool-dependent (`auto` for reading in scroll mode, `none` only for drawing tools); continuous mode = native momentum scrolling |
| B4 | High | No zoom on mobile | Zoom cluster `hidden sm:flex`; no pinch/wheel/double-tap anywhere | Pinch-to-zoom, double-tap toggle, ctrl/⌘+wheel, zoom menu (Fit width / Fit page / Actual / presets) reachable on all sizes |
| B5 | High | Navigation desync / lost annotations | Handlers closed over stale `pages`/`annotations` (`deletePage`, `commit`, …); page input navigated on every keystroke ("12" → jump 1 → 12) | Single navigation controller (`goToPage` + ref-mirrored state + functional updates); go-to-page uses a draft committed on Go/Enter (`parsePageInput`) |
| B6 | High | Blurry + slow thumbnails | All pages rendered serially at 90px at open; rotation ignored in thumbnail viewport | Lazy (IntersectionObserver), retina width (≤340px, DPR≤2), rotation honored, ≤2 concurrent renders, cache |
| B7 | Medium | Occasional blank/stuck page on rapid navigation | Previous render task cancelled only when the next started; same-canvas errors swallowed by `catch {}` | Token-guarded serialized renders per page; previous task cancelled **and awaited**; real failures show a per-page Retry |
| B8 | Medium | Slow first paint on large PDFs | `getPage()` for every page awaited serially before showing anything | Page 1 measured immediately; remaining sizes/rotations corrected in background batches of 8 |
| B9 | Medium | Failed open wiped current edits; password/corrupt indistinguishable | `loadFile` cleared annotations **before** parsing; single generic toast | Session replaced only after successful parse; `classifyLoadError` → password prompt (with incorrect-password state), damaged, too-large states; replacing an edited doc asks for confirmation |
| B10 | Medium | Instant delete, no recovery | Toolbar trash deleted page + annotations immediately | Page actions live in the Pages panel (swipe-down/long-press/⋯/right-click on a **thumbnail**); delete asks for confirmation and offers Undo (snapshot restore) |
| B11 | Medium | Layout ignored resize/rotation | Stage width read once per render effect; no `ResizeObserver`; `min-h-screen` + no safe-area | `ResizeObserver` + DPR tracking refits pages; `h-dvh`, safe-area-aware bars, ≥44px targets (was 28px) |
| B12 | Low | No dark-mode/token coherence | Hardcoded hex palette bypassing app tokens | `--pdfs-*` tokens mapped to app theme variables + `.dark` variants |

Good parts deliberately preserved: normalized-coordinate annotations, pdf-lib export from
original bytes, signature storage, full tool set (pen/highlighter/text/shapes/stamps/
signatures/images/eraser), page ops (rotate/duplicate/blank/reorder), share/save flows.

## 4. What the new editor does

- **Read-first opening.** A PDF opens in clean reading mode — no tool active, no drawing
  surface over the page. Empty state supports drag & drop (also mid-session: dropping a
  PDF anywhere feeds the editor instead of navigating away) and a built-in 5-page mixed-size
  sample (`public/sample.pdf`, generated by `scripts/make-sample-pdf.mjs`).
- **Two view modes.** Continuous scroll (default, Samsung-Notes-like: vertical scroll,
  scroll-spy keeps the page indicator honest, only a ±2-page window holds bitmaps) and
  Single-page (swipe left/right to turn, subtle slide, manual pan when zoomed).
- **Circular tool launcher.** One 56px button (bottom-right, safe-area aware); tapping fans
  out Read / Pen / Highlight / Erase / Text / Shapes / Sign / Image along an arc with
  staggered, reduced-motion-aware animation. The active tool's settings live in a compact
  contextual pill bar — never a permanent panel. Done (✓) returns to Read.
- **Gestures, deliberately.** Swipe = page turn only in single-page mode, only in Read,
  only fast (>56px, axis-locked, <700ms). Pinch cancels any in-progress stroke. Swipe-down
  exists **only on thumbnails** to reveal page actions; the document always scrolls.
  Keyboard: arrows/PageUp/PageDown/Home/End, +/−/0 zoom, V/P/H/E/T tools, Esc → Read,
  Ctrl+Z/Y/S/F.
- **Pages panel.** Desktop rail / mobile drawer; lazy retina thumbnails; rotate, duplicate,
  move, insert blank (same/A4/Letter), delete-with-confirm+undo.
- **Search.** Page-level find over the pdf.js text layer with match navigation
  (honest note in UI: scanned PDFs without a text layer won't match).
- **Session safety.** Annotations + page order auto-persist per exact file fingerprint
  (name+size+pages) in localStorage and restore on reopen; save status in the header
  (Unsaved edits / Saved HH:MM); share warns when edits are newer than the last export.

## 5. Files

| File | Change |
|---|---|
| `src/lib/pdfEditor.ts` | **New** — pure rules: render planning (DPR/caps), navigation math, gesture classifiers, zoom presets, error classification, `displayDims`, tool metadata. Unit-tested |
| `src/components/pdf-studio/PdfStudio.tsx` | Rewritten shell — header/search/zoom/view modes, pointer+pinch orchestration, page ops, export, password/confirm/go-to sheets, contextual bar, signature modal |
| `src/components/pdf-studio/PdfPageView.tsx` | **New** — per-page hi-DPI canvas + overlay; serialized cancellable renders; placeholder windows; per-page retry |
| `src/components/pdf-studio/RadialTools.tsx` | **New** — circular tool launcher + fan |
| `src/components/pdf-studio/PagePanel.tsx` | **New** — lazy thumbnails + page-action sheet |
| `src/components/pdf-studio/pdf-studio.css` | **New** — `--pdfs-*` design tokens, fan/sheet/page-turn motion, reduced-motion fallbacks |
| `src/test/pdfEditor.test.ts` | **New** — 24 tests (render planning regression guards, navigation, gestures, errors) |
| `src/test/pdfStudioScreen.test.tsx` | Updated — read-first empty-state contract (no canvas mounted, no auto-pen) |
| `public/sample.pdf` + `scripts/make-sample-pdf.mjs` | **New** — QA sample document (4 KB, 5 pages, mixed A4/Letter-landscape) |
| `AGENTS.md` | Decision entry for the editor architecture |

`src/lib/pdfStudio.ts` (annotation model + exporter) is unchanged on purpose.

## 6. Open-source research (Phase 12) — decision

All four referenced repos were inspected via their GitHub metadata/trees on 2026-10-25:

| Repo | License | Stars | Notes | Decision |
|---|---|---|---|---|
| vensas/pdf-editor | MIT | 3 | Young browser editor | Patterns only |
| universal-simulation-ltd/Universal_PDF | “Other” (unclear) | 2 | License not clearly reusable | **Do not copy** |
| suhasTeju/pdf-reader-js | MIT | 0 | Next.js monorepo demo, not a drop-in lib | Patterns only (canvas/DPR approach cross-checked) |
| owenpkent/folio | MIT | 1 | Tauri desktop app; componentized `Page.tsx` | Pattern (per-page component) matched our design |

No third-party code was copied; the implementation is native to the existing
pdf.js + pdf-lib stack. `pdfjs-dist` stays at 4.10.38 — upgrading majors mid-redesign
would add API risk without a user-visible win; noted as a follow-up.

## 7. Verification — what was actually run

| Check | Result |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | **0 errors** |
| `npx eslint` (changed files) | **0 errors**, 1 dev-only fast-refresh warning (old file alone had 7 errors) |
| Unit/UI tests `npx vitest run` (full suite) | **201/201 passed** (17 files), incl. 24 new editor-rule tests + updated screen test + all pre-existing pdfStudio export tests |
| `npm run build` | Passes; pdf worker chunk + `sample.pdf` present in `dist/` |
| Real pdf.js probe (Node) | Sample opens (5 pages), rotated viewports swap correctly (595×842 → 1684×1191 @2x/90°), text layer finds “photosynthesis” (p1) and “quadratic” (p1, p4) |
| Dev server | Serves app + `/sample.pdf` (HTTP 200) at port 8080 |

**Not executed here (no browser binary in the sandbox — puppeteer's Chromium download is
blocked by the network allowlist):** pixel-level screenshot comparison, real touch/pinch
on a device, Capacitor APK run, screen-reader pass. These need one manual pass on a real
phone + desktop browser via the live preview (checklist below).

### Manual QA checklist (≈10 minutes, using “Try the sample”)

1. Sample opens in Read mode; text is visibly sharp at 100% and after pinch-zoom-in.
2. Scroll mode: flick through all 5 pages; page pill stays in sync; landscape page fits.
3. More → Single-page view: swipe left/right turns pages; vertical scroll never turns.
4. Tools fan: Pen → draw; Highlight → drag; Eraser drag; Text tap-type; Shapes → arrow;
   Sign → create + place; ✓ returns to Read; nothing draws in Read.
5. Pages panel: swipe a thumbnail down → actions; Rotate the landscape page; Duplicate;
   Delete → confirm → Undo restores.
6. Search “quadratic” → 2 pages, step through. Search gibberish → honest no-match text.
7. Save PDF → reopen the downloaded file → annotations + page changes present, text selectable.
8. Rotate phone / resize window mid-edit → page refits, annotations stay aligned.
9. Open a password-protected PDF → prompt; wrong password message; correct one opens.
10. Reload the app, reopen the same file → edits restored.

## 8. Known limitations (honest)

- **Encrypted PDFs:** pdf.js can *open* them with a password, but `pdf-lib` cannot decrypt
  on export — saving an edited encrypted file may fail (the error is surfaced, not silent).
- **Annotations are flattened** into the exported PDF (by design, as before) — they are
  not PDF-native annotation objects, and existing PDF text cannot be edited in place
  (the Text tool adds new text on top).
- **Stylus:** on the web, `touch-action` can't differ per pointer type, so a stylus draws
  when a drawing tool is active (like most web editors) instead of Samsung's
  “pen always writes, finger always scrolls”. In continuous Read mode a touch-drag selects
  (tap) but scrolls rather than drag-moving annotations; mouse/pen or single-page mode drag.
- **Extreme-zoom softness:** beyond the 12 MP/page budget (e.g., A4 at 300% on DPR-2
  desktop) output scale can dip to ≈0.94 — a deliberate memory ceiling, still far sharper
  than the old fixed 2400px cap.
- **Session restore size cap:** sessions with >1.5 MB of annotation JSON (many embedded
  photos) skip localStorage persistence.
- Global page-operation history is not part of Ctrl+Z (annotation history is); page delete
  has its own Undo toast, other page ops are immediate.
- `pdfjs-dist` 4.10.38 retained; a 5.x/6.x upgrade (newer rendering, WASM decoders) is a
  separate, separately-testable change.

## 9. Run it

```bash
npm install        # in restricted sandboxes: PUPPETEER_SKIP_DOWNLOAD=true npm install
npm run dev        # http://localhost:8080/pdf-editor
npm test           # vitest (full suite)
npm run build
node scripts/make-sample-pdf.mjs   # regenerate public/sample.pdf
```

## 10. Production readiness

**Ready to merge behind normal review.** Rendering, navigation and gesture foundations are
rebuilt and covered by tests; no auth, storage, premium or routing behavior outside the
editor changed; the full repo suite is green. Before promoting to all users, run the
10-minute manual checklist above on one Android phone (primary form factor) and one
desktop browser, since real-device touch is the only layer that could not be exercised
in this environment.
