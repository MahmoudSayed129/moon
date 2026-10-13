// Multi-table store operations that used to run inside the database
// (checkout inserts + the process_order_return RPC). They work on a draft of
// the local tables, so call them inside `mutate()`.

import {
  HistoryRow,
  OrderItemRow,
  OrderRow,
  ReturnStatus,
  Tables,
  UserRole,
  UserRow,
  newId,
  round2,
  toLocalDate,
  toLocalTime,
} from './local-db';

export const RETURN_WINDOW_DAYS = 14;

export const addHistoryRow = (
  tables: Tables,
  entry: Pick<HistoryRow, 'product_id' | 'product_name' | 'barcode' | 'operation' | 'quantity'> &
    Partial<Pick<HistoryRow, 'location'>>,
  at: Date = new Date()
): HistoryRow => {
  const row: HistoryRow = {
    id: newId(),
    location: 'store',
    ...entry,
    date: toLocalDate(at),
    time: toLocalTime(at),
    created_at: at.toISOString(),
  };
  tables.history.push(row);
  return row;
};

const buildInvoiceNumber = (tables: Tables, at: Date) => {
  const datePart = toLocalDate(at).replace(/-/g, '');
  let sequence = 1000 + tables.orders.length + 1;
  let invoiceNumber = '';
  do {
    invoiceNumber = `INV-${datePart}-${String(sequence).padStart(6, '0')}`;
    sequence += 1;
  } while (tables.orders.some((order) => order.invoice_number === invoiceNumber));
  return invoiceNumber;
};

export interface CheckoutInput {
  items: Array<{ productId: string; quantity: number }>;
  clientId?: string | null;
  employeeCode?: string;
  notes?: string;
  discountAmount?: number;
}

export interface CheckoutOutput {
  order: OrderRow;
  items: OrderItemRow[];
  employee: UserRow | null;
}

