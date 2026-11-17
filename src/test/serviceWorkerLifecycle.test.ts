import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '@/hooks/useServiceWorkerRegistration';

describe('service worker lifecycle', () => {
  it('only removes obsolete NikNote shell caches when the worker activates', () => {
    const source = readFileSync('public/sw.js', 'utf8');
    expect(source).toContain("key.startsWith('niknote-shell-') && key !== SHELL_CACHE");
    expect(source).not.toContain('.filter((key) => key !== SHELL_CACHE)');
  });

  const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');

  afterEach(() => {
    if (originalDescriptor) Object.defineProperty(navigator, 'serviceWorker', originalDescriptor);
    else Reflect.deleteProperty(navigator, 'serviceWorker');
    if (originalCaches) Object.defineProperty(globalThis, 'caches', originalCaches);
    else Reflect.deleteProperty(globalThis, 'caches');
    vi.restoreAllMocks();
  });

  it('registers and updates the worker without unregistering it or clearing its cache', async () => {
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      installing: null,
    };
    const unregister = vi.fn();
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    const register = vi.fn().mockResolvedValue(registration);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register, getRegistrations },
    });
    const cacheDelete = vi.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: { delete: cacheDelete } });

    registerServiceWorker();
    await vi.waitFor(() => expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' }));
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledOnce());

    expect(getRegistrations).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(cacheDelete).not.toHaveBeenCalled();
  });
});
