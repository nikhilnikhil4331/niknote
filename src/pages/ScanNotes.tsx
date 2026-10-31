// ============================================================
// Scan Handwriting — photo / screenshot → typed, editable note
//
// Flow: pick or click a photo of handwritten study notes ->
// read it (on-device OCR, free & offline after first model
// download — or NikAI for cursive) -> fix any line in the
// editor -> Save to notebook (Supabase) or on-device notebook
// for guests. The note lands as regular text blocks, so it can
// be edited, converted to handwriting, or exported like any
// other NikNote page.
// ============================================================

import React, { useRef, useState } from 'react';
import {
  ArrowLeft, Camera, Check, Copy, FileText, ImagePlus, Loader2,
  NotebookPen, ScanText, Sparkles, Trash2, X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { createBlock } from '@/types/block';
import {
  recognizeOnDevice,
  cleanOcrLines,
  titleFromLines,
  loadLocalScans,
  saveLocalScan,
  deleteLocalScan,
  type ScanLanguage,
  type SavedScan,
  type ScanSource,
} from '@/lib/scanOcr';
import { trackSaveNote } from '@/lib/tracking';

type Engine = 'device' | 'ai';

async function fileToScaledDataUrl(file: File, maxDim = 2000): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale >= 1) return dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export default function ScanNotes() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [preview, setPreview] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine>('device');
  const [language, setLanguage] = useState<ScanLanguage>('eng');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ label: string; value: number | null } | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ source: ScanSource; confidence: number | null } | null>(null);
  const [scans, setScans] = useState<SavedScan[]>(() => loadLocalScans());
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const isLocalGuest = !user || String(user.id || '').startsWith('local-guest-');

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Photo ya screenshot choose karo (image file)');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image 15 MB se chhoti rakho');
      return;
    }
    try {
      setPreview(await fileToScaledDataUrl(file));
      setText(null);
      setResultMeta(null);
      setEditingLocalId(null);
    } catch {
      toast.error('Image open nahi ho payi');
    }
  };

  const readWithAi = async (imageBase64: string): Promise<{ lines: string[]; confidence: number | null }> => {
    if (!session?.access_token) {
      toast.error('NikAI reading ke liye login chahiye — ya On-device OCR use karo');
      navigate('/login');
      throw new Error('login required');
    }
    const { data, error } = await supabase.functions.invoke('extract-handwriting-text', {
      body: { imageBase64, retryAttempt: 0 },
    });
    if (error) throw new Error(error.message || 'AI reading failed');
    if (!data?.success) throw new Error(data?.error || 'Text unclear hai — photo dobara lo');
    return {
      lines: cleanOcrLines((data.lines as string[]).join('\n')),
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
    };
  };

  const read = async () => {
    if (!preview || busy) return;
    setBusy(true);
    setProgress({ label: 'Shuru kar rahe hain…', value: null });
    try {
      let lines: string[];
      let confidence: number | null;
      if (engine === 'ai') {
        setProgress({ label: 'NikAI handwriting padh raha hai…', value: null });
        ({ lines, confidence } = await readWithAi(preview));
      } else {
        const res = await recognizeOnDevice(preview, language, (p) =>
          setProgress({ label: p.label, value: p.progress })
        );
        lines = res.lines;
        confidence = res.confidence;
      }
      if (lines.length === 0) {
        toast.warning('Koi text nahi mila — zyada roshni me seedhi photo try karo, ya NikAI engine chuno');
        setText('');
      } else {
        setText(lines.join('\n'));
        setTitle(titleFromLines(lines));
        toast.success(`${lines.filter((l) => l.trim()).length} lines padhi gayi — galti ho to neeche theek kar lo`);
      }
      setResultMeta({ source: engine === 'ai' ? 'ai' : 'device', confidence });
    } catch (err) {
      if ((err as Error)?.message !== 'login required') {
        toast.error((err as Error)?.message || 'Reading fail ho gayi — dobara try karo');
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const save = async () => {
    const lines = cleanOcrLines(text ?? '');
    if (lines.length === 0) {
      toast.error('Pehle kuch text padho ya likho');
      return;
    }
    const finalTitle = title.trim() || titleFromLines(lines);
    setSaving(true);
    try {
      if (!isLocalGuest && user) {
        const { data: nb, error: nbErr } = await supabase
          .from('notebooks')
          .insert({ user_id: user.id, title: finalTitle })
          .select()
          .single();
        if (nbErr) throw nbErr;
        const blocks = lines.filter((l) => l.trim()).map((l) => createBlock('text', l));
        const { error: pgErr } = await supabase.from('pages').insert([{
          user_id: user.id,
          notebook_id: nb.id,
          title: finalTitle,
          page_number: 1,
          content: blocks.length ? blocks : [createBlock('text', text ?? '')],
        }]);
        if (pgErr) throw pgErr;
        trackSaveNote({ featureName: 'scan_notes_ocr', conversionSource: 'scan_cloud_save', pageCount: 1 });
        toast.success('Notebook me save ho gaya — My Notebooks me milega');
        navigate('/notebooks');
        return;
      }
      throw new Error('local');
    } catch (err) {
      if ((err as Error)?.message !== 'local') console.warn('Notebook save fallback:', err);
      const entry = saveLocalScan({
        title: finalTitle,
        lines,
        source: resultMeta?.source ?? 'device',
      });
      setScans(loadLocalScans());
      setEditingLocalId(entry.id);
      trackSaveNote({ featureName: 'scan_notes_ocr', conversionSource: 'scan_device_save', pageCount: 1 });
      toast.success(isLocalGuest
        ? 'Is device ke notebook me save ho gaya (neeche list me hai) — login karne par cloud notebook banta hai'
        : 'Is device par save kar diya (network/account issue) — neeche list me hai');
    } finally {
      setSaving(false);
    }
  };

  const openLocal = (scan: SavedScan) => {
    setEditingLocalId(scan.id);
    setTitle(scan.title);
    setText(scan.lines.join('\n'));
    setResultMeta({ source: scan.source, confidence: null });
    setPreview(null);
  };

  const saveLocalEdits = () => {
    if (!editingLocalId) return;
    const lines = cleanOcrLines(text ?? '');
    setScans((prev) => {
      const next = prev.map((s) => (s.id === editingLocalId ? { ...s, title: title.trim() || s.title, lines } : s));
      try { localStorage.setItem('niknote.scans.v1', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    toast.success('Changes save ho gaye');
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
          <Link to="/hub" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold leading-tight">Scan Handwriting</h1>
            <p className="text-[11px] leading-tight text-muted-foreground">Photo / screenshot → typed, editable notebook page</p>
          </div>
          <Link to="/notebooks" className="ml-auto flex min-h-10 items-center gap-1.5 rounded-full border border-border px-3 text-[12px] font-semibold">
            <NotebookPen className="h-4 w-4" /> Notebooks
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 pb-16 pt-4 sm:px-4">
        {/* Picker */}
        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          {!preview ? (
            <div className="py-2 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-accent-rose">
                <ScanText className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold">Apne handwritten notes ki photo lo</p>
              <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                Seedhi, achhi roshni wali photo sabse sahi padhti hai. Text typed hokar
                notebook me save hoga — baad me kabhi bhi edit kar sakte ho.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button onClick={() => cameraRef.current?.click()} className="min-h-11 rounded-full px-5 font-semibold">
                  <Camera className="mr-2 h-4 w-4" /> Photo lo
                </Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="min-h-11 rounded-full px-5 font-semibold">
                  <ImagePlus className="mr-2 h-4 w-4" /> Gallery / screenshot
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="relative overflow-hidden rounded-2xl border border-border">
                <img src={preview} alt="Handwritten notes" className="max-h-[46dvh] w-full object-contain bg-surface" />
                <button type="button" aria-label="Remove photo" onClick={() => { setPreview(null); setText(null); setResultMeta(null); }}
                  className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-nk-midnight/60 text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Engine chooser */}
              <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Reading engine">
                <button type="button" role="radio" aria-checked={engine === 'device'} onClick={() => setEngine('device')}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${engine === 'device' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  <span className="flex items-center gap-1.5 text-[13px] font-bold"><ScanText className="h-4 w-4" /> On-device OCR</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">Muft, bina login. Saaf handwriting ke liye best. Pehli baar model download hota hai.</span>
                </button>
                <button type="button" role="radio" aria-checked={engine === 'ai'} onClick={() => setEngine('ai')}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${engine === 'ai' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                  <span className="flex items-center gap-1.5 text-[13px] font-bold"><Sparkles className="h-4 w-4" /> NikAI</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">Cursive / mili-juli handwriting ke liye best. Login + internet chahiye.</span>
                </button>
              </div>
              {engine === 'device' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11.5px] font-semibold text-muted-foreground">Language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value as ScanLanguage)} aria-label="OCR language"
                    className="min-h-9 rounded-full border border-border bg-card px-2.5 text-[12px] font-semibold">
                    <option value="eng">English / Hinglish (Roman)</option>
                    <option value="eng+hin">English + हिन्दी (Devanagari)</option>
                  </select>
                </div>
              )}

              <Button onClick={read} disabled={busy} className="mt-3 min-h-11 w-full rounded-full font-semibold">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                {busy ? 'Padh rahe hain…' : 'Read my handwriting'}
              </Button>
              {progress && (
                <div className="mt-2" role="status">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all"
                      style={{ width: progress.value === null ? '35%' : `${Math.round(progress.value * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{progress.label}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Result editor */}
        {text !== null && (
          <section className="mt-4 rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold">Typed notes</h2>
              {resultMeta && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-accent-rose">
                  {resultMeta.source === 'ai' ? 'NikAI' : 'On-device OCR'}
                  {resultMeta.confidence !== null ? ` · ${resultMeta.confidence}% sure` : ''}
                </span>
              )}
              <button type="button" className="ml-auto flex min-h-9 items-center gap-1 rounded-full border border-border px-2.5 text-[11.5px] font-semibold"
                onClick={() => { void navigator.clipboard?.writeText(text).then(() => toast.success('Text copy ho gaya')).catch(() => toast.error('Copy nahi ho paya')); }}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note ka title…"
              aria-label="Note title"
              className="mt-3 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))] focus:border-primary" />
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10}
              aria-label="Scanned text — yahan theek kar sakte ho"
              placeholder="Yahan typed text aayega — koi line galat padhi ho to yahin theek kar lo."
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] leading-relaxed outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))] focus:border-primary" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Har line alag block banegi — notebook me jaakar handwriting style bhi laga sakte ho.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving} className="min-h-11 flex-1 rounded-full font-semibold sm:flex-none sm:px-6">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save to notebook
              </Button>
              {editingLocalId && (
                <Button variant="outline" onClick={saveLocalEdits} className="min-h-11 rounded-full font-semibold">
                  Update saved copy
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Local scans */}
        {scans.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-bold">Is device par saved scans</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {scans.map((s) => (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-3">
                  <button type="button" onClick={() => openLocal(s)} className="block w-full text-left">
                    <p className="truncate text-[13px] font-bold">{s.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                      {s.lines.filter((l) => l.trim()).slice(0, 2).join(' · ') || '—'}
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' })} · {s.source === 'ai' ? 'NikAI' : 'OCR'} · tap karke edit karo
                    </p>
                  </button>
                  <button type="button" aria-label={`Delete ${s.title}`}
                    onClick={() => { deleteLocalScan(s.id); setScans(loadLocalScans()); if (editingLocalId === s.id) setEditingLocalId(null); }}
                    className="mt-2 flex min-h-9 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-hidden tabIndex={-1}
          onChange={(e) => { void onFile(e.target.files?.[0] || null); e.target.value = ''; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-hidden tabIndex={-1}
          onChange={(e) => { void onFile(e.target.files?.[0] || null); e.target.value = ''; }} />
      </main>
    </div>
  );
}
