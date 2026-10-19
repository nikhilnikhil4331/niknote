// ============================================================
// NikNote 4.0 — AI Workspace Panel
// Unified panel: Agents + Workflow + Knowledge + Templates
// Accessible from sidebar, integrates into main layout
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import {
  Brain, Workflow, BookOpen, Sparkles, Send, Loader2,
  ChevronRight, ChevronDown, Search, FileText, Target,
  GraduationCap, BarChart3, Clock, Briefcase, HelpCircle,
  Calendar, Zap, Database, X, Copy, Check, RotateCcw,
  Plus, Play, Settings2, Lightbulb, Wand2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { renderBoldSegments } from '@/lib/richText';
import { toast } from 'sonner';
import {
  aiOrchestrator, AgentType, AgentResponse, AgentAction
} from '@/agents/orchestrator';

// ============================================================
// Types
// ============================================================

type WorkspaceTab = 'agents' | 'knowledge' | 'workflows' | 'templates';

interface AgentDef {
  type: AgentType;
  label: string;
  icon: React.ReactNode;
  color: string;
  desc: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: AgentType;
  suggestions?: string[];
  actions?: AgentAction[];
  timestamp: number;
  isLoading?: boolean;
}

interface KnowledgeItem {
  id: string;
  title: string;
  type: 'note' | 'flashcard' | 'quiz' | 'summary';
  preview: string;
  tags: string[];
  createdAt: number;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  steps: string[];
}

// ============================================================
// Data
// ============================================================

const AGENTS: AgentDef[] = [
  { type: 'teacher', label: 'Guru AI', icon: <GraduationCap className="w-4 h-4" />, color: 'from-blue-500 to-indigo-600', desc: 'Explains like a real teacher' },
  { type: 'notes', label: 'Notes AI', icon: <FileText className="w-4 h-4" />, color: 'from-green-500 to-emerald-600', desc: 'Creates exam-ready notes' },
  { type: 'quiz', label: 'Quiz AI', icon: <Target className="w-4 h-4" />, color: 'from-amber-500 to-yellow-600', desc: 'MCQs & practice tests' },
  { type: 'revision', label: 'Revision AI', icon: <Clock className="w-4 h-4" />, color: 'from-pink-500 to-rose-600', desc: 'Quick revision sheets' },
  { type: 'doubt', label: 'Doubt AI', icon: <HelpCircle className="w-4 h-4" />, color: 'from-red-500 to-pink-600', desc: 'Instant doubt solving' },
  { type: 'research', label: 'Research AI', icon: <Search className="w-4 h-4" />, color: 'from-purple-500 to-violet-600', desc: 'Deep research & info' },
  { type: 'diagram', label: 'Diagram AI', icon: <BarChart3 className="w-4 h-4" />, color: 'from-orange-500 to-red-500', desc: 'Visual diagrams & charts' },
  { type: 'productivity', label: 'Planner AI', icon: <Calendar className="w-4 h-4" />, color: 'from-indigo-500 to-blue-600', desc: 'Study plans & schedules' },
  { type: 'assignment', label: 'Assignment AI', icon: <Briefcase className="w-4 h-4" />, color: 'from-teal-500 to-cyan-600', desc: 'Assignment help' },
  { type: 'document', label: 'Doc AI', icon: <Database className="w-4 h-4" />, color: 'from-slate-500 to-gray-600', desc: 'Document analysis' },
];

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  { id: 'pdf-flashcards', name: 'PDF → Flashcards', icon: '🃏', description: 'Upload PDF, auto-generate flashcards for revision', steps: ['Upload PDF', 'Extract text via OCR', 'Generate flashcards', 'Review & export'] },
  { id: 'exam-analyzer', name: 'Exam Paper Analyzer', icon: '📋', description: 'Analyze past exam papers, find important topics', steps: ['Upload exam paper', 'OCR extract questions', 'Categorize by topic', 'Generate study guide'] },
  { id: 'research-summary', name: 'Research Paper Summarizer', icon: '📄', description: 'Summarize long research papers into key points', steps: ['Upload paper', 'Extract key sections', 'Generate summary', 'Create flashcards'] },
  { id: 'handwriting-notes', name: 'Handwriting → Digital Notes', icon: '✍️', description: 'Convert handwritten notes to editable digital format', steps: ['Upload handwriting', 'OCR recognition', 'Format as blocks', 'Export options'] },
  { id: 'study-planner', name: 'AI Study Planner', icon: '📅', description: 'Create personalized study schedule based on exams', steps: ['Enter exam dates', 'List topics', 'AI generates schedule', 'Track progress'] },
  { id: 'batch-ocr', name: 'Batch OCR Processor', icon: '🔍', description: 'Process multiple images/PDFs at once', steps: ['Upload multiple files', 'Queue processing', 'Extract all text', 'Combine & export'] },
];

