import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // 🔒 SEGURIDAD
import { Plus, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';

// --- TUS COMPONENTES DE SEGURIDAD ---
import UserManagement from '@/components/UserManagement'; 
import RolesPermissions from '@/components/RolesPermissions'; 

// Componentes Principales
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
import StatisticsCharts from '@/components/StatisticsCharts';
import DailyReport from '@/components/DailyReport';

// Proformas Components
import ProformasPanel from '@/components/ProformasPanel';
import ProformaForm from '@/components/ProformaForm';
import ProformaDetailsModal from '@/components/ProformaDetailsModal';

// Invoices Components
import InvoicesPanel from '@/components/InvoicesPanel';
import InvoiceForm from '@/components/InvoiceForm';
import InvoiceDetailsModal from '@/components/InvoiceDetailsModal';

// Workflows
const WORKFLOW_VPVC = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];
const WORKFLOW_VC = ['VENTAS', 'CONTABILIDAD', 'FINALIZADA'];

function App() {
  const [user, setUser] = useState(null);
  const [allowedViews, setAllowedViews] = useState([]); 
  
  // Data States
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]); 
  const [proformas, setProformas] = useState([]);
  const [kanbanTasks, setKanbanTasks] = useState([]);
  const [invoices, setInvoices] = useState([]); 
  
  // UI States
  const [showForm, setShowForm] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null); 
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [cloningOrder, setCloningOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderSource, setViewOrderSource] = useState(null);

  // UI States - Proformas & Invoices
  const [showProformaForm, setShowProformaForm] = useState(false);
  const [editingProforma, setEditingProforma] = useState(null);
  const [viewProforma, setViewProforma] = useState(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [initialInvoiceOrder, setInitialInvoiceOrder] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);

  // UI States - General
  const [currentView, setCurrentView] = useState('inicio');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showClientFormModal, setShowClientFormModal] = useState(false);
  const [archivedNotifications, setArchivedNotifications] = useState([]);
  
  const [staffUsers, setStaffUsers] = useState([
    { id: '1', name: 'Administrador Principal', role: 'Administrador' },
    { id: '2', name: 'Juan Pérez (Vendedor)', role: 'Vendedor' },
    { id: '3', name: 'Ana Gomez (Vendedor)', role: 'Vendedor' },
    { id: '4', name: 'Carlos Producción', role: 'Producción' },
    { id: '5', name: 'Lucia Contabilidad', role: 'Contabilidad' }
  ]);

  const { toast } = useToast();

  const handlePersistence = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (error) { console.error("Storage Error", error); }
  };

  // --- 🔒 SEGURIDAD: FETCH PERMISOS ---
  const fetchUserPermissions = async (role) => {
    if (role === 'Administrador') return; 
    try {
        const { data, error } = await supabase
            .from('role_permissions')
            .select('allowed_views')
            .eq('role', role)
            .single();
        if (data) setAllowedViews(data.allowed_views || []);
    } catch (error) { console.error("Error permisos:", error); }
  };

  // --- INIT EFFECT ---
  useEffect(() => {
    document.title = "Sistema de Órdenes de Producción";
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        fetchUserPermissions(parsedUser.role);
    }
    
    // Cargar datos locales
    try {
      if(localStorage.getItem('productionOrders')) setOrders(JSON.parse(localStorage.getItem('productionOrders')));
      if(localStorage.getItem('archivedNotifications')) setArchivedNotifications(JSON.parse(localStorage.getItem('archivedNotifications')));
      if(localStorage.getItem('clientsDB')) setClients(JSON.parse(localStorage.getItem('clientsDB')));
      if(localStorage.getItem('proformasDB')) setProformas(JSON.parse(localStorage.getItem('proformasDB')));
      if(localStorage.getItem('kanbanTasksDB')) setKanbanTasks(JSON.parse(localStorage.getItem('kanbanTasksDB')));
      if(localStorage.getItem('invoicesDB')) setInvoices(JSON.parse(localStorage.getItem('invoicesDB')));
    } catch (error) { console.error(error); }
  }, []);

  // --- Persistence Effects ---
  useEffect(() => handlePersistence('productionOrders', orders), [orders]);
  useEffect(() => { if (clients.length > 0) handlePersistence('clientsDB', clients); }, [clients]);
  useEffect(() => handlePersistence('archivedNotifications', archivedNotifications), [archivedNotifications]);
  useEffect(() => handlePersistence('proformasDB', proformas), [proformas]);
  useEffect(() => handlePersistence('kanbanTasksDB', kanbanTasks), [kanbanTasks]);
  useEffect(() => handlePersistence('invoicesDB', invoices), [invoices]);

  // --- LOGIN/LOGOUT ---
  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    fetchUserPermissions(userData.role);
  };

  const handleLogout = () => {
    setUser(null);
    setAllowedViews([]);
    localStorage.removeItem('currentUser');
  };

  // --- Handlers ---
  const handleKanbanCreate = (taskData) => {
     const newTask = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...taskData };
     setKanbanTasks(prev => [...prev, newTask]);
     toast({ title: "Tarea creada", description: "Se ha añadido a la columna." });
  };
  const handleKanbanUpdate = (taskId, updates) => setKanbanTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  const handleKanbanDelete = (taskId) => setKanbanTasks(prev => prev.filter(t => t.id !== taskId));

  const getNextOrderNumber = () => {
    if (orders.length === 0) return 1;
    return Math.max(...orders.map(o => parseInt(o.orderNumber || 0))) + 1;
  };
  const getNextProformaNumber = () => {
    if (proformas.length === 0) return 1;
    return Math.max(...proformas.map(p => parseInt(p.proformaNumber || 0))) + 1;
  };
  const getNextInvoiceNumber = () => {
    if (invoices.length === 0) return 1;
    return Math.max(...invoices.map(inv => parseInt(inv.sequential || 0))) + 1;
  };
  const formatOrderNumberForDisplay = (num) => num.toString().padStart(7, '0');

  const handleCreateOrder = (orderData) => {
    const orderNumber = orderData.orderNumber || getNextOrderNumber();
    const newOrder = { ...orderData, id: orderData.id || Date.now().toString(), orderNumber, status: 'VENTAS', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setOrders(prev => [newOrder, ...prev]);
    setShowForm(false);
    setCloningOrder(null);
    toast({ title: "✅ Orden creada", description: `Orden #${formatOrderNumberForDisplay(newOrder.orderNumber)} registrada` });
  };
  const handleUpdateOrder = (id, data) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...data, updatedAt: new Date().toISOString() } : o));
    setEditingOrder(null); setPaymentOrder(null);
    if (viewOrder && viewOrder.id === id) setViewOrder(prev => ({ ...prev, ...data, updatedAt: new Date().toISOString() }));
    toast({ title: "💾 Actualizado", description: "Los cambios han sido guardados" });
  };
  const handleStatusChange = (id, status) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o));
    if (viewOrder && viewOrder.id === id) setViewOrder(prev => ({ ...prev, status }));
    toast({ title: "Estado actualizado", description: status });
  };
  const handleDeleteOrder = (id) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    toast({ title: "Eliminado", description: "Orden borrada." });
  };
  const handleCloneOrder = (order) => {
    const { id, createdAt, updatedAt, ...rest } = order;
    setCloningOrder({ ...rest, orderNumber: getNextOrderNumber(), status: 'VENTAS', anticipo: 0, financials: { ...rest.financials, saldo: rest.financials?.total || 0 } });
  };

  const handleCreateProforma = (data) => {
    setProformas(prev => [{ ...data, id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev]);
    setShowProformaForm(false);
  };
  const handleUpdateProforma = (data) => {
     setProformas(prev => prev.map(p => p.id === data.id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p));
     setEditingProforma(null);
     if (viewProforma?.id === data.id) setViewProforma({ ...viewProforma, ...data });
     toast({ title: "Proforma Actualizada" });
  };
  const handleDeleteProforma = (id) => setProformas(prev => prev.filter(p => p.id !== id));
  const handleConvertProformaToOrder = (proforma) => {
    const newOrder = {
      id: Date.now().toString(), orderNumber: getNextOrderNumber(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'VENTAS',
      cliente: proforma.clienteData?.razonSocial || 'Cliente', clienteId: proforma.cliente, tipoLetrero: `PROFORMA #${proforma.proformaNumber}`, tipoOrden: 'VENTA CON PRODUCCION (VPVC)',
      productos: proforma.items.map(item => ({ descripcion: item.producto, cantidad: item.cantidad, precio: item.precioUnitario, completed: false })),
      financials: { subtotal: proforma.financials.subtotal, iva: proforma.financials.impuesto, total: proforma.financials.total, saldo: proforma.saldoMonto },
      anticipo: proforma.anticipoMonto, formaPagoAnticipo: proforma.formaPago, origenProformaId: proforma.proformaNumber, vendedor: proforma.responsable, notas: proforma.notasInternas, aplicarIva: proforma.financials.impuesto > 0
    };
    setOrders(prev => [newOrder, ...prev]);
    handleUpdateProforma({ ...proforma, status: 'APROBADA', convertedToOrderId: newOrder.orderNumber });
    setViewProforma(null);
    toast({ title: "✅ Conversión Exitosa", description: `Orden #${newOrder.orderNumber} creada.` });
    setCurrentView('ordenes-todas');
  };

  const handleCreateInvoice = (data) => {
     setInvoices(prev => [{ ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...prev]);
     setShowInvoiceForm(false); setInitialInvoiceOrder(null);
     toast({ title: "Factura Emitida" });
  };
  const handleAnulateInvoice = (inv) => {
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'ANULADA' } : i));
    if (viewInvoice?.id === inv.id) setViewInvoice(prev => ({ ...prev, status: 'ANULADA' }));
    toast({ title: "Factura Anulada" });
  };
  const handleGenerateInvoiceFromOrder = (order) => { setInitialInvoiceOrder(order); setViewOrder(null); setShowInvoiceForm(true); };

  const handleCreateClient = (data) => {
    const newClient = { id: Date.now().toString(), ...data, createdAt: new Date().toISOString() };
    setClients(prev => [newClient, ...prev]);
    setShowClientFormModal(false);
    toast({ title: "Cliente registrado" });
  };

  const handleProductToggle = (order, idx) => {
    if (user.role !== 'Producción') return;
    const prods = [...order.productos]; prods[idx].completed = !prods[idx].completed;
    const upd = { ...order, productos: prods };
    setOrders(prev => prev.map(o => o.id === order.id ? upd : o));
    if (viewOrder?.id === order.id) setViewOrder(upd);
  };
  const handleArchiveNotification = (id) => { setArchivedNotifications(prev => [...prev, id]); toast({ description: "Archivada" }); };
  const handleViewOrder = (o, src) => { setViewOrder(o); setViewOrderSource(src); };
  const handleViewChange = (v) => { if (v === 'ordenes-nueva') { setCurrentView('ordenes-todas'); setShowForm(true); } else setCurrentView(v); };
  const handleAdvanceWorkflow = (order) => {
    const flow = (order.tipoOrden && order.tipoOrden.includes('(VC)')) ? WORKFLOW_VC : WORKFLOW_VPVC;
    const idx = flow.indexOf(order.status);
    if (idx !== -1 && idx < flow.length - 1) handleStatusChange(order.id, flow[idx + 1]);
  };
  const handleArchiveOrder = (order) => { handleStatusChange(order.id, 'ARCHIVADA'); setViewOrder(null); };

  if (!user) return <><Login onLogin={handleLogin} /><Toaster /></>;

  const showDashboard = (user.role === 'Administrador' || user.role === 'Vendedor') && (currentView === 'inicio');

  // --- RENDERIZADO DE VISTAS ---
  const renderContent = () => {
    if (currentView === 'admin-usuarios') return <UserManagement />;
    if (currentView === 'roles-permisos') return <RolesPermissions />;

    if (currentView === 'facturacion-panel') return <div className="space-y-6 animate-in fade-in"><InvoicesPanel invoices={invoices} onViewInvoice={setViewInvoice} onAnulateInvoice={handleAnulateInvoice}/></div>;
    if (currentView === 'proformas') return <div className="space-y-6 animate-in fade-in"><ProformasPanel proformas={proformas} clients={clients} user={user} onCreateNew={() => setShowProformaForm(true)} onViewProforma={setViewProforma} onEditProforma={setEditingProforma} onDeleteProforma={handleDeleteProforma} onConvertToOrder={handleConvertProformaToOrder}/></div>;

    if (currentView === 'estadisticas-reporte') return <DailyReport orders={orders} user={user} />;
    if (currentView === 'clientes-lista') return <div className="space-y-6"><div className="bg-white p-6 rounded-xl shadow-sm border mb-4"><h2 className="text-xl font-bold">Gestión de Clientes</h2></div><ClientsPanel /></div>;

    if (currentView.startsWith('ordenes-')) {
       let filtered = orders.filter(o => o.status !== 'ARCHIVADA');
       if (currentView === 'ordenes-sin-factura') filtered = filtered.filter(o => !o.aplicarIva);
       if (currentView === 'ordenes-con-factura') filtered = filtered.filter(o => o.aplicarIva);
       if (currentView === 'ordenes-anuladas') filtered = orders.filter(o => o.status === 'ANULADA');
       if (currentView === 'ordenes-archivadas') filtered = orders.filter(o => o.status === 'ARCHIVADA');

       return (
          <div className="space-y-6 animate-in fade-in">
            {showDashboard && <Stats orders={orders} />}
            <OrdersPanel
              orders={filtered}
              user={user}
              onUpdateStatus={handleStatusChange}
              onDeleteOrder={handleDeleteOrder}
              onUpdateOrder={(id, d) => handleUpdateOrder(id, d)}
              onEditOrder={setEditingOrder}
              onCloneOrder={handleCloneOrder}
              onPaymentOrder={setPaymentOrder}
              onCreateOrder={() => setShowForm(true)}
              onViewOrder={(o) => handleViewOrder(o, null)} 
              currentView={currentView}
            />
          </div>
       );
    }

    switch (currentView) {
      case 'inicio':
        return (
           <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Hola, {user.name}! 👋</h2>
                <p className="text-slate-500">Sistema Seguro Fusionado.</p>
             </div>
             <Stats orders={orders} />
             
             {/* --- AQUI HEMOS ELIMINADO EL OrdersPanel (TABLA Y BOTON) --- */}
             {/* Solo mostramos desde WorkAreaList hacia abajo */}

             <div className="mt-8">
               <WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='list' />
             </div>
           </div>
        );
      case 'clientes-nuevo': return <div className="space-y-6 animate-in fade-in"><ClientForm onSubmit={handleCreateClient} onCancel={() => setCurrentView('clientes-lista')}/></div>;
      case 'trabajo-listado': return <div className="space-y-6 animate-in fade-in"><div className="bg-white p-6 rounded-xl shadow-sm border mb-4"><h2 className="text-xl font-bold">Área de Trabajo - Listado</h2></div><WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='list' /></div>;
      case 'trabajo-mistareas': return <div className="space-y-6 animate-in fade-in"><div className="bg-white p-6 rounded-xl shadow-sm border mb-4"><h2 className="text-xl font-bold">Área de Trabajo - Tablero</h2></div><WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='board' /></div>;
      case 'trabajo-disponibilidad': return <div className="space-y-6 animate-in fade-in h-[calc(100vh-140px)]"><WorkAreaCalendar orders={orders} onViewOrder={(o) => handleViewOrder(o, 'tasks')} /></div>;
      case 'estadisticas-graficos': return <StatisticsCharts orders={orders} />;
      default: return <div className="p-10 text-center">Seleccione una opción</div>;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex">
        <div className="hidden md:block w-64 flex-shrink-0">
           <Sidebar user={user} onLogout={handleLogout} currentView={currentView} onViewChange={handleViewChange} allowedViews={allowedViews} />
        </div>

        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 text-white p-4 flex justify-between items-center shadow-md print:hidden">
           <span className="font-bold">Sistema Producción</span>
           <div className="flex items-center gap-3">
             <Notifications user={user} orders={orders} archivedIds={archivedNotifications} onArchive={handleArchiveNotification} onViewOrder={(o) => handleViewOrder(o, 'tasks')} />
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu className="h-6 w-6" /></button>
           </div>
        </div>
        {isMobileMenuOpen && (
           <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-64 bg-slate-900 h-full shadow-2xl" onClick={e => e.stopPropagation()}>
                <Sidebar user={user} onLogout={handleLogout} currentView={currentView} onViewChange={(view) => { handleViewChange(view); setIsMobileMenuOpen(false); }} allowedViews={allowedViews} />
              </div>
           </div>
        )}

        <div className="flex-1 w-full md:w-[calc(100%-16rem)] min-h-screen transition-all duration-300 flex flex-col">
           <div className="hidden md:flex bg-white border-b border-slate-200 h-16 px-8 items-center justify-end sticky top-0 z-20 shadow-sm print:hidden">
              <div className="flex items-center gap-4">
                 <Notifications user={user} orders={orders} archivedIds={archivedNotifications} onArchive={handleArchiveNotification} onViewOrder={(o) => handleViewOrder(o, 'tasks')} />
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <OrderForm currentUser={user} clients={clients} staffUsers={staffUsers} onSubmit={handleCreateOrder} onCancel={() => setShowForm(false)} mode="create" nextOrderNumber={getNextOrderNumber()} onCheckAvailability={() => setShowAvailabilityModal(true)} onCreateClient={() => setShowClientFormModal(true)} />
          </div>
        </div>
      )}
      
      {cloningOrder && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCloningOrder(null)}><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}><OrderForm currentUser={user} clients={clients} staffUsers={staffUsers} initialData={cloningOrder} onSubmit={handleCreateOrder} onCancel={() => setCloningOrder(null)} mode="create" nextOrderNumber={getNextOrderNumber()} onCheckAvailability={() => setShowAvailabilityModal(true)} onCreateClient={() => setShowClientFormModal(true)} /></div></div>)}
      {editingOrder && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingOrder(null)}><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}><OrderForm currentUser={user} clients={clients} staffUsers={staffUsers} initialData={editingOrder} onSubmit={(data) => handleUpdateOrder(editingOrder.id, data)} onCancel={() => setEditingOrder(null)} mode="edit" onCheckAvailability={() => setShowAvailabilityModal(true)} onCreateClient={() => setShowClientFormModal(true)} /></div></div>)}
      {paymentOrder && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPaymentOrder(null)}><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}><OrderForm currentUser={user} clients={clients} staffUsers={staffUsers} initialData={paymentOrder} onSubmit={(data) => handleUpdateOrder(paymentOrder.id, data)} onCancel={() => setPaymentOrder(null)} mode="payment_only" /></div></div>)}
      
      {showProformaForm && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProformaForm(false)}><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}><ProformaForm currentUser={user} clients={clients} staffUsers={staffUsers} onSubmit={handleCreateProforma} onCancel={() => setShowProformaForm(false)} mode="create" nextProformaNumber={getNextProformaNumber()} /></div></div>)}
      {editingProforma && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingProforma(null)}><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}><ProformaForm currentUser={user} clients={clients} staffUsers={staffUsers} initialData={editingProforma} onSubmit={handleUpdateProforma} onCancel={() => setEditingProforma(null)} mode="edit" /></div></div>)}
      {viewProforma && (<ProformaDetailsModal proforma={viewProforma} onClose={() => setViewProforma(null)} onEdit={(p) => { setViewProforma(null); setEditingProforma(p); }} onConvert={handleConvertProformaToOrder} onUpdateProforma={(updatedData) => handleUpdateProforma({ id: viewProforma.id, ...updatedData })} user={user} staffUsers={staffUsers} />)}

      {showInvoiceForm && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowInvoiceForm(false)}><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto h-full" onClick={e => e.stopPropagation()}><InvoiceForm user={user} initialOrder={initialInvoiceOrder} nextInvoiceNumber={getNextInvoiceNumber()} onSubmit={handleCreateInvoice} onCancel={() => { setShowInvoiceForm(false); setInitialInvoiceOrder(null); }} /></div></div>)}
      {viewInvoice && (<InvoiceDetailsModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} onAnulate={handleAnulateInvoice} onViewOrder={(orderId) => { const order = orders.find(o => o.id === orderId || o.orderNumber == orderId); if(order) { setViewInvoice(null); handleViewOrder(order); } }} />)}

      {showClientFormModal && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"><div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 relative"><button onClick={() => setShowClientFormModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button><h3 className="text-lg font-bold mb-4">Registrar Nuevo Cliente</h3><ClientForm onSubmit={handleCreateClient} onCancel={() => setShowClientFormModal(false)} /></div></div>)}
      {showAvailabilityModal && (<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"><div className="w-full max-w-5xl bg-white h-[85vh] rounded-xl shadow-2xl flex flex-col"><div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl"><h3 className="font-bold text-lg">Disponibilidad</h3><Button variant="ghost" size="icon" onClick={() => setShowAvailabilityModal(false)}><X className="h-5 w-5" /></Button></div><div className="flex-1 overflow-hidden p-4"><WorkAreaCalendar orders={orders} onViewOrder={(o) => { setShowAvailabilityModal(false); handleViewOrder(o, 'tasks'); }} /></div></div></div>)}

      <OrderDetailsModal order={viewOrder} user={user} staffUsers={staffUsers} onClose={() => setViewOrder(null)} onProductToggle={handleProductToggle} isTaskView={viewOrderSource === 'tasks'} onAdvanceWorkflow={handleAdvanceWorkflow} onArchiveOrder={handleArchiveOrder} onUpdateOrder={handleUpdateOrder} onGenerateInvoice={handleGenerateInvoiceFromOrder} />
      <Toaster />
    </>
  );
}

export default App; 