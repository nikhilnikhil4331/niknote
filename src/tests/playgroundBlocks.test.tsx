import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockLibrary } from '@/components/playground/BlockLibrary';
import { ContextToolbar } from '@/components/playground/ContextToolbar';
import { createPlaygroundObject } from '@/lib/playground';

describe('playground blocks and document references', () => {
  it('inserts shapes and real existing-note references', () => {
    const onAdd = vi.fn();
    render(<BlockLibrary notes={[{ id: 'note-123', title: 'Research note' }]} onAdd={onAdd} onImage={vi.fn()} onPen={vi.fn()} onAI={vi.fn()} />);

    fireEvent.click(screen.getByTitle('Insert Rectangle'));
    expect(onAdd).toHaveBeenCalledWith('shape', expect.objectContaining({ shape: 'rectangle' }));

    fireEvent.change(screen.getByLabelText('Search blocks'), { target: { value: 'Research note' } });
    fireEvent.click(screen.getByTitle('Insert Research note'));
    expect(onAdd).toHaveBeenCalledWith('link', expect.objectContaining({
      text: 'Research note',
      href: '/?editor=1&notebook=note-123',
    }));
  });

  it('opens selected canvas text in the connected document workflow', () => {
    const onOpenDocument = vi.fn();
    const object = createPlaygroundObject('text', 0, 0, { text: 'Connected thought' });
    render(<ContextToolbar
      objects={[object]}
      onPatch={vi.fn()}
      onPatchEdge={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      onDeleteEdge={vi.fn()}
      onLock={vi.fn()}
      onLayer={vi.fn()}
      onGroup={vi.fn()}
      onRotate={vi.fn()}
      onReplaceImage={vi.fn()}
      onOpenDocument={onOpenDocument}
    />);
    fireEvent.click(screen.getByTitle('Open as a document'));
    expect(onOpenDocument).toHaveBeenCalledOnce();
  });
});
