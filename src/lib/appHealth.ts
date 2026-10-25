// ============================================================
// NikNote Check-up — "sab kaam kar raha hai?" ka seedha jawab
//
// Har check devic par chalta hai, aur nateeja user ko dikhaya jaata hai:
//   1. AI   → NikAI ka poora raasta (gateway / same-origin) + providers
//   2. PDF  → pdf-lib engine se asli PDF banake watermark + reopen
//   3. OCR  → tesseract worker CDN reachable? (canvas available?)
//   4. Save → storage + device type (APK / web)
// ============================================================

import { addWatermark, countPdfPages } from '@/lib/pdfTools';
import { getRemoteAstraGatewayUrl } from '@/lib/aiEngine';

export type CheckStatus = 'ok' | 'warn' | 'fail';

export type CheckResult = {
  id: 'ai' | 'pdf' | 'ocr' | 'device';
  label: string;
  status: CheckStatus;
  detail: string;
  ms: number;
};

export type AiRoute = 'gateway' | 'same-origin';

/** Where NikAI will send its requests on this device. */
export function getAiEndpoint(): { url: string; route: AiRoute } {
  const gateway = getRemoteAstraGatewayUrl();
  if (gateway) return { url: gateway, route: 'gateway' };
  return { url: '/api/ai', route: 'same-origin' };
}

export function isNativeApp(): boolean {
  try {
    const cap = (globalThis as any)?.Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function') return Boolean(cap.isNativePlatform());
    if (cap && typeof cap.getPlatform === 'function') return cap.getPlatform() !== 'web';
  } catch {
    /* ignore */
  }
  return false;
}

/** `{groq:true, gemini:false}` → `groq ✓ · gemini ✕` */
export function formatProviders(providers: Record<string, boolean> | null | undefined): string {
  if (!providers || typeof providers !== 'object') return 'providers unknown';
  const keys = ['groq', 'gemini', 'openai'];
  const parts = keys.filter((key) => key in providers).map((key) => `${key} ${providers[key] ? '✓' : '✕'}`);
  return parts.length > 0 ? parts.join(' · ') : 'koi provider nahi';
}

type HealthPayload = { ok?: boolean; providers?: Record<string, boolean>; engine?: string };

export async function checkAi(timeoutMs = 20000): Promise<CheckResult> {
  const started = performance.now();
  const { url, route } = getAiEndpoint();
  const label = 'NikAI (AI)';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const where = route === 'gateway' ? 'cloud relay' : 'same-origin';

  try {
    // 1. Health: which providers does this endpoint actually have?
    let providers = 'providers unknown';
    try {
      const health = await fetch(url, { method: 'GET', signal: controller.signal });
      if (health.ok) {
        const payload = (await health.json()) as HealthPayload;
        providers = formatProviders(payload?.providers);
      }
    } catch {
      /* the real answer below is the actual test */
    }

    // 2. A real, tiny completion — same route the chat uses, but non-streaming
    //    so the answer arrives in one shot (and proves the keys work).
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Reply with exactly one word: OK' }],
        mode: 'auto',
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        id: 'ai',
        label,
        status: 'fail',
        detail: `${where} ne ${res.status} diya — site down ya internet nahi · ${providers}`,
        ms: Math.round(performance.now() - started),
      };
    }

    let content = '';
    let model = '';
    try {
      const payload = (await res.json()) as { content?: string; model?: string; provider?: string };
      content = String(payload?.content || '').trim();
      model = payload?.model || payload?.provider || '';
    } catch {
      content = '';
    }

    return {
      id: 'ai',
      label,
      status: content ? 'ok' : 'warn',
      detail: content
        ? `${where} · ${providers} · ${model || 'Astra'} · jawab: ${content.slice(0, 24)}`
        : `${where} se jawab khali aaya · ${providers}`,
      ms: Math.round(performance.now() - started),
    };
  } catch (error: any) {
    const aborted = error?.name === 'AbortError';
    return {
      id: 'ai',
      label,
      status: 'fail',
      detail: aborted
        ? `AI ne ${Math.round(timeoutMs / 1000)}s me jawab nahi diya — internet slow lagta hai`
        : `AI tak nahi pahunch paye — internet check karo (${String(error?.message || 'network error').slice(0, 60)})`,
      ms: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Builds, watermarks and re-opens a real PDF — proves the whole engine works offline. */
export async function checkPdfEngine(): Promise<CheckResult> {
  const started = performance.now();
  try {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595.28, 841.89]);
    page.drawText('NikNote check-up', { x: 40, y: 760, size: 18, font });
    const base = await doc.save();

    const marked = await addWatermark(base, { text: 'CHECK', opacity: 0.2 });
    const pages = await countPdfPages(marked);
    const ok = pages === 1 && marked.byteLength > base.byteLength;
    return {
      id: 'pdf',
      label: 'PDF engine (edit, convert, protect)',
      status: ok ? 'ok' : 'warn',
      detail: ok ? `PDF bani, watermark lagi, dobara khuli · ${Math.round(marked.byteLength / 1024)} KB` : 'PDF engine ne galat output diya',
      ms: Math.round(performance.now() - started),
    };
  } catch (error: any) {
    return {
      id: 'pdf',
      label: 'PDF engine (edit, convert, protect)',
      status: 'fail',
      detail: `PDF engine fail: ${String(error?.message || error).slice(0, 80)}`,
      ms: Math.round(performance.now() - started),
    };
  }
}

