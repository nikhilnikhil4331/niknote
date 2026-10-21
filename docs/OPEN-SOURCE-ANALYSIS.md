# Open-source analysis for NikNote — 8 repositories

Scope: what each project is, its licence, which parts are worth studying for NikNote, what we
actually took, and what we deliberately did **not** take.

**Ground rules applied:**

- Study and adapt ideas only — nothing is cloned, merged or vendored.
- Licence is checked before any reuse (copyleft ⇒ no code, vocabulary only).
- NikNote stays a **notes app first**; no feature here is allowed to break the editor.
- No fake metrics: a borrowed idea that needs data NikNote does not have is not adopted.

---

## 1. `ethanplusai/harvey` — growth/outreach pipeline

**What it is:** an agentic outbound system: prospecting → campaign generation → reply handling →
approval queue → analytics → budget controls, with a human approval step.
**Licence:** self-described MIT (verify the LICENSE file before any reuse).

| Studied | Adopted in NikNote | Where |
| --- | --- | --- |
| Staged pipeline with a human gate | `draft → review → approved → sent` states; `decide()` throws without a named human | `src/lib/growth/approvals.ts` |
| Campaign generation | Draft composer that requires public evidence + a public channel | `src/lib/growth/outreach.ts` |
| Reply/opt-out handling | Mandatory opt-out sentence in every draft; opt-out list respected | `outreach.ts` |
| Analytics on the funnel | Consent-gated local funnel with `MIN_SAMPLE = 30` | `src/lib/growth/funnel.ts` |
| Budget controls | Spend budget defaults to 0 paise; `AUTONOMOUS_SPENDING = false` | `approvals.ts` |

**Not adopted:** autonomous sending, scraping private profiles, purchased lists, auto-replies.
**Priority mapping:** P5 (partnership/outreach), P3 (reporting).
**Result:** the workflow shape is in place; nothing can send without a human, which is the point.

---

## 2. `WeKnora` — document understanding / RAG

**What it is:** document ingestion + retrieval + chunked answer generation with citations.
**Licence:** MIT.

| Studied | Adopted | Where |
| --- | --- | --- |
| Chunking with page anchors | Chunk by page, sentence-bounded, with overlap; every chunk keeps `docId` + page | `src/lib/knowledgeIndex.ts` |
| Retrieval scoring | BM25-style scoring (k1 = 1.4, b = 0.75) with term coverage boosting | `knowledgeIndex.ts` |
| Citation-first answers | Passages are numbered `[1]…[n]`; the model is told to cite them or say it does not know | `groundingPrompt()` |
| Confidence gating | `high` / `low` / `none`; `none` ⇒ explicit "not in your material" instruction | `knowledgeIndex.ts` |

**Not adopted:** vector databases, embedding models, GPU stacks. NikNote's corpus is a student's own
notes and a handful of PDFs — lexical retrieval is instant, offline, free, and explainable.
**Priority mapping:** P2 (document intelligence).
**Trade-off:** weaker on pure paraphrase queries; a hybrid embedding path can be added later behind
the same `searchKnowledge()` signature.

---

## 3. `openwhispr` — local speech-to-text

**What it is:** desktop dictation with local models.
**Licence:** MIT.

| Studied | Adopted | Where |
| --- | --- | --- |
| Browser-native recognition as the zero-cost path | Web Speech API wrapper with typed error codes | `src/lib/speech.ts` |
| Explicit unsupported state | "This browser has no speech recognition" instead of a dead button | `src/pages/LectureMode.tsx` |
| Transcript cleanup before storage | Filler stripping (`um`, `uh`, `matlab`, …) | `src/lib/lecture.ts` |

**Not adopted:** bundling a Whisper model (tens of MB, device-specific). If local transcription is
wanted later it belongs behind a lazy-loaded worker, not in the main bundle.
**Priority mapping:** P4 (voice capture → notes).
**Privacy note:** browser speech engines may send audio to their own service — the UI says so.

---

## 4. `VoiceStudio` — voice cloning

**What it is:** speech synthesis / voice cloning studio.
**Licence:** **AGPL-3.0-only**.

**Verdict: nothing used, nothing merged.** Reading for inspiration only; the licence would force
source disclosure on a hosted product. No code, no model, no assets.
**Priority mapping:** none.

---

## 5. `openproject` — project management

**What it is:** work packages, scheduling, dependencies, Gantt.
**Licence:** **GPL-3.0**.

**Verdict:** vocabulary and scheduling concepts only (no code). What was useful is the idea of a
task carrying an effort estimate and a deadline, and of scheduling earliest-deadline-first within a
capacity limit — reimplemented from scratch for study planning.

