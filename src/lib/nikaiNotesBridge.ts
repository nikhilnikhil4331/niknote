// ============================================================
// NikAI <-> NikNote Deep Notes Implementation Bridge
// Converts rich Markdown responses directly into multi-ink,
// structured NikNote Blocks, saves to Device + Cloud Notebooks,
// opens directly inside Handwriting Canvas, or extracts Flashcards!
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import type { Block } from '@/types/block';
import type { Json } from '@/integrations/supabase/types';
import { markdownToStructuredLines, structuredToBlocks } from '@/lib/noteStructure';
import { isCloudUserId, notifyLocalDataChanged } from '@/lib/cloudSyncEngine';
import { upsertLocalNoteForOwner } from '@/lib/localNoteStore';
import { ownerScopedStorageKey } from '@/lib/ownerScopedStorage';

export interface SavedNikNoteResult {
  notebookId: string;
  title: string;
  blockCount: number;
  flashcardCount: number;
}

/**
 * Convert NikAI Markdown through the same parser as live AI insertion, so a
 * saved Smart Note and the active handwriting editor keep identical structure.
 * Markdown headings, tasks, tables, images, chart fences, equations and code
 * therefore all persist as their matching NikNote blocks.
 */
export function markdownToRichNikNoteBlocks(markdown: string): Block[] {
  return structuredToBlocks(markdownToStructuredLines(markdown));
}

/**
 * Extracts study flashcards automatically from headings/bullet definitions/MCQs
 * and stores them into NikNote's local flashcard deck (`niknote-flashcards-v1`).
 */
