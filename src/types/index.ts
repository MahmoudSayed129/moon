export type StockLocation = 'store' | 'warehouse';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  warehouseQuantity: number;
  price: number;
  category: string;
  categoryId?: string;
  trader?: string;
  traderId?: string;
  costPrice?: number;
  description?: string;
  image?: string; // base64 encoded image
  size?: string;
  dateAdded: string;
  lastUpdated: string;
}

export interface Trader {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type HistoryOperation = 'add' | 'take' | 'remove' | 'return';

// Add ProductWithCategory as an alias for Product since they're the same
export type ProductWithCategory = Product;

export interface HistoryEntry {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  operation: HistoryOperation;
  location: StockLocation;
  quantity: number;
  date: string;
  time: string;
  createdAt?: string;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  saleDate: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  hasReturns?: boolean;
  returnsCount?: number;
  lastReturnedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  returnedQuantity?: number;
  returnableQuantity?: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
}

export interface OrderReturnItem {
  id: string;
  returnId: string;
  orderItemId: string;
  productId?: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
}

export interface OrderReturnRecord {
  id: string;
  orderId: string;
  clientId?: string;
  processedByAuthId?: string;
  reason?: string;
  subtotalReturned: number;
  commissionReturned: number;
  totalReturned: number;
  createdAt: string;
  items: OrderReturnItem[];
}

export interface Order {
  id: string;
  invoiceNumber: string;
  clientId?: string;
  employeeId?: string;
  employeeCode?: string;
  soldByAuthId?: string;
  subtotal: number;
  discountAmount?: number;
  commissionRate: number;
  commissionAmount: number;
  totalAmount: number;
  returnedSubtotal?: number;
  returnedCommissionAmount?: number;
  returnedTotalAmount?: number;
  netSubtotal?: number;
  netCommissionAmount?: number;
  netTotalAmount?: number;
  hasReturn?: boolean;
  returnCount?: number;
  lastReturnedAt?: string;
  returnStatus?: 'none' | 'partial' | 'full';
  notes?: string;
  createdAt: string;
  items: OrderItem[];
  returns?: OrderReturnRecord[];
}

export interface CheckoutCartItem {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
  availableQuantity: number;
  unitPrice: number;
}

export interface CheckoutResult {
  order: Order;
  client?: Client | null;
  employee?: {
    id: string;
    username: string;
    employeeCode?: string;
    commissionRate: number;
  } | null;
}

export interface ProcessReturnPayload {
  orderId: string;
  items: Array<{
    orderItemId: string;
    quantity: number;
  }>;
  reason?: string;
}