const OCR_WORKER_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js';

export async function checkOcr(): Promise<CheckResult> {
  const started = performance.now();
  const canvasOk = typeof document !== 'undefined' && Boolean(document.createElement('canvas').getContext);
  try {
    const res = await fetch(OCR_WORKER_URL, { method: 'HEAD', mode: 'cors', cache: 'no-store' });
    const reachable = res.ok;
    return {
      id: 'ocr',
      label: 'OCR (searchable PDF)',
      status: reachable ? 'ok' : 'warn',
      detail: reachable
        ? `OCR model server reachable · canvas ${canvasOk ? 'ready' : 'missing'}`
        : 'OCR model server tak nahi pahunche — pehli baar OCR ke liye internet chahiye',
      ms: Math.round(performance.now() - started),
    };
  } catch {
    return {
      id: 'ocr',
      label: 'OCR (searchable PDF)',
      status: 'warn',
      detail: 'OCR model offline hai — baaki tools phir bhi chalenge, OCR ko internet chahiye',
      ms: Math.round(performance.now() - started),
    };
  }
}

export async function checkDevice(): Promise<CheckResult> {
  const started = performance.now();
  const native = isNativeApp();
  let storage = false;
  try {
    localStorage.setItem('niknote.checkup', '1');
    storage = localStorage.getItem('niknote.checkup') === '1';
    localStorage.removeItem('niknote.checkup');
  } catch {
    storage = false;
  }
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const host = typeof window !== 'undefined' ? window.location.hostname : 'unknown';

  return {
    id: 'device',
    label: native ? 'App device' : 'Web browser',
    status: storage ? 'ok' : 'warn',
    detail: `${native ? 'APK' : 'web'} · ${host} · storage ${storage ? 'ok' : 'band'} · ${online ? 'online' : 'offline'}`,
    ms: Math.round(performance.now() - started),
  };
}

export const CHECKS: { id: CheckResult['id']; label: string; run: () => Promise<CheckResult> }[] = [
  { id: 'device', label: 'Device', run: checkDevice },
  { id: 'pdf', label: 'PDF engine', run: checkPdfEngine },
  { id: 'ocr', label: 'OCR', run: checkOcr },
  { id: 'ai', label: 'NikAI', run: checkAi },
];

/** Runs every check and reports each one the moment it finishes (AI is slowest). */
export async function runAllChecks(
  onResult?: (result: CheckResult) => void
): Promise<CheckResult[]> {
  const settled = await Promise.all(
    CHECKS.map(async (check) => {
      const result = await check.run();
      onResult?.(result);
      return result;
    })
  );
  const order: CheckResult['id'][] = ['ai', 'pdf', 'ocr', 'device'];
  return settled.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
