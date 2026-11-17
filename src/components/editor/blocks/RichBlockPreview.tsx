import type { Block } from '@/types/block';
import { DataChartBlock } from './DataChartBlock';
import { EditableBlockTable } from './EditableBlockTable';

interface RichBlockPreviewProps {
  block: Block;
  forExport?: boolean;
}

/** Read-only rendering of rich blocks inside the handwriting preview/PDF page. */
export function RichBlockPreview({ block, forExport = false }: RichBlockPreviewProps) {
  if (block.type === 'image' && block.url) {
    return (
      <figure className="my-2 w-full max-w-full overflow-hidden rounded-xl border border-[#e6e1d7] bg-white p-2">
        <img
          src={block.url}
          alt={block.content || block.caption || 'Note image'}
          loading="eager"
          className="mx-auto block w-full object-contain"
          style={{ maxHeight: forExport ? 230 : 260 }}
        />
        {block.caption && <figcaption className="pt-2 text-center text-xs text-[#5e5961]">{block.caption}</figcaption>}
      </figure>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="my-2 w-full max-w-full overflow-hidden rounded-xl border border-[#e6e1d7] bg-white p-2">
        <EditableBlockTable
          data={block.tableData || { headers: ['Column 1', 'Column 2'], rows: [], colCount: 2 }}
          onChange={() => {}}
          label="Note table preview"
          readOnly
        />
      </div>
    );
  }

  if (block.type === 'chart') {
    return <DataChartBlock block={block} readOnly showDataTable={false} />;
  }

  return null;
}
