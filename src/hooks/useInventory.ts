import { useState, useEffect } from 'react';
import { HistoryRow, ProductRow, SaleRow, Tables, mutate, newId, select } from '@/lib/local-db';
import { addHistoryRow, checkoutOrder, processOrderReturn } from '@/lib/store-operations';
import { CheckoutResult, Product, HistoryEntry, Sale, ProcessReturnPayload, StockLocation } from '@/types';
import { useAuth } from '@/hooks/useAuth';

const mapProduct = (
  product: ProductRow,
  categoryNames: Map<string, string>,
  traderNames: Map<string, string>
): Product => ({
  id: product.id,
  name: product.name,
  barcode: product.barcode,
  quantity: product.quantity,
  warehouseQuantity: Number(product.warehouse_quantity ?? 0),
  price: Number(product.price),
  category: (product.category && categoryNames.get(product.category)) || 'Uncategorized',
  categoryId: product.category || undefined,
  trader: (product.trader_id && traderNames.get(product.trader_id)) || undefined,
  traderId: product.trader_id || undefined,
  costPrice: product.cost_price !== null && product.cost_price !== undefined
    ? Number(product.cost_price)
    : undefined,
  description: product.description || '',
  size: product.size || '',
  image: product.image || '',
  dateAdded: product.date_added,
  lastUpdated: product.last_updated
});

const mapHistory = (entry: HistoryRow): HistoryEntry => ({
  id: entry.id,
  productId: entry.product_id || '',
  productName: entry.product_name,
  barcode: entry.barcode,
  operation: entry.operation,
  location: entry.location || 'store',
  quantity: entry.quantity,
  date: entry.date,
  time: entry.time,
  createdAt: entry.created_at || undefined,
});

const mapSale = (sale: SaleRow): Sale => ({
  id: sale.id,
  productId: sale.product_id || '',
  productName: sale.product_name,
  quantity: sale.quantity,
  unitPrice: Number(sale.unit_price),
  totalAmount: Number(sale.total_amount),
  saleDate: sale.sale_date
});

const findProduct = (tables: Tables, id: string) => {
  const product = tables.products.find((entry) => entry.id === id);
  if (!product) throw new Error('المنتج مش موجود');
  return product;
};

const assertUniqueBarcode = (tables: Tables, barcode: string, ignoreId?: string) => {
  if (tables.products.some((product) => product.barcode === barcode && product.id !== ignoreId)) {
    throw new Error('الباركود ده مستخدم لمنتج تاني');
  }
};

