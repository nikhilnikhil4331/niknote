import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, FileText, Sparkles, BookOpen, GraduationCap, Briefcase,
  Wand2, ArrowRight, Download, Copy, Check, Loader2, ArrowLeft,
  Brain, Lightbulb, PenLine, FileOutput, BookMarked, RefreshCw, Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { FileUploadZone } from './FileUploadZone';
import { supabase } from '@/integrations/supabase/client';

type ProcessMode = 'solve' | 'improve' | 'summarize' | 'rewrite' | 'explain' | 'template' | 'notes' | 'essay';
type UserMode = 'student' | 'college' | 'professional';

const userModes = [
  { id: 'student' as const, label: 'Student', icon: BookOpen, desc: 'School homework & assignments' },
  { id: 'college' as const, label: 'College', icon: GraduationCap, desc: 'University projects & papers' },
  { id: 'professional' as const, label: 'Professional', icon: Briefcase, desc: 'Office documents & reports' },
];

const processModes = [
  { id: 'solve' as const, label: 'Solve', icon: Brain, desc: 'Solve problems & questions', color: 'text-red-500' },
  { id: 'explain' as const, label: 'Explain', icon: Lightbulb, desc: 'Break down complex topics', color: 'text-yellow-500' },
  { id: 'improve' as const, label: 'Improve', icon: PenLine, desc: 'Fix grammar & enhance writing', color: 'text-green-500' },
  { id: 'summarize' as const, label: 'Summarize', icon: FileOutput, desc: 'Create concise summaries', color: 'text-blue-500' },
  { id: 'rewrite' as const, label: 'Rewrite', icon: RefreshCw, desc: 'Fresh take, same meaning', color: 'text-purple-500' },
  { id: 'essay' as const, label: 'Essay', icon: FileText, desc: 'Generate full essays', color: 'text-orange-500' },
  { id: 'template' as const, label: 'Template', icon: FileText, desc: 'Format as assignment', color: 'text-pink-500' },
  { id: 'notes' as const, label: 'Quick Notes', icon: BookMarked, desc: 'Convert to study notes', color: 'text-cyan-500' },
];

