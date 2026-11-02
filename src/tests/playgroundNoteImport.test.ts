import { beforeEach, describe, expect, it } from 'vitest';
import { consumePlaygroundNoteImport, PLAYGROUND_NOTE_IMPORT_KEY, playgroundFromNote } from '@/lib/playgroundNoteImport';
import { createBlock } from '@/types/block';

describe('Notes Taking to Playground handoff', () => {
  beforeEach(() => sessionStorage.clear());

  it('creates a new real canvas with structured note content and a return link', () => {
    const firstTask = createBlock('todo', 'Review lesson');
    firstTask.checked = true;
    const doc = playgroundFromNote({
      title: 'Biology',
      noteId: 'note-42',
      blocks: [
        createBlock('heading1', 'Photosynthesis'),
        createBlock('text', 'Actual note body'),
        firstTask,
        createBlock('todo', 'Revise diagram'),
        createBlock('code', 'const light = true;'),
      ],
    });

    expect(doc.title).toBe('Biology · Playground');
    expect(doc.objects.some((object) => object.kind === 'heading' && object.text === 'Photosynthesis')).toBe(true);
    expect(doc.objects.some((object) => object.text === 'Actual note body')).toBe(true);
    const checklist = doc.objects.find((object) => object.kind === 'todo');
    expect(checklist?.items).toHaveLength(2);
    expect(checklist?.items?.[0]).toMatchObject({ text: 'Review lesson', done: true });
    const returnLink = doc.objects.find((object) => object.kind === 'link');
    expect(returnLink?.href).toContain('notebook=note-42');
    expect(returnLink?.href).toContain(`canvas=${encodeURIComponent(doc.id)}`);
  });

  it('consumes a pending import once instead of duplicating it on reload', () => {
    sessionStorage.setItem(PLAYGROUND_NOTE_IMPORT_KEY, JSON.stringify({ title: 'One time', blocks: [createBlock('text', 'Body')] }));
    expect(consumePlaygroundNoteImport()?.title).toBe('One time · Playground');
    expect(consumePlaygroundNoteImport()).toBeNull();
    expect(sessionStorage.getItem(PLAYGROUND_NOTE_IMPORT_KEY)).toBeNull();
  });
});
