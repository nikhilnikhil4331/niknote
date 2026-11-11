import React, { useMemo, useState } from 'react';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckSquare2,
  Code2,
  FileText,
  Heading1,
  Image,
  List,
  ListOrdered,
  MessageSquareQuote,
  Minus,
  Plus,
  ScanLine,
  Sparkles,
  Table2,
  WandSparkles,
} from 'lucide-react';
import type { Block, BlockType } from '@/types/block';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EditorInspectorProps {
  blocks: Block[];
  activeTab?: 'blocks' | 'ai';
  onTabChange?: (tab: 'blocks' | 'ai') => void;
  onInsertBlock: (type: BlockType) => void;
  onOpenAI: () => void;
  onOpenNikAI: () => void;
  onOpenScanner: () => void;
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

const INSERT_BLOCKS: { type: BlockType; label: string; description: string; icon: React.ElementType }[] = [
  { type: 'text', label: 'Text', description: 'Start with a plain paragraph', icon: AlignLeft },
  { type: 'heading1', label: 'Heading', description: 'Create a clear section title', icon: Heading1 },
  { type: 'bullet', label: 'Bulleted list', description: 'Organize related points', icon: List },
  { type: 'numbered', label: 'Numbered list', description: 'Add steps in order', icon: ListOrdered },
  { type: 'todo', label: 'To-do', description: 'Track a task in this note', icon: CheckSquare2 },
  { type: 'quote', label: 'Quote', description: 'Highlight a useful passage', icon: MessageSquareQuote },
  { type: 'code', label: 'Code', description: 'Format a code snippet', icon: Code2 },
  { type: 'table', label: 'Table', description: 'Add a structured table', icon: Table2 },
  { type: 'image', label: 'Image', description: 'Insert an image block', icon: Image },
  { type: 'divider', label: 'Divider', description: 'Separate sections', icon: Minus },
];

export const EditorInspector: React.FC<EditorInspectorProps> = ({
  blocks,
  activeTab: controlledTab,
  onTabChange,
  onInsertBlock,
  onOpenAI,
  onOpenNikAI,
  onOpenScanner,
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
  const tab = controlledTab ?? uncontrolledTab;
  const changeTab = (next: 'blocks' | 'ai') => {
    setUncontrolledTab(next);
    onTabChange?.(next);
  };
  const wordCount = useMemo(
    () => blocks.reduce((count, block) => count + (block.content.trim().match(/\S+/g)?.length || 0), 0),
    [blocks],
  );
  const headings = blocks.filter((block) => /^heading[123]$/.test(block.type) && block.content.trim());
  const completedTodos = blocks.filter((block) => block.type === 'todo' && block.checked).length;
  const todoCount = blocks.filter((block) => block.type === 'todo').length;

  const jumpToBlock = (id: string) => {
    const wrapper = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).find(
      (node) => node.dataset.blockId === id,
    );
    const textarea = wrapper?.querySelector('textarea');
    textarea?.focus();
    wrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <aside className="nn-editor-inspector" aria-label="Editor tools">
      <div className="nn-inspector-tabs" role="tablist" aria-label="Editor panel">
        <button type="button" role="tab" aria-selected={tab === 'blocks'} onClick={() => changeTab('blocks')}>
          <Plus className="h-3.5 w-3.5" /> Blocks
        </button>
        <button type="button" role="tab" aria-selected={tab === 'ai'} onClick={() => changeTab('ai')}>
          <Sparkles className="h-3.5 w-3.5" /> AI
        </button>
      </div>

      {tab === 'blocks' ? (
        <div className="nn-inspector-scroll">
          <section className="nn-inspector-section">
            <div className="nn-inspector-section-title">
              <div>
                <p className="nn-inspector-eyebrow">BUILD YOUR PAGE</p>
                <h2>Blocks</h2>
              </div>
              <span className="nn-block-count">{blocks.length}</span>
            </div>
            <div className="nn-block-insert-list">
              {INSERT_BLOCKS.map(({ type, label, description, icon: Icon }) => (
                <button key={type} type="button" onClick={() => onInsertBlock(type)} className="nn-block-insert">
                  <span className="nn-block-insert-icon"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <Plus className="nn-block-insert-plus h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </section>

          <section className="nn-inspector-section">
            <div className="nn-inspector-section-title">
              <div>
                <p className="nn-inspector-eyebrow">DOCUMENT</p>
                <h2>Outline</h2>
              </div>
            </div>
            {headings.length ? (
              <div className="nn-outline-list">
                {headings.map((heading) => (
                  <button
                    type="button"
                    key={heading.id}
                    className={cn('nn-outline-item', heading.type === 'heading2' && 'is-nested', heading.type === 'heading3' && 'is-deep')}
                    onClick={() => jumpToBlock(heading.id)}
                  >
                    <span>{heading.type === 'heading1' ? 'H1' : heading.type === 'heading2' ? 'H2' : 'H3'}</span>
                    <strong>{heading.content}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <p className="nn-inspector-empty">Headings you add will appear here.</p>
            )}
          </section>

          <section className="nn-inspector-section nn-note-stats">
            <p className="nn-inspector-eyebrow">AT A GLANCE</p>
            <div className="nn-stat-grid">
              <div><strong>{wordCount}</strong><span>Words</span></div>
              <div><strong>{blocks.length}</strong><span>Blocks</span></div>
              <div><strong>{todoCount ? `${completedTodos}/${todoCount}` : '—'}</strong><span>To-dos</span></div>
            </div>
          </section>

          <section className="nn-inspector-section nn-page-tools">
            <div className="nn-inspector-section-title">
              <div>
                <p className="nn-inspector-eyebrow">HANDWRITING EXPORT</p>
                <h2>Page tools</h2>
              </div>
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="nn-page-stepper">
              <Button variant="ghost" size="icon" onClick={onPreviousPage} disabled={!canGoPrev} aria-label="Previous page"><ArrowUp className="h-4 w-4" /></Button>
              <span>Page {pageNumber} <small>of {totalPages}</small></span>
              <Button variant="ghost" size="icon" onClick={onNextPage} disabled={!canGoNext} aria-label="Next page"><ArrowDown className="h-4 w-4" /></Button>
            </div>
            <div className="nn-page-actions">
              <Button variant="outline" size="sm" onClick={onAddPage}><Plus className="h-3.5 w-3.5" /> New page</Button>
              <Button variant="outline" size="sm" onClick={onOpenPageStyle}>Paper style</Button>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={onExportPDF}><BookOpen className="h-3.5 w-3.5" /> Export handwritten PDF</Button>
          </section>
        </div>
      ) : (
        <div className="nn-inspector-scroll nn-ai-panel">
          <div className="nn-ai-panel-card">
            <div className="nn-ai-panel-mark"><WandSparkles className="h-5 w-5" /></div>
            <p className="nn-inspector-eyebrow">NIKAI ASSISTANT</p>
            <h2>Think it through, together.</h2>
            <p>Ask a question, organize your notes, or turn a rough idea into something clearer.</p>
            <Button onClick={onOpenNikAI} className="w-full"><Sparkles className="h-4 w-4" /> Open NikAI</Button>
          </div>
          <section className="nn-inspector-section">
            <p className="nn-inspector-eyebrow">QUICK ACTIONS</p>
            <div className="nn-ai-actions">
              <button type="button" onClick={onOpenAI}><WandSparkles className="h-4 w-4" /><span><strong>Work with this note</strong><small>Summarize, rewrite, or expand</small></span></button>
              <button type="button" onClick={onOpenNikAI}><BookOpen className="h-4 w-4" /><span><strong>Study from my notes</strong><small>Make a quiz or flashcards</small></span></button>
              <button type="button" onClick={onOpenScanner}><ScanLine className="h-4 w-4" /><span><strong>Scan handwriting</strong><small>Extract text from a page</small></span></button>
            </div>
          </section>
          <div className="nn-ai-panel-hint"><FileText className="h-4 w-4" /> Your notes stay in your workspace. AI only runs when you choose an action.</div>
        </div>
      )}
    </aside>
  );
};
