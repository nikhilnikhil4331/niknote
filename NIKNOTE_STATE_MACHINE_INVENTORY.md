# NikNote implicit state-machine inventory

**Audit date:** 2026-11-04

**Scope:** source-level inventory of the checked-out application, its route/component wiring, client persistence, and the Supabase Edge Function / migration paths visible in this repository.

## How to read this inventory

- **Active runtime** means a route, mounted component, or call path was found in the application. It does not mean the workflow was exercised against a live deployment.
- **Transient** means React/component/session state that is not itself a durable record. A workflow may combine transient states with durable storage.
- **Unwired / candidate** means implementation or state declarations exist, but a product route or caller was not found in the searched application sources. Tests, comments, and imports alone are not proof of a user-facing workflow.
- **Simulated** means the UI or code substitutes a timer, template, hard-coded result, or mock-like response for the operation its label suggests.
- State names below are literal where an explicit union/state is present; otherwise they describe the observed transitions in plain language.
- Persistence labels: **cloud** = Supabase/backend; **local** = `localStorage` or device-side data; **session** = `sessionStorage` or current page/session; **memory** = React/module state only.

This is not a production health check or a claim that all migrations have been applied. Vercel deployment metadata was inspected, and commit `0d22a8c` was deployed and promoted to the production aliases; no Supabase schema introspection or production user flows were run. Local automated checks and deployment details are summarized separately in `NIKNOTE_QA_REPORT.md`; this source inventory does not establish remote schema state. Route and caller findings come from static source inspection/search; an unsearched or indirect integration may still exist.

---

## 1. Active runtime workflows

### 1.1 Application entry, redirects, responsive shell, and native Back

- **States / events:** initial route → legacy redirect or requested route → responsive rendering. `/` uses query parameters to choose an editor target or `/home`; `/studio`, `/app`, and the route without an editor ID redirect into the editor target. `ResponsivePage` renders `MobileExperience` on mobile and the requested desktop page otherwise. The Android Back handler first follows browser history and uses a double-press-to-exit behavior at the root.
- **Persistence / recovery:** route/history state is browser history, not note data. Production startup registers the service worker; browser/service-worker update state is managed by the platform. Native Back listener and app-global effects are mounted/cleaned up with the app shell.
- **Runtime anchors:** `src/App.tsx` (`legacyWorkspaceTarget`, `legacyEditorTarget`, `ResponsivePage`, routes, global providers/mounts); `src/lib/nativeNav.ts`; `src/hooks/useServiceWorkerRegistration.ts`; `src/components/mobile/MobileExperience.tsx`.
- **Important route alias:** `/ai`, `/nikai`, `/ai-workspace`, `/agents`, `/ai-solver`, and `/ai-classic` resolve to the unified NikAI workspace through route wrappers/re-exports. `/agents` is not `src/pages/AgentConsole.tsx`.

### 1.2 Authentication, guest entry, offline guest, and guest promotion

- **States / events:** auth bootstrap/loading → signed-in account, cloud guest, device-only guest, or signed-out. Email/password login and OAuth update the Supabase session. The auth screen switches between guest/login/signup tabs; guest entry is single-flight to prevent duplicate provisioning. Signup is gated by `SIGNUP_ENABLED` (currently disabled in the inspected feature configuration). A requested post-auth destination is validated before navigation.
- **Cloud guest recovery order:** reuse current session → try the saved guest vault through `guest-session` (including a pending target email, if applicable) → try Supabase anonymous sign-in → request a new cloud guest through `guest-session`. If cloud entry fails and offline fallback is allowed, create/reuse a `local-guest-*` user. A pending email-confirmation vault blocks silent fallback so the app does not create a different workspace.
- **Quota / recovery edge:** the checked-in `anon_ai_limits` / `consume_anon_quota` migration is called by the `guest-session` Edge path for *new Edge-created* guest accounts: five per hour per HMAC-digested requester-IP bucket. Resuming saved credentials bypasses that creation quota, and the earlier Supabase anonymous-sign-in branch does not pass through this Edge quota. Rate limit returns `429` with `Retry-After`; missing request-origin/quota infrastructure fails closed with `503`. The auth flow can still use its device-only guest fallback where allowed.
- **Promotion / recovery:** reconnecting a device guest starts the promotion intent, provisions/resumes a cloud guest, copies device-scoped data/local notes to the cloud owner without deleting the original first, then starts cloud sync. Failed promotion leaves the local guest available for retry. `GuestUpgradeCard` can manually retry cloud sync or convert the active cloud guest to email/password; while confirmation is pending the guest session/data remain the active workspace. Sign-out preserves the saved guest credentials for the pending-confirmation case; otherwise guest-vault/offline-guest state is cleared before leaving.
- **Persistence:** Supabase Auth session; guest vault and offline identity in `localStorage`; post-auth redirect in `sessionStorage`; pending email state in the vault; guest-promotion intent is short-lived local state. Local notes/data are preserved under owner-scoped keys and are promoted separately from authentication.
- **Runtime anchors:** `src/contexts/AuthContext.tsx`; `src/components/auth/NiknoteAuth.tsx`; `src/components/auth/GuestUpgradeCard.tsx`; `src/lib/ownerScopedStorage.ts`; `src/lib/localNoteStore.ts`; `supabase/functions/guest-session/index.ts`; `supabase/migrations/20261104100000_harden_anon_ai_quota.sql`; `src/config/features.ts`.

### 1.3 Cross-feature cloud synchronization

- **States:** `local`, `syncing`, `synced`, `offline`, `error` (the sync snapshot); a saved timestamp and counts supplement these states.
- **Triggers:** a cloud login/promotion, a local-data-change event (debounced), manual Sync Now, online/focus/visibility recovery, and startup restoration. Sync is deduplicated per owner; note, board, money, habit, and other supported local records are mapped to cloud data. Failed items remain available for a later retry rather than being cleared as successful.
- **Persistence / recovery:** sync timestamps are owner-scoped in local storage; content remains in its local store as well as cloud records. Cloud pull is used by explicit/manual restore paths. Device-only users remain `local`/`offline` rather than being represented as cloud-synced.
- **Runtime anchors:** `src/lib/cloudSyncEngine.ts`; `src/lib/ownerScopedStorage.ts`; `src/lib/localNoteStore.ts`; `src/contexts/AuthContext.tsx`; `src/components/auth/GuestUpgradeCard.tsx`; feature stores such as `src/components/desktop/store.ts` and `src/components/habits/RoutineProvider.tsx`.

### 1.4 Main editor: load, hydrate, edit, autosave, and recover

