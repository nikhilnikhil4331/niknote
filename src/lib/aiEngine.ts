// ============================================================
// NikAI — Unified Astra Neural Core Engine
// Powers NikAI (/ai), Inline Editor AI, @AI Mentions,
// Persistent Session Memory, Smart Notes & Live Quizzes.
// Primary Frontier Router: LarpRouter (https://larprouter.com/v1)
// ============================================================

import { supabase } from '@/integrations/supabase/client';
import { buildNikAIMemoryPrompt } from '@/lib/nikaiMemory';

export type AstaMode =
  | 'auto'
  | 'deep'
  | 'teacher'
  | 'solver'
  | 'code'
  | 'notes'
  | 'quiz'
  | 'write';

export type AstaModelChoice =
  | 'astra-auto'
  | 'astra-pro'
  | 'astra-flash'
  | 'astra-vision'
  | 'astra-coder';

export const LARPROUTER_DEFAULT_BASE_URL = 'https://larprouter.com/v1';

// ── Mode / model normalisation ──
// The UI (and older stored threads) can use short ids like `tutor`, `writing`,
// `pro`, `flash` or `vision`. The server gateway only understands the canonical
// ids below, so every request is normalised before it leaves the browser.
const MODE_ALIASES: Record<string, AstaMode> = {
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

const KNOWN_MODES: AstaMode[] = ['auto', 'deep', 'teacher', 'solver', 'code', 'notes', 'quiz', 'write'];

export function resolveAstaMode(mode?: string | null): AstaMode {
  const key = String(mode || 'auto').trim().toLowerCase();
  if (MODE_ALIASES[key]) return MODE_ALIASES[key];
  return (KNOWN_MODES as string[]).includes(key) ? (key as AstaMode) : 'auto';
}

const MODEL_ALIASES: Record<string, AstaModelChoice> = {
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

export function resolveAstaModel(model?: string | null): AstaModelChoice {
  const key = String(model || 'astra-auto').trim().toLowerCase();
  const aliased = MODEL_ALIASES[key];
  if (aliased) return aliased;
  const known: AstaModelChoice[] = ['astra-auto', 'astra-pro', 'astra-flash', 'astra-vision', 'astra-coder'];
  return known.includes(key as AstaModelChoice) ? (key as AstaModelChoice) : 'astra-auto';
}

export interface AstaImageAttachment {
  name?: string;
  mimeType: string;
  dataUrl: string;
}

export interface AstaChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: AstaImageAttachment[];
}

export interface AstaCustomKeys {
  larprouterKey?: string;
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
}

export interface AstaStreamOptions {
  messages: AstaChatTurn[];
  mode?: AstaMode;
  model?: AstaModelChoice;
  threadId?: string;
  noteContext?: string;
  memoryContext?: string;
  action?: string;
  targetLanguage?: string;
  instruction?: string;
  signal?: AbortSignal;
  onMeta?: (meta: { model: string; provider: string }) => void;
  onThinking?: (delta: string, fullThinking: string) => void;
  onToken?: (delta: string, fullText: string) => void;
}

export interface AstaResult {
  content: string;
  thinking: string;
  model: string;
  provider: string;
  latencyMs: number;
  followUps: string[];
}

const KEYS_STORAGE_KEY = 'niknote.ai.keys.v1';

export function cleanClientApiKey(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .replace(/^(?:bearer|x-api-key:?)\s+/i, '')
    .trim();
}

export function readCustomAIKeys(): AstaCustomKeys {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      larprouterKey: cleanClientApiKey(parsed.larprouterKey),
      groqKey: cleanClientApiKey(parsed.groqKey),
      geminiKey: cleanClientApiKey(parsed.geminiKey),
      openaiKey: cleanClientApiKey(parsed.openaiKey),
    };
  } catch {
    return {};
  }
}

