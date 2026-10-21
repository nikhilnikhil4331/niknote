import React, { useState, useRef, useCallback, useEffect } from 'react';
import { haptic } from '@/hooks/useHaptics';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { MobileEditorHeader, MobileEditorToolbar } from '@/components/mobile/MobileEditorChrome';
import { useMobileAppearance } from '@/components/mobile/useMobileAppearance';
import { HandwritingTextImporter } from '@/components/HandwritingTextImporter';
import { useNotebooks } from '@/hooks/useNotebooks';
import { supabase } from '@/integrations/supabase/client';
import type { Block } from '@/types/block';
import { type PageStyle } from '@/types/notes';
import { NotionEditor } from '@/components/editor/NotionEditor';
import { useBlockEditor } from '@/hooks/useBlockEditor';
import { lazy } from 'react';
const SmartEditor = lazy(() => import('@/components/smart-editor/SmartEditor').then(m => ({ default: m.SmartEditor })));
const AIWorkspacePanel = lazy(() => import('@/components/ai-workspace/AIWorkspacePanel').then(m => ({ default: m.AIWorkspacePanel })));
import type { EditorSuggestion } from '@/components/smart-editor/SmartEditor';
import { NotebookPreview, NotebookPreviewHandle } from '@/components/NotebookPreview';
import { PenPalette } from '@/components/PenPalette';
const ControlPanel = lazy(() => import('@/components/ControlPanel').then(m => ({ default: m.ControlPanel })));
import { PageBar } from '@/components/PageBar';
import { MoodSelector } from '@/components/MoodSelector';
import { SlidePanel } from '@/components/SlidePanel';
import { MobileBottomNav, MobileTab } from '@/components/MobileBottomNav';
const MobileStyleSheet = lazy(() => import('@/components/MobileStyleSheet').then(m => ({ default: m.MobileStyleSheet })));
import { QuickStylesBar } from '@/components/QuickStylesBar';
import { useNoteSettings } from '@/hooks/useNoteSettings';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDiagrams } from '@/hooks/useDiagrams';
import { useTableData } from '@/hooks/useTableData';
import { useNotebookPages } from '@/hooks/useNotebookPages';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useMood } from '@/hooks/useMood';
import { useIsMobile } from '@/hooks/use-mobile';
import { exportToPDF, ExportProgress } from '@/utils/export';
import { toast } from 'sonner';
import { shareAsImage, shareAsPDF } from '@/utils/share';
const WorkspaceSidebar = lazy(() => import('@/components/workspace/WorkspaceSidebar').then(m => ({ default: m.WorkspaceSidebar })));
import {
  Settings2, Edit3, FileDown, Palette, Crown, LogIn, Cloud, RefreshCw, CheckCircle2,
  Gem, MoreVertical, Moon, Sun, RotateCcw, Share2, Image, FileText,
  LayoutGrid, Scan, Brain, PanelLeft, ChevronDown, MessageSquare, Zap, Undo2, Redo2, Save, Eye, PenLine, Upload,
  Calculator, ListChecks, FileUp, Sparkles, ChevronLeft, ChevronRight, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NoteLine, LineInkColor, LINE_INK_COLORS, generateLineId, getDefaultColorForLine, LineHistory } from '@/types/noteLine';
import { createBlock } from '@/types/block';
import { InlineDiagram } from '@/types/noteLine';
import { useAutoPagination } from '@/hooks/useAutoPagination';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { PaywallModal } from '@/components/premium/PaywallModal';
import {
  isCloudUserId,
  PC_ACTIVE_META_KEY,
  useCloudSyncStatus,
  notifyLocalDataChanged,
  updateSyncSnapshot,
} from '@/lib/cloudSyncEngine';
import { usePremium, PremiumFeature } from '@/hooks/usePremium';

import { useAuth } from '@/contexts/AuthContext';
import { useHandwritingDNA } from '@/contexts/HandwritingDNAContext';
const HandwritingScanner = lazy(() => import('@/components/handwriting-dna/HandwritingScanner').then(m => ({ default: m.HandwritingScanner })));
const CommandPalette = lazy(() => import('@/components/command-palette/CommandPalette').then(m => ({ default: m.CommandPalette })));
import { useUITheme, UI_THEMES, UITheme, getThemeClasses } from '@/utils/uiThemes';
import { cn } from '@/lib/utils';
import { persistMobileDraftNotebook } from '@/lib/mobileDraft';
import { HeaderProfileButton } from '@/components/HeaderProfileButton';
const DiagramToolbar = lazy(() => import('@/components/DiagramToolbar').then(m => ({ default: m.DiagramToolbar })));
import { useInlineContent } from '@/hooks/useInlineContent';
import { Toolbar } from '@/components/Toolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toggleMark } from '@/lib/inlineMarks';
import {
  markdownToStructuredLines,
  stripMarkdownNoise,
  structuredToBlocks,
  structuredToNoteLines,
  type StructuredLine,
} from '@/lib/noteStructure';
import { composeStudyNotes } from '@/lib/aiNotes';
import { noteLinesToBlocks } from '@/lib/noteStructure';
import { PageStage, type PageStageHandle } from '@/components/notes/PageStage';
import { SketchToolbar, type SketchSettings } from '@/components/notes/SketchToolbar';
import { usePageStrokes } from '@/hooks/usePageStrokes';
import { SemiCircularDial } from '@/components/dial/SemiCircularDial';
import { readPdf } from '@/lib/pdfText';
const HandwritingStudio = lazy(() => import('@/components/handwriting-dna/HandwritingStudio').then(m => ({ default: m.HandwritingStudio })));

