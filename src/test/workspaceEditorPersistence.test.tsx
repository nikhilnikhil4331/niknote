import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotionEditor } from '@/components/editor/NotionEditor';
import { DataChartBlock } from '@/components/editor/blocks/DataChartBlock';
import { EditableBlockTable } from '@/components/editor/blocks/EditableBlockTable';
import { createBlock, type Block } from '@/types/block';
import {
  copyLocalNotesToOwner,
  localNotebookAsCloudShape,
  readLocalNotesForOwner,
  removeLocalNoteForOwner,
  upsertLocalNoteForOwner,
} from '@/lib/localNoteStore';

beforeEach(() => localStorage.clear());

function CachedBlockEditor({ noteId, initialBlocks }: { noteId: string; initialBlocks: Block[] }) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const onBlocksChange = (next: Block[]) => {
    setBlocks(next);
    upsertLocalNoteForOwner({
      id: noteId,
      title: 'Structured editor QA',
      content: next.map((block) => block.content).join('\n'),
      blocks: next,
    }, 'owner-a');
  };
  return <NotionEditor blocks={blocks} onBlocksChange={onBlocksChange} />;
}

describe('editable structured blocks', () => {
  it('starts a chart without demo data and plots only values entered in its table', () => {
    function ChartHarness() {
      const [block, setBlock] = useState(() => createBlock('chart'));
      return <DataChartBlock block={block} onChange={(patch) => setBlock((current) => ({ ...current, ...patch }))} />;
    }

    render(<ChartHarness />);
    expect(screen.getByRole('status').textContent).toMatch(/Nothing is plotted until you enter your data/i);
    expect(screen.queryByText(/0 data points plotted from your table/i)).toBeNull();

    fireEvent.change(screen.getByLabelText('Chart style'), { target: { value: 'line' } });
    expect(screen.getByLabelText('Chart style')).toHaveValue('line');

    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.change(screen.getByLabelText('Row 1, column 1'), { target: { value: 'Week 1' } });
    fireEvent.change(screen.getByLabelText('Row 1, column 2'), { target: { value: '12' } });
    expect(screen.getByRole('img', { name: 'line chart with 1 data point' })).toBeTruthy();
    expect(screen.getByText(/1 data point plotted from your table/i)).toBeTruthy();
  });

  it('adds table rows and columns through the editable grid callback', () => {
    const data = createBlock('table').tableData!;
    const onChange = vi.fn();
    render(<EditableBlockTable data={data} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ rows: expect.arrayContaining([expect.any(Array)]) }));

    fireEvent.click(screen.getByRole('button', { name: 'Add table column' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ headers: [...data.headers, 'Column 4'], colCount: 4 }));
  });

  it('persists actual table cell, header, row, and column edits and reloads them in the editor', () => {
    const table = createBlock('table');
    const { unmount } = render(<CachedBlockEditor noteId="edited-table" initialBlocks={[table]} />);

    fireEvent.change(screen.getByLabelText('Column 1 name'), { target: { value: 'Topic' } });
    fireEvent.change(screen.getByLabelText('Row 1, column 1'), { target: { value: 'Cell biology' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add table column' }));
    fireEvent.change(screen.getByLabelText('Column 4 name'), { target: { value: 'Priority' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.change(screen.getByLabelText('Row 3, column 4'), { target: { value: 'High' } });

    const saved = readLocalNotesForOwner('owner-a').find((note) => note.id === 'edited-table');
    const savedTable = saved?.blocks?.[0]?.tableData;
    expect(savedTable?.headers).toEqual(['Topic', 'Column 2', 'Column 3', 'Priority']);
    expect(savedTable?.rows[0]?.[0]?.content).toBe('Cell biology');
    expect(savedTable?.rows[2]?.[3]?.content).toBe('High');

    unmount();
    render(<NotionEditor blocks={saved?.blocks || []} onBlocksChange={vi.fn()} />);
    expect(screen.getByLabelText('Column 1 name')).toHaveValue('Topic');
    expect(screen.getByLabelText('Row 1, column 1')).toHaveValue('Cell biology');
    expect(screen.getByLabelText('Row 3, column 4')).toHaveValue('High');
  });

  it('persists chart style and plotted table edits and restores a plotted chart from cache', () => {
    const chart = createBlock('chart');
    const { unmount } = render(<CachedBlockEditor noteId="edited-chart" initialBlocks={[chart]} />);

    fireEvent.change(screen.getByLabelText('Chart style'), { target: { value: 'line' } });
    fireEvent.change(screen.getByLabelText('Row 1, column 1'), { target: { value: 'Week 1' } });
    fireEvent.change(screen.getByLabelText('Row 1, column 2'), { target: { value: '12' } });
    expect(screen.getByRole('img', { name: 'line chart with 1 data point' })).toBeInTheDocument();

    const saved = readLocalNotesForOwner('owner-a').find((note) => note.id === 'edited-chart');
    expect(saved?.blocks?.[0]?.chartType).toBe('line');
    expect(saved?.blocks?.[0]?.tableData?.rows[0]?.map((cell) => cell.content)).toEqual(['Week 1', '12']);

    unmount();
    render(<NotionEditor blocks={saved?.blocks || []} onBlocksChange={vi.fn()} />);
    expect(screen.getByLabelText('Chart style')).toHaveValue('line');
    expect(screen.getByRole('img', { name: 'line chart with 1 data point' })).toBeInTheDocument();
  });

  it('round-trips table and chart source data in the owning note cache', () => {
    const table = createBlock('table');
    table.tableData = {
      headers: ['Task', 'Hours'],
      rows: [[
        { id: 'table-task', content: 'Study', type: 'text' },
        { id: 'table-hours', content: '2', type: 'number' },
      ]],
      colCount: 2,
    };
    const chart = createBlock('chart');
    chart.chartType = 'line';
    chart.tableData = {
      headers: ['Week', 'Score'],
      rows: [[
        { id: 'chart-week', content: 'Week 1', type: 'text' },
        { id: 'chart-score', content: '85', type: 'number' },
      ]],
      colCount: 2,
    };

    upsertLocalNoteForOwner({ id: 'structured-note', title: 'Structured data', blocks: [table, chart] }, 'owner-a');

    expect(readLocalNotesForOwner('owner-a').find((note) => note.id === 'structured-note')?.blocks).toEqual([table, chart]);
    expect(readLocalNotesForOwner('owner-b')).toEqual([]);
  });
});

describe('owner-scoped local note metadata', () => {
  it('keeps favorite and trash metadata in the owning workspace only', () => {
    upsertLocalNoteForOwner({
      id: 'note-a',
      title: 'Owner A note',
      is_favorite: true,
      folder: '__trash__',
    }, 'owner-a');

    const ownerA = readLocalNotesForOwner('owner-a');
    expect(ownerA).toHaveLength(1);
    expect(ownerA[0]).toMatchObject({ id: 'note-a', is_favorite: true, folder: '__trash__', _ownerId: 'owner-a' });
    expect(readLocalNotesForOwner('owner-b')).toEqual([]);
    expect(localNotebookAsCloudShape(ownerA[0], 'owner-a')).toMatchObject({ is_favorite: true, folder: '__trash__', user_id: 'owner-a' });
  });

  it('does not remove another owner’s same-ID local note during permanent deletion', () => {
    upsertLocalNoteForOwner({ id: 'shared-id', title: 'A copy' }, 'owner-a');
    upsertLocalNoteForOwner({ id: 'shared-id', title: 'B copy' }, 'owner-b');

    removeLocalNoteForOwner('shared-id', 'owner-a');

    expect(readLocalNotesForOwner('owner-a')).toEqual([]);
    expect(readLocalNotesForOwner('owner-b').map((note) => note.title)).toEqual(['B copy']);
  });

  it('copies only an explicitly promoted guest’s notes and keeps the device recovery rows intact', () => {
    const guestId = 'local-guest-source';
    const ownerId = '123e4567-e89b-42d3-a456-426614174000';
    const deviceRows = [
      { id: 'guest-note', _ownerId: guestId, title: 'Guest note', blocks: [] },
      { id: 'legacy-note', title: 'Unclaimed guest draft', blocks: [] },
      { id: 'synced-note', title: 'Previously synced', _syncedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'other-guest-note', _ownerId: 'local-guest-other', title: 'Other guest' },
      { id: 'shared-id', _ownerId: guestId, title: 'Guest version' },
      { id: 'shared-id', _ownerId: ownerId, title: 'Existing account version' },
    ];
    localStorage.setItem('niknote.mobile.notebooks.v1', JSON.stringify(deviceRows));

    expect(copyLocalNotesToOwner(guestId, ownerId)).toBe(2);
    const afterCopy = JSON.parse(localStorage.getItem('niknote.mobile.notebooks.v1') || '[]');
    expect(afterCopy.slice(0, 2)).toEqual([
      { id: 'guest-note', _ownerId: ownerId, title: 'Guest note', blocks: [] },
      { id: 'legacy-note', title: 'Unclaimed guest draft', blocks: [], _ownerId: ownerId },
    ]);
    expect(afterCopy.slice(2)).toEqual(deviceRows);
    expect(readLocalNotesForOwner(ownerId).map((note) => note.id).sort()).toEqual(['guest-note', 'legacy-note', 'shared-id']);
    expect(readLocalNotesForOwner(ownerId).find((note) => note.id === 'shared-id')?.title).toBe('Existing account version');
  });

  it('does not copy unclaimed legacy notes when another owner is recorded as their claimant', () => {
    localStorage.setItem('niknote.mobile.notebooks.v1', JSON.stringify([{ id: 'legacy', title: 'Keep with prior guest' }]));
    localStorage.setItem('niknote.local-notes.legacy-owner.v1', 'local-guest-prior');

    expect(copyLocalNotesToOwner('local-guest-current', '123e4567-e89b-42d3-a456-426614174000')).toBe(0);
    expect(readLocalNotesForOwner('123e4567-e89b-42d3-a456-426614174000')).toEqual([]);
    expect(JSON.parse(localStorage.getItem('niknote.mobile.notebooks.v1') || '[]')[0]._ownerId).toBeUndefined();
  });
});
