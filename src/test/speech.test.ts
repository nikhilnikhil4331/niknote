import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanForSpeech,
  isDictationSupported,
  isSpeechSupported,
  speakAloud,
  startDictation,
  stopSpeaking,
} from '@/lib/speech';

describe('cleanForSpeech', () => {
  it('removes markdown furniture before reading aloud', () => {
    const md = [
      '## Newton\'s Second Law',
      '',
      '- **Force** equals mass times acceleration.',
      '- Formula: `F = ma`',
      '',
      '```js',
      'const ignored = true;',
      '```',
    ].join('\n');
    const spoken = cleanForSpeech(md);
    expect(spoken).not.toContain('#');
    expect(spoken).not.toContain('**');
    expect(spoken).not.toContain('```');
    expect(spoken).not.toContain('ignored');
    expect(spoken).toContain("Newton's Second Law");
    expect(spoken).toContain('Force equals mass times acceleration');
  });

  it('keeps the words inside links and inline math', () => {
    expect(cleanForSpeech('See [the chapter](https://x.y) about $F = ma$')).toBe(
      'See the chapter about F = ma',
    );
  });

  it('returns an empty string for empty input', () => {
    expect(cleanForSpeech('   ')).toBe('');
  });
});

describe('feature detection', () => {
  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  });

  it('reports dictation unsupported instead of throwing', () => {
    expect(isDictationSupported()).toBe(false);
    const onError = vi.fn();
    const handle = startDictation({ onResult: () => {}, onError });
    expect(handle).toBeNull();
    expect(onError).toHaveBeenCalledWith('unsupported', expect.stringContaining('speech'));
  });

  it('reports read-aloud unsupported and refuses to pretend', () => {
    expect(isSpeechSupported()).toBe(false);
    expect(speakAloud('hello')).toBe(false);
    stopSpeaking(); // must not throw
  });
});

describe('dictation session', () => {
  let instance: {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    emit: (text: string, isFinal: boolean) => void;
    fail: (code: string) => void;
  };

  beforeEach(() => {
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      constructor() {
        instance = this as unknown as typeof instance;
      }
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
      emit(text: string, isFinal: boolean) {
        this.onresult?.({
          resultIndex: 0,
          results: Object.assign([{ isFinal, 0: { transcript: text }, length: 1 }], { length: 1 }),
        });
      }
      fail(code: string) {
        this.onerror?.({ error: code, message: code });
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });

  afterEach(() => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });

  it('streams interim and final transcript text', () => {
    expect(isDictationSupported()).toBe(true);
    const onResult = vi.fn();
    const handle = startDictation({ lang: 'en-IN', onResult });
    expect(handle).not.toBeNull();
    expect(instance.lang).toBe('en-IN');
    expect(instance.continuous).toBe(true);

    instance.emit('newton second law', false);
    instance.emit('create a section on Newton second law', true);
    expect(onResult).toHaveBeenNthCalledWith(1, 'newton second law', false);
    expect(onResult).toHaveBeenNthCalledWith(2, 'create a section on Newton second law', true);
  });

  it('maps microphone denial to a permission error', () => {
    const onError = vi.fn();
    startDictation({ onResult: () => {}, onError });
    instance.fail('not-allowed');
    expect(onError).toHaveBeenCalledWith('not-allowed', 'not-allowed');
  });

  it('stopping the session does not fire the end callback twice', () => {
    const onEnd = vi.fn();
    const handle = startDictation({ onResult: () => {}, onEnd });
    handle?.stop();
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe('read aloud', () => {
  const speak = vi.fn();
  const cancel = vi.fn();

  beforeEach(() => {
    (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
      speak,
      cancel,
      getVoices: () => [{ lang: 'en-IN', name: 'Rishi' }, { lang: 'hi-IN', name: 'Lekha' }],
    };
    (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      class {
        text: string;
        lang = '';
        rate = 1;
        pitch = 1;
        voice: unknown = null;
        onend: (() => void) | null = null;
        constructor(text: string) { this.text = text; }
      };
  });

  afterEach(() => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    speak.mockReset();
    cancel.mockReset();
  });

  it('reads cleaned text with an installed voice', () => {
    expect(isSpeechSupported()).toBe(true);
    expect(speakAloud('## Title\n\n**Bold** text')).toBe(true);
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as { text: string; lang: string; voice: { name: string } };
    expect(utterance.text).toBe('Title\n\nBold text');
    expect(utterance.voice.name).toBe('Rishi');
  });

  it('does nothing for content with no speakable text', () => {
    expect(speakAloud('```\ncode only\n```')).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });
});
