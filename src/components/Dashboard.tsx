import { Product, Sale } from '@/types';
import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { formatEGP } from '@/lib/currency';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
}

const Dashboard = ({ products, sales }: DashboardProps) => {
  const { authState } = useAuth();
  const { user } = authState;

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const lowStockItems = products.filter((product) => product.quantity < 10).length;
    const now = new Date();
    const currentMonthProfit = sales
      .filter((sale) => {
        const saleDate = new Date(sale.saleDate);
        return (
          saleDate.getFullYear() === now.getFullYear() &&
          saleDate.getMonth() === now.getMonth()
        );
      })
      .reduce((sum, sale) => sum + sale.totalAmount, 0);

    const categoryStats = products.reduce((acc, product) => {
      const category = product.category || 'بدون قسم';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalCategories = Object.keys(categoryStats).length;

    return {
      totalProducts,
      currentMonthProfit,
      lowStockItems,
      totalCategories,
      categoryStats,
    };
  }, [products, sales]);

  const StatCard = ({
    title,
    value,
    subtitle,
    isWarning = false,
    isCurrency = false,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    isWarning?: boolean;
    isCurrency?: boolean;
  }) => (
    <div
      className={`bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 border-r-4 ${
        isWarning ? 'border-red-500' : 'border-black'
      }`}
    >
      <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 sm:mb-2">{title}</h3>
      <p
        className={`text-base sm:text-lg lg:text-2xl font-bold ${
          isWarning ? 'text-red-600' : 'text-gray-900'
        }`}
      >
        {isCurrency && typeof value === 'number' ? formatEGP(value) : value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );

  const CategoryCard = ({ category, count }: { category: string; count: number }) => (
    <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 lg:p-6 border-r-4 border-blue-500">
      <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1 sm:mb-2 truncate">
        {category}
      </h3>
      <p className="text-base sm:text-lg lg:text-2xl font-bold text-gray-900">{count}</p>
      <p className="text-xs text-gray-400 mt-1">صنف</p>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 lg:p-0">
      <div className="flex justify-between items-center">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">نظرة عامة</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
        <StatCard title="إجمالي المنتجات" value={stats.totalProducts} subtitle="أصناف في المحل" />
        <StatCard
          title="مبيعات الشهر الحالي"
          value={stats.currentMonthProfit}
          subtitle="إجمالي مبيعات الشهر ده"
          isCurrency
        />
        <StatCard
          title="أصناف على وشك النفاد"
          value={stats.lowStockItems}
          subtitle="أقل من 10 قطع"
          isWarning={stats.lowStockItems > 0}
        />
        <StatCard title="عدد الأقسام" value={stats.totalCategories} subtitle="أقسام بها منتجات" />
      </div>

      <div className="space-y-3 sm:space-y-4">
        <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">
          توزيع المنتجات على الأقسام
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
          {Object.entries(stats.categoryStats).map(([category, count]) => (
            <CategoryCard key={category} category={category} count={count} />
          ))}
          {Object.keys(stats.categoryStats).length === 0 && (
            <div className="col-span-full text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
              مفيش أقسام لسه. ضيف منتجات علشان تشوف التوزيع.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
