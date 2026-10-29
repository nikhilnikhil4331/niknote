// ============================================================================
// NikAI — Astra Neural Core Serverless Multi-Provider Streaming Gateway
// Endpoint: /api/ai (GET health/models/probe, POST SSE/JSON chat + vision + memory)
// Primary Multi-Model Router: LarpRouter (https://larprouter.com/v1)
// Resilient Fallbacks: Groq, Google Gemini, OpenAI
// ============================================================================

export const config = {
  runtime: 'edge',
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-LarpRouter-Key, X-Groq-Key, X-Gemini-Key, X-OpenAI-Key',
};

export const DEFAULT_LARPROUTER_BASE_URL = 'https://larprouter.com/v1';

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
- Academic & Technical Precision: Deliver accurate, verified derivations, formulas, algorithms, and exam-grade clarity (JEE, NEET, CBSE, ICSE, UPSC, University, and Production Software Engineering). Never guess or hallucinate facts; verify calculations step by step.
- Persistent Session Memory: When "Active User Memory & Previous Sessions" is provided below, seamlessly use the user's name, exam/course goals, preferences, and prior session context without sounding robotic.
- Notes Implementation Excellence: Structure study notes, explanations, and solutions cleanly with Markdown headings (\`##\`, \`###\`), **bold key terms**, bullet points, comparison tables, code/formula blocks, callouts (\`> 💡 Pro-Tip:\`), and checklists (\`- [ ]\`) so NikNote's 1-tap **Handwriting & Smart Notes Engine** converts them into multi-color handwritten notebook pages effortlessly.`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  auto: `Deliver complete, insightful, exam- & production-grade answers tailored to the question's depth.`,
  deep: `MODE: **ASTRA PRO DEEP THINK**. Reason methodically from first principles, verify every equation, boundary condition, and edge case, show crystal-clear logical derivations, and highlight the final answer unmistakably.`,
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

function buildInlineActionPrompt(body: AIRequestBody, rawText: string, maxCtx = 16000): { system: string; user: string } {
  const inlineSys =
    'You are NikAI inline writing assistant inside NikNote. Output clean, ready-to-insert text directly without meta commentary. Match the user language unless asked to translate.';
  const ctx = body.noteContext ? `\n\nDocument context:\n${body.noteContext.slice(0, maxCtx)}` : '';
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
      return {
        system: `${NIKAI_ASTRA_IDENTITY}\n\n${MODE_INSTRUCTIONS[body.mode || 'auto'] || MODE_INSTRUCTIONS.auto}`,
        user: `${body.instruction ? `${body.instruction}\n\n` : ''}${rawText}${ctx}`,
      };
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

/** Normalize pasted API keys (strips quotes, accidental 'Bearer ' or 'x-api-key:' prefixes). */
export function cleanApiKey(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^(?:bearer|x-api-key:?)\s+/i, '')
    .trim();
}

/**
 * Normalize LarpRouter base URL so both `https://larprouter.com/v1` (OpenAI SDK)
 * and `https://larprouter.com` (Anthropic SDK URL from dashboard) resolve cleanly
 * to `https://larprouter.com/v1`.
 */
export function normalizeLarpRouterBaseUrl(raw?: string | null): string {
  const cleaned = (raw || '').trim().replace(/\/+$/, '');
  if (!cleaned) return DEFAULT_LARPROUTER_BASE_URL;
  const withoutEndpoint = cleaned.replace(/\/(?:chat\/completions|messages|models)$/i, '');
  if (/^https?:\/\/(?:www\.)?larprouter\.com$/i.test(withoutEndpoint)) {
    return `${withoutEndpoint}/v1`;
  }
  return withoutEndpoint;
}

/**
 * Extract `<think>...</think>` blocks from non-streaming completions so reasoning
 * models (DeepSeek V4.1, GLM-5.3, Qwen 3.8, Kimi K3.1) never leak XML tags into notes.
 */
export function stripThinkTags(raw: string): { content: string; thinking: string } {
  if (!raw) return { content: '', thinking: '' };
  const thinkingParts: string[] = [];
  const cleaned = raw.replace(/<think>([\s\S]*?)<\/think>\s*/gi, (_m, inner) => {
    if (inner && inner.trim()) thinkingParts.push(inner.trim());
    return '';
  });
  return { content: cleaned.trim(), thinking: thinkingParts.join('\n\n') };
}

/**
 * Consume an OpenAI-compatible response that may arrive either as an SSE stream
 * (`data: {...}\n\n` — LarpRouter's native gateway mode) or as a standard JSON
 * completion payload, returning clean `{ content, thinking }`.
 */
async function consumeOpenAICompletion(res: Response): Promise<{ content: string; thinking: string }> {
  const raw = await res.text();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const trimmed = raw.trimStart();

  if (contentType.includes('text/event-stream') || trimmed.startsWith('data:')) {
    const contentChunks: string[] = [];
    const thinkingChunks: string[] = [];
    const splitter = createThinkTagSplitter(
      (t) => thinkingChunks.push(t),
      (c) => contentChunks.push(c)
    );

    for (const rawLine of raw.split('\n')) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const deltaObj = parsed?.choices?.[0]?.delta;
        const reasoning = deltaObj?.reasoning ?? deltaObj?.reasoning_content;
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          thinkingChunks.push(reasoning);
        }
        const text = deltaObj?.content;
        if (typeof text === 'string' && text.length > 0) {
          splitter.push(text);
        }
      } catch {
        // ignore partial/comment lines
      }
    }
    splitter.flush();
    return {
      content: contentChunks.join('').trim(),
      thinking: thinkingChunks.join('').trim(),
    };
  }

  try {
    const json: any = JSON.parse(raw);
    const rawContent = String(json?.choices?.[0]?.message?.content ?? '');
    const { content, thinking } = stripThinkTags(rawContent);
    const extraThinking = String(
      json?.choices?.[0]?.message?.reasoning ?? json?.choices?.[0]?.message?.reasoning_content ?? ''
    ).trim();
    return {
      content,
      thinking: [extraThinking, thinking].filter(Boolean).join('\n\n'),
    };
  } catch {
    return stripThinkTags(raw);
  }
}

