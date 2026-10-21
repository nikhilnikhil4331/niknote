// ============================================================
// NikAI — Unified Neural Engine
// Powers NikAI (/ai), Inline Editor AI, @AI Mentions,
// Persistent Session Memory, Smart Notes & Live Quizzes.
// ============================================================

import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import { buildNikAIMemoryPrompt } from '@/lib/nikaiMemory';

export type AstaMode =
  | 'auto'
  | 'deep'
  | 'teacher'
  | 'solver'
  | 'code'
  | 'notes'
  | 'quiz'
  | 'write'
  | 'tutor'
  | 'writing'
  | 'vision';

export type AstaModelChoice =
  | 'astra-auto'
  | 'astra-pro'
  | 'astra-flash'
  | 'astra-vision'
  | 'astra-coder'
  | 'auto'
  | 'pro'
  | 'flash'
  | 'vision'
  | 'coder';

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

export function readCustomAIKeys(): AstaCustomKeys {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      groqKey: typeof parsed.groqKey === 'string' ? parsed.groqKey.trim() : '',
      geminiKey: typeof parsed.geminiKey === 'string' ? parsed.geminiKey.trim() : '',
      openaiKey: typeof parsed.openaiKey === 'string' ? parsed.openaiKey.trim() : '',
    };
  } catch {
    return {};
  }
}

export function saveCustomAIKeys(keys: AstaCustomKeys): void {
  try {
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify({
      groqKey: (keys.groqKey || '').trim(),
      geminiKey: (keys.geminiKey || '').trim(),
      openaiKey: (keys.openaiKey || '').trim(),
    }));
  } catch {
    // ignore storage quota errors
  }
}

// Only keys the user pasted themselves in Settings -> AI keys live here.
// Build-time VITE_* provider keys were removed on purpose: anything prefixed with
// VITE_ is inlined into the public JS bundle, so those secrets now live in the
// ai-proxy / editor-ai edge functions and in /api/ai (GROQ_API_KEY, GEMINI_API_KEY).
function getEffectiveClientKeys(): { groq: string; gemini: string; openai: string } {
  const custom = readCustomAIKeys();
  return {
    groq: (custom.groqKey || '').trim(),
    gemini: (custom.geminiKey || '').trim(),
    openai: (custom.openaiKey || '').trim(),
  };
}

export async function probeAstaProviders(): Promise<{ cloudReady: boolean; providers: string[] }> {
  const localKeys = getEffectiveClientKeys();
  const active = new Set<string>();
  if (localKeys.openai) active.add('NikAI OpenAI');
  if (localKeys.groq) active.add('NikAI Turbo');
  if (localKeys.gemini) active.add('NikAI Vision');

  try {
    const res = await fetch('/api/ai', { method: 'GET' });
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (data?.providers?.openai) active.add('NikAI OpenAI');
      if (data?.providers?.groq) active.add('NikAI Turbo');
      if (data?.providers?.gemini) active.add('NikAI Vision');
    }
  } catch {
    // ignore network check failure
  }

  return {
    cloudReady: active.size > 0,
    providers: Array.from(active),
  };
}

