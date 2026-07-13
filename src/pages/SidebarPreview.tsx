// TEMPORARY: preview harness so we can screenshot AdminSidebar without a live DB session.
// Delete this file (and its route in App.tsx) once the design is approved.

import { useState } from 'react';
import AdminSidebar, { ADMIN_NAV_ITEMS } from '@/components/AdminSidebar';
import PageHeader from '@/components/PageHeader';
import InventoryTab from '@/components/InventoryTab';
import { AuthContext } from '@/hooks/useAuth';

const mockAuth = {
  authState: {
    user: {
      id: 'preview',
      username: 'admin',
      role: 'super_admin' as const,
      employee_code: 'MO-001',
      commission_rate: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    isAuthenticated: true,
    isLoading: false,
  },
  login: async () => ({ success: true }),
  logout: () => {},
};

const SidebarPreview = () => {
  const [activeTab, setActiveTab] = useState('warehouse');
  const meta = ADMIN_NAV_ITEMS.find((item) => item.id === activeTab);

  const mockProducts = [
    {
      id: 'p1',
      name: 'قميص قطن أبيض',
      barcode: '1111',
      quantity: 4,
      warehouseQuantity: 20,
      price: 300,
      category: 'ملابس',
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'p2',
      name: 'بنطلون جينز أزرق',
      barcode: '2222',
      quantity: 0,
      warehouseQuantity: 6,
      price: 450,
      category: 'ملابس',
      dateAdded: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    },
  ];

  const noop = async () => {};
  const noopTrue = async () => true;

  return (
    <AuthContext.Provider value={mockAuth}>
      <div className="min-h-screen bg-gray-50">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="lg:mr-64 px-4 py-6 lg:px-8 lg:py-8">
          {meta && <PageHeader title={meta.label} subtitle={meta.subtitle} />}
          {activeTab === 'warehouse' ? (
            <InventoryTab
              products={mockProducts}
              onAddProduct={() => {}}
              onAddToWarehouse={noop}
              onTakeFromWarehouse={noopTrue}
              onMoveToStore={noopTrue}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
              دي المساحة اللي هيتعرض فيها محتوى التاب — التاب النشط:{' '}
              <span className="font-mono">{activeTab}</span>
            </div>
          )}
        </main>
      </div>
    </AuthContext.Provider>
  );
};

export default SidebarPreview;
