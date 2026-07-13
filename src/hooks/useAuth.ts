
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, AuthState } from '@/types/auth';
import type { Session } from '@supabase/supabase-js';

const AuthContext = createContext<{
  authState: AuthState;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}>({
  authState: { user: null, isAuthenticated: false, isLoading: true },
  login: async () => ({ success: false }),
  logout: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Setup auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Fetch app user data
          setTimeout(async () => {
            const { data: userData } = await supabase
              .from('users')
              .select('*')
              .eq('auth_id', session.user.id)
              .single();

            if (userData) {
              const appUser: User = {
                id: userData.id,
                username: userData.username,
                role: userData.role,
                employee_code: userData.employee_code || undefined,
                commission_rate: Number(userData.commission_rate || 0),
                created_at: userData.created_at,
                updated_at: userData.created_at,
              };
              
              setAuthState({
                user: appUser,
                isAuthenticated: true,
                isLoading: false,
              });
            }
          }, 0);
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      
      if (session?.user) {
        supabase
          .from('users')
          .select('*')
          .eq('auth_id', session.user.id)
          .single()
          .then(({ data: userData }) => {
            if (userData) {
              const appUser: User = {
                id: userData.id,
                username: userData.username,
                role: userData.role,
                employee_code: userData.employee_code || undefined,
                commission_rate: Number(userData.commission_rate || 0),
                created_at: userData.created_at,
                updated_at: userData.created_at,
              };
              
              setAuthState({
                user: appUser,
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              setAuthState(prev => ({ ...prev, isLoading: false }));
            }
          });
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // First check if user exists in app
      const { data: appUsers, error: appError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .limit(1);

      if (appError || !appUsers || appUsers.length === 0) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      const appUser = appUsers[0];

      // If no auth_id, sync user to auth
      if (!appUser.auth_id) {
        const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-user-auth', {
          body: {
            username: appUser.username,
            password,
            app_user_id: appUser.id,
            role: appUser.role
          }
        });

        if (syncError) {
          console.error('Sync error:', syncError);
          return { success: false, error: 'فشل مزامنة المستخدم' };
        }

        // Update local appUser with auth_id
        appUser.auth_id = syncData.auth_id;
      }

      // Sign in with Supabase auth
      const email = `${username}@ravin.app`;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      // Auth state will be updated by onAuthStateChange
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'حدث خطأ في تسجيل الدخول' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return {
    authState,
    login,
    logout,
  };
};

export { AuthContext };