const CLIENT_SYSTEM_PROMPTS: Record<AstaMode, string> = {
  auto: `You are **NikAI**, NikNote's single unified AI study assistant. Match user language (English / Hinglish / Hindi). Give complete, crystal-clear structured Markdown answers with headings, **bold terms**, tables, code/formula blocks, and \`> 💡 Pro-Tips\` ready for 1-tap Handwriting conversion.`,
  deep: `You are **NikAI Pro** — reason step by step from first principles, check every equation and edge case, and highlight the final answer clearly.`,
  teacher: `You are **NikAI Master Guru** — explain with: 1) Intuition & real-life analogy, 2) Step-by-Step Breakdown, 3) Formulas/Rules, 4) Worked Example, 5) > 💡 Exam Pro-Tip.`,
  solver: `You are **NikAI Step-by-Step Solver** — present Given → Formula/Concept → Step-by-Step Working → Verification → ✅ Final Answer → ⚡ Shortcut Trick.`,
  code: `You are **NikAI Coder** — write clean, complete, production-ready fenced code blocks with explanations, edge cases, and Time/Space Complexity.`,
  notes: `You are **NikAI Smart Notes Architect** — build complete exam-ready notebook pages with \`# Chapter Title\`, \`## Subheadings\`, bullet definitions (\`- **Term:** Meaning\`), callout tips (\`> 💡\`), comparison tables, and 3 self-check questions.`,
  quiz: `You are **NikAI Live Quiz Master** — generate 5 high-yield MCQs (Easy to Tough). Format strictly:\n### Q1. [Question]\n- A) [Option]\n- B) [Option]\n- C) [Option]\n- D) [Option]\n**Answer:** [A/B/C/D]\n**Explanation:** [Why correct]`,
  write: `You are **NikAI Writing Studio** — craft compelling, natural prose, summaries, grammar fixes, or translations matching the requested language.`,
  tutor: `You are **NikAI Tutor** — explain the idea from intuition, then build the formal answer with a worked example and one exam tip.`,
  writing: `You are **NikAI Writing Studio** — craft compelling, natural prose, summaries, grammar fixes, or translations matching the requested language.`,
  vision: `You are **NikAI Vision** — read the attached image or diagram carefully, describe what matters, and then answer the question with the visible evidence.`,
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

// ── Tier 1: Same-origin /api/ai SSE stream ──
async function tryServerlessStream(
  opts: AstaStreamOptions,
  memoryContext: string
): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  const custom = readCustomAIKeys();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (custom.groqKey) headers['X-Groq-Key'] = custom.groqKey;
  if (custom.geminiKey) headers['X-Gemini-Key'] = custom.geminiKey;
  if (custom.openaiKey) headers['X-OpenAI-Key'] = custom.openaiKey;

  const res = await fetch('/api/ai', {
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
  });

  if (!res.ok || !res.body) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let thinking = '';
  let model = 'NikAI';
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

// ── Tier 2: Direct Browser Cloud Stream (OpenAI / Groq / Gemini) ──
async function tryDirectCloudStream(
  opts: AstaStreamOptions,
  memoryContext: string
): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  const keys = getEffectiveClientKeys();
  if (!keys.groq && !keys.gemini && !keys.openai) return null;

  const mode = opts.mode || 'auto';
  const sys = [
    CLIENT_SYSTEM_PROMPTS[mode] || CLIENT_SYSTEM_PROMPTS.auto,
    memoryContext ? `\n\nActive User Memory & Previous Sessions:\n${memoryContext.slice(0, 5000)}` : '',
    opts.noteContext?.trim() ? `\n\nAttached Note Context:\n${opts.noteContext.slice(0, 12000)}` : '',
  ].join('');

  const turns = opts.messages.filter((m) => m.role !== 'system');
  const hasImages = turns.some((m) => m.images && m.images.length > 0);
  const preferGemini = hasImages || opts.model === 'astra-vision' || (!keys.openai && !keys.groq && Boolean(keys.gemini));

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
          : 'llama-3.3-70b-versatile';
    const label = opts.model === 'astra-pro' || mode === 'deep' ? 'NikAI Pro' : 'NikAI';

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      signal: opts.signal,
      body: JSON.stringify({
        model: upstreamModel,
        stream: true,
        temperature: 0.55,
        max_tokens: 4096,
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
    opts.onMeta?.({ model: label, provider: useOpenAI ? 'openai' : 'groq' });

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
            const p = JSON.parse(d)?.choices?.[0]?.delta;
            if (p?.reasoning) { thinking += p.reasoning; opts.onThinking?.(p.reasoning, thinking); }
            if (p?.content) { content += p.content; opts.onToken?.(p.content, content); }
          } catch { /* skip */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return content.trim() ? { content, thinking, model: label, provider: useOpenAI ? 'openai' : 'groq' } : null;
  };

  const tryGemini = async () => {
    if (!keys.gemini) return null;
    const model = opts.model === 'astra-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const label = opts.model === 'astra-pro' ? 'NikAI Pro' : 'NikAI Vision';
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
                if (p.thought) { thinking += p.text; opts.onThinking?.(p.text, thinking); }
                else { content += p.text; opts.onToken?.(p.text, content); }
              }
            }
          } catch { /* skip */ }
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
      (await tryOpenAIOrGroq(true).catch(() => null)) ||
      (await tryOpenAIOrGroq(false).catch(() => null))
    );
  }
  return (
    (await tryOpenAIOrGroq(true).catch(() => null)) ||
    (await tryOpenAIOrGroq(false).catch(() => null)) ||
    (await tryGemini().catch(() => null))
  );
}

