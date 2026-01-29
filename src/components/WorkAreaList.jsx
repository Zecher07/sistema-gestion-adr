
import React, { useState } from 'react';
import { Search, Eye, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';

const WorkAreaList = ({ orders = [], user, onViewOrder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Lógica de filtrado idéntica a Notificaciones
  const getRelevantOrders = () => {
    if (!user || !orders) return [];

    return orders.filter(order => {
      // Admin: Finalizadas (para archivar) - o todas las activas?
      // El prompt dice "mostrando órdenes según notificaciones del rol"
      if (user.role === 'Administrador') {
        return order.status === 'FINALIZADA'; 
      }
      
      // Vendedor: Paso 1 (Ventas) y Paso 3 (Por Retirar) + deben ser SUYAS
      if (user.role === 'Vendedor') {
        const isMyOrder = order.vendedor === user.name;
        const isRelevantStatus = order.status === 'VENTAS' || order.status === 'VENTAS POR RETIRAR';
        return isMyOrder && isRelevantStatus;
      }

      // Contabilidad: Paso 4
      if (user.role === 'Contabilidad') {
        return order.status === 'CONTABILIDAD';
      }

      // Producción: Paso 2
      if (user.role === 'Producción') {
        return order.status === 'PRODUCCION';
      }

      return false;
    });
  };

  const filteredOrders = getRelevantOrders().filter(order => 
    order.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.tipoLetrero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toString().includes(searchTerm)
  );

  const formatOrderId = (id) => id.toString().slice(-8).padStart(8, '0');
  
  const formatDateTime = (dateString) => {
    if (!dateString) return '0000-00-00 00:00:00';
    try {
        const d = new Date(dateString);
        return d.toLocaleString('es-ES', { 
           year: 'numeric', month: '2-digit', day: '2-digit',
           hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } catch { return '0000-00-00 00:00:00'; }
  };

  return (
    <div className="space-y-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">Tareas Pendientes</h2>
            <div className="flex flex-col md:flex-row justify-between gap-4">
                 <div className="flex items-center gap-2 text-sm text-slate-600">
                     <span>Mostrar</span>
                     <select 
                       className="border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                       value={itemsPerPage}
                       onChange={(e) => setItemsPerPage(Number(e.target.value))}
                     >
                       <option value={10}>10</option>
                       <option value={25}>25</option>
                       <option value={50}>50</option>
                     </select>
                     <span>registros</span>
                 </div>
                 <div className="relative max-w-md w-full">
                   <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                   <input 
                     type="text" 
                     placeholder="Buscar..." 
                     className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                   />
                   <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">
                      Buscar:
                   </span>
                 </div>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-100 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 font-bold cursor-pointer hover:bg-slate-200">Orden</th>
                            <th className="px-6 py-3 font-bold cursor-pointer hover:bg-slate-200">Fecha ENTREGA</th>
                            <th className="px-6 py-3 font-bold cursor-pointer hover:bg-slate-200">Cliente</th>
                            <th className="px-6 py-3 font-bold cursor-pointer hover:bg-slate-200">Titulo</th>
                            <th className="px-6 py-3 font-bold text-center">Detalles</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredOrders.length > 0 ? (
                             filteredOrders.slice(0, itemsPerPage).map(order => (
                                 <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                                     <td className="px-6 py-4 font-mono text-blue-600 font-medium">
                                         {formatOrderId(order.id)}
                                     </td>
                                     <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                                         {formatDateTime(order.fechaEntrega)}
                                     </td>
                                     <td className="px-6 py-4 font-medium text-slate-800 uppercase">
                                         {order.cliente}
                                     </td>
                                     <td className="px-6 py-4 text-slate-600 uppercase">
                                         {order.tipoLetrero}
                                     </td>
                                     <td className="px-6 py-4 text-center">
                                         <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 w-8 p-0"
                                            onClick={() => onViewOrder(order)}
                                         >
                                             <Eye className="h-4 w-4 text-slate-500 hover:text-blue-600" />
                                         </Button>
                                     </td>
                                 </tr>
                             ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                    No hay tareas pendientes para tu rol.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500">
                 Mostrando {Math.min(itemsPerPage, filteredOrders.length)} de {filteredOrders.length} registros
            </div>
        </div>
    </div>
  );
};

export default WorkAreaList;
