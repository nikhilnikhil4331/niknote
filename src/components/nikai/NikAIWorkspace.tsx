// ============================================================================
// NikAI — Single Unified Flagship Intelligence of NikNote
// Powered by Astra Neural Core · Persistent Cross-Session Memory ·
// 1-Tap Multi-Ink Handwriting & Smart Notes Architect · Live Thinking Mini-Game
// ============================================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Plus, Sparkles, Brain, Code2, BookOpen, Calculator, ListChecks,
  PenTool, Zap, Paperclip, Mic, MicOff, Volume2, VolumeX, Copy, Check,
  BookmarkPlus, RotateCcw, Square, Trash2, Menu, X, KeyRound, ChevronDown,
  FileText, ArrowLeft, Image as ImageIcon, Search, Gamepad2, Layers, Feather,
  PlusCircle, Sparkle, MessageCircle, MessageSquare, Target, GraduationCap,
  ClipboardPen, CodeXml, ArrowUp, ArrowRight, ChevronsLeft, PanelLeft,
  BrainCircuit, Crown, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AstaMarkdown } from '@/components/asta/AstaMarkdown';
import {
  NikAIBrand,
  NikAIStarConstellation,
  NikAILogoMark,
  NikAIIconGradients,
} from '@/components/nikai/NikAIBrand';
import { NikAIThinkingArena } from '@/components/nikai/NikAIThinkingArena';
import {
  loadNikAIMemory,
  learnFromConversationTurn,
  addManualMemoryFact,
  deleteMemoryFact,
  clearAllNikAIMemory,
  buildNikAIMemoryPrompt,
  type NikAIMemoryStore,
} from '@/lib/nikaiMemory';
import {
  implementNikAINote,
  extractAndSaveFlashcardsFromMarkdown,
} from '@/lib/nikaiNotesBridge';
import {
  streamAstaAI,
  probeAstaProviders,
  readCustomAIKeys,
  saveCustomAIKeys,
  type AstaMode,
  type AstaModelChoice,
  type AstaImageAttachment,
} from '@/lib/aiEngine';

export interface NikAIWorkspaceProps {
  embedded?: boolean;
  onClose?: () => void;
  noteTitle?: string;
  noteContent?: string;
  onInsertContent?: (markdown: string) => void;
}

export interface NikAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  images?: AstaImageAttachment[];
  model?: string;
  provider?: string;
  latencyMs?: number;
  followUps?: string[];
  savedNoteId?: string;
  createdAt: number;
}

interface NikAIThread {
  id: string;
  title: string;
  mode: AstaMode;
  messages: NikAIMessage[];
  updatedAt: number;
}

interface NotePickerItem {
  id: string;
  title: string;
  preview: string;
}

const THREADS_KEY = 'niknote.nikai.threads.v1';
const LEGACY_THREADS_KEY = 'niknote.asta.threads.v2';
const ACTIVE_THREAD_KEY = 'niknote.nikai.activeThread.v1';

const MODE_DEFS: {
  id: AstaMode;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  badgeColor: string;
  placeholder: string;
}[] = [
  {
    id: 'auto',
    label: 'Astra Auto',
    shortLabel: 'Astra Auto',
    icon: Sparkles,
    badgeColor: '#7C3AED',
    placeholder: 'Ask NikAI anything...',
  },
  {
    id: 'notes',
    label: 'Smart Notes',
    shortLabel: 'Notes Architect',
    icon: Feather,
    badgeColor: '#DB2777',
    placeholder: 'Topic likho — NikAI structured multi-ink notebook notes + flashcards bana dega…',
  },
  {
    id: 'deep',
    label: 'Astra Pro Deep',
    shortLabel: 'Astra Pro',
    icon: Brain,
    badgeColor: '#5B1BC9',
    placeholder: 'Complex proofs, JEE/NEET derivations, multi-step logic & research…',
  },
  {
    id: 'teacher',
    label: 'Master Guru',
    shortLabel: 'Guru',
    icon: BookOpen,
    badgeColor: '#D97706',
    placeholder: 'Zero se advanced tak desi analogy + exam pro-tips ke saath samjho…',
  },
  {
    id: 'solver',
    label: 'Math & Science',
    shortLabel: 'Solver',
    icon: Calculator,
    badgeColor: '#059669',
    placeholder: 'Paste equation, numerical, or attach homework photo for step-by-step solution…',
  },
  {
    id: 'code',
    label: 'Astra Coder',
    shortLabel: 'Coder',
    icon: Code2,
    badgeColor: '#2563EB',
    placeholder: 'Build full apps, debug errors, write DSA algorithms or SQL queries…',
  },
  {
    id: 'quiz',
    label: 'Live Quiz',
    shortLabel: 'Live Quiz',
    icon: ListChecks,
    badgeColor: '#EA580C',
    placeholder: 'Enter any chapter or subject to launch an interactive 5-MCQ test…',
  },
  {
    id: 'write',
    label: 'Writing Studio',
    shortLabel: 'Writer',
    icon: PenTool,
    badgeColor: '#E11D48',
    placeholder: 'Draft essays, emails, summaries, SOPs, or translate naturally…',
  },
];

const MODEL_OPTIONS: { id: AstaModelChoice; label: string; sub: string }[] = [
  { id: 'astra-auto', label: 'Astra Neural Auto', sub: 'Best model per task · Instant streaming' },
  { id: 'astra-pro', label: 'Astra Pro 120B', sub: 'Maximum reasoning, STEM & deep analysis' },
  { id: 'astra-flash', label: 'Astra Flash', sub: 'Sub-second ultra-fast responses' },
  { id: 'astra-vision', label: 'Astra Vision 2.5', sub: 'Handwriting, diagrams & photo solver' },
  { id: 'astra-coder', label: 'Astra Coder Pro', sub: 'Clean architecture, debugging & DSA' },
];

/** Left-rail primary nav (exactly the 5 destinations in the NikAI home design). */
const SIDEBAR_NAV: { id: string; label: string; mode: AstaMode; icon: React.ElementType }[] = [
  { id: 'chat', label: 'Chat', mode: 'auto', icon: MessageCircle },
  { id: 'notes', label: 'Smart Notes', mode: 'notes', icon: Feather },
  { id: 'quiz', label: 'Quiz', mode: 'quiz', icon: Target },
  { id: 'writing', label: 'Writing Studio', mode: 'write', icon: FileText },
  { id: 'code', label: 'Code', mode: 'code', icon: Code2 },
];