export const useInventory = () => {
  const { authState } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from the local store once logged in
  useEffect(() => {
    if (authState.isAuthenticated) {
      loadAllData();
    }
  }, [authState.isAuthenticated]);

  // Re-read every table this hook exposes. Local reads are instant, so writes
  // just call this instead of patching React state by hand.
  const syncFromStore = () => {
    const categoryNames = new Map(select('categories').map((row) => [row.id, row.name]));
    const traderNames = new Map(select('traders').map((row) => [row.id, row.name]));

    setProducts(
      select('products')
        .sort((a, b) => b.date_added.localeCompare(a.date_added))
        .map((product) => mapProduct(product, categoryNames, traderNames))
    );
    setHistory(
      select('history')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(mapHistory)
    );
    setSales(
      select('sales')
        .sort((a, b) => b.sale_date.localeCompare(a.sale_date))
        .map(mapSale)
    );
  };

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      syncFromStore();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'dateAdded' | 'lastUpdated'>) => {
    try {
      mutate((tables) => {
        assertUniqueBarcode(tables, productData.barcode);

        const now = new Date();
        const row: ProductRow = {
          id: newId(),
          name: productData.name,
          barcode: productData.barcode,
          quantity: productData.quantity,
          warehouse_quantity: productData.warehouseQuantity ?? 0,
          price: productData.price,
          category: productData.categoryId ?? (productData.category || null),
          trader_id: productData.traderId || null,
          cost_price: productData.costPrice ?? null,
          description: productData.description || null,
          size: productData.size || null,
          image: productData.image || null,
          date_added: now.toISOString(),
          last_updated: now.toISOString(),
        };
        tables.products.push(row);

        // Log initial stock for whichever side received it. A brand-new product
        // typically lands in the warehouse; some workflows drop it straight on
        // the floor. Either way, only log a row if there's a non-zero amount.
        const base = { product_id: row.id, product_name: row.name, barcode: row.barcode };
        if (productData.quantity > 0) {
          addHistoryRow(tables, { ...base, operation: 'add', quantity: productData.quantity, location: 'store' }, now);
        }
        if ((productData.warehouseQuantity ?? 0) > 0) {
          addHistoryRow(tables, { ...base, operation: 'add', quantity: productData.warehouseQuantity!, location: 'warehouse' }, now);
        }
      });

      syncFromStore();
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      // Skip fields the caller didn't supply (e.g. quantity-only nudges from
      // takeFromProduct) so we don't wipe cost_price or trader_id by mistake.
      mutate((tables) => {
        const product = findProduct(tables, id);
        if (updates.barcode !== undefined) {
          assertUniqueBarcode(tables, updates.barcode, id);
          product.barcode = updates.barcode;
        }
        if (updates.name !== undefined) product.name = updates.name;
        if (updates.quantity !== undefined) product.quantity = updates.quantity;
        if (updates.warehouseQuantity !== undefined) product.warehouse_quantity = updates.warehouseQuantity;
        if (updates.price !== undefined) product.price = updates.price;
        if (updates.categoryId !== undefined || updates.category !== undefined) {
          product.category = updates.categoryId ?? (updates.category || null);
        }
        if (updates.traderId !== undefined) product.trader_id = updates.traderId || null;
        if (updates.costPrice !== undefined) product.cost_price = updates.costPrice ?? null;
        if (updates.description !== undefined) product.description = updates.description;
        if (updates.size !== undefined) product.size = updates.size;
        if (updates.image !== undefined) product.image = updates.image;
        product.last_updated = new Date().toISOString();
      });

      syncFromStore();
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      mutate((tables) => {
        tables.products = tables.products.filter((product) => product.id !== id);
        // Same as the old foreign keys: stock history and sales go with the
        // product, invoices keep their lines but lose the product link.
        tables.history = tables.history.filter((entry) => entry.product_id !== id);
        tables.sales = tables.sales.filter((sale) => sale.product_id !== id);
        tables.order_items.forEach((item) => {
          if (item.product_id === id) item.product_id = null;
        });
        tables.order_return_items.forEach((item) => {
          if (item.product_id === id) item.product_id = null;
        });
      });

      syncFromStore();
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  };

  // Adjust one side's stock and log the movement in a single write.
  const moveStock = (
    productId: string,
    quantity: number,
    location: StockLocation,
    operation: 'add' | 'remove'
  ): boolean => {
    const moved = mutate((tables) => {
      const product = findProduct(tables, productId);
      const field = location === 'warehouse' ? 'warehouse_quantity' : 'quantity';
      if (operation === 'remove' && product[field] < quantity) return false;

      product[field] += operation === 'add' ? quantity : -quantity;
      product.last_updated = new Date().toISOString();
      addHistoryRow(tables, {
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode,
        operation,
        quantity,
        location,
      });
      return true;
    });

    syncFromStore();
    return moved;
  };

  const addToProduct = async (productId: string, quantity: number) => {
    moveStock(productId, quantity, 'store', 'add');
  };

  const takeFromProduct = async (productId: string, quantity: number): Promise<boolean> =>
    moveStock(productId, quantity, 'store', 'remove');

  // ---- Warehouse (back-of-store) operations -------------------------------
  // The store floor keeps its existing addToProduct/takeFromProduct/checkout
  // flow. These three sit alongside them and only touch warehouse stock.
  const addToWarehouse = async (productId: string, quantity: number) => {
    moveStock(productId, quantity, 'warehouse', 'add');
  };

  const takeFromWarehouse = async (productId: string, quantity: number): Promise<boolean> =>
    moveStock(productId, quantity, 'warehouse', 'remove');

  const moveToStore = async (productId: string, quantity: number): Promise<boolean> => {
    if (quantity <= 0) return false;

    const moved = mutate((tables) => {
      const product = findProduct(tables, productId);
      if (product.warehouse_quantity < quantity) return false;

      product.warehouse_quantity -= quantity;
      product.quantity += quantity;
      product.last_updated = new Date().toISOString();

      // Two history rows so both the store and warehouse filters catch it.
      const base = { product_id: product.id, product_name: product.name, barcode: product.barcode };
      addHistoryRow(tables, { ...base, operation: 'remove', quantity, location: 'warehouse' });
      addHistoryRow(tables, { ...base, operation: 'add', quantity, location: 'store' });
      return true;
    });

    syncFromStore();
    return moved;
  };

  const completeCheckout = async (payload: {
    items: Array<{ productId: string; quantity: number }>;
    clientId?: string;
    employeeCode?: string;
    notes?: string;
    discountAmount?: number;
  }): Promise<CheckoutResult> => {
    if (!authState.user) {
      throw new Error('لازم تسجل الدخول علشان تكمل عملية البيع');
    }

    const { order, items, employee } = mutate((tables) => checkoutOrder(tables, payload));
    syncFromStore();

    return {
      order: {
        id: order.id,
        invoiceNumber: order.invoice_number,
        clientId: order.client_id || undefined,
        employeeId: order.employee_id || undefined,
        employeeCode: order.employee_code || undefined,
        soldByAuthId: order.sold_by_auth_id || undefined,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discount_amount || 0),
        commissionRate: Number(order.commission_rate || 0),
        commissionAmount: Number(order.commission_amount || 0),
        totalAmount: Number(order.total_amount),
        notes: order.notes || '',
        createdAt: order.created_at,
        items: items.map((item) => ({
          id: item.id,
          orderId: item.order_id,
          productId: item.product_id || undefined,
          productName: item.product_name,
          productBarcode: item.product_barcode,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          lineTotal: Number(item.line_total),
          createdAt: item.created_at,
        })),
      },
      employee: employee ? {
        id: employee.id,
        username: employee.username,
        employeeCode: employee.employee_code || undefined,
        commissionRate: Number(employee.commission_rate || 0),
      } : null,
      client: null,
    };
  };

  const processReturn = async (payload: ProcessReturnPayload) => {
    if (!authState.user) {
      throw new Error('لازم تسجل الدخول علشان تسجل مرتجع');
    }

    const sanitizedItems = payload.items.filter((item) => item.quantity > 0);

    if (sanitizedItems.length === 0) {
      throw new Error('اختار قطعة واحدة على الأقل علشان ترجعها');
    }

    const actor = { id: authState.user.id, role: authState.user.role };
    mutate((tables) =>
      processOrderReturn(tables, {
        orderId: payload.orderId,
        items: sanitizedItems,
        reason: payload.reason,
        actor,
      })
    );

    syncFromStore();
  };

  return {
    products,
    history,
    sales,
    isLoading,
    addProduct,
    updateProduct,
    deleteProduct,
    addToProduct,
    takeFromProduct,
    addToWarehouse,
    takeFromWarehouse,
    moveToStore,
    completeCheckout,
    processReturn,
    refreshData: loadAllData
  };
};
