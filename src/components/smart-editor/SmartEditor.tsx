// ============================================================
// NikNote 4.0 — Smart Editor Suggestions
// Real-time proactive suggestions while typing:
// headings, missing points, formulas, exam questions
// ============================================================

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, BookOpen, Brain, Target, FileText,
  Lightbulb, AlertTriangle, ChevronRight, X, Wand2, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';

// ============================================================
// Types
// ============================================================

export interface EditorSuggestion {
  id: string;
  type: 'heading' | 'missing_point' | 'formula' | 'exam_question' | 'structure' | 'improvement';
  label: string;
  description: string;
  insertText?: string;
  icon: React.ReactNode;
  priority: number; // 1-5, lower = more important
}

interface SmartEditorProps {
  // Current text in editor
  currentText: string;
  // Called when suggestion is accepted
  onAccept: (suggestion: EditorSuggestion) => void;
  // Called when suggestion is dismissed
  onDismiss?: (suggestionId: string) => void;
  // Whether editor is focused
  isFocused?: boolean;
  // Current topic (if known)
  topic?: string;
}

// ============================================================
// Local Pattern Matching for Fast Suggestions
// ============================================================

const HEADING_PATTERNS = [
  { regex: /^(chapter|unit|topic|section)\s+\d+/i, suggestion: 'Add Chapter Title Heading', type: 'heading' as const },
  { regex: /introduction/i, suggestion: 'Add Introduction Section', type: 'heading' as const },
  { regex: /conclusion|summary/i, suggestion: 'Add Conclusion Section', type: 'heading' as const },
  { regex: /definition|define/i, suggestion: 'Add Definition Box', type: 'heading' as const },
];

const FORMULA_PATTERNS = [
  { regex: /speed|velocity|acceleration/i, formulas: ['v = u + at', 's = ut + ½at²', 'v² = u² + 2as'] },
  { regex: /force|newton/i, formulas: ['F = ma', 'F = G(m₁m₂)/r²', 'W = F·d·cosθ'] },
  { regex: /energy|work|power/i, formulas: ['KE = ½mv²', 'PE = mgh', 'P = W/t'] },
  { regex: /momentum/i, formulas: ['p = mv', 'F = Δp/Δt', 'm₁v₁ = m₂v₂'] },
  { regex: /area|volume|perimeter/i, formulas: ['A = πr²', 'V = 4/3πr³', 'C = 2πr'] },
  { regex: /probability/i, formulas: ['P(A) = n(A)/n(S)', 'P(A∪B) = P(A) + P(B) - P(A∩B)'] },
  { regex: /ohm|resistance|current|voltage/i, formulas: ['V = IR', 'P = VI', 'R = ρL/A'] },
  { regex: /photosynthesis/i, formulas: ['6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂'] },
  { regex: /pythagor/i, formulas: ['a² + b² = c²'] },
  { regex: /quadratic/i, formulas: ['x = (-b ± √(b²-4ac)) / 2a'] },
];

const EXAM_TOPICS: Record<string, string[]> = {
  physics: ['Derive the equation of motion', 'State Newton\'s Laws with examples', 'Explain conservation of energy'],
  chemistry: ['Write the electronic configuration', 'Balance the chemical equation', 'Explain the periodic trend'],
  biology: ['Draw and label the diagram', 'Explain the process step-by-step', 'Compare and contrast'],
  math: ['Prove that...', 'Solve for x', 'Find the area/volume'],
};

// ============================================================
// Suggestion Generator (local, instant)
// ============================================================

