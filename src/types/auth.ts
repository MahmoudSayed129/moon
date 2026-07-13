
export interface User {
  id: string;
  username: string;
  role: 'super_admin' | 'supervisor' | 'employee';
  employee_code?: string;
  commission_rate?: number;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
