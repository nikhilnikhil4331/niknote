import type { Block } from '@/types/block';
import {
  createPlaygroundObject,
  emptyPlayground,
  playgroundId,
  type PlaygroundDocument,
  type PlaygroundObject,
} from '@/lib/playground';

export const PLAYGROUND_NOTE_IMPORT_KEY = 'niknote.playground.note-import.v1';

export interface PlaygroundNoteImport {
  title: string;
  noteId?: string | null;
  blocks: Block[];
}

/** Create a new canvas; never overwrite the note or an existing playground. */
export function playgroundFromNote(input: PlaygroundNoteImport): PlaygroundDocument {
  const title = input.title.trim() || 'Untitled Note';
  const doc = emptyPlayground(`${title} · Playground`);
  const objects: PlaygroundObject[] = [createPlaygroundObject('heading', 64, 48, {
    text: title,
    width: 680,
    height: 72,
  })];
  let y = 148;
  let todos: Block[] = [];
  let numbered = 0;

  const add = (kind: PlaygroundObject['kind'], text: string, overrides: Partial<PlaygroundObject> = {}) => {
    const lines = Math.max(1, text.split('\n').length + Math.floor(text.length / 100));
    const height = Math.max(54, Math.min(360, 24 + lines * 24));
    const object = createPlaygroundObject(kind, 64, y, { text, width: 640, height, ...overrides });
    objects.push(object);
    y += object.height + 24;
  };
  const flushTodos = () => {
    if (!todos.length) return;
    add('todo', 'Checklist', {
      height: Math.max(104, 68 + todos.length * 30),
      items: todos.map((block) => ({ id: playgroundId('task'), text: block.content, done: Boolean(block.checked) })),
    });
    todos = [];
  };

  for (const block of input.blocks) {
    if (block.type === 'todo') {
      todos.push(block);
      numbered = 0;
      continue;
    }
    flushTodos();
    const text = block.content || '';
    if (block.type === 'divider') {
      add('divider', '', { width: 640, height: 24 });
    } else if (block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3') {
      add('heading', text, { fontSize: block.type === 'heading1' ? 36 : block.type === 'heading2' ? 29 : 23, height: block.type === 'heading3' ? 54 : 66 });
    } else if (block.type === 'code' || block.type === 'equation' || block.type === 'mermaid') {
      add('code', text);
    } else if (block.type === 'bullet') {
      add('text', `• ${text}`, { height: 52 });
    } else if (block.type === 'numbered') {
      numbered += 1;
      add('text', `${numbered}. ${text}`, { height: 52 });
    } else if (block.type === 'quote') {
      add('text', `“${text}”`, { fontSize: 20, fontStyle: 'italic', background: '#F8F3FA' });
    } else if (block.type === 'callout' || block.type === 'toggle') {
      add('text', `${block.emoji || '💡'} ${text}`, { background: '#F6F0F8' });
    } else if (block.type === 'image' && (block.url || text)) {
      add('image', '', { src: block.url || text, alt: block.caption || text || 'Note image', width: 480, height: 320 });
    } else if (block.type === 'table' && block.tableData) {
      add('table', text || 'Table', {
        height: Math.max(120, 58 + (block.tableData.rows.length + 1) * 34),
        rows: [block.tableData.headers, ...block.tableData.rows.map((row) => row.map((cell) => cell.content))],
      });
    } else if (['bookmark', 'video', 'audio', 'embed', 'pdf', 'file'].includes(block.type) && (block.url || text)) {
      add('link', block.caption || text || block.type, { href: block.url || text, height: 96 });
    } else if (block.type === 'flashcard') {
      add('text', `${block.front || text}\n\n${block.back || ''}`.trim(), { background: '#F8F3FA' });
    } else if (text.trim()) {
      add('text', text);
    }
    if (block.type !== 'numbered') numbered = 0;
  }
  flushTodos();

  const returnUrl = `/?editor=1${input.noteId ? `&notebook=${encodeURIComponent(input.noteId)}` : ''}&canvas=${encodeURIComponent(doc.id)}`;
  add('link', 'Open in Notes Taking', { href: returnUrl, height: 92 });
  doc.objects = objects;
  return doc;
}

export function consumePlaygroundNoteImport(): PlaygroundDocument | null {
  try {
    const raw = sessionStorage.getItem(PLAYGROUND_NOTE_IMPORT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PLAYGROUND_NOTE_IMPORT_KEY);
    const value = JSON.parse(raw) as PlaygroundNoteImport;
    if (!value || typeof value.title !== 'string' || !Array.isArray(value.blocks)) return null;
    return playgroundFromNote(value);
  } catch {
    return null;
  }
}
