import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import { Download, FileText, Receipt, RotateCcw, Search, Trophy } from 'lucide-react';
import { useCheckoutHistory } from '@/hooks/useCheckoutHistory';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { openInvoicePdf } from '@/lib/invoice';
import { formatEGP } from '@/lib/currency';
import { createMoonPdf, drawMoonHeader, drawMoonSectionTitle, drawMoonStatStrip, moonTableTheme } from '@/lib/pdf-theme';
import type { ProcessReturnPayload } from '@/types';

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);
const RETURN_WINDOW_DAYS = 14;

interface CheckoutHistoryTabProps {
  onProcessReturn: (payload: ProcessReturnPayload) => Promise<void>;
}

const CheckoutHistoryTab = ({ onProcessReturn }: CheckoutHistoryTabProps) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const { authState } = useAuth();
  const { toast } = useToast();
  const { orders, isLoading, refreshOrders } = useCheckoutHistory(selectedMonth);
  const showCommissionDetails = authState.user?.role === 'employee';
  const canProcessReturns =
    authState.user?.role === 'super_admin' || authState.user?.role === 'supervisor';

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter(
      (order) =>
        order.invoiceNumber.toLowerCase().includes(query) ||
        order.clientName.toLowerCase().includes(query) ||
        order.employeeName.toLowerCase().includes(query) ||
        order.items.some(
          (item) =>
            item.productName.toLowerCase().includes(query) ||
            item.productBarcode.toLowerCase().includes(query)
        )
    );
  }, [orders, searchQuery]);

  const stats = useMemo(() => {
    const revenue = filteredOrders.reduce((sum, order) => sum + order.netTotalAmount, 0);
    const commissions = filteredOrders.reduce(
      (sum, order) => sum + order.netCommissionAmount,
      0
    );
    const returnedAmount = filteredOrders.reduce(
      (sum, order) => sum + order.returnedTotalAmount,
      0
    );
    const itemsSold = filteredOrders.reduce(
      (sum, order) =>
        sum +
        order.items.reduce(
          (itemSum, item) => itemSum + (item.quantity - item.returnedQuantity),
          0
        ),
      0
    );

    return {
      revenue,
      commissions,
      returnedAmount,
      itemsSold,
      ordersCount: filteredOrders.length,
    };
  }, [filteredOrders]);

  // --- Per-trader performance for the currently-filtered orders ------------
  // We aggregate net units, net revenue, net cost, and returned units so the
  // store owner can see which trader's goods actually earned money after
  // returns, not just which trader shipped the most stock.
  const traderStats = useMemo(() => {
    const buckets = new Map<
      string,
      {
        traderId: string;
        traderName: string;
        unitsSold: number;
        unitsReturned: number;
        netRevenue: number;
        netCost: number;
        hasCost: boolean;
      }
    >();

    for (const order of filteredOrders) {
      for (const item of order.items) {
        const key = item.traderId || '__untagged__';
        const bucket = buckets.get(key) || {
          traderId: item.traderId || '',
          traderName: item.traderName || 'بضاعة بدون تاجر',
          unitsSold: 0,
          unitsReturned: 0,
          netRevenue: 0,
          netCost: 0,
          hasCost: false,
        };
        const netQty = item.quantity - item.returnedQuantity;
        bucket.unitsSold += netQty;
        bucket.unitsReturned += item.returnedQuantity;
        bucket.netRevenue += netQty * item.unitPrice;
        if (item.costPrice !== undefined) {
          bucket.netCost += netQty * item.costPrice;
          bucket.hasCost = true;
        }
        buckets.set(key, bucket);
      }
    }

    return Array.from(buckets.values())
      .map((b) => {
        const netProfit = b.hasCost ? b.netRevenue - b.netCost : null;
        const marginPct =
          netProfit !== null && b.netRevenue > 0
            ? (netProfit / b.netRevenue) * 100
            : null;
        return { ...b, netProfit, marginPct };
      })
      .sort((a, b) => {
        // Rank by margin when both have cost; otherwise by revenue.
        if (a.netProfit !== null && b.netProfit !== null) return b.netProfit - a.netProfit;
        if (a.netProfit !== null) return -1;
        if (b.netProfit !== null) return 1;
        return b.netRevenue - a.netRevenue;
      });
  }, [filteredOrders]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedOrderId) || null,
    [filteredOrders, selectedOrderId]
  );

  const selectedOrderReturnableItems = useMemo(
    () => selectedOrder?.items.filter((item) => item.returnableQuantity > 0) || [],
    [selectedOrder]
  );

  const exportExcel = () => {
    const rows = filteredOrders.flatMap((order) =>
      order.items.map((item) => ({
        'رقم الفاتورة': order.invoiceNumber,
        التاريخ: new Date(order.createdAt).toLocaleDateString('ar-EG'),
        العميل: order.clientName,
        الموظف: order.employeeName,
        'كود الموظف': order.employeeCode || '',
        المنتج: item.productName,
        الباركود: item.productBarcode,
        الكمية: item.quantity,
        المرتجع: item.returnedQuantity,
        'صافي البيع': item.quantity - item.returnedQuantity,
        'سعر القطعة': item.unitPrice,
        'إجمالي السطر': item.lineTotal,
        'إجمالي المرتجع': order.returnedTotalAmount,
        'صافي الفاتورة': order.netTotalAmount,
        'حالة المرتجع': order.returnStatus,
      }))
    );

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Checkout History');
    XLSX.writeFile(workbook, `Moon_Checkout_History_${selectedMonth}.xlsx`);
  };

  const exportPdf = () => {
    const doc = createMoonPdf();
    let y = drawMoonHeader(
      doc,
      'MOON Checkout History',
      selectedMonth,
      'Monthly sales and returns report'
    );
    y = drawMoonStatStrip(
      doc,
      [
        { label: 'Orders', value: String(stats.ordersCount) },
        { label: 'Net Revenue', value: formatEGP(stats.revenue), tone: 'accent' },
        { label: 'Returns', value: formatEGP(stats.returnedAmount), tone: 'warn' },
        ...(showCommissionDetails
          ? [{ label: 'Net Commission', value: formatEGP(stats.commissions) }]
          : []),
      ],
      y
    );
    y = drawMoonSectionTitle(doc, 'Invoices', y);

    autoTable(doc, {
      ...moonTableTheme,
      startY: y,
      head: [['Invoice', 'Date', 'Client', 'Status', 'Returned', 'Net Total']],
      body: filteredOrders.map((order) => [
        order.invoiceNumber,
        new Date(order.createdAt).toLocaleDateString('en-EG'),
        order.clientName,
        order.returnStatus.toUpperCase(),
        formatEGP(order.returnedTotalAmount),
        formatEGP(order.netTotalAmount),
      ]),
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });

    doc.save(`Moon_Checkout_History_${selectedMonth}.pdf`);
  };

  const openReturnDialog = (orderId: string) => {
    setSelectedOrderId(orderId);
    setReturnReason('');
    setReturnQuantities({});
  };

  const closeReturnDialog = () => {
    setSelectedOrderId(null);
    setReturnReason('');
    setReturnQuantities({});
  };

  const isWithinReturnWindow = (createdAt: string) => {
    const returnDeadline = new Date(createdAt);
    returnDeadline.setDate(returnDeadline.getDate() + RETURN_WINDOW_DAYS);
    return returnDeadline.getTime() >= Date.now();
  };

  const handleProcessReturn = async () => {
    if (!selectedOrder) return;

    const items = selectedOrderReturnableItems
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: Math.max(
          0,
          Math.min(Number(returnQuantities[item.orderItemId] || 0), item.returnableQuantity)
        ),
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      toast({
        title: 'مفيش قطع مختارة',
        description: 'دخّل كمية مرتجعة لقطعة واحدة على الأقل.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmittingReturn(true);
      await onProcessReturn({
        orderId: selectedOrder.id,
        items,
        reason: returnReason,
      });
      await refreshOrders();
      closeReturnDialog();
      toast({
        title: 'تم تسجيل المرتجع',
        description: `${selectedOrder.invoiceNumber} اتحدثت بنجاح.`,
      });
    } catch (error: any) {
      toast({
        title: 'فشل تسجيل المرتجع',
        description: error.message || 'حاول تاني.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const returnStatusLabel = (status: 'none' | 'partial' | 'full') => {
    if (status === 'full') return 'مرتجع كامل';
    if (status === 'partial') return 'مرتجع جزئي';
    return 'بدون مرتجع';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">سجل المبيعات</h2>
          <p className="text-sm text-gray-500">
            راجع فواتير الشهر، المبيعات، المرتجعات، العملاء، ونشاط الموظفين.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={exportExcel}
            variant="outline"
            className="gap-2 border-green-200 text-green-700 hover:bg-green-50"
          >
            <FileText className="h-4 w-4" />
            Excel
          </Button>
          <Button
            onClick={exportPdf}
            variant="outline"
            className="gap-2 border-red-200 text-red-700 hover:bg-red-50"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div
        className={`grid gap-4 md:grid-cols-2 ${
          showCommissionDetails ? 'xl:grid-cols-5' : 'xl:grid-cols-4'
        }`}
      >
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">عدد الفواتير</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{stats.ordersCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">صافي الإيرادات</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {formatEGP(stats.revenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">إجمالي المرتجعات</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {formatEGP(stats.returnedAmount)}
            </div>
          </CardContent>
        </Card>
        {showCommissionDetails && (
          <Card>
            <CardContent className="p-5">
              <div className="text-sm text-gray-500">صافي العمولة</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">
                {formatEGP(stats.commissions)}
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-gray-500">صافي القطع المبيعة</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{stats.itemsSold}</div>
          </CardContent>
        </Card>
      </div>

      {traderStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              أداء التجار
            </CardTitle>
            <p className="text-sm text-gray-500">
              الترتيب حسب صافي الربح لما سعر الجملة مسجل، وحسب الإيرادات لو التاجر مالوش سعر جملة.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-right text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2 pl-4 font-medium">الترتيب</th>
                    <th className="py-2 pl-4 font-medium">التاجر</th>
                    <th className="py-2 pl-4 font-medium">قطع مبيعة</th>
                    <th className="py-2 pl-4 font-medium">مرتجعات</th>
                    <th className="py-2 pl-4 font-medium">صافي الإيرادات</th>
                    <th className="py-2 pl-4 font-medium">تكلفة الجملة</th>
                    <th className="py-2 pl-4 font-medium">صافي الربح</th>
                    <th className="py-2 font-medium">هامش الربح</th>
                  </tr>
                </thead>
                <tbody>
                  {traderStats.map((t, index) => {
                    const isTopMargin = index === 0 && t.netProfit !== null;
                    return (
                      <tr
                        key={t.traderId || '__untagged__'}
                        className={`border-b last:border-b-0 ${
                          isTopMargin ? 'bg-emerald-50' : ''
                        }`}
                      >
                        <td className="py-3 pl-4 font-medium text-gray-900">
                          {isTopMargin ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Trophy className="h-4 w-4" /> #1
                            </span>
                          ) : (
                            `#${index + 1}`
                          )}
                        </td>
                        <td className="py-3 pl-4 font-medium text-gray-900">
                          {t.traderName}
                        </td>
                        <td className="py-3 pl-4 text-gray-700">{t.unitsSold}</td>
                        <td className="py-3 pl-4 text-blue-700">{t.unitsReturned}</td>
                        <td className="py-3 pl-4 text-gray-700">
                          {formatEGP(t.netRevenue)}
                        </td>
                        <td className="py-3 pl-4 text-gray-700">
                          {t.hasCost ? formatEGP(t.netCost) : 'غير مسجل'}
                        </td>
                        <td className="py-3 pl-4 font-semibold text-gray-900">
                          {t.netProfit !== null ? formatEGP(t.netProfit) : '—'}
                        </td>
                        <td className="py-3 font-semibold text-gray-900">
                          {t.marginPct !== null ? `${t.marginPct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            فلترة الشهر
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">الشهر</label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">بحث</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="رقم الفاتورة، العميل، الموظف، المنتج أو الباركود"
                className="pr-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading && <div className="text-sm text-gray-500">جاري تحميل الفواتير...</div>}
        {!isLoading && filteredOrders.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            مفيش فواتير مسجلة لشهر {selectedMonth}.
          </div>
        )}

        {filteredOrders.map((order) => {
          const returnWindowOpen = isWithinReturnWindow(order.createdAt);
          const hasReturnableItems = order.items.some((item) => item.returnableQuantity > 0);

          return (
            <Card key={order.id}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold text-gray-900">
                        {order.invoiceNumber}
                      </div>
                      {order.hasReturn && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          {returnStatusLabel(order.returnStatus)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString('ar-EG')}
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                      العميل: <span className="font-medium">{order.clientName}</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      الموظف: <span className="font-medium">{order.employeeName}</span>
                      {order.employeeCode ? ` (${order.employeeCode})` : ''}
                    </div>
                    {order.hasReturn && order.lastReturnedAt && (
                      <div className="text-sm text-blue-700">
                        آخر مرتجع:{' '}
                        {new Date(order.lastReturnedAt).toLocaleString('ar-EG')}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-1 text-sm text-gray-700 lg:text-left">
                    <div>
                      المجموع قبل الخصم:{' '}
                      <span className="font-medium">{formatEGP(order.subtotal)}</span>
                    </div>
                    {order.discountAmount > 0 && (
                      <div>
                        الخصم:{' '}
                        <span className="font-medium text-emerald-700">
                          - {formatEGP(order.discountAmount)}
                        </span>
                      </div>
                    )}
                    {order.returnedTotalAmount > 0 && (
                      <div>
                        المرتجع:{' '}
                        <span className="font-medium text-blue-700">
                          - {formatEGP(order.returnedTotalAmount)}
                        </span>
                      </div>
                    )}
                    {showCommissionDetails && (
                      <div>
                        صافي العمولة:{' '}
                        <span className="font-medium">
                          {formatEGP(order.netCommissionAmount)}
                        </span>
                      </div>
                    )}
                    <div>
                      الصافي:{' '}
                      <span className="text-lg font-semibold text-gray-900">
                        {formatEGP(order.netTotalAmount)}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          openInvoicePdf({
                            invoiceNumber: order.invoiceNumber,
                            createdAt: order.createdAt,
                            subtotal: order.subtotal,
                            discountAmount: order.discountAmount,
                            totalAmount: order.totalAmount,
                            returnedTotalAmount: order.returnedTotalAmount,
                            netTotalAmount: order.netTotalAmount,
                            commissionRate: order.commissionRate,
                            commissionAmount: order.commissionAmount,
                            returnedCommissionAmount: order.returnedCommissionAmount,
                            netCommissionAmount: order.netCommissionAmount,
                            returnStatus: order.returnStatus,
                            notes: order.notes,
                            employeeCode: order.employeeCode,
                            employeeName: order.employeeName,
                            client: { name: order.clientName },
                            items: order.items.map((item) => ({
                              ...item,
                              returnedQuantity: item.returnedQuantity,
                            })),
                            returns: order.returns.map((entry) => ({
                              reason: entry.reason,
                              totalReturned: entry.totalReturned,
                              createdAt: entry.createdAt,
                              items: entry.items.map((item) => ({
                                productName: item.productName,
                                productBarcode: item.productBarcode,
                                quantity: item.quantity,
                                lineTotal: item.lineTotal,
                              })),
                            })),
                          })
                        }
                      >
                        عرض PDF
                      </Button>
                      {canProcessReturns && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReturnDialog(order.id)}
                          disabled={!returnWindowOpen || !hasReturnableItems}
                        >
                          <RotateCcw className="ml-2 h-4 w-4" />
                          تسجيل مرتجع
                        </Button>
                      )}
                    </div>
                    {canProcessReturns && !returnWindowOpen && (
                      <div className="text-xs text-red-600">
                        مدة استرجاع الفاتورة (14 يوم) خلصت.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-right text-sm">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="py-2 pl-4 font-medium">المنتج</th>
                        <th className="py-2 pl-4 font-medium">الباركود</th>
                        <th className="py-2 pl-4 font-medium">مبيع</th>
                        <th className="py-2 pl-4 font-medium">مرتجع</th>
                        <th className="py-2 pl-4 font-medium">صافي</th>
                        <th className="py-2 pl-4 font-medium">سعر القطعة</th>
                        <th className="py-2 font-medium">إجمالي السطر</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-b-0">
                          <td className="py-2 pl-4 text-gray-900">{item.productName}</td>
                          <td className="py-2 pl-4 text-gray-600" dir="ltr">
                            {item.productBarcode}
                          </td>
                          <td className="py-2 pl-4 text-gray-600">{item.quantity}</td>
                          <td className="py-2 pl-4 text-blue-700">{item.returnedQuantity}</td>
                          <td className="py-2 pl-4 text-gray-600">
                            {item.quantity - item.returnedQuantity}
                          </td>
                          <td className="py-2 pl-4 text-gray-600">
                            {formatEGP(item.unitPrice)}
                          </td>
                          <td className="py-2 font-medium text-gray-900">
                            {formatEGP(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {order.returns.length > 0 && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="mb-3 text-sm font-semibold text-blue-900">
                      سجل المرتجعات
                    </div>
                    <div className="space-y-3">
                      {order.returns.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-lg bg-white p-3 text-sm text-gray-700"
                        >
                          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <div className="font-medium text-gray-900">
                              {new Date(entry.createdAt).toLocaleString('ar-EG')}
                            </div>
                            <div className="font-semibold text-blue-800">
                              مرتجع بقيمة {formatEGP(entry.totalReturned)}
                            </div>
                          </div>
                          <div className="mt-1 text-gray-600">
                            {entry.reason || 'مفيش سبب محدد.'}
                          </div>
                          <div className="mt-2 text-gray-600">
                            {entry.items
                              .map((item) => `${item.productName} × ${item.quantity}`)
                              .join('، ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {order.notes && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <span className="font-medium text-gray-800">ملاحظات:</span> {order.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => !open && closeReturnDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تسجيل مرتجع</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">
                  {selectedOrder.invoiceNumber}
                </div>
                <div>العميل: {selectedOrder.clientName}</div>
                <div>
                  تاريخ الفاتورة:{' '}
                  {new Date(selectedOrder.createdAt).toLocaleString('ar-EG')}
                </div>
              </div>

              <div className="space-y-3">
                {selectedOrderReturnableItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                    كل قطع الفاتورة اترجعت بالفعل.
                  </div>
                )}

                {selectedOrderReturnableItems.map((item) => (
                  <div
                    key={item.orderItemId}
                    className="grid gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-[1fr_140px]"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{item.productName}</div>
                      <div className="text-sm text-gray-500" dir="ltr">
                        {item.productBarcode}
                      </div>
                      <div className="text-sm text-gray-600">
                        بيع {item.quantity} • مرتجع سابقاً {item.returnedQuantity} • قابل للمرتجع{' '}
                        {item.returnableQuantity}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>الكمية المرتجعة</Label>
                      <Input
                        type="number"
                        min={0}
                        max={item.returnableQuantity}
                        value={returnQuantities[item.orderItemId] ?? 0}
                        onChange={(e) =>
                          setReturnQuantities((prev) => ({
                            ...prev,
                            [item.orderItemId]: Math.max(
                              0,
                              Math.min(
                                Number(e.target.value || 0),
                                item.returnableQuantity
                              )
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>سبب المرتجع</Label>
                <Textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={3}
                  placeholder="ليه العميل بيرجع القطع دي؟"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeReturnDialog}>
                  إلغاء
                </Button>
                <Button
                  onClick={handleProcessReturn}
                  disabled={
                    isSubmittingReturn || selectedOrderReturnableItems.length === 0
                  }
                >
                  {isSubmittingReturn ? 'جاري الحفظ...' : 'تأكيد المرتجع'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutHistoryTab;
