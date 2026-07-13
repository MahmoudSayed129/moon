import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface EmployeeDirectoryEntry {
  id: string;
  username: string;
  employeeCode?: string;
  role: 'super_admin' | 'supervisor' | 'employee';
  commissionRate: number;
}

const mapEmployee = (row: any): EmployeeDirectoryEntry => ({
  id: row.id,
  username: row.username,
  employeeCode: row.employee_code || undefined,
  role: row.role,
  commissionRate: Number(row.commission_rate || 0),
});

export const useEmployeeDirectory = () => {
  const { authState } = useAuth();
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!authState.isAuthenticated) {
      setEmployees([]);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, username, employee_code, role, commission_rate')
        .in('role', ['employee', 'supervisor'])
        .order('username', { ascending: true });

      if (error) throw error;
      setEmployees((data || []).map(mapEmployee));
    } catch (error) {
      console.error('Error loading employee directory:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authState.isAuthenticated]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  return {
    employees,
    isLoading,
    refreshEmployees: loadEmployees,
  };
};
