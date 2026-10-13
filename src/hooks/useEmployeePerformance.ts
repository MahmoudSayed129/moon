import { useEffect, useMemo, useState } from 'react';
import { isInMonth, select } from '@/lib/local-db';
import { resolveOrderFinancials } from '@/lib/order-financials';
import { useAuth } from './useAuth';

export interface EmployeePerformanceEntry {
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  ordersCount: number;
  itemsSold: number;
  netRevenue: number;
}

export const useEmployeePerformance = (month: string) => {
  const { authState } = useAuth();
  const [entries, setEntries] = useState<EmployeePerformanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadPerformance = async () => {
      if (!authState.isAuthenticated || !month) return;

      try {
        setIsLoading(true);

        const employeesData = select('users')
          .filter((user) => user.role === 'employee')
          .sort((a, b) => a.username.localeCompare(b.username));
        const orderItems = select('order_items');
        const ordersData = select('orders')
          .filter((order) => order.employee_id && isInMonth(order.created_at, month))
          .map((order) => ({
            ...order,
            order_items: orderItems.filter((item) => item.order_id === order.id),
          }));

        const performanceMap = new Map<string, EmployeePerformanceEntry>(
          employeesData.map((employee) => [
            employee.id,
            {
              employeeId: employee.id,
              employeeName: employee.username,
              employeeCode: employee.employee_code || undefined,
              ordersCount: 0,
              itemsSold: 0,
              netRevenue: 0,
            },
          ])
        );

        for (const order of ordersData) {
          if (!order.employee_id) continue;

          const employee = performanceMap.get(order.employee_id);
          if (!employee) continue;

          const financials = resolveOrderFinancials(order);
          const itemsSold = order.order_items.reduce((sum, item) => {
            return sum + Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0));
          }, 0);

          employee.ordersCount += 1;
          employee.itemsSold += itemsSold;
          employee.netRevenue += financials.netTotalAmount;
        }

        setEntries(
          Array.from(performanceMap.values()).sort((a, b) => {
            if (b.netRevenue !== a.netRevenue) return b.netRevenue - a.netRevenue;
            if (b.ordersCount !== a.ordersCount) return b.ordersCount - a.ordersCount;
            return a.employeeName.localeCompare(b.employeeName);
          })
        );
      } catch (error) {
        console.error('Error loading employee performance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPerformance();
  }, [authState.isAuthenticated, month]);

  const stats = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.employeesCount += 1;
        acc.ordersCount += entry.ordersCount;
        acc.itemsSold += entry.itemsSold;
        acc.netRevenue += entry.netRevenue;
        return acc;
      },
      {
        employeesCount: 0,
        ordersCount: 0,
        itemsSold: 0,
        netRevenue: 0,
      }
    );
  }, [entries]);

  return {
    entries,
    stats,
    isLoading,
  };
};
