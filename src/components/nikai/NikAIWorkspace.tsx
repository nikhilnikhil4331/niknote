// ============================================================
// NikAI — Neural Studio (signature design)
// Official NikAI Brand Emblem + Dreamy Horizon Landscape + Clean Glass UI:
// 1. Official NikAI Logo + Collapsible Left Sidebar + Recent Chats + Pro Card
// 2. Top Search Bar (Ctrl+K) + Persistent Cross-Session Memory Pill + Model Picker
// 3. 4 Signature Starter Cards + Floating Pill Composer (Attach, Voice, Model)
// 4. Multi-Model Cloud Streaming + Smart Notes + Handwriting Export + Mini-Game
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  BookmarkPlus,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Code2,
  Copy,
  Crown,
  Feather,
  FileText,
  Gamepad2,
  GraduationCap,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Menu,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  NotebookPen,
  Paperclip,
  Plus,
  PlusCircle,
  RotateCcw,
  Search,
  Square,
  Target,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { AstaMarkdown } from '@/components/asta/AstaMarkdown';
import {
  streamAstaAI,
  readCustomAIKeys,
  saveCustomAIKeys,
  type AstaMode,
  type AstaModelChoice,
  type AstaImageAttachment,
} from '@/lib/aiEngine';
import {
  addManualMemoryFact,
  buildNikAIMemoryPrompt,
  clearAllNikAIMemory,
  deleteMemoryFact,
  learnFromConversationTurn,
  loadNikAIMemory,
  type NikAIMemoryStore,
} from '@/lib/nikaiMemory';
import {
  extractAndSaveFlashcardsFromMarkdown,
  implementNikAINote,
} from '@/lib/nikaiNotesBridge';
import { speakAloud, stopSpeaking } from '@/lib/speech';
import { track } from '@/lib/growth/funnel';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import {
  buildGroundedContext,
  collectLocalKnowledge,
  groundingPrompt,
  loadKnowledgeDocs,
  removeKnowledgeDoc,
  sourceLabel,
  type GroundingConfidence,
  type KnowledgeDoc,
  type SourceRef,
} from '@/lib/knowledgeIndex';
import { NikAIBrand, NikAIStarConstellation } from './NikAIBrand';
import { NikAIThinkingArena } from './NikAIThinkingArena';

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
  /** Passages from the user's own notes/PDFs used for this answer. */
  sources?: SourceRef[];
  grounding?: GroundingConfidence;
  createdAt: number;
}

export interface NikAIThread {
  id: string;
  title: string;
  mode: AstaMode;
  messages: NikAIMessage[];
  updatedAt: number;
}

interface AttachedNoteContext {
  id: string;
  title: string;
  preview: string;
}

export interface NikAIWorkspaceProps {
  embedded?: boolean;
  onClose?: () => void;
  noteTitle?: string;
  noteContent?: string;
  onInsertContent?: (markdown: string) => void;
}

const THREADS_KEY = 'niknote.nikai.threads.v2';
const LEGACY_THREADS_KEY = 'niknote.asta.threads.v2';
const HIDDEN_SEEDS_KEY = 'niknote.nikai.hidden_seeds.v1';

interface SeedChatPreview {
  id: string;
  title: string;
  relTime: string;
  prompt: string;
  mode: AstaMode;
}

const SEED_RECENT_CHATS: SeedChatPreview[] = [
  {
    id: 'seed-quantum',
    title: 'Quantum mechanics notes',
    relTime: '2 hours ago',
    prompt:
      'Create exam-ready structured Smart Notes on Quantum Mechanics: wavefunctions, Schrödinger equation, operators, uncertainty principle, and key formulas.',
    mode: 'notes',
  },
  {
    id: 'seed-mcq',
    title: '5 MCQ mock test',
    relTime: '4 hours ago',
    prompt:
      'Generate a 5-question interactive MCQ mock test on Physics Mechanics & Electromagnetism with answers and clear explanations.',
    mode: 'quiz',
  },
  {
    id: 'seed-python',
    title: 'Build a Python project',
    relTime: 'Yesterday',
    prompt:
      'Help me build a clean modular Python CLI study planner project with JSON storage, typing, and unit tests.',
    mode: 'code',
  },
  {
    id: 'seed-thermo',
    title: 'Thermodynamics summary',
    relTime: '2 days ago',
    prompt:
      'Write a crystal-clear revision summary of Thermodynamics (Zeroth, First, Second Laws, Carnot engine, entropy, and PV work formulas).',
    mode: 'notes',
  },
  {
    id: 'seed-duality',
    title: 'Explain wave-particle duality',
    relTime: '2 days ago',
    prompt:
      'Explain wave-particle duality simply with real-world intuition, de Broglie wavelength formula, and double-slit experiment clarity.',
    mode: 'tutor',
  },
  {
    id: 'seed-dsa',
    title: 'DSA study plan',
    relTime: '3 days ago',
    prompt:
      'Design a high-impact 30-day DSA study plan covering arrays, trees, graphs, dynamic programming, and daily problem targets.',
    mode: 'auto',
  },
  {
    id: 'seed-organic',
    title: 'Organic chemistry flashcards',
    relTime: '4 days ago',
    prompt:
      'Create structured notes and quick Q&A flashcards for Organic Chemistry named reactions (SN1, SN2, Aldol, Cannizzaro, Markovnikov).',
    mode: 'notes',
  },
];

const MODEL_OPTIONS: Array<{
  id: AstaModelChoice;
  label: string;
  badge: string;
}> = [
  { id: 'auto', label: 'NikAI Auto', badge: 'Best routing' },
  { id: 'pro', label: 'NikAI Pro', badge: 'Deeper reasoning' },
  { id: 'flash', label: 'NikAI Flash', badge: 'Fast answers' },
  { id: 'vision', label: 'NikAI Vision', badge: 'Diagrams & scans' },
];

const SIDEBAR_NAV_ITEMS: Array<{
  id: AstaMode;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'auto', label: 'Chat', icon: MessageCircle },
  { id: 'notes', label: 'Smart Notes', icon: Feather },
  { id: 'quiz', label: 'Quiz', icon: Target },
  { id: 'writing', label: 'Writing Studio', icon: FileText },
  { id: 'code', label: 'Code', icon: Code2 },
];

