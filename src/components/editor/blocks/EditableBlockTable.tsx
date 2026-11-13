import { Plus, Trash2 } from 'lucide-react';
import { generateBlockId, type Block } from '@/types/block';

export type EditableTableData = NonNullable<Block['tableData']>;

interface EditableBlockTableProps {
  data: EditableTableData;
  onChange: (next: EditableTableData) => void;
  label?: string;
}

const emptyCell = () => ({ id: generateBlockId(), content: '', type: 'text' as const });

export function EditableBlockTable({ data, onChange, label = 'Editable table' }: EditableBlockTableProps) {
  const updateHeader = (columnIndex: number, content: string) => {
    const headers = data.headers.map((header, index) => index === columnIndex ? content : header);
    onChange({ ...data, headers, colCount: headers.length });
  };

  const updateCell = (rowIndex: number, columnIndex: number, content: string) => {
    const rows = data.rows.map((row, index) => {
      if (index !== rowIndex) return row;
      const next = [...row];
      while (next.length < data.headers.length) next.push(emptyCell());
      next[columnIndex] = { ...(next[columnIndex] || emptyCell()), content };
      return next;
    });
    onChange({ ...data, rows });
  };

  const addRow = () => {
    const columns = Math.max(1, data.headers.length);
    onChange({ ...data, rows: [...data.rows, Array.from({ length: columns }, emptyCell)] });
  };

  const addColumn = () => {
    const nextColumn = data.headers.length + 1;
    onChange({
      headers: [...data.headers, `Column ${nextColumn}`],
      rows: data.rows.map((row) => [...row, emptyCell()]),
      colCount: nextColumn,
    });
  };

  const deleteRow = (rowIndex: number) => {
    onChange({ ...data, rows: data.rows.filter((_, index) => index !== rowIndex) });
  };

  const deleteColumn = (columnIndex: number) => {
    const headers = data.headers.filter((_, index) => index !== columnIndex);
    onChange({
      headers,
      rows: data.rows.map((row) => row.filter((_, index) => index !== columnIndex)),
      colCount: headers.length,
    });
  };

  return (
    <div className="nn-data-table" aria-label={label}>
      <div className="nn-data-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="nn-data-table-row-number" aria-hidden="true">#</th>
              {data.headers.map((header, columnIndex) => (
                <th key={`head-${columnIndex}`}>
                  <input
                    aria-label={`Column ${columnIndex + 1} name`}
                    value={header}
                    onChange={(event) => updateHeader(columnIndex, event.target.value)}
                    placeholder={`Column ${columnIndex + 1}`}
                  />
                  <button
                    type="button"
                    aria-label={`Remove column ${columnIndex + 1}`}
                    title="Remove column"
                    disabled={data.headers.length <= 1}
                    onClick={() => deleteColumn(columnIndex)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </th>
              ))}
              <th className="nn-data-table-add-column">
                <button type="button" aria-label="Add table column" title="Add column" onClick={addColumn}>
                  <Plus aria-hidden="true" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                <th className="nn-data-table-row-number" scope="row">{rowIndex + 1}</th>
                {data.headers.map((_, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`}>
                    <input
                      aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                      value={row[columnIndex]?.content ?? ''}
                      onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      placeholder="Add a value"
                    />
                  </td>
                ))}
                <td className="nn-data-table-row-actions">
                  <button type="button" aria-label={`Remove row ${rowIndex + 1}`} title="Remove row" onClick={() => deleteRow(rowIndex)}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="nn-data-table-footer">
        <button type="button" onClick={addRow}><Plus aria-hidden="true" /> Add row</button>
        <span>{data.rows.length} rows · {data.headers.length} columns</span>
      </div>
    </div>
  );
}