export function extractAndSaveFlashcardsFromMarkdown(topicTitle: string, markdown: string, ownerId?: string): number {
  const cards: { id: string; front: string; back: string; deck: string; createdAt: number }[] = [];

  // 1. Extract "**Term:** Definition" or "**Term** — Definition" bullets & numbered items
  const bulletDefs = markdown.matchAll(
    /(?:[-*•]|\d+\.)\s+\*\*([^*:]{2,60}):?\*\*\s*[:—-]?\s*([^\n]{6,260})/g
  );
  for (const m of bulletDefs) {
    cards.push({
      id: `fc-${Date.now()}-${cards.length}`,
      front: m[1].trim(),
      back: m[2].trim(),
      deck: topicTitle,
      createdAt: Date.now(),
    });
  }

  // 2. Extract MCQs if quiz mode
  const mcqs = markdown.split(/(?=###\s*Q\d+[.:)\s])/i).filter((b) => /^###\s*Q\d+/i.test(b.trim()));
  for (const block of mcqs) {
    const q = block.match(/^###\s*Q\d+[.:)\s-]*(.+)$/im)?.[1]?.trim();
    const ans = block.match(/^\*{0,2}Answer\s*:?\*{0,2}\s*([^\n]+)/im)?.[1]?.trim();
    const exp = block.match(/^\*{0,2}Explanation\s*:?\*{0,2}\s*([^\n]+)/im)?.[1]?.trim();
    if (q && ans) {
      cards.push({
        id: `fc-q-${Date.now()}-${cards.length}`,
        front: q,
        back: exp ? `Answer: ${ans} — ${exp}` : `Answer: ${ans}`,
        deck: topicTitle,
        createdAt: Date.now(),
      });
    }
  }

  if (cards.length === 0) return 0;

  try {
    const storageKey = ownerScopedStorageKey('niknote-flashcards-v1', ownerId);
    const raw = localStorage.getItem(storageKey);
    const existing = raw ? JSON.parse(raw) : [];
    const merged = [...cards, ...(Array.isArray(existing) ? existing : [])].slice(0, 200);
    localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch {
    // ignore storage quota
  }

  return cards.length;
}

/**
 * Saves a NikAI response as a full multi-block NikNote Notebook (both local device
 * storage AND Cloud `notebooks` + `pages` when authenticated) AND optionally prepares
 * the Handwriting Editor canvas for immediate 1-tap opening!
 */
export async function implementNikAINote(params: {
  markdown: string;
  fallbackTitle?: string;
  userId?: string;
  pageStyle?: string;
  prepareEditorOpen?: boolean;
}): Promise<SavedNikNoteResult> {
  const heading = params.markdown.match(/^##?\s+([^\n#*]+)$/m)?.[1]?.trim();
  const title = (heading || params.fallbackTitle || 'NikAI Smart Study Notes').slice(0, 80);
  const blocks = markdownToRichNikNoteBlocks(params.markdown);
  const now = new Date().toISOString();
  let notebookId = `local-${Date.now()}`;

  // 1. Always save a device copy. Known workspaces get an owner tag so this
  // cache stays private across account changes; only a no-auth legacy session
  // writes the original unclaimed device keys.
  const localNotebookId = notebookId;
  const localNotebook = {
    id: localNotebookId,
    title,
    blocks,
    content: params.markdown,
    page_style: params.pageStyle || 'ruled',
    tags: ['NikAI', 'Smart Notes'],
    created_at: now,
    updated_at: now,
  };
  if (params.userId) {
    upsertLocalNoteForOwner(localNotebook, params.userId, { is_favorite: true });
  } else {
    try {
      const mobileListRaw = localStorage.getItem('niknote.mobile.notebooks.v1');
      const mobileList = mobileListRaw ? JSON.parse(mobileListRaw) : [];
      localStorage.setItem(
        'niknote.mobile.notebooks.v1',
        JSON.stringify([localNotebook, ...(Array.isArray(mobileList) ? mobileList : [])])
      );

      const notesRaw = localStorage.getItem('niknote.notes.v1');
      const notesList = notesRaw ? JSON.parse(notesRaw) : [];
      localStorage.setItem(
        'niknote.notes.v1',
        JSON.stringify([
          {
            id: localNotebookId,
            title,
            icon: '✦',
            content: params.markdown,
            starred: true,
            tags: ['NikAI', 'Smart Notes'],
            parentId: null,
            trashedAt: null,
            createdAt: now,
            updatedAt: now,
          },
          ...(Array.isArray(notesList) ? notesList : []),
        ])
      );
    } catch {
      // ignore quota issues
    }
  }

  // 2. Also sync to Supabase Cloud Notebooks if user has a valid Cloud UUID
  if (isCloudUserId(params.userId)) {
    try {
      const { data: nb } = await supabase
        .from('notebooks')
        .insert({
          user_id: params.userId,
          title,
          cover_color: '#7c3aed',
          tags: ['NikAI', 'Smart Notes'],
          page_style: params.pageStyle || 'ruled',
          page_size: 'a4',
        })
        .select('id')
        .single();

      if (nb?.id) {
        const mapKey = ownerScopedStorageKey('niknote.sync.notebook_map.v1', params.userId);
        try {
          const mapRaw = localStorage.getItem(mapKey);
          const mapObj = mapRaw ? JSON.parse(mapRaw) : {};
          mapObj[localNotebookId] = nb.id;
          localStorage.setItem(mapKey, JSON.stringify(mapObj));
        } catch {
          // Local note still carries its owner tag and can sync later.
        }
        notebookId = nb.id;
        const pageResult = await supabase.from('pages').insert({
          notebook_id: nb.id,
          user_id: params.userId,
          page_number: 1,
          title,
          content: blocks as unknown as Json,
        });
        if (!pageResult.error) {
          upsertLocalNoteForOwner({
            ...localNotebook,
            cloud_id: nb.id,
            _syncedAt: now,
          }, params.userId, { is_favorite: true }, { notify: false });
          notifyLocalDataChanged();
        }
      }
    } catch {
      // local copy already persisted safely
    }
  } else {
    notifyLocalDataChanged();
  }

  // 3. Also auto-build study flashcards in the background
  const flashcardCount = extractAndSaveFlashcardsFromMarkdown(title, params.markdown, params.userId);

  // 4. Prepare immediate editor open payload when requested
  if (params.prepareEditorOpen) {
    try {
      sessionStorage.setItem(
        'niknote-mobile-open',
        JSON.stringify({
          ownerId: params.userId,
          title,
          blocks,
          notebookId,
          style: params.pageStyle || 'ruled',
        })
      );
      localStorage.setItem(ownerScopedStorageKey('niknote-mobile-draft-title', params.userId), title);
    } catch {
      // ignore storage issues
    }
  }

  return {
    notebookId,
    title,
    blockCount: blocks.length,
    flashcardCount,
  };
}
