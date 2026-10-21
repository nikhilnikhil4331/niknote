// ============================================================
// speech — browser-native dictation and read-aloud.
//
// Why not bundle a speech model: OpenWhispr (MIT) and VoiceStudio (AGPL-3.0)
// both solve dictation, but they ship desktop runtimes or Python model
// servers. Pulling either into a Vite PWA would cost tens of MB of weights,
// need a GPU for the good models, and break the "notes still work offline on
// a phone" rule.
//
// The Web Speech API gives us the product-relevant 80%:
//   - dictation through the OS/browser engine (no weights, no keys),
//   - read-aloud through the installed speech voices (works offline),
//   - graceful, explicit failure when the browser has no support,
// and it keeps user audio out of NikNote's servers entirely.
//
// Cloud TTS/STT can be added later behind this same interface.
// ============================================================

export type DictationErrorCode =
  | 'unsupported'
  | 'not-allowed'
  | 'no-speech'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface DictationHandle {
  stop: () => void;
}

export interface DictationOptions {
  lang?: string;
  /** Called with interim text while speaking and final text when a phrase settles. */
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (code: DictationErrorCode, message: string) => void;
  onEnd?: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isDictationSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

const ERROR_MAP: Record<string, DictationErrorCode> = {
  'not-allowed': 'not-allowed',
  'service-not-allowed': 'not-allowed',
  'no-speech': 'no-speech',
  network: 'network',
  aborted: 'aborted',
  'audio-capture': 'network',
};

/**
 * Start dictation. Returns `null` when the browser cannot do it, so callers
 * can hide the button instead of showing a dead control.
 */
export function startDictation(options: DictationOptions): DictationHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    options.onError?.('unsupported', 'This browser has no speech recognition. Chrome, Edge or Safari work.');
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = options.lang || navigator.language || 'en-IN';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let stopped = false;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript?.trim();
      if (!text) continue;
      options.onResult(text, result.isFinal);
    }
  };

  recognition.onerror = (event) => {
    const code = ERROR_MAP[event.error] || 'unknown';
    if (code !== 'aborted') options.onError?.(code, event.message || event.error);
  };

  recognition.onend = () => {
    if (!stopped) options.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    options.onError?.('unknown', 'Could not start the microphone.');
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      try { recognition.stop(); } catch { /* already stopped */ }
    },
  };
}

/** Strip markdown so read-aloud sounds like a person, not a syntax error. */
export function cleanForSpeech(markdown: string): string {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ')
    .replace(/\$([^$]+)\$/g, ' $1 ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

/**
 * Read text aloud with the closest installed voice; returns false when the
 * platform has no speech synthesis so the UI can avoid a dead button.
 */
export function speakAloud(text: string, options: SpeakOptions = {}): boolean {
  if (!isSpeechSupported()) return false;
  const clean = cleanForSpeech(text);
  if (!clean) return false;

  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(clean);
  const want = (options.lang || 'en-IN').toLowerCase();
  const voices = window.speechSynthesis.getVoices?.() || [];
  const exact = voices.find(v => v.lang?.toLowerCase() === want);
  const sameLanguage = voices.find(v => v.lang?.toLowerCase().startsWith(want.split('-')[0]));
  const indian = voices.find(v => /-(IN|PK)$/i.test(v.lang || ''));
  const chosen = exact || sameLanguage || indian;
  if (chosen) utterance.voice = chosen;
  utterance.lang = chosen?.lang || want;
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  if (options.onEnd) utterance.onend = () => options.onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}