/** Home hero action cards. */
const HERO_CARDS: {
  mode: AstaMode;
  title: string;
  description: string;
  prompt: string;
  icon: React.ElementType;
  stroke: string;
  background: string;
}[] = [
  {
    mode: 'notes',
    title: 'Smart Notes',
    description: 'Turn any topic into beautiful, structured handwritten-ready notes.',
    prompt: 'Thermodynamics (Laws, Enthalpy, Entropy & Gibbs Free Energy) ke complete color-coded exam Smart Notes banao with key formulas, comparison table, aur memory tricks!',
    icon: ClipboardPen,
    stroke: 'url(#nikai-grad-violet)',
    background: 'linear-gradient(165deg, #F8F5FE 0%, #F2ECFD 100%)',
  },
  {
    mode: 'teacher',
    title: 'Learn a concept',
    description: 'Get simple explanations with examples and visual clarity.',
    prompt: 'Quantum Mechanics aur Heisenberg Uncertainty Principle ko bilkul zero se desi real-life analogy aur exam pro-tips ke saath Hinglish mein samjhao!',
    icon: GraduationCap,
    stroke: 'url(#nikai-grad-violet)',
    background: 'linear-gradient(165deg, #FFFCF5 0%, #FDF6E9 100%)',
  },
  {
    mode: 'quiz',
    title: 'Practice quiz',
    description: 'Generate MCQs, mock tests and instant feedback.',
    prompt: 'Create a 5-question interactive MCQ quiz on Indian Polity & Modern History from easy to exam-tough level.',
    icon: Target,
    stroke: 'url(#nikai-grad-pink)',
    background: 'linear-gradient(165deg, #FEF7FB 0%, #FDEEF7 100%)',
  },
  {
    mode: 'code',
    title: 'Write code',
    description: 'Build, debug and explain code in Python, TypeScript and more.',
    prompt: 'Write a production-ready LRU Cache in TypeScript using Map with O(1) get/put, edge cases, and step-by-step dry run.',
    icon: CodeXml,
    stroke: 'url(#nikai-grad-blue)',
    background: 'linear-gradient(165deg, #F5FAFE 0%, #EDF6FE 100%)',
  },
];

/** "2 hours ago" / "Yesterday" / "3 days ago" timestamps for Recent Chats. */
function formatRelativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSavedThreads(): NikAIThread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY) || localStorage.getItem(LEGACY_THREADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveThreadsToStorage(threads: NikAIThread[]): void {
  try {
    const compact = threads.slice(0, 45).map((t) => ({
      ...t,
      messages: t.messages.slice(-50).map((m) => ({
        ...m,
        images: m.images?.map((img) =>
          img.dataUrl.length > 180_000 ? { ...img, dataUrl: img.dataUrl } : img
        ),
      })),
    }));
    localStorage.setItem(THREADS_KEY, JSON.stringify(compact));
  } catch {
    try {
      const textOnly = threads.slice(0, 25).map((t) => ({
        ...t,
        messages: t.messages.slice(-30).map(({ images: _omit, ...rest }) => rest),
      }));
      localStorage.setItem(THREADS_KEY, JSON.stringify(textOnly));
    } catch {
      // ignore quota failure
    }
  }
}

async function compressImageFile(file: File): Promise<AstaImageAttachment> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

  if (rawDataUrl.length < 350_000 || typeof Image === 'undefined') {
    return { name: file.name, mimeType: file.type || 'image/jpeg', dataUrl: rawDataUrl };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1280;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ name: file.name, mimeType: file.type || 'image/jpeg', dataUrl: rawDataUrl });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ name: file.name, mimeType: 'image/jpeg', dataUrl: compressed });
      } catch {
        resolve({ name: file.name, mimeType: file.type || 'image/jpeg', dataUrl: rawDataUrl });
      }
    };
    img.onerror = () => resolve({ name: file.name, mimeType: file.type || 'image/jpeg', dataUrl: rawDataUrl });
    img.src = rawDataUrl;
  });
}

