import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, Check, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { HandwritingModel } from '@/hooks/useHandwritingModels';

interface HandwritingUploaderProps {
  onClose: () => void;
  onModelCreated: (model: Partial<HandwritingModel>) => void;
}

interface AnalysisResult {
  suggestedFont: string;
  fontSize: number;
  lineSpacing: number;
  wordSpacing: number;
  baselineJitter: boolean;
  strokeRandomness: boolean;
  inkColor: string;
  slant?: number;
  strokeThickness?: number;
  penPressureFeel?: number;
  analysisNotes: string;
}

export const HandwritingUploader: React.FC<HandwritingUploaderProps> = ({
  onClose,
  onModelCreated,
}) => {
  const { user } = useAuth();
  const { playClick, playSuccess } = useSoundEffects();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [styleName, setStyleName] = useState('My Handwriting');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [step, setStep] = useState<'upload' | 'analyzing' | 'result'>('upload');

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    playClick();

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, [playClick]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(droppedFile);
    }
  }, []);

  const analyzeHandwriting = async () => {
    if (!preview || !user) return;

    setIsAnalyzing(true);
    setStep('analyzing');

    try {
      const { data, error } = await supabase.functions.invoke('analyze-handwriting', {
        body: { imageBase64: preview },
      });

      if (error) throw error;

      setAnalysisResult(data);
      setStep('result');
      playSuccess();
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(error.message || 'Failed to analyze handwriting');
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveStyle = async () => {
    if (!analysisResult || !user) return;

    playClick();

    // Upload image to storage
    let imageUrl: string | null = null;
    if (file) {
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('handwriting-samples')
        .upload(fileName, file);

      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('handwriting-samples')
          .getPublicUrl(uploadData.path);
        imageUrl = publicUrl;
      }
    }

    onModelCreated({
      name: styleName,
      sample_image_url: imageUrl,
      suggested_font: analysisResult.suggestedFont,
      font_size: analysisResult.fontSize,
      line_spacing: analysisResult.lineSpacing,
      word_spacing: analysisResult.wordSpacing,
      baseline_jitter: analysisResult.baselineJitter,
      stroke_randomness: analysisResult.strokeRandomness,
      ink_color: analysisResult.inkColor,
      slant: analysisResult.slant || 0,
      stroke_thickness: analysisResult.strokeThickness || 1,
      pen_pressure_feel: analysisResult.penPressureFeel || 0.5,
      analysis_notes: analysisResult.analysisNotes,
    });

    toast.success('Handwriting style saved!');
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card rounded-3xl border border-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Upload Handwriting Sample</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'upload' && 'Upload a clear image of your handwriting'}
              {step === 'analyzing' && 'AI is analyzing your handwriting...'}
              {step === 'result' && 'Your personalized style is ready!'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Style name input */}
              <div>
                <Label htmlFor="styleName" className="text-sm font-medium mb-2 block">
                  Style Name
                </Label>
                <Input
                  id="styleName"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder="My Handwriting"
                  className="rounded-xl"
                />
              </div>

              {/* Upload area */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                  preview ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                {preview ? (
                  <div className="space-y-4">
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-xl object-contain"
                    />
                    <Button
                      variant="outline"
                      onClick={() => { setPreview(null); setFile(null); }}
                      className="rounded-xl"
                    >
                      Choose Different Image
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium mb-1">Drop your handwriting image here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">PNG, JPG up to 5MB</p>
                  </label>
                )}
              </div>

              <Button
                onClick={analyzeHandwriting}
                disabled={!preview}
                className="w-full h-12 rounded-xl"
              >
                Analyze My Handwriting
              </Button>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="py-12 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
              >
                <Loader2 className="w-8 h-8 text-accent-rose" />
              </motion.div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Analyzing Your Handwriting</h3>
              <p className="text-muted-foreground">
                Our AI is studying your unique style...
              </p>
              <div className="flex justify-center gap-1 mt-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, delay: i * 0.1, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                ))}
              </div>
            </div>
          )}

          {step === 'result' && analysisResult && (
            <div className="space-y-6">
              {/* Success message */}
              <div className="flex items-center gap-3 p-4 bg-success/10 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Analysis Complete!</p>
                  <p className="text-sm text-muted-foreground">Your personalized style is ready</p>
                </div>
              </div>

              {/* Analysis results */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground">Suggested Font</p>
                  <p className="font-medium text-foreground capitalize">{analysisResult.suggestedFont.replace('-', ' ')}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground">Ink Color</p>
                  <p className="font-medium text-foreground capitalize">{analysisResult.inkColor}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground">Font Size</p>
                  <p className="font-medium text-foreground">{analysisResult.fontSize}px</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-xl">
                  <p className="text-xs text-muted-foreground">Line Spacing</p>
                  <p className="font-medium text-foreground">{analysisResult.lineSpacing}px</p>
                </div>
              </div>

              {/* Analysis notes */}
              {analysisResult.analysisNotes && (
                <div className="p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">AI Notes</p>
                  <p className="text-sm text-foreground">{analysisResult.analysisNotes}</p>
                </div>
              )}

              <Button
                onClick={handleSaveStyle}
                className="w-full h-12 rounded-xl"
              >
                Save This Style
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
