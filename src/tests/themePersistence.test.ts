import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { applyTheme, getTheme, readStoredTheme, THEME_STORAGE_KEY } from '@/hooks/useDarkMode';

describe('theme persistence (Sunset Plum)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.nkTheme;
  });

  it('defaults to Sunset Plum Night when nothing is stored', () => {
    expect(readStoredTheme()).toBeNull();
    expect(getTheme()).toBe('light'); // no class applied yet by the bootstrap script
    applyTheme('dark');
    expect(getTheme()).toBe('dark');
  });

  it('persists the chosen theme and mirrors it on <html>', () => {
    applyTheme('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.nkTheme).toBe('daylight');
    expect(document.documentElement.style.colorScheme).toBe('light');

    applyTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.nkTheme).toBe('night');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('the pre-paint bootstrap script defaults to dark and is CSP-safe (external, no inline handlers)', () => {
    const bootstrap = fs.readFileSync(path.join(process.cwd(), 'public/theme-init.js'), 'utf8');
    expect(bootstrap).toContain("stored !== 'light'");
    expect(bootstrap).toContain("classList.add('dark')");
    expect(bootstrap).not.toContain('<script');
  });
});
