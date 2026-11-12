import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataChartBlock } from '@/components/editor/blocks/DataChartBlock';
import { EditableBlockTable } from '@/components/editor/blocks/EditableBlockTable';
import { createBlock } from '@/types/block';
import {
  localNotebookAsCloudShape,
  readLocalNotesForOwner,
  removeLocalNoteForOwner,
  upsertLocalNoteForOwner,
} from '@/lib/localNoteStore';

beforeEach(() => localStorage.clear());

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
});
