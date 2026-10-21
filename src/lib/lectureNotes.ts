// ============================================================
// lectureNotes — persist a finished lecture as a normal workspace note
// (same `niknote.notes.v1` list the notebooks screen reads).
// ============================================================

import { toast } from 'sonner';
import { track, trackFirstNote } from '@/lib/growth/funnel';

export function saveLectureNote(title: string, lines: { text: string; blockType: string }[]): string {
  const id = `lecture-${Date.now().toString(36)}`;
  const content = lines
    .map(line => {
      const prefix =
        line.blockType === 'h2' ? '## ' :
        line.blockType === 'h3' ? '### ' :
        line.blockType === 'bullet' ? '- ' :
        line.blockType === 'numbered' ? '1. ' : '';
      return `${prefix}${line.text}`;
    })
    .join('\n');
  try {
    const raw = localStorage.getItem('niknote.notes.v1');
    const list = raw ? JSON.parse(raw) : [];
    const next = [
      {
        id,
        title: title || 'Lecture notes',
        icon: '🎙️',
        content,
        starred: false,
        tags: ['Lecture'],
        parentId: null,
        trashedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      ...(Array.isArray(list) ? list : []),
    ];
    localStorage.setItem('niknote.notes.v1', JSON.stringify(next.slice(0, 200)));
    track('note_created', { feature: 'lecture_mode' });
    trackFirstNote('lecture_mode');
  } catch {
    toast.error('Could not save the note on this device (storage full).');
  }
  return id;
}

