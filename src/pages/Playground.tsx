import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownToLine, Check, CheckSquare, ChevronLeft, CircleHelp, Download, Grid2X2,
  MessageCircle, Move, Palette, Plus, RotateCcw, RotateCw, Shapes, Sparkles,
  Star, StickyNote, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { MobileNavigation } from '@/components/mobile/MobilePrimitives';
import { useMobileAppearance } from '@/components/mobile/useMobileAppearance';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  createCanvasItem,
  createPlaygroundSvg,
  createStarterBoard,
  parsePlaygroundBoard,
  PLAYGROUND_COLORS,
  PLAYGROUND_MAX_ITEMS,
  PLAYGROUND_STORAGE_KEY,
  PLAYGROUND_THEMES,
  type PlaygroundBoard,
  type PlaygroundColorId,
  type PlaygroundItem,
  type PlaygroundItemKind,
  type PlaygroundTemplateId,
} from '@/lib/playground';
import './playground.css';

type SaveState = 'saving' | 'saved' | 'unavailable';

const TEMPLATES: { id: PlaygroundTemplateId; title: string; description: string; icon: typeof Sparkles }[] = [
  { id: 'idea-garden', title: 'Idea garden', description: 'A little room to wander', icon: Sparkles },
  { id: 'daily-reset', title: 'Daily reset', description: 'A kind, simple plan', icon: CheckSquare },
  { id: 'story-beats', title: 'Story beats', description: 'Arrange a tiny narrative', icon: StickyNote },
  { id: 'revision-map', title: 'Revision map', description: 'Small steps for study', icon: Grid2X2 },
];

const PIECES: { kind: PlaygroundItemKind; label: string; hint: string; icon: typeof StickyNote }[] = [
  { kind: 'note', label: 'Sticky note', hint: 'A place for a thought', icon: StickyNote },
  { kind: 'checklist', label: 'Checklist', hint: 'Little steps, checked off', icon: CheckSquare },
  { kind: 'bubble', label: 'Thought bubble', hint: 'Ask a what-if', icon: MessageCircle },
  { kind: 'star', label: 'Compass star', hint: 'Mark a bright idea', icon: Star },
];

const kindLabels: Record<PlaygroundItemKind, string> = {
  note: 'Sticky note',
  checklist: 'Checklist',
  bubble: 'Thought bubble',
  star: 'Compass star',
};

function getInitialBoard(): PlaygroundBoard {
  try {
    return parsePlaygroundBoard(localStorage.getItem(PLAYGROUND_STORAGE_KEY)) ?? createStarterBoard();
  } catch {
    return createStarterBoard();
  }
}

