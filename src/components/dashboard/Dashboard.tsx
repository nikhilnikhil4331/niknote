import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PenTool, Plus, BookOpen, Settings, LogOut, 
  Upload, Sparkles, FileText, User, ChevronRight,
  Moon, Sun, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useHandwritingModels } from '@/hooks/useHandwritingModels';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { NotebookCard } from './NotebookCard';
import { HandwritingUploader } from './HandwritingUploader';
import { HandwritingStyleCard } from './HandwritingStyleCard';
import { FeedbackModal } from './FeedbackModal';
import { toast } from 'sonner';

interface DashboardProps {
  onOpenNotebook: (notebookId: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onOpenNotebook, 
  isDark, 
  onToggleTheme 
}) => {
  const { user, signOut } = useAuth();
  const { notebooks, loading: notebooksLoading, createNotebook, deleteNotebook } = useNotebooks();
  const { models, loading: modelsLoading, activeModel, setActiveModel, createModel, deleteModel } = useHandwritingModels();
  const { playClick, playSuccess } = useSoundEffects();
  const [showUploader, setShowUploader] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleCreateNotebook = async () => {
    playClick();
    const colors = ['#5C3A6E', '#157F52', '#C4762F', '#A62B36', '#7C5F9E', '#A34054'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const notebook = await createNotebook({
      title: `Notebook ${notebooks.length + 1}`,
      cover_color: randomColor,
      handwriting_model_id: activeModel?.id || null,
    });

    if (notebook) {
      playSuccess();
      onOpenNotebook(notebook.id);
    }
  };

  const handleSignOut = async () => {
    playClick();
    await signOut();
    toast.success('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <PenTool className="w-5 h-5 text-accent-rose" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">NikNote</h1>
                <p className="text-xs text-muted-foreground">Your handwriting, digitized</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { playClick(); setShowFeedback(true); }}
                className="rounded-xl"
              >
                <MessageSquare className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { playClick(); onToggleTheme(); }}
                className="rounded-xl"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-accent-rose" />
                </div>
                <span className="text-sm font-medium text-foreground hidden sm:block">
                  {user?.email?.split('@')[0]}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="rounded-xl text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Handwriting Styles Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Your Handwriting Styles</h2>
              <p className="text-muted-foreground mt-1">Upload samples to train your personalized AI style</p>
            </div>
            <Button
              onClick={() => { playClick(); setShowUploader(true); }}
              className="rounded-xl gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Sample
            </Button>
          </div>

          {modelsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-muted/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : models.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-primary/5 to-nk-rose/5 rounded-3xl p-8 text-center border-2 border-dashed border-primary/20"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-accent-rose" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No handwriting styles yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Upload a sample of your handwriting and our AI will analyze it to create your personalized digital style.
              </p>
              <Button
                onClick={() => { playClick(); setShowUploader(true); }}
                className="rounded-xl gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Your First Sample
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((model) => (
                <HandwritingStyleCard
                  key={model.id}
                  model={model}
                  isActive={activeModel?.id === model.id}
                  onSelect={() => { playClick(); setActiveModel(model); }}
                  onDelete={() => { playClick(); deleteModel(model.id); }}
                />
              ))}
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => { playClick(); setShowUploader(true); }}
                className="h-40 bg-muted/30 hover:bg-muted/50 rounded-2xl border-2 border-dashed border-border hover:border-primary/30 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-8 h-8" />
                <span className="text-sm font-medium">Add Style</span>
              </motion.button>
            </div>
          )}
        </section>

        {/* Notebooks Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Your Notebooks</h2>
              <p className="text-muted-foreground mt-1">Create and manage your handwritten notes</p>
            </div>
            <Button
              onClick={handleCreateNotebook}
              className="rounded-xl gap-2"
              disabled={models.length === 0}
            >
              <Plus className="w-4 h-4" />
              New Notebook
            </Button>
          </div>

          {notebooksLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-48 bg-muted/50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : notebooks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-muted/30 rounded-3xl p-8 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No notebooks yet</h3>
              <p className="text-muted-foreground mb-6">
                {models.length === 0 
                  ? 'Upload a handwriting sample first to start creating notebooks'
                  : 'Create your first notebook to start writing in your handwriting style'
                }
              </p>
              {models.length > 0 && (
                <Button onClick={handleCreateNotebook} className="rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Create First Notebook
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {notebooks.map((notebook, index) => (
                <NotebookCard
                  key={notebook.id}
                  notebook={notebook}
                  index={index}
                  onClick={() => { playClick(); onOpenNotebook(notebook.id); }}
                  onDelete={() => { playClick(); deleteNotebook(notebook.id); }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Handwriting Uploader Modal */}
      <AnimatePresence>
        {showUploader && (
          <HandwritingUploader
            onClose={() => setShowUploader(false)}
            onModelCreated={(model) => {
              createModel(model);
              setShowUploader(false);
              playSuccess();
            }}
          />
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedback && (
          <FeedbackModal onClose={() => setShowFeedback(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};
