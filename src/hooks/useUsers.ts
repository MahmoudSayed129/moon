import { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { mutate, newId, select } from '@/lib/local-db';
import { User } from '@/types/auth';
import { useAuth } from './useAuth';

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { authState } = useAuth();

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = select('users').sort((a, b) => b.created_at.localeCompare(a.created_at));

      const mappedUsers: User[] = data.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        employee_code: user.employee_code || undefined,
        commission_rate: Number(user.commission_rate || 0),
        created_at: user.created_at,
        updated_at: user.created_at
      }));
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addUser = async (
    username: string,
    password: string,
    role: 'supervisor' | 'employee',
    employeeCode?: string,
    commissionRate = 0
  ) => {
    try {
      if (!authState.isAuthenticated || !authState.user) {
        return { success: false, error: 'لازم تسجل الدخول علشان تضيف مستخدمين' };
      }

      if (authState.user.role !== 'super_admin') {
        return { success: false, error: 'المدير العام فقط هو اللي يقدر يضيف مستخدمين' };
      }

      if (!username || username.trim().length === 0) {
        return { success: false, error: 'اسم المستخدم مطلوب' };
      }

      if (username.trim().length < 3) {
        return { success: false, error: 'اسم المستخدم لازم يكون 3 حروف على الأقل' };
      }

      const existingUsers = select('users');
      if (existingUsers.some((user) => user.username === username.trim())) {
        return { success: false, error: 'اسم المستخدم ده موجود بالفعل' };
      }

      const code = employeeCode?.trim() || null;
      if (code && existingUsers.some((user) => user.employee_code === code)) {
        return { success: false, error: 'كود الموظف ده مستخدم لموظف تاني' };
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const data = mutate((tables) => {
        const row = {
          id: newId(),
          username: username.trim(),
          password_hash: hashedPassword,
          role,
          employee_code: code,
          commission_rate: commissionRate,
          created_at: new Date().toISOString(),
        };
        tables.users.push(row);
        return row;
      });

      await fetchUsers();
      return { success: true, data };
    } catch (error) {
      console.error('Error adding user:', error);
      return { success: false, error: error.message || 'مقدرناش نضيف المستخدم' };
    }
  };

  const updateUserPassword = async (userId: string, newPassword: string) => {
    try {
      if (!authState.isAuthenticated || authState.user?.role !== 'super_admin') {
        return { success: false, error: 'المدير العام فقط هو اللي يقدر يغيّر كلمات المرور' };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      mutate((tables) => {
        const user = tables.users.find((entry) => entry.id === userId);
        if (!user) throw new Error('المستخدم مش موجود');
        user.password_hash = hashedPassword;
      });

      await fetchUsers();
      return { success: true };
    } catch (error) {
      console.error('Error updating password:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      if (!authState.isAuthenticated || authState.user?.role !== 'super_admin') {
        return { success: false, error: 'المدير العام فقط هو اللي يقدر يحذف مستخدمين' };
      }

      if (authState.user?.id === userId) {
        return { success: false, error: 'مينفعش تحذف الحساب اللي داخل بيه' };
      }

      mutate((tables) => {
        tables.users = tables.users.filter((user) => user.id !== userId);
        // Invoices keep their numbers; they just lose the employee link.
        tables.orders.forEach((order) => {
          if (order.employee_id === userId) order.employee_id = null;
        });
      });

      await fetchUsers();
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    // Only the super admin manages users.
    if (authState.isAuthenticated && authState.user?.role === 'super_admin') {
      fetchUsers();
    } else {
      setUsers([]);
    }
  }, [authState.isAuthenticated, authState.user?.role]);

  return {
    users,
    isLoading,
    addUser,
    updateUserPassword,
    deleteUser,
    refetchUsers: fetchUsers
  };
};
