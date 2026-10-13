export const MOBILE_DRAFT_NOTEBOOK_KEY = 'niknote-mobile-draft-notebook';

// Persist the current identity on change, not the previous render on cleanup.
export function persistMobileDraftNotebook(storage: Pick<Storage, 'setItem' | 'removeItem'>, id: string | null) {
  if (id) storage.setItem(MOBILE_DRAFT_NOTEBOOK_KEY, id);
  else storage.removeItem(MOBILE_DRAFT_NOTEBOOK_KEY);
}