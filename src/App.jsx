import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { isUserInList } from '@/utils/userMatch';
import { Menu, Settings, X, Loader2 } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';

import UserManagement from '@/components/UserManagement'; 
import MyProfile from '@/components/MyProfile';
import RolesPermissions from '@/components/RolesPermissions'; 
import Login from '@/components/Login';
import AnulationConfig from '@/components/AnulationConfig';
import Sidebar from '@/components/Sidebar';
import Stats from '@/components/Stats';
import Notifications from '@/components/Notifications';
import DailyReport from '@/components/DailyReport';
import StatisticsCharts from '@/components/StatisticsCharts';
import OrdersPanel from '@/components/OrdersPanel';
import OrderForm from '@/components/OrderForm';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import WorkAreaList from '@/components/WorkAreaList';
import WorkAreaCalendar from '@/components/WorkAreaCalendar';
import ClientsPanel from '@/components/ClientsPanel';
import ClientForm from '@/components/ClientForm';
import ProformasPanel from '@/components/ProformasPanel';
import ProformaForm from '@/components/ProformaForm';
import ProformaDetailsModal from '@/components/ProformaDetailsModal';
import InvoicesPanel from '@/components/InvoicesPanel';
import InvoiceForm from '@/components/InvoiceForm';
import InvoiceDetailsModal from '@/components/InvoiceDetailsModal';
import InventoryPanel from '@/components/InventoryPanel';
import CatalogPanel from '@/components/CatalogPanel';
import ValesCajaPanel from './components/ValesCajaPanel'; 
import AccountingPanel from '@/components/AccountingPanel'; 
import AbonosModal from '@/components/AbonosModal'; 
import GeneralLedgerPanel from './components/GeneralLedgerPanel';
import NotificationsPanel from './components/NotificationsPanel'; // 🔥 NUEVO PANEL DE NOTIFICACIONES

const WORKFLOW_VPVC = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];
const WORKFLOW_VC = ['VENTAS', 'CONTABILIDAD', 'FINALIZADA'];

