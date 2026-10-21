# NikNote — open-source capability analysis & integration plan

Date: 2026-10-21 · Branch: `arena/09510f5e-niknote`
Scope: eight reference repositories, mapped onto the **existing** NikNote app.
Rule followed throughout: *adapt the engineering idea, do not graft the product*.

---

## 0. NikNote baseline (measured before changes)

| Area | Reality in the repo |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5, Tailwind + shadcn/Radix, framer-motion, react-router 7, PWA service worker, Capacitor (Android/iOS) |
| Backend | Supabase (auth, Postgres, edge functions) + Vercel serverless routes (`api/`), client fallbacks |
| AI | `src/lib/aiEngine.ts` — one adapter with 4 fallbacks: serverless → direct cloud (BYOK) → Supabase edge → **on-device offline brain**. Providers already normalised; nothing hard-depends on a paid key |
| Data | localStorage-first (notes, DNA, habit, money, flashcards) + optional cloud sync; no vector DB |
| Editor | line-based notebook (`LineBasedEditor`, `NotebookPreview`, `PageStage`), block editor for AI/imported notes |
| PDF in | `pdfjs-dist` text extraction (`lib/pdfText.ts`) + OCR/import pipeline (`HandwritingTextImporter`, `pdfPipeline.ts`) |
| PDF out | html2canvas + jsPDF, full-size offscreen sheets |
| Handwriting | DNA measured from ink (`handwritingAnalysis.ts`), one shared page renderer (`HandwritingPage`), per-word realism |
| Drawing | fabric.js canvas + `DrawingTool`, `PenPalette`, sketch store |
| Trackers | daily/habit + money local stores, charts via recharts |
| Navigation | semi-circular dial (`dialGeometry.ts`), mobile board footer |
| Mini-games / AI workspace | `NikAIWorkspace` (chat, note insertion, flashcards, handwriting hand-off) |
| Search | command palette only — **no retrieval over note/PDF content** |
| Voice | `useSpeechDictation` (Web Speech API) in editor + `PenPalette`; read-aloud in NikAI (inline `speechSynthesis`) |
| Tests | 13 vitest files, 152 tests, jsdom; `tsc -p tsconfig.app.json` clean; `vite build` clean |

**Dead / duplicate code found (not touched this turn):**
`src/services/knowledge/KnowledgeEngine.ts` (494 lines), `services/agents/MultiAgentSystem.ts`,
`services/ocr/OCREngine.ts`, `services/workflow/WorkflowEngine.ts` — none are imported anywhere.
They are aspirational scaffolds; tree-shaking keeps them out of the bundle, but they cost
maintenance. Recommended: delete or archive after the live replacements are proven.

**Genuine gap (the one that mattered):** NikAI only ever received the *single attached note* as
context. There was no way to ask a question about an uploaded PDF, no retrieval across notes, and
no citation — so document questions were answered from general model memory with no trace of
where (or whether) the material supported the answer.

---

## 1. Ranking for **NikNote** (not a quality ranking of the projects)

| # | Repo | License | Fit | Why |
|---|---|---|---|---|
| 1 | **Tencent/WeKnora** | MIT (third-party components listed separately) | ★★★★★ | Document → RAG pipeline is exactly NikNote's gap. But it is a Go + Python + vector-DB platform; NikNote needs the *pattern*, not the deployment |
| 2 | **OpenWhispr/openwhispr** | MIT | ★★★★ | Local Whisper/Parakeet dictation. NikNote already dictates via Web Speech, so the real value is transcript→structured notes, not another mic |
| 3 | **debpalash/VoiceStudio** | AGPL-3.0-only | ★★★ | Best TTS quality, but Python + model weights + GPU; AGPL makes any in-app reuse a licensing project |
| 4 | **opf/openproject** | GPL-3.0 | ★★★ | Task/workflow *vocabulary* (subject, deadline, priority, dependencies) is useful; code is Ruby GPL — read only |
| 5 | **calcom/cal.com** | MIT (core; `packages/features/ee` separately licensed) | ★★★ | Scheduling semantics + ICS interoperability. Full platform is unnecessary |
| 6 | **every-app/open-seo** | MIT | ★★ | Useful SEO auditing ideas; live keyword data needs DataForSEO (paid) |
| 7 | **wide-trace/open-higgsfield** | **No license file** (`LICENSE` 404) | ★ | Architecture reference only — **cannot** copy code without permission; generation needs paid provider keys |
| 8 | **chatwoot/chatwoot** | MIT core, `enterprise/` separate | ★★ | A separate support deployment, not an embed. No user notes may flow into it |