- **States / events:** route document ID changes → load/hydrate → editor ready; editing marks content dirty/unsaved → a debounced save starts → saved, offline/local, or error state. Manual Save/Sync and page navigation can also trigger a save. The page has explicit hydration/loading/error guards so old or not-yet-hydrated content is not immediately written as the new document.
- **Persistence / recovery:** pages and drafts are owner/document-scoped. `useNotebookPages` keeps browser drafts; the editor retains an owner-scoped local copy if cloud persistence fails. Cloud pages/notebooks are the durable account copy; local recovery remains available for retry. The editor can receive a short-lived session handoff (e.g. generated notes) and route to a new document. Undo/redo is in editor memory, not a durable version history.
- **Active editor wiring:** `/editor/:documentId` mounts `Index` → `DirectWritingWorkspace` → `NotionEditor`. The active editor uses `useBlockEditor` and the `Block` data model. `BlockEditor.tsx` is a separate, unmounted implementation (see §3).
- **Other editor transitions:** title/block/page changes; add/remove page; handwriting preview on/off; page-style/AI/import/scanner panels; dictation start/final transcript; local image selection (10 MB limit) → a base64 data URL stored in an image block. Current note settings supply the default ink; per-block swatches update that block and the current note ink, and ink edits participate in undo. Mobile per-block swatches are visible and use a 44px touch target in the active editor. The observed `Index` image-pick path does not call `secure-image-upload`; do not infer that the secure-upload Edge Function handles this active editor insertion path. The active Share toolbar uses `navigator.share({title, text})` or copies note text to the clipboard; it does **not** create a public note URL or change access permissions.
- **Export:** export progresses through `preparing → capturing → rendering → saving → done`; errors are surfaced to the caller. The export itself is a generated download/share artifact, not a saved editor revision.
- **Runtime anchors:** `src/pages/Index.tsx`; `src/hooks/useNotebookPages.ts`; `src/hooks/useBlockEditor.ts`; `src/components/workspace/DirectWritingWorkspace.tsx`; `src/components/editor/NotionEditor.tsx`; `src/types/block.ts`; `src/lib/localNoteStore.ts`; `src/lib/cloudSyncEngine.ts`; `src/utils/export.ts`.

**Notebook library and favorites**

- `useNotebooks` hydrates only the active owner’s cloud notebooks, merges that owner’s unsynced local notes, and falls back to the owner-local list if the cloud read fails. Device-only guest users read their local owner records.
- On desktop, `/notebooks-classic` mounts `MyNotebooks` (the responsive route renders `MobileExperience` instead on mobile): search/folder/tag filters are transient; create/edit/delete call the hook. Delete confirms first. Create is cloud-only in the hook (there is no local-only create fallback), so a `local-guest-*` device guest cannot create a notebook through this route until promoted. Existing unsynced local notes can be updated/deleted locally. The edit form closes and emits its success toast even if `updateNotebook` returned `null` after its own failure toast.
- The active editor’s favorite toggle is optimistic; it calls `updateNotebook` for a cloud-owned notebook, rolls back and shows an error if that call fails, then updates the owner-local record and notifies notebook lists. The canonical metadata field is `notebooks.is_favorite` (checked-in migration `20261104120000_add_notebook_favorites.sql`). Desktop-note favorites are a separate local model (see §1.9).
- **Runtime anchors:** `src/pages/MyNotebooks.tsx`; `src/hooks/useNotebooks.ts`; `src/pages/Index.tsx`; `src/components/workspace/WorkspaceSidebar.tsx`; `src/components/workspace/DirectWritingWorkspace.tsx`; `src/lib/localNoteStore.ts`; `supabase/migrations/20261104120000_add_notebook_favorites.sql`.

### 1.5 AI workspaces and editor AI

**Unified NikAI workspace**

- **States / events:** selected thread or new thread → user prompt/image appended with a placeholder assistant message → provider stream updates message/thinking/model → completed response with follow-ups, cancelled response, or an error/retry path. Stop/new-chat abort marks the assistant message cancelled, preserves any partial output, and shows an explicit stopped status when no text arrived; stale callbacks/finalizers do not overwrite a newer generation. Regenerate removes the last user/assistant pair and reissues the user request; deleting a thread removes it from the saved list.
- **Persistence / recovery:** thread history is stored in owner-scoped `localStorage` (up to 60 threads); a legacy thread key is read as a fallback. Conversation memory facts and NikAI's provider-key record are owner-scoped local data. This chat history is not shown as a cloud-synced Supabase conversation table. Pending input, open menus, active generation, and abort controller are transient. Owner-keyed content remounts when the owner changes. `AstaMarkdown` can turn a formatted MCQ response into an interactive quiz; picks, explanations, score, completion, and Retry are component state, not a separately saved grade.
- **Provider transitions:** `aiEngine` tries configured gateway/cloud and BYOK provider paths, can call the Supabase `openai-brain` function, and falls back to local symbolic/template answers. The UI labels local-provider output as offline rather than presenting it as a cloud result. Provider/model metadata is recorded on the message. When invoked, `openai-brain` validates a real Supabase user token and consumes the shared per-user hourly quota (default 30) before calling providers; exhausted quota returns `429` with `Retry-After`, while auth/quota infrastructure failure is fail-closed as `401`/`503`. The checked-in migration search did not find the `consume_ai_quota` RPC definition called by this guard (see §4, item 8).
- **Runtime anchors:** `src/components/asta/AstaAIWorkspace.tsx` (re-export); `src/components/nikai/NikAIWorkspace.tsx`; `src/components/asta/AstaMarkdown.tsx`; `src/lib/aiEngine.ts`; `src/lib/nikaiMemory.ts`; `src/lib/ownerScopedStorage.ts`; `supabase/functions/openai-brain/index.ts`; `supabase/functions/_shared/aiSecurity.ts`.

**Inline editor AI**

- **States / events:** choose an `@` AI action → editor inserts an action label and waits for the user’s question → Ctrl+Enter/submit replaces the target block with an in-progress AI block → `aiOrchestrator.chat()` streams through `aiEngine` or falls back to a curated local knowledge entry/dynamic template → output becomes an `ai-generated` block and a following text block is added. Empty/error responses become an editor message/block rather than a persisted AI job.
- **Persistence:** the active response is written into the current document blocks and therefore follows editor save behavior. `AgentOrchestrator.conversationHistory` is a module-level in-memory array; no durable thread history or active editor UI clear operation was found.
- **Additional active editor AI:** the handwriting/pen palette mounts `AIWritingAssistant`; it holds its generation/review UI in component state until the user applies/accepts content. The main editor AI action is separate from the unified NikAI thread list.
- **Runtime anchors:** `src/components/editor/NotionEditor.tsx`; `src/agents/orchestrator.ts`; `src/lib/aiEngine.ts`; `src/components/PenPalette.tsx`; `src/components/AIWritingAssistant.tsx`; `src/pages/Index.tsx`.

