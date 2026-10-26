import { describe, it, expect } from 'vitest';
import { cleanOcrLines, titleFromLines } from '@/lib/scanOcr';
import { backAction } from '@/lib/nativeNav';

describe('cleanOcrLines — study-notes cleanup', () => {
  it('keeps lines, collapses blank runs, drops specks', () => {
    const raw = 'Mera name Nikhil hai   \n\n\nor mai Saharanpur se hu\n|\n\fNikNote ko banaya hai\n';
    expect(cleanOcrLines(raw)).toEqual([
      'Mera name Nikhil hai',
      '',
      'or mai Saharanpur se hu',
      'NikNote ko banaya hai',
    ]);
  });

  it('handles empty and whitespace-only input', () => {
    expect(cleanOcrLines('')).toEqual([]);
    expect(cleanOcrLines('  \n \n')).toEqual([]);
  });

  it('keeps short real words and Hindi text', () => {
    expect(cleanOcrLines('OK\nहिंदी नोट\n1. पहला point')).toEqual(['OK', 'हिंदी नोट', '1. पहला point']);
  });
});

describe('titleFromLines', () => {
  it('uses the first real line, truncated', () => {
    expect(titleFromLines(['', 'Photosynthesis notes', 'body'])).toBe('Photosynthesis notes');
    expect(titleFromLines(['x'.repeat(60)])).toHaveLength(49);
  });

  it('falls back to a dated title', () => {
    expect(titleFromLines([], new Date(2026, 9, 25))).toContain('Scanned note');
  });
});

describe('backAction — Android Back decisions', () => {
  it('goes back in history when navigation is possible', () => {
    expect(backAction({ canGoBack: true, now: 5000, lastRootBackAt: 0 })).toBe('history');
  });

  it('warns first, exits on a second quick press at the root', () => {
    expect(backAction({ canGoBack: false, now: 5000, lastRootBackAt: 0 })).toBe('warn');
    expect(backAction({ canGoBack: false, now: 6200, lastRootBackAt: 5000 })).toBe('exit');
    expect(backAction({ canGoBack: false, now: 9000, lastRootBackAt: 5000 })).toBe('warn');
  });
});