export const AISolverPage: React.FC = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [userMode, setUserMode] = useState<UserMode>('student');
  const [processMode, setProcessMode] = useState<ProcessMode>('solve');
  const [inputContent, setInputContent] = useState('');
  const [outputContent, setOutputContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState('');
  const [_fileName, setFileName] = useState<string | null>(null);

  const handleFileExtracted = useCallback((content: string, name: string) => {
    setInputContent(content);
    setFileName(name);
    setTitle(name.replace(/\.[^/.]+$/, '')); // Remove extension for title
  }, []);

  const handleProcess = useCallback(async () => {
    if (!inputContent.trim()) {
      toast.error('Please enter some content to process');
      return;
    }

    if (!user || !session) {
      toast.error('Please sign in to use AI features');
      navigate('/login');
      return;
    }

    setIsProcessing(true);
    setOutputContent('');

    try {
      // Use the new OpenAI brain endpoint
      const response = await fetch(`${SUPABASE_URL}/functions/v1/openai-brain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: processMode,
          content: inputContent,
          mode: userMode,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          toast.error('Session expired. Please sign in again.');
          navigate('/login');
          return;
        }
        if (response.status === 429) {
          toast.error('AI is busy right now. Please wait a moment and try again.', {
            action: {
              label: 'Retry',
              onClick: () => handleProcess(),
            },
          });
          return;
        }
        if (response.status === 402) {
          toast.error('Daily AI limit reached. Upgrade for unlimited access.', {
            action: {
              label: 'Upgrade',
              onClick: () => navigate('/payment'),
            },
          });
          return;
        }
        throw new Error(errorData.error || 'Something went wrong. Please try again.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setOutputContent(fullText);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      if (fullText) {
        toast.success('Content processed successfully!');
        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'ai_document_process',
          category: 'ai',
          details: { processMode, userMode, contentLength: inputContent.length },
          page_url: '/ai-solver',
        });
      }
    } catch (err) {
      console.error('Processing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'AI processing failed';
      toast.error(errorMessage, {
        action: {
          label: 'Retry',
          onClick: () => handleProcess(),
        },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [inputContent, processMode, userMode, title, user, session, navigate]);

  const handleCopy = useCallback(async () => {
    if (!outputContent) return;
    await navigator.clipboard.writeText(outputContent);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  }, [outputContent]);

  const handleDownload = useCallback(() => {
    if (!outputContent) return;
    
    const blob = new Blob([outputContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'processed-content'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded successfully!');
  }, [outputContent, title]);

  const handleClear = useCallback(() => {
    setInputContent('');
    setOutputContent('');
    setTitle('');
    setFileName(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Premium Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-10"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
                <Brain className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">AI Solver</h1>
                <p className="text-xs text-muted-foreground">Homework • Assignments • Documents</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2 rounded-xl">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </div>
        </div>
      </motion.header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* User Mode Selection - Premium Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <p className="text-sm font-medium text-muted-foreground mb-4">I am a...</p>
          <div className="grid grid-cols-3 gap-4">
            {userModes.map((mode, index) => (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                onClick={() => setUserMode(mode.id)}
                className={`
                  relative p-5 rounded-2xl border-2 transition-all text-left overflow-hidden group
                  ${userMode === mode.id 
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
                    : 'border-border/50 hover:border-primary/30 hover:bg-muted/30 hover:shadow-md'
                  }
                `}
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity ${userMode === mode.id ? 'opacity-100' : 'group-hover:opacity-50'}`} />
                <mode.icon className={`h-7 w-7 mb-3 relative z-10 ${userMode === mode.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="font-semibold text-sm relative z-10">{mode.label}</div>
                <div className="text-xs text-muted-foreground mt-1 relative z-10">{mode.desc}</div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-2 overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 to-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="w-4 h-4 text-primary" />
                  Input
                </CardTitle>
                <CardDescription>Upload a file or paste your content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload Zone */}
                <FileUploadZone 
                  onContentExtracted={handleFileExtracted}
                  className="mb-4"
                />

                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
                <Textarea
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  placeholder="Paste your homework, assignment, or any text here...

Examples:
• Math problems to solve
• Essays to improve
• Articles to summarize
• Topics to explain
• Content to format as assignments"
                  className="min-h-[250px] resize-none text-sm rounded-xl"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{inputContent.length.toLocaleString()} characters</span>
                  {inputContent && (
                    <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 text-xs">
                      Clear all
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Output Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-2 overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Output
                    </CardTitle>
                    <CardDescription>AI-processed result</CardDescription>
                  </div>
                  {outputContent && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 rounded-xl">
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 rounded-xl">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="min-h-[250px] max-h-[400px] rounded-xl border bg-muted/20 p-4 overflow-auto">
                  {isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-primary/10 animate-pulse" />
                        <Loader2 className="w-8 h-8 animate-spin text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-sm text-muted-foreground">Processing with AI...</p>
                      <p className="text-xs text-muted-foreground/60">This may take a few seconds</p>
                    </div>
                  ) : outputContent ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
                      <ReactMarkdown>{outputContent}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <Wand2 className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Select a mode and click Process</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Your AI-generated content will appear here</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Process Modes - Premium Design */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <p className="text-sm font-medium text-muted-foreground mb-4">What should I do?</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {processModes.map((mode, index) => (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.03 }}
                onClick={() => setProcessMode(mode.id)}
                className={`
                  p-4 rounded-2xl border-2 transition-all text-center group
                  ${processMode === mode.id 
                    ? 'border-primary bg-primary/10 shadow-md shadow-primary/10' 
                    : 'border-border/50 hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm'
                  }
                `}
              >
                <mode.icon className={`w-6 h-6 mx-auto mb-2 transition-colors ${processMode === mode.id ? 'text-primary' : mode.color}`} />
                <div className="text-xs font-semibold">{mode.label}</div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Process Button - Premium */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex justify-center"
        >
          <Button
            size="lg"
            onClick={handleProcess}
            disabled={isProcessing || !inputContent.trim()}
            className="px-10 h-14 gap-3 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Process with AI
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </motion.div>

        {/* Quick Tips - Premium Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-10 p-6 rounded-3xl bg-gradient-to-br from-muted/50 to-muted/20 border"
        >
          <p className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            Tips for best results
          </p>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              Be specific with your content - include all relevant details
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              For math problems, clearly state the question and any given values
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              Use "Template" mode to format content as a proper assignment with headings
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              "Quick Notes" mode is perfect for exam preparation
            </li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
};