**Generic stream hook**

- `useAIStream` explicitly transitions `idle → streaming → done | error`; cancel/abort returns an active stream to `idle`, and unmount cancels. Its output is transient unless a caller copies it elsewhere. `/audit` is a mounted caller that runs generated reports. `MobileExperience` instantiates the hook and cancels it on unmount, but no `run()` call was found there; `InlineAIMenu.tsx` and `AgentConsole.tsx` contain run controls but are not mounted routes/components in the current product path.
- **Runtime anchors:** `src/hooks/useAIStream.ts`; `src/components/mobile/MobileExperience.tsx`; `src/pages/AuditReports.tsx`; `src/lib/aiEngine.ts`.

### 1.6 Document intelligence, handwriting import, and Scan Handwriting

**Document Intelligence (`/documents`)**

- **States / events:** select document → local extraction/parsing → optional OCR for scanned pages → send extracted content/mode to `process-document` → results or error/retry. The result is held in component state. “Generate notes” converts the result into owner-scoped content, writes a session handoff, and routes to `/editor/new`.
- **Persistence:** source file/results are not a durable document-job record in the observed component; the Edge Function records an activity row on successful processing. Generated note content becomes durable only through the editor save flow.
- **Runtime anchors:** `src/components/document-intelligence/DocumentIntelligence.tsx`; `src/lib/documentExtraction.ts`; `src/lib/pdfPipeline.ts`; `src/lib/pdfOcr.ts`; `supabase/functions/process-document/index.ts`; `src/pages/Index.tsx`.

**Editor import panel (`HandwritingTextImporter`)**

- **States / events:** image/PDF selection and validation → OCR in progress → extracted text/confidence/warnings, failed pages, or retry → accept/import into editor blocks. PDF processing has per-page `queued/processing/done/failed/skipped` states and retry; the batch can partially succeed. Image OCR can retry once when the backend marks the extraction retryable.
- **Persistence:** import preview and per-page status are in memory. Accepted text becomes ordinary editor blocks and is persisted with that document. The PDF OCR pipeline caches page results locally to avoid repeating successful OCR work.
- **Runtime anchors:** `src/components/HandwritingTextImporter.tsx`; `src/lib/pdfPipeline.ts`; `src/lib/pdfOcr.ts`; `src/pages/Index.tsx`; `supabase/functions/handwriting-vision/index.ts`.

**Standalone Scan Handwriting (`/scan-notes`)**

- **States / events:** pick/capture image → scale/preview → choose on-device OCR or AI OCR → progress/result/empty/error → edit title/text → save. AI OCR requires a cloud session; on-device OCR supports the chosen language and uses a downloaded/cached OCR model. A cloud save creates notebook/page records; if guest/local or cloud write fails, save as a local scan instead.
- **Persistence / recovery:** local saved scans live in `localStorage` (`niknote.scans.v1`); cloud saves become ordinary notebook pages. Local edits can be reopened and saved back to that local list. No automatic conversion of local scans to cloud pages was found in this screen.
- **Runtime anchors:** `src/pages/ScanNotes.tsx`; `src/lib/scanOcr.ts`; `src/lib/localNoteStore.ts`; `supabase/functions/extract-handwriting-text/index.ts`.

**Handwriting DNA scanner and onboarding sample**

- In the active editor, scanner state is `upload → scanning → results → adjust`; the browser canvas analyzes image pixels, suggests a preset, permits local adjustments, and applies the selected profile to the editor. This is client-side analysis, not the OCR or remote AI flow above.
- The shared profile persists under `niknote-handwriting-dna` in `localStorage` (not owner-scoped). The onboarding handwriting step uploads a sample to the private `handwriting-samples` bucket, then advances; that onboarding handler does not itself run a handwriting analysis.
- **Runtime anchors:** `src/contexts/HandwritingDNAContext.tsx`; `src/components/handwriting-dna/HandwritingScanner.tsx`; `src/components/handwriting-dna/HandwritingDNAEngine.ts`; `src/pages/Index.tsx`; `src/pages/Onboarding.tsx`; storage policy in `supabase/migrations/20260113121249_d263dd5a-6195-4849-8806-b1eea502744f.sql`.

### 1.7 PDF Studio, PDF Tools, and generated files

- **PDF Studio (`/pdf-editor`, `/pdf`):** file open `idle → loading → ready | error | password`; wrong password stays in the password state with retry/cancel. Page selection, annotations, text runs, reordering/deletion, signatures, and export are interactive component state. Annotation/order session autosave is keyed to the exact PDF; PDF export uses per-page progress and save/share handling. The file itself is processed locally in the browser.
- **PDF Tools (`/pdf-tools`):** separate client-side operations (merge/split/compress/watermark/page numbering/images-to-PDF/Word/Excel/OCR/protect/unlock) each use a file/settings → busy/progress → result/error → download flow. Operations are not a durable server job. OCR has model/progress states and a local cache; PDF password is local to the operation and not recoverable by the app.
- **Recovery:** Studio session state can restore recent edits for the same file; Tools result/password/selection state is component memory. Export flow is described in §1.4.
- **Runtime anchors:** `src/components/pdf-studio/PdfStudio.tsx`; `src/components/pdf-studio/PdfPageView.tsx`; `src/components/pdf-tools/PdfTools.tsx`; `src/lib/pdfPipeline.ts`; `src/lib/pdfOcr.ts`; `src/utils/export.ts`; `src/lib/saveFile.ts`.

### 1.8 Board, Playground, and flashcard study

**Board (`/board`)**

- **States / events:** initial load → ready; edits schedule cloud autosave (`idle/saving/saved/error`); failed/absent cloud state can recover from a timestamped local draft. Undo/redo is in memory. Media uploads have their own queued/uploading/success-or-error/retry path; voice capture is `idle/recording/paused`.
- **Persistence:** board data autosaves to the cloud with a local draft recovery copy. Uploads use the board media bucket and signed URLs. Recording/selection/progress are transient.
- **Runtime anchors:** `src/pages/Board.tsx`; cloud schema/helpers in `src/lib/cloudSyncEngine.ts` and Supabase storage calls from the page.

**Playground (`/playground`)**