// ── Tier 0: server-side proxy (keys never reach the browser) ──
/** Enabled by `VITE_AI_PROXY=1` once `ai-proxy` has its provider secrets. */
export function aiProxyEnabled(): boolean {
  const flag = String(import.meta.env.VITE_AI_PROXY ?? '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'on';
}

const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;

/**
 * Ask our own edge function instead of calling Gemini/Groq with a public key.
 * The function enforces a per-user hourly quota and returns 429 with the reset
 * time, which we surface honestly instead of silently retrying elsewhere.
 */
async function tryAiProxy(
  opts: AstaStreamOptions,
  memoryContext: string
): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  if (!aiProxyEnabled()) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    const system = [memoryContext, opts.noteContext].filter(Boolean).join('\n\n');
    const res = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
        system: system || undefined,
      }),
      signal: opts.signal,
    });

    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      const resetAt = typeof body?.resetAt === 'string' ? new Date(body.resetAt) : null;
      const when = resetAt && !Number.isNaN(resetAt.getTime())
        ? resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'in a little while';
      const message = [
        '## Hourly AI limit reached',
        '',
        `You have used the free AI requests for this hour. The limit resets at **${when}**.`,
        '',
        'Notes, PDF import and handwriting export keep working without AI.',
      ].join('\n');
      opts.onMeta?.({ model: 'NikAI quota', provider: 'quota' });
      opts.onToken?.(message, message);
      return { content: message, thinking: '', model: 'NikAI quota', provider: 'quota' };
    }

    if (!res.ok) return null;
    const data = await res.json();
    const content = typeof data?.content === 'string' ? data.content.trim() : '';
    if (!content) return null;

    opts.onMeta?.({ model: data.model || 'NikAI proxy', provider: data.provider || 'proxy' });
    opts.onToken?.(content, content);
    return {
      content,
      thinking: '',
      model: data.model || 'NikAI proxy',
      provider: data.provider || 'proxy',
    };
  } catch {
    return null;
  }
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
      tutor: 'teacher',
      writing: 'notes',
      vision: 'teacher',
    };
    const combinedContext = [memoryContext, opts.noteContext].filter(Boolean).join('\n\n');
    const { data, error } = await supabase.functions.invoke('openai-brain', {
      body: {
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
        agentType: modeMap[opts.mode || 'auto'] || 'teacher',
        noteContext: combinedContext,
      },
    });
    if (error || !data) return null;
    const text = (data.content || data.response || '').trim();
    if (!text) return null;
    opts.onMeta?.({ model: 'NikAI Cloud', provider: data.provider || 'supabase' });
    opts.onToken?.(text, text);
    return { content: text, thinking: '', model: 'NikAI Cloud', provider: data.provider || 'supabase' };
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
      const roots = D >= 0
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
    opts.onMeta?.({ model: 'NikAI Maths', provider: 'local' });
    opts.onToken?.(mathSolved, mathSolved);
    return { content: mathSolved, thinking: '', model: 'NikAI Maths', provider: 'local' };
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
  opts.onMeta?.({ model: 'NikAI Device', provider: 'local' });

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
  return { content: built || full, thinking: '', model: 'NikAI Device', provider: 'local' };
}

// ── Public Entry Points ──
export async function streamAstaAI(opts: AstaStreamOptions): Promise<AstaResult> {
  const t0 = performance.now();
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')?.content || '';
  const mode = opts.mode || 'auto';
  const memoryContext = opts.memoryContext ?? buildNikAIMemoryPrompt(opts.threadId);

  const result =
    (await tryAiProxy(opts, memoryContext).catch((err) => {
      if (err?.name === 'AbortError') throw err;
      return null;
    })) ||
    (await tryServerlessStream(opts, memoryContext).catch((err) => {
      if (err?.name === 'AbortError') throw err;
      return null;
    })) ||
    (await tryDirectCloudStream(opts, memoryContext).catch((err) => {
      if (err?.name === 'AbortError') throw err;
      return null;
    })) ||
    (await trySupabaseEdge(opts, memoryContext).catch(() => null)) ||
    (await synthesizeOfflineAstaResponse(opts, memoryContext));

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
