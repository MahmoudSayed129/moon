import { useCallback, useEffect, useState } from 'react';
import { select, UserRow } from '@/lib/local-db';
import { useAuth } from './useAuth';

export interface EmployeeDirectoryEntry {
  id: string;
  username: string;
  employeeCode?: string;
  role: 'super_admin' | 'supervisor' | 'employee';
  commissionRate: number;
}

const mapEmployee = (row: UserRow): EmployeeDirectoryEntry => ({
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
      const data = select('users')
        .filter((user) => user.role === 'employee' || user.role === 'supervisor')
        .sort((a, b) => a.username.localeCompare(b.username));
      setEmployees(data.map(mapEmployee));
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
