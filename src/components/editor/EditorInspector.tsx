import React, { useMemo, useState } from 'react';
import {
  AlignLeft,
  AudioLines,
  BarChart3,
  BookOpen,
  Braces,
  CheckSquare2,
  ChevronDown,
  Code2,
  FileText,
  Heading1,
  Image,
  Layers3,
  List,
  ListOrdered,
  Minus,
  Music2,
  PanelTop,
  Plus,
  ScanLine,
  Search,
  Sparkles,
  Table2,
  Video,
  WandSparkles,
  Quote,
  Link2,
  FileUp,
  File,
  Columns3,
  Sigma,
  ToggleLeft,
} from 'lucide-react';
import type { Block, BlockType } from '@/types/block';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EditorInspectorProps {
  blocks: Block[];
  activeTab?: 'blocks' | 'ai';
  onTabChange?: (tab: 'blocks' | 'ai') => void;
  onInsertBlock: (type: BlockType) => void;
  onInsertImage?: () => void;
  onOpenAI: () => void;
  onOpenNikAI: () => void;
  onOpenScanner: () => void;
  onOpenImport: () => void;
  onOpenPageStyle: () => void;
  pageNumber: number;
  totalPages: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onAddPage: () => void;
  onExportPDF: () => void;
}

type BlockGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: { type: BlockType; label: string; icon: React.ElementType }[];
};

