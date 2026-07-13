'use client';

import { useState } from 'react';
import { Edit, Trash, Scan, Plus, Filter, FileText, Download, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProductWithCategory } from '@/types';
import Pagination from './pagination';
import BarcodeScanner from './BarcodeScanner';
import ProductForm from './ProductForm';
import ProductDetailsModal from './ProductDetailsModal';
import { useToast } from '@/hooks/use-toast';
import { formatEGP } from '@/lib/currency';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import * as XLSX from 'xlsx';
import autoTable from 'jspdf-autotable';
import {
  createMoonPdf,
  drawMoonHeader,
  drawMoonSectionTitle,
  drawMoonStatStrip,
  moonPdfColors,
  moonTableTheme,
} from '@/lib/pdf-theme';

type Props = {
  products: ProductWithCategory[];
  onAddProduct: (product: Omit<ProductWithCategory, 'id' | 'dateAdded' | 'lastUpdated'>) => void;
  onUpdateProduct: (id: string, updates: Partial<ProductWithCategory>) => void;
  onDeleteProduct: (productId: string) => void;
  onAddToProduct: (productId: string, quantity: number) => void;
  onTakeFromProduct: (productId: string, quantity: number) => Promise<boolean>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isReadOnly?: boolean;
  showBarcodeScanner?: boolean;
  userRole?: string;
};

