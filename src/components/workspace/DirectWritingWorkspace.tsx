import React, { useCallback, useEffect, useState } from 'react';
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CheckSquare2,
  ChevronDown,
  Code2,
  CloudUpload,
  FileText,
  FileUp,
  Heading1,
  Image,
  List,
  ListOrdered,
  Link2,
  Menu,
  Minus,
  Moon,
  MoreHorizontal,
  PanelRight,
  Quote,
  Save,
  Search,
  UsersRound,
  Sparkles,
  Star,
  Sun,
  Table2,
  Video,
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
  autoFocusTitle?: boolean;
  onTitleChange: (title: string) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
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
  onInsertImage: () => void;
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

const QUICK_BLOCKS: { type: BlockType; label: string; short?: string; icon: React.ElementType }[] = [
  { type: 'text', label: 'Text', short: 'Aa', icon: AlignLeft },
  { type: 'heading1', label: 'Heading', short: 'H1', icon: Heading1 },
  { type: 'bullet', label: 'Bulleted list', icon: List },
  { type: 'todo', label: 'To-do', icon: CheckSquare2 },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'code', label: 'Code', icon: Code2 },
  { type: 'table', label: 'Table', icon: Table2 },
  { type: 'bookmark', label: 'Link', icon: Link2 },
  { type: 'divider', label: 'Divider', icon: Minus },
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
  autoFocusTitle = false,
  onTitleChange,
  isFavorite,
  onToggleFavorite,
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
  onInsertImage,
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [floatingMoreOpen, setFloatingMoreOpen] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setInspectorOpen(false);
    } else {
      setSidebarOpen(true);
      setInspectorOpen(true);
    }
  }, [isMobile]);

  const handleEditorAIAction = useCallback(() => {
    setActiveInspectorTab('ai');
    setInspectorOpen(true);
    onOpenAI();
  }, [onOpenAI]);

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
            <Menu />
          </Button>
          <button type="button" className="nn-brand-button" onClick={() => navigate('/home')} aria-label="NikNote workspace home">
            <img className="nn-brand-mark" src="/images/brand/niknote-primary-mark.png" alt="" aria-hidden="true" />
            <img className="nn-brand-wordmark" src="/images/brand/niknote-primary-wordmark.png" alt="NikNote" />
          </button>
        </div>

        <div className="nn-topbar-actions">
          <Button variant="ghost" size="icon" onClick={onOpenCommandPalette} aria-label="Search workspace" title="Search (Ctrl+K)" className="nn-topbar-icon">
            <Search />
          </Button>
          <Button variant="outline" onClick={onOpenNikAI} className="nn-topbar-ai" aria-label="Open NikAI">
            <img src="/nikai-mark.png" alt="" aria-hidden="true" />
            {!isMobile && <span>NikAI</span>}
          </Button>
          <Button
            variant="outline"
            onClick={onSync}
            className={cn('nn-sync-pill', `nn-sync-${syncState}`)}
            title={`Sync status: ${syncLabel(syncState)} — sync now`}
            aria-label={`Sync status: ${syncLabel(syncState)}. Sync now`}
          >
            <CloudUpload aria-hidden="true" className={syncState === 'syncing' ? 'nn-cloud-uploading' : undefined} />
            <span className="sr-only">{syncLabel(syncState)}</span>
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
                editorChrome
                isOpen
                onToggle={() => setSidebarOpen(false)}
                onNewNote={() => { setSidebarOpen(false); navigate('/editor/new'); }}
                onOpenCommandPalette={onOpenCommandPalette}
              />
            </aside>
          </>
        )}

        <main className="nn-writing-main">
          <div className="nn-document-bar">
            <div className="nn-document-location">
              {!isMobile && (
                <div className="nn-history-actions" aria-label="History">
                  <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo" className="nn-document-icon nn-history-control"><ArrowLeft /></Button>
                  <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo" className="nn-document-icon nn-history-control"><ArrowRight /></Button>
                  <span className="nn-history-divider" aria-hidden="true" />
                </div>
              )}
              <FileText className="nn-document-file-icon" aria-hidden="true" />
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
              <span className="sr-only" role="status">{saveLabel(saveStatus)}</span>
              <Button variant="outline" onClick={onShare} className="nn-action-button nn-share-button" aria-label="Share note">
                <UsersRound />{!isMobile && <span>Share</span>}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleFavorite}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={isFavorite}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                className={cn('nn-document-icon nn-favorite-toggle', isFavorite && 'is-favorite')}
              >
                <Star aria-hidden="true" />
              </Button>
              <div className="nn-document-more-wrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMoreMenuOpen((open) => !open)}
                  aria-label="More note actions"
                  aria-expanded={moreMenuOpen}
                  className="nn-document-icon"
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
                {moreMenuOpen && (
                  <div className="nn-document-more-menu" role="menu" aria-label="More note actions">
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onSave(); }} disabled={saveStatus === 'saving'}><Save aria-hidden="true" /> Save now</button>
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onUndo(); }} disabled={!canUndo}><ArrowLeft aria-hidden="true" /> Undo</button>
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onRedo(); }} disabled={!canRedo}><ArrowRight aria-hidden="true" /> Redo</button>
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onToggleHandwritingPreview(); }}><BookOpen aria-hidden="true" /> {showHandwritingPreview ? 'Hide handwriting preview' : 'Handwriting preview'}</button>
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onOpenPageStyle(); }}><BookOpen aria-hidden="true" /> Paper &amp; pen style</button>
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onOpenImport(); }}><FileUp aria-hidden="true" /> Import</button>
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onOpenScanner(); }}><Sparkles aria-hidden="true" /> Handwriting scanner</button>
                    <button type="button" role="menuitem" onClick={() => { setMoreMenuOpen(false); onExportPDF(); }} disabled={exporting}><FileText aria-hidden="true" /> Export PDF</button>
                  </div>
                )}
              </div>
              {isMobile && <Button variant="ghost" size="icon" onClick={() => setInspectorOpen((open) => !open)} aria-label="Toggle editor tools" className="nn-document-icon"><PanelRight /></Button>}
            </div>
          </div>

          <div className="nn-writing-content">
            <div className="nn-document-scroll">
              <article className="nn-document-canvas">
                <div className="nn-document-title-area">
                  <input
                    aria-label="Page title"
                    autoFocus={autoFocusTitle}
                    className="nn-document-heading"
                    value={title}
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder="Untitled"
                    onFocus={() => onFocusBlock(null)}
                  />
                  <div className="sr-only" aria-live="polite">
                    {blocks.reduce((sum, block) => sum + (block.content.trim().match(/\S+/g)?.length || 0), 0)} words, {blocks.length} blocks, page {pageNumber} of {totalPages}
                  </div>
                </div>
                <div className="nn-direct-editor" onFocusCapture={handleFocusCapture} data-paper={settings.pageStyle}>
                  <NotionEditor
                    blocks={blocks}
                    onBlocksChange={onBlocksChange}
                    currentColor={currentColor}
                    onColorChange={onColorChange}
                    onAIAction={handleEditorAIAction}
                    onOCRAction={onOpenScanner}
                    onExport={onExportPDF}
                    settings={settings}
                    textPlaceholder="Type '/' for commands, '@' to mention, or just start writing..."
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
                    onOpenImport={onOpenImport}
                    onInsertImage={onInsertImage}
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
                <button key={type} type="button" onClick={() => type === 'image' ? onInsertImage() : onAddBlock(type)} aria-label={`Insert ${label}`} title={label}>
                  {short ? <span>{short}</span> : <Icon aria-hidden="true" />}
                </button>
              ))}
              <button
                type="button"
                className="nn-floating-more-trigger"
                onClick={() => setFloatingMoreOpen((open) => !open)}
                aria-label="More editor tools"
                aria-expanded={floatingMoreOpen}
                title="More editor tools"
              >
                <MoreHorizontal aria-hidden="true" />
              </button>
            </div>
            {floatingMoreOpen && (
              <div className="nn-floating-more-menu" role="menu" aria-label="More editor tools">
                <button type="button" role="menuitem" onClick={() => { setFloatingMoreOpen(false); onAddBlock('numbered'); }}><ListOrdered aria-hidden="true" /> Numbered list</button>
                <button type="button" role="menuitem" onClick={() => { setFloatingMoreOpen(false); onAddBlock('quote'); }}><Quote aria-hidden="true" /> Quote</button>
                <button type="button" role="menuitem" onClick={() => { setFloatingMoreOpen(false); onAddBlock('chart'); }}><Table2 aria-hidden="true" /> Data chart</button>
                <button type="button" role="menuitem" onClick={() => { setFloatingMoreOpen(false); onAddBlock('audio'); }}><Video aria-hidden="true" /> Audio or media</button>
                <button type="button" role="menuitem" onClick={() => { setFloatingMoreOpen(false); onOpenPageStyle(); }}><BookOpen aria-hidden="true" /> Paper &amp; pen</button>
                <button type="button" role="menuitem" onClick={() => { setFloatingMoreOpen(false); onOpenAI(); }}><Sparkles aria-hidden="true" /> Writing assistant</button>
              </div>
            )}
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