---

## 2. Per-repository analysis

### 2.1 Tencent/WeKnora — document intelligence (chosen)
- **Capabilities:** multi-format ingestion (PDF/Word/Markdown/HTML/images) via a Python `docreader`
  service, chunking, vector retrieval, LLM answer synthesis, agent orchestration, knowledge graph.
- **Relevant source:** `docreader/parser`, `docreader/splitter`, `internal/application` (RAG),
  `internal/agent`, `internal/database`.
- **Use in NikNote:** ask questions about an uploaded PDF; search across notes; show sources;
  summarise long documents; generate revision questions/flashcards; connect related notes.
- **Integration approach chosen:** re-implement the *retrieval contract* locally —
  Otsu-free plain chunking + BM25 lexical ranking + page-level citations
  (`src/lib/knowledgeIndex.ts`), wired into NikAI's existing prompt path. No new service,
  no vector DB, no key, works offline, nothing leaves the device.
- **Compatibility:** perfect (pure TypeScript, ~13 KB source, zero deps). A hosted WeKnora
  would add a Go service + Postgres/pgvector + embedding costs and break offline use.
- **Limitations:** lexical recall ≠ semantic embeddings; no cross-document knowledge graph yet.
  For English/Hinglish study notes BM25 + page citations is the right first step; embeddings can
  be added later behind the same `buildGroundedContext()` interface.

### 2.2 OpenWhispr — voice
- **Capabilities:** Electron desktop app, local Whisper/Parakeet (whisper.cpp / sherpa-onnx) and
  cloud BYOK models; hotkey dictation, clipboard insert, cleanup prompts.
- **Relevant source:** `src/services`, `src/helpers`, `native/`, `main.js`.
- **Use in NikNote:** lecture transcription, "speak → organised notes".
- **Decision:** Web Speech API dictation already exists and needs no download. What was missing was
  **voice input for NikAI itself** and a typed/cleaned shared speech layer — both shipped this turn.
  A local Whisper option would need WASM weights (~40–150 MB) and will only be considered for a
  future offline "lecture mode", measured before adoption.

### 2.3 VoiceStudio — TTS
- **Capabilities:** Python, model weights, voice cloning/design/dubbing, local GPU inference.
- **Decision:** AGPL-3.0-only application code + separate model-weight terms → not mergeable into
  a proprietary frontend. Read-aloud is instead improved on the browser's own voices (offline,
  Hindi/English voice selection, markdown stripped). A hosted TTS adapter can be added later behind
  `speakAloud()` without touching UI.

### 2.4 OpenProject — planning
- **Capabilities:** GPL-3.0 Ruby/Rails; work packages, dependencies, Gantt, recurring work.
- **Use in NikNote:** model study tasks as work-package-like records (subject, topic, estimate,
  deadline, priority, completion, linked note). Reference only; **no code copied** (GPL).
- **Status:** data model already partly exists in the Daily Tracker. Calendar export (ICS) is the
  next honest step: it interoperates without claiming an external event was created.

### 2.5 Cal.com — scheduling
- **Capabilities:** MIT core; availability rules, recurring sessions, ICS/CalDAV interoperability.
- **Use in NikNote:** "revise thermodynamics before Friday" → suggested study blocks, `.ics` export.
- **Decision:** do not embed the scheduler. Emit standards-compliant ICS so Google/Apple Calendar
  can import it, with explicit confirmation in the UI.

### 2.6 OpenSEO — discoverability
- **Capabilities:** site audits, rank tracking, keyword research; MIT; needs a paid search-data
  provider (DataForSEO) for live keyword metrics.
- **Use in NikNote:** audit `niknote.online` landing metadata/structured data; keep authenticated
  routes out of the index (`X-Robots-Tag`, `robots.txt`).
- **Decision:** no paid provider. Public-page metadata work is queued; must be applied only to
  marketing routes, never to the app shell.

### 2.7 OpenHiggsfield — creative generation
- **Capabilities:** Next.js studio with provider adapters ("platform key"), 38 image/video models;
  `src/generation`, `src/app`.
- **License:** **no licence file in the repository** → all rights reserved; reference only.
- **Use in NikNote:** provider-adapter *shape* (one interface, per-model settings, job history,
  retry) for optional educational illustrations.
- **Decision:** not implemented. Requires paid keys; and for maths/science precision, structured
  diagrams in `noteGraphs.ts` beat generated art. No fabricated media will ever be shown as success.

### 2.8 Chatwoot — support
- **Capabilities:** MIT core, omni-channel inbox, agent assignment, canned responses; `enterprise/`
  directory under a separate licence.
