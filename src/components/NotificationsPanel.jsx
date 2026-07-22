import React, { useState, useEffect } from 'react';
import { Bell, UserPlus, Info, Receipt, FileText, ExternalLink, X, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../supabaseClient';

const NotificationsPanel = ({ 
  user, 
  orders = [], 
  realtimeEvents = [], 
  onClearEvent,        
  onViewOrder,
  onViewChange       
}) => {
  const [pendingVales, setPendingVales] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'Administrador';

  // Buscar Vales Pendientes (Solo Admin)
  useEffect(() => {
    const fetchPendingVales = async () => {
      if (!isAdmin) {
          setLoading(false);
          return;
      }
      try {
        const { data, error } = await supabase
          .from('vales_caja')
          .select('*')
          .eq('status', 'PENDIENTE')
          .order('fecha', { ascending: false });
        
        if (!error && data) {
            setPendingVales(data);
        }
      } catch (error) {
        console.error("Error cargando vales", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingVales();
  }, [isAdmin]);

  // Filtrar Órdenes Pendientes según Rol (Igual que la campanita)
  const getWorkItems = () => {
    if (!user || !orders) return [];

    return orders.filter(order => {
      if (order.status === 'ANULADA' || order.status === 'ARCHIVADA') return false;

      if (user.role === 'Administrador') return order.status === 'FINALIZADA';
      
      if (user.role === 'Vendedor') {
        const isMyOrder = order.vendedor === user.name;
        const isRelevantStatus = order.status === 'VENTAS' || order.status === 'VENTAS POR RETIRAR';
        return isMyOrder && isRelevantStatus;
      }

      if (user.role === 'Contabilidad') return order.status === 'CONTABILIDAD';
      if (user.role === 'Producción') return order.status === 'PRODUCCION';

      return false;
    });
  };

  const workItems = getWorkItems();
  const totalCount = realtimeEvents.length + workItems.length + pendingVales.length;

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
    } catch (e) { return '-'; }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Bell className="h-6 w-6 text-blue-600" /> Centro de Notificaciones y Tareas
                </h2>
                <p className="text-slate-500">
                    Tienes <strong className="text-blue-600">{totalCount}</strong> asuntos pendientes que requieren tu atención.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* COLUMNA IZQUIERDA: ALERTAS Y VALES */}
            <div className="xl:col-span-1 space-y-6">
                
                {/* EVENTOS EN TIEMPO REAL */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Info className="h-4 w-4 text-blue-500"/> Alertas Recientes
                        </h3>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">{realtimeEvents.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                        {realtimeEvents.length > 0 ? realtimeEvents.map(event => (
                            <div key={event.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3 relative group">
                                <div className="mt-0.5">
                                    {event.type === 'assignment' ? <UserPlus className="h-5 w-5 text-blue-600"/> : <Info className="h-5 w-5 text-purple-600"/>}
                                </div>
                                <div className="flex-1 min-w-0 pr-6">
                                    <p className="text-sm font-bold text-slate-800">{event.title}</p>
                                    <p className="text-xs text-slate-600 mt-1">{event.message}</p>
                                </div>
                                <button onClick={() => onClearEvent(event.id)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-slate-400 text-sm italic">No hay alertas nuevas.</div>
                        )}
                    </div>
                </div>

                {/* VALES PENDIENTES (SOLO ADMIN) */}
                {isAdmin && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                            <h3 className="font-bold text-red-800 flex items-center gap-2">
                                <Receipt className="h-4 w-4"/> Vales por Aprobar
                            </h3>
                            <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{pendingVales.length}</span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div>
                            ) : pendingVales.length > 0 ? pendingVales.map(vale => (
                                <div key={vale.id} className="p-4 hover:bg-red-50/30 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">Caja: {vale.vendedor}</p>
                                            <p className="text-xs text-slate-500">{formatDate(vale.created_at)}</p>
                                        </div>
                                        <span className="text-base font-black text-red-600">-{formatCurrency(vale.monto)}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 mb-3"><span className="font-semibold">Concepto:</span> {vale.concepto}</p>
                                    <Button size="sm" variant="outline" className="w-full text-xs border-red-200 text-red-700 hover:bg-red-50" onClick={() => onViewChange('vales')}>
                                        Ir a gestionar vales <ArrowRight className="h-3 w-3 ml-1" />
                                    </Button>
                                </div>
                            )) : (
                                <div className="p-8 text-center text-slate-400 text-sm italic">Todos los vales están revisados.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* COLUMNA DERECHA: ÓRDENES DE TRABAJO PENDIENTES */}
            <div className="xl:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-indigo-500"/> Bandeja de Trabajo ({user?.role})
                        </h3>
                        <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">{workItems.length} Tareas</span>
                    </div>
                    
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Orden</th>
                                    <th className="px-4 py-3">Cliente</th>
                                    <th className="px-4 py-3">Detalle / Proyecto</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                    <th className="px-4 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {workItems.length > 0 ? workItems.map(order => (
                                    <tr key={order.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-4 py-3 font-mono font-bold text-slate-500 whitespace-nowrap">
                                            #{String(order.orderNumber || order.order_number || order.id).padStart(7, '0')}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-800 max-w-[200px] truncate" title={order.cliente || order.cliente_nombre}>
                                            {order.cliente || order.cliente_nombre}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 max-w-[250px] truncate" title={order.tipoLetrero || order.tipo_trabajo}>
                                            {order.tipoLetrero || order.tipo_trabajo}
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className="text-[10px] font-bold px-2 py-1 rounded border bg-slate-100 text-slate-700 border-slate-300">
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Button size="sm" onClick={() => onViewOrder(order)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8">
                                                <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                                            </Button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-16 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle2 className="h-10 w-10 text-green-400" />
                                                <span className="text-lg font-medium text-slate-600">¡Bandeja Limpia!</span>
                                                <span className="text-sm">No tienes órdenes pendientes en tu departamento.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default NotificationsPanel;