function downloadBoard(board: PlaygroundBoard) {
  try {
    const blob = new Blob([createPlaygroundSvg(board)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(board.title || 'niknote-playground').trim().replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'niknote-playground'}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success('Your canvas is ready as an SVG.');
  } catch {
    toast.error('The canvas could not be exported in this browser.');
  }
}

function itemColor(color: PlaygroundColorId) {
  return PLAYGROUND_COLORS.find((entry) => entry.id === color) ?? PLAYGROUND_COLORS[4];
}

function BoardPiece({
  item,
  selected,
  onSelect,
  onStartDrag,
  onDrag,
  onEndDrag,
  onRemove,
  onToggleCheck,
  onMoveWithKeyboard,
}: {
  item: PlaygroundItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onStartDrag: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  onDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndDrag: () => void;
  onRemove: (id: string) => void;
  onToggleCheck: (id: string, index: number) => void;
  onMoveWithKeyboard: (id: string, key: string, largeStep: boolean) => void;
}) {
  const palette = itemColor(item.color);
  const lines = item.text.split(/\r?\n/).filter(Boolean).slice(0, 5);
  const style: CSSProperties & Record<`--${string}`, string> = {
    left: `${item.x}%`,
    top: `${item.y}%`,
    transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
    zIndex: selected ? 3 : 1,
    '--pg-piece-fill': palette.fill,
    '--pg-piece-ink': palette.ink,
    '--pg-piece-border': palette.border,
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Let nested checklist and remove buttons keep their native keyboard behavior.
    if (event.target !== event.currentTarget) return;
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      onMoveWithKeyboard(item.id, event.key, event.shiftKey);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(item.id);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemove(item.id);
    }
  };

  const renderPiece = () => {
    if (item.kind === 'star') {
      return (
        <div className="pg-star-sticker">
          <Star className="pg-star-icon" aria-hidden="true" fill="currentColor" />
          <span>{item.text || 'Keep this idea close'}</span>
        </div>
      );
    }
    if (item.kind === 'bubble') {
      return (
        <div className="pg-bubble-sticker">
          <div className="pg-piece-label"><MessageCircle size={13} aria-hidden="true" /> A THOUGHT</div>
          <p>{item.text || 'What if…?'}</p>
        </div>
      );
    }
    if (item.kind === 'checklist') {
      return (
        <div className="pg-paper-sticker pg-checklist-sticker">
          <div className="pg-piece-label"><CheckSquare size={13} aria-hidden="true" /> LITTLE CHECKLIST</div>
          <div className="pg-checklist-lines">
            {(lines.length ? lines : ['Add a small step']).map((line, index) => {
              const checked = item.checked?.[index] === true;
              return (
                <button
                  type="button"
                  className={`pg-check-row${checked ? ' is-checked' : ''}`}
                  key={`${index}-${line}`}
                  aria-label={`${checked ? 'Uncheck' : 'Check'} ${line}`}
                  aria-pressed={checked}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => { event.stopPropagation(); onToggleCheck(item.id, index); }}
                >
                  <span className="pg-check-box" aria-hidden="true">{checked && <Check size={12} />}</span>
                  <span>{line}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="pg-paper-sticker">
        <div className="pg-piece-label"><StickyNote size={13} aria-hidden="true" /> STICKY NOTE</div>
        <p>{item.text || 'Write a bright little thought…'}</p>
      </div>
    );
  };

  return (
    <div
      className={`pg-board-piece${selected ? ' is-selected' : ''}`}
      style={style}
      role="group"
      tabIndex={0}
      aria-label={`${kindLabels[item.kind]}. ${item.text || 'Empty piece'}. Use the arrow keys to move it.`}
      aria-roledescription="movable canvas piece"
      onClick={() => onSelect(item.id)}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
        event.preventDefault();
        onSelect(item.id);
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture may be unsupported in embedded browsers. */ }
        onStartDrag(item.id, event);
      }}
      onPointerMove={(event) => { if (event.buttons > 0) onDrag(event); }}
      onPointerUp={onEndDrag}
      onPointerCancel={onEndDrag}
      onLostPointerCapture={onEndDrag}
    >
      {renderPiece()}
      {selected && (
        <button
          type="button"
          className="pg-piece-remove"
          aria-label={`Remove ${kindLabels[item.kind]}`}
          title="Remove this piece"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onRemove(item.id); }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function PlaygroundCanvas({
  board,
  selectedId,
  stageRef,
  onSelect,
  onStartDrag,
  onDrag,
  onEndDrag,
  onRemove,
  onToggleCheck,
  onMoveWithKeyboard,
}: {
  board: PlaygroundBoard;
  selectedId: string | null;
  stageRef: React.RefObject<HTMLDivElement>;
  onSelect: (id: string) => void;
  onStartDrag: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  onDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndDrag: () => void;
  onRemove: (id: string) => void;
  onToggleCheck: (id: string, index: number) => void;
  onMoveWithKeyboard: (id: string, key: string, largeStep: boolean) => void;
}) {
  return (
    <div className={`pg-canvas pg-theme-${board.theme}`} data-theme={board.theme}>
      <div className="pg-canvas-topline" aria-hidden="true">
        <span className="pg-canvas-dot" /><span className="pg-canvas-dot" /><span className="pg-canvas-dot" />
        <span className="pg-canvas-caption">YOUR LITTLE IDEA DESK</span>
      </div>
      <div
        className="pg-canvas-stage"
        ref={stageRef}
        role="group"
        aria-label="Creative canvas. Drag pieces to move them, or focus one and use the arrow keys."
      >
        {board.items.map((item) => (
          <BoardPiece
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onSelect={onSelect}
            onStartDrag={onStartDrag}
            onDrag={onDrag}
            onEndDrag={onEndDrag}
            onRemove={onRemove}
            onToggleCheck={onToggleCheck}
            onMoveWithKeyboard={onMoveWithKeyboard}
          />
        ))}
        {board.items.length === 0 && (
          <div className="pg-empty-canvas">
            <span className="pg-empty-icon"><Sparkles size={20} /></span>
            <strong>A fresh page, all yours.</strong>
            <span>Add a note, checklist, bubble or star to begin.</span>
          </div>
        )}
      </div>
      <div className="pg-canvas-footer" aria-hidden="true">
        <span><Move size={13} /> Drag to move · arrow keys for tiny nudges</span>
        <span>{board.items.length}/{PLAYGROUND_MAX_ITEMS} pieces</span>
      </div>
    </div>
  );
}

function ThemePicker({ theme, onChange }: { theme: PlaygroundBoard['theme']; onChange: (theme: PlaygroundBoard['theme']) => void }) {
  return (
    <div className="pg-theme-list" role="group" aria-label="Canvas paper style">
      {PLAYGROUND_THEMES.map((option) => (
        <button
          type="button"
          key={option.id}
          className={`pg-theme-option${theme === option.id ? ' is-active' : ''}`}
          aria-label={`${option.label} paper`}
          aria-pressed={theme === option.id}
          onClick={() => onChange(option.id)}
        >
          <span className={`pg-theme-swatch pg-theme-swatch-${option.id}`} aria-hidden="true" />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function PlaygroundTools({
  board,
  selected,
  onAdd,
  onUpdateSelected,
  onTheme,
  onTemplate,
  onRotate,
  onRemove,
}: {
  board: PlaygroundBoard;
  selected: PlaygroundItem | null;
  onAdd: (kind: PlaygroundItemKind) => void;
  onUpdateSelected: (updates: Partial<PlaygroundItem>) => void;
  onTheme: (theme: PlaygroundBoard['theme']) => void;
  onTemplate: (template: PlaygroundTemplateId) => void;
  onRotate: (amount: number) => void;
  onRemove: () => void;
}) {
  return (
    <aside className="pg-tools-column" aria-label="Playground tools">
      <section className="pg-tool-card">
        <div className="pg-tool-heading">
          <span className="pg-tool-icon"><Shapes size={16} /></span>
          <div><h2>Pieces to play with</h2><p>Pin a thought to the page.</p></div>
        </div>
        <div className="pg-piece-picker">
          {PIECES.map(({ kind, label, hint, icon: Icon }) => (
            <button
              type="button"
              key={kind}
              className="pg-piece-choice"
              onClick={() => onAdd(kind)}
              disabled={board.items.length >= PLAYGROUND_MAX_ITEMS}
            >
              <span className={`pg-choice-icon pg-choice-${kind}`}><Icon size={17} /></span>
              <span className="pg-choice-copy"><strong>{label}</strong><small>{hint}</small></span>
              <Plus className="pg-choice-plus" size={16} />
            </button>
          ))}
        </div>
        {board.items.length >= PLAYGROUND_MAX_ITEMS && <p className="pg-limit-note">This canvas is full. Remove a piece to add another.</p>}
      </section>

      <section className="pg-tool-card">
        <div className="pg-tool-heading">
          <span className="pg-tool-icon pg-tool-icon-yellow"><Palette size={16} /></span>
          <div><h2>Choose your paper</h2><p>Set the mood for your ideas.</p></div>
        </div>
        <ThemePicker theme={board.theme} onChange={onTheme} />
      </section>

      <section className="pg-tool-card pg-inspector-card" aria-labelledby="pg-inspector-title">
        <div className="pg-tool-heading">
          <span className="pg-tool-icon pg-tool-icon-coral"><Move size={16} /></span>
          <div><h2 id="pg-inspector-title">Piece inspector</h2><p>{selected ? kindLabels[selected.kind] : 'Pick a piece to fine-tune it.'}</p></div>
        </div>
        {selected ? (
          <div className="pg-inspector-fields">
            <label className="pg-field-label" htmlFor="pg-piece-text">Your words</label>
            <textarea
              id="pg-piece-text"
              className="pg-textarea"
              maxLength={500}
              rows={selected.kind === 'checklist' ? 4 : 3}
              value={selected.text}
              onChange={(event) => onUpdateSelected({ text: event.target.value })}
              placeholder={selected.kind === 'checklist' ? 'One small step per line…' : 'Write a little something…'}
            />
            {selected.kind === 'checklist' && <p className="pg-field-hint">Use a new line for each checkbox. Tap a checkbox on the canvas to mark it done.</p>}
            <fieldset className="pg-color-fieldset">
              <legend className="pg-field-label">Paper colour</legend>
              <div className="pg-color-swatches">
                {PLAYGROUND_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color.id}
                    className={`pg-color-swatch${selected.color === color.id ? ' is-active' : ''}`}
                    style={{ background: color.fill, borderColor: color.border } as CSSProperties}
                    aria-label={color.label}
                    aria-pressed={selected.color === color.id}
                    onClick={() => onUpdateSelected({ color: color.id })}
                  >
                    {selected.color === color.id && <Check size={14} color={color.ink} />}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="pg-adjust-row">
              <label className="pg-range-label" htmlFor="pg-piece-scale">Size <span>{Math.round(selected.scale * 100)}%</span></label>
              <input
                id="pg-piece-scale"
                type="range"
                min="0.75"
                max="1.3"
                step="0.05"
                value={selected.scale}
                onChange={(event) => onUpdateSelected({ scale: Number(event.target.value) })}
              />
            </div>
            <div className="pg-inspector-actions">
              <button type="button" className="pg-small-action" onClick={() => onRotate(-5)} aria-label="Rotate left"><RotateCcw size={14} /> Rotate left</button>
              <button type="button" className="pg-small-action" onClick={() => onRotate(5)} aria-label="Rotate right"><RotateCw size={14} /> Rotate right</button>
              <button type="button" className="pg-small-action pg-delete-action" onClick={onRemove}><Trash2 size={14} /> Remove</button>
            </div>
          </div>
        ) : (
          <div className="pg-inspector-empty"><CircleHelp size={19} /><span>Select a piece on the canvas to edit its words, colour and size.</span></div>
        )}
      </section>

      <section className="pg-tool-card pg-templates-card">
        <div className="pg-tool-heading">
          <span className="pg-tool-icon pg-tool-icon-blue"><Sparkles size={16} /></span>
          <div><h2>Start with a little spark</h2><p>Choose a layout to remix.</p></div>
        </div>
        <div className="pg-template-list">
          {TEMPLATES.map(({ id, title, description, icon: Icon }) => (
            <button type="button" key={id} className="pg-template-choice" onClick={() => onTemplate(id)}>
              <span className="pg-template-mark"><Icon size={15} /></span>
              <span><strong>{title}</strong><small>{description}</small></span>
              <span className="pg-template-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <p className="pg-template-warning">Choosing a layout replaces the current canvas only after you confirm.</p>
      </section>
    </aside>
  );
}

function PlaygroundWorkspace({
  board,
  selected,
  selectedId,
  stageRef,
  onBoardTitle,
  onSelect,
  onStartDrag,
  onDrag,
  onEndDrag,
  onRemove,
  onToggleCheck,
  onMoveWithKeyboard,
  onAdd,
  onUpdateSelected,
  onTheme,
  onTemplate,
  onRotate,
}: {
  board: PlaygroundBoard;
  selected: PlaygroundItem | null;
  selectedId: string | null;
  stageRef: React.RefObject<HTMLDivElement>;
  onBoardTitle: (title: string) => void;
  onSelect: (id: string) => void;
  onStartDrag: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  onDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onEndDrag: () => void;
  onRemove: (id: string) => void;
  onToggleCheck: (id: string, index: number) => void;
  onMoveWithKeyboard: (id: string, key: string, largeStep: boolean) => void;
  onAdd: (kind: PlaygroundItemKind) => void;
  onUpdateSelected: (updates: Partial<PlaygroundItem>) => void;
  onTheme: (theme: PlaygroundBoard['theme']) => void;
  onTemplate: (template: PlaygroundTemplateId) => void;
  onRotate: (amount: number) => void;
}) {
  const selectedLabel = selected ? kindLabels[selected.kind] : 'Nothing selected';
  return (
    <div className="pg-workspace">
      <section className="pg-board-panel" aria-labelledby="pg-board-heading">
        <div className="pg-board-toolbar">
          <div className="pg-board-title-wrap">
            <span className="pg-board-icon"><StickyNote size={17} /></span>
            <div className="pg-board-title-copy">
              <label htmlFor="pg-board-title">Board title</label>
              <input id="pg-board-title" value={board.title} maxLength={80} onChange={(event) => onBoardTitle(event.target.value)} />
            </div>
          </div>
          <span className="pg-selected-pill" aria-live="polite">{selectedLabel}</span>
        </div>
        <PlaygroundCanvas
          board={board}
          selectedId={selectedId}
          stageRef={stageRef}
          onSelect={onSelect}
          onStartDrag={onStartDrag}
          onDrag={onDrag}
          onEndDrag={onEndDrag}
          onRemove={onRemove}
          onToggleCheck={onToggleCheck}
          onMoveWithKeyboard={onMoveWithKeyboard}
        />
      </section>
      <PlaygroundTools
        board={board}
        selected={selected}
        onAdd={onAdd}
        onUpdateSelected={onUpdateSelected}
        onTheme={onTheme}
        onTemplate={onTemplate}
        onRotate={onRotate}
        onRemove={() => selected && onRemove(selected.id)}
      />
    </div>
  );
}

export default function PlaygroundPage() {
  const mobile = useIsMobile();
  const { appearance, attributes } = useMobileAppearance();
  const reducedMotion = useReducedMotion();
  const noMotion = reducedMotion || !appearance.animations;
  const [board, setBoard] = useState<PlaygroundBoard>(getInitialBoard);
  const [selectedId, setSelectedId] = useState<string | null>(() => board.items[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);

  const selected = board.items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    setSaveState('saving');
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(board));
        setSaveState('saved');
      } catch {
        setSaveState('unavailable');
      }
    }, 220);
    return () => {
      window.clearTimeout(timeout);
      // Flush the latest committed canvas if a user leaves before the debounce.
      try { localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(board)); } catch { /* The status already reports unavailable storage. */ }
    };
  }, [board]);

  const updateBoard = useCallback((updater: (current: PlaygroundBoard) => PlaygroundBoard) => {
    setBoard((current) => updater(current));
  }, []);

  const selectPiece = (id: string) => setSelectedId(id);

  const addPiece = (kind: PlaygroundItemKind) => {
    if (board.items.length >= PLAYGROUND_MAX_ITEMS) {
      toast.info('This canvas is full. Remove a piece to make room.');
      return;
    }
    const item = createCanvasItem(kind, board.items.length);
    updateBoard((current) => ({ ...current, items: [...current.items, item] }));
    setSelectedId(item.id);
  };

  const updateSelected = (updates: Partial<PlaygroundItem>) => {
    if (!selectedId) return;
    updateBoard((current) => ({
      ...current,
      items: current.items.map((item) => item.id === selectedId ? { ...item, ...updates } : item),
    }));
  };

  const removePiece = (id: string) => {
    updateBoard((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    setSelectedId((current) => current === id ? null : current);
  };

  const toggleCheck = (id: string, index: number) => {
    updateBoard((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id || item.kind !== 'checklist') return item;
        const checked = [...(item.checked ?? [])];
        checked[index] = !checked[index];
        return { ...item, checked };
      }),
    }));
  };

  const startDrag = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    const item = board.items.find((piece) => piece.id === id);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0 || !item) return;
    dragRef.current = {
      id,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: item.x,
      startY: item.y,
      width: bounds.width,
      height: bounds.height,
    };
  };

  const dragPiece = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragRef.current;
    if (!session) return;
    const nextX = Math.max(20, Math.min(80, session.startX + ((event.clientX - session.clientX) / session.width) * 100));
    const nextY = Math.max(20, Math.min(80, session.startY + ((event.clientY - session.clientY) / session.height) * 100));
    updateBoard((current) => ({
      ...current,
      items: current.items.map((item) => item.id === session.id ? { ...item, x: nextX, y: nextY } : item),
    }));
  };

  const endDrag = () => { dragRef.current = null; };

  const moveWithKeyboard = (id: string, key: string, largeStep: boolean) => {
    const step = largeStep ? 4 : 1;
    const delta = key === 'ArrowLeft' ? [-step, 0]
      : key === 'ArrowRight' ? [step, 0]
        : key === 'ArrowUp' ? [0, -step]
          : key === 'ArrowDown' ? [0, step] : [0, 0];
    updateBoard((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? {
        ...item,
        x: Math.max(20, Math.min(80, item.x + delta[0])),
        y: Math.max(20, Math.min(80, item.y + delta[1])),
      } : item),
    }));
  };

  const rotateSelected = (amount: number) => {
    if (!selected) return;
    updateSelected({ rotation: Math.max(-12, Math.min(12, selected.rotation + amount)) });
  };

  const selectTemplate = (template: PlaygroundTemplateId) => {
    if (!window.confirm('Replace this canvas with the selected starter layout? Your current canvas is saved on this device, but its pieces will be replaced.')) return;
    const next = createStarterBoard(template);
    setBoard(next);
    setSelectedId(next.items[0]?.id ?? null);
    toast.success('A fresh little layout is ready to remix.');
  };

  const resetBoard = () => {
    if (!window.confirm('Start over with the original idea garden? This replaces the current canvas on this device.')) return;
    const next = createStarterBoard();
    setBoard(next);
    setSelectedId(next.items[0]?.id ?? null);
    toast.success('Your idea garden is fresh again.');
  };

  const content = (
    <div className={`pg-page${mobile ? ' pg-page-mobile' : ''}${noMotion ? ' pg-motion-off' : ''}`}>
      <motion.header
        className="pg-page-heading"
        initial={noMotion ? false : { opacity: 0, y: 9 }}
        animate={{ opacity: 1, y: 0 }}
        transition={noMotion ? { duration: 0 } : { duration: 0.26 }}
      >
        <div className="pg-heading-copy">
          <div className="pg-eyebrow"><Sparkles size={14} /> NIKNOTE MAKER'S CORNER</div>
          <h1 id="pg-board-heading">Playground <span>for your ideas</span></h1>
          <p>Move a thought around. Add a little colour. See what grows.</p>
        </div>
        <div className="pg-heading-actions">
          <span className={`pg-save-status is-${saveState}`} role="status" aria-live="polite">
            <span className="pg-save-dot" />
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved on this device' : 'Local save unavailable'}
          </span>
          <button type="button" className="pg-export-button" onClick={() => downloadBoard(board)}>
            <ArrowDownToLine size={16} /> <span>Export SVG</span>
          </button>
          <button type="button" className="pg-reset-button" onClick={resetBoard} aria-label="Reset canvas" title="Start a fresh idea garden">
            <RotateCcw size={16} />
          </button>
        </div>
      </motion.header>

      <PlaygroundWorkspace
        board={board}
        selected={selected}
        selectedId={selectedId}
        stageRef={stageRef}
        onBoardTitle={(title) => updateBoard((current) => ({ ...current, title }))}
        onSelect={selectPiece}
        onStartDrag={startDrag}
        onDrag={dragPiece}
        onEndDrag={endDrag}
        onRemove={removePiece}
        onToggleCheck={toggleCheck}
        onMoveWithKeyboard={moveWithKeyboard}
        onAdd={addPiece}
        onUpdateSelected={updateSelected}
        onTheme={(theme) => updateBoard((current) => ({ ...current, theme }))}
        onTemplate={selectTemplate}
        onRotate={rotateSelected}
      />
      <p className="pg-privacy-note"><Check size={14} /> Your canvas stays in this browser. Nothing here is sent to your NikNote account or a server.</p>
    </div>
  );

  if (mobile) {
    return (
      <div className="nn-mobile pg-mobile-shell" {...attributes}>
        <header className="pg-mobile-header">
          <Link to="/home" className="pg-back-link" aria-label="Back to Notes"><ChevronLeft size={20} /></Link>
          <div className="pg-mobile-brand">
            <img src="/images/brand/niknote-primary-mark.png" alt="" aria-hidden="true" />
            <span>PLAYGROUND</span>
          </div>
          <button type="button" className="pg-mobile-export" onClick={() => downloadBoard(board)} aria-label="Export canvas as SVG" title="Export SVG">
            <Download size={17} />
          </button>
        </header>
        {content}
        <MobileNavigation active="" />
      </div>
    );
  }

  return <DesktopShell>{content}</DesktopShell>;
}