**Adopted (original code):** `StudyTask`, `planSessions()` (EDF + priority, daily minute budget,
overdue work pinned to today), `tasksToIcs()` (RFC 5545, CRLF, 75-octet folding, `VALARM`).
**Where:** `src/lib/studyPlan.ts`, `src/pages/StudyPlanner.tsx`.
**Priority mapping:** P6 (retention: planning brings students back).

---

## 6. `cal.com` — scheduling

**What it is:** scheduling/booking platform.
**Licence:** MIT for the core (enterprise folders carry their own licence).

| Studied | Adopted | Where |
| --- | --- | --- |
| Calendar interop done via files, not fragile APIs | `.ics` export + a Google Calendar template link | `src/lib/studyPlan.ts` |
| Explicit "we did not book anything" wording | Copy states the file is imported by the user's calendar | `StudyPlanner.tsx` |

**Not adopted:** OAuth calendar write access. A failed write would create a false claim that an event
exists; a file the user imports cannot lie.
**Priority mapping:** P6.

---

## 7. `open-seo` — SEO checklist

**What it is:** an audit-rule collection for technical SEO.
**Licence:** MIT.

| Studied | Adopted | Where |
| --- | --- | --- |
| One canonical URL per page, no duplicate titles | `SITE_ORIGIN` + per-route metadata + canonical link | `src/lib/seo/meta.ts`, `SeoManager.tsx` |
| Sitemap hygiene (only canonical, indexable URLs) | Generated sitemap: 27 public URLs, private routes excluded | `scripts/generate-sitemap.mjs` |
| Machine-readable coverage | `SoftwareApplication`, `Article`, `FAQPage` JSON-LD | `index.html`, `meta.ts` |

**Not adopted:** automated site-crawling rules that need a backend; and no "growth hack" rules.
**Important:** `robots.txt` was treated as a *request*, not a security boundary — private routes are
also auth-gated and send `X-Robots-Tag: noindex`.
**Priority mapping:** P1 (technical SEO).

---

## 8. `open-higgsfield` — media generation

**What it is:** generative media tooling.
**Licence:** **no licence file found (404)** → all rights reserved.

**Verdict: nothing copied, not even snippets.** Unlicensed code is not open source. The only thing
taken is the negative lesson: do not ship generated media as if it were a user's own work.

---

## Codebase baseline (measured, not estimated)

| Signal | Value | Command |
| --- | --- | --- |
| Tests | 22 files / 244 tests passing | `npm test` |
| Type check | clean | `npm run typecheck` |
| Dead modules | **0** (69 orphans deleted, test-only helpers reported separately) | `npm run check:dead-code` |
| Build | Vite build succeeds | `npm run build` |
| Third-party packages | 707, 0 copyleft | `docs/license-inventory.json` |
| Growth dependencies added | 0 | `package.json` diff |

---

## Implementation plan (what this work changed, in priority order)

| # | Work | Files | Verified by |
| --- | --- | --- | --- |
| 1 | Remove fabricated admin metrics + demo chat | `src/pages/AdminPanelNikhil.tsx` | code review + empty-state copy |
| 2 | Dead-code gate in CI + 69 orphan modules deleted | `scripts/check-dead-code.mjs`, `.github/workflows/ci.yml` | `npm run check:dead-code` |
| 3 | Consent-gated funnel, approvals, content validator, experiments | `src/lib/growth/*` | `src/test/growth.test.ts` |
| 4 | Per-route SEO + private-route noindex + sitemap pipeline | `src/lib/seo/meta.ts`, `SeoManager.tsx`, `scripts/generate-sitemap.mjs`, `public/robots.txt`, `vercel.json` | `src/test/seo.test.ts` |
| 5 | Grounded retrieval with citations | `src/lib/knowledgeIndex.ts` | `src/test/knowledgeIndex.test.ts` |
| 6 | Lecture mode (record → structured notes) | `src/lib/lecture.ts`, `src/lib/lectureNotes.ts`, `src/pages/LectureMode.tsx` | `src/test/lectureAndPlan.test.ts`, `plannerAndLectureUi.test.tsx` |
| 7 | Study planner + `.ics` export | `src/lib/studyPlan.ts`, `src/pages/StudyPlanner.tsx` | same two files |
| 8 | Per-word handwriting lean + page widow control | `src/lib/handwritingStyle.ts`, `src/components/HandwritingLine.tsx` | `src/test/handwritingDna.test.tsx` |

---

## Honest gaps

1. Retrieval is lexical, not semantic — paraphrase-heavy questions can miss. Same API, future upgrade.
2. The AI proxy is deployed, but its provider secrets are not set yet, so the app still uses the legacy
   direct-key path until §16 step 3 is done.
3. Outreach has no provider; approved drafts open in the operator's mail app (deliberate).
4. Voice capture depends on the browser's speech engine; unsupported browsers are told so.
5. Edge functions have no automated test harness yet (migration is SQL-verified, client logic is unit-tested).
6. Harvey's licence needs a final read before any future code reuse; today only ideas were used.
