// ============================================================================
// NikAI — Astra Neural Core Serverless Multi-Provider Streaming Gateway
// Endpoint: /api/ai (GET health probe, POST SSE/JSON chat + vision + memory)
// ============================================================================

export const config = {
  runtime: 'edge',
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Groq-Key, X-Gemini-Key, X-OpenAI-Key',
};

interface IncomingImage {
  mimeType?: string;
  dataUrl: string;
}

interface IncomingMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: IncomingImage[];
}

interface AIRequestBody {
  messages?: IncomingMessage[];
  prompt?: string;
  mode?: string;
  model?: string;
  action?: string;
  targetLanguage?: string;
  instruction?: string;
  noteContext?: string;
  memoryContext?: string;
  stream?: boolean;
}

const NIKAI_ASTRA_IDENTITY = `You are **NikAI** (powered by **Astra Neural Core**), the single unified flagship AI intelligence built exclusively into **NikNote** (https://www.niknote.online).

Core Capabilities & Identity:
- Always identify yourself naturally as **NikAI** (powered by NikNote's Astra engine) — NEVER mention separate old tools like "AI 4.0", "AI Solver", or "AI Workshop".
- Language Mastery: Match the user's language naturally and effortlessly — crisp **English**, natural **Hinglish**, or pure **Hindi**, or any requested target language.
- Persistent Session Memory: When "Active User Memory & Previous Sessions" is provided below, seamlessly use the user's name, exam/course goals, preferences, and prior session context without sounding robotic.
- Notes Implementation Excellence: Structure study notes, explanations, and solutions cleanly with Markdown headings (\`##\`, \`###\`), **bold key terms**, bullet points, comparison tables, code/formula blocks, callouts (\`> 💡 Pro-Tip:\`), and checklists (\`- [ ]\`) so NikNote's 1-tap **Handwriting & Smart Notes Engine** converts them into multi-color handwritten notebook pages effortlessly.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  auto: `Deliver complete, insightful, exam- & production-grade answers tailored to the question's depth.`,
  deep: `MODE: **ASTRA PRO DEEP THINK**. Reason methodically from first principles, check every equation and edge case, show clear logical derivations, and highlight the final answer unmistakably.`,
  teacher: `MODE: **MASTER GURU**. Teach with: 1) **30-Second Intuition & Real-Life Analogy**, 2) **Core Step-by-Step Breakdown**, 3) **Formulas / Key Rules**, 4) **Worked Exam Example**, 5) **> 💡 Exam Pro-Tip**.`,
  solver: `MODE: **STEP-BY-STEP SOLVER**. Present: **Given** → **Concept / Formula** → **Step-by-Step Working** → **Verification** → **✅ Final Answer** → **⚡ Shortcut Trick**.`,
  code: `MODE: **ASTRA CODER**. Write clean, complete, production-ready fenced code blocks with language tags, brief architecture explanation, edge cases, and **Time & Space Complexity**.`,
  notes: `MODE: **SMART NOTES ARCHITECT**. Generate complete revision-ready notebook pages with \`# Chapter Title\`, \`## Key Sections\`, bullet points with **bold terms: crisp definitions**, formula callouts, comparison table, memory mnemonic, and 3 self-check questions.`,
  quiz: `MODE: **LIVE INTERACTIVE QUIZ**. Create 5 high-yield MCQs (Easy → Exam Tough). Format EVERY question strictly as:
### Q1. [Clear question text]
- A) [Option A]
- B) [Option B]
- C) [Option C]
- D) [Option D]
**Answer:** [Single letter A, B, C, or D]
**Explanation:** [Crisp 1-2 line explanation]`,
  write: `MODE: **WRITING STUDIO**. Craft compelling, natural, publication-ready writing, summaries, grammar fixes, or translations matching the exact requested tone.`,
};