const Index = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const mobileAppearance = useMobileAppearance();
  const [noteTitle, setNoteTitle] = useState(() => localStorage.getItem('niknote-mobile-draft-title') || 'Untitled Note');
  useEffect(() => { localStorage.setItem('niknote-mobile-draft-title', noteTitle); }, [noteTitle]);
  const [editorTool, setEditorTool] = useState('pen');
  const [mobileView, setMobileView] = useState<'write' | 'preview'>('write');
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [cloudNotebookId, setCloudNotebookId] = useState<string | null>(new URLSearchParams(search).get('notebook') || localStorage.getItem('niknote-mobile-draft-notebook'));
  const { createNotebook, updateNotebook } = useNotebooks();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textSelectionRef = useRef<{ index: number; start: number; end: number } | null>(null);
  useEffect(() => {
    const capture = () => {
      const el = document.activeElement as HTMLTextAreaElement;
      if (el?.tagName !== 'TEXTAREA' || !el.closest('.nn-editor-canvas')) return;
      textSelectionRef.current = { index: Array.from(document.querySelectorAll('.nn-editor-canvas textarea')).indexOf(el), start: el.selectionStart, end: el.selectionEnd };
    };
    document.addEventListener('selectionchange', capture);
    return () => document.removeEventListener('selectionchange', capture);
  }, []);
  const { user, isGuest, signInAsGuest } = useAuth();
  const cloudSync = useCloudSyncStatus(user?.id);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const dnaContext = useHandwritingDNA();
  const { theme: uiTheme, setTheme: setUITheme, classes: themeClasses } = useUITheme();
  const isMobile = useIsMobile();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [glassMode, setGlassMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);

  // Command Palette keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [pageDirection, setPageDirection] = useState<'left' | 'right' | 'none'>('none');
  const [showPenPanel, setShowPenPanel] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showScanPanel, setShowScanPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showAIWorkspace, setShowAIWorkspace] = useState(false);
  const [showStudioPanel, setShowStudioPanel] = useState(false);
  const homePdfRef = useRef<HTMLInputElement>(null);

  // Mobile state
  const [mobileTab, setMobileTab] = useState<MobileTab>('write');
  const [showMobileStyleSheet, setShowMobileStyleSheet] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);

  const { settings, updateSettings, updateMargins, updateHeaderFooter, resetSettings } = useNoteSettings();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { diagrams, addDiagram, removeDiagram, updateDiagram } = useDiagrams();
  const { tableData, updateTableData } = useTableData(settings.table.rows, settings.table.columns);
  const { content: inlineContent, addImage, addDiagram: addInlineDiagram, updateContent, removeContent } = useInlineContent();
  const { mood, changeMood, styles: moodStyles } = useMood();
  const previewRef = useRef<NotebookPreviewHandle>(null);
  const pageStageRef = useRef<PageStageHandle>(null);
  const sketchStore = usePageStrokes();
  const [sketch, setSketch] = useState<SketchSettings>({ enabled: false, tool: 'pen', color: '#1e2a78', width: 2.6 });
  const updateSketch = useCallback((patch: Partial<SketchSettings>) => setSketch(prev => ({ ...prev, ...patch })), []);
  const isPastingRef = useRef(false);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const [exportMount, setExportMount] = useState(false);
  const [exportLinesOverride, setExportLinesOverride] = useState<NoteLine[] | null>(null);
  const { triggerHaptic } = useHaptics();
  const { playClick, playSuccess } = useSoundEffects();
  const premium = usePremium();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<PremiumFeature | null>(null);
  const requirePremium = useCallback((feature: PremiumFeature) => {
    setPendingFeature(feature);
    setPaywallOpen(true);
  }, []);
  const quickDictation = useSpeechDictation({
    onFinalTranscript: (text) => { if (isMobile) blockEditor.setBlocks([...blockEditor.blocks, createBlock('text', text)]); else handlePaste(text); }
  });

  const {
    pages, currentPageIndex, currentPage, totalPages,
    goToPage, nextPage, prevPage, addNewPage, deletePage,
    updateCurrentPageLines, replaceAllPages, flowOverflowFrom, canGoNext, canGoPrev
  } = useNotebookPages();

  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [currentColor, setCurrentColor] = useState<LineInkColor>('black');
  const [realPenMode, setRealPenMode] = useState(false);
  const [lineHistories, setLineHistories] = useState<Map<string, LineHistory>>(new Map());
  const lines = currentPage.lines;
  const currentStrokes = sketchStore.strokesFor(currentPage.id);

  const blockEditor = useBlockEditor();
  useEffect(() => {
    if (!isMobile) return;
    try { localStorage.setItem('niknote_autosave', JSON.stringify(blockEditor.blocks)); } catch {}
  }, [isMobile, blockEditor.blocks]);
  const previewLines = blockEditor.blocks.some(b => b.content.trim()) ? blockEditor.lines : lines;
  const hasContent = blockEditor.blocks.some(b => b.content.trim()) || lines.some(l => l.text.trim());

  // Restore PC cloud notebook automatically on clean browsers & auto-sync edits to Supabase Cloud
  const pcHydratedUserRef = useRef<string | null>(null);
  const pcInitialRenderRef = useRef(true);

  useEffect(() => {
    if (isMobile || !isCloudUserId(user?.id)) return;
    if (pcHydratedUserRef.current === user.id) return;
    pcHydratedUserRef.current = user.id;

    // Restore cloudNotebookId if cached on this browser
    let storedNotebookId: string | null = null;
    try {
      const meta = JSON.parse(localStorage.getItem(PC_ACTIVE_META_KEY) || '{}');
      if (meta?.userId === user.id && isCloudUserId(meta?.notebookId)) {
        storedNotebookId = meta.notebookId;
        setCloudNotebookId(meta.notebookId);
        if (meta.title) setNoteTitle(meta.title);
      }
    } catch {
      // ignore
    }

    const localHasLines = pages.some((p) => p.lines.some((l) => l.text.trim().length > 0));
    if (localHasLines) return;

    // Clean device with empty paper -> pull most recent cloud notebook onto PC studio automatically!
    void (async () => {
      try {
        const nbQuery = storedNotebookId
          ? await supabase.from('notebooks').select('id, title, page_style').eq('id', storedNotebookId).maybeSingle()
          : await supabase.from('notebooks').select('id, title, page_style').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
        const nb = nbQuery?.data;
        if (!nb?.id) return;

        const { data: nbPages } = await supabase
          .from('notebook_pages')
          .select('id, page_number, lines')
          .eq('notebook_id', nb.id)
          .order('page_number', { ascending: true });

        if (Array.isArray(nbPages) && nbPages.length > 0 && nbPages.some((p: any) => Array.isArray(p.lines) && p.lines.some((l: any) => l?.text))) {
          setCloudNotebookId(nb.id);
          setNoteTitle(nb.title || 'Untitled Note');
          replaceAllPages(
            nbPages.map((p: any, idx: number) => ({
              id: p.id || `page-cloud-${idx}`,
              lines: Array.isArray(p.lines) ? p.lines : [],
              createdAt: Date.now(),
            }))
          );
          updateSyncSnapshot({ state: 'synced', lastSyncedAt: new Date().toISOString() });
        }
      } catch {
        // local paper remains active
      }
    })();
  }, [isMobile, user?.id, pages, replaceAllPages]);

  // Debounced background cloud sync of PC Notebook pages -> Supabase `notebooks` + `notebook_pages` + `pages`
  useEffect(() => {
    if (isMobile) return;
    if (pcInitialRenderRef.current) {
      pcInitialRenderRef.current = false;
      return;
    }
    if (!isCloudUserId(user?.id)) return;
    const anyNonEmpty = pages.some((p) => p.lines.some((l) => l.text.trim().length > 0));
    if (!anyNonEmpty) return;

    const timer = window.setTimeout(async () => {
      try {
        updateSyncSnapshot({ state: 'syncing', errorMessage: null });
        let nbId = cloudNotebookId && isCloudUserId(cloudNotebookId) ? cloudNotebookId : null;

        if (!nbId) {
          const { data: created, error: createErr } = await supabase
            .from('notebooks')
            .insert({
              user_id: user.id,
              title: noteTitle || 'PC Notebook',
              cover_color: '#7c3aed',
              page_style: settings.pageStyle,
              page_size: settings.pageSize,
              tags: ['PC Studio'],
            })
            .select('id')
            .single();
          if (createErr || !created?.id) throw createErr || new Error('Could not create cloud notebook');
          nbId = created.id;
          setCloudNotebookId(nbId);
        } else {
          await supabase
            .from('notebooks')
            .update({ title: noteTitle || 'PC Notebook', page_style: settings.pageStyle })
            .eq('id', nbId);
        }

        try {
          localStorage.setItem(
            PC_ACTIVE_META_KEY,
            JSON.stringify({ userId: user.id, notebookId: nbId, title: noteTitle || 'PC Notebook' })
          );
        } catch {
          // ignore
        }

        // Sync rich handwritten multi-page lines to `notebook_pages`
        await supabase.from('notebook_pages').delete().eq('notebook_id', nbId);
        await supabase.from('notebook_pages').insert(
          pages.map((p, idx) => ({
            notebook_id: nbId,
            page_number: idx + 1,
            lines: p.lines as any,
          }))
        );

        // Mirror flat blocks into `pages` so mobile editor & NikAI Smart Notes also see PC notes immediately!
        const allBlocks: Block[] = pages
          .flatMap((p) => p.lines)
          .filter((l) => l.text.trim().length > 0)
          .map((l) => ({ ...createBlock('text', l.text), color: l.color }));

        await supabase.from('pages').upsert(
          {
            notebook_id: nbId,
            user_id: user.id,
            page_number: 1,
            title: noteTitle || 'PC Notebook',
            content: (allBlocks.length ? allBlocks : [createBlock('text', '')]) as any,
          },
          { onConflict: 'notebook_id,page_number' }
        );

        updateSyncSnapshot({ state: 'synced', lastSyncedAt: new Date().toISOString(), errorMessage: null });
      } catch (err) {
        updateSyncSnapshot({
          state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error',
          errorMessage: err instanceof Error ? err.message : 'Sync paused',
        });
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [pages, noteTitle, settings.pageStyle, settings.pageSize, isMobile, user?.id, cloudNotebookId]);

  // Mobile Editor Auto-Save (Local + Cloud): automatically persists typed blocks in 700ms so users never lose notes!
  useEffect(() => {
    const isEditorOpen = new URLSearchParams(search).has('editor');
    if (!isMobile || !isEditorOpen) return;
    const nonEmptyBlocks = blockEditor.blocks.some((b) => (b.content || '').trim().length > 0);
    if (!nonEmptyBlocks && !noteTitle.trim()) return;

    const timer = window.setTimeout(() => {
      try {
        const localRaw = localStorage.getItem('niknote.mobile.notebooks.v1');
        const list: any[] = localRaw ? JSON.parse(localRaw) : [];
        const id = cloudNotebookId || `local-${Date.now()}`;
        if (!cloudNotebookId) setCloudNotebookId(id);
        const now = new Date().toISOString();
        const entry = {
          id,
          title: noteTitle || 'Untitled Note',
          blocks: blockEditor.blocks,
          page_style: settings.pageStyle,
          tags: ['Notes'],
          updated_at: now,
        };
        const idx = list.findIndex((item) => item.id === id);
        const next = idx >= 0 ? list.map((item, i) => (i === idx ? entry : item)) : [entry, ...list];
        localStorage.setItem('niknote.mobile.notebooks.v1', JSON.stringify(next));
        notifyLocalDataChanged();
      } catch {
        // ignore quota errors
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [isMobile, search, blockEditor.blocks, noteTitle, settings.pageStyle, cloudNotebookId]);

  // Auto-trigger onboarding ONLY for permanent registered accounts (never hijack Guest or PC Studio load!)
  useEffect(() => {
    if (user && !isGuest) {
      const hasSeenOnboarding = localStorage.getItem('niknote_onboarding_done');
      if (!hasSeenOnboarding) {
        navigate('/onboarding');
      } else {
        // Welcome back toast for returning users
        const lastVisit = localStorage.getItem('niknote_last_visit');
        const today = new Date().toISOString().split('T')[0];
        if (lastVisit && lastVisit !== today) {
          toast.success('Welcome back! 👋 Your streak continues 🔥');
        } else if (!lastVisit) {
          localStorage.setItem('niknote_last_visit', today);
        }
        localStorage.setItem('niknote_last_visit', today);

        // Referral reminder (show once every 7 days)
        const lastReferralPrompt = localStorage.getItem('niknote_referral_prompt');
        const daysSincePrompt = lastReferralPrompt ? (Date.now() - parseInt(lastReferralPrompt, 10)) / 86400000 : 999;
        if (daysSincePrompt >= 7) {
          setTimeout(() => {
            toast('Share NikNote with friends? 🎁', {
              description: '3 friends = 7 days FREE Premium!',
              duration: 8000,
              action: {
                label: 'Share 📱',
                onClick: () => {
                  const msg = encodeURIComponent('🎓 NikNote — Free AI Study App! ✨\n\n✍️ Handwriting notes (16+ styles)\n🧠 AI Teacher (Hindi!)\n📝 Quiz + Flashcards\n\nDownload FREE: https://www.niknote.online');
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }
              }
            });
            localStorage.setItem('niknote_referral_prompt', Date.now().toString());
          }, 10000);
        }
      }
    }
  }, [user, navigate]);

  useEffect(() => { setSelectedLines(new Set()); }, [currentPageIndex]);

  // Keep the current mobile identity durable even when a reload skips cleanup.
  useEffect(() => {
    if (!isMobile) return;
    try { persistMobileDraftNotebook(localStorage, cloudNotebookId); } catch {}
  }, [cloudNotebookId, isMobile]);
  const initialPageRef = useRef(true);
  useEffect(() => {
    if (initialPageRef.current) { initialPageRef.current = false; if (isMobile) return; }
    const currentPageContent = currentPage.lines;
    // Preserve headings / lists / equations when a page becomes active again.
    blockEditor.setBlocks(noteLinesToBlocks(currentPageContent));
  }, [currentPageIndex]);

  useEffect(() => {
    if (isMobile) setRealPenMode(mobileAppearance.appearance.realPen);
    const pending = sessionStorage.getItem('niknote-mobile-open');
    if (pending) {
      sessionStorage.removeItem('niknote-mobile-open');
      try {
        const note = JSON.parse(pending) as { title: string; blocks: Block[]; notebookId?: string; style?: PageStyle };
        setNoteTitle(note.title);
        const safeBlocks = note.blocks.length ? note.blocks : [createBlock()];
        blockEditor.setBlocks(safeBlocks);
        updateCurrentPageLines(
          safeBlocks.map((b, index) => ({
            id: generateLineId(),
            text: b.content || '',
            color: (b.color as LineInkColor) || 'blue',
            timestamp: Date.now() + index,
          }))
        );
        setCloudNotebookId(note.notebookId || null);
        if (note.style) updateSettings({ pageStyle: note.style });
      } catch { toast.error('Could not open this note'); }
    } else if (isMobile && new URLSearchParams(search).has('new')) {
      blockEditor.setBlocks([createBlock()]); setCloudNotebookId(null); setNoteTitle('Untitled Note');
      navigate('/?editor=1', { replace: true });
    }
    const panel = new URLSearchParams(search).get('panel');
    if (panel === 'scan') setShowScanPanel(true);
    if (panel === 'import') setShowImportPanel(true);
  }, []);

  const pendingGuestSave = useRef(false);
  const saveRef = useRef<() => void>();
  useEffect(() => { if (user && pendingGuestSave.current) { pendingGuestSave.current = false; window.setTimeout(() => saveRef.current?.(), 0); } }, [user]);
  const saveMobileNote = async () => {
    if (savingNote) return;
    setSavingNote(true);
    try {
      // Local-first device persistence whenever user is not signed into cloud UUID yet
      if (!isCloudUserId(user?.id)) {
        const localRaw = localStorage.getItem('niknote.mobile.notebooks.v1');
        const list: any[] = localRaw ? JSON.parse(localRaw) : [];
        const id = cloudNotebookId || `local-${Date.now()}`;
        const now = new Date().toISOString();
        const entry = {
          id,
          title: noteTitle || 'Untitled Note',
          blocks: blockEditor.blocks,
          page_style: settings.pageStyle,
          tags: ['Notes'],
          updated_at: now,
        };
        const idx = list.findIndex((item) => item.id === id);
        const next = idx >= 0 ? list.map((item, i) => (i === idx ? entry : item)) : [entry, ...list];
        localStorage.setItem('niknote.mobile.notebooks.v1', JSON.stringify(next));

        // Also mirror into niknote.notes.v1 so Asta AI can attach any saved note
        try {
          const notesRaw = localStorage.getItem('niknote.notes.v1');
          const notesList: any[] = notesRaw ? JSON.parse(notesRaw) : [];
          const plain = blockEditor.blocks.map((b) => b.content).join('\n');
          const mirror = {
            id,
            title: entry.title,
            icon: '📝',
            content: plain,
            starred: false,
            tags: ['Notes'],
            parentId: null,
            trashedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          const mIdx = notesList.findIndex((n) => n.id === id);
          localStorage.setItem(
            'niknote.notes.v1',
            JSON.stringify(mIdx >= 0 ? notesList.map((n, i) => (i === mIdx ? mirror : n)) : [mirror, ...notesList])
          );
        } catch {
          // ignore mirror quota issue
        }

        setCloudNotebookId(id);
        notifyLocalDataChanged();
        toast.success('Note saved on this device ✨');
        return;
      }

      let id = cloudNotebookId;
      if (!id || id.startsWith('local-')) {
        const notebook = await createNotebook({ title: noteTitle || 'Untitled Note', cover_color: '#9b85eb', tags: ['Notes'], page_style: settings.pageStyle, page_size: settings.pageSize });
        if (!notebook) return;
        id = notebook.id; setCloudNotebookId(id);
      } else await updateNotebook(id, { title: noteTitle, page_style: settings.pageStyle });
      const { data: existing, error: readError } = await supabase.from('pages').select('id').eq('notebook_id', id).order('page_number').limit(1);
      if (readError) throw readError;
      const result = existing?.[0]
        ? await supabase.from('pages').update({ content: blockEditor.blocks as any, title: noteTitle }).eq('id', existing[0].id)
        : await supabase.from('pages').insert({ notebook_id: id, user_id: user.id, page_number: 1, title: noteTitle, content: blockEditor.blocks as any });
      if (result.error) throw result.error;
      toast.success('Note saved to your notebooks');
    } catch { toast.error('Could not save note. Your local draft is still available.'); }
    finally { setSavingNote(false); }
  };
  saveRef.current = saveMobileNote;

  const selectEditorTool = (tool: string) => {
    setEditorTool(tool);
    if (tool === 'pen') setShowPenPanel(true);
    if (tool === 'image') imageInputRef.current?.click();
    if (tool === 'text') document.querySelector<HTMLTextAreaElement>('.nn-editor-canvas textarea')?.focus();
    if (tool === 'eraser') {
      const selected = textSelectionRef.current;
      if (selected && selected.index >= 0 && selected.end > selected.start) {
        blockEditor.setBlocks(blockEditor.blocks.map((b, i) => i === selected.index ? { ...b, content: b.content.slice(0, selected.start) + b.content.slice(selected.end) } : b));
        textSelectionRef.current = null;
      } else toast.info('Select text in your note, then tap Eraser');
    }
    if (tool === 'highlighter') {
      const index = textSelectionRef.current?.index ?? 0;
      blockEditor.setBlocks(blockEditor.blocks.map((b, i) => i === index ? { ...b, type: b.type === 'callout' ? 'text' : 'callout' } : b));
      toast.info('Block highlight toggled');
    }
    if (tool === 'voice') {
      if (!quickDictation.isSupported) { toast.info('Voice is unavailable in this browser'); return; }
      if (quickDictation.isListening) quickDictation.stop(); else quickDictation.start();
    }
  };

  useEffect(() => {
    if (!isMobile || !new URLSearchParams(search).has('notebook')) return;
    const id = new URLSearchParams(search).get('notebook');
    if (!id) return;
    if (id.startsWith('local-') || !user) {
      try {
        const localList: any[] = JSON.parse(localStorage.getItem('niknote.mobile.notebooks.v1') || '[]');
        const found = localList.find((item) => item.id === id);
        if (found) {
          setNoteTitle(found.title || 'Untitled Note');
          if (found.page_style) updateSettings({ pageStyle: found.page_style as PageStyle });
          if (Array.isArray(found.blocks) && found.blocks.length) blockEditor.setBlocks(found.blocks);
        }
      } catch {
        // ignore parse issues
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: notebook }, { data: savedPages, error }] = await Promise.all([
        supabase.from('notebooks').select('title,page_style').eq('id', id).maybeSingle(),
        supabase.from('pages').select('content').eq('notebook_id', id).order('page_number').limit(1),
      ]);
      if (cancelled) return;
      if (error) { toast.error('Could not load saved note'); return; }
      if (notebook) { setNoteTitle(notebook.title); updateSettings({ pageStyle: notebook.page_style as PageStyle }); }
      if (Array.isArray(savedPages?.[0]?.content) && savedPages[0].content.length) blockEditor.setBlocks(savedPages[0].content as unknown as Block[]);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Mobile tab handler
  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    if (tab === 'style') { setShowMobileStyleSheet(true); return; }
    if (tab === 'ai') { navigate('/ai'); return; }
    setMobileTab(tab);
  }, [navigate]);

  // Editor focus tracking
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') setEditorFocused(true);
    };
    const handleFocusOut = (e: FocusEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        setTimeout(() => setEditorFocused(false), 200);
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Line operations
  const saveToHistory = useCallback((lineId: string, line: NoteLine) => {
    setLineHistories((prev) => {
      const n = new Map(prev);
      const h = n.get(lineId) || { past: [], future: [] };
      n.set(lineId, { past: [...h.past.slice(-20), line], future: [] });
      return n;
    });
  }, []);

  const updateLineText = useCallback((lineId: string, text: string) => {
    const idx = lines.findIndex(l => l.id === lineId);
    if (idx === -1) return;
    saveToHistory(lineId, lines[idx]);
    updateCurrentPageLines(lines.map(l => l.id === lineId ? { ...l, text, timestamp: Date.now() } : l));
  }, [lines, saveToHistory, updateCurrentPageLines]);

  const updateLineColor = useCallback((lineId: string, color: LineInkColor) => {
    updateCurrentPageLines(lines.map(l => l.id === lineId ? { ...l, color, timestamp: Date.now() } : l));
  }, [lines, updateCurrentPageLines]);

  const updateSelectedLinesColor = useCallback((color: LineInkColor) => {
    if (selectedLines.size === 0) return;
    updateCurrentPageLines(lines.map(l => selectedLines.has(l.id) ? { ...l, color, timestamp: Date.now() } : l));
    setCurrentColor(color);
  }, [lines, selectedLines, updateCurrentPageLines]);

  const addLine = useCallback((afterLineId?: string): string => {
    const newId = generateLineId();
    const idx = afterLineId ? lines.findIndex(l => l.id === afterLineId) + 1 : lines.length;
    const newLine: NoteLine = { id: newId, text: '', color: getDefaultColorForLine(idx), timestamp: Date.now() };
    const newLines = [...lines];
    newLines.splice(idx, 0, newLine);
    updateCurrentPageLines(newLines);
    return newId;
  }, [lines, updateCurrentPageLines]);

  const removeLine = useCallback((lineId: string) => {
    if (lines.length <= 1) {
      updateCurrentPageLines(lines.map(l => l.id === lineId ? { ...l, text: '', timestamp: Date.now() } : l));
    } else {
      updateCurrentPageLines(lines.filter(l => l.id !== lineId));
    }
    setSelectedLines(prev => { const n = new Set(prev); n.delete(lineId); return n; });
  }, [lines, updateCurrentPageLines]);

  const selectLine = useCallback((lineId: string, multiSelect = false) => {
    setSelectedLines(prev => {
      if (multiSelect) { const n = new Set(prev); if (n.has(lineId)) n.delete(lineId); else n.add(lineId); return n; }
      return new Set([lineId]);
    });
    const line = lines.find(l => l.id === lineId);
    if (line) setCurrentColor(line.color);
  }, [lines]);

  const clearSelection = useCallback(() => { setSelectedLines(new Set()); }, []);

  const autoPagination = useAutoPagination({ settings, lines, updateLines: updateCurrentPageLines, addNewPage, totalPages, currentPageIndex, goToPage });

  /** Shared low-level insert into the lines model (batches + auto-flow pages). */
  const insertNoteLinesAt = useCallback((newLinesData: NoteLine[], atLineId?: string, atIndex?: number) => {
    if (!newLinesData.length) return;
    const requested = atIndex !== undefined ? Math.max(0, Math.min(atIndex, lines.length - 1)) : -1;
    const insertIndex = requested >= 0 ? requested : atLineId ? lines.findIndex(l => l.id === atLineId) : lines.length - 1;
    if (insertIndex === -1) return;
    const currentLine = lines[insertIndex];
    const baseBefore = (currentLine?.text ?? '') === '' ? lines.slice(0, insertIndex) : lines.slice(0, insertIndex + 1);
    const baseAfter = lines.slice(insertIndex + 1);
    isPastingRef.current = true;
    let inserted: NoteLine[] = [];
    let lastWorking: NoteLine[] = [...baseBefore, ...baseAfter];
    const batchSize = newLinesData.length > 50 ? 12 : 30;
    const tick = () => {
      const nextBatch = newLinesData.slice(inserted.length, inserted.length + batchSize);
      inserted = inserted.concat(nextBatch);
      lastWorking = [...baseBefore, ...inserted, ...baseAfter];
      updateCurrentPageLines(lastWorking);
      if (inserted.length < newLinesData.length) { setTimeout(tick, 0); return; }
      requestAnimationFrame(() => { requestAnimationFrame(() => {
        isPastingRef.current = false;
        if (lastWorking.length > autoPagination.linesPerPage) flowOverflowFrom(currentPageIndex, autoPagination.linesPerPage);
      }); });
    };
    tick();
  }, [lines, updateCurrentPageLines, autoPagination.linesPerPage, flowOverflowFrom, currentPageIndex]);

  const handlePaste = useCallback((rawText: string, atLineId?: string) => {
    const normalized = (rawText ?? '').replace(/\r/g, '');
    const pastedLines = normalized.split('\n');
    if (pastedLines.length <= 1) return;
    const insertIndex = atLineId ? lines.findIndex(l => l.id === atLineId) : lines.length - 1;
    if (insertIndex === -1) return;
    const newLinesData = pastedLines.map((text, i) => ({ id: generateLineId(), text, color: getDefaultColorForLine(insertIndex + i), timestamp: Date.now() + i }));
    insertNoteLinesAt(newLinesData, atLineId);
  }, [lines, insertNoteLinesAt]);

  /**
   * Structured AI/PDF insert — the "organised notes" path.
   * Converts markdown → structured lines, then appends proper
   * blocks to the home canvas (BlockEditor) and mirrored lines to
   * the pages model (preview/pagination), so ### / $$ / /// never
   * appear as raw artifacts.
   */
  const handleAIInsertStructured = useCallback((structured: StructuredLine[], options?: { atCursor?: boolean }) => {
    if (!structured.length) return;
    const newBlocks = structuredToBlocks(structured);
    const blocks = blockEditor.blocks;

    // Insert where the writer is, not on top of their page. Falls back to
    // appending when the cursor is not inside the note canvas.
    const focusIndex = options?.atCursor === false ? -1 : blocks.findIndex(b => b.id === focusedBlockId);
    const lineIndexHint = options?.atCursor === false ? undefined : textSelectionRef.current?.index;

    let nextBlocks: typeof blocks;
    if (focusIndex >= 0) {
      nextBlocks = [...blocks.slice(0, focusIndex + 1), ...newBlocks, ...blocks.slice(focusIndex + 1)];
    } else {
      const last = blocks[blocks.length - 1];
      // Don't leave a dangling empty line above the inserted content
      nextBlocks = last && last.type === 'text' && !last.content.trim()
        ? [...blocks.slice(0, -1), ...newBlocks]
        : [...blocks, ...newBlocks];
    }
    blockEditor.setBlocks(nextBlocks);
    insertNoteLinesAt(structuredToNoteLines(structured), undefined, lineIndexHint);
    toast.success('Added to your notes — organised ✦');
  }, [blockEditor, insertNoteLinesAt, focusedBlockId]);

  /**
   * Markdown → document model → notes. The composer strips assistant
   * chatter, de-duplicates sections, normalises equations and fits prose
   * to written lines, so the paper reads like a real study document.
   */
  const handleAIInsertMarkdown = useCallback((markdown: string, options?: { atCursor?: boolean }) => {
    const composed = composeStudyNotes(markdown, { fallbackTitle: noteTitle });
    handleAIInsertStructured(composed.lines, options);
    if (composed.title && /^untitled/i.test(noteTitle.trim())) setNoteTitle(composed.title);
  }, [handleAIInsertStructured, noteTitle]);

  /** PDF → structured note insert (offline, read locally). */
  const handleHomePdfImport = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file');
      return;
    }
    try {
      toast.info('Reading PDF locally…');
      const { pages } = await readPdf(file, 12);
      const text = pages.map(p => p.lines.join('\n')).join('\n\n').trim();
      if (!text) { toast.error('No extractable text in this PDF (scanned PDFs need OCR)'); return; }
      handleAIInsertMarkdown(text);
      toast.success(`Imported ${pages.filter(p => p.lines.some(l => l.trim())).length} page(s) from “${file.name}”`);
    } catch (e) {
      console.error('pdf import failed', e);
      toast.error('Could not read that PDF');
    }
  }, [handleAIInsertMarkdown]);

  useEffect(() => {
    if (isPastingRef.current) return;
    if (lines.length > autoPagination.linesPerPage) flowOverflowFrom(currentPageIndex, autoPagination.linesPerPage);
  }, [lines.length, autoPagination.linesPerPage, currentPageIndex, flowOverflowFrom]);

  // Page auto-shrink: when content is deleted, a trailing page that
  // becomes fully empty is removed (one per pass, debounced).
  useEffect(() => {
    if (isPastingRef.current || totalPages <= 1) return;
    const t = setTimeout(() => {
      const last = pages[totalPages - 1];
      if (last && last.lines.length > 0 && last.lines.every(l => !l.text.trim())) {
        deletePage(totalPages - 1);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [pages, totalPages, deletePage]);

  const undoLine = useCallback((lineId: string) => {
    const h = lineHistories.get(lineId);
    if (!h || h.past.length === 0) return;
    const cur = lines.find(l => l.id === lineId);
    if (!cur) return;
    const prev = h.past[h.past.length - 1];
    setLineHistories(p => { const n = new Map(p); const hh = n.get(lineId)!; n.set(lineId, { past: hh.past.slice(0, -1), future: [cur, ...hh.future] }); return n; });
    updateCurrentPageLines(lines.map(l => l.id === lineId ? prev : l));
  }, [lines, lineHistories, updateCurrentPageLines]);

  const redoLine = useCallback((lineId: string) => {
    const h = lineHistories.get(lineId);
    if (!h || h.future.length === 0) return;
    const cur = lines.find(l => l.id === lineId);
    if (!cur) return;
    const next = h.future[0];
    setLineHistories(p => { const n = new Map(p); const hh = n.get(lineId)!; n.set(lineId, { past: [...hh.past, cur], future: hh.future.slice(1) }); return n; });
    updateCurrentPageLines(lines.map(l => l.id === lineId ? next : l));
  }, [lines, lineHistories, updateCurrentPageLines]);

  const canUndo = useCallback((lineId: string) => { const h = lineHistories.get(lineId); return h ? h.past.length > 0 : false; }, [lineHistories]);
  const canRedo = useCallback((lineId: string) => { const h = lineHistories.get(lineId); return h ? h.future.length > 0 : false; }, [lineHistories]);
  const getPlainText = useCallback(() => lines.map(l => l.text).join('\n'), [lines]);

  const mergeLinesUp = useCallback((lineId: string) => {
    const idx = lines.findIndex(l => l.id === lineId);
    if (idx <= 0) return;
    const merged: NoteLine = { ...lines[idx - 1], text: lines[idx - 1].text + lines[idx].text, timestamp: Date.now() };
    const newLines = [...lines]; newLines[idx - 1] = merged; newLines.splice(idx, 1);
    updateCurrentPageLines(newLines);
  }, [lines, updateCurrentPageLines]);

  const firstSelectedLineId = selectedLines.size > 0 ? Array.from(selectedLines)[0] : null;

  // Page navigation — every move goes through the page stage so the sheet
  // turns (existing pages) or unfolds (a new page) instead of snapping.
  const handleNextPage = useCallback(() => {
    if (!canGoNext) return;
    triggerHaptic('light'); playClick();
    const commit = () => { setPageDirection('right'); nextPage(); };
    if (pageStageRef.current) void pageStageRef.current.turn('next', commit); else commit();
  }, [canGoNext, nextPage, triggerHaptic, playClick]);
  const handlePrevPage = useCallback(() => {
    if (!canGoPrev) return;
    triggerHaptic('light'); playClick();
    const commit = () => { setPageDirection('left'); prevPage(); };
    if (pageStageRef.current) void pageStageRef.current.turn('prev', commit); else commit();
  }, [canGoPrev, prevPage, triggerHaptic, playClick]);
  const handleAddPage = useCallback(() => {
    triggerHaptic('medium'); playSuccess();
    const commit = () => { setPageDirection('right'); addNewPage(); toast.success('New page added!'); };
    if (pageStageRef.current) void pageStageRef.current.unfold(commit); else commit();
  }, [addNewPage, triggerHaptic, playSuccess]);
  const handleDeletePage = useCallback((index: number) => { if (totalPages > 1) { deletePage(index); triggerHaptic('medium'); toast.success('Page deleted'); } }, [deletePage, totalPages, triggerHaptic]);
  const handleGoToPage = useCallback((index: number) => {
    if (index === currentPageIndex) return;
    triggerHaptic('light'); playClick();
    const direction = index > currentPageIndex ? 'next' : 'prev';
    const commit = () => { setPageDirection(index > currentPageIndex ? 'right' : 'left'); goToPage(index); };
    if (pageStageRef.current) void pageStageRef.current.turn(direction, commit); else commit();
  }, [currentPageIndex, goToPage, triggerHaptic, playClick]);

  const onPageStageTurn = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next') handleNextPage(); else handlePrevPage();
  }, [handleNextPage, handlePrevPage]);

  const handleExportPDF = useCallback(async () => {
    // Get content from block editor
    const blockText = blockEditor.blocks.map(b => b.content).join('\n').trim();
    const lineText = lines.map(l => l.text).join('\n').trim();
    const contentText = blockText || lineText;
    
    if (!contentText && !settings.table.enabled && diagrams.length === 0) {
      toast.error('Pehle kuch content likho! ✍️');
      return;
    }
    
    setIsExporting(true);
    setExportProgress(null);
    triggerHaptic('medium');
    
    const toastId = toast.loading('PDF bana raha hai...');
    
    // METHOD 0: capture the styled handwriting pages (paper, pen, effects) at print resolution
    try {
      const styledLines: NoteLine[] = contentText.split('\n').map((t, i) => {
        const h = /^(#{1,3})\s+/.exec(t);
        return {
          id: `exp-${i}`, text: t.replace(/^#{1,3}\s+/, '').replace(/^[-•]\s/, '• '), color: currentColor, timestamp: i,
          ...(h ? { fontSize: Math.round((settings.fontSize || 24) * (h[1].length === 1 ? 1.5 : 1.25)), fontWeight: '700' } : {}),
        };
      });
      setExportLinesOverride(styledLines);
      setExportMount(true);
      let els: HTMLElement[] = [];
      for (let i = 0; i < 30 && !els.length; i++) {
        await new Promise(r => setTimeout(r, 150));
        els = Array.from(exportContainerRef.current?.querySelectorAll<HTMLElement>('[data-export-page="true"]') ?? []);
      }
      if (!els.length) throw new Error('Styled pages not ready');
      await new Promise(r => setTimeout(r, 1200)); // handwriting fade-in + fonts
      await exportToPDF(els, 'niknote-notes', settings.pageSize);
      toast.success(`PDF download ho gaya! 📄 (${els.length} page)`, { id: toastId });
      playSuccess(); triggerHaptic('success');
      setIsExporting(false); setExportMount(false); setExportLinesOverride(null);
      return;
    } catch (styledErr) {
      console.warn('Styled PDF export failed, falling back to text PDF:', styledErr);
      setExportMount(false); setExportLinesOverride(null);
    }

    try {
      // METHOD 1: Try using jsPDF directly with text content — works everywhere
      const { jsPDF } = await import('jspdf');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      
      // Get font setting
      const fontFamily = settings.font || 'roman-regular';
      const fontSize = settings.fontSize || 24;
      const lineHeight = settings.lineSpacing || 32;
      
      // Set font
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(14);
      
      // Page dimensions
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      
      // Get ink color
      const inkData = LINE_INK_COLORS.find(c => c.value === currentColor);
      const textColor = inkData?.hex || '#000000';
      
      // Convert hex to RGB for jsPDF
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      
      const rgb = hexToRgb(textColor);
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      
      // Split content into lines and paginate
      const contentLines = contentText.split('\n');
      let y = margin + 10;
      let pageNum = 1;
      
      for (const line of contentLines) {
        // Check if we need a new page
        if (y > pageHeight - margin - 10) {
          pdf.addPage();
          y = margin + 10;
          pageNum++;
        }
        
        // Handle headings (from block content)
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('## ')) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(18);
          const text = trimmedLine.replace(/^#+\s/, '');
          const wrapped = pdf.splitTextToSize(text, maxWidth);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 8 + 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(14);
        } else if (trimmedLine.startsWith('# ')) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(22);
          const text = trimmedLine.replace(/^#+\s/, '');
          const wrapped = pdf.splitTextToSize(text, maxWidth);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 10 + 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(14);
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
          // Bullet points
          pdf.setFontSize(13);
          const text = trimmedLine.replace(/^[-•]\s/, '');
          const wrapped = pdf.splitTextToSize(text, maxWidth - 8);
          pdf.text('•', margin + 2, y);
          pdf.text(wrapped, margin + 8, y);
          y += wrapped.length * 6 + 2;
        } else if (trimmedLine === '') {
          // Empty line = spacing
          y += 4;
        } else {
          // Regular text
          pdf.setFontSize(14);
          const wrapped = pdf.splitTextToSize(trimmedLine, maxWidth);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 6 + 1;
        }
      }
      
      // Add page number footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`NikNote — Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
      // Save the PDF
      const filename = 'niknote-notes';
      pdf.save(`${filename}.pdf`);
      
      toast.success(`PDF download ho gaya! 📄 (${totalPages} page)`, { id: toastId });
      playSuccess();
      triggerHaptic('success');

      // 🎯 VIRAL GROWTH: Prompt sharing after successful PDF export
      setTimeout(() => {
        toast('Share NikNote with friends? 🎓', {
          description: '3 friends share = 7 days FREE Premium!',
          duration: 8000,
          action: {
            label: 'WhatsApp Share 📱',
            onClick: () => {
              const msg = encodeURIComponent(
                `🎓 NikNote — Free AI Study App! ✨\n\n✍️ Handwriting notes (16+ styles)\n🧠 AI Teacher (Hindi!)\n📝 Quiz + Flashcards generator\n\nDownload FREE: https://www.niknote.online\n3 dosto ko bhejo — Premium free! 🎁`
              );
              window.open(`https://wa.me/?text=${msg}`, '_blank');
              try {
                const clicks = parseInt(localStorage.getItem('niknote_share_clicks') || '0', 10);
                localStorage.setItem('niknote_share_clicks', (clicks + 1).toString());
              } catch {}
            }
          }
        });
      }, 1500);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('PDF export error:', msg);
      toast.error(`PDF fail: ${msg}`, {
        id: toastId,
        action: { label: 'Retry', onClick: () => handleExportPDF() }
      });
      triggerHaptic('error');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      setExportMount(false);
    }
  }, [blockEditor.blocks, lines, settings, currentColor, diagrams, triggerHaptic, playSuccess]);

  const handleReset = useCallback(() => { resetSettings(); triggerHaptic('medium'); toast.success('Settings reset'); }, [resetSettings, triggerHaptic]);

  const handleShareImage = useCallback(async () => {
    setShowShareMenu(false);
    const el = document.querySelector('[data-export-page="true"]') as HTMLElement ?? previewRef.current?.getPageElements()?.[0];
    if (!el) { toast.error('Switch to Preview first'); return; }
    setIsSharing(true);
    try { await shareAsImage(el, 'NikNote'); toast.success('Shared!'); }
    catch (e: any) { if (e?.name !== 'AbortError') toast.error('Share failed'); }
    finally { setIsSharing(false); }
  }, []);

  const handleSharePDF = useCallback(async () => {
    setShowShareMenu(false);
    const els = Array.from(document.querySelectorAll('[data-export-page="true"]')) as HTMLElement[];
    if (!els.length) { toast.error('Switch to Preview first'); return; }
    setIsSharing(true);
    try { await shareAsPDF(els, 'NikNote'); toast.success('PDF ready!'); }
    catch (e: any) { if (e?.name !== 'AbortError') toast.error('Share failed'); }
    finally { setIsSharing(false); }
  }, []);

  const handleColorChange = useCallback((color: typeof currentColor) => {
    if (selectedLines.size > 0) {
      updateSelectedLinesColor(color);
    }
    // Only set the current color for NEW blocks — do NOT change existing blocks
    blockEditor.setCurrentColor(color);
    setCurrentColor(color); triggerHaptic('selection'); playClick();
  }, [selectedLines, updateSelectedLinesColor, blockEditor, triggerHaptic, playClick]);

  const handleUndo = useCallback(() => { if (firstSelectedLineId) { undoLine(firstSelectedLineId); triggerHaptic('light'); } }, [firstSelectedLineId, undoLine, triggerHaptic]);
  const handleRedo = useCallback(() => { if (firstSelectedLineId) { redoLine(firstSelectedLineId); triggerHaptic('light'); } }, [firstSelectedLineId, redoLine, triggerHaptic]);

  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) { try { await addImage(file); toast.success('Image added!'); triggerHaptic('success'); } catch { toast.error('Failed'); } }
    };
    input.click();
  }, [addImage, triggerHaptic]);

  const handleAddInlineDiagram = useCallback((diagram: InlineDiagram) => { addInlineDiagram(diagram); toast.success('Shape added!'); triggerHaptic('light'); }, [addInlineDiagram, triggerHaptic]);

  const handleImportText = useCallback((importedLines: string[]) => {
    const flattened = importedLines.flatMap(chunk => String(chunk ?? '').split(/\r?\n/)).map(l => l.replace(/[\t ]+$/g, ''));
    const safeLines = flattened.length > 0 ? flattened : [''];
    const newLines = safeLines.map((text, i) => ({ id: generateLineId(), text, color: getDefaultColorForLine(i) as LineInkColor, timestamp: Date.now() + i }));
    if (newLines.length > 0) { updateCurrentPageLines(newLines); toast.success(`Imported ${newLines.length} lines!`); }
  }, [updateCurrentPageLines]);

  const controlPanelProps = {
    settings, updateSettings, updateMargins, updateHeaderFooter, tableData,
    onTableDataChange: updateTableData, diagrams, onAddDiagram: addDiagram,
    onRemoveDiagram: removeDiagram, onUpdateDiagram: updateDiagram,
    premiumLocked: !premium.isPremium, onPremiumTap: () => requirePremium('handwriting_styles'),
    onImportText: handleImportText
  };

  const pageVariants = {
    enter: (d: string) => ({ x: d === 'right' ? 300 : d === 'left' ? -300 : 0, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: string) => ({ x: d === 'right' ? -300 : d === 'left' ? 300 : 0, opacity: 0, scale: 0.95 })
  };

  // ===================== RENDER =====================
  return (
    <div className={cn("flex flex-col transition-all duration-500 touch-manipulation", moodStyles.background, glassMode && "glass-mode", themeClasses.wrapper, isMobile ? "min-h-screen nn-mobile nn-editor-root" : "h-[100dvh] overflow-hidden")}
         style={isMobile ? { touchAction: 'manipulation' } : undefined} {...(isMobile ? mobileAppearance.attributes : {})}>

      {isMobile && <MobileEditorHeader title={noteTitle} onTitle={setNoteTitle} onSave={saveMobileNote} saving={savingNote} onExport={handleExportPDF} exporting={isExporting} onStyle={() => setShowMobileStyleSheet(true)} onScan={() => setShowScanPanel(true)} onShare={() => setShowShareMenu(true)} />}
      {/* ============ HEADER — Floating Glass Bar ============ */}
      {!isMobile && <header className={cn(
        "sticky top-0 z-50 flex-shrink-0",
        isMobile 
          ? "bg-white border-b border-gray-100 h-12" 
          : "mx-3 mt-2 rounded-2xl bg-white/20 backdrop-blur-2xl border border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.08)] h-14"
      )}>
        <div className={cn("h-full flex items-center justify-between gap-2", isMobile ? "px-3" : "px-4 lg:px-5")}>
          {/* Left: toggle + logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(p => !p)}
              className={cn(
                "flex items-center justify-center rounded-lg transition-colors",
                isMobile ? "w-8 h-8 active:bg-gray-100" : "h-8 w-8 hover:bg-white/20"
              )}
              style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
            >
              <PanelLeft className="w-4 h-4 text-gray-600" />
            </button>
            <img 
              src="/niknote-logo.png" 
              alt="NikNote" 
              className={cn("select-none", isMobile ? "h-8" : "h-10")}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            />
            
          </div>

          {/* Center: Mood pills (desktop) */}
          {!isMobile && (
            <div className="flex items-center gap-1.5 flex-shrink min-w-0">
              <MoodSelector currentMood={mood} onMoodChange={changeMood} />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setGlassMode(p => !p)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                  glassMode
                    ? "bg-white/30 text-foreground shadow-sm backdrop-blur-sm"
                    : "bg-white/10 text-foreground/70 hover:bg-white/20 hover:text-foreground"
                )}
              >
                <Gem className="w-4 h-4" />
                <span className="hidden lg:inline">Glass</span>
              </motion.button>
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isMobile ? (
              <>
                <button
                  onClick={() => navigate('/ai')}
                  data-testid="mobile-open-nikai-btn"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-white border border-purple-200/90 shadow-[0_4px_14px_rgba(138,63,252,0.18)] active:scale-95 transition-transform"
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                >
                  <img src="/nikai-mark.png" alt="" aria-hidden="true" className="h-4 w-auto object-contain select-none" />
                  <span className="text-[11px] font-bold tracking-tight bg-gradient-to-r from-[#6D28D9] to-[#EC4899] bg-clip-text text-transparent">NikAI</span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="flex items-center justify-center w-8 h-8 rounded-lg active:bg-gray-100 transition-colors"
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-2xl border-gray-200 rounded-xl shadow-xl">
                    <DropdownMenuItem onClick={() => changeMood('calm')}>☀️ Calm</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeMood('focus')}>✨ Focus</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeMood('dark')}>🌙 Dark</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeMood('vintage')}>☕ Vintage</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeMood('study')}>📖 Study</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setGlassMode(p => !p)}>
                      <Gem className="w-4 h-4 mr-2" /> {glassMode ? 'Disable' : 'Enable'} Glass
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleDark}>
                      {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                      {isDark ? 'Light' : 'Dark'} Mode
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowThemePicker(true)}><LayoutGrid className="w-4 h-4 mr-2" /> UI Themes</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" /> Reset</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/notebooks')}><FileText className="w-4 h-4 mr-2" /> My Notebooks</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/feedback')}><MessageSquare className="w-4 h-4 mr-2" /> Feedback 💬</DropdownMenuItem>
                    {!premium.isPremium && <DropdownMenuItem onClick={() => navigate('/payment')}><Crown className="w-4 h-4 mr-2" /> Upgrade to Premium ✨</DropdownMenuItem>}
                    {!premium.isPremium && (() => {
                      const aiAccess = premium.checkFeatureAccess('ai_solver');
                      return aiAccess.limit < Infinity ? (
                        <div className="px-2 py-1.5 text-[10px] text-amber-600 flex items-center gap-1.5">
                          <Zap className="h-3 w-3" /> AI: {aiAccess.limit - aiAccess.used}/{aiAccess.limit} free left today
                        </div>
                      ) : null;
                    })()}
                    {user ? <DropdownMenuItem onClick={() => navigate('/account')}>👤 Account</DropdownMenuItem>
                      : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Live Cloud Sync Pill — Shows live sync state & triggers instant full sync on click */}
                <button
                  type="button"
                  data-testid="cloud-sync-pill"
                  onClick={async () => {
                    if (!isCloudUserId(user?.id)) {
                      const g = await signInAsGuest(undefined, { allowOfflineFallback: true });
                      if (g.error || g.offline) {
                        toast.info('Saved safely on this device — will sync automatically when online.');
                        return;
                      }
                    }
                    const res = await cloudSync.syncNow();
                    if (res.ok) {
                      toast.success('All notes, pages & trackers synced to Cloud ☁️');
                    } else {
                      toast.info('Saved safely on this device — cloud sync will retry automatically.');
                    }
                  }}
                  title="Cloud Sync Status — click to sync now"
                  className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium bg-white/25 hover:bg-white/40 dark:bg-slate-800/60 border border-white/30 text-foreground transition-all"
                >
                  {cloudSync.state === 'syncing' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                      <span>Syncing…</span>
                    </>
                  ) : cloudSync.state === 'synced' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Synced</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-sky-600" />
                      <span>Sync</span>
                    </>
                  )}
                </button>

                {/* Single Unified NikAI Option on PC — Opens /ai ONLY on click */}
                <motion.div whileTap={{ scale: 0.94 }} whileHover={{ scale: 1.04 }}>
                  <button
                    onClick={() => navigate('/ai')}
                    data-testid="pc-open-nikai-btn"
                    className="relative group flex items-center gap-2 h-9 pl-3 pr-4 rounded-full bg-white hover:bg-purple-50/90 text-[#19162B] border border-purple-200/90 shadow-[0_6px_22px_rgba(138,63,252,0.22)] hover:shadow-[0_8px_28px_rgba(236,72,153,0.32)] transition-all"
                  >
                    <img
                      src="/nikai-mark.png"
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-auto object-contain select-none"
                    />
                    <span className="font-bold text-[14px] tracking-tight bg-gradient-to-r from-[#241A5E] via-[#6D28D9] to-[#EC4899] bg-clip-text text-transparent">
                      NikAI
                    </span>
                  </button>
                </motion.div>

                {/* DNA Scanner button */}
                <motion.div whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.04 }}>
                  <button
                    onClick={() => setShowScanPanel(true)}
                    className="flex items-center gap-2 h-9 px-4 rounded-full font-semibold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] transition-all"
                  >
                    <Scan className="w-4 h-4" />
                    DNA Scan
                  </button>
                </motion.div>

                {user ? <HeaderProfileButton /> : null}

                <Toolbar onExportPDF={handleExportPDF} onReset={handleReset} isDark={isDark} onToggleDark={toggleDark} isExporting={isExporting} />
              </>
            )}
          </div>
        </div>
      </header>}

      {/* ============ MOBILE SIDEBAR DRAWER — Simple, no AnimatePresence ============ */}
      {isMobile && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/30"
            onClick={() => setSidebarOpen(false)}
            style={{ touchAction: 'manipulation' }}
          />
          <div
            className="fixed left-0 top-0 bottom-0 w-[280px] z-[61] bg-white shadow-2xl"
            style={{ transition: 'transform 0.3s ease' }}
          >
            <React.Suspense fallback={<div className="w-[240px] h-full bg-gray-50 animate-pulse" />}><WorkspaceSidebar isOpen={true} onToggle={() => setSidebarOpen(false)} onOpenCommandPalette={() => setShowCommandPalette(true)} /></React.Suspense>
          </div>
        </>
      )}

      {/* ============ BODY: 3-PANE LAYOUT ============ */}
      <div className={cn(
        "flex flex-1 min-h-0 gap-3",
        isMobile ? "" : "mt-2 mx-3 mb-3 overflow-hidden"
      )}>

        {/* LEFT SIDEBAR — desktop only */}
        {!isMobile && (
          <AnimatePresence>
            {sidebarOpen && (
              <div className="rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
                <React.Suspense fallback={<div className="w-[240px] h-full bg-white/30 animate-pulse rounded-2xl" />}><WorkspaceSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} onOpenCommandPalette={() => setShowCommandPalette(true)} /></React.Suspense>
              </div>
            )}
          </AnimatePresence>
        )}

        {/* ======== CENTER CONTENT ======== */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 gap-3",
          isMobile ? "" : "overflow-hidden"
        )}>

          {/* Page Bar */}
          {!isMobile && <div className={cn(
            "flex-shrink-0 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/25 shadow-sm px-3 py-1.5",
            isMobile && "rounded-none border-0 border-b border-gray-100 bg-white/95 py-1"
          )}>
            <div className="max-w-4xl mx-auto">
              <PageBar
                currentPage={currentPageIndex + 1}
                totalPages={totalPages}
                onPrevPage={handlePrevPage}
                onNextPage={handleNextPage}
                onAddPage={handleAddPage}
                onDeletePage={handleDeletePage}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onGoToPage={handleGoToPage}
              />
            </div>
          </div>}

          {/* ---- MOBILE NOTEBOOK BOARD ---- */}
          {isMobile && (
            <div className="nn-editor-page">
              <div className="nn-board-controls">
                <div className="nn-board-tabs" role="tablist" aria-label="Note view">
                  <Button variant="ghost" role="tab" aria-selected={mobileView === 'write'} onClick={() => setMobileView('write')}><PenLine className="h-4 w-4" />Write</Button>
                  <Button variant="ghost" role="tab" aria-selected={mobileView === 'preview'} onClick={() => setMobileView('preview')}><Eye className="h-4 w-4" />Preview</Button>
                </div>
                <Button variant="ghost" size="icon" onClick={blockEditor.undo} disabled={!blockEditor.canUndo} aria-label="Undo" title="Undo"><Undo2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={blockEditor.redo} disabled={!blockEditor.canRedo} aria-label="Redo" title="Redo"><Redo2 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={saveMobileNote} disabled={savingNote} aria-label="Save note" title="Save note"><Save className="h-4 w-4" /></Button>
              </div>
              {mobileView === 'write' && <div className="nn-format-bar" role="toolbar" aria-label="Line format" onPointerDown={e => e.preventDefault()}>
                {([['bold','Bold','B'],['italic','Italic','I']] as const).map(([m,label,icon]) => <button key={m} type="button" aria-label={label} disabled={!focusedBlockId} style={{ fontWeight: m === 'bold' ? 800 : 500, fontStyle: m === 'italic' ? 'italic' : undefined }} onClick={() => {
                  const id = focusedBlockId; const cur = blockEditor.blocks.find(b => b.id === id);
                  const ta = document.querySelector<HTMLTextAreaElement>(`[data-block-id="${id}"] textarea`);
                  if (!cur || !ta) return;
                  let s0 = ta.selectionStart ?? 0, e0 = ta.selectionEnd ?? 0;
                  if (s0 === e0) { // no selection: use the word under the caret
                    const v = cur.content; while (s0 > 0 && !/\s/.test(v[s0 - 1])) s0--; while (e0 < v.length && !/\s/.test(v[e0])) e0++;
                  }
                  if (s0 === e0) { toast.info('Select some words first'); return; }
                  const r = toggleMark(cur.content, s0, e0, m);
                  blockEditor.updateBlock(cur.id, { content: r.text });
                  haptic('selection');
                  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(r.start, r.end); });
                }}>{icon}</button>)}
                {([['text','Text','Aa'],['heading1','Heading 1','H1'],['heading2','Heading 2','H2'],['bullet','Bullet list','•'],['numbered','Numbered list','1.'],['todo','Checklist','☐'],['quote','Quote','❝'],['code','Code','</>']] as const).map(([t,label,icon]) => {
                  const cur = blockEditor.blocks.find(b => b.id === focusedBlockId);
                  return <button key={t} type="button" aria-label={label} aria-pressed={cur?.type === t} disabled={!cur} onClick={() => { if (cur) { blockEditor.convertBlock(cur.id, t as any); haptic('selection'); } }}>{icon}</button>;
                })}
                <button type="button" aria-label="Move line up" disabled={!focusedBlockId} onClick={() => focusedBlockId && blockEditor.moveBlock(focusedBlockId, 'up')}>↑</button>
                <button type="button" aria-label="Move line down" disabled={!focusedBlockId} onClick={() => focusedBlockId && blockEditor.moveBlock(focusedBlockId, 'down')}>↓</button>
              </div>}
              <div className="nn-editor-helper"><span>{blockEditor.blocks.reduce((t, b) => t + b.content.trim().split(/\s+/).filter(Boolean).length, 0)} words</span><span>Local draft</span></div>
              {/* Mobile Notion Editor — Full width, clean */}
              {/* Page strip — always available, in Write and Preview alike, so a
                  new sheet can be added without hunting for the preview tab. */}
              <div className="nn-page-pager nn-page-pager--board" role="group" aria-label="Page controls">
                <Button variant="ghost" size="sm" onClick={handlePrevPage} disabled={!canGoPrev} aria-label="Previous page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span aria-live="polite">Page {currentPageIndex + 1} of {totalPages}</span>
                <Button variant="ghost" size="sm" onClick={handleAddPage} aria-label="Add page">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleNextPage} disabled={!canGoNext} aria-label="Next page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Both views live inside one paper stage: the writer's canvas is
                  never remounted, and a page turn/unfold animates in Write too. */}
              <PageStage
                ref={pageStageRef}
                enter
                swipe
                keyboard={false}
                disabled={isExporting}
                onTurn={onPageStageTurn}
                ariaLabel={`Note page ${currentPageIndex + 1} of ${totalPages}`}
                className={mobileView === 'write' ? 'nn-page-stage--write' : ''}
              >
                              <div className="nn-editor-canvas" onFocusCapture={e => { const id = (e.target as HTMLElement).closest('[data-block-id]')?.getAttribute('data-block-id'); if (id) setFocusedBlockId(id); }} hidden={mobileView !== 'write'} data-paper={settings.pageStyle} style={{ '--nn-handwriting': settings.font === 'roman-regular' ? 'Inter, sans-serif' : settings.font === 'roman-serif' ? 'Georgia, serif' : settings.font === 'roman-mono' ? '"JetBrains Mono", monospace' : `"${settings.font.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}", cursive` } as React.CSSProperties}>
                  <NotionEditor
                    blocks={blockEditor.blocks}
                    onBlocksChange={blockEditor.setBlocks}
                    currentColor={currentColor}
                    onColorChange={handleColorChange}
                    onAIAction={() => setShowAIWorkspace(true)}
                    onOCRAction={() => setShowScanPanel(true)}
                    onExport={handleExportPDF}
                    dna={dnaContext.dna}
                    settings={settings}
                    pageNumber={currentPageIndex + 1}
                    totalPages={totalPages}
                  />
                </div>

                {mobileView === 'preview' && (
                  <div className="nn-board-preview">
                    {/* One sheet at a time so a swipe can turn it like paper. */}
                    <NotebookPreview
                      ref={previewRef}
                      lines={previewLines}
                      settings={settings}
                      realPenMode={realPenMode}
                      pageNumber={currentPageIndex + 1}
                      totalPages={totalPages}
                      inlineContent={inlineContent}
                      onUpdateContent={updateContent}
                      onDeleteContent={removeContent}
                      dna={dnaContext.dna}
                      focusPage={currentPageIndex}
                      pageId={currentPage.id}
                      strokes={currentStrokes}
                      drawing={sketch.enabled ? sketch : undefined}
                      onStroke={sketchStore.addStroke}
                      onEraseStroke={sketchStore.eraseAt}
                    />
                    <div className="mt-2 flex justify-center">
                      <SketchToolbar
                        value={sketch}
                        onChange={updateSketch}
                        onUndo={sketchStore.undo}
                        onRedo={sketchStore.redo}
                        onClear={() => sketchStore.clearPage(currentPage.id)}
                        canUndo={sketchStore.canUndo}
                        canRedo={sketchStore.canRedo}
                      />
                    </div>
                    <p className="nn-page-hint">Swipe left or right to turn the page</p>
                  </div>
                )}
              </PageStage>

              <div className="nn-board-footer">
                <Button variant="ghost" onClick={() => setShowMobileStyleSheet(true)}><Settings2 className="h-4 w-4" />Paper & pen</Button>
                <Button variant="ghost" onClick={() => setShowImportPanel(true)} aria-label="Import document" title="Import document"><Upload className="h-4 w-4" /></Button>
                <Button variant="ghost" onClick={() => navigate('/ai')} aria-label="NikAI" title="NikAI"><img src="/nikai-mark.png" alt="" aria-hidden="true" className="h-4 w-auto object-contain select-none" /></Button>
                <Button onClick={handleExportPDF} disabled={isExporting}><FileDown className="h-4 w-4" />PDF</Button>
              </div>

              {/* Mobile Share Menu — Simple, no AnimatePresence (touch fix) */}
              {showShareMenu && (
                <>
                  <div
                    className="fixed inset-0 z-[70] bg-black/30"
                    onClick={() => setShowShareMenu(false)}
                    style={{ touchAction: 'manipulation' }}
                  />
                  <div
                    className="fixed bottom-0 left-0 right-0 z-[71] bg-white rounded-t-2xl shadow-2xl p-5"
                  >
                    <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Share Notes</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleShareImage}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium active:scale-95 transition-transform"
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                      >
                        <Image className="w-4 h-4" /> As Image
                      </button>
                      <button 
                        onClick={handleSharePDF}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium active:scale-95 transition-transform"
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                      >
                        <FileText className="w-4 h-4" /> As PDF
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---- DESKTOP NOTION-STYLE LAYOUT ---- */}
          {!isMobile && (
            <div className="flex-1 flex overflow-hidden min-h-0 gap-0 relative">
              {/* MAIN CONTENT — Notion-style integrated editor + preview */}
              <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <ScrollArea className="flex-1">
                  <div className="max-w-[900px] mx-auto px-6 py-4">
                    {/* Notion-style integrated editor — the stage animates the
                        sheet; the editor itself stays mounted across page turns. */}
                    <PageStage
                      ref={pageStageRef}
                      enter
                      disabled={isExporting}
                      onTurn={onPageStageTurn}
                      ariaLabel={`Note page ${currentPageIndex + 1} of ${totalPages}`}
                    >
                    <div
                      className={cn(
                        "rounded-2xl bg-white/60 backdrop-blur-xl border border-white/30 shadow-sm min-h-[calc(100vh-12rem)]",
                        moodStyles.paper
                      )}
                    >
                      {/* Page title area */}
                      <div className="px-8 pt-6 pb-2">
                        <textarea
                          defaultValue="Untitled"
                          className="w-full text-3xl font-bold bg-transparent border-0 outline-none resize-none text-foreground placeholder:text-muted-foreground/30"
                          rows={1}
                          onChange={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                        />
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                          <span>{blockEditor.blocks.reduce((t, b) => t + b.content.trim().split(/\s+/).filter(Boolean).length, 0)} words</span>
                          <span>•</span>
                          <span>Page {currentPageIndex + 1}/{totalPages}</span>
                          <span>•</span>
                          <span>{blockEditor.blocks.length} blocks</span>
                        </div>
                      </div>

                      {/* Integrated Notion Editor */}
                      <div className="px-8 pb-8">
                        <NotionEditor
                          blocks={blockEditor.blocks}
                          onBlocksChange={blockEditor.setBlocks}
                          currentColor={currentColor}
                          onColorChange={handleColorChange}
                          onAIAction={(action) => {
                            setShowAIWorkspace(true);
                          }}
                          onOCRAction={() => setShowScanPanel(true)}
                          onExport={handleExportPDF}
                          dna={dnaContext.dna}
                          settings={settings}
                          pageNumber={currentPageIndex + 1}
                          totalPages={totalPages}
                        />
                      </div>

                      {/* Handwriting preview — Premium styled card */}
                      {hasContent && (
                        <div className="mx-8 mb-6">
                          <div className="preview-card">
                            <div className="preview-card-header">
                              <span className="flex items-center gap-2 text-[11px] font-bold text-violet-700">✍️ Handwriting Preview</span>
                              <div className="flex flex-wrap items-center gap-2">
                                <SketchToolbar
                                  value={sketch}
                                  onChange={updateSketch}
                                  onUndo={sketchStore.undo}
                                  onRedo={sketchStore.redo}
                                  onClear={() => sketchStore.clearPage(currentPage.id)}
                                  canUndo={sketchStore.canUndo}
                                  canRedo={sketchStore.canRedo}
                                />
                                <Button variant="ghost" size="sm" onClick={handleExportPDF} disabled={isExporting} className="h-6 px-2 text-[10px] rounded-lg gap-1">
                                  <FileDown className="w-3 h-3" /> PDF
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setShowShareMenu(v => !v)} className="h-6 px-2 text-[10px] rounded-lg gap-1">
                                  <Share2 className="w-3 h-3" /> Share
                                </Button>
                              </div>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto">
                              <NotebookPreview
                                ref={previewRef}
                                lines={previewLines}
                                settings={settings}
                              realPenMode={realPenMode}
                              pageNumber={currentPageIndex + 1}
                              totalPages={totalPages}
                              inlineContent={inlineContent}
                              onUpdateContent={updateContent}
                              onDeleteContent={removeContent}
                              dna={dnaContext.dna}
                              pageId={currentPage.id}
                              strokes={currentStrokes}
                              drawing={sketch.enabled ? sketch : undefined}
                              onStroke={sketchStore.addStroke}
                              onEraseStroke={sketchStore.eraseAt}
                            />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    </PageStage>

                    {/* Smart suggestions below */}
                    <div className="mt-3">
                      <React.Suspense fallback={null}>
                        <SmartEditor
                          currentText={blockEditor.blocks.map(b => b.content).join('\n')}
                          onAccept={(suggestion: EditorSuggestion) => {
                            if (suggestion.insertText) {
                              const lastBlock = blockEditor.blocks[blockEditor.blocks.length - 1];
                              if (lastBlock) {
                                blockEditor.setBlocks(
                                  blockEditor.blocks.map(b =>
                                    b.id === lastBlock.id
                                      ? { ...b, content: b.content + suggestion.insertText }
                                      : b
                                  )
                                );
                              }
                            }
                            toast.success('💡 ' + suggestion.label);
                          }}
                          isFocused={editorFocused}
                        />
                      </React.Suspense>
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* RIGHT SIDEBAR — Compact tools panel */}
              <div className="w-[260px] xl:w-[280px] flex-shrink-0 border-l border-border/30 bg-white/30 backdrop-blur-xl overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-3">
                    {/* Quick tools */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => setShowScanPanel(true)} className="h-8 px-2.5 rounded-xl text-[10px] gap-1 bg-emerald-50 border border-emerald-100">
                        <Scan className="w-3 h-3 text-emerald-500" /> DNA Scan
                      </Button>
                    </div>

                    {/* Pen Palette - compact */}
                    <PenPalette
                      currentColor={currentColor}
                      onColorChange={handleColorChange}
                      selectedCount={selectedLines.size}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                      canUndo={firstSelectedLineId ? canUndo(firstSelectedLineId) : false}
                      canRedo={firstSelectedLineId ? canRedo(firstSelectedLineId) : false}
                      realPenMode={realPenMode}
                      onRealPenModeChange={setRealPenMode}
                      currentText={getPlainText()}
                      onInsertText={(text) => handlePaste(text)}
                      onInsertStructured={handleAIInsertStructured}
                      premiumLocked={!premium.isPremium}
                      onPremiumTap={() => requirePremium('handwriting_styles')}
                    />

                    {/* Page Controls */}
                    <div>
                      <Button variant="ghost" size="sm" onClick={() => setShowControls(!showControls)} className="w-full gap-2 rounded-xl text-xs hover:bg-white/20">
                        <Settings2 className="w-4 h-4" /> {showControls ? 'Hide' : 'Show'} Page Settings
                      </Button>
                      <AnimatePresence>
                        {showControls && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden">
                            <React.Suspense fallback={<div className="h-20 bg-muted/10 rounded-xl animate-pulse" />}><ControlPanel {...controlPanelProps} /></React.Suspense>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Quick Export */}
                    <div className="p-3 rounded-xl bg-white/30 border border-white/20">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Export</h4>
                      <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting} className="gap-1.5 rounded-xl text-xs w-full bg-white/30">
                        <FileDown className="w-3.5 h-3.5" /> {isExporting ? 'Exporting...' : 'Export PDF'}
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Home quick-nav dial — same semi-circular menu as Daily Tracker / Money */}
              <div className="nn-dial-anchor-inline">
                <SemiCircularDial
                  menuLabel="Quick menu"
                  centerLabel="Menu"
                  align="left"
                  items={[
                    { id: 'nikai', label: 'NikAI', icon: Sparkles, tint: '#7c3aed', onSelect: () => navigate('/ai') },
                    { id: 'money', label: 'Money', icon: Calculator, tint: '#059669', onSelect: () => navigate('/money') },
                    { id: 'routine', label: 'Routine', icon: ListChecks, tint: '#2563eb', onSelect: () => navigate('/routine') },
                    { id: 'handwriting', label: 'Handwriting', icon: PenLine, tint: '#d97706', onSelect: () => setShowStudioPanel(true) },
                    { id: 'pdf', label: 'Import PDF', icon: FileUp, tint: '#e11d48', onSelect: () => homePdfRef.current?.click() },
                    { id: 'notebooks', label: 'Notebooks', icon: FileText, tint: '#0891b2', onSelect: () => navigate('/notebooks') },
                    { id: 'settings', label: 'Settings', icon: Settings2, tint: '#64748b', onSelect: () => navigate('/appearance') },
                  ]}
                />
              </div>
              <input
                ref={homePdfRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => { handleHomePdfImport(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
          )}
        </div>
      </div>


      {/* ============ MOBILE PANELS ============ */}
      <SlidePanel isOpen={showPenPanel} onClose={() => setShowPenPanel(false)} title="Pen Palette" icon={<Palette className="w-4 h-4 text-primary" />} side="right">
        <PenPalette currentColor={currentColor} onColorChange={handleColorChange} selectedCount={selectedLines.size} onUndo={handleUndo} onRedo={handleRedo} canUndo={firstSelectedLineId ? canUndo(firstSelectedLineId) : false} canRedo={firstSelectedLineId ? canRedo(firstSelectedLineId) : false} realPenMode={realPenMode} onRealPenModeChange={setRealPenMode} currentText={getPlainText()} onInsertText={(text) => handlePaste(text)} onInsertStructured={handleAIInsertStructured} premiumLocked={!premium.isPremium} onPremiumTap={() => requirePremium('ai_text_tools')} />
      </SlidePanel>

      <SlidePanel isOpen={showStylePanel} onClose={() => setShowStylePanel(false)} title="Page Style" icon={<Settings2 className="w-4 h-4 text-primary" />} side="right">
        <React.Suspense fallback={<div className="h-20 bg-muted/10 rounded-xl animate-pulse" />}><ControlPanel {...controlPanelProps} /></React.Suspense>
      </SlidePanel>

      {/* Handwriting DNA Scanner Panel */}
      <SlidePanel isOpen={showScanPanel} onClose={() => setShowScanPanel(false)} title="Handwriting DNA Scanner" icon={<Scan className="w-4 h-4 text-emerald-500" />} side="right">
        <React.Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">Loading Scanner...</div>}>
          <HandwritingScanner
            onDNAExtracted={(dna) => {
              dnaContext.updateDNA(dna);
              setShowScanPanel(false);
              toast.success(`✅ ${dna.styleName} DNA applied!`);
            }}
            onClose={() => setShowScanPanel(false)}
          />
        </React.Suspense>
      </SlidePanel>

      {/* Handwriting Studio — style profiles + PDF → handwritten conversion */}
      <SlidePanel isOpen={showStudioPanel} onClose={() => setShowStudioPanel(false)} title="Handwriting Studio" icon={<PenLine className="w-4 h-4 text-primary" />} side="right">
        <React.Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">Loading Studio…</div>}>
          <HandwritingStudio
            onInsertStructured={handleAIInsertStructured}
            onUpdateDNA={(dna) => dnaContext.updateDNA(dna)}
            currentDNA={dnaContext.dna}
          />
        </React.Suspense>
      </SlidePanel>

      {/* Command Palette (Cmd+K) */}
      <React.Suspense fallback={null}>
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNewNote={() => { setShowCommandPalette(false); }}
          onToggleTheme={toggleDark}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <MobileStyleSheet
          isOpen={showMobileStyleSheet}
          onClose={() => setShowMobileStyleSheet(false)}
          settings={settings}
          updateSettings={updateSettings}
          currentColor={currentColor}
          onColorChange={handleColorChange}
          realPenMode={realPenMode}
          onRealPenModeChange={setRealPenMode}
          isListening={quickDictation.isListening}
          onToggleVoice={() => {
            if (!premium.isPremium) { requirePremium('voice_to_notes'); return; }
            if (!quickDictation.isSupported) return;
            if (quickDictation.isListening) quickDictation.stop(); else quickDictation.start();
          }}
        />
      </React.Suspense>

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileEditorToolbar active={editorTool} onTool={selectEditorTool} listening={quickDictation.isListening} />}
      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={e => {
        const file = e.target.files?.[0]; if (!file) return;
        if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
        const reader = new FileReader(); reader.onload = () => { const b = createBlock('image'); b.url = String(reader.result); blockEditor.setBlocks([...blockEditor.blocks, b]); }; reader.readAsDataURL(file); e.target.value = '';
      }} />
      <SlidePanel isOpen={showImportPanel} onClose={() => setShowImportPanel(false)} title="Import a document" icon={<FileText className="w-4 h-4" />} side="right">
        <HandwritingTextImporter onImportText={text => { blockEditor.setBlocks(text.map(t => createBlock('text', t))); setShowImportPanel(false); }} />
      </SlidePanel>

      {/* Offscreen export DOM */}
      {exportMount && (
        <div ref={exportContainerRef} className="fixed left-[-10000px] top-0 pointer-events-none" aria-hidden="true">
          <div className="flex flex-col gap-6">
            {exportLinesOverride ? (
              <NotebookPreview
                lines={exportLinesOverride}
                settings={settings}
                realPenMode={realPenMode}
                pageNumber={1}
                totalPages={1}
                forExport
                pageId={currentPage.id}
                strokes={currentStrokes}
              />
            ) : pages.map((page, idx) => (
              <div key={page.id} style={{ width: 794, height: 1123 }}>
                <NotebookPreview
                  lines={page.lines}
                  settings={settings}
                  realPenMode={realPenMode}
                  pageNumber={idx + 1}
                  totalPages={pages.length}
                  forExport
                  pageId={page.id}
                  strokes={sketchStore.strokesFor(page.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UI Theme Picker Modal */}
      <AnimatePresence>
        {showThemePicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[70]"
              onClick={() => setShowThemePicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] z-[71] bg-white/95 backdrop-blur-2xl rounded-2xl border border-white/30 shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-primary" />
                  UI Design System
                </h3>
                <button onClick={() => setShowThemePicker(false)} aria-label="Close theme picker" className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted">
                  ×
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Choose a design language for your workspace</p>
              <div className="grid grid-cols-2 gap-3">
                {UI_THEMES.map((t) => (
                  <motion.button
                    key={t.value}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setUITheme(t.value); setShowThemePicker(false); toast.success(`${t.emoji} ${t.label} applied!`); }}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left",
                      uiTheme === t.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/50 hover:border-primary/40"
                    )}
                  >
                    <span className="text-2xl mb-1">{t.emoji}</span>
                    <span className="text-sm font-semibold text-foreground">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PaywallModal open={paywallOpen} onOpenChange={setPaywallOpen} />

      {/* AI Workspace Panel — Agents, Knowledge, Workflows */}
      <React.Suspense fallback={null}>
        <AIWorkspacePanel
          isOpen={showAIWorkspace}
          onClose={() => setShowAIWorkspace(false)}
          onInsertContent={(content) => {
            // Insert AI content as a real document (no raw markdown, no chatter)
            handleAIInsertMarkdown(content);
          }}
        />
      </React.Suspense>
    </div>
  );
};

export default Index;