- **States / events:** starter/saved board → add/edit/move/check/remove canvas pieces or choose theme/template → debounced save `saving → saved | unavailable`; leaving the page flushes the current board once more. SVG export produces a downloaded file.
- **Persistence:** one local browser key (`PLAYGROUND_STORAGE_KEY`), not owner-scoped and not cloud-synced. Selected piece/drag state is memory-only.
- **Runtime anchors:** `src/pages/Playground.tsx`; `src/lib/playground.ts`.

**Flashcards (`/flashcards`)**

- **States / events:** load cloud pages plus local generated cards → construct review queue (due-only or all) → flip card → rate `again/hard/good/easy` → schedule/update review record and advance → session complete/review again. The review algorithm is SM-2-lite.
- **Persistence / recovery:** review schedule is local storage keyed by active owner/device. Cloud notebook cards are derived from notebook/page content; generated local cards are added to the list. Queue index, flip state, and per-session rating counts are transient. On cloud fetch error, the screen falls back to that owner’s local generated cards and reports the cloud-load failure.
- **Runtime anchors:** `src/pages/Flashcards.tsx`; `src/hooks/useFlashcards.ts`; `src/types/block.ts` (`flashcard` type); `src/pages/Index.tsx` slash-command editor path.

### 1.9 Habit, routine, money, desktop tasks, and focus timers

**Habit app (`/habit`)**

- **States / events:** `/habit` mounts `RoutineApp` with its own `RoutineProvider`; splash/onboarding completion gates the app’s screen state. Habit creation/edit/archive/check-in, daily entries, todo completion, wellness fields, theme, and focus session transitions update the provider state. The focus timer uses a target end timestamp; completing focus records a session rather than merely incrementing a counter.
- **Persistence / recovery:** `niknote.habits.v1.<owner>` local owner-scoped state; cloud restore is attempted for cloud users and guarded so first restore does not overwrite local edits. Local state remains usable on timeout/offline and can be manually synced/exported. Focus sessions are recorded in provider state. Its focus timer is separate from `/focus`.
- **Runtime anchors:** `src/components/habits/RoutineApp.tsx`; `src/components/habits/RoutineProvider.tsx`; `src/lib/routineStore.ts`; `src/components/habits/screens/FocusTimer.tsx`; route in `src/App.tsx`.

**Routine Tracker (`/routine`)**

- **States / events:** separate legacy-style tracker load → local/cloud restore → habits/checks/todos/wellness edits → save/sync/error/reload. It has its own habit/check/todo/week/water-goal model. Its standalone timer uses transient `focus/break`, `secs`, and `running` interval state; it is not the `/habit` timer and does not have the desktop timer’s timestamp recovery.
- **Persistence / recovery:** owner-scoped local state plus Supabase operations; a load timeout/error is surfaced with an explicit reload path. When local-only/guest, changes are saved locally. Do not merge this model with the `/habit` provider model.
- **Runtime anchors:** `src/pages/RoutineTracker.tsx`; `src/lib/routineStore.ts`; route in `src/App.tsx`.

**Money Tracker (`/money`)**

- **States / events:** transaction/goal/bill form state → local add/edit/delete or cloud operation → success/error; receipt image → `scan-receipt` extraction → insert transaction. It keeps local/owner-scoped records and pending cloud operations so the tracker remains usable through offline/network failure.
- **Persistence / recovery:** local owner-scoped queues/records, cloud tables when available, and retry/reconciliation paths; receipt scan output is transient until the user inserts the transaction.
- **Runtime anchors:** `src/pages/MoneyTracker.tsx`; `src/components/trackers/TrackerShell.tsx`; `supabase/functions/scan-receipt/index.ts`; route in `src/App.tsx`.

**Desktop workspace (`/home`, `/tasks`, `/calendar`, `/notes`, `/trash`, `/shared`, `/focus`, `/templates`)**

- Tasks persist `todo → doing → done` with due/status metadata; undo reinserts a removed task. Note metadata (favourite/pinned/status/previous folder), spaces, and desktop preferences are separate local records shared between desktop components. Trash/restore is a distinct desktop-note operation, not the main editor’s version history.
- The desktop focus panel has `pomodoro/countdown/stopwatch`; timer phases include idle/focus/short break/long break, pause/resume, completion, and session logging. Countdown uses an end timestamp and recomputes on visibility/focus; stopwatch uses start/base timestamps. State is persisted per owner on transitions (not every tick); corrupt saved state falls back to clean defaults. Completed focus sessions are stored separately.
- On desktop, `/shared` is a paste-and-open URL utility with a local recently-opened list (up to 12), not an ACL or public-share service. Same-site NikNote URLs navigate into the app; external URLs open in a new tab. Its “anyone can view” instructional copy is not backed by the active editor Share action, which shares plain text only; opening a notebook URL still reaches the editor’s owner check. The separate permission/invite `SharePanel` is unmounted (see §3).
- Desktop note/tasks/space/focus state is local owner-scoped storage; it is not the same database model as the main notebook editor or either tracker.
- **Runtime anchors:** `src/pages/DesktopHome.tsx`; `src/pages/DesktopTasks.tsx`; `src/pages/DesktopNotes.tsx`; `src/pages/DesktopTrash.tsx`; `src/pages/DesktopShared.tsx`; `src/pages/DesktopFocus.tsx`; `src/components/desktop/store.ts`; `src/components/desktop/notes.ts`; `src/components/desktop/focus/FocusTimerPanel.tsx`; `src/lib/focusClock.ts`.

### 1.10 Activity history, streaks, and achievements

- **Activity history (`/history`):** signed-out visitors are redirected to login. On mount, the page requests the current user’s newest 100 `activity_logs` rows and derives AI/export/page counts and “last active” from that same bounded batch—not lifetime totals. A fetch failure is only logged; loading ends with the normal empty state and there is no visible retry/error state, so an outage can look like “No activity yet.”
- **Cloud streak:** `useStreak` reads `user_streaks`; opening the active desktop home or achievements screen records app activity through `update_user_streak`. The SQL function is idempotent within a database `CURRENT_DATE`; yesterday increments, otherwise the streak restarts at 1. Guest-local users are skipped. The cloud row is the durable streak.
- **Separate local streak:** Account mounts `StudyStreakWidget`, which stores `niknote_streak_data` in local storage and auto-marks today active whenever the widget mounts (not only after a note-writing action). It calculates daily streaks locally. The hook auto-marks milestone rewards as `claimed`, while the widget popup searches for an unclaimed unlocked reward; these transitions are not a server reward or entitlement.
- **Achievements:** `/achievements` loads badge definitions and a user’s `user_badges`, then displays earned/locked. `earnBadge()` can insert an earned badge, but no product caller invoking it was found; do not infer automatic badge earning.
- **Runtime anchors:** `src/pages/History.tsx`; `src/hooks/useActivityTracker.ts`; `src/hooks/useStreak.ts`; `src/components/gamification/StudyStreak.tsx`; `src/pages/Account.tsx`; `src/pages/DesktopHome.tsx`; `src/pages/Achievements.tsx`; `src/hooks/useBadges.ts`; `supabase/migrations/20260410062823_0e26f5ae-35c4-46c4-b124-067664c59d6e.sql`.

