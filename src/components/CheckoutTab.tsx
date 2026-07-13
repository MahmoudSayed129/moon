import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckoutCartItem, CheckoutResult, Product } from '@/types';
import { useClients } from '@/hooks/useClients';
import { useEmployeeDirectory } from '@/hooks/useEmployeeDirectory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  BadgePercent,
  Minus,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { downloadInvoicePdf, printReceiptPdf } from '@/lib/invoice';
import { formatEGP } from '@/lib/currency';
import {
  Offer,
  computeTotalDiscount,
  describeOffer,
} from '@/lib/offers';

interface CheckoutTabProps {
  products: Product[];
  onCheckout: (payload: {
    items: Array<{ productId: string; quantity: number }>;
    clientId?: string;
    employeeCode?: string;
    notes?: string;
    discountAmount?: number;
  }) => Promise<CheckoutResult>;
}

const CheckoutTab = ({ products, onCheckout }: CheckoutTabProps) => {
  const { clients, addClient } = useClients();
  const { employees } = useEmployeeDirectory();
  const { toast } = useToast();
  const productDropdownRef = useRef<HTMLDivElement | null>(null);
  const employeeDropdownRef = useRef<HTMLDivElement | null>(null);
  const [searchCode, setSearchCode] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('walk-in');
  const [employeeLookup, setEmployeeLookup] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoice, setInvoice] = useState<CheckoutResult | null>(null);
  const [cart, setCart] = useState<CheckoutCartItem[]>([]);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', notes: '' });
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [draftOffer, setDraftOffer] = useState<
    | { kind: 'invoice-percent'; percent: string }
    | { kind: 'items-percent'; percent: string; productIds: string[] }
    | { kind: 'buy-x-pay-y'; getCount: string; payCount: string }
  >({ kind: 'invoice-percent', percent: '10' });

  const filteredProducts = useMemo(() => {
    const query = searchCode.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.barcode.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query) ||
        (product.size || '').toLowerCase().includes(query)
    );
  }, [products, searchCode]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );

  const filteredEmployees = useMemo(() => {
    const query = employeeLookup.trim().toLowerCase();
    if (!query) return employees;

    return employees.filter(
      (employee) =>
        employee.username.toLowerCase().includes(query) ||
        (employee.employeeCode || '').toLowerCase().includes(query)
    );
  }, [employees, employeeLookup]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const { discount: totalDiscount, perOffer: offerBreakdown } = useMemo(
    () => computeTotalDiscount(offers, cart),
    [offers, cart]
  );
  const netTotal = Math.max(0, subtotal - totalDiscount);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      if (productDropdownRef.current && !productDropdownRef.current.contains(target)) {
        setIsProductDropdownOpen(false);
      }
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(target)) {
        setIsEmployeeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const addItemToCart = () => {
    if (!selectedProduct) {
      toast({
        title: 'اختار منتج',
        description: 'لازم تختار منتج قبل ما تضيفه للفاتورة.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedQuantity < 1 || selectedQuantity > selectedProduct.quantity) {
      toast({
        title: 'كمية غير صحيحة',
        description: `المتوفر من ${selectedProduct.name} هو ${selectedProduct.quantity} قطعة.`,
        variant: 'destructive',
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === selectedProduct.id);
      if (existing) {
        const newQuantity = existing.quantity + selectedQuantity;
        if (newQuantity > selectedProduct.quantity) {
          toast({
            title: 'الكمية أكبر من المتاح',
            description: `مقدرش تبيع أكتر من ${selectedProduct.quantity} قطعة من ${selectedProduct.name}.`,
            variant: 'destructive',
          });
          return prev;
        }
        return prev.map((item) =>
          item.productId === selectedProduct.id ? { ...item, quantity: newQuantity } : item
        );
      }

      return [
        ...prev,
        {
          productId: selectedProduct.id,
          name: selectedProduct.name,
          barcode: selectedProduct.barcode,
          quantity: selectedQuantity,
          availableQuantity: selectedProduct.quantity,
          unitPrice: selectedProduct.price,
        },
      ];
    });
  };

  const selectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setSearchCode(
      `${product.name} • ${product.barcode}${product.size ? ` • ${product.size}` : ''}`
    );
    setIsProductDropdownOpen(false);
  };

  const selectEmployee = (employee: { username: string; employeeCode?: string }) => {
    setEmployeeCode(employee.employeeCode || '');
    setEmployeeLookup(
      employee.employeeCode
        ? `${employee.username} • ${employee.employeeCode}`
        : employee.username
    );
    setIsEmployeeDropdownOpen(false);
  };

  const updateCartQuantity = (productId: string, nextQuantity: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          return {
            ...item,
            quantity: Math.max(1, Math.min(nextQuantity, item.availableQuantity)),
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const createInlineClient = async () => {
    if (!newClient.name.trim()) {
      throw new Error('اسم العميل مطلوب');
    }
    const createdClient = await addClient(newClient);
    setSelectedClientId(createdClient.id);
    setNewClient({ name: '', phone: '', email: '', notes: '' });
    setIsCreatingClient(false);
    return createdClient;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({
        title: 'الفاتورة فاضية',
        description: 'ضيف قطعة واحدة على الأقل قبل ما تكمل.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      let clientId: string | undefined;
      let clientRecord = null;

      if (isCreatingClient) {
        clientRecord = await createInlineClient();
        clientId = clientRecord.id;
      } else if (selectedClientId && selectedClientId !== 'walk-in') {
        clientId = selectedClientId;
        clientRecord =
          clients.find((client) => client.id === selectedClientId) || null;
      }

      const result = await onCheckout({
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        clientId,
        employeeCode: employeeCode.trim() || undefined,
        notes: notes.trim() || undefined,
        discountAmount: totalDiscount,
      });

      const finalResult = { ...result, client: clientRecord };

      setInvoice(finalResult);
      setCart([]);
      setOffers([]);
      setEmployeeLookup('');
      setEmployeeCode('');
      setNotes('');
      setSearchCode('');
      setSelectedProductId('');
      setSelectedQuantity(1);
      setIsProductDropdownOpen(false);

      toast({
        title: 'تمت عملية البيع',
        description: `تم إصدار الفاتورة ${result.order.invoiceNumber} بنجاح.`,
      });
    } catch (error: any) {
      toast({
        title: 'فشلت عملية البيع',
        description: error.message || 'راجع الفاتورة وحاول تاني.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">نقطة البيع</h2>
        <p className="text-sm text-gray-500">
          بيع المنتجات، اربط الفاتورة بالعميل، طبّق عمولة الموظف، وأصدر إيصال احترافي.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                امسح أو ابحث بالباركود
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_140px_auto]">
                <div className="space-y-2 md:col-span-2">
                  <Label>كود المنتج أو اسمه</Label>
                  <div ref={productDropdownRef} className="relative">
                    <Input
                      value={searchCode}
                      onChange={(e) => {
                        setSearchCode(e.target.value);
                        setSelectedProductId('');
                        setIsProductDropdownOpen(true);
                      }}
                      onFocus={() => setIsProductDropdownOpen(true)}
                      placeholder="اكتب الباركود أو اسم المنتج"
                    />
                    {isProductDropdownOpen && searchCode.trim() && (
                      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white shadow-lg">
                        <Command className="bg-white">
                          <CommandList>
                            <CommandEmpty>مفيش منتج مطابق للبحث.</CommandEmpty>
                            <CommandGroup>
                              {filteredProducts.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.name} ${product.barcode} ${product.size || ''}`}
                                  onSelect={() => selectProduct(product)}
                                  className="flex flex-col items-start gap-1 px-4 py-3"
                                >
                                  <span className="w-full truncate font-medium text-gray-900">
                                    {product.name}
                                  </span>
                                  <span className="w-full truncate text-xs text-gray-500">
                                    {product.barcode}
                                    {product.size ? ` • ${product.size}` : ''}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الكمية</Label>
                  <Input
                    type="number"
                    min={1}
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addItemToCart} className="w-full">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة
                  </Button>
                </div>
              </div>

              {selectedProduct && (
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                  <div className="font-medium text-gray-900">{selectedProduct.name}</div>
                  <div>المتاح في المحل: {selectedProduct.quantity}</div>
                  <div>السعر: {formatEGP(selectedProduct.price)}</div>
                  <div>القسم: {selectedProduct.category}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>العميل والعمولة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>العميل</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختار العميل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk-in">عميل عابر</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>كود عمولة الموظف</Label>
                  <div ref={employeeDropdownRef} className="relative">
                    <Input
                      value={employeeLookup}
                      onChange={(e) => {
                        setEmployeeLookup(e.target.value);
                        setEmployeeCode('');
                        setIsEmployeeDropdownOpen(true);
                      }}
                      onFocus={() => setIsEmployeeDropdownOpen(true)}
                      placeholder="ابحث باسم أو كود الموظف"
                    />
                    {isEmployeeDropdownOpen && (
                      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white shadow-lg">
                        <Command className="bg-white">
                          <CommandList>
                            <CommandEmpty>مفيش موظف مطابق للبحث.</CommandEmpty>
                            <CommandGroup>
                              {filteredEmployees.map((employee) => (
                                <CommandItem
                                  key={employee.id}
                                  value={`${employee.username} ${employee.employeeCode || ''}`}
                                  onSelect={() => selectEmployee(employee)}
                                  className="flex flex-col items-start gap-1 px-4 py-3"
                                >
                                  <span className="w-full truncate font-medium text-gray-900">
                                    {employee.username}
                                  </span>
                                  <span className="w-full truncate text-xs text-gray-500">
                                    {employee.employeeCode || 'مفيش كود'}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-gray-300 p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-gray-900">إضافة عميل سريع</div>
                    <div className="text-sm text-gray-500">
                      استخدمها لو العميل جديد ومش موجود في السيستم.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreatingClient((prev) => !prev)}
                    className="w-full sm:w-auto"
                  >
                    <UserPlus className="ml-2 h-4 w-4" />
                    {isCreatingClient ? 'استخدم عميل موجود' : 'إضافة عميل جديد'}
                  </Button>
                </div>
                {isCreatingClient && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>الاسم</Label>
                      <Input
                        value={newClient.name}
                        onChange={(e) =>
                          setNewClient((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الموبايل</Label>
                      <Input
                        value={newClient.phone}
                        onChange={(e) =>
                          setNewClient((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الإيميل</Label>
                      <Input
                        value={newClient.email}
                        onChange={(e) =>
                          setNewClient((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>ملاحظات</Label>
                      <Textarea
                        value={newClient.notes}
                        onChange={(e) =>
                          setNewClient((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>ملاحظات الفاتورة</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="بيانات التوصيل أو ملاحظات دفع أو أي تعليمات خاصة"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              سلة الفاتورة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                ضيف منتجات علشان تبدأ الفاتورة.
              </div>
            )}

            {cart.map((item) => (
              <div key={item.productId} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{item.name}</div>
                    <div className="truncate text-sm text-gray-500" dir="ltr">
                      {item.barcode}
                    </div>
                    <div className="text-sm text-gray-500">
                      المتاح: {item.availableQuantity}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeFromCart(item.productId)}
                    className="w-full sm:w-auto"
                  >
                    حذف
                  </Button>
                </div>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="w-10 text-center font-medium">{item.quantity}</div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateCartQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {formatEGP(item.unitPrice)} للقطعة
                    </div>
                    <div className="font-semibold text-gray-900">
                      {formatEGP(item.unitPrice * item.quantity)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* --- Offers container --- */}
            <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-purple-900">
                  <BadgePercent className="h-4 w-4" />
                  <div className="font-semibold">العروض والخصومات</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-purple-200 text-purple-700 hover:bg-purple-100"
                  onClick={() => {
                    setDraftOffer({ kind: 'invoice-percent', percent: '10' });
                    setIsOfferDialogOpen(true);
                  }}
                >
                  <Plus className="ml-1 h-4 w-4" />
                  إضافة عرض
                </Button>
              </div>
              {offers.length === 0 ? (
                <p className="mt-3 text-xs text-purple-700/80">
                  مفيش عروض متطبقة. اضغط "إضافة عرض" لو الفاتورة عليها خصم.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {offers.map((offer, idx) => {
                    const info = offerBreakdown[idx];
                    return (
                      <li
                        key={offer.id}
                        className={`flex items-start justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm ${
                          info.discount === 0 ? 'opacity-70' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            <Tag className="h-3.5 w-3.5 text-purple-600" />
                            <span className="truncate">{describeOffer(offer)}</span>
                          </div>
                          {info.discount > 0 ? (
                            <div className="mt-0.5 text-xs text-emerald-700">
                              - {formatEGP(info.discount)}
                            </div>
                          ) : (
                            <div className="mt-0.5 text-xs text-gray-500">
                              {info.note || 'العرض مش هيتطبق حالياً'}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setOffers((prev) => prev.filter((o) => o.id !== offer.id))
                          }
                          className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="حذف العرض"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-xl bg-gray-900 p-5 text-white">
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span>المجموع قبل الخصم</span>
                <span>{formatEGP(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="mt-1 flex items-center justify-between text-sm text-emerald-300">
                  <span>إجمالي الخصم</span>
                  <span>- {formatEGP(totalDiscount)}</span>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-xl font-semibold">
                <span>الإجمالي</span>
                <span>{formatEGP(netTotal)}</span>
              </div>
              <Button
                className="mt-5 w-full bg-white text-gray-900 hover:bg-gray-100"
                onClick={handleCheckout}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'جاري الإصدار...' : 'إتمام البيع'}
              </Button>
            </div>

            {invoice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-emerald-900">
                      {invoice.order.invoiceNumber}
                    </div>
                    <div className="text-sm text-emerald-700">
                      {invoice.client?.name || 'عميل عابر'} •{' '}
                      {formatEGP(invoice.order.totalAmount)}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      printReceiptPdf({
                        invoiceNumber: invoice.order.invoiceNumber,
                        createdAt: invoice.order.createdAt,
                        subtotal: invoice.order.subtotal,
                        discountAmount: invoice.order.discountAmount,
                        totalAmount: invoice.order.totalAmount,
                        commissionRate: invoice.order.commissionRate,
                        commissionAmount: invoice.order.commissionAmount,
                        notes: invoice.order.notes,
                        employeeCode:
                          invoice.employee?.employeeCode ||
                          invoice.order.employeeCode,
                        employeeName: invoice.employee?.username,
                        client: invoice.client || undefined,
                        items: invoice.order.items,
                      })
                    }
                  >
                    <Printer className="ml-2 h-4 w-4" />
                    طباعة الإيصال
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      downloadInvoicePdf({
                        invoiceNumber: invoice.order.invoiceNumber,
                        createdAt: invoice.order.createdAt,
                        subtotal: invoice.order.subtotal,
                        discountAmount: invoice.order.discountAmount,
                        totalAmount: invoice.order.totalAmount,
                        commissionRate: invoice.order.commissionRate,
                        commissionAmount: invoice.order.commissionAmount,
                        notes: invoice.order.notes,
                        employeeCode:
                          invoice.employee?.employeeCode ||
                          invoice.order.employeeCode,
                        employeeName: invoice.employee?.username,
                        client: invoice.client || undefined,
                        items: invoice.order.items,
                      })
                    }
                  >
                    <Receipt className="ml-2 h-4 w-4" />
                    تنزيل الفاتورة
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- Offer builder dialog --- */}
      <Dialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>إضافة عرض</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup
              value={draftOffer.kind}
              onValueChange={(value) => {
                if (value === 'invoice-percent') {
                  setDraftOffer({ kind: 'invoice-percent', percent: '10' });
                } else if (value === 'items-percent') {
                  setDraftOffer({ kind: 'items-percent', percent: '10', productIds: [] });
                } else {
                  setDraftOffer({ kind: 'buy-x-pay-y', getCount: '5', payCount: '2' });
                }
              }}
              className="grid gap-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                <RadioGroupItem value="invoice-percent" id="offer-invoice-percent" className="mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">خصم % على كل الفاتورة</div>
                  <div className="text-xs text-gray-500">
                    نسبة خصم واحدة تتخصم من إجمالي الفاتورة كلها.
                  </div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                <RadioGroupItem value="items-percent" id="offer-items-percent" className="mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">خصم % على منتجات محددة</div>
                  <div className="text-xs text-gray-500">
                    اختار من قطع الفاتورة اللي عليها العرض.
                  </div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
                <RadioGroupItem value="buy-x-pay-y" id="offer-buy-x-pay-y" className="mt-1" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">خد X قطعة وادفع تمن Y</div>
                  <div className="text-xs text-gray-500">
                    مثلاً: خد 5 قطع وادفع تمن 2 — أرخص 3 قطع في الفاتورة يبقوا مجاناً.
                  </div>
                </div>
              </label>
            </RadioGroup>

            {draftOffer.kind === 'invoice-percent' && (
              <div className="space-y-2">
                <Label>نسبة الخصم %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={draftOffer.percent}
                  onChange={(e) =>
                    setDraftOffer({ kind: 'invoice-percent', percent: e.target.value })
                  }
                />
              </div>
            )}

            {draftOffer.kind === 'items-percent' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>نسبة الخصم %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={draftOffer.percent}
                    onChange={(e) =>
                      setDraftOffer((prev) =>
                        prev.kind === 'items-percent' ? { ...prev, percent: e.target.value } : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>القطع اللي عليها العرض</Label>
                  {cart.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      ضيف قطع للفاتورة الأول عشان تختار منها.
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
                      {cart.map((item) => (
                        <label
                          key={item.productId}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={
                              draftOffer.kind === 'items-percent' &&
                              draftOffer.productIds.includes(item.productId)
                            }
                            onCheckedChange={(checked) =>
                              setDraftOffer((prev) => {
                                if (prev.kind !== 'items-percent') return prev;
                                const set = new Set(prev.productIds);
                                if (checked) set.add(item.productId);
                                else set.delete(item.productId);
                                return { ...prev, productIds: Array.from(set) };
                              })
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {item.quantity} × {formatEGP(item.unitPrice)}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {draftOffer.kind === 'buy-x-pay-y' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>عدد القطع اللي بياخدها العميل (X)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={draftOffer.getCount}
                    onChange={(e) =>
                      setDraftOffer((prev) =>
                        prev.kind === 'buy-x-pay-y'
                          ? { ...prev, getCount: e.target.value }
                          : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>عدد القطع اللي بيدفع تمنها (Y)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={draftOffer.payCount}
                    onChange={(e) =>
                      setDraftOffer((prev) =>
                        prev.kind === 'buy-x-pay-y'
                          ? { ...prev, payCount: e.target.value }
                          : prev
                      )
                    }
                  />
                </div>
                <div className="col-span-2 text-xs text-gray-500">
                  الأرخص من كل X قطعة يبقوا مجاناً. الأمثلة: 5 و 2 = أرخص 3 مجاناً؛ 3 و 2 = أرخص قطعة مجاناً.
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOfferDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                const id = `offer-${Date.now()}-${Math.round(Math.random() * 10000)}`;
                if (draftOffer.kind === 'invoice-percent') {
                  const pct = parseFloat(draftOffer.percent);
                  if (!Number.isFinite(pct) || pct <= 0) {
                    toast({
                      title: 'نسبة غير صحيحة',
                      description: 'دخّل نسبة أكبر من صفر.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  setOffers((prev) => [...prev, { id, kind: 'invoice-percent', percent: pct }]);
                } else if (draftOffer.kind === 'items-percent') {
                  const pct = parseFloat(draftOffer.percent);
                  if (!Number.isFinite(pct) || pct <= 0) {
                    toast({
                      title: 'نسبة غير صحيحة',
                      description: 'دخّل نسبة أكبر من صفر.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  if (draftOffer.productIds.length === 0) {
                    toast({
                      title: 'اختار قطع أولاً',
                      description: 'حدّد على الأقل قطعة واحدة من الفاتورة.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  setOffers((prev) => [
                    ...prev,
                    {
                      id,
                      kind: 'items-percent',
                      percent: pct,
                      productIds: [...draftOffer.productIds],
                    },
                  ]);
                } else {
                  const x = parseInt(draftOffer.getCount, 10);
                  const y = parseInt(draftOffer.payCount, 10);
                  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y < 0 || y >= x) {
                    toast({
                      title: 'قيم العرض غير صحيحة',
                      description: 'X لازم أكبر من Y وأكبر من صفر.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  setOffers((prev) => [
                    ...prev,
                    { id, kind: 'buy-x-pay-y', getCount: x, payCount: y },
                  ]);
                }
                setIsOfferDialogOpen(false);
              }}
            >
              حفظ العرض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutTab;