export const NikAIWorkspace: React.FC<NikAIWorkspaceProps> = ({
  embedded = false,
  onClose,
  noteTitle,
  noteContent,
  onInsertContent,
}) => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data?.session?.user?.id);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const [threads, setThreads] = useState<NikAIThread[]>(() => loadSavedThreads());
  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_THREAD_KEY) || '';
    } catch {
      return '';
    }
  });
  const [mode, setMode] = useState<AstaMode>('auto');
  const [modelChoice, setModelChoice] = useState<AstaModelChoice>('astra-auto');
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<AstaImageAttachment[]>([]);
  const [attachedNote, setAttachedNote] = useState<NotePickerItem | null>(() =>
    noteContent && noteContent.trim()
      ? {
          id: 'active-editor-note',
          title: noteTitle || 'Open Note',
          preview: noteContent.slice(0, 12000),
        }
      : null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveModelName, setLiveModelName] = useState('NikAI Astra Core');
  const [liveThinkingText, setLiveThinkingText] = useState('');
  const [cloudProviders, setCloudProviders] = useState<string[]>([]);

  // Persistent Cross-Session Memory State
  const [memoryState, setMemoryState] = useState<NikAIMemoryStore>(() => loadNikAIMemory());
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [newMemoryFact, setNewMemoryFact] = useState('');

  // Playable Mini-Game on demand OR auto during thinking
  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  // UI drawers & modals
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelMenuSource, setModelMenuSource] = useState<'header' | 'composer'>('header');
  const [keysModalOpen, setKeysModalOpen] = useState(false);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [availableNotes, setAvailableNotes] = useState<NotePickerItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [implementingId, setImplementingId] = useState<string | null>(null);

  const [groqInput, setGroqInput] = useState(() => readCustomAIKeys().groqKey || '');
  const [geminiInput, setGeminiInput] = useState(() => readCustomAIKeys().geminiKey || '');
  const [openaiInput, setOpenaiInput] = useState(() => readCustomAIKeys().openaiKey || '');

  const abortRef = useRef<AbortController | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Sync live open note from Editor when embedded
  useEffect(() => {
    if (noteContent && noteContent.trim()) {
      setAttachedNote({
        id: 'active-editor-note',
        title: noteTitle || 'Open Note',
        preview: noteContent.slice(0, 12000),
      });
    }
  }, [noteTitle, noteContent]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const currentModeDef = useMemo(
    () => MODE_DEFS.find((m) => m.id === mode) || MODE_DEFS[0],
    [mode]
  );

  const memoryCount = useMemo(() => {
    let count = memoryState.facts.length + memoryState.sessionDigests.length;
    if (memoryState.userName) count += 1;
    if (memoryState.examOrRole) count += 1;
    return count;
  }, [memoryState]);

  useEffect(() => {
    saveThreadsToStorage(threads);
  }, [threads]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_THREAD_KEY, activeThreadId);
    } catch {
      // ignore
    }
  }, [activeThreadId]);

  useEffect(() => {
    let cancelled = false;
    probeAstaProviders().then((res) => {
      if (!cancelled) setCloudProviders(res.providers);
    });
    return () => {
      cancelled = true;
    };
  }, [keysModalOpen]);

  useEffect(() => {
    // Only auto-scroll inside an actual conversation. On the home screen the
    // sentinel sits below the hero, so scrolling to it hid the greeting.
    if (!activeThreadId) return;
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThreadId, activeThread?.messages.length, isGenerating, playgroundOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  const loadNotesForPicker = useCallback(async () => {
    const items: NotePickerItem[] = [];
    if (noteContent && noteContent.trim()) {
      items.push({
        id: 'active-editor-note',
        title: `✨ ${noteTitle || 'Currently Open Note'}`,
        preview: noteContent.slice(0, 12000),
      });
    }
    try {
      const mobileRaw = JSON.parse(localStorage.getItem('niknote.mobile.notebooks.v1') || '[]');
      for (const nb of (Array.isArray(mobileRaw) ? mobileRaw : []).slice(0, 15)) {
        const text = Array.isArray(nb.blocks)
          ? nb.blocks.map((b: any) => b.content || '').filter(Boolean).join('\n')
          : String(nb.content || '');
        items.push({
          id: nb.id,
          title: nb.title || 'Untitled Note',
          preview: text.slice(0, 8000) || nb.title || 'Empty note',
        });
      }
      const notesRaw = JSON.parse(localStorage.getItem('niknote.notes.v1') || '[]');
      for (const n of (Array.isArray(notesRaw) ? notesRaw : []).slice(0, 15)) {
        if (!items.some((x) => x.id === n.id)) {
          items.push({
            id: n.id,
            title: n.title || 'Untitled Note',
            preview: String(n.content || '').slice(0, 8000) || n.title || 'Empty note',
          });
        }
      }
    } catch {
      // ignore local storage issues
    }

    if (userId) {
      try {
        const { data } = await supabase
          .from('notes')
          .select('id, title, content')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(20);
        if (data) {
          for (const n of data) {
            if (!items.some((x) => x.id === n.id)) {
              const rawText = String(n.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              items.push({
                id: n.id,
                title: n.title || 'Untitled Cloud Note',
                preview: rawText.slice(0, 8000),
              });
            }
          }
        }
      } catch {
        // ignore network issues
      }
    }
    setAvailableNotes(items);
  }, [userId, noteTitle, noteContent]);

  const startNewChat = useCallback((nextMode?: AstaMode) => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setLiveThinkingText('');
    setActiveThreadId('');
    if (nextMode) setMode(nextMode);
    setInput('');
    setPendingImages([]);
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, []);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setLiveThinkingText('');
  }, []);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: AstaImageAttachment[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }
      try {
        const compressed = await compressImageFile(file);
        added.push(compressed);
      } catch {
        toast.error(`Could not attach ${file.name}`);
      }
    }
    if (added.length > 0) {
      setPendingImages((prev) => [...prev, ...added].slice(0, 4));
      toast.success(`${added.length} image attached to NikAI Vision`);
    }
  }, []);

  const toggleVoiceInput = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error('Voice input is not supported in this browser');
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = 'en-IN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (event.results[event.results.length - 1]?.isFinal) {
          setInput((prev) => `${prev ? `${prev} ` : ''}${transcript.trim()}`);
        }
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening]);

  const toggleSpeakMessage = useCallback((msg: NikAIMessage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Text-to-speech is unavailable in this browser');
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingId === msg.id) {
      setSpeakingId(null);
      return;
    }
    const plain = msg.content
      .replace(/```[\s\S]*?```/g, ' code block. ')
      .replace(/[#*_>`~[\]()|-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const utter = new SpeechSynthesisUtterance(plain.slice(0, 4000));
    utter.rate = 1.02;
    utter.onend = () => setSpeakingId(null);
    utter.onerror = () => setSpeakingId(null);
    setSpeakingId(msg.id);
    window.speechSynthesis.speak(utter);
  }, [speakingId]);

  const handleImplementNote = useCallback(
    async (msg: NikAIMessage, openHandwriting: boolean) => {
      if (implementingId) return;
      setImplementingId(msg.id);
      try {
        const res = await implementNikAINote({
          markdown: msg.content,
          fallbackTitle: activeThread?.title || 'NikAI Smart Note',
          userId,
          prepareEditorOpen: openHandwriting,
        });

        setThreads((prev) =>
          prev.map((t) => ({
            ...t,
            messages: t.messages.map((m) =>
              m.id === msg.id ? { ...m, savedNoteId: res.notebookId } : m
            ),
          }))
        );

        const cardSuffix =
          res.flashcardCount > 0 ? ` + ${res.flashcardCount} Flashcards!` : '';

        if (openHandwriting) {
          toast.success(`Opening "${res.title}" (${res.blockCount} multi-ink blocks)${cardSuffix}`);
          navigate(`/?editor=1&notebook=${encodeURIComponent(res.notebookId)}`);
        } else {
          toast.success(`Saved "${res.title}" (${res.blockCount} structured blocks)${cardSuffix}`, {
            action: {
              label: 'Open Note ✍️',
              onClick: () => navigate(`/?editor=1&notebook=${encodeURIComponent(res.notebookId)}`),
            },
          });
        }
      } catch {
        toast.error('Could not save note right now');
      } finally {
        setImplementingId(null);
      }
    },
    [activeThread?.title, implementingId, navigate, userId]
  );

  const handleMakeFlashcardsOnly = useCallback((msg: NikAIMessage) => {
    const count = extractAndSaveFlashcardsFromMarkdown(
      activeThread?.title || 'NikAI Study Deck',
      msg.content
    );
    toast.success(`Created ${count} Study Flashcards from NikAI!`, {
      action: {
        label: 'Study Now',
        onClick: () => navigate('/flashcards'),
      },
    });
  }, [activeThread?.title, navigate]);

  const sendPrompt = useCallback(
    async (overridePrompt?: string, overrideMode?: AstaMode) => {
      const text = (overridePrompt !== undefined ? overridePrompt : input).trim();
      const imagesToSend = overridePrompt !== undefined ? [] : pendingImages;
      if ((!text && imagesToSend.length === 0) || isGenerating) return;

      const effectiveMode = overrideMode || mode;
      if (overrideMode && overrideMode !== mode) setMode(overrideMode);

      const userMsg: NikAIMessage = {
        id: uid(),
        role: 'user',
        content: text || 'Analyze this image thoroughly step by step.',
        images: imagesToSend.length > 0 ? imagesToSend : undefined,
        createdAt: Date.now(),
      };

      const assistantMsgId = uid();
      const placeholderAssistant: NikAIMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        thinking: '',
        createdAt: Date.now(),
      };

      const existingThread = threads.find((t) => t.id === activeThreadId);
      const targetThreadId = existingThread ? existingThread.id : uid();
      const historyForEngine: NikAIMessage[] = existingThread
        ? [...existingThread.messages, userMsg]
        : [userMsg];
      const titleSource = userMsg.content.replace(/\s+/g, ' ').trim();

      setThreads((prev) => {
        const found = prev.find((t) => t.id === targetThreadId);
        if (found) {
          return prev.map((t) =>
            t.id === targetThreadId
              ? {
                  ...t,
                  mode: effectiveMode,
                  updatedAt: Date.now(),
                  messages: [...t.messages, userMsg, placeholderAssistant],
                }
              : t
          );
        }
        const newThread: NikAIThread = {
          id: targetThreadId,
          title:
            titleSource.length > 46
              ? `${titleSource.slice(0, 44)}…`
              : titleSource || 'NikAI Session',
          mode: effectiveMode,
          updatedAt: Date.now(),
          messages: [userMsg, placeholderAssistant],
        };
        return [newThread, ...prev];
      });

      setActiveThreadId(targetThreadId);
      if (overridePrompt === undefined) {
        setInput('');
        setPendingImages([]);
      }
      setIsGenerating(true);
      setLiveThinkingText('');
      setLiveModelName('NikAI Astra Core');

      const controller = new AbortController();
      abortRef.current = controller;
      const freshMemoryPrompt = buildNikAIMemoryPrompt(targetThreadId);

      try {
        const noteCtx = attachedNote
          ? `Note Title: ${attachedNote.title}\n\n${attachedNote.preview}`
          : undefined;

        const result = await streamAstaAI({
          messages: historyForEngine.slice(-18).map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images,
          })),
          mode: effectiveMode,
          model: modelChoice,
          threadId: targetThreadId,
          noteContext: noteCtx,
          memoryContext: freshMemoryPrompt,
          signal: controller.signal,
          onMeta: (meta) => {
            setLiveModelName(meta.model);
            setThreads((prev) =>
              prev.map((t) =>
                t.id === targetThreadId
                  ? {
                      ...t,
                      messages: t.messages.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, model: meta.model, provider: meta.provider }
                          : m
                      ),
                    }
                  : t
              )
            );
          },
          onThinking: (_delta, fullThinking) => {
            setLiveThinkingText(fullThinking);
            setThreads((prev) =>
              prev.map((t) =>
                t.id === targetThreadId
                  ? {
                      ...t,
                      messages: t.messages.map((m) =>
                        m.id === assistantMsgId ? { ...m, thinking: fullThinking } : m
                      ),
                    }
                  : t
              )
            );
          },
          onToken: (_delta, fullText) => {
            setThreads((prev) =>
              prev.map((t) =>
                t.id === targetThreadId
                  ? {
                      ...t,
                      messages: t.messages.map((m) =>
                        m.id === assistantMsgId ? { ...m, content: fullText } : m
                      ),
                    }
                  : t
              )
            );
          },
        });

        setThreads((prev) =>
          prev.map((t) =>
            t.id === targetThreadId
              ? {
                  ...t,
                  updatedAt: Date.now(),
                  messages: t.messages.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: result.content,
                          thinking: result.thinking || m.thinking,
                          model: result.model,
                          provider: result.provider,
                          latencyMs: result.latencyMs,
                          followUps: result.followUps,
                        }
                      : m
                  ),
                }
              : t
          )
        );

        // Auto-learn user memory & cross-session history
        const updatedMem = learnFromConversationTurn(
          userMsg.content,
          result.content,
          targetThreadId,
          userMsg.content.length > 48
            ? `${userMsg.content.slice(0, 46)}…`
            : userMsg.content
        );
        setMemoryState(updatedMem);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setThreads((prev) =>
            prev.map((t) =>
              t.id === targetThreadId
                ? {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === assistantMsgId && !m.content
                        ? {
                            ...m,
                            content:
                              '⚠️ NikAI encountered a connection hiccup — hit **Regenerate** to continue immediately.',
                          }
                        : m
                    ),
                  }
                : t
            )
          );
        }
      } finally {
        setIsGenerating(false);
        setLiveThinkingText('');
      }
    },
    [
      threads,
      input,
      pendingImages,
      isGenerating,
      mode,
      activeThreadId,
      attachedNote,
      modelChoice,
    ]
  );

  const regenerateLast = useCallback(() => {
    if (!activeThread || isGenerating) return;
    const msgs = activeThread.messages;
    const lastUserIdx = [...msgs].map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) return;
    const lastUserMsg = msgs[lastUserIdx];
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id ? { ...t, messages: msgs.slice(0, lastUserIdx) } : t
      )
    );
    setTimeout(() => {
      sendPrompt(lastUserMsg.content, activeThread.mode);
    }, 20);
  }, [activeThread, isGenerating, sendPrompt]);

  const deleteThread = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeThreadId === id) setActiveThreadId('');
    },
    [activeThreadId]
  );

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [threads, searchQuery]);

  const activeMessages = activeThread?.messages || [];

  const activeModelLabel = (MODEL_OPTIONS.find((m) => m.id === modelChoice)?.label || '✦ Astra Neural Auto')
    .replace('✦ ', '');

  const modelMenuPanel = (align: 'left' | 'right') => (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
      <div
        className={`absolute ${
          align === 'right' ? 'right-0' : 'left-0'
        } z-50 mt-2 w-[288px] overflow-hidden rounded-2xl border border-[#EFE9FA] bg-white p-2 shadow-[0_28px_70px_-28px_rgba(76,29,149,0.42)]`}
      >
        <div className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A4BC]">
          Neural model
        </div>
        {MODEL_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setModelChoice(opt.id);
              setModelMenuOpen(false);
            }}
            className={`flex w-full items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
              modelChoice === opt.id ? 'bg-[#F5F0FE]' : 'hover:bg-[#FAF8FE]'
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-bold text-[#312E43]">{opt.label}</span>
              <span className="block text-[11px] leading-snug text-[#8B8AA0]">{opt.sub}</span>
            </span>
            {modelChoice === opt.id && (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7C3AED]" />
            )}
          </button>
        ))}
        <div className="my-1.5 h-px bg-[#F2EDFB]" />
        <div className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A8A4BC]">
          Specialist mode
        </div>
        <div className="grid grid-cols-2 gap-1">
          {MODE_DEFS.map((m) => {
            const Icon = m.icon;
            const isActive = m.id === mode;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  setModelMenuOpen(false);
                }}
                className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${
                  isActive ? 'bg-[#F5F0FE] text-[#6D28D9]' : 'text-[#4B5563] hover:bg-[#FAF8FE]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: m.badgeColor }} />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  const sidebarNavMode = SIDEBAR_NAV.find((n) => n.mode === mode)?.mode;

  return (
    <div
      data-nikai-root="true"
      className={`${
        embedded
          ? 'relative w-full h-full'
          : 'fixed inset-x-0 top-0 bottom-0 z-30'
      } flex overflow-hidden`}
      style={{
        backgroundColor: '#FBF9FE',
        backgroundImage:
          'radial-gradient(ellipse 70% 42% at 78% -8%, rgba(167,139,250,0.10), transparent 70%), radial-gradient(ellipse 60% 40% at 8% -6%, rgba(244,114,182,0.07), transparent 70%)',
        color: '#1E1B2E',
        fontFamily: "'Plus Jakarta Sans', Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <NikAIIconGradients />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && !embedded && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-[#1E103C]/25 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* ==================== LEFT RAIL ==================== */}
      {!embedded && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[290px] shrink-0 flex-col border-r border-[#EFE9FA] bg-[#FAF8FE] transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${sideCollapsed ? 'lg:hidden' : ''}`}
        >
          {/* Brand */}
          <div className="flex h-[78px] shrink-0 items-center gap-2 px-5">
            <NikAIBrand size="sm" />
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Collapse sidebar"
              className="ml-auto hidden h-8 w-8 items-center justify-center rounded-full border border-[#EFE9FA] bg-white text-[#64748B] transition-colors hover:border-[#DDD2F7] hover:text-[#7C3AED] lg:flex"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#EFE9FA] bg-white text-[#64748B] lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* New Chat */}
          <div className="px-4">
            <button
              type="button"
              onClick={() => startNewChat()}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(168,85,247,0.85)] transition-transform active:scale-[0.99]"
              style={{
                background:
                  'linear-gradient(96deg, #8B5CF6 0%, #A855F7 30%, #E256C6 66%, #FB8A6B 100%)',
              }}
            >
              <Plus className="h-[18px] w-[18px]" />
              New Chat
            </button>
          </div>

          {/* Primary nav */}
          <nav className="mt-4 space-y-1 px-3">
            {SIDEBAR_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = sidebarNavMode === item.mode;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.mode)}
                  className={`flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-[14px] transition-colors ${
                    isActive
                      ? 'bg-[#F1EBFE] font-semibold text-[#6D28D9]'
                      : 'font-medium text-[#334155] hover:bg-white'
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#7C3AED]' : 'text-[#1E293B]'}`}
                    strokeWidth={1.9}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mx-5 mt-4 shrink-0 border-t border-[#EFE9FA]" />

          {/* Recent chats */}
          <div className="flex shrink-0 items-center justify-between px-6 pb-1.5 pt-4">
            <span className="text-[12.5px] font-semibold text-[#64748B]">Recent Chats</span>
            <button
              type="button"
              aria-label="Search chats"
              onClick={() => searchInputRef.current?.focus()}
              className="text-[#94A3B8] transition-colors hover:text-[#7C3AED]"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
            {filteredThreads.length === 0 ? (
              <p className="px-3 py-6 text-center text-[11.5px] leading-relaxed text-[#A5A3B8]">
                {searchQuery.trim()
                  ? 'No chats match your search.'
                  : 'No chats yet — start a new conversation and it will appear here.'}
              </p>
            ) : (
              filteredThreads.map((t) => {
                const isActive = t.id === activeThreadId;
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveThreadId(t.id);
                      setMode(t.mode || 'auto');
                      setSidebarOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setActiveThreadId(t.id);
                        setMode(t.mode || 'auto');
                      }
                    }}
                    className={`group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 transition-colors ${
                      isActive ? 'bg-[#F3EDFE]' : 'hover:bg-white'
                    }`}
                  >
                    <MessageSquare
                      className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#7C3AED]' : 'text-[#94A3B8]'}`}
                      strokeWidth={1.9}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-[12.5px] ${
                          isActive ? 'font-semibold text-[#5B21B6]' : 'text-[#334155]'
                        }`}
                      >
                        {t.title}
                      </span>
                      <span className="block text-[10.5px] text-[#A5A3B8]">
                        {formatRelativeTime(t.updatedAt)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => deleteThread(t.id, e)}
                      aria-label="Delete chat"
                      className="rounded-lg p-1 text-[#A5A3B8] opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Upgrade card */}
          <div className="shrink-0 p-3">
            <button
              type="button"
              onClick={() => navigate('/upgrade')}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-[#F6DDEA] bg-gradient-to-r from-[#FDF3F9] via-[#FDF1F7] to-[#FEF7EF] px-3.5 py-3 text-left transition-transform active:scale-[0.99]"
            >
              <Crown className="h-[18px] w-[18px] shrink-0 fill-amber-400 text-amber-400" />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-bold text-[#DB2777]">Upgrade to NikAI Pro</span>
                <span className="block text-[10.5px] text-[#9A8798]">More power, higher limits</span>
              </span>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[#D9B9C9]" />
            </button>
          </div>
        </aside>
      )}

      {/* ==================== MAIN ==================== */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {/* Dreamy landscape backdrop */}
        {activeMessages.length === 0 && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[47%] overflow-hidden">
            <div
              className="absolute inset-0 bg-cover opacity-[0.88]"
              style={{
                backgroundImage: "url('/nikai/hero-landscape.jpg')",
                backgroundPosition: 'center 68%',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(251,249,254,0.10) 30%, rgba(251,249,254,0.62) 62%, rgba(251,249,254,0.94) 86%, #FBF9FE 100%)',
              }}
            />
          </div>
        )}

        {/* Top bar */}
        <header className="relative z-20 flex h-[78px] shrink-0 items-center gap-2 px-4 sm:px-7">
          {!embedded && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EFE9FA] bg-white/90 text-[#475569] lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          {!embedded && sideCollapsed && (
            <button
              type="button"
              onClick={() => setSideCollapsed(false)}
              aria-label="Show sidebar"
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-[#EFE9FA] bg-white/90 text-[#475569] hover:text-[#7C3AED] lg:flex"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}

          <div className="relative w-full max-w-[430px]">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              aria-label="Search chats"
              className="h-11 w-full rounded-2xl border border-[#EFE9FA] bg-white/85 pl-11 pr-4 text-[13.5px] sm:pr-20 text-[#334155] placeholder:text-[#A5A3B8] focus:border-[#D8C8F8] focus:outline-none focus:ring-2 focus:ring-[#EDE4FE]"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-lg bg-[#F4F1FA] px-2 py-[3px] text-[10.5px] font-semibold text-[#8B8AA0] sm:block">
              Ctrl K
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {embedded && <NikAIBrand size="sm" showBadge={false} />}

            <button
              type="button"
              onClick={() => setMemoryOpen(true)}
              data-testid="nikai-memory-btn"
              title="NikAI persistent memory"
              className="flex h-11 items-center gap-2 rounded-2xl border border-[#EFE9FA] bg-white/85 px-3 text-[13px] font-semibold text-[#334155] transition-colors hover:border-[#DDD2F7]"
            >
              <BrainCircuit className="h-[17px] w-[17px] text-[#7C3AED]" strokeWidth={1.9} />
              <span className="hidden sm:inline">Memory</span>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[10.5px] font-bold text-white">
                {memoryCount}
              </span>
            </button>

            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => {
                  setModelMenuSource('header');
                  setModelMenuOpen((v) => (modelMenuSource === 'header' ? !v : true));
                }}
                className="flex h-11 items-center gap-2 rounded-2xl border border-[#EFE9FA] bg-white/85 px-3.5 text-[13px] font-semibold text-[#312E43] transition-colors hover:border-[#DDD2F7]"
              >
                <Sparkles className="h-[15px] w-[15px] text-[#8B5CF6]" />
                <span className="max-w-[150px] truncate">{activeModelLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[#8B8AA0]" />
              </button>
              {modelMenuOpen && modelMenuSource === 'header' && modelMenuPanel('right')}
            </div>

            <button
              type="button"
              onClick={() => setPlaygroundOpen((v) => !v)}
              data-testid="nikai-game-btn"
              title="NikAI Star Catch mini-game"
              className={`hidden h-11 w-11 items-center justify-center rounded-2xl border transition-colors sm:flex ${
                playgroundOpen
                  ? 'border-transparent bg-gradient-to-r from-[#8B5CF6] via-[#DB2777] to-[#FB923C] text-white'
                  : 'border-[#EFE9FA] bg-white/85 text-[#7C3AED] hover:border-[#DDD2F7]'
              }`}
            >
              <Gamepad2 className="h-[17px] w-[17px]" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/account')}
              aria-label="Your account"
              className="flex h-11 w-11 items-center justify-center rounded-full p-[2px]"
              style={{ background: 'linear-gradient(140deg, #C4B5FD 0%, #F9A8D4 55%, #FDBA74 100%)' }}
            >
              <span className="flex h-full w-full items-center justify-center rounded-full bg-white p-[2px]">
                <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#DB2777] text-[13px] font-bold text-white">
                  {(memoryState.userName || 'N').trim().charAt(0).toUpperCase()}
                </span>
              </span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close NikAI panel"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EFE9FA] bg-white/85 text-[#64748B] hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {/* Body */}
        <div
          data-scrollable="true"
          className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-2 sm:px-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="mx-auto w-full max-w-[1120px]">
            <AnimatePresence>
              {playgroundOpen && !isGenerating && (
                <NikAIThinkingArena
                  isStreaming={false}
                  forceOpen
                  modelName={liveModelName}
                  onCloseManual={() => setPlaygroundOpen(false)}
                />
              )}
            </AnimatePresence>

            {activeMessages.length === 0 ? (
              /* ---------------- HOME (hero) ---------------- */
              <div className="pb-4">
                <div className="flex flex-col items-center pt-1 text-center sm:pt-6">
                  <NikAILogoMark size={embedded ? 74 : 96} animate="idle" />
                  <h1 className="mt-4 text-[27px] font-extrabold leading-tight tracking-[-0.02em] text-[#1E1B2E] sm:text-[42px]">
                    What can I help you{' '}
                    <span
                      style={{
                        backgroundImage:
                          'linear-gradient(96deg, #8B5CF6 0%, #C026D3 42%, #EC4899 72%, #FB8C5A 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                      }}
                    >
                      create
                    </span>
                    <span className="text-[#FB8C5A]">?</span>
                  </h1>
                  <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#64748B] sm:text-[14.5px]">
                    Your AI companion for learning, notes, quizzes, writing and coding.
                  </p>
                  {memoryState.userName && (
                    <p className="mt-1.5 text-[11.5px] font-semibold text-[#8B5CF6]">
                      Welcome back, {memoryState.userName}
                    </p>
                  )}
                </div>

                <div
                  className={`mt-5 grid gap-2.5 sm:mt-6 sm:gap-3.5 ${
                    embedded ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-4'
                  }`}
                >
                  {HERO_CARDS.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.title}
                        type="button"
                        onClick={() => sendPrompt(card.prompt, card.mode)}
                        className="group flex flex-col rounded-[18px] border border-[#F1ECFB] p-3.5 text-left sm:rounded-[20px] sm:p-5 shadow-[0_16px_40px_-32px_rgba(109,40,217,0.55)] transition-all hover:-translate-y-0.5 hover:border-[#E5D9FA] hover:shadow-[0_22px_48px_-30px_rgba(109,40,217,0.45)] active:scale-[0.995] sm:min-h-[176px] sm:p-5"
                        style={{ background: card.background }}
                      >
                        <Icon
                          className="h-[22px] w-[22px] sm:h-[26px] sm:w-[26px]"
                          strokeWidth={2}
                          style={{ stroke: card.stroke, fill: 'none' }}
                        />
                        <span className="mt-3 block text-[13.5px] font-bold leading-tight text-[#1E1B2E] sm:mt-3.5 sm:text-[15.5px]">
                          {card.title}
                        </span>
                        <span className="mt-1 block text-[11.5px] leading-[1.5] text-[#6B7280] sm:mt-1.5 sm:text-[13px]">
                          {card.description}
                        </span>
                        <span className="mt-3 ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#F1ECFB] bg-white/90 text-[#6D28D9] shadow-sm transition-transform group-hover:translate-x-0.5 sm:mt-auto">
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ---------------- CONVERSATION ---------------- */
              <div className="mx-auto max-w-[860px] space-y-6 pb-4 pt-1">
                {activeMessages.map((msg, idx) => {
                  const isLastAssistant =
                    msg.role === 'assistant' && idx === activeMessages.length - 1;
                  const isCurrentlyStreaming = isLastAssistant && isGenerating;

                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div
                          className="max-w-[88%] rounded-[20px] rounded-tr-md px-4 py-3 text-white shadow-[0_16px_34px_-22px_rgba(109,40,217,0.8)] sm:max-w-[76%]"
                          style={{
                            background:
                              'linear-gradient(115deg, #7C3AED 0%, #A855F7 48%, #EC4899 100%)',
                          }}
                        >
                          {msg.images && msg.images.length > 0 && (
                            <div className="mb-2.5 flex flex-wrap gap-2">
                              {msg.images.map((img, i) => (
                                <img
                                  key={i}
                                  src={img.dataUrl}
                                  alt={img.name || 'Attachment'}
                                  className="h-24 w-24 rounded-xl border border-white/25 object-cover"
                                />
                              ))}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#EFE9FA] bg-white">
                          <NikAILogoMark size={22} animate={isCurrentlyStreaming ? 'fast' : false} />
                        </span>
                        <img
                          src="/nikai/nikai-wordmark.png"
                          alt="NikAI"
                          className="w-auto select-none"
                          style={{ width: 74 }}
                          draggable={false}
                        />
                        {msg.model && (
                          <span className="rounded-full bg-[#F5F0FE] px-2 py-0.5 text-[10.5px] font-bold text-[#6D28D9]">
                            {msg.model}
                            {msg.latencyMs ? ` · ${(msg.latencyMs / 1000).toFixed(1)}s` : ''}
                          </span>
                        )}
                      </div>

                      {isCurrentlyStreaming && (
                        <NikAIThinkingArena
                          isStreaming
                          modelName={liveModelName}
                          thinkingText={liveThinkingText || msg.thinking}
                        />
                      )}

                      {!isCurrentlyStreaming && msg.thinking && (
                        <details className="rounded-xl border border-[#EFE9FA] bg-white/70 px-3.5 py-2 text-xs text-[#5B21B6]">
                          <summary className="flex cursor-pointer select-none items-center gap-1.5 font-bold">
                            <Brain className="h-3.5 w-3.5 text-[#7C3AED]" />
                            View Astra thought process
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-[#64748B]">
                            {msg.thinking}
                          </p>
                        </details>
                      )}

                      {(msg.content || !isCurrentlyStreaming) && (
                        <div className="rounded-[20px] border border-[#F1ECFB] bg-white/95 px-4 py-3.5 shadow-[0_18px_46px_-36px_rgba(109,40,217,0.6)] sm:px-5">
                          <AstaMarkdown content={msg.content} isStreaming={isCurrentlyStreaming} />

                          {!isCurrentlyStreaming && msg.content && (
                            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#F4F1FA] pt-3">
                              {onInsertContent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onInsertContent(msg.content);
                                    toast.success('Inserted cleanly into your active Note!');
                                  }}
                                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all active:scale-95"
                                  style={{
                                    background: 'linear-gradient(100deg, #7C3AED 0%, #DB2777 100%)',
                                  }}
                                >
                                  <PlusCircle className="h-3.5 w-3.5" />
                                  Insert in Note
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={implementingId === msg.id}
                                onClick={() => handleImplementNote(msg, false)}
                                data-testid={`save-smart-note-${idx}`}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                                  msg.savedNoteId
                                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border border-[#EFE9FA] bg-[#F7F3FE] text-[#6D28D9] hover:bg-[#F1EAFE]'
                                }`}
                              >
                                <BookmarkPlus className="h-3.5 w-3.5" />
                                {msg.savedNoteId ? 'Saved Smart Note ✓' : 'Save Smart Note'}
                              </button>

                              <button
                                type="button"
                                disabled={implementingId === msg.id}
                                onClick={() => handleImplementNote(msg, true)}
                                className="flex items-center gap-1 rounded-lg border border-pink-200/80 bg-pink-50 px-2.5 py-1.5 text-xs font-bold text-pink-700 transition-colors hover:bg-pink-100"
                              >
                                <Feather className="h-3.5 w-3.5" />
                                Open in Handwriting
                              </button>

                              <button
                                type="button"
                                onClick={() => handleMakeFlashcardsOnly(msg)}
                                className="flex items-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100"
                              >
                                <Layers className="h-3.5 w-3.5" />
                                Flashcards
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(msg.content);
                                  setCopiedId(msg.id);
                                  setTimeout(() => setCopiedId(null), 1800);
                                }}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#FAF8FE] hover:text-[#1E1B2E]"
                              >
                                {copiedId === msg.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => toggleSpeakMessage(msg)}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#FAF8FE] hover:text-[#1E1B2E]"
                              >
                                {speakingId === msg.id ? (
                                  <>
                                    <VolumeX className="h-3.5 w-3.5 text-rose-600" />
                                    Stop
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="h-3.5 w-3.5" />
                                    Listen
                                  </>
                                )}
                              </button>

                              {isLastAssistant && (
                                <button
                                  type="button"
                                  onClick={regenerateLast}
                                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#FAF8FE] hover:text-[#1E1B2E]"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Regenerate
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {!isCurrentlyStreaming &&
                        isLastAssistant &&
                        msg.followUps &&
                        msg.followUps.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {msg.followUps.map((f, fIdx) => (
                              <button
                                key={fIdx}
                                type="button"
                                onClick={() => sendPrompt(f)}
                                className="rounded-full border border-[#EFE9FA] bg-white px-3 py-1.5 text-left text-xs font-semibold text-[#6D28D9] transition-all hover:border-[#DDD2F7] hover:bg-[#F8F4FE] active:scale-95"
                              >
                                {f} →
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>
        </div>

        {/* ==================== COMPOSER ==================== */}
        <div className="relative z-10 shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1 sm:px-7 sm:pb-8">
          <div className="mx-auto w-full max-w-[900px]">
            {/* Attachment pills */}
            {(attachedNote || pendingImages.length > 0) && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {attachedNote && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E6DCFB] bg-white/95 px-3 py-1 text-xs font-bold text-[#5B21B6]">
                    <FileText className="h-3.5 w-3.5 text-[#7C3AED]" />
                    <span className="max-w-[200px] truncate">{attachedNote.title}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedNote(null)}
                      aria-label="Remove attached note"
                      className="ml-0.5 text-[#A78BFA] hover:text-[#4C1D95]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {pendingImages.map((img, i) => (
                  <div key={i} className="group relative">
                    <img
                      src={img.dataUrl}
                      alt={img.name || 'Preview'}
                      className="h-12 w-12 rounded-xl border border-[#E6DCFB] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Remove image"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Composer card */}
            <div className="rounded-[24px] border border-[#EFE9FA] bg-white/95 p-2 shadow-[0_26px_70px_-38px_rgba(109,40,217,0.6)] backdrop-blur-md transition-colors focus-within:border-[#DED0FA]">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  const files = e.clipboardData?.files;
                  if (files && files.length > 0) handleFilesSelected(files);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendPrompt();
                  }
                }}
                placeholder={currentModeDef.placeholder}
                className="max-h-44 w-full resize-none border-0 bg-transparent px-3 pb-1 pt-2.5 text-[14.5px] leading-relaxed text-[#1E1B2E] placeholder:text-[#9CA3AF] focus:outline-none"
              />

              <div className="flex items-center gap-1 px-1 pb-0.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAttachMenuOpen((v) => !v)}
                    title="Attach a photo or a NikNote page"
                    className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium text-[#475569] transition-colors hover:bg-[#F8F4FE]"
                  >
                    <Paperclip className="h-[17px] w-[17px]" />
                    <span className="hidden sm:inline">Attach</span>
                  </button>
                  {attachMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setAttachMenuOpen(false)} />
                      <div className="absolute bottom-11 left-0 z-50 w-52 overflow-hidden rounded-xl border border-[#EFE9FA] bg-white p-1 shadow-[0_22px_50px_-24px_rgba(76,29,149,0.45)]">
                        <button
                          type="button"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            fileInputRef.current?.click();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold text-[#334155] hover:bg-[#F8F4FE]"
                        >
                          <ImageIcon className="h-4 w-4 text-[#7C3AED]" />
                          Upload image
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            loadNotesForPicker();
                            setNotePickerOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-semibold text-[#334155] hover:bg-[#F8F4FE]"
                        >
                          <FileText className="h-4 w-4 text-[#7C3AED]" />
                          Attach note
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <span className="mx-0.5 h-5 w-px bg-[#F0EBF9]" />

                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title="Voice input"
                  className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium transition-colors ${
                    listening
                      ? 'bg-rose-50 text-rose-600'
                      : 'text-[#475569] hover:bg-[#F8F4FE]'
                  }`}
                >
                  {listening ? <MicOff className="h-[17px] w-[17px]" /> : <Mic className="h-[17px] w-[17px]" />}
                  <span className="hidden sm:inline">Voice</span>
                </button>

                <span className="mx-0.5 h-5 w-px bg-[#F0EBF9]" />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setModelMenuSource('composer');
                      setModelMenuOpen((v) => (modelMenuSource === 'composer' ? !v : true));
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-[#E9DFFB] bg-[#FBF8FF] px-3 text-[12.5px] font-semibold text-[#4C1D95] transition-colors hover:border-[#D8C8F8]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" />
                    <span className="max-w-[150px] truncate">{activeModelLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#8B5CF6]" />
                  </button>
                  {modelMenuOpen && modelMenuSource === 'composer' && modelMenuPanel('left')}
                </div>

                {SIDEBAR_NAV.every((n) => n.mode !== mode) && (
                  <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-[#F1ECFB] bg-white px-2.5 py-1 text-[11px] font-bold text-[#6D28D9] sm:flex">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: currentModeDef.badgeColor }}
                    />
                    {currentModeDef.shortLabel}
                  </span>
                )}

                <div className="ml-auto flex items-center gap-1">
                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      aria-label="Stop generation"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500 text-white shadow-[0_14px_28px_-14px_rgba(244,63,94,0.9)] transition-transform active:scale-95"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendPrompt()}
                      disabled={!input.trim() && pendingImages.length === 0}
                      aria-label="Send message to NikAI"
                      className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[0_16px_30px_-14px_rgba(168,85,247,0.95)] transition-transform active:scale-95 disabled:opacity-90"
                      style={{
                        background:
                          'linear-gradient(140deg, #A855F7 0%, #C084FC 30%, #EC4899 68%, #FB923C 100%)',
                      }}
                    >
                      <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MEMORY MODAL ==================== */}
      {memoryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E103C]/45 p-4 backdrop-blur-sm"
          onClick={() => setMemoryOpen(false)}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#EFE9FA] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-4 text-white"
              style={{
                background:
                  'linear-gradient(100deg, #7C3AED 0%, #A855F7 42%, #DB2777 82%, #FB923C 100%)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <BrainCircuit className="h-5 w-5 text-amber-200" />
                <div>
                  <h3 className="text-sm font-extrabold">NikAI Memory</h3>
                  <p className="text-[11px] text-white/85">
                    Remembers your profile, goals & past sessions automatically
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMemoryOpen(false)}
                aria-label="Close memory"
                className="rounded-lg bg-white/15 p-1.5 text-white hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4 text-xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMemoryFact.trim()) return;
                  const next = addManualMemoryFact(newMemoryFact);
                  setMemoryState(next);
                  setNewMemoryFact('');
                  toast.success('Pinned to NikAI memory!');
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={newMemoryFact}
                  onChange={(e) => setNewMemoryFact(e.target.value)}
                  placeholder="Pin anything (e.g. Preparing for JEE 2027 · Explain in Hinglish)…"
                  className="flex-1 rounded-xl border border-[#EFE9FA] px-3 py-2 text-xs focus:border-[#C4B5FD] focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(100deg, #7C3AED, #DB2777)' }}
                >
                  Remember
                </button>
              </form>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-[#EFE9FA] bg-[#F9F6FE] p-2.5">
                  <div className="text-[10px] font-bold uppercase text-[#8B5CF6]">Name</div>
                  <div className="mt-0.5 font-bold text-[#312E43]">
                    {memoryState.userName || 'Auto-detects from chat'}
                  </div>
                </div>
                <div className="rounded-xl border border-pink-100 bg-pink-50/70 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-pink-600">Goal / Course</div>
                  <div className="mt-0.5 truncate font-bold text-pink-950">
                    {memoryState.examOrRole || 'Auto-detects exam/goal'}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-2.5">
                  <div className="text-[10px] font-bold uppercase text-amber-600">Language</div>
                  <div className="mt-0.5 font-bold text-amber-950">
                    {memoryState.preferredLanguage || 'Auto-Adaptive'}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-bold text-slate-700">
                  Pinned facts & preferences ({memoryState.facts.length})
                </div>
                {memoryState.facts.length === 0 ? (
                  <p className="italic text-slate-400">
                    Say &ldquo;Remember that…&rdquo; in chat or add a fact above!
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {memoryState.facts.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2"
                      >
                        <span className="font-medium text-slate-800">{f.text}</span>
                        <button
                          type="button"
                          onClick={() => setMemoryState(deleteMemoryFact(f.id))}
                          aria-label="Delete memory"
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {memoryState.sessionDigests.length > 0 && (
                <div>
                  <div className="mb-1.5 font-bold text-slate-700">
                    Remembered past sessions ({memoryState.sessionDigests.length})
                  </div>
                  <div className="space-y-1.5">
                    {memoryState.sessionDigests.slice(0, 6).map((s) => (
                      <div
                        key={s.threadId}
                        className="rounded-xl border border-[#F1ECFB] bg-[#FAF8FE] px-3 py-2"
                      >
                        <div className="font-bold text-[#4C1D95]">{s.title}</div>
                        <div className="line-clamp-1 text-[11px] text-slate-500">{s.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {memoryCount > 0 && (
                <div className="flex justify-end border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMemoryState(clearAllNikAIMemory());
                      toast.info('Cleared NikAI memory');
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Reset all memory
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ATTACH NOTE MODAL ==================== */}
      {notePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E103C]/45 p-4 backdrop-blur-sm"
          onClick={() => setNotePickerOpen(false)}
        >
          <div
            className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#EFE9FA] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F4F1FA] p-4">
              <h3 className="text-sm font-bold text-[#312E43]">Attach note to NikAI</h3>
              <button
                type="button"
                onClick={() => setNotePickerOpen(false)}
                aria-label="Close note picker"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1 overflow-y-auto p-2">
              {availableNotes.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-400">
                  No notes found yet — ask NikAI to create one and click Save Smart Note!
                </p>
              ) : (
                availableNotes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setAttachedNote(n);
                      setNotePickerOpen(false);
                      toast.success(`Attached "${n.title}" to NikAI`);
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#F8F4FE]"
                  >
                    <div className="truncate text-xs font-bold text-slate-900">{n.title}</div>
                    <div className="line-clamp-1 text-[11px] text-slate-400">{n.preview}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ENGINE / KEYS MODAL ==================== */}
      {keysModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E103C]/45 p-4 backdrop-blur-sm"
          onClick={() => setKeysModalOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-2xl border border-[#EFE9FA] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#312E43]">NikAI Astra Cloud Engine</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Powered by Astra multi-model cloud + optional personal API keys
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKeysModalOpen(false)}
                aria-label="Close engine settings"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  OpenAI API key (optional)
                </label>
                <input
                  type="password"
                  value={openaiInput}
                  onChange={(e) => setOpenaiInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-xl border border-[#EFE9FA] px-3 py-2 text-xs focus:border-[#C4B5FD] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Groq API key (optional — ultra-fast 120B)
                </label>
                <input
                  type="password"
                  value={groqInput}
                  onChange={(e) => setGroqInput(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full rounded-xl border border-[#EFE9FA] px-3 py-2 text-xs focus:border-[#C4B5FD] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Google Gemini API key (optional — vision 2.5)
                </label>
                <input
                  type="password"
                  value={geminiInput}
                  onChange={(e) => setGeminiInput(e.target.value)}
                  placeholder="AIza..."
                  className="w-full rounded-xl border border-[#EFE9FA] px-3 py-2 text-xs focus:border-[#C4B5FD] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKeysModalOpen(false)}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  saveCustomAIKeys({
                    groqKey: groqInput,
                    geminiKey: geminiInput,
                    openaiKey: openaiInput,
                  });
                  setKeysModalOpen(false);
                  toast.success('NikAI cloud keys saved');
                }}
                className="rounded-xl px-4 py-2 text-xs font-bold text-white"
                style={{ background: 'linear-gradient(100deg, #7C3AED, #DB2777)' }}
              >
                Save keys
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NikAIWorkspace;
