import { useMemo, useState } from 'react';
import { ArrowLeftRight, Filter, Minus, Plus, PackagePlus, Search } from 'lucide-react';
import { Product, ProductWithCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatEGP } from '@/lib/currency';
import Pagination from './pagination';
import ProductForm from './ProductForm';

type ActionKind = 'add' | 'take' | 'move';

interface InventoryTabProps {
  products: Product[];
  onAddProduct: (product: Omit<ProductWithCategory, 'id' | 'dateAdded' | 'lastUpdated'>) => void;
  onAddToWarehouse: (productId: string, quantity: number) => Promise<void> | void;
  onTakeFromWarehouse: (productId: string, quantity: number) => Promise<boolean>;
  onMoveToStore: (productId: string, quantity: number) => Promise<boolean>;
  isReadOnly?: boolean;
}

const ITEMS_PER_PAGE = 10;

const InventoryTab = ({
  products,
  onAddProduct,
  onAddToWarehouse,
  onTakeFromWarehouse,
  onMoveToStore,
  isReadOnly = false,
}: InventoryTabProps) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [dialog, setDialog] = useState<{
    kind: ActionKind;
    product: Product;
    quantity: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  const handleAddProduct = (
    product: Omit<ProductWithCategory, 'id' | 'dateAdded' | 'lastUpdated'>
  ) => {
    try {
      onAddProduct(product);
      const parts: string[] = [];
      if ((product.warehouseQuantity ?? 0) > 0) parts.push(`${product.warehouseQuantity} في المخزن`);
      if ((product.quantity ?? 0) > 0) parts.push(`${product.quantity} في المحل`);
      toast({
        title: 'تمت إضافة المنتج',
        description: parts.length
          ? `${product.name} — ${parts.join(' و ')}.`
          : `${product.name} اتضاف بدون كميات، ضيف من الأزرار في الجدول.`,
      });
      setIsAddProductOpen(false);
    } catch (err: any) {
      toast({
        title: 'حصلت مشكلة',
        description: err?.message || 'حاول تاني',
        variant: 'destructive',
      });
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q);
      const w = p.warehouseQuantity;
      const matchStock =
        stockFilter === 'all'
          ? true
          : stockFilter === 'low'
            ? w > 0 && w < 10
            : w === 0;
      return matchSearch && matchStock;
    });
  }, [products, searchQuery, stockFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const pageProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { text: 'خلص من المخزن', color: 'bg-red-100 text-red-800' };
    if (qty < 10) return { text: 'كمية قليلة', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'متوفر', color: 'bg-green-100 text-green-800' };
  };

  const openDialog = (kind: ActionKind, product: Product) => {
    if (isReadOnly) return;
    if (kind === 'move' && product.warehouseQuantity === 0) return;
    if (kind === 'take' && product.warehouseQuantity === 0) return;
    setDialog({ kind, product, quantity: 1 });
  };

  const closeDialog = () => setDialog(null);

  const handleSubmit = async () => {
    if (!dialog) return;
    const { kind, product, quantity } = dialog;
    if (quantity <= 0) {
      toast({
        title: 'كمية غير صحيحة',
        description: 'دخّل كمية أكبر من صفر.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      if (kind === 'add') {
        await onAddToWarehouse(product.id, quantity);
        toast({
          title: 'تمت إضافة الكمية للمخزن',
          description: `تمت إضافة ${quantity} قطعة لـ ${product.name}.`,
        });
      } else if (kind === 'take') {
        const ok = await onTakeFromWarehouse(product.id, quantity);
        if (!ok) {
          toast({
            title: 'الكمية مش كافية',
            description: 'المتاح في المخزن أقل من الكمية دي.',
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'تم الخصم من المخزن',
          description: `تم خصم ${quantity} قطعة من ${product.name}.`,
        });
      } else {
        const ok = await onMoveToStore(product.id, quantity);
        if (!ok) {
          toast({
            title: 'الكمية مش كافية',
            description: 'المتاح في المخزن أقل من الكمية اللي عايز تنقلها.',
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'تم نقل البضاعة للمحل',
          description: `تم نقل ${quantity} قطعة من ${product.name} من المخزن للمحل.`,
        });
      }
      closeDialog();
    } catch (err: any) {
      toast({
        title: 'حصلت مشكلة',
        description: err?.message || 'حاول تاني',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogTitle = (() => {
    if (!dialog) return '';
    if (dialog.kind === 'add') return 'إضافة كمية للمخزن';
    if (dialog.kind === 'take') return 'خصم كمية من المخزن';
    return 'نقل من المخزن للمحل';
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">مخزن المحل</h2>
        <div className="flex flex-wrap gap-2">
          {!isReadOnly && (
            <Button
              onClick={() => setIsAddProductOpen(true)}
              className="bg-neutral-900 hover:bg-black text-white"
            >
              <PackagePlus className="h-4 w-4" />
              إضافة منتج جديد
            </Button>
          )}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="ابحث بالاسم أو الباركود..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pr-9 w-full sm:w-64"
            />
          </div>
          <Button
            variant={stockFilter === 'low' ? 'default' : 'outline'}
            onClick={() => {
              setStockFilter((prev) => (prev === 'low' ? 'all' : 'low'));
              setCurrentPage(1);
            }}
            className={
              stockFilter === 'low'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'border-amber-200 text-amber-700 hover:bg-amber-50'
            }
          >
            <Filter className="h-4 w-4" />
            كمية قليلة
          </Button>
          <Button
            variant={stockFilter === 'out' ? 'default' : 'outline'}
            onClick={() => {
              setStockFilter((prev) => (prev === 'out' ? 'all' : 'out'));
              setCurrentPage(1);
            }}
            className={
              stockFilter === 'out'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'border-red-200 text-red-700 hover:bg-red-50'
            }
          >
            <Filter className="h-4 w-4" />
            خلص من المخزن
          </Button>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="grid sm:hidden gap-3">
        {pageProducts.map((p) => {
          const s = getStockStatus(p.warehouseQuantity);
          return (
            <div key={p.id} className="rounded-lg bg-white p-4 shadow">
              <div className="flex items-center gap-3">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="h-14 w-14 rounded-lg border border-gray-200 object-cover" />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-lg bg-gray-100 text-xs text-gray-400">
                    مفيش صورة
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gray-900">{p.name}</div>
                  <div className="truncate text-xs text-gray-500" dir="ltr">{p.barcode}</div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>
                    {s.text}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">في المخزن</div>
                  <div className="font-bold text-gray-900">{p.warehouseQuantity}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <div className="text-xs text-gray-500">في المحل</div>
                  <div className="font-bold text-gray-900">{p.quantity}</div>
                </div>
              </div>
              {!isReadOnly && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" onClick={() => openDialog('add', p)}>
                    <Plus className="h-4 w-4" />
                    إضافة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDialog('take', p)}
                    disabled={p.warehouseQuantity === 0}
                  >
                    <Minus className="h-4 w-4" />
                    خصم
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => openDialog('move', p)}
                    disabled={p.warehouseQuantity === 0}
                    className="bg-neutral-900 hover:bg-black text-white"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    للمحل
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الصورة</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">المنتج</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الباركود</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">القسم</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">السعر</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">في المخزن</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">في المحل</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">الحالة</th>
              {!isReadOnly && (
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">إجراءات</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {pageProducts.map((p) => {
              const s = getStockStatus(p.warehouseQuantity);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded bg-gray-100 text-xs text-gray-400">
                        مفيش صورة
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{p.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap" dir="ltr">{p.barcode}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{p.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatEGP(p.price)}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold">{p.warehouseQuantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{p.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${s.color}`}>
                      {s.text}
                    </span>
                  </td>
                  {!isReadOnly && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openDialog('add', p)}
                          className="text-green-600 hover:text-green-800"
                          title="إضافة للمخزن"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDialog('take', p)}
                          disabled={p.warehouseQuantity === 0}
                          className="text-red-600 hover:text-red-800 disabled:opacity-40"
                          title="خصم من المخزن"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDialog('move', p)}
                          disabled={p.warehouseQuantity === 0}
                          className="text-neutral-800 hover:text-brand-600 disabled:opacity-40"
                          title="نقل للمحل"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {pageProducts.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">
            مفيش منتجات في المخزن مطابقة للبحث.
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <Dialog open={!!dialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <div className="font-medium text-gray-900">{dialog.product.name}</div>
                <div className="text-xs text-gray-500" dir="ltr">{dialog.product.barcode}</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>في المخزن: <span className="font-bold">{dialog.product.warehouseQuantity}</span></div>
                  <div>في المحل: <span className="font-bold">{dialog.product.quantity}</span></div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>الكمية</Label>
                <Input
                  type="number"
                  min={1}
                  max={
                    dialog.kind === 'add'
                      ? undefined
                      : dialog.product.warehouseQuantity
                  }
                  value={dialog.quantity}
                  onChange={(e) =>
                    setDialog((prev) =>
                      prev ? { ...prev, quantity: Math.max(1, Number(e.target.value) || 1) } : prev
                    )
                  }
                />
                {(dialog.kind === 'take' || dialog.kind === 'move') && (
                  <p className="text-xs text-gray-500">
                    الحد الأقصى: {dialog.product.warehouseQuantity}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'جاري الحفظ...' : 'تأكيد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductForm
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSubmit={handleAddProduct}
      />
    </div>
  );
};

export default InventoryTab;