### 1.11 Checkout, verified payments, entitlements, and password recovery

**Checkout / recovery**

- **States:** plan selection → order creation → checkout processing → verification → `success`, `pending`, or failure/retry. “Already paid?” calls verification/recovery without opening Razorpay. Receipt mail has a separate sent/retry indication.
- **Persistence:** browser stores a pending Razorpay order ID per user; server also stores the order in `checkout_orders`. The 2026-10-29 migration disables client table access and grants service-role access. `verify-razorpay-payment` checks the authenticated owner, plan, amount/currency, provider-captured payment, callback signature, and refund state before activation. Webhook validates its HMAC/provider data. Activation is through `activate_verified_purchase`, with the checkout row marked verified. `record-payment` rejects ordinary customer activation; its admin path is separate.
- **Receipt/recovery:** if the callback is missed, recovery finds the user’s recent created orders and can verify a specific saved order. The receipt retry path uses the verified purchase record; an email-delivery failure does not turn an unverified order into an entitlement.
- **Runtime anchors:** `src/pages/Payment.tsx`; `supabase/functions/create-razorpay-order/index.ts`; `supabase/functions/verify-razorpay-payment/index.ts`; `supabase/functions/razorpay-webhook/index.ts`; `supabase/functions/record-payment/index.ts`; `supabase/functions/_shared/payment-confirmation-email.ts`; `supabase/migrations/20261029170000_checkout_order_recovery.sql`.

**Entitlement/usage state**

- `PremiumContext` loads subscription/feature limits and `incrementUsage` upserts `feature_usage`; `usePremium` is a second implementation. The trial flag is `FREE_TRIAL = false`. The implementations should not be treated as identical.
- Source search found no product caller for `checkFeatureAccess` or `incrementUsage`; code for feature limits/usage exists, but consumption/enforcement through those helpers is not demonstrated. Individual backend functions may separately enforce auth/rate limits/paid access.
- **Runtime anchors:** `src/contexts/PremiumContext.tsx`; `src/hooks/usePremium.ts`; `src/components/premium/PricingPopup.tsx`; `supabase/migrations/20260414132519_4e78eb69-1bb8-41f1-9234-e2e73bb33bb8.sql`.

**Password reset**

- **States:** `request → sent`; a recovery URL starts `checking → update | expired`; valid recovery session permits password update → `done` → delayed redirect. PKCE `?code=` is exchanged for a session; hash recovery/error tokens are also recognized. Password mismatch/weakness/rate limits stay in form error state.
- **Persistence / recovery:** Supabase Auth owns reset links/session; link is single-use. The URL fragment/query is removed after a successful change. Form fields and stage are in memory; expired links return to a fresh request state.
- **Runtime anchors:** `src/pages/ResetPassword.tsx`; route in `src/App.tsx`; auth behavior in `src/contexts/AuthContext.tsx`.

### 1.12 Account, onboarding, feedback, institution inquiries, referral/share

**Account and usage panel (`/account`, `/account-details`)**

- Signed-out users are routed to login. The desktop/standalone Account page loads the newest 100 user `activity_logs` and the owner’s notebook count in parallel; activity summaries are calculated from that bounded batch. Activity-query failure is visible and has a Retry button. The notebook-count query’s error is not checked, so a count-query failure can display as zero while the rest of the page succeeds.
- Profile display is derived from the auth user’s metadata/email; the page does not save a separate editable profile form. Sign-out delegates to `AuthContext` and routes home, inheriting its pending guest-recovery behavior (§1.2). The separate Account OpenAI-key setting is local-only and is not the owner-scoped NikAI BYOK store (see §4, item 6).
- `/account` is wrapped responsively, so mobile renders `MobileExperience` rather than this full Account page; `/account-details` mounts Account directly. The Account page mounts `GuestUpgradeCard`, the generic promotion/share card, and the local streak widget covered elsewhere.
- **Runtime anchors:** `src/pages/Account.tsx`; `src/App.tsx`; `src/contexts/AuthContext.tsx`; `src/components/mobile/MobileExperience.tsx`.

**Active onboarding (`/onboarding`)**

- **States / events:** `welcome → usecase → exam → handwriting → ai-demo → tour → home`, or Skip → home. Use case/exam selection updates the profile for cloud users. Handwriting sample uploads to the private bucket. Completion/skip writes `niknote_onboarding_done` locally and updates `profiles.onboarding_completed` for cloud users.
- **Persistence / recovery:** profile answers/completion are cloud fields plus a browser-local done key; the current step itself is not persisted for resume. Handwriting upload is a cloud object. The “AI demo” only validates a topic, waits two seconds, and advances; it does not call AI or generate notes.
- **Runtime anchors:** `src/pages/Onboarding.tsx`; `src/App.tsx`; migration `supabase/migrations/20260414132519_4e78eb69-1bb8-41f1-9234-e2e73bb33bb8.sql`.

**Feedback (`/feedback`)**

- **States / events:** form draft → validation → submitting → submitted or error. Requires signed-in user, nonempty title/description, minimum lengths, and rating; a hidden honeypot short-circuits submission. Successful submit inserts a row in `feedback` and sets a 60-second browser-local cooldown.
- **Persistence / recovery:** feedback row is cloud-persisted. Cooldown is per browser, not a server idempotency token. Success state is React memory; refreshing does not restore the form’s success view.
- **Runtime anchors:** `src/pages/Feedback.tsx`; route in `src/App.tsx`.

**Institution inquiry (`/schools`, `/institutions`)**

- **States / events:** form draft → submitting → server validation/save → success toast or failure with email-support fallback. The `b2b-lead` Edge Function validates/sanitizes fields, infers segment, and inserts `sales_leads` at stage `new`; duplicate `(email, institution)` returns conflict rather than claiming the repeat was saved.
- **Persistence / recovery:** durable server lead; UI form data remains in component state after failure. The admin sales view is read-only and shows the latest 50 leads/stage; no stage-change workflow was found.
- **Runtime anchors:** `src/pages/B2BLanding.tsx`; `supabase/functions/b2b-lead/index.ts`; `src/components/admin/AdminSalesOverview.tsx`; `supabase/functions/sales-overview/index.ts`; `supabase/migrations/20261029171000_sales_overview.sql`.

