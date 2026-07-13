
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import bcrypt from 'bcryptjs';
import { User } from '@/types/auth';
import { useAuth } from './useAuth';

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { authState } = useAuth();

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching users...');
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      console.log('Users fetched successfully:', data);
      // Map data to include updated_at field using created_at
      const mappedUsers: User[] = data?.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        employee_code: user.employee_code || undefined,
        commission_rate: Number(user.commission_rate || 0),
        created_at: user.created_at,
        updated_at: user.created_at // Use created_at since updated_at doesn't exist in new DB
      })) || [];
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
      console.log('Adding user:', username, 'with role:', role);
      console.log('Current auth state:', authState);
      
      // Check if user is authenticated
      if (!authState.isAuthenticated || !authState.user) {
        console.error('User not authenticated');
        return { success: false, error: 'لازم تسجل الدخول علشان تضيف مستخدمين' };
      }

      // Check if user is super admin
      if (authState.user.role !== 'super_admin') {
        console.error('Unauthorized: User is not super admin');
        return { success: false, error: 'المدير العام فقط هو اللي يقدر يضيف مستخدمين' };
      }

      // Validate username
      if (!username || username.trim().length === 0) {
        return { success: false, error: 'اسم المستخدم مطلوب' };
      }

      if (username.trim().length < 3) {
        return { success: false, error: 'اسم المستخدم لازم يكون 3 حروف على الأقل' };
      }

      // Check if username already exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('username')
        .eq('username', username.trim());

      if (checkError) {
        console.error('Error checking existing users:', checkError);
        return { success: false, error: 'مقدرناش نتأكد من المستخدمين الموجودين' };
      }

      if (existingUsers && existingUsers.length > 0) {
        console.log('Username already exists');
        return { success: false, error: 'اسم المستخدم ده موجود بالفعل' };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Password hashed successfully');
      
      const { data, error } = await supabase
        .from('users')
        .insert([{
          username: username.trim(),
          password_hash: hashedPassword,
          role: role,
          employee_code: employeeCode?.trim() || null,
          commission_rate: commissionRate
        }])
        .select()
        .single();

      if (error) {
        console.error('Direct insert failed:', error);
        return { success: false, error: 'مقدرناش نضيف المستخدم: ' + error.message };
      }

      console.log('User added successfully:', data);
      
      // Sync to auth system
      try {
        await supabase.functions.invoke('sync-user-auth', {
          body: {
            username: username.trim(),
            password,
            app_user_id: data.id,
            role
          }
        });
      } catch (syncError) {
        console.warn('Failed to sync to auth:', syncError);
      }
      
      await fetchUsers();
      return { success: true, data };
    } catch (error) {
      console.error('Error adding user:', error);
      return { success: false, error: error.message || 'مقدرناش نضيف المستخدم' };
    }
  };

  const updateUserPassword = async (userId: string, newPassword: string) => {
    try {
      // Check authentication and permissions
      if (!authState.isAuthenticated || authState.user?.role !== 'super_admin') {
        return { success: false, error: 'المدير العام فقط هو اللي يقدر يغيّر كلمات المرور' };
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const { error } = await supabase
        .from('users')
        .update({ 
          password_hash: hashedPassword
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating password:', error);
        return { success: false, error: error.message };
      }

      await fetchUsers();
      return { success: true };
    } catch (error) {
      console.error('Error updating password:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Check authentication and permissions
      if (!authState.isAuthenticated || authState.user?.role !== 'super_admin') {
        return { success: false, error: 'المدير العام فقط هو اللي يقدر يحذف مستخدمين' };
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: error.message };
      }

      await fetchUsers();
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    console.log('useUsers useEffect triggered');
    console.log('Auth state:', authState);
    
    // Only fetch users if authenticated and is super admin
    if (authState.isAuthenticated && authState.user?.role === 'super_admin') {
      console.log('Fetching users because user is authenticated super admin');
      fetchUsers();
    } else {
      console.log('Not fetching users - not authenticated or not super admin');
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
