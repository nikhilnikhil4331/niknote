// ============================================================
// NikNote — Scan Handwriting: photo/screenshot → typed lines
//
// On-device OCR via tesseract.js (Apache-2.0), same engine the
// PDF OCR tool uses. First run downloads the language model
// (browser/WebView cache keeps it afterwards, so the APK works
// offline). Cursive-heavy pages do better with the NikAI edge
// function — the Scan page offers both and says so honestly.
//
// Pure helpers (line cleanup, local scan store) are unit-tested.
// ============================================================

export type ScanLanguage = 'eng' | 'eng+hin';
export type ScanSource = 'device' | 'ai';

export interface ScanResult {
  text: string;
  lines: string[];
  /** 0..100 when the engine reports it (tesseract does, AI may not). */
  confidence: number | null;
  source: ScanSource;
}

/**
 * Conservative cleanup of raw OCR/pages output for study notes:
 * preserves the writer's line breaks, drops form feeds, empty
 * runs and obvious one-character noise. Never rewrites words.
 */
export function cleanOcrLines(text: string): string[] {
  const raw = (text || '').replace(/\f/g, '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  for (const lineRaw of raw) {
    const line = lineRaw.replace(/[ \t]+$/g, '').replace(/^[ \t]+/, '');
    if (!line) {
      // keep at most one blank separator
      if (out.length > 0 && out[out.length - 1] !== '') out.push('');
      continue;
    }
    // drop pure-symbol specks like "|" or ".," left by ruled paper lines
    if (line.length <= 2 && !/[\p{L}\p{N}]/u.test(line)) continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  while (out.length && out[0] === '') out.shift();
  return out;
}

export function titleFromLines(lines: string[], fallbackDate = new Date()): string {
  const first = lines.find((l) => l.trim().length >= 3)?.trim();
  if (first) return first.length > 48 ? `${first.slice(0, 48)}…` : first;
  return `Scanned note — ${fallbackDate.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
}

// ── Local scan notebook (offline / guest fallback) ───────────

export interface SavedScan {
  id: string;
  title: string;
  lines: string[];
  createdAt: string;
  source: ScanSource;
}

const SCANS_KEY = 'niknote.scans.v1';
const MAX_LOCAL_SCANS = 50;

export function loadLocalScans(): SavedScan[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCANS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((s) => s && Array.isArray(s.lines)) : [];
  } catch {
    return [];
  }
}

export function saveLocalScan(scan: Omit<SavedScan, 'id' | 'createdAt'>): SavedScan {
  const entry: SavedScan = {
    ...scan,
    id: `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(SCANS_KEY, JSON.stringify([entry, ...loadLocalScans()].slice(0, MAX_LOCAL_SCANS)));
  } catch { /* storage full — the text is still on screen to copy */ }
  return entry;
}

export function deleteLocalScan(id: string): void {
  try {
    localStorage.setItem(SCANS_KEY, JSON.stringify(loadLocalScans().filter((s) => s.id !== id)));
  } catch { /* noop */ }
}

export function updateLocalScan(id: string, title: string, lines: string[]): void {
  try {
    localStorage.setItem(
      SCANS_KEY,
      JSON.stringify(loadLocalScans().map((s) => (s.id === id ? { ...s, title, lines } : s)))
    );
  } catch { /* noop */ }
}

// ── On-device OCR ────────────────────────────────────────────

export interface ScanProgress {
  label: string;
  /** 0..1 when known */
  progress: number | null;
}

export async function recognizeOnDevice(
  image: string,
  language: ScanLanguage,
  onProgress?: (p: ScanProgress) => void
): Promise<ScanResult> {
  onProgress?.({ label: 'OCR model load ho raha hai (pehli baar download hota hai)…', progress: null });
  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker(language, tesseract.OEM.LSTM_ONLY, {
    logger: (m: { status?: string; progress?: number }) => {
      if (typeof m?.progress !== 'number') return;
      onProgress?.({
        label: m.status === 'recognizing text' ? 'Handwriting padhi ja rahi hai…' : 'OCR model load ho raha hai…',
        progress: m.progress,
      });
    },
  });
  try {
    const { data } = await worker.recognize(image);
    const text = data.text || '';
    return {
      text,
      lines: cleanOcrLines(text),
      confidence: typeof data.confidence === 'number' ? Math.round(data.confidence) : null,
      source: 'device',
    };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
