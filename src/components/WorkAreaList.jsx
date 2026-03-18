import React, { useState, useEffect, useMemo } from 'react';
import { LayoutList, Kanban as KanbanIcon, CheckCircle2, Search, ChevronLeft, ChevronRight, Play, PackageSearch, PackageCheck } from 'lucide-react';
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
  
  // Filtro principal para la tabla (Ingresadas vs Por Retirar)
  const [listFilter, setListFilter] = useState('ingresadas'); // 'ingresadas' | 'por_retirar'
  
  // States for Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
     if(initialMode) setViewMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    // Reset page on search or filter change
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, listFilter]);

  // --- LÓGICA ESTRICTA DE FILTRADO POR ROL (TAREAS ASIGNADAS) ---
  const rawFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Ignorar siempre lo que ya no está activo
      if (order.status === 'ANULADA' || order.status === 'ARCHIVADA' || order.status === 'FINALIZADA') return false;
      
      // 1. PRODUCCIÓN: Solo ve lo que está físicamente en Producción
      if (user.role === 'Producción') {
          return order.status === 'PRODUCCION'; 
      }
      
      // 2. CONTABILIDAD: Solo ve lo que llegó a Contabilidad
      if (user.role === 'Contabilidad') {
          return order.status === 'CONTABILIDAD'; 
      }
      
      // 3. VENDEDOR: Solo ve SUS propias órdenes, y estrictamente lo que requiere su acción
      if (user.role === 'Vendedor') {
          if (order.vendedor !== user.name) return false; // Bloqueo: Solo ve lo suyo
          
          if (listFilter === 'ingresadas') {
              return order.status === 'VENTAS'; // Solo ve lo recién ingresado (no ve Producción ni Contab)
          } else if (listFilter === 'por_retirar') {
              return order.status === 'VENTAS POR RETIRAR'; // Tareas de entrega
          }
      }

      // 4. ADMINISTRADOR: Auditoría global, ve todo el flujo
      if (user.role === 'Administrador') {
          if (listFilter === 'ingresadas') {
              return ['VENTAS', 'PRODUCCION', 'CONTABILIDAD'].includes(order.status);
          } else if (listFilter === 'por_retirar') {
              return order.status === 'VENTAS POR RETIRAR';
          }
      }
      
      return false;
    });
  }, [orders, user.role, listFilter, user.name]);

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

  // --- PROGRESS CALC ---
  const calculateProductStats = (order) => {
    const products = order.productos || order.products || [];
    const total = products.length;
    
    const completed = products.filter(p => p.estado_prod === 'FINALIZADO').length;
    const inProcess = products.filter(p => p.estado_prod === 'EN_PROCESO').length;
    const startedCount = completed + inProcess; 
    
    return { total, completed, inProcess, startedCount };
  };

  const completedTasks = kanbanTasks.filter(t => t.status === 'Completada');

  // Cálculos precisos para las "burbujas" de contador según el rol
  const countIngresadas = orders.filter(o => {
      if (o.status === 'ANULADA' || o.status === 'ARCHIVADA' || o.status === 'FINALIZADA') return false;
      if (user.role === 'Vendedor') return o.status === 'VENTAS' && o.vendedor === user.name;
      if (user.role === 'Administrador') return ['VENTAS', 'PRODUCCION', 'CONTABILIDAD'].includes(o.status);
      return false;
  }).length;

  const countPorRetirar = orders.filter(o => {
      if (o.status === 'ANULADA' || o.status === 'ARCHIVADA' || o.status === 'FINALIZADA') return false;
      if (user.role === 'Vendedor') return o.status === 'VENTAS POR RETIRAR' && o.vendedor === user.name;
      if (user.role === 'Administrador') return o.status === 'VENTAS POR RETIRAR';
      return false;
  }).length;

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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300 min-h-[600px] flex flex-col">
               
               {/* BOTONES INDEPENDIENTES DE FILTRO (Solo para Vendedor/Admin) */}
               {(user.role === 'Vendedor' || user.role === 'Administrador') && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-center">
                    <button
                        onClick={() => setListFilter('ingresadas')}
                        className={cn(
                            "px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border",
                            listFilter === 'ingresadas' 
                                ? "bg-blue-600 text-white border-blue-700 shadow-blue-200" 
                                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                        )}
                    >
                        <PackageSearch className="h-5 w-5" />
                        {user.role === 'Vendedor' ? 'ÓRDENES EN VENTAS' : 'ÓRDENES EN PROCESO'}
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'ingresadas' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>
                           {countIngresadas}
                        </span>
                    </button>
                    
                    <button
                        onClick={() => setListFilter('por_retirar')}
                        className={cn(
                            "px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border",
                            listFilter === 'por_retirar' 
                                ? "bg-green-600 text-white border-green-700 shadow-green-200" 
                                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                        )}
                    >
                        <PackageCheck className="h-5 w-5" />
                        ÓRDENES POR RETIRAR
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'por_retirar' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>
                           {countPorRetirar}
                        </span>
                    </button>
                 </div>
               )}

               {/* Barra de título para Producción y Contabilidad */}
               {(user.role === 'Producción' || user.role === 'Contabilidad') && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-700">
                       Tus Tareas Asignadas - Departamento de {user.role}
                    </h3>
                 </div>
               )}

               {/* Controls Bar (Paginación y Buscador) */}
               <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
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

                   <div className="flex items-center gap-2 w-full md:w-auto">
                       <span className="text-sm font-bold text-slate-700">Buscar:</span>
                       <div className="relative">
                          <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
                          <input 
                             type="text"
                             className="border border-slate-300 rounded pl-9 pr-3 py-1 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                             placeholder="Nombre, ID, Cédula..."
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)}
                          />
                       </div>
                   </div>
               </div>

               {/* Table */}
               <div className="overflow-x-auto flex-1 bg-slate-50/30">
               <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-700 font-bold border-b border-slate-200 bg-white">
                     <tr>
                        <th className="px-6 py-3 whitespace-nowrap">Orden</th>
                        <th className="px-6 py-3 whitespace-nowrap">Estado Actual</th> 
                        <th className="px-6 py-3 whitespace-nowrap text-center">Producidos / TOTAL</th>
                        <th className="px-6 py-3 whitespace-nowrap">Fecha ENTREGA</th>
                        <th className="px-6 py-3 whitespace-nowrap">Cliente</th>
                        <th className="px-6 py-3 whitespace-nowrap">Titulo</th>
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
                                  <span className="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100 group-hover:underline shadow-sm">
                                     #{formatOrderId(order)}
                                  </span>
                               </td>
                               <td className="px-6 py-3 text-xs font-bold">
                                   <span className={cn(
                                       "px-2 py-1 rounded shadow-sm border",
                                       order.status === 'VENTAS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                       order.status === 'PRODUCCION' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                       order.status === 'VENTAS POR RETIRAR' ? 'bg-green-50 text-green-700 border-green-200' :
                                       'bg-slate-50 text-slate-700 border-slate-200'
                                   )}>
                                       {order.status}
                                   </span>
                               </td>
                               <td className="px-6 py-3 text-center text-slate-700 font-medium">
                                   <span className={cn(
                                       "px-3 py-1 rounded-full text-xs font-bold inline-flex items-center border shadow-sm",
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
                           <td colSpan="6" className="px-6 py-16 text-center text-slate-500 bg-white">
                              <div className="flex flex-col items-center gap-2">
                                 {listFilter === 'por_retirar' ? (
                                     <>
                                        <PackageCheck className="h-8 w-8 text-slate-300" />
                                        <span className="text-lg font-medium text-slate-600">No hay órdenes listas</span>
                                        <span className="text-sm">Aún no tienes órdenes marcadas como "Ventas por Retirar".</span>
                                     </>
                                 ) : (
                                     <>
                                        <Search className="h-8 w-8 text-slate-300" />
                                        <span className="text-lg font-medium text-slate-600">Lista Limpia</span>
                                        <span className="text-sm">No tienes tareas pendientes en este momento.</span>
                                     </>
                                 )}
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
                      Mostrando del <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> al <span className="font-semibold">{endIndex}</span> de un total de <span className="font-semibold text-slate-900">{totalItems}</span> registros
                  </div>
                  
                  <div className="flex items-center gap-1">
                      <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-8 px-2 border-slate-300"
                         onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                         disabled={currentPage === 1}
                      >
                         <ChevronLeft className="h-4 w-4 mr-1" />
                         Anterior
                      </Button>
                      
                      <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded shadow-sm text-blue-700 font-bold min-w-[32px] text-center mx-2">
                          {currentPage} <span className="text-slate-400 font-normal mx-1">/</span> {totalPages || 1}
                      </div>

                      <Button 
                         variant="outline" 
                         size="sm" 
                         className="h-8 px-2 border-slate-300"
                         onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                         disabled={currentPage >= totalPages}
                      >
                         Siguiente
                         <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
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