const BLOCK_GROUPS: BlockGroup[] = [
  {
    id: 'essentials',
    label: 'Essentials',
    icon: Layers3,
    items: [
      { type: 'text', label: 'Text', icon: AlignLeft },
      { type: 'heading1', label: 'Heading', icon: Heading1 },
      { type: 'bullet', label: 'List', icon: List },
      { type: 'todo', label: 'To-do', icon: CheckSquare2 },
      { type: 'toggle', label: 'Toggle', icon: ToggleLeft },
      { type: 'quote', label: 'Quote', icon: Quote },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    icon: PanelTop,
    items: [
      { type: 'image', label: 'Image', icon: Image },
      { type: 'video', label: 'Video', icon: Video },
      { type: 'audio', label: 'Audio', icon: Music2 },
      { type: 'file', label: 'File', icon: File },
      { type: 'embed', label: 'Embed', icon: Braces },
      { type: 'code', label: 'Code', icon: Code2 },
    ],
  },
  {
    id: 'layout',
    label: 'Layout',
    icon: Table2,
    items: [
      { type: 'table', label: 'Table', icon: Table2 },
      { type: 'chart', label: 'Chart', icon: BarChart3 },
      { type: 'column', label: 'Columns', icon: Columns3 },
      { type: 'divider', label: 'Divider', icon: Minus },
      { type: 'table_of_contents', label: 'Contents', icon: ListOrdered },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: Sigma,
    items: [
      { type: 'heading2', label: 'Heading 2', icon: Heading1 },
      { type: 'heading3', label: 'Heading 3', icon: Heading1 },
      { type: 'numbered', label: 'Numbered', icon: ListOrdered },
      { type: 'callout', label: 'Callout', icon: Sparkles },
      { type: 'equation', label: 'Equation', icon: Sigma },
      { type: 'mermaid', label: 'Diagram', icon: Braces },
      { type: 'bookmark', label: 'Bookmark', icon: Link2 },
      { type: 'pdf', label: 'PDF link', icon: FileText },
      { type: 'flashcard', label: 'Flashcard', icon: BookOpen },
    ],
  },
];

export const EditorInspector: React.FC<EditorInspectorProps> = ({
  blocks,
  activeTab: controlledTab,
  onTabChange,
  onInsertBlock,
  onInsertImage,
  onOpenAI,
  onOpenNikAI,
  onOpenScanner,
  onOpenImport,
  onOpenPageStyle,
  pageNumber,
  totalPages,
  canGoPrev,
  canGoNext,
  onPreviousPage,
  onNextPage,
  onAddPage,
  onExportPDF,
}) => {
  const [uncontrolledTab, setUncontrolledTab] = useState<'blocks' | 'ai'>('blocks');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ essentials: true, content: true, layout: false, advanced: false });
  const tab = controlledTab ?? uncontrolledTab;
  const changeTab = (next: 'blocks' | 'ai') => {
    setUncontrolledTab(next);
    onTabChange?.(next);
  };
  const normalizedQuery = query.trim().toLowerCase();
  const groups = useMemo(() => BLOCK_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !normalizedQuery || `${item.label} ${item.type}`.toLowerCase().includes(normalizedQuery)),
  })).filter((group) => group.items.length > 0), [normalizedQuery]);

  const insert = (type: BlockType) => {
    if (type === 'image' && onInsertImage) onInsertImage();
    else onInsertBlock(type);
  };

  return (
    <aside className="nn-editor-inspector" aria-label="Editor tools">
      <div className="nn-inspector-tabs" role="tablist" aria-label="Editor panel">
        <button type="button" role="tab" aria-selected={tab === 'blocks'} onClick={() => changeTab('blocks')}>
          <Layers3 aria-hidden="true" /> Blocks
        </button>
        <button type="button" role="tab" aria-selected={tab === 'ai'} onClick={() => changeTab('ai')}>
          <Sparkles aria-hidden="true" /> AI
        </button>
      </div>

      {tab === 'blocks' ? (
        <div className="nn-inspector-scroll">
          <label className="nn-block-search">
            <Search aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search blocks…" aria-label="Search blocks" />
          </label>
          {groups.map((group) => {
            const Icon = group.icon;
            const isExpanded = normalizedQuery ? true : Boolean(expanded[group.id]);
            return (
              <section className="nn-block-group" key={group.id}>
                <button
                  type="button"
                  className="nn-block-group-heading"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded((current) => ({ ...current, [group.id]: !current[group.id] }))}
                >
                  <Icon aria-hidden="true" />
                  <span>{group.label}</span>
                  <ChevronDown className={cn('nn-block-group-chevron', !isExpanded && 'is-collapsed')} aria-hidden="true" />
                </button>
                {isExpanded && (
                  <div className="nn-insert-grid">
                    {group.items.map(({ type, label, icon: ItemIcon }) => (
                      <button key={type} type="button" onClick={() => insert(type)} className="nn-insert-tile" aria-label={`Insert ${label} block`}>
                        <ItemIcon aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {groups.length === 0 && <p className="nn-inspector-empty">No blocks match “{query}”.</p>}

          <details className="nn-integrations">
            <summary><Sparkles aria-hidden="true" /><span>Integrations</span><ChevronDown aria-hidden="true" /></summary>
            <div className="nn-integrations-actions">
              <button type="button" onClick={onOpenScanner}><ScanLine aria-hidden="true" /><span>Scan handwriting</span></button>
              <button type="button" onClick={onOpenAI}><WandSparkles aria-hidden="true" /><span>Work with this note</span></button>
              <button type="button" onClick={onOpenNikAI}><Sparkles aria-hidden="true" /><span>Open NikAI</span></button>
              <button type="button" onClick={onOpenImport}><FileUp aria-hidden="true" /><span>Import text or PDF</span></button>
            </div>
          </details>

          <details className="nn-integrations nn-page-tools-accordion">
            <summary><BookOpen aria-hidden="true" /><span>Handwriting &amp; pages</span><ChevronDown aria-hidden="true" /></summary>
            <div className="nn-page-tools">
              <div className="nn-page-stepper">
                <Button variant="ghost" size="icon" onClick={onPreviousPage} disabled={!canGoPrev} aria-label="Previous page"><span aria-hidden="true">‹</span></Button>
                <span>Page {pageNumber} <small>of {totalPages}</small></span>
                <Button variant="ghost" size="icon" onClick={onNextPage} disabled={!canGoNext} aria-label="Next page"><span aria-hidden="true">›</span></Button>
              </div>
              <div className="nn-page-actions">
                <Button variant="outline" size="sm" onClick={onAddPage}><Plus aria-hidden="true" /> New page</Button>
                <Button variant="outline" size="sm" onClick={onOpenPageStyle}>Paper style</Button>
              </div>
              <Button variant="outline" size="sm" className="nn-page-export" onClick={onExportPDF}><BookOpen aria-hidden="true" /> Export handwritten PDF</Button>
            </div>
          </details>
          <div className="nn-inspector-current-count" aria-live="polite">{blocks.length} {blocks.length === 1 ? 'block' : 'blocks'} in this note</div>
        </div>
      ) : (
        <div className="nn-inspector-scroll nn-ai-panel">
          <div className="nn-ai-panel-card">
            <div className="nn-ai-panel-mark"><WandSparkles aria-hidden="true" /></div>
            <p className="nn-inspector-eyebrow">NIKAI ASSISTANT</p>
            <h2>Think it through, together.</h2>
            <p>Ask a question, organize your notes, or turn a rough idea into something clearer.</p>
            <Button onClick={onOpenNikAI} className="w-full"><Sparkles aria-hidden="true" /> Open NikAI</Button>
          </div>
          <section className="nn-inspector-section">
            <p className="nn-inspector-eyebrow">AI ACTIONS</p>
            <div className="nn-ai-actions">
              <button type="button" onClick={onOpenAI}><WandSparkles aria-hidden="true" /><span><strong>Work with this note</strong><small>Summarize, rewrite, or expand</small></span></button>
              <button type="button" onClick={onOpenNikAI}><BookOpen aria-hidden="true" /><span><strong>Study from my notes</strong><small>Ask NikAI about your workspace</small></span></button>
              <button type="button" onClick={onOpenScanner}><ScanLine aria-hidden="true" /><span><strong>Scan handwriting</strong><small>Extract text from a page</small></span></button>
            </div>
          </section>
          <div className="nn-ai-panel-hint"><FileText aria-hidden="true" /> AI only runs when you choose an action.</div>
        </div>
      )}
    </aside>
  );
};