export function saveCustomAIKeys(keys: AstaCustomKeys): void {
  try {
    localStorage.setItem(
      KEYS_STORAGE_KEY,
      JSON.stringify({
        larprouterKey: cleanClientApiKey(keys.larprouterKey),
        groqKey: cleanClientApiKey(keys.groqKey),
        geminiKey: cleanClientApiKey(keys.geminiKey),
        openaiKey: cleanClientApiKey(keys.openaiKey),
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

function getEffectiveClientKeys(): { larprouter: string; groq: string; gemini: string; openai: string } {
  const custom = readCustomAIKeys();
  const env = (import.meta as any)?.env || {};
  let larprouter = cleanClientApiKey(custom.larprouterKey || env.VITE_LARPROUTER_KEY);
  let groq = cleanClientApiKey(custom.groqKey || env.VITE_GROQ_KEY);
  const gemini = cleanClientApiKey(custom.geminiKey || env.VITE_GEMINI_KEY);
  let openai = cleanClientApiKey(custom.openaiKey || env.VITE_OPENAI_KEY);

  // Auto-route `lrsk-...` keys even if a user pasted them into OpenAI / Groq by mistake
  if (!larprouter && openai.startsWith('lrsk-')) {
    larprouter = openai;
    openai = '';
  } else if (openai.startsWith('lrsk-')) {
    openai = '';
  }
  if (!larprouter && groq.startsWith('lrsk-')) {
    larprouter = groq;
    groq = '';
  } else if (groq.startsWith('lrsk-')) {
    groq = '';
  }

  return { larprouter, groq, gemini, openai };
}

export async function probeAstaProviders(): Promise<{ cloudReady: boolean; providers: string[] }> {
  const localKeys = getEffectiveClientKeys();
  const active = new Set<string>();
  if (localKeys.larprouter) active.add('NikAI Astra LarpRouter 1M');
  if (localKeys.openai) active.add('NikAI Astra OpenAI Core');
  if (localKeys.groq) active.add('NikAI Astra Turbo 120B');
  if (localKeys.gemini) active.add('NikAI Astra Vision 2.5');

  try {
    const probeUrl = getRemoteAstraGatewayUrl() || '/api/ai';
    const res = await fetch(probeUrl, { method: 'GET' });
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (data?.providers?.larprouter) active.add('NikAI Astra LarpRouter 1M');
      if (data?.providers?.openai) active.add('NikAI Astra OpenAI Core');
      if (data?.providers?.groq) active.add('NikAI Astra Turbo 120B');
      if (data?.providers?.gemini) active.add('NikAI Astra Vision 2.5');
    }
  } catch {
    // ignore network check failure
  }

  // Dev / preview sandboxes relay to the production gateway, so cloud AI is
  // available there even without local provider keys.
  if (active.size === 0 && getRemoteAstraGatewayUrl()) {
    active.add('NikAI Astra Cloud Relay');
  }

  return {
    cloudReady: active.size > 0,
    providers: Array.from(active),
  };
}

const CLIENT_SYSTEM_PROMPTS: Record<AstaMode, string> = {
  auto: `You are **NikAI** (powered by **Astra Neural Core**), NikNote's single unified AI intelligence. Match user language (English / Hinglish / Hindi). Give complete, crystal-clear structured Markdown answers with headings, **bold terms**, tables, code/formula blocks, and \`> 💡 Pro-Tips\` ready for 1-tap Handwriting conversion.`,
  deep: `You are **NikAI Astra Pro** — reason step by step from first principles, verify every equation and edge case, and highlight the final answer clearly.`,
  teacher: `You are **NikAI Master Guru** — explain with: 1) Intuition & real-life analogy, 2) Step-by-Step Breakdown, 3) Formulas/Rules, 4) Worked Example, 5) > 💡 Exam Pro-Tip.`,
  solver: `You are **NikAI Step-by-Step Solver** — present Given → Formula/Concept → Step-by-Step Working → Verification → ✅ Final Answer → ⚡ Shortcut Trick.`,
  code: `You are **NikAI Astra Coder** — write clean, complete, production-ready fenced code blocks with explanations, edge cases, and Time/Space Complexity.`,
  notes: `You are **NikAI Smart Notes Architect** — build complete exam-ready notebook pages with \`# Chapter Title\`, \`## Subheadings\`, bullet definitions (\`- **Term:** Meaning\`), callout tips (\`> 💡\`), comparison tables, and 3 self-check questions.`,
  quiz: `You are **NikAI Live Quiz Master** — generate 5 high-yield MCQs (Easy to Tough). Format strictly:\n### Q1. [Question]\n- A) [Option]\n- B) [Option]\n- C) [Option]\n- D) [Option]\n**Answer:** [A/B/C/D]\n**Explanation:** [Why correct]`,
  write: `You are **NikAI Writing Studio** — craft compelling, natural prose, summaries, grammar fixes, or translations matching the requested language.`,
};

export function generateFollowUpSuggestions(query: string, mode: AstaMode): string[] {
  const clean = query.replace(/\s+/g, ' ').trim();
  const shortTopic = clean.length > 42 ? `${clean.slice(0, 40).trim()}…` : clean || 'this topic';
  const hinglish = /\b(kya|kaise|kyu|samjhao|batao|likho|karo|hai|ke|ki|aur|mein|se)\b/i.test(clean);

  if (mode === 'quiz') {
    return hinglish
      ? [`Aur 5 tough exam-level MCQs banao 🔥`, `Is topic ke Handwriting Smart Notes banao ✍️`, `Sabse tricky concept example se samjhao 🧠`]
      : [`Give me 5 tougher exam MCQs 🔥`, `Build Handwriting Smart Notes on this ✍️`, `Explain the trickiest concept step by step 🧠`];
  }
  if (mode === 'code') {
    return [
      `Add unit tests & edge cases for this code`,
      `Optimize time & space complexity further`,
      `Walk through a line-by-line dry run`,
    ];
  }
  return hinglish
    ? [
        `Is topic pe 5 Live MCQ Quiz khilao 🎯`,
        `Handwriting Notebook Notes ready karo ✍️`,
        `Ek solved exam numerical step-by-step dikhao ⚡`,
      ]
    : [
        `Launch a 5-MCQ Live Quiz on "${shortTopic}" 🎯`,
        `Build ready-to-write Smart Notes on "${shortTopic}" ✍️`,
        `Solve a worked exam example step by step ⚡`,
      ];
}

// ── Shared NikAI gateway request builder ──
function buildGatewayRequest(opts: AstaStreamOptions, memoryContext: string): RequestInit {
  const custom = readCustomAIKeys();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let larpKey = custom.larprouterKey || '';
  let groqKey = custom.groqKey || '';
  let openaiKey = custom.openaiKey || '';
  if (!larpKey && openaiKey.startsWith('lrsk-')) {
    larpKey = openaiKey;
    openaiKey = '';
  }
  if (!larpKey && groqKey.startsWith('lrsk-')) {
    larpKey = groqKey;
    groqKey = '';
  }
  if (larpKey) headers['X-LarpRouter-Key'] = larpKey;
  if (groqKey) headers['X-Groq-Key'] = groqKey;
  if (custom.geminiKey) headers['X-Gemini-Key'] = custom.geminiKey;
  if (openaiKey) headers['X-OpenAI-Key'] = openaiKey;

  return {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      messages: opts.messages,
      mode: opts.mode || 'auto',
      model: opts.model || 'astra-auto',
      noteContext: opts.noteContext,
      memoryContext,
      action: opts.action,
      targetLanguage: opts.targetLanguage,
      instruction: opts.instruction,
      stream: true,
    }),
  };
}

// Parses the NikAI SSE protocol (`data: {"meta"|"thinking"|"delta"}`) into text.
async function consumeAstraSSE(
  res: Response,
  opts: AstaStreamOptions
): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let thinking = '';
  let model = 'NikAI Astra Core';
  let provider = 'cloud';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.meta) {
            model = parsed.model || model;
            provider = parsed.provider || provider;
            opts.onMeta?.({ model, provider });
          }
          if (parsed.thinking) {
            thinking += parsed.thinking;
            opts.onThinking?.(parsed.thinking, thinking);
          }
          if (parsed.delta) {
            content += parsed.delta;
            opts.onToken?.(parsed.delta, content);
          }
        } catch {
          // ignore partial SSE JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return content.trim() ? { content, thinking, model, provider } : null;
}

