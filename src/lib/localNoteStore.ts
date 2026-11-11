import type { Block } from '@/types/block';
import type { NoteSettings } from '@/types/notes';

export const LOCAL_NOTEBOOKS_KEY = 'niknote.mobile.notebooks.v1';
export const LOCAL_PLAIN_NOTES_KEY = 'niknote.notes.v1';
const LEGACY_NOTE_OWNER_KEY = 'niknote.local-notes.legacy-owner.v1';

export interface LocalNoteRecord {
  id: string;
  title?: string;
  blocks?: Block[];
  content?: string;
  page_style?: string;
  page_size?: string;
  settings?: Partial<NoteSettings> | null;
  font?: string;
  ink_color?: string;
  folder?: string | null;
  cover_color?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  updatedAt?: string;
  trashedAt?: string | null;
  _ownerId?: string;
  _syncedAt?: string;
  user_id?: string;
  [key: string]: unknown;
}

function readList(key: string): LocalNoteRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value)
      ? value.filter((item): item is LocalNoteRecord => Boolean(item && typeof item.id === 'string'))
      : [];
  } catch {
    return [];
  }
}

function writeList(key: string, value: LocalNoteRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the editor usable if device storage is full.
  }
}

function notifyLocalChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('niknote:local-data-changed'));
}

function ownerOf(note: LocalNoteRecord): string | undefined {
  return note._ownerId || note.user_id;
}

function isUnclaimedOfflineNote(note: LocalNoteRecord) {
  return !ownerOf(note) && !note._syncedAt;
}

function canClaimLegacyNotes(ownerId: string, allowLegacyClaim: boolean) {
  if (!allowLegacyClaim || typeof window === 'undefined') return false;
  try {
    const claimedBy = localStorage.getItem(LEGACY_NOTE_OWNER_KEY);
    if (claimedBy) return claimedBy === ownerId;
    // Legacy device notes are only eligible for an active guest workspace.
    // A registered account must never silently absorb an unknown device cache.
    return ownerId.startsWith('local-guest-') || allowLegacyClaim;
  } catch {
    return ownerId.startsWith('local-guest-');
  }
}

function mergeByOwner(notes: LocalNoteRecord[], ownerId: string, allowLegacyClaim: boolean): LocalNoteRecord[] {
  const mayClaimLegacy = canClaimLegacyNotes(ownerId, allowLegacyClaim);
  const visible = new Map<string, LocalNoteRecord>();
  for (const note of notes) {
    const owner = ownerOf(note);
    const claimedLegacy = mayClaimLegacy && isUnclaimedOfflineNote(note);
    if (owner !== ownerId && !claimedLegacy) continue;
    const previous = visible.get(note.id);
    // Plain-note records carry favorite/folder metadata; notebook records carry
    // full blocks and page settings. Merge rather than discarding either side.
    visible.set(note.id, previous ? { ...previous, ...note } : { ...note });
  }

  if (mayClaimLegacy && Array.from(visible.values()).some((note) => !ownerOf(note))) {
    const claim = (list: LocalNoteRecord[]) => list.map((note) => {
      if (!isUnclaimedOfflineNote(note)) return note;
      const saved = visible.get(note.id);
      return saved ? { ...saved, _ownerId: ownerId } : note;
    });
    writeList(LOCAL_NOTEBOOKS_KEY, claim(readList(LOCAL_NOTEBOOKS_KEY)));
    writeList(LOCAL_PLAIN_NOTES_KEY, claim(readList(LOCAL_PLAIN_NOTES_KEY)));
    try { localStorage.setItem(LEGACY_NOTE_OWNER_KEY, ownerId); } catch { /* ignore */ }
  }

  return Array.from(visible.values()).map((note) => ({
    ...note,
    _ownerId: ownerOf(note) || ownerId,
  }));
}

/**
 * Read only device notes owned by the active workspace. Unmarked legacy drafts
 * may be claimed by a guest workspace, never by a registered account by default.
 * Synced rows with an owner marker are not exposed to another identity.
 */
export function readLocalNotesForOwner(
  ownerId: string | null | undefined,
  options: { allowLegacyClaim?: boolean } = {},
): LocalNoteRecord[] {
  if (!ownerId) return [];
  return mergeByOwner(
    [...readList(LOCAL_PLAIN_NOTES_KEY), ...readList(LOCAL_NOTEBOOKS_KEY)],
    ownerId,
    Boolean(options.allowLegacyClaim),
  );
}

export function findLocalNoteForOwner(
  id: string,
  ownerId: string | null | undefined,
  options: { allowLegacyClaim?: boolean } = {},
): LocalNoteRecord | null {
  return readLocalNotesForOwner(ownerId, options).find((note) => note.id === id) || null;
}

