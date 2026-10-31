import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Type } from 'lucide-react';

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const TextEditor: React.FC<TextEditorProps> = ({ value, onChange }) => {
  const lines = value.split('\n').length;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="section-icon">
            <Edit3 className="w-4 h-4 text-accent-rose" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Text Editor</h3>
            <p className="text-[11px] text-muted-foreground">Write or paste your content</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Type className="w-3.5 h-3.5" />
          <span>{value.length} chars</span>
        </div>
        <div className="w-1 h-1 rounded-full bg-border" />
        <span className="text-xs text-muted-foreground">{words} words</span>
        <div className="w-1 h-1 rounded-full bg-border" />
        <span className="text-xs text-muted-foreground">{lines} lines</span>
      </div>

      {/* Textarea */}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing your notes here...

You can write multiple lines.
Each line will be rendered in your chosen handwriting style.

Try adjusting the settings to customize the look!"
        className="flex-1 resize-none text-[15px] leading-relaxed font-sans bg-secondary/30 border-border/60 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/40 min-h-[320px] rounded-xl p-4 placeholder:text-muted-foreground/60 transition-all duration-200"
      />

      {/* Helper text */}
      <p className="text-[11px] text-muted-foreground mt-3 text-center">
        Pro tip: Use line breaks for new handwritten lines
      </p>
    </div>
  );
};
