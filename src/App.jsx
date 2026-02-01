import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';

// Importación de Componentes
import OrderForm from '@/components/OrderForm';
import OrdersPanel from '@/components/OrdersPanel';
import Stats from '@/components/Stats';
import Login from '@/components/Login';
import Sidebar from '@/components/Sidebar';
import Notifications from '@/components/Notifications';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import { ClientForm } from '@/components/ClientForm';
import { ClientsPanel } from '@/components/ClientsPanel';
import WorkAreaList from '@/components/WorkAreaList';
import WorkAreaCalendar from '@/components/WorkAreaCalendar';
import UserManagement from '@/components/UserManagement';
import MyProfile from '@/components/MyProfile';
import RolesPermissions from '@/components/RolesPermissions';
import { supabase } from './supabaseClient';
import StatisticsCharts from '@/components/StatisticsCharts';
import DailyReport from '@/components/DailyReport';

// -----------------------------------------------------------------------------
// Componente Interno: Contiene toda la lógica que requiere el Router context
// -----------------------------------------------------------------------------
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // --- Estados Globales ---
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  
  // --- Estados de Modals ---
  const [showForm, setShowForm] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [showClientFormModal, setShowClientFormModal] = useState(false);
  
  // --- Estados de UI ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [archivedNotifications, setArchivedNotifications] = useState([]);
  const [allowedViews, setAllowedViews] = useState([]);

  // --- Efectos ---

  // 1. Cargar Permisos
  useEffect(() => {
    if (user) {
      const fetchPermissions = async () => {
        let views = ['inicio', 'salir'];
        try {
          const { data, error } = await supabase
            .from('role_permissions')
            .select('allowed_views')
            .eq('role', user.role)
            .single();

          if (data && data.allowed_views) {
            views = data.allowed_views;
          }
        } catch (error) {
          console.error("Error cargando permisos", error);
        }
        if (user.role === 'Administrador') {
          if (!views.includes('roles-permisos')) views.push('roles-permisos');
          if (!views.includes('admin-usuarios')) views.push('admin-usuarios');
        }
        setAllowedViews(views);
      };
      fetchPermissions();
    }
  }, [user]);

  // 2. Persistencia Local
  useEffect(() => {
    if (orders.length > 0) localStorage.setItem('productionOrders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (clients.length > 0) localStorage.setItem('clientsDB', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('archivedNotifications', JSON.stringify(archivedNotifications));
  }, [archivedNotifications]);

  // --- Handlers de Usuario ---
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    navigate('/'); // Redirigir al inicio al loguearse
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    navigate('/');
  };

  // --- Lógica de Órdenes ---
  const getNextOrderNumber = () => {
    if (orders.length === 0) return 1;
    const maxNumber = orders.reduce((max, o) => {
      const num = parseInt(o.orderNumber || 0);
      return num > max ? num : max;
    }, 0);
    return maxNumber + 1;
  };

  const handleCreateOrder = (orderData) => {
    const orderNumber = orderData.orderNumber || getNextOrderNumber();
    const newOrder = {
      ...orderData,
      id: orderData.id || Date.now().toString(),
      orderNumber: orderNumber,
      status: 'VENTAS',
      vendedor: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setOrders(prev => [newOrder, ...prev]);
    setShowForm(false);
    toast({ title: "✅ Orden creada", description: `Orden #${newOrder.orderNumber} registrada` });
  };

  const handleUpdateOrder = (orderId, updatedData) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updatedData, updatedAt: new Date().toISOString() } : o));
    setEditingOrder(null);
    setPaymentOrder(null);
    toast({ title: "💾 Actualizado", description: "Los cambios han sido guardados" });
  };

  const handleStatusChange = (orderId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    let msg = `Nueva etapa: ${newStatus}`;
    if (newStatus === 'ANULADA') msg = "Orden anulada correctamente";
    if (newStatus === 'ARCHIVADA') msg = "Orden archivada en historial";
    if (newStatus === 'FINALIZADA' && orders.find(o => o.id === orderId)?.status === 'ARCHIVADA') msg = "Orden restaurada de archivo";
    toast({ title: "Estado actualizado", description: msg });
  };

  const handleDeleteOrder = (orderId) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    toast({ title: "🗑️ Eliminado", description: "Orden eliminada permanentemente del sistema" });
  };

  const handleProductToggle = (order, productIndex) => {
    if (user.role !== 'Producción') return;
    const updatedProducts = [...order.productos];
    updatedProducts[productIndex] = { ...updatedProducts[productIndex], completed: !updatedProducts[productIndex].completed };
    const updatedOrder = { ...order, productos: updatedProducts };
    setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
    if (viewOrder && viewOrder.id === order.id) {
      setViewOrder(updatedOrder);
    }
  };

  // --- Lógica de Clientes ---
  const handleCreateClient = (clientData) => {
    const newClient = {
      id: Date.now().toString(),
      ...clientData,
      createdAt: new Date().toISOString()
    };
    setClients(prev => [newClient, ...prev]);

    if (showClientFormModal) {
      setShowClientFormModal(false);
      toast({ title: "✅ Cliente registrado", description: "Ahora puede seleccionarlo en la orden." });
    } else {
      navigate('/clientes'); // Navegación con Router
      toast({ title: "✅ Cliente registrado", description: `${clientData.razonSocial} ha sido agregado exitosamente.` });
    }
  };

  const handleArchiveNotification = (orderId) => {
    setArchivedNotifications(prev => [...prev, orderId]);
    toast({ description: "Notificación archivada" });
  };

  // --- Adaptador de Navegación (Sidebar -> Router) ---
  // Esta función traduce los IDs antiguos del Sidebar a Rutas URL
  const handleViewChange = (viewId) => {
    if (viewId === 'ordenes-nueva') {
      setShowForm(true); // Modal, no cambia ruta
      return;
    }
    
    const routesMap = {
      'inicio': '/',
      'ordenes-todas': '/ordenes',
      'ordenes-activas': '/ordenes/activas',
      'ordenes-sin-factura': '/ordenes/sin-factura',
      'ordenes-con-factura': '/ordenes/con-factura',
      'ordenes-credito': '/ordenes/credito',
      'ordenes-finalizadas': '/ordenes/finalizadas',
      'ordenes-anuladas': '/ordenes/anuladas',
      'ordenes-archivadas': '/ordenes/archivadas',
      'estadisticas-graficos': '/estadisticas/graficos',
      'estadisticas-reporte': '/estadisticas/reporte',
      'clientes-lista': '/clientes',
      'clientes-nuevo': '/clientes/nuevo',
      'trabajo-listado': '/trabajo/lista',
      'trabajo-disponibilidad': '/trabajo/calendario',
      'admin-usuarios': '/admin/usuarios',
      'roles-permisos': '/admin/roles',
      'mi-perfil': '/perfil'
    };

    const path = routesMap[viewId];
    if (path) {
      navigate(path);
      setIsMobileMenuOpen(false);
    }
  };

  // --- Función auxiliar para obtener el "currentView" string basado en la URL actual ---
  // Esto es necesario para que el Sidebar sepa qué item resaltar
  const getCurrentViewFromPath = () => {
    const path = location.pathname;
    if (path === '/') return 'inicio';
    if (path === '/ordenes') return 'ordenes-todas';
    if (path === '/ordenes/activas') return 'ordenes-activas';
    if (path === '/ordenes/sin-factura') return 'ordenes-sin-factura';
    if (path === '/ordenes/con-factura') return 'ordenes-con-factura';
    if (path === '/ordenes/credito') return 'ordenes-credito';
    if (path === '/ordenes/finalizadas') return 'ordenes-finalizadas';
    if (path === '/ordenes/anuladas') return 'ordenes-anuladas';
    if (path === '/ordenes/archivadas') return 'ordenes-archivadas';
    if (path === '/estadisticas/graficos') return 'estadisticas-graficos';
    if (path === '/estadisticas/reporte') return 'estadisticas-reporte';
    if (path === '/clientes') return 'clientes-lista';
    if (path === '/clientes/nuevo') return 'clientes-nuevo';
    if (path === '/trabajo/lista') return 'trabajo-listado';
    if (path === '/trabajo/calendario') return 'trabajo-disponibilidad';
    if (path === '/admin/usuarios') return 'admin-usuarios';
    if (path === '/admin/roles') return 'roles-permisos';
    if (path === '/perfil') return 'mi-perfil';
    return '';
  };

  // --- Filtro de Órdenes para las Rutas ---
  const getFilteredOrders = (filterType) => {
    switch (filterType) {
      case 'activas':
        return orders.filter(o => o.status !== 'FINALIZADA' && o.status !== 'ANULADA' && o.status !== 'ARCHIVADA');
      case 'sin-factura':
        return orders.filter(o => !o.aplicarIva);
      case 'con-factura':
        return orders.filter(o => o.aplicarIva);
      case 'credito':
        return orders.filter(o => o.formaPagoAnticipo === 'Crédito' || o.formaPagoSaldo === 'Crédito' || o.status === 'CONTABILIDAD');
      case 'finalizadas':
        return orders.filter(o => o.status === 'FINALIZADA');
      case 'anuladas':
        return orders.filter(o => o.status === 'ANULADA');
      case 'archivadas':
        return orders.filter(o => o.status === 'ARCHIVADA');
      default:
        return orders;
    }
  };

  const showDashboard = (user?.role === 'Administrador' || user?.role === 'Vendedor');

  // Si no hay usuario, mostrar Login (Protección básica)
  if (!user) return <><Login onLogin={handleLogin} /><Toaster /></>;

  // Componente wrapper para las vistas de órdenes para evitar repetición
  const OrdersView = ({ filter }) => (
    <div className="space-y-6 animate-in fade-in duration-500">
      {filter === 'todas' && showDashboard && <Stats orders={orders} />}
      <OrdersPanel
        orders={getFilteredOrders(filter)}
        user={user}
        onUpdateStatus={handleStatusChange}
        onDeleteOrder={handleDeleteOrder}
        onUpdateOrder={(id, data) => handleUpdateOrder(id, data)}
        onEditOrder={setEditingOrder}
        onPaymentOrder={setPaymentOrder}
        onCreateOrder={() => setShowForm(true)}
        onViewOrder={setViewOrder}
      />
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-slate-50 print:bg-white flex">
        {/* Sidebar Desktop */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <Sidebar
            user={user}
            onLogout={handleLogout}
            currentView={getCurrentViewFromPath()} // Pasamos el view calculado de la URL
            onViewChange={handleViewChange}
            allowedViews={allowedViews}
          />
        </div>

        {/* Header Mobile */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
          <span className="font-bold">Sistema Producción</span>
          <div className="flex items-center gap-3">
            <Notifications
              user={user}
              orders={orders}
              archivedIds={archivedNotifications}
              onArchive={handleArchiveNotification}
              onViewOrder={setViewOrder}
            />
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Sidebar Mobile */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="w-64 bg-slate-900 h-full shadow-2xl" onClick={e => e.stopPropagation()}>
              <Sidebar
                user={user}
                onLogout={handleLogout}
                currentView={getCurrentViewFromPath()}
                onViewChange={handleViewChange}
                allowedViews={allowedViews}
              />
            </div>
          </div>
        )}

        {/* Contenido Principal */}
        <div className="flex-1 w-full md:w-[calc(100%-16rem)] min-h-screen transition-all duration-300 flex flex-col">
          {/* Header Desktop */}
          <div className="hidden md:flex bg-white border-b border-slate-200 h-16 px-8 items-center justify-end sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-4">
              <Notifications
                user={user}
                orders={orders}
                archivedIds={archivedNotifications}
                onArchive={handleArchiveNotification}
                onViewOrder={setViewOrder}
              />
              <div className="h-8 w-[1px] bg-slate-200"></div>
              <span className="text-sm font-semibold text-slate-700">{user.name}</span>
            </div>
          </div>

          <div className="container mx-auto px-4 py-8 md:p-8 mt-12 md:mt-0 flex-1 print:p-0 print:max-w-none print:mt-0">
            
            {/* DEFINICIÓN DE RUTAS */}
            <Routes>
              {/* Inicio / Dashboard */}
              <Route path="/" element={
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Hola, {user.name}! 👋</h2>
                    <p className="text-slate-500">Bienvenido al panel de control.</p>
                  </div>
                  {showDashboard && <Stats orders={orders} />}
                  <OrdersPanel
                    orders={orders.slice(0, 5)}
                    user={user}
                    onUpdateStatus={handleStatusChange}
                    onDeleteOrder={handleDeleteOrder}
                    onUpdateOrder={(id, data) => handleUpdateOrder(id, data)}
                    onEditOrder={setEditingOrder}
                    onPaymentOrder={setPaymentOrder}
                    onCreateOrder={() => setShowForm(true)}
                    onViewOrder={setViewOrder}
                  />
                </div>
              } />

              {/* Rutas de Órdenes */}
              <Route path="/ordenes" element={<OrdersView filter="todas" />} />
              <Route path="/ordenes/activas" element={<OrdersView filter="activas" />} />
              <Route path="/ordenes/sin-factura" element={<OrdersView filter="sin-factura" />} />
              <Route path="/ordenes/con-factura" element={<OrdersView filter="con-factura" />} />
              <Route path="/ordenes/credito" element={<OrdersView filter="credito" />} />
              <Route path="/ordenes/finalizadas" element={<OrdersView filter="finalizadas" />} />
              <Route path="/ordenes/anuladas" element={<OrdersView filter="anuladas" />} />
              <Route path="/ordenes/archivadas" element={<OrdersView filter="archivadas" />} />

              {/* Estadísticas */}
              <Route path="/estadisticas/graficos" element={<StatisticsCharts orders={orders} />} />
              <Route path="/estadisticas/reporte" element={<DailyReport orders={orders} user={user} />} />

              {/* Clientes */}
              <Route path="/clientes" element={
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Gestión de Clientes</h2>
                  </div>
                  <ClientsPanel clients={clients} onCreateNew={() => navigate('/clientes/nuevo')} />
                </div>
              } />
              <Route path="/clientes/nuevo" element={
                <div className="space-y-6 animate-in fade-in duration-500">
                  <ClientForm onSubmit={handleCreateClient} onCancel={() => navigate('/clientes')} />
                </div>
              } />

              {/* Producción / Trabajo */}
              <Route path="/trabajo/lista" element={
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Área de Trabajo - Listado</h2>
                  </div>
                  <WorkAreaList orders={orders} user={user} onViewOrder={setViewOrder} />
                </div>
              } />
              <Route path="/trabajo/calendario" element={
                <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-140px)]">
                  <WorkAreaCalendar orders={orders} onViewOrder={setViewOrder} />
                </div>
              } />

              {/* Administración */}
              <Route path="/admin/usuarios" element={<div className="space-y-6 animate-in fade-in duration-500"><UserManagement /></div>} />
              <Route path="/admin/roles" element={<RolesPermissions />} />
              <Route path="/perfil" element={<MyProfile user={user} />} />

              {/* Ruta 404 por defecto */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

          </div>
        </div>
      </div>

      {/* --- MODALES GLOBALES (Fuera de Routes) --- */}
      
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <OrderForm
              currentUser={user}
              clients={clients}
              onSubmit={handleCreateOrder}
              onCancel={() => setShowForm(false)}
              mode="create"
              nextOrderNumber={getNextOrderNumber()}
              onCheckAvailability={() => setShowAvailabilityModal(true)}
              onCreateClient={() => setShowClientFormModal(true)}
            />
          </div>
        </div>
      )}

      {/* Resto de Modales (Editing, Payment, ClientFormModal, etc.) se mantienen igual */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden" onClick={() => setEditingOrder(null)}>
          <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <OrderForm
              currentUser={user}
              clients={clients}
              initialData={editingOrder}
              onSubmit={(data) => handleUpdateOrder(editingOrder.id, data)}
              onCancel={() => setEditingOrder(null)}
              mode="edit"
              onCheckAvailability={() => setShowAvailabilityModal(true)}
              onCreateClient={() => setShowClientFormModal(true)}
            />
          </div>
        </div>
      )}

      {paymentOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden" onClick={() => setPaymentOrder(null)}>
          <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <OrderForm
              currentUser={user}
              clients={clients}
              initialData={paymentOrder}
              onSubmit={(data) => handleUpdateOrder(paymentOrder.id, data)}
              onCancel={() => setPaymentOrder(null)}
              mode="payment_only"
            />
          </div>
        </div>
      )}

      {showClientFormModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowClientFormModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Registrar Nuevo Cliente</h3>
            <ClientForm
              onSubmit={handleCreateClient}
              onCancel={() => setShowClientFormModal(false)}
            />
          </div>
        </div>
      )}

      {showAvailabilityModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
          <div className="w-full max-w-5xl bg-white h-[85vh] rounded-xl shadow-2xl flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-lg">Disponibilidad de Producción</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAvailabilityModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <WorkAreaCalendar
                orders={orders}
                onViewOrder={(o) => { setShowAvailabilityModal(false); setViewOrder(o); }}
              />
            </div>
          </div>
        </div>
      )}

      <OrderDetailsModal
        order={viewOrder}
        user={user}
        onClose={() => setViewOrder(null)}
        onProductToggle={handleProductToggle}
      />
    </>
  );
}
  
function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Toaster />
    </BrowserRouter>
  );
}

export default App;