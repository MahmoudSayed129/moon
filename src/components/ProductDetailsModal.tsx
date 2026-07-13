import { useState } from 'react';
import { Product } from '@/types';
import { X, Plus, Minus, Edit, Trash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatEGP } from '@/lib/currency';

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  onAddToProduct: (productId: string, quantity: number) => void;
  onTakeFromProduct: (productId: string, quantity: number) => Promise<boolean>;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}

const ProductDetailsModal = ({
  product,
  onClose,
  onAddToProduct,
  onTakeFromProduct,
  onEdit,
  onDelete,
  isReadOnly = false,
}: ProductDetailsModalProps) => {
  const [addQuantity, setAddQuantity] = useState(1);
  const [takeQuantity, setTakeQuantity] = useState(1);
  const { toast } = useToast();

  const handleAddQuantity = () => {
    if (isReadOnly) return;
    if (addQuantity > 0) {
      onAddToProduct(product.id, addQuantity);
      toast({
        title: 'تمت الإضافة',
        description: `تمت إضافة ${addQuantity} قطعة لـ ${product.name}`,
        duration: 3000,
      });
      setAddQuantity(1);
    }
  };

  const handleTakeQuantity = async () => {
    if (isReadOnly) return;
    if (takeQuantity > 0 && takeQuantity <= product.quantity) {
      const success = await onTakeFromProduct(product.id, takeQuantity);
      if (success) {
        toast({
          title: 'تم الخصم',
          description: `تم خصم ${takeQuantity} قطعة من ${product.name}`,
          duration: 3000,
        });
        setTakeQuantity(1);
      } else {
        toast({
          title: 'خطأ',
          description: 'مقدرش تخصم أكتر من الكمية المتوفرة',
          variant: 'destructive',
          duration: 3000,
        });
      }
    } else {
      toast({
        title: 'خطأ',
        description: 'الكمية غير صحيحة',
        variant: 'destructive',
        duration: 3000,
      });
    }
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { text: 'خلص من المحل', color: 'text-red-600 bg-red-50' };
    if (quantity < 10) return { text: 'كمية قليلة', color: 'text-yellow-600 bg-yellow-50' };
    return { text: 'متوفر', color: 'text-green-600 bg-green-50' };
  };

  const stockStatus = getStockStatus(product.quantity);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">تفاصيل المنتج</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="إغلاق">
            <X className="w-6 h-6" />
          </button>
        </div>

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>عرض فقط:</strong> مش مسموح لك تعمل تعديلات على المنتج ده.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-64 object-cover rounded-lg border border-gray-200"
              />
            ) : (
              <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-400">مفيش صورة</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{product.name}</h3>
              {product.description && <p className="text-gray-600 mt-1">{product.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">الباركود:</span>
                <p className="text-gray-900" dir="ltr">
                  {product.barcode}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700">القسم:</span>
                <p className="text-gray-900">{product.category}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">المقاس:</span>
                <p className="text-gray-900">{product.size || 'غير محدد'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">السعر:</span>
                <p className="text-gray-900 font-semibold">{formatEGP(product.price)}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">التاجر:</span>
                <p className="text-gray-900">{product.trader || 'غير محدد'}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">سعر الجملة:</span>
                <p className="text-gray-900">
                  {product.costPrice !== undefined ? formatEGP(product.costPrice) : 'غير محدد'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-700">الكمية:</span>
                <p className="text-2xl font-bold text-gray-900">{product.quantity}</p>
              </div>
              <span
                className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${stockStatus.color}`}
              >
                {stockStatus.text}
              </span>
            </div>

            <div className="text-xs text-gray-500">
              <p>تاريخ الإضافة: {new Date(product.dateAdded).toLocaleDateString('ar-EG')}</p>
              <p>آخر تحديث: {new Date(product.lastUpdated).toLocaleDateString('ar-EG')}</p>
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-3">إضافة كمية</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-3 py-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={handleAddQuantity}
                    className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-semibold text-orange-800 mb-3">تحويل للمعرض</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max={product.quantity}
                    value={takeQuantity}
                    onChange={(e) =>
                      setTakeQuantity(
                        Math.max(1, Math.min(product.quantity, parseInt(e.target.value) || 1))
                      )
                    }
                    className="w-20 px-3 py-2 border border-orange-300 rounded-md focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    onClick={handleTakeQuantity}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-orange-700"
                    disabled={product.quantity === 0}
                  >
                    <Minus className="w-4 h-4" />
                    <span>خصم</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  onEdit(product);
                  onClose();
                }}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md flex items-center gap-2 hover:bg-indigo-700"
              >
                <Edit className="w-4 h-4" />
                <span>تعديل المنتج</span>
              </button>
              <button
                onClick={() => {
                  if (confirm('متأكد إنك عايز تحذف المنتج ده؟')) {
                    onDelete(product.id);
                    onClose();
                  }
                }}
                className="bg-red-600 text-white px-6 py-2 rounded-md flex items-center gap-2 hover:bg-red-700"
              >
                <Trash className="w-4 h-4" />
                <span>حذف المنتج</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailsModal;
