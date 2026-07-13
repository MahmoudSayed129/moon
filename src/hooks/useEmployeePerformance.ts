import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

const getCurrentMonthRange = (month: string) => {
  const startDate = `${month}-01T00:00:00.000Z`;
  const nextMonthDate = new Date(`${month}-01T00:00:00.000Z`);
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);

  return {
    startDate,
    endDate: nextMonthDate.toISOString(),
  };
};

export const useEmployeePerformance = (month: string) => {
  const { authState } = useAuth();
  const [entries, setEntries] = useState<EmployeePerformanceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadPerformance = async () => {
      if (!authState.isAuthenticated || !month) return;

      const { startDate, endDate } = getCurrentMonthRange(month);

      try {
        setIsLoading(true);

        const [{ data: employeesData, error: employeesError }, { data: ordersData, error: ordersError }] = await Promise.all([
          supabase
            .from('users')
            .select('id, username, employee_code, role')
            .eq('role', 'employee')
            .order('username', { ascending: true }),
          supabase
            .from('orders')
            .select(`
              id,
              employee_id,
              employee_code,
              subtotal,
              commission_amount,
              total_amount,
              net_subtotal,
              net_commission_amount,
              net_total_amount,
              has_return,
              return_status,
              order_items (
                quantity,
                returned_quantity
              )
            `)
            .not('employee_id', 'is', null)
            .gte('created_at', startDate)
            .lt('created_at', endDate),
        ]);

        if (employeesError) throw employeesError;
        if (ordersError) throw ordersError;

        const performanceMap = new Map<string, EmployeePerformanceEntry>(
          (employeesData || []).map((employee: any) => [
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

        for (const order of ordersData || []) {
          if (!order.employee_id) continue;

          const employee = performanceMap.get(order.employee_id);
          if (!employee) continue;

          const financials = resolveOrderFinancials(order);
          const itemsSold = (order.order_items || []).reduce((sum: number, item: any) => {
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
