import React, { useState, useEffect, useMemo } from 'react';
import { User, FileText, Phone, ShoppingCart, DollarSign, Wallet, ShieldAlert, History, X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

// 🔧 NUEVO: extraído de ClientsPanel.jsx para poder mostrarse como popup desde
// cualquier pantalla (ej. desde el detalle de una orden) sin tener que navegar
// a la pestaña de Clientes y perder el contexto de lo que se estaba viendo.
const ClientExpedienteModal = ({ cliente, orders = [], onClose, onEditClient, onViewOrder, canViewOrderDetails = true }) => {
  const [ordenesCliente, setOrdenesCliente] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      if (!cliente) return;
      setLoading(true);
      const t = setTimeout(() => {
          const ordenadas = orders.filter(o => {
              const matchIdentificacion = cliente.empresa && (o.ruc === cliente.empresa || o.cedula === cliente.empresa || o.cliente_identificacion === cliente.empresa);
              const matchNombre = (o.cliente || o.cliente_nombre)?.toLowerCase() === cliente.nombre?.toLowerCase();
              return matchIdentificacion || matchNombre;
          }).sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
          setOrdenesCliente(ordenadas);
          setLoading(false);
      }, 200);
      return () => clearTimeout(t);
  }, [cliente, orders]);

  const clientStats = useMemo(() => {
      if (!cliente) return null;
      let totalComprado = 0, deudaActual = 0, ordenesActivas = 0;

      ordenesCliente.forEach(o => {
          if (o.status !== 'ANULADA') {
              const totalOrden = Number(o.financials?.total) || 0;
              totalComprado += totalOrden;
              const anticipo = Number(o.anticipo) || 0;
              const retencion = Number(o.retencion) || 0;
              const totalAbonos = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
              const saldoPendiente = totalOrden - anticipo - retencion - totalAbonos;
              if (saldoPendiente > 0) deudaActual += saldoPendiente;
              if (o.status !== 'FINALIZADA' && o.status !== 'ARCHIVADA') ordenesActivas++;
          }
      });

      const limite = Number(cliente.limiteCredito) || 0;
      const porcentajeDeuda = limite > 0 ? Math.min((deudaActual / limite) * 100, 100) : 0;
      const sobregirado = deudaActual > limite && limite > 0;

      return { totalComprado, deudaActual, ordenesActivas, limite, porcentajeDeuda, sobregirado };
  }, [cliente, ordenesCliente]);

  if (!cliente) return null;

  return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4 sm:p-6 animate-in fade-in duration-200 no-print">
         <div className="w-full max-w-5xl bg-slate-50 h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/20">

            <div className="bg-slate-800 p-6 flex justify-between items-start shrink-0">
               <div className="flex gap-4 items-center text-white">
                   <div className="h-14 w-14 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                       <User className="h-7 w-7 text-blue-300" />
                   </div>
                   <div>
                       <h2 className="text-2xl font-black tracking-wide">{cliente.nombre}</h2>
                       <div className="flex items-center gap-4 text-sm text-slate-300 mt-1 font-medium">
                           <span className="flex items-center gap-1 font-mono"><FileText className="h-4 w-4"/> RUC: {cliente.empresa || '-'}</span>
                           <span className="flex items-center gap-1"><Phone className="h-4 w-4"/> {cliente.telefono || '-'}</span>
                       </div>
                   </div>
               </div>
               <div className="flex items-center gap-2">
                   {onEditClient && (
                       <Button variant="outline" size="sm" onClick={() => onEditClient(cliente)} className="bg-slate-700/50 border-slate-600 text-white hover:bg-blue-600 hover:border-blue-500 transition-colors">
                           <Edit2 className="h-4 w-4 mr-2" /> Editar Datos
                       </Button>
                   )}
                   <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-full">
                       <X className="h-6 w-6" />
                   </Button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {loading ? (
                   <div className="text-center py-20 text-slate-500 font-bold animate-pulse">Cargando datos financieros...</div>
               ) : (
                   <>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                             <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><ShoppingCart className="h-6 w-6"/></div>
                             <div>
                                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historial de Compras</p>
                                 <div className="flex items-end gap-2">
                                     <p className="text-2xl font-black text-slate-800">{ordenesCliente.length}</p>
                                     <p className="text-sm text-blue-600 font-bold mb-1">({clientStats?.ordenesActivas} activas)</p>
                                 </div>
                             </div>
                         </div>
                         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                             <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><DollarSign className="h-6 w-6"/></div>
                             <div>
                                 <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volumen Comprado</p>
                                 <p className="text-2xl font-black text-slate-800">{formatCurrency(clientStats?.totalComprado)}</p>
                             </div>
                         </div>
                         <div className={cn("p-5 rounded-xl border shadow-sm flex items-center gap-4", clientStats?.deudaActual > 0 ? "bg-rose-50 border-red-200" : "bg-white border-slate-200")}>
                             <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", clientStats?.deudaActual > 0 ? "bg-red-200 text-red-700" : "bg-slate-100 text-slate-600")}><Wallet className="h-6 w-6"/></div>
                             <div>
                                 <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Saldo Pendiente (Deuda)</p>
                                 <p className={cn("text-2xl font-black", clientStats?.deudaActual > 0 ? "text-red-700" : "text-slate-800")}>{formatCurrency(clientStats?.deudaActual)}</p>
                             </div>
                         </div>
                     </div>

                     {cliente.permiteCredito ? (
                         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                             <div className="flex justify-between items-end mb-2">
                                 <div>
                                     <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-indigo-600"/> Uso de Línea de Crédito</h3>
                                     <p className="text-sm text-slate-500">Límite Aprobado: <span className="font-bold text-slate-800">{formatCurrency(clientStats?.limite)}</span></p>
                                 </div>
                                 <div className="text-right">
                                     <span className={cn("text-xl font-black", clientStats?.sobregirado ? "text-red-600" : "text-indigo-600")}>
                                         {formatCurrency(Math.max((clientStats?.limite || 0) - (clientStats?.deudaActual || 0), 0))}
                                     </span>
                                     <p className="text-xs font-bold text-slate-500 uppercase">Disponible</p>
                                 </div>
                             </div>
                             <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative mt-4">
                                 <div className={cn("h-full transition-all duration-1000", clientStats?.sobregirado ? "bg-red-500" : "bg-indigo-500")} style={{ width: `${clientStats?.porcentajeDeuda}%` }}></div>
                             </div>
                             {clientStats?.sobregirado && <p className="text-xs font-bold text-red-600 mt-2 text-center animate-pulse">⚠️ ALERTA: EL CLIENTE HA EXCEDIDO SU LÍMITE DE CRÉDITO PERMITIDO.</p>}
                         </div>
                     ) : (
                         <div className="bg-slate-200/50 border border-slate-300 border-dashed p-4 rounded-xl text-center">
                             <ShieldAlert className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                             <p className="font-bold text-slate-600">Cliente sin Crédito Autorizado</p>
                         </div>
                     )}

                     <div>
                         <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History className="h-5 w-5 text-slate-500"/> Registro de Órdenes</h3>
                         <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-y-auto max-h-[600px]">
                             <table className="w-full text-sm text-left relative">
                                 <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-600 sticky top-0 z-10 shadow-sm">
                                     <tr>
                                         <th className="px-4 py-3 text-center">Nº Orden</th>
                                         <th className="px-4 py-3">Fecha</th>
                                         <th className="px-4 py-3">Trabajo</th>
                                         <th className="px-4 py-3 text-center">Estado</th>
                                         <th className="px-4 py-3 text-right">Total</th>
                                         <th className="px-4 py-3 text-right">Deuda</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                     {ordenesCliente.length > 0 ? (
                                         ordenesCliente.map(orden => {
                                             const total = Number(orden.financials?.total) || 0;
                                             const anticipo = Number(orden.anticipo) || 0;
                                             const retencion = Number(orden.retencion) || 0;
                                             const abonos = (orden.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
                                             const deuda = Math.max(total - anticipo - retencion - abonos, 0);

                                             return (
                                                 <tr
                                                     key={orden.id}
                                                     className={cn("transition-colors", canViewOrderDetails && onViewOrder ? "hover:bg-blue-50 cursor-pointer" : "hover:bg-slate-50")}
                                                     onClick={() => { if (canViewOrderDetails && onViewOrder) onViewOrder(orden); }}
                                                 >
                                                     <td className="px-4 py-3 text-center font-mono font-bold text-blue-600">#{String(orden.orderNumber || orden.order_number || orden.id).slice(-7).padStart(7, '0')}</td>
                                                     <td className="px-4 py-3 text-slate-600">{new Date(orden.created_at || orden.createdAt).toLocaleDateString('es-ES')}</td>
                                                     <td className="px-4 py-3 text-slate-800 text-xs uppercase font-medium">{orden.tipoLetrero || orden.tipo_trabajo || '-'}</td>
                                                     <td className="px-4 py-3 text-center"><span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-700 rounded border">{orden.status}</span></td>
                                                     <td className="px-4 py-3 text-right font-bold text-slate-700">{formatCurrency(total)}</td>
                                                     <td className="px-4 py-3 text-right font-bold text-red-600">{deuda > 0 ? formatCurrency(deuda) : '-'}</td>
                                                 </tr>
                                             )
                                         })
                                     ) : (
                                         <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500 italic">No hay historial de compras.</td></tr>
                                     )}
                                 </tbody>
                             </table>
                         </div>
                     </div>
                   </>
               )}
            </div>
         </div>
      </div>
  );
};

export default ClientExpedienteModal;
