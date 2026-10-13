// Demo content for Moon Store. Built fresh (relative to "now") the first time
// the app opens or after "reset demo data", so the current month always has
// sales, a few invoices are still inside the 14-day return window, and the
// previous months have history to browse.

import {
  CategoryRow,
  ClientRow,
  ProductRow,
  Tables,
  TraderRow,
  UserRow,
  registerSeed,
} from './local-db';
import { addHistoryRow, checkoutOrder, processOrderReturn } from './store-operations';

export interface DemoAccount {
  username: string;
  password: string;
  role: UserRow['role'];
  label: string;
}

// Shown on the login screen. Hashes below are bcrypt(password, 10).
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'admin', password: 'admin123', role: 'super_admin', label: 'المدير العام' },
  { username: 'manager', password: 'manager123', role: 'supervisor', label: 'مشرف' },
  { username: 'ahmed', password: 'ahmed123', role: 'employee', label: 'موظف مبيعات' },
];

const DAY = 24 * 60 * 60 * 1000;

// Deterministic PRNG so every reset produces the same story.
const createRng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ean13 = (body12: string) => {
  const sum = body12
    .split('')
    .reduce((acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${body12}${(10 - (sum % 10)) % 10}`;
};

const productImage = (emoji: string, from: string, to: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="160" height="160" fill="url(#g)"/>` +
    `<text x="80" y="104" font-size="76" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const daysAgo = (now: Date, days: number, hour = 12, minute = 0) => {
  const date = new Date(now.getTime() - days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const USERS: Array<Omit<UserRow, 'created_at'> & { daysAgo: number }> = [
  {
    id: 'a0f4c1e2-0001-4000-8000-000000000001',
    username: 'admin',
    password_hash: '$2b$10$zuJboy25O3qNm992grEdBOmRDeo2pKy5xs4YUbvyiAoWEAH8dyNpO',
    role: 'super_admin',
    employee_code: null,
    commission_rate: 0,
    daysAgo: 120,
  },
  {
    id: 'a0f4c1e2-0002-4000-8000-000000000002',
    username: 'manager',
    password_hash: '$2b$10$iTA.5.sff3gZF12647u19.gvmuqroEg8MuOvzwSRwrtuBleUIXtSm',
    role: 'supervisor',
    employee_code: 'MO-100',
    commission_rate: 2,
    daysAgo: 110,
  },
  {
    id: 'a0f4c1e2-0003-4000-8000-000000000003',
    username: 'ahmed',
    password_hash: '$2b$10$4lJ6vR8.GVGT.YvOG5nW4Oj/IIKtlnD4xZDoPOWbHHF6G7tq/ddRK',
    role: 'employee',
    employee_code: 'MO-101',
    commission_rate: 5,
    daysAgo: 100,
  },
  {
    id: 'a0f4c1e2-0004-4000-8000-000000000004',
    username: 'mona',
    password_hash: '$2b$10$ldloxTOvdlt7KEsQfmPDSeNAsUEFwPKMA21/LRTCwvFX6ymzTnVvq',
    role: 'employee',
    employee_code: 'MO-102',
    commission_rate: 4,
    daysAgo: 95,
  },
  {
    id: 'a0f4c1e2-0005-4000-8000-000000000005',
    username: 'youssef',
    password_hash: '$2b$10$w4PaJKrkuGUTA0pHf9onq.J.SIpfSVzUD1LDKE4u8cyGoSjcjDOg.',
    role: 'employee',
    employee_code: 'MO-103',
    commission_rate: 3,
    daysAgo: 60,
  },
];

const CATEGORIES: Array<{ key: string; name: string; description: string }> = [
  { key: 'tees', name: 'تيشيرتات', description: 'تيشيرتات قطن وبولو' },
  { key: 'shirts', name: 'قمصان', description: 'قمصان كاجوال وكلاسيك' },
  { key: 'pants', name: 'بناطيل وجينز', description: 'جينز، كارجو وبناطيل قماش' },
  { key: 'dresses', name: 'فساتين', description: 'فساتين صيفي وسواريه' },
  { key: 'jackets', name: 'جواكت', description: 'جواكت جينز وجلد وبومبر' },
  { key: 'knit', name: 'تريكو وسويت شيرت', description: 'هوديز وبلوفرات' },
  { key: 'shoes', name: 'أحذية', description: 'كوتشيات، صنادل وأحذية كلاسيك' },
  { key: 'accessories', name: 'إكسسوارات', description: 'شنط، أحزمة، كابات ونضارات' },
];

const TRADERS: Array<{ key: string; name: string; phone: string; notes: string }> = [
  { key: 'nile', name: 'مصنع النيل للملابس الجاهزة', phone: '01001234567', notes: 'توريد أسبوعي - دفع آجل 30 يوم' },
  { key: 'amal', name: 'شركة الأمل للأحذية', phone: '01112345678', notes: 'أحذية جلد طبيعي - أقل طلبية 12 جوز' },
  { key: 'hussainy', name: 'ورشة الحسيني للتريكو', phone: '01223456789', notes: 'تريكو وهوديز - تسليم خلال 10 أيام' },
  { key: 'alex', name: 'مستورد الإسكندرية', phone: '01556789012', notes: 'بضاعة مستوردة تركي وصيني' },
];

interface ProductSeed {
  name: string;
  size: string;
  price: number;
  cost: number;
  store: number;
  warehouse: number;
  category: string;
  trader: string;
  image: [string, string, string];
  description: string;
  weight: number;
  addedDaysAgo?: number;
}

const PRODUCTS: ProductSeed[] = [
  { name: 'تيشيرت قطن أبيض بيزك', size: 'M', price: 250, cost: 140, store: 34, warehouse: 60, category: 'tees', trader: 'nile', image: ['👕', '#f5f3ff', '#ddd6fe'], description: 'قطن 100% مصري', weight: 9 },
  { name: 'تيشيرت أوفر سايز أسود', size: 'L', price: 320, cost: 180, store: 18, warehouse: 40, category: 'tees', trader: 'nile', image: ['👕', '#e4e4e7', '#71717a'], description: 'قصة أوفر سايز - قطن تقيل', weight: 8 },
  { name: 'تيشيرت بولو كحلي', size: 'XL', price: 380, cost: 210, store: 7, warehouse: 25, category: 'tees', trader: 'nile', image: ['👕', '#dbeafe', '#1e3a8a'], description: 'بولو بياقة وزراير', weight: 6 },
  { name: 'قميص كتان بيج', size: 'L', price: 550, cost: 300, store: 12, warehouse: 20, category: 'shirts', trader: 'nile', image: ['👔', '#fef3c7', '#d6b98c'], description: 'كتان طبيعي - مناسب للصيف', weight: 5 },
  { name: 'قميص أكسفورد أزرق فاتح', size: 'M', price: 480, cost: 260, store: 9, warehouse: 30, category: 'shirts', trader: 'nile', image: ['👔', '#e0f2fe', '#7dd3fc'], description: 'قماش أكسفورد كلاسيك', weight: 5 },
  { name: 'قميص كاروهات كاجوال', size: 'L', price: 420, cost: 230, store: 15, warehouse: 0, category: 'shirts', trader: 'alex', image: ['👔', '#fee2e2', '#b91c1c'], description: 'كاروهات فلانيل', weight: 4 },
  { name: 'بنطلون جينز سليم أزرق', size: '32', price: 650, cost: 380, store: 22, warehouse: 45, category: 'pants', trader: 'alex', image: ['👖', '#dbeafe', '#2563eb'], description: 'جينز سليم فيت ستريتش', weight: 8 },
  { name: 'بنطلون جينز واسع فاتح', size: '30', price: 700, cost: 400, store: 6, warehouse: 18, category: 'pants', trader: 'alex', image: ['👖', '#eff6ff', '#93c5fd'], description: 'قصة واسعة - غسلة فاتحة', weight: 6 },
  { name: 'بنطلون كارجو زيتي', size: '34', price: 580, cost: 320, store: 14, warehouse: 22, category: 'pants', trader: 'nile', image: ['👖', '#ecfccb', '#4d7c0f'], description: 'كارجو بستة جيوب', weight: 5 },
  { name: 'بنطلون قماش رمادي', size: '32', price: 520, cost: 290, store: 0, warehouse: 12, category: 'pants', trader: 'nile', image: ['👖', '#f4f4f5', '#a1a1aa'], description: 'بنطلون قماش رسمي', weight: 3 },
  { name: 'فستان صيفي مشجر', size: 'S', price: 850, cost: 470, store: 11, warehouse: 16, category: 'dresses', trader: 'alex', image: ['👗', '#fce7f3', '#f472b6'], description: 'فستان شيفون مشجر', weight: 6 },
  { name: 'فستان سواريه موف', size: 'M', price: 1450, cost: 820, store: 4, warehouse: 6, category: 'dresses', trader: 'alex', image: ['👗', '#f3e8ff', '#7e22ce'], description: 'سواريه ساتان طويل', weight: 3 },
  { name: 'فستان كاجوال جينز', size: 'M', price: 780, cost: 430, store: 9, warehouse: 10, category: 'dresses', trader: 'alex', image: ['👗', '#e0e7ff', '#4f46e5'], description: 'فستان جينز بحزام', weight: 4 },
  { name: 'جاكيت جينز كلاسيك', size: 'L', price: 950, cost: 540, store: 8, warehouse: 14, category: 'jackets', trader: 'alex', image: ['🧥', '#dbeafe', '#1d4ed8'], description: 'جاكيت جينز غسلة متوسطة', weight: 4 },
  { name: 'جاكيت جلد أسود', size: 'XL', price: 1800, cost: 1050, store: 3, warehouse: 5, category: 'jackets', trader: 'alex', image: ['🧥', '#d4d4d8', '#18181b'], description: 'جلد صناعي عالي الجودة', weight: 2 },
  { name: 'بومبر جاكيت زيتي', size: 'L', price: 1100, cost: 620, store: 10, warehouse: 8, category: 'jackets', trader: 'nile', image: ['🧥', '#ecfccb', '#3f6212'], description: 'بومبر مبطن', weight: 3, addedDaysAgo: 4 },
  { name: 'سويت شيرت هودي رمادي', size: 'L', price: 690, cost: 380, store: 19, warehouse: 35, category: 'knit', trader: 'hussainy', image: ['🧶', '#f4f4f5', '#71717a'], description: 'هودي قطن مبطن', weight: 6, addedDaysAgo: 6 },
  { name: 'بلوفر تريكو بيج', size: 'M', price: 590, cost: 320, store: 12, warehouse: 24, category: 'knit', trader: 'hussainy', image: ['🧶', '#fef3c7', '#b45309'], description: 'تريكو صوف خفيف', weight: 4, addedDaysAgo: 6 },
  { name: 'كوتشي أبيض سنيكرز', size: '42', price: 1200, cost: 700, store: 16, warehouse: 30, category: 'shoes', trader: 'amal', image: ['👟', '#f8fafc', '#cbd5e1'], description: 'سنيكرز جلد أبيض', weight: 6 },
  { name: 'صندل جلد بني', size: '41', price: 600, cost: 330, store: 20, warehouse: 25, category: 'shoes', trader: 'amal', image: ['🩴', '#fef3c7', '#92400e'], description: 'صندل جلد طبيعي', weight: 4 },
  { name: 'حذاء كلاسيك أسود', size: '43', price: 1350, cost: 780, store: 5, warehouse: 12, category: 'shoes', trader: 'amal', image: ['👞', '#e4e4e7', '#27272a'], description: 'حذاء جلد رسمي', weight: 3 },
  { name: 'شنطة كروس جلد', size: 'مقاس موحد', price: 480, cost: 250, store: 13, warehouse: 20, category: 'accessories', trader: 'alex', image: ['👜', '#fae8ff', '#a21caf'], description: 'شنطة كروس بسلسلة', weight: 5 },
  { name: 'كاب قطن موف', size: 'فري سايز', price: 180, cost: 85, store: 30, warehouse: 50, category: 'accessories', trader: 'nile', image: ['🧢', '#f3e8ff', '#9333ea'], description: 'كاب مطرز بلوجو مون', weight: 5 },
  { name: 'نضارة شمس كلاسيك', size: 'مقاس موحد', price: 350, cost: 160, store: 17, warehouse: 22, category: 'accessories', trader: 'alex', image: ['🕶️', '#fef9c3', '#ca8a04'], description: 'حماية UV400', weight: 4 },
  { name: 'سكارف حرير مشجر', size: 'مقاس موحد', price: 260, cost: 120, store: 2, warehouse: 15, category: 'accessories', trader: 'alex', image: ['🧣', '#ffe4e6', '#e11d48'], description: 'حرير صناعي مشجر', weight: 3 },
];

const CLIENTS: Array<{ name: string; phone: string; email?: string; notes?: string }> = [
  { name: 'نورهان عادل', phone: '01012345678', email: 'nourhan.adel@gmail.com', notes: 'بتحب الفساتين الصيفي - مقاس S' },
  { name: 'محمد السيد', phone: '01098765432' },
  { name: 'ياسمين خالد', phone: '01234567890', email: 'yasmin.k@yahoo.com' },
  { name: 'كريم مصطفى', phone: '01155554444', notes: 'عميل VIP - بياخد خصم على العروض' },
  { name: 'دينا فاروق', phone: '01066778899' },
  { name: 'عمر الشريف', phone: '01511223344', email: 'omar.elsherif@gmail.com' },
  { name: 'هبة إبراهيم', phone: '01277889900', email: 'heba.ibrahim@gmail.com' },
  { name: 'مصطفى رمضان', phone: '01022334455' },
  { name: 'سلمى حسن', phone: '01199887766', notes: 'بتفضل التواصل على واتساب' },
  { name: 'أحمد جمال', phone: '01288776655' },
  { name: 'رنا وليد', phone: '01033445566', email: 'rana.walid@outlook.com' },
  { name: 'خالد منصور', phone: '01544332211', notes: 'بيشتري جملة للعيلة' },
];

const ORDER_NOTES = [
  'تغليف هدية',
  'العميل ممكن يرجع يبدّل المقاس',
  'دفع فيزا',
  'حجز من الصفحة على فيسبوك',
];

const SEED_IDS = {
  category: (index: number) => `c47e0000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  trader: (index: number) => `7a0de500-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  product: (index: number) => `9d0c0000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  client: (index: number) => `c11e0000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
};

// Big starting stock while simulating sales; real starting stock is
// back-solved afterwards so today's numbers match PRODUCTS.
const SIMULATION_STOCK = 100_000;

export const buildDemoData = (now: Date = new Date()): Tables => {
  const rng = createRng(20260713);
  const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)];

  const tables: Tables = {
    users: [],
    categories: [],
    traders: [],
    products: [],
    history: [],
    sales: [],
    clients: [],
    orders: [],
    order_items: [],
    order_returns: [],
    order_return_items: [],
  };

  tables.users = USERS.map(({ daysAgo: age, ...user }) => ({
    ...user,
    created_at: daysAgo(now, age, 10).toISOString(),
  }));

  const categoryIds = new Map<string, string>();
  tables.categories = CATEGORIES.map((category, index): CategoryRow => {
    const id = SEED_IDS.category(index);
    categoryIds.set(category.key, id);
    const createdAt = daysAgo(now, 115, 11, index).toISOString();
    return {
      id,
      name: category.name,
      description: category.description,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  const traderIds = new Map<string, string>();
  tables.traders = TRADERS.map((trader, index): TraderRow => {
    const id = SEED_IDS.trader(index);
    traderIds.set(trader.key, id);
    const createdAt = daysAgo(now, 112, 12, index).toISOString();
    return {
      id,
      name: trader.name,
      phone: trader.phone,
      notes: trader.notes,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  tables.products = PRODUCTS.map((product, index): ProductRow => {
    const addedAt = daysAgo(now, product.addedDaysAgo ?? 90 - index, 10, index).toISOString();
    return {
      id: SEED_IDS.product(index),
      name: product.name,
      barcode: ean13(`6221${String(2026000 + index * 7).padStart(8, '0')}`),
      quantity: SIMULATION_STOCK,
      warehouse_quantity: product.warehouse,
      price: product.price,
      category: categoryIds.get(product.category) || null,
      trader_id: traderIds.get(product.trader) || null,
      cost_price: product.cost,
      description: product.description,
      size: product.size,
      image: productImage(...product.image),
      date_added: addedAt,
      last_updated: addedAt,
    };
  });

  tables.clients = CLIENTS.map((client, index): ClientRow => {
    const createdAt = daysAgo(now, 88 - index * 6, 13, index).toISOString();
    return {
      id: SEED_IDS.client(index),
      name: client.name,
      phone: client.phone,
      email: client.email || null,
      notes: client.notes || null,
      has_returns: false,
      returns_count: 0,
      last_returned_at: null,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  // ---- Sales simulation ---------------------------------------------------
  const employeeCodes = ['MO-101', 'MO-101', 'MO-101', 'MO-102', 'MO-102', 'MO-103', 'MO-103', 'MO-100', ''];
  const weightedProducts = PRODUCTS.flatMap((product, index) =>
    Array.from({ length: product.weight }, () => index)
  );

  for (let age = 80; age >= 0; age -= 1) {
    const day = daysAgo(now, age);
    const isWeekend = day.getDay() === 4 || day.getDay() === 5; // Thu / Fri
    const ordersToday = Math.floor(rng() * (isWeekend ? 4 : 3));

    for (let n = 0; n < ordersToday; n += 1) {
      const at = daysAgo(now, age, 11 + Math.floor(rng() * 11), Math.floor(rng() * 60));
      if (at > now) continue;

      const itemCount = 1 + Math.floor(rng() * rng() * 4);
      const items = new Map<number, number>();
      for (let i = 0; i < itemCount; i += 1) {
        const productIndex = pick(weightedProducts);
        const product = tables.products[productIndex];
        if (new Date(product.date_added) > at) continue;
        items.set(productIndex, (items.get(productIndex) || 0) + (rng() < 0.85 ? 1 : 2));
      }
      if (items.size === 0) continue;

      const cart = Array.from(items, ([productIndex, quantity]) => ({
        productId: tables.products[productIndex].id,
        quantity,
      }));
      const subtotal = Array.from(items).reduce(
        (sum, [productIndex, quantity]) => sum + PRODUCTS[productIndex].price * quantity,
        0
      );
      const clientsSoFar = tables.clients.filter((client) => new Date(client.created_at) <= at);
      const clientId = clientsSoFar.length > 0 && rng() < 0.65 ? pick(clientsSoFar).id : null;
      const discountAmount = rng() < 0.15 ? Math.round((subtotal * 0.1) / 5) * 5 : 0;

      checkoutOrder(
        tables,
        {
          items: cart,
          clientId,
          employeeCode: pick(employeeCodes),
          discountAmount,
          notes: rng() < 0.12 ? pick(ORDER_NOTES) : undefined,
        },
        at
      );
    }
  }

  // ---- Returns ------------------------------------------------------------
  const admin = tables.users[0];
  const manager = tables.users[1];
  const recentOrders = (minAge: number, maxAge: number) =>
    tables.orders.filter((order) => {
      const age = (now.getTime() - new Date(order.created_at).getTime()) / DAY;
      return age >= minAge && age <= maxAge && order.client_id && order.return_status === 'none';
    });
  const itemsOf = (orderId: string) => tables.order_items.filter((item) => item.order_id === orderId);

  const plannedReturns: Array<{
    window: [number, number];
    afterDays: number;
    full: boolean;
    reason: string;
    actor: UserRow;
  }> = [
    { window: [30, 40], afterDays: 3, full: true, reason: 'العميل غيّر رأيه', actor: manager },
    { window: [16, 22], afterDays: 5, full: false, reason: 'المقاس صغير', actor: admin },
    { window: [6, 10], afterDays: 2, full: true, reason: 'عيب في الخياطة', actor: manager },
    { window: [2, 5], afterDays: 1, full: false, reason: 'اللون مختلف عن الصورة', actor: admin },
  ];

  for (const plan of plannedReturns) {
    const candidates = recentOrders(...plan.window).filter(
      (order) => plan.full || itemsOf(order.id).length > 1
    );
    if (candidates.length === 0) continue;

    const order = pick(candidates);
    const orderItems = itemsOf(order.id);
    const returnItems = plan.full
      ? orderItems.map((item) => ({ orderItemId: item.id, quantity: item.quantity }))
      : [{ orderItemId: orderItems[0].id, quantity: 1 }];
    const returnAt = new Date(
      Math.min(now.getTime() - 60 * 60 * 1000, new Date(order.created_at).getTime() + plan.afterDays * DAY)
    );

    processOrderReturn(
      tables,
      {
        orderId: order.id,
        items: returnItems,
        reason: plan.reason,
        actor: { id: plan.actor.id, role: plan.actor.role },
      },
      returnAt
    );
  }

  // ---- Back-solve opening stock + stock-movement history ------------------
  tables.products.forEach((product, index) => {
    const seed = PRODUCTS[index];
    const soldNet = SIMULATION_STOCK - product.quantity;
    const addedAt = new Date(product.date_added);
    const transfer = seed.warehouse > 0 ? Math.max(0, Math.min(12, Math.round(soldNet * 0.3))) : 0;
    const openingStore = seed.store + soldNet - transfer;
    const openingWarehouse = seed.warehouse + transfer;

    product.quantity = seed.store;
    product.warehouse_quantity = seed.warehouse;

    const base = {
      product_id: product.id,
      product_name: product.name,
      barcode: product.barcode,
    };
    if (openingStore > 0) {
      addHistoryRow(tables, { ...base, operation: 'add', quantity: openingStore, location: 'store' }, addedAt);
    }
    if (openingWarehouse > 0) {
      addHistoryRow(
        tables,
        { ...base, operation: 'add', quantity: openingWarehouse, location: 'warehouse' },
        new Date(addedAt.getTime() + 5 * 60 * 1000)
      );
    }
    if (transfer > 0) {
      const ageDays = Math.max(1, Math.floor((now.getTime() - addedAt.getTime()) / DAY / 2));
      const movedAt = daysAgo(now, ageDays, 10, 15);
      addHistoryRow(tables, { ...base, operation: 'remove', quantity: transfer, location: 'warehouse' }, movedAt);
      addHistoryRow(
        tables,
        { ...base, operation: 'add', quantity: transfer, location: 'store' },
        new Date(movedAt.getTime() + 60 * 1000)
      );
      product.last_updated = movedAt.toISOString();
    }
  });

  return tables;
};

registerSeed(() => buildDemoData());
