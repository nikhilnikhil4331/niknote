import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Circle, Rect, Line } from 'fabric';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Pencil, 
  Circle as CircleIcon, 
  Square, 
  Minus, 
  Eraser, 
  Trash2, 
  Download,
  MousePointer,
  Undo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DrawingToolProps {
  onSaveDrawing: (dataUrl: string) => void;
  inkColor: string;
}

type DrawingToolType = 'select' | 'pencil' | 'line' | 'rectangle' | 'circle' | 'eraser';

const COLORS = [
  { name: 'Blue', value: '#1e40af' },
  { name: 'Black', value: '#1f2937' },
  { name: 'Red', value: '#A62B36' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Purple', value: '#7C5F9E' },
  { name: 'Brown', value: '#92400e' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Orange', value: '#ea580c' },
];

export const DrawingTool: React.FC<DrawingToolProps> = ({ onSaveDrawing, inkColor }) => {
  const [open, setOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<DrawingToolType>('pencil');
  const [brushSize, setBrushSize] = useState(3);
  const [activeColor, setActiveColor] = useState(COLORS[0].value);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const historyRef = useRef<string[]>([]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;

    // Small delay to ensure dialog is fully rendered
    const timer = setTimeout(() => {
      if (!canvasRef.current) return;
      
      const canvas = new FabricCanvas(canvasRef.current, {
        width: 560,
        height: 400,
        backgroundColor: '#fffef7',
        isDrawingMode: true,
      });

      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = brushSize;

      fabricRef.current = canvas;

      // Save initial state
      historyRef.current = [JSON.stringify(canvas.toJSON())];

      // Track changes for undo
      canvas.on('object:added', () => {
        historyRef.current.push(JSON.stringify(canvas.toJSON()));
      });

      return () => {
        canvas.dispose();
        fabricRef.current = null;
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = activeTool === 'eraser' ? '#fffef7' : activeColor;
        canvas.freeDrawingBrush.width = activeTool === 'eraser' ? brushSize * 3 : brushSize;
      }
    } else {
      canvas.isDrawingMode = false;
    }
  }, [activeTool, activeColor, brushSize]);

  const handleToolClick = useCallback((tool: DrawingToolType) => {
    setActiveTool(tool);

    if (!fabricRef.current) return;
    const canvas = fabricRef.current;

    if (tool === 'rectangle') {
      const rect = new Rect({
        left: 100 + Math.random() * 200,
        top: 100 + Math.random() * 100,
        fill: 'transparent',
        stroke: activeColor,
        strokeWidth: brushSize,
        width: 80,
        height: 60,
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
    } else if (tool === 'circle') {
      const circle = new Circle({
        left: 100 + Math.random() * 200,
        top: 100 + Math.random() * 100,
        fill: 'transparent',
        stroke: activeColor,
        strokeWidth: brushSize,
        radius: 40,
      });
      canvas.add(circle);
      canvas.setActiveObject(circle);
    } else if (tool === 'line') {
      const line = new Line([50, 50, 200, 50], {
        left: 100 + Math.random() * 200,
        top: 100 + Math.random() * 100,
        stroke: activeColor,
        strokeWidth: brushSize,
      });
      canvas.add(line);
      canvas.setActiveObject(line);
    }
  }, [activeColor, brushSize]);

  const handleClear = useCallback(() => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = '#fffef7';
    fabricRef.current.renderAll();
    historyRef.current = [JSON.stringify(fabricRef.current.toJSON())];
    toast.success('Canvas cleared');
  }, []);

  const handleUndo = useCallback(() => {
    if (!fabricRef.current || historyRef.current.length <= 1) return;
    
    historyRef.current.pop();
    const previousState = historyRef.current[historyRef.current.length - 1];
    
    fabricRef.current.loadFromJSON(JSON.parse(previousState)).then(() => {
      fabricRef.current?.renderAll();
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!fabricRef.current) return;
    
    const dataUrl = fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    
    onSaveDrawing(dataUrl);
    setOpen(false);
    toast.success('Drawing added to document');
  }, [onSaveDrawing]);

  const tools: { tool: DrawingToolType; icon: React.ReactNode; label: string }[] = [
    { tool: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select' },
    { tool: 'pencil', icon: <Pencil className="w-4 h-4" />, label: 'Pencil' },
    { tool: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
    { tool: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
    { tool: 'circle', icon: <CircleIcon className="w-4 h-4" />, label: 'Circle' },
    { tool: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2" type="button">
          <Pencil className="w-4 h-4" />
          Open Drawing Tool
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Draw Diagram</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border">
          {/* Tools */}
          <div className="flex gap-1">
            {tools.map(({ tool, icon, label }) => (
              <Button
                key={tool}
                variant={activeTool === tool ? 'default' : 'outline'}
                size="icon"
                type="button"
                onClick={() => handleToolClick(tool)}
                title={label}
                className="h-9 w-9"
              >
                {icon}
              </Button>
            ))}
          </div>

          <div className="w-px h-8 bg-border mx-1" />

          {/* Colors */}
          <div className="flex gap-1">
            {COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setActiveColor(color.value)}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                  activeColor === color.value ? 'border-primary scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>

          <div className="w-px h-8 bg-border mx-1" />

          {/* Actions */}
          <Button variant="outline" size="icon" type="button" onClick={handleUndo} title="Undo" className="h-9 w-9">
            <Undo className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" type="button" onClick={handleClear} title="Clear" className="h-9 w-9">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Brush Size */}
        <div className="flex items-center gap-3 py-2">
          <Label className="text-sm w-24">Brush: {brushSize}px</Label>
          <Slider
            value={[brushSize]}
            onValueChange={([value]) => setBrushSize(value)}
            min={1}
            max={20}
            step={1}
            className="flex-1"
          />
        </div>

        {/* Canvas */}
        <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
          <canvas ref={canvasRef} />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} className="gap-2">
            <Download className="w-4 h-4" />
            Add to Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
