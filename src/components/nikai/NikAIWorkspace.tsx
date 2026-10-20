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
  PlusCircle, Sparkle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AstaMarkdown } from '@/components/asta/AstaMarkdown';
import { NikAIBrand, NikAIStarConstellation } from '@/components/nikai/NikAIBrand';
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
    placeholder: 'Ask NikAI anything — notes, concepts, math, coding, exams (Hindi / Hinglish / English)…',
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
  { id: 'astra-auto', label: '✦ Astra Neural Auto', sub: 'Best model per task · Instant streaming' },
  { id: 'astra-pro', label: '🧠 Astra Pro 120B', sub: 'Maximum reasoning, STEM & deep analysis' },
  { id: 'astra-flash', label: '⚡ Astra Flash', sub: 'Sub-second ultra-fast responses' },
  { id: 'astra-vision', label: '📷 Astra Vision 2.5', sub: 'Handwriting, diagrams & photo solver' },
  { id: 'astra-coder', label: '💻 Astra Coder Pro', sub: 'Clean architecture, debugging & DSA' },
];

const STARTER_CARDS: {
  mode: AstaMode;
  tag: string;
  title: string;
  prompt: string;
  accent: string;
}[] = [
  {
    mode: 'notes',
    tag: '✍️ Smart Notes Power',
    title: 'Organic Chemistry / Physics ke Handwriting-ready Notes + Flashcards',
    prompt: 'Thermodynamics (Laws, Enthalpy, Entropy & Gibbs Free Energy) ke complete color-coded exam Smart Notes banao with key formulas, comparison table, aur memory tricks!',
    accent: '#DB2777',
  },
  {
    mode: 'teacher',
    tag: '🎓 Hinglish Guru',
    title: 'Quantum Mechanics & Wave-Particle Duality desi analogy se',
    prompt: 'Quantum Mechanics aur Heisenberg Uncertainty Principle ko bilkul zero se desi real-life analogy aur exam pro-tips ke saath Hinglish mein samjhao!',
    accent: '#7C3AED',
  },
  {
    mode: 'quiz',
    tag: '🎯 Live Playable Quiz',
    title: '5-MCQ Interactive Mock Test abhi khilo (Instant Score)',
    prompt: 'Create a 5-question interactive MCQ quiz on Indian Polity & Modern History from easy to exam-tough level.',
    accent: '#EA580C',
  },
  {
    mode: 'code',
    tag: '💻 Astra Coder',
    title: 'Production TypeScript / Python DSA + Dry Run & Complexity',
    prompt: 'Write a production-ready LRU Cache in TypeScript using Map with O(1) get/put, edge cases, and step-by-step dry run.',
    accent: '#2563EB',
  },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
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
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread?.messages.length, isGenerating, playgroundOpen]);

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

  return (
    <div
      data-nikai-root="true"
      className={`${
        embedded
          ? 'relative w-full h-full'
          : 'fixed inset-x-0 top-0 bottom-[60px] md:bottom-0 z-30'
      } flex overflow-hidden`}
      style={{
        background:
          'radial-gradient(ellipse 90% 45% at 50% -10%, rgba(139,30,224,0.10), rgba(244,107,85,0.04) 48%, rgba(250,248,255,1) 82%)',
        backgroundColor: '#FAF8FF',
        color: '#1E1B4B',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-[#1E103C]/35 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Left Session History Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[284px] flex flex-col border-r border-purple-200/60 bg-white/95 backdrop-blur-xl transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : embedded ? '-translate-x-full hidden' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3.5 border-b border-purple-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {!embedded && (
              <button
                type="button"
                onClick={() => navigate('/')}
                title="Back to NikNote"
                className="w-8 h-8 rounded-xl border border-purple-200/80 flex items-center justify-center text-purple-700 hover:bg-purple-50 transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <NikAIBrand size="sm" subtitle="Astra Neural Core" />
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className={`${embedded ? 'flex' : 'lg:hidden flex'} w-8 h-8 rounded-xl items-center justify-center text-slate-400 hover:bg-slate-100`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Session + Memory Vault + Game Quick Triggers */}
        <div className="p-3 space-y-2.5">
          <button
            type="button"
            onClick={() => startNewChat()}
            className="w-full py-2.5 px-3.5 rounded-2xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 active:scale-[0.99] transition-all"
            style={{
              background: 'linear-gradient(100deg, #5B1BC9 0%, #8B1EE0 45%, #DB2777 82%, #F46B55 100%)',
            }}
          >
            <Plus className="w-4 h-4" />
            New NikAI Session
          </button>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMemoryOpen(true);
                setSidebarOpen(false);
              }}
              className="py-2 px-2.5 rounded-xl bg-purple-50/90 hover:bg-purple-100/90 border border-purple-200/70 text-[11px] font-bold text-purple-900 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Brain className="w-3.5 h-3.5 text-purple-600" />
              Memory ({memoryCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaygroundOpen((v) => !v);
                setSidebarOpen(false);
              }}
              className="py-2 px-2.5 rounded-xl bg-amber-50/90 hover:bg-amber-100/90 border border-amber-200/80 text-[11px] font-bold text-amber-900 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-amber-600" />
              Star Game
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search remembered sessions…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-purple-50/50 border border-purple-200/70 text-xs text-slate-700 placeholder:text-purple-400/80 focus:outline-none focus:bg-white focus:border-purple-400"
            />
          </div>
        </div>

        {/* Thread History */}
        <div className="flex-1 overflow-y-auto px-2.5 pb-3 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
            Session History ({filteredThreads.length})
          </div>
          {filteredThreads.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-400">
              Your conversations & learned memories stay saved automatically across sessions.
            </div>
          ) : (
            filteredThreads.map((t) => {
              const active = t.id === activeThreadId;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveThreadId(t.id);
                    setMode(t.mode || 'auto');
                    setSidebarOpen(false);
                  }}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-purple-100/90 to-pink-50/80 text-purple-950 font-semibold border border-purple-200/80'
                      : 'text-slate-600 hover:bg-purple-50/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs truncate">{t.title}</div>
                    <div className="text-[10px] text-purple-400">
                      {t.messages.length} msgs · {new Date(t.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => deleteThread(t.id, e)}
                    aria-label="Delete session"
                    className="opacity-70 lg:opacity-0 lg:group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Cloud Status + Optional Custom API Keys */}
        <div className="p-3 border-t border-purple-100 bg-purple-50/40">
          <button
            type="button"
            onClick={() => setKeysModalOpen(true)}
            className="w-full px-3 py-2 rounded-xl border border-purple-200/80 bg-white hover:bg-purple-50/60 flex items-center justify-between text-xs font-semibold text-purple-950 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  cloudProviders.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-purple-500'
                }`}
              />
              <span className="truncate">
                {cloudProviders.length > 0 ? 'Astra Cloud Connected' : 'Astra Neural Active'}
              </span>
            </span>
            <KeyRound className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          </button>
        </div>
      </aside>

      {/* Main NikAI Studio Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Signature Bar */}
        <header className="h-14 px-3 sm:px-5 border-b border-purple-200/60 bg-white/88 backdrop-blur-xl flex items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            {!embedded && (
              <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="Back to NikNote"
                className="lg:hidden flex w-9 h-9 rounded-xl border border-purple-200/80 items-center justify-center text-purple-800 hover:bg-purple-50 active:scale-95 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Open NikAI Sessions"
              className={`${
                embedded ? 'flex' : 'lg:hidden flex'
              } w-9 h-9 rounded-xl border border-purple-200/80 items-center justify-center text-purple-800 hover:bg-purple-50 active:scale-95 shrink-0`}
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className={`${embedded ? 'flex' : 'lg:hidden flex'} items-center`}>
              <NikAIBrand size="sm" />
            </div>

            {/* Astra Model Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 via-fuchsia-50 to-orange-50 hover:from-purple-100 hover:to-pink-100 text-[11px] sm:text-xs font-bold text-purple-950 border border-purple-200/80 transition-colors"
              >
                <span className="max-w-[125px] sm:max-w-none truncate">
                  {MODEL_OPTIONS.find((m) => m.id === modelChoice)?.label || '✦ Astra Neural Auto'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              </button>

              {modelMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setModelMenuOpen(false)} />
                  <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white border border-purple-200 shadow-xl p-1.5 z-40">
                    {MODEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setModelChoice(opt.id);
                          setModelMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl transition-colors flex items-start justify-between gap-2 ${
                          modelChoice === opt.id
                            ? 'bg-gradient-to-r from-purple-100/80 to-pink-50 text-purple-950'
                            : 'hover:bg-purple-50/50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">{opt.label}</div>
                          <div className="text-[11px] text-slate-500">{opt.sub}</div>
                        </div>
                        {modelChoice === opt.id && (
                          <Check className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Power Actions: Memory Vault + Mini-Game + New Session + Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setMemoryOpen(true)}
              data-testid="nikai-memory-btn"
              className="px-2.5 py-1.5 rounded-xl border border-purple-200/80 bg-purple-50/70 hover:bg-purple-100/80 text-xs font-bold text-purple-900 flex items-center gap-1.5 transition-colors"
              title="NikAI Persistent Cross-Session Memory Vault"
            >
              <Brain className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Memory</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[10px] font-extrabold">
                {memoryCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPlaygroundOpen((v) => !v)}
              data-testid="nikai-game-btn"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                playgroundOpen
                  ? 'border-pink-400 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white shadow-sm'
                  : 'border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-900'
              }`}
              title="Play NikAI Star Catch & Brain Blitz Mini-Game"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mini-Game</span>
            </button>

            <button
              type="button"
              onClick={() => startNewChat()}
              className="px-2.5 py-1.5 rounded-xl border border-purple-200/80 hover:bg-purple-50 text-xs font-bold text-purple-900 flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New</span>
            </button>

            {embedded && (
              <button
                type="button"
                onClick={() => navigate('/ai')}
                title="Open NikAI Fullscreen Studio"
                className="px-2.5 py-1.5 rounded-xl border border-purple-200/80 hover:bg-purple-50 text-xs font-bold text-purple-900 hidden sm:flex items-center gap-1 transition-colors"
              >
                Fullscreen ↗
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close NikAI Panel"
                className="w-8 h-8 rounded-xl border border-purple-200/80 flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Conversation & Hero Stream */}
        <div
          data-scrollable="true"
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="max-w-3xl mx-auto">
            {/* Optional On-Demand Mini-Game Playground */}
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
              /* Signature NikAI Welcome Hero in Exact NikNote Brand Identity */
              <div className="pt-2 sm:pt-7 pb-6">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center text-center mb-6"
                >
                  <div className="px-5 py-3 rounded-[28px] bg-white/90 border border-purple-200/80 shadow-[0_14px_40px_-14px_rgba(124,58,237,0.28)] mb-3">
                    <NikAIBrand size={embedded ? 'md' : 'xl'} />
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
                    {memoryState.userName
                      ? `Welcome back, ${memoryState.userName}! `
                      : ''}
                    Powered by <span className="font-bold text-purple-800">Astra Neural Core</span> ·{' '}
                    <span className="font-semibold text-pink-600">Remembers Every Session</span> ·{' '}
                    <span className="font-semibold text-amber-600">1-Tap Multi-Ink Smart Notes</span>
                  </p>

                  {/* Memory Ribbon if active memories exist */}
                  {memoryCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setMemoryOpen(true)}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100/80 hover:bg-purple-200/70 text-[11px] font-bold text-purple-900 border border-purple-200 transition-colors"
                    >
                      <Sparkle className="w-3 h-3 text-pink-600" />
                      <span>
                        {memoryCount} active session {memoryCount === 1 ? 'memory' : 'memories'} synced
                        {memoryState.examOrRole ? ` · ${memoryState.examOrRole}` : ''}
                      </span>
                    </button>
                  )}
                </motion.div>

                {/* Specialist Mode Pills */}
                <div className="flex flex-wrap justify-center gap-1.5 mb-6">
                  {MODE_DEFS.map((m) => {
                    const Icon = m.icon;
                    const active = m.id === mode;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                          active
                            ? 'text-white border-transparent shadow-md'
                            : 'bg-white text-slate-600 border-purple-200/80 hover:border-purple-300 hover:bg-purple-50/40'
                        }`}
                        style={
                          active
                            ? {
                                background: `linear-gradient(120deg, ${m.badgeColor}, #DB2777)`,
                              }
                            : undefined
                        }
                      >
                        <Icon
                          className="w-3.5 h-3.5"
                          style={{ color: active ? '#FFFFFF' : m.badgeColor }}
                        />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {/* 4 Power Starter Cards */}
                <div className={`grid ${embedded ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-3`}>
                  {STARTER_CARDS.map((card, i) => (
                    <motion.button
                      key={i}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      onClick={() => sendPrompt(card.prompt, card.mode)}
                      className="text-left p-4 rounded-2xl bg-white/95 border border-purple-200/70 hover:border-pink-300 hover:shadow-md hover:shadow-purple-500/10 active:scale-[0.99] transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${card.accent}14`,
                            color: card.accent,
                          }}
                        >
                          {card.tag}
                        </span>
                        <Zap className="w-3.5 h-3.5 text-purple-300 group-hover:text-pink-500 transition-colors" />
                      </div>
                      <div className="text-[13px] font-bold text-slate-900 mb-1 leading-snug">
                        {card.title}
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-2">{card.prompt}</div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              /* Active Conversation Stream */
              <div className="space-y-6 pb-4">
                {activeMessages.map((msg, idx) => {
                  const isLastAssistant =
                    msg.role === 'assistant' && idx === activeMessages.length - 1;
                  const isCurrentlyStreaming = isLastAssistant && isGenerating;

                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div
                          className="max-w-[88%] sm:max-w-[78%] rounded-2xl rounded-tr-md px-4 py-3 text-white shadow-md shadow-purple-600/15"
                          style={{
                            background:
                              'linear-gradient(115deg, #4C1D95 0%, #6D28D9 52%, #BE185D 100%)',
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
                          <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex flex-col gap-2">
                      {/* NikAI Signature Avatar Row */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-100 via-pink-50 to-amber-50 border border-purple-200 flex items-center justify-center shrink-0">
                          <NikAIStarConstellation
                            size={18}
                            animate={isCurrentlyStreaming ? 'fast' : 'idle'}
                          />
                        </div>
                        <span
                          style={{
                            fontFamily: "'Dancing Script', 'Caveat', cursive",
                            fontWeight: 700,
                            fontSize: 20,
                            background:
                              'linear-gradient(96deg, #5B1BC9 0%, #DB2777 65%, #F46B55 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                          }}
                        >
                          NikAI
                        </span>
                        {msg.model && (
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-purple-100/80 text-purple-800">
                            {msg.model}
                            {msg.latencyMs
                              ? ` · ${(msg.latencyMs / 1000).toFixed(1)}s`
                              : ''}
                          </span>
                        )}
                      </div>

                      {/* KHATARNAK LIVE THINKING ARENA + MINI-GAME */}
                      {isCurrentlyStreaming && (
                        <NikAIThinkingArena
                          isStreaming
                          modelName={liveModelName}
                          thinkingText={liveThinkingText || msg.thinking}
                        />
                      )}

                      {/* Completed Reasoning Drawer */}
                      {!isCurrentlyStreaming && msg.thinking && (
                        <details className="rounded-xl bg-purple-50/70 border border-purple-200/80 px-3.5 py-2 text-xs text-purple-900">
                          <summary className="cursor-pointer font-bold select-none flex items-center gap-1.5">
                            <Brain className="w-3.5 h-3.5 text-purple-600" />
                            View Astra Thought Process
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-slate-600 leading-relaxed">
                            {msg.thinking}
                          </p>
                        </details>
                      )}

                      {/* Rich Markdown Answer Card */}
                      {(msg.content || !isCurrentlyStreaming) && (
                        <div className="rounded-2xl bg-white/95 border border-purple-200/75 px-4 sm:px-5 py-3.5 shadow-sm">
                          <AstaMarkdown
                            content={msg.content}
                            isStreaming={isCurrentlyStreaming}
                          />

                          {/* Supercharged Smart Notes & Action Bar */}
                          {!isCurrentlyStreaming && msg.content && (
                            <div className="mt-4 pt-3 border-t border-purple-100 flex flex-wrap items-center gap-1.5">
                              {/* 1. Insert directly into open Editor Note if embedded */}
                              {onInsertContent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onInsertContent(msg.content);
                                    toast.success('Inserted cleanly into your active Note!');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1 shadow-sm transition-all active:scale-95"
                                  style={{
                                    background:
                                      'linear-gradient(100deg, #5B1BC9 0%, #DB2777 100%)',
                                  }}
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  Insert in Note
                                </button>
                              )}

                              {/* 2. 1-Tap Save Rich Multi-Ink Note + Flashcards */}
                              <button
                                type="button"
                                disabled={implementingId === msg.id}
                                onClick={() => handleImplementNote(msg, false)}
                                data-testid={`save-smart-note-${idx}`}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                  msg.savedNoteId
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/80'
                                }`}
                              >
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                {msg.savedNoteId ? 'Saved Smart Note ✓' : 'Save Smart Note'}
                              </button>

                              {/* 3. Open Directly Inside Multi-Ink Handwriting Canvas */}
                              <button
                                type="button"
                                disabled={implementingId === msg.id}
                                onClick={() => handleImplementNote(msg, true)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200/80 flex items-center gap-1 transition-colors"
                              >
                                <Feather className="w-3.5 h-3.5" />
                                Open in Handwriting
                              </button>

                              {/* 4. 1-Tap Flashcard Deck Extractor */}
                              <button
                                type="button"
                                onClick={() => handleMakeFlashcardsOnly(msg)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 flex items-center gap-1 transition-colors"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                Flashcards
                              </button>

                              {/* Copy */}
                              <button
                                type="button"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(msg.content);
                                  setCopiedId(msg.id);
                                  setTimeout(() => setCopiedId(null), 1800);
                                }}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-colors"
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

                              {/* Listen */}
                              <button
                                type="button"
                                onClick={() => toggleSpeakMessage(msg)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-colors"
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
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Regenerate
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Smart Next-Step Chips */}
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
                                className="text-left text-xs px-3 py-1.5 rounded-full bg-white hover:bg-purple-50 text-purple-900 border border-purple-200/80 hover:border-pink-300 font-semibold transition-all active:scale-95"
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

        {/* Sticky Bottom Unified NikAI Composer */}
        <div className="px-3 sm:px-6 pb-3 pt-2 bg-gradient-to-t from-[#FAF8FF] via-[#FAF8FF] to-transparent shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Active Note & Image Attachment Pills */}
            {(attachedNote || pendingImages.length > 0) && (
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {attachedNote && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100/90 border border-purple-200 text-xs font-bold text-purple-900">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                    <span className="max-w-[200px] truncate">{attachedNote.title}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedNote(null)}
                      className="ml-0.5 text-purple-500 hover:text-purple-950"
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
                      className="w-12 h-12 rounded-xl object-cover border border-purple-300"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPendingImages((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center absolute -top-1.5 -right-1.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Main Composer Box */}
            <div className="rounded-2xl bg-white border border-purple-200/90 shadow-lg shadow-purple-900/5 focus-within:border-purple-400 transition-colors p-2">
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
                className="w-full resize-none border-0 bg-transparent px-2.5 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none max-h-44"
              />

              <div className="flex items-center justify-between gap-2 pt-1 px-1">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
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

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach photo / homework diagram"
                    className="p-2 rounded-xl text-purple-600 hover:text-purple-900 hover:bg-purple-50 active:scale-95 transition-all"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      loadNotesForPicker();
                      setNotePickerOpen(true);
                    }}
                    title="Attach any NikNote page as context"
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-50 flex items-center gap-1 active:scale-95 transition-all"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Attach Note</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    title="Voice input"
                    className={`p-2 rounded-xl transition-all active:scale-95 ${
                      listening
                        ? 'bg-rose-50 text-rose-600 animate-pulse'
                        : 'text-purple-600 hover:text-purple-900 hover:bg-purple-50'
                    }`}
                  >
                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Quick Mode Cycle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx =
                        (MODE_DEFS.findIndex((m) => m.id === mode) + 1) % MODE_DEFS.length;
                      setMode(MODE_DEFS[nextIdx].id);
                    }}
                    title="Switch NikAI Specialist Mode"
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-purple-200 bg-purple-50/70 text-purple-900 flex items-center gap-1 shrink-0"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: currentModeDef.badgeColor }}
                    />
                    {currentModeDef.shortLabel}
                  </button>
                </div>

                {/* Send or Stop Button */}
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    aria-label="Stop generation"
                    className="h-9 px-3.5 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-rose-700 active:scale-95 shrink-0"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendPrompt()}
                    disabled={!input.trim() && pendingImages.length === 0}
                    aria-label="Send message to NikAI"
                    className="h-9 px-4 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition-all shrink-0 shadow-md shadow-purple-500/20"
                    style={{
                      background:
                        'linear-gradient(100deg, #5B1BC9 0%, #8B1EE0 45%, #DB2777 82%, #F46B55 100%)',
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Ask NikAI</span>
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
          className="fixed inset-0 z-50 bg-[#1E103C]/50 backdrop-blur-xs flex items-center justify-center p-4"
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
                  'linear-gradient(100deg, #4C1D95 0%, #7E22CE 48%, #DB2777 88%, #F46B55 100%)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-extrabold">NikAI Cross-Session Memory Vault</h3>
                  <p className="text-[11px] text-white/80">
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
              {/* Pin a Custom Memory */}
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
                    background: 'linear-gradient(100deg, #5B1BC9, #DB2777)',
                  }}
                >
                  Remember
                </button>
              </form>

              {/* Auto-Learned Profile Pills */}
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

              {/* Pinned Facts */}
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

              {/* Past Session Summaries */}
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
                <h3 className="text-sm font-bold text-purple-950">NikAI Astra Cloud Engine</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Powered by Astra Multi-Model Cloud + optional personal API keys
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
                  background: 'linear-gradient(100deg, #5B1BC9, #DB2777)',
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
