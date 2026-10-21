import { useCallback, useEffect, useState } from 'react';
import { Check, PencilLine, Sparkles, X } from 'lucide-react';
import { CLOUD_SYNC_EVENT } from '@/lib/cloudSyncEngine';

const DISMISS_KEY = 'niknote.onboarding.firstNote.v1';
const NOTES_KEY = 'niknote.notes.v1';
const MOBILE_NOTES_KEY = 'niknote.mobile.notebooks.v1';

function countSavedNotes(): number {
  if (typeof localStorage === 'undefined') return 0;
  let total = 0;
  for (const key of [NOTES_KEY, MOBILE_NOTES_KEY]) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(parsed)) {
        total += parsed.filter((item) => item && !item.trashedAt).length;
      }
    } catch {
      // A broken key must not block onboarding.
    }
  }
  return total;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

interface FirstNoteGuideProps {
  /** True as soon as the editor has any typed text. */
  hasContent: boolean;
  /** Opens the paper & pen settings. */
  onOpenStyle: () => void;
}

/**
 * Three-step first-note checklist.
 *
 * It is a guide, not a gate: nothing is blocked, nothing is modal, and it
 * disappears for good once a note exists or the user dismisses it. The ticks
 * are derived from real state (editor text, saved notes) instead of a
 * "completed" flag the user could tick without doing anything.
 */
export function FirstNoteGuide({ hasContent, onOpenStyle }: FirstNoteGuideProps) {
  const [savedNotes, setSavedNotes] = useState(() => countSavedNotes());
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [styleTouched, setStyleTouched] = useState(false);

  const refresh = useCallback(() => setSavedNotes(countSavedNotes()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(CLOUD_SYNC_EVENT, refresh);
    window.addEventListener('storage', refresh);
    const timer = window.setInterval(refresh, 2500);
    return () => {
      window.removeEventListener(CLOUD_SYNC_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, 'dismissed'); } catch { /* ignore */ }
  };

  if (dismissed || savedNotes > 0) return null;

  const steps = [
    { label: 'Write or paste your first line', done: hasContent },
    { label: 'Pick your paper and pen', done: styleTouched },
    { label: 'Save the page', done: savedNotes > 0 },
  ];
  const doneCount = steps.filter(step => step.done).length;

  return (
    <aside
      aria-label="First note guide"
      data-testid="first-note-guide"
      className="fixed bottom-24 left-3 z-40 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-violet-200/70 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-5 sm:left-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#241a3d]">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
            Your first page in 3 steps
          </p>
          <p className="mt-0.5 text-[11px] text-[#6b6486]">{doneCount}/3 done · nothing is blocked</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss the first note guide"
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ol className="mt-2 space-y-1.5">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-2 text-[11.5px]">
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${
                step.done
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-violet-300 bg-white text-violet-500'
              }`}
            >
              {step.done ? <Check className="h-2.5 w-2.5" /> : index + 1}
            </span>
            <span className={step.done ? 'text-[#a79fc0] line-through' : 'text-[#3b3358]'}>{step.label}</span>
          </li>
        ))}
      </ol>

      {!hasContent && (
        <p className="mt-2 rounded-lg bg-violet-50 px-2 py-1.5 text-[10.5px] leading-relaxed text-violet-800">
          Tip: paste a paragraph and press “Turn into notes” — or open a PDF in the import panel.
        </p>
      )}

      {hasContent && !styleTouched && (
        <button
          type="button"
          onClick={() => { setStyleTouched(true); onOpenStyle(); }}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#241a3d] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#322452]"
        >
          <PencilLine className="h-3 w-3" /> Choose paper &amp; pen
        </button>
      )}
    </aside>
  );
}

export default FirstNoteGuide;
