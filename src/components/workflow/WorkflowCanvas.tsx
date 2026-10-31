// ============================================================
// NikNote 4.0 — Visual Workflow Canvas Builder
// Drag-drop canvas for building AI workflows
// Inspired by Dify's visual workflow editor
// ============================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Plus, Trash2, Settings2, ChevronRight, Zap,
  Brain, FileText, Search, Code, Globe, Scan, GitBranch,
  RefreshCw, Eye, Copy, Download, X, GripVertical,
  ArrowRight, Check, AlertTriangle, Loader2, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

export type CanvasNodeType =
  | 'start' | 'end' | 'llm' | 'knowledge' | 'code'
  | 'http' | 'ocr' | 'condition' | 'loop' | 'transform'
  | 'memory' | 'notification' | 'pdf' | 'flashcard'
  | 'quiz' | 'summarize' | 'translate' | 'agent';

interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, any>;
  status: 'idle' | 'running' | 'done' | 'error';
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

// ============================================================
// Node config
// ============================================================

const NODE_CONFIG: Record<CanvasNodeType, { icon: React.ReactNode; color: string; label: string; desc: string }> = {
  start: { icon: <Play className="w-4 h-4" />, color: 'bg-success', label: 'Start', desc: 'Input node' },
  end: { icon: <Check className="w-4 h-4" />, color: 'bg-error', label: 'End', desc: 'Output node' },
  llm: { icon: <Brain className="w-4 h-4" />, color: 'bg-primary', label: 'LLM', desc: 'AI model call' },
  knowledge: { icon: <Search className="w-4 h-4" />, color: 'bg-[color:hsl(var(--accent-cool-solid-hsl))]', label: 'Knowledge', desc: 'RAG retrieval' },
  code: { icon: <Code className="w-4 h-4" />, color: 'bg-nk-warm-600', label: 'Code', desc: 'JavaScript execution' },
  http: { icon: <Globe className="w-4 h-4" />, color: 'bg-nk-warm-600', label: 'HTTP', desc: 'API call' },
  ocr: { icon: <Scan className="w-4 h-4" />, color: 'bg-success', label: 'OCR', desc: 'Document scanning' },
  condition: { icon: <GitBranch className="w-4 h-4" />, color: 'bg-primary', label: 'Condition', desc: 'If/else branch' },
  loop: { icon: <RefreshCw className="w-4 h-4" />, color: 'bg-primary', label: 'Loop', desc: 'Iterate items' },
  transform: { icon: <Zap className="w-4 h-4" />, color: 'bg-[color:hsl(var(--accent-cool-solid-hsl))]', label: 'Transform', desc: 'Data transform' },
  memory: { icon: <FileText className="w-4 h-4" />, color: 'bg-nk-warm-600', label: 'Memory', desc: 'Store/retrieve' },
  notification: { icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-primary', label: 'Notify', desc: 'Send notification' },
  pdf: { icon: <FileText className="w-4 h-4" />, color: 'bg-muted', label: 'PDF', desc: 'PDF processing' },
  flashcard: { icon: <Zap className="w-4 h-4" />, color: 'bg-primary', label: 'Flashcard', desc: 'Generate flashcards' },
  quiz: { icon: <Brain className="w-4 h-4" />, color: 'bg-success', label: 'Quiz', desc: 'Generate quiz' },
  summarize: { icon: <FileText className="w-4 h-4" />, color: 'bg-[color:hsl(var(--accent-cool-solid-hsl))]', label: 'Summarize', desc: 'Summarize content' },
  translate: { icon: <Globe className="w-4 h-4" />, color: 'bg-success', label: 'Translate', desc: 'Translate text' },
  agent: { icon: <Brain className="w-4 h-4" />, color: 'bg-primary', label: 'Agent', desc: 'Sub-agent' },
};

// ============================================================
// Component
// ============================================================

export const WorkflowCanvas: React.FC<{
  onClose?: () => void;
  onRun?: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
}> = ({ onClose, onRun }) => {
  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: 'node-1', type: 'start', label: 'Start', x: 100, y: 200, config: {}, status: 'idle' },
  ]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showNodePicker, setShowNodePicker] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const addNode = useCallback((type: CanvasNodeType) => {
    const config = NODE_CONFIG[type];
    const id = `node-${Date.now()}`;
    setNodes(prev => [...prev, {
      id,
      type,
      label: config.label,
      x: 200 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      config: {},
      status: 'idle',
    }]);
    setShowNodePicker(false);
    toast.success(`${config.label} node added!`);
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    if (selectedNode === id) setSelectedNode(null);
  }, [selectedNode]);

  const connectNodes = useCallback((from: string, to: string) => {
    if (from === to) return;
    const exists = edges.some(e => e.from === from && e.to === to);
    if (exists) return;
    setEdges(prev => [...prev, { id: `edge-${Date.now()}`, from, to }]);
    setConnectingFrom(null);
    toast.success('Connected! 🔗');
  }, [edges]);

  // Mouse/touch drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNode(nodeId);
    setSelectedNode(nodeId);
    setDragOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNode) return;
    setNodes(prev => prev.map(n =>
      n.id === draggingNode
        ? { ...n, x: Math.max(0, e.clientX - dragOffset.x), y: Math.max(0, e.clientY - dragOffset.y) }
        : n
    ));
  }, [draggingNode, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  // Touch drag handling
  const handleTouchStart = useCallback((e: React.TouchEvent, nodeId: string) => {
    const touch = e.touches[0];
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNode(nodeId);
    setSelectedNode(nodeId);
    setDragOffset({ x: touch.clientX - node.x, y: touch.clientY - node.y });
  }, [nodes]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggingNode) return;
    const touch = e.touches[0];
    setNodes(prev => prev.map(n =>
      n.id === draggingNode
        ? { ...n, x: Math.max(0, touch.clientX - dragOffset.x), y: Math.max(0, touch.clientY - dragOffset.y) }
        : n
    ));
  }, [draggingNode, dragOffset]);

  const handleTouchEnd = useCallback(() => {
    setDraggingNode(null);
  }, []);

  const handleRun = useCallback(() => {
    // Mark all nodes as running then done
    setNodes(prev => prev.map(n => ({ ...n, status: 'running' as const })));
    setTimeout(() => {
      setNodes(prev => prev.map(n => ({ ...n, status: 'done' as const })));
      toast.success('Workflow completed! ✅');
      onRun?.(nodes, edges);
    }, 2000);
  }, [nodes, edges, onRun]);

  // Render edges as SVG lines
  const renderEdges = () => (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
      {edges.map(edge => {
        const from = nodes.find(n => n.id === edge.from);
        const to = nodes.find(n => n.id === edge.to);
        if (!from || !to) return null;
        return (
          <g key={edge.id}>
            <line
              x1={from.x + 80} y1={from.y + 24}
              x2={to.x} y2={to.y + 24}
              className="stroke-primary/40"
              strokeWidth={2}
              strokeDasharray="6 3"
            />
            <circle cx={to.x} cy={to.y + 24} r={4} className="fill-primary" />
          </g>
        );
      })}
      {/* Connecting line from selected */}
      {connectingFrom && (
        <circle
          cx={nodes.find(n => n.id === connectingFrom)?.x || 0}
          cy={(nodes.find(n => n.id === connectingFrom)?.y || 0) + 24}
          r={8}
          className="fill-primary animate-pulse"
        />
      )}
    </svg>
  );

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-rose" />
          <span className="font-semibold text-sm">Workflow Builder</span>
          <span className="text-xs text-muted-foreground">{nodes.length} nodes</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNodePicker(true)} className="gap-1 text-xs rounded-lg">
            <Plus className="w-3.5 h-3.5" /> Add Node
          </Button>
          <Button size="sm" onClick={handleRun} className="gap-1 text-xs rounded-lg bg-gradient-to-r from-primary to-nk-rose">
            <Play className="w-3.5 h-3.5" /> Run
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-[radial-gradient(circle,_#e5e7eb_1px,_transparent_1px)] bg-[size:20px_20px]"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => { setSelectedNode(null); setConnectingFrom(null); }}
        >
          {renderEdges()}

          {/* Nodes */}
          {nodes.map(node => {
            const config = NODE_CONFIG[node.type];
            const isSelected = selectedNode === node.id;
            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1, x: node.x, y: node.y }}
                className={cn(
                  "absolute z-10 cursor-grab active:cursor-grabbing",
                  isSelected && "z-20"
                )}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onTouchStart={(e) => handleTouchStart(e, node.id)}
                onClick={(e) => { e.stopPropagation(); setSelectedNode(node.id); }}
              >
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border-2 shadow-md min-w-[160px] transition-all",
                  isSelected ? "border-primary shadow-lg shadow-primary/20" : "border-border/50 hover:border-primary/40",
                  node.status === 'running' && "border-[color:hsl(var(--accent-warm-hsl)/0.34)] animate-pulse",
                  node.status === 'done' && "border-[color:hsl(var(--success)/0.4)]",
                  node.status === 'error' && "border-[color:hsl(var(--error)/0.4)]",
                  "bg-surface/95 backdrop-blur-sm"
                )}>
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0", config.color)}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{node.label}</div>
                    <div className="text-[9px] text-muted-foreground truncate">{config.desc}</div>
                  </div>
                  {node.status === 'running' && <Loader2 className="w-3 h-3 text-accent-warm animate-spin" />}
                  {node.status === 'done' && <Check className="w-3 h-3 text-success" />}
                  {/* Connect handle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (connectingFrom === node.id) {
                        setConnectingFrom(null);
                      } else if (connectingFrom) {
                        connectNodes(connectingFrom, node.id);
                      } else {
                        setConnectingFrom(node.id);
                        toast.info('Click another node to connect 🔗');
                      }
                    }}
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                      connectingFrom === node.id ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"
                    )}
                    title="Connect to another node"
                  />
                </div>
              </motion.div>
            );
          })}

          {/* Empty state */}
          {nodes.length <= 1 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-muted-foreground/40">
                <Zap className="w-12 h-12 mx-auto mb-3" />
                <p className="text-sm font-medium">Add nodes to build your workflow</p>
                <p className="text-xs mt-1">Click "Add Node" to get started</p>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar — node config */}
        {selectedNodeData && (
          <div className="w-[240px] border-l border-border/30 bg-surface/50 backdrop-blur-sm p-3 overflow-y-auto flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold">Node Config</span>
              <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Label</label>
                <input
                  className="w-full mt-0.5 px-2 py-1 text-xs rounded-lg border border-border/50 bg-surface/50"
                  value={selectedNodeData.label}
                  onChange={(e) => setNodes(prev => prev.map(n =>
                    n.id === selectedNode ? { ...n, label: e.target.value } : n
                  ))}
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Type</label>
                <div className="mt-0.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50 text-xs">
                  <div className={cn("w-5 h-5 rounded flex items-center justify-center text-white", NODE_CONFIG[selectedNodeData.type].color)}>
                    {NODE_CONFIG[selectedNodeData.type].icon}
                  </div>
                  {NODE_CONFIG[selectedNodeData.type].label}
                </div>
              </div>

              {/* Connections info */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">Connections</label>
                <div className="mt-0.5 text-xs space-y-0.5">
                  {edges.filter(e => e.from === selectedNode).map(e => {
                    const target = nodes.find(n => n.id === e.to);
                    return (
                      <div key={e.id} className="flex items-center gap-1 text-muted-foreground">
                        <ArrowRight className="w-3 h-3" /> {target?.label || 'Unknown'}
                      </div>
                    );
                  })}
                  {edges.filter(e => e.from === selectedNode).length === 0 && (
                    <div className="text-muted-foreground/50">No outgoing connections</div>
                  )}
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteNode(selectedNode)}
                className="w-full text-xs gap-1"
                disabled={selectedNodeData.type === 'start'}
              >
                <Trash2 className="w-3 h-3" /> Delete Node
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Node picker modal */}
      <AnimatePresence>
        {showNodePicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[color:var(--nk-scrim)] z-50"
              onClick={() => setShowNodePicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-surface/95 backdrop-blur-xl rounded-2xl border border-border/30 shadow-2xl p-4 w-[90vw] max-w-[500px]"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Add Workflow Node</h3>
                <button onClick={() => setShowNodePicker(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
                {Object.entries(NODE_CONFIG).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => addNode(type as CanvasNodeType)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-center"
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", config.color)}>
                      {config.icon}
                    </div>
                    <span className="text-[10px] font-medium">{config.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
