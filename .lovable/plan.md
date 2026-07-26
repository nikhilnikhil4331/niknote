# Make Every Function Actually Work — NikNote Editor

Goal: har button, slash-command, aur block type ka real behavior. Notion-parity where feasible in this codebase.

## Scope (in order)

### 1. Slash menu + block types (BlockEditor.tsx)
- Fuzzy-search working `/` menu with keyboard nav (↑↓ Enter Esc)
- Insert & fully edit these block types: `text`, `heading1/2/3`, `bulleted`, `numbered`, `todo` (checkbox toggle), `toggle` (collapsible), `quote`, `callout`, `divider`, `code` (with language + copy), `flashcard` (new), `image`, `table` (existing TableBlock wired in)
- Enter/Backspace/Tab behavior per block (indent, outdent, split, merge)
- Block hover toolbar buttons all wired: drag handle, duplicate, delete, turn-into, comment, AI

### 2. Flashcards + Study Mode (new)
- `flashcard` block: front / back inline edit, click to flip (framer-motion)
- `/flashcards` route: review all flashcards from all pages
- Simple SM-2-lite spaced-repetition (Again / Hard / Good / Easy)
- Progress stored in `flashcard_reviews` table (user_id, block_id, ease, due_at, interval)

### 3. Drag-and-drop reorder
- Native HTML5 DnD on block rows with drop indicators
- Works with keyboard (Alt+↑ / Alt+↓) too

### 4. AI menu end-to-end (InlineAIMenu)
- Confirm all 8 actions stream, Diff view toggles, Accept/Reject/Retry buttons work, error toast on 402/429

### 5. Comments + Mentions + Backlinks
- `@` popup: real search across `profiles` + `notebooks` (debounced)
- Block comments: open thread on button click, realtime, resolve/delete works
- Backlinks panel: shows blocks that mention current page

### 6. Global wiring pass
- Verify every button in AppHeader, BottomNavBar, StepStyle, StepPreview, Dashboard, MyNotebooks, Handbook, AgentConsole, AuditReports calls its handler and produces visible feedback (toast + haptic)
- Fix any dead `onClick={() => {}}` stubs found during pass

## Technical

**New table**
```sql
flashcard_reviews(user_id uuid, block_id text, ease numeric default 2.5,
                  interval_days int default 0, due_at timestamptz default now(),
                  reps int default 0, last_reviewed_at timestamptz)
-- PK (user_id, block_id), RLS: own rows only, GRANTs to authenticated + service_role
```

**Files touched (major)**
- `src/components/editor/BlockEditor.tsx` — slash menu fuzzy + DnD + keybinds + flashcard render
- `src/components/editor/SlashCommandMenu.tsx` — add flashcard, fix ordering
- `src/components/editor/blocks/FlashcardBlock.tsx` — NEW
- `src/pages/Flashcards.tsx` — NEW (study mode)
- `src/hooks/useFlashcards.ts` — NEW (SRS scheduling)
- `src/components/editor/BacklinksAndMentions.tsx` — wire real query
- `src/components/editor/MentionPopup.tsx` — Supabase search
- `src/components/editor/BlockContextMenu.tsx` — wire duplicate/turn-into/delete
- `src/App.tsx` — add `/flashcards` route
- `src/components/app/BottomNavBar.tsx` — add Flashcards entry

**Non-goals (this pass)**
- Real-time multi-cursor collab
- Full database views (Kanban/Calendar/Gallery already stubbed — left as-is)
- Rich-text formatting toolbar (bold/italic inline) — separate follow-up

## Delivery order
1. DB migration for `flashcard_reviews` (needs approval first)
2. Flashcard block + study page + SRS hook
3. Slash menu + DnD + block behaviors polish
4. Mentions/comments/backlinks real queries
5. Dead-click sweep across pages
6. Manual smoke test via Playwright, screenshots to confirm.