// ── Tier 1: Same-origin /api/ai SSE stream ──
async function tryServerlessStream(
  opts: AstaStreamOptions,
  memoryContext: string
): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  const res = await fetch('/api/ai', buildGatewayRequest(opts, memoryContext));
  if (!res.ok || !res.body) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) return null;
  return consumeAstraSSE(res, opts);
}

// ── Tier 1.5: Remote NikAI gateway (dev / preview only) ──
const SANDBOX_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$|\.(e2b\.app|e2b\.dev|lovable\.dev|lovableproject\.com)$/i;

export function getRemoteAstraGatewayUrl(): string | null {
  try {
    if (typeof (globalThis as any).vi !== 'undefined') return null;
    const explicit = String((import.meta as any)?.env?.VITE_NIKAI_REMOTE_AI_URL || '').trim();
    if (explicit) return explicit;

    const cap = (globalThis as any)?.Capacitor;
    const native = Boolean(
      cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.getPlatform?.() !== 'web')
    );
    if (native) return 'https://www.niknote.online/api/ai';

    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (host && SANDBOX_HOST_PATTERN.test(host)) return 'https://www.niknote.online/api/ai';
  } catch {
    // ignore env / window access issues
  }
  return null;
}

async function tryRemoteGatewayStream(
  opts: AstaStreamOptions,
  memoryContext: string
): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  const gateway = getRemoteAstraGatewayUrl();
  if (!gateway) return null;

  const res = await fetch(gateway, buildGatewayRequest(opts, memoryContext));
  if (!res.ok || !res.body) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) return null;
  const out = await consumeAstraSSE(res, opts);
  if (!out) return null;
  return { ...out, provider: out.provider || 'cloud' };
}

