// ============================================================
// NikNote PDF Tools — the companion page to PDF Studio
// Merge · Split · Compress · Watermark · Page numbers · Images → PDF
// Word · Excel · OCR (searchable PDF) · Protect / Unlock
// One screen, mobile first, everything processed on the device.
// ============================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, Combine, Download, FileSpreadsheet, FileText,
  FileType2, Hash, ImagePlus, KeyRound, Loader2, Lock, Minimize2, ScanText, Scissors,
  Share2, Sparkles, Stamp, Trash2, Unlock, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { saveFile } from '@/lib/saveFile';
import { OCR_LANGUAGE_LABEL, ocrEstimateLabel, type OcrLanguage, type OcrQuality } from '@/lib/pdfOcrMath';
import type { OcrProgress } from '@/lib/pdfOcr';
import { validatePassword } from '@/lib/pdfSecurity';
import {
  PAPER_LABELS, type PaperKey, type PageNumberPosition, type SplitMode, type WatermarkPosition,
  addPageNumbers, addWatermark, detectImageType, extractPages, formatBytes, imagesToPdf,
  inspectPdf, mergePdfs, outputName, pagesLabel, parsePageRanges, splitPlan,
} from '@/lib/pdfTools';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type PdfPick = { id: string; name: string; bytes: Uint8Array; pages: number; locked?: boolean };
type ImagePick = { id: string; name: string; bytes: Uint8Array; type: 'png' | 'jpg'; size: number };
type Result = { name: string; bytes: Uint8Array };

const uid = () => Math.random().toString(36).slice(2, 10);

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function OptionChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-[color:hsl(var(--accent-rose-hsl)/0.36)] bg-primary text-white shadow-sm'
          : 'border-border/70 bg-background/60 text-muted-foreground hover:border-[color:hsl(var(--accent-rose-hsl)/0.6)] hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function usePdfPicker(multiple: boolean, onLoaded: (files: PdfPick[]) => void) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const open = () => inputRef.current?.click();

  const element = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      multiple={multiple}
      className="hidden"
      onChange={async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (files.length === 0) return;
        setBusy(true);
        try {
          const loaded: PdfPick[] = [];
          for (const file of multiple ? files : files.slice(0, 1)) {
            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              const info = await inspectPdf(bytes);
              loaded.push({ id: uid(), name: file.name, bytes, pages: info.pages, locked: info.encrypted });
              if (info.encrypted) toast.info(`${file.name} password-protected hai — Unlock tool use karo`);
            } catch {
              toast.error(`${file.name} khul nahi paya — file corrupt lagti hai`);
            }
          }
          if (loaded.length > 0) onLoaded(loaded);
        } catch {
          toast.error('File padhne me problem aayi');
        } finally {
          setBusy(false);
        }
      }}
    />
  );

  return { open, element, busy };
}

