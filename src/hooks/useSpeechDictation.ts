import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isDictationSupported,
  startDictation,
  type DictationErrorCode,
  type DictationHandle,
} from '@/lib/speech';

type DictationStatus = 'idle' | 'listening' | 'error';

export interface UseSpeechDictationOptions {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  /** Called when a final transcript segment is produced */
  onFinalTranscript?: (text: string) => void;
}

export interface UseSpeechDictationReturn {
  isSupported: boolean;
  status: DictationStatus;
  isListening: boolean;
  interimTranscript: string;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const ERROR_MESSAGES: Record<DictationErrorCode, string> = {
  unsupported: 'Speech recognition is not supported in this browser.',
  'not-allowed': 'Microphone access is blocked. Allow it in your browser settings.',
  'no-speech': 'No speech detected — try again a little closer to the mic.',
  network: 'The speech service could not be reached.',
  aborted: '',
  unknown: 'Dictation error. Please try again.',
};

/**
 * Thin React wrapper over `startDictation` (src/lib/speech.ts).
 *
 * The platform plumbing lives in the lib so the same implementation is shared
 * with NikAI's voice input; this hook only owns component state.
 */
export function useSpeechDictation(options: UseSpeechDictationOptions = {}): UseSpeechDictationReturn {
  const { lang, onFinalTranscript } = options;

  const isSupported = isDictationSupported();
  const handleRef = useRef<DictationHandle | null>(null);

  const [status, setStatus] = useState<DictationStatus>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    setInterimTranscript('');
    setErrorMessage(null);
    setStatus('idle');
  }, []);

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    setInterimTranscript('');
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) {
      setErrorMessage(ERROR_MESSAGES.unsupported);
      setStatus('error');
      return;
    }

    setErrorMessage(null);
    setInterimTranscript('');
    setStatus('listening');

    const handle = startDictation({
      lang,
      onResult: (text, isFinal) => {
        if (isFinal) {
          setInterimTranscript('');
          onFinalTranscript?.(text);
        } else {
          setInterimTranscript(text);
        }
      },
      onError: (code) => {
        const message = ERROR_MESSAGES[code];
        if (!message) return;
        setErrorMessage(message);
        setStatus('error');
      },
      onEnd: () => {
        handleRef.current = null;
        setInterimTranscript('');
        setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      },
    });

    handleRef.current = handle;
    if (!handle) setStatus('error');
  }, [isSupported, lang, onFinalTranscript]);

  // Never leave the microphone open after the component goes away.
  useEffect(() => () => {
    handleRef.current?.stop();
    handleRef.current = null;
  }, []);

  return {
    isSupported,
    status,
    isListening: status === 'listening',
    interimTranscript,
    errorMessage,
    start,
    stop,
    reset,
  };
}
