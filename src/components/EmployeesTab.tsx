import { useMemo, useState } from 'react';
import { BarChart3, Receipt, Search, ShoppingBag, Users } from 'lucide-react';
import { useEmployeePerformance } from '@/hooks/useEmployeePerformance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatEGP } from '@/lib/currency';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const EmployeesTab = () => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const { entries, stats, isLoading } = useEmployeePerformance(selectedMonth);

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;

    return entries.filter(
      (entry) =>
        entry.employeeName.toLowerCase().includes(query) ||
        (entry.employeeCode || '').toLowerCase().includes(query)
    );
  }, [entries, searchQuery]);

  const filteredStats = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.ordersCount += entry.ordersCount;
        acc.itemsSold += entry.itemsSold;
        acc.netRevenue += entry.netRevenue;
        return acc;
      },
      {
        employeesCount: filteredEntries.length,
        ordersCount: 0,
        itemsSold: 0,
        netRevenue: 0,
      }
    );
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">الموظفين</h2>
          <p className="text-sm text-gray-500">
            متابعة أداء الموظفين شهرياً من ناحية عدد الفواتير، القطع المبيعة، والإيرادات.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:min-w-[28rem]">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">الشهر</label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">بحث</label>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اسم الموظف أو الكود"
                className="pr-9"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users className="h-4 w-4" />
              الموظفين
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {filteredStats.employeesCount}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {stats.employeesCount} إجمالي المسجلين
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Receipt className="h-4 w-4" />
              الفواتير
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {filteredStats.ordersCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ShoppingBag className="h-4 w-4" />
              القطع المبيعة
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {filteredStats.itemsSold}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart3 className="h-4 w-4" />
              صافي الإيرادات
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {formatEGP(filteredStats.netRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أداء الموظفين خلال الشهر</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-gray-500">جاري تحميل بيانات الموظفين...</div>}
          {!isLoading && filteredEntries.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              مفيش بيانات أداء للموظفين لشهر {selectedMonth}.
            </div>
          )}
          {!isLoading && filteredEntries.length > 0 && (
            <>
              <div className="space-y-3 md:hidden">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.employeeId}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900">
                          {entry.employeeName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {entry.employeeCode || 'مفيش كود'}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="text-xs text-gray-500">صافي الإيرادات</div>
                        <div className="font-semibold text-gray-900">
                          {formatEGP(entry.netRevenue)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-gray-50 p-3">
                        <div className="text-gray-500">الفواتير</div>
                        <div className="mt-1 font-semibold text-gray-900">
                          {entry.ordersCount}
                        </div>
                      </div>
                      <div className="rounded-md bg-gray-50 p-3">
                        <div className="text-gray-500">القطع المبيعة</div>
                        <div className="mt-1 font-semibold text-gray-900">
                          {entry.itemsSold}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-right text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="py-2 pl-4 font-medium">الموظف</th>
                      <th className="py-2 pl-4 font-medium">الكود</th>
                      <th className="py-2 pl-4 font-medium">الفواتير</th>
                      <th className="py-2 pl-4 font-medium">القطع المبيعة</th>
                      <th className="py-2 font-medium">صافي الإيرادات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr
                        key={entry.employeeId}
                        className="border-b last:border-b-0"
                      >
                        <td className="py-3 pl-4 font-medium text-gray-900">
                          {entry.employeeName}
                        </td>
                        <td className="py-3 pl-4 text-gray-600">
                          {entry.employeeCode || 'مفيش كود'}
                        </td>
                        <td className="py-3 pl-4 text-gray-700">{entry.ordersCount}</td>
                        <td className="py-3 pl-4 text-gray-700">{entry.itemsSold}</td>
                        <td className="py-3 font-semibold text-gray-900">
                          {formatEGP(entry.netRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeesTab;
