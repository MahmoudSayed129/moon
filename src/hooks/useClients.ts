import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Client, Order, OrderItem } from '@/types';
import { useAuth } from './useAuth';
import { resolveOrderFinancials } from '@/lib/order-financials';

const mapClient = (row: any): Client => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  email: row.email || '',
  notes: row.notes || '',
  hasReturns: Boolean(row.has_returns),
  returnsCount: Number(row.returns_count || 0),
  lastReturnedAt: row.last_returned_at || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapOrderItems = (rows: any[] = []): OrderItem[] =>
  rows.map((item) => ({
    id: item.id,
    orderId: item.order_id,
    productId: item.product_id || undefined,
    productName: item.product_name,
    productBarcode: item.product_barcode,
    quantity: item.quantity,
    returnedQuantity: Number(item.returned_quantity || 0),
    returnableQuantity: Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0)),
    unitPrice: Number(item.unit_price),
    lineTotal: Number(item.line_total),
    createdAt: item.created_at,
  }));

const mapOrderReturns = (rows: any[] = []) =>
  rows.map((entry) => ({
    id: entry.id,
    orderId: entry.order_id,
    clientId: entry.client_id || undefined,
    processedByAuthId: entry.processed_by_auth_id || undefined,
    reason: entry.reason || '',
    subtotalReturned: Number(entry.subtotal_returned || 0),
    commissionReturned: Number(entry.commission_returned || 0),
    totalReturned: Number(entry.total_returned || 0),
    createdAt: entry.created_at,
    items: (entry.order_return_items || []).map((returnItem: any) => ({
      id: returnItem.id,
      returnId: returnItem.return_id,
      orderItemId: returnItem.order_item_id,
      productId: returnItem.product_id || undefined,
      productName: returnItem.product_name,
      productBarcode: returnItem.product_barcode,
      quantity: Number(returnItem.quantity || 0),
      unitPrice: Number(returnItem.unit_price || 0),
      lineTotal: Number(returnItem.line_total || 0),
      createdAt: returnItem.created_at,
    })),
  }));

const mapOrder = (row: any): Order => {
  const financials = resolveOrderFinancials(row);

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id || undefined,
    employeeId: row.employee_id || undefined,
    employeeCode: row.employee_code || undefined,
    soldByAuthId: row.sold_by_auth_id || undefined,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount || 0),
    commissionRate: Number(row.commission_rate || 0),
    commissionAmount: Number(row.commission_amount || 0),
    totalAmount: Number(row.total_amount),
    returnedSubtotal: Number(row.returned_subtotal || 0),
    returnedCommissionAmount: Number(row.returned_commission_amount || 0),
    returnedTotalAmount: Number(row.returned_total_amount || 0),
    netSubtotal: financials.netSubtotal,
    netCommissionAmount: financials.netCommissionAmount,
    netTotalAmount: financials.netTotalAmount,
    hasReturn: Boolean(row.has_return),
    returnCount: Number(row.return_count || 0),
    lastReturnedAt: row.last_returned_at || undefined,
    returnStatus: (row.return_status || 'none') as 'none' | 'partial' | 'full',
    notes: row.notes || '',
    createdAt: row.created_at,
    items: mapOrderItems(row.order_items),
    returns: mapOrderReturns(row.order_returns),
  };
};

export const useClients = () => {
  const { authState } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients((data || []).map(mapClient));
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState.isAuthenticated) {
      loadClients();
    }
  }, [authState.isAuthenticated, loadClients]);

  const addClient = useCallback(async (payload: {
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) => {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: payload.name.trim(),
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        notes: payload.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    const client = mapClient(data);
    setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
    return client;
  }, []);

  const updateClient = useCallback(async (
    clientId: string,
    updates: Partial<Pick<Client, 'name' | 'phone' | 'email' | 'notes'>>
  ) => {
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: updates.name?.trim(),
        phone: updates.phone?.trim() || null,
        email: updates.email?.trim() || null,
        notes: updates.notes?.trim() || null,
      })
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;

    const client = mapClient(data);
    setClients((prev) => prev.map((entry) => (entry.id === client.id ? client : entry)));
    return client;
  }, []);

  const deleteClient = useCallback(async (clientId: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) throw error;
    setClients((prev) => prev.filter((client) => client.id !== clientId));
  }, []);

  const getClientOrders = useCallback(async (clientId: string) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*),
        order_returns (
          *,
          order_return_items (*)
        )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapOrder);
  }, []);

  return {
    clients,
    isLoading,
    addClient,
    updateClient,
    deleteClient,
    getClientOrders,
    refreshClients: loadClients,
  };
};
