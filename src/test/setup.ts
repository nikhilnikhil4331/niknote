import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

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
(globalThis as any).ResizeObserver = FakeResizeObserver;
HTMLCanvasElement.prototype.getContext = (() => null) as any;

// Supabase client uses localStorage in tests
if (!globalThis.IntersectionObserver) {
  (globalThis as any).IntersectionObserver = class { observe(){}; unobserve(){}; disconnect(){} };
}
