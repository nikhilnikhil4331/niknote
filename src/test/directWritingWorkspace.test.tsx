import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DirectWritingWorkspace } from '@/components/workspace/DirectWritingWorkspace';
import { createBlock } from '@/types/block';
import { DEFAULT_SETTINGS } from '@/types/notes';

function renderMobileWorkspace() {
  const onAddBlock = vi.fn();
  const onSave = vi.fn();
  const onOpenPageStyle = vi.fn();
  render(
    <MemoryRouter initialEntries={['/editor/new']}>
      <DirectWritingWorkspace
        title="Workspace interaction test"
        onTitleChange={vi.fn()}
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        blocks={[createBlock('text', 'Write here')]}
        onBlocksChange={vi.fn()}
        settings={DEFAULT_SETTINGS}
        currentColor="blue"
        onColorChange={vi.fn()}
        saveStatus="saved"
        syncState="local"
        isMobile
        isDark={false}
        onToggleDark={vi.fn()}
        canUndo
        canRedo
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onSave={onSave}
        onExportPDF={vi.fn()}
        exporting={false}
        onShare={vi.fn()}
        onOpenAI={vi.fn()}
        onOpenNikAI={vi.fn()}
        onOpenScanner={vi.fn()}
        onOpenImport={vi.fn()}
        onInsertImage={vi.fn()}
        mobileTool="text"
        isListening={false}
        onMobileTool={vi.fn()}
        showHandwritingPreview={false}
        onToggleHandwritingPreview={vi.fn()}
        handwritingPreview={null}
        onOpenPageStyle={onOpenPageStyle}
        onOpenCommandPalette={vi.fn()}
        onSync={vi.fn()}
        onAddPage={vi.fn()}
        onPreviousPage={vi.fn()}
        onNextPage={vi.fn()}
        pageNumber={1}
        totalPages={1}
        canGoPrev={false}
        canGoNext={false}
        onAddBlock={onAddBlock}
        onFocusBlock={vi.fn()}
        focusedBlockId={null}
      />
    </MemoryRouter>,
  );
  return { onAddBlock, onSave, onOpenPageStyle };
}

describe('responsive editor workspace interactions', () => {
  it('keeps the More-tools menu outside the floating toolbar and inserts a chart', () => {
    const { onAddBlock } = renderMobileWorkspace();

    const moreButton = screen.getByRole('button', { name: 'More editor tools' });
    fireEvent.click(moreButton);
    expect(moreButton).toHaveAttribute('aria-expanded', 'true');

    const moreMenu = screen.getByRole('menu', { name: 'More editor tools' });
    expect(document.querySelector('.nn-floating-blocks')?.contains(moreMenu)).toBe(false);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Data chart' }));
    expect(onAddBlock).toHaveBeenCalledWith('chart');
    expect(screen.queryByRole('menu', { name: 'More editor tools' })).toBeNull();
  });

  it('searches the mobile block catalog and inserts a table, then runs a document action', () => {
    const { onAddBlock, onSave } = renderMobileWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle editor tools' }));
    expect(screen.getByRole('complementary', { name: 'Editor tools' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search blocks' }), { target: { value: 'table' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert Table block' }));
    expect(onAddBlock).toHaveBeenCalledWith('table');

    fireEvent.click(screen.getByRole('button', { name: 'More note actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save now' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
