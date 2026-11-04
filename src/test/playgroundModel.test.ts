import { describe, expect, it } from 'vitest';
import {
  createPlaygroundSvg,
  createStarterBoard,
  escapeSvgText,
  parsePlaygroundBoard,
  PLAYGROUND_MAX_ITEMS,
} from '@/lib/playground';

describe('creative playground board model', () => {
  it('provides distinct, usable starter layouts', () => {
    const garden = createStarterBoard('idea-garden');
    const revision = createStarterBoard('revision-map');

    expect(garden.items).toHaveLength(4);
    expect(garden.items.some((item) => item.kind === 'checklist')).toBe(true);
    expect(garden.theme).toBe('paper');
    expect(revision.theme).toBe('night');
    expect(revision.items.map((item) => item.id)).not.toEqual(garden.items.map((item) => item.id));
  });

  it('rejects malformed storage and safely clamps untrusted values', () => {
    expect(parsePlaygroundBoard('{bad json')).toBeNull();
    expect(parsePlaygroundBoard(null)).toBeNull();

    const board = parsePlaygroundBoard(JSON.stringify({
      title: 'x'.repeat(100),
      theme: 'not-a-theme',
      items: [
        { id: 'saved-note', kind: 'note', x: 120, y: -2, rotation: 90, scale: 9, color: 'unsafe', text: 'y'.repeat(600) },
        { id: 'unknown', kind: 'script', x: 50, y: 50, text: '<script>' },
      ],
    }));

    expect(board).not.toBeNull();
    expect(board?.title).toHaveLength(80);
    expect(board?.theme).toBe('paper');
    expect(board?.items).toHaveLength(1);
    expect(board?.items[0]).toMatchObject({ x: 80, y: 20, rotation: 12, scale: 1.3, color: 'paper' });
    expect(board?.items[0].text).toHaveLength(500);
  });

  it('repairs duplicate saved ids so canvas keys remain unique', () => {
    const item = createStarterBoard().items[0];
    const board = parsePlaygroundBoard(JSON.stringify({
      title: 'Duplicate ids',
      theme: 'paper',
      items: [{ ...item, id: 'same-id' }, { ...item, id: 'same-id' }],
    }));

    expect(board?.items).toHaveLength(2);
    const ids = board?.items.map((piece) => piece.id) ?? [];
    expect(new Set(ids).size).toBe(2);
  });

  it('caps the number of stored canvas pieces', () => {
    const items = createStarterBoard().items;
    const board = parsePlaygroundBoard(JSON.stringify({
      title: 'Many pieces',
      theme: 'paper',
      items: Array.from({ length: PLAYGROUND_MAX_ITEMS + 5 }, (_, index) => ({
        ...items[0], id: `piece-${index}`,
      })),
    }));
    expect(board?.items).toHaveLength(PLAYGROUND_MAX_ITEMS);
  });

  it('escapes user text before putting it in SVG markup', () => {
    expect(escapeSvgText(`<note & "star">it's`)).toBe('&lt;note &amp; &quot;star&quot;&gt;it&apos;s');
    const board = createStarterBoard();
    board.title = '<Board & idea>';
    board.items[0].text = '<tag> & more';
    const svg = createPlaygroundSvg(board);
    expect(svg).toContain('&lt;BOARD &amp; IDEA&gt;');
    expect(svg).toContain('&lt;tag&gt; &amp; more');
    expect(svg).not.toContain('<tag>');
  });
});
