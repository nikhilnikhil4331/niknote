## Sprint 1 — AI-First Editor Layer (Mobile-First)

Scope committed based on your answers: **AI layer first**, **fix TS errors first**, **mobile first**. Later sprints will handle command palette v2, @mentions across people/pages, missing block types, virtualization, collab, and version history.

---

### Phase 1 — TypeScript cleanup pass (unblock refactor)

Fix the ~60 pre-existing errors in one pass so the AI work doesn't fight the compiler.

Buckets:
1. **Missing icon/module imports** — `Zap`, `Toast`, etc. (find via `tsgo`, add imports).
2. **Supabase generated types drift** — add missing tables (`analytics_events`, `notebook_pages`, etc.) via a lightweight `types-augment.d.ts` module augmentation rather than regenerating (safer).
3. **HandwritingDNA type renames** — align call sites to current interface in `HandwritingDNAContext`.
4. **Node types** — replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` project-wide.
5. **Blog `date` field, misc prop mismatches** — patch call sites.

Exit criteria: `bunx tsgo --noEmit` clean, app still boots.

---

### Phase 2 — AI backend (server boundary)

Add ONE streaming Edge Function that powers every AI action.

- `supabase/functions/editor-ai/index.ts` — streaming chat via AI SDK + Lovable AI Gateway (`google/gemini-3.6-flash` default). Accepts `{ action, blocks, selection, mentions, instruction }`.
- Actions: `rewrite`, `improve`, `shorten`, `lengthen`, `translate`, `summarize`, `continue`, `explain`, `fix_grammar`, `custom`.
- Streams `UIMessage` deltas via `toUIMessageStreamResponse`.
- Uses `_shared/ai-gateway.ts` helper (create if absent).
- Rate limit per user (reuse existing `rate_limits` table).

---

### Phase 3 — Mention-aware context resolver (lightweight v1)

Not full @mention UI yet — just the context plumbing the AI layer needs.

- `src/lib/editor/context.ts` — given current block + selection, gather:
  - Current block text
  - Previous/next 3 blocks (surrounding context)
  - Any `@notebook:<id>` tokens in the instruction → fetch that notebook's blocks
  - Current page title
- Returns a compact context object sent to the edge function.

Full @people/@pages picker UI ships in Sprint 2.

---

### Phase 4 — Mobile-first inline AI menu (the headline UX)

New component `src/components/editor/InlineAIMenu.tsx`:

- **Mobile**: bottom sheet (drawer) that slides up when user taps the ✨ AI button on a block or long-presses selected text. Full-width, thumb-reachable action list, large tap targets (min-h-11), swipe-to-dismiss.
- **Desktop**: floating popover anchored to selection/block.
- Action list: Improve · Fix grammar · Shorten · Lengthen · Continue writing · Summarize · Translate → · Explain · Custom prompt…
- Streaming preview area with **Accept / Retry / Discard** buttons.
- Diff-style highlight of proposed change vs original.
- Escape / tap-outside / back-gesture dismiss.

Integration points:
- `BlockEditor` block hover/focus → show ✨ handle (mobile: always visible on active block).
- Text selection → floating "Ask AI" pill (mobile: appears above selection, above keyboard).
- Result stream writes into a preview overlay; on Accept, replaces block content and pushes to undo stack.

---

### Phase 5 — `/ai` slash commands

Extend existing `SlashCommandMenu` and `types/block.ts`:

- New AI category commands:
  - `/ai write` — freeform prompt → new block(s)
  - `/ai continue` — extend from cursor
  - `/ai outline` — generate outline from a topic
  - `/ai brainstorm` — bullet ideas
  - `/ai summarize page` — full-page summary block
  - `/ai translate page` — page-level translation
- Each opens a compact prompt input inline; streams result into the block.
- Mobile: prompt input auto-focuses and keeps keyboard open; scroll-into-view above keyboard.

---

### Phase 6 — Mobile keyboard & viewport polish

Fixes that make the AI UX feel native on phones:

- Replace `h-screen` with `h-dvh` on editor surfaces.
- Visual Viewport API listener → keep active block + AI sheet above the keyboard.
- Prevent iOS input zoom (font-size ≥16px on all editor inputs).
- Haptic feedback on Accept/Discard (reuse `useHaptics`).
- Prevent body scroll when AI sheet is open.

---

### Phase 7 — QA loop

- Manual test matrix on mobile viewport (375×667, 390×844) via Playwright screenshots.
- Verify: each action streams, Accept replaces content, Retry re-runs, Discard restores, keyboard doesn't cover input, undo works after Accept.
- AI Gateway log check (`list_ai_gateway_requests`) after each action to confirm real calls succeed.
- Fix any 400/429/402 handling — surface toasts.

---

### Technical details

**Files created:**
- `supabase/functions/editor-ai/index.ts`
- `supabase/functions/_shared/ai-gateway.ts` (if missing)
- `src/components/editor/InlineAIMenu.tsx`
- `src/components/editor/AIActionSheet.tsx` (mobile drawer)
- `src/components/editor/AIStreamPreview.tsx`
- `src/lib/editor/context.ts`
- `src/lib/editor/aiActions.ts`
- `src/hooks/useAIStream.ts`

**Files modified:**
- `src/components/editor/BlockEditor.tsx` — add AI trigger handles, integrate menu
- `src/components/editor/SlashCommandMenu.tsx` — wire `/ai` prompt input
- `src/types/block.ts` — extend `ai-generated` block metadata
- `src/index.css` — sheet animations, keyboard-aware padding
- ~20 files touched during Phase 1 typecheck cleanup

**Model routing:** default `google/gemini-3.6-flash` streaming through `@ai-sdk/openai-compatible` + Lovable AI Gateway. No OpenAI Responses API needed for v1 (no reasoning UI in Sprint 1).

**Out of scope for this sprint** (Sprint 2+):
- Full @mention picker UI (people/pages/dates)
- Emoji picker rebuild
- Command palette v2 with previews
- New block types (toggle, columns, table v2, equation, embed, TOC)
- Virtualization for 10k+ blocks
- Version history, comments, collaboration
- Autosave overhaul

---

Approve to start with Phase 1 (typecheck cleanup). If you want a different sequencing (e.g. skip cleanup, or start directly with the inline AI menu), tell me and I'll adjust.