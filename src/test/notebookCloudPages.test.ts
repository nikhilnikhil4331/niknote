import { describe, expect, it } from 'vitest';
import { blocksFromNotebookCloudPages, orderNotebookCloudPages, partitionNotebookBlocks } from '@/lib/notebookCloudPages';
import type { Block } from '@/types/block';

const block = (id: string): Block => ({ id, type: 'text', content: id });

describe('notebook cloud page block helpers', () => {
  it('orders pages and combines their blocks without dropping later pages', () => {
    const pages = [
      { id: 'page-2', page_number: 2, content: [block('b2')] },
      { id: 'page-1', page_number: 1, content: [block('b1')] },
      { id: 'page-3', page_number: 3, content: [] },
    ];

    expect(orderNotebookCloudPages(pages).map((page) => page.id)).toEqual(['page-1', 'page-2', 'page-3']);
    expect(blocksFromNotebookCloudPages(pages).map((item) => item.id)).toEqual(['b1', 'b2']);
  });

  it('redistributes the edited block list across existing page boundaries and puts overflow last', () => {
    const pages = [
      { id: 'page-2', page_number: 2, content: [block('old-3'), block('old-4')] },
      { id: 'page-1', page_number: 1, content: [block('old-1'), block('old-2')] },
      { id: 'page-3', page_number: 3, content: [] },
    ];

    const partitioned = partitionNotebookBlocks(
      [block('new-1'), block('new-2'), block('new-3'), block('new-4'), block('new-5')],
      pages,
    );

    expect(partitioned.map((page) => page.map((item) => item.id))).toEqual([
      ['new-1', 'new-2'],
      ['new-3', 'new-4'],
      ['new-5'],
    ]);
  });

  it('keeps page rows even when the new document has fewer blocks', () => {
    const pages = [
      { id: 'page-1', page_number: 1, content: [block('old-1'), block('old-2')] },
      { id: 'page-2', page_number: 2, content: [block('old-3')] },
      { id: 'page-3', page_number: 3, content: [] },
    ];

    expect(partitionNotebookBlocks([block('new-1')], pages)).toEqual([[block('new-1')], [], []]);
    expect(partitionNotebookBlocks([block('new-1')], [])).toEqual([[block('new-1')]]);
  });
});
