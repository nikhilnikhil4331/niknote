import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlaygroundNotesPreview } from '@/components/playground/PlaygroundNotesPreview';
import { createPlaygroundObject, emptyPlayground, normalizePlayground } from '@/lib/playground';
import { buildChartLayout, chartSvgMarkup, formatChartValue } from '@/lib/playgroundChart';

describe('editable playground charts', () => {
  it('builds real bar, line and area geometry including negative values', () => {
    const data = [
      { id: 'a', label: 'Positive', value: 10 },
      { id: 'b', label: 'Negative', value: -5 },
      { id: 'c', label: 'Zero', value: 0 },
    ];
    const layout = buildChartLayout(data);
    expect(layout.bars).toHaveLength(3);
    expect(layout.points[0].y).toBeLessThan(layout.zeroY);
    expect(layout.points[1].y).toBeGreaterThan(layout.zeroY);
    expect(layout.bars[1].y).toBe(layout.zeroY);
    expect(layout.linePath).toMatch(/^M .+ L .+ L /);
    expect(layout.areaPath).toContain('Z');
    expect(formatChartValue(12500)).toBe('12.5k');
  });

  it('exports escaped user data as vector markup and normalises damaged persisted data', () => {
    const markup = chartSvgMarkup({
      x: 10,
      y: 20,
      width: 440,
      height: 300,
      title: 'Research <draft>',
      type: 'line',
      data: [{ id: 'a', label: 'A&B', value: 7 }],
    });
    expect(markup).toContain('Research &lt;draft&gt;');
    expect(markup).toContain('A&amp;B: 7');
    expect(markup).toContain('<path');

    const doc = normalizePlayground({
      id: 'chart-recovery',
      objects: [{
        ...createPlaygroundObject('chart', 0, 0, { id: 'chart' }),
        chartType: 'unknown',
        chartData: [null, { id: 'same', label: 'Valid', value: 4 }, { id: 'same', label: 'Again', value: 'bad' }],
      }],
    });
    expect(doc.objects[0].chartType).toBe('bar');
    expect(doc.objects[0].chartData).toEqual([
      { id: 'same', label: 'Valid', value: 4 },
      { id: 'same-2', label: 'Again', value: 0 },
    ]);
  });

  it('shows the same actual chart data in Notes Preview', () => {
    const doc = emptyPlayground('Chart preview');
    doc.objects = [createPlaygroundObject('chart', 0, 0, {
      text: 'Revision progress',
      chartType: 'area',
      chartData: [
        { id: 'algebra', label: 'Algebra', value: 12 },
        { id: 'physics', label: 'Physics', value: 9 },
      ],
    })];
    render(<PlaygroundNotesPreview doc={doc} onBack={vi.fn()} onOpenNotes={vi.fn()} />);

    expect(screen.getByText('Chart · canvas data')).toBeInTheDocument();
    expect(screen.getByLabelText('Revision progress, area chart with 2 data points')).toBeInTheDocument();
    expect(screen.getByText('Algebra: 12')).toBeInTheDocument();
    expect(screen.getByText('Physics: 9')).toBeInTheDocument();
  });
});
