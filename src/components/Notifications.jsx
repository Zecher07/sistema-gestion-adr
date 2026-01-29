
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Archive, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Notifications = ({ user, orders, archivedIds = [], onArchive, onViewOrder }) => {
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

  // Filtrar notificaciones según rol
  const getNotifications = () => {
    if (!user || !orders) return [];

    return orders.filter(order => {
      // Admin: Finalizadas (para archivar)
      if (user.role === 'Administrador') {
        return order.status === 'FINALIZADA' && !archivedIds.includes(order.id);
      }
      
      // Vendedor: Paso 1 (Ventas) y Paso 3 (Por Retirar)
      if (user.role === 'Vendedor') {
        const isMyOrder = order.vendedor === user.name;
        const isRelevantStatus = order.status === 'VENTAS' || order.status === 'VENTAS POR RETIRAR';
        return isMyOrder && isRelevantStatus;
      }

      // Contabilidad: Paso 4 (Contabilidad)
      if (user.role === 'Contabilidad') {
        return order.status === 'CONTABILIDAD';
      }

      // Producción: Paso 2 (Producción)
      if (user.role === 'Producción') {
        return order.status === 'PRODUCCION';
      }

      return false;
    });
  };

  const notifications = getNotifications();
  const count = notifications.length;

  const handleOpenOrder = (order) => {
    onViewOrder(order);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Bell className="h-6 w-6 text-slate-600 dark:text-slate-300" />
        {count > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
            {count > 99 ? '99+' : count}
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
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-700">
                Usted tiene {count} Tareas
              </h3>
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {notifications.map(notification => (
                    <div key={notification.id} className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3 group">
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                             Procesar Orden #{notification.id.toString().slice(-8)}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                             {notification.cliente} • {notification.status}
                          </p>
                       </div>
                       <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleOpenOrder(notification)}
                            title="Ver detalles"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          
                          {user.role === 'Administrador' && (
                             <Button 
                               variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-green-600 hover:bg-green-50"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 onArchive(notification.id);
                               }}
                               title="Archivar notificación"
                             >
                               <Archive className="h-3.5 w-3.5" />
                             </Button>
                          )}
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                   <p>¡Todo al día! 🎉</p>
                   <p className="text-xs mt-1">No tienes tareas pendientes.</p>
                </div>
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