const ProductTable = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddToProduct,
  onTakeFromProduct,
  searchQuery,
  onSearchChange,
  isReadOnly = false,
  showBarcodeScanner = false,
  userRole = 'employee',
}: Props) => {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showOutOfStockOnly, setShowOutOfStockOnly] = useState(false);
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [similarProductTemplate, setSimilarProductTemplate] =
    useState<ProductWithCategory | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    product: ProductWithCategory | null;
  }>({ isOpen: false, product: null });

  const itemsPerPage = 10;

  const handleEdit = (product: ProductWithCategory) => {
    setSelectedProduct(product);
    setSimilarProductTemplate(null);
  };

  const handleDelete = (product: ProductWithCategory) => {
    setDeleteConfirmation({ isOpen: true, product });
  };

  const confirmDelete = () => {
    if (deleteConfirmation.product) {
      try {
        onDeleteProduct(deleteConfirmation.product.id);
        toast({
          title: 'تم حذف المنتج',
          description: `تم حذف ${deleteConfirmation.product.name} بنجاح.`,
        });
      } catch (error) {
        toast({
          title: 'خطأ',
          description: 'مقدرناش نحذف المنتج، حاول تاني.',
          variant: 'destructive',
        });
      }
      setDeleteConfirmation({ isOpen: false, product: null });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, product: null });
  };

  const handleAddSimilar = (product: ProductWithCategory) => {
    setSimilarProductTemplate(product);
    setSelectedProduct(null);
    setIsAddProductOpen(true);
  };

  const handleAddProduct = (
    product: Omit<ProductWithCategory, 'id' | 'dateAdded' | 'lastUpdated'>
  ) => {
    try {
      onAddProduct(product);
      toast({
        title: 'تمت إضافة المنتج',
        description: `تمت إضافة ${product.name} بنجاح.`,
      });
      setIsAddProductOpen(false);
      setSimilarProductTemplate(null);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'مقدرناش نضيف المنتج، حاول تاني.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateProduct = (id: string, updates: Partial<ProductWithCategory>) => {
    try {
      onUpdateProduct(id, updates);
      toast({
        title: 'تم تحديث المنتج',
        description: 'تم تحديث بيانات المنتج بنجاح.',
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'مقدرناش نحدث المنتج، حاول تاني.',
        variant: 'destructive',
      });
    }
  };

  const handleAddToProduct = (productId: string, quantity: number) => {
    try {
      onAddToProduct(productId, quantity);
      const product = products.find((p) => p.id === productId);
      toast({
        title: 'تمت الإضافة للمحل',
        description: `تمت إضافة ${quantity} قطعة لـ ${product?.name || 'المنتج'}.`,
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'مقدرناش نضيف الكمية، حاول تاني.',
        variant: 'destructive',
      });
    }
  };

  const handleTakeFromProduct = async (productId: string, quantity: number) => {
    try {
      const success = await onTakeFromProduct(productId, quantity);
      const product = products.find((p) => p.id === productId);
      if (success) {
        toast({
          title: 'تم الخصم من المحل',
          description: `تم خصم ${quantity} قطعة من ${product?.name || 'المنتج'}.`,
        });
      } else {
        toast({
          title: 'الكمية مش كافية',
          description: 'مقدرش تخصم أكتر من الكمية اللي في المحل.',
          variant: 'destructive',
        });
      }
      return success;
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'مقدرناش نخصم الكمية، حاول تاني.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const handleProductClick = (product: ProductWithCategory) => {
    if (userRole === 'super_admin') {
      setSelectedProduct(product);
      setShowProductDetails(true);
    }
  };

  const handleCloseDetails = () => {
    setShowProductDetails(false);
    setSelectedProduct(null);
  };

  const handleEditFromDetails = (product: ProductWithCategory) => {
    setShowProductDetails(false);
    setSelectedProduct(product);
    setSimilarProductTemplate(null);
  };

  const handleDeleteFromDetails = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      handleDelete(product);
    }
  };

  const generateExcelReport = () => {
    try {
      const reportData = filteredProducts.map((product) => ({
        'اسم المنتج': product.name,
        الباركود: product.barcode,
        القسم: product.category,
        المقاس: product.size || 'غير محدد',
        'السعر (ج.م)': product.price,
        الكمية: product.quantity,
        الحالة: getStockStatus(product.quantity).text,
        'تاريخ الإضافة': product.dateAdded
          ? new Date(product.dateAdded).toLocaleDateString('ar-EG')
          : 'غير معروف',
        'آخر تحديث': product.lastUpdated
          ? new Date(product.lastUpdated).toLocaleDateString('ar-EG')
          : 'غير معروف',
      }));

      const worksheet = XLSX.utils.json_to_sheet(reportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

      const filename = `Moon_Products_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast({
        title: 'تم إنشاء التقرير',
        description: 'تم تنزيل تقرير Excel بنجاح.',
      });
    } catch (error) {
      console.error('Error generating Excel report:', error);
      toast({
        title: 'خطأ',
        description: 'مقدرناش نجهز تقرير Excel، حاول تاني.',
        variant: 'destructive',
      });
    }
  };

  const generatePDFReport = () => {
    try {
      const doc = createMoonPdf();
      const lowStockProducts = filteredProducts.filter((p) => p.quantity < 10 && p.quantity > 0);
      const outOfStockProducts = filteredProducts.filter((p) => p.quantity === 0);
      let y = drawMoonHeader(
        doc,
        'MOON Products Report',
        new Date().toLocaleDateString('en-EG'),
        'Store stock overview'
      );
      y = drawMoonStatStrip(
        doc,
        [
          { label: 'Products', value: String(filteredProducts.length) },
          { label: 'Low Stock', value: String(lowStockProducts.length), tone: 'warn' },
          { label: 'Out of Stock', value: String(outOfStockProducts.length), tone: 'danger' },
        ],
        y
      );
      y = drawMoonSectionTitle(doc, 'Store List', y);

      const tableData = filteredProducts.map((product) => [
        product.name,
        product.barcode,
        product.category,
        product.size || 'N/A',
        formatEGP(product.price),
        product.quantity.toString(),
        getStockStatus(product.quantity).text,
      ]);

      autoTable(doc, {
        ...moonTableTheme,
        head: [['Product', 'Barcode', 'Category', 'Size', 'Price', 'Qty', 'Status']],
        body: tableData,
        startY: y,
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'center' },
          6: { halign: 'center' },
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.row.index >= 0) {
            const product = filteredProducts[data.row.index];
            if (product.quantity === 0) {
              data.cell.styles.fillColor = [254, 242, 242];
              data.cell.styles.textColor = [...moonPdfColors.red];
            } else if (product.quantity < 10) {
              data.cell.styles.fillColor = [255, 247, 237];
              data.cell.styles.textColor = [...moonPdfColors.amber];
            }
          }
        },
      });

      const filename = `Moon_Products_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      toast({
        title: 'تم إنشاء التقرير',
        description: 'تم تنزيل تقرير PDF بنجاح.',
      });
    } catch (error) {
      console.error('Error generating PDF report:', error);
      toast({
        title: 'خطأ',
        description: 'مقدرناش نجهز تقرير PDF، حاول تاني.',
        variant: 'destructive',
      });
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStockFilter = true;

    if (showLowStockOnly && showOutOfStockOnly) {
      matchesStockFilter = product.quantity < 10;
    } else if (showLowStockOnly) {
      matchesStockFilter = product.quantity < 10 && product.quantity > 0;
    } else if (showOutOfStockOnly) {
      matchesStockFilter = product.quantity === 0;
    }

    return matchesSearch && matchesStockFilter;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const displayProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { text: 'خلص من المحل', color: 'bg-red-100 text-red-800' };
    if (quantity < 10) return { text: 'كمية قليلة', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'متوفر', color: 'bg-green-100 text-green-800' };
  };

  const handleBarcodeScanned = (barcode: string) => {
    onSearchChange(barcode);
    setCurrentPage(1);
    toast({
      title: 'اتقرا الباركود',
      description: `بندور على منتج بالباركود: ${barcode}`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-lg font-semibold">المنتجات</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="ابحث بالاسم أو الباركود..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-64"
          />
          <Button
            onClick={() => {
              setShowLowStockOnly(!showLowStockOnly);
              setCurrentPage(1);
            }}
            variant={showLowStockOnly ? 'default' : 'outline'}
            className={`flex items-center gap-2 ${
              showLowStockOnly
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'border-amber-200 text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            كمية قليلة
          </Button>
          <Button
            onClick={() => {
              setShowOutOfStockOnly(!showOutOfStockOnly);
              setCurrentPage(1);
            }}
            variant={showOutOfStockOnly ? 'default' : 'outline'}
            className={`flex items-center gap-2 ${
              showOutOfStockOnly
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'border-red-200 text-red-700 hover:bg-red-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            خلص من المحل
          </Button>
          {showBarcodeScanner && (
            <Button
              onClick={() => setIsScannerOpen(true)}
              variant="outline"
              className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Scan className="h-4 w-4" />
              قراءة الباركود
            </Button>
          )}
          {userRole === 'super_admin' && (
            <>
              <Button
                onClick={generateExcelReport}
                variant="outline"
                className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
              >
                <FileText className="h-4 w-4" />
                تقرير Excel
              </Button>
              <Button
                onClick={generatePDFReport}
                variant="outline"
                className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
              >
                <Download className="h-4 w-4" />
                تقرير PDF
              </Button>
              <Button
                onClick={() => {
                  setIsAddProductOpen(true);
                  setSimilarProductTemplate(null);
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="h-4 w-4" />
                إضافة منتج
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="grid sm:hidden gap-4">
        {displayProducts.map((product) => {
          const stockStatus = getStockStatus(product.quantity);
          return (
            <div
              key={product.id}
              onClick={() => handleProductClick(product)}
              className={`bg-white p-4 rounded-lg shadow hover:shadow-md transition ${
                userRole === 'super_admin' ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div className="flex items-center gap-4">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400 text-xs">مفيش صورة</span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{product.name}</div>
                  <div className="text-sm text-gray-500" dir="ltr">
                    {product.barcode}
                  </div>
                  <div
                    className={`mt-1 inline-block text-xs font-semibold px-2 py-1 rounded-full ${stockStatus.color}`}
                  >
                    {stockStatus.text}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-700">
                <div>
                  <strong>القسم:</strong> {product.category}
                </div>
                <div>
                  <strong>المقاس:</strong> {product.size || 'غير محدد'}
                </div>
                <div>
                  <strong>السعر:</strong> {formatEGP(product.price)}
                </div>
                <div>
                  <strong>الكمية:</strong> {product.quantity}
                </div>
              </div>
              {userRole === 'super_admin' && (
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(product);
                    }}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="تعديل المنتج"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddSimilar(product);
                    }}
                    className="text-green-600 hover:text-green-900"
                    title="إضافة منتج مشابه"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(product);
                    }}
                    className="text-red-600 hover:text-red-900"
                    title="حذف المنتج"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الصورة
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                المنتج
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الباركود
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                القسم
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                المقاس
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                السعر
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الكمية
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                الحالة
              </th>
              {userRole === 'super_admin' && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  إجراءات
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayProducts.map((product) => {
              const stockStatus = getStockStatus(product.quantity);
              return (
                <tr
                  key={product.id}
                  className={`hover:bg-gray-50 ${
                    userRole === 'super_admin' ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  onClick={() => handleProductClick(product)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">مفيش صورة</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap" dir="ltr">
                    {product.barcode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.size || 'غير محدد'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatEGP(product.price)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-1 rounded-full ${stockStatus.color}`}
                    >
                      {stockStatus.text}
                    </span>
                  </td>
                  {userRole === 'super_admin' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(product);
                          }}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="تعديل المنتج"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddSimilar(product);
                          }}
                          className="text-green-600 hover:text-green-900"
                          title="إضافة منتج مشابه"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(product);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="حذف المنتج"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />

      <ProductForm
        isOpen={isAddProductOpen || selectedProduct !== null}
        onClose={() => {
          setIsAddProductOpen(false);
          setSelectedProduct(null);
          setSimilarProductTemplate(null);
        }}
        onSubmit={handleAddProduct}
        product={selectedProduct}
        similarProductTemplate={similarProductTemplate}
        onUpdateProduct={handleUpdateProduct}
        onAddToProduct={handleAddToProduct}
        onTakeFromProduct={handleTakeFromProduct}
      />

      {showProductDetails && selectedProduct && userRole === 'super_admin' && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={handleCloseDetails}
          onAddToProduct={handleAddToProduct}
          onTakeFromProduct={handleTakeFromProduct}
          onEdit={handleEditFromDetails}
          onDelete={handleDeleteFromDetails}
          isReadOnly={false}
        />
      )}

      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={cancelDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>
              متأكد إنك عايز تحذف "{deleteConfirmation.product?.name}"؟ الإجراء ده مش هيرجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductTable;
