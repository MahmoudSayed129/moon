import { useEffect, useMemo, useState } from 'react';
import { Client, Order } from '@/types';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users } from 'lucide-react';
import { formatEGP } from '@/lib/currency';

const emptyClient = {
  name: '',
  phone: '',
  email: '',
  notes: '',
};

const CRMTab = () => {
  const { clients, isLoading, addClient, updateClient, getClientOrders } = useClients();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formState, setFormState] = useState(emptyClient);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedClientOrders, setSelectedClientOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) =>
      [client.name, client.phone, client.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [clients, searchQuery]);

  useEffect(() => {
    if (!selectedClient) return;

    const loadOrders = async () => {
      try {
        setIsOrdersLoading(true);
        const orders = await getClientOrders(selectedClient.id);
        setSelectedClientOrders(orders);
      } catch (error) {
        console.error('Error loading client orders:', error);
        toast({
          title: 'فشل تحميل مشتريات العميل',
          description: 'حاول تاني.',
          variant: 'destructive',
        });
      } finally {
        setIsOrdersLoading(false);
      }
    };

    loadOrders();
  }, [getClientOrders, selectedClient, toast]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newClient = await addClient(formState);
      setSelectedClient(newClient);
      setFormState(emptyClient);
      setIsDialogOpen(false);
      toast({
        title: 'تمت إضافة العميل',
        description: `${newClient.name} اتضاف للعملاء.`,
      });
    } catch (error: any) {
      toast({
        title: 'فشلت إضافة العميل',
        description: error.message || 'حاول تاني.',
        variant: 'destructive',
      });
    }
  };

  const handleQuickUpdate = async () => {
    if (!selectedClient) return;
    try {
      const updated = await updateClient(selectedClient.id, {
        name: selectedClient.name,
        phone: selectedClient.phone,
        email: selectedClient.email,
        notes: selectedClient.notes,
      });
      setSelectedClient(updated);
      toast({
        title: 'تم تحديث بيانات العميل',
        description: `${updated.name} اتحفظ بنجاح.`,
      });
    } catch (error: any) {
      toast({
        title: 'فشل تحديث العميل',
        description: error.message || 'حاول تاني.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">العملاء</h2>
          <p className="text-sm text-gray-500">
            إدارة العملاء ومراجعة كل حاجة اشتروها.
          </p>
        </div>
        <div className="flex w-full gap-3 lg:w-auto">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم، الموبايل، أو الإيميل"
            className="lg:w-80"
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="ml-2 h-4 w-4" />
                عميل جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة عميل</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-name">الاسم</Label>
                  <Input
                    id="client-name"
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-phone">الموبايل</Label>
                  <Input
                    id="client-phone"
                    value={formState.phone}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-email">الإيميل</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={formState.email}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-notes">ملاحظات</Label>
                  <Textarea
                    id="client-notes"
                    value={formState.notes}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={4}
                  />
                </div>
                <Button type="submit" className="w-full">
                  حفظ العميل
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              العملاء
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <div className="text-sm text-gray-500">جاري تحميل العملاء...</div>}
            {!isLoading && filteredClients.length === 0 && (
              <div className="text-sm text-gray-500">مفيش عملاء لسه.</div>
            )}
            {filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClient(client)}
                className={`w-full rounded-lg border p-3 text-right transition ${
                  selectedClient?.id === client.id
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-gray-900">{client.name}</div>
                  {client.hasReturns && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                      {client.returnsCount || 0} مرتجع
                    </span>
                  )}
                </div>
                {client.phone && (
                  <div className="text-sm text-gray-500" dir="ltr">
                    {client.phone}
                  </div>
                )}
                {client.email && (
                  <div className="text-sm text-gray-500" dir="ltr">
                    {client.email}
                  </div>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedClient ? selectedClient.name : 'تفاصيل العميل'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedClient && (
              <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                اختار عميل من القائمة علشان تشوف بياناته وسجل المشتريات.
              </div>
            )}

            {selectedClient && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>الاسم</Label>
                    <Input
                      value={selectedClient.name}
                      onChange={(e) =>
                        setSelectedClient((prev) =>
                          prev ? { ...prev, name: e.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الموبايل</Label>
                    <Input
                      value={selectedClient.phone || ''}
                      onChange={(e) =>
                        setSelectedClient((prev) =>
                          prev ? { ...prev, phone: e.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الإيميل</Label>
                    <Input
                      value={selectedClient.email || ''}
                      onChange={(e) =>
                        setSelectedClient((prev) =>
                          prev ? { ...prev, email: e.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>تاريخ الإضافة</Label>
                    <Input
                      value={new Date(selectedClient.createdAt).toLocaleDateString('ar-EG')}
                      disabled
                    />
                  </div>
                </div>
                {selectedClient.hasReturns && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    <div className="font-semibold">مرتجعات</div>
                    <div>
                      العميل ده عنده {selectedClient.returnsCount || 0} مرتجع.
                    </div>
                    {selectedClient.lastReturnedAt && (
                      <div>
                        آخر مرتجع:{' '}
                        {new Date(selectedClient.lastReturnedAt).toLocaleString('ar-EG')}
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={selectedClient.notes || ''}
                    onChange={(e) =>
                      setSelectedClient((prev) =>
                        prev ? { ...prev, notes: e.target.value } : prev
                      )
                    }
                    rows={4}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleQuickUpdate}>حفظ التغييرات</Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">سجل المشتريات</h3>
                    <p className="text-sm text-gray-500">
                      الفواتير والتواريخ وكل حاجة العميل ده اشتراها.
                    </p>
                  </div>
                  {isOrdersLoading && (
                    <div className="text-sm text-gray-500">جاري تحميل المشتريات...</div>
                  )}
                  {!isOrdersLoading && selectedClientOrders.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                      لسه مفيش مشتريات مسجلة للعميل ده.
                    </div>
                  )}
                  <div className="space-y-4">
                    {selectedClientOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-gray-200 p-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-gray-900">
                                {order.invoiceNumber}
                              </div>
                              {order.hasReturn && (
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                                  {order.returnStatus === 'full' ? 'مرتجع كامل' : 'بيه مرتجع'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(order.createdAt).toLocaleString('ar-EG')}
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="text-sm text-gray-500">الصافي</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {formatEGP(order.netTotalAmount || order.totalAmount)}
                            </div>
                            {(order.discountAmount || 0) > 0 && (
                              <div className="text-sm text-emerald-700">
                                خصم {formatEGP(order.discountAmount || 0)}
                              </div>
                            )}
                            {(order.returnedTotalAmount || 0) > 0 && (
                              <div className="text-sm text-blue-700">
                                المرتجع {formatEGP(order.returnedTotalAmount || 0)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                            >
                              <div>
                                <div className="font-medium text-gray-900">
                                  {item.productName}
                                </div>
                                <div className="text-gray-500" dir="ltr">
                                  {item.productBarcode}
                                </div>
                              </div>
                              <div className="text-left text-gray-700">
                                <div>
                                  {item.quantity} × {formatEGP(item.unitPrice)}
                                </div>
                                {(item.returnedQuantity || 0) > 0 && (
                                  <div className="text-blue-700">
                                    مرتجع: {item.returnedQuantity}
                                  </div>
                                )}
                                <div className="font-medium">
                                  {formatEGP(item.lineTotal)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.returns && order.returns.length > 0 && (
                          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                            {order.returns.map((entry) => (
                              <div key={entry.id} className="mb-2 last:mb-0">
                                <div className="font-medium">
                                  {new Date(entry.createdAt).toLocaleString('ar-EG')} • مرتجع{' '}
                                  {formatEGP(entry.totalReturned)}
                                </div>
                                <div>{entry.reason || 'مفيش سبب محدد.'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CRMTab;
