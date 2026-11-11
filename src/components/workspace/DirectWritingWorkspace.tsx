import React, { useEffect, useState } from 'react';
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckSquare2,
  ChevronDown,
  Code2,
  FileText,
  FileUp,
  Heading1,
  Image,
  List,
  ListOrdered,
  Menu,
  Moon,
  MoreHorizontal,
  PanelRight,
  Plus,
  Quote,
  Save,
  Search,
  Share2,
  Sparkles,
  Sun,
  Table2,
  Video,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Block, BlockType } from '@/types/block';
import { MobileEditorToolbar, type EditorSaveStatus } from '@/components/mobile/MobileEditorChrome';
import { HeaderProfileButton } from '@/components/HeaderProfileButton';
import { Button } from '@/components/ui/button';
import { EditorInspector } from '@/components/editor/EditorInspector';
import { NotionEditor } from '@/components/editor/NotionEditor';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';
import { cn } from '@/lib/utils';
import type { LineInkColor } from '@/types/noteLine';
import type { NoteSettings } from '@/types/notes';
import type { CloudSyncState } from '@/lib/cloudSyncEngine';

interface DirectWritingWorkspaceProps {
  title: string;
  onTitleChange: (title: string) => void;
  blocks: Block[];
  onBlocksChange: (blocks: Block[]) => void;
  settings: NoteSettings;
  currentColor: LineInkColor;
  onColorChange: (color: LineInkColor) => void;
  saveStatus: EditorSaveStatus;
  syncState: CloudSyncState;
  isMobile: boolean;
  isDark: boolean;
  onToggleDark: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onExportPDF: () => void;
  exporting: boolean;
  onShare: () => void;
  onOpenAI: () => void;
  onOpenNikAI: () => void;
  onOpenScanner: () => void;
  onOpenImport: () => void;
  mobileTool: string;
  isListening: boolean;
  onMobileTool: (tool: string) => void;
  showHandwritingPreview: boolean;
  onToggleHandwritingPreview: () => void;
  handwritingPreview: React.ReactNode;
  onOpenPageStyle: () => void;
  onOpenCommandPalette: () => void;
  onSync: () => void;
  onAddPage: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  pageNumber: number;
  totalPages: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onAddBlock: (type: BlockType) => void;
  onFocusBlock: (id: string | null) => void;
  focusedBlockId: string | null;
}

const QUICK_BLOCKS: { type: BlockType; label: string; short: string; icon: React.ElementType }[] = [
  { type: 'text', label: 'Text', short: 'Aa', icon: AlignLeft },
  { type: 'heading1', label: 'Heading', short: 'H1', icon: Heading1 },
  { type: 'bullet', label: 'Bulleted list', short: '•', icon: List },
  { type: 'numbered', label: 'Numbered list', short: '1.', icon: ListOrdered },
  { type: 'todo', label: 'To-do', short: '☐', icon: CheckSquare2 },
  { type: 'quote', label: 'Quote', short: '❝', icon: Quote },
  { type: 'image', label: 'Image', short: '▧', icon: Image },
  { type: 'video', label: 'Video', short: '▷', icon: Video },
  { type: 'code', label: 'Code', short: '</>', icon: Code2 },
  { type: 'table', label: 'Table', short: '▦', icon: Table2 },
  { type: 'divider', label: 'Divider', short: '—', icon: Plus },
];

function saveLabel(status: EditorSaveStatus) {
  switch (status) {
    case 'saving': return 'Saving…';
    case 'unsaved': return 'Unsaved changes';
    case 'offline': return 'Saved on this device';
    case 'error': return 'Save needs attention';
    default: return 'Saved';
  }
}

function syncLabel(state: CloudSyncState) {
  if (state === 'syncing') return 'Syncing';
  if (state === 'synced') return 'Synced';
  if (state === 'offline') return 'Offline';
  if (state === 'error') return 'Sync issue';
  return 'On this device';
}