function generateLocalSuggestions(text: string, topic?: string): EditorSuggestion[] {
  const suggestions: EditorSuggestion[] = [];
  const lower = text.toLowerCase();
  let id = 0;

  // Check for heading patterns
  for (const pattern of HEADING_PATTERNS) {
    if (pattern.regex.test(text)) {
      suggestions.push({
        id: `sug-heading-${id++}`,
        type: pattern.type,
        label: pattern.suggestion,
        description: 'Structure your notes better with clear sections',
        icon: <BookOpen className="w-3.5 h-3.5" />,
        priority: 2,
      });
    }
  }

  // Check for formula suggestions
  for (const pattern of FORMULA_PATTERNS) {
    if (pattern.regex.test(lower)) {
      pattern.formulas.forEach((formula, i) => {
        suggestions.push({
          id: `sug-formula-${id++}`,
          type: 'formula',
          label: `Add Formula: ${formula}`,
          description: 'Important formula related to your topic',
          insertText: `\n${formula}\n`,
          icon: <Zap className="w-3.5 h-3.5" />,
          priority: 1,
        });
      });
    }
  }

  // Check if text is long enough for structure suggestions
  if (text.length > 200 && !lower.includes('example') && !lower.includes('e.g.')) {
    suggestions.push({
      id: `sug-example-${id++}`,
      type: 'missing_point',
      label: 'Add Examples',
      description: 'Examples make concepts easier to remember',
      insertText: '\n📝 Example: ',
      icon: <Lightbulb className="w-3.5 h-3.5" />,
      priority: 3,
    });
  }

  // Check if text is long but no exam tips
  if (text.length > 300 && !lower.includes('exam tip') && !lower.includes('important') && !lower.includes('⚠️')) {
    suggestions.push({
      id: `sug-exam-${id++}`,
      type: 'exam_question',
      label: 'Add Exam Tips',
      description: 'Mark important points for revision',
      insertText: '\n⚠️ Exam Tip: ',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      priority: 2,
    });
  }

  // Structure suggestion for long text without headings
  if (text.length > 500 && !text.match(/^#{1,3}\s/m)) {
    suggestions.push({
      id: `sug-structure-${id++}`,
      type: 'structure',
      label: 'Add Structure',
      description: 'Break your notes into sections with headings',
      insertText: '\n## ',
      icon: <FileText className="w-3.5 h-3.5" />,
      priority: 4,
    });
  }

  // Topic-specific suggestions
  if (topic) {
    const topicLower = topic.toLowerCase();
    for (const [key, examQs] of Object.entries(EXAM_TOPICS)) {
      if (topicLower.includes(key)) {
        examQs.slice(0, 2).forEach((q, i) => {
          suggestions.push({
            id: `sug-topic-${id++}`,
            type: 'exam_question',
            label: q,
            description: 'Common exam question for this topic',
            insertText: `\n🎯 ${q}\n`,
            icon: <Target className="w-3.5 h-3.5" />,
            priority: 3,
          });
        });
        break;
      }
    }
  }

  // Sort by priority
  return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// Using useDebounce from @/hooks/useDebounce

// ============================================================
// Smart Editor Component
// ============================================================

export const SmartEditor: React.FC<SmartEditorProps> = ({
  currentText,
  onAccept,
  onDismiss,
  isFocused = true,
  topic,
}) => {
  const [suggestions, setSuggestions] = useState<EditorSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const prevTextRef = useRef('');
  const lastSuggestionTime = useRef(0);

  // Debounce text to avoid computing suggestions on every keystroke
  const debouncedText = useDebounce(currentText, 800);

  // Generate suggestions when text changes
  useEffect(() => {
    if (!debouncedText || debouncedText.length < 20) {
      setSuggestions([]);
      return;
    }

    // Throttle: don't suggest more than once every 2 seconds
    const now = Date.now();
    if (now - lastSuggestionTime.current < 2000) return;
    lastSuggestionTime.current = now;

    // Only regenerate if text actually changed significantly
    if (Math.abs(debouncedText.length - prevTextRef.current.length) < 10) return;
    prevTextRef.current = debouncedText;

    const newSuggestions = generateLocalSuggestions(debouncedText, topic);
    setSuggestions(newSuggestions.filter(s => !dismissedIds.has(s.id)));
  }, [debouncedText, topic, dismissedIds]);

  // Handle accept
  const handleAccept = useCallback((suggestion: EditorSuggestion) => {
    onAccept(suggestion);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, [onAccept]);

  // Handle dismiss
  const handleDismiss = useCallback((suggestionId: string) => {
    setDismissedIds(prev => new Set([...prev, suggestionId]));
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    onDismiss?.(suggestionId);
  }, [onDismiss]);

  // Don't render if no suggestions
  if (suggestions.length === 0 || !isFocused) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-warm" />
          <span className="text-xs font-semibold">Smart Suggestions</span>
          <span className="text-[10px] bg-primary/10 text-accent-rose px-1.5 py-0.5 rounded-full font-medium">
            {suggestions.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Suggestions */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-1">
              {suggestions.map((suggestion) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 group transition-colors"
                >
                  <div className="mt-0.5 text-muted-foreground shrink-0">
                    {suggestion.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{suggestion.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {suggestion.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleAccept(suggestion)}
                      className="p-1 rounded-md bg-primary/10 text-accent-rose hover:bg-primary/20 transition-colors"
                      title="Accept"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDismiss(suggestion.id)}
                      className="p-1 rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SmartEditor;
