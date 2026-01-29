import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import OrderForm from '@/components/OrderForm';
import OrdersPanel from '@/components/OrdersPanel';
import Stats from '@/components/Stats';
import Login from '@/components/Login';
import Sidebar from '@/components/Sidebar';
import Notifications from '@/components/Notifications';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import ClientForm from '@/components/ClientForm';
import ClientsPanel from '@/components/ClientsPanel';
import WorkAreaList from '@/components/WorkAreaList';
import WorkAreaCalendar from '@/components/WorkAreaCalendar';
import UserManagement from '@/components/UserManagement';
import MyProfile from '@/components/MyProfile';
import RolesPermissions from '@/components/RolesPermissions';
import { supabase } from './supabaseClient';
import StatisticsCharts from '@/components/StatisticsCharts';
import DailyReport from '@/components/DailyReport';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]); 
  const [showForm, setShowForm] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null); 
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [currentView, setCurrentView] = useState('ordenes-todas');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);
  const [showClientFormModal, setShowClientFormModal] = useState(false);
  const [archivedNotifications, setArchivedNotifications] = useState([]);
  const { toast } = useToast();
  const [allowedViews, setAllowedViews] = useState([]); 

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
         if(!views.includes('roles-permisos')) views.push('roles-permisos');
         if(!views.includes('admin-usuarios')) views.push('admin-usuarios');
      }

      setAllowedViews(views);
    };
    fetchPermissions();
  }
  }, [user]);

  useEffect(() => {
    if (orders.length > 0) localStorage.setItem('productionOrders', JSON.stringify(orders));
  }, [orders]);
  
  useEffect(() => {
    if (clients.length > 0) localStorage.setItem('clientsDB', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('archivedNotifications', JSON.stringify(archivedNotifications));
  }, [archivedNotifications]);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

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
      setCurrentView('clientes-lista');
      toast({ title: "✅ Cliente registrado", description: `${clientData.razonSocial} ha sido agregado exitosamente.` });
    }
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
    if (newStatus === 'FINALIZADA' && orders.find(o=>o.id===orderId)?.status === 'ARCHIVADA') msg = "Orden restaurada de archivo";

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

  const handleArchiveNotification = (orderId) => {
    setArchivedNotifications(prev => [...prev, orderId]);
    toast({ description: "Notificación archivada" });
  };

  const handleViewChange = (viewId) => {
    if (viewId === 'ordenes-nueva') {
      setCurrentView('ordenes-todas');
      setShowForm(true);
    } else {
      setCurrentView(viewId);
    }
  };

  const getFilteredOrders = () => {
    switch (currentView) {
      case 'ordenes-todas':
        return orders;
      case 'ordenes-activas':
        return orders.filter(o => o.status !== 'FINALIZADA' && o.status !== 'ANULADA' && o.status !== 'ARCHIVADA');
      case 'ordenes-sin-factura':
        return orders.filter(o => !o.aplicarIva);
      case 'ordenes-con-factura':
        return orders.filter(o => o.aplicarIva);
      case 'ordenes-credito':
        return orders.filter(o => 
          o.formaPagoAnticipo === 'Crédito' || 
          o.formaPagoSaldo === 'Crédito' || 
          o.status === 'CONTABILIDAD'
        );
      case 'ordenes-finalizadas':
        return orders.filter(o => o.status === 'FINALIZADA');
      case 'ordenes-anuladas':
        return orders.filter(o => o.status === 'ANULADA');
      case 'ordenes-archivadas':
        return orders.filter(o => o.status === 'ARCHIVADA');
      default:
        if (currentView.startsWith('ordenes')) return orders;
        return [];
    }
  };

  if (!user) return <><Login onLogin={handleLogin} /><Toaster /></>;

  const showDashboard = (user.role === 'Administrador' || user.role === 'Vendedor') && (currentView === 'inicio' || currentView === 'ordenes-todas');

  const renderContent = () => {
    if (currentView.startsWith('ordenes-')) {
       const filteredOrders = getFilteredOrders();
       return (
          <div className="space-y-6 animate-in fade-in duration-500">
            {showDashboard && <Stats orders={orders} />}
            <OrdersPanel
              orders={filteredOrders}
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
    }

    switch (currentView) {
      case 'estadisticas-graficos':
        return <StatisticsCharts orders={orders} />
      case 'estadisticas-reporte':
        return <DailyReport orders={orders} user={user} />;
      case 'roles-permisos':
        return <RolesPermissions />;
      case 'mi-perfil':
        return <MyProfile user={user} />;
      case 'admin-usuarios':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
              <UserManagement />
          </div>
        );
      case 'inicio':
        return (
           <div className="space-y-6 animate-in fade-in duration-500">
             <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Hola, {user.name}! 👋</h2>
                <p className="text-slate-500">Bienvenido al panel de control. Aquí tienes un resumen de la actividad reciente.</p>
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
        );
      case 'clientes-lista':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-4">
                <h2 className="text-xl font-bold text-slate-800">Gestión de Clientes</h2>
                <p className="text-slate-500 text-sm">Administra la base de datos de clientes.</p>
             </div>
             <ClientsPanel 
                clients={clients} 
                onCreateNew={() => setCurrentView('clientes-nuevo')}
             />
          </div>
        );
      case 'clientes-nuevo':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
             <ClientForm 
                onSubmit={handleCreateClient}
                onCancel={() => setCurrentView('clientes-lista')}
             />
          </div>
        );
      case 'trabajo-listado':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-4">
                <h2 className="text-xl font-bold text-slate-800">Área de Trabajo - Listado</h2>
                <p className="text-slate-500 text-sm">Visualiza tus tareas pendientes en formato de lista.</p>
             </div>
             <WorkAreaList 
                orders={orders} 
                user={user}
                onViewOrder={setViewOrder}
             />
          </div>
        );
      case 'trabajo-disponibilidad':
        return (
          <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-140px)]">
             <WorkAreaCalendar 
                orders={orders} 
                onViewOrder={setViewOrder}
             />
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-in fade-in zoom-in duration-300">
             <div className="p-6 bg-slate-100 rounded-full">
                <Menu className="h-12 w-12 text-slate-400" />
             </div>
             <h2 className="text-xl font-bold text-slate-700">Sección en Construcción</h2>
             <p className="text-slate-500 max-w-md">
               La sección <span className="font-bold text-blue-600">{currentView ? currentView.charAt(0).toUpperCase() + currentView.slice(1) : ''}</span> está siendo desarrollada.
             </p>
             <Button onClick={() => setCurrentView('inicio')} variant="outline">
               Volver al Inicio
             </Button>
          </div>
        );
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 print:bg-white flex">
        <div className="hidden md:block w-64 flex-shrink-0">
           <Sidebar 
             user={user} 
             onLogout={handleLogout} 
             currentView={currentView}
             onViewChange={handleViewChange}
             allowedViews={allowedViews}
           />
        </div>

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

        {isMobileMenuOpen && (
           <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-64 bg-slate-900 h-full shadow-2xl" onClick={e => e.stopPropagation()}>
                <Sidebar 
                  user={user} 
                  onLogout={handleLogout} 
                  currentView={currentView}
                  onViewChange={(view) => { handleViewChange(view); setIsMobileMenuOpen(false); }}
                  allowedViews={allowedViews}
                />
              </div>
           </div>
        )}

        <div className="flex-1 w-full md:w-[calc(100%-16rem)] min-h-screen transition-all duration-300 flex flex-col">
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
              {renderContent()}
           </div>
        </div>
      </div>

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

      {/* Modal rápido de nuevo cliente desde el formulario de orden */}
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

      {/* Modal de Disponibilidad (Calendario) */}
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

      <Toaster />
    </>
  );
}

export default App;
