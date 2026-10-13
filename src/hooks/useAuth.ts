import { useState, useEffect, createContext, useContext } from 'react';
import bcrypt from 'bcryptjs';
import { select, UserRow } from '@/lib/local-db';
import { User, AuthState } from '@/types/auth';

const SESSION_KEY = 'moon-demo-session';

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

const toAppUser = (userData: UserRow): User => ({
  id: userData.id,
  username: userData.username,
  role: userData.role,
  employee_code: userData.employee_code || undefined,
  commission_rate: Number(userData.commission_rate || 0),
  created_at: userData.created_at,
  updated_at: userData.created_at,
});

const readSession = () => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};

const writeSession = (userId: string | null) => {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Session just won't survive a reload.
  }
};

export const useAuthProvider = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const sessionUserId = readSession();
    const userData = sessionUserId
      ? select('users').find((user) => user.id === sessionUserId)
      : undefined;

    if (userData) {
      setAuthState({ user: toAppUser(userData), isAuthenticated: true, isLoading: false });
    } else {
      writeSession(null);
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const appUser = select('users').find((user) => user.username === username.trim());
      const passwordMatches = appUser
        ? await bcrypt.compare(password, appUser.password_hash)
        : false;

      if (!appUser || !passwordMatches) {
        return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      writeSession(appUser.id);
      setAuthState({ user: toAppUser(appUser), isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'حدث خطأ في تسجيل الدخول' };
    }
  };

  const logout = () => {
    writeSession(null);
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
