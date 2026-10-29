import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import apiHandler, {
  cleanApiKey,
  createThinkTagSplitter,
  normalizeLarpRouterBaseUrl,
  resolveProviderKeys,
  stripThinkTags,
} from '../../api/ai';
import {
  probeAstaProviders,
  readCustomAIKeys,
  resolveAstaModel,
  saveCustomAIKeys,
  streamAstaAI,
} from '@/lib/aiEngine';
import { checkAi, formatProviders } from '@/lib/appHealth';

function buildOpenAISSEBody(chunks: Array<{ content?: string; reasoning_content?: string }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const delta of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`)
        );
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

async function readAllSSEEvents(res: Response): Promise<Array<Record<string, any>>> {
  const text = await res.text();
  const events: Array<Record<string, any>> = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    events.push(JSON.parse(payload));
  }
  return events;
}

describe('LarpRouter URL & API key normalization', () => {
  it('normalizes both OpenAI (/v1) and Anthropic root URLs to https://larprouter.com/v1', () => {
    expect(normalizeLarpRouterBaseUrl(undefined)).toBe('https://larprouter.com/v1');
    expect(normalizeLarpRouterBaseUrl('')).toBe('https://larprouter.com/v1');
    expect(normalizeLarpRouterBaseUrl('https://larprouter.com/v1/')).toBe('https://larprouter.com/v1');
    expect(normalizeLarpRouterBaseUrl('https://larprouter.com')).toBe('https://larprouter.com/v1');
    expect(normalizeLarpRouterBaseUrl('https://larprouter.com/v1/chat/completions')).toBe(
      'https://larprouter.com/v1'
    );
  });

  it('cleans pasted API keys with accidental Bearer / x-api-key prefixes or quotes', () => {
    expect(cleanApiKey('  lrsk-64e5d01cc8521  ')).toBe('lrsk-64e5d01cc8521');
    expect(cleanApiKey('Bearer lrsk-64e5d01cc8521')).toBe('lrsk-64e5d01cc8521');
    expect(cleanApiKey('x-api-key: lrsk-64e5d01cc8521')).toBe('lrsk-64e5d01cc8521');
    expect(cleanApiKey('"lrsk-64e5d01cc8521"')).toBe('lrsk-64e5d01cc8521');
  });

  it('auto-routes lrsk- keys even when pasted into OpenAI or Groq headers', () => {
    const req = new Request('http://localhost/api/ai', {
      headers: { 'x-openai-key': 'Bearer lrsk-misplaced-key-99' },
    });
    const resolved = resolveProviderKeys(req);
    expect(resolved.larprouterKey).toBe('lrsk-misplaced-key-99');
    expect(resolved.openaiKey).toBe('');
  });
});

describe('Reasoning <think> tag splitter', () => {
  it('splits fragmented <think>...</think> chunks cleanly without leaking tags into answer delta', () => {
    const thoughts: string[] = [];
    const contents: string[] = [];
    const splitter = createThinkTagSplitter(
      (t) => thoughts.push(t),
      (c) => contents.push(c)
    );

    for (const chunk of ['<thi', 'nk>Derive ', 'F = ma step ', 'by step</th', 'ink>\n\n## Final ', 'Answer\nF = ma']) {
      splitter.push(chunk);
    }
    splitter.flush();

    expect(thoughts.join('')).toBe('Derive F = ma step by step');
    expect(contents.join('')).toBe('## Final Answer\nF = ma');
  });

  it('passes normal Markdown content immediately without buffering', () => {
    const contents: string[] = [];
    const splitter = createThinkTagSplitter(
      () => {},
      (c) => contents.push(c)
    );
    splitter.push('## Quantum');
    expect(contents).toEqual(['## Quantum']);
    splitter.push(' Notes');
    expect(contents.join('')).toBe('## Quantum Notes');
  });

  it('strips <think> blocks in non-streaming responses', () => {
    const out = stripThinkTags('<think>Check discriminant D = 1</think>\n\n**Roots: 2, 3**');
    expect(out.thinking).toBe('Check discriminant D = 1');
    expect(out.content).toBe('**Roots: 2, 3**');
  });
});

describe('NikAI /api/ai LarpRouter gateway routing & resilience', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('reports larprouter provider ready on GET /api/ai when X-LarpRouter-Key is supplied', async () => {
    const res = await apiHandler(
      new Request('http://localhost/api/ai', {
        method: 'GET',
        headers: { 'x-larprouter-key': 'lrsk-test-health-01' },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.providers.larprouter).toBe(true);
  });

  it('streams DeepSeek V4.1 from https://larprouter.com/v1/chat/completions and separates <think> reasoning', async () => {
    const upstreamCalls: Array<{ url: string; auth: string; body: any }> = [];
    globalThis.fetch = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      upstreamCalls.push({ url, auth: headers.get('authorization') || '', body });

      return new Response(
        buildOpenAISSEBody([
          { content: '<think>Analyzing thermodynamics laws...</think>\n' },
          { content: '## First Law of Thermodynamics\nEnergy is conserved.' },
        ]),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }) as unknown as typeof fetch;

    const res = await apiHandler(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LarpRouter-Key': 'lrsk-live-stream-test-01',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Explain First Law of Thermodynamics' }],
          mode: 'auto',
          model: 'astra-auto',
          stream: true,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(upstreamCalls).toHaveLength(1);
    expect(upstreamCalls[0].url).toBe('https://larprouter.com/v1/chat/completions');
    expect(upstreamCalls[0].auth).toBe('Bearer lrsk-live-stream-test-01');
    expect(upstreamCalls[0].body.model).toBe('deepseek-v4.1-flash');

    const events = await readAllSSEEvents(res);
    const meta = events.find((e) => e.meta);
    expect(meta?.provider).toBe('larprouter');
    expect(meta?.model).toContain('DeepSeek V4.1');

    const thinkingText = events.map((e) => e.thinking || '').join('');
    const answerText = events.map((e) => e.delta || '').join('');
    expect(thinkingText).toBe('Analyzing thermodynamics laws...');
    expect(answerText).toBe('## First Law of Thermodynamics\nEnergy is conserved.');
  });

  it('routes code mode to glm-5.3 and deep/pro mode to kimi-k3.1-pro when credit is available', async () => {
    const modelsRequested: string[] = [];
    globalThis.fetch = vi.fn(async (_input: any, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      modelsRequested.push(body.model);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'Clean solution' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    await apiHandler(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LarpRouter-Key': 'lrsk-funded-pro-02' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Implement Dijkstra in TypeScript' }],
          mode: 'code',
          model: 'astra-coder',
          stream: false,
        }),
      })
    );

    await apiHandler(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LarpRouter-Key': 'lrsk-funded-pro-03' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Prove Euler formula' }],
          mode: 'deep',
          model: 'astra-pro',
          stream: false,
        }),
      })
    );

    expect(modelsRequested).toEqual(['glm-5.3', 'kimi-k3.1-pro']);
  });

  it('gracefully falls back from paid 402 to Free-tier deepseek-v4.1-flash, and then to Groq if all LarpRouter routes 402', async () => {
    const tried: string[] = [];
    // Case 1: Paid kimi-k3.1-pro returns 402, Free-tier deepseek-v4.1-flash succeeds!
    globalThis.fetch = vi.fn(async (input: any, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      tried.push(`${String(input).includes('larprouter') ? 'larp' : 'groq'}:${body.model}`);
      if (body.model === 'kimi-k3.1-pro' || body.model === 'glm-5.3') {
        return new Response(JSON.stringify({ error: { type: 'insufficient_credit' } }), { status: 402 });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'Solved on Free Tier!' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const freeTierRes = await apiHandler(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LarpRouter-Key': 'lrsk-zero-bal-free-ok' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Solve integral of x^2' }],
          mode: 'deep',
          model: 'astra-pro',
          stream: false,
        }),
      })
    );
    expect(freeTierRes.status).toBe(200);
    const freeTierJson = await freeTierRes.json();
    expect(freeTierJson.content).toBe('Solved on Free Tier!');
    expect(freeTierJson.provider).toBe('larprouter');

    // Case 2: All LarpRouter routes return 402 -> immediately fails over to Groq without hanging!
    tried.length = 0;
    globalThis.fetch = vi.fn(async (input: any, init?: RequestInit) => {
      const isLarp = String(input).includes('larprouter.com');
      const body = JSON.parse(String(init?.body || '{}'));
      tried.push(`${isLarp ? 'larp' : 'groq'}:${body.model}`);
      if (isLarp) {
        return new Response(JSON.stringify({ error: { type: 'insufficient_credit' } }), { status: 402 });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'Answered via Groq failover' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const failoverRes = await apiHandler(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LarpRouter-Key': 'lrsk-all-402-key',
          'X-Groq-Key': 'gsk_backup_key',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello NikAI' }],
          mode: 'auto',
          stream: false,
        }),
      })
    );
    expect(failoverRes.status).toBe(200);
    const failoverJson = await failoverRes.json();
    expect(failoverJson.provider).toBe('groq');
    expect(failoverJson.content).toBe('Answered via Groq failover');
    // Free-tier deepseek-v4.1-flash 402 immediately aborted remaining LarpRouter hops!
    expect(tried).toEqual(['larp:deepseek-v4.1-flash', 'groq:openai/gpt-oss-120b']);
  });

  it('heals custom LarpRouter model pools via GET /v1/models on 404', async () => {
    globalThis.fetch = vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://larprouter.com/v1/models') {
        return new Response(
          JSON.stringify({ data: [{ id: 'claude-sonnet-4-6' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const body = JSON.parse(String(init?.body || '{}'));
      if (body.model !== 'claude-sonnet-4-6') {
        return new Response(JSON.stringify({ error: 'model_not_in_pool' }), { status: 404 });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'Answered by Claude pool!' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const res = await apiHandler(
      new Request('http://localhost/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LarpRouter-Key': 'lrsk-claude-pool-key' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello!' }],
          mode: 'auto',
          stream: false,
        }),
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.content).toBe('Answered by Claude pool!');
    expect(json.provider).toBe('larprouter');
  });

  it('sends stream: true to LarpRouter during GET /api/ai?probe=1 and collects SSE answer cleanly', async () => {
    let probeUpstreamBody: any = null;
    globalThis.fetch = vi.fn(async (_input: any, init?: RequestInit) => {
      probeUpstreamBody = JSON.parse(String(init?.body || '{}'));
      return new Response(
        buildOpenAISSEBody([{ content: '<think>checking...</think>' }, { content: 'OK' }]),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }) as unknown as typeof fetch;

    const res = await apiHandler(
      new Request('http://localhost/api/ai?probe=1', {
        method: 'GET',
        headers: { 'X-LarpRouter-Key': 'lrsk-probe-sse-test' },
      })
    );
    expect(res.status).toBe(200);
    expect(probeUpstreamBody.stream).toBe(true);
    expect(probeUpstreamBody.temperature).toBeUndefined();
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.probe.ok).toBe(true);
    expect(json.probe.provider).toBe('larprouter');
    expect(json.probe.model).toBe('deepseek-v4.1-flash');
    expect(json.probe.answer).toBe('OK');
  });
});

describe('Client aiEngine & Checkup LarpRouter integration', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('persists larprouterKey cleanly and forwards X-LarpRouter-Key from streamAstaAI', async () => {
    saveCustomAIKeys({ larprouterKey: 'Bearer lrsk-client-saved-77' });
    const saved = readCustomAIKeys();
    expect(saved.larprouterKey).toBe('lrsk-client-saved-77');
    expect(resolveAstaModel('deepseek')).toBe('astra-auto');
    expect(resolveAstaModel('kimi')).toBe('astra-pro');
    expect(resolveAstaModel('glm')).toBe('astra-coder');

    let capturedHeader = '';
    globalThis.fetch = vi.fn(async (input: any, init?: RequestInit) => {
      if (String(input) === '/api/ai' && init?.method === 'POST') {
        const h = init.headers as Record<string, string>;
        capturedHeader = h['X-LarpRouter-Key'] || '';
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ meta: true, model: 'NikAI Astra · DeepSeek V4.1', provider: 'larprouter' })}\n\n`
              )
            );
            c.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: 'Namaste from LarpRouter!' })}\n\n`));
            c.enqueue(encoder.encode('data: [DONE]\n\n'));
            c.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return new Response(JSON.stringify({ ok: true, providers: { larprouter: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const probe = await probeAstaProviders();
    expect(probe.cloudReady).toBe(true);
    expect(probe.providers).toContain('NikAI Astra LarpRouter 1M');

    const result = await streamAstaAI({
      messages: [{ role: 'user', content: 'Namaste' }],
      mode: 'auto',
    });
    expect(capturedHeader).toBe('lrsk-client-saved-77');
    expect(result.provider).toBe('larprouter');
    expect(result.content).toBe('Namaste from LarpRouter!');
  });

  it('formats larprouter in Check-up providers and warns clearly on 402 insufficient_credit', async () => {
    expect(formatProviders({ larprouter: true, groq: true, gemini: false })).toBe(
      'larprouter ✓ · groq ✓ · gemini ✕'
    );

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          providers: { larprouter: true, groq: false, gemini: false, openai: false },
          probe: { ok: false, errors: ['larprouter/deepseek-v4.1-flash: 402 insufficient_credit'] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const res = await checkAi();
    expect(res.status).toBe('warn');
    expect(res.detail).toContain('larprouter ✓');
    expect(res.detail).toContain('$0.00');
  });
});
