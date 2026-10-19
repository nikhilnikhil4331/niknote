// ============================================================
// NikNote 4.0 — AI 4.0 Page Component
// Lightning-fast, agent-based AI with teacher personality
// Replaces the old slow AI Solver
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  aiOrchestrator, AgentType, AgentResponse, AgentAction,
  Flashcard, QuizQuestion, MindMapNode
} from '@/agents/orchestrator';
import {
  BookOpen, Brain, Target, FileText, Lightbulb, Sparkles,
  Send, Loader2, RotateCcw, Copy, Check, ChevronRight,
  Zap, GraduationCap, Pen, BarChart3, Clock, MessageCircle,
  Briefcase, HelpCircle, Calendar, FileSearch, Upload,
  ArrowLeft, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderBoldSegments } from '@/lib/richText';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Agent metadata
const AGENTS: { type: AgentType; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { type: 'teacher', label: 'Teacher', icon: <GraduationCap className="w-4 h-4" />, color: 'from-blue-500 to-indigo-600', desc: 'Explains concepts' },
  { type: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" />, color: 'from-green-500 to-emerald-600', desc: 'Creates notes' },
  { type: 'research', label: 'Research', icon: <FileSearch className="w-4 h-4" />, color: 'from-purple-500 to-violet-600', desc: 'Finds information' },
  { type: 'diagram', label: 'Diagram', icon: <BarChart3 className="w-4 h-4" />, color: 'from-orange-500 to-red-500', desc: 'Visual aids' },
  { type: 'revision', label: 'Revision', icon: <Clock className="w-4 h-4" />, color: 'from-pink-500 to-rose-600', desc: 'Quick revision' },
  { type: 'quiz', label: 'Quiz', icon: <Target className="w-4 h-4" />, color: 'from-amber-500 to-yellow-600', desc: 'Tests & MCQs' },
  { type: 'assignment', label: 'Assignment', icon: <Briefcase className="w-4 h-4" />, color: 'from-teal-500 to-cyan-600', desc: 'Helps complete' },
  { type: 'doubt', label: 'Doubt', icon: <HelpCircle className="w-4 h-4" />, color: 'from-red-500 to-pink-600', desc: 'Instant answers' },
  { type: 'productivity', label: 'Study Plan', icon: <Calendar className="w-4 h-4" />, color: 'from-indigo-500 to-blue-600', desc: 'Schedules' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: AgentType;
  suggestions?: string[];
  actions?: AgentAction[];
  timestamp: number;
  isLoading?: boolean;
}

export const AI4Page: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentType>('teacher');
  const [showAgents, setShowAgents] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `# 👋 Welcome to NikNote AI 4.0!\n\nI'm your **personal AI teacher**, not just a chatbot.\n\nTell me ANY topic and I'll:\n- 📚 **Explain** it like a real teacher\n- 📝 **Create notes** you can convert to handwriting\n- 🧠 **Generate mind maps** for visual learning\n- 🎯 **Create quizzes** to test yourself\n- 🃏 **Make flashcards** for quick revision\n- 📊 **Add diagrams** automatically\n\n**Try saying:** "Explain Photosynthesis" or "Create notes on Newton's Laws"`,
      agent: 'teacher',
      suggestions: [
        '📚 Explain Photosynthesis',
        '📝 Notes on Newton\'s Laws',
        '🧠 Mind Map for Cell Biology',
        '🎯 Quiz on Thermodynamics',
      ],
      timestamp: Date.now(),
    }]);
  }, []);

  // Send message
  const handleSend = useCallback(async (text?: string) => {
    const message = text || input.trim();
    if (!message || isGenerating) return;

    setInput('');
    setIsGenerating(true);

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add loading message
    const loadingId = `loading-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '',
      isLoading: true,
      timestamp: Date.now(),
    }]);

    try {
      const response = await aiOrchestrator.chat(message, activeAgent);

      // Replace loading with actual response
      setMessages(prev => prev.map(m =>
        m.id === loadingId ? {
          ...m,
          id: `ai-${Date.now()}`,
          content: response.content,
          agent: response.agent,
          suggestions: response.suggestions,
          actions: response.actions,
          isLoading: false,
        } : m
      ));
    } catch (error) {
      setMessages(prev => prev.map(m =>
        m.id === loadingId ? {
          ...m,
          id: `error-${Date.now()}`,
          content: '⚠️ Something went wrong. Please try again.',
          isLoading: false,
        } : m
      ));
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, activeAgent]);

  // Handle suggestion click
  const handleSuggestion = (suggestion: string) => {
    // Extract actual query from suggestion (remove emoji prefix)
    const query = suggestion.replace(/^[^\s]+\s/, '');
    handleSend(query);
  };

  // Copy to clipboard
  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Copied! 📋');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle action
  const handleAction = (action: AgentAction) => {
    const queryMap: Record<string, string> = {
      create_notes: '📝 Create detailed notes',
      create_flashcards: '🃏 Create flashcards',
      create_quiz: '🎯 Create a quiz',
      create_mindmap: '🧠 Create a mind map',
      create_revision: '📖 Create revision sheet',
      add_diagram: '📊 Add diagrams',
      create_assignment: '✍️ Help with assignment',
      create_study_plan: '📅 Create study plan',
    };
    handleSend(queryMap[action.type] || action.label);
  };

  // Render markdown-like content
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace('## ', '')}</h2>;
      if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace('# ', '')}</h1>;
      // Bold is rendered as React nodes, never as HTML (audit F-01):
      // `**x**` used to become `<strong>x</strong>` and then go through
      // dangerouslySetInnerHTML, so any markup in model output was live.
      // Bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={i} className="ml-4 list-disc">{renderBoldSegments(line.replace(/^[-*]\s/, ''), `l${i}`)}</li>;
      }
      // Numbered lists
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="ml-4 list-decimal">{renderBoldSegments(line.replace(/^\d+\.\s/, ''), `l${i}`)}</li>;
      }
      // Empty line
      if (!line.trim()) return <br key={i} />;
      // Regular text
      return <p key={i} className="mb-1">{renderBoldSegments(line, `l${i}`)}</p>;
    });
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center">
              <img src="/niknote-logo.png" alt="NikNote" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold">NikNote AI 4.0</h1>
              <p className="text-[10px] text-muted-foreground">Your Personal AI Teacher</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/documents')}
              className="gap-1.5 rounded-xl text-xs"
            >
              <Upload className="w-3 h-3" /> Docs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-1.5 rounded-xl text-xs"
            >
              <Pen className="w-3 h-3" /> Editor
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { aiOrchestrator.clearHistory(); setMessages([messages[0]]); }}
              className="gap-1.5 rounded-xl text-xs"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </Button>
          </div>
        </div>
      </header>

      {/* Agent selector */}
      <div className="border-b border-border/50 bg-muted/30 px-4 py-2">
        <div className="max-w-3xl mx-auto flex gap-1.5 overflow-x-auto scrollbar-hide">
          {AGENTS.map(agent => (
            <button
              key={agent.type}
              onClick={() => setActiveAgent(agent.type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                activeAgent === agent.type
                  ? `bg-gradient-to-r ${agent.color} text-white shadow-md`
                  : 'bg-white/50 dark:bg-white/10 text-foreground/70 hover:bg-white/80'
              }`}
            >
              {agent.icon}
              {agent.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : ''}`}>
                  {/* Agent badge */}
                  {msg.agent && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {AGENTS.find(a => a.type === msg.agent)?.label || msg.agent}
                      </span>
                    </div>
                  )}

                  {/* Message bubble */}
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/50 shadow-sm'
                  }`}>
                    {msg.isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">
                          {activeAgent === 'teacher' ? 'Teaching...' :
                           activeAgent === 'notes' ? 'Creating notes...' :
                           activeAgent === 'quiz' ? 'Creating quiz...' :
                           activeAgent === 'revision' ? 'Making revision sheet...' :
                           'Thinking...'}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed prose-sm">
                        {renderContent(msg.content)}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleAction(action)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
                        >
                          <span>{action.icon}</span>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestion(suggestion)}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-medium bg-muted/50 border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Copy button */}
                  {msg.role === 'assistant' && !msg.isLoading && msg.content && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === msg.id ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <div className="max-w-3xl mx-auto">
          {/* Quick prompts */}
          <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
            {['📚 Explain', '📝 Notes', '🎯 Quiz', '🃏 Flashcards', '📖 Revision', '🧠 Mind Map'].map(prompt => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="px-3 py-1 rounded-full text-[10px] font-medium bg-muted/50 border border-border/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all whitespace-nowrap"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Ask ${AGENTS.find(a => a.type === activeAgent)?.label || 'AI'} anything...`}
                className="w-full rounded-2xl bg-muted/50 border border-border/50 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px] max-h-[120px]"
                rows={1}
              />
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={isGenerating || !input.trim()}
              className="rounded-2xl px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