export const checkoutOrder = (
  tables: Tables,
  payload: CheckoutInput,
  at: Date = new Date()
): CheckoutOutput => {
  if (payload.items.length === 0) {
    throw new Error('ضيف قطعة واحدة على الأقل للفاتورة');
  }

  const cartProducts = payload.items.map((item) => {
    const product = tables.products.find((entry) => entry.id === item.productId);
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

  const employeeCode = payload.employeeCode?.trim() || '';
  let employee: UserRow | null = null;
  if (employeeCode) {
    employee = tables.users.find((user) => user.employee_code === employeeCode) || null;
    if (!employee) {
      throw new Error('كود الموظف مش موجود');
    }
  }

  const subtotal = round2(
    cartProducts.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );
  // Discount comes from offers built on the client. Cap at subtotal so an
  // over-eager cashier can't produce a negative total.
  const discountAmount = round2(
    Math.min(subtotal, Math.max(0, Number(payload.discountAmount || 0)))
  );
  const netTotal = round2(subtotal - discountAmount);
  // Commission is calculated on the pre-discount subtotal so the sales person
  // isn't penalized for offers the store chose to run.
  const commissionRate = Number(employee?.commission_rate || 0);
  const commissionAmount = round2(subtotal * (commissionRate / 100));
  const createdAt = at.toISOString();

  const order: OrderRow = {
    id: newId(),
    invoice_number: buildInvoiceNumber(tables, at),
    client_id: payload.clientId || null,
    employee_id: employee?.id || null,
    employee_code: employee?.employee_code || employeeCode || null,
    sold_by_auth_id: null,
    subtotal,
    discount_amount: discountAmount,
    commission_rate: commissionRate,
    commission_amount: commissionAmount,
    total_amount: netTotal,
    returned_subtotal: 0,
    returned_commission_amount: 0,
    returned_total_amount: 0,
    net_subtotal: netTotal,
    net_commission_amount: commissionAmount,
    net_total_amount: netTotal,
    has_return: false,
    return_count: 0,
    last_returned_at: null,
    return_status: 'none',
    notes: payload.notes?.trim() || null,
    created_at: createdAt,
  };
  tables.orders.push(order);

  const items = cartProducts.map(({ product, quantity }) => {
    const item: OrderItemRow = {
      id: newId(),
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      product_barcode: product.barcode,
      quantity,
      returned_quantity: 0,
      unit_price: product.price,
      line_total: round2(product.price * quantity),
      created_at: createdAt,
    };
    tables.order_items.push(item);

    product.quantity -= quantity;
    product.last_updated = createdAt;

    tables.sales.push({
      id: newId(),
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: product.price,
      total_amount: item.line_total,
      sale_date: createdAt,
    });

    addHistoryRow(
      tables,
      {
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode,
        operation: 'take',
        quantity,
      },
      at
    );

    return item;
  });

  return { order, items, employee };
};

export interface ReturnInput {
  orderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  reason?: string | null;
  actor: { id: string; role: UserRole };
}

export const processOrderReturn = (
  tables: Tables,
  payload: ReturnInput,
  at: Date = new Date()
) => {
  if (payload.actor.role !== 'super_admin' && payload.actor.role !== 'supervisor') {
    throw new Error('المدير أو المشرف بس هو اللي يقدر يسجل مرتجع');
  }

  if (payload.items.length === 0) {
    throw new Error('اختار قطعة واحدة على الأقل علشان ترجعها');
  }

  const order = tables.orders.find((entry) => entry.id === payload.orderId);
  if (!order) {
    throw new Error('الفاتورة مش موجودة');
  }

  const windowStart = at.getTime() - RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (new Date(order.created_at).getTime() < windowStart) {
    throw new Error(`مدة استرجاع الفاتورة (${RETURN_WINDOW_DAYS} يوم) خلصت`);
  }

  const createdAt = at.toISOString();
  const returnId = newId();
  let subtotalReturned = 0;

  for (const requested of payload.items) {
    if (requested.quantity <= 0) {
      throw new Error('كمية المرتجع لازم تكون أكبر من صفر');
    }

    const orderItem = tables.order_items.find(
      (entry) => entry.id === requested.orderItemId && entry.order_id === order.id
    );
    if (!orderItem) {
      throw new Error('واحد من أصناف الفاتورة مش موجود');
    }

    const available = orderItem.quantity - (orderItem.returned_quantity || 0);
    if (requested.quantity > available) {
      throw new Error(`كمية المرتجع أكبر من المتاح للاسترجاع من ${orderItem.product_name}`);
    }

    orderItem.returned_quantity += requested.quantity;

    const product = orderItem.product_id
      ? tables.products.find((entry) => entry.id === orderItem.product_id)
      : undefined;
    if (product) {
      product.quantity += requested.quantity;
      product.last_updated = createdAt;
    }

    const lineTotal = round2(orderItem.unit_price * requested.quantity);
    subtotalReturned += lineTotal;

    tables.order_return_items.push({
      id: newId(),
      return_id: returnId,
      order_item_id: orderItem.id,
      product_id: orderItem.product_id,
      product_name: orderItem.product_name,
      product_barcode: orderItem.product_barcode,
      quantity: requested.quantity,
      unit_price: orderItem.unit_price,
      line_total: lineTotal,
      created_at: createdAt,
    });

    addHistoryRow(
      tables,
      {
        product_id: orderItem.product_id,
        product_name: orderItem.product_name,
        barcode: orderItem.product_barcode,
        operation: 'return',
        quantity: requested.quantity,
      },
      at
    );

    tables.sales.push({
      id: newId(),
      product_id: orderItem.product_id,
      product_name: orderItem.product_name,
      quantity: -requested.quantity,
      unit_price: orderItem.unit_price,
      total_amount: -lineTotal,
      sale_date: createdAt,
    });
  }

  subtotalReturned = round2(subtotalReturned);
  const commissionReturned = round2(subtotalReturned * (order.commission_rate / 100));
  const totalReturned = subtotalReturned;

  tables.order_returns.push({
    id: returnId,
    order_id: order.id,
    client_id: order.client_id,
    processed_by_auth_id: payload.actor.id,
    reason: payload.reason?.trim() || null,
    subtotal_returned: subtotalReturned,
    commission_returned: commissionReturned,
    total_returned: totalReturned,
    created_at: createdAt,
  });

  const returnStatus: ReturnStatus = tables.order_items.some(
    (item) => item.order_id === order.id && (item.returned_quantity || 0) < item.quantity
  )
    ? 'partial'
    : 'full';

  order.returned_subtotal = round2(order.returned_subtotal + subtotalReturned);
  order.returned_commission_amount = round2(order.returned_commission_amount + commissionReturned);
  order.returned_total_amount = round2(order.returned_total_amount + totalReturned);
  order.net_subtotal = round2(order.subtotal - order.returned_subtotal);
  order.net_commission_amount = round2(order.commission_amount - order.returned_commission_amount);
  order.net_total_amount = round2(order.total_amount - order.returned_total_amount);
  order.has_return = true;
  order.return_count += 1;
  order.last_returned_at = createdAt;
  order.return_status = returnStatus;

  if (order.client_id) {
    const client = tables.clients.find((entry) => entry.id === order.client_id);
    if (client) {
      client.has_returns = true;
      client.returns_count += 1;
      client.last_returned_at = createdAt;
    }
  }

  return {
    returnId,
    subtotalReturned,
    commissionReturned,
    totalReturned,
    returnStatus,
  };
};
