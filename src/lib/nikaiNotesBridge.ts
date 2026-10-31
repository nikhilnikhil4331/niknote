// ============================================================
// NikAI <-> NikNote Deep Notes Implementation Bridge
// Converts rich Markdown responses directly into multi-ink,
// structured NikNote Blocks, saves to Device + Cloud Notebooks,
// opens directly inside Handwriting Canvas, or extracts Flashcards!
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import { Block, BlockType, createBlock } from '@/types/block';
import { isCloudUserId, notifyLocalDataChanged } from '@/lib/cloudSyncEngine';

export interface SavedNikNoteResult {
  notebookId: string;
  title: string;
  blockCount: number;
  flashcardCount: number;
}

function cleanInlineMarkdown(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * Converts a full NikAI Markdown answer into structured, multi-ink NikNote `Block[]`
 * so headings are dark/purple ink, subheadings are royal blue ink, key tips are callouts,
 * checklists are interactive todo blocks, and code/formulas keep crisp block formatting!
 */
export function markdownToRichNikNoteBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let inCodeFence = false;
  let codeLines: string[] = [];

  const push = (type: BlockType, content: string, color: 'black' | 'blue' | 'red' | 'green' | 'purple' = 'blue') => {
    const b = createBlock(type, content);
    b.color = color;
    blocks.push(b);
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed.startsWith('```')) {
      if (!inCodeFence) {
        inCodeFence = true;
        codeLines = [];
      } else {
        inCodeFence = false;
        if (codeLines.length > 0) {
          push('code', codeLines.join('\n'), 'purple');
        }
        codeLines = [];
      }
      continue;
    }

    if (inCodeFence) {
      codeLines.push(raw);
      continue;
    }

    if (!trimmed) continue;

    // Horizontal divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      push('divider', '', 'blue');
      continue;
    }

    // Markdown Table separator skip, table row format cleanly
    if (/^\|[\s:-]+\|$/.test(trimmed)) continue;
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => cleanInlineMarkdown(c))
        .filter(Boolean);
      if (cells.length > 0) {
        push('bullet', cells.join('  —  '), 'blue');
      }
      continue;
    }

    // Headings with signature NikNote multi-color ink!
    if (trimmed.startsWith('# ')) {
      push('heading1', cleanInlineMarkdown(trimmed.slice(2)), 'purple');
      continue;
    }
    if (trimmed.startsWith('## ')) {
      push('heading2', cleanInlineMarkdown(trimmed.slice(3)), 'black');
      continue;
    }
    if (trimmed.startsWith('### ')) {
      push('heading3', cleanInlineMarkdown(trimmed.slice(4)), 'red');
      continue;
    }

    // Callouts / Blockquotes / Pro-Tips
    if (trimmed.startsWith('>')) {
      push('callout', cleanInlineMarkdown(trimmed.replace(/^>\s*/, '')), 'green');
      continue;
    }

    // Interactive Checklists
    const todoMatch = trimmed.match(/^[-*]\s*\[( |x|X)\]\s+(.+)$/);
    if (todoMatch) {
      const b = createBlock('todo', cleanInlineMarkdown(todoMatch[2]));
      b.color = 'blue';
      b.checked = todoMatch[1].toLowerCase() === 'x';
      blocks.push(b);
      continue;
    }

    // Bullet lists
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      push('bullet', cleanInlineMarkdown(bulletMatch[1]), 'blue');
      continue;
    }

    // Numbered steps
    const numMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numMatch) {
      push('numbered', cleanInlineMarkdown(numMatch[1]), 'blue');
      continue;
    }

    push('text', cleanInlineMarkdown(trimmed), 'blue');
  }

  if (inCodeFence && codeLines.length > 0) {
    push('code', codeLines.join('\n'), 'purple');
  }

  if (blocks.length > 0) return blocks;
  const fallback = createBlock('text', markdown.trim());
  fallback.color = 'blue';
  return [fallback];
}

/**
 * Extracts study flashcards automatically from headings/bullet definitions/MCQs
 * and stores them into NikNote's local flashcard deck (`niknote-flashcards-v1`).
 */
export function extractAndSaveFlashcardsFromMarkdown(topicTitle: string, markdown: string): number {
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
    const raw = localStorage.getItem('niknote-flashcards-v1');
    const existing = raw ? JSON.parse(raw) : [];
    const merged = [...cards, ...(Array.isArray(existing) ? existing : [])].slice(0, 200);
    localStorage.setItem('niknote-flashcards-v1', JSON.stringify(merged));
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

  // 1. Always save locally so offline/guest mobile & desktop work instantaneously
  try {
    const mobileListRaw = localStorage.getItem('niknote.mobile.notebooks.v1');
    const mobileList = mobileListRaw ? JSON.parse(mobileListRaw) : [];
    const localNotebook = {
      id: notebookId,
      title,
      blocks,
      page_style: params.pageStyle || 'ruled',
      tags: ['NikAI', 'Smart Notes'],
      updated_at: now,
    };
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
          id: notebookId,
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

  // 2. Also sync to Supabase Cloud Notebooks if user has a valid Cloud UUID
  if (isCloudUserId(params.userId)) {
    try {
      const { data: nb } = await supabase
        .from('notebooks')
        .insert({
          user_id: params.userId,
          title,
          cover_color: '#7C5F9E',
          tags: ['NikAI', 'Smart Notes'],
          page_style: params.pageStyle || 'ruled',
          page_size: 'a4',
        })
        .select('id')
        .single();

      if (nb?.id) {
        try {
          const mapRaw = localStorage.getItem('niknote.sync.notebook_map.v1');
          const mapObj = mapRaw ? JSON.parse(mapRaw) : {};
          mapObj[notebookId] = nb.id;
          localStorage.setItem('niknote.sync.notebook_map.v1', JSON.stringify(mapObj));
        } catch {
          // ignore
        }
        notebookId = nb.id;
        await supabase.from('pages').insert({
          notebook_id: nb.id,
          user_id: params.userId,
          page_number: 1,
          title,
          content: blocks as any,
        });
      }
    } catch {
      // local copy already persisted safely
    }
  } else {
    notifyLocalDataChanged();
  }

  // 3. Also auto-build study flashcards in the background
  const flashcardCount = extractAndSaveFlashcardsFromMarkdown(title, params.markdown);

  // 4. Prepare immediate editor open payload when requested
  if (params.prepareEditorOpen) {
    try {
      sessionStorage.setItem(
        'niknote-mobile-open',
        JSON.stringify({
          title,
          blocks,
          notebookId,
          style: params.pageStyle || 'ruled',
        })
      );
      localStorage.setItem('niknote-mobile-draft-title', title);
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