**Referral and share surfaces**

- The active share card on Account/Welcome is just copy-link/WhatsApp sharing. The app startup `checkReferral()` accepts `?ref=` and writes a code/visit counter to browser local storage. This local attribution is not a paid conversion or entitlement grant.
- A separate `useReferral`/`src/components/referral/ReferralWidget.tsx` implementation derives a different code format and can upsert `referrals`, but that component has no product mount and `trackReferral()` has no product caller in the searched sources. `markReferralConversion()` also has no caller; the inspected payment verification path contains no referral reward transition. Treat the database reward flow as unwired/incomplete, not as a working “free Premium” machine.
- **Runtime anchors:** `src/App.tsx` (`checkReferral` startup); `src/utils/referral.ts`; active `src/components/promotion/ReferralWidget.tsx`; dormant `src/hooks/useReferral.ts`; dormant `src/components/referral/ReferralWidget.tsx`; `src/pages/Account.tsx`; `src/components/landing/LandingPage.tsx`.

### 1.13 Admin authentication, dashboards, user actions, sales, and welcome emails

**Admin session**

- **States / events:** credential form idle/submitting/error → Edge credential validation → server session created or rejected/rate-limited. Successful `admin-auth` creates a random token, stores only its SHA-256 hash in `admin_sessions`, and returns the raw token for `sessionStorage`; expiry is 24 hours. `AdminPanelNikhil.checkAdminStatus()` sends `action: validate` to the Edge Function, removes invalid/expired local token state, then falls back to a signed-in Supabase `user_roles` admin check.
- **Persistence / recovery:** database session is server-validated; raw token/expiry are tab-session storage and the login-page shortcut checks its local expiry before redirect. The legacy `/admin` route only checks the signed-in database role. `AdminPanelNikhil.handleLogout()` signs out Supabase and navigates home; the inspected handler does not call `admin-auth` with `action: logout` or explicitly clear the admin token, so server-side token revocation is not established for that UI action (session remains until expiry unless otherwise revoked).
- **Runtime anchors:** `src/pages/AdminLogin.tsx`; `src/pages/AdminPanelNikhil.tsx`; `src/pages/Admin.tsx`; `supabase/functions/admin-auth/index.ts`; `supabase/migrations/20260205053811_2ac1b590-a9b2-401e-b1ea-3210f69dc1f2.sql`.

**Admin dashboards/actions**

- `AdminPanelNikhil` loads dashboard snapshots, supports manual refresh, subscribes to selected Postgres changes while admin, and refreshes some metrics every 60 seconds. Tabs, selected user, drawers, filters, and charts are client state; source records remain in their underlying Supabase tables.
- `AdminCommandCenter` loads a service-authorized user list/detail, then actions such as grant/revoke premium, set coins, ban/unban, delete account, and grant/remove admin role. The Edge Function validates either a hashed admin-session token or a valid JWT with admin role before service-role mutations. Successful actions reload the user list.
- The separate legacy `/admin` page also has role-gated user/subscription listing and calls `record-payment`; the Edge Function permits its admin operation but rejects non-admin/customer activation via that endpoint. Its profile query does not select an email address but maps `display_name` into the displayed `email` field, so that column is not a verified email.
- **Runtime anchors:** `src/pages/AdminPanelNikhil.tsx`; `src/pages/Admin.tsx`; `src/components/admin/AdminCommandCenter.tsx`; `supabase/functions/admin-user-management/index.ts`; `supabase/functions/record-payment/index.ts`.

**Sales overview and welcome email studio**

- Sales overview is read-only: request → server validates admin session or admin-role JWT → service-only `sales_overview()` returns verified capture count/gross paise and recent inquiries. UI refresh is transient; those figures are a verified capture ledger, not bank settlement/net revenue.
- Email Studio: choose 7/30/90-day recent window → load confirmed, non-admin, non-guest recipients → select up to 25 → confirm/send → per-recipient `accepted/skipped/failed` results and audit status → reload recipient list. The Edge Function only sends a fixed template one message at a time, uses an idempotency key per recipient/template, and writes `customer_email_logs`; failures/audit-log failure are surfaced separately. There is no campaign/job state persisted in the browser.
- **Runtime anchors:** `src/components/admin/AdminSalesOverview.tsx`; `src/components/admin/AdminEmailStudio.tsx`; `supabase/functions/sales-overview/index.ts`; `supabase/functions/admin-welcome-email/index.ts`; `supabase/functions/_shared/admin-welcome-email.ts`; `supabase/migrations/20261029171000_sales_overview.sql`.

### 1.14 Consent, analytics, PWA install, diagnostics, and promotions

- **Consent:** unset → delayed banner or explicit settings → accept all, reject non-essential, or save separate analytics/marketing switches. Essential is always true. Choice/timestamp are in local storage; updates dispatch a custom event. Tracker initialization and route/page-view delivery are consent-gated; analytics/marketing consent are separate.
- **PWA install:** `beforeinstallprompt` availability → prompt offered → accepted/dismissed; accepted/dismissed decisions are remembered locally, with dismissal suppression for seven days. Service worker registers only in production, calls update, and reports activation/update; registration errors are non-critical.
- **Pricing Popup:** global eligibility waits for auth/premium and consent state, suppresses checkout/auth/B2B routes, opens after a delay, and remembers the session plus a week-scale dismissal. Route changes close it on suppressed destinations.
- **Exit intent:** active under `/welcome` through the landing page; desktop mouse-leave or mobile inactivity may open it once per tab session. Closing/CTA state is transient; CTA routes to payment/signup.
- **Diagnostics:** `/checkup` runs real browser/network/device probes in parallel and renders per-check `ok/warn/fail`; its results/probe JSON are transient. `/qa` is a QA harness, not a persisted user workflow (see §3).
- **Runtime anchors:** `src/lib/consent.ts`; `src/components/CookieConsent.tsx`; `src/lib/tracking.ts`; `src/hooks/usePWAInstall.ts`; `src/components/InstallBanner.tsx`; `src/hooks/useServiceWorkerRegistration.ts`; `src/components/premium/PricingPopup.tsx`; `src/components/urgency/ExitIntentPopup.tsx`; `src/pages/Welcome.tsx`; `src/lib/appHealth.ts`; `src/pages/Checkup.tsx`; `src/pages/QA.tsx`.

---

## 2. Transient UI state versus durable state

These are useful to recognize but should not be mistaken for independent persistent machines:

