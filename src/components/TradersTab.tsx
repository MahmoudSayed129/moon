import { useState } from 'react';
import { useTraders } from '@/hooks/useTraders';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Trader } from '@/types';

const TradersTab = () => {
  const { traders, isLoading, addTrader, updateTrader, deleteTrader } = useTraders();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTrader, setEditingTrader] = useState<Trader | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', notes: '' });

  const handleOpenDialog = (trader?: Trader) => {
    if (trader) {
      setEditingTrader(trader);
      setFormData({
        name: trader.name,
        phone: trader.phone || '',
        notes: trader.notes || '',
      });
    } else {
      setEditingTrader(null);
      setFormData({ name: '', phone: '', notes: '' });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTrader(null);
    setFormData({ name: '', phone: '', notes: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTrader) {
        await updateTrader(editingTrader.id, formData);
        toast({ title: 'تم تحديث التاجر بنجاح' });
      } else {
        await addTrader(formData);
        toast({ title: 'تمت إضافة التاجر بنجاح' });
      }
      handleCloseDialog();
    } catch (error: any) {
      toast({
        title: 'حصلت مشكلة',
        description: error?.message || 'حاول تاني',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('متأكد إنك عايز تحذف التاجر ده؟')) {
      try {
        await deleteTrader(id);
        toast({ title: 'تم حذف التاجر بنجاح' });
      } catch (error: any) {
        toast({
          title: 'حصلت مشكلة',
          description: error?.message || 'حاول تاني',
          variant: 'destructive',
        });
      }
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إدارة التجار</h2>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة تاجر
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الاسم
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الموبايل
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                ملاحظات
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                إجراءات
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {traders.map((trader) => (
              <tr key={trader.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {trader.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500" dir="ltr">
                  {trader.phone || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {trader.notes || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(trader)}
                      aria-label="تعديل"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(trader.id)}
                      aria-label="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {traders.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            مفيش تجار لسه. ضيف تاجر جديد علشان تربط بضاعتك بيه.
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTrader ? 'تعديل التاجر' : 'إضافة تاجر جديد'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اسم التاجر
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الموبايل
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                dir="ltr"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-right"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ملاحظات
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                إلغاء
              </Button>
              <Button type="submit">
                {editingTrader ? 'حفظ التعديل' : 'إضافة'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradersTab;
