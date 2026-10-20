import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Wand2, FileText, BookOpen, PenTool, X, ChartLine } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { NikAIMark } from './nikai/NikAIBrand';
import { markdownToStructuredLines, stripMarkdownNoise, type StructuredLine } from '@/lib/noteStructure';
import { GRAPH_PRESETS, encodeGraphSpec, graphLabel, type GraphSpec } from '@/lib/noteGraphs';

interface AIWritingAssistantProps {
  onInsertText: (text: string) => void;
  /** Preferred path: insert properly structured (organised) note lines. */
  onInsertStructured?: (lines: StructuredLine[]) => void;
  currentText?: string;
  locked?: boolean;
  onLockedTap?: () => void;
}

type AssistMode = 'expand' | 'summarize' | 'improve' | 'generate' | 'graph';

const GRAPH_COLORS = ['#7c3aed', '#2563eb', '#059669', '#e11d48', '#d97706'];

export const AIWritingAssistant: React.FC<AIWritingAssistantProps> = ({
  onInsertText,
  onInsertStructured,
  currentText = '',
  locked = false,
  onLockedTap,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [selectedMode, setSelectedMode] = useState<AssistMode>('generate');

  // Graph builder state
  const [graphPreset, setGraphPreset] = useState(GRAPH_PRESETS[0]);
  const [graphAmp, setGraphAmp] = useState(String(GRAPH_PRESETS[0].spec.amp ?? 1));
  const [graphFreq, setGraphFreq] = useState(String(GRAPH_PRESETS[0].spec.freq ?? 1));
  const [graphC, setGraphC] = useState(String(GRAPH_PRESETS[0].spec.c ?? 0));
  const [graphColor, setGraphColor] = useState(GRAPH_COLORS[0]);

  const modes = useMemo(
    () => [
      { id: 'generate' as const, label: 'Generate', icon: Wand2, desc: 'Create new content from a topic' },
      { id: 'expand' as const, label: 'Expand', icon: FileText, desc: 'Add more detail to your notes' },
      { id: 'summarize' as const, label: 'Summarize', icon: BookOpen, desc: 'Turn text into short notes' },
      { id: 'improve' as const, label: 'Improve', icon: PenTool, desc: 'Fix grammar and clarity' },
      { id: 'graph' as const, label: 'Insert graph', icon: ChartLine, desc: 'Real function graph in your notes' },
    ],
    []
  );

  const getSystemPrompt = (mode: AssistMode): string => {
    switch (mode) {
      case 'expand':
        return 'You are a writing assistant. Expand and add more details to the given text while maintaining the original meaning and style. Write naturally as if handwritten.';
      case 'summarize':
        return 'You are a writing assistant. Summarize the given text into a concise version while keeping the key points. Write naturally as if for handwritten notes.';
      case 'improve':
        return 'You are a writing assistant. Improve the given text by fixing grammar, enhancing clarity, and making it flow better. Keep it natural and suitable for handwritten notes.';
      case 'generate':
        return "You are a creative writing assistant. Generate content based on the user's prompt. Write naturally, as if creating handwritten notes. Keep paragraphs short and scannable. Format with clean markdown: # headings, - bullets, 1. steps, and $...$ for equations.";
      default:
        return '';
    }
  };

  /** Insert into the active note — structured when supported, cleaned plain text otherwise. */
  const insertIntoNote = (text: string) => {
    if (onInsertStructured) {
      onInsertStructured(markdownToStructuredLines(text));
    } else {
      onInsertText(stripMarkdownNoise(text));
    }
  };

  const handleAssist = async () => {
    const inputText = selectedMode === 'generate' ? prompt : currentText;

    if (selectedMode !== 'graph') {
      if (!inputText.trim()) {
        toast.error(selectedMode === 'generate' ? 'Please enter a topic or prompt' : 'No text to work with — write something first');
        return;
      }
    }

    setIsLoading(true);
    setResult('');

    try {
      const { streamAstaAI } = await import('@/lib/aiEngine');
      const actionMap = {
        expand: 'lengthen',
        summarize: 'summarize',
        improve: 'improve',
        generate: 'custom',
        graph: 'custom',
      } as const;

      const response = await streamAstaAI({
        messages: [
          { role: 'system', content: getSystemPrompt(selectedMode) },
          { role: 'user', content: inputText },
        ],
        mode: selectedMode === 'generate' ? 'notes' : 'write',
        action: actionMap[selectedMode],
        onToken: (_delta, fullText) => setResult(fullText),
      });

      if (response.content) {
        setResult(response.content);
        toast.success('AI content generated!');
      }
    } catch (error) {
      console.error('AI assist error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get AI assistance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsert = () => {
    if (selectedMode === 'graph') { handleInsertGraph(); return; }
    if (!result) return;

    insertIntoNote(result);
    setResult('');
    setPrompt('');
    toast.success('Text inserted into notes!');
    setIsOpen(false);
  };

  const handleInsertGraph = () => {
    const base = graphPreset.spec;
    const amp = Number(graphAmp) || 1;
    const freq = Number(graphFreq) || 1;
    const c = Number(graphC) || 0;
    const spec: GraphSpec = {
      fn: graphPreset.id,
      amp, freq, c,
      xMin: base.xMin!, xMax: base.xMax!, yMin: base.yMin!, yMax: base.yMax!,
      label: graphLabel({ fn: graphPreset.id, amp, freq, c }),
      color: graphColor,
    };
    if (onInsertStructured) {
      onInsertStructured([{ text: encodeGraphSpec(spec), blockType: 'graph', color: 'purple', indent: 0 }]);
      toast.success('Graph inserted into your notes!');
    } else {
      onInsertText(spec.label);
      toast.info('Graph needs the structured notes editor — inserted the formula instead.');
    }
    setIsOpen(false);
  };

  const pickPreset = (p: typeof GRAPH_PRESETS[number]) => {
    setGraphPreset(p);
    setGraphAmp(String(p.spec.amp ?? 1));
    setGraphFreq(String(p.spec.freq ?? 1));
    setGraphC(String(p.spec.c ?? 0));
  };

  const isGraphMode = selectedMode === 'graph';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          title={locked ? "Premium feature" : "AI Writing Assistant"}
          onClick={(e) => {
            if (!locked) return;
            e.preventDefault();
            e.stopPropagation();
            onLockedTap?.();
          }}
        >
          <NikAIMark size={18} />
          <span className="sr-only">AI Writing Assistant</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <motion.span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4F1FC]"
              animate={isLoading ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={isLoading ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
            >
              <NikAIMark size={22} />
            </motion.span>
            AI Writing Assistant
          </DialogTitle>
          <DialogDescription>
            {isGraphMode
              ? 'Pick a function, tune it, and insert a real graph into your notes.'
              : 'Generate, expand, summarize, or improve text — inserted into your notes as clean, organised content.'}
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-2">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setSelectedMode(mode.id)}
              className={
                `
                flex items-start gap-3 rounded-xl border p-3 text-left transition-all
                ${selectedMode === mode.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/40'}
              `
              }
            >
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                <mode.icon className="h-4 w-4 text-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{mode.label}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">{mode.desc}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Graph builder */}
        {isGraphMode ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Function</p>
              <div className="grid grid-cols-3 gap-1.5">
                {GRAPH_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickPreset(p)}
                    className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${graphPreset.id === p.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/40'}`}
                  >
                    <span className="block text-xs font-semibold">{p.label}</span>
                    <span className="block text-[10px] text-muted-foreground font-mono">{p.formula}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'A (scale)', value: graphAmp, set: setGraphAmp },
                { label: 'B (freq)', value: graphFreq, set: setGraphFreq },
                { label: 'C (shift)', value: graphC, set: setGraphC },
              ].map(f => (
                <label key={f.label} className="block">
                  <span className="text-[11px] font-medium text-muted-foreground">{f.label}</span>
                  <input
                    inputMode="decimal"
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">Ink</span>
              {GRAPH_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Graph ink ${c}`}
                  onClick={() => setGraphColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${graphColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        ) : (
          /* Input */
          <div className="space-y-2">
            {selectedMode === 'generate' ? (
              <>
                <p className="text-xs font-medium text-foreground">Topic / prompt</p>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Example: Explain photosynthesis in simple bullet points"
                  className="min-h-[90px] text-sm resize-none"
                />
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-foreground">Working with</p>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs whitespace-pre-wrap text-foreground line-clamp-5">{currentText || 'No text yet — write something first.'}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Action */}
        <Button onClick={isGraphMode ? handleInsertGraph : handleAssist} disabled={isLoading} className="w-full gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isGraphMode ? <ChartLine className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
          {isLoading ? 'Working…' : isGraphMode ? 'Insert graph into notes' : `${modes.find((m) => m.id === selectedMode)?.label} with AI`}
        </Button>

        {/* Result */}
        {!isGraphMode && (
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-2"
              >
                <div className="rounded-xl border border-border/60 bg-background p-3 max-h-[200px] overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap text-foreground">{result}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleInsert} className="flex-1">Insert into notes</Button>
                  <Button size="sm" variant="outline" onClick={() => setIsOpen(false)}><X className="w-4 h-4" /></Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AIWritingAssistant;
