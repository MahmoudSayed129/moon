
import { useState, useMemo } from 'react';
import { useInventory } from '@/hooks/useInventory';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import AdminSidebar, { ADMIN_NAV_ITEMS } from '@/components/AdminSidebar';
import PageHeader from '@/components/PageHeader';
import Dashboard from '@/components/Dashboard';
import ProductTable from '@/components/ProductTable';
import InventoryTab from '@/components/InventoryTab';
import HistoryTab from '@/components/HistoryTab';
import UsersTab from '@/components/UsersTab';
import CategoriesTab from '@/components/CategoriesTab';
import TradersTab from '@/components/TradersTab';
import CRMTab from '@/components/CRMTab';
import CheckoutTab from '@/components/CheckoutTab';
import CheckoutHistoryTab from '@/components/CheckoutHistoryTab';
import EmployeesTab from '@/components/EmployeesTab';
import ProfitTab from '@/components/ProfitTab';
import LoginForm from '@/components/LoginForm';
import { Toaster } from '@/components/ui/toaster';

const Index = () => {
  const { authState } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  
  const {
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
    processReturn
  } = useInventory();

  // Filter products based on search query (only for store tab)
  const filteredProducts = useMemo(() => {
    if (!searchQuery || activeTab !== 'inventory') return products;
    
    const query = searchQuery.toLowerCase();
    return products.filter(product => 
      product.name.toLowerCase().includes(query) ||
      product.barcode.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query)
    );
  }, [products, searchQuery, activeTab]);

  // Show loading if auth is still loading
  if (authState.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">جاري التحميل...</div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!authState.isAuthenticated) {
    return <LoginForm />;
  }

  const isAdmin = authState.user?.role === 'super_admin';

  // Show loading if data is still loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {isAdmin ? (
          <>
            <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <main className="lg:mr-64 px-4 py-8">
              <div className="flex items-center justify-center h-64">
                <div className="text-lg">جاري تحميل بيانات المحل...</div>
              </div>
            </main>
          </>
        ) : (
          <>
            <Header />
            <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
            <main className="container mx-auto px-4 py-8">
              <div className="flex items-center justify-center h-64">
                <div className="text-lg">جاري تحميل بيانات المحل...</div>
              </div>
            </main>
          </>
        )}
      </div>
    );
  }

  // Ensure employee users stay within their allowed tabs
  if (authState.user?.role === 'employee' && !['inventory', 'profit'].includes(activeTab)) {
    setActiveTab('inventory');
  }

  // Employees never see the warehouse. If they somehow land on it, bounce to store.
  if (authState.user?.role === 'employee' && activeTab === 'warehouse') {
    setActiveTab('inventory');
  }

  const renderContent = () => {
    const userRole = authState.user?.role;

    const employeeOnlyDenied = (
      <div className="text-center py-8">
        <p>غير مسموح بالدخول. الموظفين مسموح لهم فقط بالمحل والعمولة.</p>
      </div>
    );

    const superAdminOnlyDenied = (
      <div className="text-center py-8">
        <p>غير مسموح بالدخول. الصفحة دي متاحة للمدير العام فقط.</p>
      </div>
    );

    switch (activeTab) {
      case 'dashboard':
        if (userRole === 'employee') return employeeOnlyDenied;
        return <Dashboard products={products} sales={sales} />;
      case 'inventory': {
        const isReadOnly = userRole === 'supervisor' || userRole === 'employee';
        const showBarcodeScanner = userRole === 'employee';

        return (
          <ProductTable
            products={filteredProducts}
            onAddProduct={addProduct}
            onUpdateProduct={updateProduct}
            onDeleteProduct={deleteProduct}
            onAddToProduct={addToProduct}
            onTakeFromProduct={takeFromProduct}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isReadOnly={isReadOnly}
            showBarcodeScanner={showBarcodeScanner}
            userRole={userRole}
          />
        );
      }
      case 'warehouse': {
        if (userRole === 'employee') return employeeOnlyDenied;
        const isReadOnly = false; // super_admin + supervisor can both manage warehouse.
        return (
          <InventoryTab
            products={products}
            onAddProduct={addProduct}
            onAddToWarehouse={addToWarehouse}
            onTakeFromWarehouse={takeFromWarehouse}
            onMoveToStore={moveToStore}
            isReadOnly={isReadOnly}
          />
        );
      }
      case 'history':
        if (userRole === 'employee') return employeeOnlyDenied;
        return <HistoryTab history={history} products={products} />;
      case 'checkout':
        return userRole === 'employee' ? employeeOnlyDenied : (
          <CheckoutTab products={products} onCheckout={completeCheckout} />
        );
      case 'profit':
        return userRole === 'employee' ? (
          <ProfitTab />
        ) : (
          <div className="text-center py-8">
            <p>غير مسموح بالدخول. صفحة العمولة متاحة للموظفين فقط.</p>
          </div>
        );
      case 'checkout-history':
        return userRole === 'employee' ? employeeOnlyDenied : (
          <CheckoutHistoryTab onProcessReturn={processReturn} />
        );
      case 'employees':
        return userRole === 'employee' ? employeeOnlyDenied : <EmployeesTab />;
      case 'crm':
        return userRole === 'employee' ? (
          <div className="text-center py-8">
            <p>غير مسموح بالدخول. الموظفين بيقدروا يضيفوا عملاء من صفحة نقطة البيع.</p>
          </div>
        ) : <CRMTab />;
      case 'users':
        return userRole === 'super_admin' ? <UsersTab /> : superAdminOnlyDenied;
      case 'categories':
        return userRole === 'super_admin' ? <CategoriesTab /> : superAdminOnlyDenied;
      case 'traders':
        return userRole === 'super_admin' ? <TradersTab /> : superAdminOnlyDenied;
      default:
        return <Dashboard products={products} sales={sales} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isAdmin ? (
        <>
          <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="lg:mr-64 px-4 py-6 lg:px-8 lg:py-8">
            {(() => {
              const meta = ADMIN_NAV_ITEMS.find((item) => item.id === activeTab);
              return meta ? (
                <PageHeader title={meta.label} subtitle={meta.subtitle} />
              ) : null;
            })()}
            {renderContent()}
          </main>
        </>
      ) : (
        <>
          <Header />
          <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="container mx-auto px-4 py-8">
            {renderContent()}
          </main>
        </>
      )}

      <Toaster />
    </div>
  );
};

export default Index;
