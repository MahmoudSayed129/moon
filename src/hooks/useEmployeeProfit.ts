import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { resolveOrderFinancials } from '@/lib/order-financials';

interface EmployeeProfitOrder {
  id: string;
  invoiceNumber: string;
  clientName: string;
  totalAmount: number;
  returnedAmount: number;
  netTotalAmount: number;
  commissionAmount: number;
  returnedCommissionAmount: number;
  netCommissionAmount: number;
  commissionRate: number;
  returnStatus: 'none' | 'partial' | 'full';
  createdAt: string;
}

export const useEmployeeProfit = (month: string) => {
  const { authState } = useAuth();
  const [orders, setOrders] = useState<EmployeeProfitOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadProfit = async () => {
      if (!authState.isAuthenticated || !authState.user || !month) return;

      const startDate = `${month}-01T00:00:00.000Z`;
      const nextMonthDate = new Date(`${month}-01T00:00:00.000Z`);
      nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
      const endDate = nextMonthDate.toISOString();

      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            invoice_number,
            total_amount,
            returned_total_amount,
            net_total_amount,
            commission_amount,
            returned_commission_amount,
            net_commission_amount,
            commission_rate,
            return_status,
            created_at,
            clients ( name )
          `)
          .eq('employee_id', authState.user.id)
          .gte('created_at', startDate)
          .lt('created_at', endDate)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setOrders((data || []).map((order: any) => {
          const financials = resolveOrderFinancials(order);

          return {
            id: order.id,
            invoiceNumber: order.invoice_number,
            clientName: order.clients?.name || 'Walk-in Client',
            totalAmount: Number(order.total_amount),
            returnedAmount: Number(order.returned_total_amount || 0),
            netTotalAmount: financials.netTotalAmount,
            commissionAmount: Number(order.commission_amount || 0),
            returnedCommissionAmount: Number(order.returned_commission_amount || 0),
            netCommissionAmount: financials.netCommissionAmount,
            commissionRate: Number(order.commission_rate || 0),
            returnStatus: (order.return_status || 'none') as 'none' | 'partial' | 'full',
            createdAt: order.created_at,
          };
        }));
      } catch (error) {
        console.error('Error loading employee profit:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfit();
  }, [authState.isAuthenticated, authState.user, month]);

  return {
    orders,
    isLoading,
  };
};
