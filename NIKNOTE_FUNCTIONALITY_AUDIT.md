# NikNote Functionality Audit

**Audit date:** 2026-11-04 (UTC)  
**Repository:** `nikhilnikhil4331/niknote`  
**Branch / source snapshot:** `arena/fa802f8f-niknote` at `3757a96`, plus the uncommitted local audit changes described below  
**Scope:** Local code and product-surface review; automated checks are listed in `NIKNOTE_QA_REPORT.md`. Production was inspected read-only in the earlier audit pass. Nothing in this report represents a production deployment or a completed end-to-end user acceptance test.

## Executive summary

NikNote is a broad React, TypeScript, and Vite study/workspace product with notebook editing, handwriting-style output, an AI workspace, document/PDF utilities, flashcards, study and personal trackers, a mobile shell, PWA support, and a locally persisted creative Playground. The application router declares **62 route entries** (including aliases and the wildcard), with **46 top-level page TSX files** and **236 component TS/TSX files within the audited depth-3 inventory**. The product surface is larger than the set of flows that can be verified from a build or unit tests alone.

The main product paths are present in the router. Several files/features that read as product capabilities are not connected to those paths or are only prototypes; they must not be counted as live user functionality without integration. Local fixes now align `/documents` request/response handling, bound browser-side PDF/OCR work and OCR JSON, move guest email updates onto authenticated confirmation, preserve/recover pending guest workspaces, and harden the anonymous quota path. Formula safety, sync conflict behavior, AI/auth request bounds, and service-worker startup were also improved locally. These edits remain **uncommitted and undeployed**; no live user journey has verified them against Supabase or providers.

## Product capability map

| Area | Main entry points | Current implementation evidence | Audit assessment |
|---|---|---|---|
| Workspace, notes, and handwritten output | `/`, `/home`, `/studio`, `/notebooks`, `/notes`, `/notebooks-classic`, `/history` | Desktop and mobile shells; editor and notebook page files; handwriting font/paper/ink settings; local state plus Supabase-backed notebook/page sync code | Core surface is substantial. Automated coverage exercises selected editor and sync behavior; this pass did not manually execute every save, export, and cross-device flow. |
| AI study assistant | `/ai`, `/nikai`, `/ai-workspace`, `/agents`, `/ai-classic`, `/ai-solver` | NikAI workspace, a Vercel `/api/ai` gateway, multiple Supabase Edge Functions, prompt/stream helpers, and offline/fallback code | Multiple entry points and providers exist. Auth/quota availability and provider configuration are deployment dependencies; do not assume every legacy AI path is live or equivalent. |
| Documents, OCR, and handwriting vision | `/documents`, `/scan-notes`, `/checkup` | Browser document/PDF code and authenticated Edge Function paths; paid handwriting vision validates subscription and bounded image payloads in source | Significant code exists; end-to-end OCR, subscription, quota, and storage behavior needs real environment QA. |
| PDF studio and PDF tools | `/pdf-editor`, `/pdf`, `/pdf-tools` | Client-side PDF editing/export and PDF/OCR-related chunks in the production build | Functional code is present and is intentionally heavy; see the performance report. No device-by-device PDF acceptance run was performed in this audit. |
| Study / personal productivity | `/flashcards`, `/calendar`, `/tasks`, `/focus`, `/routine`, `/habit`, `/money`, `/achievements` | Routed modules for flashcards, routines, habit tracking, finance, and study productivity | Feature breadth is present; persistence, time-zone, and data-recovery behavior should be tested per module. |
| Sharing / collaboration / board | `/shared`, `/board`, `/feedback` | Shared-notes, board, and feedback surfaces; Supabase data/storage integrations | Authentication, RLS, and multi-user behavior need production-like integration tests; source presence is not proof of isolation. |
| Marketing, onboarding, account, and payments | `/welcome`, `/onboarding`, `/login`, `/signup`, `/reset-password`, `/auth`, `/account-details`, `/account`, `/appearance`, `/templates`, `/landing`, `/schools`, `/institutions`, `/upgrade`, `/payment`, `/donate`, `/blog`, `/blog/:slug`, `/handbook`, `/privacy`, `/terms`, `/refunds` | Routed content, auth, billing, and policy pages | Browser and real-provider completion paths were not re-run as part of this audit. See the open verification items in the QA report. |
| Internal / quality surfaces | `/qa`, `/audit`, `/admin`, `/admin-login`, `/admin-panel-nikhil` | Diagnostic, audit, and admin page modules | Confirm server-side authorization and role checks independently; a client route or noindex metadata is not an access-control boundary. |
| Creative canvas | `/playground` | Bespoke desktop/mobile canvas; validated localStorage model; item cap; keyboard/pointer movement; SVG export; no invented backend | Local-only by design in this iteration. Data does not sync across accounts/devices. |
| Mobile/PWA/native | Root and responsive routes; Capacitor integration | Separate mobile experience, service-worker registration, web app manifest, native navigation/haptics hooks | Offline support is shell/cache behavior, not proof that every feature works offline. Native packaging/device QA is outside this run. |

## Route inventory

The router declares the following 62 entries. Several are aliases that intentionally render the same surface; the count is not a count of unique product capabilities.

