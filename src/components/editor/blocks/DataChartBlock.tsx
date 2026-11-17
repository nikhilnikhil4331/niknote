import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Block, ChartType } from '@/types/block';
import { EditableBlockTable, type EditableTableData } from './EditableBlockTable';

interface DataChartBlockProps {
  block: Block;
  onChange?: (patch: Partial<Block>) => void;
  readOnly?: boolean;
  showDataTable?: boolean;
}

const CHART_COLORS = ['#2869D5', '#C83F58', '#2E7D32', '#D8894F', '#58A6B5', '#8872C8', '#D4A900'];
const EMPTY_SOURCE: EditableTableData = { headers: ['Label', 'Value'], rows: [], colCount: 2 };
const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'pie', label: 'Pie' },
];

interface ChartPoint extends Record<string, string | number> {
  label: string;
}

export function DataChartBlock({ block, onChange, readOnly = false, showDataTable = true }: DataChartBlockProps) {
  const source = block.tableData || EMPTY_SOURCE;
  const chartType: ChartType = block.chartType || 'bar';
  const series = useMemo(
    () => source.headers.slice(1).map((label, index) => ({ key: `series${index}`, label: label.trim() || `Series ${index + 1}` })),
    [source.headers],
  );
  const data = useMemo<ChartPoint[]>(() => source.rows.flatMap((row) => {
    const label = row[0]?.content.trim() || '';
    if (!label) return [];
    const point: ChartPoint = { label };
    let hasNumber = false;
    series.forEach(({ key }, index) => {
      const raw = row[index + 1]?.content.trim() || '';
      const value = Number(raw.replace(/,/g, ''));
      if (raw && Number.isFinite(value)) {
        point[key] = value;
        hasNumber = true;
      }
    });
    return hasNumber ? [point] : [];
  }), [source.rows, series]);
  const activeSeries = useMemo(
    () => series.filter(({ key }) => data.some((point) => typeof point[key] === 'number')),
    [data, series],
  );
  const pieSeries = activeSeries[0];
  const pieData = pieSeries ? data.filter((point) => Number(point[pieSeries.key]) > 0) : [];
  const plottedSeries = chartType === 'pie' && pieSeries ? [pieSeries] : activeSeries;

  const updateSource = (tableData: EditableTableData) => onChange?.({ tableData });
  const updateChartType = (nextType: ChartType) => onChange?.({ chartType: nextType });
  const updateTitle = (content: string) => onChange?.({ content });
  const typeLabel = CHART_TYPES.find((type) => type.value === chartType)?.label || 'Bar';
  const chartDescription = `${chartType} chart with ${data.length} data point${data.length === 1 ? '' : 's'}`;

  return (
    <section
      className="nn-data-chart"
      aria-label="Chart built from editable data"
      style={{ minWidth: 0, borderColor: 'var(--nn-border, #E2E7F0)', background: 'var(--nn-surface, #FFFDF5)' }}
    >
      <header className="nn-data-chart-header">
        <div className="nn-data-chart-heading">
          {readOnly ? (
            <strong>{block.content || 'Chart'}</strong>
          ) : (
            <input
              className="nn-data-chart-title-input"
              aria-label="Chart title"
              value={block.content}
              onChange={(event) => updateTitle(event.target.value)}
              placeholder="Give this chart a title"
            />
          )}
          <span>{readOnly ? 'Chart preview' : 'Edit the table below to update the chart'}</span>
        </div>
        {readOnly ? (
          <span className="nn-data-chart-type-label">{typeLabel}</span>
        ) : (
          <label>
            <span>Chart style</span>
            <select
              aria-label="Chart style"
              value={chartType}
              onChange={(event) => updateChartType(event.target.value as ChartType)}
            >
              {CHART_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
        )}
      </header>

      {data.length > 0 && activeSeries.length > 0 && (chartType !== 'pie' || pieData.length > 0) ? (
        <>
          <div className="nn-data-chart-plot" role="img" aria-label={chartDescription} style={readOnly ? { height: 200 } : undefined}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'pie' ? (
                <PieChart>
                  <Tooltip />
                  <Pie data={pieData} dataKey={pieSeries.key} nameKey="label" outerRadius="74%" label={({ name }) => name}>
                    {pieData.map((entry, index) => (
                      <Cell key={`${entry.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : chartType === 'line' ? (
                <LineChart data={data} margin={{ top: 10, right: 18, bottom: 4, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--nn-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {activeSeries.length > 1 && <Legend />}
                  {activeSeries.map((item, index) => (
                    <Line key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  ))}
                </LineChart>
              ) : chartType === 'area' ? (
                <AreaChart data={data} margin={{ top: 10, right: 18, bottom: 4, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--nn-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {activeSeries.length > 1 && <Legend />}
                  {activeSeries.map((item, index) => (
                    <Area key={item.key} type="monotone" dataKey={item.key} name={item.label} stroke={CHART_COLORS[index % CHART_COLORS.length]} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.2} connectNulls />
                  ))}
                </AreaChart>
              ) : (
                <BarChart data={data} margin={{ top: 10, right: 18, bottom: 4, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--nn-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {activeSeries.length > 1 && <Legend />}
                  {activeSeries.map((item, index) => (
                    <Bar key={item.key} dataKey={item.key} name={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <p className="nn-data-chart-summary" role="status">
            {data.length} data point{data.length === 1 ? '' : 's'} plotted from your table across {plottedSeries.length} numeric series.
            {chartType === 'pie' && data.length !== pieData.length ? ' Pie charts omit zero and negative values.' : ''}
          </p>
        </>
      ) : (
        <div className="nn-data-chart-empty" role="status">
          {chartType === 'pie' && data.length > 0
            ? 'Pie charts need at least one positive value in the first data series.'
            : 'Nothing is plotted until you enter your data. Add a category and numeric values in the table below.'}
        </div>
      )}

      {showDataTable && (
        <EditableBlockTable
          data={source}
          onChange={updateSource}
          label={readOnly ? 'Chart source data preview' : 'Chart source data'}
          readOnly={readOnly}
        />
      )}
    </section>
  );
}
