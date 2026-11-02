import React from 'react';
import { ArrowLeft, Check, FileText, NotebookPen } from 'lucide-react';
import { playgroundReadingOrder, type PlaygroundDocument, type PlaygroundObject } from '@/lib/playground';

interface Props {
  doc: PlaygroundDocument;
  onBack: () => void;
  onOpenNotes: () => void;
}

/** Read-only, live view of this canvas. Editing stays in the existing Notes Taking app. */
export function PlaygroundNotesPreview({ doc, onBack, onOpenNotes }: Props) {
  const objects = playgroundReadingOrder(doc.objects);
  const readable = objects.filter((object) => !['shape', 'drawing'].includes(object.kind));
  const visualOnlyCount = objects.length - readable.length;

  return (
    <section className="pg-notes-preview" aria-label="Canvas notes preview">
      <header className="pg-notes-preview-toolbar">
        <div>
          <FileText size={17} />
          <span><strong>Notes Preview</strong><small>Live from this canvas</small></span>
        </div>
        <div>
          <button onClick={onBack}><ArrowLeft size={14} /> Back to canvas</button>
          <button className="pg-notes-edit-button" onClick={onOpenNotes}><NotebookPen size={14} /> Edit in Notes Taking</button>
        </div>
      </header>
      <div className="pg-notes-preview-scroll">
        <article className="pg-notes-preview-sheet">
          <span className="pg-notes-preview-eyebrow">NIKNOTE · CANVAS NOTES</span>
          <h1>{doc.title || 'Untitled playground'}</h1>
          <p className="pg-notes-preview-meta">{readable.length} note section{readable.length === 1 ? '' : 's'} · synced with the current canvas</p>
          {!readable.length && (
            <div className="pg-notes-preview-empty">
              <FileText size={28} />
              <h2>No written notes yet</h2>
              <p>Return to the canvas and add text, a checklist, table or note link.</p>
            </div>
          )}
          {readable.map((object) => <PreviewSection key={object.id} object={object} />)}
          {visualOnlyCount > 0 && <p className="pg-notes-preview-footnote">{visualOnlyCount} drawing/shape object{visualOnlyCount === 1 ? ' remains' : 's remain'} editable on the canvas.</p>}
        </article>
      </div>
    </section>
  );
}

function PreviewSection({ object }: { object: PlaygroundObject }) {
  if (object.kind === 'divider') return <hr className="pg-note-divider" />;
  if (object.kind === 'image') {
    return object.src ? <figure className="pg-note-image"><img src={object.src} alt={object.alt || 'Canvas upload'} /><figcaption>{object.alt || 'Canvas image'}</figcaption></figure> : null;
  }
  if (object.kind === 'todo') {
    return (
      <section className="pg-note-section" data-note-kind="todo">
        <span className="pg-note-kind">Checklist</span>
        <h2>{object.text || 'Checklist'}</h2>
        <ul className="pg-note-checklist">
          {(object.items || []).map((item) => <li key={item.id} className={item.done ? 'is-done' : ''}><span>{item.done && <Check size={12} />}</span>{item.text}</li>)}
        </ul>
      </section>
    );
  }
  if (object.kind === 'table') {
    return (
      <section className="pg-note-section" data-note-kind="table">
        <span className="pg-note-kind">Table</span>
        <h2>{object.text || 'Table'}</h2>
        <div className="pg-note-table-scroll"><table><tbody>
          {(object.rows || []).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={columnIndex}>{cell}</td>)}</tr>)}
        </tbody></table></div>
      </section>
    );
  }
  if (object.kind === 'code') {
    return <section className="pg-note-section"><span className="pg-note-kind">Code</span><pre className="pg-note-code"><code>{object.text}</code></pre></section>;
  }
  if (object.kind === 'link') {
    return (
      <section className="pg-note-section pg-note-link">
        <span className="pg-note-kind">Note / link</span>
        <a href={object.href} target={object.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
          <strong>{object.text || 'Open link'}</strong><span>{object.href}</span>
        </a>
      </section>
    );
  }
  if (object.kind === 'node') {
    return <section className="pg-note-section"><span className="pg-note-kind">{object.nodeCategory || 'Visual node'} · visual only</span><h2>{object.text || 'Untitled node'}</h2><p>{object.subtitle}</p></section>;
  }
  if (object.kind === 'heading') return <section className="pg-note-section"><h2 className="pg-note-heading">{object.text}</h2></section>;
  return <section className={`pg-note-section${object.kind === 'sticky' ? ' pg-note-sticky' : ''}`}><p className="pg-note-paragraph">{object.text}</p></section>;
}
