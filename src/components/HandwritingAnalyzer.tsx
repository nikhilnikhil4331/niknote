import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, Loader2, Camera, X, Sparkles, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { NoteSettings, HandwritingFont, InkColor, FONT_OPTIONS } from '@/types/notes';
import { requestPaidHandwritingVision } from '@/lib/paidHandwritingVision';
import { useAuth } from '@/contexts/AuthContext';
import { useHandwritingDNAOptional } from '@/contexts/HandwritingDNAContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface HandwritingAnalyzerProps {
  onApplyStyle: (settings: Partial<NoteSettings>) => void;
}

interface AnalysisResult {
  suggestedFont: HandwritingFont;
  fontSize: number;
  lineSpacing: number;
  wordSpacing: number;
  baselineJitter: boolean;
  baselineJitterAmount: number;
  strokeRandomness: boolean;
  inkColor: InkColor;
  slant: number;
  strokeThickness: number;
  penPressureFeel: number;
  letterSpacingVariation: number;
  analysisNotes: string;
  confidence: number;
  qualityWarning: string | null;
}

type AnalysisStep = 'upload' | 'analyzing' | 'result';

const ANALYSIS_MESSAGES = [
  { icon: '📸', text: 'Reading your handwriting...' },
  { icon: '🔍', text: 'Analyzing letter shapes & connections...' },
  { icon: '📐', text: 'Measuring slant & spacing...' },
  { icon: '✒️', text: 'Estimating visible stroke weight...' },
  { icon: '✨', text: 'Creating your personal style...' },
];

