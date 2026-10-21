import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom has no PointerEvent, so React receives pointer events whose
// clientX/clientY/pointerType are undefined — every gesture test reads NaN.
if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
  class PointerEventShim extends MouseEvent {
    pointerType: string;
    pointerId: number;
    constructor(type: string, params: Record<string, unknown> = {}) {
      super(type, params as MouseEventInit);
      this.pointerType = (params.pointerType as string) ?? 'mouse';
      this.pointerId = (params.pointerId as number) ?? 1;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventShim;
  (globalThis as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventShim;
}

// jsdom lacks matchMedia / ResizeObserver / canvas
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
class FakeResizeObserver { observe() {}; unobserve() {}; disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
// jsdom has no 2D canvas: any canvas API returns null so callers take their
// "no canvas" fallback path instead of crashing.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Supabase client uses localStorage in tests
if (!globalThis.IntersectionObserver) {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    class { observe(){}; unobserve(){}; disconnect(){} };
}
