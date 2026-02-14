import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ExternalLink, X, UserPlus, FileText, Info } from 'lucide-react'; // Nuevos iconos
import { Button } from '@/components/ui/button';

const Notifications = ({ 
  user, 
  orders, 
  archivedIds = [], 
  onArchive, 
  onViewOrder,
  realtimeEvents = [], // 🔥 NUEVO: Eventos que llegan al instante
  onClearEvent         // 🔥 NUEVO: Función para borrar la notificación
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. NOTIFICACIONES PASIVAS (Tareas Pendientes)
  // Esta lógica se mantiene igual: Calcula qué tienes pendiente de trabajar.
  const getWorkItems = () => {
    if (!user || !orders) return [];

    return orders.filter(order => {
      if (order.status === 'ANULADA' || order.status === 'ARCHIVADA') return false;

      // Admin: Finalizadas (para archivar)
      if (user.role === 'Administrador') return order.status === 'FINALIZADA';
      
      // Vendedor: Paso 1 y 3
      if (user.role === 'Vendedor') {
        const isMyOrder = order.vendedor === user.name;
        const isRelevantStatus = order.status === 'VENTAS' || order.status === 'VENTAS POR RETIRAR';
        return isMyOrder && isRelevantStatus;
      }

      // Contabilidad: Paso 4
      if (user.role === 'Contabilidad') return order.status === 'CONTABILIDAD';

      // Producción: Paso 2
      if (user.role === 'Producción') return order.status === 'PRODUCCION';

      return false;
    });
  };

  const workItems = getWorkItems();
  
  // 🔥 COMBINAR CONTADORES
  const totalCount = realtimeEvents.length + workItems.length;

  // Handler para abrir orden
  const handleOpenOrder = (orderId) => {
    // Buscamos la orden completa en el array si solo tenemos el ID
    const orderObj = typeof orderId === 'string' || typeof orderId === 'number' 
        ? orders.find(o => o.id === orderId) 
        : orderId;

    if (orderObj) {
        onViewOrder(orderObj);
        setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className={`h-6 w-6 ${realtimeEvents.length > 0 ? 'text-blue-600 animate-pulse' : 'text-slate-600'}`} />
        {totalCount > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white shadow-sm">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden"
          >
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-700">Notificaciones</h3>
              {totalCount > 0 && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{totalCount} nuevas</span>}
            </div>

            <div className="max-h-[350px] overflow-y-auto">
              
              {/* --- SECCIÓN 1: EVENTOS REALTIME (NUEVOS) --- */}
              {realtimeEvents.length > 0 && (
                  <div className="border-b border-blue-100">
                      {realtimeEvents.map(event => (
                          <div key={event.id} className="p-3 bg-blue-50/50 hover:bg-blue-100 transition-colors flex items-start gap-3 relative border-b border-blue-100 last:border-0">
                              <div className="mt-1">
                                  {event.type === 'assignment' ? <UserPlus className="h-4 w-4 text-blue-600"/> : <Info className="h-4 w-4 text-purple-600"/>}
                              </div>
                              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { handleOpenOrder(event.orderId); onClearEvent(event.id); }}>
                                  <p className="text-sm font-bold text-slate-800">{event.title}</p>
                                  <p className="text-xs text-slate-600 mt-0.5">{event.message}</p>
                                  <span className="text-[10px] text-blue-500 font-medium mt-1 block">Hace un momento</span>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); onClearEvent(event.id); }} className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1">
                                  <X className="h-3 w-3" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              {/* --- SECCIÓN 2: TAREAS DE TRABAJO (PENDIENTES) --- */}
              {workItems.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {workItems.map(item => (
                    <div key={item.id} className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3 group">
                        <div className="mt-1"><FileText className="h-4 w-4 text-slate-400" /></div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpenOrder(item)}>
                          <p className="text-sm font-medium text-slate-700 truncate">
                             Orden #{item.orderNumber?.toString().padStart(7, '0') || item.id}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                             {item.cliente} • <span className="font-semibold text-slate-600">{item.status}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleOpenOrder(item)}
                            title="Ver detalles"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Mensaje si no hay tareas, pero puede haber eventos realtime arriba */
                workItems.length === 0 && realtimeEvents.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        <p>¡Todo al día! 🎉</p>
                        <p className="text-xs mt-1">No tienes tareas pendientes.</p>
                    </div>
                )
              )}
            </div>

            <div className="bg-slate-50 p-2 text-center border-t border-slate-200">
              <button 
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Notifications;