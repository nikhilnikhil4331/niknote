import React from 'react';

/**
 * Renders the `**bold**` subset of markdown that the AI panels use — as React
 * elements, never as HTML.
 *
 * Security note (audit F-01): these panels previously rewrote the `**bold**`
 * delimiters into a `<strong>` HTML string and pushed the result through
 * `dangerouslySetInnerHTML`. That turned any `<`, `>` or attribute syntax
 * coming out of the model (or injected into a document the model rewrites)
 * into live markup. Splitting on the delimiter and letting React escape each
 * text segment removes the sink entirely — no sanitizer needed.
 */
export function renderBoldSegments(text: string, keyPrefix = 'b'): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part.length > 0)
    .map((part, index) => {
      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
      }
      return <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>;
    });
}
