import React, { useState } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it, vi } from 'vitest';
import { NotionEditor } from '@/components/editor/NotionEditor';
import { useBlockEditor } from '@/hooks/useBlockEditor';
import { createBlock } from '@/types/block';
import type { LineInkColor } from '@/types/noteLine';

const workspaceStyles = postcss.parse(
  readFileSync(resolve(process.cwd(), 'src/styles/direct-writing-workspace.css'), 'utf8'),
);
const mobileStyles = postcss.parse(
  readFileSync(resolve(process.cwd(), 'src/components/mobile/mobile.css'), 'utf8'),
);

describe('editor ink colors', () => {
  it('recomputes preview lines when the inherited pen color changes', () => {
    const { result } = renderHook(() => useBlockEditor());

    expect(result.current.lines[0]?.color).toBe('black');
    act(() => result.current.setCurrentColor('purple'));

    expect(result.current.lines[0]?.color).toBe('purple');
    expect(result.current.blocks[0]).not.toHaveProperty('color');
  });

  it('records block ink changes in undo history', () => {
    const block = createBlock('text', 'Undo this ink change');
    const { result } = renderHook(() => useBlockEditor());

    act(() => result.current.setBlocks([block]));
    act(() => result.current.updateBlock(block.id, { color: 'green' }));

    expect(result.current.blocks[0]?.color).toBe('green');
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.blocks[0]?.color).toBeUndefined();
  });

  it('lets a text block choose ink and applies that color to the editor input', () => {
    const onColorChange = vi.fn();

    function ColorEditor() {
      const [blocks, setBlocks] = useState(() => {
        const block = createBlock('text', 'Ink should change');
        block.color = 'black';
        return [block];
      });
      const [currentColor, setCurrentColor] = useState<LineInkColor>('black');

      return (
        <NotionEditor
          blocks={blocks}
          onBlocksChange={setBlocks}
          currentColor={currentColor}
          onColorChange={(color) => {
            setCurrentColor(color);
            onColorChange(color);
          }}
        />
      );
    }

    render(<ColorEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Change block ink' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set block ink to Blue' }));

    const textarea = screen.getByDisplayValue('Ink should change') as HTMLTextAreaElement;
    expect(textarea.style.color).toMatch(/rgb\(21,\s*101,\s*192\)/i);
    expect(onColorChange).toHaveBeenCalledWith('blue');
  });

  it('keeps per-block ink controls visible and tappable in the mobile editor', async () => {
    const previousInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });

    try {
      const block = createBlock('text', 'Mobile ink');
      block.color = 'black';
      const onColorChange = vi.fn();
      render(
        <NotionEditor
          blocks={[block]}
          onBlocksChange={vi.fn()}
          onColorChange={onColorChange}
        />,
      );

      const colorControl = screen.getByRole('button', { name: 'Change block ink' });
      await waitFor(() => {
        expect(colorControl).toHaveClass('inline-flex', 'h-11', 'w-11');
        expect(colorControl.parentElement).toHaveClass('opacity-100');
      });
      fireEvent.click(colorControl);
      const blueSwatch = screen.getByRole('button', { name: 'Set block ink to Blue' });
      expect(blueSwatch).toBeVisible();
      expect(blueSwatch).toHaveClass('h-11', 'w-11');
      fireEvent.click(blueSwatch);
      expect(onColorChange).toHaveBeenCalledWith('blue');

      const hiddenMobileInkControls: string[] = [];
      mobileStyles.walkRules((rule) => {
        const targetsMobileEditorInk = rule.selector.split(',').some((selector) =>
          selector.includes('.nn-editor-canvas') && selector.includes('.nn-block-color'),
        );
        if (targetsMobileEditorInk) {
          rule.walkDecls('display', (declaration) => {
            if (declaration.value === 'none') hiddenMobileInkControls.push(rule.selector);
          });
        }
      });
      expect(hiddenMobileInkControls).toEqual([]);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousInnerWidth });
    }
  });

  it('keeps text ink controls visible and does not override chosen ink in light or dark editor styles', () => {
    const hiddenTextInkControls: string[] = [];
    const forcedTextInkColors: string[] = [];

    workspaceStyles.walkRules((rule) => {
      const selectors = rule.selector.split(',').map((selector) => selector.trim());
      const targetsTextInkControl = selectors.some((selector) =>
        selector.includes('.nn-direct-editor') &&
        selector.includes('[data-block-type="text"]') &&
        selector.includes('.nn-block-color'),
      );
      if (targetsTextInkControl) {
        rule.walkDecls('display', (declaration) => {
          if (declaration.value === 'none') hiddenTextInkControls.push(rule.selector);
        });
      }

      const targetsTextInput = selectors.some((selector) =>
        selector.includes('.nn-direct-editor') &&
        selector.includes('textarea') &&
        !selector.includes('::placeholder'),
      );
      if (targetsTextInput) {
        rule.walkDecls('color', (declaration) => {
          if (declaration.important) forcedTextInkColors.push(rule.selector);
        });
      }
    });

    expect(hiddenTextInkControls).toEqual([]);
    expect(forcedTextInkColors).toEqual([]);
  });
});
