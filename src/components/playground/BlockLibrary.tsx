import React, { useMemo, useState } from 'react';
import {
  BarChart3, Brain, CheckSquare, ChevronDown, ChevronRight, Code2, Database, FileText,
  Heading1, Image, Lightbulb, Link2, List, ListOrdered, Minus, MousePointer2,
  PenLine, Quote, Search, Shapes, Sparkles, Square, Circle, Triangle, ArrowRight,
  StickyNote, Table2, Type, Workflow, X,
} from 'lucide-react';
import type { PlaygroundBlockKind, PlaygroundObject } from '@/lib/playground';

export interface BlockSpec {
  id: string;
  label: string;
  category: string;
  icon: React.ElementType;
  kind?: PlaygroundBlockKind;
  overrides?: Partial<PlaygroundObject>;
  action?: 'image' | 'pen' | 'ai';
}

const PLAYGROUND_BLOCKS: BlockSpec[] = [
  { id: 'text', label: 'Text', category: 'Basic', icon: Type, kind: 'text' },
  { id: 'heading', label: 'Heading', category: 'Basic', icon: Heading1, kind: 'heading' },
  { id: 'todo', label: 'To-do list', category: 'Basic', icon: CheckSquare, kind: 'todo' },
  { id: 'bullets', label: 'Bulleted list', category: 'Basic', icon: List, kind: 'text', overrides: { text: '• First item\n• Second item', height: 120 } },
  { id: 'numbered', label: 'Numbered list', category: 'Basic', icon: ListOrdered, kind: 'text', overrides: { text: '1. First item\n2. Second item', height: 120 } },
  { id: 'quote', label: 'Quote', category: 'Basic', icon: Quote, kind: 'text', overrides: { text: '“A thought worth keeping.”', fontSize: 20, fontStyle: 'italic', borderColor: '#CB289D' } },
  { id: 'callout', label: 'Callout', category: 'Basic', icon: Lightbulb, kind: 'text', overrides: { text: '💡 Add a useful callout', background: '#F6F0F8', height: 90 } },
  { id: 'code', label: 'Code block', category: 'Basic', icon: Code2, kind: 'code' },
  { id: 'divider', label: 'Divider', category: 'Basic', icon: Minus, kind: 'divider' },
  { id: 'image', label: 'Upload image', category: 'Media', icon: Image, action: 'image' },
  { id: 'link', label: 'Link card', category: 'Media', icon: Link2, kind: 'link' },
  { id: 'table', label: 'Table', category: 'Productivity', icon: Table2, kind: 'table' },
  { id: 'chart', label: 'Editable chart / graph', category: 'Productivity', icon: BarChart3, kind: 'chart' },
  { id: 'database', label: 'Data table', category: 'Productivity', icon: Database, kind: 'table', overrides: { text: 'Research database', rows: [['Idea', 'Owner', 'Status'], ['', '', 'Not started'], ['', '', 'Not started']] } },
  { id: 'sticky', label: 'Sticky note', category: 'Creative', icon: StickyNote, kind: 'sticky' },
  { id: 'rectangle', label: 'Rectangle', category: 'Creative', icon: Square, kind: 'shape', overrides: { shape: 'rectangle' } },
  { id: 'circle', label: 'Circle', category: 'Creative', icon: Circle, kind: 'shape', overrides: { shape: 'circle' } },
  { id: 'triangle', label: 'Triangle', category: 'Creative', icon: Triangle, kind: 'shape', overrides: { shape: 'triangle' } },
  { id: 'arrow', label: 'Arrow', category: 'Creative', icon: ArrowRight, kind: 'shape', overrides: { shape: 'arrow', background: '#CB289D', borderColor: '#CB289D' } },
  { id: 'pen', label: 'Freehand drawing', category: 'Creative', icon: PenLine, action: 'pen' },
  { id: 'input-node', label: 'Input node', category: 'Workflow', icon: Workflow, kind: 'node', overrides: { text: 'Input', nodeCategory: 'Input', subtitle: 'Visual node · not executed' } },
  { id: 'ai-node', label: 'AI node', category: 'Workflow', icon: Brain, kind: 'node', overrides: { text: 'AI Model', nodeCategory: 'AI', subtitle: 'Configure · not executed' } },
  { id: 'logic-node', label: 'Logic node', category: 'Workflow', icon: Shapes, kind: 'node', overrides: { text: 'Condition', nodeCategory: 'Logic', subtitle: 'Visual branch · not executed' } },
  { id: 'output-node', label: 'Output node', category: 'Workflow', icon: MousePointer2, kind: 'node', overrides: { text: 'Output', nodeCategory: 'Output', subtitle: 'Visual output · not executed' } },
  { id: 'ai-assistant', label: 'Open NikAI Assistant', category: 'AI', icon: Sparkles, action: 'ai' },
];