export const DirectWritingWorkspace: React.FC<DirectWritingWorkspaceProps> = ({
  title,
  onTitleChange,
  blocks,
  onBlocksChange,
  settings,
  currentColor,
  onColorChange,
  saveStatus,
  syncState,
  isMobile,
  isDark,
  onToggleDark,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onExportPDF,
  exporting,
  onShare,
  onOpenAI,
  onOpenNikAI,
  onOpenScanner,
  onOpenImport,
  mobileTool,
  isListening,
  onMobileTool,
  showHandwritingPreview,
  onToggleHandwritingPreview,
  handwritingPreview,
  onOpenPageStyle,
  onOpenCommandPalette,
  onSync,
  onAddPage,
  onPreviousPage,
  onNextPage,
  pageNumber,
  totalPages,
  canGoPrev,
  canGoNext,
  onAddBlock,
  onFocusBlock,
  focusedBlockId,
}) => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [inspectorOpen, setInspectorOpen] = useState(!isMobile);
  const [activeInspectorTab, setActiveInspectorTab] = useState<'blocks' | 'ai'>('blocks');
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setInspectorOpen(false);
    } else {
      setSidebarOpen(true);
      setInspectorOpen(true);
    }
  }, [isMobile]);

  const openAIInspector = () => {
    setActiveInspectorTab('ai');
    setInspectorOpen(true);
  };

  const insertBlock = (type: BlockType) => {
    onAddBlock(type);
    if (isMobile) setInspectorOpen(false);
  };

  const handleFocusCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    const id = (event.target as HTMLElement).closest('[data-block-id]')?.getAttribute('data-block-id');
    if (id) onFocusBlock(id);
  };

  return (
    <div className={cn('nn-writing-workspace', isMobile && 'nn-writing-mobile')}>
      <header className="nn-writing-topbar">
        <div className="nn-topbar-brand">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle workspace sidebar" className="nn-topbar-icon">
            {isMobile ? <Menu /> : <BookOpen />}
          </Button>
          <button type="button" className="nn-brand-button" onClick={() => navigate('/home')} aria-label="NikNote workspace home">
            <img src="/niknote-logo.png" alt="NikNote" />
            {!isMobile && <span>Workspace</span>}
          </button>
        </div>

        <div className="nn-topbar-actions">
          <Button variant="ghost" size="icon" onClick={onOpenCommandPalette} aria-label="Search workspace" title="Search (Ctrl+K)" className="nn-topbar-icon">
            <Search />
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpenImport} aria-label="Import a document" title="Import a document" className="nn-topbar-icon nn-import-button">
            <FileUp />
          </Button>
          <Button variant="outline" onClick={onOpenNikAI} className="nn-topbar-ai" aria-label="Open NikAI">
            <img src="/nikai-mark.png" alt="" aria-hidden="true" />
            {!isMobile && <span>NikAI</span>}
          </Button>
          <Button
            variant="outline"
            onClick={onSync}
            className={cn('nn-sync-pill', `nn-sync-${syncState}`)}
            title="Sync this workspace"
            aria-label={`Sync status: ${syncLabel(syncState)}. Sync now`}
          >
            {syncState === 'syncing' ? <span className="nn-sync-dot is-spinning" /> : syncState === 'synced' ? <Check /> : <span className="nn-sync-dot" />}
            {!isMobile && <span>{syncLabel(syncState)}</span>}
          </Button>
          {isMobile && <Button variant="ghost" size="icon" onClick={onToggleDark} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} className="nn-topbar-icon">{isDark ? <Sun /> : <Moon />}</Button>}
          {!isMobile && <Button variant="ghost" size="icon" aria-label="Notifications" title="Notifications" className="nn-topbar-icon" onClick={() => navigate('/history')}><Bell /></Button>}
          {isMobile ? (
            <Button variant="ghost" size="icon" aria-label="Account" onClick={() => navigate('/account')} className="nn-topbar-icon"><MoreHorizontal /></Button>
          ) : <HeaderProfileButton />}
        </div>
      </header>

      <div className="nn-writing-frame">
        {sidebarOpen && (
          <>
            {isMobile && <button className="nn-writing-scrim" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}
            <aside className="nn-writing-sidebar">
              <WorkspaceSidebar
                isOpen
                onToggle={() => setSidebarOpen(false)}
                onNewNote={() => { setSidebarOpen(false); navigate('/?editor=1&new=1'); }}
                onOpenDNA={() => { setSidebarOpen(false); onOpenScanner(); }}
                onOpenCommandPalette={onOpenCommandPalette}
              />
            </aside>
          </>
        )}

        <main className="nn-writing-main">
          <div className="nn-document-bar">
            <div className="nn-document-location">
              {!isMobile && <span className="nn-location-muted">My workspace</span>}
              {!isMobile && <span className="nn-location-divider">/</span>}
              <FileText className="h-4 w-4" />
              <input
                aria-label="Document title"
                className="nn-document-bar-title"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Untitled"
              />
              <ChevronDown className="h-3.5 w-3.5 nn-title-chevron" aria-hidden="true" />
            </div>
            <div className="nn-document-actions">
              <span className={cn('nn-save-indicator', `nn-save-${saveStatus}`)} role="status">{saveLabel(saveStatus)}</span>
              {!isMobile && <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo" className="nn-document-icon"><ArrowLeft /></Button>}
              {!isMobile && <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo" className="nn-document-icon"><ArrowRight /></Button>}
              {!isMobile && <Button variant="ghost" onClick={onToggleHandwritingPreview} className="nn-action-button nn-preview-toggle" aria-label={showHandwritingPreview ? 'Hide handwriting preview' : 'Show handwriting preview'} title="Handwriting preview"><BookOpen /><span>{showHandwritingPreview ? 'Hide preview' : 'Preview'}</span></Button>}
              <Button variant="outline" onClick={() => setShareMenuOpen((open) => !open)} className="nn-action-button nn-share-button" aria-label="Share note">
                <Share2 />{!isMobile && <span>Share</span>}
              </Button>
              {shareMenuOpen && (
                <div className="nn-share-popover" role="menu">
                  <button type="button" onClick={() => { setShareMenuOpen(false); onShare(); }}>Share note</button>
                  <button type="button" onClick={() => { setShareMenuOpen(false); onExportPDF(); }} disabled={exporting}><FileUp /> Export PDF</button>
                </div>
              )}
              <Button onClick={onSave} className="nn-action-button nn-save-button" disabled={saveStatus === 'saving'}>
                <Save />{!isMobile && <span>Save</span>}
              </Button>
              {isMobile && <Button variant="ghost" size="icon" onClick={() => setInspectorOpen((open) => !open)} aria-label="Toggle editor tools" className="nn-document-icon"><PanelRight /></Button>}
            </div>
          </div>

          <div className="nn-writing-content">
            <div className="nn-document-scroll">
              <article className="nn-document-canvas">
                <div className="nn-document-title-area">
                  <input
                    aria-label="Page title"
                    className="nn-document-heading"
                    value={title}
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder="Untitled"
                    onFocus={() => onFocusBlock(null)}
                  />
                  <div className="nn-document-meta">
                    <span>{blocks.reduce((sum, block) => sum + (block.content.trim().match(/\S+/g)?.length || 0), 0)} words</span>
                    <span aria-hidden="true">·</span>
                    <span>{blocks.length} blocks</span>
                    <span aria-hidden="true">·</span>
                    <span>Page {pageNumber} of {totalPages}</span>
                  </div>
                  <p className="nn-document-prompt">Type <kbd>/</kbd> for blocks, <kbd>@</kbd> for AI, or just start writing.</p>
                </div>
                <div className="nn-direct-editor" onFocusCapture={handleFocusCapture} data-paper={settings.pageStyle}>
                  <NotionEditor
                    blocks={blocks}
                    onBlocksChange={onBlocksChange}
                    currentColor={currentColor}
                    onColorChange={onColorChange}
                    onAIAction={() => { openAIInspector(); onOpenAI(); }}
                    onOCRAction={onOpenScanner}
                    onExport={onExportPDF}
                    settings={settings}
                    pageNumber={pageNumber}
                    totalPages={totalPages}
                  />
                </div>
                {showHandwritingPreview && <section className="nn-visible-handwriting-preview"><div className="nn-preview-title"><BookOpen /><span>Handwriting preview</span></div>{handwritingPreview}</section>}
              </article>
            </div>

            {inspectorOpen && (
              <>
                {isMobile && <button className="nn-writing-scrim nn-inspector-scrim" aria-label="Close editor tools" onClick={() => setInspectorOpen(false)} />}
                <div className={cn('nn-inspector-dock', isMobile && 'nn-inspector-dock-mobile')}>
                  <EditorInspector
                    blocks={blocks}
                    activeTab={activeInspectorTab}
                    onTabChange={setActiveInspectorTab}
                    onInsertBlock={insertBlock}
                    onOpenAI={onOpenAI}
                    onOpenNikAI={onOpenNikAI}
                    onOpenScanner={onOpenScanner}
                    onOpenPageStyle={onOpenPageStyle}
                    pageNumber={pageNumber}
                    totalPages={totalPages}
                    canGoPrev={canGoPrev}
                    canGoNext={canGoNext}
                    onPreviousPage={onPreviousPage}
                    onNextPage={onNextPage}
                    onAddPage={onAddPage}
                    onExportPDF={onExportPDF}
                  />
                </div>
              </>
            )}
          </div>

          <div className="nn-floating-tools" role="toolbar" aria-label="Insert a block">
            <div className="nn-floating-blocks">
              {QUICK_BLOCKS.map(({ type, label, short, icon: Icon }) => (
                <button key={type} type="button" onClick={() => onAddBlock(type)} aria-label={`Insert ${label}`} title={label}>
                  <Icon aria-hidden="true" />
                  <span>{short}</span>
                </button>
              ))}
              <button type="button" onClick={onOpenPageStyle} aria-label="Paper and pen style" title="Paper and pen style"><BookOpen /><span>Paper</span></button>
              <button type="button" onClick={onOpenAI} aria-label="Open writing assistant" title="Writing assistant"><Sparkles /><span>AI</span></button>
            </div>
            <div className="nn-appearance-toggle" aria-label="Appearance">
              <button type="button" onClick={() => !isDark && onToggleDark()} aria-label="Light mode" aria-pressed={!isDark} className={!isDark ? 'is-active' : ''}><Sun /></button>
              <button type="button" onClick={() => isDark && onToggleDark()} aria-label="Dark mode" aria-pressed={isDark} className={isDark ? 'is-active' : ''}><Moon /></button>
            </div>
          </div>
          {isMobile && <div className="nn-writing-mobile-toolbar"><MobileEditorToolbar active={mobileTool} onTool={onMobileTool} listening={isListening} /></div>}
        </main>
      </div>
    </div>
  );
};
