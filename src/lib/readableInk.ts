/**
 * Contrast helpers for dynamic colours.
 *
 * Task tags, habit colours and category chips are user-pickable, so the
 * label colour cannot be a fixed token. These helpers pick a Sunset Plum
 * ink that keeps the label at WCAG AA (>= 4.5:1) on the chosen fill.
 *
 * Amber and Soft Blush are light fills — they must never carry white text.
 */

const MIDNIGHT = '#1B1931';
const WHITE = '#FFFFFF';

const cache = new Map<string, string>();

function parseHex(value: string): [number, number, number] | null {
  const raw = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) return null;
  const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** True when the fill is light enough that white text would fail AA. */
export function isLightFill(color: string): boolean {
  const rgb = parseHex(color);
  if (!rgb) return false;
  const lum = luminance(rgb);
  return contrast(lum, luminance([255, 255, 255])) < 4.5;
}

/**
 * Returns Midnight Plum or white — whichever reaches AA on `color`.
 * Unknown formats (gradients, `var(--token)`) default to white because the
 * brand fills those tokens resolve to are dark enough for white text.
 */
export function readableInk(color: string, fallback = WHITE): string {
  const cached = cache.get(color);
  if (cached) return cached;
  const rgb = parseHex(color);
  if (!rgb) return fallback;
  const lum = luminance(rgb);
  const ink = contrast(lum, luminance([27, 25, 49])) > contrast(lum, luminance([255, 255, 255])) ? MIDNIGHT : WHITE;
  cache.set(color, ink);
  return ink;
}

/** Midnight Plum ink value, exported for call sites that need the literal. */
export const INK_ON_LIGHT = MIDNIGHT;
