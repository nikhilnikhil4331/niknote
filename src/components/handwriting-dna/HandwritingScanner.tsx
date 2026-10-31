import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Camera, Scan, Check, X, Sparkles, RotateCcw, Download, Sliders, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HandwritingDNA, DNA_PRESETS, analyzeHandwritingImage, findClosestPreset, dnaToCSS } from './HandwritingDNAEngine';

interface HandwritingScannerProps {
  onDNAExtracted?: (dna: HandwritingDNA) => void;
  onClose?: () => void;
}

export const HandwritingScanner: React.FC<HandwritingScannerProps> = ({ onDNAExtracted, onClose }) => {
  const [step, setStep] = useState<'upload' | 'scanning' | 'results' | 'adjust'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dna, setDNA] = useState<HandwritingDNA | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('neat_student');
  const [adjustments, setAdjustments] = useState<Partial<HandwritingDNA>>({});
  const [sampleText] = useState('The quick brown fox jumps over the lazy dog. Hindi: भारत मेरा देश है।');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle image upload
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      
      // Start scanning
      setStep('scanning');
      setTimeout(() => processImage(dataUrl), 500);
    };
    reader.readAsDataURL(file);
  }, []);

  // Process the uploaded image
  const processImage = useCallback((dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Resize for processing
      const maxDim = 800;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Analyze!
      const extractedDNA = analyzeHandwritingImage(imageData);
      setDNA(extractedDNA);
      setSelectedPreset(findClosestPreset(extractedDNA));
      setStep('results');
    };
    img.src = dataUrl;
  }, []);

  // Handle camera capture
  const handleCamera = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Apply preset
  const applyPreset = useCallback((name: string) => {
    setSelectedPreset(name);
    setDNA(DNA_PRESETS[name]);
    setAdjustments({});
  }, []);

  // Use extracted DNA
  const useDNA = useCallback(() => {
    if (dna && onDNAExtracted) {
      onDNAExtracted(dna);
    }
  }, [dna, onDNAExtracted]);

  // Reset
  const reset = useCallback(() => {
    setStep('upload');
    setImagePreview(null);
    setDNA(null);
    setAdjustments({});
  }, []);

  // Adjust DNA parameter
  const adjustDNA = useCallback((key: keyof HandwritingDNA, value: number) => {
    if (!dna) return;
    const newDNA = { ...dna, [key]: value };
    setAdjustments(prev => ({ ...prev, [key]: value }));
    setDNA(newDNA);
  }, [dna]);

  const currentDNA = dna || DNA_PRESETS[selectedPreset];
  const dnaCSS = dnaToCSS(currentDNA);

  return (
    <div className="max-w-2xl mx-auto">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-nk-purple to-nk-rose flex items-center justify-center shadow-lg">
              <Scan className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Handwriting DNA Scanner 🔬</h2>
              <p className="text-muted-foreground mt-2">
                Apni handwriting ka photo upload karo — hum scan karke pattern nikalenge!
              </p>
            </div>

            {/* Upload area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[color:hsl(var(--primary)/0.3)] rounded-2xl p-8 cursor-pointer hover:border-primary hover:bg-[color:hsl(var(--primary)/0.5)] transition-all"
            >
              <Upload className="w-10 h-10 text-accent-cool mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Click to upload handwriting image</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, HEIC — phone photo bhi chalega!</p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-gradient-to-r from-nk-purple to-nk-rose">
                <Upload className="w-4 h-4" />
                Upload Photo
              </Button>
              <Button variant="outline" onClick={handleCamera} className="gap-2">
                <Camera className="w-4 h-4" />
                Take Photo
              </Button>
            </div>

            {/* Or choose preset */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Ya preset choose karo:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(DNA_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => { applyPreset(key); setStep('results'); }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPreset === key
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <span className="text-sm font-medium">{preset.styleName}</span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">{preset.styleDescription.slice(0, 40)}...</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Scanning */}
        {step === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-6"
          >
            {imagePreview && (
              <div className="relative rounded-2xl overflow-hidden border-2 border-[color:hsl(var(--primary)/0.3)]">
                <img src={imagePreview} alt="Handwriting sample" className="w-full max-h-80 object-contain" />
                {/* Scanning overlay */}
                <motion.div
                  className="absolute inset-0 bg-primary/10"
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-nk-burgundy to-transparent"
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            )}
            <div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="inline-block"
              >
                <Sparkles className="w-8 h-8 text-accent-cool" />
              </motion.div>
              <p className="text-lg font-semibold mt-3">Scanning handwriting DNA... 🔬</p>
              <p className="text-sm text-muted-foreground">
                Analyzing slant, pressure, size, spacing, connections...
              </p>
            </div>
          </motion.div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && dna && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:hsl(var(--success)/0.14)] text-success text-sm font-medium mb-3">
                <Check className="w-4 h-4" />
                DNA Extracted Successfully!
              </div>
              <h2 className="text-2xl font-bold">{dna.styleName}</h2>
              <p className="text-muted-foreground">{dna.styleDescription}</p>
            </div>

            {/* Preview */}
            <div className="p-6 rounded-2xl bg-[color:hsl(var(--accent-warm-hsl)/0.16)] border border-[color:hsl(var(--accent-warm-hsl)/0.34)]">
              <p className="text-xs text-accent-warm font-medium mb-2">Preview:</p>
              <div style={dnaCSS} className="font-handwriting-1 text-fg-primary whitespace-pre-wrap">
                {sampleText}
              </div>
            </div>

            {/* DNA Parameters */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'slant', label: 'Slant', icon: '↗️' },
                { key: 'pressure', label: 'Pressure', icon: '✍️' },
                { key: 'size', label: 'Size', icon: '📏' },
                { key: 'spacing', label: 'Spacing', icon: '↔️' },
                { key: 'connectedness', label: 'Cursive', icon: '🔗' },
                { key: 'consistency', label: 'Consistency', icon: '🎯' },
              ].map(({ key, label, icon }) => (
                <div key={key} className="p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{icon} {label}</span>
                    <span className="text-xs font-bold">{Math.round(currentDNA[key as keyof HandwritingDNA] as number)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-nk-purple to-nk-rose rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${currentDNA[key as keyof HandwritingDNA] as number}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={useDNA} className="flex-1 gap-2 bg-gradient-to-r from-nk-purple to-nk-rose">
                <Sparkles className="w-4 h-4" />
                Use This Style
              </Button>
              <Button variant="outline" onClick={() => setStep('adjust')} className="gap-2">
                <Sliders className="w-4 h-4" />
                Adjust
              </Button>
              <Button variant="ghost" onClick={reset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Adjust */}
        {step === 'adjust' && dna && (
          <motion.div
            key="adjust"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <h2 className="text-xl font-bold">Fine-tune DNA 🔧</h2>
            
            {/* Live Preview */}
            <div className="p-4 rounded-2xl bg-[color:hsl(var(--accent-warm-hsl)/0.16)] border border-[color:hsl(var(--accent-warm-hsl)/0.34)]">
              <p className="text-xs text-accent-warm font-medium mb-1">Live Preview:</p>
              <div style={dnaToCSS(currentDNA)} className="font-handwriting-1 text-fg-primary">
                {sampleText}
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              {[
                { key: 'slant' as const, label: 'Slant', min: -50, max: 50 },
                { key: 'pressure' as const, label: 'Pressure', min: 0, max: 100 },
                { key: 'size' as const, label: 'Size', min: 0, max: 100 },
                { key: 'spacing' as const, label: 'Spacing', min: 0, max: 100 },
                { key: 'connectedness' as const, label: 'Cursive Level', min: 0, max: 100 },
                { key: 'consistency' as const, label: 'Consistency', min: 0, max: 100 },
                { key: 'strokeWidth' as const, label: 'Stroke Width', min: 0, max: 100 },
                { key: 'loopiness' as const, label: 'Loopiness', min: 0, max: 100 },
                { key: 'roundedness' as const, label: 'Roundedness', min: 0, max: 100 },
              ].map(({ key, label, min, max }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium">{label}</label>
                    <span className="text-xs font-mono text-muted-foreground">
                      {Math.round(currentDNA[key] as number)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={currentDNA[key] as number}
                    onChange={(e) => adjustDNA(key, parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button onClick={useDNA} className="flex-1 gap-2 bg-gradient-to-r from-nk-purple to-nk-rose">
                <Check className="w-4 h-4" />
                Apply DNA
              </Button>
              <Button variant="outline" onClick={() => setStep('results')}>
                <Eye className="w-4 h-4 mr-2" />
                Back to Results
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
