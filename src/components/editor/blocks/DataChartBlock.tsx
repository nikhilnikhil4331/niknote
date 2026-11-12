import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Block } from '@/types/block';
import { EditableBlockTable, type EditableTableData } from './EditableBlockTable';

interface DataChartBlockProps {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}

const PIE_COLORS = ['#2765d8', '#53a17a', '#f0b34b', '#db7183', '#8872c8', '#58a6b5', '#d8894f'];
const EMPTY_SOURCE: EditableTableData = { headers: ['Label', 'Value'], rows: [], colCount: 2 };

export function DataChartBlock({ block, onChange }: DataChartBlockProps) {
  const source = block.tableData || EMPTY_SOURCE;
  const chartType = block.chartType || 'bar';
  const data = useMemo(() => source.rows.flatMap((row) => {
    const label = row[0]?.content.trim() || '';
    const rawValue = row[1]?.content.trim() || '';
    const value = Number(rawValue);
    return label && rawValue && Number.isFinite(value) ? [{ label, value }] : [];
  }), [source.rows]);

  const updateSource = (tableData: EditableTableData) => onChange({ tableData });
  const updateChartType = (nextType: Block['chartType']) => onChange({ chartType: nextType });

  return (
    <section className="nn-data-chart" aria-label="Chart built from editable data">
      <header className="nn-data-chart-header">
        <div>
          <strong>Chart</strong>
          <span>Plotted from this block’s table data</span>
        </div>
        <label>
          <span>Chart style</span>
          <select aria-label="Chart style" value={chartType} onChange={(event) => updateChartType(event.target.value as Block['chartType'])}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </label>
      </header>

      {data.length ? (
        <>
          <div className="nn-data-chart-plot" role="img" aria-label={`${chartType} chart with ${data.length} data ${data.length === 1 ? 'point' : 'points'}`}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--nn-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2765d8" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              ) : chartType === 'pie' ? (
                <PieChart>
                  <Tooltip />
                  <Pie data={data} dataKey="value" nameKey="label" outerRadius="78%" label={({ name }) => name}>
                    {data.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              ) : (
                <BarChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--nn-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2765d8" radius={[5, 5, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <p className="nn-data-chart-summary" role="status">{data.length} data {data.length === 1 ? 'point' : 'points'} plotted from your table.</p>
        </>
      ) : (
        <div className="nn-data-chart-empty" role="status">
          Add a label and a number below to build a chart. Nothing is plotted until you enter your data.
        </div>
      )}

      <EditableBlockTable data={source} onChange={updateSource} label="Chart source data" />
    </section>
  );
}
