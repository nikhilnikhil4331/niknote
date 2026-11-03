import React, { useMemo } from 'react';
import { objectBounds, type PlaygroundDocument, type PlaygroundObject, type PlaygroundViewport } from '@/lib/playground';

interface Props {
  doc: PlaygroundDocument;
  width: number;
  height: number;
  onNavigate: (viewport: PlaygroundViewport) => void;
}

export function Minimap({ doc, width, height, onNavigate }: Props) {
  const bounds = useMemo(() => objectBounds(doc.objects) || { x: 0, y: 0, width: 800, height: 600 }, [doc.objects]);
  const scale = Math.min(150 / Math.max(1, bounds.width), 88 / Math.max(1, bounds.height));
  const offsetX = (158 - bounds.width * scale) / 2;
  const offsetY = (96 - bounds.height * scale) / 2;
  return (
    <button
      className="pg-minimap"
      aria-label="Minimap: click to centre this area"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - rect.left - 8 - offsetX;
        const localY = event.clientY - rect.top - 8 - offsetY;
        const worldX = bounds.x + localX / scale;
        const worldY = bounds.y + localY / scale;
        onNavigate({ ...doc.viewport, x: width / 2 - worldX * doc.viewport.zoom, y: height / 2 - worldY * doc.viewport.zoom });
      }}
    >
      <svg viewBox="0 0 166 104" aria-hidden>
        <g transform={`translate(${8 + offsetX} ${4 + offsetY}) scale(${scale})`}>
          <MinimapObjects objects={doc.objects} />
          <rect
            x={-doc.viewport.x / doc.viewport.zoom}
            y={-doc.viewport.y / doc.viewport.zoom}
            width={width / doc.viewport.zoom}
            height={height / doc.viewport.zoom}
            className="pg-mini-viewport"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      <span>Minimap</span>
    </button>
  );
}

const MinimapObjects = React.memo(function MinimapObjects({ objects }: { objects: PlaygroundObject[] }) {
  return objects.map((object) => (
    <rect key={object.id} x={object.x} y={object.y} width={object.width} height={object.height} rx={Math.min(8, object.height / 8)} className={`pg-mini-${object.kind}`} />
  ));
});
