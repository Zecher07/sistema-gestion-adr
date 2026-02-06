import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // 🔒 CONEXIÓN DB
import { Menu, Settings, X } from 'lucide-react'; // Agregué X aquí que faltaba
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';

// --- COMPONENTES DE SEGURIDAD Y ADMIN ---
import UserManagement from '@/components/UserManagement'; 
import RolesPermissions from '@/components/RolesPermissions'; 
import Login from '@/components/Login';
import AnulationConfig from '@/components/AnulationConfig';

// --- COMPONENTES PRINCIPALES ---
import Sidebar from '@/components/Sidebar';
import Stats from '@/components/Stats';
import Notifications from '@/components/Notifications';
import DailyReport from '@/components/DailyReport';
import StatisticsCharts from '@/components/StatisticsCharts';

// --- MÓDULO ÓRDENES Y TRABAJO ---
import OrdersPanel from '@/components/OrdersPanel';
import OrderForm from '@/components/OrderForm';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import WorkAreaList from '@/components/WorkAreaList';
import WorkAreaCalendar from '@/components/WorkAreaCalendar';

// --- MÓDULO CLIENTES ---
import ClientsPanel from '@/components/ClientsPanel';
import ClientForm from '@/components/ClientForm';

// --- MÓDULO FACTURACIÓN Y PROFORMAS ---
import ProformasPanel from '@/components/ProformasPanel';
import ProformaForm from '@/components/ProformaForm';
import ProformaDetailsModal from '@/components/ProformaDetailsModal';
import InvoicesPanel from '@/components/InvoicesPanel';
import InvoiceForm from '@/components/InvoiceForm';
import InvoiceDetailsModal from '@/components/InvoiceDetailsModal';

// Flujos de trabajo
const WORKFLOW_VPVC = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];
const WORKFLOW_VC = ['VENTAS', 'CONTABILIDAD', 'FINALIZADA'];

// --- LISTA DE EMPLEADOS FIJA (PARA EVITAR ERROR DE DB) ---
const FIXED_STAFF = [
  { id: 1, name: 'Administrador Principal', role: 'Administrador' },
  { id: 2, name: 'Juan Pérez', role: 'Vendedor' },
  { id: 3, name: 'Ana Gomez', role: 'Vendedor' },
  { id: 4, name: 'Carlos Producción', role: 'Producción' },
  { id: 5, name: 'Lucia Contabilidad', role: 'Contabilidad' }
];