const HERO_CARDS: Array<{
  title: string;
  description: string;
  prompt: string;
  mode: AstaMode;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  tintBg: string;
  borderTint: string;
}> = [
  {
    title: 'Smart Notes',
    description: 'Turn any topic into beautiful, structured handwritten-ready notes.',
    prompt:
      'Create complete exam-ready Smart Notes on Rotational Motion & Moment of Inertia with key formulas, memory tricks, and quick revision summary.',
    mode: 'notes',
    icon: NotebookPen,
    tintBg: 'linear-gradient(165deg, rgba(250,248,255,0.92) 0%, rgba(244,240,255,0.86) 100%)',
    borderTint: 'rgba(221, 214, 254, 0.75)',
  },
  {
    title: 'Learn a concept',
    description: 'Get simple explanations with examples and visual clarity.',
    prompt:
      'Explain Bayes Theorem and Conditional Probability intuitively from scratch with clear step-by-step real-life examples.',
    mode: 'tutor',
    icon: GraduationCap,
    tintBg: 'linear-gradient(165deg, rgba(255,252,245,0.93) 0%, rgba(255,247,235,0.87) 100%)',
    borderTint: 'rgba(253, 230, 196, 0.8)',
  },
  {
    title: 'Practice quiz',
    description: 'Generate MCQs, mock tests and instant feedback.',
    prompt:
      'Create a 5-question interactive MCQ mock test on Chemical Bonding & Hybridization with instant answer explanations.',
    mode: 'quiz',
    icon: Target,
    tintBg: 'linear-gradient(165deg, rgba(255,246,250,0.93) 0%, rgba(254,238,246,0.87) 100%)',
    borderTint: 'rgba(251, 207, 232, 0.72)',
  },
  {
    title: 'Write code',
    description: 'Build, debug and explain code in Python, TypeScript and more.',
    prompt:
      'Write a clean, well-typed TypeScript LRU Cache implementation with O(1) get/put operations and usage examples.',
    mode: 'code',
    icon: Code2,
    tintBg: 'linear-gradient(165deg, rgba(246,250,255,0.93) 0%, rgba(238,246,255,0.87) 100%)',
    borderTint: 'rgba(219, 234, 254, 0.85)',
  },
];

const SingleFourPointSparkle: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
    <defs>
      <linearGradient id="nikai-pill-sparkle" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
    </defs>
    <path
      d="M12 2C12.55 8.8 15.2 11.45 22 12C15.2 12.55 12.55 15.2 12 22C11.45 15.2 8.8 12.55 2 12C8.8 11.45 11.45 8.8 12 2Z"
      fill="url(#nikai-pill-sparkle)"
    />
  </svg>
);

function uid(): string {
  return `nk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function loadSavedThreads(): NikAIThread[] {
  try {
    const primary = localStorage.getItem(THREADS_KEY);
    if (primary) {
      const parsed = JSON.parse(primary);
      if (Array.isArray(parsed)) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_THREADS_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

function persistThreads(threads: NikAIThread[]) {
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads.slice(0, 60)));
  } catch {
    // ignore storage quota overflow
  }
}

function buildFollowUps(reply: string, activeMode: AstaMode): string[] {
  const lower = reply.toLowerCase();
  if (activeMode === 'quiz' || lower.includes('**answer:**')) {
    return [
      'Give me 5 harder exam-level MCQs on this topic',
      'Create quick revision Smart Notes from weak concepts',
      'Explain every question shortcut step by step',
    ];
  }
  if (activeMode === 'code' || reply.includes('```')) {
    return [
      'Add edge-case tests & complexity breakdown',
      'Refactor this for cleaner modular architecture',
      'Turn this solution into step-by-step study notes',
    ];
  }
  return [
    'Test me with a 5-question interactive MCQ quiz on this',
    'Convert this into crisp bullet revision Smart Notes',
    'Explain with a real-world analogy in simple Hinglish',
  ];
}

