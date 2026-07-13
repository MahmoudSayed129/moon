import { useMemo, useState } from 'react';
import { BadgeDollarSign, Hash, Wallet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEmployeeProfit } from '@/hooks/useEmployeeProfit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatEGP } from '@/lib/currency';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const ProfitTab = () => {
  const { authState } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const { orders, isLoading } = useEmployeeProfit(selectedMonth);

  const stats = useMemo(() => {
    const totalCommission = orders.reduce((sum, order) => sum + order.netCommissionAmount, 0);
    const totalSales = orders.reduce((sum, order) => sum + order.netTotalAmount, 0);
    const returnedSales = orders.reduce((sum, order) => sum + order.returnedAmount, 0);

    return {
      totalCommission,
      totalSales,
      returnedSales,
      ordersCount: orders.length,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">العمولة</h2>
          <p className="text-sm text-gray-500">ملخص عمولتك عن مبيعات الشهر.</p>
        </div>
        <div className="w-full lg:w-56">
          <label className="mb-2 block text-sm font-medium text-gray-700">الشهر</label>
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Hash className="h-4 w-4" />
              كود الموظف
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {authState.user?.employee_code || 'غير محدد'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <BadgeDollarSign className="h-4 w-4" />
              عمولة الشهر
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {formatEGP(stats.totalCommission)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Wallet className="h-4 w-4" />
              المبيعات المسجلة باسمك
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {formatEGP(stats.totalSales)}
            </div>
            <div className="mt-1 text-sm text-gray-500">{stats.ordersCount} فاتورة</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Wallet className="h-4 w-4" />
              مرتجعات الشهر
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {formatEGP(stats.returnedSales)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تفاصيل العمولة الشهرية</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-gray-500">جاري تحميل بيانات العمولة...</div>}
          {!isLoading && orders.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              مفيش عمولات مسجلة لشهر {selectedMonth}.
            </div>
          )}
          {!isLoading && orders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2 pl-4 font-medium">رقم الفاتورة</th>
                    <th className="py-2 pl-4 font-medium">العميل</th>
                    <th className="py-2 pl-4 font-medium">التاريخ</th>
                    <th className="py-2 pl-4 font-medium">صافي البيع</th>
                    <th className="py-2 pl-4 font-medium">المرتجع</th>
                    <th className="py-2 pl-4 font-medium">النسبة</th>
                    <th className="py-2 font-medium">صافي العمولة</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-b-0">
                      <td className="py-3 pl-4 font-medium text-gray-900">
                        {order.invoiceNumber}
                      </td>
                      <td className="py-3 pl-4 text-gray-700">{order.clientName}</td>
                      <td className="py-3 pl-4 text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3 pl-4 text-gray-700">
                        {formatEGP(order.netTotalAmount)}
                      </td>
                      <td className="py-3 pl-4 text-gray-700">
                        {formatEGP(order.returnedAmount)}
                      </td>
                      <td className="py-3 pl-4 text-gray-600">
                        {order.commissionRate.toFixed(2)}%
                      </td>
                      <td className="py-3 font-semibold text-gray-900">
                        {formatEGP(order.netCommissionAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitTab;
