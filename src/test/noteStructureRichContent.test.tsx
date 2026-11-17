import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataChartBlock } from '@/components/editor/blocks/DataChartBlock';
import { markdownToStructuredLines, structuredToBlocks } from '@/lib/noteStructure';
import { createBlock } from '@/types/block';
import { styledWords } from '@/lib/inlineMarks';
import { AstaMarkdown } from '@/components/asta/AstaMarkdown';

const richMarkdown = `# Study overview

The **key idea** is _important_ and stays emphasized.

1. First step
2. Second step

| Month | Sales | Returns |
| :--- | ---: | ---: |
| Jan | 12 | 2 |
| Feb | 18 | 1 |

![Sales illustration](https://images.example.test/sales.png "Sales by month")

\`\`\`chart
{"type":"area","title":"Monthly sales","headers":["Month","2025","2026"],"rows":[["Jan",10,12],["Feb",14,18]]}
\`\`\``;

describe('rich Markdown-to-note conversion', () => {
  it('keeps inline bold and italic markers styled in the handwritten preview', () => {
    expect(styledWords('**key idea** is _important_.').map(({ text, bold, italic }) => ({ text, bold, italic }))).toEqual([
      { text: 'key', bold: true, italic: false },
      { text: 'idea', bold: true, italic: false },
      { text: 'is', bold: false, italic: false },
      { text: 'important.', bold: false, italic: true },
    ]);
    expect(styledWords('__term__')[0]).toEqual({ text: 'term', bold: true, italic: false });
    expect(styledWords('___term___')[0]).toEqual({ text: 'term', bold: true, italic: true });
  });

  it('preserves headings, emphasis, ordered lists and per-block ink', () => {
    const blocks = structuredToBlocks(markdownToStructuredLines(richMarkdown));

    expect(blocks[0]).toMatchObject({ type: 'heading1', content: 'Study overview', color: 'purple' });
    expect(blocks.some((block) => block.content.includes('**key idea**') && block.content.includes('_important_'))).toBe(true);
    expect(blocks.filter((block) => block.type === 'numbered').map((block) => block.content)).toEqual([
      'First step',
      'Second step',
    ]);
  });

  it('keeps nested ordered, bulleted and checklist blocks indented', () => {
    const blocks = structuredToBlocks(markdownToStructuredLines('- Chapter\n  1. First nested step\n  - Supporting detail\n  - [ ] Review this point'));

    expect(blocks.filter((block) => block.indent === 1).map((block) => block.type)).toEqual([
      'numbered',
      'bullet',
      'todo',
    ]);
  });

  it('numbers nested ordered lists independently from their parent list', () => {
    const blocks = markdownToStructuredLines('1. Parent step\n  1. Nested step\n2. Next parent step');

    expect(blocks.map(({ text, indent }) => [text, indent])).toEqual([
      ['1. Parent step', 0],
      ['1. Nested step', 1],
      ['2. Next parent step', 0],
    ]);
  });

  it('converts a Markdown table into one editable table with aligned cells', () => {
    const blocks = structuredToBlocks(markdownToStructuredLines(richMarkdown));
    const table = blocks.find((block) => block.type === 'table');

    expect(table?.tableData?.headers).toEqual(['Month', 'Sales', 'Returns']);
    expect(table?.tableData?.rows.map((row) => row.map((cell) => cell.content))).toEqual([
      ['Jan', '12', '2'],
      ['Feb', '18', '1'],
    ]);
  });

  it('keeps Markdown images as safe image blocks with alt text and captions', () => {
    const blocks = structuredToBlocks(markdownToStructuredLines(richMarkdown));
    const image = blocks.find((block) => block.type === 'image');

    expect(image).toMatchObject({
      type: 'image',
      content: 'Sales illustration',
      url: 'https://images.example.test/sales.png',
      caption: 'Sales by month',
    });
  });

  it('turns chart fences into editable, multi-series chart blocks', () => {
    const blocks = structuredToBlocks(markdownToStructuredLines(richMarkdown));
    const chart = blocks.find((block) => block.type === 'chart');

    expect(chart).toMatchObject({ type: 'chart', content: 'Monthly sales', chartType: 'area' });
    expect(chart?.tableData?.headers).toEqual(['Month', '2025', '2026']);
    expect(chart?.tableData?.rows.map((row) => row.map((cell) => cell.content))).toEqual([
      ['Jan', '10', '12'],
      ['Feb', '14', '18'],
    ]);
  });

  it('renders chart fences and safe Markdown images in the AI preview', () => {
    const { container } = render(<AstaMarkdown content={richMarkdown} />);

    expect(container.querySelector('.nn-data-chart')).toBeTruthy();
    expect(screen.getByText('Monthly sales')).toBeTruthy();
    expect(container.querySelector('img[src="https://images.example.test/sales.png"]')).toBeTruthy();
  });

  it('does not turn an unsafe Markdown image URL into a loadable image', () => {
    const blocks = structuredToBlocks(markdownToStructuredLines('![Do not load](javascript:alert(1))'));
    expect(blocks.some((block) => block.type === 'image')).toBe(false);
    expect(blocks[0]?.content).toContain('Do not load');
  });
});

describe('editable chart blocks', () => {
  it('changes chart type and source values through accessible editor controls', () => {
    const chart = createBlock('chart', 'Quarterly totals');
    chart.chartType = 'bar';
    chart.tableData = {
      headers: ['Quarter', '2025', '2026'],
      rows: [
        [
          { id: 'q1', content: 'Q1', type: 'text' },
          { id: 'q1-25', content: '10', type: 'number' },
          { id: 'q1-26', content: '14', type: 'number' },
        ],
      ],
      colCount: 3,
    };
    const onChange = vi.fn();

    render(<DataChartBlock block={chart} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Chart style' }), { target: { value: 'area' } });
    expect(onChange).toHaveBeenCalledWith({ chartType: 'area' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Row 1, column 2' }), { target: { value: '16' } });
    const tableUpdate = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    expect(tableUpdate.tableData.rows[0][1].content).toBe('16');
    expect(screen.getByRole('img', { name: 'bar chart with 1 data point' })).toBeTruthy();
  });

  it('shows a live chart-type change when the editor applies the emitted block patch', () => {
    const initial = createBlock('chart', 'Attendance');
    initial.tableData = {
      headers: ['Week', 'Present'],
      rows: [[{ id: 'w1', content: 'Week 1', type: 'text' }, { id: 'v1', content: '24', type: 'number' }]],
      colCount: 2,
    };

    function ControlledChart() {
      const [block, setBlock] = useState(initial);
      return <DataChartBlock block={block} onChange={(patch) => setBlock((current) => ({ ...current, ...patch }))} />;
    }

    render(<ControlledChart />);
    const select = screen.getByRole('combobox', { name: 'Chart style' });
    fireEvent.change(select, { target: { value: 'line' } });
    expect(screen.getByRole('img', { name: 'line chart with 1 data point' })).toBeTruthy();
  });
});
