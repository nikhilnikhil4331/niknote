import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, Loader2, Camera, X, FileText, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { openPdfPipeline, assemble, validatePdf, type PageResult, type PipelineHandle } from '@/lib/pdfPipeline';

interface HandwritingTextImporterProps {
  onImportText: (lines: string[]) => void;
}

interface OCRResult {
  extractedText: string;
  lines: string[];
  confidence: number;
  warnings: string[];
  success: boolean;
  error?: string;
  shouldRetry?: boolean;
}

export const HandwritingTextImporter: React.FC<HandwritingTextImporterProps> = ({ onImportText }) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { session } = useAuth();
  const navigate = useNavigate();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      await importPdf(file);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image or PDF file');
      return;
    }

    // Validate file size (max 10MB for OCR)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPreviewImage(base64);
      setOcrResult(null);
      setRetryCount(0);
      await extractText(base64, 0);
    };
    reader.readAsDataURL(file);
  };

  const pipelineRef = useRef<PipelineHandle | null>(null);
  const [pages, setPages] = useState<PageResult[]>([]);

  const ocrCall = async (imageBase64: string) => {
    const { data, error } = await supabase.functions.invoke('extract-handwriting-text', { body: { imageBase64, retryAttempt: 0 } });
    if (error) {
      const status = (error as any)?.context?.status ?? (error as any)?.status;
      let msg = error.message;
      try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* keep */ }
      throw Object.assign(new Error(msg), { status });
    }
    if (!data?.success) throw Object.assign(new Error(data?.error || 'Text unclear on this page'), { status: 422 });
    return data.lines as string[];
  };

  const publish = (list: PageResult[]) => {
    const lines = assemble(list);
    const failed = list.filter(p => p?.status === 'failed').map(p => p.index + 1);
    setOcrResult({
      extractedText: lines.join('\n'), lines, confidence: 1, success: lines.some(l => l.trim()),
      warnings: failed.length ? [`Page ${failed.join(', ')} needs retry`] : [],
      error: lines.length ? undefined : 'No text found in this PDF',
    });
  };

  const importPdf = async (file: File) => {
    if (!session?.access_token) { toast.error('Please login first'); navigate('/login'); return; }
    const invalid = validatePdf(file); if (invalid) { toast.error(invalid); return; }
    setIsExtracting(true); setOcrResult(null); setPages([]);
    try {
      const handle = await openPdfPipeline(file, ocrCall);
      pipelineRef.current = handle;
      setPreviewImage(handle.firstPageImage);
      const list = await handle.run(p => setPages(prev => { const n = [...prev]; n[p.index] = p; return n; }));
      setPages([...list]); publish(list);
      const failed = list.filter(p => p.status === 'failed').length;
      if (failed) toast.warning(`${list.length - failed} of ${list.length} pages read. Retry the rest below.`);
      else toast.success(`Read ${list.length} page${list.length > 1 ? 's' : ''} from the PDF`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read PDF');
    } finally { setIsExtracting(false); }
  };

  const retryPdfPage = async (i: number) => {
    const h = pipelineRef.current; if (!h) return;
    const upd = (p: PageResult) => setPages(prev => { const n = [...prev]; n[p.index] = p; return n; });
    const r = await h.retryPage(i, upd);
    setPages(prev => { const n = [...prev]; n[i] = r; publish(n); return n; });
  };

  const extractText = async (imageBase64: string, retryAttempt: number) => {
    setIsExtracting(true);
    
    try {
      if (!session?.access_token) {
        toast.error('Please login first');
        navigate('/login');
        return;
      }

      const { data, error } = await supabase.functions.invoke('extract-handwriting-text', {
        body: { imageBase64, retryAttempt },
      });

      if (error) {
        const status = (error as unknown as { status?: number })?.status;
        if (status === 401) {
          toast.error('Please login first');
          navigate('/login');
          return;
        }
        throw new Error(error.message || 'Extraction failed');
      }

      const result = data as OCRResult;
      setOcrResult(result);
      
      if (result.success) {
        toast.success(`Extracted ${result.lines.length} lines of text!`);
      } else if (result.shouldRetry && retryAttempt < 1) {
        toast.warning('First extraction unclear. Retrying with enhanced processing...');
        setRetryCount(retryAttempt + 1);
        await extractText(imageBase64, retryAttempt + 1);
        return;
      } else {
        toast.error(result.error || 'Could not extract text from image');
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract text');
      setOcrResult({
        extractedText: '',
        lines: [],
        confidence: 0,
        warnings: [(error as Error).message],
        success: false,
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleImport = () => {
    if (!ocrResult?.lines.length) return;

    // CRITICAL: Ensure we import as real editor line blocks.
    // Some OCR pipelines return "lines" that still contain embedded newlines (paragraph chunks).
    const flattened = ocrResult.lines
      .flatMap((chunk) => String(chunk ?? '').split(/\r?\n/))
      .map((l) => l.replace(/[\t ]+$/g, ''));

    onImportText(flattened);
    toast.success('Text imported to editor!');
    clearImage();
  };

  const handleRetry = () => {
    if (previewImage) {
      setOcrResult(null);
      extractText(previewImage, 0);
    }
  };

  const clearImage = () => {
    setPreviewImage(null);
    setOcrResult(null);
    setRetryCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!previewImage ? (
        <Card
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors cursor-pointer p-6 text-center bg-muted/20"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Import a PDF or Photo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Any PDF (typed or scanned) or handwriting photo → rewritten in your style
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-2 gap-2">
              <Camera className="w-4 h-4" />
              Upload PDF / Image
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Preview Image */}
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img
              src={previewImage}
              alt="Handwriting sample"
              className="w-full max-h-48 object-contain bg-white"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-background/80 hover:bg-background"
              onClick={clearImage}
            >
              <X className="w-4 h-4" />
            </Button>
            
            {isExtracting && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm font-medium">
                    {retryCount > 0 ? 'Retrying extraction...' : 'Extracting text...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {pages.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Page progress">
              {pages.map((p, i) => p && (
                <button key={i} type="button" disabled={p.status !== 'failed'} onClick={() => retryPdfPage(i)}
                  title={p.status === 'failed' ? `${p.error} — tap to retry` : p.kind === 'digital' ? 'Text layer' : p.status}
                  className={cn('text-[11px] px-2 py-1 rounded-md border',
                    p.status === 'done' && 'bg-primary/10 border-primary/30',
                    p.status === 'processing' && 'animate-pulse border-primary',
                    p.status === 'queued' && 'text-muted-foreground',
                    p.status === 'skipped' && 'opacity-50',
                    p.status === 'failed' && 'bg-destructive/10 border-destructive text-destructive')}>
                  {i + 1}{p.status === 'failed' ? ' ↻' : p.status === 'done' ? ' ✓' : p.status === 'skipped' ? ' –' : ''}
                </button>
              ))}
            </div>
          )}

          {/* OCR Results */}
          {ocrResult && (
            <Card className={cn(
              "p-4 border",
              ocrResult.success 
                ? "bg-primary/5 border-primary/20" 
                : "bg-destructive/5 border-destructive/20"
            )}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      ocrResult.success ? "bg-primary/10" : "bg-destructive/10"
                    )}>
                      {ocrResult.success ? (
                        <FileText className="w-4 h-4 text-primary" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">
                        {ocrResult.success ? 'Text Extracted' : 'Extraction Failed'}
                      </h4>
                      {ocrResult.success && (
                        <p className="text-xs text-muted-foreground">
                          {ocrResult.lines.length} lines found
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {ocrResult.success && (
                    <div className={cn("text-xs font-medium", getConfidenceColor(ocrResult.confidence))}>
                      {getConfidenceLabel(ocrResult.confidence)} confidence
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {ocrResult.warnings.length > 0 && (
                  <div className="text-xs text-muted-foreground bg-background/50 rounded-lg p-2">
                    {ocrResult.warnings.map((warning, i) => (
                      <p key={i} className="flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-yellow-500" />
                        {warning}
                      </p>
                    ))}
                  </div>
                )}

                {/* Preview of extracted text */}
                {ocrResult.success && ocrResult.lines.length > 0 && (
                  <div className="bg-background/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                    <div className="text-sm whitespace-pre-wrap font-handwriting-1">
                      {ocrResult.lines.slice(0, 5).join('\n')}
                      {ocrResult.lines.length > 5 && (
                        <span className="text-muted-foreground">
                          {'\n'}...and {ocrResult.lines.length - 5} more lines
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Error message */}
                {!ocrResult.success && ocrResult.error && (
                  <p className="text-xs text-destructive">
                    {ocrResult.error}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {ocrResult.success ? (
                    <Button onClick={handleImport} className="flex-1 gap-2" size="sm">
                      <Check className="w-4 h-4" />
                      Import to Editor
                    </Button>
                  ) : (
                    <Button onClick={handleRetry} className="flex-1 gap-2" size="sm" variant="outline">
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Try another image button */}
          {!isExtracting && ocrResult && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full gap-2"
            >
              <Upload className="w-4 h-4" />
              Try Another Image
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

HandwritingTextImporter.displayName = 'HandwritingTextImporter';