// ── Tier 2: Direct Browser Cloud Stream (LarpRouter / OpenAI / Groq / Gemini) ──
async function tryDirectCloudStream(
  opts: AstaStreamOptions,
  memoryContext: string
): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  const keys = getEffectiveClientKeys();
  if (!keys.larprouter && !keys.groq && !keys.gemini && !keys.openai) return null;

  const mode = opts.mode || 'auto';
  const maxCtx = keys.larprouter || keys.gemini ? 36000 : 12000;
  const sys = [
    CLIENT_SYSTEM_PROMPTS[mode] || CLIENT_SYSTEM_PROMPTS.auto,
    memoryContext ? `\n\nActive User Memory & Previous Sessions:\n${memoryContext.slice(0, 6000)}` : '',
    opts.noteContext?.trim() ? `\n\nAttached Note Context:\n${opts.noteContext.slice(0, maxCtx)}` : '',
  ].join('');

  const turns = opts.messages.filter((m) => m.role !== 'system');
  const hasImages = turns.some((m) => m.images && m.images.length > 0);
  const preferGemini =
    hasImages ||
    opts.model === 'astra-vision' ||
    (!keys.larprouter && !keys.openai && !keys.groq && Boolean(keys.gemini));

  const streamOpenAICompatible = async (
    provider: 'larprouter' | 'openai' | 'groq',
    key: string,
    url: string,
    upstreamModel: string,
    label: string
  ) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: opts.signal,
      body: JSON.stringify({
        model: upstreamModel,
        stream: true,
        temperature: mode === 'code' || mode === 'solver' ? 0.35 : 0.55,
        max_tokens: provider === 'larprouter' ? 6144 : 4096,
        messages: [
          { role: 'system', content: sys },
          ...turns.map((m) =>
            m.images?.length && m.role === 'user'
              ? {
                  role: 'user',
                  content: [
                    { type: 'text', text: m.content || 'Analyze this image carefully.' },
                    ...m.images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
                  ],
                }
              : { role: m.role, content: m.content }
          ),
        ],
      }),
    });
    if (!res.ok || !res.body) return null;
    opts.onMeta?.({ model: label, provider });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let rawContent = '';
    let emittedLen = 0;
    let thinking = '';
    let insideThink = false;

    const processTextChunk = (delta: string) => {
      rawContent += delta;
      // Handle optional `<think>...</think>` blocks cleanly
      if (rawContent.startsWith('<think>') || insideThink) {
        const closeIdx = rawContent.indexOf('</think>');
        if (closeIdx === -1) {
          insideThink = true;
          const nextThought = rawContent.slice(7);
          const diff = nextThought.slice(thinking.length);
          if (diff) {
            thinking = nextThought;
            opts.onThinking?.(diff, thinking);
          }
          return;
        }
        insideThink = false;
        const fullThought = rawContent.slice(7, closeIdx);
        if (fullThought.length > thinking.length) {
          const diff = fullThought.slice(thinking.length);
          thinking = fullThought;
          opts.onThinking?.(diff, thinking);
        }
        const cleanBody = rawContent.slice(closeIdx + 8).replace(/^\r?\n+/, '');
        if (cleanBody.length > emittedLen) {
          const token = cleanBody.slice(emittedLen);
          emittedLen = cleanBody.length;
          opts.onToken?.(token, cleanBody);
        }
        return;
      }

      if (rawContent.length < 7 && '<think>'.startsWith(rawContent)) {
        return;
      }
      if (rawContent.length > emittedLen) {
        const token = rawContent.slice(emittedLen);
        emittedLen = rawContent.length;
        opts.onToken?.(token, rawContent);
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const d = line.slice(5).trim();
          if (!d || d === '[DONE]') continue;
          try {
            const p = JSON.parse(d)?.choices?.[0]?.delta;
            const reasoning = p?.reasoning ?? p?.reasoning_content;
            if (reasoning) {
              thinking += reasoning;
              opts.onThinking?.(reasoning, thinking);
            }
            if (p?.content) processTextChunk(p.content);
          } catch {
            /* skip partial chunk */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const finalClean = rawContent.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
    return finalClean ? { content: finalClean, thinking, model: label, provider } : null;
  };

  const tryLarpRouter = async () => {
    if (!keys.larprouter) return null;
    const url = `${LARPROUTER_DEFAULT_BASE_URL}/chat/completions`;
    const modelCandidates: Array<{ id: string; label: string }> =
      opts.model === 'astra-pro' || mode === 'deep' || mode === 'solver'
        ? [
            { id: 'kimi-k3.1-pro', label: 'NikAI Astra Pro · Kimi K3.1' },
            { id: 'deepseek-v4.1-flash', label: 'NikAI Astra Pro · DeepSeek V4.1' },
            { id: 'glm-5.3-flash', label: 'NikAI Astra · GLM-5.3' },
          ]
        : opts.model === 'astra-coder' || mode === 'code'
          ? [
              { id: 'glm-5.3', label: 'NikAI Astra Coder · GLM-5.3' },
              { id: 'deepseek-v4.1-flash', label: 'NikAI Astra Coder · DeepSeek V4.1' },
              { id: 'glm-5.3-flash', label: 'NikAI Astra Coder · GLM-5.3' },
            ]
          : [
              { id: 'deepseek-v4.1-flash', label: 'NikAI Astra · DeepSeek V4.1' },
              { id: 'glm-5.3-flash', label: 'NikAI Astra · GLM-5.3' },
            ];

    for (const candidate of modelCandidates) {
      const out = await streamOpenAICompatible(
        'larprouter',
        keys.larprouter,
        url,
        candidate.id,
        candidate.label
      ).catch(() => null);
      if (out) return out;
    }
    return null;
  };

  const tryOpenAIOrGroq = async (useOpenAI: boolean) => {
    const key = useOpenAI ? keys.openai : keys.groq;
    if (!key) return null;
    const url = useOpenAI
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';
    const upstreamModel = useOpenAI
      ? 'gpt-4o'
      : hasImages
        ? 'meta-llama/llama-4-scout-17b-16e-instruct'
        : opts.model === 'astra-pro' || mode === 'deep'
          ? 'openai/gpt-oss-120b'
          : 'openai/gpt-oss-20b';
    const label = opts.model === 'astra-pro' || mode === 'deep' ? 'NikAI Astra Pro' : 'NikAI Astra Core';

    return streamOpenAICompatible(useOpenAI ? 'openai' : 'groq', key, url, upstreamModel, label);
  };

  const tryGemini = async () => {
    if (!keys.gemini) return null;
    const model = opts.model === 'astra-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const label = opts.model === 'astra-pro' ? 'NikAI Astra Pro' : 'NikAI Astra Vision';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(keys.gemini)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sys }] },
          contents: turns.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [
              ...(m.content ? [{ text: m.content }] : []),
              ...(m.images || []).map((img) => ({
                inline_data: {
                  mime_type: img.mimeType || 'image/jpeg',
                  data: img.dataUrl.includes(',') ? img.dataUrl.split(',')[1] : img.dataUrl,
                },
              })),
            ],
          })),
          generationConfig: { temperature: 0.55, maxOutputTokens: 4096 },
        }),
      }
    );
    if (!res.ok || !res.body) return null;
    opts.onMeta?.({ model: label, provider: 'gemini' });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let thinking = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const d = line.slice(5).trim();
          if (!d || d === '[DONE]') continue;
          try {
            const parts = JSON.parse(d)?.candidates?.[0]?.content?.parts || [];
            for (const p of parts) {
              if (typeof p?.text === 'string') {
                if (p.thought) {
                  thinking += p.text;
                  opts.onThinking?.(p.text, thinking);
                } else {
                  content += p.text;
                  opts.onToken?.(p.text, content);
                }
              }
            }
          } catch {
            /* skip */
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return content.trim() ? { content, thinking, model: label, provider: 'gemini' } : null;
  };

  if (preferGemini) {
    return (
      (await tryGemini().catch(() => null)) ||
      (await tryLarpRouter().catch(() => null)) ||
      (await tryOpenAIOrGroq(true).catch(() => null)) ||
      (await tryOpenAIOrGroq(false).catch(() => null))
    );
  }
  return (
    (await tryLarpRouter().catch(() => null)) ||
    (await tryOpenAIOrGroq(true).catch(() => null)) ||
    (await tryOpenAIOrGroq(false).catch(() => null)) ||
    (await tryGemini().catch(() => null))
  );
}

