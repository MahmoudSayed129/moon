
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckoutResult, Product, HistoryEntry, Sale, ProcessReturnPayload, StockLocation } from '@/types';
import { useAuth } from '@/hooks/useAuth';

export const useInventory = () => {
  const { authState } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from Supabase on mount
  useEffect(() => {
    if (authState.isAuthenticated) {
      loadAllData();
    }
  }, [authState.isAuthenticated]);

  const loadAllData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        loadProducts(),
        loadHistory(),
        loadSales()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories:category (
            name
          ),
          traders:trader_id (
            name
          )
        `)
        .order('date_added', { ascending: false });

      if (error) throw error;

      const mappedProducts: Product[] = data?.map(product => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: product.quantity,
        warehouseQuantity: Number((product as any).warehouse_quantity ?? 0),
        price: Number(product.price),
        category: (product.categories as any)?.name || (product.category ? String(product.category) : 'Uncategorized'),
        categoryId: product.category || undefined,
        trader: (product.traders as any)?.name || undefined,
        traderId: (product as any).trader_id || undefined,
        costPrice: (product as any).cost_price !== null && (product as any).cost_price !== undefined
          ? Number((product as any).cost_price)
          : undefined,
        description: product.description || '',
        size: product.size || '',
        image: product.image || '',
        dateAdded: product.date_added,
        lastUpdated: product.last_updated
      })) || [];

      setProducts(mappedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('history')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (error) throw error;

      const mappedHistory: HistoryEntry[] = data?.map(entry => ({
        id: entry.id,
        productId: entry.product_id,
        productName: entry.product_name,
        barcode: entry.barcode,
        operation: entry.operation as HistoryEntry['operation'],
        location: (((entry as any).location as StockLocation) || 'store'),
        quantity: entry.quantity,
        date: entry.date,
        time: entry.time,
        createdAt: entry.created_at || undefined,
      })) || [];

      setHistory(mappedHistory);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const loadSales = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false });

      if (error) throw error;

      const mappedSales: Sale[] = data?.map(sale => ({
        id: sale.id,
        productId: sale.product_id,
        productName: sale.product_name,
        quantity: sale.quantity,
        unitPrice: Number(sale.unit_price),
        totalAmount: Number(sale.total_amount),
        saleDate: sale.sale_date
      })) || [];

      setSales(mappedSales);
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'dateAdded' | 'lastUpdated'>) => {
    try {
      console.log('=== Starting addProduct ===');
      console.log('Product data:', productData);

      const insertData = {
        name: productData.name,
        barcode: productData.barcode,
        quantity: productData.quantity,
        warehouse_quantity: productData.warehouseQuantity ?? 0,
        price: productData.price,
        category: productData.categoryId ?? productData.category,
        trader_id: productData.traderId || null,
        cost_price: productData.costPrice ?? null,
        description: productData.description || null,
        size: productData.size || null,
        image: productData.image || null
      };

      console.log('Insert data:', insertData);

      const { data, error } = await supabase
        .from('products')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      console.log('Product inserted successfully:', data);

      const newProduct: Product = {
        id: data.id,
        name: data.name,
        barcode: data.barcode,
        quantity: data.quantity,
        warehouseQuantity: Number((data as any).warehouse_quantity ?? 0),
        price: Number(data.price),
        category: data.category ? String(data.category) : 'Uncategorized',
        categoryId: data.category || undefined,
        traderId: (data as any).trader_id || undefined,
        costPrice:
          (data as any).cost_price !== null && (data as any).cost_price !== undefined
            ? Number((data as any).cost_price)
            : undefined,
        description: data.description || '',
        size: data.size || '',
        image: data.image || '',
        dateAdded: data.date_added,
        lastUpdated: data.last_updated
      };

      const [categoryLookup, traderLookup] = await Promise.all([
        data.category
          ? supabase.from('categories').select('name').eq('id', data.category).maybeSingle()
          : Promise.resolve({ data: null as any }),
        (data as any).trader_id
          ? supabase.from('traders').select('name').eq('id', (data as any).trader_id).maybeSingle()
          : Promise.resolve({ data: null as any }),
      ]);

      const hydratedProduct = {
        ...newProduct,
        category: categoryLookup.data?.name || newProduct.category,
        trader: traderLookup.data?.name || undefined,
      };

      setProducts(prev => [hydratedProduct, ...prev]);

      // Log initial stock for whichever side received it. A brand-new product
      // typically lands in the warehouse; some workflows drop it straight on
      // the floor. Either way, only log a row if there's a non-zero amount.
      if (productData.quantity > 0) {
        await addHistoryEntry(newProduct.id, newProduct.name, newProduct.barcode, 'add', productData.quantity, 'store');
      }
      if ((productData.warehouseQuantity ?? 0) > 0) {
        await addHistoryEntry(newProduct.id, newProduct.name, newProduct.barcode, 'add', productData.warehouseQuantity!, 'warehouse');
      }

      console.log('=== Product added successfully ===');
    } catch (error) {
      console.error('=== Error in addProduct ===');
      console.error('Error details:', error);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      // Skip fields the caller didn't supply (e.g. quantity-only nudges from
      // takeFromProduct) so we don't wipe cost_price or trader_id by mistake.
      const patch: Record<string, unknown> = {};
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.barcode !== undefined) patch.barcode = updates.barcode;
      if (updates.quantity !== undefined) patch.quantity = updates.quantity;
      if (updates.warehouseQuantity !== undefined) patch.warehouse_quantity = updates.warehouseQuantity;
      if (updates.price !== undefined) patch.price = updates.price;
      if (updates.categoryId !== undefined || updates.category !== undefined) {
        patch.category = updates.categoryId ?? updates.category;
      }
      if (updates.traderId !== undefined) patch.trader_id = updates.traderId || null;
      if (updates.costPrice !== undefined) patch.cost_price = updates.costPrice ?? null;
      if (updates.description !== undefined) patch.description = updates.description;
      if (updates.size !== undefined) patch.size = updates.size;
      if (updates.image !== undefined) patch.image = updates.image;

      const { error } = await supabase.from('products').update(patch).eq('id', id);
      if (error) throw error;

      const categoryId = updates.categoryId ?? updates.category;
      const [categoryLookup, traderLookup] = await Promise.all([
        categoryId
          ? supabase.from('categories').select('name').eq('id', categoryId).maybeSingle()
          : Promise.resolve({ data: null as any }),
        updates.traderId
          ? supabase.from('traders').select('name').eq('id', updates.traderId).maybeSingle()
          : Promise.resolve({ data: null as any }),
      ]);

      setProducts(prev =>
        prev.map(product =>
          product.id === id
            ? {
                ...product,
                ...updates,
                category: categoryLookup.data?.name || updates.category || product.category,
                categoryId: categoryId || product.categoryId,
                trader: traderLookup.data?.name ?? (updates.traderId ? product.trader : product.trader),
                traderId: updates.traderId !== undefined ? (updates.traderId || undefined) : product.traderId,
                costPrice: updates.costPrice !== undefined ? updates.costPrice : product.costPrice,
                lastUpdated: new Date().toISOString(),
              }
            : product
        )
      );
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.filter(product => product.id !== id));
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  };

  const addToProduct = async (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newQuantity = product.quantity + quantity;
      await updateProduct(productId, { quantity: newQuantity });
      await addHistoryEntry(productId, product.name, product.barcode, 'add', quantity);
    }
  };

  const takeFromProduct = async (productId: string, quantity: number): Promise<boolean> => {
    const product = products.find(p => p.id === productId);
    if (product && product.quantity >= quantity) {
      const newQuantity = product.quantity - quantity;
      await updateProduct(productId, { quantity: newQuantity });
      await addHistoryEntry(productId, product.name, product.barcode, 'remove', quantity);
      return true;
    }
    return false;
  };

  const addHistoryEntry = async (
    productId: string,
    productName: string,
    barcode: string,
    operation: HistoryEntry['operation'],
    quantity: number,
    location: StockLocation = 'store'
  ) => {
    try {
      const now = new Date();
      const { data, error } = await supabase
        .from('history')
        .insert({
          product_id: productId,
          product_name: productName,
          barcode: barcode,
          operation: operation,
          location,
          quantity: quantity,
          date: now.toISOString().split('T')[0],
          time: now.toLocaleTimeString()
        })
        .select()
        .single();

      if (error) throw error;

      const newEntry: HistoryEntry = {
        id: data.id,
        productId: data.product_id,
        productName: data.product_name,
        barcode: data.barcode,
        operation: data.operation as HistoryEntry['operation'],
        location: ((data as any).location as StockLocation) || location,
        quantity: data.quantity,
        date: data.date,
        time: data.time,
        createdAt: data.created_at || undefined,
      };

      setHistory(prev => [newEntry, ...prev]);
    } catch (error) {
      console.error('Error adding history entry:', error);
    }
  };

  // ---- Warehouse (back-of-store) operations -------------------------------
  // The store floor keeps its existing addToProduct/takeFromProduct/checkout
  // flow. These three sit alongside them and only touch warehouse stock.
  const addToWarehouse = async (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const nextWarehouse = product.warehouseQuantity + quantity;
    await updateProduct(productId, { warehouseQuantity: nextWarehouse });
    await addHistoryEntry(productId, product.name, product.barcode, 'add', quantity, 'warehouse');
  };

  const takeFromWarehouse = async (productId: string, quantity: number): Promise<boolean> => {
    const product = products.find(p => p.id === productId);
    if (!product || product.warehouseQuantity < quantity) return false;
    const nextWarehouse = product.warehouseQuantity - quantity;
    await updateProduct(productId, { warehouseQuantity: nextWarehouse });
    await addHistoryEntry(productId, product.name, product.barcode, 'remove', quantity, 'warehouse');
    return true;
  };

  const moveToStore = async (productId: string, quantity: number): Promise<boolean> => {
    const product = products.find(p => p.id === productId);
    if (!product || product.warehouseQuantity < quantity || quantity <= 0) return false;

    // Non-atomic on the DB side, but this is a single-store admin action —
    // we accept the small window and log two history rows so both filters
    // catch the movement.
    await updateProduct(productId, {
      warehouseQuantity: product.warehouseQuantity - quantity,
      quantity: product.quantity + quantity,
    });
    await addHistoryEntry(productId, product.name, product.barcode, 'remove', quantity, 'warehouse');
    await addHistoryEntry(productId, product.name, product.barcode, 'add', quantity, 'store');
    return true;
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

    if (payload.items.length === 0) {
      throw new Error('ضيف قطعة واحدة على الأقل للفاتورة');
    }

    const cartProducts = payload.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) {
        throw new Error('واحد من المنتجات المختارة مش موجود');
      }
      if (item.quantity <= 0) {
        throw new Error(`الكمية لـ ${product.name} لازم تكون أكبر من صفر`);
      }
      if (product.quantity < item.quantity) {
        throw new Error(`الكمية المتوفرة من ${product.name} مش كافية`);
      }
      return { product, quantity: item.quantity };
    });

    let commissionUser: {
      id: string;
      username: string;
      employee_code: string | null;
      commission_rate: number;
    } | null = null;

    if (payload.employeeCode?.trim()) {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, employee_code, commission_rate')
        .eq('employee_code', payload.employeeCode.trim())
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('كود الموظف مش موجود');
      }
      commissionUser = {
        id: data[0].id,
        username: data[0].username,
        employee_code: data[0].employee_code,
        commission_rate: Number(data[0].commission_rate || 0),
      };
    }

    const subtotal = cartProducts.reduce(
      (sum, item) => sum + (item.product.price * item.quantity),
      0
    );
    // Discount comes from offers built on the client. Cap at subtotal so an
    // over-eager cashier can't send a negative total to the DB.
    const discountAmount = Math.min(
      subtotal,
      Math.max(0, Number(payload.discountAmount || 0))
    );
    const netTotal = subtotal - discountAmount;
    // Commission still calculated on the pre-discount subtotal so the sales
    // person isn't penalized for offers the store chose to run.
    const commissionRate = commissionUser?.commission_rate || 0;
    const commissionAmount = subtotal * (commissionRate / 100);
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;

    const { data: insertedOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        invoice_number: invoiceNumber,
        client_id: payload.clientId || null,
        employee_id: commissionUser?.id || null,
        employee_code: commissionUser?.employee_code || payload.employeeCode?.trim() || null,
        sold_by_auth_id: null,
        subtotal,
        discount_amount: discountAmount,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        returned_subtotal: 0,
        returned_commission_amount: 0,
        returned_total_amount: 0,
        net_subtotal: netTotal,
        net_commission_amount: commissionAmount,
        net_total_amount: netTotal,
        has_return: false,
        return_count: 0,
        return_status: 'none',
        total_amount: netTotal,
        notes: payload.notes?.trim() || null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItemsPayload = cartProducts.map(({ product, quantity }) => ({
      order_id: insertedOrder.id,
      product_id: product.id,
      product_name: product.name,
      product_barcode: product.barcode,
      quantity,
      unit_price: product.price,
      line_total: product.price * quantity,
    }));

    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload)
      .select();

    if (orderItemsError) throw orderItemsError;

    for (const { product, quantity } of cartProducts) {
      const newQuantity = product.quantity - quantity;
      await updateProduct(product.id, { quantity: newQuantity });

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: product.price,
          total_amount: product.price * quantity,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      setSales((prev) => [{
        id: saleData.id,
        productId: saleData.product_id,
        productName: saleData.product_name,
        quantity: saleData.quantity,
        unitPrice: Number(saleData.unit_price),
        totalAmount: Number(saleData.total_amount),
        saleDate: saleData.sale_date,
      }, ...prev]);

      await addHistoryEntry(product.id, product.name, product.barcode, 'take', quantity);
    }

    return {
      order: {
        id: insertedOrder.id,
        invoiceNumber: insertedOrder.invoice_number,
        clientId: insertedOrder.client_id || undefined,
        employeeId: insertedOrder.employee_id || undefined,
        employeeCode: insertedOrder.employee_code || undefined,
        soldByAuthId: insertedOrder.sold_by_auth_id || undefined,
        subtotal: Number(insertedOrder.subtotal),
        discountAmount: Number((insertedOrder as any).discount_amount || 0),
        commissionRate: Number(insertedOrder.commission_rate || 0),
        commissionAmount: Number(insertedOrder.commission_amount || 0),
        totalAmount: Number(insertedOrder.total_amount),
        notes: insertedOrder.notes || '',
        createdAt: insertedOrder.created_at,
        items: (orderItems || []).map((item) => ({
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
      employee: commissionUser ? {
        id: commissionUser.id,
        username: commissionUser.username,
        employeeCode: commissionUser.employee_code || undefined,
        commissionRate: commissionUser.commission_rate,
      } : null,
      client: null,
    };
  };

  const processReturn = async (payload: ProcessReturnPayload) => {
    const sanitizedItems = payload.items
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        order_item_id: item.orderItemId,
        quantity: item.quantity,
      }));

    if (sanitizedItems.length === 0) {
      throw new Error('اختار قطعة واحدة على الأقل علشان ترجعها');
    }

    const { error } = await supabase.rpc('process_order_return', {
      p_order_id: payload.orderId,
      p_items: sanitizedItems,
      p_reason: payload.reason?.trim() || null,
    });

    if (error) {
      throw new Error(error.message || 'حصلت مشكلة أثناء تسجيل المرتجع');
    }

    await loadAllData();
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
