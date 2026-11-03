import React from 'react';
import {
  connectionPath,
  temporaryConnectionPath,
  type PlaygroundEdge,
  type PlaygroundObject,
  type PlaygroundPoint,
} from '@/lib/playground';

interface Props {
  objects: PlaygroundObject[];
  edges: PlaygroundEdge[];
  selectedEdgeId: string | null;
  onSelectEdge: (id: string) => void;
  connectingObject: PlaygroundObject | null;
  connectionPoint: PlaygroundPoint | null;
  guides: { vertical?: number; horizontal?: number };
}

// Viewport transforms happen on the parent. Memoizing this comparatively
// expensive SVG layer keeps edge path calculation out of every pan/zoom frame.
export const PlaygroundConnections = React.memo(function PlaygroundConnections({
  objects,
  edges,
  selectedEdgeId,
  onSelectEdge,
  connectingObject,
  connectionPoint,
  guides,
}: Props) {
  return (
    <svg className="pg-connections" width="1" height="1" overflow="visible">
      <defs>
        <marker id="pg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" /></marker>
      </defs>
      {edges.map((edge) => {
        const path = connectionPath(edge, objects);
        return (
          <g key={edge.id} className={selectedEdgeId === edge.id ? 'is-selected' : ''}>
            <path d={path} className="pg-edge-hit" onPointerDown={(event) => { event.stopPropagation(); onSelectEdge(edge.id); }} />
            <path d={path} className="pg-edge" stroke={edge.color || '#A02AA4'} strokeWidth={edge.width || 2} strokeDasharray={edge.style === 'dashed' ? '8 6' : undefined} markerEnd={edge.arrow !== 'none' ? 'url(#pg-arrow)' : undefined} markerStart={edge.arrow === 'both' ? 'url(#pg-arrow)' : undefined} pointerEvents="none" />
            {edge.label && <EdgeLabel edge={edge} objects={objects} />}
          </g>
        );
      })}
      {connectingObject && connectionPoint && <path d={temporaryConnectionPath(connectingObject, connectionPoint)} className="pg-edge-temp" />}
      {guides.vertical !== undefined && <line x1={guides.vertical} y1={-100000} x2={guides.vertical} y2={100000} className="pg-align-guide" />}
      {guides.horizontal !== undefined && <line x1={-100000} y1={guides.horizontal} x2={100000} y2={guides.horizontal} className="pg-align-guide" />}
    </svg>
  );
});

function EdgeLabel({ edge, objects }: { edge: PlaygroundEdge; objects: PlaygroundObject[] }) {
  const from = objects.find((object) => object.id === edge.from);
  const to = objects.find((object) => object.id === edge.to);
  if (!from || !to) return null;
  const x = (from.x + from.width + to.x) / 2;
  const y = (from.y + from.height / 2 + to.y + to.height / 2) / 2 - 10;
  return <text x={x} y={y} className="pg-edge-label" textAnchor="middle">{edge.label}</text>;
}