// ── Tier 3: Supabase Edge Function fallback ──
async function trySupabaseEdge(
  opts: AstaStreamOptions,
  memoryContext: string
): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  try {
    const modeMap: Record<AstaMode, string> = {
      auto: 'teacher',
      deep: 'research',
      teacher: 'teacher',
      solver: 'assignment',
      code: 'code',
      notes: 'notes',
      quiz: 'quiz',
      write: 'notes',
    };
    const custom = readCustomAIKeys();
    const extraHeaders: Record<string, string> = {};
    if (custom.larprouterKey) extraHeaders['x-larprouter-key'] = custom.larprouterKey;
    if (custom.groqKey) extraHeaders['x-groq-key'] = custom.groqKey;
    if (custom.geminiKey) extraHeaders['x-gemini-key'] = custom.geminiKey;
    if (custom.openaiKey) extraHeaders['x-openai-key'] = custom.openaiKey;

    const combinedContext = [memoryContext, opts.noteContext].filter(Boolean).join('\n\n');
    const { data, error } = await supabase.functions.invoke('openai-brain', {
      headers: extraHeaders,
      body: {
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
        agentType: modeMap[opts.mode || 'auto'] || 'teacher',
        noteContext: combinedContext,
      },
    });
    if (error || !data) return null;
    const text = String(data.content || data.response || '')
      .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
      .trim();
    if (!text) return null;
    opts.onMeta?.({ model: data.model || 'NikAI Astra Edge', provider: data.provider || 'supabase' });
    opts.onToken?.(text, text);
    return {
      content: text,
      thinking: '',
      model: data.model || 'NikAI Astra Edge',
      provider: data.provider || 'supabase',
    };
  } catch {
    return null;
  }
}

