import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotebooks, Notebook } from '@/hooks/useNotebooks';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Search, FolderOpen, Tag, BookOpen, ArrowLeft,
  MoreVertical, Edit2, Trash2, FolderPlus, X, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const COVER_COLORS = [
  '#5C3A6E', '#7C5F9E', '#A34054', '#A62B36',
  '#C4762F', '#157F52', '#7C5F9E', '#7C5F9E',
];

const MyNotebooks: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { notebooks, loading, createNotebook, updateNotebook, deleteNotebook } = useNotebooks();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFolder, setFormFolder] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formColor, setFormColor] = useState(COVER_COLORS[0]);

  // Derived data
  const folders = useMemo(() => {
    const set = new Set<string>();
    notebooks.forEach((n) => n.folder && set.add(n.folder));
    return Array.from(set).sort();
  }, [notebooks]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notebooks.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [notebooks]);

  const filteredNotebooks = useMemo(() => {
    let list = notebooks;
    if (activeFolder) list = list.filter((n) => n.folder === activeFolder);
    if (activeTag) list = list.filter((n) => (n.tags || []).includes(activeTag));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q) ||
          (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [notebooks, activeFolder, activeTag, searchQuery]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormFolder('');
    setFormTags('');
    setFormColor(COVER_COLORS[0]);
    setEditingNotebook(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };

  const openEdit = (nb: Notebook) => {
    setEditingNotebook(nb);
    setFormTitle(nb.title);
    setFormDescription(nb.description || '');
    setFormFolder(nb.folder || '');
    setFormTags((nb.tags || []).join(', '));
    setFormColor(nb.cover_color);
    setShowCreateDialog(true);
  };

  const handleSave = async () => {
    const tags = formTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const payload: any = {
      title: formTitle || 'Untitled Notebook',
      description: formDescription || null,
      folder: formFolder || null,
      tags,
      cover_color: formColor,
    };

    if (editingNotebook) {
      await updateNotebook(editingNotebook.id, payload);
      toast.success('Notebook updated!');
    } else {
      await createNotebook(payload);
    }
    setShowCreateDialog(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notebook and all its pages?')) return;
    await deleteNotebook(id);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold truncate">My Notebooks</h1>
          <div className="ml-auto">
            <Button size="sm" onClick={openCreate} className="gap-1.5 rounded-xl">
              <Plus className="w-4 h-4" /> New
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notebooks, tags..."
            className="pl-10 rounded-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Folder / Tag chips */}
        {(folders.length > 0 || allTags.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {activeFolder || activeTag ? (
              <Badge
                variant="outline"
                className="cursor-pointer gap-1"
                onClick={() => { setActiveFolder(null); setActiveTag(null); }}
              >
                <X className="w-3 h-3" /> Clear filter
              </Badge>
            ) : null}

            {folders.map((f) => (
              <Badge
                key={f}
                variant={activeFolder === f ? 'default' : 'secondary'}
                className="cursor-pointer gap-1"
                onClick={() => setActiveFolder(activeFolder === f ? null : f)}
              >
                <FolderOpen className="w-3 h-3" /> {f}
              </Badge>
            ))}
            {allTags.map((t) => (
              <Badge
                key={t}
                variant={activeTag === t ? 'default' : 'outline'}
                className="cursor-pointer gap-1"
                onClick={() => setActiveTag(activeTag === t ? null : t)}
              >
                <Tag className="w-3 h-3" /> {t}
              </Badge>
            ))}
          </div>
        )}

        {/* Notebooks grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filteredNotebooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">
              {notebooks.length === 0 ? 'No notebooks yet' : 'No matches found'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {notebooks.length === 0
                ? 'Create your first notebook to start writing!'
                : 'Try a different search or filter.'}
            </p>
            {notebooks.length === 0 && (
              <Button onClick={openCreate} className="gap-2 rounded-xl">
                <Plus className="w-4 h-4" /> Create Notebook
              </Button>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredNotebooks.map((nb, i) => (
                <motion.div
                  key={nb.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className="group relative bg-card rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => navigate(`/app?notebook=${nb.id}`)}
                >
                  <div className="h-2.5 w-full" style={{ backgroundColor: nb.cover_color }} />
                  <div className="p-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${nb.cover_color}18` }}
                    >
                      <BookOpen className="w-5 h-5" style={{ color: nb.cover_color }} />
                    </div>
                    <h3 className="font-semibold text-base mb-0.5 truncate group-hover:text-accent-rose transition-colors">
                      {nb.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                      {nb.description || 'No description'}
                    </p>

                    {/* Tags */}
                    {(nb.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {nb.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-accent-rose"
                          >
                            #{t}
                          </span>
                        ))}
                        {nb.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{nb.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {nb.folder && (
                          <span className="inline-flex items-center gap-0.5 mr-2">
                            <FolderOpen className="w-3 h-3" /> {nb.folder}
                          </span>
                        )}
                        {new Date(nb.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-4 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => openEdit(nb)}>
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(nb.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingNotebook ? 'Edit Notebook' : 'New Notebook'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="My Physics Notes"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Folder</Label>
              <Input
                value={formFolder}
                onChange={(e) => setFormFolder(e.target.value)}
                placeholder="e.g. Semester 3"
                className="mt-1"
                list="folder-suggestions"
              />
              <datalist id="folder-suggestions">
                {folders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="physics, exam, important"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cover Color</Label>
              <div className="flex gap-2 mt-2">
                {COVER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      formColor === c ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingNotebook ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyNotebooks;
