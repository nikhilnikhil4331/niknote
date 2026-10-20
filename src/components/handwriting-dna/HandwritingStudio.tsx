// ============================================================
// Handwriting Studio — build reusable handwriting style profiles
// from a sample image, then convert PDF content into realistic
// handwritten A4 pages (preview + PDF download + insert to notes).
//
// Honest limits: the engine captures the *general character* of
// the sample (slant, pressure, size, rhythm, letterforms) and
// renders with a matching typeface + per-line/word variation.
// It is a close stylistic match — not a forensic replica of the
// person's writing, and it is never presented as one.
// ============================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Upload, PenLine, Trash2, FileText, Download, Loader2, Scan,
  Info, Check, Sparkles, NotebookPen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeHandwriting, DNA_PRESETS, findClosestPreset, type HandwritingDNA } from './HandwritingDNAEngine';
import { HandwrittenText } from '@/components/HandwrittenText';
import { DEFAULT_SETTINGS, type NoteSettings, type HandwritingFont, type InkColor } from '@/types/notes';
import { readPdf, type PdfPage } from '@/lib/pdfText';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { StructuredLine } from '@/lib/noteStructure';

// ── Profile store (localStorage) ──────────────────────────

export interface DNAProfile {
  id: string;
  name: string;
  dna: HandwritingDNA;
  thumb?: string;
  createdAt: number;
}

const PROFILES_KEY = 'niknote.dna.profiles.v1';

function loadProfiles(): DNAProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProfiles(list: DNAProfile[]) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
  } catch {
    /* storage full — drop thumbs and retry once */
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(list.map(p => ({ ...p, thumb: undefined }))));
    } catch { /* give up silently */ }
  }
}

// ── DNA → renderer mapping ────────────────────────────────

function fontForDna(dna: HandwritingDNA): HandwritingFont {
  if (dna.connectedness >= 75) return 'dancing-script';
  if (dna.loopiness >= 60 && dna.size <= 55) return 'indie-flower';
  if (dna.consistency >= 80 && dna.size <= 55) return 'kalam';
  if (dna.roundedness >= 65) return 'patrick-hand';
  if (dna.size >= 65) return 'architects-daughter';
  return 'caveat';
}

function settingsForDna(dna: HandwritingDNA): NoteSettings {
  const size = 16 + (dna.size / 100) * 14; // 16–30px
  const spacing = 2 + (dna.spacing / 100) * 6;
  const lineHeight = 24 + (dna.lineHeight / 100) * 18;
  return {
    ...DEFAULT_SETTINGS,
    font: fontForDna(dna),
    fontSize: Math.round(size),
    lineSpacing: Math.round(lineHeight),
    wordSpacing: Math.round(spacing),
    pageStyle: 'plain',
    inkColor: 'blue' as InkColor,
    baselineJitter: dna.consistency < 60,
    strokeRandomness: true,
  };
}

