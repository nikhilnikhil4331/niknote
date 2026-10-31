/**
 * NikNote theme controller
 * ------------------------------------------------------------
 * One source of truth for light/dark. The initial class is applied by
 * `/theme-init.js` before React boots (no flash of the wrong theme, CSP-safe
 * because it is an external self-hosted script). This module keeps every
 * consumer in sync through an external store + a window event so multiple
 * components (editor toolbar, landing header, toasts) never drift apart.
 *
 * Default: Sunset Plum Night (`dark`). An explicit `theme=light` preference
 * persisted in localStorage switches to the Daylight palette.
 */

import { useCallback, useSyncExternalStore } from 'react';

export type NikTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
const THEME_EVENT = 'niknote:themechange';
const DARK_THEME_COLOR = '#121020';
const LIGHT_THEME_COLOR = '#FBF6F4';

function canUseDOM() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function readStoredTheme(): NikTheme | null {
  if (!canUseDOM()) return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

export function getTheme(): NikTheme {
  if (!canUseDOM()) return 'dark';
  const stored = readStoredTheme();
  if (stored) return stored;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: NikTheme, persist = true) {
  if (!canUseDOM()) return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.nkTheme = theme === 'dark' ? 'night' : 'daylight';
  root.style.colorScheme = theme;
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // storage can be unavailable in private contexts — theme still applies
    }
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  window.dispatchEvent(new CustomEvent<NikTheme>(THEME_EVENT, { detail: theme }));
}

export function setTheme(theme: NikTheme) {
  applyTheme(theme, true);
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function subscribe(onChange: () => void) {
  if (!canUseDOM()) return () => {};
  const onLocal = () => onChange();
  const onCustom = () => onChange();
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener(THEME_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', onLocal);
  return () => {
    window.removeEventListener(THEME_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
    media?.removeEventListener?.('change', onLocal);
  };
}

export function useDarkMode() {
  const theme = useSyncExternalStore<NikTheme>(
    subscribe,
    () => getTheme(),
    () => 'dark' as NikTheme,
  );

  const toggle = useCallback(() => toggleTheme(), []);
  const change = useCallback((next: NikTheme) => setTheme(next), []);

  return { isDark: theme === 'dark', theme, setTheme: change, toggle };
}

export function useTheme() {
  return useDarkMode();
}
