import { useCallback, useEffect, useState } from 'react';
import { mutate, newId, select, TraderRow } from '@/lib/local-db';
import { Trader } from '@/types';

const mapTrader = (row: TraderRow): Trader => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  notes: row.notes || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const DUPLICATE_NAME_ERROR = 'فيه تاجر بنفس الاسم ده بالفعل';

export const useTraders = () => {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTraders = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = select('traders').sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      setTraders(data.map(mapTrader));
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
      mutate((tables) => {
        const name = payload.name.trim();
        if (tables.traders.some((trader) => trader.name === name)) {
          throw new Error(DUPLICATE_NAME_ERROR);
        }
        const now = new Date().toISOString();
        tables.traders.push({
          id: newId(),
          name,
          phone: payload.phone?.trim() || null,
          notes: payload.notes?.trim() || null,
          created_at: now,
          updated_at: now,
        });
      });
      await loadTraders();
    },
    [loadTraders]
  );

  const updateTrader = useCallback(
    async (
      id: string,
      updates: { name?: string; phone?: string; notes?: string }
    ) => {
      mutate((tables) => {
        const trader = tables.traders.find((entry) => entry.id === id);
        if (!trader) throw new Error('التاجر مش موجود');

        const name = updates.name?.trim();
        if (name && tables.traders.some((entry) => entry.id !== id && entry.name === name)) {
          throw new Error(DUPLICATE_NAME_ERROR);
        }
        if (name) trader.name = name;
        trader.phone = updates.phone?.trim() || null;
        trader.notes = updates.notes?.trim() || null;
        trader.updated_at = new Date().toISOString();
      });
      await loadTraders();
    },
    [loadTraders]
  );

  const deleteTrader = useCallback(
    async (id: string) => {
      mutate((tables) => {
        tables.traders = tables.traders.filter((trader) => trader.id !== id);
        tables.products.forEach((product) => {
          if (product.trader_id === id) product.trader_id = null;
        });
      });
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
