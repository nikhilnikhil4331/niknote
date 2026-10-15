import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Camera, ChevronDown, ChevronUp, Circle, Copy, Eraser, Hand, Highlighter, ImagePlus, Lasso,
  Loader2, Mic, MousePointer2, Pause, Pencil, PenLine, Play, Plus, Redo2, RotateCw, Slash, Square, Square as StopIcon, Trash2, Type, Undo2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  BoardData, BoardItem, BoardPage, History, MARGIN, PAGE_PRESETS, PAPER_COLORS, Pattern, Stroke, StrokeTool, Tool,
  duplicatePage, emptyBoard, eraseAt, movePage, newPage, normalizeBoard, orient, paginateText, strokesInLasso, textCapacity, uid, validateImage,
} from '@/lib/board';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const COLORS = ['#1a1a2e', '#1565c0', '#d32f2f', '#2e7d32', '#7b1fa2', '#ef6c00', '#facc15'];
const clone = (d: BoardData): BoardData => JSON.parse(JSON.stringify(d));

function patternStyle(p: BoardPage): React.CSSProperties {
  const ink = p.bg === '#1f2430' ? 'rgba(255,255,255,.12)' : 'rgba(30,64,175,.14)';
  if (p.pattern === 'ruled') return { backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 31px, ${ink} 31px 32px)` };
  if (p.pattern === 'grid') return { backgroundImage: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, backgroundSize: '24px 24px' };
  if (p.pattern === 'dotted') return { backgroundImage: `radial-gradient(${ink} 1.4px, transparent 1.4px)`, backgroundSize: '22px 22px' };
  return {};
}

function strokePath(s: Stroke) {
  const pts = s.points;
  if (!pts.length) return '';
  const [a, b] = [pts[0], pts[pts.length - 1]];
  if (s.tool === 'line' || s.tool === 'arrow') {
    let d = `M${a[0]},${a[1]} L${b[0]},${b[1]}`;
    if (s.tool === 'arrow') {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 14 + s.width * 2;
      d += ` M${b[0]},${b[1]} L${b[0] - L * Math.cos(ang - 0.45)},${b[1] - L * Math.sin(ang - 0.45)} M${b[0]},${b[1]} L${b[0] - L * Math.cos(ang + 0.45)},${b[1] - L * Math.sin(ang + 0.45)}`;
    }
    return d;
  }
  if (s.tool === 'rect') return `M${a[0]},${a[1]} H${b[0]} V${b[1]} H${a[0]} Z`;
  if (s.tool === 'ellipse') {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
    return `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
  }
  if (pts.length < 3) return `M${a[0]},${a[1]} L${b[0] + 0.1},${b[1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0]},${pts[i][1]} ${mx},${my}`;
  }
  return d + ` L${b[0]},${b[1]}`;
}

function strokeWidth(s: Stroke) {
  const avg = s.points.reduce((t, p) => t + p[2], 0) / Math.max(1, s.points.length);
  return s.width * (0.5 + avg);
}

