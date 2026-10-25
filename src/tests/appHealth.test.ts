import { describe, expect, test, afterEach, vi } from 'vitest';
import {
  checkAi, checkDevice, checkPdfEngine, formatProviders, getAiEndpoint, isNativeApp,
} from '@/lib/appHealth';

afterEach(() => {
  delete (globalThis as any).Capacitor;
});

describe('providers summary', () => {
  test('shows a tick/cross per provider', () => {
    expect(formatProviders({ groq: true, gemini: true })).toBe('groq ✓ · gemini ✓');
    expect(formatProviders({ groq: true, gemini: false })).toBe('groq ✓ · gemini ✕');
  });

  test('handles empty or missing data', () => {
    expect(formatProviders({})).toBe('koi provider nahi');
    expect(formatProviders(null)).toBe('providers unknown');
  });
});

describe('AI endpoint resolution', () => {
  test('unit tests never hit the live gateway (uses the site path)', () => {
    expect(getAiEndpoint().route).toBe('same-origin');
    expect(getAiEndpoint().url).toBe('/api/ai');
  });

  test('native app detection reads the Capacitor bridge', () => {
    expect(isNativeApp()).toBe(false);
    (globalThis as any).Capacitor = { isNativePlatform: () => true };
    expect(isNativeApp()).toBe(true);
  });

  test('a native shell falls back to the platform API', () => {
    (globalThis as any).Capacitor = { getPlatform: () => 'android' };
    expect(isNativeApp()).toBe(true);
  });
});

describe('pdf engine check', () => {
  test('builds, watermarks and re-opens a PDF on-device', async () => {
    const result = await checkPdfEngine();
    expect(result.id).toBe('pdf');
    expect(result.status).toBe('ok');
    expect(result.detail).toMatch(/watermark/i);
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });
});

describe('device check', () => {
  test('reports platform, storage and network', async () => {
    const result = await checkDevice();
    expect(result.id).toBe('device');
    expect(result.status).toBe('ok');
    expect(result.detail).toMatch(/storage ok/);
    expect(result.detail).toMatch(/localhost/);
  });

  test('labels the APK correctly when running natively', async () => {
    (globalThis as any).Capacitor = { isNativePlatform: () => true };
    const result = await checkDevice();
    expect(result.label).toBe('App device');
    expect(result.detail).toMatch(/^APK/);
  });
});

describe('AI check', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('trusts the gateway probe and names the model that answered', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          providers: { groq: true, gemini: true },
          probe: { ok: true, provider: 'groq', model: 'llama-3.1-8b-instant', answer: 'OK', ms: 240 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const result = await checkAi();
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('groq ✓');
    expect(result.detail).toContain('llama-3.1-8b-instant');
    expect(result.detail).toContain('OK');
  });

  test('says out loud when the server has no provider key', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          providers: { groq: false, gemini: false },
          probe: { ok: false, errors: ['no_provider_configured'] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const result = await checkAi();
    expect(result.status).toBe('fail');
    expect(result.detail).toMatch(/koi AI key set nahi/);
  });

  test('falls back to the chat-style POST on an older deployment', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: any) => {
      calls.push(String(input));
      if (!String(input).includes('probe=1')) {
        return new Response(JSON.stringify({ content: 'OK', model: 'Astra Core' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, providers: { groq: true } }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await checkAi();
    expect(calls.length).toBe(2);
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('Astra Core');
  });

  test('reports a network failure instead of hanging', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const result = await checkAi(1500);
    expect(result.status).toBe('fail');
    expect(result.detail).toMatch(/internet check karo/);
  });
});