| Surface | Transient state | Durable part / boundary |
|---|---|---|
| Auth screens | Input fields, auth tab, `busy`, error/success animation | Auth session, guest vault/offline user, and redirect key are persisted as described in §1.2. |
| Editor | Focused block, selection, open panels, page index, dictation capture, undo/redo stack | Owner/document content and local draft are saved by editor/sync paths; no active version-history component was found. |
| NikAI | Composer text, pending images, current stream, thinking display, selected mode/model, open menus | Threads, memory, and NikAI provider keys are local owner-scoped records, not cloud thread storage; Account’s legacy OpenAI-key field is a separate global localStorage key (see §4, item 6). |
| Document/OCR/PDF | Preview file, OCR progress, extraction result, password field, current tool settings, export progress | Accepted note content, local scan list, session PDF edits, or generated download only where explicitly listed in §1.6–1.7. |
| Board and trackers | Upload queue, recorder state, active form/modal, timer tick display, toast and errors | Board cloud/local draft and tracker-specific stores are separate. A status label does not itself mean a server row exists. |
| Admin | Active tab, filters, selected user, loaded data snapshots, email selection/summary | Admin data mutations and email audit rows persist server-side; view/filter state does not. |
| Feedback/B2B/onboarding | Form values, spinner, toast, current step, success panel | Feedback/leads/profile fields/sample upload persist only after their respective server write succeeds. |
| Consent/install/popup | Banner visibility, settings panel, prompt instance, dialog animation | Consent, install response/dismissal, and popup suppression keys are the durable pieces. |

A type such as `loading`, `success`, `failed`, `BlockType`, or `TaskStatus` is only a declaration. Runtime handlers and call sites above determine whether it is a real active transition and what it persists.

---

## 3. Simulations, unwired implementations, and type-only evidence

### 3.1 Simulated or test/developer-oriented flows

| Implementation | What is present | Audit classification |
|---|---|---|
| Onboarding AI demo | Topic field and two-second timeout before moving to the next step; no AI request | Simulated step inside otherwise active onboarding. `src/pages/Onboarding.tsx`. |
| `/audit` Audit Reports | Sends fixed, hard-coded app-context seed strings/instructions to AI; reports persist in browser local storage | Active report-generation UI, but it does not inspect repository files, telemetry, or actual system state. Treat the “audit” output as generated advice, not an automated code/system audit. `src/pages/AuditReports.tsx`. |
| Admin “System Check” | Auth/database/subscription queries are attempted; Export Functions, Mobile Layout, and some payment status checks are appended as fixed/pass-like results | Mixed diagnostic and hard-coded statuses, not a complete operational health check. `src/pages/AdminPanelNikhil.tsx`. |
| QA Dashboard | Runs `qaRunner.runCycle()` repeatedly and renders in-memory cycle results | QA/test harness, not a user-data workflow; results are not persisted as application records. `src/pages/QA.tsx`; `src/utils/qa/testRunner.ts`. |
| Workflow canvas | Displays/simulates node behavior in UI | Not a wired product automation execution path. `src/components/workflow/WorkflowCanvas.tsx`. |

### 3.2 Implementations with no product runtime caller found

| Candidate | Evidence boundary |
|---|---|
| `src/pages/AgentConsole.tsx` | `App.tsx` declares a lazy import but no `<Route>` uses it. `/agents` is routed to NikAI instead. Its AI state is therefore not an active route from the current router. |
| `src/pages/AppWorkspace.tsx` | No route/caller found; `/app` is a legacy redirect to the editor. |
| `src/components/OnboardingFlow.tsx` | Separate three-step local font wizard, no mount/caller found. Active onboarding is `src/pages/Onboarding.tsx`. |
| `src/components/editor/BlockEditor.tsx` and nested `BlockCommentsThread.tsx` | No `<BlockEditor>` application mount found. The thread is composed inside that unmounted editor, so it is not evidence of active block comments. The main editor instead mounts `NotionEditor`. |
| `src/components/editor/VersionHistory.tsx` | No caller found; no active version-history save/restore workflow established. |
| `src/components/sharing/SharePanel.tsx`; `src/components/collaboration/PresenceSystem.tsx`, `CommentsPanel.tsx`, `NotificationSystem.tsx`, `ActivityFeed.tsx` | No product mount/caller found in the searched app sources. Their types/statuses do not establish live sharing/collaboration. |
| `src/components/editor/InlineAIMenu.tsx` | Uses `useAIStream`, but no application mount found. `useAIStream` itself has other active consumers. |
| `src/components/handwriting-dna/HandwritingStudio.tsx` | No product mount found; the editor scanner (`HandwritingScanner`) is a distinct active component. |
| `src/components/referral/ReferralWidget.tsx`; `src/hooks/useReferral.ts` | No product mount/call to `trackReferral()` found. This is distinct from the active share-only `src/components/promotion/ReferralWidget.tsx`. |
| `src/services/workflow/WorkflowEngine.ts` | Execution logic exists and was found in workflow security tests, but no product caller found. Do not infer a runtime workflow engine from its status enum or tests. |
| `src/services/knowledge/KnowledgeEngine.ts` | Contains in-memory ingest/search and Supabase persistence code, but only test instantiations were found. No product caller found. A later-dated migration defines owner-RLS-protected `knowledge_documents`; schema presence does not wire this engine into a user path. |
| `src/services/agents/MultiAgentSystem.ts` | No product caller found. Do not infer an active multi-agent route from agent type declarations. |
| `src/services/ocr/OCREngine.ts` | Found through the unmounted/test-oriented workflow engine path, not as the active ScanNotes/PDF OCR implementation. |
| `supabase/functions/secure-image-upload/index.ts` | Edge upload implementation exists, but no direct frontend invocation string/caller was found in the searched sources. The main editor’s observed image insertion reads a data URL into a block. Do not claim this endpoint backs that active path. |

### 3.3 Type declarations and schema descriptions are not machines

- `src/integrations/supabase/types.ts` describes typed tables, RPCs, and row shapes. It does not prove that a table is deployed, that a component writes it, or that a transition is reachable. Migrations and runtime callers are separate evidence.
- `src/types/block.ts`, `src/types/noteLine.ts`, and `src/types/notes.ts` define content/configuration shapes and unions. Their `BlockType`, color/font/style, and history interfaces are data contracts; only mounted editors/handlers establish active behavior.
- `src/vite-env.d.ts` is Vite environment typing only.
- `AgentType`, `WorkflowNodeType`, `OCRMode`, admin DTOs, and UI status unions likewise do not demonstrate a route or active workflow without the call path described above.

---

## 4. Important implementation divergences and schema-evidence limits

