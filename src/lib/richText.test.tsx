/**
 * Audit F-01 — AI output must never be rendered as HTML.
 *
 * Before this fix the AI panels converted `**bold**` to a string and injected
 * it with dangerouslySetInnerHTML, so markup from model output (or injected
 * into a document the model rewrites) executed in the app origin.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBoldSegments } from './richText';

const XSS_PAYLOADS = [
  '<img src=x onerror="window.__pwned=1">',
  '<script>window.__pwned=1</script>',
  '"><svg onload="window.__pwned=1">',
  "<iframe src='javascript:alert(1)'></iframe>",
  '**<img src=x onerror=alert(1)>**',
];

describe('renderBoldSegments', () => {
  it('renders **bold** as a <strong> element', () => {
    const { container } = render(<p>{renderBoldSegments('hello **world**!')}</p>);
    expect(container.querySelector('strong')?.textContent).toBe('world');
    expect(container.textContent).toBe('hello world!');
  });

  it('handles several bold segments and unmatched delimiters', () => {
    const { container } = render(
      <p>{renderBoldSegments('**a** and **b** and ** left alone')}</p>,
    );
    expect(container.querySelectorAll('strong')).toHaveLength(2);
    expect(container.textContent).toContain('** left alone');
  });

  it.each(XSS_PAYLOADS)('treats %s as inert text', (payload) => {
    const { container } = render(<p>{renderBoldSegments(payload)}</p>);
    expect(container.querySelector('img, script, svg, iframe')).toBeNull();
    expect(container.textContent).toContain(payload.replace(/\*\*/g, ''));
  });

  it('does not create elements for attributes or entities', () => {
    const { container } = render(
      <p>{renderBoldSegments('&lt;b&gt;not bold&lt;/b&gt; **real**')}</p>,
    );
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('strong')?.textContent).toBe('real');
  });
});

describe('AI panels have no HTML sink', () => {
  const panels = [
    'src/components/ai4/AI4Page.tsx',
    'src/components/ai-workspace/AIWorkspacePanel.tsx',
  ];

  it.each(panels)('%s does not use dangerouslySetInnerHTML', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).not.toMatch(/dangerouslySetInnerHTML\s*=\s*\{\{/);
  });
});