// ── Tier 4: Built-in Offline STEM / Code / Study / Math Engine ──
function solveMathExpression(input: string): string | null {
  const quad = input.replace(/\s+/g, '').match(/^([+-]?\d*\.?\d*)x(?:\^2|²)([+-]\d*\.?\d*)x([+-]\d+\.?\d*)=0$/i);
  if (quad) {
    const a = quad[1] === '' || quad[1] === '+' ? 1 : quad[1] === '-' ? -1 : Number(quad[1]);
    const b = quad[2] === '+' ? 1 : quad[2] === '-' ? -1 : Number(quad[2]);
    const c = Number(quad[3]);
    if (Number.isFinite(a) && a !== 0 && Number.isFinite(b) && Number.isFinite(c)) {
      const D = b * b - 4 * a * c;
      const roots =
        D >= 0
          ? `x₁ = ${((-b + Math.sqrt(D)) / (2 * a)).toFixed(4).replace(/\.?0+$/, '')},  x₂ = ${((-b - Math.sqrt(D)) / (2 * a)).toFixed(4).replace(/\.?0+$/, '')}`
          : `Complex roots: x = ${(-b / (2 * a)).toFixed(3)} ± ${(Math.sqrt(-D) / (2 * a)).toFixed(3)}i`;
      return `## Quadratic Equation Step-by-Step Solution

### 1. Given Equation
\`${a}x² ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = 0\`
- **a:** ${a}, **b:** ${b}, **c:** ${c}

### 2. Discriminant Formula
\`D = b² - 4ac = (${b})² - 4(${a})(${c}) = ${b * b} - (${4 * a * c}) = ${D}\`

### 3. Quadratic Formula
\`x = (-b ± √D) / (2a)\`

### ✅ Final Answer
**${roots}**`;
    }
  }

  const cleaned = input
    .replace(/^(solve|calculate|what is|evaluate|compute|kitna hoga|value of)\s+/i, '')
    .replace(/\?+$/, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '**')
    .trim();

  if (/^[0-9+\-*/().%\s*]+$/.test(cleaned) && /[+\-*/%]/.test(cleaned) && /\d/.test(cleaned)) {
    try {
      const value = Function(`"use strict"; return (${cleaned});`)();
      if (typeof value === 'number' && Number.isFinite(value)) {
        const formatted = Number.isInteger(value) ? String(value) : Number(value.toFixed(8)).toString();
        return `## Instant Calculation Result\n\n- **Expression:** \`${cleaned}\`\n- **Result:** **${formatted}**`;
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function synthesizeOfflineAstaResponse(
  opts: AstaStreamOptions,
  memoryContext: string
): Promise<{ content: string; thinking: string; model: string; provider: string }> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')?.content || '';
  const mathSolved = solveMathExpression(lastUser);
  if (mathSolved) {
    opts.onMeta?.({ model: 'NikAI Astra Symbolic', provider: 'local' });
    opts.onToken?.(mathSolved, mathSolved);
    return { content: mathSolved, thinking: '', model: 'NikAI Astra Symbolic', provider: 'local' };
  }

  const { buildOfflineKnowledgeResponse } = await import('@/lib/astaOfflineBrain');
  const full = buildOfflineKnowledgeResponse(
    lastUser,
    opts.mode || 'auto',
    opts.noteContext,
    opts.action,
    opts.targetLanguage,
    memoryContext
  );
  opts.onMeta?.({ model: 'NikAI Astra Local Core', provider: 'local' });

  const words = full.split(/(\s+)/);
  let built = '';
  const step = 6;
  for (let i = 0; i < words.length; i += step) {
    if (opts.signal?.aborted) break;
    const chunk = words.slice(i, i + step).join('');
    built += chunk;
    opts.onToken?.(chunk, built);
    await new Promise((r) => setTimeout(r, 8));
  }
  return { content: built || full, thinking: '', model: 'NikAI Astra Local Core', provider: 'local' };
}

// ── Public Entry Points ──
export async function streamAstaAI(opts: AstaStreamOptions): Promise<AstaResult> {
  const t0 = performance.now();
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')?.content || '';
  const mode = resolveAstaMode(opts.mode);
  const memoryContext = opts.memoryContext ?? buildNikAIMemoryPrompt(opts.threadId);

  const request: AstaStreamOptions = { ...opts, mode, model: resolveAstaModel(opts.model) };

  const result =
    (await tryServerlessStream(request, memoryContext).catch((err) => {
      if (err?.name === 'AbortError') throw err;
      return null;
    })) ||
    (await tryDirectCloudStream(request, memoryContext).catch((err) => {
      if (err?.name === 'AbortError') throw err;
      return null;
    })) ||
    (await tryRemoteGatewayStream(request, memoryContext).catch((err) => {
      if (err?.name === 'AbortError') throw err;
      return null;
    })) ||
    (await trySupabaseEdge(request, memoryContext).catch(() => null)) ||
    (await synthesizeOfflineAstaResponse(request, memoryContext));

  return {
    ...result,
    latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    followUps: generateFollowUpSuggestions(lastUser, mode),
  };
}

export async function runAstaCompletion(params: {
  prompt: string;
  history?: AstaChatTurn[];
  mode?: AstaMode;
  noteContext?: string;
}): Promise<AstaResult> {
  const messages: AstaChatTurn[] = [
    ...(params.history || []),
    { role: 'user', content: params.prompt },
  ];
  return streamAstaAI({
    messages,
    mode: params.mode || 'auto',
    noteContext: params.noteContext,
  });
}
