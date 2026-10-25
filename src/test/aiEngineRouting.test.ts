import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  resolveAstaMode,
  resolveAstaModel,
  getRemoteAstraGatewayUrl,
  probeAstaProviders,
} from '@/lib/aiEngine';

describe('NikAI mode / model normalisation', () => {
  it('maps every UI mode id to a canonical gateway mode', () => {
    expect(resolveAstaMode('tutor')).toBe('teacher');
    expect(resolveAstaMode('writing')).toBe('write');
    expect(resolveAstaMode('vision')).toBe('auto');
    expect(resolveAstaMode('solve')).toBe('solver');
    expect(resolveAstaMode('QUIZ')).toBe('quiz');
    expect(resolveAstaMode('notes')).toBe('notes');
    expect(resolveAstaMode(undefined)).toBe('auto');
    expect(resolveAstaMode('nonsense-mode')).toBe('auto');
  });

  it('maps short / legacy model ids to the canonical Astra ids', () => {
    expect(resolveAstaModel('auto')).toBe('astra-auto');
    expect(resolveAstaModel('pro')).toBe('astra-pro');
    expect(resolveAstaModel('flash')).toBe('astra-flash');
    expect(resolveAstaModel('vision')).toBe('astra-vision');
    expect(resolveAstaModel('coder')).toBe('astra-coder');
    expect(resolveAstaModel('astra-pro')).toBe('astra-pro');
    expect(resolveAstaModel('')).toBe('astra-auto');
    expect(resolveAstaModel('gpt-4o')).toBe('astra-auto');
  });
});

describe('NikAI preview gateway relay', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('relays to the production gateway only on sandbox / local hosts', () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    expect(getRemoteAstraGatewayUrl()).toBe('https://www.niknote.online/api/ai');

    vi.stubGlobal('window', { location: { hostname: '8080-abc123.e2b.app' } });
    expect(getRemoteAstraGatewayUrl()).toBe('https://www.niknote.online/api/ai');

    vi.stubGlobal('window', { location: { hostname: 'www.niknote.online' } });
    expect(getRemoteAstraGatewayUrl()).toBeNull();
  });

  it('reports the cloud relay as an active provider in sandboxes without keys', async () => {
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, providers: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    );

    const probe = await probeAstaProviders();
    expect(probe.cloudReady).toBe(true);
    expect(probe.providers).toContain('NikAI Astra Cloud Relay');
  });
});