function dnaWordProps(dna: HandwritingDNA) {
  return {
    slant: dna.slant,
    penPressure: dna.penPressure ?? dna.pressure / 100,
    strokeThickness: dna.strokeThickness ?? 0.8 + dna.strokeWidth / 60,
    baselineJitterAmount: 1 + (100 - dna.consistency) / 40,
    letterSpacingVariation: (100 - dna.consistency) / 34 + Math.abs(dna.spacing - 50) / 60,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

async function makeThumb(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 140 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

// ── Component ─────────────────────────────────────────────

interface HandwritingStudioProps {
  onInsertStructured?: (lines: StructuredLine[]) => void;
  onUpdateDNA?: (dna: HandwritingDNA) => void;
  currentDNA?: HandwritingDNA;
}

type StudioTab = 'styles' | 'convert';

export const HandwritingStudio: React.FC<HandwritingStudioProps> = ({ onInsertStructured, onUpdateDNA, currentDNA }) => {
  const [tab, setTab] = useState<StudioTab>('styles');

  // ── Tab 1: styles ──
  const [sampleUrl, setSampleUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<HandwritingDNA | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profiles, setProfiles] = useState<DNAProfile[]>(() => loadProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // ── Tab 2: convert ──
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);
  const [pdfName, setPdfName] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [renderProfileId, setRenderProfileId] = useState<string>('current'); // 'current' = app style
  const [renderInk, setRenderInk] = useState<InkColor>('blue');
  const [downloading, setDownloading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || null;
  const renderProfile = renderProfileId === 'current'
    ? null
    : profiles.find(p => p.id === renderProfileId) || null;
  const renderDNA = renderProfile?.dna || currentDNA || DNA_PRESETS.neat_student;
  const renderSettings = useMemo<NoteSettings>(() => {
    const s = settingsForDna(renderDNA);
    return { ...s, inkColor: renderInk, pageStyle: 'ruled' };
  }, [renderDNA, renderInk]);
  const renderWordProps = useMemo(() => dnaWordProps(renderDNA), [renderDNA]);

  const totalPdfChars = pdfPages.reduce((t, p) => t + p.lines.join('').length, 0);

  // ── Style actions ──

  const handleSampleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image (photo of handwriting)'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Image is too large (max 8 MB)'); return; }
    try {
      const url = await fileToDataUrl(file);
      setSampleUrl(url);
      setAnalysis(null);
      setProfileName('');
    } catch {
      toast.error('Could not read that image');
    }
  };

  const handleAnalyze = async () => {
    if (!sampleUrl) { toast.error('Add a handwriting sample first'); return; }
    if (!consent) { toast.error('Please confirm you may use this handwriting sample'); return; }
    setAnalyzing(true);
    try {
      const dna = await analyzeHandwriting(sampleUrl);
      setAnalysis(dna);
      setProfileName(dna.styleName);
      const closest = findClosestPreset(dna);
      toast.success(`Style analysed — closest match: ${DNA_PRESETS[closest]?.styleName ?? dna.styleName}`);
    } catch (e) {
      console.error('analysis failed', e);
      toast.error('Analysis failed — try a clearer photo with good contrast');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!analysis) { toast.error('Analyse a sample first'); return; }
    const name = profileName.trim() || analysis.styleName;
    const thumb = await makeThumb(sampleUrl);
    const profile: DNAProfile = {
      id: `dna-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      dna: analysis,
      thumb,
      createdAt: Date.now(),
    };
    const next = [profile, ...profiles].slice(0, 12);
    setProfiles(next);
    saveProfiles(next);
    setActiveProfileId(profile.id);
    setRenderProfileId(profile.id);
    toast.success(`“${name}” saved to your styles`);
    setAnalysis(null);
    setSampleUrl('');
    setConsent(false);
  };

  const handleUseProfile = (p: DNAProfile) => {
    setActiveProfileId(p.id);
    setRenderProfileId(p.id);
    onUpdateDNA?.(p.dna);
    toast.success(`Notes now use “${p.name}” style`);
  };

  const handleDeleteProfile = (id: string) => {
    const next = profiles.filter(p => p.id !== id);
    setProfiles(next);
    saveProfiles(next);
    if (activeProfileId === id) setActiveProfileId(null);
    if (renderProfileId === id) setRenderProfileId('current');
    toast.info('Style deleted');
  };

  // ── Convert actions ──

  const handlePdfFile = async (file: File | undefined) => {
    if (!file) return;
    setPdfLoading(true);
    setPdfError('');
    setPdfPages([]);
    try {
      const { pages } = await readPdf(file, 12);
      const withText = pages.filter(p => p.lines.some(l => l.trim()));
      if (!withText.length) {
        setPdfError('No extractable text found in this PDF (scanned/image-only PDFs need OCR).');
      } else {
        setPdfPages(withText.slice(0, 8));
        setPdfName(file.name);
        toast.success(`Read ${withText.length} page${withText.length > 1 ? 's' : ''} from “${file.name}”`);
      }
    } catch (e) {
      console.error('pdf read failed', e);
      setPdfError('Could not read this PDF. It may be corrupted or password-protected.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleInsertToNotes = () => {
    if (!pdfPages.length) return;
    if (!onInsertStructured) { toast.error('Note editor is not ready'); return; }
    const structured: StructuredLine[] = pdfPages.flatMap(p =>
      p.lines
        .map(l => l.trim())
        .filter(Boolean)
        .map(text => ({ text, blockType: 'text' as const, color: 'blue' as const, indent: 0 }))
    );
    if (!structured.length) return;
    onInsertStructured(structured);
    toast.success(`${structured.length} lines inserted into your notes`);
  };

  const handleDownloadPdf = async () => {
    if (!pdfPages.length) return;
    setDownloading(true);
    try {
      // Wait for handwriting webfonts before snapshotting
      try { await document.fonts.ready; } catch { /* continue */ }
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      for (let i = 0; i < pdfPages.length; i++) {
        const el = exportRefs.current[i];
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false });
        const img = canvas.toDataURL('image/jpeg', 0.92);
        if (i > 0) doc.addPage('a4', 'portrait');
        doc.addImage(img, 'JPEG', 0, 0, 210, 297);
      }
      const base = (renderProfile?.name || 'handwriting').replace(/[^\w\- ]+/g, '').trim() || 'handwriting';
      doc.save(`${base}-a4.pdf`);
      toast.success('PDF downloaded (A4)');
    } catch (e) {
      console.error('pdf export failed', e);
      toast.error('PDF export failed — try again');
    } finally {
      setDownloading(false);
    }
  };

  // ── UI ──

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/50 p-1" role="tablist" aria-label="Handwriting Studio">
        {([['styles', 'My styles', PenLine], ['convert', 'Convert PDF', FileText]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'styles' ? (
          <motion.div
            key="styles"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-4"
          >
            {/* Sample upload */}
            <div className="rounded-xl border border-border/60 bg-white/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-foreground">1 · Handwriting sample</h4>
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px] gap-1.5" onClick={() => imgInputRef.current?.click()}>
                  <Upload className="w-3 h-3" /> {sampleUrl ? 'Replace photo' : 'Choose photo'}
                </Button>
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleSampleFile(e.target.files?.[0])}
                />
              </div>
              {sampleUrl ? (
                <img src={sampleUrl} alt="Handwriting sample" className="max-h-36 w-full object-contain rounded-lg border border-border/40 bg-white" />
              ) : (
                <button
                  onClick={() => imgInputRef.current?.click()}
                  className="w-full h-28 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
                >
                  <Scan className="w-5 h-5" />
                  <span className="text-[11px]">Photo of a few lines of handwriting (clear, straight, good light)</span>
                </button>
              )}
            </div>

            {/* Consent */}
            <label className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-white/50 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <span className="text-[11px] leading-snug text-muted-foreground">
                <strong className="text-foreground">Consent.</strong> This is my own handwriting, or I have the person's
                permission to create a style from it. I will not use this to impersonate anyone.
              </span>
            </label>

            <Button onClick={handleAnalyze} disabled={analyzing || !sampleUrl || !consent} className="gap-2">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzing ? 'Analysing rhythm & letterforms…' : 'Analyse handwriting'}
            </Button>

            {/* Analysis result */}
            {analysis && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{analysis.styleName}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{analysis.styleDescription}</p>
                  </div>
                  {analysis.confidence != null && (
                    <span className="flex-shrink-0 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                      {Math.round(analysis.confidence * 100)}% match
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ['Slant', Math.abs(analysis.slant)],
                    ['Pressure', analysis.pressure],
                    ['Size', analysis.size],
                    ['Flow', analysis.connectedness],
                  ].map(([label, v]) => (
                    <div key={label as string}>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{label}</span><span>{Math.round(v as number)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/70 mt-0.5 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(100, Math.max(4, v as number))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    placeholder="Style name (e.g. “Aarav’s notes”)"
                    className="flex-1 h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
                  />
                  <Button size="sm" onClick={handleSaveProfile} className="gap-1.5"><Check className="w-3.5 h-3.5" /> Save style</Button>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground flex items-start gap-1.5">
                  <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  This captures the general character of the sample — slant, pressure, size and rhythm — with a
                  matching typeface. It is a close stylistic match, not a forensic replica of the person's writing.
                </p>
              </motion.div>
            )}

            {/* Saved profiles */}
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">Your styles {profiles.length > 0 && <span className="text-muted-foreground font-normal">({profiles.length}/12)</span>}</h4>
              {profiles.length === 0 ? (
                <p className="text-[11px] text-muted-foreground rounded-xl border border-dashed border-border/60 p-4 text-center">
                  No saved styles yet — analyse a sample above to create one.
                </p>
              ) : (
                <ul className="space-y-2">
                  {profiles.map(p => (
                    <li key={p.id} className={`rounded-xl border p-2.5 flex items-center gap-2.5 ${activeProfileId === p.id ? 'border-primary/40 bg-primary/[0.04]' : 'border-border/60 bg-white/50'}`}>
                      {p.thumb ? (
                        <img src={p.thumb} alt="" className="w-12 h-12 rounded-lg object-cover border border-border/40 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0"><PenLine className="w-4 h-4 text-muted-foreground" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.dna.styleName} · {new Date(p.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => handleUseProfile(p)}>Use</Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" aria-label={`Delete ${p.name}`} onClick={() => handleDeleteProfile(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="convert"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-3"
          >
            {/* PDF upload */}
            <div className="rounded-xl border border-border/60 bg-white/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-foreground">1 · Upload PDF (text PDF)</h4>
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-[11px] gap-1.5" onClick={() => pdfInputRef.current?.click()}>
                  <Upload className="w-3 h-3" /> {pdfName ? 'Replace PDF' : 'Choose PDF'}
                </Button>
                <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => handlePdfFile(e.target.files?.[0])} />
              </div>
              {pdfLoading ? (
                <div className="h-20 flex items-center justify-center gap-2 text-muted-foreground text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Reading PDF offline in your browser…</div>
              ) : pdfError ? (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">{pdfError}</p>
              ) : pdfName ? (
                <p className="text-[11px] text-foreground">{pdfName} — <strong>{pdfPages.length}</strong> page{pdfPages.length !== 1 && 's'} with text, {totalPdfChars.toLocaleString()} characters</p>
              ) : (
                <button onClick={() => pdfInputRef.current?.click()} className="w-full h-20 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors">
                  <FileText className="w-5 h-5" />
                  <span className="text-[11px]">PDF is read locally — never uploaded</span>
                </button>
              )}
            </div>

            {/* Style + ink pickers */}
            {pdfPages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Style
                  <select
                    value={renderProfileId}
                    onChange={e => setRenderProfileId(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] max-w-[160px]"
                  >
                    <option value="current">Current note style</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  Ink
                  <select
                    value={renderInk}
                    onChange={e => setRenderInk(e.target.value as InkColor)}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-[11px]"
                  >
                    {(['blue', 'black', 'navy', 'red', 'green', 'purple', 'brown'] as InkColor[]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* A4 previews */}
            {pdfPages.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-foreground">2 · Handwritten A4 preview</h4>
                {pdfPages.map((page, i) => (
                  <div key={i} className="mx-auto max-w-[240px]">
                    <div ref={el => { exportRefs.current[i] = el; }} className="w-full">
                      <HandwrittenText
                        text={page.lines.join('\n')}
                        settings={renderSettings}
                        slant={renderWordProps.slant}
                        penPressure={renderWordProps.penPressure}
                        strokeThickness={renderWordProps.strokeThickness}
                        baselineJitterAmount={renderWordProps.baselineJitterAmount}
                        letterSpacingVariation={renderWordProps.letterSpacingVariation}
                      />
                    </div>
                    <p className="text-center text-[10px] text-muted-foreground mt-1">Page {i + 1}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {pdfPages.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={handleInsertToNotes} className="gap-1.5" disabled={!onInsertStructured}>
                  <NotebookPen className="w-3.5 h-3.5" /> Insert into notes
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={downloading} className="gap-1.5">
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {downloading ? 'Rendering…' : 'Download PDF (A4)'}
                </Button>
              </div>
            )}
            <p className="text-[10px] leading-snug text-muted-foreground flex items-start gap-1.5">
              <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
              Output follows the chosen style's rhythm and letterforms. Long documents fall back to a
              consistent base style for characters the sample didn't show — check the result before sharing.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HandwritingStudio;