- **Use in NikNote:** feedback/bug intake → status tracking; possibly a self-hosted deployment.
- **Privacy rule:** note content must never be auto-forwarded; attachments require explicit consent.
- **Decision:** post-launch. A separate deployment, integrated by webhook/API, not embedded.

---

## 3. What was implemented this turn (Priority 2 → shipped)

### A. Local document intelligence (WeKnora pattern, no platform)
`src/lib/knowledgeIndex.ts` (new, ~380 lines, **zero dependencies**)
- `tokenize` — Unicode-aware (Devanagari + Hinglish safe), stop-words, conservative stemming.
- `chunkPage` — sentence-boundary chunks, 700 char target, 120 char overlap, monster-sentence split.
- `searchKnowledge` — BM25 (k1 1.4, b 0.75), multi-term coverage bonus, per-document spread cap.
- `buildGroundedContext` — top-k passages formatted with `[n] title · page`, deduped, char-capped,
  confidence `high | low | none`.
- `groundingPrompt` — explicit instructions: prefer passages, cite `[n]`, **never invent a page
  number**, and say so when nothing matched.
- Storage: `registerKnowledgeDoc` / `loadKnowledgeDocs` (40 docs / 400k chars, quota-safe fallback),
  `knowledgeDocsFromNotes` (searches all local notes automatically).

Wiring:
- `src/pages/Index.tsx` — PDF import now registers the document (pages preserved for citations)
  **and** still inserts structured notes.
- `src/components/handwriting-dna/HandwritingStudio.tsx` — the same for PDFs opened for handwriting.
- `src/components/nikai/NikAIWorkspace.tsx` — every question retrieves from notes + PDFs, the
  passages go into the existing prompt path, and answers render **Sources** chips (`[1] Bio p.3`).
  If nothing matches, the UI states plainly that the answer is general knowledge, not the material.

### B. Voice (Priority 4, delta only)
- `src/lib/speech.ts` (new) — single typed implementation: `startDictation`, `cleanForSpeech`,
  `speakAloud`, `stopSpeaking`, support detection, error mapping (`not-allowed`, `no-speech`, …).
- `src/hooks/useSpeechDictation.ts` — rewritten as a thin wrapper over the lib (same public API,
  so `PenPalette` and the editor are unchanged); removed `any` casts and duplicated plumbing.
- `NikAIWorkspace` — **Voice** button in the composer (listening indicator with interim text,
  cancel, permission messaging); read-aloud now uses `speakAloud` (markdown stripped, Indian voice
  preferred) instead of the old regex one-liner.

### C. Verification
- `npx vitest run` → **13 files / 152 tests pass** (new: `knowledgeIndex.test.ts` 13,
  `speech.test.ts` 10, `useSpeechDictation.test.tsx` 4).
- `npx tsc -p tsconfig.app.json --noEmit` → clean.
- `npx vite build` → clean.

### D. Dependencies
**Added: none.** Removed: none. The whole improvement is pure TypeScript using APIs already in
the app (`pdfjs-dist` for text, Web Speech for voice).

---

## 4. Deliberately not done (with reasons)

| Item | Reason |
|---|---|
| Running WeKnora / OpenWhispr / VoiceStudio services | New runtime + GPU + ops cost for a single-user notebook; breaks offline and free-tier deployment |
| Copying OpenProject or VoiceStudio code | GPL-3.0 / AGPL-3.0-only obligations on a proprietary app |
| Copying OpenHiggsfield code | No licence file → no reuse permission |
| Embedding Chatwoot | Correct shape is a separate deployment + API, and only after a privacy review |
| Paid SEO / generation APIs | Would add per-user cost with no core-product benefit |
| Vector embeddings for retrieval | Real cost (API + storage) for marginal gain on a personal note corpus; interface is ready if needed |

---

## 5. Next priorities (in order)

1. **Priority 1 sweep:** delete/archive the four unused `src/services/*` scaffolds; add a coverage
   check so new dead modules fail CI.
2. **Priority 3:** handwriting fidelity — per-word slant distribution from the scan; currently one
   global slant. (Page management and line leading are fixed.)
3. **Priority 4:** lecture mode — record → transcribe (on-device if feasible) → `composeStudyNotes`
   → grounded summary with citations.
4. **Priority 5:** study planner — task model (OpenProject vocabulary) + ICS export (Cal.com
   semantics), with confirmation before any external calendar write.
5. **Priority 6:** public-page SEO metadata for `niknote.online` only; support intake post-launch.
