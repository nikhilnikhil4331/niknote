import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { trackStartNoteCreation } from '@/lib/tracking';

export interface Notebook {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_color: string;
  handwriting_model_id: string | null;
  page_style: string;
  page_size: string;
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
  content: any[];
  page_number: number;
  created_at: string;
  updated_at: string;
}

export const useNotebooks = () => {
  const { user } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotebooks = useCallback(async () => {
    if (!user || String(user.id || '').startsWith('local-guest-')) {
      try {
        const localRaw = localStorage.getItem('niknote.mobile.notebooks.v1');
        setNotebooks(localRaw ? (JSON.parse(localRaw) as Notebook[]) : []);
      } catch {
        setNotebooks([]);
      }
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

      setNotebooks((data || []) as Notebook[]);
    } catch (error) {
      console.warn('Notebook fetch fallback to local cache:', error);
      try {
        const localRaw = localStorage.getItem('niknote.mobile.notebooks.v1');
        if (localRaw) setNotebooks(JSON.parse(localRaw) as Notebook[]);
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotebooks();
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
      toast.success('Notebook created!');
      return newNotebook;
    } catch (error) {
      console.error('Error creating notebook:', error);
      toast.error('Failed to create notebook');
      return null;
    }
  };

  const updateNotebook = async (id: string, updates: Partial<Notebook>) => {
    try {
      const { data, error } = await supabase
        .from('notebooks')
        .update(updates)
        .eq('id', id)
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
    try {
      const { error } = await supabase
        .from('notebooks')
        .delete()
        .eq('id', id);

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
          user_id: user.id,
          notebook_id: notebookId,
          page_number: nextPageNumber,
          content: [] as any,
          ...pageData,
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
        .update(updates as any)
        .eq('id', id)
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
        .eq('id', id);

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