function buildInlineActionPrompt(body: AIRequestBody, rawText: string): { system: string; user: string } {
  const inlineSys = 'You are NikAI inline writing assistant inside NikNote. Output clean, ready-to-insert text directly without meta commentary. Match the user language unless asked to translate.';
  const ctx = body.noteContext ? `\n\nDocument context:\n${body.noteContext.slice(0, 6000)}` : '';
  switch (body.action) {
    case 'improve':
      return { system: inlineSys, user: `Improve clarity, flow, and impact while keeping exact meaning:\n\n${rawText}${ctx}` };
    case 'fix_grammar':
      return { system: inlineSys, user: `Fix all spelling, grammar, and punctuation cleanly:\n\n${rawText}` };
    case 'shorten':
      return { system: inlineSys, user: `Make this concise and punchy without losing key points:\n\n${rawText}` };
    case 'lengthen':
      return { system: inlineSys, user: `Expand with rich, concrete detail and examples:\n\n${rawText}${ctx}` };
    case 'continue':
      return { system: inlineSys, user: `Continue writing naturally from where this stops:\n\n${rawText}${ctx}` };
    case 'translate':
      return { system: inlineSys, user: `Translate naturally into ${body.targetLanguage || 'English'}:\n\n${rawText}` };
    case 'summarize':
      return { system: inlineSys, user: `Summarize into crisp high-signal bullet points:\n\n${rawText}${ctx}` };
    default:
      return { system: `${NIKAI_ASTRA_IDENTITY}\n\n${MODE_INSTRUCTIONS[body.mode || 'auto'] || MODE_INSTRUCTIONS.auto}`, user: `${body.instruction ? `${body.instruction}\n\n` : ''}${rawText}${ctx}` };
  }
}

function getEnv(name: string): string {
  try {
    const val = (globalThis as any)?.process?.env?.[name];
    return typeof val === 'string' ? val.trim() : '';
  } catch {
    return '';
  }
}

function parseDataUrl(dataUrl: string, fallbackMime = 'image/jpeg'): { mimeType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (match) return { mimeType: match[1], base64: match[2] };
  return { mimeType: fallbackMime, base64: dataUrl };
}

function createNormalizedSSEStream(
  upstreamBody: ReadableStream<Uint8Array>,
  parser: 'openai' | 'gemini',
  modelLabel: string,
  providerName: string
): ReadableStream<Uint8Array> {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '';
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ meta: true, model: modelLabel, provider: providerName })}\n\n`)
      );

      const processLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload);
          if (parser === 'openai') {
            const deltaObj = parsed?.choices?.[0]?.delta;
            const reasoning = deltaObj?.reasoning ?? deltaObj?.reasoning_content;
            if (typeof reasoning === 'string' && reasoning.length > 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: reasoning })}\n\n`));
            }
            const text = deltaObj?.content;
            if (typeof text === 'string' && text.length > 0) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
            }
          } else {
            const parts = parsed?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part?.thought && typeof part.text === 'string') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: part.text })}\n\n`));
                } else if (typeof part?.text === 'string' && part.text.length > 0) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: part.text })}\n\n`));
                }
              }
            }
          }
        } catch {
          // ignore partial chunks
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const l of lines) processLine(l);
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const l of buffer.split('\n')) processLine(l);
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

