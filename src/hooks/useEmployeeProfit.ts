import { useEffect, useState } from 'react';
import { byNewest, isInMonth, select } from '@/lib/local-db';
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

      try {
        setIsLoading(true);
        const clients = new Map(select('clients').map((client) => [client.id, client.name]));
        const data = select('orders')
          .filter((order) => order.employee_id === authState.user!.id && isInMonth(order.created_at, month))
          .sort(byNewest);

        setOrders(data.map((order) => {
          const financials = resolveOrderFinancials(order);

          return {
            id: order.id,
            invoiceNumber: order.invoice_number,
            clientName: (order.client_id && clients.get(order.client_id)) || 'Walk-in Client',
            totalAmount: Number(order.total_amount),
            returnedAmount: Number(order.returned_total_amount || 0),
            netTotalAmount: financials.netTotalAmount,
            commissionAmount: Number(order.commission_amount || 0),
            returnedCommissionAmount: Number(order.returned_commission_amount || 0),
            netCommissionAmount: financials.netCommissionAmount,
            commissionRate: Number(order.commission_rate || 0),
            returnStatus: order.return_status || 'none',
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
