import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { trackFirstNoteCreated } from '@/utils/analytics';
import { trackStartNoteCreation } from '@/lib/tracking';
import { localNotebookAsCloudShape, readLocalNotesForOwner, removeLocalNoteForOwner, upsertLocalNoteForOwner } from '@/lib/localNoteStore';
import type { NoteSettings } from '@/types/notes';

export interface Notebook {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_color: string;
  handwriting_model_id: string | null;
  page_style: string;
  page_size: string;
  settings?: Partial<NoteSettings> | null;
  folder: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  notebook_id: string;
  user_id: string;
  title: string;
  content: Json;
  page_number: number;
  created_at: string;
  updated_at: string;
}

export const useNotebooks = () => {
  const { user, isGuest, loading: authLoading } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotebooks = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);

    if (!user) {
      // Never expose a previous device guest's unowned notes during auth
      // startup or after sign-out.
      setNotebooks([]);
      setLoading(false);
      return;
    }

    const localNotes = readLocalNotesForOwner(user.id, { allowLegacyClaim: isGuest });
    const localRows = localNotes.map((note) => localNotebookAsCloudShape(note, user.id) as Notebook);

    if (String(user.id || '').startsWith('local-guest-')) {
      setNotebooks(localRows);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      const cloudRows = (data || []) as Notebook[];
      const cloudIds = new Set(cloudRows.map((notebook) => notebook.id));
      // Local-first drafts for this same account remain visible during an
      // outage or while their first cloud save is retrying. No other owner is
      // ever mixed into this list.
      setNotebooks([...cloudRows, ...localRows.filter((notebook) => !cloudIds.has(notebook.id))]);
    } catch (error) {
      console.warn('Notebook fetch fallback to owner-scoped local cache:', error);
      setNotebooks(localRows);
    } finally {
      setLoading(false);
    }
  }, [user, isGuest, authLoading]);

  useEffect(() => {
    void fetchNotebooks();
    const refresh = () => { void fetchNotebooks(); };
    window.addEventListener('niknote:local-data-changed', refresh);
    return () => window.removeEventListener('niknote:local-data-changed', refresh);
  }, [fetchNotebooks]);

  const createNotebook = async (notebookData: Partial<Notebook>) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('notebooks')
        .insert({
          user_id: user.id,
          title: notebookData.title || 'Untitled Notebook',
          ...notebookData,
        })
        .select()
        .single();

      if (error) throw error;

      const newNotebook = data as Notebook;
      setNotebooks(prev => [newNotebook, ...prev]);
      trackStartNoteCreation({
        conversionSource: 'create_notebook',
        featureName: 'handwriting_editor',
        pageType: 'workspace',
      });
      // Activation event: this is the first time the user gets real value.
      // Deduped to once per session so it measures activation, not volume.
      trackFirstNoteCreated();
      toast.success('Notebook created!');
      return newNotebook;
    } catch (error) {
      console.error('Error creating notebook:', error);
      toast.error('Failed to create notebook');
      return null;
    }
  };

  const updateNotebook = async (id: string, updates: Partial<Notebook>) => {
    if (!user) return null;
    const local = readLocalNotesForOwner(user.id, { allowLegacyClaim: isGuest }).find((note) => note.id === id);
    if (local && !local._syncedAt) {
      const updated = { ...local, ...updates, updated_at: new Date().toISOString() };
      upsertLocalNoteForOwner(updated, user.id, {}, { allowLegacyClaim: isGuest });
      await fetchNotebooks();
      return localNotebookAsCloudShape(updated, user.id) as Notebook;
    }

    try {
      const { data, error } = await supabase
        .from('notebooks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      const updatedNotebook = data as Notebook;
      setNotebooks(prev => prev.map(n => n.id === id ? updatedNotebook : n));
      return updatedNotebook;
    } catch (error) {
      console.error('Error updating notebook:', error);
      toast.error('Failed to update notebook');
      return null;
    }
  };

  const deleteNotebook = async (id: string) => {
    if (!user) return;
    const local = readLocalNotesForOwner(user.id, { allowLegacyClaim: isGuest }).find((note) => note.id === id);
    if (local && !local._syncedAt) {
      removeLocalNoteForOwner(id, user.id);
      setNotebooks(prev => prev.filter((notebook) => notebook.id !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('notebooks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotebooks(prev => prev.filter(n => n.id !== id));
      toast.success('Notebook deleted');
    } catch (error) {
      console.error('Error deleting notebook:', error);
      toast.error('Failed to delete notebook');
    }
  };

  return {
    notebooks,
    loading,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    refetch: fetchNotebooks,
  };
};

export const usePages = (notebookId: string | null) => {
  const { user } = useAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = useCallback(async () => {
    if (!user || !notebookId) {
      setPages([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('notebook_id', notebookId)
        .eq('user_id', user.id)
        .order('page_number', { ascending: true });

      if (error) throw error;

      setPages((data || []) as Page[]);
    } catch (error) {
      console.error('Error fetching pages:', error);
      toast.error('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [user, notebookId]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const createPage = async (pageData: Partial<Page>) => {
    if (!user || !notebookId) return null;

    try {
      const nextPageNumber = pages.length > 0 
        ? Math.max(...pages.map(p => p.page_number)) + 1 
        : 1;

      const { data, error } = await supabase
        .from('pages')
        .insert([{
          ...pageData,
          user_id: user.id,
          notebook_id: notebookId,
          page_number: nextPageNumber,
          content: pageData.content ?? [],
        }])
        .select()
        .single();

      if (error) throw error;

      const newPage = data as Page;
      setPages(prev => [...prev, newPage]);
      return newPage;
    } catch (error) {
      console.error('Error creating page:', error);
      toast.error('Failed to create page');
      return null;
    }
  };

  const updatePage = async (id: string, updates: Partial<Page>) => {
    try {
      const { data, error } = await supabase
        .from('pages')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user?.id || '')
        .select()
        .single();

      if (error) throw error;

      const updatedPage = data as Page;
      setPages(prev => prev.map(p => p.id === id ? updatedPage : p));
      return updatedPage;
    } catch (error) {
      console.error('Error updating page:', error);
      return null;
    }
  };

  const deletePage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pages')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id || '');

      if (error) throw error;

      setPages(prev => prev.filter(p => p.id !== id));
      toast.success('Page deleted');
    } catch (error) {
      console.error('Error deleting page:', error);
      toast.error('Failed to delete page');
    }
  };

  return {
    pages,
    loading,
    createPage,
    updatePage,
    deletePage,
    refetch: fetchPages,
  };
};
