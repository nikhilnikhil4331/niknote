# Sprint 2 — Collaborative & Interactive Editor Layer

Mobile-first, no new heavy deps. Builds on Sprint 1's `BlockEditor` + `InlineAIMenu` + `editor-ai` streaming function. Framer Motion stays pinned at ^11.15.0.

## 1. Inline AI Diff Preview
Extend `InlineAIMenu` so Improve / Fix / Translate / Shorten stream into a **diff view** instead of replacing text immediately.
- New `src/components/editor/AIDiffView.tsx`: word-level diff using a tiny in-house LCS (no dep). Removed = red strikethrough, added = green highlight, unchanged = muted.
- Sheet gets three actions: **Accept**, **Reject**, **Regenerate**. Accept commits to the block; Reject closes; Regenerate re-runs same action.
- Continue / Summarize / Explain skip diff (they append or produce net-new content) — keep current flow.

## 2. @Mention Popup
- New `src/components/editor/MentionPopup.tsx` — portal-positioned popup (reuses SlashCommandMenu positioning pattern) with tabs: People, Pages, Tasks.
- Data sources:
  - People: `profiles` table (id, display_name, avatar).
  - Pages: `notebooks` (id, title).
  - Tasks: derive from current doc's `todo` blocks.
- Fuzzy search via existing `filteredCommands`-style filter; debounced (`useDebounce`, 120ms).
- Trigger: typing `@` in a block input. Insert token `@[type:id|label]` at cursor; render as pill via a small parser in the block textarea's display (kept as plain text in storage, styled in preview only for now).
- Keyboard nav (↑↓ Enter Esc) matches slash menu.

## 3. Block-Level Comments
- Migration `supabase/migrations/xxxx_block_comments.sql`:
  - `block_comments` (id, block_id text, notebook_id uuid, thread_id uuid, author_id uuid, body text, mentions jsonb, created_at, updated_at, deleted_at nullable).
  - GRANTs to `authenticated` + `service_role`; RLS: users can select/insert/update/delete their own; select all in notebooks they own.
- UI:
  - `src/components/editor/BlockCommentsThread.tsx` — thread panel (mobile bottom sheet, desktop right rail).
  - Comment icon appears in block hover toolbar (`BlockEditor`); badge shows count.
  - Composer supports `@` mentions (reuses MentionPopup). Mentions stored in `mentions` jsonb.
- Realtime subscription per open thread via Supabase channel.

## 4. Drag-and-Drop Block Reordering
- Native HTML5 DnD (already used in `KanbanView`) — no new dep.
- Drag handle already exists in `BlockEditor` hover toolbar; make it `draggable`.
- Show blue insertion line between blocks during drag (CSS pseudo-element toggled via `dragover`).
- Uses existing `moveBlock`/`setBlocks` from `useBlockEditor`; add `moveBlockToIndex(id, index)` helper.
- Preserve focused block id across move; disable text selection during drag.
- Mobile: long-press (400ms) on drag handle enables drag via touch events (polyfilled with pointer events).

## 5. Slash Command Menu Wiring
Menu component (`SlashCommandMenu.tsx`) already exists. Wire it into `BlockEditor`:
- On `/` at empty position, capture query until space/Esc, show menu at caret coords.
- Selection converts current block to chosen type via `convertBlock` (or inserts new block for media types).
- Add a few **template** commands (weekly review, meeting notes) that expand into multiple blocks.

## Technical notes
- All new UIs use existing Tailwind tokens; no hardcoded colors.
- Framer Motion only for sheet/popup enter/exit — already imported.
- Typecheck via `tsgo` after each phase.
- Backend rules: RLS + GRANT on every new public table (per project rules).

## Order of execution
1. Slash menu wiring (smallest, unblocks demo of block insertion).
2. Drag & drop (self-contained, visual win).
3. Diff preview (extends existing sheet).
4. @Mention popup (shared by comments).
5. Comments (migration + UI + realtime).

## Out of scope this sprint
- Rich pill rendering of mentions inside textareas (needs contenteditable rework — deferred).
- Comment resolution/threading beyond flat replies.
- Cross-doc mention navigation.
