import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Check, ClipboardCopy, FileText, ListChecks,
  Mic, NotebookPen, Square, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { lectureToNotes, estimateSpokenMinutes } from '@/lib/lecture';
import { saveLectureNote } from '@/lib/lectureNotes';
import { track } from '@/lib/growth/funnel';

const BLOCK_LABEL: Record<string, string> = {
  h1: 'Title',
  h2: 'Heading',
  h3: 'Sub-heading',
  bullet: 'Point',
  numbered: 'Step',
  equation: 'Formula',
  text: 'Paragraph',
};

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function LectureMode() {
  const navigate = useNavigate();
  const dictation = useSpeechDictation({
    lang: typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('hi') ? 'hi-IN' : 'en-IN',
    onFinalTranscript: text => setTranscript(prev => `${prev}${prev ? ' ' : ''}${text}`),
  });

  const [transcript, setTranscript] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [built, setBuilt] = useState<ReturnType<typeof lectureToNotes> | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!dictation.isListening) return;
    startedAt.current = startedAt.current ?? Date.now();
    const timer = window.setInterval(() => {
      if (startedAt.current) setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [dictation.isListening]);

  const words = useMemo(() => transcript.trim().split(/\s+/).filter(Boolean).length, [transcript]);

  const build = () => {
    if (!transcript.trim()) {
      toast.error('Record or paste a lecture first.');
      return;
    }
    const notes = lectureToNotes(transcript, { title: 'Lecture notes' });
    setBuilt(notes);
    toast.success(`Built ${notes.composed.lines.length} note lines — nothing was invented.`);
  };

  const save = () => {
    if (!built) return;
    saveLectureNote(built.composed.title || 'Lecture notes', built.composed.lines);
    toast.success('Saved to My Notebooks');
    navigate('/notebooks');
  };

  const startStop = () => {
    if (dictation.isListening) {
      dictation.stop();
      return;
    }
    startedAt.current = Date.now();
    void dictation.start();
  };

  return (
    <div className="min-h-screen bg-[#F7F5FF] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5B4E8A] hover:text-[#3f2a63]"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <header className="rounded-2xl border border-violet-200/70 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-[#241a3d]">
                <Mic className="h-5 w-5 text-violet-600" /> Lecture mode
              </h1>
              <p className="mt-1 text-xs text-[#6b6486]">
                Record a lecture, then turn the transcript into structured notes. Audio is never
                stored and never leaves this device — only the text you see below is kept.
              </p>
            </div>
            <div className="rounded-xl bg-violet-50 px-3 py-2 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Recording</div>
              <div className="font-mono text-lg font-bold text-violet-800">{formatClock(elapsed)}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="lecture-record-btn"
              onClick={startStop}
              disabled={!dictation.isSupported}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition ${
                dictation.isListening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-violet-600 hover:bg-violet-700'
              } disabled:opacity-50`}
            >
              {dictation.isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {dictation.isListening ? 'Stop recording' : 'Start recording'}
            </button>
            <span className="text-xs text-[#6b6486]">
              {dictation.isListening ? 'Listening…' : `${words} words · ~${estimateSpokenMinutes(words)} min`}
            </span>
            {dictation.interimTranscript && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                {dictation.interimTranscript}
              </span>
            )}
          </div>

          {!dictation.isSupported && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              This browser has no speech recognition. You can still paste a transcript below.
            </p>
          )}
          {dictation.errorMessage && (
            <p className="mt-2 text-xs font-medium text-amber-700">{dictation.errorMessage}</p>
          )}
        </header>

        <section className="rounded-2xl border border-violet-200/70 bg-white p-4 shadow-sm">
          <label htmlFor="lecture-transcript" className="text-xs font-bold uppercase tracking-wide text-[#8B7FB0]">
            Transcript
          </label>
          <textarea
            id="lecture-transcript"
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={6}
            placeholder="Speak, or paste a transcript here…"
            className="mt-1 w-full resize-y rounded-xl border border-violet-200 bg-[#FBFAFF] px-3 py-2 text-sm text-[#241a3d] focus:border-violet-400 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={build}
              data-testid="lecture-build-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#241a3d] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#322452]"
            >
              <Sparkles className="h-3.5 w-3.5" /> Turn into notes
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(transcript);
                toast.success('Transcript copied');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2 text-xs font-semibold text-[#5B4E8A] hover:bg-violet-50"
            >
              <ClipboardCopy className="h-3.5 w-3.5" /> Copy transcript
            </button>
            {transcript && (
              <button
                type="button"
                onClick={() => { setTranscript(''); setBuilt(null); setElapsed(0); }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {built && (
          <section className="rounded-2xl border border-violet-200/70 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[#241a3d]">
                <ListChecks className="h-4 w-4 text-violet-600" /> {built.composed.title || 'Lecture notes'}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#6b6486]">
                <span className="rounded-full bg-violet-50 px-2 py-0.5">{built.headings} headings</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{built.bullets} points</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">{built.wordCount} words</span>
              </div>
            </div>

            <ul className="mt-3 space-y-1.5">
              {built.composed.lines.slice(0, 60).map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#2b2344]">
                  <span className="mt-0.5 w-[74px] shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#a79fc0]">
                    {BLOCK_LABEL[line.blockType] || 'Line'}
                  </span>
                  <span className={line.blockType === 'h2' ? 'font-bold' : line.blockType === 'h3' ? 'font-semibold' : ''}>
                    {line.text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                data-testid="lecture-save-btn"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-3.5 py-2 text-xs font-bold text-white"
              >
                <NotebookPen className="h-3.5 w-3.5" /> Save as note
              </button>
              <Link
                to="/notebooks"
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2 text-xs font-semibold text-[#5B4E8A] hover:bg-violet-50"
              >
                <FileText className="h-3.5 w-3.5" /> Open notebooks
              </Link>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#6b6486]">
                <Check className="h-3 w-3 text-emerald-600" /> Generated from your transcript only
              </span>
            </div>
          </section>
        )}

        <p className="px-1 text-[11px] leading-relaxed text-[#8B7FB0]">
          Speech recognition uses your browser's engine. Some browsers send short audio clips to
          their own speech service; NikNote itself stores only the transcript text you see. Notes
          keep the structure cues the speaker gave — headings and bullets are never invented.
        </p>
      </div>
    </div>
  );
}
