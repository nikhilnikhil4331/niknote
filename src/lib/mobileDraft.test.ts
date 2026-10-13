/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { MOBILE_DRAFT_NOTEBOOK_KEY, persistMobileDraftNotebook } from './mobileDraft';

function storage() {
  const values = new Map<string, string>();
  return {
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    getItem: (key: string) => values.get(key) ?? null,
  };
}

test('starting a new mobile note removes the older saved identity before reload', () => {
  const local = storage();
  persistMobileDraftNotebook(local, 'saved-A');
  persistMobileDraftNotebook(local, null);
  expect(local.getItem(MOBILE_DRAFT_NOTEBOOK_KEY)).toBeNull();
});

test('first save preserves the new notebook identity for the next save after reload', () => {
  const local = storage();
  persistMobileDraftNotebook(local, null);
  persistMobileDraftNotebook(local, 'saved-B');
  expect(local.getItem(MOBILE_DRAFT_NOTEBOOK_KEY)).toBe('saved-B');
});

test('opening another saved mobile note immediately replaces the stored identity', () => {
  const local = storage();
  persistMobileDraftNotebook(local, 'saved-A');
  persistMobileDraftNotebook(local, 'saved-B');
  expect(local.getItem(MOBILE_DRAFT_NOTEBOOK_KEY)).toBe('saved-B');
});