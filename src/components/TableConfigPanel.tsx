import React from 'react';
import { NoteSettings, FONT_OPTIONS } from '@/types/notes';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Table, Grid3X3 } from 'lucide-react';

interface TableConfigPanelProps {
  settings: NoteSettings;
  updateSettings: (updates: Partial<NoteSettings>) => void;
  tableData: string[][];
  onTableDataChange: (data: string[][]) => void;
}

export const TableConfigPanel: React.FC<TableConfigPanelProps> = ({
  settings,
  updateSettings,
  tableData,
  onTableDataChange,
}) => {
  const { table } = settings;

  const updateTable = (updates: Partial<NoteSettings['table']>) => {
    updateSettings({ table: { ...table, ...updates } });
  };

  const handleRowsChange = (rows: number) => {
    updateTable({ rows });
    // Adjust table data
    const newData = [...tableData];
    while (newData.length < rows) {
      newData.push(new Array(table.columns).fill(''));
    }
    while (newData.length > rows) {
      newData.pop();
    }
    onTableDataChange(newData);
  };

  const handleColumnsChange = (columns: number) => {
    updateTable({ columns });
    // Adjust table data
    const newData = tableData.map(row => {
      const newRow = [...row];
      while (newRow.length < columns) {
        newRow.push('');
      }
      while (newRow.length > columns) {
        newRow.pop();
      }
      return newRow;
    });
    onTableDataChange(newData);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = tableData.map((row, rIdx) => 
      rIdx === rowIndex 
        ? row.map((cell, cIdx) => cIdx === colIndex ? value : cell)
        : [...row]
    );
    onTableDataChange(newData);
  };

  const fontClass = FONT_OPTIONS.find(f => f.value === settings.font)?.className || 'font-handwriting-1';
  const inkClass = `ink-${settings.inkColor}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-accent-rose" />
          <Label className="text-sm font-medium">Insert Table</Label>
        </div>
        <Switch
          checked={table.enabled}
          onCheckedChange={(enabled) => updateTable({ enabled })}
        />
      </div>

      {table.enabled && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="control-label">Rows: {table.rows}</Label>
              <Slider
                value={[table.rows]}
                onValueChange={([value]) => handleRowsChange(value)}
                min={2}
                max={10}
                step={1}
                className="mt-2"
              />
            </div>
            <div>
              <Label className="control-label">Columns: {table.columns}</Label>
              <Slider
                value={[table.columns]}
                onValueChange={([value]) => handleColumnsChange(value)}
                min={2}
                max={6}
                step={1}
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Show Borders</Label>
            <Switch
              checked={table.showBorders}
              onCheckedChange={(showBorders) => updateTable({ showBorders })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Header Row</Label>
            <Switch
              checked={table.headerRow}
              onCheckedChange={(headerRow) => updateTable({ headerRow })}
            />
          </div>

          {/* Table editor */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {tableData.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 && table.headerRow ? 'bg-muted/50' : ''}>
                      {row.map((cell, colIndex) => (
                        <td key={colIndex} className="border border-border p-0">
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                            placeholder={rowIndex === 0 && table.headerRow ? `Header ${colIndex + 1}` : ''}
                            className={`w-full p-2 bg-transparent border-none text-center focus:outline-none focus:bg-primary/5 ${fontClass} ${inkClass}`}
                            style={{ fontSize: `${settings.fontSize * 0.7}px` }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