const SAMPLE_KNOWLEDGE: KnowledgeItem[] = [
  { id: 'k1', title: "Newton's Laws of Motion", type: 'note', preview: '3 laws: Inertia, F=ma, Action-Reaction...', tags: ['physics', 'mechanics'], createdAt: Date.now() - 86400000 },
  { id: 'k2', title: 'Photosynthesis Process', type: 'flashcard', preview: 'Q: What is photosynthesis? A: Process by which...', tags: ['biology', 'plants'], createdAt: Date.now() - 172800000 },
  { id: 'k3', title: 'Quadratic Equations', type: 'quiz', preview: 'Solve: x² - 5x + 6 = 0', tags: ['math', 'algebra'], createdAt: Date.now() - 259200000 },
  { id: 'k4', title: 'Indian Constitution Basics', type: 'summary', preview: 'Preamble, Fundamental Rights, Directive Principles...', tags: ['civics', 'constitution'], createdAt: Date.now() - 345600000 },
];

// ============================================================
// Component
// ============================================================

interface AIWorkspacePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertContent?: (content: string) => void;
}

export const AIWorkspacePanel: React.FC<AIWorkspacePanelProps> = ({
  isOpen,
  onClose,
  onInsertContent,
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('agents');
  const [showCanvas, setShowCanvas] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentType>('teacher');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `# 👋 Welcome to NikNote AI Workspace!\n\nChoose an **agent** and ask anything. I can:\n- 📚 Explain concepts like a teacher\n- 📝 Create exam-ready notes\n- 🎯 Generate quizzes & MCQs\n- 🃏 Make flashcards for revision\n- 📊 Draw diagrams & flowcharts\n- 📅 Plan your study schedule\n\n**Try:** "Explain Newton's Laws" or "Create notes on Photosynthesis"`,
        agent: 'teacher',
        suggestions: ['📚 Explain Photosynthesis', '📝 Notes on Thermodynamics', '🎯 Quiz on Algebra', '🃏 Flashcards for History'],
        timestamp: Date.now(),
      }]);
    }
  }, [isOpen]);

  // Send message to AI
  const handleSend = useCallback(async (text?: string) => {
    const message = text || input.trim();
    if (!message || isGenerating) return;

    setInput('');
    setIsGenerating(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

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
    } catch {
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

  // Copy content
  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Copied! 📋');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Insert content into editor
  const handleInsert = (content: string) => {
    onInsertContent?.(content);
    toast.success('Content inserted into editor! ✍️');
  };

  // Render markdown-like content
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold mt-3 mb-1">{line.replace('## ', '')}</h2>;
      if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold mt-3 mb-1">{line.replace('# ', '')}</h1>;
      if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold mt-2 mb-1">{line.replace('### ', '')}</h3>;
      // Bold is rendered as React nodes, never as HTML (audit F-01).
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={i} className="ml-3 list-disc text-xs">{renderBoldSegments(line.replace(/^[-*]\s/, ''), `l${i}`)}</li>;
      }
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="ml-3 list-decimal text-xs">{renderBoldSegments(line.replace(/^\d+\.\s/, ''), `l${i}`)}</li>;
      }
      if (!line.trim()) return <br key={i} />;
      return <p key={i} className="mb-0.5 text-xs">{renderBoldSegments(line, `l${i}`)}</p>;
    });
  };

  // Filter knowledge items
  const filteredKnowledge = searchQuery
    ? SAMPLE_KNOWLEDGE.filter(k =>
        k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : SAMPLE_KNOWLEDGE;

  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'agents', label: 'Agents', icon: <Brain className="w-3.5 h-3.5" /> },
    { id: 'knowledge', label: 'Knowledge', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'workflows', label: 'Workflows', icon: <Workflow className="w-3.5 h-3.5" /> },
    { id: 'templates', label: 'Templates', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white dark:bg-gray-950 border-l border-border z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold">AI Workspace</h2>
                <p className="text-[10px] text-muted-foreground">Agents • Knowledge • Workflows</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-xl">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-semibold transition-all border-b-2",
                    activeTab === tab.id
                      ? "text-primary border-primary bg-primary/5"
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* ===== AGENTS TAB ===== */}
              {activeTab === 'agents' && (
                <>
                  {/* Agent selector */}
                  <div className="px-3 py-2 border-b border-border/50 bg-muted/20">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
                      {AGENTS.map(agent => (
                        <button
                          key={agent.type}
                          onClick={() => setActiveAgent(agent.type)}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all",
                            activeAgent === agent.type
                              ? `bg-gradient-to-r ${agent.color} text-white shadow-md`
                              : "bg-white/60 dark:bg-white/10 text-foreground/70 hover:bg-white/90"
                          )}
                        >
                          {agent.icon}
                          {agent.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                    {messages.map(msg => (
                      <div key={msg.id} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        <div className={cn("max-w-[90%] rounded-2xl", msg.role === 'user' ? 'bg-primary text-primary-foreground px-3 py-2' : 'bg-card border border-border/50 px-3 py-2 shadow-sm')}>
                          {msg.isLoading ? (
                            <div className="flex items-center gap-2 py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                              <span className="text-[11px] text-muted-foreground">Thinking...</span>
                            </div>
                          ) : (
                            <div className="text-xs leading-relaxed">{renderContent(msg.content)}</div>
                          )}

                          {/* Suggestions */}
                          {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {msg.suggestions.slice(0, 4).map((s, i) => (
                                <button key={i} onClick={() => handleSend(s.replace(/^[^\s]+\s/, ''))} className="px-2 py-1 rounded-lg text-[9px] bg-muted/50 border border-border/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          {msg.role === 'assistant' && !msg.isLoading && msg.content && (
                            <div className="flex items-center gap-2 mt-2 pt-1 border-t border-border/30">
                              <button onClick={() => handleCopy(msg.content, msg.id)} className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                                {copiedId === msg.id ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                {copiedId === msg.id ? 'Copied' : 'Copy'}
                              </button>
                              <button onClick={() => handleInsert(msg.content)} className="text-[9px] text-primary hover:text-primary/80 flex items-center gap-1">
                                <Plus className="w-2.5 h-2.5" />
                                Insert
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="border-t border-border px-3 py-2 bg-background">
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
                          placeholder={`Ask ${AGENTS.find(a => a.type === activeAgent)?.label}...`}
                          className="w-full rounded-xl bg-muted/50 border border-border/50 px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[36px] max-h-[80px]"
                          rows={1}
                        />
                      </div>
                      <Button
                        onClick={() => handleSend()}
                        disabled={isGenerating || !input.trim()}
                        className="rounded-xl px-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white h-9"
                        size="sm"
                      >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                    {/* Quick prompts */}
                    <div className="flex gap-1 mt-1.5 overflow-x-auto scrollbar-hide">
                      {['📚 Explain', '📝 Notes', '🎯 Quiz', '🃏 Flashcards', '📖 Revision'].map(p => (
                        <button key={p} onClick={() => handleSend(p)} className="px-2 py-1 rounded-lg text-[9px] bg-muted/40 border border-border/40 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors whitespace-nowrap">
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ===== KNOWLEDGE TAB ===== */}
              {activeTab === 'knowledge' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search knowledge base..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 rounded-xl text-xs"
                    />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card border border-border/50 rounded-xl p-2 text-center">
                      <div className="text-lg font-bold text-primary">4</div>
                      <div className="text-[9px] text-muted-foreground">Items</div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-2 text-center">
                      <div className="text-lg font-bold text-green-500">12</div>
                      <div className="text-[9px] text-muted-foreground">Flashcards</div>
                    </div>
                    <div className="bg-card border border-border/50 rounded-xl p-2 text-center">
                      <div className="text-lg font-bold text-amber-500">5</div>
                      <div className="text-[9px] text-muted-foreground">Quizzes</div>
                    </div>
                  </div>

                  {/* Knowledge items */}
                  {filteredKnowledge.map(item => (
                    <div key={item.id} className="bg-card border border-border/50 rounded-xl p-3 hover:border-primary/30 transition-colors cursor-pointer group">
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0",
                          item.type === 'note' ? 'bg-blue-100 text-blue-600' :
                          item.type === 'flashcard' ? 'bg-green-100 text-green-600' :
                          item.type === 'quiz' ? 'bg-amber-100 text-amber-600' :
                          'bg-purple-100 text-purple-600'
                        )}>
                          {item.type === 'note' ? '📝' : item.type === 'flashcard' ? '🃏' : item.type === 'quiz' ? '🎯' : '📋'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{item.title}</h4>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{item.preview}</p>
                          <div className="flex gap-1 mt-1.5">
                            {item.tags.map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded-full text-[8px] bg-primary/5 text-primary border border-primary/10">{tag}</span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                      </div>
                    </div>
                  ))}

                  {/* Add from editor */}
                  <button
                    onClick={() => {
                      toast.success('Save notes to knowledge base from the editor using the 💾 button');
                    }}
                    className="w-full p-3 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/40 transition-colors text-center"
                  >
                    <Plus className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground">Save current notes to Knowledge Base</span>
                  </button>
                </div>
              )}

              {/* ===== WORKFLOWS TAB ===== */}
              {activeTab === 'workflows' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-muted-foreground">AI-powered workflows. Select template or build your own.</p>
                    <Button variant="outline" size="sm" onClick={() => setShowCanvas(true)} className="gap-1 text-[9px] h-6 rounded-lg">
                      <Workflow className="w-3 h-3" /> Visual Builder
                    </Button>
                  </div>

                  {WORKFLOW_TEMPLATES.map(wf => (
                    <div key={wf.id} className="bg-card border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors cursor-pointer group">
                      <div className="p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-base">{wf.icon}</span>
                          <h4 className="text-xs font-semibold group-hover:text-primary transition-colors">{wf.name}</h4>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{wf.description}</p>
                      </div>
                      {/* Steps */}
                      <div className="px-3 pb-3">
                        <div className="flex items-center gap-1">
                          {wf.steps.map((step, i) => (
                            <React.Fragment key={i}>
                              <div className="px-2 py-1 rounded-lg bg-primary/5 text-[9px] text-primary font-medium whitespace-nowrap">
                                {step}
                              </div>
                              {i < wf.steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      <div className="px-3 pb-3">
                        <Button
                          size="sm"
                          className="w-full rounded-xl text-[10px] h-8 gap-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
                          onClick={() => {
                            toast.success(`🚀 ${wf.name} workflow started! Follow the steps.`);
                            handleSend(`Run workflow: ${wf.name}. ${wf.description}`);
                          }}
                        >
                          <Play className="w-3 h-3" />
                          Start Workflow
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ===== TEMPLATES TAB ===== */}
              {activeTab === 'templates' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground mb-2">Quick AI templates — click to generate content instantly.</p>

                  {[
                    { emoji: '📝', title: 'Study Notes', prompt: 'Create detailed study notes', desc: 'Structured notes with headings, bullet points, formulas' },
                    { emoji: '🎯', title: 'Quiz Generator', prompt: 'Generate a quiz with 10 MCQ questions', desc: 'MCQs with explanations, difficulty levels' },
                    { emoji: '🃏', title: 'Flashcards', prompt: 'Create flashcards for revision', desc: 'Q&A flashcards with spaced repetition' },
                    { emoji: '📊', title: 'Mind Map', prompt: 'Create a mind map diagram', desc: 'Visual topic hierarchy with branches' },
                    { emoji: '📋', title: 'Exam Paper', prompt: 'Generate a practice exam paper', desc: 'Full exam paper with sections & marks' },
                    { emoji: '📖', title: 'Quick Revision', prompt: 'Create a quick revision sheet', desc: 'One-page cheat sheet with key points' },
                    { emoji: '🧮', title: 'Math Solutions', prompt: 'Solve this math problem step by step', desc: 'Step-by-step solutions with explanations' },
                    { emoji: '💬', title: 'Hinglish Explain', prompt: 'Explain this topic in Hinglish', desc: 'Hindi+English mix explanation for Indian students' },
                  ].map(template => (
                    <button
                      key={template.title}
                      onClick={() => {
                        setActiveTab('agents');
                        handleSend(template.prompt);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="text-xl">{template.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold group-hover:text-primary transition-colors">{template.title}</div>
                        <div className="text-[10px] text-muted-foreground">{template.desc}</div>
                      </div>
                      <Wand2 className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
