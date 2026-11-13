import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BookOpen, FileText, Loader2, Scan, Sparkles } from 'lucide-react';
import '@/styles/direct-writing-workspace.css';
import { useAuth, isGuestUser } from '@/contexts/AuthContext';
import { useHandwritingDNA } from '@/contexts/HandwritingDNAContext';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useBlockEditor } from '@/hooks/useBlockEditor';
import { useNotebookPages, type NotebookPage } from '@/hooks/useNotebookPages';
import { useNoteSettings } from '@/hooks/useNoteSettings';
import { useNotebooks, type Notebook } from '@/hooks/useNotebooks';
import { useCloudSyncStatus, PC_ACTIVE_META_KEY, isCloudUserId, notifyLocalDataChanged } from '@/lib/cloudSyncEngine';
import { findLocalNoteForOwner, readLocalNotesForOwner, removeLocalNoteForOwner, upsertLocalNoteForOwner, type LocalNoteRecord } from '@/lib/localNoteStore';
import { DEFAULT_SETTINGS, type NoteSettings, type PageStyle, type HandwritingFont, type InkColor } from '@/types/notes';
import { createBlock, type Block, type BlockType } from '@/types/block';
import { type LineInkColor } from '@/types/noteLine';
import { markdownToStructuredLines, structuredToBlocks, type StructuredLine } from '@/lib/noteStructure';
import { NotebookPreview } from '@/components/NotebookPreview';
import { DirectWritingWorkspace } from '@/components/workspace/DirectWritingWorkspace';
import { type EditorSaveStatus } from '@/components/mobile/MobileEditorChrome';
import { HandwritingTextImporter } from '@/components/HandwritingTextImporter';
import { PenPalette } from '@/components/PenPalette';
import { SlidePanel } from '@/components/SlidePanel';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePremium, type PremiumFeature } from '@/hooks/usePremium';
import { useDiagrams } from '@/hooks/useDiagrams';
import { useTableData } from '@/hooks/useTableData';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { blocksFromNotebookCloudPages, orderNotebookCloudPages, partitionNotebookBlocks } from '@/lib/notebookCloudPages';
import { exportToPDF } from '@/utils/export';
import { trackSaveNote } from '@/lib/tracking';
import { Button } from '@/components/ui/button';
import { PaywallModal } from '@/components/premium/PaywallModal';

const AIWorkspacePanel = lazy(() => import('@/components/ai-workspace/AIWorkspacePanel').then((module) => ({ default: module.AIWorkspacePanel })));
const HandwritingScanner = lazy(() => import('@/components/handwriting-dna/HandwritingScanner').then((module) => ({ default: module.HandwritingScanner })));
const CommandPalette = lazy(() => import('@/components/command-palette/CommandPalette').then((module) => ({ default: module.CommandPalette })));
const ControlPanel = lazy(() => import('@/components/ControlPanel').then((module) => ({ default: module.ControlPanel })));

const ACTIVE_DOCUMENT_KEY = 'niknote.active-document.v1';
const PENDING_MOBILE_OPEN_KEY = 'niknote-mobile-open';
const DEFAULT_NOTE_TITLE = 'Untitled';

type PendingOpen = {
  ownerId?: string;
  title?: string;
  blocks?: Block[];
  notebookId?: string;
  style?: PageStyle;
  font?: HandwritingFont;
  inkColor?: InkColor;
};

type LocalWritingNote = LocalNoteRecord & {
  blocks?: Block[];
  settings?: Partial<NoteSettings>;
  handwritingPages?: NotebookPage[];
  font?: HandwritingFont;
  ink_color?: InkColor;
  page_style?: PageStyle;
  page_size?: NoteSettings['pageSize'];
  realPenMode?: boolean;
  is_favorite?: boolean;
};

function scopedActiveKey(ownerId: string) {
  return `${ACTIVE_DOCUMENT_KEY}:${encodeURIComponent(ownerId)}`;
}

function readActiveDocumentId(ownerId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const scoped = localStorage.getItem(scopedActiveKey(ownerId));
    if (scoped) return scoped;
    const scopedMeta = localStorage.getItem(`${PC_ACTIVE_META_KEY}:${ownerId}`);
    const meta = JSON.parse(scopedMeta || localStorage.getItem(PC_ACTIVE_META_KEY) || '{}');
    if (meta?.userId === ownerId && typeof meta.notebookId === 'string') return meta.notebookId;
  } catch {
    // A malformed active-document hint must never affect what can be loaded.
  }
  return null;
}

