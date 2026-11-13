import type { Block } from '@/types/block';

export interface NotebookCloudPage {
  id?: string;
  title?: string | null;
  content?: unknown;
  page_number?: number;
  updated_at?: string | null;
}

export function orderNotebookCloudPages<T extends NotebookCloudPage>(pages: readonly T[]): T[] {
  return [...pages].sort((left, right) => {
    const pageDifference = (left.page_number ?? 0) - (right.page_number ?? 0);
    return pageDifference || (left.id ?? '').localeCompare(right.id ?? '');
  });
}

/** Return every block from every stored page in page order. */
export function blocksFromNotebookCloudPages(pages: readonly NotebookCloudPage[]): Block[] {
  return orderNotebookCloudPages(pages).flatMap((page) => {
    if (!Array.isArray(page.content)) return [];
    return page.content.filter((item): item is Block => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const block = item as Record<string, unknown>;
      return typeof block.id === 'string' && typeof block.type === 'string' && typeof block.content === 'string';
    });
  });
}

/**
 * Keep the existing page rows and their original block boundaries when saving
 * the editor's flattened block list. New overflow goes onto the last row; no
 * cloud page is deleted as a side effect of an ordinary save.
 */
export function partitionNotebookBlocks(
  blocks: readonly Block[],
  pages: readonly NotebookCloudPage[],
): Block[][] {
  if (pages.length === 0) return [[...blocks]];

  const orderedPages = orderNotebookCloudPages(pages);
  let offset = 0;

  return orderedPages.map((page, index) => {
    if (index === orderedPages.length - 1) return blocks.slice(offset);

    const originalPageSize = Array.isArray(page.content) ? page.content.length : 0;
    const pageBlocks = blocks.slice(offset, offset + originalPageSize);
    offset += pageBlocks.length;
    return pageBlocks;
  });
}
