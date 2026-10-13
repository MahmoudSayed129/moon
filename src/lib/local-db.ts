// Local, in-browser replacement for the old Supabase database.
// Every table lives in one JSON document in localStorage, so the app runs
// fully offline as a demo. Rows keep the old snake_case column names, which
// lets the hooks map them exactly as they did before.

export type UserRole = 'super_admin' | 'supervisor' | 'employee';
export type ReturnStatus = 'none' | 'partial' | 'full';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  employee_code: string | null;
  commission_rate: number;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TraderRow {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  warehouse_quantity: number;
  price: number;
  category: string | null;
  trader_id: string | null;
  cost_price: number | null;
  description: string | null;
  size: string | null;
  image: string | null;
  date_added: string;
  last_updated: string;
}

export interface HistoryRow {
  id: string;
  product_id: string | null;
  product_name: string;
  barcode: string;
  operation: 'add' | 'take' | 'remove' | 'return';
  location: 'store' | 'warehouse';
  quantity: number;
  date: string;
  time: string;
  created_at: string;
}

export interface SaleRow {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  sale_date: string;
}

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  has_returns: boolean;
  returns_count: number;
  last_returned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  invoice_number: string;
  client_id: string | null;
  employee_id: string | null;
  employee_code: string | null;
  sold_by_auth_id: string | null;
  subtotal: number;
  discount_amount: number;
  commission_rate: number;
  commission_amount: number;
  total_amount: number;
  returned_subtotal: number;
  returned_commission_amount: number;
  returned_total_amount: number;
  net_subtotal: number;
  net_commission_amount: number;
  net_total_amount: number;
  has_return: boolean;
  return_count: number;
  last_returned_at: string | null;
  return_status: ReturnStatus;
  notes: string | null;
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_barcode: string;
  quantity: number;
  returned_quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface OrderReturnRow {
  id: string;
  order_id: string;
  client_id: string | null;
  processed_by_auth_id: string | null;
  reason: string | null;
  subtotal_returned: number;
  commission_returned: number;
  total_returned: number;
  created_at: string;
}

export interface OrderReturnItemRow {
  id: string;
  return_id: string;
  order_item_id: string;
  product_id: string | null;
  product_name: string;
  product_barcode: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface Tables {
  users: UserRow[];
  categories: CategoryRow[];
  traders: TraderRow[];
  products: ProductRow[];
  history: HistoryRow[];
  sales: SaleRow[];
  clients: ClientRow[];
  orders: OrderRow[];
  order_items: OrderItemRow[];
  order_returns: OrderReturnRow[];
  order_return_items: OrderReturnItemRow[];
}

const STORAGE_KEY = 'moon-demo-db-v1';

let cache: Tables | null = null;
let seedFactory: (() => Tables) | null = null;

// The seed lives in its own module; it registers itself here so this file
// stays free of demo content.
export const registerSeed = (factory: () => Tables) => {
  seedFactory = factory;
};

export const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // crypto.randomUUID is missing on plain-http LAN origins.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    return (char === 'x' ? rand : (rand & 0x3) | 0x8).toString(16);
  });
};

export const round2 = (value: number) => Math.round(value * 100) / 100;

/** Same window the old queries used: [month-01T00:00Z, next month-01T00:00Z). */
export const isInMonth = (isoDate: string, month: string) => {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const value = new Date(isoDate).getTime();
  return value >= start.getTime() && value < end.getTime();
};

export const byNewest = (a: { created_at: string }, b: { created_at: string }) =>
  b.created_at.localeCompare(a.created_at);

export const toLocalDate = (date: Date) => date.toLocaleDateString('en-CA');
export const toLocalTime = (date: Date) => date.toLocaleTimeString('en-GB', { hour12: false });

const persist = (tables: Tables) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  } catch (error) {
    console.error('Local storage write failed:', error);
    throw new Error('مساحة التخزين على الجهاز مليانة. صغّر الصور أو اعمل إعادة ضبط لبيانات الديمو.');
  }
};

const load = (): Tables => {
  if (cache) return cache;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw) as Tables;
      return cache;
    }
  } catch (error) {
    console.warn('Could not read local demo data, reseeding:', error);
  }

  if (!seedFactory) {
    throw new Error('Demo seed is not registered');
  }

  cache = seedFactory();
  try {
    persist(cache);
  } catch {
    // Storage unavailable (private mode): keep the seed in memory.
  }
  return cache;
};

/** Read a table. Rows are copies, so callers can't mutate stored state. */
export const select = <K extends keyof Tables>(table: K): Tables[K] =>
  structuredClone(load()[table]);

/**
 * Run a write against a draft copy of every table. The draft is saved only if
 * `fn` finishes without throwing, so multi-table writes are all-or-nothing.
 */
export const mutate = <R>(fn: (tables: Tables) => R): R => {
  const draft = structuredClone(load());
  const result = fn(draft);
  persist(draft);
  cache = draft;
  return structuredClone(result);
};

/**
 * Attach the related rows the old `orders` select embedded: client name,
 * employee username, items (with product trader/cost) and returns.
 */
export const withOrderRelations = (orders: OrderRow[]) => {
  const tables = load();
  const clients = new Map(tables.clients.map((row) => [row.id, row]));
  const users = new Map(tables.users.map((row) => [row.id, row]));
  const products = new Map(tables.products.map((row) => [row.id, row]));
  const traders = new Map(tables.traders.map((row) => [row.id, row]));

  return orders.map((order) => {
    const client = order.client_id ? clients.get(order.client_id) : undefined;
    const employee = order.employee_id ? users.get(order.employee_id) : undefined;

    return {
      ...order,
      clients: client ? { name: client.name } : null,
      users: employee ? { username: employee.username } : null,
      order_items: tables.order_items
        .filter((item) => item.order_id === order.id)
        .map((item) => {
          const product = item.product_id ? products.get(item.product_id) : undefined;
          const trader = product?.trader_id ? traders.get(product.trader_id) : undefined;
          return {
            ...item,
            products: product
              ? {
                  trader_id: product.trader_id,
                  cost_price: product.cost_price,
                  traders: trader ? { name: trader.name } : null,
                }
              : null,
          };
        }),
      order_returns: tables.order_returns
        .filter((entry) => entry.order_id === order.id)
        .map((entry) => ({
          ...entry,
          order_return_items: tables.order_return_items.filter((item) => item.return_id === entry.id),
        })),
    };
  });
};

export const resetDemoData = () => {
  cache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
  load();
};