/**
 * Stateful streaming splitter for `<think>...</think>` tags across arbitrary SSE
 * token boundaries. Normal text that does not begin with `<` passes through with
 * zero buffering latency.
 */
export function createThinkTagSplitter(
  onThinking: (chunk: string) => void,
  onContent: (chunk: string) => void
) {
  const OPEN_TAG = '<think>';
  const CLOSE_TAG = '</think>';
  let checkedStart = false;
  let inThink = false;
  let pending = '';
  let stripLeadingNewlineAfterThink = false;

  const emitCleanContent = (text: string) => {
    if (!text) return;
    let out = text;
    if (stripLeadingNewlineAfterThink) {
      out = out.replace(/^\r?\n+/, '');
      if (out.length > 0) stripLeadingNewlineAfterThink = false;
    }
    if (out) onContent(out);
  };

  return {
    push(delta: string) {
      if (!delta) return;

      if (!checkedStart) {
        pending += delta;
        const trimmedLead = pending.replace(/^\s+/, '');
        if (!trimmedLead) return; // still only leading whitespace

        const lower = trimmedLead.toLowerCase();
        if (OPEN_TAG.startsWith(lower) && lower.length < OPEN_TAG.length) {
          // Wait for a few more bytes to confirm `<think>`
          return;
        }
        checkedStart = true;
        if (lower.startsWith(OPEN_TAG)) {
          inThink = true;
          pending = trimmedLead.slice(OPEN_TAG.length);
        } else {
          const out = pending;
          pending = '';
          onContent(out);
          return;
        }
      } else if (inThink) {
        pending += delta;
      } else {
        emitCleanContent(delta);
        return;
      }

      if (inThink) {
        const lowerPending = pending.toLowerCase();
        const closeIdx = lowerPending.indexOf(CLOSE_TAG);
        if (closeIdx !== -1) {
          const thoughtPart = pending.slice(0, closeIdx);
          if (thoughtPart) onThinking(thoughtPart);
          const after = pending.slice(closeIdx + CLOSE_TAG.length);
          pending = '';
          inThink = false;
          stripLeadingNewlineAfterThink = true;
          emitCleanContent(after);
          return;
        }

        // Hold back up to 7 trailing chars if they match a partial `</think>` prefix
        let hold = 0;
        const maxHold = Math.min(CLOSE_TAG.length - 1, pending.length);
        for (let k = maxHold; k >= 1; k--) {
          if (CLOSE_TAG.startsWith(pending.slice(-k).toLowerCase())) {
            hold = k;
            break;
          }
        }
        const safeLen = pending.length - hold;
        if (safeLen > 0) {
          onThinking(pending.slice(0, safeLen));
          pending = pending.slice(safeLen);
        }
      }
    },
    flush() {
      if (!pending) return;
      const leftover = pending;
      pending = '';
      if (inThink) {
        onThinking(leftover);
      } else {
        emitCleanContent(leftover);
      }
    },
  };
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

      const splitter = createThinkTagSplitter(
        (thought) => {
          if (thought) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: thought })}\n\n`));
        },
        (text) => {
          if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
        }
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
              splitter.push(text);
            }
          } else {
            const parts = parsed?.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part?.thought && typeof part.text === 'string') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: part.text })}\n\n`));
                } else if (typeof part?.text === 'string' && part.text.length > 0) {
                  splitter.push(part.text);
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
        splitter.flush();
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
// Live model discovery & credit-aware routing.
// Supports LarpRouter (`https://larprouter.com/v1`), Groq, Gemini, and OpenAI.
// ---------------------------------------------------------------------------
export type ProviderId = 'larprouter' | 'groq' | 'gemini' | 'openai';

const MODEL_CACHE = new Map<string, { ids: string[]; at: number }>();
const MODEL_TTL_MS = 5 * 60 * 1000;

// Short-lived cache when paid LarpRouter routes return 402 (`insufficient_credit`)
// so subsequent turns jump directly to Free-tier routes (`deepseek-v4.1-flash`,
// `glm-5.3-flash`) or secondary providers with zero wasted latency.
const LARP_PAID_402_CACHE = new Map<string, number>();
const LARP_PAID_402_TTL_MS = 2 * 60 * 1000;

// Short-lived per-model cooldown when a LarpRouter upstream supplier returns 503
// (`upstream_failed`) so active chat turns skip degraded routes immediately.
const LARP_MODEL_503_CACHE = new Map<string, number>();
const LARP_MODEL_503_TTL_MS = 45 * 1000;

const LARPROUTER_FREE_TIER_MODELS = new Set(['deepseek-v4.1-flash', 'glm-5.3-flash']);

const PREFERRED_MODELS: Record<ProviderId, string[]> = {
  larprouter: [
    'deepseek-v4.1-flash',
    'glm-5.3-flash',
    'glm-5.3',
    'kimi-k3.1-pro',
    'deepseek-v4.1-flash-fast',
    'minimax-m3.1-flash',
    'deepseek-v4.1-flash-1017-non-abliterated',
    'qwen3.8-27b-non-abliterated',
    'deepseek-v4.1-flash-1017-abliterated',
    // Alternate LarpRouter pools (Claude / Gemini / Grok)
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'grok-4',
    'grok-3',
  ],
  groq: [
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'qwen/qwen3-32b',
    'moonshotai/kimi-k2-instruct',
  ],
  gemini: [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-pro',
    'gemini-pro-latest',
    'gemini-2.0-flash',
  ],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-5-mini', 'gpt-5'],
};

const VISION_HINTS = ['vision', 'vl', 'scout', 'maverick', 'flash', 'gpt-4o', 'gpt-4.1', 'claude', 'gemini', 'kimi'];

function isChatModel(id: string): boolean {
  if (!id) return false;
  if (
    /embed|whisper|tts|audio|moderation|dall-e|stable-diffusion|rerank|imagen|veo|sora|realtime|guard|safeguard|ocr|orpheus|lyria|nano-banana|transcribe|computer-use|robotics|image/i.test(
      id
    )
  ) {
    return false;
  }
  return true;
}

function getOpenAICompatibleBaseUrl(provider: Exclude<ProviderId, 'gemini'>, larprouterBaseUrl: string): string {
  if (provider === 'larprouter') return larprouterBaseUrl;
  if (provider === 'groq') return 'https://api.groq.com/openai/v1';
  return 'https://api.openai.com/v1';
}

async function listModels(
  provider: ProviderId,
  key: string,
  larprouterBaseUrl = DEFAULT_LARPROUTER_BASE_URL
): Promise<string[]> {
  if (!key) return [];
  const cacheKey = `${provider}:${key.slice(-8)}`;
  const cached = MODEL_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < MODEL_TTL_MS) return cached.ids;

  let ids: string[] = [];
  try {
    const signal = AbortSignal.timeout(8000);
    if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        { signal }
      );
      if (res.ok) {
        const json: any = await res.json();
        ids = (json?.models || [])
          .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m: any) => String(m.name || '').replace(/^models\//, ''))
          .filter(Boolean);
      }
    } else {
      const base = getOpenAICompatibleBaseUrl(provider, larprouterBaseUrl);
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal,
      });
      if (res.ok) {
        const json: any = await res.json();
        const rawList = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.models)
            ? json.models
            : [];
        ids = rawList
          .map((m: any) => String(m?.id || m?.name || '').replace(/^models\//, ''))
          .filter(Boolean);
      }
    }
  } catch {
    /* offline or blocked — callers fall back to curated ids */
  }

  if (ids.length) MODEL_CACHE.set(cacheKey, { ids, at: Date.now() });
  return ids;
}

