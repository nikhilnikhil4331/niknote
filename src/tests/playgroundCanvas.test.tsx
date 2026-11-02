import React, { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PlaygroundCanvas } from '@/components/playground/PlaygroundCanvas';
import { History } from '@/lib/board';
import {
  clonePlaygroundDocument,
  emptyPlayground,
  createPlaygroundObject,
  type PlaygroundDocument,
} from '@/lib/playground';

beforeAll(() => {
  class MockPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    pressure: number;
    isPrimary: boolean;
    constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string; pressure?: number; isPrimary?: boolean } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType || 'mouse';
      this.pressure = init.pressure ?? 0.5;
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MockPointerEvent });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => false });
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
});

function Harness({ initialDoc }: { initialDoc?: PlaygroundDocument }) {
  const [doc, setDoc] = useState(() => initialDoc || emptyPlayground('Interaction test'));
  const history = useRef(new History<PlaygroundDocument>());
  const [, redraw] = useState(0);
  const apply = (recipe: (draft: PlaygroundDocument) => void, options: { record?: boolean; touch?: boolean } = {}) => {
    setDoc((previous) => {
      if (options.record !== false) history.current.push(clonePlaygroundDocument(previous));
      const next = clonePlaygroundDocument(previous);
      recipe(next);
      return next;
    });
    redraw((value) => value + 1);
  };
  return (
    <PlaygroundCanvas
      doc={doc}
      apply={apply}
      beginTransaction={() => { history.current.push(clonePlaygroundDocument(doc)); redraw((value) => value + 1); }}
      undo={() => false}
      redo={() => false}
      canUndo={false}
      canRedo={false}
      libraryOpen={false}
      onToggleLibrary={vi.fn()}
      onPresentation={vi.fn()}
      onOpenDocument={vi.fn()}
    />
  );
}

const pointer = { pointerId: 1, button: 0, bubbles: true };

describe('playground canvas interactions', () => {
  it('inserts, edits, drags, resizes and context-duplicates a real text object', () => {
    const { container } = render(<Harness />);
    const canvas = container.querySelector('.pg-canvas')!;
    fireEvent.click(screen.getByTitle('Text'));
    expect(screen.getByText('Write something…')).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByText('Write something…'));
    const editor = screen.getByLabelText('Edit text');
    fireEvent.change(editor, { target: { value: 'Persistent thought' } });
    fireEvent.blur(editor);
    const text = screen.getByText('Persistent thought');
    const object = text.closest('[data-object-id]') as HTMLElement;
    const originalLeft = object.style.left;

    fireEvent.pointerDown(object, { ...pointer, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { ...pointer, clientX: 140, clientY: 125 });
    fireEvent.pointerUp(canvas, { ...pointer, clientX: 140, clientY: 125 });
    expect(object.style.left).not.toBe(originalLeft);

    const originalWidth = parseFloat(object.style.width);
    fireEvent.pointerDown(screen.getByLabelText('Resize from se'), { ...pointer, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(canvas, { ...pointer, clientX: 260, clientY: 230 });
    fireEvent.pointerUp(canvas, { ...pointer, clientX: 260, clientY: 230 });
    expect(parseFloat(object.style.width)).toBeGreaterThan(originalWidth);

    fireEvent.contextMenu(object);
    fireEvent.click(screen.getByText('Duplicate').closest('button')!);
    expect(container.querySelectorAll('[data-object-id]')).toHaveLength(2);
  });

  it('creates visual-only nodes and connects their ports without claiming execution', () => {
    const { container } = render(<Harness />);
    const canvas = container.querySelector('.pg-canvas')!;
    const addNode = screen.getByTitle('Workflow node');
    fireEvent.click(addNode);
    fireEvent.click(addNode);
    expect(screen.getAllByText('Visual only')).toHaveLength(2);

    const outputs = screen.getAllByLabelText(/Connect from/);
    const inputs = screen.getAllByLabelText(/Connect into/);
    fireEvent.pointerDown(outputs[0], { ...pointer, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(canvas, { ...pointer, clientX: 300, clientY: 100 });
    fireEvent.pointerDown(inputs[1], { ...pointer, pointerId: 2, clientX: 300, clientY: 100 });

    expect(container.querySelectorAll('.pg-edge')).toHaveLength(1);
    expect(screen.queryByText(/workflow completed/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Visual only')).toHaveLength(2);
  });

  it('adds a working sticky note and toggles grid/snap controls', () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByTitle('Sticky note'));
    expect(screen.getByText('Capture an idea…')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Hide grid'));
    expect(screen.getByLabelText('Show grid')).toBeInTheDocument();
    expect(container.querySelector('.pg-canvas')).toHaveStyle({ backgroundImage: 'none' });
    fireEvent.click(screen.getByLabelText('Disable snap'));
    expect(screen.getByLabelText('Enable snap')).toBeInTheDocument();
  });

  it('writes directly at a canvas point with the text tool', () => {
    const { container } = render(<Harness />);
    const canvas = container.querySelector('.pg-canvas')!;
    fireEvent.click(screen.getByLabelText('Text (T)'));
    fireEvent.pointerDown(canvas, { ...pointer, clientX: 320, clientY: 220 });
    fireEvent.pointerUp(canvas, { ...pointer, clientX: 320, clientY: 220 });
    const editor = screen.getByLabelText('Edit text');
    fireEvent.change(editor, { target: { value: 'Written anywhere' } });
    fireEvent.blur(editor);
    expect(screen.getByText('Written anywhere')).toBeInTheDocument();
  });

  it('drags, resizes and rotates an image object', () => {
    const doc = emptyPlayground('Image test');
    doc.objects = [createPlaygroundObject('image', 40, 60, {
      src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
      alt: 'Pixel',
      width: 200,
      height: 120,
    })];
    const { container } = render(<Harness initialDoc={doc} />);
    const canvas = container.querySelector('.pg-canvas')!;
    const image = screen.getByAltText('Pixel');
    const object = image.closest('[data-object-id]') as HTMLElement;

    fireEvent.pointerDown(object, { ...pointer, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { ...pointer, clientX: 130, clientY: 120 });
    fireEvent.pointerUp(canvas, { ...pointer, clientX: 130, clientY: 120 });
    expect(object.style.left).not.toBe('40px');

    fireEvent.pointerDown(screen.getByLabelText('Resize from se'), { ...pointer, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(canvas, { ...pointer, clientX: 250, clientY: 230 });
    fireEvent.pointerUp(canvas, { ...pointer, clientX: 250, clientY: 230 });
    expect(parseFloat(object.style.width)).toBeGreaterThan(200);

    fireEvent.pointerDown(screen.getByLabelText('Rotate object'), { ...pointer, clientX: 200, clientY: 20 });
    fireEvent.pointerMove(canvas, { ...pointer, clientX: 260, clientY: 80 });
    fireEvent.pointerUp(canvas, { ...pointer, clientX: 260, clientY: 80 });
    expect(object.style.transform).not.toBe('rotate(0deg)');
  });
});