function FileRow({
  name, meta, onRemove, leading,
}: { name: string; meta: string; onRemove?: () => void; leading?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
      {leading ?? <FileText className="h-5 w-5 shrink-0 text-accent-rose" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-[11px] text-muted-foreground">{meta}</p>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${name}`}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

function DropZone({
  onClick, busy, title, subtitle, icon: Icon = Upload,
}: { onClick: () => void; busy?: boolean; title: string; subtitle: string; icon?: React.FC<{ className?: string }> }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-[color:hsl(var(--accent-rose-hsl)/0.7)] bg-[color:hsl(var(--accent-rose-hsl)/0.4)] px-4 py-7 text-center transition hover:border-[color:hsl(var(--accent-rose-hsl)/0.36)] hover:bg-[color:hsl(var(--accent-rose-hsl)/0.7)] dark:border-[color:hsl(var(--accent-rose-hsl)/0.3)] dark:bg-primary/5 dark:hover:bg-primary/10"
    >
      {busy ? <Loader2 className="h-6 w-6 animate-spin text-accent-rose" /> : <Icon className="h-6 w-6 text-accent-rose" />}
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{subtitle}</span>
    </button>
  );
}

function ResultCard({ result, extra, mime = 'application/pdf' }: { result: Result; extra?: string; mime?: string }) {
  const [saving, setSaving] = useState(false);

  const share = async (mode: 'save' | 'share') => {
    setSaving(true);
    try {
      const outcome = await saveFile(result.bytes, result.name, mime);
      if (outcome === 'cancelled') toast.info('Cancel kar diya');
      else toast.success(mode === 'share' ? 'Share sheet khul gaya' : `${result.name} ready hai`);
    } catch {
      toast.error('Save nahi ho paya — dobara try karo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-[color:hsl(var(--success)/0.5)] bg-[color:hsl(var(--success)/0.6)] p-3 dark:bg-success/10">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{result.name}</p>
        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(result.bytes.byteLength)}</span>
      </div>
      {extra ? <p className="mt-1 text-xs text-success dark:text-success">{extra}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => share('save')} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Save PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => share('share')} disabled={saving} className="gap-1.5">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>
    </div>
  );
}

// ── 1. Merge ────────────────────────────────────────────────

function MergePanel() {
  const [files, setFiles] = useState<PdfPick[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const picker = usePdfPicker(true, (loaded) => {
    setFiles((prev) => [...prev, ...loaded]);
    setResult(null);
  });

  const move = (index: number, delta: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const run = async () => {
    if (files.length < 2) {
      toast.error('Kam se kam 2 PDF chahiye');
      return;
    }
    setBusy(true);
    try {
      const bytes = await mergePdfs(files.map((f) => f.bytes));
      const { pages } = await inspectPdf(bytes);
      setResult({
        name: outputName(files[0].name, 'merged'),
        bytes,
      });
      toast.success(`${files.length} PDF jud gaye · ${pages} pages`);
    } catch (err: any) {
      toast.error(err?.message || 'Merge fail ho gaya');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {picker.element}
      <DropZone onClick={picker.open} busy={picker.busy} title="PDF add karo" subtitle="2 ya zyada PDF · order badal sakte ho" />
      {files.length > 0 ? (
        <Card className="space-y-2">
          {files.map((file, index) => (
            <FileRow
              key={file.id}
              name={`${index + 1}. ${file.name}`}
              meta={`${file.pages} pages · ${formatBytes(file.bytes.byteLength)}`}
              onRemove={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
              leading={
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => move(index, -1)} className="text-muted-foreground hover:text-foreground" aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} className="text-muted-foreground hover:text-foreground" aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              }
            />
          ))}
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Combine className="h-4 w-4" />}
            Merge {files.length} PDFs
          </Button>
        </Card>
      ) : null}
      {result ? <ResultCard result={result} /> : null}
    </div>
  );
}

// ── 2. Split ────────────────────────────────────────────────

function SplitPanel() {
  const [file, setFile] = useState<PdfPick | null>(null);
  const [mode, setMode] = useState<SplitMode>('ranges');
  const [chunkSize, setChunkSize] = useState(2);
  const [ranges, setRanges] = useState('1-2, 3-5');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const picker = usePdfPicker(false, (loaded) => {
    if (!loaded[0]) return;
    setFile(loaded[0]);
    setResults(null);
  });

  const plan = useMemo(() => {
    if (!file) return [];
    return splitPlan(mode, file.pages, { chunkSize, ranges });
  }, [file, mode, chunkSize, ranges]);

  const run = async () => {
    if (!file) return;
    if (plan.length === 0) {
      toast.error('Page range sahi likho, jaise 1-3, 4-6');
      return;
    }
    setBusy(true);
    try {
      const out: Result[] = [];
      for (const pages of plan) {
        const bytes = await extractPages(file.bytes, pages);
        out.push({ name: outputName(file.name, `p${pagesLabel(pages).replace(/[,\s]+/g, '_')}`), bytes });
      }
      setResults(out);
      toast.success(`${out.length} file${out.length > 1 ? 's' : ''} ready`);
    } catch (err: any) {
      toast.error(err?.message || 'Split fail ho gaya');
    } finally {
      setBusy(false);
    }
  };

  const saveAll = async () => {
    if (!results) return;
    for (const item of results) {
      await saveFile(item.bytes, item.name, 'application/pdf');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    toast.success('Saari files save ho gayi');
  };

  return (
    <div className="space-y-3">
      {picker.element}
      {!file ? (
        <DropZone onClick={picker.open} busy={picker.busy} title="PDF chuno" subtitle="Pages alag-alag files me todo" icon={Scissors} />
      ) : (
        <>
          <Card className="space-y-3">
            <FileRow name={file.name} meta={`${file.pages} pages`} onRemove={() => { setFile(null); setResults(null); }} />
            <Field label="Kaise todo?">
              <div className="flex flex-wrap gap-2">
                <OptionChip active={mode === 'ranges'} onClick={() => setMode('ranges')}>Custom ranges</OptionChip>
                <OptionChip active={mode === 'chunks'} onClick={() => setMode('chunks')}>Har N pages</OptionChip>
                <OptionChip active={mode === 'each'} onClick={() => setMode('each')}>Har page alag</OptionChip>
              </div>
            </Field>
            {mode === 'ranges' ? (
              <Field label="Ranges" hint="Har comma group ek alag PDF banega. Example: 1-3, 4-6, 9">
                <Input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 4-6" />
              </Field>
            ) : null}
            {mode === 'chunks' ? (
              <Field label="Pages per file">
                <Input
                  type="number"
                  min={1}
                  max={file.pages}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {plan.length > 0
                ? `${plan.length} file banengi · ${plan.map((p) => pagesLabel(p)).join(' | ')}`
                : 'Koi valid page nahi mila'}
            </p>
            <Button onClick={run} disabled={busy || plan.length === 0} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
              Split karo
            </Button>
          </Card>
          {results ? (
            <Card className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{results.length} files ready</p>
                <Button size="sm" variant="outline" onClick={saveAll} className="gap-1.5">
                  <Download className="h-4 w-4" /> Save all
                </Button>
              </div>
              {results.map((item) => (
                <ResultCard key={item.name} result={item} />
              ))}
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

// ── 3. Compress ─────────────────────────────────────────────

function CompressPanel() {
  const [file, setFile] = useState<PdfPick | null>(null);
  const [quality, setQuality] = useState<'tiny' | 'balanced' | 'sharp'>('balanced');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ name: string; bytes: Uint8Array; before: number; after: number } | null>(null);
  const picker = usePdfPicker(false, (loaded) => {
    if (!loaded[0]) return;
    setFile(loaded[0]);
    setResult(null);
  });

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ done: 0, total: file.pages });
    try {
      const { compressPdf } = await import('@/lib/pdfCompress');
      const out = await compressPdf(file.bytes, {
        quality,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult({ name: outputName(file.name, 'compressed'), ...out });
      const saved = out.before > 0 ? Math.round((1 - out.after / out.before) * 100) : 0;
      toast.success(saved > 0 ? `${saved}% chhota ho gaya` : 'File ready hai (already optimized)');
    } catch (err: any) {
      toast.error(err?.message || 'Compress fail ho gaya');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const savedPercent = result && result.before > 0
    ? Math.round((1 - result.after / result.before) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {picker.element}
      {!file ? (
        <DropZone onClick={picker.open} busy={picker.busy} title="PDF chuno" subtitle="Scans aur photos wali PDF sabse zyada chhoti hoti hai" icon={Minimize2} />
      ) : (
        <Card className="space-y-3">
          <FileRow name={file.name} meta={`${file.pages} pages · ${formatBytes(file.bytes.byteLength)}`} onRemove={() => { setFile(null); setResult(null); }} />
          <Field label="Quality">
            <div className="flex flex-wrap gap-2">
              <OptionChip active={quality === 'tiny'} onClick={() => setQuality('tiny')}>Smallest</OptionChip>
              <OptionChip active={quality === 'balanced'} onClick={() => setQuality('balanced')}>Balanced</OptionChip>
              <OptionChip active={quality === 'sharp'} onClick={() => setQuality('sharp')}>Sharper</OptionChip>
            </div>
          </Field>
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minimize2 className="h-4 w-4" />}
            {progress ? `Page ${progress.done}/${progress.total}…` : 'Compress karo'}
          </Button>
        </Card>
      )}
      {result ? (
        <ResultCard
          result={{ name: result.name, bytes: result.bytes }}
          extra={`${formatBytes(result.before)} → ${formatBytes(result.after)}${savedPercent > 0 ? ` · ${savedPercent}% saved` : ''}`}
        />
      ) : null}
    </div>
  );
}

// ── 4. Watermark ────────────────────────────────────────────

const WATERMARK_COLORS = ['#A62B36', '#7C5F9E', '#111827', '#16a34a', '#7C5F9E'];

function WatermarkPanel() {
  const [file, setFile] = useState<PdfPick | null>(null);
  const [text, setText] = useState('NikNote');
  const [position, setPosition] = useState<WatermarkPosition>('center');
  const [opacity, setOpacity] = useState(0.18);
  const [angle, setAngle] = useState(45);
  const [color, setColor] = useState(WATERMARK_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const picker = usePdfPicker(false, (loaded) => {
    if (!loaded[0]) return;
    setFile(loaded[0]);
    setResult(null);
  });

  const run = async () => {
    if (!file) return;
    if (!text.trim()) {
      toast.error('Watermark text likho');
      return;
    }
    setBusy(true);
    try {
      const bytes = await addWatermark(file.bytes, { text, position, opacity, angle, color });
      setResult({ name: outputName(file.name, 'watermark'), bytes });
      toast.success('Watermark lag gaya');
    } catch (err: any) {
      toast.error(err?.message || 'Watermark fail ho gaya');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {picker.element}
      {!file ? (
        <DropZone onClick={picker.open} busy={picker.busy} title="PDF chuno" subtitle="DRAFT / CONFIDENTIAL / apna naam — jo chahiye" icon={Stamp} />
      ) : (
        <Card className="space-y-3">
          <FileRow name={file.name} meta={`${file.pages} pages`} onRemove={() => { setFile(null); setResult(null); }} />
          <Field label="Text">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="DRAFT" maxLength={40} />
          </Field>
          <Field label="Style">
            <div className="flex flex-wrap gap-2">
              <OptionChip active={position === 'center'} onClick={() => setPosition('center')}>Center</OptionChip>
              <OptionChip active={position === 'tile'} onClick={() => setPosition('tile')}>Full page</OptionChip>
              <OptionChip active={position === 'top'} onClick={() => setPosition('top')}>Top</OptionChip>
              <OptionChip active={position === 'bottom'} onClick={() => setPosition('bottom')}>Bottom</OptionChip>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Opacity ${Math.round(opacity * 100)}%`}>
              <input
                type="range"
                min={5}
                max={60}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="w-full accent-rose-500"
              />
            </Field>
            <Field label={`Angle ${angle}°`}>
              <input
                type="range"
                min={0}
                max={90}
                step={15}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
            </Field>
          </div>
          <Field label="Color">
            <div className="flex gap-2">
              {WATERMARK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`h-7 w-7 rounded-full border-2 transition ${color === c ? 'border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
            Watermark lagao
          </Button>
        </Card>
      )}
      {result ? <ResultCard result={result} /> : null}
    </div>
  );
}

// ── 5. Page numbers ─────────────────────────────────────────

const NUMBER_POSITIONS: { id: PageNumberPosition; label: string }[] = [
  { id: 'bottom-center', label: 'Bottom center' },
  { id: 'bottom-right', label: 'Bottom right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'top-center', label: 'Top center' },
  { id: 'top-right', label: 'Top right' },
  { id: 'top-left', label: 'Top left' },
];

function PageNumberPanel() {
  const [file, setFile] = useState<PdfPick | null>(null);
  const [format, setFormat] = useState('Page {n} of {total}');
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [startAt, setStartAt] = useState(1);
  const [size, setSize] = useState(11);
  const [skipFirst, setSkipFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const picker = usePdfPicker(false, (loaded) => {
    if (!loaded[0]) return;
    setFile(loaded[0]);
    setResult(null);
  });

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const bytes = await addPageNumbers(file.bytes, { format, position, startAt, size, skipFirst });
      setResult({ name: outputName(file.name, 'numbered'), bytes });
      toast.success('Page numbers lag gaye');
    } catch (err: any) {
      toast.error(err?.message || 'Number lagane me dikkat aayi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {picker.element}
      {!file ? (
        <DropZone onClick={picker.open} busy={picker.busy} title="PDF chuno" subtitle="Assignments aur notes ko number do" icon={Hash} />
      ) : (
        <Card className="space-y-3">
          <FileRow name={file.name} meta={`${file.pages} pages`} onRemove={() => { setFile(null); setResult(null); }} />
          <Field label="Format" hint="{n} = page number, {total} = total pages">
            <Input value={format} onChange={(e) => setFormat(e.target.value)} maxLength={40} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start at">
              <Input type="number" min={0} value={startAt} onChange={(e) => setStartAt(Number(e.target.value) || 1)} />
            </Field>
            <Field label="Font size">
              <Input type="number" min={6} max={36} value={size} onChange={(e) => setSize(Math.min(36, Math.max(6, Number(e.target.value) || 11)))} />
            </Field>
          </div>
          <Field label="Position">
            <div className="flex flex-wrap gap-2">
              {NUMBER_POSITIONS.map((item) => (
                <OptionChip key={item.id} active={position === item.id} onClick={() => setPosition(item.id)}>
                  {item.label}
                </OptionChip>
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skipFirst} onChange={(e) => setSkipFirst(e.target.checked)} className="accent-rose-500" />
            Pehle page (cover) par number mat lagao
          </label>
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
            Numbers lagao
          </Button>
        </Card>
      )}
      {result ? <ResultCard result={result} /> : null}
    </div>
  );
}

// ── 6. Images → PDF ─────────────────────────────────────────

function ImagesPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<ImagePick[]>([]);
  const [paper, setPaper] = useState<PaperKey>('a4');
  const [margin, setMargin] = useState(24);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const addImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    const loaded: ImagePick[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type = detectImageType(bytes);
      if (!type) {
        toast.error(`${file.name} PNG/JPG nahi hai — skip kiya`);
        continue;
      }
      loaded.push({ id: uid(), name: file.name, bytes, type, size: bytes.byteLength });
    }
    if (loaded.length > 0) {
      setImages((prev) => [...prev, ...loaded]);
      setResult(null);
    }
  };

  const move = (index: number, delta: number) => {
    setImages((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const run = async () => {
    if (images.length === 0) return;
    setBusy(true);
    try {
      const bytes = await imagesToPdf(
        images.map((image) => ({ bytes: image.bytes, type: image.type })),
        { paper, margin, title: 'NikNote images' }
      );
      setResult({ name: outputName(images[0].name, 'images'), bytes });
      toast.success(`${images.length} image → PDF ready`);
    } catch (err: any) {
      toast.error(err?.message || 'PDF banane me dikkat aayi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple className="hidden" onChange={addImages} />
      <DropZone onClick={() => inputRef.current?.click()} title="Photos chuno" subtitle="JPG / PNG · assignments, ID card, notes ki photos" icon={ImagePlus} />
      {images.length > 0 ? (
        <Card className="space-y-2">
          {images.map((image, index) => (
            <FileRow
              key={image.id}
              name={`${index + 1}. ${image.name}`}
              meta={`${image.type.toUpperCase()} · ${formatBytes(image.size)}`}
              onRemove={() => setImages((prev) => prev.filter((i) => i.id !== image.id))}
              leading={
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => move(index, -1)} className="text-muted-foreground hover:text-foreground" aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} className="text-muted-foreground hover:text-foreground" aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              }
            />
          ))}
          <Field label="Page size">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PAPER_LABELS) as PaperKey[]).map((key) => (
                <OptionChip key={key} active={paper === key} onClick={() => setPaper(key)}>
                  {PAPER_LABELS[key]}
                </OptionChip>
              ))}
            </div>
          </Field>
          <Field label={`Margin ${margin}pt`}>
            <input type="range" min={0} max={72} step={4} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full accent-rose-500" />
          </Field>
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {images.length} image → PDF
          </Button>
        </Card>
      ) : null}
      {result ? <ResultCard result={result} /> : null}
    </div>
  );
}

// ── 7. PDF → Word ──────────────────────────────────────────

function WordPanel() {
  const [file, setFile] = useState<PdfPick | null>(null);
  const [pageBreaks, setPageBreaks] = useState(true);
  const [detectHeadings, setDetectHeadings] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const picker = usePdfPicker(false, (loaded) => {
    if (!loaded[0]) return;
    setFile(loaded[0]);
    setResult(null);
  });

  const run = async () => {
    if (!file) return;
    if (file.locked) {
      toast.error('Ye PDF password-protected hai — pehle Unlock karo');
      return;
    }
    setBusy(true);
    try {
      const { pdfToDocx } = await import('@/lib/pdfConvert');
      const bytes = await pdfToDocx(file.bytes, {
        title: file.name.replace(/\.pdf$/i, ''),
        pageBreaks,
        detectHeadings,
      });
      setResult({ name: outputName(file.name, 'word', 'docx'), bytes });
      toast.success('Word file ready — .docx download karo');
    } catch (err: any) {
      toast.error(err?.message || 'Word banane me dikkat aayi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {picker.element}
      {!file ? (
        <DropZone onClick={picker.open} busy={picker.busy} title="PDF chuno" subtitle="Text wali PDF → editable Word file" icon={FileType2} />
      ) : (
        <Card className="space-y-3">
          <FileRow
            name={file.name}
            meta={`${file.pages} pages${file.locked ? ' · password-protected' : ''}`}
            onRemove={() => { setFile(null); setResult(null); }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pageBreaks} onChange={(e) => setPageBreaks(e.target.checked)} className="accent-rose-500" />
            Har PDF page ke baad Word me page break
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={detectHeadings} onChange={(e) => setDetectHeadings(e.target.checked)} className="accent-rose-500" />
            Bade text ko heading banao (auto-detect)
          </label>
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType2 className="h-4 w-4" />}
            Word (.docx) banao
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Text, headings aur page order save hote hain. Photos/graphics Word me nahi aate — uske liye PDF Studio use karo.
          </p>
        </Card>
      )}
      {result ? <ResultCard result={result} mime={DOCX_MIME} /> : null}
    </div>
  );
}

// ── 8. PDF → Excel ─────────────────────────────────────────

function ExcelPanel() {
  const [file, setFile] = useState<PdfPick | null>(null);
  const [perPage, setPerPage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const picker = usePdfPicker(false, (loaded) => {
    if (!loaded[0]) return;
    setFile(loaded[0]);
    setResult(null);
  });

  const run = async () => {
    if (!file) return;
    if (file.locked) {
      toast.error('Ye PDF password-protected hai — pehle Unlock karo');
      return;
    }
    setBusy(true);
    try {
      const { pdfToXlsx } = await import('@/lib/pdfConvert');
      const bytes = await pdfToXlsx(file.bytes, { perPage });
      setResult({ name: outputName(file.name, 'excel', 'xlsx'), bytes });
      toast.success('Excel file ready — .xlsx download karo');
    } catch (err: any) {
      toast.error(err?.message || 'Excel banane me dikkat aayi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {picker.element}
      {!file ? (
        <DropZone onClick={picker.open} busy={picker.busy} title="PDF chuno" subtitle="Tables / list wali PDF → Excel sheet" icon={FileSpreadsheet} />
      ) : (
        <Card className="space-y-3">
          <FileRow
            name={file.name}
            meta={`${file.pages} pages${file.locked ? ' · password-protected' : ''}`}
            onRemove={() => { setFile(null); setResult(null); }}
          />
          <Field label="Sheet layout" hint="Column wale gaps se cells banti hain — tables seedha Excel me aate hain">
            <div className="flex flex-wrap gap-2">
              <OptionChip active={perPage} onClick={() => setPerPage(true)}>Har page = alag sheet</OptionChip>
              <OptionChip active={!perPage} onClick={() => setPerPage(false)}>Sab kuch ek sheet me</OptionChip>
            </div>
          </Field>
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel (.xlsx) banao
          </Button>
        </Card>
      )}
      {result ? <ResultCard result={result} mime={XLSX_MIME} /> : null}
    </div>
  );
}

// ── 9. OCR → searchable PDF ────────────────────────────────

function OcrPanel() {
  const [file, setFile] = useState<PdfPick | null>(null);
  const [language, setLanguage] = useState<OcrLanguage>('eng');
  const [quality, setQuality] = useState<OcrQuality>('balanced');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [result, setResult] = useState<{ name: string; bytes: Uint8Array; words: number } | null>(null);
  const picker = usePdfPicker(false, (loaded) => {
    if (!loaded[0]) return;
    setFile(loaded[0]);
    setResult(null);
  });

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setProgress({ stage: 'model', label: 'Shuru ho raha hai…', done: 0, total: file.pages || 1 });
    try {
      const { ocrToSearchablePdf } = await import('@/lib/pdfOcr');
      const out = await ocrToSearchablePdf(file.bytes, {
        language,
        quality,
        onProgress: (next) => setProgress(next),
      });
      setResult({ name: outputName(file.name, 'searchable'), bytes: out.bytes, words: out.words });
      toast.success(`${out.words} words ka searchable layer ban gaya`);
    } catch (err: any) {
      toast.error(err?.message || 'OCR fail ho gaya');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-3">
      {picker.element}
      {!file ? (
        <DropZone onClick={picker.open} busy={picker.busy} title="Scan / photo PDF chuno" subtitle="Text layer add karke search + copy yogya banao" icon={ScanText} />
      ) : (
        <Card className="space-y-3">
          <FileRow
            name={file.name}
            meta={`${file.pages} pages${file.locked ? ' · password-protected' : ''}`}
            onRemove={() => { setFile(null); setResult(null); }}
          />
          <Field label="Language" hint="Hindi pages ke liye दोनों चुनो — thoda slow hota hai">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OCR_LANGUAGE_LABEL) as OcrLanguage[]).map((code) => (
                <OptionChip key={code} active={language === code} onClick={() => setLanguage(code)}>
                  {OCR_LANGUAGE_LABEL[code]}
                </OptionChip>
              ))}
            </div>
          </Field>
          <Field label="Quality">
            <div className="flex flex-wrap gap-2">
              <OptionChip active={quality === 'fast'} onClick={() => setQuality('fast')}>Fast</OptionChip>
              <OptionChip active={quality === 'balanced'} onClick={() => setQuality('balanced')}>Balanced</OptionChip>
              <OptionChip active={quality === 'best'} onClick={() => setQuality('best')}>Best</OptionChip>
            </div>
          </Field>
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
            {busy ? 'OCR chal raha hai…' : 'Searchable PDF banao'}
          </Button>
          {progress ? (
            <div className="space-y-1.5 rounded-2xl border border-border/60 bg-background/60 p-3">
              <p className="text-xs font-medium">{progress.label}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.round(
                      (progress.stage === 'page'
                        ? Math.min(1, progress.done / Math.max(1, progress.total)) * 0.95
                        : progress.stage === 'build'
                          ? 0.98
                          : (progress.progress || 0) * 0.15) * 100
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pehli baar model download hota hai (~10 MB), uske baad offline chalta hai. Tab band mat karo.
              </p>
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Anumanit samay: {ocrEstimateLabel(file.pages || 1, quality)} · asli PDF same dikhegi, bas usme text add ho jayega.
          </p>
        </Card>
      )}
      {result ? (
        <ResultCard result={{ name: result.name, bytes: result.bytes }} extra={`${result.words} words searchable`} />
      ) : null}
    </div>
  );
}

// ── 10. Protect / Unlock ───────────────────────────────────

function ProtectPanel() {
  const [file, setFile] = useState<PdfPick | null>(null);
  const [mode, setMode] = useState<'protect' | 'unlock'>('protect');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const picker = usePdfPicker(false, (loaded) => {
    if (!loaded[0]) return;
    setFile(loaded[0]);
    setMode(loaded[0].locked ? 'unlock' : 'protect');
    setResult(null);
  });

  const run = async () => {
    if (!file) return;
    const problem = validatePassword(password, mode === 'protect' ? confirm : undefined);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const { protectPdf, unlockPdf } = await import('@/lib/pdfSecurity');
      if (mode === 'protect') {
        const bytes = await protectPdf(file.bytes, { userPassword: password, allowPrinting, allowCopying });
        setResult({ name: outputName(file.name, 'protected'), bytes });
        toast.success('PDF password se lock ho gayi (AES-256)');
      } else {
        const bytes = await unlockPdf(file.bytes, password);
        setResult({ name: outputName(file.name, 'unlocked'), bytes });
        toast.success('Password hata diya — PDF ab bina password khulegi');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Kaam nahi bana — dobara try karo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {picker.element}
      {!file ? (
        <DropZone onClick={picker.open} busy={picker.busy} title="PDF chuno" subtitle="Password lagao (protect) ya hatao (unlock)" icon={Lock} />
      ) : (
        <Card className="space-y-3">
          <FileRow
            name={file.name}
            meta={`${file.pages} pages${file.locked ? ' · 🔒 password-protected' : ''}`}
            onRemove={() => { setFile(null); setResult(null); setPassword(''); setConfirm(''); }}
          />
          <Field label="Kya karna hai?">
            <div className="flex flex-wrap gap-2">
              <OptionChip active={mode === 'protect'} onClick={() => setMode('protect')}>🔒 Protect (password lagao)</OptionChip>
              <OptionChip active={mode === 'unlock'} onClick={() => setMode('unlock')}>🔓 Unlock (password hatao)</OptionChip>
            </div>
          </Field>
          <Field
            label={mode === 'protect' ? 'Naya password' : 'Purana password'}
            hint={mode === 'protect' ? 'Kam se kam 4 characters — yaad rakhna, reset nahi hota' : 'Jo password PDF kholne me lagta hai'}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </Field>
          {mode === 'protect' ? (
            <>
              <Field label="Password dobara">
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••" autoComplete="new-password" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowPrinting} onChange={(e) => setAllowPrinting(e.target.checked)} className="accent-rose-500" />
                Printing allowed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allowCopying} onChange={(e) => setAllowCopying(e.target.checked)} className="accent-rose-500" />
                Text copy allowed
              </label>
            </>
          ) : null}
          <Button onClick={run} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'protect' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {mode === 'protect' ? 'Password lagao' : 'Password hatao'}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Encryption AES-256 (PDF 2.0 standard) — Acrobat, Chrome, iPhone, Android sab support karte hain. Sab kuch device par hota hai.
          </p>
        </Card>
      )}
      {result ? <ResultCard result={result} /> : null}
    </div>
  );
}

// ── page shell ──────────────────────────────────────────────

const TABS = [
  { id: 'merge', label: 'Merge', icon: Combine, Panel: MergePanel },
  { id: 'split', label: 'Split', icon: Scissors, Panel: SplitPanel },
  { id: 'compress', label: 'Compress', icon: Minimize2, Panel: CompressPanel },
  { id: 'word', label: 'Word', icon: FileType2, Panel: WordPanel },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet, Panel: ExcelPanel },
  { id: 'ocr', label: 'OCR', icon: ScanText, Panel: OcrPanel },
  { id: 'protect', label: 'Protect', icon: KeyRound, Panel: ProtectPanel },
  { id: 'watermark', label: 'Watermark', icon: Stamp, Panel: WatermarkPanel },
  { id: 'numbers', label: 'Page numbers', icon: Hash, Panel: PageNumberPanel },
  { id: 'images', label: 'Images → PDF', icon: ImagePlus, Panel: ImagesPanel },
] as const;

export default function PdfTools() {
  const [tab, setTab] = useState<string>('merge');
  const active = TABS.find((item) => item.id === tab) || TABS[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-nk-rose/10 via-background to-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            to="/hub"
            className="grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-card/80 text-muted-foreground transition hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">PDF Tools</h1>
            <p className="truncate text-[11px] text-muted-foreground">Merge · Split · Compress · Word · Excel · OCR · Protect</p>
          </div>
          <Link
            to="/pdf-editor"
            className="rounded-full border border-[color:hsl(var(--accent-rose-hsl)/0.5)] bg-primary/10 px-3 py-1.5 text-xs font-semibold text-accent-rose transition hover:bg-primary/20 dark:text-accent-rose"
          >
            Edit & sign
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-rose" />
          <p>
            Sab kuch tumhare phone me hi hota hai — koi file upload nahi hoti. Merge, split, compress,
            Word, Excel, watermark aur password sab <strong className="font-semibold">offline</strong> chalte hain;
            sirf OCR ko pehli baar model download karne ke liye internet chahiye. Bade PDF par thoda time lagega,
            tab band mat karo.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-1.5 rounded-xl px-3 py-1.5 text-xs data-[state=active]:bg-background">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map(({ id, Panel }) => (
            <TabsContent key={id} value={id} className="mt-0">
              <Panel />
            </TabsContent>
          ))}
        </Tabs>

        <Card className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Iske baad</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Link to="/pdf-editor" className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm transition hover:border-[color:hsl(var(--accent-rose-hsl)/0.6)]">
              <span className="font-semibold">PDF Studio</span>
              <span className="block text-[11px] text-muted-foreground">Pen, signature, stamps, page edit</span>
            </Link>
            <Link to="/documents" className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm transition hover:border-[color:hsl(var(--accent-rose-hsl)/0.6)]">
              <span className="font-semibold">Documents</span>
              <span className="block text-[11px] text-muted-foreground">Scan → OCR → NikAI summary</span>
            </Link>
          </div>
        </Card>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Trash2 className="h-3 w-3" /> Files device se bahar nahi jaati
        </p>
      </main>
    </div>
  );
}