function pickModel(provider: ProviderId, ids: string[], preferVision = false): string | null {
  const usable = ids.filter(isChatModel);
  if (usable.length === 0) return null;
  const pool = preferVision
    ? [...usable].sort((a, b) => {
        const score = (id: string) => (VISION_HINTS.some((h) => id.toLowerCase().includes(h)) ? 0 : 1);
        return score(a) - score(b);
      })
    : usable;

  for (const wanted of PREFERRED_MODELS[provider]) {
    const exact = pool.find((id) => id === wanted);
    if (exact) return exact;
  }
  for (const wanted of PREFERRED_MODELS[provider]) {
    const partial = pool.find((id) => id.includes(wanted));
    if (partial) return partial;
  }
  return pool[0] || null;
}

/** A replacement model for one dead candidate, or null when nothing is live. */
async function healModel(
  provider: ProviderId,
  key: string,
  preferVision = false,
  larprouterBaseUrl = DEFAULT_LARPROUTER_BASE_URL
): Promise<string | null> {
  const ids = await listModels(provider, key, larprouterBaseUrl);
  if (preferVision && provider === 'groq') {
    const multimodal = ids.filter((id) => /scout|maverick|vision/i.test(id));
    return pickModel(provider, multimodal, true);
  }
  return pickModel(provider, ids, preferVision);
}

