import { describe, it, expect, vi, afterEach } from 'vitest';
import { isNativeApp, saveFile } from '@/lib/saveFile';

describe('saveFile (download helper)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('detects the web (non-native) platform by default', () => {
    expect(isNativeApp()).toBe(false);
  });

  it('downloads through a blob link when the share API is unavailable', async () => {
    const clicks: string[] = [];
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:niknote-test'),
      revokeObjectURL: vi.fn(),
    });
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = createElement(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = () => clicks.push((el as HTMLAnchorElement).download);
      }
      return el;
    });

    const result = await saveFile(new Uint8Array([1, 2, 3]), 'notes.pdf');
    expect(result).toBe('downloaded');
    expect(clicks).toEqual(['notes.pdf']);
  });

  it('uses the mobile share sheet when files can be shared', async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      canShare: () => true,
      share,
      maxTouchPoints: 5,
    });
    const result = await saveFile(new Uint8Array([1, 2, 3]), 'signed.pdf');
    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
  });
});