function fileToAttachment(file: File): Promise<AstaImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: String(reader.result),
            mimeType: file.type || 'image/jpeg',
            name: file.name,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.84);
        resolve({ dataUrl: compressed, mimeType: 'image/jpeg', name: file.name });
      };
      img.onerror = () =>
        resolve({
          dataUrl: String(reader.result),
          mimeType: file.type || 'image/png',
          name: file.name,
        });
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
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
  const [userAvatarSrc, setUserAvatarSrc] = useState<string>('/nikai-avatar.jpg');

  const [threads, setThreads] = useState<NikAIThread[]>(() => loadSavedThreads());
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    const initial = loadSavedThreads();
    return initial[0]?.id ?? null;
  });
  const [mode, setMode] = useState<AstaMode>('auto');
  const [modelChoice, setModelChoice] = useState<AstaModelChoice>('auto');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [composerModelMenuOpen, setComposerModelMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<AstaImageAttachment[]>([]);
  const [attachedNote, setAttachedNote] = useState<AttachedNoteContext | null>(() =>
    noteContent && noteContent.trim()
      ? {
          id: 'active-editor-note',
          title: noteTitle || 'Current Note',
          preview: noteContent.slice(0, 6000),
        }
      : null
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenSeeds, setHiddenSeeds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HIDDEN_SEEDS_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const [memoryState, setMemoryState] = useState<NikAIMemoryStore>(() => loadNikAIMemory());
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [searchableDocs, setSearchableDocs] = useState<KnowledgeDoc[]>([]);
  const [newMemoryFact, setNewMemoryFact] = useState('');

  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [availableNotes, setAvailableNotes] = useState<AttachedNoteContext[]>([]);
  const [keysModalOpen, setKeysModalOpen] = useState(false);
  const [arcadeModalOpen, setArcadeModalOpen] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [liveThinkingText, setLiveThinkingText] = useState('');
  const [liveModelName, setLiveModelName] = useState('NikAI');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Voice input for NikAI: same engine as the editor's dictation, so a
  // spoken request follows exactly the same path as a typed one.
  const nikaiDictation = useSpeechDictation({
    lang:
      typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('hi')
        ? 'hi-IN'
        : 'en-IN',
    onFinalTranscript: (text) =>
      setInput((prev) => `${prev}${prev && !/\s$/.test(prev) ? ' ' : ''}${text}`),
  });
  const [listening, setListening] = useState(false);
  const [implementingId, setImplementingId] = useState<string | null>(null);

  const customKeys = readCustomAIKeys();
  const [groqInput, setGroqInput] = useState(customKeys.groqKey || '');
  const [geminiInput, setGeminiInput] = useState(customKeys.geminiKey || '');
  const [openaiInput, setOpenaiInput] = useState(customKeys.openaiKey || '');

  const abortRef = useRef<AbortController | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const u = data?.session?.user;
        if (u?.id) setUserId(u.id);
        const pic = (u?.user_metadata as any)?.avatar_url || (u?.user_metadata as any)?.picture;
        if (pic) setUserAvatarSrc(pic);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (noteContent && noteContent.trim()) {
      setAttachedNote({
        id: 'active-editor-note',
        title: noteTitle || 'Current Note',
        preview: noteContent.slice(0, 6000),
      });
    }
  }, [noteTitle, noteContent]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const activeMessages = activeThread?.messages ?? [];

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [threads, searchQuery]);

  const filteredSeedChats = useMemo(() => {
    const visible = SEED_RECENT_CHATS.filter((s) => !hiddenSeeds.includes(s.id));
    if (!searchQuery.trim()) return visible;
    const q = searchQuery.toLowerCase();
    return visible.filter((s) => s.title.toLowerCase().includes(q));
  }, [hiddenSeeds, searchQuery]);

  const selectedModelDef = useMemo(
    () => MODEL_OPTIONS.find((m) => m.id === modelChoice) || MODEL_OPTIONS[0],
    [modelChoice]
  );

  useEffect(() => {
    persistThreads(threads);
  }, [threads]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: isGenerating ? 'auto' : 'smooth' });
  }, [activeMessages.length, isGenerating]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const loadNotesForPicker = useCallback(() => {
    const collected: AttachedNoteContext[] = [];
    try {
      const mobileRaw = localStorage.getItem('niknote.mobile.notebooks.v1');
      if (mobileRaw) {
        const list = JSON.parse(mobileRaw);
        if (Array.isArray(list)) {
          for (const item of list) {
            const text = Array.isArray(item.blocks)
              ? item.blocks.map((b: any) => b.content || '').join('\n')
              : item.content || '';
            if (item.title || text) {
              collected.push({
                id: String(item.id || Math.random()),
                title: String(item.title || 'Untitled Note'),
                preview: String(text).slice(0, 6000),
              });
            }
          }
        }
      }
      const wsRaw = localStorage.getItem('niknote.notes.v1');
      if (wsRaw) {
        const list = JSON.parse(wsRaw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!item.trashedAt && (item.title || item.content)) {
              collected.push({
                id: String(item.id || Math.random()),
                title: String(item.title || 'Workspace Note'),
                preview: String(item.content || '').slice(0, 6000),
              });
            }
          }
        }
      }
    } catch {
      // ignore parse errors
    }
    setAvailableNotes(collected.slice(0, 30));
  }, []);

  const startNewChat = useCallback((nextMode?: AstaMode) => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setLiveThinkingText('');
    setActiveThreadId(null);
    if (nextMode) setMode(nextMode);
    setInput('');
    setPendingImages([]);
    setMobileSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 40);
  }, []);

  const deleteThread = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (activeThreadId === id) {
          setActiveThreadId(next[0]?.id ?? null);
        }
        return next;
      });
    },
    [activeThreadId]
  );

  const deleteSeedChat = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHiddenSeeds((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem(HIDDEN_SEEDS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const additions: AstaImageAttachment[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (!file.type.startsWith('image/')) {
        toast.info('Please select an image or screenshot (PNG, JPG, WebP)');
        continue;
      }
      try {
        const att = await fileToAttachment(file);
        additions.push(att);
      } catch {
        toast.error('Could not attach image');
      }
    }
    if (additions.length > 0) {
      setPendingImages((prev) => [...prev, ...additions].slice(0, 4));
    }
  }, []);

  const toggleVoiceInput = useCallback(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.info('Voice dictation is not supported in this browser');
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-IN';
      rec.onresult = (ev: any) => {
        const transcript = Array.from(ev.results)
          .map((r: any) => r[0]?.transcript || '')
          .join('');
        setInput(transcript);
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

  const toggleSpeakMessage = useCallback(
    (msg: NikAIMessage) => {
      if (!('speechSynthesis' in window)) {
        toast.info('Read-aloud is unavailable on this browser');
        return;
      }
      if (speakingId === msg.id) {
        stopSpeaking();
        setSpeakingId(null);
        return;
      }
      // Strip markdown and pick an Indian voice when one is installed.
      const started = speakAloud(msg.content, {
        onEnd: () => setSpeakingId(null),
      });
      if (!started) {
        toast.info('Nothing to read aloud in this answer');
        return;
      }
      setSpeakingId(msg.id);
    },
    [speakingId]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const handleImplementNote = useCallback(
    async (msg: NikAIMessage, openInHandwritingEditor: boolean) => {
      if (implementingId) return;
      setImplementingId(msg.id);
      try {
        const res = await implementNikAINote({
          markdown: msg.content,
          fallbackTitle: activeThread?.title || noteTitle || 'NikAI Smart Study Notes',
          userId,
          prepareEditorOpen: openInHandwritingEditor,
        });

        setThreads((prev) =>
          prev.map((t) =>
            t.id !== activeThreadId
              ? t
              : {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === msg.id ? { ...m, savedNoteId: res.notebookId } : m
                  ),
                }
          )
        );

        const cardSuffix =
          res.flashcardCount > 0 ? ` + ${res.flashcardCount} Flashcards ready!` : '';

        if (openInHandwritingEditor) {
          toast.success(`Opening "${res.title}" inside NikNote Handwriting Studio!${cardSuffix}`);
          navigate(`/?editor=1&notebook=${encodeURIComponent(res.notebookId)}`);
        } else {
          toast.success(`Saved "${res.title}" (${res.blockCount} blocks)${cardSuffix}`);
        }
      } catch {
        toast.error('Could not save note');
      } finally {
        setImplementingId(null);
      }
    },
    [activeThread?.title, activeThreadId, implementingId, navigate, noteTitle, userId]
  );

  const handleMakeFlashcardsOnly = useCallback(
    (msg: NikAIMessage) => {
      const count = extractAndSaveFlashcardsFromMarkdown(
        activeThread?.title || 'NikAI Flashcard Deck',
        msg.content
      );
      if (count > 0) {
        toast.success(`Extracted ${count} study flashcards! Opening Flashcard Arena…`);
        navigate('/flashcards');
      } else {
        toast.info('Ask NikAI for notes with bold key terms or an MCQ quiz first!');
      }
    },
    [activeThread?.title, navigate]
  );

  const sendPrompt = useCallback(
    async (overridePrompt?: string, overrideMode?: AstaMode) => {
      const text = (overridePrompt !== undefined ? overridePrompt : input).trim();
      const imagesToSend = overridePrompt !== undefined ? [] : pendingImages;
      if ((!text && imagesToSend.length === 0) || isGenerating) return;

      const effectiveMode: AstaMode =
        imagesToSend.length > 0 && (overrideMode || mode) === 'auto'
          ? 'vision'
          : overrideMode || mode;
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
      setLiveModelName(`NikAI · ${selectedModelDef.label}`);

      const controller = new AbortController();
      abortRef.current = controller;
      const freshMemoryPrompt = buildNikAIMemoryPrompt(targetThreadId);

      try {
        const noteCtx = attachedNote
          ? `Note Title: ${attachedNote.title}\n\n${attachedNote.preview}`
          : undefined;

        // Retrieve from the user's own material (all local notes + imported
        // PDFs) so answers can be grounded and cited. Retrieval is purely
        // local: nothing is sent to a search service.
        const attachedDocs: KnowledgeDoc[] = attachedNote
          ? [{
              id: `attached-${attachedNote.id}`,
              title: attachedNote.title,
              kind: 'note',
              pages: [attachedNote.preview],
              updatedAt: Date.now(),
            }]
          : [];
        const localDocs = collectLocalKnowledge();
        const grounded = buildGroundedContext(userMsg.content, localDocs, {
          includeDocs: attachedDocs,
          topK: 5,
        });

        const result = await streamAstaAI({
          messages: historyForEngine.slice(-18).map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images,
          })),
          mode: effectiveMode,
          model: modelChoice,
          threadId: targetThreadId,
          noteContext: [noteCtx, groundingPrompt(grounded)].filter(Boolean).join('\n\n'),
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

        const finalText = result.content;
        track('ai_used', { feature: 'nikai', method: result.provider });
        const followUps = buildFollowUps(finalText, effectiveMode);

        setThreads((prev) =>
          prev.map((t) =>
            t.id === targetThreadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          content: finalText,
                          thinking: result.thinking || m.thinking,
                          model: result.model,
                          provider: result.provider,
                          latencyMs: result.latencyMs,
                          followUps,
                          sources: grounded.sources.length ? grounded.sources : undefined,
                          grounding:
                            localDocs.length || attachedDocs.length
                              ? grounded.confidence
                              : undefined,
                        }
                      : m
                  ),
                }
              : t
          )
        );

        const updatedMemory = learnFromConversationTurn(
          userMsg.content,
          finalText,
          targetThreadId,
          titleSource.slice(0, 56) || 'Study Session'
        );
        setMemoryState(updatedMemory);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        const fallbackError =
          'NikAI hit a brief network snag — tap Regenerate to retry immediately.';
        setThreads((prev) =>
          prev.map((t) =>
            t.id !== targetThreadId
              ? t
              : {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: fallbackError } : m
                  ),
                }
          )
        );
      } finally {
        setIsGenerating(false);
        setLiveThinkingText('');
      }
    },
    [
      input,
      pendingImages,
      isGenerating,
      mode,
      modelChoice,
      activeThreadId,
      threads,
      attachedNote,
      selectedModelDef.label,
    ]
  );

  const regenerateLast = useCallback(() => {
    if (!activeThread || isGenerating) return;
    const lastUser = [...activeThread.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id ? { ...t, messages: t.messages.slice(0, -2) } : t
      )
    );
    setTimeout(() => {
      sendPrompt(lastUser.content, activeThread.mode);
    }, 20);
  }, [activeThread, isGenerating, sendPrompt]);

  const memoryCount =
    memoryState.facts.length +
    memoryState.sessionDigests.length +
    (memoryState.userName ? 1 : 0) +
    (memoryState.examOrRole ? 1 : 0);

  const SidebarContent = (
    <div className="flex flex-col h-full justify-between px-3.5 py-4 select-none">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Official NikAI Brand Header + Collapse Circular Button */}
        <div className="flex items-center justify-between gap-2 px-1 mb-4">
          <button
            type="button"
            onClick={() => startNewChat('auto')}
            className="text-left focus:outline-none hover:opacity-95 transition-opacity"
          >
            <NikAIBrand size="md" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (mobileSidebarOpen) setMobileSidebarOpen(false);
              else setSidebarCollapsed(true);
            }}
            aria-label="Collapse sidebar"
            className="w-8 h-8 rounded-full bg-white hover:bg-[#F6F4FC] border border-[#ECEAF6] text-[#6E698A] flex items-center justify-center transition-colors shrink-0"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>

        {/* + New Chat Signature Pill CTA */}
        <button
          type="button"
          onClick={() => startNewChat('auto')}
          className="w-full h-11 rounded-full text-white font-semibold text-[14.5px] flex items-center justify-center gap-2 shadow-[0_8px_22px_rgba(147,51,234,0.26)] hover:shadow-[0_10px_28px_rgba(236,72,153,0.34)] active:scale-[0.985] transition-all shrink-0 mb-4"
          style={{
            background:
              'linear-gradient(90deg, #8B3DFF 0%, #B845F5 42%, #F266B6 74%, #FF965A 100%)',
          }}
        >
          <Plus className="w-4 h-4 stroke-[2.4]" />
          <span>New Chat</span>
        </button>

        {/* Primary 5 Specialist Navigation Links */}
        <nav aria-label="NikAI workspaces" className="space-y-1 shrink-0">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode(item.id);
                  setMobileSidebarOpen(false);
                  textareaRef.current?.focus();
                }}
                className={`w-full px-3.5 py-2.5 rounded-2xl text-[14px] flex items-center gap-3 transition-all ${
                  isActive
                    ? 'bg-[#F2ECFF] text-[#6A28D9] font-semibold'
                    : 'text-[#44405B] hover:bg-[#F8F6FE] font-medium'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive ? 'text-[#7C3AED]' : 'text-[#827C9F]'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Subtle Divider */}
        <div className="my-4 border-t border-[#F0EEF8] shrink-0" />

        {/* Recent Chats Header + Lens Trigger */}
        <div className="flex items-center justify-between px-2 mb-2 shrink-0">
          <span className="text-[12.5px] font-semibold text-[#6F6A8A]">Recent Chats</span>
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            aria-label="Search recent chats"
            className="p-1 rounded-lg text-[#8D88A8] hover:text-[#5B21B6] hover:bg-[#F5F2FC] transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Recent Chats List */}
        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 min-h-0">
          {filteredThreads.map((t) => {
            const isSelected = t.id === activeThreadId;
            return (
              <div
                key={t.id}
                onClick={() => {
                  setActiveThreadId(t.id);
                  setMode(t.mode || 'auto');
                  setMobileSidebarOpen(false);
                }}
                className={`group flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#F4EEFF]' : 'hover:bg-[#F8F6FD]'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <MessageSquare
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isSelected ? 'text-[#7C3AED]' : 'text-[#9A95B5]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div
                      className={`text-[13.5px] truncate leading-snug ${
                        isSelected
                          ? 'font-semibold text-[#4C1D95]'
                          : 'font-medium text-[#242039]'
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="text-[11.5px] text-[#9A95B2] mt-0.5">
                      {formatRelativeTime(t.updatedAt)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => deleteThread(t.id, e)}
                  aria-label="Delete thread"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#9A95B5] hover:text-rose-500 transition-opacity shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {threads.length === 0 &&
            filteredSeedChats.map((seed) => (
              <div
                key={seed.id}
                onClick={() => {
                  setMobileSidebarOpen(false);
                  void sendPrompt(seed.prompt, seed.mode);
                }}
                className="group flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl cursor-pointer hover:bg-[#F8F6FD] transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-[#9A95B5] group-hover:text-[#7C3AED] transition-colors" />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-[#242039] truncate leading-snug">
                      {seed.title}
                    </div>
                    <div className="text-[11.5px] text-[#9A95B2] mt-0.5">{seed.relTime}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => deleteSeedChat(seed.id, e)}
                  aria-label={`Remove ${seed.title}`}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#9A95B5] hover:text-rose-500 transition-opacity shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Bottom Sticky Upgrade to NikAI Pro Card */}
      <button
        type="button"
        onClick={() => navigate('/upgrade')}
        className="mt-3 w-full rounded-2xl px-3.5 py-3 border border-[#F5E4DC] flex items-center justify-between gap-2.5 text-left hover:shadow-md hover:border-[#EFCBBF] transition-all shrink-0"
        style={{
          background:
            'linear-gradient(135deg, #FFF8F4 0%, #FFF4F7 55%, #FDF3FF 100%)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Crown className="w-5 h-5 text-[#F59E0B] fill-[#FBBF24] shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] font-bold bg-gradient-to-r from-[#A21CAF] via-[#DB2777] to-[#E11D48] bg-clip-text text-transparent truncate">
              Upgrade to NikAI Pro
            </div>
            <div className="text-[11.5px] text-[#7D7896] truncate">
              More power, higher limits
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#E07A5F] shrink-0" />
      </button>
    </div>
  );

  return (
    <div
      data-nikai-root="true"
      className={
        embedded
          ? 'flex flex-col h-full w-full bg-[#FCFAFF] text-[#171429] overflow-hidden select-text'
          : 'fixed inset-0 z-30 flex bg-[#FCFAFF] text-[#171429] overflow-hidden select-text'
      }
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Desktop Left Sidebar */}
      {!embedded && !sidebarCollapsed && (
        <aside className="hidden lg:flex lg:w-[266px] shrink-0 flex-col bg-white border-r border-[#EEECF7] z-20">
          {SidebarContent}
        </aside>
      )}

      {/* Mobile Slide-Over Sidebar Drawer */}
      {!embedded && mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-[#191233]/35 backdrop-blur-xs flex"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className="w-[278px] max-w-[85vw] h-full bg-white border-r border-[#EEECF7] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Stage with Dreamy Pastel Horizon Background */}
      <div
        className="flex-1 flex flex-col min-w-0 relative overflow-hidden"
        style={{
          backgroundColor: '#FCFAFF',
          backgroundImage: `url('/nikai-horizon-bg.jpg')`,
          backgroundPosition: 'center bottom',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Top Floating Bar */}
        <header className="h-16 px-4 sm:px-7 flex items-center justify-between gap-3 shrink-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            {!embedded && (
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 1024) setMobileSidebarOpen(true);
                  else setSidebarCollapsed(false);
                }}
                aria-label="Open NikAI sidebar"
                className={`${
                  sidebarCollapsed ? 'inline-flex' : 'inline-flex lg:hidden'
                } w-10 h-10 rounded-full bg-white/95 border border-[#ECEAF6] shadow-[0_2px_12px_rgba(30,20,70,0.04)] items-center justify-center text-[#565074] hover:text-[#6D28D9] transition-colors shrink-0`}
              >
                {sidebarCollapsed ? (
                  <ChevronsRight className="w-4 h-4" />
                ) : (
                  <Menu className="w-4 h-4" />
                )}
              </button>
            )}

            {embedded ? (
              <NikAIBrand size="sm" />
            ) : (
              <div className="w-48 sm:w-[272px] h-10 rounded-full bg-white/95 border border-[#ECEAF6] shadow-[0_2px_12px_rgba(30,20,70,0.04)] px-3.5 flex items-center gap-2.5 focus-within:border-[#C4B5FD] transition-colors">
                <Search className="w-4 h-4 text-[#9490AD] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full bg-transparent text-[13.5px] text-[#221F36] placeholder:text-[#9893B0] focus:outline-none min-w-0"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="text-[#9490AD] hover:text-[#4C1D95]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-[#F4F3FA] border border-[#E6E4F2] text-[11px] font-medium text-[#7B7696] shrink-0">
                    Ctrl K
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: memory pill + NikAI model picker + profile avatar */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSearchableDocs(loadKnowledgeDocs());
                setMemoryOpen(true);
              }}
              data-testid="nikai-memory-btn"
              className="h-10 px-3.5 rounded-full bg-white/95 hover:bg-white border border-[#ECEAF6] shadow-[0_2px_12px_rgba(30,20,70,0.04)] flex items-center gap-2 transition-all"
            >
              <Brain className="w-4 h-4 text-[#7C3AED]" />
              <span className="text-[13.5px] font-semibold text-[#231F39]">Memory</span>
              <span className="min-w-[21px] h-[21px] px-1.5 rounded-full bg-[#7C3AED] text-white text-[11.5px] font-bold flex items-center justify-center shadow-2xs">
                {memoryCount}
              </span>
            </button>

            {!embedded && (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => {
                    setModelMenuOpen((v) => !v);
                    setProfileMenuOpen(false);
                  }}
                  className="h-10 px-4 rounded-full bg-white/95 hover:bg-white border border-[#ECEAF6] shadow-[0_2px_12px_rgba(30,20,70,0.04)] flex items-center gap-2 transition-all"
                >
                  <SingleFourPointSparkle size={15} />
                  <span className="text-[13.5px] font-semibold text-[#231F39]">
                    {selectedModelDef.label}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#7A7495]" />
                </button>

                {modelMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-[#EAE6F7] shadow-xl p-1.5 z-50"
                    onMouseLeave={() => setModelMenuOpen(false)}
                  >
                    {MODEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setModelChoice(opt.id);
                          setModelMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors ${
                          modelChoice === opt.id
                            ? 'bg-[#F3ECFF] text-[#5B21B6] font-bold'
                            : 'text-[#312D4B] hover:bg-[#F8F6FE] font-medium'
                        }`}
                      >
                        <div>
                          <div>{opt.label}</div>
                          <div className="text-[10.5px] text-[#8A84A6] font-normal">
                            {opt.badge}
                          </div>
                        </div>
                        {modelChoice === opt.id && (
                          <Check className="w-4 h-4 text-[#7C3AED]" />
                        )}
                      </button>
                    ))}
                    <div className="my-1 border-t border-[#F1EFF9]" />
                    <button
                      type="button"
                      onClick={() => {
                        setModelMenuOpen(false);
                        setKeysModalOpen(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-[#5B4E89] hover:bg-[#F8F6FE] flex items-center gap-2"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#7C3AED]" />
                      <span>Custom Cloud API Keys…</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {embedded && onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close NikAI panel"
                className="w-9 h-9 rounded-full bg-white border border-[#ECEAF6] flex items-center justify-center text-[#5E587D] hover:text-[#171429]"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen((v) => !v);
                    setModelMenuOpen(false);
                  }}
                  aria-label="NikAI quick menu"
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-[0_2px_12px_rgba(30,20,70,0.12)] hover:scale-[1.03] transition-transform focus:outline-none"
                >
                  <img
                    src={userAvatarSrc}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </button>

                {profileMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#EAE6F7] shadow-xl p-1.5 z-50 text-xs"
                    onMouseLeave={() => setProfileMenuOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate('/');
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left font-semibold text-[#241F3D] hover:bg-[#F5F1FF] flex items-center gap-2.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 text-[#7C3AED]" />
                      <span>Back to NikNote Studio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setArcadeModalOpen(true);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left font-medium text-[#373254] hover:bg-[#F8F6FE] flex items-center gap-2.5"
                    >
                      <Gamepad2 className="w-3.5 h-3.5 text-[#EC4899]" />
                      <span>Thinking Mini-Game</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setKeysModalOpen(true);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left font-medium text-[#373254] hover:bg-[#F8F6FE] flex items-center gap-2.5"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#7C3AED]" />
                      <span>Cloud & API Keys</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate('/notebooks');
                      }}
                      className="w-full px-3 py-2.5 rounded-xl text-left font-medium text-[#373254] hover:bg-[#F8F6FE] flex items-center gap-2.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#6366F1]" />
                      <span>My Saved Notebooks</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Center Stage */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 flex flex-col">
          {activeMessages.length === 0 ? (
            <div
              className={`${
                embedded ? 'max-w-xl py-4' : 'max-w-[960px] py-6'
              } w-full mx-auto my-auto flex flex-col items-center`}
            >
              {/* Official NikAI Calligraphic Emblem */}
              <motion.img
                src="/nikai-mark.png"
                alt="NikAI Emblem"
                initial={{ opacity: 0, scale: 0.92, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="h-14 sm:h-16 w-auto object-contain mb-3 select-none pointer-events-none drop-shadow-[0_6px_18px_rgba(139,61,255,0.16)]"
              />

              {/* Headline */}
              <h1
                className={`${
                  embedded
                    ? 'text-2xl sm:text-3xl'
                    : 'text-[28px] sm:text-[42px]'
                } font-extrabold tracking-[-0.025em] text-[#171429] text-center leading-[1.15]`}
              >
                What can I help you{' '}
                <span
                  style={{
                    background:
                      'linear-gradient(90deg, #8B3DFF 0%, #EA4A9E 58%, #FF934F 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  create?
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-[14.5px] sm:text-[16px] text-[#5B5675] text-center mt-2.5 mb-8 max-w-xl">
                Your AI companion for learning, notes, quizzes, writing and coding.
              </p>

              {/* 4 Pastel Frosted-Glass Starter Cards */}
              <div
                className={`w-full grid ${
                  embedded
                    ? 'grid-cols-1 sm:grid-cols-2 gap-3'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
                }`}
              >
                {/* SVG Linear Gradient Definition for Crisp Card Line Icons */}
                <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
                  <defs>
                    <linearGradient id="nikai-card-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7C3AED" />
                      <stop offset="65%" stopColor="#D946EF" />
                      <stop offset="100%" stopColor="#EC4899" />
                    </linearGradient>
                  </defs>
                </svg>

                {HERO_CARDS.map((card, i) => {
                  const CardIcon = card.icon;
                  return (
                    <motion.button
                      key={card.title}
                      type="button"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.28 }}
                      onClick={() => sendPrompt(card.prompt, card.mode)}
                      style={{
                        background: card.tintBg,
                        borderColor: card.borderTint,
                      }}
                      className="group relative text-left rounded-[22px] border backdrop-blur-md px-5 pt-5 pb-4 min-h-[178px] flex flex-col justify-between shadow-[0_8px_28px_rgba(45,26,95,0.04)] hover:shadow-[0_14px_34px_rgba(124,58,237,0.12)] hover:-translate-y-0.5 active:scale-[0.99] transition-all"
                    >
                      <div>
                        <div className="mb-3.5">
                          <CardIcon
                            className="w-7 h-7 stroke-[2]"
                            style={{ stroke: 'url(#nikai-card-stroke)' }}
                          />
                        </div>

                        <div className="text-[15.5px] font-bold text-[#19162D] leading-snug mb-1.5">
                          {card.title}
                        </div>

                        <p className="text-[13px] leading-relaxed text-[#645E7D] pr-5">
                          {card.description}
                        </p>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <span className="w-8 h-8 rounded-full bg-white/95 border border-[#ECEAF6] text-[#5B4E8A] group-hover:text-[#7C3AED] group-hover:translate-x-0.5 flex items-center justify-center shadow-2xs transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl w-full mx-auto py-5 space-y-6">
              {activeMessages.map((msg, idx) => {
                const isLastAssistant =
                  msg.role === 'assistant' && idx === activeMessages.length - 1;
                const isCurrentlyStreaming = isLastAssistant && isGenerating;

                if (msg.role === 'user') {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div
                        className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tr-md px-4 py-3 text-white shadow-md shadow-purple-700/15"
                        style={{
                          background:
                            'linear-gradient(115deg, #5B21B6 0%, #7C3AED 52%, #DB2777 100%)',
                        }}
                      >
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2.5">
                            {msg.images.map((img, i) => (
                              <img
                                key={i}
                                src={img.dataUrl}
                                alt={img.name || 'Attachment'}
                                className="w-24 h-24 object-cover rounded-xl border border-white/25"
                              />
                            ))}
                          </div>
                        )}
                        <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white border border-[#EAE6F7] shadow-2xs flex items-center justify-center shrink-0 p-1">
                        <img
                          src="/nikai-mark.png"
                          alt=""
                          aria-hidden="true"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="font-bold text-[15px] text-[#1D1936]">NikAI</span>
                      {msg.model && (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/90 border border-[#EAE6F7] text-[#6D28D9]">
                          {msg.model}
                          {msg.latencyMs
                            ? ` · ${(msg.latencyMs / 1000).toFixed(1)}s`
                            : ''}
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
                      <details className="rounded-xl bg-white/85 border border-[#E7E2F7] px-3.5 py-2 text-xs text-[#4C1D95]">
                        <summary className="cursor-pointer font-semibold select-none flex items-center gap-1.5">
                          <Brain className="w-3.5 h-3.5 text-[#7C3AED]" />
                          View NikAI reasoning
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-[#5B5675] leading-relaxed">
                          {msg.thinking}
                        </p>
                      </details>
                    )}

                    {(msg.content || !isCurrentlyStreaming) && (
                      <div className="rounded-2xl bg-white/95 backdrop-blur-md border border-[#EAE6F7] px-4 sm:px-5 py-4 shadow-[0_8px_28px_rgba(40,22,90,0.06)]">
                        {/* Where the answer came from — only real retrieved
                            passages are ever listed here. */}
                        {!isCurrentlyStreaming && msg.sources && msg.sources.length > 0 && (
                          <div
                            className="mb-3 flex flex-wrap items-center gap-1.5"
                            data-testid="nikai-sources"
                          >
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-[#8B7FB0]">
                              <BookOpen className="w-3 h-3" />
                              Sources
                            </span>
                            {msg.sources.map((source, i) => (
                              <span
                                key={`${source.docId}-${source.page}-${i}`}
                                title={source.excerpt}
                                className="rounded-full bg-[#F5F0FF] border border-[#E2D4FC] px-2 py-0.5 text-[10.5px] font-semibold text-[#5B21B6]"
                              >
                                [{i + 1}] {sourceLabel(source)}
                              </span>
                            ))}
                          </div>
                        )}

                        {!isCurrentlyStreaming &&
                          msg.grounding === 'none' &&
                          msg.content && (
                            <p className="mb-3 rounded-lg bg-amber-50/80 border border-amber-200/70 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
                              No matching passage in your notes or PDFs — this answer is from
                              general knowledge, not your material.
                            </p>
                          )}

                        <AstaMarkdown
                          content={msg.content}
                          isStreaming={isCurrentlyStreaming}
                        />

                        {!isCurrentlyStreaming && msg.content && (
                          <div className="mt-4 pt-3 border-t border-[#F1EFF9] flex flex-wrap items-center gap-1.5">
                            {onInsertContent && (
                              <button
                                type="button"
                                onClick={() => {
                                  onInsertContent(msg.content);
                                  toast.success('Inserted cleanly into your active Note!');
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1 shadow-xs transition-all active:scale-95"
                                style={{
                                  background:
                                    'linear-gradient(90deg, #8B3DFF 0%, #EC4899 100%)',
                                }}
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                Insert in Note
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={implementingId === msg.id}
                              onClick={() => handleImplementNote(msg, false)}
                              data-testid={`save-smart-note-${idx}`}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                                msg.savedNoteId
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-[#F5F0FF] text-[#6D28D9] hover:bg-[#EDE4FF] border border-[#E2D4FC]'
                              }`}
                            >
                              <BookmarkPlus className="w-3.5 h-3.5" />
                              {msg.savedNoteId ? 'Saved Smart Note ✓' : 'Save Smart Note'}
                            </button>

                            <button
                              type="button"
                              disabled={implementingId === msg.id}
                              onClick={() => handleImplementNote(msg, true)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200/80 flex items-center gap-1 transition-colors"
                            >
                              <Feather className="w-3.5 h-3.5" />
                              Open in Handwriting
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMakeFlashcardsOnly(msg)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 flex items-center gap-1 transition-colors"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              Flashcards
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(msg.content);
                                setCopiedId(msg.id);
                                setTimeout(() => setCopiedId(null), 1800);
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#5E587D] hover:text-[#19162D] hover:bg-[#F5F3FB] flex items-center gap-1 transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleSpeakMessage(msg)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#5E587D] hover:text-[#19162D] hover:bg-[#F5F3FB] flex items-center gap-1 transition-colors"
                            >
                              {speakingId === msg.id ? (
                                <>
                                  <VolumeX className="w-3.5 h-3.5 text-rose-600" />
                                  Stop
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5" />
                                  Listen
                                </>
                              )}
                            </button>

                            {isLastAssistant && (
                              <button
                                type="button"
                                onClick={regenerateLast}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#5E587D] hover:text-[#19162D] hover:bg-[#F5F3FB] flex items-center gap-1 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
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
                              className="text-left text-xs px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white text-[#4C1D95] border border-[#E5DDFB] hover:border-[#C084FC] font-medium transition-all active:scale-95"
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

        {/* Floating Pill NikAI Composer */}
        <div className="px-4 sm:px-8 pb-5 pt-2 shrink-0 z-20">
          <div className="max-w-[780px] mx-auto">
            {(attachedNote || pendingImages.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 mb-2 px-1">
                {attachedNote && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 border border-[#DFD7FA] text-xs font-semibold text-[#5B21B6] shadow-2xs">
                    <FileText className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span className="max-w-[220px] truncate">{attachedNote.title}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedNote(null)}
                      aria-label="Detach note"
                      className="ml-0.5 text-[#8B5CF6] hover:text-[#3B0764]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {pendingImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.dataUrl}
                      alt={img.name || 'Preview'}
                      className="w-12 h-12 rounded-xl object-cover border border-[#D8B4FE] shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPendingImages((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      aria-label="Remove image"
                      className="w-5 h-5 rounded-full bg-[#19162D] text-white flex items-center justify-center absolute -top-1.5 -right-1.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[26px] bg-white/95 backdrop-blur-md border border-[#EAE6F6] shadow-[0_14px_40px_rgba(49,28,99,0.10)] focus-within:border-[#C4B5FD] transition-all px-5 pt-3.5 pb-3">
              {nikaiDictation.isListening && (
                <div
                  className="mb-1 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[11.5px] font-medium text-rose-700"
                  data-testid="nikai-dictation-indicator"
                  role="status"
                  aria-live="polite"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-bold">Listening…</span>
                  <span className="truncate text-rose-600/90">
                    {nikaiDictation.interimTranscript || 'boliye — aapki awaaz notes me jayegi'}
                  </span>
                  <button
                    type="button"
                    onClick={nikaiDictation.stop}
                    className="ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {nikaiDictation.errorMessage && (
                <p className="mb-1 text-[11px] font-medium text-amber-700">
                  {nikaiDictation.errorMessage}
                </p>
              )}

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
                placeholder="Ask NikAI anything..."
                className="w-full resize-none border-0 bg-transparent px-0.5 py-1.5 text-[15px] text-[#19162D] placeholder:text-[#9893B0] focus:outline-none max-h-44"
              />

              <div className="flex items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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

                  {nikaiDictation.isSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        if (nikaiDictation.isListening) nikaiDictation.stop();
                        else void nikaiDictation.start();
                      }}
                      aria-pressed={nikaiDictation.isListening}
                      aria-label={nikaiDictation.isListening ? 'Stop voice input' : 'Speak your request'}
                      data-testid="nikai-mic-btn"
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[13.5px] font-medium transition-colors ${
                        nikaiDictation.isListening
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'text-[#585275] hover:text-[#6D28D9] hover:bg-[#F6F3FD]'
                      }`}
                    >
                      {nikaiDictation.isListening ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4 text-[#7C7699]" />
                      )}
                      <span>{nikaiDictation.isListening ? 'Stop' : 'Voice'}</span>
                    </button>
                  )}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAttachMenuOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[13.5px] font-medium text-[#585275] hover:text-[#6D28D9] hover:bg-[#F6F3FD] transition-colors"
                    >
                      <Paperclip className="w-4 h-4 text-[#7C7699]" />
                      <span>Attach</span>
                    </button>

                    {attachMenuOpen && (
                      <div
                        className="absolute bottom-10 left-0 w-52 rounded-2xl bg-white border border-[#EAE6F7] shadow-xl p-1.5 z-50 text-xs"
                        onMouseLeave={() => setAttachMenuOpen(false)}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            fileInputRef.current?.click();
                          }}
                          className="w-full px-3 py-2 rounded-xl text-left font-medium text-[#2A2545] hover:bg-[#F6F3FD] flex items-center gap-2"
                        >
                          <ImageIcon className="w-4 h-4 text-[#8B3DFF]" />
                          <span>Upload Image / Diagram</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            loadNotesForPicker();
                            setNotePickerOpen(true);
                          }}
                          className="w-full px-3 py-2 rounded-xl text-left font-medium text-[#2A2545] hover:bg-[#F6F3FD] flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4 text-[#EC4899]" />
                          <span>Attach NikNote Page</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="h-4 w-px bg-[#E8E5F3]" aria-hidden="true" />

                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[13.5px] font-medium transition-colors ${
                      listening
                        ? 'bg-rose-50 text-rose-600 animate-pulse'
                        : 'text-[#585275] hover:text-[#6D28D9] hover:bg-[#F6F3FD]'
                    }`}
                  >
                    {listening ? (
                      <MicOff className="w-4 h-4 text-rose-600" />
                    ) : (
                      <Mic className="w-4 h-4 text-[#7C7699]" />
                    )}
                    <span>{listening ? 'Listening…' : 'Voice'}</span>
                  </button>

                  <span className="hidden sm:inline-block h-4 w-px bg-[#E8E5F3]" aria-hidden="true" />

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setComposerModelMenuOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F6F4FC] hover:bg-[#EFEAFB] border border-[#E7E2F6] text-[12.5px] font-semibold text-[#312C4D] transition-colors"
                    >
                      <SingleFourPointSparkle size={13} />
                      <span>{selectedModelDef.label}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-[#7A7495]" />
                    </button>

                    {composerModelMenuOpen && (
                      <div
                        className="absolute bottom-10 left-0 w-56 rounded-2xl bg-white border border-[#EAE6F7] shadow-xl p-1.5 z-50 text-xs"
                        onMouseLeave={() => setComposerModelMenuOpen(false)}
                      >
                        {MODEL_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setModelChoice(opt.id);
                              setComposerModelMenuOpen(false);
                            }}
                            className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between ${
                              modelChoice === opt.id
                                ? 'bg-[#F3ECFF] text-[#5B21B6] font-bold'
                                : 'text-[#312D4B] hover:bg-[#F8F6FE] font-medium'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {modelChoice === opt.id && (
                              <Check className="w-3.5 h-3.5 text-[#7C3AED]" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    aria-label="Stop generation"
                    className="w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendPrompt()}
                    disabled={!input.trim() && pendingImages.length === 0}
                    aria-label="Send message to NikAI"
                    className="w-11 h-11 rounded-full text-white flex items-center justify-center disabled:opacity-55 hover:scale-[1.03] active:scale-95 transition-all shrink-0 shadow-[0_8px_20px_rgba(147,51,234,0.34)]"
                    style={{
                      background:
                        'linear-gradient(135deg, #8B3DFF 0%, #CE4CE2 52%, #FF9356 100%)',
                    }}
                  >
                    <ArrowUp className="w-5 h-5 stroke-[2.4]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent Cross-Session Memory Vault Modal */}
      {memoryOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#1E103C]/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setMemoryOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[82vh] flex flex-col rounded-3xl bg-white border border-purple-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 text-white flex items-center justify-between"
              style={{
                background:
                  'linear-gradient(95deg, #6D28D9 0%, #B845F5 48%, #EC4899 84%, #FF965A 100%)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-white" />
                <div>
                  <h3 className="text-sm font-extrabold">NikAI Cross-Session Memory Vault</h3>
                  <p className="text-[11px] text-white/85">
                    NikAI remembers your profile, goals & past sessions automatically
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMemoryOpen(false)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMemoryFact.trim()) return;
                  const next = addManualMemoryFact(newMemoryFact);
                  setMemoryState(next);
                  setNewMemoryFact('');
                  toast.success('Pinned to NikAI Session Memory!');
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={newMemoryFact}
                  onChange={(e) => setNewMemoryFact(e.target.value)}
                  placeholder="Pin anything (e.g. Preparing for JEE 2027 · Explain in Hinglish)…"
                  className="flex-1 px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl text-white font-bold text-xs shrink-0"
                  style={{
                    background: 'linear-gradient(95deg, #7C3AED, #EC4899)',
                  }}
                >
                  Remember
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-purple-50/80 border border-purple-200/70">
                  <div className="text-[10px] font-bold uppercase text-purple-500">Name</div>
                  <div className="font-bold text-purple-950 mt-0.5">
                    {memoryState.userName || 'Auto-detects from chat'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-pink-50/80 border border-pink-200/70">
                  <div className="text-[10px] font-bold uppercase text-pink-600">Goal / Course</div>
                  <div className="font-bold text-pink-950 mt-0.5 truncate">
                    {memoryState.examOrRole || 'Auto-detects exam/goal'}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70">
                  <div className="text-[10px] font-bold uppercase text-amber-600">Language</div>
                  <div className="font-bold text-amber-950 mt-0.5">
                    {memoryState.preferredLanguage || 'Auto-Adaptive'}
                  </div>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-700 mb-1.5">
                  Searchable material ({searchableDocs.length})
                </div>
                <p className="mb-2 text-[11px] text-slate-500">
                  Imported PDFs NikAI can quote, with page numbers. Your notes are searched
                  automatically and never leave this device.
                </p>
                {searchableDocs.length === 0 ? (
                  <p className="text-slate-400 italic">
                    No imported documents yet — import a PDF from the editor to make it searchable.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {searchableDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80"
                      >
                        <span className="truncate text-slate-800 font-medium">
                          {doc.title}
                          <span className="ml-1.5 text-[10.5px] font-semibold text-slate-400">
                            {doc.pages.length} page{doc.pages.length === 1 ? '' : 's'}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Forget ${doc.title}`}
                          onClick={() => {
                            setSearchableDocs(removeKnowledgeDoc(doc.id));
                            toast.success(`Forgot “${doc.title}”`);
                          }}
                          className="text-slate-400 hover:text-rose-600 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="font-bold text-slate-700 mb-1.5">
                  Pinned Facts & Preferences ({memoryState.facts.length})
                </div>
                {memoryState.facts.length === 0 ? (
                  <p className="text-slate-400 italic">
                    Say &ldquo;Remember that…&rdquo; in chat or add a fact above!
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {memoryState.facts.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80"
                      >
                        <span className="text-slate-800 font-medium">{f.text}</span>
                        <button
                          type="button"
                          onClick={() => setMemoryState(deleteMemoryFact(f.id))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {memoryState.sessionDigests.length > 0 && (
                <div>
                  <div className="font-bold text-slate-700 mb-1.5">
                    Remembered Past Sessions ({memoryState.sessionDigests.length})
                  </div>
                  <div className="space-y-1.5">
                    {memoryState.sessionDigests.slice(0, 6).map((s) => (
                      <div
                        key={s.threadId}
                        className="px-3 py-2 rounded-xl bg-purple-50/40 border border-purple-100"
                      >
                        <div className="font-bold text-purple-950">{s.title}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{s.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {memoryCount > 0 && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMemoryState(clearAllNikAIMemory());
                      toast.info('Cleared NikAI memory vault');
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Reset All Memory
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Optional Thinking Mini-Game Modal */}
      {arcadeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#1E103C]/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setArcadeModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-4 shadow-2xl border border-purple-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-[#4C1D95]">NikAI Focus Arcade</span>
              <button
                type="button"
                onClick={() => setArcadeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <NikAIThinkingArena
              isStreaming={isGenerating}
              forceOpen
              modelName={liveModelName}
            />
          </div>
        </div>
      )}

      {/* Attach Note Modal */}
      {notePickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#1E103C]/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setNotePickerOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[75vh] flex flex-col rounded-2xl bg-white border border-purple-200 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-purple-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-purple-950">Attach Note to NikAI</h3>
              <button
                type="button"
                onClick={() => setNotePickerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 overflow-y-auto space-y-1">
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
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-purple-50/70 transition-colors"
                  >
                    <div className="text-xs font-bold text-slate-900 truncate">{n.title}</div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">{n.preview}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cloud Provider & Custom API Keys Modal */}
      {keysModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#1E103C]/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setKeysModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-purple-200 p-5 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-purple-950">NikAI Cloud Engine</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Powered by NikAI's multi-model cloud + optional personal API keys
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKeysModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  OpenAI API Key (Optional)
                </label>
                <input
                  type="password"
                  value={openaiInput}
                  onChange={(e) => setOpenaiInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Groq API Key (Optional — Ultra-Fast 120B)
                </label>
                <input
                  type="password"
                  value={groqInput}
                  onChange={(e) => setGroqInput(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google Gemini API Key (Optional — Vision 2.5)
                </label>
                <input
                  type="password"
                  value={geminiInput}
                  onChange={(e) => setGeminiInput(e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-3 py-2 rounded-xl border border-purple-200 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKeysModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
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
                  toast.success('NikAI Cloud keys saved');
                }}
                className="px-4 py-2 rounded-xl text-white text-xs font-bold"
                style={{
                  background: 'linear-gradient(95deg, #7C3AED, #EC4899)',
                }}
              >
                Save Keys
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NikAIWorkspace;
