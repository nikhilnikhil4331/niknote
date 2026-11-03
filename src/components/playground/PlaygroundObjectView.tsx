import React, { useEffect, useRef } from 'react';
import { Check, Plus, RotateCw } from 'lucide-react';
import type { PlaygroundObject, PlaygroundTodo } from '@/lib/playground';
import { PlaygroundChart } from './PlaygroundChart';

interface Props {
  object: PlaygroundObject;
  selected: boolean;
  editing: boolean;
  layer: number;
  onPatch: (id: string, patch: Partial<PlaygroundObject>, record?: boolean) => void;
  onBeginTransaction: () => void;
  onEdit: (id: string | null) => void;
  onPortDown: (event: React.PointerEvent, id: string, side: 'input' | 'output') => void;
  onHandleDown: (event: React.PointerEvent, id: string, mode: 'resize' | 'rotate', corner?: string) => void;
}

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

export const PlaygroundObjectView = React.memo(function PlaygroundObjectView({
  object: objectValue,
  selected,
  editing,
  layer,
  onPatch,
  onBeginTransaction,
  onEdit,
  onPortDown,
  onHandleDown,
}: Props) {
  const object = objectValue;
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing || !editRef.current) return;
    editRef.current.focus();
    const length = editRef.current.value.length;
    editRef.current.setSelectionRange(length, length);
  }, [editing]);

  const sharedStyle: React.CSSProperties = {
    color: object.color,
    fontSize: object.fontSize,
    fontFamily: object.fontFamily,
    fontWeight: object.fontWeight,
    fontStyle: object.fontStyle,
    textDecoration: object.textDecoration,
    textAlign: object.align,
  };

  const patchTodos = (items: PlaygroundTodo[]) => onPatch(object.id, { items }, false);

  return (
    <div
      className={`pg-object pg-object-${object.kind}${selected ? ' is-selected' : ''}${object.locked ? ' is-locked' : ''}${editing ? ' is-editing' : ''}`}
      data-object-id={object.id}
      style={{
        left: object.x,
        top: object.y,
        width: object.width,
        height: object.height,
        transform: `rotate(${object.rotation}deg)`,
        zIndex: selected ? 10000 + layer : layer + 1,
        opacity: object.opacity ?? 1,
        background: object.kind !== 'shape' && object.kind !== 'drawing' ? object.background : undefined,
        borderRadius: object.radius,
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (!object.locked && !['image', 'shape', 'drawing', 'divider', 'todo', 'table'].includes(object.kind)) onEdit(object.id);
      }}
    >
      {(object.kind === 'text' || object.kind === 'heading' || object.kind === 'sticky' || object.kind === 'code') && (
        editing ? (
          <textarea
            ref={editRef}
            className="pg-text-editor"
            value={object.text || ''}
            aria-label={`Edit ${object.kind}`}
            style={sharedStyle}
            onChange={(event) => {
              const height = Math.max(object.height, event.target.scrollHeight + 16);
              onPatch(object.id, { text: event.target.value, ...(height > object.height ? { height } : {}) }, false);
            }}
            onBlur={() => onEdit(null)}
            onPointerDown={stop}
            onKeyDown={(event) => {
              if (event.key === 'Escape') { event.preventDefault(); onEdit(null); }
              event.stopPropagation();
            }}
          />
        ) : (
          <div className="pg-text-content" style={sharedStyle}>{object.text || <span className="pg-placeholder">Double-click to write</span>}</div>
        )
      )}

      {object.kind === 'node' && (
        <>
          <div className="pg-node-accent" />
          <div className="pg-node-body">
            <span className="pg-node-category">{object.nodeCategory || 'Processing'}</span>
            {editing ? (
              <div onPointerDown={stop}>
                <input className="pg-node-title-input" value={object.text || ''} onChange={(e) => onPatch(object.id, { text: e.target.value }, false)} onBlur={() => onEdit(null)} aria-label="Node label" autoFocus />
                <input className="pg-node-subtitle-input" value={object.subtitle || ''} onChange={(e) => onPatch(object.id, { subtitle: e.target.value }, false)} onBlur={() => onEdit(null)} aria-label="Node description" />
              </div>
            ) : (
              <>
                <strong>{object.text || 'Untitled node'}</strong>
                <span>{object.subtitle || 'Visual node · not executed'}</span>
              </>
            )}
          </div>
          <span className="pg-visual-badge">Visual only</span>
          <button className="pg-port pg-port-input" data-port="input" aria-label={`Connect into ${object.text}`} onPointerDown={(event) => onPortDown(event, object.id, 'input')} />
          <button className="pg-port pg-port-output" data-port="output" aria-label={`Connect from ${object.text}`} onPointerDown={(event) => onPortDown(event, object.id, 'output')} />
        </>
      )}

      {object.kind === 'todo' && (
        <div className="pg-todo-wrap" onFocusCapture={onBeginTransaction}>
          <input className="pg-todo-title" value={object.text || ''} onChange={(e) => onPatch(object.id, { text: e.target.value }, false)} onPointerDown={stop} aria-label="Checklist title" />
          <div className="pg-todo-list">
            {(object.items || []).map((item) => (
              <div className="pg-todo-item" key={item.id}>
                <button
                  className={item.done ? 'is-done' : ''}
                  aria-label={item.done ? `Mark ${item.text} incomplete` : `Mark ${item.text} complete`}
                  onPointerDown={stop}
                  onClick={() => patchTodos((object.items || []).map((candidate) => candidate.id === item.id ? { ...candidate, done: !candidate.done } : candidate))}
                >{item.done && <Check size={11} />}</button>
                <input
                  value={item.text}
                  className={item.done ? 'is-done' : ''}
                  onPointerDown={stop}
                  aria-label="Checklist item"
                  onChange={(e) => patchTodos((object.items || []).map((candidate) => candidate.id === item.id ? { ...candidate, text: e.target.value } : candidate))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      patchTodos([...(object.items || []), { id: `${item.id}-next-${Date.now()}`, text: '', done: false }]);
                    }
                  }}
                />
              </div>
            ))}
          </div>
          <button className="pg-todo-add" onPointerDown={stop} onClick={() => patchTodos([...(object.items || []), { id: `task-${Date.now()}`, text: 'New task', done: false }])}><Plus size={12} /> Add task</button>
        </div>
      )}

      {object.kind === 'table' && (
        <div className="pg-table-wrap" onFocusCapture={onBeginTransaction}>
          <input className="pg-table-title" value={object.text || ''} onChange={(e) => onPatch(object.id, { text: e.target.value }, false)} onPointerDown={stop} aria-label="Table title" />
          <div className="pg-table-scroll" onPointerDown={stop}>
            <table>
              <tbody>
                {(object.rows || []).map((row, rowIndex) => (
                  <tr key={rowIndex}>{row.map((cell, columnIndex) => (
                    <td key={columnIndex}><input
                      value={cell}
                      aria-label={`Row ${rowIndex + 1} column ${columnIndex + 1}`}
                      onChange={(e) => onPatch(object.id, {
                        rows: (object.rows || []).map((line, r) => r === rowIndex ? line.map((value, c) => c === columnIndex ? e.target.value : value) : line),
                      }, false)}
                    /></td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pg-table-actions" onPointerDown={stop}>
            <button onClick={() => onPatch(object.id, { rows: [...(object.rows || []), Array.from({ length: object.rows?.[0]?.length || 3 }, () => '')] })}>+ Row</button>
            <button onClick={() => onPatch(object.id, { rows: (object.rows || []).map((row) => [...row, '']) })}>+ Column</button>
          </div>
        </div>
      )}

      {object.kind === 'chart' && <PlaygroundChart object={object} selected={selected} editing={editing} onPatch={onPatch} onEdit={onEdit} />}
      {object.kind === 'shape' && <Shape object={object} />}
      {object.kind === 'drawing' && <Drawing object={object} />}
      {object.kind === 'image' && (
        object.src ? <img src={object.src} alt={object.alt || 'Canvas upload'} draggable={false} /> : <div className="pg-image-empty">Image unavailable</div>
      )}
      {object.kind === 'link' && (
        editing ? (
          <div className="pg-link-editor" onPointerDown={stop}>
            <input value={object.text || ''} onChange={(e) => onPatch(object.id, { text: e.target.value }, false)} aria-label="Link title" autoFocus />
            <input value={object.href || ''} onChange={(e) => onPatch(object.id, { href: e.target.value }, false)} onBlur={() => onEdit(null)} aria-label="Link URL" placeholder="https://…" />
          </div>
        ) : (
          <a href={object.href} target={object.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onPointerDown={stop}>
            <LinkIcon />
            <strong>{object.text || 'Open link'}</strong>
            <span>{object.href}</span>
          </a>
        )
      )}
      {object.kind === 'divider' && <div className="pg-divider-line" />}

      {selected && !editing && !object.locked && (
        <>
          {['nw', 'ne', 'sw', 'se'].map((corner) => (
            <button
              key={corner}
              className={`pg-resize pg-resize-${corner}`}
              aria-label={`Resize from ${corner}`}
              onPointerDown={(event) => onHandleDown(event, object.id, 'resize', corner)}
            />
          ))}
          <button className="pg-rotate" aria-label="Rotate object" onPointerDown={(event) => onHandleDown(event, object.id, 'rotate')}><RotateCw size={11} /></button>
        </>
      )}
    </div>
  );
});

function Shape({ object }: { object: PlaygroundObject }) {
  const fill = object.background || '#EEE7F5';
  const stroke = object.borderColor || '#8020A2';
  const width = object.strokeWidth || 2;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${object.shape} shape`}>
      {object.shape === 'circle' && <ellipse cx="50" cy="50" rx="48" ry="48" fill={fill} stroke={stroke} strokeWidth={width} vectorEffect="non-scaling-stroke" />}
      {object.shape === 'triangle' && <polygon points="50,3 97,97 3,97" fill={fill} stroke={stroke} strokeWidth={width} vectorEffect="non-scaling-stroke" />}
      {object.shape === 'arrow' && <path d="M4 42 H65 V20 L97 50 L65 80 V58 H4 Z" fill={fill} stroke={stroke} strokeWidth={width} vectorEffect="non-scaling-stroke" />}
      {(!object.shape || object.shape === 'rectangle') && <rect x="2" y="2" width="96" height="96" rx={object.radius || 4} fill={fill} stroke={stroke} strokeWidth={width} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

function Drawing({ object }: { object: PlaygroundObject }) {
  const points = object.points || [];
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  return (
    <svg className="pg-drawing" viewBox={`0 0 ${Math.max(1, object.width)} ${Math.max(1, object.height)}`} preserveAspectRatio="none" aria-label="Freehand drawing">
      <path d={path} fill="none" stroke={object.color || '#8020A2'} strokeWidth={object.strokeWidth || 3} strokeLinecap="round" strokeLinejoin="round" opacity={object.opacity ?? 1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function LinkIcon() {
  return <span className="pg-link-icon" aria-hidden>↗</span>;
}
