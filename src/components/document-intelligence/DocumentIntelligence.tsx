// ============================================================
// NikNote 4.0 — Document Intelligence Component
// Upload PDF/images → AI extracts text, summarizes,
// generates key points, creates handwritten notes
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Image, Loader2, Sparkles, Copy, Check,
  BookOpen, Brain, Target, FileDown, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { aiOrchestrator } from '@/agents/orchestrator';

interface ExtractedContent {
  text: string;
  summary: string;
  keyPoints: string[];
  formulas: string[];
  definitions: string[];
  topics: string[];
}

type ProcessingStep = 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'done' | 'error';

export const DocumentIntelligence: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('summary');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Sirf PDF aur images (JPG, PNG, WebP) support hote hain');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File 10MB se chhoti honi chahiye');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }

    // Start processing
    await processDocument(selectedFile);
  }, []);

  // Process the document
  const processDocument = useCallback(async (docFile: File) => {
    setStep('uploading');
    setError(null);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(docFile);
      setStep('extracting');

      // Call process-document edge function
      const { data, error: processError } = await supabase.functions.invoke('process-document', {
        body: {
          fileBase64: base64,
          fileName: docFile.name,
          fileType: docFile.type,
        },
      });

      if (processError) throw processError;

      const extractedText = data?.text || data?.content || '';
      setStep('analyzing');

      // Use AI to analyze the extracted content
      if (extractedText) {
        const aiResponse = await aiOrchestrator.chat(
          `Analyze this document content and provide:
1. A concise SUMMARY (5-7 lines)
2. KEY POINTS (5-8 bullet points)
3. Important FORMULAS (if any)
4. Key DEFINITIONS (if any)
5. Main TOPICS covered

Document content:
${extractedText.substring(0, 4000)}`,
          'document'
        );

        const content = aiResponse.content;

        // Parse the AI response into structured data
        const summary = extractSection(content, 'summary', 'SUMMARY');
        const keyPoints = extractBulletPoints(content, 'key point', 'KEY POINT');
        const formulas = extractBulletPoints(content, 'formula', 'FORMULA');
        const definitions = extractBulletPoints(content, 'definition', 'DEFINITION');
        const topics = extractBulletPoints(content, 'topic', 'TOPIC');

        setExtracted({
          text: extractedText,
          summary,
          keyPoints,
          formulas,
          definitions,
          topics,
        });
      } else {
        // Fallback: even without extracted text, try AI vision
        if (docFile.type.startsWith('image/')) {
          const aiResponse = await aiOrchestrator.chat(
            `Analyze this document image and extract all readable content. Provide a summary, key points, and important information.`,
            'document'
          );
          setExtracted({
            text: aiResponse.content,
            summary: aiResponse.content.substring(0, 500),
            keyPoints: [],
            formulas: [],
            definitions: [],
            topics: [],
          });
        }
      }

      setStep('done');
      toast.success('Document analyzed! 🎉');
    } catch (err) {
      console.error('Document processing error:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStep('error');
      toast.error('Document process nahi ho paya. Try again!');
    }
  }, []);

  // Generate handwritten notes from extracted content
  const handleGenerateNotes = useCallback(async () => {
    if (!extracted) return;

    setIsGeneratingNotes(true);
    try {
      // Navigate to main editor with the extracted content
      // Store in localStorage for the editor to pick up
      localStorage.setItem('niknote-imported-content', JSON.stringify({
        text: extracted.text,
        summary: extracted.summary,
        keyPoints: extracted.keyPoints,
        formulas: extracted.formulas,
        definitions: extracted.definitions,
        topics: extracted.topics,
        timestamp: Date.now(),
      }));

      toast.success('Notes ready! Editor mein open ho rahe hain... ✍️');
      navigate('/');
    } catch (err) {
      toast.error('Notes generate nahi ho paye');
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [extracted, navigate]);

  // Copy section to clipboard
  const handleCopy = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success('Copied! 📋');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Drag and drop handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Sections for the result view
  const sections = [
    { id: 'summary', label: 'Summary', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'keypoints', label: 'Key Points', icon: <Target className="w-4 h-4" /> },
    { id: 'formulas', label: 'Formulas', icon: <FileText className="w-4 h-4" /> },
    { id: 'definitions', label: 'Definitions', icon: <Brain className="w-4 h-4" /> },
    { id: 'fulltext', label: 'Full Text', icon: <FileDown className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Document Intelligence
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          PDF ya image upload karo — AI sab samajh lega! 🧠
        </p>
        <button
          onClick={() => navigate('/pdf-editor')}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] px-4 py-2 text-[12.5px] font-bold text-white shadow-sm"
        >
          <FileText className="w-4 h-4" />
          PDF Studio — edit, sign & annotate any PDF
        </button>
      </div>

      {/* Upload Area */}
      {step === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Document Upload Karo</h3>
          <p className="text-muted-foreground text-sm mb-4">
            PDF, JPG, PNG, ya WebP — max 10MB
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="w-4 h-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Image className="w-4 h-4" /> Image
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </motion.div>
      )}

      {/* Processing State */}
      {step !== 'idle' && step !== 'done' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary mb-4" />
          <h3 className="text-lg font-semibold mb-1">
            {step === 'uploading' && 'Upload ho raha hai...'}
            {step === 'extracting' && 'Text extract ho raha hai...'}
            {step === 'analyzing' && 'AI analyze kar raha hai...'}
          </h3>
          <p className="text-muted-foreground text-sm">
            {step === 'uploading' && 'Document prepare ho raha hai'}
            {step === 'extracting' && 'OCR se text nikal rahe hain'}
            {step === 'analyzing' && 'AI document ko samajh raha hai'}
          </p>
          {preview && (
            <img src={preview} alt="Preview" className="max-w-xs mx-auto mt-4 rounded-xl shadow-lg" />
          )}
        </motion.div>
      )}

      {/* Error State */}
      {step === 'error' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <X className="w-10 h-10 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold mb-1">Oops! Error aa gaya</h3>
          <p className="text-muted-foreground text-sm mb-4">{error}</p>
          <Button onClick={() => { setStep('idle'); setFile(null); setError(null); }}>
            Try Again
          </Button>
        </motion.div>
      )}

      {/* Results */}
      {step === 'done' && extracted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* File info */}
          {file && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-xl">
              <FileText className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('idle');
                  setFile(null);
                  setExtracted(null);
                  setPreview(null);
                }}
              >
                New Document
              </Button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              onClick={handleGenerateNotes}
              disabled={isGeneratingNotes}
              className="flex-1 gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white"
            >
              {isGeneratingNotes ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Handwritten Notes Banao
            </Button>
          </div>

          {/* Section tabs */}
          <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </div>

          {/* Content sections */}
          <div className="space-y-4">
            {/* Summary */}
            {activeSection === 'summary' && extracted.summary && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">📋 Summary</h4>
                  <button
                    onClick={() => handleCopy(extracted.summary, 'summary')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedSection === 'summary' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {extracted.summary}
                </p>
              </div>
            )}

            {/* Key Points */}
            {activeSection === 'keypoints' && extracted.keyPoints.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">🎯 Key Points</h4>
                  <button
                    onClick={() => handleCopy(extracted.keyPoints.join('\n'), 'keypoints')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedSection === 'keypoints' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <ul className="space-y-2">
                  {extracted.keyPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      <span className="text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Formulas */}
            {activeSection === 'formulas' && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">🔢 Formulas</h4>
                  <button
                    onClick={() => handleCopy(extracted.formulas.join('\n'), 'formulas')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedSection === 'formulas' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {extracted.formulas.length > 0 ? (
                  <div className="space-y-2">
                    {extracted.formulas.map((formula, i) => (
                      <div key={i} className="bg-muted/50 p-3 rounded-lg font-mono text-sm">
                        {formula}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Koi formula nahi mila is document mein</p>
                )}
              </div>
            )}

            {/* Definitions */}
            {activeSection === 'definitions' && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">📖 Definitions</h4>
                  <button
                    onClick={() => handleCopy(extracted.definitions.join('\n'), 'definitions')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedSection === 'definitions' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {extracted.definitions.length > 0 ? (
                  <div className="space-y-2">
                    {extracted.definitions.map((def, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-muted-foreground">{def}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Koi definition nahi mila</p>
                )}
              </div>
            )}

            {/* Full Text */}
            {activeSection === 'fulltext' && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm">📄 Full Extracted Text</h4>
                  <button
                    onClick={() => handleCopy(extracted.text, 'fulltext')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedSection === 'fulltext' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {extracted.text}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Topics */}
          {extracted.topics.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-sm mb-2">📚 Topics Detected</h4>
              <div className="flex flex-wrap gap-2">
                {extracted.topics.map((topic, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

// Helper: File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix for clean base64
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper: Extract a section from AI response
function extractSection(content: string, ...keywords: string[]): string {
  const lower = content.toLowerCase();
  for (const keyword of keywords) {
    const regex = new RegExp(`#{1,3}\\s*${keyword}[\\s\\S]*?(?=#{1,3}\\s|$)`, 'i');
    const match = content.match(regex);
    if (match) {
      return match[0]
        .replace(/#{1,3}\s*\w+\s*/i, '')
        .replace(/\*\*/g, '')
        .trim();
    }
  }

  // Fallback: first 500 chars
  return content.substring(0, 500).replace(/\*\*/g, '').trim();
}

// Helper: Extract bullet points from AI response
function extractBulletPoints(content: string, ...keywords: string[]): string[] {
  const points: string[] = [];
  const lower = content.toLowerCase();

  for (const keyword of keywords) {
    const regex = new RegExp(`#{1,3}\\s*${keyword}[\\s\\S]*?(?=#{1,3}\\s|$)`, 'i');
    const match = content.match(regex);
    if (match) {
      const lines = match[0].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^[-*•]\s/) || trimmed.match(/^\d+\.\s/)) {
          points.push(trimmed.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, '').replace(/\*\*/g, ''));
        }
      }
    }
  }

  return points;
}

export default DocumentIntelligence;