function App() {
  const [user, setUser] = useState(null);
  const [allowedViews, setAllowedViews] = useState([]); 
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]); 
  const [proformas, setProformas] = useState([]);
  const [invoices, setInvoices] = useState([]); 
  const [kanbanTasks, setKanbanTasks] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]); 
  
  // 🔧 FIX: antes 'currentView' siempre arrancaba en 'inicio' (era un useState fijo),
  // así que CUALQUIER recarga de página (F5) te mandaba de vuelta a Inicio, sin importar
  // dónde estabas. Ahora se recuerda durante la sesión del navegador (sessionStorage),
  // y solo se reinicia a 'inicio' cuando hay un login real (ver handleLogin más abajo).
  const [currentView, setCurrentView] = useState(() => sessionStorage.getItem('currentView') || 'inicio');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  
  const [showClientFormModal, setShowClientFormModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null); 
  // 🔧 NUEVO: para abrir cliente/orden/proforma en una PESTAÑA NUEVA. Usamos <a href="#...">
  // reales (no solo onClick) para que el clic derecho -> "Abrir en pestaña nueva" del
  // propio navegador también funcione, no solo nuestro botón dedicado.
  const [pendingExpedienteClientId, setPendingExpedienteClientId] = useState(null);
  const buildClientTabUrl = (clienteId) => `#cliente=${clienteId}`;
  const buildOrderTabUrl = (ordenId) => `#orden=${ordenId}`;
  const buildProformaTabUrl = (proformaId) => `#proforma=${proformaId}`;
  const buildViewTabUrl = (viewId) => `#view=${viewId}`;
  // 🔧 NUEVO: si la pestaña se abrió con un enlace directo (#orden=, #proforma=,
  // #cliente=), evitamos que se vea un "destello" de la pantalla de Inicio antes de
  // que aparezca lo que realmente se pidió. Mientras esto sea true, se muestra una
  // pantalla en blanco de carga en vez del contenido normal de la app.
  const [pendingDeepLink, setPendingDeepLink] = useState(() => /^#(orden|proforma|cliente)=/.test(window.location.hash));

  // Respaldo: si por algún motivo el enlace nunca se resuelve (id inválido, dato
  // borrado, etc.), no dejamos a la persona atascada en una pantalla en blanco.
  useEffect(() => {
      if (!pendingDeepLink) return;
      const t = setTimeout(() => setPendingDeepLink(false), 6000);
      return () => clearTimeout(t);
  }, [pendingDeepLink]);
  const openClientProfileInNewTab = (clienteId) => {
      if (!clienteId) return;
      window.open(`${window.location.origin}${window.location.pathname}${buildClientTabUrl(clienteId)}`, '_blank');
  };

  const [archivedNotifications, setArchivedNotifications] = useState([]);
  const [realtimeEvents, setRealtimeEvents] = useState([]); 

  const [editingOrder, setEditingOrder] = useState(null); 
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [cloningOrder, setCloningOrder] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [abonoOrder, setAbonoOrder] = useState(null);
  const [viewOrderSource, setViewOrderSource] = useState(null);

  const [showProformaForm, setShowProformaForm] = useState(false);
  const [editingProforma, setEditingProforma] = useState(null);
  const [viewProforma, setViewProforma] = useState(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [initialInvoiceOrder, setInitialInvoiceOrder] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  
  const [proformaToConvertId, setProformaToConvertId] = useState(null);

  const { toast } = useToast();
  const [canUserAnulate, setCanUserAnulate] = useState(false);
  const [canUserEdit, setCanUserEdit] = useState(false);
  
  const normalizeText = (text) => {
    if (!text) return "";
    return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const fetchAllData = async (userOverride = null) => {
    try {
      const currentUser = userOverride || user; 
      if (!currentUser) return;

      const { data: clientesData } = await supabase.from('clientes').select('*');
      if (clientesData) setClients(clientesData);

      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role').order('full_name');
      if (profilesData) {
          setStaffUsers(profilesData.map(p => ({ id: p.id, name: p.full_name, role: p.role })));
      }

      // 🔧 REFACTOR: agregamos vendedor_ids / recibido_por_*_id para que el filtrado
      // de "mis órdenes" funcione por ID en vez de por nombre (ver src/utils/userMatch.js)
      const colOrdenes = 'id, order_number, cliente_id, cliente_nombre, tipo_trabajo, tipoOrden, fecha_entrega, vendedor, vendedor_ids, notas, prioridad, origenProformaInfo, productos, financials, anticipo, retencion, forma_pago_anticipo, nota_anticipo, credito_vence_anticipo, esDistribuidor, status, created_at, updated_at, recibido_por_anticipo, recibido_por_anticipo_id, recibido_por_saldo, recibido_por_saldo_id, abonos, motivoAnulacion, ruc, cliente_telefono';
      
      let ordersQuery = supabase.from('ordenes').select(colOrdenes).order('created_at', { ascending: false });
      const { data: ordenesData } = await ordersQuery;
      
      // 🔧 FIX: antes cada Vendedor solo veía SUS PROPIAS cotizaciones (filtro
      // .ilike('responsable_nombre', su nombre)). El pedido fue que todos los
      // vendedores vean todas las cotizaciones de cualquiera, por si alguien
      // falta y otro necesita retomar/consultar su trabajo.
      let proformasQuery = supabase.from('proformas').select('*').order('created_at', { ascending: false });

      const { data: proformasData } = await proformasQuery;
      if (proformasData) setProformas(proformasData);

      if (ordenesData && clientesData) {
        const ordenesEnriquecidas = ordenesData.map(orden => {
          const nombreOrden = normalizeText(orden.cliente || orden.cliente_nombre);
          const clienteEncontrado = clientesData.find(c => {
             const nombreCliente = normalizeText(c.nombre || c.full_name);
             return nombreCliente === nombreOrden;
          });
          const rucEncontrado = clienteEncontrado ? (clienteEncontrado.empresa || clienteEncontrado.ruc || clienteEncontrado.cedula || clienteEncontrado.identificacion || '') : '';
          return { ...orden, ruc: String(rucEncontrado), cedula: String(rucEncontrado), telefono: clienteEncontrado ? (clienteEncontrado.telefono || '') : '' };
        });
        setOrders(ordenesEnriquecidas);
      } else if (ordenesData) {
        setOrders(ordenesData);
      }
      
      if (currentUser) {
          if (currentUser.role === 'Administrador') {
              setCanUserAnulate(true); setCanUserEdit(true);
          } else {
              const { data: roleData } = await supabase.from('role_permissions').select('can_anulate, can_edit').eq('role', currentUser.role).maybeSingle();
              setCanUserAnulate(!!roleData?.can_anulate); setCanUserEdit(!!roleData?.can_edit);
          }
      }
    } catch (error) { console.error("Error cargando datos:", error); }
  };

  useEffect(() => {
    let loadedUser = null;
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        loadedUser = JSON.parse(savedUser);
        setUser(loadedUser);
        fetchUserPermissions(loadedUser.role);

        // 🔧 NUEVO: antes la app confiaba ciegamente en el rol guardado en el
        // navegador desde el momento del login — si algo cambiaba después (tu
        // perfil se editaba, o la sesión quedaba vieja), la app seguía actuando
        // con el rol antiguo hasta que cerrabas sesión y volvías a entrar. Ahora
        // se revisa el rol REAL contra la base de datos apenas carga la página,
        // y se autocorrige sola si hay una diferencia — sin necesidad de
        // cerrar sesión.
        supabase.from('profiles').select('id, full_name, role').eq('id', loadedUser.id).single()
            .then(({ data: perfilReal, error }) => {
                if (error || !perfilReal) return;
                const cambioAlgo = perfilReal.role !== loadedUser.role || perfilReal.full_name !== loadedUser.name;
                if (cambioAlgo) {
                    const usuarioActualizado = { ...loadedUser, name: perfilReal.full_name, role: perfilReal.role };
                    setUser(usuarioActualizado);
                    localStorage.setItem('currentUser', JSON.stringify(usuarioActualizado));
                    fetchUserPermissions(perfilReal.role);
                }
            });
    }
    fetchAllData(loadedUser);
    // 🔧 NUEVO: si la pestaña se abrió con #cliente=ID, #orden=ID o #proforma=ID
    // (desde "Abrir en pestaña nueva" o un clic derecho del navegador), navega
    // directo a esa pantalla/modal. Las órdenes y proformas necesitan que 'orders'/
    // 'proformas' ya estén cargadas, así que se resuelven en un efecto aparte más abajo.
    const hashCliente = window.location.hash.match(/^#cliente=(.+)$/);
    if (hashCliente) {
        setCurrentView('clientes-lista');
        setPendingExpedienteClientId(hashCliente[1]);
    }
    // 🔧 NUEVO: soporte para #view=<id> (clic derecho en la barra lateral -> pestaña nueva)
    const hashView = window.location.hash.match(/^#view=(.+)$/);
    if (hashView) {
        setCurrentView(hashView[1]);
    }
    try {
      if(localStorage.getItem('archivedNotifications')) setArchivedNotifications(JSON.parse(localStorage.getItem('archivedNotifications')));
      if(localStorage.getItem('kanbanTasksDB')) setKanbanTasks(JSON.parse(localStorage.getItem('kanbanTasksDB')));
      if(localStorage.getItem('invoicesDB')) setInvoices(JSON.parse(localStorage.getItem('invoicesDB')));
      if(localStorage.getItem('realtimeEvents')) setRealtimeEvents(JSON.parse(localStorage.getItem('realtimeEvents')));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { localStorage.setItem('realtimeEvents', JSON.stringify(realtimeEvents)); }, [realtimeEvents]);

  // 🔧 NUEVO: guarda la pantalla actual para que sobreviva a un F5
  useEffect(() => { sessionStorage.setItem('currentView', currentView); }, [currentView]);

  // 🔧 NUEVO: resuelve #orden=ID / #proforma=ID una vez que 'orders'/'proformas' ya
  // cargaron (al abrir la app con esos datos aún no están disponibles en el primer render).
  useEffect(() => {
      const hashOrden = window.location.hash.match(/^#orden=(.+)$/);
      if (hashOrden && orders.length > 0) {
          const target = orders.find(o => String(o.id) === hashOrden[1]);
          if (target) { handleViewOrder(target, 'link'); window.history.replaceState(null, '', window.location.pathname); }
          setPendingDeepLink(false);
      }
      const hashProforma = window.location.hash.match(/^#proforma=(.+)$/);
      if (hashProforma && proformas.length > 0) {
          const targetP = proformas.find(p => String(p.id) === hashProforma[1]);
          if (targetP) { setViewProforma(targetP); window.history.replaceState(null, '', window.location.pathname); }
          setPendingDeepLink(false);
      }
      const hashCliente = window.location.hash.match(/^#cliente=/);
      if (hashCliente && clients.length > 0) {
          setPendingDeepLink(false);
      }
  }, [orders, proformas, clients]);

  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => { fetchAllData(user); }, 5000); 

    const channel = supabase
      .channel('realtime_ordenes_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, (payload) => {
        
        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'UPDATE') {
            const numOrden = newRecord.order_number || newRecord.id;
            const isMineNow = isUserInList(newRecord?.vendedor_ids, newRecord?.vendedor, user);
            const wasMine = isUserInList(oldRecord?.vendedor_ids, oldRecord?.vendedor, user);

            if (isMineNow && !wasMine) {
                const notif = {
                    id: Date.now(),
                    type: 'assignment',
                    title: 'Nueva Orden Asignada',
                    message: `Te han delegado la orden #${numOrden} como colaborador`,
                    orderId: newRecord.id,
                    isRead: false,
                    timestamp: new Date().toISOString()
                };
                setRealtimeEvents(prev => [notif, ...prev]);
                toast({ title: notif.title, description: notif.message, className: "bg-blue-100 border-blue-500 text-blue-900" });
            }

            if (newRecord.status !== oldRecord.status) {
                let relevant = false;
                if (isUserInList(newRecord?.vendedor_ids, newRecord?.vendedor, user)) relevant = true;
                if (user.role === 'Producción' && newRecord.status === 'PRODUCCION') relevant = true;
                if (user.role === 'Contabilidad' && newRecord.status === 'CONTABILIDAD') relevant = true;

                if (relevant) {
                    const notif = {
                        id: Date.now(),
                        type: 'status',
                        title: 'Cambio de Estado',
                        message: `Orden #${numOrden} pasó a ${newRecord.status}`,
                        orderId: newRecord.id,
                        isRead: false,
                        timestamp: new Date().toISOString()
                    };
                    setRealtimeEvents(prev => [notif, ...prev]);
                    toast({ title: notif.title, description: notif.message });
                }
            }
        }

        setOrders(prevOrders => {
            if (eventType === 'INSERT') {
                return [newRecord, ...prevOrders];
            }
            if (eventType === 'UPDATE') {
                return prevOrders.map(o => o.id === newRecord.id ? { ...o, ...newRecord } : o);
            }
            if (eventType === 'DELETE') return prevOrders.filter(o => o.id !== oldRecord.id);
            return prevOrders;
        });

        setTimeout(() => fetchAllData(user), 1000);
      })
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [user, toast]); 

  const handleClearEvent = (id) => { setRealtimeEvents(prev => prev.filter(e => e.id !== id)); };

  const fetchUserPermissions = async (role) => {
    if (role === 'Administrador') return; 
    try { const { data } = await supabase.from('role_permissions').select('allowed_views').eq('role', role).single(); if (data) setAllowedViews(data.allowed_views || []); } catch (error) { console.error(error); }
  };

  const handleLogin = (userData) => { setUser(userData); localStorage.setItem('currentUser', JSON.stringify(userData)); setCurrentView('inicio'); sessionStorage.setItem('currentView', 'inicio'); fetchUserPermissions(userData.role); fetchAllData(userData); };
  const handleLogout = () => { setUser(null); setAllowedViews([]); localStorage.removeItem('currentUser'); sessionStorage.removeItem('currentView'); };

  const handleOrderSuccess = async () => {
    if (proformaToConvertId) {
        try {
            await supabase.from('proformas').update({ status: 'APROBADA' }).eq('id', proformaToConvertId);
            toast({ title: "Proforma Aprobada", description: "Orden generada y estado actualizado." });
        } catch (error) { console.error(error); }
        setProformaToConvertId(null);
    }
    fetchAllData(); 
    setShowForm(false);
    setEditingOrder(null);
    setPaymentOrder(null);
    setCloningOrder(null);
  };

  const handleClientSuccess = () => { fetchAllData(); setShowClientFormModal(false); setEditingClient(null); };
  const getNextOrderNumber = () => { if (orders.length === 0) return 1; const nums = orders.map(o => parseInt(o.order_number || o.orderNumber || 0)); return Math.max(...nums) + 1; };
  const getNextProformaNumber = () => { if (proformas.length === 0) return 1; return Math.max(...proformas.map(p => parseInt(p.proformaNumber || p.numero || 0))) + 1; };
  const getNextInvoiceNumber = () => { if (invoices.length === 0) return 1; return Math.max(...invoices.map(i => parseInt(i.number || 0))) + 1; };

  const handleKanbanCreate = (t) => { setKanbanTasks(prev => [...prev, { id: Date.now().toString(), createdAt: new Date().toISOString(), ...t }]); toast({title: "Tarea creada"}); };
  const handleKanbanUpdate = (id, up) => setKanbanTasks(prev => prev.map(t => t.id === id ? { ...t, ...up } : t));
  const handleKanbanDelete = (id) => setKanbanTasks(prev => prev.filter(t => t.id !== id));
  
  const handleDeleteProforma = async (id) => { await supabase.from('proformas').delete().eq('id', id); fetchAllData(); toast({ title: "Eliminado", description: "Proforma eliminada correctamente" }); };
  const handleCreateInvoice = (d) => { setInvoices(p => [{ ...d, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...p]); setShowInvoiceForm(false); setInitialInvoiceOrder(null); };
  const handleAnulateInvoice = (inv) => { setInvoices(p => p.map(i => i.id === inv.id ? { ...i, status: 'ANULADA' } : i)); if(viewInvoice?.id === inv.id) setViewInvoice(prev => ({...prev, status: 'ANULADA'})); };

  const handleConvertProformaToOrder = (proforma) => {
      let finData = proforma.financials || {};
      if (typeof finData === 'string') { try { finData = JSON.parse(finData); } catch(e) { finData = {}; } }

      const savedDescuentoMonto = finData.descuentoMonto || (finData.descuento ? finData.descuento * (proforma.iva > 0 ? (1 + (proforma.iva_percentage || 15)/100) : 1) : 0);

      const prefilledOrderData = {
          cliente_nombre: proforma.cliente_nombre, cliente: proforma.cliente_nombre, ruc: proforma.cliente_identificacion, 
          productos: (proforma.items || []).map(item => ({ cantidad: item.cantidad, descripcion: item.descripcion, precio: item.precioUnitario, total: item.total })),
          financials: { subtotal: proforma.subtotal, iva: proforma.iva, total: proforma.total, ivaPercentage: proforma.iva_percentage || 15, saldo: proforma.total, diasEntrega: proforma.dias_entrega || finData.diasEntrega || 0, descuentoMonto: savedDescuentoMonto },
          descuentoMonto: savedDescuentoMonto,
          dias_entrega: proforma.dias_entrega || finData.diasEntrega || 0,
          tipoLetrero: proforma.titulo || proforma.tipo_trabajo || '', origenProformaInfo: proforma.proformaNumber || proforma.numero || '', 
          aplicarIva: proforma.iva > 0, notas: proforma.notas, vendedor: proforma.responsable_nombre || user.name,
          imagenes: proforma.imagenes || [],
      };
      
      setProformaToConvertId(proforma.id);
      setEditingOrder(prefilledOrderData);
      setViewProforma(null);
      setShowForm(true); 
      toast({ description: "Verifique la orden, agregue anticipo y guarde." });
  };
  
  const handleViewChange = (v) => { if (v === 'ordenes-nueva') { setCurrentView('ordenes-todas'); setShowForm(true); } else setCurrentView(v); };
  const handleArchiveNotification = (id) => { setArchivedNotifications(prev => [...prev, id]); };
  
  const handleViewOrder = (o, src) => { setViewOrder(o); setViewOrderSource(src); };

  const handleEditOrderRequest = (o) => {
      const isContabilidadAllowed = user.role === 'Contabilidad' && o.status === 'CONTABILIDAD';

      if (user.role !== 'Administrador' && !isContabilidadAllowed && !isUserInList(o?.vendedor_ids, o?.vendedor, user)) {
          toast({ title: "Acceso Denegado", description: "Solo puedes editar las órdenes donde estés asignado.", variant: "destructive" });
          return;
      }
      setEditingOrder(o);
  };

  const handleAbonoOrderRequest = (o) => {
      if (user.role !== 'Administrador' && user.role !== 'Contabilidad' && !isUserInList(o?.vendedor_ids, o?.vendedor, user)) {
          toast({ title: "Acceso Denegado", description: "Solo puedes registrar abonos en tus propias órdenes.", variant: "destructive" });
          return;
      }
      setAbonoOrder(o);
  };

  const handlePaymentOrderRequest = (o) => {
      if (user.role !== 'Administrador' && user.role !== 'Contabilidad' && !isUserInList(o?.vendedor_ids, o?.vendedor, user)) {
          toast({ title: "Acceso Denegado", description: "No tienes permisos para cobrar en esta orden.", variant: "destructive" });
          return;
      }
      setPaymentOrder(o);
  };

  const handleDeleteOrderRequest = async (id) => {
      const orderToDelete = orders.find(o => o.id === id);
      if (user.role !== 'Administrador' && !isUserInList(orderToDelete?.vendedor_ids, orderToDelete?.vendedor, user)) {
          toast({ title: "Acceso Denegado", description: "No puedes eliminar órdenes de otros vendedores.", variant: "destructive" });
          return;
      }
      await supabase.from('ordenes').delete().eq('id', id);
  };

  const handleAnulateOrderRequest = async (orderId) => { 
      const orderToAnulate = orders.find(o => o.id === orderId) || viewOrder;
      if (user.role !== 'Administrador' && !isUserInList(orderToAnulate?.vendedor_ids, orderToAnulate?.vendedor, user)) {
          toast({ title: "Acceso Denegado", description: "No puedes anular órdenes de otros vendedores.", variant: "destructive" });
          return;
      }
      try { 
          const { error } = await supabase.from('ordenes').update({ status: 'ANULADA' }).eq('id', orderId); 
          if (error) throw error; 
          toast({ title: "Orden Anulada" }); 
          setViewOrder(null); 
      } catch (error) { 
          toast({ variant: "destructive", title: "Error" }); 
      } 
  };

  const handleAdvanceWorkflow = async (order) => {
    if (user.role !== 'Administrador' && user.role !== 'Producción' && user.role !== 'Contabilidad' && !isUserInList(order?.vendedor_ids, order?.vendedor, user)) {
        toast({ title: "Acceso Denegado", description: "No tienes permisos para avanzar esta orden.", variant: "destructive" });
        return;
    }
    const tipo = String(order.tipoOrden || order.tipo_trabajo || order.tipoLetrero || '').toUpperCase();
    const isVentaCorta = tipo.includes('(VC)') || tipo === 'VC' || tipo === 'VENTA CORTA';

    const flow = isVentaCorta ? WORKFLOW_VC : WORKFLOW_VPVC;
    const currentStatus = order.status;
    const idx = flow.indexOf(currentStatus);
    
    if (idx !== -1 && idx < flow.length - 1) {
        const nextStatus = flow[idx + 1];
        try {
            const { error } = await supabase.from('ordenes').update({ status: nextStatus }).eq('id', order.id);
            if(error) throw error;
            toast({ title: "Estado Actualizado", description: `Orden movida a ${nextStatus}` });
        } catch (error) { toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" }); }
    }
  };

  const handleRegressWorkflow = async (order) => {
    if (user.role !== 'Administrador') {
        toast({ title: "Acceso Denegado", description: "Solo el Administrador puede revertir estados.", variant: "destructive" });
        return;
    }
    const tipo = String(order.tipoOrden || order.tipo_trabajo || order.tipoLetrero || '').toUpperCase();
    const isVentaCorta = tipo.includes('(VC)') || tipo === 'VC' || tipo === 'VENTA CORTA';

    const flow = isVentaCorta ? WORKFLOW_VC : WORKFLOW_VPVC;
    const currentStatus = order.status;
    const idx = flow.indexOf(currentStatus);
    
    if (idx > 0) {
        const prevStatus = flow[idx - 1];
        try {
            const { error } = await supabase.from('ordenes').update({ status: prevStatus }).eq('id', order.id);
            if(error) throw error;
            toast({ title: "Estado Revertido", description: `La orden regresó a ${prevStatus}` });
        } catch (error) { toast({ title: "Error", description: "No se pudo revertir el estado.", variant: "destructive" }); }
    }
  };

  const handleProductToggle = async (order, idx, newState) => {
      if (user.role !== 'Producción' && user.role !== 'Administrador') return;
      const currentProducts = order.productos || order.products || [];
      const updatedProducts = [...currentProducts];
      updatedProducts[idx] = { ...updatedProducts[idx], estado_prod: newState };
      if (viewOrder && viewOrder.id === order.id) { setViewOrder({ ...viewOrder, productos: updatedProducts }); }

      try {
          const { error } = await supabase.from('ordenes').update({ productos: updatedProducts }).eq('id', order.id);
          if (error) throw error;
      } catch (error) { toast({ title: "Error", description: "No se guardó el estado de producción", variant: "destructive" }); }
  };

  const handleArchiveOrder = async (order) => { await supabase.from('ordenes').update({ status: 'ARCHIVADA' }).eq('id', order.id); setViewOrder(null); toast({ title: "Orden Archivada" }); };

  if (!user) return <><Login onLogin={handleLogin} /><Toaster /></>;
  if (pendingDeepLink) return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-3 z-[999]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-sm text-slate-400">Abriendo...</span>
      </div>
  );

  const renderContent = () => {
    if (currentView === 'admin-usuarios') return <UserManagement />;
    if (currentView === 'roles-permisos') return <RolesPermissions />;
    if (currentView === 'facturacion-panel') return <InvoicesPanel invoices={invoices} onViewInvoice={setViewInvoice} onAnulateInvoice={handleAnulateInvoice}/>;
    if (currentView === 'proformas') return <ProformasPanel proformas={proformas} clients={clients} user={user} onCreateNew={() => setShowProformaForm(true)} onViewProforma={setViewProforma} onEditProforma={setEditingProforma} onDeleteProforma={handleDeleteProforma} />;
    if (currentView === 'estadisticas-reporte') return <DailyReport orders={orders} user={user} onViewOrder={(o) => handleViewOrder(o, 'report')} onDataChanged={() => fetchAllData(user)} />;
    if (currentView === 'libro-diario-general') return <GeneralLedgerPanel orders={orders} user={user} />;
    if (currentView === 'mi-perfil') return <MyProfile user={user} />;
    if (currentView === 'clientes-lista') return ( <ClientsPanel clients={clients} orders={orders} user={user} onCreateNew={() => { setEditingClient(null); setShowClientFormModal(true); }} onEditClient={(client) => { setEditingClient(client); setShowClientFormModal(true); }} onViewOrder={(o) => handleViewOrder(o, 'clientes')} initialExpedienteClientId={pendingExpedienteClientId} onExpedienteOpened={() => setPendingExpedienteClientId(null)} /> );
    if (currentView === 'configuracion') return <AnulationConfig />;
    if (currentView === 'vales') return <ValesCajaPanel user={user} orders={orders} />;
    if (currentView === 'contabilidad-cierre') return <AccountingPanel user={user} orders={orders} staffUsers={staffUsers} onViewOrder={handleViewOrder} />;
    
    // 🔥 NUEVA VISTA: PANEL DE NOTIFICACIONES 🔥
    if (currentView === 'notificaciones') {
        return (
            <NotificationsPanel 
                user={user} 
                orders={orders} 
                staffUsers={staffUsers}
                realtimeEvents={realtimeEvents} 
                onClearEvent={handleClearEvent} 
                onViewOrder={(o) => handleViewOrder(o, 'notifications')} 
                onViewChange={handleViewChange}
            />
        );
    }

    if (currentView.startsWith('ordenes-')) {
       // 🔧 FIX: "Todas las órdenes" ahora sí incluye las archivadas (antes se
       // excluían siempre por defecto). Las demás vistas filtradas (sin factura,
       // con factura, crédito, etc.) siguen sin mostrar archivadas, como antes.
       let filtered = currentView === 'ordenes-todas' ? [...orders] : orders.filter(o => o.status !== 'ARCHIVADA');
       
       if (currentView === 'ordenes-activas') {
           filtered = filtered.filter(o => o.status !== 'ANULADA' && o.status !== 'FINALIZADA');
       }

       if (currentView === 'ordenes-sin-factura') filtered = filtered.filter(o => !o.financials?.iva);
       if (currentView === 'ordenes-con-factura') filtered = filtered.filter(o => o.financials?.iva > 0);
       if (currentView === 'ordenes-archivadas') filtered = orders.filter(o => o.status === 'ARCHIVADA');

       // 🔧 FIX: antes "Crédito" solo miraba si el método de pago DECÍA "Crédito", sin
       // importar si ya estaba pagado, vencido, o con saldo pendiente de verdad — por eso
       // se mezclaba con las impagas. Ahora usa la misma lógica real de Stats.jsx: solo
       // cuenta como "Crédito" si tiene saldo pendiente Y no está vencido; si está vencido
       // o no es crédito formal, es "Impaga" — nunca las dos cosas a la vez.
       const getEstadoCredito = (o) => {
           const total = Number(o.financials?.total) || 0;
           const anticipo = Number(o.anticipo) || 0;
           const retencion = Number(o.retencion || o.financials?.retencion) || 0;
           const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
           const saldoFinalReal = total - anticipo - retencion - totalAbonado;
           const pSaldo = String(o.formaPagoSaldo || o.financials?.formaPagoSaldo || '').toLowerCase();
           const pAnticipo = String(o.formaPagoAnticipo || o.forma_pago_anticipo || '').toLowerCase();
           const isCredito = pSaldo.includes('crédit') || pSaldo.includes('credit') || pAnticipo.includes('crédit') || pAnticipo.includes('credit');
           const today = new Date().toISOString().split('T')[0];
           const fechaVence = o.financials?.creditoVenceSaldo || o.creditoVenceSaldo || o.credito_vence_saldo || o.creditoVenceAnticipo || o.credito_vence_anticipo || o.financials?.creditoVenceAnticipo || '';
           const isVencido = isCredito && fechaVence && fechaVence < today;
           if (saldoFinalReal > 0.01 && (!isCredito || isVencido)) return 'impaga';
           if (saldoFinalReal > 0.01 && isCredito && !isVencido) return 'credito';
           return 'ok';
       };

       if (currentView === 'ordenes-credito') {
           filtered = filtered.filter(o => getEstadoCredito(o) === 'credito');
       }
       if (currentView === 'ordenes-impagas') {
           filtered = filtered.filter(o => getEstadoCredito(o) === 'impaga');
       }

       return (
          <div className="space-y-6 animate-in fade-in">
            {(user.role === 'Administrador' || user.role === 'Vendedor') && <Stats orders={orders} user={user} />}
            <OrdersPanel 
                orders={filtered} 
                user={user} 
                onUpdateStatus={() => {}} 
                onDeleteOrder={handleDeleteOrderRequest} 
                onEditOrder={handleEditOrderRequest} 
                onCloneOrder={setCloningOrder} 
                onPaymentOrder={handlePaymentOrderRequest} 
                onCreateOrder={() => setShowForm(true)} 
                onViewOrder={(o) => handleViewOrder(o, null)} 
                currentView={currentView} 
                onAbonoOrder={handleAbonoOrderRequest} 
            />
          </div>
       );
    }

    switch (currentView) {
      case 'inicio': return ( <div className="space-y-6 animate-in fade-in"><div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 flex justify-between items-start"><div><h2 className="text-2xl font-bold text-slate-800 mb-2">¡Hola, {user.name}! 👋</h2><p className="text-slate-500">Panel de Control General</p></div>{user.role === 'Administrador' && (<Button variant="outline" onClick={() => setCurrentView('configuracion')} className="gap-2"><Settings className="h-4 w-4" /> Configurar Permisos</Button>)}</div><Stats orders={orders} user={user} /><div className="mt-8"><WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='list' onAbonoOrder={handleAbonoOrderRequest} /></div></div> );
      case 'clientes-nuevo': return <ClientForm user={user} onSuccess={handleClientSuccess} onCancel={() => setCurrentView('clientes-lista')}/>;
      case 'trabajo-listado': return <div className="space-y-4"><h2 className="text-xl font-bold">Listado de Trabajo</h2><WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='list' onAbonoOrder={handleAbonoOrderRequest} /></div>;
      case 'trabajo-mistareas': return <div className="space-y-4"><h2 className="text-xl font-bold">Tablero Kanban</h2><WorkAreaList orders={orders} user={user} staffUsers={staffUsers} kanbanTasks={kanbanTasks} onKanbanUpdate={handleKanbanUpdate} onKanbanCreate={handleKanbanCreate} onKanbanDelete={handleKanbanDelete} onViewOrder={(o) => handleViewOrder(o, 'tasks')} initialMode='board' onAbonoOrder={handleAbonoOrderRequest} /></div>;
      case 'trabajo-disponibilidad': return <div className="h-[calc(100vh-140px)]"><WorkAreaCalendar orders={orders} onViewOrder={(o) => handleViewOrder(o, 'tasks')} /></div>;
      case 'inventario-ver': return <InventoryPanel user={user} mode="view" />;
      case 'inventario-gestionar': return <InventoryPanel user={user} mode="manage" />; 
      case 'estadisticas-graficos': return <StatisticsCharts orders={orders} user={user} />;
      case 'inventario-catalogo': return <CatalogPanel user={user} />;
      default: return <div className="p-10 text-center text-slate-500">Seleccione una opción del menú lateral.</div>;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex">
        <div className="hidden md:block w-64 flex-shrink-0"><Sidebar user={user} onLogout={handleLogout} currentView={currentView} onViewChange={handleViewChange} allowedViews={allowedViews} /></div>
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-slate-900 text-white p-4 flex justify-between items-center shadow-md print:hidden"><span className="font-bold">Sistema Producción</span><div className="flex items-center gap-3"><Notifications user={user} orders={orders} archivedIds={archivedNotifications} onArchive={handleArchiveNotification} onViewOrder={(o) => handleViewOrder(o, 'tasks')} realtimeEvents={realtimeEvents} onClearEvent={handleClearEvent} onViewChange={(view) => { handleViewChange(view); setIsMobileMenuOpen(false); }} /><button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}><Menu className="h-6 w-6" /></button></div></div>
        {isMobileMenuOpen && (<div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}><div className="w-64 bg-slate-900 h-full shadow-2xl" onClick={e => e.stopPropagation()}><Sidebar user={user} onLogout={handleLogout} currentView={currentView} onViewChange={(view) => { handleViewChange(view); setIsMobileMenuOpen(false); }} allowedViews={allowedViews} /></div></div>)}
        <div className="flex-1 w-full md:w-[calc(100%-16rem)] min-h-screen transition-all duration-300 flex flex-col"><div className="hidden md:flex bg-white border-b border-slate-200 h-16 px-8 items-center justify-end sticky top-0 z-20 shadow-sm print:hidden"><div className="flex items-center gap-4"><Notifications user={user} orders={orders} archivedIds={archivedNotifications} onArchive={handleArchiveNotification} onViewOrder={(o) => handleViewOrder(o, 'tasks')} realtimeEvents={realtimeEvents} onClearEvent={handleClearEvent} onViewChange={handleViewChange} /><div className="h-8 w-[1px] bg-slate-200"></div><span className="text-sm font-semibold text-slate-700">{user.name}</span></div></div><div className="container mx-auto px-4 py-8 md:p-8 mt-12 md:mt-0 flex-1 print:p-0 print:max-w-none print:mt-0">{renderContent()}</div></div>
      </div>

      {(showForm || cloningOrder || editingOrder) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"> 
          <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto">
            <OrderForm currentUser={user} clients={clients} staffUsers={staffUsers} orders={orders} onSuccess={handleOrderSuccess} onCancel={() => { setShowForm(false); setCloningOrder(null); setEditingOrder(null); setProformaToConvertId(null); }} initialData={editingOrder || cloningOrder} nextOrderNumber={getNextOrderNumber()} onCheckAvailability={() => setShowAvailabilityModal(true)} onCreateClient={() => { setEditingClient(null); setShowClientFormModal(true); }} />
          </div>
        </div>
      )}

      {paymentOrder && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto"><OrderForm currentUser={user} clients={clients} staffUsers={staffUsers} orders={orders} initialData={paymentOrder} onSuccess={handleOrderSuccess} onCancel={() => setPaymentOrder(null)} mode="payment_only"/></div></div>)}
      
      {showClientFormModal && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 no-print"><ClientForm user={user} clienteAEditar={editingClient} onSuccess={() => { fetchAllData(); setShowClientFormModal(false); setEditingClient(null); }} onCancel={() => { setShowClientFormModal(false); setEditingClient(null); }} /></div>)}
      
      {(showProformaForm || editingProforma) && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto"><ProformaForm user={user} clients={clients} initialData={editingProforma} onSuccess={() => { setShowProformaForm(false); setEditingProforma(null); fetchAllData(); }} onCancel={() => { setShowProformaForm(false); setEditingProforma(null); }} nextProformaNumber={getNextProformaNumber()} onCreateClient={() => { setEditingClient(null); setShowClientFormModal(true); }} /></div></div>)}

      {showInvoiceForm && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"><div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto h-full"><InvoiceForm user={user} initialOrder={initialInvoiceOrder} nextInvoiceNumber={getNextInvoiceNumber()} onSubmit={handleCreateInvoice} onCancel={() => { setShowInvoiceForm(false); setInitialInvoiceOrder(null); }} /></div></div>)}
      
      {viewProforma && (<ProformaDetailsModal proforma={viewProforma} onClose={() => setViewProforma(null)} onEdit={(p) => { setViewProforma(null); setEditingProforma(p); }} onConvert={(p) => handleConvertProformaToOrder(p)} onUpdateProforma={async (updates) => { try { await supabase.from('proformas').update(updates).eq('id', viewProforma.id); fetchAllData(); toast({ title: "Proforma Actualizada" }); } catch (error) { console.error(error); } }} user={user} staffUsers={staffUsers} />)}
      
      {viewInvoice && (<InvoiceDetailsModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} onAnulate={handleAnulateInvoice} onViewOrder={(id) => { const o = orders.find(x => x.id === id || x.orderNumber == id || x.order_number == id); if(o) { setViewInvoice(null); handleViewOrder(o); } }} />)}
      
      {showAvailabilityModal && (<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"><div className="w-full max-w-5xl bg-white h-[85vh] rounded-xl shadow-2xl flex flex-col"><div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl"><h3 className="font-bold text-lg">Disponibilidad</h3><Button variant="ghost" size="icon" onClick={() => setShowAvailabilityModal(false)}><X className="h-5 w-5" /></Button></div><div className="flex-1 overflow-hidden p-4"><WorkAreaCalendar orders={orders} onViewOrder={(o) => { setShowAvailabilityModal(false); handleViewOrder(o, 'tasks'); }} /></div></div></div>)}
      
      <OrderDetailsModal 
        order={viewOrder} 
        user={user} 
        staffUsers={staffUsers} 
        clients={clients}
        onEditClient={(client) => { setEditingClient(client); setShowClientFormModal(true); }}
        orders={orders}
        onSwitchOrder={(o) => { setViewOrder(o); }}
        onOpenClientProfileNewTab={openClientProfileInNewTab}
        onClose={() => setViewOrder(null)} 
        onProductToggle={handleProductToggle} 
        isTaskView={viewOrderSource === 'tasks'} 
        onAdvanceWorkflow={handleAdvanceWorkflow} 
        onRegressWorkflow={handleRegressWorkflow}
        onArchiveOrder={handleArchiveOrder} 
        onUpdateOrder={() => { handleEditOrderRequest(viewOrder); setViewOrder(null); }} 
        onGenerateInvoice={(o) => { setInitialInvoiceOrder(o); setViewOrder(null); setShowInvoiceForm(true); }} 
        onAnulateOrder={handleAnulateOrderRequest} 
        canAnulate={user.role === 'Administrador' || (canUserAnulate && isUserInList(viewOrder?.vendedor_ids, viewOrder?.vendedor, user))} 
        canEdit={
          user.role === 'Administrador' || 
          (user.role === 'Contabilidad' && viewOrder?.status === 'CONTABILIDAD') || 
          (canUserEdit && isUserInList(viewOrder?.vendedor_ids, viewOrder?.vendedor, user))
        } 
        onAbonoOrder={handleAbonoOrderRequest} 
      />

      <div className="relative z-[9999]">
          {abonoOrder && (<AbonosModal order={abonoOrder} user={user} onClose={() => setAbonoOrder(null)} onSuccess={() => { setAbonoOrder(null); fetchAllData(); }} />)}
      </div>

      <Toaster />
    </>
  );
}

export default App;