1. **Three different note/data surfaces:** main editor notebook pages (`Index`/`useNotebookPages`), local scan records (`ScanNotes`), and desktop notes/trash (`components/desktop/notes.ts`) have different IDs, stores, and recovery rules. Do not assume a save in one automatically creates a record in another.
2. **Separate timer machines:** `/habit` focus uses provider state/end timestamp; `/routine` uses an interval-oriented local timer; `/focus` has the desktop timestamp-based Pomodoro/countdown/stopwatch and separate sessions. They are not one shared timer record.
3. **Two streak models:** cloud `user_streaks` is app-open activity and database-date based; `StudyStreakWidget` is a local browser counter that marks activity on widget mount. Their totals/rewards can disagree.
4. **Referral reward claims are not wired end-to-end:** active sharing is a generic link; the local referral helpers do not prove a conversion; the DB hook has no product caller; no paid-conversion/reward transition was found in payment verification. Do not report “refer friends to unlock premium” as a functioning state machine based on these implementations alone.
5. **Entitlement code is not uniformly consumed:** `PremiumContext` and `usePremium` are separate; usage helpers have no product callers found. Verify per-feature backend checks rather than assuming all UI gates use one counter.
6. **Editor AI vs NikAI:** inline `@` AI uses `AgentOrchestrator` and writes a document block; the unified workspace stores local chat threads. `useAIStream` is another hook and some consumers are unmounted. These are related provider paths, not one conversation store. The Account page’s legacy OpenAI-key control stores `niknote_openai_key` globally in browser `localStorage`; searches found no active AI-engine reader for that key. NikAI’s own BYOK settings use a separate owner-scoped `niknote.ai.keys.v1` record, so the Account control should not be assumed to configure the active workspace and may remain across account changes on the same browser.
7. **Sharing is not the same as public access:** the active editor Share button sends/copies plain note text. `/shared` only accepts pasted URLs and keeps local open history. The permission/invite `SharePanel` has no product mount, and the editor enforces notebook ownership on open; no active public-link/ACL workflow was established.
8. **Potential schema provenance gap:** checked-in migrations create `admin_sessions`, `checkout_orders`, `feature_usage`, `activity_logs`, `badges`/`user_badges`, `user_streaks`, the service-owned `anon_ai_limits`/`consume_anon_quota` guest-creation quota, notebook favorites, and the service-only `sales_overview()` function. Despite the `anon_ai` name, `consume_anon_quota` is called by the `guest-session` Edge path, not by the AI request guard. The active functions also reference `sales_leads`, `customer_email_logs`, `mailflare_config`, and `verified_payments`; the migration search did not find their table-creation DDL. The payment-verification path calls `activate_verified_purchase`, but no checked-in migration defining that RPC was found; the sales overview separately reads `verified_payments`, whose table-creation DDL was also not found. `referrals`/`verified_payments` and some RPCs appear in generated types, which is not proof of deployed schema. `openai-brain` calls `consume_ai_quota` from `aiSecurity.ts`, but no checked-in migration defining that RPC was found either. This is a repository evidence gap only: no live database introspection was performed, so it does not establish whether the tables/functions exist in the deployed project.
9. **Future-dated migration files:** the checked-out tree also contains migrations dated 2026-11-11 for `notebooks.settings` and owner-RLS-protected `knowledge_documents`, after this inventory’s 2026-11-04 audit date. They are source declarations, not evidence that they were applied. `KnowledgeEngine` has table persistence code/tests but no product caller found.
10. **Admin logout path:** server-side admin-session validation is present, but the main admin-panel logout handler observed only signs out Supabase and navigates away; it does not invoke the Edge Function logout action or explicitly clear `admin_token`. This is relevant to token/session lifecycle, independent of the product workflow inventory.

## 5. Primary route and source index

| Workflow surface | Route(s) | Primary entry / state owner |
|---|---|---|
| Home/editor | `/home`, `/editor/:documentId` | `src/App.tsx`, `src/pages/Index.tsx`, `src/pages/DesktopHome.tsx`, `src/components/mobile/MobileExperience.tsx` |
| Notebook library/favorites | `/notebooks-classic`; editor sidebar/header favorites | `src/pages/MyNotebooks.tsx`, `src/hooks/useNotebooks.ts`, `src/components/workspace/WorkspaceSidebar.tsx` |
| Auth/reset/onboarding | `/login`, `/signup`, `/auth`, `/reset-password`, `/onboarding` | `src/contexts/AuthContext.tsx`, `src/components/auth/NiknoteAuth.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/Onboarding.tsx` |
| AI | `/ai`, `/nikai`, `/ai-workspace`, `/agents`, `/ai-solver`, `/ai-classic` | `src/components/nikai/NikAIWorkspace.tsx`, `src/lib/aiEngine.ts`, active editor `src/components/editor/NotionEditor.tsx` |
| Documents/PDF/OCR | `/documents`, `/scan-notes`, `/pdf`, `/pdf-editor`, `/pdf-tools` | `src/components/document-intelligence/DocumentIntelligence.tsx`, `src/pages/ScanNotes.tsx`, `src/components/pdf-studio/PdfStudio.tsx`, `src/components/pdf-tools/PdfTools.tsx` |
| Planning/study | `/board`, `/playground`, `/flashcards`, `/habit`, `/routine`, `/money` | `src/pages/Board.tsx`, `src/pages/Playground.tsx`, `src/pages/Flashcards.tsx`, `src/components/habits/RoutineProvider.tsx`, `src/pages/RoutineTracker.tsx`, `src/pages/MoneyTracker.tsx` |
| Desktop shell | `/tasks`, `/calendar`, `/notes`, `/trash`, `/shared`, `/focus`, `/templates` | `src/components/desktop/store.ts`, `src/components/desktop/notes.ts`, `src/components/desktop/focus/FocusTimerPanel.tsx` |
| Account/achievement/admin | `/account`, `/history`, `/achievements`, `/admin`, `/admin-login`, `/admin-panel-nikhil` | `src/pages/Account.tsx`, `src/pages/History.tsx`, `src/pages/Achievements.tsx`, `src/pages/Admin.tsx`, `src/pages/AdminPanelNikhil.tsx` |
| B2B/feedback | `/schools`, `/institutions`, `/feedback` | `src/pages/B2BLanding.tsx`, `src/pages/Feedback.tsx`, `supabase/functions/b2b-lead/index.ts` |
| Global consent/install/promotion | all router-mounted pages with route suppression | `src/App.tsx`, `src/components/CookieConsent.tsx`, `src/components/InstallBanner.tsx`, `src/components/premium/PricingPopup.tsx` |
