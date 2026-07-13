import { useState, useEffect } from 'react';
import { ProductWithCategory } from '@/types';
import ImageUpload from './ImageUpload';
import BarcodeScanner from './BarcodeScanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Scan } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useTraders } from '@/hooks/useTraders';
import { formatEGP } from '@/lib/currency';

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (product: Omit<ProductWithCategory, 'id' | 'dateAdded' | 'lastUpdated'>) => void;
  product?: ProductWithCategory | null;
  similarProductTemplate?: ProductWithCategory | null;
  onUpdateProduct?: (id: string, updates: Partial<ProductWithCategory>) => void;
  onAddToProduct?: (productId: string, quantity: number) => void;
  onTakeFromProduct?: (productId: string, quantity: number) => Promise<boolean>;
}

const ProductForm = ({
  isOpen,
  onClose,
  onSubmit,
  product,
  similarProductTemplate,
  onUpdateProduct,
  onAddToProduct,
  onTakeFromProduct,
}: ProductFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    quantity: 0,
    warehouseQuantity: 0,
    price: 0,
    category: '',
    traderId: '',
    costPrice: '' as string,
    description: '',
    size: '',
    image: undefined as string | undefined,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [quantityToAdd, setQuantityToAdd] = useState(0);
  const [quantityToTake, setQuantityToTake] = useState(0);
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);
  const { categories, isLoading } = useCategories();
  const { traders, isLoading: isLoadingTraders } = useTraders();

  useEffect(() => {
    if (product) {
      const existingCategoryId =
        product.categoryId ||
        categories.find((cat) => cat.name === product.category)?.id ||
        '';
      const existingTraderId =
        product.traderId ||
        traders.find((t) => t.name === product.trader)?.id ||
        '';

      setFormData({
        name: product.name,
        barcode: product.barcode,
        quantity: product.quantity,
        warehouseQuantity: product.warehouseQuantity ?? 0,
        price: product.price,
        category: existingCategoryId,
        traderId: existingTraderId,
        costPrice:
          product.costPrice !== undefined && product.costPrice !== null
            ? String(product.costPrice)
            : '',
        description: product.description || '',
        size: product.size || '',
        image: product.image,
      });
      setIsEditing(true);
    } else if (similarProductTemplate) {
      const templateCategoryId =
        similarProductTemplate.categoryId ||
        categories.find((cat) => cat.name === similarProductTemplate.category)?.id ||
        '';
      const templateTraderId =
        similarProductTemplate.traderId ||
        traders.find((t) => t.name === similarProductTemplate.trader)?.id ||
        '';

      setFormData({
        name: similarProductTemplate.name,
        barcode: '',
        quantity: 0,
        warehouseQuantity: 0,
        price: similarProductTemplate.price,
        category: templateCategoryId,
        traderId: templateTraderId,
        costPrice:
          similarProductTemplate.costPrice !== undefined &&
          similarProductTemplate.costPrice !== null
            ? String(similarProductTemplate.costPrice)
            : '',
        description: similarProductTemplate.description || '',
        size: similarProductTemplate.size || '',
        image: similarProductTemplate.image,
      });
      setIsEditing(false);
    } else {
      setFormData({
        name: '',
        barcode: '',
        quantity: 0,
        warehouseQuantity: 0,
        price: 0,
        category: '',
        traderId: '',
        costPrice: '',
        description: '',
        size: '',
        image: undefined,
      });
      setIsEditing(false);
    }
  }, [product, similarProductTemplate, categories, traders]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const costNum = formData.costPrice === '' ? undefined : parseFloat(formData.costPrice);
    const payload = {
      name: formData.name,
      barcode: formData.barcode,
      quantity: formData.quantity,
      warehouseQuantity: formData.warehouseQuantity,
      price: formData.price,
      category: formData.category,
      categoryId: formData.category || undefined,
      traderId: formData.traderId || undefined,
      costPrice: costNum !== undefined && !Number.isNaN(costNum) ? costNum : undefined,
      description: formData.description,
      size: formData.size,
      image: formData.image,
    };
    if (isEditing && product && onUpdateProduct) {
      onUpdateProduct(product.id, payload);
    } else {
      onSubmit(payload as any);
    }
    onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'quantity' || name === 'warehouseQuantity' || name === 'price'
          ? parseFloat(value) || 0
          : value,
    }));
  };

  const handleAddQuantity = () => {
    if (product && onAddToProduct && quantityToAdd > 0) {
      onAddToProduct(product.id, quantityToAdd);
      setQuantityToAdd(0);
      onClose();
    }
  };

  const handleTakeQuantity = async () => {
    if (product && onTakeFromProduct && quantityToTake > 0) {
      const success = await onTakeFromProduct(product.id, quantityToTake);
      if (success) {
        setQuantityToTake(0);
        onClose();
      }
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    setFormData((prev) => ({ ...prev, barcode }));
    setIsBarcodeScanning(false);
  };

  const getDialogTitle = () => {
    if (isEditing) return 'تعديل منتج';
    if (similarProductTemplate) return 'إضافة منتج مشابه';
    return 'إضافة منتج جديد';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </DialogHeader>

          {isEditing ? (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">بيانات المنتج</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>الاسم:</strong> {product?.name}
                  </div>
                  <div>
                    <strong>الباركود:</strong> {product?.barcode}
                  </div>
                  <div>
                    <strong>القسم:</strong> {product?.category}
                  </div>
                  <div>
                    <strong>المقاس:</strong> {product?.size || 'غير محدد'}
                  </div>
                  <div>
                    <strong>السعر:</strong> {formatEGP(product?.price || 0)}
                  </div>
                  <div>
                    <strong>الكمية الحالية:</strong> {product?.quantity}
                  </div>
                  <div>
                    <strong>التاجر:</strong> {product?.trader || 'غير محدد'}
                  </div>
                  <div>
                    <strong>سعر الجملة:</strong>{' '}
                    {product?.costPrice !== undefined ? formatEGP(product.costPrice) : 'غير محدد'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">إضافة للمحل</h4>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={quantityToAdd}
                      onChange={(e) => setQuantityToAdd(parseInt(e.target.value) || 0)}
                      min="0"
                      className="flex-1 px-3 py-2 border border-green-300 rounded-lg"
                      placeholder="الكمية اللي هتضاف"
                    />
                    <button
                      onClick={handleAddQuantity}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      إضافة
                    </button>
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">خصم من المحل</h4>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={quantityToTake}
                      onChange={(e) => setQuantityToTake(parseInt(e.target.value) || 0)}
                      min="0"
                      max={product?.quantity || 0}
                      className="flex-1 px-3 py-2 border border-red-300 rounded-lg"
                      placeholder="الكمية اللي هتخصم"
                    />
                    <button
                      onClick={handleTakeQuantity}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      خصم
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اسم المنتج
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">الباركود</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="barcode"
                        value={formData.barcode}
                        onChange={handleChange}
                        required
                        dir="ltr"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-right"
                      />
                      <Button
                        type="button"
                        onClick={() => setIsBarcodeScanning(true)}
                        variant="outline"
                        className="px-3 py-2"
                      >
                        <Scan className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">القسم</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">اختار قسم</option>
                      {isLoading ? (
                        <option disabled>بيتم تحميل الأقسام...</option>
                      ) : (
                        categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">المقاس</label>
                    <select
                      name="size"
                      value={formData.size}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">اختار المقاس</option>
                      <option value="XS">XS</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                      <option value="XXL">XXL</option>
                      <option value="One Size">مقاس واحد</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      السعر (ج.م)
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      التاجر (المورّد)
                    </label>
                    <select
                      name="traderId"
                      value={formData.traderId}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">اختار تاجر (اختياري)</option>
                      {isLoadingTraders ? (
                        <option disabled>بيتم تحميل التجار...</option>
                      ) : (
                        traders.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      سعر الجملة من التاجر (ج.م)
                    </label>
                    <input
                      type="number"
                      name="costPrice"
                      value={formData.costPrice}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="اختياري - علشان نحسب هامش الربح"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  />
                </div>

                <ImageUpload
                  currentImage={formData.image}
                  onImageChange={(image) => setFormData((prev) => ({ ...prev, image }))}
                />

                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    حفظ التعديل
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              {similarProductTemplate && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2">
                    بتضيف منتج مشابه لـ:
                  </h3>
                  <p className="text-sm text-blue-700">
                    {similarProductTemplate.name} - {similarProductTemplate.barcode}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    الباركود والكمية اتفضّوا علشان تدخل بيانات جديدة
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      اسم المنتج
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">الباركود</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="barcode"
                        value={formData.barcode}
                        onChange={handleChange}
                        required
                        dir="ltr"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-right"
                        placeholder={similarProductTemplate ? 'دخّل باركود جديد للمنتج ده' : ''}
                      />
                      <Button
                        type="button"
                        onClick={() => setIsBarcodeScanning(true)}
                        variant="outline"
                        className="px-3 py-2"
                        title="قراءة الباركود"
                      >
                        <Scan className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">القسم</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">اختار قسم</option>
                      {isLoading ? (
                        <option disabled>بيتم تحميل الأقسام...</option>
                      ) : (
                        categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">المقاس</label>
                    <select
                      name="size"
                      value={formData.size}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">اختار المقاس</option>
                      <option value="XS">XS</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                      <option value="XXL">XXL</option>
                      <option value="One Size">مقاس واحد</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الكمية في المحل
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      min="0"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="القطع اللي هتنزل للمحل مباشرة"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الكمية في المخزن
                    </label>
                    <input
                      type="number"
                      name="warehouseQuantity"
                      value={formData.warehouseQuantity}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                      placeholder="القطع اللي هتتخزن ورا"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      السعر (ج.م)
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      التاجر (المورّد)
                    </label>
                    <select
                      name="traderId"
                      value={formData.traderId}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    >
                      <option value="">اختار تاجر (اختياري)</option>
                      {isLoadingTraders ? (
                        <option disabled>بيتم تحميل التجار...</option>
                      ) : (
                        traders.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      سعر الجملة من التاجر (ج.م)
                    </label>
                    <input
                      type="number"
                      name="costPrice"
                      value={formData.costPrice}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="اختياري - علشان نحسب هامش الربح"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  />
                </div>

                <ImageUpload
                  currentImage={formData.image}
                  onImageChange={(image) => setFormData((prev) => ({ ...prev, image }))}
                />

                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {similarProductTemplate ? 'إضافة المنتج المشابه' : 'إضافة المنتج'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        isOpen={isBarcodeScanning}
        onClose={() => setIsBarcodeScanning(false)}
        onScan={handleBarcodeScanned}
      />
    </>
  );
};

export default ProductForm;
