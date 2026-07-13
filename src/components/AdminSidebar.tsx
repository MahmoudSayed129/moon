import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  ClipboardList,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export interface AdminNavItem {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: 'dashboard',
    label: 'الرئيسية',
    subtitle: 'ملخص سريع لأداء المحل النهارده',
    icon: LayoutDashboard,
  },
  {
    id: 'inventory',
    label: 'المحل',
    subtitle: 'المنتجات المعروضة للبيع في المحل',
    icon: Store,
  },
  {
    id: 'warehouse',
    label: 'المخزن',
    subtitle: 'البضاعة اللي جاية من التجار قبل ما تنزل للمحل',
    icon: Package,
  },
  {
    id: 'history',
    label: 'سجل الحركات',
    subtitle: 'كل حركة إضافة، بيع، خصم أو مرتجع للمحل والمخزن',
    icon: ClipboardList,
  },
  {
    id: 'checkout',
    label: 'نقطة البيع',
    subtitle: 'إصدار فواتير للعملاء وتسجيل عمولة الموظف',
    icon: ShoppingCart,
  },
  {
    id: 'checkout-history',
    label: 'سجل المبيعات',
    subtitle: 'راجع فواتيرك خلال الشهر وقارن أداء التجار',
    icon: Receipt,
  },
  {
    id: 'employees',
    label: 'الموظفين',
    subtitle: 'متابعة أداء الموظفين شهرياً',
    icon: Users,
  },
  {
    id: 'crm',
    label: 'العملاء',
    subtitle: 'إدارة العملاء وسجل مشترياتهم',
    icon: UserCircle2,
  },
  {
    id: 'users',
    label: 'المستخدمين',
    subtitle: 'إدارة حسابات المستخدمين وصلاحياتهم',
    icon: ShieldCheck,
  },
  {
    id: 'categories',
    label: 'الأقسام',
    subtitle: 'تصنيفات المنتجات في المحل',
    icon: FolderTree,
  },
  {
    id: 'traders',
    label: 'التجار',
    subtitle: 'إدارة الموردين وأسعار الجملة',
    icon: Truck,
  },
];

const NAV_ITEMS = ADMIN_NAV_ITEMS;

const roleLabels: Record<string, string> = {
  super_admin: 'مدير عام',
  supervisor: 'مشرف',
  employee: 'موظف',
};

const AdminSidebar = ({ activeTab, onTabChange }: AdminSidebarProps) => {
  const { authState, logout } = useAuth();
  const { user } = authState;
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close the drawer whenever the tab changes on mobile.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [activeTab]);

  const initial = user?.username?.charAt(0)?.toUpperCase() || '؟';

  const NavList = ({ compact = false }: { compact?: boolean }) => (
    <nav className={`flex-1 ${compact ? 'px-2' : 'px-3'} py-2 space-y-1 overflow-y-auto`}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`group relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white/15 text-white shadow-inner'
                : 'text-[#c9b5e8] hover:bg-white/10 hover:text-white'
            }`}
          >
            {isActive && (
              <span className="absolute right-0 top-1.5 bottom-1.5 w-1 rounded-l-full bg-[#c084fc]" />
            )}
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const UserBlock = () => (
    <div className="border-t border-white/10 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-sm font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {user?.username || '—'}
          </div>
          <div className="text-xs text-[#c9b5e8]">
            {user?.role ? roleLabels[user.role] || user.role : '—'}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
      >
        <LogOut className="h-4 w-4" />
        تسجيل الخروج
      </button>
    </div>
  );

  const Logo = () => (
    <div className="flex flex-col items-center gap-1 border-b border-white/10 px-4 pt-6 pb-5">
      <div className="text-2xl font-black tracking-[0.35em] text-[#f3e9ff] drop-shadow-[0_0_18px_rgba(192,132,252,0.55)]">
        MO<span className="text-[#c084fc]">☾</span>N
      </div>
      <div className="rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-[11px] text-[#f4eefe] backdrop-blur">
        مون ستور
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar (< lg) */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-gradient-to-l from-[#13091d] via-[#3f1169] to-[#7b22cc] px-4 py-3 text-white shadow-md">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-white/20"
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-lg font-black tracking-[0.35em] text-[#f3e9ff]">
          MO<span className="text-[#c084fc]">☾</span>N
        </div>
        <div className="w-9" />
      </div>

      {/* Backdrop for mobile drawer */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar. Fixed on desktop; slides in from the right on mobile (RTL). */}
      <aside
        className={`fixed top-0 right-0 z-50 flex h-screen w-64 flex-col bg-gradient-to-b from-[#13091d] via-[#3f1169] to-[#4d1f76] shadow-2xl shadow-[#8f4cd633] transition-transform lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
        aria-label="القائمة الجانبية"
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          aria-label="إغلاق القائمة"
        >
          <X className="h-4 w-4" />
        </button>

        <Logo />
        <NavList />
        <UserBlock />
      </aside>
    </>
  );
};

export default AdminSidebar;
