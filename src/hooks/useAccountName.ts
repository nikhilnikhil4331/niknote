import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { accountName } from '@/lib/accountName';

export function useAccountName() {
  const { user } = useAuth();
  const id = user?.id;
  const { data } = useQuery({
    queryKey: ['account-display-name', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('profiles').select('display_name').eq('user_id', id).maybeSingle();
      if (error) return null;
      return data?.display_name ?? null;
    },
    staleTime: 60_000,
  });
  return accountName(user, data);
}