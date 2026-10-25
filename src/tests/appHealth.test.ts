import { describe, expect, test, afterEach } from 'vitest';
import {
  checkDevice, checkPdfEngine, formatProviders, getAiEndpoint, isNativeApp,
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