- **Workspace/editor:** `/`, `/home`, `/studio`, `/app`
- **Notes/productivity:** `/notebooks`, `/notes`, `/notebooks-classic`, `/history`, `/calendar`, `/tasks`, `/focus`, `/trash`, `/shared`, `/board`, `/playground`, `/flashcards`, `/achievements`, `/hub`, `/money`, `/routine`, `/habit`
- **AI/documents:** `/ai`, `/nikai`, `/ai-workspace`, `/agents`, `/ai-classic`, `/ai-solver`, `/documents`, `/scan-notes`
- **PDF/diagnostics:** `/pdf-editor`, `/pdf`, `/pdf-tools`, `/checkup`, `/qa`, `/audit`
- **Account/onboarding:** `/account-details`, `/account`, `/appearance`, `/templates`, `/welcome`, `/onboarding`, `/login`, `/signup`, `/reset-password`, `/auth`
- **Commercial/marketing/content:** `/upgrade`, `/donate`, `/payment`, `/landing`, `/schools`, `/institutions`, `/feedback`, `/handbook`, `/blog`, `/blog/:slug`
- **Internal/legal:** `/admin`, `/admin-login`, `/admin-panel-nikhil`, `/privacy`, `/terms`, `/refunds`
- **Fallback:** `*`

## Integration and completeness findings

1. **AI upload component is latent, not a proven live flow.** `src/components/ai/FileUploadZone.tsx` has no use site in the audited source search. Its request shape (`action`, `content`, `imageBase64`) does not match the current `openai-brain` message/prompt contract. Do not treat it as an integrated image OCR workflow; either wire it to a supported endpoint with tests or retire it.
2. **Workflow canvas reports simulated completion.** `src/components/workflow/WorkflowCanvas.tsx` is not integrated into an active route in the source search. Its Run handler marks nodes complete after a timer rather than executing the engine. `WorkflowEngine` exists, but arbitrary JavaScript workflow nodes now fail explicitly until an isolated sandbox exists. The visual canvas should not be advertised as production workflow execution.
3. **Agent console / knowledge service integration is unclear.** `AgentConsole.tsx` is lazy-imported but no route mounts it; `/agents` renders the shared Asta/NikAI workspace. `KnowledgeEngine` is present but no instantiation/use site was found in the audited search. Confirm intended ownership before promoting these modules as supported experiences.
4. **Document Intelligence contract is aligned locally; release behavior is not live-verified.** `/documents` now extracts text from at most 20 PDF pages in the browser, OCRs no more than 8 scanned pages, caps extracted text at 16,000 characters, and sends the `content`/`processMode`/`userMode` JSON contract to `process-document`. The function validates bounded JSON, authenticates the user, and returns JSON rather than SSE. A mocked client/function contract test passes. This is not a live OCR/provider or production integration test; the Edge Function changes remain undeployed.
5. **Theme picker is not a complete product-wide theme implementation.** The theme picker is inside the editor; only its wrapper class is applied at the main editor root. See `NIKNOTE_DESIGN_SYSTEM.md`.
6. **Local Playground is not a synced workspace.** It persists to browser localStorage and exports SVG. Clearing browser storage or switching devices does not carry the board over.
7. **Quota/storage dependencies still require target reconciliation.** A new local migration defines `consume_anon_quota` with service-role-only execution and fixed limits; it has not been applied. `consume_ai_quota` is still absent from the local migration history, while the audited production catalog previously showed it exists. Reconcile both RPC definitions and the intended project before deployment; current tests use mocks/static migration checks.

## Local changes relevant to functionality and reliability

- `src/lib/cloudSyncEngine.ts`: more explicit owner-scoped notebook lookup, preservation of local data on cloud lookup/write failures, conflict avoidance when local and remote versions both changed, and errors surfaced rather than silently ignored. Regression coverage added in `src/test/cloudSyncEngine.test.ts`.
- `src/lib/safeExpression.ts`, `src/lib/aiEngine.ts`, `src/services/workflow/WorkflowEngine.ts`: replace runtime expression evaluation with a bounded parser and explicitly disable arbitrary JS workflow nodes. Tests cover arithmetic/exponentiation, non-finite results, and workflow denial.
- `src/hooks/useServiceWorkerRegistration.ts`, `public/sw.js`: preserve the worker's cache lifecycle and network-first HTML/JS/CSS updates rather than unregistering/deleting caches during normal startup.
- `supabase/functions/*`: bound relevant JSON payloads and fail closed when several rate-limit stores cannot check/reserve a slot. OCR JSON is now capped at 14,000,000 bytes, decoded image data at 10 MiB, and accepted data URLs to supported raster types. Regression tests are described in the security and QA reports.
- Guest upgrade now uses the authenticated Supabase `auth.updateUser` flow rather than an admin-side email-confirm bypass. It keeps the current user UUID, stores pending status and recoverable credentials in the existing guest vault, resumes the saved account before anonymous provisioning, and tries the verified target address if the generated old address no longer logs in. Failed pending recovery does not create a replacement workspace. Supabase secure-email-change behavior for generated addresses remains an unresolved release risk.
- `supabase/migrations/20261104100000_harden_anon_ai_quota.sql` restricts direct quota-table/RPC access to `service_role`, checks service-role JWT claims, and fixes the quota at five creations per server-derived bucket per hour. `guest-session` computes a keyed HMAC bucket server-side and fails closed when no requester IP is available. The migration is unapplied, and trusted gateway IP-header semantics still need verification.

## Recommended acceptance coverage

Before claiming full readiness, run a browser-based user journey on current production-like services: new email signup/confirmation, sign-in, create/edit/save/reopen a note, offline edit and reconnect/sync conflict, AI request with quota success and denial, OCR upload within and over limits, PDF import/edit/export on mobile and desktop, guest-to-account upgrade, premium entitlement, payment webhook verification, and admin role denial. Record actual devices, viewport sizes, backend project, test accounts, and whether each step changed remote state. Do not substitute unit tests or route rendering for those journeys.
