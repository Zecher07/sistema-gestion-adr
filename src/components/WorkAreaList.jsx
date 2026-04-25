import React, { useState, useEffect, useMemo } from 'react';
import { LayoutList, Kanban as KanbanIcon, CheckCircle2, Search, ChevronLeft, ChevronRight, Play, PackageSearch, PackageCheck, FileSignature, AlertOctagon, Wallet, DollarSign, Globe, Wrench, ShoppingCart, Settings, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanBoard from './KanbanBoard';
import CompletedTasksList from './CompletedTasksList';
import { cn } from '@/lib/utils';

const WorkAreaList = ({ 
  orders, 
  user, 
  staffUsers, 
  kanbanTasks, 
  onKanbanUpdate, 
  onKanbanCreate, 
  onKanbanDelete, 
  onViewOrder,
  onAbonoOrder, // Función para abrir ventana de cobros
  initialMode = 'list'
}) => {
  const [viewMode, setViewMode] = useState(initialMode); 
  
  // 🔥 El filtro inicia dependiendo del rol 🔥
  const [listFilter, setListFilter] = useState(
      user?.role === 'Contabilidad' ? 'por_finalizar' : 
      user?.role === 'Administrador' ? 'todas' : 'ventas'
  ); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // 🔥 ESTADO DE ORDENAMIENTO (NUEVO) 🔥
  const [sortConfig, setSortConfig] = useState({ key: 'fechaEntrega', direction: 'asc' });

  useEffect(() => {
     if(initialMode) setViewMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, listFilter]);

  // --- LÓGICA ESTRICTA DE FILTRADO POR ROL Y SECCIÓN ---
  const rawFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.status === 'ANULADA' || order.status === 'ARCHIVADA' || order.status === 'FINALIZADA') return false;
      
      // 1. PRODUCCIÓN
      if (user.role === 'Producción') {
          return order.status === 'PRODUCCION'; 
      }
      
      // 2. CONTABILIDAD
      if (user.role === 'Contabilidad') {
          if (order.status !== 'CONTABILIDAD') return false;
          const saldoCobrado = (Number(order.financials?.total) || 0) - (Number(order.anticipo) || 0) - (Number(order.retencion) || 0);
          const totalAbonado = (order.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
          const saldoFinalReal = saldoCobrado - totalAbonado;
          const isCredito = (order.formaPagoSaldo || '').toLowerCase().includes('crédito') || (order.formaPagoSaldo || '').toLowerCase().includes('credito') || (order.formaPagoAnticipo || '').toLowerCase().includes('crédito');

          if (listFilter === 'creditos') return isCredito;
          if (listFilter === 'impagas') return saldoFinalReal > 0 && !isCredito;
          if (listFilter === 'por_finalizar') return saldoFinalReal <= 0 && !isCredito; 
          return false;
      }
      
      // 3. VENDEDOR
      if (user.role === 'Vendedor') {
          if (order.vendedor !== user.name) return false; 
          if (listFilter === 'ventas') return order.status === 'VENTAS'; 
          if (listFilter === 'por_retirar') return order.status === 'VENTAS POR RETIRAR'; 
      }

      // 4. ADMINISTRADOR (Modo Dios: Ve todas las áreas separadas)
      if (user.role === 'Administrador') {
          if (listFilter === 'todas') return ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD'].includes(order.status);
          
          if (listFilter === 'ventas') return order.status === 'VENTAS';
          if (listFilter === 'produccion') return order.status === 'PRODUCCION';
          if (listFilter === 'por_retirar') return order.status === 'VENTAS POR RETIRAR';

          if (['creditos', 'impagas', 'por_finalizar'].includes(listFilter)) {
              if (order.status !== 'CONTABILIDAD') return false;
              const saldoCobrado = (Number(order.financials?.total) || 0) - (Number(order.anticipo) || 0) - (Number(order.retencion) || 0);
              const totalAbonado = (order.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
              const saldoFinalReal = saldoCobrado - totalAbonado;
              const isCredito = (order.formaPagoSaldo || '').toLowerCase().includes('crédito') || (order.formaPagoSaldo || '').toLowerCase().includes('credito') || (order.formaPagoAnticipo || '').toLowerCase().includes('crédito');

              if (listFilter === 'creditos') return isCredito;
              if (listFilter === 'impagas') return saldoFinalReal > 0 && !isCredito;
              if (listFilter === 'por_finalizar') return saldoFinalReal <= 0 && !isCredito;
          }
      }
      
      return false;
    });
  }, [orders, user.role, listFilter, user.name]);

  const searchFilteredOrders = useMemo(() => {
    if (!searchTerm) return rawFilteredOrders;
    const lowerTerm = searchTerm.toLowerCase();
    return rawFilteredOrders.filter(order => {
      const orderId = (order.order_number || order.orderNumber || order.id || '').toString();
      const client = (order.cliente || order.cliente_nombre || '').toLowerCase();
      const title = (order.tipoLetrero || order.tipo_trabajo || '').toLowerCase();
      return orderId.includes(lowerTerm) || client.includes(lowerTerm) || title.includes(lowerTerm);
    });
  }, [rawFilteredOrders, searchTerm]);

  // 🔥 LÓGICA DE ORDENAMIENTO (NUEVA) 🔥
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const calculateProductStats = (order) => {
    const products = order.productos || order.products || [];
    const total = products.length;
    const completed = products.filter(p => p.estado_prod === 'FINALIZADO').length;
    const inProcess = products.filter(p => p.estado_prod === 'EN_PROCESO').length;
    const startedCount = completed + inProcess; 
    return { total, completed, inProcess, startedCount };
  };

  const sortedOrders = useMemo(() => {
    let sortableItems = [...searchFilteredOrders];
    sortableItems.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'orderNumber') {
         aVal = a.orderNumber || a.order_number || a.id || 0;
         bVal = b.orderNumber || b.order_number || b.id || 0;
      } else if (sortConfig.key === 'completed') {
         aVal = calculateProductStats(a).completed;
         bVal = calculateProductStats(b).completed;
      } else if (sortConfig.key === 'fechaEntrega') {
         aVal = a.fechaEntrega || a.fecha_entrega ? new Date(a.fechaEntrega || a.fecha_entrega).getTime() : 0;
         bVal = b.fechaEntrega || b.fecha_entrega ? new Date(b.fechaEntrega || b.fecha_entrega).getTime() : 0;
      } else if (sortConfig.key === 'cliente') {
         aVal = a.cliente || a.cliente_nombre || '';
         bVal = b.cliente || b.cliente_nombre || '';
      } else if (sortConfig.key === 'tipoLetrero') {
         aVal = a.tipoLetrero || a.tipo_trabajo || '';
         bVal = b.tipoLetrero || b.tipo_trabajo || '';
      }

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined || aVal === 0 || aVal === '') return 1;
      if (bVal === null || bVal === undefined || bVal === 0 || bVal === '') return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sortableItems;
  }, [searchFilteredOrders, sortConfig]);

  const totalItems = sortedOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatOrderId = (order) => {
    if (order.order_number) return order.order_number.toString().padStart(7, '0');
    if (order.orderNumber) return order.orderNumber.toString().padStart(7, '0');
    return (order.id || '').toString().slice(-7).padStart(7, '0');
  };

  const completedTasks = kanbanTasks.filter(t => t.status === 'Completada');

  // --- CONTADORES MATEMÁTICOS GLOBALES ---
  const getOrderCounts = () => {
      let counts = { todas: 0, ventas: 0, produccion: 0, por_retirar: 0, por_finalizar: 0, creditos: 0, impagas: 0 };
      
      orders.forEach(o => {
          if (o.status === 'ANULADA' || o.status === 'ARCHIVADA' || o.status === 'FINALIZADA') return;
          
          const saldoCobrado = (Number(o.financials?.total) || 0) - (Number(o.anticipo) || 0) - (Number(o.retencion) || 0);
          const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
          const saldoFinalReal = saldoCobrado - totalAbonado;
          const isCredito = (o.formaPagoSaldo || '').toLowerCase().includes('crédito') || (o.formaPagoSaldo || '').toLowerCase().includes('credito') || (o.formaPagoAnticipo || '').toLowerCase().includes('crédito');

          // Admin
          if (user.role === 'Administrador') {
              if (['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD'].includes(o.status)) counts.todas++;
              if (o.status === 'VENTAS') counts.ventas++;
              if (o.status === 'PRODUCCION') counts.produccion++;
              if (o.status === 'VENTAS POR RETIRAR') counts.por_retirar++;
              if (o.status === 'CONTABILIDAD') {
                  if (isCredito) counts.creditos++;
                  else if (saldoFinalReal > 0) counts.impagas++;
                  else counts.por_finalizar++;
              }
          }
          
          // Vendedor
          if (user.role === 'Vendedor' && o.vendedor === user.name) {
              if (o.status === 'VENTAS') counts.ventas++;
              if (o.status === 'VENTAS POR RETIRAR') counts.por_retirar++;
          }
          
          // Contabilidad
          if (user.role === 'Contabilidad' && o.status === 'CONTABILIDAD') {
              if (isCredito) counts.creditos++;
              else if (saldoFinalReal > 0) counts.impagas++;
              else counts.por_finalizar++;
          }
      });
      return counts;
  };
  const counts = getOrderCounts();

  // 🔥 COMPONENTE DE CABECERA ORDENABLE (NUEVO) 🔥
  const SortableHeader = ({ label, sortKey, align = 'left', width }) => (
      <th 
          className={`px-6 py-3 whitespace-nowrap font-bold cursor-pointer hover:bg-slate-50 transition-colors select-none ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${width ? width : ''}`} 
          onClick={() => requestSort(sortKey)}
      >
          <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
              {label}
              <ArrowUpDown className={`h-3 w-3 ${sortConfig.key === sortKey ? 'text-blue-600' : 'text-slate-400'}`} />
          </div>
      </th>
  );

  return (
    <div className="space-y-4">
       {/* Tab Switcher - Main Control for this View */}
       <div className="flex flex-wrap gap-1 bg-slate-200 p-1.5 rounded-lg w-fit border border-slate-300 shadow-inner">
          <button onClick={() => setViewMode('list')} className={cn("px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all", viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50')}>
             <LayoutList className="h-4 w-4" /> LISTADO
          </button>
          <button onClick={() => setViewMode('board')} className={cn("px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all", viewMode === 'board' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50')}>
             <KanbanIcon className="h-4 w-4" /> TABLERO KANBAN
          </button>
          <button onClick={() => setViewMode('completed')} className={cn("px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all", viewMode === 'completed' ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:text-green-700 hover:bg-slate-300/50')}>
             <CheckCircle2 className="h-4 w-4" /> TAREAS COMPLETADAS <span className="ml-1 bg-black/10 px-1.5 py-0.5 rounded-full text-[10px]">{completedTasks.length}</span>
          </button>
       </div>

       <div>
         {viewMode === 'list' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300 min-h-[600px] flex flex-col">
               
               {/* 🔥 TORRE DE CONTROL: ADMINISTRADOR 🔥 */}
               {user.role === 'Administrador' && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Search className="h-4 w-4 text-slate-500"/>
                        <span className="text-sm font-bold text-slate-700">Filtros de Área (Vista Global)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {/* Global */}
                        <button onClick={() => setListFilter('todas')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'todas' ? "bg-slate-800 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <Globe className="h-4 w-4" /> TODAS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.todas}</span>
                        </button>
                        
                        <div className="w-px bg-slate-300 mx-1"></div>
                        
                        {/* Ventas y Prod */}
                        <button onClick={() => setListFilter('ventas')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'ventas' ? "bg-blue-600 text-white border-blue-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <ShoppingCart className="h-4 w-4" /> VENTAS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.ventas}</span>
                        </button>
                        <button onClick={() => setListFilter('produccion')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'produccion' ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <Wrench className="h-4 w-4" /> PRODUCCIÓN <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.produccion}</span>
                        </button>
                        <button onClick={() => setListFilter('por_retirar')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'por_retirar' ? "bg-green-600 text-white border-green-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <PackageCheck className="h-4 w-4" /> POR RETIRAR <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.por_retirar}</span>
                        </button>
                        
                        <div className="w-px bg-slate-300 mx-1"></div>

                        {/* Contabilidad */}
                        <button onClick={() => setListFilter('por_finalizar')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'por_finalizar' ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <FileSignature className="h-4 w-4" /> POR CERRAR <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.por_finalizar}</span>
                        </button>
                        <button onClick={() => setListFilter('creditos')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'creditos' ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <Wallet className="h-4 w-4" /> CRÉDITOS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.creditos}</span>
                        </button>
                        <button onClick={() => setListFilter('impagas')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'impagas' ? "bg-red-600 text-white border-red-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <AlertOctagon className="h-4 w-4" /> IMPAGAS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.impagas}</span>
                        </button>
                    </div>
                 </div>
               )}

               {/* 🔥 VISTA DE VENDEDOR 🔥 */}
               {user.role === 'Vendedor' && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-center">
                    <button onClick={() => setListFilter('ventas')} className={cn("px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border", listFilter === 'ventas' ? "bg-blue-600 text-white border-blue-700 shadow-blue-200" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                        <ShoppingCart className="h-5 w-5" /> EN VENTAS
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'ventas' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>{counts.ventas}</span>
                    </button>
                    <button onClick={() => setListFilter('por_retirar')} className={cn("px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border", listFilter === 'por_retirar' ? "bg-green-600 text-white border-green-700 shadow-green-200" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                        <PackageCheck className="h-5 w-5" /> POR RETIRAR
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'por_retirar' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>{counts.por_retirar}</span>
                    </button>
                 </div>
               )}

               {/* 🔥 VISTA DE CONTABILIDAD 🔥 */}
               {user.role === 'Contabilidad' && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-center">
                    <button onClick={() => setListFilter('por_finalizar')} className={cn("px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border", listFilter === 'por_finalizar' ? "bg-indigo-600 text-white border-indigo-700 shadow-blue-200" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                        <FileSignature className="h-5 w-5" /> POR FINALIZAR
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'por_finalizar' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>{counts.por_finalizar}</span>
                    </button>
                    <button onClick={() => setListFilter('creditos')} className={cn("px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border", listFilter === 'creditos' ? "bg-amber-500 text-white border-amber-600 shadow-amber-200" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                        <Wallet className="h-5 w-5" /> CRÉDITOS
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'creditos' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>{counts.creditos}</span>
                    </button>
                    <button onClick={() => setListFilter('impagas')} className={cn("px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border", listFilter === 'impagas' ? "bg-red-600 text-white border-red-700 shadow-red-200" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                        <AlertOctagon className="h-5 w-5" /> IMPAGAS
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'impagas' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>{counts.impagas}</span>
                    </button>
                 </div>
               )}

               {/* Barra de título para Producción */}
               {user.role === 'Producción' && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-700">Tus Tareas Asignadas - Departamento de Producción</h3>
                 </div>
               )}

               {/* Controls Bar (Paginación y Buscador) */}
               <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
                   <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                       <span>Mostrar</span>
                       <select className="border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                           <option value={10}>10</option>
                           <option value={25}>25</option>
                           <option value={50}>50</option>
                           <option value={100}>100</option>
                       </select>
                       <span>registros</span>
                   </div>

                   <div className="flex items-center gap-2 w-full md:w-auto">
                       <span className="text-sm font-bold text-slate-700">Buscar:</span>
                       <div className="relative">
                          <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                          <input type="text" className="border border-slate-300 rounded pl-9 pr-3 py-1 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="Nombre, ID, Cédula..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                       </div>
                   </div>
               </div>

               {/* Table */}
               <div className="overflow-x-auto flex-1 bg-slate-50/30">
               <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-700 font-bold border-b border-slate-200 bg-white">
                     <tr>
                        {/* 🔥 COLUMNAS ORDENABLES APLICADAS AQUÍ 🔥 */}
                        <SortableHeader label="Orden" sortKey="orderNumber" />
                        <SortableHeader label="Estado Actual" sortKey="status" />
                        <SortableHeader label="Producidos / TOTAL" sortKey="completed" align="center" />
                        <SortableHeader label="Fecha ENTREGA" sortKey="fechaEntrega" />
                        <SortableHeader label="Cliente" sortKey="cliente" />
                        <SortableHeader label="Titulo" sortKey="tipoLetrero" />
                        
                        {(user.role === 'Contabilidad' || user.role === 'Administrador') && <th className="px-6 py-3 whitespace-nowrap text-center">Acciones</th>}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {paginatedOrders.length > 0 ? (
                        paginatedOrders.map(order => {
                          const stats = calculateProductStats(order);
                          const isFullyCompleted = stats.total > 0 && stats.completed === stats.total;
                          const hasProgress = stats.startedCount > 0;

                          return (
                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors group cursor-pointer bg-white" onClick={() => onViewOrder(order)}>
                               <td className="px-6 py-3">
                                  <span className="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100 group-hover:underline shadow-sm">#{formatOrderId(order)}</span>
                               </td>
                               <td className="px-6 py-3 text-xs font-bold">
                                   <span className={cn("px-2 py-1 rounded shadow-sm border", order.status === 'VENTAS' ? 'bg-blue-50 text-blue-700 border-blue-200' : order.status === 'PRODUCCION' ? 'bg-amber-50 text-amber-700 border-amber-200' : order.status === 'VENTAS POR RETIRAR' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 border-slate-200')}>
                                       {order.status}
                                   </span>
                               </td>
                               <td className="px-6 py-3 text-center text-slate-700 font-medium">
                                   <span className={cn("px-3 py-1 rounded-full text-xs font-bold inline-flex items-center border shadow-sm", isFullyCompleted ? "bg-green-100 text-green-700 border-green-200" : hasProgress ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                                       {stats.completed} / {stats.total}
                                   </span>
                               </td>
                               <td className="px-6 py-3 text-slate-600">{formatDate(order.fechaEntrega || order.fecha_entrega)}</td>
                               <td className="px-6 py-3 text-slate-800 uppercase text-xs font-semibold">{order.cliente || order.cliente_nombre}</td>
                               <td className="px-6 py-3 text-slate-600 uppercase text-xs">{order.tipoLetrero || order.tipo_trabajo}</td>
                               
                               {(user.role === 'Contabilidad' || user.role === 'Administrador') && (
                                  <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                      {order.status === 'CONTABILIDAD' && onAbonoOrder ? (
                                          <Button size="sm" onClick={() => onAbonoOrder(order)} className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 shadow-sm mx-auto">
                                              <DollarSign className="h-4 w-4"/> Cobrar
                                          </Button>
                                      ) : (
                                          <span className="text-xs text-slate-400">-</span>
                                      )}
                                  </td>
                               )}
                            </tr>
                          );
                        })
                     ) : (
                        <tr>
                           <td colSpan={(user.role === 'Contabilidad' || user.role === 'Administrador') ? "7" : "6"} className="px-6 py-16 text-center text-slate-500 bg-white">
                              <div className="flex flex-col items-center gap-2">
                                 <Search className="h-8 w-8 text-slate-300" />
                                 <span className="text-lg font-medium text-slate-600">Lista Limpia</span>
                                 <span className="text-sm">No tienes tareas pendientes en esta categoría.</span>
                              </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
               </div>
               
               {/* Pagination Footer */}
               <div className="px-6 py-3 border-t border-slate-200 bg-white text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>Mostrando del <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> al <span className="font-semibold">{endIndex}</span> de un total de <span className="font-semibold text-slate-900">{totalItems}</span> registros</div>
                  <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 px-2 border-slate-300" onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.max(prev - 1, 1)); }} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</Button>
                      <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded shadow-sm text-blue-700 font-bold min-w-[32px] text-center mx-2">{currentPage} <span className="text-slate-400 font-normal mx-1">/</span> {totalPages || 1}</div>
                      <Button variant="outline" size="sm" className="h-8 px-2 border-slate-300" onClick={(e) => { e.stopPropagation(); setCurrentPage(prev => Math.min(prev + 1, totalPages)); }} disabled={currentPage >= totalPages}>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></Button>
                  </div>
               </div>
            </div>
         )}

         {viewMode === 'board' && (
            <div className="animate-in fade-in duration-300">
               <KanbanBoard tasks={kanbanTasks || []} orders={orders} staffUsers={staffUsers} onTaskUpdate={onKanbanUpdate} onTaskCreate={onKanbanCreate} onTaskDelete={onKanbanDelete} onViewOrder={onViewOrder} />
            </div>
         )}

         {viewMode === 'completed' && (
            <div className="animate-in fade-in duration-300">
               <CompletedTasksList tasks={completedTasks} orders={orders} onViewOrder={onViewOrder} />
            </div>
         )}
       </div>
    </div>
  );
};

export default WorkAreaList;