// ---------------------------------------------------------------------------
// Live probe: `GET /api/ai?probe=1` asks each configured provider for a single
// word, so anyone (and the in-app Check-up page) can prove that the keys and
// the upstream models are actually answering — a plain browser URL is enough,
// no POST needed. Cost per hit: a handful of tokens.
// ---------------------------------------------------------------------------
async function runProbe(groqKey: string, geminiKey: string, openaiKey: string): Promise<Response> {
  const started = Date.now();
  const prompt = 'Reply with exactly one word: OK';
  const errors: string[] = [];

  const attempts: Array<{ provider: 'groq' | 'gemini' | 'openai'; model: string }> = [];
  if (groqKey) attempts.push({ provider: 'groq', model: 'llama-3.1-8b-instant' });
  if (geminiKey) attempts.push({ provider: 'gemini', model: 'gemini-2.0-flash' });
  if (openaiKey) attempts.push({ provider: 'openai', model: 'gpt-4o-mini' });
  if (groqKey) attempts.push({ provider: 'groq', model: 'llama-3.3-70b-versatile' });

  for (const attempt of attempts) {
    try {
      const signal = AbortSignal.timeout(12000);
      if (attempt.provider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
          }
        );
        if (!res.ok) {
          errors.push(`gemini/${attempt.model}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
          continue;
        }
        const json: any = await res.json();
        const answer =
          json?.candidates?.[0]?.content?.parts
            ?.filter((p: any) => !p.thought)
            ?.map((p: any) => p.text || '')
            ?.join('')
            ?.trim() ?? '';
        return new Response(
          JSON.stringify({
            ok: Boolean(answer),
            provider: 'gemini',
            model: attempt.model,
            answer: answer.slice(0, 40),
            ms: Date.now() - started,
            errors,
          }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
        );
      }

      const key = attempt.provider === 'groq' ? groqKey : openaiKey;
      const base = attempt.provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        signal,
        body: JSON.stringify({
          model: attempt.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 24,
          temperature: 0,
          stream: false,
        }),
      });
      if (!res.ok) {
        errors.push(`${attempt.provider}/${attempt.model}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
        continue;
      }
      const json: any = await res.json();
      const answer = String(json?.choices?.[0]?.message?.content ?? '').trim();
      return new Response(
        JSON.stringify({
          ok: Boolean(answer),
          provider: attempt.provider,
          model: attempt.model,
          answer: answer.slice(0, 40),
          ms: Date.now() - started,
          errors,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    } catch (error: any) {
      errors.push(`${attempt.provider}/${attempt.model}: ${String(error?.message || error).slice(0, 120)}`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: false,
      provider: null,
      model: null,
      answer: '',
      ms: Date.now() - started,
      errors: errors.length ? errors : ['no_provider_configured'],
    }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  const groqKey = (req.headers.get('x-groq-key') || '').trim() || getEnv('GROQ_API_KEY') || getEnv('VITE_GROQ_KEY');
  const geminiKey = (req.headers.get('x-gemini-key') || '').trim() || getEnv('GEMINI_API_KEY') || getEnv('VITE_GEMINI_KEY');
  const openaiKey = (req.headers.get('x-openai-key') || '').trim() || getEnv('OPENAI_API_KEY') || getEnv('VITE_OPENAI_KEY');

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const providers = {
      groq: Boolean(groqKey),
      gemini: Boolean(geminiKey),
      openai: Boolean(openaiKey),
    };

    // ?probe=1 — real completion from each provider, so AI health is provable
    // from a plain URL (used by the in-app Check-up page and by smoke tests).
    if (url.searchParams.get('probe')) {
      const probe = await runProbe(groqKey, geminiKey, openaiKey);
      const payload = (await probe.json()) as Record<string, unknown>;
      return new Response(
        JSON.stringify({ ok: Boolean(payload.ok), engine: 'NikAI Astra Neural Core', providers, probe: payload }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, engine: 'NikAI Astra Neural Core', providers }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: AIRequestBody;
  try {
    body = (await req.json()) as AIRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Accept both the canonical ids and the short UI ids (`tutor`, `writing`,
  // `pro`, `flash`, `vision`) so persona + model routing never silently drops.
  const MODE_ALIASES: Record<string, string> = {
    tutor: 'teacher',
    teaching: 'teacher',
    guru: 'teacher',
    learn: 'teacher',
    writing: 'write',
    writer: 'write',
    essay: 'write',
    vision: 'auto',
    solve: 'solver',
    homework: 'solver',
  };
  const MODEL_ALIASES: Record<string, string> = {
    auto: 'astra-auto',
    pro: 'astra-pro',
    flash: 'astra-flash',
    vision: 'astra-vision',
    coder: 'astra-coder',
    code: 'astra-coder',
  };
  const requestedMode = String(body.mode || 'auto').trim().toLowerCase();
  const mode = MODE_ALIASES[requestedMode] || requestedMode;
  const wantStream = body.stream !== false;

  let systemInstruction = `${NIKAI_ASTRA_IDENTITY}\n\n${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.auto}`;
  let conversation: IncomingMessage[] = [];

  if (body.action && (body.prompt || body.messages?.length)) {
    const rawText = body.prompt || body.messages?.[body.messages.length - 1]?.content || '';
    const inlineBuilt = buildInlineActionPrompt(body, rawText);
    systemInstruction = inlineBuilt.system;
    conversation = [{ role: 'user', content: inlineBuilt.user }];
  } else if (Array.isArray(body.messages) && body.messages.length > 0) {
    const systemFromClient = body.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    if (systemFromClient) systemInstruction = `${systemInstruction}\n\n${systemFromClient}`;
    conversation = body.messages.filter((m) => m.role !== 'system');
  } else if (body.prompt) {
    conversation = [{ role: 'user', content: body.prompt }];
  }

  if (body.memoryContext && body.memoryContext.trim()) {
    systemInstruction += `\n\n--- ACTIVE USER MEMORY & PREVIOUS SESSIONS ---\n${body.memoryContext.slice(0, 6000)}\n--- END MEMORY ---`;
  }

  if (body.noteContext && body.noteContext.trim()) {
    systemInstruction += `\n\n--- ATTACHED USER NOTE CONTEXT ---\n${body.noteContext.slice(0, 14000)}\n--- END NOTE CONTEXT ---`;
  }

  if (conversation.length === 0) {
    return new Response(JSON.stringify({ error: 'No prompt or messages supplied' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const hasImages = conversation.some((m) => Array.isArray(m.images) && m.images.length > 0);
  const rawModel = String(body.model || 'astra-auto').trim().toLowerCase();
  const requestedModel = MODEL_ALIASES[rawModel] || rawModel;

  type Candidate = { provider: 'groq' | 'gemini' | 'openai'; model: string; label: string };
  const candidates: Candidate[] = [];

  if (hasImages || requestedModel === 'astra-vision') {
    if (geminiKey) {
      candidates.push({ provider: 'gemini', model: 'gemini-2.5-flash', label: 'NikAI Astra Vision' });
      candidates.push({ provider: 'gemini', model: 'gemini-2.0-flash', label: 'NikAI Astra Vision' });
    }
    if (groqKey) {
      candidates.push({ provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'NikAI Astra Vision' });
    }
    if (openaiKey) {
      candidates.push({ provider: 'openai', model: 'gpt-4o', label: 'NikAI Astra Vision Pro' });
    }
  } else if (requestedModel === 'astra-pro' || mode === 'deep') {
    if (openaiKey) candidates.push({ provider: 'openai', model: 'gpt-4o', label: 'NikAI Astra Pro' });
    if (groqKey) candidates.push({ provider: 'groq', model: 'openai/gpt-oss-120b', label: 'NikAI Astra Pro 120B' });
    if (geminiKey) candidates.push({ provider: 'gemini', model: 'gemini-2.5-pro', label: 'NikAI Astra Pro' });
    if (groqKey) candidates.push({ provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'NikAI Astra Core' });
    if (geminiKey) candidates.push({ provider: 'gemini', model: 'gemini-2.5-flash', label: 'NikAI Astra Flash' });
  } else if (requestedModel === 'astra-coder' || mode === 'code') {
    if (openaiKey) candidates.push({ provider: 'openai', model: 'gpt-4o', label: 'NikAI Astra Coder' });
    if (groqKey) candidates.push({ provider: 'groq', model: 'openai/gpt-oss-120b', label: 'NikAI Astra Coder 120B' });
    if (groqKey) candidates.push({ provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'NikAI Astra Coder' });
    if (geminiKey) candidates.push({ provider: 'gemini', model: 'gemini-2.5-pro', label: 'NikAI Astra Coder' });
  } else {
    if (openaiKey) candidates.push({ provider: 'openai', model: 'gpt-4o', label: 'NikAI Astra Core' });
    if (groqKey) {
      candidates.push({ provider: 'groq', model: 'llama-3.3-70b-versatile', label: requestedModel === 'astra-flash' ? 'NikAI Astra Flash' : 'NikAI Astra Core' });
      candidates.push({ provider: 'groq', model: 'openai/gpt-oss-120b', label: 'NikAI Astra Pro' });
      candidates.push({ provider: 'groq', model: 'llama-3.1-8b-instant', label: 'NikAI Astra Instant' });
    }
    if (geminiKey) {
      candidates.push({ provider: 'gemini', model: 'gemini-2.5-flash', label: 'NikAI Astra Flash' });
      candidates.push({ provider: 'gemini', model: 'gemini-2.0-flash', label: 'NikAI Astra Flash' });
    }
  }

  if (candidates.length === 0) {
    return new Response(
      JSON.stringify({
        error: 'no_api_key_configured',
        message: 'No AI provider key configured on server.',
      }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      if (candidate.provider === 'groq' || candidate.provider === 'openai') {
        const key = candidate.provider === 'groq' ? groqKey : openaiKey;
        const url =
          candidate.provider === 'groq'
            ? 'https://api.groq.com/openai/v1/chat/completions'
            : 'https://api.openai.com/v1/chat/completions';

        const oaMessages = [
          { role: 'system', content: systemInstruction },
          ...conversation.map((m) => {
            if (m.images && m.images.length > 0 && m.role === 'user') {
              return {
                role: 'user',
                content: [
                  { type: 'text', text: m.content || 'Analyze this image thoroughly.' },
                  ...m.images.map((img) => ({
                    type: 'image_url',
                    image_url: { url: img.dataUrl },
                  })),
                ],
              };
            }
            return { role: m.role, content: m.content };
          }),
        ];

        const upstream = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          signal: req.signal,
          body: JSON.stringify({
            model: candidate.model,
            messages: oaMessages,
            stream: wantStream,
            temperature: mode === 'code' || mode === 'solver' ? 0.35 : 0.6,
            max_tokens: 4096,
          }),
        });

        if (!upstream.ok) {
          const errTxt = await upstream.text().catch(() => '');
          errors.push(`${candidate.provider}/${candidate.model}: ${upstream.status} ${errTxt.slice(0, 140)}`);
          continue;
        }

        if (!wantStream) {
          const json = await upstream.json();
          const content = json?.choices?.[0]?.message?.content ?? '';
          return new Response(
            JSON.stringify({ content, model: candidate.label, provider: candidate.provider }),
            { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        if (!upstream.body) continue;
        return new Response(
          createNormalizedSSEStream(upstream.body, 'openai', candidate.label, candidate.provider),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'X-Accel-Buffering': 'no',
            },
          }
        );
      }

      if (candidate.provider === 'gemini') {
        const endpoint = wantStream
          ? `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(geminiKey)}`
          : `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent?key=${encodeURIComponent(geminiKey)}`;

        const geminiContents = conversation.map((m) => {
          const parts: any[] = [];
          if (m.content) parts.push({ text: m.content });
          if (m.images && m.images.length > 0) {
            for (const img of m.images) {
              const { mimeType, base64 } = parseDataUrl(img.dataUrl, img.mimeType);
              parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
            }
          }
          if (parts.length === 0) parts.push({ text: 'Hello' });
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts,
          };
        });

        const upstream = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: req.signal,
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: geminiContents,
            generationConfig: {
              temperature: mode === 'code' || mode === 'solver' ? 0.35 : 0.6,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (!upstream.ok) {
          const errTxt = await upstream.text().catch(() => '');
          errors.push(`gemini/${candidate.model}: ${upstream.status} ${errTxt.slice(0, 140)}`);
          continue;
        }

        if (!wantStream) {
          const json = await upstream.json();
          const content =
            json?.candidates?.[0]?.content?.parts
              ?.filter((p: any) => !p.thought)
              ?.map((p: any) => p.text || '')
              ?.join('') ?? '';
          return new Response(
            JSON.stringify({ content, model: candidate.label, provider: 'gemini' }),
            { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        if (!upstream.body) continue;
        return new Response(
          createNormalizedSSEStream(upstream.body, 'gemini', candidate.label, 'gemini'),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'X-Accel-Buffering': 'no',
            },
          }
        );
      }
    } catch (err: any) {
      if (req.signal?.aborted) {
        return new Response(null, { status: 499, headers: CORS_HEADERS });
      }
      errors.push(`${candidate.provider}/${candidate.model}: ${err?.message || 'network failure'}`);
    }
  }

  return new Response(
    JSON.stringify({ error: 'all_providers_failed', details: errors }),
    { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
  );
}
