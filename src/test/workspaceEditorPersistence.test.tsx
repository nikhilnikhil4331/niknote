import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataChartBlock } from '@/components/editor/blocks/DataChartBlock';
import { EditableBlockTable } from '@/components/editor/blocks/EditableBlockTable';
import { createBlock } from '@/types/block';
import {
  copyLocalNotesToOwner,
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
