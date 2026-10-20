import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Brain,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  FilePlus2,
  FileText,
  GraduationCap,
  History,
  KeyRound,
  Mic,
  MicOff,
  PenLine,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { AstaMarkdown } from '@/components/asta/AstaMarkdown';
import { MobileNavigation } from '@/components/mobile/MobilePrimitives';
import {
  AstaImageAttachment,
  AstaMode,
  AstaModelChoice,
  probeAstaProviders,
  readCustomAIKeys,
  saveCustomAIKeys,
  streamAstaAI,
} from '@/lib/aiEngine';

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  images?: AstaImageAttachment[];
  model?: string;
  provider?: string;
  latencyMs?: number;
  followUps?: string[];
  createdAt: number;
}

interface ChatThread {
  id: string;
  title: string;
  mode: AstaMode;
  updatedAt: number;
  messages: StoredMessage[];
}

interface LocalNoteSummary {
  id: string;
  title: string;
  content: string;
}

const THREADS_KEY = 'niknote.asta.threads.v1';
const NOTES_STORAGE_KEY = 'niknote.notes.v1';

const MODES: { id: AstaMode; label: string; badge: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { id: 'auto', label: 'Asta Auto', badge: 'Ultra', icon: Sparkles, hint: 'Ask anything — studies, code, math, Hinglish or English…' },
  { id: 'deep', label: 'Deep Think', badge: 'R1 / Pro', icon: Brain, hint: 'Hard math, physics derivations, logic puzzles & architecture…' },
  { id: 'teacher', label: 'Master Teacher', badge: 'Step-by-step', icon: GraduationCap, hint: 'Explain any concept simply with examples & formulas…' },
  { id: 'solver', label: 'Exam Solver', badge: 'Homework', icon: Zap, hint: 'Paste a question or snap a photo for step-by-step working…' },
  { id: 'code', label: 'Code Studio', badge: 'Dev', icon: Code2, hint: 'Write, debug, refactor or explain code in Python, JS/TS, C++…' },
  { id: 'notes', label: 'Smart Notes', badge: 'Revision', icon: BookOpen, hint: 'Enter any chapter/topic to generate exam-ready notes…' },
  { id: 'quiz', label: 'Live Quiz', badge: 'MCQ', icon: FileText, hint: 'Enter any topic to play a live scored MCQ quiz right here…' },
  { id: 'write', label: 'Writing Pro', badge: 'Polish', icon: PenLine, hint: 'Draft essays, emails, summaries, grammar fixes or translations…' },
];

