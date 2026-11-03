import React, { useMemo } from 'react';
import { BarChart3, Check, Plus, Trash2 } from 'lucide-react';
import {
  buildChartLayout,
  formatChartValue,
  normalizeChartType,
  type PlaygroundChartDatum,
  type PlaygroundChartType,
} from '@/lib/playgroundChart';
import { playgroundId, type PlaygroundObject } from '@/lib/playground';

interface GraphicProps {
  data: PlaygroundChartDatum[];
  type?: PlaygroundChartType;
  title?: string;
}

export const ChartGraphic = React.memo(function ChartGraphic({ data, type = 'bar', title = 'Chart' }: GraphicProps) {
  const layout = useMemo(() => buildChartLayout(data), [data]);
  if (!data.length) {
    return <div className="pg-chart-empty"><BarChart3 size={25} /><span>No chart data yet</span><small>Double-click to add labels and values</small></div>;
  }
  return (
    <svg className="pg-chart-graphic" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`${title}, ${type} chart with ${data.length} data point${data.length === 1 ? '' : 's'}`}>
      {layout.grids.map((line, index) => (
        <g key={index}>
          <line x1={layout.left} y1={line.y} x2={layout.left + layout.plotWidth} y2={line.y} className="pg-chart-grid" />
          <text x={layout.left - 7} y={line.y + 3} textAnchor="end" className="pg-chart-value-label">{formatChartValue(line.value)}</text>
        </g>
      ))}
      <line x1={layout.left} y1={layout.zeroY} x2={layout.left + layout.plotWidth} y2={layout.zeroY} className="pg-chart-zero" />
      {type === 'area' && layout.areaPath && <path d={layout.areaPath} className="pg-chart-area" />}
      {type !== 'bar' && layout.linePath && <path d={layout.linePath} className="pg-chart-line" />}
      {type === 'bar' && layout.bars.map((bar) => (
        <rect key={bar.id} x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="3" className="pg-chart-bar">
          <title>{bar.label}: {bar.value}</title>
        </rect>
      ))}
      {type !== 'bar' && layout.points.map((point) => (
        <circle key={point.id} cx={point.x} cy={point.y} r="4" className="pg-chart-point">
          <title>{point.label}: {point.value}</title>
        </circle>
      ))}
      {layout.labels.map((label) => <text key={label.id} x={label.x} y={label.y} textAnchor="middle" className="pg-chart-axis-label">{label.text}</text>)}
    </svg>
  );
});

interface Props {
  object: PlaygroundObject;
  selected: boolean;
  editing: boolean;
  onPatch: (id: string, patch: Partial<PlaygroundObject>, record?: boolean) => void;
  onEdit: (id: string | null) => void;
}

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

export function PlaygroundChart({ object, selected, editing, onPatch, onEdit }: Props) {
  const data = object.chartData || [];
  const type = normalizeChartType(object.chartType);
  const patch = (value: Partial<PlaygroundObject>) => onPatch(object.id, value, false);
  const updateDatum = (id: string, value: Partial<PlaygroundChartDatum>) => {
    patch({ chartData: data.map((datum) => datum.id === id ? { ...datum, ...value } : datum) });
  };

  if (editing) {
    return (
      <div
        className="pg-chart-editor"
        onPointerDown={stop}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onEdit(null);
        }}
      >
        <div className="pg-chart-editor-head">
          <input value={object.text || ''} onChange={(event) => patch({ text: event.target.value })} aria-label="Chart title" autoFocus />
          <button onClick={() => onEdit(null)} title="Finish chart editing"><Check size={13} /> Done</button>
        </div>
        <label className="pg-chart-type-label">Chart type
          <select value={type} onChange={(event) => patch({ chartType: normalizeChartType(event.target.value) })} aria-label="Chart type">
            <option value="bar">Bar chart</option>
            <option value="line">Line graph</option>
            <option value="area">Area graph</option>
          </select>
        </label>
        <div className="pg-chart-data-head"><span>Label</span><span>Value</span><span /></div>
        <div className="pg-chart-data-list">
          {data.map((datum, index) => (
            <div className="pg-chart-data-row" key={datum.id}>
              <input value={datum.label} onChange={(event) => updateDatum(datum.id, { label: event.target.value })} aria-label={`Chart label ${index + 1}`} placeholder={`Point ${index + 1}`} />
              <input type="number" step="any" value={datum.value} onChange={(event) => updateDatum(datum.id, { value: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0 })} aria-label={`Chart value ${index + 1}`} />
              <button onClick={() => patch({ chartData: data.filter((point) => point.id !== datum.id) })} aria-label={`Remove chart point ${index + 1}`} title="Remove data point"><Trash2 size={12} /></button>
            </div>
          ))}
          {!data.length && <p className="pg-chart-editor-empty">Add a data point to build your real chart.</p>}
        </div>
        <button className="pg-chart-add-point" onClick={() => patch({ chartData: [...data, { id: playgroundId('point'), label: `Point ${data.length + 1}`, value: 0 }] })}><Plus size={13} /> Add data point</button>
      </div>
    );
  }

  return (
    <div className="pg-chart-wrap">
      <header>
        <strong>{object.text || 'Untitled chart'}</strong>
        {selected && !object.locked ? <button onPointerDown={stop} onClick={() => onEdit(object.id)}>Edit data</button> : <span>{type}</span>}
      </header>
      <ChartGraphic data={data} type={type} title={object.text || 'Chart'} />
    </div>
  );
}