function makeDraftId(ownerId: string) {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return `local-draft-${safeOwner}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [createBlock('text', '')];
  const blocks = value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      ...item,
      id: typeof item.id === 'string' ? item.id : createBlock('text', '').id,
      type: typeof item.type === 'string' ? item.type : 'text',
      content: typeof item.content === 'string' ? item.content : '',
    })) as Block[];
  return blocks.length ? blocks : [createBlock('text', '')];
}

function blocksFromText(text: string): Block[] {
  if (!text.trim()) return [createBlock('text', '')];
  return text.split(/\r?\n/).map((line) => createBlock('text', line));
}

function blocksFromHandwritingPages(pages: NotebookPage[]): Block[] {
  const blocks = pages.flatMap((page) => page.lines)
    .filter((line) => typeof line.text === 'string' && line.text.trim())
    .map((line) => {
      const block = createBlock('text', line.text);
      if (line.color) block.color = line.color;
      return block;
    });
  return blocks.length ? blocks : [createBlock('text', '')];
}

function normalizeHandwritingPages(value: unknown): NotebookPage[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  return value.map((item: unknown, index) => {
    const page = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    return {
      id: typeof page.id === 'string' ? page.id : `page-restored-${index}`,
      lines: Array.isArray(page.lines) ? page.lines as NotebookPage['lines'] : [],
      createdAt: typeof page.createdAt === 'number' ? page.createdAt : Date.now(),
    };
  });
}

function mergeNoteSettings(value: unknown, pageStyle?: string | null, pageSize?: string | null): NoteSettings {
  const stored = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<NoteSettings>
    : {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    margins: { ...DEFAULT_SETTINGS.margins, ...(stored.margins || {}) },
    headerFooter: { ...DEFAULT_SETTINGS.headerFooter, ...(stored.headerFooter || {}) },
    table: { ...DEFAULT_SETTINGS.table, ...(stored.table || {}) },
    pageStyle: (pageStyle || stored.pageStyle || DEFAULT_SETTINGS.pageStyle) as PageStyle,
    pageSize: (pageSize || stored.pageSize || DEFAULT_SETTINGS.pageSize) as NoteSettings['pageSize'],
  };
}

function readPendingOpen(expectedOwnerId: string): PendingOpen | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_MOBILE_OPEN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingOpen;
    if (!data || typeof data !== 'object') return null;
    if (data.ownerId && data.ownerId !== expectedOwnerId) return null;
    // Legacy untagged handoffs may remain usable on device/guest workspaces,
    // but must not seed a registered account with another session's content.
    if (!data.ownerId && isCloudUserId(expectedOwnerId)) return null;
    return data;
  } catch {
    return null;
  }
}

function hasNoteContent(blocks: Block[]) {
  return blocks.some((block) => Boolean(block.content?.trim() || block.url || block.tableData || block.front || block.back));
}

function currentSignature(documentId: string, title: string, blocks: Block[], settings: NoteSettings, pages: NotebookPage[], isFavorite: boolean) {
  return JSON.stringify({
    documentId,
    title,
    isFavorite,
    blocks,
    settings,
    pages: pages.map((page) => ({ id: page.id, lines: page.lines })),
  });
}

function safeFileName(title: string) {
  return (title || 'niknote-notes').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'niknote-notes';
}

async function exportPlainTextPdf(text: string, title: string, pageSize: NoteSettings['pageSize']) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: pageSize, compress: true });
  const margin = 18;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = margin;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  for (const line of text.split('\n')) {
    const wrapped = pdf.splitTextToSize(line || ' ', pageWidth - margin * 2);
    for (const part of wrapped) {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(part, margin, y);
      y += 6;
    }
  }
  pdf.save(`${safeFileName(title)}.pdf`);
}

const Index: React.FC<{ routeDocumentId?: string }> = ({ routeDocumentId }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="nn-writing-loading"><Loader2 className="h-5 w-5 animate-spin" /><span>Opening your workspace…</span></div>;
  }
  const ownerId = user?.id || 'anonymous-device';
  return <OwnerWritingWorkspace key={ownerId} ownerId={ownerId} isGuest={isGuestUser(user)} routeDocumentId={routeDocumentId} />;
};

const OwnerWritingWorkspace: React.FC<{ ownerId: string; isGuest: boolean; routeDocumentId?: string }> = ({ ownerId, isGuest, routeDocumentId }) => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const requestedQueryId = params.get('notebook');
  const requestedId = routeDocumentId && routeDocumentId !== 'new' ? routeDocumentId : requestedQueryId;
  const explicitNew = routeDocumentId === 'new' || (params.get('new') === '1' && !requestedId);
  const [documentId, setDocumentId] = useState(() => requestedId || (explicitNew ? '' : readActiveDocumentId(ownerId) || ''));
  const [pendingReady, setPendingReady] = useState(false);
  const pendingOpenRef = useRef<PendingOpen | null>(null);
  const [title, setTitle] = useState(DEFAULT_NOTE_TITLE);
  const [isFavorite, setIsFavorite] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(true);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>('saved');
  const [saveRevision, setSaveRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportMount, setExportMount] = useState(false);
  const [exportLines, setExportLines] = useState<NotebookPage['lines']>([]);
  const [showAIWorkspace, setShowAIWorkspace] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showPenPanel, setShowPenPanel] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHandwritingPreview, setShowHandwritingPreview] = useState(false);
  const [mobileTool, setMobileTool] = useState('text');
  const [realPenMode, setRealPenMode] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState<LineInkColor>('black');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textSelectionRef = useRef<{ blockId: string; start: number; end: number } | null>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const loadedDocumentRef = useRef<string | null>(null);
  const lastRouteKeyRef = useRef(routeDocumentId || (requestedQueryId ? `note:${requestedQueryId}` : explicitNew ? 'new' : ''));
  const lastSavedSignatureRef = useRef('');
  const latestSignatureRef = useRef('');
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    const captureSelection = () => {
      const active = document.activeElement as HTMLTextAreaElement;
      if (active?.tagName !== 'TEXTAREA' || !active.closest('.nn-direct-editor')) return;
      const blockId = active.closest<HTMLElement>('[data-block-id]')?.dataset.blockId;
      if (!blockId) return;
      textSelectionRef.current = { blockId, start: active.selectionStart, end: active.selectionEnd };
    };
    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
  }, []);

  const isMobile = useIsMobile();
  const { notebooks, loading: notebooksLoading, refetch: refetchNotebooks, updateNotebook } = useNotebooks();
  const { settings, updateSettings, updateMargins, updateHeaderFooter } = useNoteSettings();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const blockEditor = useBlockEditor();
  const {
    pages,
    currentPageIndex,
    currentPage,
    totalPages,
    nextPage,
    prevPage,
    addNewPage,
    replaceAllPages,
    canGoNext,
    canGoPrev,
  } = useNotebookPages(ownerId, documentId || 'workspace');
  const cloudSync = useCloudSyncStatus(ownerId);
  const dna = useHandwritingDNA();
  const { triggerHaptic } = useHaptics();
  const { playSuccess } = useSoundEffects();
  const premium = usePremium();
  const { diagrams, addDiagram, removeDiagram, updateDiagram, clearDiagrams } = useDiagrams();
  const { tableData, updateTableData, resetTableData } = useTableData(settings.table.rows, settings.table.columns);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const requirePremium = useCallback((_feature: PremiumFeature) => setPaywallOpen(true), []);

  const findOwnedLocalNote = useCallback((id: string) =>
    findLocalNoteForOwner(id, ownerId, { allowLegacyClaim: isGuest }), [ownerId, isGuest]);

  const previewLines = useMemo(() => {
    if (hasNoteContent(blockEditor.blocks)) return blockEditor.lines;
    return currentPage?.lines || [];
  }, [blockEditor.blocks, blockEditor.lines, currentPage]);
  const signature = useMemo(
    () => currentSignature(documentId, title, blockEditor.blocks, settings, pages, isFavorite),
    [documentId, title, blockEditor.blocks, settings, pages, isFavorite],
  );
  latestSignatureRef.current = signature;
  const safeReady = isHydrated && !documentLoading && !documentError && (!requestedId || requestedId === documentId);

  // Read the one-shot mobile/template handoff without trusting note data that
  // includes an existing notebook ID. Existing documents are always loaded
  // again from this owner's local cache or owner-filtered cloud rows.
  useEffect(() => {
    const handoff = readPendingOpen(ownerId);
    if (handoff) {
      pendingOpenRef.current = handoff;
      if (!handoff.notebookId && !requestedId) {
        setDocumentId((current) => current || makeDraftId(ownerId));
      }
      try { sessionStorage.removeItem(PENDING_MOBILE_OPEN_KEY); } catch { /* ignore */ }
    }
    if (explicitNew && !requestedId) {
      setDocumentId((current) => current || makeDraftId(ownerId));
    }
    if (params.get('panel') === 'scan') setShowScanner(true);
    setPendingReady(true);
  // OwnerWritingWorkspace is keyed by owner, so this is a mount-only handoff.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingReady || documentId || notebooksLoading || explicitNew) return;
    const lastActive = readActiveDocumentId(ownerId);
    setDocumentId(lastActive || notebooks[0]?.id || makeDraftId(ownerId));
  }, [pendingReady, documentId, notebooksLoading, notebooks, ownerId, explicitNew]);

  // Every editor route is just a requested document key; loadDocument below
  // still verifies local ownership or the cloud notebook's owner before reading.
  useEffect(() => {
    const nextKey = routeDocumentId || (requestedQueryId ? `note:${requestedQueryId}` : explicitNew ? 'new' : '');
    if (!nextKey || nextKey === lastRouteKeyRef.current) return;
    lastRouteKeyRef.current = nextKey;
    setIsHydrated(false);
    setDocumentLoading(true);
    setDocumentError(null);

    if (nextKey === 'new') {
      const handoff = readPendingOpen(ownerId);
      pendingOpenRef.current = handoff;
      try { sessionStorage.removeItem(PENDING_MOBILE_OPEN_KEY); } catch { /* ignore */ }
      setDocumentId(makeDraftId(ownerId));
      return;
    }

    const nextId = nextKey.startsWith('note:') ? nextKey.slice('note:'.length) : nextKey;
    setDocumentId(nextId);
  }, [routeDocumentId, requestedQueryId, explicitNew, ownerId]);

  // Load only a note that has an owner-tagged local copy or a cloud notebook
  // whose user_id matches the active account. Unknown/unowned legacy rows are
  // never adopted into a signed-in account.
  useEffect(() => {
    if (!pendingReady || !documentId || loadedDocumentRef.current === documentId) return;
    let cancelled = false;
    setIsHydrated(false);
    setDocumentLoading(true);
    setDocumentError(null);

    const applyNote = (note: LocalWritingNote, notebook?: Notebook, legacyPages?: NotebookPage[]) => {
      if (cancelled) return;
      const loadedBlocks = Array.isArray(note.blocks)
        ? normalizeBlocks(note.blocks)
        : blocksFromText(String(note.content || notebook?.description || ''));
      const noteSettings = mergeNoteSettings(note.settings, note.page_style, note.page_size);
      if (note.font) noteSettings.font = note.font;
      if (note.ink_color) noteSettings.inkColor = note.ink_color;
      setTitle(note.title || notebook?.title || DEFAULT_NOTE_TITLE);
      setIsFavorite(Boolean(note.is_favorite ?? notebook?.is_favorite));
      blockEditor.replaceBlocks(loadedBlocks);
      updateSettings(noteSettings);
      clearDiagrams();
      resetTableData(noteSettings.table.rows, noteSettings.table.columns);
      setShowHandwritingPreview(false);
      setCurrentColor((note.ink_color || noteSettings.inkColor || 'black') as LineInkColor);
      setRealPenMode(Boolean(note.realPenMode));
      const handwriting = normalizeHandwritingPages(note.handwritingPages) || legacyPages;
      if (handwriting?.length) replaceAllPages(handwriting);
      else if (legacyPages?.length) replaceAllPages(legacyPages);
      setDocumentError(null);
      setDocumentLoading(false);
      setIsHydrated(true);
      loadedDocumentRef.current = documentId;
      lastSavedSignatureRef.current = '';
    };

    const applyBlankDraft = (draftId: string, pending?: PendingOpen | null) => {
      if (cancelled) return;
      setTitle(pending?.title || DEFAULT_NOTE_TITLE);
      setIsFavorite(false);
      const blocks = pending?.blocks?.length ? normalizeBlocks(pending.blocks) : [createBlock('text', '')];
      blockEditor.replaceBlocks(blocks);
      updateSettings({ ...DEFAULT_SETTINGS, ...(pending?.style ? { pageStyle: pending.style } : {}), ...(pending?.font ? { font: pending.font } : {}), ...(pending?.inkColor ? { inkColor: pending.inkColor } : {}) });
      clearDiagrams();
      resetTableData(DEFAULT_SETTINGS.table.rows, DEFAULT_SETTINGS.table.columns);
      setShowHandwritingPreview(false);
      if (pending?.inkColor) setCurrentColor(pending.inkColor as unknown as LineInkColor);
      setRealPenMode(false);
      setDocumentError(null);
      setDocumentLoading(false);
      setIsHydrated(true);
      loadedDocumentRef.current = draftId;
      lastSavedSignatureRef.current = '';
      pendingOpenRef.current = null;
    };

    const loadDocument = async () => {
      const local = findOwnedLocalNote(documentId) as LocalWritingNote | null;
      if (local) {
        applyNote(local);
        return;
      }

      if (documentId.startsWith('local-draft-')) {
        const pending = pendingOpenRef.current;
        // A note ID in the handoff is never used as authorization or as the
        // source of note content; it must resolve through the owner checks.
        applyBlankDraft(documentId, pending && !pending.notebookId ? pending : null);
        return;
      }

      if (!isCloudUserId(ownerId) || !isCloudUserId(documentId)) {
        const nextDraft = makeDraftId(ownerId);
        setDocumentId(nextDraft);
        if (requestedId) navigate(`/editor/${encodeURIComponent(nextDraft)}`, { replace: true });
        return;
      }

      if (notebooksLoading) return;
      let notebook = notebooks.find((row) => row.id === documentId && row.user_id === ownerId);
      if (!notebook) {
        const lookup = await supabase
          .from('notebooks')
          .select('*')
          .eq('id', documentId)
          .eq('user_id', ownerId)
          .maybeSingle();
        if (cancelled) return;
        if (lookup.error) {
          setDocumentError('This note could not be verified right now. Your account data has not been changed.');
          setDocumentLoading(false);
          loadedDocumentRef.current = documentId;
          return;
        }
        notebook = (lookup.data || undefined) as Notebook | undefined;
      }
      if (!notebook) {
        toast.error('That note is not available in this account. A new draft was opened instead.');
        const nextDraft = makeDraftId(ownerId);
        setDocumentId(nextDraft);
        navigate(`/editor/${encodeURIComponent(nextDraft)}`, { replace: true });
        return;
      }

      const pageResult = await supabase
        .from('pages')
        .select('id,title,content,page_number,updated_at')
        .eq('notebook_id', documentId)
        .eq('user_id', ownerId)
        .order('page_number', { ascending: true });
      if (cancelled) return;
      if (pageResult.error) {
        setDocumentError('The note was verified, but its pages could not be loaded. Nothing has been overwritten.');
        setDocumentLoading(false);
        loadedDocumentRef.current = documentId;
        return;
      }

      let legacyPages: NotebookPage[] | undefined;
      try {
        const handPageResult = await supabase
          .from('notebook_pages')
          .select('id,page_number,lines')
          .eq('notebook_id', documentId)
          .order('page_number', { ascending: true });
        const handPageRows = handPageResult.data as Array<{ id: string; lines: unknown }> | null;
        if (!handPageResult.error && Array.isArray(handPageRows) && handPageRows.length) {
          legacyPages = handPageRows.map((page, index) => ({
            id: typeof page.id === 'string' ? page.id : `page-cloud-${index}`,
            lines: Array.isArray(page.lines) ? page.lines as NotebookPage['lines'] : [],
            createdAt: Date.now(),
          }));
        }
      } catch {
        // The legacy handwriting table is optional for newer block-only notes.
      }
      if (cancelled) return;

      const cloudPages = orderNotebookCloudPages(pageResult.data || []);
      const remoteBlocks = blocksFromNotebookCloudPages(cloudPages);
      let blocks: Block[];
      if (remoteBlocks.length) {
        blocks = normalizeBlocks(remoteBlocks);
      } else if (legacyPages?.some((page) => page.lines.some((line) => line.text.trim()))) {
        blocks = blocksFromHandwritingPages(legacyPages);
      } else {
        blocks = blocksFromText(String(notebook.description || ''));
      }
      const noteSettings = mergeNoteSettings(notebook.settings, notebook.page_style, notebook.page_size);
      applyNote({
        id: notebook.id,
        title: cloudPages.find((page) => page.title)?.title || notebook.title || DEFAULT_NOTE_TITLE,
        blocks,
        settings: noteSettings,
        page_style: noteSettings.pageStyle,
        page_size: noteSettings.pageSize,
        cover_color: notebook.cover_color,
        folder: notebook.folder,
        tags: notebook.tags,
        _ownerId: ownerId,
      }, notebook, legacyPages);
    };

    void loadDocument().catch((error) => {
      if (cancelled) return;
      console.error('Could not load this owner-scoped note:', error);
      setDocumentError('This note could not be loaded. Your local data has not been changed.');
      setDocumentLoading(false);
      loadedDocumentRef.current = documentId;
    });

    return () => { cancelled = true; };
  }, [documentId, ownerId, isGuest, requestedId, navigate, notebooks, notebooksLoading, findOwnedLocalNote, blockEditor.replaceBlocks, updateSettings, replaceAllPages, clearDiagrams, resetTableData]);

  useEffect(() => {
    if (!safeReady || !documentId) return;
    try {
      localStorage.setItem(scopedActiveKey(ownerId), documentId);
      const meta = JSON.stringify({ userId: ownerId, notebookId: documentId, title });
      localStorage.setItem(`${PC_ACTIVE_META_KEY}:${ownerId}`, meta);
      // Keep the legacy hint only as an owner-tagged pointer. Legacy note data
      // itself is not copied or claimed here.
      localStorage.setItem(PC_ACTIVE_META_KEY, meta);
    } catch {
      // ignore storage limits
    }
  }, [safeReady, documentId, ownerId, title]);

  const pagesForStorage = pages;
  const documentSignature = signature;

  const saveDocument = useCallback(async (manual = false) => {
    if (!safeReady || !documentId || saveInFlightRef.current) return;
    const contentExists = hasNoteContent(blockEditor.blocks) || pagesForStorage.some((page) => page.lines.some((line) => line.text.trim()));
    if (!contentExists && title.trim() === DEFAULT_NOTE_TITLE) {
      if (manual) toast.info('Start writing before saving a note.');
      return;
    }

    saveInFlightRef.current = true;
    setSaveStatus('saving');
    const now = new Date().toISOString();
    const existing = findOwnedLocalNote(documentId) as LocalWritingNote | null;
    const knownNotebook = notebooks.find((row) => row.id === documentId && row.user_id === ownerId);
    const record: LocalWritingNote = {
      ...(existing || {}),
      id: documentId,
      title: title.trim() || DEFAULT_NOTE_TITLE,
      blocks: blockEditor.blocks,
      content: blockEditor.blocks.map((block) => block.content || '').join('\n'),
      settings,
      page_style: settings.pageStyle,
      page_size: settings.pageSize,
      font: settings.font,
      ink_color: settings.inkColor,
      cover_color: existing?.cover_color || knownNotebook?.cover_color || '#8b5cf6',
      folder: existing?.folder ?? knownNotebook?.folder ?? null,
      tags: existing?.tags || knownNotebook?.tags || ['Notes'],
      is_favorite: isFavorite,
      realPenMode,
      handwritingPages: pagesForStorage,
      created_at: existing?.created_at || knownNotebook?.created_at || now,
      updated_at: now,
      updatedAt: now,
      _ownerId: ownerId,
      user_id: ownerId,
    };

    try {
      upsertLocalNoteForOwner(record, ownerId, {}, { notify: false, allowLegacyClaim: isGuest });
      void refetchNotebooks();

      if (!isCloudUserId(ownerId)) {
        lastSavedSignatureRef.current = documentSignature;
        setSaveStatus('offline');
        if (manual) {
          trackSaveNote({ featureName: 'handwriting_editor', conversionSource: 'device_save', pageCount: Math.max(1, pagesForStorage.length) });
          toast.success('Note saved on this device.');
        }
        return;
      }

      let cloudId = typeof record.cloud_id === 'string' ? record.cloud_id : (isCloudUserId(documentId) ? documentId : null);
      if (cloudId) {
        const lookup = await supabase.from('notebooks').select('id,updated_at').eq('id', cloudId).eq('user_id', ownerId).maybeSingle();
        if (lookup.error) throw lookup.error;
        if (!lookup.data) cloudId = null;
      }
      if (!cloudId) {
        const created = await supabase.from('notebooks').insert({
          user_id: ownerId,
          title: record.title,
          cover_color: record.cover_color,
          page_style: record.page_style,
          page_size: record.page_size,
          settings: record.settings as unknown as Json,
          tags: record.tags,
          folder: record.folder,
          is_favorite: record.is_favorite,
        }).select('id,updated_at').single();
        if (created.error || !created.data?.id) throw created.error || new Error('Could not create the cloud note.');
        cloudId = created.data.id;
        // Keep a verified remote pointer if page writing is temporarily
        // interrupted. The sync engine also validates this pointer by owner.
        record.cloud_id = cloudId;
        upsertLocalNoteForOwner(record, ownerId, {}, { notify: false, allowLegacyClaim: isGuest });
      }

      const notebookUpdate = await supabase.from('notebooks').update({
        title: record.title,
        cover_color: record.cover_color,
        page_style: record.page_style,
        page_size: record.page_size,
        settings: record.settings as unknown as Json,
        tags: record.tags,
        folder: record.folder,
        is_favorite: record.is_favorite,
      }).eq('id', cloudId).eq('user_id', ownerId).select('id,updated_at').maybeSingle();
      if (notebookUpdate.error) throw notebookUpdate.error;
      if (!notebookUpdate.data?.id) throw new Error('The cloud note is no longer available to this account.');

      const pageRead = await supabase
        .from('pages')
        .select('id,page_number,content')
        .eq('notebook_id', cloudId)
        .eq('user_id', ownerId)
        .order('page_number', { ascending: true })
        .order('id', { ascending: true });
      if (pageRead.error) throw pageRead.error;
      const cloudPages = orderNotebookCloudPages(pageRead.data || []);
      const pageContents = partitionNotebookBlocks(blockEditor.blocks, cloudPages);
      const pageWriteResults = cloudPages.length
        ? await Promise.all(cloudPages.map((page, index) => supabase
          .from('pages')
          .update({ title: record.title, content: pageContents[index] as unknown as Json, updated_at: now })
          .eq('id', page.id)
          .eq('notebook_id', cloudId)
          .eq('user_id', ownerId)
          .select('id')
          .maybeSingle()))
        : [await supabase.from('pages').insert({
          notebook_id: cloudId,
          user_id: ownerId,
          page_number: 1,
          title: record.title,
          content: blockEditor.blocks as unknown as Json,
          updated_at: now,
        }).select('id').single()];
      const failedPageWrite = pageWriteResults.find((result) => result.error);
      if (failedPageWrite?.error) throw failedPageWrite.error;
      if (pageWriteResults.some((result) => !result.data?.id)) {
        throw new Error('A note page is no longer available to this account.');
      }

      // `notebook_pages` is a legacy handwritten-lines table with no user_id
      // column. Its read is protected by RLS through the verified notebook owner
      // and is only used to restore old previews. This block editor writes to
      // `pages.content`; it must never delete/recreate the legacy handwritten
      // rows as a side effect of an ordinary save.
      const stamp = new Date().toISOString();
      const savedRecord: LocalWritingNote = {
        ...record,
        id: cloudId,
        cloud_id: cloudId,
        user_id: ownerId,
        _ownerId: ownerId,
        updated_at: stamp,
        updatedAt: stamp,
        _syncedAt: stamp,
      };
      upsertLocalNoteForOwner(savedRecord, ownerId, {}, { notify: false, allowLegacyClaim: isGuest });
      if (documentId !== cloudId) {
        removeLocalNoteForOwner(documentId, ownerId, { notify: false });
        loadedDocumentRef.current = null;
        setDocumentId(cloudId);
        navigate(`/editor/${encodeURIComponent(cloudId)}`, { replace: true });
      }
      const nextSignature = currentSignature(cloudId, title, blockEditor.blocks, settings, pagesForStorage, isFavorite);
      lastSavedSignatureRef.current = nextSignature;
      setSaveStatus('saved');
      notifyLocalDataChanged();
      void refetchNotebooks();
      if (manual) {
        trackSaveNote({ featureName: 'handwriting_editor', conversionSource: 'cloud_save', pageCount: Math.max(1, pagesForStorage.length) });
        toast.success('Note saved to your workspace.');
      }
    } catch (error) {
      console.error('Note save failed; owner-scoped local copy retained:', error);
      const localNow = new Date().toISOString();
      upsertLocalNoteForOwner({ ...record, updated_at: localNow, updatedAt: localNow }, ownerId, {}, { notify: false, allowLegacyClaim: isGuest });
      lastSavedSignatureRef.current = isCloudUserId(ownerId) ? '' : documentSignature;
      setSaveStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
      void refetchNotebooks();
      if (manual) toast.error('Cloud save failed. Your owner-scoped local copy is safe; try again when connected.');
    } finally {
      saveInFlightRef.current = false;
      if (latestSignatureRef.current !== documentSignature) setSaveRevision((value) => value + 1);
    }
  }, [safeReady, documentId, blockEditor.blocks, pagesForStorage, title, settings, isFavorite, realPenMode, ownerId, isGuest, notebooks, documentSignature, refetchNotebooks, navigate]);

  const toggleFavorite = useCallback(async () => {
    if (!documentId) return;
    const nextFavorite = !isFavorite;
    setIsFavorite(nextFavorite);
    const now = new Date().toISOString();

    if (isCloudUserId(ownerId) && isCloudUserId(documentId)) {
      const updated = await updateNotebook(documentId, { is_favorite: nextFavorite });
      if (!updated) {
        setIsFavorite(!nextFavorite);
        toast.error('Could not update this note’s favorite status.');
        return;
      }
    }

    const existing = findOwnedLocalNote(documentId) as LocalWritingNote | null;
    upsertLocalNoteForOwner({
      ...(existing || {}),
      id: documentId,
      title: existing?.title || title || DEFAULT_NOTE_TITLE,
      is_favorite: nextFavorite,
      updated_at: now,
      updatedAt: now,
      _ownerId: ownerId,
      user_id: ownerId,
    }, ownerId, {}, { notify: false, allowLegacyClaim: isGuest });
    notifyLocalDataChanged();
    toast.success(nextFavorite ? 'Added to Favorites.' : 'Removed from Favorites.');
  }, [documentId, isFavorite, ownerId, updateNotebook, findOwnedLocalNote, title, isGuest]);

  useEffect(() => {
    if (!safeReady || !documentId || signature === lastSavedSignatureRef.current) return;
    const meaningful = hasNoteContent(blockEditor.blocks) || title.trim() !== DEFAULT_NOTE_TITLE || pages.some((page) => page.lines.some((line) => line.text.trim()));
    if (!meaningful) return;
    setSaveStatus('unsaved');
    const timer = window.setTimeout(() => { void saveDocument(false); }, 850);
    return () => window.clearTimeout(timer);
  }, [safeReady, documentId, signature, blockEditor.blocks, title, pages, saveRevision, saveDocument]);

  useEffect(() => {
    const retryWhenOnline = () => setSaveRevision((value) => value + 1);
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveDocument(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveDocument]);

  const addStructuredContent = useCallback((structured: StructuredLine[]) => {
    if (!structured.length) return;
    const inserted = structuredToBlocks(structured);
    const current = blockEditor.blocks;
    const last = current[current.length - 1];
    const next = last?.type === 'text' && !last.content.trim()
      ? [...current.slice(0, -1), ...inserted]
      : [...current, ...inserted];
    blockEditor.setBlocks(next);
    toast.success('Added to your note.');
  }, [blockEditor]);

  const addBlock = useCallback((type: BlockType) => {
    const targetId = focusedBlockId || blockEditor.blocks[blockEditor.blocks.length - 1]?.id;
    const newId = targetId ? blockEditor.addBlockAfter(targetId, type) : undefined;
    if (isMobile) setMobileTool('text');
    if (newId) window.setTimeout(() => document.querySelector<HTMLElement>(`[data-block-id="${newId}"] textarea`)?.focus(), 0);
  }, [blockEditor, focusedBlockId, isMobile]);

  const handleImagePick = useCallback(() => imageInputRef.current?.click(), []);
  const handleImageFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Choose an image file.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Images must be under 10 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const block = createBlock('image');
      block.url = String(reader.result || '');
      blockEditor.setBlocks([...blockEditor.blocks, block]);
      setFocusedBlockId(block.id);
    };
    reader.onerror = () => toast.error('Could not read that image.');
    reader.readAsDataURL(file);
  }, [blockEditor]);

  const dictation = useSpeechDictation({
    onFinalTranscript: (text) => {
      const block = createBlock('text', text);
      blockEditor.setBlocks([...blockEditor.blocks, block]);
      setFocusedBlockId(block.id);
    },
  });

  const handleMobileTool = useCallback((tool: string) => {
    setMobileTool(tool);
    if (tool === 'pen') { setShowPenPanel(true); return; }
    if (tool === 'image') { handleImagePick(); return; }
    if (tool === 'text') {
      document.querySelector<HTMLTextAreaElement>('.nn-direct-editor [data-block-id] textarea')?.focus();
      return;
    }
    if (tool === 'eraser') {
      const selected = textSelectionRef.current;
      const focused = selected && blockEditor.blocks.find((block) => block.id === selected.blockId);
      if (!selected || !focused || selected.start === selected.end) {
        toast.info('Select text in your note, then tap Eraser.');
        return;
      }
      blockEditor.updateBlock(focused.id, { content: focused.content.slice(0, selected.start) + focused.content.slice(selected.end) });
      textSelectionRef.current = null;
      return;
    }
    if (tool === 'highlighter') {
      const focused = blockEditor.blocks.find((block) => block.id === focusedBlockId);
      if (!focused) { toast.info('Select a block to highlight.'); return; }
      blockEditor.updateBlock(focused.id, { type: focused.type === 'callout' ? 'text' : 'callout' });
      return;
    }
    if (tool === 'voice') {
      if (!dictation.isSupported) { toast.info('Voice input is not available in this browser.'); return; }
      if (dictation.isListening) dictation.stop(); else void dictation.start();
    }
  }, [blockEditor, focusedBlockId, dictation, handleImagePick]);

  const onColorChange = useCallback((color: LineInkColor) => {
    setCurrentColor(color);
    blockEditor.setCurrentColor(color);
  }, [blockEditor]);

  const handleExportPDF = useCallback(async () => {
    const hasBlockText = hasNoteContent(blockEditor.blocks);
    const lines = hasBlockText
      ? blockEditor.lines
      : pages.flatMap((page) => page.lines).filter((line) => line.text.trim());
    const plainText = hasBlockText
      ? blockEditor.blocks.map((block) => block.content).filter(Boolean).join('\n')
      : lines.map((line) => line.text).join('\n');
    if (!plainText.trim()) { toast.info('Write something before exporting a PDF.'); return; }

    setExporting(true);
    setExportLines(lines);
    setExportMount(true);
    const toastId = toast.loading('Preparing your handwritten PDF…');
    try {
      let pageElements: HTMLElement[] = [];
      for (let attempt = 0; attempt < 30 && !pageElements.length; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        pageElements = Array.from(exportContainerRef.current?.querySelectorAll<HTMLElement>('[data-export-page="true"]') || []);
      }
      if (!pageElements.length) throw new Error('The handwritten preview did not finish rendering.');
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      await exportToPDF(pageElements, safeFileName(title), settings.pageSize);
      toast.success('Handwritten PDF exported.', { id: toastId });
      playSuccess();
      triggerHaptic('success');
    } catch (error) {
      console.warn('Handwritten PDF export failed; using text export:', error);
      try {
        await exportPlainTextPdf(plainText, title, settings.pageSize);
        toast.success('PDF exported with a text layout.', { id: toastId });
      } catch (fallbackError) {
        console.error('Text PDF export failed:', fallbackError);
        toast.error('Could not export this PDF. Try again.', { id: toastId });
      }
    } finally {
      setExporting(false);
      setExportMount(false);
      setExportLines([]);
    }
  }, [blockEditor.blocks, blockEditor.lines, pages, title, settings.pageSize, playSuccess, triggerHaptic]);

  const handleShare = useCallback(async () => {
    const text = blockEditor.blocks.map((block) => block.content).filter(Boolean).join('\n\n');
    if (!text.trim()) { toast.info('Write something to share first.'); return; }
    try {
      if (navigator.share) await navigator.share({ title: title || DEFAULT_NOTE_TITLE, text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success('Note text copied to clipboard.');
      }
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') toast.error('Could not share this note.');
    }
  }, [blockEditor.blocks, title]);

  const importText = useCallback((lines: string[]) => {
    const text = lines.join('\n');
    addStructuredContent(markdownToStructuredLines(text));
    setShowImportPanel(false);
  }, [addStructuredContent]);

  const handlePdfImport = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Choose a PDF document.');
      return;
    }
    try {
      const { readPdf } = await import('@/lib/pdfText');
      const result = await readPdf(file, 12);
      const text = result.pages.map((page) => page.lines.join('\n')).join('\n\n').trim();
      if (!text) { toast.info('No selectable text was found in that PDF. Scanned files need OCR.'); return; }
      addStructuredContent(markdownToStructuredLines(text));
      toast.success('PDF text added to your note.');
    } catch (error) {
      console.error('PDF import failed:', error);
      toast.error('Could not read that PDF.');
    }
  }, [addStructuredContent]);

  const controlPanelProps = {
    settings,
    updateSettings,
    updateMargins,
    updateHeaderFooter,
    tableData,
    onTableDataChange: updateTableData,
    diagrams,
    onAddDiagram: addDiagram,
    onRemoveDiagram: removeDiagram,
    onUpdateDiagram: updateDiagram,
    premiumLocked: !premium.isPremium,
    onPremiumTap: () => requirePremium('handwriting_styles'),
    onImportText: importText,
  };

  const handleSync = useCallback(() => { void saveDocument(true); }, [saveDocument]);

  const restartLoad = useCallback(() => {
    loadedDocumentRef.current = null;
    setDocumentError(null);
    setDocumentLoading(true);
    setIsHydrated(false);
    setSaveRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    return () => {
      if (saveInFlightRef.current) return;
      if (!safeReady || !documentId) return;
      const shouldKeep = hasNoteContent(blockEditor.blocks) || title.trim() !== DEFAULT_NOTE_TITLE;
      if (!shouldKeep) return;
      const now = new Date().toISOString();
      upsertLocalNoteForOwner({
        id: documentId,
        title: title.trim() || DEFAULT_NOTE_TITLE,
        blocks: blockEditor.blocks,
        content: blockEditor.blocks.map((block) => block.content || '').join('\n'),
        settings,
        page_style: settings.pageStyle,
        page_size: settings.pageSize,
        font: settings.font,
        ink_color: settings.inkColor,
        handwritingPages: pagesForStorage,
        updated_at: now,
        updatedAt: now,
        _ownerId: ownerId,
        user_id: ownerId,
      }, ownerId, {}, { notify: false, allowLegacyClaim: isGuest });
    };
  }, [safeReady, documentId, title, blockEditor.blocks, settings, pagesForStorage, ownerId, isGuest]);

  const navigateToNewNote = useCallback(() => {
    navigate('/editor/new');
  }, [navigate]);

  if (documentError) {
    return (
      <div className="nn-writing-loading nn-writing-error-state">
        <FileText className="h-6 w-6" />
        <p>{documentError}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/home')}>Dashboard</Button>
          <Button onClick={restartLoad}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!safeReady) {
    return <div className="nn-writing-loading"><Loader2 className="h-5 w-5 animate-spin" /><span>{documentLoading ? 'Opening your note…' : 'Preparing your workspace…'}</span></div>;
  }

  const handwritingPreview = (
    <NotebookPreview
      lines={previewLines}
      settings={settings}
      realPenMode={realPenMode}
      pageNumber={currentPageIndex + 1}
      totalPages={totalPages}
      dna={dna.dna}
    />
  );

  return (
    <>
      <DirectWritingWorkspace
        title={title}
        autoFocusTitle={explicitNew}
        onTitleChange={setTitle}
        isFavorite={isFavorite}
        onToggleFavorite={() => { void toggleFavorite(); }}
        blocks={blockEditor.blocks}
        onBlocksChange={blockEditor.setBlocks}
        settings={settings}
        currentColor={currentColor}
        onColorChange={onColorChange}
        saveStatus={saveStatus}
        syncState={cloudSync.state}
        isMobile={isMobile}
        isDark={isDark}
        onToggleDark={toggleDark}
        canUndo={blockEditor.canUndo}
        canRedo={blockEditor.canRedo}
        onUndo={blockEditor.undo}
        onRedo={blockEditor.redo}
        onSave={() => { void saveDocument(true); }}
        onExportPDF={() => { void handleExportPDF(); }}
        exporting={exporting}
        onShare={() => { void handleShare(); }}
        onOpenAI={() => setShowAIWorkspace(true)}
        onOpenNikAI={() => navigate('/ai')}
        onOpenScanner={() => setShowScanner(true)}
        onOpenImport={() => setShowImportPanel(true)}
        onInsertImage={handleImagePick}
        mobileTool={mobileTool}
        isListening={dictation.isListening}
        onMobileTool={handleMobileTool}
        showHandwritingPreview={showHandwritingPreview}
        onToggleHandwritingPreview={() => setShowHandwritingPreview((show) => !show)}
        handwritingPreview={handwritingPreview}
        onOpenPageStyle={() => setShowStylePanel(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onSync={handleSync}
        onAddPage={addNewPage}
        onPreviousPage={prevPage}
        onNextPage={nextPage}
        pageNumber={currentPageIndex + 1}
        totalPages={totalPages}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onAddBlock={addBlock}
        onFocusBlock={setFocusedBlockId}
        focusedBlockId={focusedBlockId}
      />

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { handleImageFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />

      <SlidePanel isOpen={showStylePanel} onClose={() => setShowStylePanel(false)} title="Paper, handwriting & page style" icon={<BookOpen className="h-4 w-4" />} side="right">
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading page settings…</div>}>
          <ControlPanel {...controlPanelProps} />
        </Suspense>
      </SlidePanel>
      <SlidePanel isOpen={showPenPanel} onClose={() => setShowPenPanel(false)} title="Pen palette & writing tools" icon={<Sparkles className="h-4 w-4" />} side="right">
        <PenPalette
          currentColor={currentColor}
          onColorChange={onColorChange}
          selectedCount={focusedBlockId ? 1 : 0}
          onUndo={blockEditor.undo}
          onRedo={blockEditor.redo}
          canUndo={blockEditor.canUndo}
          canRedo={blockEditor.canRedo}
          realPenMode={realPenMode}
          onRealPenModeChange={setRealPenMode}
          currentText={blockEditor.getPlainText()}
          onInsertText={(text) => addStructuredContent(markdownToStructuredLines(text))}
          onInsertStructured={addStructuredContent}
          premiumLocked={!premium.isPremium}
          onPremiumTap={() => requirePremium('ai_text_tools')}
        />
      </SlidePanel>
      <SlidePanel isOpen={showScanner} onClose={() => setShowScanner(false)} title="Handwriting DNA scanner" icon={<Scan className="h-4 w-4" />} side="right">
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading scanner…</div>}>
          <HandwritingScanner onDNAExtracted={(nextDNA) => { dna.updateDNA(nextDNA); setShowScanner(false); toast.success('Handwriting style applied.'); }} onClose={() => setShowScanner(false)} />
        </Suspense>
      </SlidePanel>
      <SlidePanel isOpen={showImportPanel} onClose={() => setShowImportPanel(false)} title="Import a document" icon={<FileText className="h-4 w-4" />} side="right">
        <div className="space-y-4 p-4">
          <HandwritingTextImporter onImportText={importText} />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/30">
            <FileText className="h-4 w-4" /> Import text from a PDF
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { void handlePdfImport(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
        </div>
      </SlidePanel>
      <Suspense fallback={null}>
        <AIWorkspacePanel
          isOpen={showAIWorkspace}
          onClose={() => setShowAIWorkspace(false)}
          noteTitle={title}
          noteContent={blockEditor.getPlainText()}
          onInsertContent={(markdown) => addStructuredContent(markdownToStructuredLines(markdown))}
        />
      </Suspense>
      <Suspense fallback={null}>
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNewNote={() => { setShowCommandPalette(false); navigateToNewNote(); }}
          onToggleTheme={toggleDark}
          onToggleSidebar={() => {}}
        />
      </Suspense>
      <PaywallModal open={paywallOpen} onOpenChange={setPaywallOpen} />
      {exportMount && (
        <div ref={exportContainerRef} className="nn-writing-export-mount" aria-hidden="true">
          <NotebookPreview
            lines={exportLines}
            settings={settings}
            realPenMode={realPenMode}
            pageNumber={1}
            totalPages={totalPages}
            forExport
            dna={dna.dna}
          />
        </div>
      )}
    </>
  );
};

export default Index;
