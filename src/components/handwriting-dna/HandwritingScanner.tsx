import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Camera, Scan, Check, X, Sparkles, RotateCcw, Download, Sliders, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HandwritingDNA, DNA_PRESETS, analyzeHandwritingImage, findClosestPreset } from './HandwritingDNAEngine';
import { dnaPresetMeta, dnaTraits, handwritingClassForDNA } from '@/lib/handwritingStyle';
import { DnaSamplePreview } from './HandwritingPage';


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
  const [sampleText, setSampleText] = useState('The quick brown fox jumps over 42 lazy dogs.');
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
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
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
              className="border-2 border-dashed border-purple-300 rounded-2xl p-8 cursor-pointer hover:border-purple-500 hover:bg-purple-50/50 transition-all"
            >
              <Upload className="w-10 h-10 text-purple-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Click to upload handwriting image</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, HEIC — phone photo bhi chalega!</p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-gradient-to-r from-purple-500 to-blue-600">
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
              <div className="grid grid-cols-2 gap-2" data-testid="dna-preset-grid">
                {Object.keys(DNA_PRESETS).map(key => {
                  const meta = dnaPresetMeta(key);
                  const preset = DNA_PRESETS[key];
                  return (
                    <button
                      key={key}
                      onClick={() => { applyPreset(key); setStep('results'); }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedPreset === key ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30'
                      }`}
                    >
                      <span className={`block truncate text-sm text-foreground ${handwritingClassForDNA({ ...preset, closestFont: undefined })}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5 leading-snug">{meta.description}</span>
                    </button>
                  );
                })}
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
              <div className="relative rounded-2xl overflow-hidden border-2 border-purple-300">
                <img src={imagePreview} alt="Handwriting sample" className="w-full max-h-80 object-contain" />
                {/* Scanning overlay */}
                <motion.div
                  className="absolute inset-0 bg-purple-500/10"
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"
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
                <Sparkles className="w-8 h-8 text-purple-500" />
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
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-medium mb-3">
                <Check className="w-4 h-4" />
                DNA Extracted Successfully!
              </div>
              <h2 className="text-2xl font-bold">{dna.styleName}</h2>
              <p className="text-muted-foreground">{dna.styleDescription}</p>
            </div>

            {/* Preview — same renderer as the notebook, side by side with the photo */}
            <div className="grid gap-3 sm:grid-cols-2 items-start">
              {imagePreview && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1.5">Your sample</p>
                  <img src={imagePreview} alt="Uploaded handwriting sample" className="w-full max-h-40 rounded-lg object-contain bg-white" />
                </div>
              )}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-1.5">Your notes in this style</p>
                <div className="scale-[0.86] origin-top-left">
                  <DnaSamplePreview dna={currentDNA} text={sampleText} />
                </div>
              </div>
            </div>

            {/* DNA Parameters */}
            <div className="grid grid-cols-2 gap-3">
              {dnaTraits(currentDNA).map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{label}</span>
                    <span className="text-xs font-bold tabular-nums">{value}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden" role="presentation">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {currentDNA.confidence != null && (
              <p className="text-[11px] text-muted-foreground text-center">
                Sample quality: <strong>{String(currentDNA.sampleQuality ?? '—')}</strong> · {Math.round(currentDNA.confidence * 100)}% confidence
                {currentDNA.confidence < 0.5 && ' — a straight, well-lit photo of 3+ lines gives a much closer match.'}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={useDNA} className="flex-1 gap-2 bg-gradient-to-r from-purple-500 to-blue-600">
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
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-1.5">Live preview</p>
              <div className="scale-[0.9] origin-top-left">
                <DnaSamplePreview dna={currentDNA} text={sampleText} />
              </div>
            </div>
            <input
              value={sampleText}
              onChange={e => setSampleText(e.target.value)}
              aria-label="Preview text"
              className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              placeholder="Type your own line to preview"
            />

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
              <Button onClick={useDNA} className="flex-1 gap-2 bg-gradient-to-r from-purple-500 to-blue-600">
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
