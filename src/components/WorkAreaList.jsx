import React, { useState, useEffect, useMemo } from 'react';
import { LayoutList, Kanban as KanbanIcon, CheckCircle2, Search, ChevronLeft, ChevronRight, Settings, ArrowUpDown } from 'lucide-react';
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
  initialMode = 'list'
}) => {
  const [viewMode, setViewMode] = useState(initialMode); // 'list' | 'board' | 'completed'
  const [contaTab, setContaTab] = useState('normal'); // 'normal', 'creditos', 'impagas'
  
  // States for Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // 🔥 ESTADO DE ORDENAMIENTO 🔥
  const [sortConfig, setSortConfig] = useState({ key: 'fechaEntrega', direction: 'asc' });

  useEffect(() => {
     if(initialMode) setViewMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, contaTab]);

  // --- Formatters & Helpers ---
  const calculateProductStats = (order) => {
    const products = order.productos || [];
    const total = products.length;
    const completed = products.filter(p => p.estado_prod === 'FINALIZADO' || p.completed).length;
    return { total, completed, startedCount: products.length };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const formatOrderId = (order) => {
    if (order.orderNumber) return order.orderNumber.toString().padStart(7, '0');
    return (order.id || '').toString().slice(-7).padStart(7, '0');
  };

  // --- Filtering Logic ---
  const rawFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Basic Status Filters
      if (order.status === 'ANULADA' || order.status === 'ARCHIVADA') return false;
      if (user.role === 'Administrador') return order.status === 'FINALIZADA';
      if (order.status === 'FINALIZADA') return false;
      
      // Role-based visibility
      if (user.role === 'Producción') return order.status === 'PRODUCCION';
      if (user.role === 'Contabilidad') return order.status === 'CONTABILIDAD';
      if (user.role === 'Vendedor') return ['VENTAS', 'VENTAS POR RETIRAR'].includes(order.status);
      
      return false;
    });
  }, [orders, user.role]);

  // --- Search & Tabs Logic ---
  const searchFilteredOrders = useMemo(() => {
    let filtered = rawFilteredOrders;
    
    // 🔥 FILTROS ESPECÍFICOS PARA CONTABILIDAD (LAS 3 TAREAS) 🔥
    if (user.role === 'Contabilidad') {
        filtered = filtered.filter(order => {
            const pA = String(order.formaPagoAnticipo || order.forma_pago_anticipo || '').toLowerCase();
            const pS = String(order.formaPagoSaldo || order.financials?.formaPagoSaldo || '').toLowerCase();
            const isCredito = pA.includes('crédito') || pA.includes('credito') || pS.includes('crédito') || pS.includes('credito');
            
            const total = Number(order.financials?.total) || 0;
            const anticipo = Number(order.anticipo) || 0;
            const retencion = Number(order.retencion) || 0;
            const abonos = (order.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
            const saldoReal = Math.max(0, total - anticipo - retencion - abonos);

            if (contaTab === 'normal') return !isCredito && saldoReal <= 0.02; // Pagadas al 100%
            if (contaTab === 'creditos') return isCredito; // Créditos
            if (contaTab === 'impagas') return !isCredito && saldoReal > 0.02; // Faltan de pagar
            return true;
        });
    }

    if (!searchTerm) return filtered;
    
    const lowerTerm = searchTerm.toLowerCase();
    return filtered.filter(order => {
      const orderId = (order.orderNumber || order.id || '').toString();
      const client = (order.cliente || '').toLowerCase();
      const title = (order.tipoLetrero || '').toLowerCase();
      const date = (order.fechaEntrega || '').toLowerCase();
      
      return orderId.includes(lowerTerm) || client.includes(lowerTerm) || title.includes(lowerTerm) || date.includes(lowerTerm);
    });
  }, [rawFilteredOrders, searchTerm, user.role, contaTab]);

  // 🔥 LÓGICA DE ORDENAMIENTO 🔥
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedOrders = useMemo(() => {
    let sortableItems = [...searchFilteredOrders];
    sortableItems.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'orderNumber') {
         aVal = a.orderNumber || a.id || 0;
         bVal = b.orderNumber || b.id || 0;
      } else if (sortConfig.key === 'startedCount') {
         aVal = calculateProductStats(a).startedCount;
         bVal = calculateProductStats(b).startedCount;
      } else if (sortConfig.key === 'completed') {
         aVal = calculateProductStats(a).completed;
         bVal = calculateProductStats(b).completed;
      } else if (sortConfig.key === 'fechaEntrega') {
         aVal = new Date(a.fechaEntrega || a.fecha_entrega || 0).getTime();
         bVal = new Date(b.fechaEntrega || b.fecha_entrega || 0).getTime();
      }

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sortableItems;
  }, [searchFilteredOrders, sortConfig]);

  // --- Pagination Logic ---
  const totalItems = sortedOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

  // Filter tasks for Completed View
  const completedTasks = kanbanTasks.filter(t => t.status === 'Completada');

  // 🔥 COMPONENTE DE CABECERA ORDENABLE 🔥
  const SortableHeader = ({ label, sortKey, align = 'left', width }) => (
      <th 
          className={`px-6 py-3 font-bold cursor-pointer hover:bg-slate-50 transition-colors select-none border-b border-slate-200 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${width ? width : ''}`} 
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
       <div className="flex flex-wrap gap-1 bg-slate-200 p-1.5 rounded-lg w-fit border border-slate-300 shadow-inner">
          <button onClick={() => setViewMode('list')} className={cn("px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all", viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50')}><LayoutList className="h-4 w-4" />LISTADO</button>
          <button onClick={() => setViewMode('board')} className={cn("px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all", viewMode === 'board' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50')}><KanbanIcon className="h-4 w-4" />TABLERO KANBAN</button>
          <button onClick={() => setViewMode('completed')} className={cn("px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all", viewMode === 'completed' ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:text-green-700 hover:bg-slate-300/50')}><CheckCircle2 className="h-4 w-4" />TAREAS COMPLETADAS<span className="ml-1 bg-black/10 px-1.5 py-0.5 rounded-full text-[10px]">{completedTasks.length}</span></button>
       </div>

       {/* 🔥 PESTAÑAS EXCLUSIVAS DE CONTABILIDAD 🔥 */}
       {user.role === 'Contabilidad' && viewMode === 'list' && (
           <div className="flex flex-wrap items-center gap-2 mt-4 mb-2">
               <Button variant={contaTab === 'normal' ? 'default' : 'outline'} size="sm" onClick={() => setContaTab('normal')} className={cn(contaTab === 'normal' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-slate-600', "font-bold shadow-sm")}>
                   🟢 Por Finalizar (Pagadas)
               </Button>
               <Button variant={contaTab === 'creditos' ? 'default' : 'outline'} size="sm" onClick={() => setContaTab('creditos')} className={cn(contaTab === 'creditos' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'text-slate-600', "font-bold shadow-sm")}>
                   🟡 Órdenes a Crédito
               </Button>
               <Button variant={contaTab === 'impagas' ? 'default' : 'outline'} size="sm" onClick={() => setContaTab('impagas')} className={cn(contaTab === 'impagas' ? 'bg-red-600 text-white hover:bg-red-700' : 'text-slate-600', "font-bold shadow-sm")}>
                   🔴 Órdenes Impagas
               </Button>
           </div>
       )}

       <div>
         {viewMode === 'list' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300 min-h-[600px]">
               
               <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
                   <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                       <span>Mostrar</span>
                       <select className="border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                           <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                       </select>
                       <span>registros</span>
                   </div>

                   <div className="flex items-center gap-2 w-full md:w-auto">
                       <span className="text-sm font-bold text-slate-700">Buscar:</span>
                       <div className="relative">
                          <input type="text" className="border border-slate-300 rounded px-3 py-1 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                       </div>
                   </div>
               </div>

               <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-700 bg-white">
                     <tr>
                        <SortableHeader label="Orden" sortKey="orderNumber" />
                        <SortableHeader label="Iniciada (items)" sortKey="startedCount" align="center" />
                        <SortableHeader label="Producidos / TOTAL" sortKey="completed" align="center" />
                        <SortableHeader label="Fecha ENTREGA" sortKey="fechaEntrega" />
                        <SortableHeader label="Cliente" sortKey="cliente" />
                        <SortableHeader label="Titulo" sortKey="tipoLetrero" />
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {paginatedOrders.length > 0 ? (
                        paginatedOrders.map(order => {
                          const stats = calculateProductStats(order);
                          return (
                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors group">
                               <td className="px-6 py-3">
                                  <button onClick={() => onViewOrder(order)} className="text-blue-500 hover:text-blue-700 font-bold hover:underline">
                                     {formatOrderId(order)}
                                  </button>
                               </td>
                               <td className="px-6 py-3 text-slate-600 text-center">
                                   <div className="flex items-center justify-center gap-2">
                                     <Settings className="h-4 w-4 text-slate-400" />
                                     <span className="font-bold">({stats.startedCount})</span>
                                   </div>
                               </td>
                               <td className="px-6 py-3 text-slate-700 font-bold text-center">
                                   {stats.completed} / {stats.total}
                               </td>
                               <td className="px-6 py-3 text-slate-600 font-medium">
                                  {formatDate(order.fechaEntrega)}
                               </td>
                               <td className="px-6 py-3 text-slate-800 uppercase text-xs font-bold">
                                  {order.cliente}
                               </td>
                               <td className="px-6 py-3 text-slate-600 uppercase text-xs font-medium">
                                  {order.tipoLetrero}
                               </td>
                            </tr>
                          );
                        })
                     ) : (
                        <tr>
                           <td colSpan="6" className="px-6 py-12 text-center text-slate-500 italic">
                              <div className="flex flex-col items-center gap-2">
                                 <span className="text-lg font-medium text-slate-400">Sin resultados</span>
                                 <span>No se encontraron registros en esta vista.</span>
                              </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
               </div>
               
               <div className="px-6 py-3 border-t border-slate-200 bg-white text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>Mostrando registros del <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> al <span className="font-semibold">{endIndex}</span> de un total de <span className="font-semibold">{totalItems}</span> registros</div>
                  <div className="flex items-center gap-1">
                      <span className="mr-2 text-slate-500">{currentPage > 1 ? 'Anterior' : 'Anterior'}</span>
                      <Button variant="outline" size="sm" className="h-8 px-2 border-slate-300" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                      <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium min-w-[32px] text-center">{currentPage}</div>
                      <Button variant="outline" size="sm" className="h-8 px-2 border-slate-300" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
                      <span className="ml-2 text-slate-500">{currentPage < totalPages ? 'Siguiente' : 'Siguiente'}</span>
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