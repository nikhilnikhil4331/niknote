import { describe, expect, it } from 'vitest';
import { isLightFill, readableInk } from '@/lib/readableInk';

describe('readableInk', () => {
  it('never puts white text on Amber or Soft Blush', () => {
    expect(readableInk('#ED9E59')).toBe('#1B1931');
    expect(readableInk('#E9BCB9')).toBe('#1B1931');
    expect(readableInk('#D9822F')).toBe('#1B1931');
    expect(isLightFill('#ED9E59')).toBe(true);
    expect(isLightFill('#E9BCB9')).toBe(true);
  });

  it('keeps white text on the deep brand fills', () => {
    expect(readableInk('#662249')).toBe('#FFFFFF');
    expect(readableInk('#44174E')).toBe('#FFFFFF');
    expect(readableInk('#A34054')).toBe('#FFFFFF');
    expect(readableInk('#8C3149')).toBe('#FFFFFF');
    expect(isLightFill('#662249')).toBe(false);
  });

  it('expands short hex and is case insensitive', () => {
    expect(readableInk('#fff')).toBe('#1B1931');
    expect(readableInk('#ED9e59')).toBe('#1B1931');
  });

  it('falls back to white for colours it cannot parse', () => {
    expect(readableInk('var(--nnh-purple)')).toBe('#FFFFFF');
    expect(readableInk('linear-gradient(135deg,#000,#fff)')).toBe('#FFFFFF');
  });
});
