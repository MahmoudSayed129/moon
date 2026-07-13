import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trader } from '@/types';

const mapTrader = (row: any): Trader => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  notes: row.notes || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const useTraders = () => {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTraders = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('traders')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setTraders((data || []).map(mapTrader));
    } catch (error) {
      console.error('Error loading traders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTraders();
  }, [loadTraders]);

  const addTrader = useCallback(
    async (payload: { name: string; phone?: string; notes?: string }) => {
      const { error } = await supabase.from('traders').insert({
        name: payload.name.trim(),
        phone: payload.phone?.trim() || null,
        notes: payload.notes?.trim() || null,
      });
      if (error) throw error;
      await loadTraders();
    },
    [loadTraders]
  );

  const updateTrader = useCallback(
    async (
      id: string,
      updates: { name?: string; phone?: string; notes?: string }
    ) => {
      const { error } = await supabase
        .from('traders')
        .update({
          name: updates.name?.trim(),
          phone: updates.phone?.trim() || null,
          notes: updates.notes?.trim() || null,
        })
        .eq('id', id);
      if (error) throw error;
      await loadTraders();
    },
    [loadTraders]
  );

  const deleteTrader = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('traders').delete().eq('id', id);
      if (error) throw error;
      await loadTraders();
    },
    [loadTraders]
  );

  return {
    traders,
    isLoading,
    addTrader,
    updateTrader,
    deleteTrader,
    refreshTraders: loadTraders,
  };
};