export const HandwritingAnalyzer: React.FC<HandwritingAnalyzerProps> = ({ onApplyStyle }) => {
  const dnaContext = useHandwritingDNAOptional();
  const [step, setStep] = useState<AnalysisStep>('upload');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { session } = useAuth();
  const navigate = useNavigate();

  // Cycle through analysis messages
  useEffect(() => {
    if (step !== 'analyzing') return;
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % ANALYSIS_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [step]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPreviewImage(base64);
      setAnalysisResult(null);
      await analyzeHandwriting(base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzeHandwriting = async (imageBase64: string) => {
    setStep('analyzing');
    setMessageIndex(0);
    
    try {
      if (!session?.access_token) {
        toast.error('Please login first');
        navigate('/login');
        return;
      }

      const data = await requestPaidHandwritingVision('style', imageBase64);

      setAnalysisResult(data as AnalysisResult);
      setStep('result');
      toast.success('Handwriting analyzed successfully!');
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze handwriting');
      setStep('upload');
    }
  };

  const handleApplyStyle = () => {
    if (!analysisResult) return;
    onApplyStyle({
      font: analysisResult.suggestedFont,
      fontSize: analysisResult.fontSize,
      lineSpacing: analysisResult.lineSpacing,
      wordSpacing: analysisResult.wordSpacing,
      baselineJitter: analysisResult.baselineJitter,
      strokeRandomness: analysisResult.strokeRandomness,
      inkColor: analysisResult.inkColor,
    });
    // Also save to DNA context for v2
    if (dnaContext) {
      dnaContext.updateDNA({
        slant: analysisResult.slant || 0,
        strokeThickness: analysisResult.strokeThickness || 1,
        penPressure: analysisResult.penPressureFeel || 0.5,
        baselineDrift: analysisResult.baselineJitterAmount || 1,
        letterSpacing: analysisResult.letterSpacingVariation || 0,
        characterSize: analysisResult.fontSize || 24,
        closestFont: analysisResult.suggestedFont || 'caveat',
        confidence: analysisResult.confidence || 0.7,
        sampleQuality: analysisResult.qualityWarning ? 'fair' : 'good',
      });
    }
    toast.success('Style applied! DNA saved ✨');
  };

  const clearAndReset = () => {
    setPreviewImage(null);
    setAnalysisResult(null);
    setStep('upload');
    setMessageIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fontLabel = analysisResult 
    ? FONT_OPTIONS.find(f => f.value === analysisResult.suggestedFont)?.label || analysisResult.suggestedFont
    : '';

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {/* ==================== STEP 1: UPLOAD ==================== */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border/50 hover:border-primary/50 transition-all cursor-pointer p-6 text-center bg-muted/20 hover:bg-muted/30"
            >
              <div className="flex flex-col items-center gap-4">
                <motion.div 
                  className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Camera className="w-8 h-8 text-primary" />
                </motion.div>
                <div>
                  <p className="font-semibold text-sm">Upload Handwriting Sample</p>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px] mx-auto">
                    Write 2-3 lines on white paper. Take a clear, well-lit photo.
                  </p>
                </div>

                {/* Tips */}
                <div className="grid grid-cols-3 gap-2 w-full mt-1">
                  <div className="bg-green-500/10 rounded-lg p-2 text-center">
                    <span className="text-lg">✅</span>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Clear & bright</p>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-2 text-center">
                    <span className="text-lg">📝</span>
                    <p className="text-[9px] text-muted-foreground mt-0.5">2-3 lines</p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-2 text-center">
                    <span className="text-lg">❌</span>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Blurry/dark</p>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="mt-1 gap-2 rounded-xl">
                  <Upload className="w-4 h-4" />
                  Choose Image
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ==================== STEP 2: ANALYZING ==================== */}
        {step === 'analyzing' && previewImage && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Thumbnail */}
            <div className="relative rounded-xl overflow-hidden border border-border h-32">
              <img src={previewImage} alt="Sample" className="w-full h-full object-contain bg-white/50" />
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
            </div>

            {/* Animated messages */}
            <Card className="p-6 bg-primary/5 border-primary/20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={messageIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-2xl block mb-2">{ANALYSIS_MESSAGES[messageIndex].icon}</span>
                  <p className="text-sm font-medium">{ANALYSIS_MESSAGES[messageIndex].text}</p>
                </motion.div>
              </AnimatePresence>
              <Progress value={(messageIndex + 1) / ANALYSIS_MESSAGES.length * 100} className="mt-4 h-1.5" />
            </Card>
          </motion.div>
        )}

        {/* ==================== STEP 3: RESULT ==================== */}
        {step === 'result' && analysisResult && previewImage && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* Header */}
            <div className="text-center py-2">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
              </motion.div>
              <h3 className="font-bold text-base">Your Handwriting Style is Ready! ✨</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(analysisResult.confidence * 100)}% confidence match
              </p>
            </div>

            {/* Quality warning */}
            {analysisResult.qualityWarning && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400">{analysisResult.qualityWarning}</p>
              </div>
            )}

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl overflow-hidden border border-border">
                <p className="text-[9px] font-semibold text-center py-1 bg-muted/50 text-muted-foreground">ORIGINAL</p>
                <img src={previewImage} alt="Original" className="w-full h-24 object-contain bg-white" />
              </div>
              <div className="rounded-xl overflow-hidden border border-primary/30 bg-white">
                <p className="text-[9px] font-semibold text-center py-1 bg-primary/10 text-primary">GENERATED</p>
                <div className="p-2 h-24 flex items-center justify-center">
                  <p 
                    className={cn(
                      FONT_OPTIONS.find(f => f.value === analysisResult.suggestedFont)?.className,
                      "text-center leading-relaxed"
                    )}
                    style={{ 
                      fontSize: `${Math.min(analysisResult.fontSize, 18)}px`,
                      transform: analysisResult.slant ? `skewX(${-analysisResult.slant * 0.5}deg)` : undefined,
                      fontWeight: Math.round(300 + analysisResult.penPressureFeel * 400),
                    }}
                  >
                    Hello World!<br />This is your style.
                  </p>
                </div>
              </div>
            </div>

            {/* Analysis notes */}
            <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
              {analysisResult.analysisNotes}
            </p>

            {/* Parameter meters */}
            <div className="grid grid-cols-2 gap-2">
              <ParameterMeter label="Font" value={fontLabel} />
              <ParameterMeter label="Size" value={`${analysisResult.fontSize}px`} />
              <ParameterMeter label="Slant" value={`${analysisResult.slant > 0 ? '+' : ''}${analysisResult.slant}°`} />
              <ParameterMeter label="Stroke look" value={`${Math.round(analysisResult.penPressureFeel * 100)}%`} />
              <ParameterMeter label="Ink" value={analysisResult.inkColor} />
              <ParameterMeter label="Thickness" value={`${analysisResult.strokeThickness.toFixed(1)}`} />
            </div>

            {/* Action buttons */}
            <Button onClick={handleApplyStyle} className="w-full gap-2 rounded-xl" size="sm">
              <Check className="w-4 h-4" />
              Apply This Style
            </Button>
            <Button variant="outline" size="sm" onClick={clearAndReset} className="w-full gap-2 rounded-xl">
              <RotateCcw className="w-4 h-4" />
              Try Another Image
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Small helper component for parameter display
const ParameterMeter: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-muted/30 rounded-lg p-2 flex flex-col">
    <span className="text-muted-foreground text-[9px] uppercase tracking-wider">{label}</span>
    <span className="font-medium text-xs capitalize truncate">{value}</span>
  </div>
);