// ---------------------------------------------------------------------------
// Live probe: `GET /api/ai?probe=1` asks each configured provider for a single
// word, so anyone (and the in-app Check-up page / NikAI Keys modal) can verify
// that keys and upstream models are answering.
// ---------------------------------------------------------------------------
async function runProbe(
  larprouterKey: string,
  groqKey: string,
  geminiKey: string,
  openaiKey: string,
  larprouterBaseUrl: string
): Promise<Response> {
  const started = Date.now();
  const prompt = 'Reply with exactly one word: OK';
  const errors: string[] = [];

  type Attempt = { provider: ProviderId; model: string };
  const attempts: Attempt[] = [];
  if (larprouterKey) {
    attempts.push({ provider: 'larprouter', model: 'deepseek-v4.1-flash' });
    attempts.push({ provider: 'larprouter', model: 'glm-5.3-flash' });
    attempts.push({ provider: 'larprouter', model: 'deepseek-v4.1-flash-fast' });
  }
  if (groqKey) attempts.push({ provider: 'groq', model: 'openai/gpt-oss-20b' });
  if (geminiKey) attempts.push({ provider: 'gemini', model: 'gemini-2.5-flash' });
  if (openaiKey) attempts.push({ provider: 'openai', model: 'gpt-4o-mini' });
  if (groqKey) attempts.push({ provider: 'groq', model: 'openai/gpt-oss-120b' });

  const keys: Record<ProviderId, string> = {
    larprouter: larprouterKey,
    groq: groqKey,
    gemini: geminiKey,
    openai: openaiKey,
  };
  const tried = new Set(attempts.map((a) => `${a.provider}:${a.model}`));
  let skipLarpRouter = false;

  const ok = (provider: ProviderId, model: string, answer: string) =>
    new Response(
      JSON.stringify({
        ok: Boolean(answer),
        provider,
        model,
        answer: answer.slice(0, 40),
        ms: Date.now() - started,
        errors,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    if (attempt.provider === 'larprouter' && skipLarpRouter) continue;

    try {
      const signal = AbortSignal.timeout(12000);
      let status = 0;
      let answer = '';

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
        status = res.status;
        if (res.ok) {
          const json: any = await res.json();
          answer =
            json?.candidates?.[0]?.content?.parts
              ?.filter((p: any) => !p.thought)
              ?.map((p: any) => p.text || '')
              ?.join('')
              ?.trim() ?? '';
          if (answer) return ok('gemini', attempt.model, answer);
        }
        errors.push(`gemini/${attempt.model}: ${status} ${(await res.text().catch(() => '')).slice(0, 120)}`);
      } else {
        const key = keys[attempt.provider];
        const base = getOpenAICompatibleBaseUrl(attempt.provider, larprouterBaseUrl);
        // LarpRouter's OpenAI gateway streams over SSE (`stream: true` per docs);
        // Groq/OpenAI probes can use plain JSON (`stream: false`).
        const reqPayload =
          attempt.provider === 'larprouter'
            ? {
                model: attempt.model,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
              }
            : {
                model: attempt.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 512,
                temperature: 0,
                stream: false,
              };
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          signal,
          body: JSON.stringify(reqPayload),
        });
        status = res.status;
        if (res.ok) {
          const parsed = await consumeOpenAICompletion(res);
          answer = parsed.content || 'OK';
          return ok(attempt.provider, attempt.model, answer);
        }
        const errBody = (await res.text().catch(() => '')).slice(0, 140);
        errors.push(`${attempt.provider}/${attempt.model}: ${status} ${errBody}`);
        if (attempt.provider === 'larprouter' && (status === 401 || (status === 402 && LARPROUTER_FREE_TIER_MODELS.has(attempt.model)))) {
          skipLarpRouter = true;
        }
      }

      if (status === 404 || (attempt.provider === 'larprouter' && status === 400)) {
        const healed = await healModel(attempt.provider, keys[attempt.provider], false, larprouterBaseUrl);
        const id = healed ? `${attempt.provider}:${healed}` : '';
        if (healed && !tried.has(id)) {
          tried.add(id);
          attempts.splice(i + 1, 0, { provider: attempt.provider, model: healed });
        }
      }
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

export function resolveProviderKeys(req: Request): {
  larprouterKey: string;
  groqKey: string;
  geminiKey: string;
  openaiKey: string;
  larprouterBaseUrl: string;
} {
  let larprouterKey = cleanApiKey(
    req.headers.get('x-larprouter-key') || getEnv('LARPROUTER_API_KEY') || getEnv('VITE_LARPROUTER_KEY')
  );
  let groqKey = cleanApiKey(req.headers.get('x-groq-key') || getEnv('GROQ_API_KEY') || getEnv('VITE_GROQ_KEY'));
  const geminiKey = cleanApiKey(
    req.headers.get('x-gemini-key') || getEnv('GEMINI_API_KEY') || getEnv('VITE_GEMINI_KEY')
  );
  let openaiKey = cleanApiKey(
    req.headers.get('x-openai-key') || getEnv('OPENAI_API_KEY') || getEnv('VITE_OPENAI_KEY')
  );

  // Guard against mis-slotted LarpRouter keys (`lrsk-...` pasted into OpenAI or Groq box)
  if (!larprouterKey && openaiKey.startsWith('lrsk-')) {
    larprouterKey = openaiKey;
    openaiKey = '';
  } else if (openaiKey.startsWith('lrsk-')) {
    openaiKey = '';
  }
  if (!larprouterKey && groqKey.startsWith('lrsk-')) {
    larprouterKey = groqKey;
    groqKey = '';
  } else if (groqKey.startsWith('lrsk-')) {
    groqKey = '';
  }

  const larprouterBaseUrl = normalizeLarpRouterBaseUrl(
    getEnv('LARPROUTER_BASE_URL') || getEnv('VITE_LARPROUTER_BASE_URL')
  );

  return { larprouterKey, groqKey, geminiKey, openaiKey, larprouterBaseUrl };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  const { larprouterKey, groqKey, geminiKey, openaiKey, larprouterBaseUrl } = resolveProviderKeys(req);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const providers = {
      larprouter: Boolean(larprouterKey),
      groq: Boolean(groqKey),
      gemini: Boolean(geminiKey),
      openai: Boolean(openaiKey),
    };

    if (url.searchParams.get('models')) {
      const [larpIds, groqIds, geminiIds, openaiIds] = await Promise.all([
        listModels('larprouter', larprouterKey, larprouterBaseUrl),
        listModels('groq', groqKey, larprouterBaseUrl),
        listModels('gemini', geminiKey, larprouterBaseUrl),
        listModels('openai', openaiKey, larprouterBaseUrl),
      ]);
      return new Response(
        JSON.stringify({
          ok: true,
          engine: 'NikAI Astra Neural Core',
          providers,
          models: {
            larprouter: {
              count: larpIds.length,
              picked: pickModel('larprouter', larpIds),
              ids: larpIds.slice(0, 40),
            },
            groq: { count: groqIds.length, picked: pickModel('groq', groqIds), ids: groqIds.slice(0, 40) },
            gemini: { count: geminiIds.length, picked: pickModel('gemini', geminiIds), ids: geminiIds.slice(0, 40) },
            openai: { count: openaiIds.length, picked: pickModel('openai', openaiIds), ids: openaiIds.slice(0, 40) },
          },
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    if (url.searchParams.get('probe')) {
      const probe = await runProbe(larprouterKey, groqKey, geminiKey, openaiKey, larprouterBaseUrl);
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
    flashcards: 'notes',
    revise: 'notes',
  };
  const MODEL_ALIASES: Record<string, string> = {
    auto: 'astra-auto',
    pro: 'astra-pro',
    flash: 'astra-flash',
    vision: 'astra-vision',
    coder: 'astra-coder',
    code: 'astra-coder',
    deepseek: 'astra-auto',
    kimi: 'astra-pro',
    glm: 'astra-coder',
    larprouter: 'astra-auto',
  };
  const requestedMode = String(body.mode || 'auto').trim().toLowerCase();
  const mode = MODE_ALIASES[requestedMode] || requestedMode;
  const wantStream = body.stream !== false;

  const hasLongContextProvider = Boolean(larprouterKey || geminiKey || openaiKey);
  const baseSystemPrompt = `${NIKAI_ASTRA_IDENTITY}\n\n${MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.auto}`;
  let isInlineAction = false;
  let inlineSystemPrompt = '';
  let conversation: IncomingMessage[] = [];

  if (body.action && (body.prompt || body.messages?.length)) {
    isInlineAction = true;
    const rawText = body.prompt || body.messages?.[body.messages.length - 1]?.content || '';
    const inlineBuilt = buildInlineActionPrompt(body, rawText, hasLongContextProvider ? 24000 : 8000);
    inlineSystemPrompt = inlineBuilt.system;
    conversation = [{ role: 'user', content: inlineBuilt.user }];
  } else if (Array.isArray(body.messages) && body.messages.length > 0) {
    const systemFromClient = body.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    inlineSystemPrompt = systemFromClient ? `${baseSystemPrompt}\n\n${systemFromClient}` : baseSystemPrompt;
    conversation = body.messages.filter((m) => m.role !== 'system');
  } else if (body.prompt) {
    inlineSystemPrompt = baseSystemPrompt;
    conversation = [{ role: 'user', content: body.prompt }];
  }

  const buildSystemForProvider = (provider: ProviderId): string => {
    let sys = inlineSystemPrompt || baseSystemPrompt;
    if (body.memoryContext && body.memoryContext.trim()) {
      sys += `\n\n--- ACTIVE USER MEMORY & PREVIOUS SESSIONS ---\n${body.memoryContext.slice(0, 8000)}\n--- END MEMORY ---`;
    }
    if (!isInlineAction && body.noteContext && body.noteContext.trim()) {
      // LarpRouter & Gemini support 1M-token context windows; Groq has tighter TPM limits.
      const maxNoteChars = provider === 'groq' ? 14000 : 48000;
      sys += `\n\n--- ATTACHED USER NOTE CONTEXT ---\n${body.noteContext.slice(0, maxNoteChars)}\n--- END NOTE CONTEXT ---`;
    }
    return sys;
  };

  if (conversation.length === 0) {
    return new Response(JSON.stringify({ error: 'No prompt or messages supplied' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const hasImages = conversation.some((m) => Array.isArray(m.images) && m.images.length > 0);
  const rawModel = String(body.model || 'astra-auto').trim().toLowerCase();
  const requestedModel = MODEL_ALIASES[rawModel] || rawModel;

  type Candidate = { provider: ProviderId; model: string; label: string };
  const candidates: Candidate[] = [];

  const larpKeyTag = larprouterKey ? larprouterKey.slice(-8) : '';
  const larpPaidExhaustedAt = larpKeyTag ? LARP_PAID_402_CACHE.get(larpKeyTag) || 0 : 0;
  const allowLarpPaidFirst =
    Boolean(larprouterKey) && Date.now() - larpPaidExhaustedAt >= LARP_PAID_402_TTL_MS;

  if (hasImages || requestedModel === 'astra-vision') {
    if (geminiKey) {
      candidates.push({ provider: 'gemini', model: 'gemini-2.5-flash', label: 'NikAI Astra Vision' });
      candidates.push({ provider: 'gemini', model: 'gemini-2.5-pro', label: 'NikAI Astra Vision Pro' });
    }
    if (groqKey) {
      candidates.push({
        provider: 'groq',
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        label: 'NikAI Astra Vision',
      });
      candidates.push({
        provider: 'groq',
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        label: 'NikAI Astra Vision',
      });
    }
    if (openaiKey) {
      candidates.push({ provider: 'openai', model: 'gpt-4o', label: 'NikAI Astra Vision Pro' });
    }
    if (larprouterKey) {
      if (allowLarpPaidFirst) {
        candidates.push({ provider: 'larprouter', model: 'kimi-k3.1-pro', label: 'NikAI Astra Vision · Kimi K3.1' });
        candidates.push({ provider: 'larprouter', model: 'glm-5.3', label: 'NikAI Astra Vision · GLM-5.3' });
      }
      candidates.push({ provider: 'larprouter', model: 'glm-5.3-flash', label: 'NikAI Astra Vision · GLM-5.3' });
      candidates.push({ provider: 'larprouter', model: 'deepseek-v4.1-flash', label: 'NikAI Astra · DeepSeek V4.1' });
    }
  } else if (requestedModel === 'astra-pro' || mode === 'deep' || mode === 'solver') {
    if (larprouterKey) {
      if (allowLarpPaidFirst) {
        candidates.push({ provider: 'larprouter', model: 'kimi-k3.1-pro', label: 'NikAI Astra Pro · Kimi K3.1' });
        candidates.push({ provider: 'larprouter', model: 'glm-5.3', label: 'NikAI Astra Pro · GLM-5.3' });
      }
      candidates.push({
        provider: 'larprouter',
        model: 'deepseek-v4.1-flash',
        label: 'NikAI Astra Pro · DeepSeek V4.1',
      });
      candidates.push({ provider: 'larprouter', model: 'glm-5.3-flash', label: 'NikAI Astra · GLM-5.3' });
    }
    if (groqKey) candidates.push({ provider: 'groq', model: 'openai/gpt-oss-120b', label: 'NikAI Astra Pro 120B' });
    if (openaiKey) candidates.push({ provider: 'openai', model: 'gpt-4o', label: 'NikAI Astra Pro' });
    if (geminiKey) candidates.push({ provider: 'gemini', model: 'gemini-2.5-pro', label: 'NikAI Astra Pro' });
    if (geminiKey) candidates.push({ provider: 'gemini', model: 'gemini-2.5-flash', label: 'NikAI Astra Flash' });
    if (groqKey) candidates.push({ provider: 'groq', model: 'openai/gpt-oss-20b', label: 'NikAI Astra Core' });
  } else if (requestedModel === 'astra-coder' || mode === 'code') {
    if (larprouterKey) {
      if (allowLarpPaidFirst) {
        candidates.push({ provider: 'larprouter', model: 'glm-5.3', label: 'NikAI Astra Coder · GLM-5.3' });
        candidates.push({ provider: 'larprouter', model: 'kimi-k3.1-pro', label: 'NikAI Astra Coder · Kimi K3.1' });
      }
      candidates.push({
        provider: 'larprouter',
        model: 'deepseek-v4.1-flash',
        label: 'NikAI Astra Coder · DeepSeek V4.1',
      });
      candidates.push({ provider: 'larprouter', model: 'glm-5.3-flash', label: 'NikAI Astra Coder · GLM-5.3' });
    }
    if (groqKey) candidates.push({ provider: 'groq', model: 'openai/gpt-oss-120b', label: 'NikAI Astra Coder 120B' });
    if (openaiKey) candidates.push({ provider: 'openai', model: 'gpt-4o', label: 'NikAI Astra Coder' });
    if (geminiKey) candidates.push({ provider: 'gemini', model: 'gemini-2.5-pro', label: 'NikAI Astra Coder' });
    if (groqKey) candidates.push({ provider: 'groq', model: 'openai/gpt-oss-20b', label: 'NikAI Astra Coder' });
  } else if (requestedModel === 'astra-flash') {
    if (larprouterKey) {
      if (allowLarpPaidFirst) {
        candidates.push({
          provider: 'larprouter',
          model: 'deepseek-v4.1-flash-fast',
          label: 'NikAI Astra Flash · DeepSeek V4.1',
        });
      }
      candidates.push({ provider: 'larprouter', model: 'glm-5.3-flash', label: 'NikAI Astra Flash · GLM-5.3' });
      candidates.push({
        provider: 'larprouter',
        model: 'deepseek-v4.1-flash',
        label: 'NikAI Astra Flash · DeepSeek V4.1',
      });
    }
    if (groqKey) candidates.push({ provider: 'groq', model: 'openai/gpt-oss-20b', label: 'NikAI Astra Flash' });
    if (geminiKey) candidates.push({ provider: 'gemini', model: 'gemini-2.5-flash', label: 'NikAI Astra Flash' });
    if (openaiKey) candidates.push({ provider: 'openai', model: 'gpt-4o-mini', label: 'NikAI Astra Flash' });
  } else {
    // Smart Auto (`astra-auto`, `teacher`, `notes`, `quiz`, `write`)
    if (larprouterKey) {
      candidates.push({
        provider: 'larprouter',
        model: 'deepseek-v4.1-flash',
        label: 'NikAI Astra · DeepSeek V4.1',
      });
      candidates.push({ provider: 'larprouter', model: 'glm-5.3-flash', label: 'NikAI Astra · GLM-5.3' });
      if (allowLarpPaidFirst) {
        candidates.push({
          provider: 'larprouter',
          model: 'minimax-m3.1-flash',
          label: 'NikAI Astra · MiniMax M3.1',
        });
        candidates.push({ provider: 'larprouter', model: 'glm-5.3', label: 'NikAI Astra Pro · GLM-5.3' });
      }
    }
    if (groqKey) {
      candidates.push({ provider: 'groq', model: 'openai/gpt-oss-120b', label: 'NikAI Astra Pro 120B' });
      candidates.push({ provider: 'groq', model: 'openai/gpt-oss-20b', label: 'NikAI Astra Core' });
    }
    if (geminiKey) {
      candidates.push({ provider: 'gemini', model: 'gemini-2.5-flash', label: 'NikAI Astra Flash' });
    }
    if (openaiKey) candidates.push({ provider: 'openai', model: 'gpt-4o-mini', label: 'NikAI Astra Core' });
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

  const providerKeys: Record<ProviderId, string> = {
    larprouter: larprouterKey,
    groq: groqKey,
    gemini: geminiKey,
    openai: openaiKey,
  };

  const errors: string[] = [];
  const triedModels = new Set(candidates.map((c) => `${c.provider}:${c.model}`));
  let abortLarpRouterForRequest = false;

  /** Queue a live replacement immediately next when a provider retires or restricts the requested model id. */
  const queueHealedCandidate = async (
    dead: { provider: ProviderId; label: string },
    preferVision: boolean,
    afterIndex: number
  ) => {
    const key = providerKeys[dead.provider];
    const healed = await healModel(dead.provider, key, preferVision, larprouterBaseUrl);
    if (!healed) return;
    const id = `${dead.provider}:${healed}`;
    if (triedModels.has(id)) return;
    triedModels.add(id);
    candidates.splice(afterIndex + 1, 0, { provider: dead.provider, model: healed, label: dead.label });
  };

  const isDeepOutputMode = mode === 'deep' || mode === 'notes' || mode === 'code' || mode === 'solver';

  for (let idx = 0; idx < candidates.length; idx++) {
    const candidate = candidates[idx];
    if (candidate.provider === 'larprouter') {
      if (abortLarpRouterForRequest) continue;
      const degradedAt = LARP_MODEL_503_CACHE.get(candidate.model) || 0;
      if (degradedAt && Date.now() - degradedAt < LARP_MODEL_503_TTL_MS && idx < candidates.length - 1) {
        continue;
      }
    }

    const systemInstruction = buildSystemForProvider(candidate.provider);

    try {
      if (candidate.provider === 'larprouter' || candidate.provider === 'groq' || candidate.provider === 'openai') {
        const key = providerKeys[candidate.provider];
        const base = getOpenAICompatibleBaseUrl(candidate.provider, larprouterBaseUrl);
        const url = `${base}/chat/completions`;

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

        const maxTokens = candidate.provider === 'larprouter' && isDeepOutputMode ? 6144 : 4096;
        // LarpRouter's OpenAI gateway is SSE-streaming-first (`stream: true` per docs)
        const upstreamStream = candidate.provider === 'larprouter' ? true : wantStream;

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
            stream: upstreamStream,
            temperature: mode === 'code' || mode === 'solver' ? 0.35 : 0.6,
            max_tokens: maxTokens,
          }),
        });

        if (!upstream.ok) {
          const errTxt = await upstream.text().catch(() => '');
          errors.push(`${candidate.provider}/${candidate.model}: ${upstream.status} ${errTxt.slice(0, 140)}`);

          if (candidate.provider === 'larprouter') {
            if (upstream.status === 401) {
              // Invalid API key — skip remaining LarpRouter candidates immediately
              abortLarpRouterForRequest = true;
              continue;
            }
            if (upstream.status === 402) {
              if (larpKeyTag) LARP_PAID_402_CACHE.set(larpKeyTag, Date.now());
              // If even a Free-tier model returned 402 (`insufficient_credit`),
              // fail over immediately to Groq / Gemini / OpenAI without extra hops.
              if (LARPROUTER_FREE_TIER_MODELS.has(candidate.model)) {
                abortLarpRouterForRequest = true;
              }
              continue;
            }
            if (upstream.status >= 500) {
              LARP_MODEL_503_CACHE.set(candidate.model, Date.now());
            }
          }

          if (upstream.status === 404 || (candidate.provider === 'larprouter' && upstream.status === 400 && !hasImages)) {
            await queueHealedCandidate(candidate, hasImages, idx);
          }
          continue;
        }

        if (!wantStream) {
          const { content, thinking } = await consumeOpenAICompletion(upstream);
          return new Response(
            JSON.stringify({
              content,
              thinking,
              model: candidate.label,
              provider: candidate.provider,
            }),
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
          if (upstream.status === 404) await queueHealedCandidate(candidate, hasImages, idx);
          continue;
        }

        if (!wantStream) {
          const json = await upstream.json();
          const rawContent =
            json?.candidates?.[0]?.content?.parts
              ?.filter((p: any) => !p.thought)
              ?.map((p: any) => p.text || '')
              ?.join('') ?? '';
          const { content } = stripThinkTags(rawContent);
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
