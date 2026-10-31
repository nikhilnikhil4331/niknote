import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Loader2, CheckCircle2, Camera, Image as ImageIcon, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface FileUploadZoneProps {
  onContentExtracted: (content: string, fileName: string) => void;
  onImageBase64?: (base64: string) => void;
  className?: string;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({ 
  onContentExtracted, 
  onImageBase64,
  className 
}) => {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  };

  const processImageWithOCR = async (file: File) => {
    // CRITICAL: Check auth before making any API calls
    if (!session?.access_token || !user) {
      toast.error('Please sign in to upload images');
      navigate('/login');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setPreviewUrl(base64);
      
      if (onImageBase64) {
        onImageBase64(base64);
      }

      // Call OpenAI Vision for OCR with proper auth
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-brain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'ocr_solve',
          content: 'Extract all text from this image. If it contains a question or problem, identify it clearly.',
          imageBase64: base64,
          mode: 'student',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (response.status === 401) {
          toast.error('Session expired. Please sign in again.');
          navigate('/login');
          return;
        }
        throw new Error(error.error || 'OCR processing failed');
      }

      const data = await response.json();
      const extractedText = data.result || '';
      
      if (extractedText) {
        onContentExtracted(extractedText, file.name);
        toast.success('Image text extracted with AI!');
      } else {
        onContentExtracted(`[Image: ${file.name}]\n\nPlease type the content you see in the image.`, file.name);
        toast.info('No text detected. Please enter content manually.');
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract text from image');
      onContentExtracted(`[Image: ${file.name}]\n\nPlease type the content manually.`, file.name);
    }
  };

  const processFile = useCallback(async (file: File) => {
    // CRITICAL: Auth check before processing
    if (!session?.access_token || !user) {
      toast.error('Please sign in to upload files');
      navigate('/login');
      return;
    }

    setUploadedFile(file);
    setIsProcessing(true);

    try {
      // For text files, read directly
      if (file.type === 'text/plain') {
        const text = await file.text();
        onContentExtracted(text, file.name);
        toast.success('Text file loaded successfully!');
        setIsProcessing(false);
        return;
      }

      // For images, use OpenAI Vision OCR
      if (file.type.startsWith('image/')) {
        await processImageWithOCR(file);
        setIsProcessing(false);
        return;
      }

      // For PDFs and Word docs - extract what we can
      if (file.type === 'application/pdf' || file.type.includes('word')) {
        toast.info('Document uploaded! Paste the text content for AI processing.');
        onContentExtracted(`[Document: ${file.name}]\n\nPlease type or paste the content from this document below.`, file.name);
        setIsProcessing(false);
        return;
      }

      toast.error('Unsupported file type');
    } catch (error) {
      console.error('File processing error:', error);
      toast.error('Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  }, [onContentExtracted, session, user, onImageBase64, navigate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleCameraCapture = useCallback(() => {
    // Check auth first
    if (!session?.access_token || !user) {
      toast.error('Please sign in to take photos');
      navigate('/login');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        processFile(target.files[0]);
      }
    };
    input.click();
  }, [processFile, session, user, navigate]);

  const clearFile = useCallback(() => {
    setUploadedFile(null);
    setPreviewUrl(null);
  }, []);

  // Show login prompt if not authenticated
  if (!user || !session) {
    return (
      <div className={className}>
        <div className="p-6 rounded-2xl border-2 border-dashed border-[color:hsl(var(--accent-warm-hsl)/0.5)] bg-nk-warm-600/5">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-nk-warm-600/10 flex items-center justify-center mb-3">
              <LogIn className="w-6 h-6 text-accent-warm" />
            </div>
            <p className="font-medium text-sm text-accent-warm dark:text-accent-warm">
              Sign in required
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Please sign in to upload files and use AI features
            </p>
            <Button 
              onClick={() => navigate('/login')} 
              size="sm"
              className="gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        {uploadedFile ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 rounded-2xl border-2 border-[color:hsl(var(--success)/0.3)] bg-success/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isProcessing ? (
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-accent-rose animate-spin" />
                  </div>
                ) : previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm truncate max-w-[180px]">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isProcessing ? 'AI is extracting text...' : 'Ready for processing'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile} disabled={isProcessing} className="rounded-xl">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-3"
          >
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                relative p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer
                ${isDragging 
                  ? 'border-primary bg-primary/5 scale-[1.02]' 
                  : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
                }
              `}
            >
              <input
                type="file"
                accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center text-center">
                <div className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-colors
                  ${isDragging ? 'bg-primary/20' : 'bg-muted'}
                `}>
                  <Upload className={`w-6 h-6 ${isDragging ? 'text-accent-rose' : 'text-muted-foreground'}`} />
                </div>
                <p className="font-medium text-sm">
                  {isDragging ? 'Drop your file here' : 'Upload homework or document'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  📸 Images • 📄 PDFs • 📝 Word docs
                </p>
              </div>
            </div>

            {/* Camera button for mobile */}
            <div className="flex gap-2 sm:hidden">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCameraCapture}
                className="flex-1 gap-2 rounded-xl"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                className="flex-1 gap-2 rounded-xl"
              >
                <ImageIcon className="w-4 h-4" />
                Gallery
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
