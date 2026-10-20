import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Sparkles, Wand2, FileText, BookOpen, PenTool, X } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { NikAIMarkIcon } from '@/components/nikai/NikAIBrand';

interface AIWritingAssistantProps {
  onInsertText: (text: string) => void;
  currentText?: string;
  locked?: boolean;
  onLockedTap?: () => void;
}

type AssistMode = 'expand' | 'summarize' | 'improve' | 'generate';

export const AIWritingAssistant: React.FC<AIWritingAssistantProps> = ({
  onInsertText,
  currentText = '',
  locked = false,
  onLockedTap,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [selectedMode, setSelectedMode] = useState<AssistMode>('generate');

  const modes = useMemo(
    () => [
      { id: 'generate' as const, label: 'Generate', icon: Wand2, desc: 'Create new content from a topic' },
      { id: 'expand' as const, label: 'Expand', icon: FileText, desc: 'Add more detail to your notes' },
      { id: 'summarize' as const, label: 'Summarize', icon: BookOpen, desc: 'Turn text into short notes' },
      { id: 'improve' as const, label: 'Improve', icon: PenTool, desc: 'Fix grammar and clarity' },
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
        return "You are a creative writing assistant. Generate content based on the user's prompt. Write naturally, as if creating handwritten notes. Keep paragraphs short and scannable.";
    }
  };

  const handleAssist = async () => {
    const inputText = selectedMode === 'generate' ? prompt : currentText;

    if (!inputText.trim()) {
      toast.error(selectedMode === 'generate' ? 'Please enter a topic or prompt' : 'No text to work with — write something first');
      return;
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
    if (!result) return;

    onInsertText(result);
    setResult('');
    setPrompt('');
    toast.success('Text inserted into notes!');
    setIsOpen(false);
  };

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
          <NikAIMarkIcon className="w-[20px] h-4" />
          <span className="sr-only">AI Writing Assistant</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-8 w-10 items-center justify-center rounded-xl bg-primary/10">
              <NikAIMarkIcon className="w-[26px] h-[15px]" />
            </span>
            NikAI Writing Assistant
          </DialogTitle>
          <DialogDescription>Generate, expand, summarize, or improve text — then insert it into your handwritten notes.</DialogDescription>
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

        {/* Input */}
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

        {/* Action */}
        <Button onClick={handleAssist} disabled={isLoading} className="w-full gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {isLoading ? 'Working…' : `${modes.find((m) => m.id === selectedMode)?.label} with AI`}
        </Button>

        {/* Result */}
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
                <Button onClick={handleInsert} size="sm" className="flex-1 gap-2">
                  <FileText className="w-4 h-4" />
                  Insert into Notes
                </Button>
                <Button
                  onClick={() => setResult('')}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  title="Clear"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
