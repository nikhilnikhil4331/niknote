import React, { useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine,
  Bold, CheckSquare, Copy, Download, FileText, Group, Italic, Link2, Lock, MoreHorizontal,
  Redo2, RotateCcw, RotateCw, Trash2, Underline, Unlock, Ungroup,
} from 'lucide-react';
import type { PlaygroundEdge, PlaygroundObject } from '@/lib/playground';

interface Props {
  objects: PlaygroundObject[];
  edge?: PlaygroundEdge | null;
  onPatch: (id: string, patch: Partial<PlaygroundObject>) => void;
  onPatchEdge: (id: string, patch: Partial<PlaygroundEdge>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeleteEdge: () => void;
  onLock: () => void;
  onLayer: (direction: 'front' | 'back') => void;
  onGroup: () => void;
  onRotate: (delta: number) => void;
  onReplaceImage: () => void;
  onOpenDocument: () => void;
}

export function ContextToolbar(props: Props) {
  const [more, setMore] = useState(false);
  const object = props.objects.length === 1 ? props.objects[0] : null;
  const multiple = props.objects.length > 1;

  if (props.edge) {
    const edge = props.edge;
    return (
      <div className="pg-context-toolbar" role="toolbar" aria-label="Connection settings" onPointerDown={(e) => e.stopPropagation()}>
        <label className="pg-toolbar-label">Label<input value={edge.label || ''} onChange={(e) => props.onPatchEdge(edge.id, { label: e.target.value })} placeholder="Add label" /></label>
        <button className={edge.style === 'dashed' ? 'is-active' : ''} onClick={() => props.onPatchEdge(edge.id, { style: edge.style === 'dashed' ? 'solid' : 'dashed' })} title="Toggle dashed line">╌</button>
        <label className="pg-icon-label" title="Connection color"><span className="pg-color-dot" style={{ background: edge.color || '#A02AA4' }} /><input type="color" value={edge.color || '#A02AA4'} onChange={(e) => props.onPatchEdge(edge.id, { color: e.target.value })} /></label>
        <label className="pg-toolbar-label">Width<input type="number" min="1" max="8" value={edge.width || 2} onChange={(e) => props.onPatchEdge(edge.id, { width: Math.max(1, Math.min(8, Number(e.target.value))) })} /></label>
        <button onClick={() => props.onPatchEdge(edge.id, { arrow: edge.arrow === 'both' ? 'end' : edge.arrow === 'none' ? 'end' : 'none' })} title="Toggle arrow direction"><Link2 size={14} /></button>
        <button className="is-danger" onClick={props.onDeleteEdge} title="Delete connection"><Trash2 size={14} /></button>
      </div>
    );
  }

  if (!props.objects.length) return null;
  const textLike = object && ['text', 'heading', 'sticky', 'code', 'node'].includes(object.kind);
  const shape = object?.kind === 'shape';
  const image = object?.kind === 'image';
  const locked = props.objects.every((item) => item.locked);

  return (
    <div className="pg-context-toolbar" role="toolbar" aria-label="Selected object settings" onPointerDown={(e) => e.stopPropagation()}>
      {textLike && object && (
        <>
          <select value={object.fontFamily || 'Inter, sans-serif'} onChange={(e) => props.onPatch(object.id, { fontFamily: e.target.value })} aria-label="Font family">
            <option value="Inter, sans-serif">Inter</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="monospace">Mono</option>
          </select>
          <input className="pg-font-size" type="number" min="8" max="96" value={object.fontSize || 16} onChange={(e) => props.onPatch(object.id, { fontSize: Math.max(8, Math.min(96, Number(e.target.value))) })} aria-label="Font size" />
          <span className="pg-toolbar-separator" />
          <button className={(object.fontWeight || 400) >= 700 ? 'is-active' : ''} onClick={() => props.onPatch(object.id, { fontWeight: (object.fontWeight || 400) >= 700 ? 450 : 750 })} title="Bold"><Bold size={14} /></button>
          <button className={object.fontStyle === 'italic' ? 'is-active' : ''} onClick={() => props.onPatch(object.id, { fontStyle: object.fontStyle === 'italic' ? 'normal' : 'italic' })} title="Italic"><Italic size={14} /></button>
          <button className={object.textDecoration === 'underline' ? 'is-active' : ''} onClick={() => props.onPatch(object.id, { textDecoration: object.textDecoration === 'underline' ? 'none' : 'underline' })} title="Underline"><Underline size={14} /></button>
          <button className={object.align === 'left' || !object.align ? 'is-active' : ''} onClick={() => props.onPatch(object.id, { align: 'left' })} title="Align left"><AlignLeft size={14} /></button>
          <button className={object.align === 'center' ? 'is-active' : ''} onClick={() => props.onPatch(object.id, { align: 'center' })} title="Align center"><AlignCenter size={14} /></button>
          <button className={object.align === 'right' ? 'is-active' : ''} onClick={() => props.onPatch(object.id, { align: 'right' })} title="Align right"><AlignRight size={14} /></button>
        </>
      )}
      {(textLike || shape) && object && (
        <label className="pg-icon-label" title={shape ? 'Fill color' : 'Text color'}><span className="pg-color-dot" style={{ background: (shape ? object.background : object.color) || (shape ? '#EEE7F5' : '#8020A2') }} /><input type="color" value={(shape ? object.background : object.color) || (shape ? '#EEE7F5' : '#8020A2')} onChange={(e) => props.onPatch(object.id, shape ? { background: e.target.value } : { color: e.target.value })} /></label>
      )}
      {shape && object && (
        <>
          <label className="pg-icon-label" title="Border color"><span className="pg-border-dot" style={{ borderColor: object.borderColor || '#8020A2' }} /><input type="color" value={object.borderColor || '#8020A2'} onChange={(e) => props.onPatch(object.id, { borderColor: e.target.value })} /></label>
          <label className="pg-opacity-control" title="Opacity"><span>O</span><input type="range" min="0.15" max="1" step="0.05" value={object.opacity ?? 1} onChange={(e) => props.onPatch(object.id, { opacity: Number(e.target.value) })} /></label>
        </>
      )}
      {image && object?.src && (
        <>
          <button onClick={props.onReplaceImage} title="Replace image"><RotateCw size={14} /></button>
          <a href={object.src} download={object.alt || 'niknote-image'} title="Download image"><Download size={14} /></a>
        </>
      )}
      {textLike && <button onClick={props.onOpenDocument} title="Open as a document"><FileText size={14} /></button>}
      {object?.kind === 'sticky' && (
        <button onClick={() => props.onPatch(object.id, {
          kind: 'todo',
          items: [{ id: `task-${Date.now()}`, text: object.text || 'New task', done: false }],
          text: 'Checklist',
        })} title="Convert sticky note to checklist"><CheckSquare size={14} /></button>
      )}
      <span className="pg-toolbar-separator" />
      <button onClick={props.onDuplicate} title="Duplicate (Ctrl D)"><Copy size={14} /></button>
      <button onClick={() => props.onRotate(-15)} title="Rotate left"><RotateCcw size={14} /></button>
      <button onClick={() => props.onRotate(15)} title="Rotate right"><Redo2 size={14} className="hidden" /><RotateCw size={14} /></button>
      <button onClick={props.onLock} title={locked ? 'Unlock' : 'Lock'}>{locked ? <Unlock size={14} /> : <Lock size={14} />}</button>
      <div className="pg-toolbar-more">
        <button onClick={() => setMore((value) => !value)} title="More object actions" aria-expanded={more}><MoreHorizontal size={15} /></button>
        {more && (
          <div className="pg-toolbar-menu">
            <button onClick={() => { props.onLayer('front'); setMore(false); }}><ArrowUpToLine size={13} /> Bring to front</button>
            <button onClick={() => { props.onLayer('back'); setMore(false); }}><ArrowDownToLine size={13} /> Send to back</button>
            {(multiple || object?.groupId) && <button onClick={() => { props.onGroup(); setMore(false); }}>{object?.groupId && !multiple ? <Ungroup size={13} /> : <Group size={13} />}{object?.groupId && !multiple ? 'Ungroup' : multiple ? 'Group selection' : 'Ungroup'}</button>}
            <button className="is-danger" onClick={() => { props.onDelete(); setMore(false); }}><Trash2 size={13} /> Delete</button>
          </div>
        )}
      </div>
      <button className="is-danger pg-toolbar-delete" onClick={props.onDelete} title="Delete selected"><Trash2 size={14} /></button>
    </div>
  );
}
