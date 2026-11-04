// ============================================================
// NikNote 4.0 — Database/Table Block Component
// Notion-level inline tables with sorting, filtering
// AI-powered auto-fill and analysis
// ============================================================

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, GripVertical, ArrowUpDown, Filter, Sparkles, MoreHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TableCell {
  id: string;
  content: string;
}

export interface TableColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'checkbox' | 'select' | 'date' | 'url';
  width?: number;
  options?: { label: string; color: string }[];
}

interface TableBlockProps {
  headers: string[];
  rows: string[][];
  onHeadersChange: (headers: string[]) => void;
  onRowsChange: (rows: string[][]) => void;
}

export const TableBlock: React.FC<TableBlockProps> = ({
  headers, rows, onHeadersChange, onRowsChange
}) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showColumnMenu, setShowColumnMenu] = useState<number | null>(null);

  // Add row
  const addRow = useCallback(() => {
    const newRow = headers.map(() => '');
    onRowsChange([...rows, newRow]);
  }, [headers, rows, onRowsChange]);

  // Add column
  const addColumn = useCallback(() => {
    const colNum = headers.length + 1;
    onHeadersChange([...headers, `Column ${colNum}`]);
    onRowsChange(rows.map(row => [...row, '']));
  }, [headers, rows, onHeadersChange, onRowsChange]);

  // Update cell
  const updateCell = useCallback((rowIdx: number, colIdx: number, value: string) => {
    const newRows = rows.map((row, r) =>
      r === rowIdx ? row.map((cell, c) => c === colIdx ? value : cell) : row
    );
    onRowsChange(newRows);
  }, [rows, onRowsChange]);

  // Update header
  const updateHeader = useCallback((colIdx: number, name: string) => {
    onHeadersChange(headers.map((h, i) => i === colIdx ? name : h));
  }, [headers, onHeadersChange]);

  // Delete row
  const deleteRow = useCallback((rowIdx: number) => {
    onRowsChange(rows.filter((_, i) => i !== rowIdx));
  }, [rows, onRowsChange]);

  // Delete column
  const deleteColumn = useCallback((colIdx: number) => {
    onHeadersChange(headers.filter((_, i) => i !== colIdx));
    onRowsChange(rows.map(row => row.filter((_, i) => i !== colIdx)));
  }, [headers, rows, onHeadersChange, onRowsChange]);

  // Sort
  const sortedRows = useMemo(() => {
    if (sortColumn === null) return rows;
    const sorted = [...rows].sort((a, b) => {
      const valA = a[sortColumn] || '';
      const valB = b[sortColumn] || '';
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDir === 'asc' ? numA - numB : numB - numA;
      }
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    return sorted;
  }, [rows, sortColumn, sortDir]);

  const toggleSort = (colIdx: number) => {
    if (sortColumn === colIdx) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colIdx);
      setSortDir('asc');
    }
  };

  return (
    <div className="table-block rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200">
              <th className="w-8 px-1 py-2" /> {/* Row number */}
              {headers.map((header, colIdx) => (
                <th key={colIdx} className="relative group border-r border-gray-200 last:border-r-0">
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <input
                      value={header}
                      onChange={(e) => updateHeader(colIdx, e.target.value)}
                      className="bg-transparent border-0 outline-none text-xs font-semibold text-gray-600 w-full"
                      placeholder={`Column ${colIdx + 1}`}
                    />
                    <button
                      onClick={() => toggleSort(colIdx)}
                      className={cn(
                        "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                        sortColumn === colIdx ? "opacity-100 text-blue-500" : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setShowColumnMenu(showColumnMenu === colIdx ? null : colIdx)}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                    >
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                  </div>
                  {/* Column menu */}
                  <AnimatePresence>
                    {showColumnMenu === colIdx && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 top-full z-50 w-32 py-1 bg-white rounded-lg shadow-lg border border-gray-200"
                      >
                        <button
                          onClick={() => { deleteColumn(colIdx); setShowColumnMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" /> Delete column
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </th>
              ))}
              <th className="w-8 px-1">
                <button onClick={addColumn} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-100 group hover:bg-gray-50/50">
                <td className="px-1 py-1 text-[10px] text-gray-300 text-center">{rowIdx + 1}</td>
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="border-r border-gray-100 last:border-r-0 px-0.5 py-0.5">
                    <input
                      value={cell}
                      onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                      onFocus={() => setSelectedCell({ row: rowIdx, col: colIdx })}
                      className={cn(
                        "w-full bg-transparent border-0 outline-none text-xs px-2 py-1.5 rounded",
                        selectedCell?.row === rowIdx && selectedCell?.col === colIdx
                          ? "bg-blue-50 ring-1 ring-blue-200"
                          : "hover:bg-gray-50"
                      )}
                      placeholder="—"
                    />
                  </td>
                ))}
                <td className="px-0.5 py-0.5">
                  <button
                    onClick={() => deleteRow(rowIdx)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row button */}
      <div className="px-2 py-1.5 border-t border-gray-100">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
          New row
        </button>
      </div>

      {/* AI Auto-fill */}
      <div className="px-2 py-1.5 border-t border-gray-50 flex items-center gap-2">
        <button className="flex items-center gap-1.5 text-[10px] text-blue-500 hover:text-blue-700 transition-colors font-medium">
          <Sparkles className="w-3 h-3" />
          AI Auto-fill
        </button>
        <span className="text-[10px] text-gray-300">|</span>
        <button className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
          <Filter className="w-3 h-3" />
          Filter
        </button>
      </div>
    </div>
  );
};
