import { useCallback, useEffect, useState } from 'react';
import { byNewest, isInMonth, select, withOrderRelations } from '@/lib/local-db';
import { useAuth } from './useAuth';
import { resolveOrderFinancials } from '@/lib/order-financials';

export interface CheckoutHistoryOrder {
  id: string;
  invoiceNumber: string;
  clientName: string;
  employeeName: string;
  employeeCode?: string;
  subtotal: number;
  discountAmount: number;
  commissionRate: number;
  commissionAmount: number;
  totalAmount: number;
  returnedSubtotal: number;
  returnedCommissionAmount: number;
  returnedTotalAmount: number;
  netSubtotal: number;
  netCommissionAmount: number;
  netTotalAmount: number;
  hasReturn: boolean;
  returnCount: number;
  lastReturnedAt?: string;
  returnStatus: 'none' | 'partial' | 'full';
  notes?: string;
  createdAt: string;
  items: Array<{
    id: string;
    orderItemId: string;
    productName: string;
    productBarcode: string;
    quantity: number;
    returnedQuantity: number;
    returnableQuantity: number;
    unitPrice: number;
    lineTotal: number;
    traderId?: string;
    traderName?: string;
    costPrice?: number;
  }>;
  returns: Array<{
    id: string;
    reason?: string;
    subtotalReturned: number;
    commissionReturned: number;
    totalReturned: number;
    createdAt: string;
    items: Array<{
      id: string;
      orderItemId: string;
      productName: string;
      productBarcode: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }>;
}

const mapOrder = (row: any): CheckoutHistoryOrder => {
  const financials = resolveOrderFinancials(row);

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientName: row.clients?.name || 'Walk-in Client',
    employeeName: row.users?.username || 'No employee',
    employeeCode: row.employee_code || undefined,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount || 0),
    commissionRate: Number(row.commission_rate || 0),
    commissionAmount: Number(row.commission_amount || 0),
    totalAmount: Number(row.total_amount),
    returnedSubtotal: Number(row.returned_subtotal || 0),
    returnedCommissionAmount: Number(row.returned_commission_amount || 0),
    returnedTotalAmount: Number(row.returned_total_amount || 0),
    netSubtotal: financials.netSubtotal,
    netCommissionAmount: financials.netCommissionAmount,
    netTotalAmount: financials.netTotalAmount,
    hasReturn: Boolean(row.has_return),
    returnCount: Number(row.return_count || 0),
    lastReturnedAt: row.last_returned_at || undefined,
    returnStatus: (row.return_status || 'none') as 'none' | 'partial' | 'full',
    notes: row.notes || '',
    createdAt: row.created_at,
    items: (row.order_items || []).map((item: any) => {
      const product = item.products || {};
      const cost = product.cost_price;
      return {
        id: item.id,
        orderItemId: item.id,
        productName: item.product_name,
        productBarcode: item.product_barcode,
        quantity: item.quantity,
        returnedQuantity: Number(item.returned_quantity || 0),
        returnableQuantity: Math.max(
          0,
          Number(item.quantity || 0) - Number(item.returned_quantity || 0)
        ),
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
        traderId: product.trader_id || undefined,
        traderName: product.traders?.name || undefined,
        costPrice: cost !== null && cost !== undefined ? Number(cost) : undefined,
      };
    }),
    returns: (row.order_returns || []).map((returnRow: any) => ({
      id: returnRow.id,
      reason: returnRow.reason || '',
      subtotalReturned: Number(returnRow.subtotal_returned || 0),
      commissionReturned: Number(returnRow.commission_returned || 0),
      totalReturned: Number(returnRow.total_returned || 0),
      createdAt: returnRow.created_at,
      items: (returnRow.order_return_items || []).map((returnItem: any) => ({
        id: returnItem.id,
        orderItemId: returnItem.order_item_id,
        productName: returnItem.product_name,
        productBarcode: returnItem.product_barcode,
        quantity: Number(returnItem.quantity || 0),
        unitPrice: Number(returnItem.unit_price || 0),
        lineTotal: Number(returnItem.line_total || 0),
      })),
    })),
  };
};

export const useCheckoutHistory = (month: string) => {
  const { authState } = useAuth();
  const [orders, setOrders] = useState<CheckoutHistoryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!month) return;

    try {
      setIsLoading(true);
      const data = withOrderRelations(
        select('orders')
          .filter((order) => isInMonth(order.created_at, month))
          .sort(byNewest)
      );
      setOrders(data.map(mapOrder));
    } catch (error) {
      console.error('Error loading checkout history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (authState.isAuthenticated) {
      loadOrders();
    }
  }, [authState.isAuthenticated, loadOrders]);

  return {
    orders,
    isLoading,
    refreshOrders: loadOrders,
  };
};
