import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const roleLabels: Record<string, string> = {
  super_admin: 'مدير عام',
  supervisor: 'مشرف',
  employee: 'موظف',
};

const Navigation = ({ activeTab, onTabChange }: NavigationProps) => {
  const { authState, logout } = useAuth();
  const { user } = authState;

  const getTabsForRole = () => {
    if (!user) return [];

    const baseTabs = [
      { id: 'dashboard', label: 'الرئيسية' },
      { id: 'inventory', label: 'المحل' },
      { id: 'warehouse', label: 'المخزن' },
      { id: 'history', label: 'سجل الحركات' },
      { id: 'checkout', label: 'نقطة البيع' },
      { id: 'checkout-history', label: 'سجل المبيعات' },
      { id: 'employees', label: 'الموظفين' },
    ];

    switch (user.role) {
      case 'super_admin':
        return [
          ...baseTabs,
          { id: 'crm', label: 'العملاء' },
          { id: 'users', label: 'المستخدمين' },
          { id: 'categories', label: 'الأقسام' },
          { id: 'traders', label: 'التجار' },
        ];
      case 'supervisor':
        return [...baseTabs, { id: 'crm', label: 'العملاء' }];
      case 'employee':
        return [
          { id: 'inventory', label: 'المحل' },
          { id: 'profit', label: 'العمولة' },
        ];
      default:
        return [];
    }
  };

  const tabs = getTabsForRole();

  const formatRole = (role?: string) => {
    if (!role) return 'غير معروف';
    return roleLabels[role] || role;
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-3 py-2 lg:flex-row lg:items-center lg:justify-between lg:py-0">
          <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <div className="flex min-w-max gap-6 lg:gap-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors lg:py-4 ${
                    activeTab === tab.id
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between lg:pb-0">
            <span className="text-sm text-gray-600">
              أهلاً بيك، {user?.username} ({formatRole(user?.role)})
              {user?.employee_code ? ` • كود: ${user.employee_code}` : ''}
            </span>
            <Button variant="outline" size="sm" onClick={logout} className="w-full sm:w-auto">
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