/** Signed URL cache for private board media. */
function useMediaUrl(path?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    supabase.storage.from('board-media').createSignedUrl(path, 3600).then(({ data, error }: any) => {
      if (!alive) return; if (error) setFailed(true); else setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [path]);
  return { url, failed };
}

function MediaImage({ item }: { item: BoardItem }) {
  const { url, failed } = useMediaUrl(item.path);
  if (failed) return <div className="grid h-full place-items-center bg-muted text-xs text-destructive">Image unavailable</div>;
  if (!url) return <div className="h-full w-full animate-pulse bg-muted motion-reduce:animate-none" />;
  return <img src={url} alt="" draggable={false} className="h-full w-full select-none" style={{ objectFit: item.fit ?? 'contain' }} />;
}
function MediaAudio({ item }: { item: BoardItem }) {
  const { url, failed } = useMediaUrl(item.path);
  if (failed) return <p className="p-2 text-xs text-destructive">Recording unavailable</p>;
  if (!url) return <p className="p-2 text-xs text-muted-foreground">Loading recording…</p>;
  return <audio controls src={url} className="w-full" aria-label="Voice note" />;
}

export default function BoardScreen() {
  const { user, loading } = useAuth();
  const reduced = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const boardId = params.get('id');
  const [boards, setBoards] = useState<{ id: string; title: string; updated_at: string }[] | null>(null);
  const [title, setTitle] = useState('Untitled board');
  const [data, setData] = useState<BoardData>(emptyBoard);
  const [ready, setReady] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [zoom, setZoom] = useState(0.8);
  const [selected, setSelected] = useState<string | null>(null);
  const [lassoSel, setLassoSel] = useState<string[]>([]);
  const [save, setSave] = useState<SaveState>('idle');
  const [uploads, setUploads] = useState<{ id: string; name: string; error?: string; file: File }[]>([]);
  const history = useRef(new History<BoardData>());
  const [, force] = useState(0);
  const page = data.pages[Math.min(pageIdx, data.pages.length - 1)];

  // ---------- load ----------
  useEffect(() => {
    if (!user) return;
    if (!boardId) {
      supabase.from('boards').select('id,title,updated_at').order('updated_at', { ascending: false }).then(({ data: rows, error }: any) => {
        if (error) toast.error('Could not load boards'); setBoards(rows ?? []);
      });
      return;
    }
    setReady(false);
    supabase.from('boards').select('*').eq('id', boardId).maybeSingle().then(({ data: row, error }: any) => {
      if (error || !row) { toast.error('Board not found'); setParams({}); return; }
      const local = localStorage.getItem(`nn-board:${boardId}`);
      let d = normalizeBoard(row.data);
      if (local) { try { const l = JSON.parse(local); if (l.at > new Date(row.updated_at).getTime()) { d = normalizeBoard(l.data); toast.info('Restored unsaved changes'); } } catch { /* ignore */ } }
      setData(d); setTitle(row.title); setPageIdx(0); history.current = new History(); setReady(true); setSave('saved');
    });
  }, [user, boardId, setParams]);

  // ---------- autosave ----------
  const dirty = useRef(false);
  const persist = useCallback(async () => {
    if (!boardId) return;
    setSave('saving');
    const { error } = await supabase.from('boards').update({ data, title }).eq('id', boardId);
    if (error) { setSave('error'); return; }
    dirty.current = false; localStorage.removeItem(`nn-board:${boardId}`); setSave('saved');
  }, [boardId, data, title]);
  useEffect(() => {
    if (!ready || !dirty.current) return;
    localStorage.setItem(`nn-board:${boardId}`, JSON.stringify({ at: Date.now(), data }));
    const t = setTimeout(persist, 900);
    return () => clearTimeout(t);
  }, [data, title, ready, boardId, persist]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const commit = useCallback((fn: (d: BoardData) => void, record = true) => {
    setData(prev => { if (record) history.current.push(prev); const next = clone(prev); fn(next); return next; });
    dirty.current = true; force(x => x + 1);
  }, []);
  const updPage = useCallback((fn: (p: BoardPage) => void, record = true) => commit(d => fn(d.pages[Math.min(pageIdx, d.pages.length - 1)]), record), [commit, pageIdx]);
  const undo = () => { const p = history.current.undo(data); if (p) { setData(p); dirty.current = true; setPageIdx(i => Math.min(i, p.pages.length - 1)); } };
  const redo = () => { const n = history.current.redo(data); if (n) { setData(n); dirty.current = true; } };
  const go = (i: number) => { if (i < 0 || i >= data.pages.length) return; setDir(i > pageIdx ? 1 : -1); setPageIdx(i); setSelected(null); setLassoSel([]); };

  // ---------- shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('textarea,input,[contenteditable]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (typing) return;
      const map: Record<string, Tool> = { v: 'select', t: 'text', p: 'pen', b: 'pencil', h: 'highlighter', e: 'eraser', l: 'lasso', r: 'rect', o: 'ellipse', a: 'arrow', ' ': 'pan' };
      if (map[e.key]) { setTool(map[e.key]); e.preventDefault(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selected || lassoSel.length)) {
        updPage(p => { p.items = p.items.filter(i => i.id !== selected); p.strokes = p.strokes.filter(s => !lassoSel.includes(s.id)); });
        setSelected(null); setLassoSel([]);
      }
      if (e.key === 'ArrowRight' && e.altKey) go(pageIdx + 1);
      if (e.key === 'ArrowLeft' && e.altKey) go(pageIdx - 1);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- drawing ----------
  const svgRef = useRef<SVGSVGElement>(null);
  const live = useRef<{ stroke?: Stroke; lasso?: [number, number][]; moveFrom?: [number, number]; pan?: [number, number, number, number] } | null>(null);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [lassoPath, setLassoPath] = useState<[number, number][] | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const local = (e: React.PointerEvent): [number, number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom, pressure];
  };
  const selBox = useMemo(() => {
    const pts = page.strokes.filter(s => lassoSel.includes(s.id)).flatMap(s => s.points);
    if (!pts.length) return null;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x: Math.min(...xs) - 6, y: Math.min(...ys) - 6, w: Math.max(...xs) - Math.min(...xs) + 12, h: Math.max(...ys) - Math.min(...ys) + 12 };
  }, [page.strokes, lassoSel]);

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch' && !e.isPrimary) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const pt = local(e);
    setSelected(null);
    if (tool === 'pan') { const s = scroller.current!; live.current = { pan: [e.clientX, e.clientY, s.scrollLeft, s.scrollTop] }; return; }
    if (tool === 'eraser') { history.current.push(clone(data)); live.current = {}; updPage(p => { p.strokes = eraseAt(p.strokes, pt[0], pt[1], 8 + width); }, false); return; }
    if (tool === 'lasso') {
      if (selBox && pt[0] >= selBox.x && pt[0] <= selBox.x + selBox.w && pt[1] >= selBox.y && pt[1] <= selBox.y + selBox.h) {
        history.current.push(clone(data)); live.current = { moveFrom: [pt[0], pt[1]] }; return;
      }
      setLassoSel([]); live.current = { lasso: [[pt[0], pt[1]]] }; setLassoPath([[pt[0], pt[1]]]); return;
    }
    const st = tool as StrokeTool;
    const s: Stroke = {
      id: uid(), tool: st, color,
      width: st === 'highlighter' ? width * 4 : st === 'pencil' ? Math.max(1, width * 0.7) : width,
      opacity: st === 'highlighter' ? 0.35 : st === 'pencil' ? Math.min(opacity, 0.75) : opacity,
      points: [pt],
    };
    live.current = { stroke: s }; setDraft(s);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const L = live.current; if (!L) return;
    if (L.pan) { const s = scroller.current!; s.scrollLeft = L.pan[2] - (e.clientX - L.pan[0]); s.scrollTop = L.pan[3] - (e.clientY - L.pan[1]); return; }
    const pt = local(e);
    if (tool === 'eraser') { updPage(p => { p.strokes = eraseAt(p.strokes, pt[0], pt[1], 8 + width); }, false); return; }
    if (L.moveFrom) {
      const dx = pt[0] - L.moveFrom[0], dy = pt[1] - L.moveFrom[1]; L.moveFrom = [pt[0], pt[1]];
      updPage(p => { p.strokes.forEach(s => { if (lassoSel.includes(s.id)) s.points = s.points.map(([x, y, q]) => [x + dx, y + dy, q]); }); }, false); return;
    }
    if (L.lasso) { L.lasso.push([pt[0], pt[1]]); setLassoPath([...L.lasso]); return; }
    if (L.stroke) {
      const isShape = ['line', 'arrow', 'rect', 'ellipse'].includes(L.stroke.tool);
      L.stroke = { ...L.stroke, points: isShape ? [L.stroke.points[0], pt] : [...L.stroke.points, pt] };
      setDraft(L.stroke);
    }
  };
  const onUp = () => {
    const L = live.current; live.current = null; if (!L) return;
    if (L.lasso) { setLassoSel(strokesInLasso(page.strokes, L.lasso)); setLassoPath(null); return; }
    if (L.stroke && L.stroke.points.length) { const s = L.stroke; updPage(p => { p.strokes.push(s); }); }
    setDraft(null);
  };

  // ---------- items ----------
  const addText = (x = MARGIN, y = MARGIN, text = '') => {
    const id = uid();
    updPage(p => { p.items.push({ id, kind: 'text', x, y, w: Math.min(360, p.width - x - MARGIN / 2), h: 120, rot: 0, z: p.items.length + 1, text, fontSize: 20, lineHeight: 1.5, align: 'left' }); });
    setSelected(id); setTool('select');
  };
  const patchItem = (id: string, patch: Partial<BoardItem>, record = true) => updPage(p => { const it = p.items.find(i => i.id === id); if (it) Object.assign(it, patch); }, record);

  const dragItem = (e: React.PointerEvent, it: BoardItem, mode: 'move' | 'resize') => {
    e.stopPropagation(); e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    history.current.push(clone(data));
    const sx = e.clientX, sy = e.clientY, o = { ...it };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;
      if (mode === 'move') patchItem(it.id, { x: Math.max(0, Math.min(page.width - 20, o.x + dx)), y: Math.max(0, Math.min(page.height - 20, o.y + dy)) }, false);
      else patchItem(it.id, { w: Math.max(60, o.w + dx), h: Math.max(40, o.h + dy) }, false);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  // Long paste flows onto new pages after the current one.
  const onPasteText = (e: React.ClipboardEvent<HTMLTextAreaElement>, it: BoardItem) => {
    const pasted = e.clipboardData.getData('text/plain');
    const { cols, rows } = textCapacity(page, it.fontSize ?? 20, it.lineHeight ?? 1.5);
    const ta = e.currentTarget;
    const full = (it.text ?? '').slice(0, ta.selectionStart) + pasted + (it.text ?? '').slice(ta.selectionEnd);
    const chunks = paginateText(full, cols, rows);
    if (chunks.length <= 1) return;
    e.preventDefault();
    commit(d => {
      const cur = d.pages[pageIdx];
      const t = cur.items.find(i => i.id === it.id)!;
      Object.assign(t, { text: chunks[0], x: MARGIN, y: MARGIN, w: cur.width - MARGIN * 2, h: cur.height - MARGIN * 2 });
      const extra = chunks.slice(1).map(c => {
        const np = newPage(cur);
        np.items.push({ ...t, id: uid(), text: c, z: 1 });
        return np;
      });
      d.pages.splice(pageIdx + 1, 0, ...extra);
    });
    toast.success(`Text continued onto ${chunks.length - 1} new page${chunks.length > 2 ? 's' : ''}`);
  };

  // ---------- uploads ----------
  const uploadFile = async (file: File, kind: 'image' | 'audio', duration?: number) => {
    if (!user || !boardId) return;
    if (kind === 'image') { const err = validateImage(file); if (err) { toast.error(err); return; } }
    const uploadId = uid();
    setUploads(u => [...u, { id: uploadId, name: file.name || 'Recording', file }]);
    const ext = (file.type.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 5);
    const path = `${user.id}/${boardId}/${uid()}.${ext}`;
    const { error } = await supabase.storage.from('board-media').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setUploads(u => u.map(x => x.id === uploadId ? { ...x, error: error.message || 'Upload failed' } : x)); return; }
    setUploads(u => u.filter(x => x.id !== uploadId));
    let w = 320, h = kind === 'audio' ? 72 : 240;
    if (kind === 'image') {
      try { const bmp = await createImageBitmap(file); const r = Math.min(1, 360 / bmp.width); w = bmp.width * r; h = bmp.height * r; } catch { /* keep default */ }
    }
    const id = uid();
    updPage(p => { p.items.push({ id, kind, x: MARGIN, y: MARGIN + 20, w, h, rot: 0, z: p.items.length + 1, path, fit: 'contain', duration }); });
    setSelected(id); setTool('select');
  };
  const retryUpload = (u: { id: string; file: File }) => { setUploads(x => x.filter(y => y.id !== u.id)); uploadFile(u.file, u.file.type.startsWith('audio') ? 'audio' : 'image'); };

  // ---------- voice ----------
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recog = useRef<any>(null);
  const [recState, setRecState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recTime, setRecTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const canRecord = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  useEffect(() => { if (recState !== 'recording') return; const t = setInterval(() => setRecTime(s => s + 1), 1000); return () => clearInterval(t); }, [recState]);
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); chunks.current = [];
      mr.ondataavailable = ev => ev.data.size && chunks.current.push(ev.data);
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
        uploadFile(new File([blob], 'voice-note', { type: blob.type.split(';')[0] }), 'audio');
      };
      mr.start(1000); rec.current = mr; setRecTime(0); setTranscript(''); setRecState('recording');
      if (SR) {
        const r = new SR(); r.continuous = true; r.interimResults = false; r.lang = navigator.language || 'en-IN';
        r.onresult = (ev: any) => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript + ' '; setTranscript(t.trim()); };
        r.onerror = () => {}; try { r.start(); recog.current = r; } catch { /* unsupported */ }
      }
    } catch (err: any) {
      toast.error(err?.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser settings.' : 'Could not start the microphone.');
    }
  };
  const pauseRec = () => { if (rec.current?.state === 'recording') { rec.current.pause(); recog.current?.stop(); setRecState('paused'); } else if (rec.current?.state === 'paused') { rec.current.resume(); try { recog.current?.start(); } catch { /* */ } setRecState('recording'); } };
  const stopRec = () => { rec.current?.stop(); recog.current?.stop(); rec.current = null; setRecState('idle'); };

  // ---------- board list / create ----------
  const createBoard = async () => {
    const { data: row, error } = await supabase.from('boards').insert({ user_id: user!.id, title: 'Untitled board', data: emptyBoard() }).select('id').single();
    if (error) { toast.error('Could not create board'); return; }
    setParams({ id: row.id });
  };

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin motion-reduce:animate-none" /></div>;
  if (!user) return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div className="space-y-3"><h1 className="text-2xl font-semibold">Sign in to use Boards</h1><p className="text-muted-foreground">Boards are saved to your account.</p><Button asChild><Link to="/login?redirect=/board">Sign in</Link></Button></div>
    </main>
  );

  if (!boardId) return (
    <main className="mx-auto max-w-3xl p-6 pb-28">
      <div className="mb-6 flex items-center justify-between"><div><Link to="/" className="text-sm text-muted-foreground">← Home</Link><h1 className="text-3xl font-semibold">Boards</h1><p className="text-muted-foreground">Free-form pages with text, images, drawing and voice notes.</p></div><Button onClick={createBoard}><Plus size={16} /> New board</Button></div>
      {boards === null ? <div className="grid gap-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div>
        : boards.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No boards yet. Create your first one.</div>
        : <ul className="grid gap-3">{boards.map(b => (
          <li key={b.id} className="flex items-center gap-2 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
            <button className="flex-1 text-left" onClick={() => setParams({ id: b.id })}><p className="font-medium">{b.title}</p><p className="text-xs text-muted-foreground">Edited {new Date(b.updated_at).toLocaleString()}</p></button>
            <Button variant="ghost" size="icon" aria-label="Delete board" onClick={async () => { if (!confirm(`Delete “${b.title}”?`)) return; const { error } = await supabase.from('boards').delete().eq('id', b.id); if (error) toast.error('Delete failed'); else setBoards(x => x!.filter(y => y.id !== b.id)); }}><Trash2 size={16} /></Button>
          </li>))}</ul>}
    </main>
  );

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select (V)' }, { id: 'text', icon: Type, label: 'Text box (T)' },
    { id: 'pen', icon: PenLine, label: 'Pen (P)' }, { id: 'pencil', icon: Pencil, label: 'Pencil (B)' }, { id: 'highlighter', icon: Highlighter, label: 'Highlighter (H)' },
    { id: 'eraser', icon: Eraser, label: 'Eraser (E)' }, { id: 'line', icon: Slash, label: 'Line' }, { id: 'arrow', icon: ArrowUpRight, label: 'Arrow (A)' },
    { id: 'rect', icon: Square, label: 'Rectangle (R)' }, { id: 'ellipse', icon: Circle, label: 'Ellipse (O)' }, { id: 'lasso', icon: Lasso, label: 'Lasso select (L)' }, { id: 'pan', icon: Hand, label: 'Pan (Space)' },
  ];
  const drawing = !['select', 'text'].includes(tool);
  const sel = page.items.find(i => i.id === selected);
  const presetKey = Object.entries(PAGE_PRESETS).find(([, v]) => Math.min(v.w, v.h) === Math.min(page.width, page.height) && Math.max(v.w, v.h) === Math.max(page.width, page.height))?.[0] ?? 'custom';
  const landscape = page.width > page.height;
  const dark = page.bg === '#1f2430';

  return (
    <main className="flex h-[100dvh] flex-col bg-muted/40">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur">
        <Button variant="ghost" size="icon" aria-label="All boards" onClick={() => { if (dirty.current) persist(); setParams({}); }}><ArrowLeft size={18} /></Button>
        <input aria-label="Board title" value={title} onChange={e => { setTitle(e.target.value); dirty.current = true; }} className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1" />
        <span role="status" aria-live="polite" className={`text-xs ${save === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {save === 'saving' ? 'Saving…' : save === 'error' ? <>Not saved · <button className="underline" onClick={persist}>Retry</button></> : save === 'saved' ? 'Saved' : ''}
        </span>
        <Button variant="ghost" size="icon" aria-label="Undo" disabled={!history.current.canUndo} onClick={undo}><Undo2 size={18} /></Button>
        <Button variant="ghost" size="icon" aria-label="Redo" disabled={!history.current.canRedo} onClick={redo}><Redo2 size={18} /></Button>
      </header>

      {/* Page settings */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background/70 px-3 py-2 text-sm">
        <select aria-label="Page size" className="rounded-md border bg-background px-2 py-1" value={presetKey} onChange={e => {
          const p = PAGE_PRESETS[e.target.value]; if (!p) return; updPage(pg => Object.assign(pg, orient(p.w, p.h, landscape)));
        }}>{Object.entries(PAGE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}<option value="custom" disabled>Custom</option></select>
        <label className="flex items-center gap-1">W<input type="number" min={300} max={3000} aria-label="Page width" className="w-16 rounded-md border bg-background px-1 py-1" value={page.width} onChange={e => { const v = +e.target.value; if (v >= 300 && v <= 3000) updPage(p => { p.width = v; }); }} /></label>
        <label className="flex items-center gap-1">H<input type="number" min={300} max={3000} aria-label="Page height" className="w-16 rounded-md border bg-background px-1 py-1" value={page.height} onChange={e => { const v = +e.target.value; if (v >= 300 && v <= 3000) updPage(p => { p.height = v; }); }} /></label>
        <Button variant="outline" size="sm" onClick={() => updPage(p => Object.assign(p, orient(p.width, p.height, !landscape)))}>{landscape ? 'Landscape' : 'Portrait'}</Button>
        <select aria-label="Page background" className="rounded-md border bg-background px-2 py-1" value={page.pattern} onChange={e => updPage(p => { p.pattern = e.target.value as Pattern; })}>
          <option value="blank">Blank</option><option value="ruled">Ruled</option><option value="grid">Grid</option><option value="dotted">Dotted</option>
        </select>
        <div className="flex items-center gap-1" role="group" aria-label="Paper colour">
          {PAPER_COLORS.map(c => <button key={c.value} aria-label={c.label} aria-pressed={page.bg === c.value} onClick={() => updPage(p => { p.bg = c.value; })} className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${page.bg === c.value ? 'ring-2 ring-primary ring-offset-1' : ''}`} style={{ background: c.value }} />)}
          <input type="color" aria-label="Custom paper colour" value={page.bg} onChange={e => updPage(p => { p.bg = e.target.value; })} className="h-6 w-7 cursor-pointer rounded border bg-transparent" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.1).toFixed(2)))}><ZoomOut size={16} /></Button>
          <button className="w-12 text-xs tabular-nums" onClick={() => setZoom(1)} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
          <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))}><ZoomIn size={16} /></Button>
          <Button variant="ghost" size="sm" aria-label="Fit page to screen" onClick={() => { const el = scroller.current; if (!el) return; setZoom(Math.max(0.25, Math.min(3, +(Math.min((el.clientWidth - 48) / page.width, (el.clientHeight - 48) / page.height)).toFixed(2)))); }}>Fit</Button>
          <Button variant="ghost" size="sm" aria-label="Export page as PNG" onClick={async () => {
            const el = document.querySelector('[data-testid="board-page"]') as HTMLElement | null; if (!el) return;
            const { default: html2canvas } = await import('html2canvas');
            const prev = el.style.transform; el.style.transform = 'none';
            try { const c = await html2canvas(el, { backgroundColor: page.bg, scale: 2, useCORS: true }); const a = document.createElement('a'); a.download = `niknote-board-page-${pageIdx + 1}.png`; a.href = c.toDataURL('image/png'); a.click(); }
            catch { alert('Could not export this page.'); } finally { el.style.transform = prev; }
          }}>PNG</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Page list */}
        <aside className="hidden w-36 shrink-0 flex-col gap-2 overflow-y-auto border-r bg-background/60 p-2 md:flex" aria-label="Pages">
          {data.pages.map((p, i) => (
            <div key={p.id} className={`group rounded-lg border p-1 transition ${i === pageIdx ? 'border-primary ring-2 ring-primary/30' : 'hover:border-foreground/30'}`}>
              <button onClick={() => go(i)} aria-label={`Go to page ${i + 1}`} aria-current={i === pageIdx} className="block w-full">
                <div className="mx-auto rounded-sm border" style={{ background: p.bg, aspectRatio: `${p.width}/${p.height}`, ...patternStyle(p), backgroundSize: p.pattern === 'blank' ? undefined : '8px 8px' }} />
                <span className="text-xs text-muted-foreground">{i + 1}</span>
              </button>
              <div className="flex justify-center gap-0.5 opacity-70 group-hover:opacity-100">
                <button aria-label="Move page up" disabled={i === 0} onClick={() => { commit(d => { d.pages = movePage(d.pages, i, i - 1); }); if (i === pageIdx) setPageIdx(i - 1); }} className="rounded p-0.5 hover:bg-muted disabled:opacity-30"><ChevronUp size={13} /></button>
                <button aria-label="Move page down" disabled={i === data.pages.length - 1} onClick={() => { commit(d => { d.pages = movePage(d.pages, i, i + 1); }); if (i === pageIdx) setPageIdx(i + 1); }} className="rounded p-0.5 hover:bg-muted disabled:opacity-30"><ChevronDown size={13} /></button>
                <button aria-label="Duplicate page" onClick={() => commit(d => { d.pages.splice(i + 1, 0, duplicatePage(d.pages[i])); })} className="rounded p-0.5 hover:bg-muted"><Copy size={13} /></button>
                <button aria-label="Delete page" disabled={data.pages.length === 1} onClick={() => { if (!confirm(`Delete page ${i + 1}?`)) return; commit(d => { d.pages.splice(i, 1); }); setPageIdx(x => Math.max(0, Math.min(x, data.pages.length - 2))); }} className="rounded p-0.5 hover:bg-muted disabled:opacity-30"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => { commit(d => { d.pages.splice(pageIdx + 1, 0, newPage(page)); }); go(pageIdx + 1); setTimeout(() => setPageIdx(pageIdx + 1)); }}><Plus size={14} /> Page</Button>
        </aside>

        {/* Canvas */}
        <div ref={scroller} className="relative min-w-0 flex-1 overflow-auto"
          onWheel={e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(z => Math.min(3, Math.max(0.25, z - e.deltaY * 0.002))); } }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(f => uploadFile(f, 'image')); }}>
          <div className="flex min-h-full min-w-max items-start justify-center p-6 pb-40">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={page.id}
                initial={reduced ? false : { opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, x: -dir * 40 }}
                transition={{ duration: reduced ? 0 : 0.22 }}
                style={{ width: page.width * zoom, height: page.height * zoom }} className="relative shrink-0">
                <div className="absolute left-0 top-0 origin-top-left overflow-hidden rounded-sm shadow-xl" data-testid="board-page"
                  style={{ width: page.width, height: page.height, transform: `scale(${zoom})`, background: page.bg, color: dark ? '#f1f5f9' : '#1a1a2e', ...patternStyle(page) }}
                  onDoubleClick={e => { if (tool !== 'select' && tool !== 'text') return; const r = e.currentTarget.getBoundingClientRect(); addText((e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom); }}
                  onPointerDown={e => { if (tool === 'text' && e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); addText((e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom); } else if (e.target === e.currentTarget) setSelected(null); }}>
                  {[...page.items].sort((a, b) => a.z - b.z).map(it => (
                    <div key={it.id} data-item={it.kind} className={`absolute ${selected === it.id ? 'outline outline-2 outline-primary' : 'outline-1 hover:outline hover:outline-primary/40'}`}
                      style={{ left: it.x, top: it.y, width: it.w, height: it.h, transform: `rotate(${it.rot}deg)`, zIndex: it.z }}
                      onPointerDown={e => { e.stopPropagation(); setSelected(it.id); if (it.kind !== 'text' && tool === 'select') dragItem(e, it, 'move'); }}>
                      {selected === it.id && <div aria-label="Drag to move" title="Drag to move" onPointerDown={e => dragItem(e, it, 'move')} className="absolute -top-6 left-0 flex h-5 cursor-move touch-none items-center gap-1 rounded-t bg-primary px-2 text-[10px] text-primary-foreground">⠿ move</div>}
                      {it.kind === 'text' && <textarea value={it.text} placeholder="Type here…" aria-label="Text box"
                        onFocus={() => { setSelected(it.id); history.current.push(clone(data)); }}
                        onChange={e => patchItem(it.id, { text: e.target.value }, false)}
                        onPaste={e => onPasteText(e, it)}
                        className="h-full w-full resize-none overflow-hidden bg-transparent p-1 outline-none placeholder:opacity-40"
                        style={{ fontSize: it.fontSize, lineHeight: it.lineHeight, textAlign: it.align, color: 'inherit' }} />}
                      {it.kind === 'image' && <MediaImage item={it} />}
                      {it.kind === 'audio' && <div className="flex h-full items-center rounded-xl border bg-background/90 p-2 shadow"><MediaAudio item={it} /></div>}
                      {selected === it.id && <div aria-label="Drag to resize" onPointerDown={e => dragItem(e, it, 'resize')} className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize touch-none rounded-full border-2 border-background bg-primary" />}
                    </div>
                  ))}
                  <svg ref={svgRef} width={page.width} height={page.height} className="absolute inset-0"
                    style={{ pointerEvents: drawing ? 'auto' : 'none', touchAction: drawing ? 'none' : 'auto', zIndex: 9999, cursor: tool === 'pan' ? 'grab' : tool === 'eraser' ? 'cell' : 'crosshair' }}
                    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                    {[...page.strokes, ...(draft ? [draft] : [])].map(s => (
                      <path key={s.id} d={strokePath(s)} fill="none" stroke={s.color} strokeOpacity={s.opacity} strokeWidth={strokeWidth(s)} strokeLinecap="round" strokeLinejoin="round"
                        style={s.tool === 'highlighter' ? { mixBlendMode: 'multiply' } : undefined} className={lassoSel.includes(s.id) ? 'drop-shadow-[0_0_3px_hsl(var(--primary))]' : ''} />
                    ))}
                    {lassoPath && <polyline points={lassoPath.map(p => p.join(',')).join(' ')} fill="hsl(var(--primary) / .08)" stroke="hsl(var(--primary))" strokeDasharray="4 4" />}
                    {selBox && tool === 'lasso' && <rect {...{ x: selBox.x, y: selBox.y, width: selBox.w, height: selBox.h }} fill="none" stroke="hsl(var(--primary))" strokeDasharray="5 3" />}
                  </svg>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Selection toolbar */}
      {(sel || lassoSel.length > 0) && (
        <div className="fixed left-1/2 top-28 z-40 flex -translate-x-1/2 flex-wrap items-center gap-1 rounded-xl border bg-background/95 p-1 shadow-lg backdrop-blur">
          {sel?.kind === 'text' && <>
            <label className="px-1 text-xs">Size<input type="number" min={8} max={96} value={sel.fontSize} onChange={e => patchItem(sel.id, { fontSize: Math.min(96, Math.max(8, +e.target.value)) })} className="ml-1 w-12 rounded border bg-background px-1" /></label>
            <label className="px-1 text-xs">Line<input type="number" step={0.1} min={1} max={3} value={sel.lineHeight} onChange={e => patchItem(sel.id, { lineHeight: Math.min(3, Math.max(1, +e.target.value)) })} className="ml-1 w-12 rounded border bg-background px-1" /></label>
            {(['left', 'center', 'right'] as const).map(a => <Button key={a} size="sm" variant={sel.align === a ? 'secondary' : 'ghost'} onClick={() => patchItem(sel.id, { align: a })}>{a[0].toUpperCase()}</Button>)}
          </>}
          {sel?.kind === 'image' && <>
            <Button size="sm" variant="ghost" onClick={() => patchItem(sel.id, { rot: (sel.rot + 15) % 360 })}><RotateCw size={14} /> Rotate</Button>
            <Button size="sm" variant="ghost" onClick={() => patchItem(sel.id, { fit: sel.fit === 'cover' ? 'contain' : 'cover' })}>{sel.fit === 'cover' ? 'Fit' : 'Crop to fill'}</Button>
          </>}
          {sel && <>
            <Button size="sm" variant="ghost" aria-label="Bring forward" onClick={() => patchItem(sel.id, { z: Math.max(...page.items.map(i => i.z)) + 1 })}><ChevronUp size={14} /></Button>
            <Button size="sm" variant="ghost" aria-label="Send backward" onClick={() => patchItem(sel.id, { z: Math.min(...page.items.map(i => i.z)) - 1 })}><ChevronDown size={14} /></Button>
            <Button size="sm" variant="ghost" aria-label="Duplicate" onClick={() => { const id = uid(); updPage(p => { p.items.push({ ...sel, id, x: sel.x + 20, y: sel.y + 20, z: sel.z + 1 }); }); setSelected(id); }}><Copy size={14} /></Button>
          </>}
          <Button size="sm" variant="ghost" aria-label="Delete selection" className="text-destructive" onClick={() => { updPage(p => { p.items = p.items.filter(i => i.id !== selected); p.strokes = p.strokes.filter(s => !lassoSel.includes(s.id)); }); setSelected(null); setLassoSel([]); }}><Trash2 size={14} /></Button>
        </div>
      )}

      {/* Uploads + recording status */}
      <div className="pointer-events-none fixed right-3 top-28 z-40 flex w-64 flex-col gap-2">
        {uploads.map(u => (
          <div key={u.id} className="pointer-events-auto rounded-lg border bg-background p-2 text-xs shadow">
            {u.error ? <><p className="text-destructive">Upload failed: {u.error}</p><button className="underline" onClick={() => retryUpload(u)}>Retry</button> · <button className="underline" onClick={() => setUploads(x => x.filter(y => y.id !== u.id))}>Dismiss</button></>
              : <p className="flex items-center gap-2"><Loader2 size={12} className="animate-spin motion-reduce:animate-none" /> Uploading {u.name}…</p>}
          </div>
        ))}
        {recState !== 'idle' && (
          <div className="pointer-events-auto rounded-lg border bg-background p-2 text-xs shadow" role="status">
            <p className="flex items-center gap-2 font-medium"><span className={`h-2.5 w-2.5 rounded-full bg-destructive ${recState === 'recording' ? 'animate-pulse motion-reduce:animate-none' : ''}`} />{recState === 'recording' ? 'Recording' : 'Paused'} · {Math.floor(recTime / 60)}:{String(recTime % 60).padStart(2, '0')}</p>
            <p className="mt-1 text-muted-foreground">{SR ? (transcript || 'Listening for speech…') : 'Live transcription is not supported in this browser. The audio is still saved.'}</p>
          </div>
        )}
        {recState === 'idle' && transcript && (
          <div className="pointer-events-auto rounded-lg border bg-background p-2 text-xs shadow">
            <p className="mb-1 line-clamp-3">{transcript}</p>
            <button className="underline" onClick={() => { addText(MARGIN, MARGIN + 120, transcript); setTranscript(''); }}>Add as text</button> · <button className="underline" onClick={() => setTranscript('')}>Dismiss</button>
          </div>
        )}
      </div>

      {/* Floating tool palette */}
      <div className="fixed bottom-3 left-1/2 z-50 w-[min(100%-1rem,980px)] -translate-x-1/2 rounded-2xl border bg-background/95 p-2 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-1 overflow-x-auto">
          <Button variant="ghost" size="icon" aria-label="Previous page" disabled={pageIdx === 0} onClick={() => go(pageIdx - 1)}><ArrowLeft size={16} /></Button>
          <span className="shrink-0 text-xs tabular-nums" aria-live="polite">{pageIdx + 1}/{data.pages.length}</span>
          <Button variant="ghost" size="icon" aria-label="Next page" disabled={pageIdx >= data.pages.length - 1} onClick={() => go(pageIdx + 1)}><ArrowRight size={16} /></Button>
          <Button variant="ghost" size="icon" aria-label="Add page" className="md:hidden" onClick={() => { commit(d => { d.pages.splice(pageIdx + 1, 0, newPage(page)); }); setDir(1); setPageIdx(pageIdx + 1); }}><Plus size={16} /></Button>
          <span className="mx-1 h-6 w-px shrink-0 bg-border" />
          {tools.map(t => (
            <motion.button key={t.id} whileTap={reduced ? undefined : { scale: 0.88 }} title={t.label} aria-label={t.label} aria-pressed={tool === t.id}
              onClick={() => { setTool(t.id); if (t.id !== 'lasso') setLassoSel([]); }}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring ${tool === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><t.icon size={17} /></motion.button>
          ))}
          <span className="mx-1 h-6 w-px shrink-0 bg-border" />
          <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-muted" title="Insert image" aria-label="Insert image">
            <ImagePlus size={17} /><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" onChange={e => { Array.from(e.target.files ?? []).forEach(f => uploadFile(f, 'image')); e.target.value = ''; }} />
          </label>
          <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-muted md:hidden" title="Take photo" aria-label="Take photo">
            <Camera size={17} /><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'image'); e.target.value = ''; }} />
          </label>
          {recState === 'idle'
            ? <Button variant="ghost" size="icon" aria-label={canRecord ? 'Record voice note' : 'Voice recording not supported in this browser'} disabled={!canRecord} title={canRecord ? 'Record voice note' : 'Not supported in this browser'} onClick={startRec}><Mic size={17} /></Button>
            : <><Button variant="ghost" size="icon" aria-label={recState === 'paused' ? 'Resume recording' : 'Pause recording'} onClick={pauseRec}>{recState === 'paused' ? <Play size={17} /> : <Pause size={17} />}</Button>
              <Button variant="ghost" size="icon" aria-label="Stop and save recording" className="text-destructive" onClick={stopRec}><StopIcon size={17} fill="currentColor" /></Button></>}
          <span className="mx-1 h-6 w-px shrink-0 bg-border" />
          {COLORS.map(c => <button key={c} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={`h-6 w-6 shrink-0 rounded-full border transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-primary ring-offset-1' : ''}`} style={{ background: c }} />)}
          <input type="color" aria-label="Custom ink colour" value={color} onChange={e => setColor(e.target.value)} className="h-6 w-7 shrink-0 cursor-pointer rounded border bg-transparent" />
          <label className="flex shrink-0 items-center gap-1 px-1 text-xs">Size<input type="range" min={1} max={20} value={width} onChange={e => setWidth(+e.target.value)} aria-label="Stroke width" className="w-16" /></label>
          <label className="flex shrink-0 items-center gap-1 px-1 text-xs">Opacity<input type="range" min={10} max={100} value={opacity * 100} onChange={e => setOpacity(+e.target.value / 100)} aria-label="Stroke opacity" className="w-16" /></label>
          <Button variant="ghost" size="sm" className="shrink-0 text-destructive" onClick={() => { if (page.strokes.length && confirm('Clear all drawing on this page?')) updPage(p => { p.strokes = []; }); }}>Clear</Button>
        </div>
      </div>
    </main>
  );
}
