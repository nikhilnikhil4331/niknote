import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';

interface FakeInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  emit: (text: string, isFinal: boolean) => void;
  fail: (code: string) => void;
  end: () => void;
}

let instance: FakeInstance;

beforeEach(() => {
  class FakeRecognition {
    lang = '';
    interimResults = false;
    continuous = false;
    maxAlternatives = 1;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
    constructor() {
      instance = this as unknown as FakeInstance;
    }
    start() { this.onstart?.(); }
    stop() { /* the browser would fire onend here */ }
    abort() { /* no-op */ }
    emit(text: string, isFinal: boolean) {
      this.onresult?.({
        resultIndex: 0,
        results: Object.assign([{ isFinal, 0: { transcript: text }, length: 1 }], { length: 1 }),
      });
    }
    fail(code: string) {
      this.onerror?.({ error: code });
    }
    end() {
      this.onend?.();
    }
  }
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
});

afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
});

describe('useSpeechDictation', () => {
  it('reports support and the listening state', async () => {
    const { result } = renderHook(() => useSpeechDictation({ lang: 'en-IN' }));
    expect(result.current.isSupported).toBe(true);
    expect(result.current.isListening).toBe(false);

    await act(async () => { await result.current.start(); });
    expect(result.current.isListening).toBe(true);
    expect(instance.lang).toBe('en-IN');
  });

  it('emits final transcript segments to the caller', async () => {
    const onFinalTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechDictation({ onFinalTranscript }));
    await act(async () => { await result.current.start(); });

    act(() => instance.emit('create a section on', false));
    expect(result.current.interimTranscript).toBe('create a section on');

    act(() => instance.emit("Newton's second law", true));
    expect(onFinalTranscript).toHaveBeenCalledWith("Newton's second law");
    expect(result.current.interimTranscript).toBe('');
  });

  it('turns a blocked microphone into a readable message', async () => {
    const { result } = renderHook(() => useSpeechDictation());
    await act(async () => { await result.current.start(); });

    act(() => instance.fail('not-allowed'));
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/Microphone access is blocked/i);
  });

  it('returns to idle when the browser ends the session', async () => {
    const { result } = renderHook(() => useSpeechDictation());
    await act(async () => { await result.current.start(); });
    expect(result.current.isListening).toBe(true);

    act(() => instance.end());
    expect(result.current.isListening).toBe(false);
  });
});