const MODEL_OPTIONS: { id: AstaModelChoice; label: string }[] = [
  { id: 'auto', label: '⚡ Auto Best Model' },
  { id: 'llama-3.3-70b', label: '🚀 Llama 3.3 70B Turbo' },
  { id: 'gpt-oss-120b', label: '🧠 GPT-OSS 120B Deep' },
  { id: 'gemini-2.5-flash', label: '✨ Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: '💎 Gemini 2.5 Pro' },
];

const STARTER_CARDS: { title: string; subtitle: string; mode: AstaMode; prompt: string }[] = [
  {
    title: '🎓 Hinglish Concept Masterclass',
    subtitle: 'Intuition + formula + real-life example',
    mode: 'teacher',
    prompt: 'Newton ke 3 laws aur Impulse-Momentum theorem ko Hinglish mein real-life examples, formulas aur JEE trick ke saath samjhao.',
  },
  {
    title: '🎯 Play Live Interactive Quiz',
    subtitle: 'Tap A/B/C/D options with instant score',
    mode: 'quiz',
    prompt: 'Create a 5-question interactive MCQ quiz on Thermodynamics & Entropy from easy to tricky exam level.',
  },
  {
    title: '💻 Production Code + Complexity',
    subtitle: 'Clean code, dry-run & edge cases',
    mode: 'code',
    prompt: 'Write a clean TypeScript + Python implementation of LRU Cache with O(1) get/put, explanation, and edge cases.',
  },
  {
    title: '📓 1-Page Revision Cheat Sheet',
    subtitle: 'Save directly into NikNote in 1 tap',
    mode: 'notes',
    prompt: 'Build complete exam revision notes on Photosynthesis (Light reaction vs Calvin cycle table, equations & mnemonics).',
  },
];

function createEmptyThread(mode: AstaMode = 'auto'): ChatThread {
  return {
    id: `asta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New Chat',
    mode,
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (!raw) return [createEmptyThread()];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // ignore corrupt storage
  }
  return [createEmptyThread()];
}

function loadSavedNotesList(): LocalNoteSummary[] {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n: any) => !n.trashedAt)
      .slice(0, 30)
      .map((n: any) => ({
        id: String(n.id),
        title: String(n.title || 'Untitled').trim() || 'Untitled',
        content: String(n.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      }));
  } catch {
    return [];
  }
}

async function compressImageFile(file: File): Promise<AstaImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxSide = 1280;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const scale = maxSide / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ name: file.name, mimeType: file.type || 'image/jpeg', dataUrl: src });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.84);
        resolve({ name: file.name, mimeType: 'image/jpeg', dataUrl: compressed });
      };
      img.onerror = () => resolve({ name: file.name, mimeType: file.type || 'image/jpeg', dataUrl: src });
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export const AstaAIWorkspace: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [threads, setThreads] = useState<ChatThread[]>(() => loadThreads());
  const [activeId, setActiveId] = useState<string>(() => loadThreads()[0]?.id || '');
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AstaMode>('auto');
  const [modelChoice, setModelChoice] = useState<AstaModelChoice>('auto');
  const [images, setImages] = useState<AstaImageAttachment[]>([]);
  const [attachedNote, setAttachedNote] = useState<LocalNoteSummary | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveThinking, setLiveThinking] = useState('');
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  // Drawers / panels
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notesPickerOpen, setNotesPickerOpen] = useState(false);
  const [keysModalOpen, setKeysModalOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ cloudReady: boolean; providers: string[] }>({
    cloudReady: true,
    providers: [],
  });
  const [keyDraft, setKeyDraft] = useState(() => readCustomAIKeys());

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) || threads[0],
    [threads, activeId]
  );

  useEffect(() => {
    try {
      // Persist last 25 threads (strip oversized raw images on older turns to protect storage quota)
      const trimmed = threads.slice(0, 25).map((t, tIdx) => ({
        ...t,
        messages: t.messages.slice(-40).map((m, mIdx, arr) => ({
          ...m,
          images: tIdx === 0 && mIdx >= arr.length - 4 ? m.images : undefined,
        })),
      }));
      localStorage.setItem(THREADS_KEY, JSON.stringify(trimmed));
    } catch {
      // quota guard
    }
  }, [threads]);

  useEffect(() => {
    probeAstaProviders().then(setCloudStatus).catch(() => {});
  }, [keysModalOpen]);

  // Support `?q=` query prefill from search/shortcuts
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q');
    if (q && q.trim()) {
      setInput(q.trim());
    }
  }, [location.search]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread?.messages.length, isStreaming]);

  // Auto-grow textarea smoothly up to 160px
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  const startNewChat = useCallback((nextMode: AstaMode = mode) => {
    abortRef.current?.abort();
    const fresh = createEmptyThread(nextMode);
    setThreads((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setMode(nextMode);
    setImages([]);
    setInput('');
    setDrawerOpen(false);
  }, [mode]);

  const deleteThread = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const fresh = createEmptyThread();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  }, [activeId]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (overrideText?: string, overrideMode?: AstaMode) => {
    const text = (overrideText ?? input).trim();
    if ((!text && images.length === 0) || isStreaming || !activeThread) return;

    const effectiveMode = overrideMode || mode;
    if (overrideMode) setMode(overrideMode);

    const userMsg: StoredMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text || 'Solve / analyze this attached image step by step.',
      images: images.length > 0 ? [...images] : undefined,
      createdAt: Date.now(),
    };

    const assistantId = `a-${Date.now() + 1}`;
    const placeholderAssistant: StoredMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      thinking: '',
      createdAt: Date.now(),
    };

    const threadId = activeThread.id;
    const historyForCall = [...activeThread.messages, userMsg];

    setInput('');
    setImages([]);
    setLiveThinking('');
    setIsStreaming(true);

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const nextTitle =
          t.messages.length === 0
            ? (userMsg.content.slice(0, 44) + (userMsg.content.length > 44 ? '…' : ''))
            : t.title;
        return {
          ...t,
          title: nextTitle,
          mode: effectiveMode,
          updatedAt: Date.now(),
          messages: [...t.messages, userMsg, placeholderAssistant],
        };
      })
    );

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await streamAstaAI({
        messages: historyForCall.slice(-16).map((m) => ({
          role: m.role,
          content: m.content,
          images: m.images,
        })),
        mode: effectiveMode,
        model: modelChoice,
        noteContext: attachedNote ? `Title: ${attachedNote.title}\n\n${attachedNote.content}` : undefined,
        signal: controller.signal,
        onMeta: ({ model, provider }) => {
          setThreads((prev) =>
            prev.map((t) =>
              t.id !== threadId
                ? t
                : {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantId ? { ...m, model, provider } : m
                    ),
                  }
            )
          );
        },
        onThinking: (_delta, fullThinking) => {
          setLiveThinking(fullThinking);
          setThreads((prev) =>
            prev.map((t) =>
              t.id !== threadId
                ? t
                : {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantId ? { ...m, thinking: fullThinking } : m
                    ),
                  }
            )
          );
        },
        onToken: (_delta, fullText) => {
          setThreads((prev) =>
            prev.map((t) =>
              t.id !== threadId
                ? t
                : {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantId ? { ...m, content: fullText } : m
                    ),
                  }
            )
          );
        },
      });

      setThreads((prev) =>
        prev.map((t) =>
          t.id !== threadId
            ? t
            : {
                ...t,
                updatedAt: Date.now(),
                messages: t.messages.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: result.content,
                        thinking: result.thinking,
                        model: result.model,
                        provider: result.provider,
                        latencyMs: result.latencyMs,
                        followUps: result.followUps,
                      }
                    : m
                ),
              }
        )
      );
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast.error('Connection interrupted — tap Regenerate to retry.');
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      setLiveThinking('');
    }
  }, [input, images, isStreaming, activeThread, mode, modelChoice, attachedNote]);

  const handleRegenerate = useCallback((assistantIndex: number) => {
    if (!activeThread || isStreaming) return;
    const prevUser = [...activeThread.messages.slice(0, assistantIndex)]
      .reverse()
      .find((m) => m.role === 'user');
    if (!prevUser) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? { ...t, messages: t.messages.slice(0, assistantIndex - 1) }
          : t
      )
    );
    setTimeout(() => {
      sendMessage(prevUser.content);
    }, 30);
  }, [activeThread, isStreaming, sendMessage]);

  const handleSaveAsNote = useCallback((msg: StoredMessage) => {
    try {
      const raw = localStorage.getItem(NOTES_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const firstHeading = msg.content.match(/^##?\s+(.+)$/m)?.[1]?.trim();
      const title = firstHeading || activeThread?.title || 'Asta AI Study Note';
      const now = new Date().toISOString();
      const newNote = {
        id: `note-ai-${Date.now()}`,
        title,
        icon: '✨',
        content: msg.content,
        starred: false,
        tags: ['ai', mode],
        parentId: null,
        trashedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      const updated = Array.isArray(list) ? [newNote, ...list] : [newNote];
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
      toast.success(`Saved "${title}" to Notes!`, {
        action: {
          label: 'Open Notes',
          onClick: () => navigate('/notes'),
        },
      });
    } catch {
      toast.error('Could not save note to device storage.');
    }
  }, [activeThread?.title, mode, navigate]);

  const handleSpeak = useCallback((msg: StoredMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.info('Speech output is not supported in this browser.');
      return;
    }
    if (speakingId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const plain = msg.content.replace(/[#*`>|_-]/g, ' ').replace(/\s+/g, ' ').trim();
    const utter = new SpeechSynthesisUtterance(plain.slice(0, 3500));
    utter.lang = 'en-IN';
    utter.rate = 1.02;
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);
    setSpeakingId(msg.id);
    window.speechSynthesis.speak(utter);
  }, [speakingId]);

  const toggleVoiceInput = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.info('Voice dictation is supported in Chrome, Edge, and Safari.');
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      const transcript = Array.from(ev.results)
        .map((r: any) => r[0]?.transcript || '')
        .join(' ');
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening]);

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    e.target.value = '';
    if (!files.length) return;
    try {
      const compressed = await Promise.all(files.map(compressImageFile));
      setImages((prev) => [...prev, ...compressed].slice(0, 3));
    } catch {
      toast.error('Could not attach image');
    }
  };

  const currentModeMeta = MODES.find((m) => m.id === mode) || MODES[0];
  const savedNotes = useMemo(() => (notesPickerOpen ? loadSavedNotesList() : []), [notesPickerOpen]);

  return (
    <div
      data-testid="asta-ai-workspace"
      className={`flex w-full bg-background text-foreground ${
        embedded ? 'h-full' : 'min-h-[100dvh]'
      }`}
    >
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:w-[272px] lg:shrink-0 lg:flex-col border-r border-border/70 bg-muted/20">
        <div className="flex items-center justify-between gap-2 p-3.5 border-b border-border/60">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-xl px-2.5 text-sm font-semibold hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>NikNote</span>
          </button>
          <button
            type="button"
            onClick={() => startNewChat()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-semibold text-background shadow-2xs hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-1">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Conversations
          </div>
          {threads.map((t) => (
            <div
              key={t.id}
              onClick={() => { setActiveId(t.id); setMode(t.mode || 'auto'); }}
              className={`group flex min-h-[42px] cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors ${
                t.id === activeThread?.id
                  ? 'bg-foreground/[0.08] font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              <span className="truncate">{t.title}</span>
              <button
                type="button"
                aria-label="Delete conversation"
                onClick={(e) => deleteThread(t.id, e)}
                className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-muted-foreground hover:text-destructive transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 p-3 space-y-2">
          <button
            type="button"
            onClick={() => setKeysModalOpen(true)}
            className="flex w-full min-h-[40px] items-center justify-between rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
              AI Provider Settings
            </span>
            <span className={`h-2 w-2 rounded-full ${cloudStatus.cloudReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </button>
        </div>
      </aside>

      {/* Mobile History Slide-Over Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-2xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative z-10 flex w-[82vw] max-w-[310px] flex-col bg-background border-r border-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="font-bold text-sm">Chat History</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <button
                type="button"
                onClick={() => startNewChat()}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-foreground text-background text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                Start New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1">
              {threads.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveId(t.id);
                    setMode(t.mode || 'auto');
                    setDrawerOpen(false);
                  }}
                  className={`flex min-h-[46px] items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${
                    t.id === activeThread?.id
                      ? 'bg-indigo-500/12 font-semibold text-foreground'
                      : 'text-muted-foreground active:bg-muted'
                  }`}
                >
                  <span className="truncate">{t.title}</span>
                  <button
                    type="button"
                    aria-label="Delete thread"
                    onClick={(e) => deleteThread(t.id, e)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Top Bar (safe-area aware, 44px touch targets) */}
        <header
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
          className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border/60 bg-background/90 px-3 py-2 backdrop-blur-md sm:px-5"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/home')}
              aria-label="Back to Home"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted active:scale-95 lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open Chat History"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted active:scale-95 lg:hidden"
            >
              <History className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold tracking-tight">NikNote Asta</span>
                  <span className="rounded-full bg-indigo-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                    Ultra
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              aria-label="Select AI Model"
              value={modelChoice}
              onChange={(e) => setModelChoice(e.target.value as AstaModelChoice)}
              className="h-9 max-w-[152px] sm:max-w-[195px] rounded-xl border border-border/80 bg-muted/50 px-2.5 text-xs font-medium text-foreground focus:outline-none"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => startNewChat()}
              aria-label="New Chat"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted active:scale-95 lg:hidden"
            >
              <Plus className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setKeysModalOpen(true)}
              aria-label="AI Provider Settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted active:scale-95 lg:hidden"
            >
              <KeyRound className="h-4 w-4 text-indigo-500" />
            </button>
          </div>
        </header>

        {/* Specialist Mode Pill Strip */}
        <div className="border-b border-border/40 bg-background/80 px-3 py-2">
          <div className="mx-auto flex max-w-4xl items-center gap-1.5 overflow-x-auto no-scrollbar">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                    active
                      ? 'bg-foreground text-background shadow-xs'
                      : 'border border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation Area */}
        <main className="flex-1 overflow-y-auto px-3.5 py-5 sm:px-6 pb-[calc(11rem+env(safe-area-inset-bottom))] md:pb-44">
          <div className="mx-auto max-w-3xl space-y-6">
            {(!activeThread || activeThread.messages.length === 0) ? (
              <div className="py-6 sm:py-12">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-lg">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                    How can Asta Ultra help you today?
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
                    Deep step-by-step reasoning, Hinglish + English mastery, live interactive quizzes, homework photo solver & 1-tap Save to Notes.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STARTER_CARDS.map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => sendMessage(card.prompt, card.mode)}
                      className="flex flex-col items-start gap-1 rounded-2xl border border-border/80 bg-card/80 p-4 text-left shadow-2xs transition-all hover:border-indigo-500/50 hover:bg-muted/40 active:scale-[0.99]"
                    >
                      <span className="text-sm font-semibold text-foreground">{card.title}</span>
                      <span className="text-xs text-muted-foreground">{card.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeThread.messages.map((msg, idx) => {
                const isLastAssistant =
                  msg.role === 'assistant' && idx === activeThread.messages.length - 1;
                const streamingNow = isLastAssistant && isStreaming;

                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-[15px] leading-relaxed text-background shadow-2xs">
                        {msg.images && msg.images.length > 0 && (
                          <div className="mb-2.5 flex flex-wrap gap-2">
                            {msg.images.map((im, i) => (
                              <img
                                key={i}
                                src={im.dataUrl}
                                alt={im.name || 'Attached'}
                                className="max-h-44 rounded-xl object-cover border border-white/20"
                              />
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                }

                const thoughtText = streamingNow && liveThinking ? liveThinking : msg.thinking;
                const thoughtOpen = Boolean(expandedThoughts[msg.id]);

                return (
                  <div key={msg.id} className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-foreground">Asta Ultra</span>
                      {msg.model && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                          {msg.model}
                        </span>
                      )}
                    </div>

                    {/* Reasoning / Deep Think Accordion */}
                    {thoughtText && (
                      <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/[0.04] px-3.5 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedThoughts((p) => ({ ...p, [msg.id]: !p[msg.id] }))
                          }
                          className="flex w-full items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
                        >
                          {thoughtOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {streamingNow && !msg.content ? 'Reasoning deeply…' : 'View Reasoning Steps'}
                          </span>
                        </button>
                        {thoughtOpen && (
                          <pre className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground font-sans">
                            {thoughtText}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Assistant Markdown Output */}
                    <div className="pl-0.5">
                      {msg.content ? (
                        <AstaMarkdown content={msg.content} isStreaming={streamingNow} />
                      ) : streamingNow ? (
                        <div className="inline-flex items-center gap-2 py-2 text-sm text-muted-foreground">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-500 [animation-delay:120ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-500 [animation-delay:240ms]" />
                          <span>Thinking…</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Message Action Bar */}
                    {!streamingNow && msg.content && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(msg.content).catch(() => {});
                            setCopiedId(msg.id);
                            setTimeout(() => setCopiedId(null), 1600);
                            toast.success('Copied response');
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
                        >
                          {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>Copy</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveAsNote(msg)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 active:scale-95"
                        >
                          <FilePlus2 className="h-3.5 w-3.5" />
                          <span>Save to Notes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSpeak(msg)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
                        >
                          {speakingId === msg.id ? <VolumeX className="h-3.5 w-3.5 text-indigo-500" /> : <Volume2 className="h-3.5 w-3.5" />}
                          <span>{speakingId === msg.id ? 'Stop' : 'Listen'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRegenerate(idx)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    )}

                    {/* Smart Follow-up Chips on latest turn */}
                    {isLastAssistant && !streamingNow && msg.followUps && msg.followUps.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {msg.followUps.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => sendMessage(f)}
                            className="min-h-[38px] rounded-xl border border-border/80 bg-muted/40 px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/[0.08] active:scale-[0.99]"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
        </main>

        {/* Bottom Composer — sits cleanly above MobileNavigation (80px) on mobile, flush on desktop */}
        <div
          className="fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 bg-gradient-to-t from-background via-background/95 to-transparent px-3 pt-2 pb-1.5 lg:left-[272px] md:bottom-0 md:pb-4"
        >
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card shadow-lg">
            {/* Attached Note / Images Preview */}
            {(attachedNote || images.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 pt-2.5 pb-2">
                {attachedNote && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/12 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span className="max-w-[180px] truncate">{attachedNote.title}</span>
                    <button type="button" onClick={() => setAttachedNote(null)} aria-label="Detach note">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
                {images.map((im, idx) => (
                  <div key={idx} className="relative">
                    <img src={im.dataUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
                    <button
                      type="button"
                      onClick={() => setImages((p) => p.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-1.5 p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onPickImages}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach photo or homework image"
                title="Attach photo or homework image"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
              >
                <Camera className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setNotesPickerOpen(true)}
                aria-label="Attach a saved NikNote"
                title="Attach a saved NikNote as context"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95"
              >
                <BookOpen className="h-5 w-5" />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={currentModeMeta.hint}
                className="max-h-[160px] min-h-[42px] flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none"
              />

              <button
                type="button"
                onClick={toggleVoiceInput}
                aria-label="Voice input"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors active:scale-95 ${
                  listening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
              </button>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  aria-label="Stop generating"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background active:scale-95"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!input.trim() && images.length === 0}
                  onClick={() => sendMessage()}
                  aria-label="Send message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs transition-all disabled:opacity-35 hover:bg-indigo-500 active:scale-95"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attach Saved Note Modal */}
      {notesPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setNotesPickerOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">Attach a Note to Asta AI</h3>
              <button type="button" onClick={() => setNotesPickerOpen(false)} className="p-2 rounded-full hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            {savedNotes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No local notes saved yet — write a note in Notes first or ask Asta to create one!
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {savedNotes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setAttachedNote(n);
                      setNotesPickerOpen(false);
                      toast.success(`Attached "${n.title}"`);
                    }}
                    className="flex w-full flex-col items-start rounded-xl border border-border/60 p-3 text-left hover:bg-muted"
                  >
                    <span className="font-semibold text-sm">{n.title}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{n.content || 'Empty note'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Optional AI Provider Keys Modal */}
      {keysModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setKeysModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">⚡ Cloud AI Engine Settings</h3>
              <button type="button" onClick={() => setKeysModalOpen(false)} className="p-2 rounded-full hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              On <strong>niknote.online</strong>, server-side Groq + Gemini keys run automatically. For custom model overrides or local development, you can optionally store personal keys privately on this device.
            </p>
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Groq API Key (Llama 3.3 70B / GPT-OSS 120B)</label>
                <input
                  type="password"
                  value={keyDraft.groqKey || ''}
                  onChange={(e) => setKeyDraft((k) => ({ ...k, groqKey: e.target.value }))}
                  placeholder="gsk_..."
                  className="w-full h-10 rounded-xl border border-border bg-muted/40 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Google Gemini API Key (Gemini 2.5 Pro / Flash)</label>
                <input
                  type="password"
                  value={keyDraft.geminiKey || ''}
                  onChange={(e) => setKeyDraft((k) => ({ ...k, geminiKey: e.target.value }))}
                  placeholder="AIza..."
                  className="w-full h-10 rounded-xl border border-border bg-muted/40 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">OpenAI API Key (GPT-4o)</label>
                <input
                  type="password"
                  value={keyDraft.openaiKey || ''}
                  onChange={(e) => setKeyDraft((k) => ({ ...k, openaiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full h-10 rounded-xl border border-border bg-muted/40 px-3 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKeysModalOpen(false)}
                className="h-10 rounded-xl px-4 text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  saveCustomAIKeys(keyDraft);
                  setKeysModalOpen(false);
                  toast.success('AI provider keys saved to this device');
                }}
                className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile 5-Tab Navigation Bar */}
      {!embedded && (
        <div className="nn-mobile min-h-0 md:hidden">
          <MobileNavigation active="ai" />
        </div>
      )}
    </div>
  );
};

export default AstaAIWorkspace;
