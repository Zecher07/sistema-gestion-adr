import React, { useState, useEffect, useMemo } from 'react';
import { LayoutList, Kanban as KanbanIcon, CheckCircle2, Search, ChevronLeft, ChevronRight, Settings, Play } from 'lucide-react';
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
  
  // States for Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
     if(initialMode) setViewMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    // Reset page on search
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

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

  // --- Search Logic ---
  const searchFilteredOrders = useMemo(() => {
    if (!searchTerm) return rawFilteredOrders;
    
    const lowerTerm = searchTerm.toLowerCase();
    
    return rawFilteredOrders.filter(order => {
      const orderId = (order.order_number || order.orderNumber || order.id || '').toString();
      const client = (order.cliente || order.cliente_nombre || '').toLowerCase();
      const title = (order.tipoLetrero || order.tipo_trabajo || '').toLowerCase();
      const date = (order.fechaEntrega || order.fecha_entrega || '').toLowerCase();
      
      return orderId.includes(lowerTerm) || 
             client.includes(lowerTerm) || 
             title.includes(lowerTerm) ||
             date.includes(lowerTerm);
    });
  }, [rawFilteredOrders, searchTerm]);

  // --- Pagination Logic ---
  const totalItems = searchFilteredOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedOrders = searchFilteredOrders.slice(startIndex, endIndex);

  // --- Formatters ---
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Format: YYYY-MM-DD HH:MM:SS
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
    if (order.order_number) return order.order_number.toString().padStart(7, '0');
    if (order.orderNumber) return order.orderNumber.toString().padStart(7, '0');
    return (order.id || '').toString().slice(-7).padStart(7, '0');
  };

  // 🔥 NUEVA LÓGICA DE CÁLCULO DE PROGRESO 🔥
  const calculateProductStats = (order) => {
    const products = order.productos || order.products || [];
    const total = products.length;
    
    // Contamos los que están marcados como FINALIZADO según tu nueva lógica
    const completed = products.filter(p => p.estado_prod === 'FINALIZADO').length;
    
    // Contamos los que están en proceso actualmente
    const inProcess = products.filter(p => p.estado_prod === 'EN_PROCESO').length;
    
    // Iniciados son todos los que no son PENDIENTES
    const startedCount = completed + inProcess; 
    
    return {
        total,
        completed,
        inProcess,
        startedCount
    };
  };

  // Filter tasks for Completed View
  const completedTasks = kanbanTasks.filter(t => t.status === 'Completada');

  return (
    <div className="space-y-4">
       {/* Tab Switcher - Main Control for this View */}
       <div className="flex flex-wrap gap-1 bg-slate-200 p-1.5 rounded-lg w-fit border border-slate-300 shadow-inner">
          <button
             onClick={() => setViewMode('list')}
             className={cn(
                "px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all",
                viewMode === 'list' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'
             )}
          >
             <LayoutList className="h-4 w-4" />
             LISTADO
          </button>
          <button
             onClick={() => setViewMode('board')}
             className={cn(
                "px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all",
                viewMode === 'board' 
                ? 'bg-slate-800 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'
             )}
          >
             <KanbanIcon className="h-4 w-4" />
             TABLERO KANBAN
          </button>
          <button
             onClick={() => setViewMode('completed')}
             className={cn(
                "px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all",
                viewMode === 'completed' 
                ? 'bg-green-600 text-white shadow-md' 
                : 'text-slate-500 hover:text-green-700 hover:bg-slate-300/50'
             )}
          >
             <CheckCircle2 className="h-4 w-4" />
             TAREAS COMPLETADAS
             <span className="ml-1 bg-black/10 px-1.5 py-0.5 rounded-full text-[10px]">
                {completedTasks.length}
             </span>
          </button>
       </div>

       <div>
         {viewMode === 'list' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300 min-h-[600px]">
               
               {/* Controls Bar */}
               <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
                   {/* Left: Page Size */}
                   <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                       <span>Mostrar</span>
                       <select 
                          className="border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                          value={itemsPerPage}
                          onChange={(e) => setItemsPerPage(Number(e.target.value))}
                       >
                           <option value={10}>10</option>
                           <option value={25}>25</option>
                           <option value={50}>50</option>
                           <option value={100}>100</option>
                       </select>
                       <span>registros</span>
                   </div>

                   {/* Right: Search */}
                   <div className="flex items-center gap-2 w-full md:w-auto">
                       <span className="text-sm font-bold text-slate-700">Buscar:</span>
                       <div className="relative">
                          <input 
                             type="text"
                             className="border border-slate-300 rounded px-3 py-1 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)}
                          />
                       </div>
                   </div>
               </div>

               {/* Table */}
               <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-700 font-bold border-b border-slate-200 bg-white">
                     <tr>
                        <th className="px-6 py-3 whitespace-nowrap">Orden</th>
                        <th className="px-6 py-3 whitespace-nowrap">Iniciada (items)</th>
                        <th className="px-6 py-3 whitespace-nowrap">Producidos / TOTAL</th>
                        <th className="px-6 py-3 whitespace-nowrap">Fecha ENTREGA</th>
                        <th className="px-6 py-3 whitespace-nowrap">Cliente</th>
                        <th className="px-6 py-3 whitespace-nowrap">Titulo</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {paginatedOrders.length > 0 ? (
                        paginatedOrders.map(order => {
                          const stats = calculateProductStats(order);
                          
                          // Lógica de color para el badge de producción
                          const isFullyCompleted = stats.total > 0 && stats.completed === stats.total;
                          const hasProgress = stats.startedCount > 0;

                          return (
                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors group">
                               <td className="px-6 py-3">
                                  <button 
                                     onClick={() => onViewOrder(order)}
                                     className="text-blue-600 hover:text-blue-800 font-bold hover:underline bg-blue-50 px-2 py-1 rounded"
                                  >
                                     #{formatOrderId(order)}
                                  </button>
                               </td>
                               <td className="px-6 py-3 text-slate-600">
                                   <div className="flex items-center gap-2">
                                     <Play className={cn("h-4 w-4", hasProgress ? "text-blue-500" : "text-slate-300")} />
                                     <span className={hasProgress ? "font-bold text-slate-800" : ""}>({stats.startedCount})</span>
                                   </div>
                               </td>
                               <td className="px-6 py-3 text-slate-700 font-medium">
                                   <span className={cn(
                                       "px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center border",
                                       isFullyCompleted 
                                          ? "bg-green-100 text-green-700 border-green-200" 
                                          : hasProgress 
                                            ? "bg-blue-100 text-blue-700 border-blue-200"
                                            : "bg-slate-100 text-slate-500 border-slate-200"
                                   )}>
                                       {stats.completed} / {stats.total}
                                   </span>
                               </td>
                               <td className="px-6 py-3 text-slate-600">
                                  {formatDate(order.fechaEntrega || order.fecha_entrega)}
                               </td>
                               <td className="px-6 py-3 text-slate-800 uppercase text-xs font-semibold">
                                  {order.cliente || order.cliente_nombre}
                               </td>
                               <td className="px-6 py-3 text-slate-600 uppercase text-xs">
                                  {order.tipoLetrero || order.tipo_trabajo}
                               </td>
                            </tr>
                          );
                        })
                     ) : (
                        <tr>
                           <td colSpan="6" className="px-6 py-12 text-center text-slate-500 italic">
                              <div className="flex flex-col items-center gap-2">
                                 <span className="text-lg font-medium text-slate-400">Sin resultados</span>
                                 <span>No se encontraron registros que coincidan con la búsqueda.</span>
                              </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
               </div>
               
               {/* Pagination Footer */}
               <div className="px-6 py-3 border-t border-slate-200 bg-white text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                      Mostrando registros del <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> al <span className="font-semibold">{endIndex}</span> de un total de <span className="font-semibold">{totalItems}</span> registros
                  </div>
                  
                  <div className="flex items-center gap-1">
                      <span className="mr-2 text-slate-500">
                         Anterior
                      </span>
                      <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-8 px-2 border-slate-300"
                         onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                         disabled={currentPage === 1}
                      >
                         <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium min-w-[32px] text-center">
                          {currentPage}
                      </div>

                      <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-8 px-2 border-slate-300"
                         onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                         disabled={currentPage >= totalPages}
                      >
                         <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="ml-2 text-slate-500">
                         Siguiente
                      </span>
                  </div>
               </div>
            </div>
         )}

         {viewMode === 'board' && (
            <div className="animate-in fade-in duration-300">
               <KanbanBoard 
                 tasks={kanbanTasks || []}
                 orders={orders}
                 staffUsers={staffUsers}
                 onTaskUpdate={onKanbanUpdate}
                 onTaskCreate={onKanbanCreate}
                 onTaskDelete={onKanbanDelete}
                 onViewOrder={onViewOrder}
               />
            </div>
         )}

         {viewMode === 'completed' && (
            <div className="animate-in fade-in duration-300">
               <CompletedTasksList 
                 tasks={completedTasks}
                 orders={orders}
                 onViewOrder={onViewOrder}
               />
            </div>
         )}
       </div>
    </div>
  );
};

export default WorkAreaList;