function App() {
  // --- ESTADOS DE SESIÓN ---
  const [user, setUser] = useState(null);
  const [allowedViews, setAllowedViews] = useState([]); 
  
  // --- ESTADOS DE DATOS (DB) ---
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]); 
  const [proformas, setProformas] = useState([]);
  const [invoices, setInvoices] = useState([]); 
  const [kanbanTasks, setKanbanTasks] = useState([]);
  
  // --- ESTADOS DE UI ---
  const [currentView, setCurrentView] = useState('inicio');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showClientFormModal, setShowClientFormModal] = useState(false);
  const [archivedNotifications, setArchivedNotifications] = useState([]);

  // Modales
  const [editingOrder, setEditingOrder] = useState(null); 
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [cloningOrder, setCloningOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderSource, setViewOrderSource] = useState(null);

  const [showProformaForm, setShowProformaForm] = useState(false);
  const [editingProforma, setEditingProforma] = useState(null);
  const [viewProforma, setViewProforma] = useState(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [initialInvoiceOrder, setInitialInvoiceOrder] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  
  // Usamos la lista fija por defecto
  const [staffUsers, setStaffUsers] = useState(FIXED_STAFF);
  const { toast } = useToast();

  // ESTADO DE PERMISO DE ANULACIÓN
  const [canUserAnulate, setCanUserAnulate] = useState(false);

  // --- 1. FUNCIÓN MAESTRA DE CARGA DE DATOS (CON CRUCE DE RUC) ---
  const fetchAllData = async (userOverride = null) => {
    try {
      const currentUser = userOverride || user; 

      // 1. Cargar Clientes PRIMERO (Necesitamos sus datos para cruzar)
      const { data: clientesData } = await supabase.from('clientes').select('*').order('nombre', { ascending: true });
      if (clientesData) setClients(clientesData);

      // 2. Cargar Órdenes
      const { data: ordenesData } = await supabase.from('ordenes').select('*').order('created_at', { ascending: false });
      
      // 3. ENRIQUECER ÓRDENES (Aquí sucede la magia)
      // Cruzamos los datos: Buscamos el cliente de la orden y le pegamos su RUC/Cédula a la orden
      if (ordenesData && clientesData) {
        const ordenesConRuc = ordenesData.map(orden => {
          // Buscamos el cliente que coincida con el nombre guardado en la orden
          // (Si guardas cliente_id, cambia 'nombre' por 'id')
          const clienteEncontrado = clientesData.find(c => c.nombre === orden.cliente);
          
          return {
            ...orden,
            // Agregamos los campos del cliente a la orden temporalmente
            ruc: clienteEncontrado ? (clienteEncontrado.ruc || clienteEncontrado.cedula || '') : '',
            cedula: clienteEncontrado ? (clienteEncontrado.cedula || '') : '',
            telefono: clienteEncontrado ? (clienteEncontrado.telefono || '') : ''
          };
        });
        
        setOrders(ordenesConRuc);
      } else if (ordenesData) {
        setOrders(ordenesData);
      }

      // C. Cargar Usuarios (Staff) - Lista Fija
      setStaffUsers(FIXED_STAFF);

      // D. VERIFICACIÓN DE PERMISOS
      if (currentUser) {
          if (currentUser.role === 'Administrador') {
              setCanUserAnulate(true);
          } else {
              const { data: roleData } = await supabase
                  .from('role_permissions')
                  .select('can_anulate')
                  .eq('role', currentUser.role)
                  .maybeSingle();
              
              setCanUserAnulate(!!roleData?.can_anulate);
          }
      }
      
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  // --- 2. EFECTOS ---
  useEffect(() => {
    document.title = "Sistema de Órdenes de Producción";
    
    let loadedUser = null;
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        loadedUser = JSON.parse(savedUser);
        setUser(loadedUser);
        fetchUserPermissions(loadedUser.role);
    }

    fetchAllData(loadedUser);

    // Carga de datos locales (legacy)
    try {
      if(localStorage.getItem('archivedNotifications')) setArchivedNotifications(JSON.parse(localStorage.getItem('archivedNotifications')));
      if(localStorage.getItem('proformasDB')) setProformas(JSON.parse(localStorage.getItem('proformasDB')));
      if(localStorage.getItem('kanbanTasksDB')) setKanbanTasks(JSON.parse(localStorage.getItem('kanbanTasksDB')));
      if(localStorage.getItem('invoicesDB')) setInvoices(JSON.parse(localStorage.getItem('invoicesDB')));
    } catch (e) { console.error(e); }
  }, []);

  // Persistencia local
  useEffect(() => { localStorage.setItem('archivedNotifications', JSON.stringify(archivedNotifications)); }, [archivedNotifications]);
  useEffect(() => { localStorage.setItem('proformasDB', JSON.stringify(proformas)); }, [proformas]);
  useEffect(() => { localStorage.setItem('kanbanTasksDB', JSON.stringify(kanbanTasks)); }, [kanbanTasks]);
  useEffect(() => { localStorage.setItem('invoicesDB', JSON.stringify(invoices)); }, [invoices]);

  // --- NUEVO: EFECTO REACTIVO PARA PERMISOS ---
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) {
        setCanUserAnulate(false);
        return;
      }
      if (user.role === 'Administrador') {
        setCanUserAnulate(true);
      } else {
        const { data } = await supabase
          .from('role_permissions') 
          .select('can_anulate')
          .eq('role', user.role)
          .maybeSingle();
        setCanUserAnulate(!!data?.can_anulate);
      }
    };
    checkPermissions();
  }, [user]);


  // --- HELPERS ---
  const fetchUserPermissions = async (role) => {
    if (role === 'Administrador') return; 
    try {
        const { data } = await supabase.from('role_permissions').select('allowed_views').eq('role', role).single();
        if (data) setAllowedViews(data.allowed_views || []);
    } catch (error) { console.error(error); }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('currentUser', JSON.stringify(userData));
    fetchUserPermissions(userData.role);
    fetchAllData(userData); 
  };

  const handleLogout = () => {
    setUser(null);
    setAllowedViews([]);
    localStorage.removeItem('currentUser');
  };

  // --- ACTION HANDLERS ---
  const handleOrderSuccess = () => {
    fetchAllData(); 
    setShowForm(false);
    setEditingOrder(null);
    setPaymentOrder(null);
    setCloningOrder(null);
  };

  const handleClientSuccess = () => {
    fetchAllData();
    setShowClientFormModal(false);
  };

  const getNextOrderNumber = () => {
    if (orders.length === 0) return 1;
    const nums = orders.map(o => parseInt(o.order_number || o.orderNumber || 0));
    return Math.max(...nums) + 1;
  };
  
  // Helpers para proformas y facturas (mocks simples si no usan DB sequence)
  const getNextProformaNumber = () => {
      if (proformas.length === 0) return 1;
      return Math.max(...proformas.map(p => parseInt(p.number || 0))) + 1;
  };
  const getNextInvoiceNumber = () => {
      if (invoices.length === 0) return 1;
      return Math.max(...invoices.map(i => parseInt(i.number || 0))) + 1;
  };

  // Handlers Locales
  const handleKanbanCreate = (t) => { setKanbanTasks(prev => [...prev, { id: Date.now().toString(), createdAt: new Date().toISOString(), ...t }]); toast({title: "Tarea creada"}); };
  const handleKanbanUpdate = (id, up) => setKanbanTasks(prev => prev.map(t => t.id === id ? { ...t, ...up } : t));
  const handleKanbanDelete = (id) => setKanbanTasks(prev => prev.filter(t => t.id !== id));
  
  const handleCreateProforma = (d) => { setProformas(p => [{ ...d, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...p]); setShowProformaForm(false); };
  const handleUpdateProforma = (d) => { setProformas(p => p.map(x => x.id === d.id ? { ...x, ...d } : x)); setEditingProforma(null); if(viewProforma?.id === d.id) setViewProforma({...viewProforma, ...d}); };
  const handleDeleteProforma = (id) => setProformas(p => p.filter(x => x.id !== id));
  
  const handleCreateInvoice = (d) => { setInvoices(p => [{ ...d, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...p]); setShowInvoiceForm(false); setInitialInvoiceOrder(null); };
  const handleAnulateInvoice = (inv) => { setInvoices(p => p.map(i => i.id === inv.id ? { ...i, status: 'ANULADA' } : i)); if(viewInvoice?.id === inv.id) setViewInvoice(prev => ({...prev, status: 'ANULADA'})); };

  const handleConvertProformaToOrder = (proforma) => {
      // Lógica de conversión simple
      toast({title: "Convertir", description: "Función de convertir proforma a orden pendiente."});
  };

  const handleViewChange = (v) => { 
    if (v === 'ordenes-nueva') { setCurrentView('ordenes-todas'); setShowForm(true); } 
    else setCurrentView(v); 
  };
  const handleArchiveNotification = (id) => { setArchivedNotifications(prev => [...prev, id]); };
  const handleViewOrder = (o, src) => { setViewOrder(o); setViewOrderSource(src); };
  
  const handleProductToggle = (order, idx) => {
    if (user.role !== 'Producción') return;
  };

  const handleAdvanceWorkflow = async (order) => {
    const flow = (order.tipo_trabajo?.includes('(VC)') || order.tipoOrden?.includes('(VC)')) ? WORKFLOW_VC : WORKFLOW_VPVC;
    const currentStatus = order.status;
    const idx = flow.indexOf(currentStatus);
    if (idx !== -1 && idx < flow.length - 1) {
        const nextStatus = flow[idx + 1];
        const { error } = await supabase.from('ordenes').update({ status: nextStatus }).eq('id', order.id);
        if(!error) {
            fetchAllData();
            toast({ title: "Estado Actualizado", description: `Orden movida a ${nextStatus}` });
        }
    }
  };

  const handleArchiveOrder = async (order) => { 
      await supabase.from('ordenes').update({ status: 'ARCHIVADA' }).eq('id', order.id);
      fetchAllData();
      setViewOrder(null);
      toast({ title: "Orden Archivada" });
  };

  const handleAnulateOrder = async (orderId) => {
      try {
          const { error } = await supabase.from('ordenes').update({ status: 'ANULADA' }).eq('id', orderId);
          if (error) throw error;
          toast({ title: "Orden Anulada", description: "El estado ha cambiado a ANULADA correctamente." });
          fetchAllData();
          setViewOrder(null);
      } catch (error) {
          console.error(error);
          toast({ title: "Error", description: "No se pudo anular la orden.", variant: "destructive" });
      }
  };

  // --- RENDERIZADO ---
  if (!user) return <><Login onLogin={handleLogin} /><Toaster /></>;

  const renderContent = () => {
    if (currentView === 'admin-usuarios') return <UserManagement />;
    if (currentView === 'roles-permisos') return <RolesPermissions />;
    if (currentView === 'facturacion-panel') return <InvoicesPanel invoices={invoices} onViewInvoice={setViewInvoice} onAnulateInvoice={handleAnulateInvoice}/>;
    if (currentView === 'proformas') return <ProformasPanel proformas={proformas} clients={clients} user={user} onCreateNew={() => setShowProformaForm(true)} onViewProforma={setViewProforma} onEditProforma={setEditingProforma} onDeleteProforma={handleDeleteProforma} />;
    
    // REPORTE DIARIO (Actualizado para funcionar con orders y user)
    if (currentView === 'estadisticas-reporte') return <DailyReport orders={orders} user={user} />;
    
    if (currentView === 'clientes-lista') return <ClientsPanel />;

    // CONFIGURACIÓN
    if (currentView === 'configuracion') return <AnulationConfig />;

    if (currentView.startsWith('ordenes-')) {
       let filtered = orders.filter(o => o.status !== 'ARCHIVADA');
       if (currentView === 'ordenes-sin-factura') filtered = filtered.filter(o => !o.financials?.iva);
       if (currentView === 'ordenes-con-factura') filtered = filtered.filter(o => o.financials?.iva > 0);
       if (currentView === 'ordenes-archivadas') filtered = orders.filter(o => o.status === 'ARCHIVADA');

       return (
          <div className="space-y-6 animate-in fade-in">
            {(user.role === 'Administrador' || user.role === 'Vendedor') && <Stats orders={orders} />}
            <OrdersPanel
              orders={filtered}
              user={user}
              onUpdateStatus={() => {}} 
              onDeleteOrder={async (id) => { await supabase.from('ordenes').delete().eq('id', id); fetchAllData(); }}
              onEditOrder={setEditingOrder}
              onCloneOrder={setCloningOrder}
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
             <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Hola, {user.name}! 👋</h2>
                    <p className="text-slate-500">Panel de Control General</p>
                </div>
                {/* BOTÓN CONFIGURACIÓN (Solo Admin) */}
                {user.role === 'Administrador' && (
                    <Button variant="outline" onClick={() => setCurrentView('configuracion')} className="gap-2">
                        <Settings className="h-4 w-4" /> Configurar Permisos
                    </Button>
                )}
             </div>
             <Stats orders={orders} />
             <div className="mt-8">
               <WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='list' />
             </div>
           </div>
        );
      case 'clientes-nuevo': return <ClientForm onSuccess={handleClientSuccess} onCancel={() => setCurrentView('clientes-lista')}/>;
      case 'trabajo-listado': return <div className="space-y-4"><h2 className="text-xl font-bold">Listado de Trabajo</h2><WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='list' /></div>;
      case 'trabajo-mistareas': return <div className="space-y-4"><h2 className="text-xl font-bold">Tablero Kanban</h2><WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='board' /></div>;
      case 'trabajo-disponibilidad': return <div className="h-[calc(100vh-140px)]"><WorkAreaCalendar orders={orders} onViewOrder={(o) => handleViewOrder(o, 'tasks')} /></div>;
      case 'estadisticas-graficos': return <StatisticsCharts orders={orders} />;
      default: return <div className="p-10 text-center text-slate-500">Seleccione una opción del menú lateral.</div>;
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

      {/* MODALES */}
      {(showForm || cloningOrder || editingOrder) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"> 
          <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto">
            <OrderForm 
                currentUser={user} clients={clients} staffUsers={staffUsers} 
                onSuccess={handleOrderSuccess} 
                onCancel={() => { setShowForm(false); setCloningOrder(null); setEditingOrder(null); }} 
                initialData={editingOrder || cloningOrder} 
                nextOrderNumber={getNextOrderNumber()} 
                onCheckAvailability={() => setShowAvailabilityModal(true)} 
                onReloadClients={fetchAllData}
            />
          </div>
        </div>
      )}

      {paymentOrder && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto">
                <OrderForm 
                    currentUser={user} clients={clients} staffUsers={staffUsers} 
                    initialData={paymentOrder} onSuccess={handleOrderSuccess} onCancel={() => setPaymentOrder(null)} 
                    mode="payment_only"
                />
            </div>
         </div>
      )}

      {showClientFormModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 relative">
                <button onClick={() => setShowClientFormModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                <h3 className="text-lg font-bold mb-4">Registrar Nuevo Cliente</h3>
                <ClientForm onSuccess={handleClientSuccess} onCancel={() => setShowClientFormModal(false)} />
            </div>
        </div>
      )}

      {(showProformaForm || editingProforma) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto">
                <ProformaForm 
                    currentUser={user} clients={clients} staffUsers={staffUsers} 
                    initialData={editingProforma}
                    onSubmit={editingProforma ? handleUpdateProforma : handleCreateProforma} 
                    onCancel={() => { setShowProformaForm(false); setEditingProforma(null); }} 
                    nextProformaNumber={getNextProformaNumber()} 
                />
            </div>
        </div>
      )}

      {showInvoiceForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto h-full">
                <InvoiceForm 
                    user={user} initialOrder={initialInvoiceOrder} nextInvoiceNumber={getNextInvoiceNumber()} 
                    onSubmit={handleCreateInvoice} onCancel={() => { setShowInvoiceForm(false); setInitialInvoiceOrder(null); }} 
                />
            </div>
        </div>
      )}

      {viewProforma && (<ProformaDetailsModal proforma={viewProforma} onClose={() => setViewProforma(null)} onEdit={(p) => { setViewProforma(null); setEditingProforma(p); }} onConvert={(p) => handleConvertProformaToOrder(p)} onUpdateProforma={(d) => handleUpdateProforma({ id: viewProforma.id, ...d })} user={user} staffUsers={staffUsers} />)}
      {viewInvoice && (<InvoiceDetailsModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} onAnulate={handleAnulateInvoice} onViewOrder={(id) => { const o = orders.find(x => x.id === id || x.orderNumber == id || x.order_number == id); if(o) { setViewInvoice(null); handleViewOrder(o); } }} />)}
      {showAvailabilityModal && (<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"><div className="w-full max-w-5xl bg-white h-[85vh] rounded-xl shadow-2xl flex flex-col"><div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl"><h3 className="font-bold text-lg">Disponibilidad</h3><Button variant="ghost" size="icon" onClick={() => setShowAvailabilityModal(false)}><X className="h-5 w-5" /></Button></div><div className="flex-1 overflow-hidden p-4"><WorkAreaCalendar orders={orders} onViewOrder={(o) => { setShowAvailabilityModal(false); handleViewOrder(o, 'tasks'); }} /></div></div></div>)}

      {/* MODAL DETALLE DE ORDEN */}
      <OrderDetailsModal 
        order={viewOrder} 
        user={user} 
        staffUsers={staffUsers} 
        onClose={() => setViewOrder(null)} 
        onProductToggle={handleProductToggle} 
        isTaskView={viewOrderSource === 'tasks'} 
        onAdvanceWorkflow={handleAdvanceWorkflow} 
        onArchiveOrder={handleArchiveOrder} 
        onUpdateOrder={() => { setEditingOrder(viewOrder); setViewOrder(null); }} 
        onGenerateInvoice={(o) => { setInitialInvoiceOrder(o); setViewOrder(null); setShowInvoiceForm(true); }}
        
        onAnulateOrder={handleAnulateOrder} 
        canAnulate={user.role === 'Administrador' || canUserAnulate} 
      />
      
      <Toaster />
    </>
  );
}

export default App;