const CATEGORY_ORDER = ['Basic', 'Media', 'Productivity', 'Creative', 'Workflow', 'AI'];

interface Props {
  notes?: { id: string; title: string }[];
  onAdd: (kind: PlaygroundBlockKind, overrides?: Partial<PlaygroundObject>) => void;
  onImage: () => void;
  onPen: () => void;
  onAI: () => void;
  onClose?: () => void;
}

export function BlockLibrary({ notes = [], onAdd, onImage, onPen, onAI, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['Basic', 'Productivity', 'Notes', 'Creative', 'Workflow']));
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('niknote.playground.recentBlocks') || '[]'); } catch { return []; }
  });

  const allBlocks = useMemo(() => [
    ...PLAYGROUND_BLOCKS,
    ...notes.map((note): BlockSpec => ({
      id: `note-${note.id}`,
      label: note.title || 'Untitled note',
      category: 'Notes',
      icon: FileText,
      kind: 'link',
      overrides: { text: note.title || 'Untitled note', href: `/?editor=1&notebook=${encodeURIComponent(note.id)}` },
    })),
  ], [notes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allBlocks.filter((block) => !q || `${block.label} ${block.category}`.toLowerCase().includes(q));
  }, [allBlocks, query]);

  const run = (block: BlockSpec) => {
    if (block.kind) onAdd(block.kind, block.overrides);
    if (block.action === 'image') onImage();
    if (block.action === 'pen') onPen();
    if (block.action === 'ai') onAI();
    const next = [block.id, ...recent.filter((id) => id !== block.id)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem('niknote.playground.recentBlocks', JSON.stringify(next)); } catch { /* optional */ }
  };

  const categories = query ? ['Search results'] : [...CATEGORY_ORDER, ...(notes.length ? ['Notes'] : [])];
  const recentBlocks = recent.map((id) => allBlocks.find((block) => block.id === id)).filter(Boolean) as BlockSpec[];

  return (
    <aside className="pg-library" aria-label="Block library">
      <div className="pg-library-search">
        <Search size={14} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search blocks…" aria-label="Search blocks" />
        {onClose && <button onClick={onClose} aria-label="Close block library"><X size={15} /></button>}
      </div>
      <div className="pg-library-scroll">
        {!query && recentBlocks.length > 0 && (
          <section className="pg-block-category">
            <h3>Recently used</h3>
            {recentBlocks.slice(0, 3).map((block) => <BlockRow key={`recent-${block.id}`} block={block} onRun={run} />)}
          </section>
        )}
        {categories.map((category) => {
          const blocks = category === 'Search results' ? visible : visible.filter((block) => block.category === category);
          if (!blocks.length) return null;
          const open = category === 'Search results' || expanded.has(category);
          return (
            <section className="pg-block-category" key={category}>
              {category !== 'Search results' && (
                <button className="pg-category-toggle" onClick={() => setExpanded((previous) => {
                  const next = new Set(previous);
                  if (next.has(category)) next.delete(category); else next.add(category);
                  return next;
                })} aria-expanded={open}>
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>{category}</span>
                </button>
              )}
              {open && blocks.map((block) => <BlockRow key={block.id} block={block} onRun={run} />)}
            </section>
          );
        })}
        {query && !visible.length && (
          <div className="pg-library-empty"><FileText size={24} /><p>No blocks match “{query}”.</p></div>
        )}
      </div>
      <p className="pg-library-hint">Click or drag anywhere · double-click blocks to edit</p>
    </aside>
  );
}

function BlockRow({ block, onRun }: { block: BlockSpec; onRun: (block: BlockSpec) => void }) {
  const Icon = block.icon;
  return (
    <button
      className="pg-block-row"
      onClick={() => onRun(block)}
      draggable={Boolean(block.kind)}
      onDragStart={(event) => {
        if (!block.kind) return event.preventDefault();
        event.dataTransfer.setData('application/x-niknote-block', JSON.stringify({ kind: block.kind, overrides: block.overrides }));
        event.dataTransfer.effectAllowed = 'copy';
      }}
      title={`Insert ${block.label}`}
    >
      <Icon size={15} strokeWidth={1.8} />
      <span>{block.label}</span>
      <span className="pg-block-add">+</span>
    </button>
  );
}