/** Save an owner-tagged local/cache copy without replacing another workspace's row. */
export function upsertLocalNoteForOwner(
  note: LocalNoteRecord,
  ownerId: string,
  plainPatch: Partial<LocalNoteRecord> = {},
  options: { notify?: boolean; allowLegacyClaim?: boolean } = {},
) {
  if (!ownerId || !note.id) return;
  const mayClaimLegacy = canClaimLegacyNotes(ownerId, Boolean(options.allowLegacyClaim));
  const ownedNote: LocalNoteRecord = { ...note, _ownerId: ownerId };
  const upsert = (key: string, value: LocalNoteRecord) => {
    const list = readList(key);
    const index = list.findIndex((item) =>
      item.id === value.id &&
      (ownerOf(item) === ownerId || (mayClaimLegacy && isUnclaimedOfflineNote(item))),
    );
    const next = index < 0
      ? [value, ...list]
      : list.map((item, i) => (i === index ? { ...item, ...value, _ownerId: ownerId } : item));
    writeList(key, next);
  };

  upsert(LOCAL_NOTEBOOKS_KEY, ownedNote);
  const existingPlain = readList(LOCAL_PLAIN_NOTES_KEY).find(
    (item) => item.id === note.id &&
      (ownerOf(item) === ownerId || (mayClaimLegacy && isUnclaimedOfflineNote(item))),
  );
  upsert(LOCAL_PLAIN_NOTES_KEY, {
    ...existingPlain,
    ...ownedNote,
    id: note.id,
    title: note.title || 'Untitled Note',
    content: note.content ?? (Array.isArray(note.blocks) ? note.blocks.map((block) => block.content || '').join('\n') : ''),
    tags: note.tags || existingPlain?.tags || ['Notes'],
    createdAt: existingPlain?.createdAt || note.createdAt || note.created_at || note.updatedAt || note.updated_at || new Date().toISOString(),
    updatedAt: note.updated_at || note.updatedAt || new Date().toISOString(),
    trashedAt: note.trashedAt ?? existingPlain?.trashedAt ?? null,
    ...plainPatch,
    _ownerId: ownerId,
  });
  if (options.notify !== false) notifyLocalChange();
}

export function removeLocalNoteForOwner(
  id: string,
  ownerId: string | null | undefined,
  options: { notify?: boolean } = {},
) {
  if (!ownerId) return;
  for (const key of [LOCAL_NOTEBOOKS_KEY, LOCAL_PLAIN_NOTES_KEY]) {
    writeList(key, readList(key).filter((note) => note.id !== id || ownerOf(note) !== ownerId));
  }
  if (options.notify !== false) notifyLocalChange();
}

/**
 * Promote an explicitly active offline guest's notes to the cloud guest identity.
 * Unclaimed legacy notes are included only during that transition; a sign-in to
 * another registered account must not automatically adopt them.
 */
export function transferLocalNotesToOwner(fromOwnerId: string | null | undefined, toOwnerId: string) {
  if (!toOwnerId || !fromOwnerId || !fromOwnerId.startsWith('local-guest-')) return;
  const mobile = readList(LOCAL_NOTEBOOKS_KEY);
  const plain = readList(LOCAL_PLAIN_NOTES_KEY);
  const transfer = (note: LocalNoteRecord) =>
    ownerOf(note) === fromOwnerId || (!ownerOf(note) && isUnclaimedOfflineNote(note));
  const nextMobile = mobile.map((note) => transfer(note) ? { ...note, _ownerId: toOwnerId } : note);
  const nextPlain = plain.map((note) => transfer(note) ? { ...note, _ownerId: toOwnerId } : note);
  const changed = nextMobile.some((note, index) => note !== mobile[index]) ||
    nextPlain.some((note, index) => note !== plain[index]);
  if (changed) {
    writeList(LOCAL_NOTEBOOKS_KEY, nextMobile);
    writeList(LOCAL_PLAIN_NOTES_KEY, nextPlain);
    try {
      if (localStorage.getItem(LEGACY_NOTE_OWNER_KEY) === fromOwnerId) {
        localStorage.setItem(LEGACY_NOTE_OWNER_KEY, toOwnerId);
      }
    } catch { /* ignore */ }
    notifyLocalChange();
  }
}

/** Normalize a device note for the existing notebooks list UI. */
export function localNotebookAsCloudShape(note: LocalNoteRecord, ownerId: string) {
  const now = note.updated_at || note.updatedAt || new Date().toISOString();
  return {
    id: note.id,
    user_id: ownerId,
    title: note.title || 'Untitled Note',
    description: note.content || (Array.isArray(note.blocks) ? note.blocks.map((block) => block.content || '').join('\n') : ''),
    cover_color: note.cover_color || '#8b5cf6',
    handwriting_model_id: null,
    page_style: note.page_style || note.settings?.pageStyle || 'ruled',
    page_size: note.page_size || note.settings?.pageSize || 'a4',
    settings: note.settings || null,
    folder: note.folder ?? (note.trashedAt ? '__trash__' : null),
    tags: Array.isArray(note.tags) ? note.tags : ['Notes'],
    created_at: note.created_at || now,
    updated_at: now,
  };
}
