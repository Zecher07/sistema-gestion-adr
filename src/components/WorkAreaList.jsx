import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Play, PackageSearch, PackageCheck, FileSignature, AlertOctagon, Wallet, DollarSign, Globe, Wrench, ShoppingCart, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isUserInList } from '@/utils/userMatch';

// Helper para obtener la fecha local exacta sin errores de zona horaria
const getLocalDate = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

// 🔥 Calculador Inteligente de Estados Contables Actualizado 🔥
const getOrderAccountingStatus = (o) => {
    const total = Number(o.financials?.total) || 0;
    const anticipo = Number(o.anticipo) || 0;
    const retencion = Number(o.retencion || o.financials?.retencion) || 0;
    const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
    const saldoFinalReal = total - anticipo - retencion - totalAbonado;

    const pSaldo = String(o.formaPagoSaldo || o.financials?.formaPagoSaldo || '').toLowerCase();
    const pAnticipo = String(o.formaPagoAnticipo || o.forma_pago_anticipo || '').toLowerCase();
    const isCredito = pSaldo.includes('crédit') || pSaldo.includes('credit') || 
                      pAnticipo.includes('crédit') || pAnticipo.includes('credit');

    const today = getLocalDate();
    const fechaVence = o.financials?.creditoVenceSaldo || o.creditoVenceSaldo || o.credito_vence_saldo || o.creditoVenceAnticipo || o.credito_vence_anticipo || o.financials?.creditoVenceAnticipo || '';
    
    const isVencido = isCredito && fechaVence && fechaVence < today;

    let retDocs = [];
    if (o.comprobantes && !Array.isArray(o.comprobantes) && o.comprobantes.retencion) {
        retDocs = o.comprobantes.retencion;
    }
    const isRetencionPendiente = retencion > 0 && retDocs.length === 0;

    let status = '';
    
    // 1. Prioridad: Si debe dinero y NO es un crédito vigente -> Impagas
    if (saldoFinalReal > 0.01 && (!isCredito || isVencido)) {
        status = 'impagas';
    } 
    // 2. Prioridad: Si no debe dinero, pero falta la foto de retención -> Retenciones
    else if (isRetencionPendiente) {
        status = 'retenciones';
    } 
    // 3. Prioridad: Si debe dinero, pero es un crédito a tiempo -> Créditos
    else if (saldoFinalReal > 0.01 && isCredito && !isVencido) {
        status = 'creditos';
    } 
    // 4. Si todo está cuadrado y con documentos -> Por Finalizar
    else {
        status = 'por_finalizar';
    }

    return { status, isRetencionPendiente, isVencido, saldoFinalReal, isCredito };
};

const WorkAreaList = ({ 
  orders, 
  user, 
  staffUsers, 
  onViewOrder,
  onAbonoOrder 
}) => {
  const [listFilter, setListFilter] = useState(
      user?.role === 'Contabilidad' ? 'por_finalizar' : 
      user?.role === 'Administrador' ? 'todas' : 'ventas'
  ); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, listFilter]);

  const rawFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.status === 'ANULADA' || order.status === 'ARCHIVADA' || order.status === 'FINALIZADA') return false;
      
      if (user.role === 'Producción') {
          return order.status === 'PRODUCCION'; 
      }
      
      if (user.role === 'Contabilidad') {
          if (order.status !== 'CONTABILIDAD') return false;
          const { status } = getOrderAccountingStatus(order);
          if (listFilter === 'creditos') return status === 'creditos';
          if (listFilter === 'impagas') return status === 'impagas';
          if (listFilter === 'retenciones') return status === 'retenciones';
          if (listFilter === 'por_finalizar') return status === 'por_finalizar'; 
          return false;
      }
      
      // 🔥 APLICADO FIX DE LECTURA DE RESPONSABLES PARA VENDEDORES 🔥
      // 🔧 FIX: antes comparaba por nombre de texto (se rompía si alguien cambiaba su
      // nombre). Ahora compara por id, con respaldo a nombre solo para filas viejas.
      // 🔧 NUEVO: se agregan los filtros de Créditos/Retenciones/Impagas/Por Cerrar,
      // que antes solo existían para Admin y Contabilidad — cada vendedor ve solo
      // SUS PROPIAS órdenes en cada uno de estos filtros.
      if (user.role === 'Vendedor') {
          if (!isUserInList(order.vendedor_ids, order.vendedor, user)) return false;
          if (listFilter === 'ventas') return order.status === 'VENTAS'; 
          if (listFilter === 'produccion') return order.status === 'PRODUCCION';
          if (listFilter === 'por_retirar') return order.status === 'VENTAS POR RETIRAR'; 
          if (['creditos', 'impagas', 'retenciones', 'por_finalizar'].includes(listFilter)) {
              if (order.status !== 'CONTABILIDAD') return false;
              const { status } = getOrderAccountingStatus(order);
              return status === listFilter;
          }
          return false;
      }

      if (user.role === 'Administrador') {
          if (listFilter === 'todas') return ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD'].includes(order.status);
          
          if (listFilter === 'ventas') return order.status === 'VENTAS';
          if (listFilter === 'produccion') return order.status === 'PRODUCCION';
          if (listFilter === 'por_retirar') return order.status === 'VENTAS POR RETIRAR';

          if (['creditos', 'impagas', 'retenciones', 'por_finalizar'].includes(listFilter)) {
              if (order.status !== 'CONTABILIDAD') return false;
              const { status } = getOrderAccountingStatus(order);
              return status === listFilter;
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

  const totalItems = searchFilteredOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedOrders = searchFilteredOrders.slice(startIndex, endIndex);

  // 🔧 FIX: antes esta función siempre asumía que la fecha traía hora, y hacía
  // "new Date(dateString)" directo. Para órdenes viejas donde fecha_entrega se guardó
  // sin hora (solo "2026-08-05", sin la "T"), JavaScript la interpreta como medianoche
  // UTC — y en Ecuador (UTC-5) eso se corre al día anterior con una hora falsa (~19:00).
  // Ahora se detecta ese caso y se evita, sin inventar una hora que nunca se puso.
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const str = String(dateString);
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str);
    const d = new Date(isDateOnly ? `${str}T12:00:00` : str);
    if (isNaN(d.getTime())) return '-';
    const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (isDateOnly) return fecha; // no había hora real que mostrar
    const horas = d.getHours();
    const minutos = d.getMinutes();
    // 🔧 AJUSTE: 00:00 tras migrar la columna a timestamp = "sin hora real registrada"
    if (horas === 0 && minutos === 0) return `${fecha} 08:00`;
    return `${fecha} ${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
  };

  const formatOrderId = (order) => {
    if (order.order_number) return order.order_number.toString().padStart(7, '0');
    if (order.orderNumber) return order.orderNumber.toString().padStart(7, '0');
    return (order.id || '').toString().slice(-7).padStart(7, '0');
  };

  const calculateProductStats = (order) => {
    const products = order.productos || order.products || [];
    const total = products.length;
    const completed = products.filter(p => p.estado_prod === 'FINALIZADO').length;
    const inProcess = products.filter(p => p.estado_prod === 'EN_PROCESO').length;
    const startedCount = completed + inProcess; 
    return { total, completed, inProcess, startedCount };
  };

  // 🔥 APLICADO FIX EN CONTEOS GENERALES DE VENDEDOR 🔥
  const getOrderCounts = () => {
      let counts = { todas: 0, ventas: 0, produccion: 0, por_retirar: 0, por_finalizar: 0, creditos: 0, impagas: 0, retenciones: 0 };
      
      orders.forEach(o => {
          if (o.status === 'ANULADA' || o.status === 'ARCHIVADA' || o.status === 'FINALIZADA') return;
          
          if (user.role === 'Administrador') {
              if (['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD'].includes(o.status)) counts.todas++;
              if (o.status === 'VENTAS') counts.ventas++;
              if (o.status === 'PRODUCCION') counts.produccion++;
              if (o.status === 'VENTAS POR RETIRAR') counts.por_retirar++;
              if (o.status === 'CONTABILIDAD') {
                  const { status } = getOrderAccountingStatus(o);
                  if (status === 'creditos') counts.creditos++;
                  else if (status === 'impagas') counts.impagas++;
                  else if (status === 'retenciones') counts.retenciones++;
                  else counts.por_finalizar++;
              }
          }
          
          if (user.role === 'Vendedor' && isUserInList(o.vendedor_ids, o.vendedor, user)) {
              if (o.status === 'VENTAS') counts.ventas++;
              if (o.status === 'PRODUCCION') counts.produccion++;
              if (o.status === 'VENTAS POR RETIRAR') counts.por_retirar++;
              if (o.status === 'CONTABILIDAD') {
                  const { status } = getOrderAccountingStatus(o);
                  if (status === 'creditos') counts.creditos++;
                  else if (status === 'impagas') counts.impagas++;
                  else if (status === 'retenciones') counts.retenciones++;
                  else counts.por_finalizar++;
              }
          }
          
          if (user.role === 'Contabilidad' && o.status === 'CONTABILIDAD') {
              const { status } = getOrderAccountingStatus(o);
              if (status === 'creditos') counts.creditos++;
              else if (status === 'impagas') counts.impagas++;
              else if (status === 'retenciones') counts.retenciones++;
              else counts.por_finalizar++;
          }
      });
      return counts;
  };
  const counts = getOrderCounts();

  return (
    <div className="space-y-4">
       <div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-300 min-h-[600px] flex flex-col">
               
               {user.role === 'Administrador' && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Search className="h-4 w-4 text-slate-500"/>
                        <span className="text-sm font-bold text-slate-700">Filtros de Área (Vista Global)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setListFilter('todas')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'todas' ? "bg-slate-800 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <Globe className="h-4 w-4" /> TODAS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.todas}</span>
                        </button>
                        
                        <div className="w-px bg-slate-300 mx-1"></div>
                        
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

                        <button onClick={() => setListFilter('por_finalizar')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'por_finalizar' ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <FileSignature className="h-4 w-4" /> POR CERRAR <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.por_finalizar}</span>
                        </button>
                        <button onClick={() => setListFilter('creditos')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'creditos' ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <Wallet className="h-4 w-4" /> CRÉDITOS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.creditos}</span>
                        </button>
                        <button onClick={() => setListFilter('retenciones')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'retenciones' ? "bg-orange-500 text-white border-orange-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <FileText className="h-4 w-4" /> RETENCIONES <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.retenciones}</span>
                        </button>
                        <button onClick={() => setListFilter('impagas')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'impagas' ? "bg-red-600 text-white border-red-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <AlertOctagon className="h-4 w-4" /> IMPAGAS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.impagas}</span>
                        </button>
                    </div>
                 </div>
               )}

               {user.role === 'Vendedor' && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setListFilter('ventas')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'ventas' ? "bg-blue-600 text-white border-blue-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <ShoppingCart className="h-4 w-4" /> EN VENTAS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.ventas}</span>
                        </button>
                        <button onClick={() => setListFilter('produccion')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'produccion' ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <Wrench className="h-4 w-4" /> EN PRODUCCIÓN <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.produccion}</span>
                        </button>
                        <button onClick={() => setListFilter('por_retirar')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'por_retirar' ? "bg-green-600 text-white border-green-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <PackageCheck className="h-4 w-4" /> POR RETIRAR <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.por_retirar}</span>
                        </button>

                        <div className="w-px bg-slate-300 mx-1"></div>

                        {/* 🔧 NUEVO: los vendedores ahora también tienen acceso a estos filtros,
                            igual que Admin/Contabilidad — pero siempre viendo SOLO sus propias órdenes */}
                        <button onClick={() => setListFilter('por_finalizar')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'por_finalizar' ? "bg-indigo-600 text-white border-indigo-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <FileSignature className="h-4 w-4" /> POR CERRAR <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.por_finalizar}</span>
                        </button>
                        <button onClick={() => setListFilter('creditos')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'creditos' ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <Wallet className="h-4 w-4" /> CRÉDITOS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.creditos}</span>
                        </button>
                        <button onClick={() => setListFilter('retenciones')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'retenciones' ? "bg-orange-500 text-white border-orange-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <FileText className="h-4 w-4" /> RETENCIONES <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.retenciones}</span>
                        </button>
                        <button onClick={() => setListFilter('impagas')} className={cn("px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-1 shadow-sm border", listFilter === 'impagas' ? "bg-red-600 text-white border-red-700" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                            <AlertOctagon className="h-4 w-4" /> IMPAGAS <span className="ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px]">{counts.impagas}</span>
                        </button>
                    </div>
                 </div>
               )}

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
                    <button onClick={() => setListFilter('retenciones')} className={cn("px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border", listFilter === 'retenciones' ? "bg-orange-500 text-white border-orange-600 shadow-orange-200" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                        <FileText className="h-5 w-5" /> RETENCIONES
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'retenciones' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>{counts.retenciones}</span>
                    </button>
                    <button onClick={() => setListFilter('impagas')} className={cn("px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-sm border", listFilter === 'impagas' ? "bg-red-600 text-white border-red-700 shadow-red-200" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100")}>
                        <AlertOctagon className="h-5 w-5" /> IMPAGAS
                        <span className={cn("px-2 py-0.5 rounded-full text-xs ml-1", listFilter === 'impagas' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600")}>{counts.impagas}</span>
                    </button>
                 </div>
               )}

               {user.role === 'Producción' && (
                 <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-700">Tus Tareas Asignadas - Departamento de Producción</h3>
                 </div>
               )}

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
                        {(user.role === 'Contabilidad' || user.role === 'Administrador') && <th className="px-6 py-3 whitespace-nowrap text-center">Acciones</th>}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {paginatedOrders.length > 0 ? (
                        paginatedOrders.map(order => {
                          const stats = calculateProductStats(order);
                          const isFullyCompleted = stats.total > 0 && stats.completed === stats.total;
                          const hasProgress = stats.startedCount > 0;
                          
                          const accData = getOrderAccountingStatus(order);
                          
                          const showCobrarButton = order.status === 'CONTABILIDAD' && onAbonoOrder && (accData.saldoFinalReal > 0.01 || accData.isCredito || accData.isRetencionPendiente);

                          return (
                            <tr key={order.id} className="hover:bg-blue-50/50 transition-colors group cursor-pointer bg-white" onClick={() => onViewOrder(order)}>
                               <td className="px-6 py-3">
                                  <span className="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100 group-hover:underline shadow-sm">#{formatOrderId(order)}</span>
                               </td>
                               <td className="px-6 py-3 text-xs font-bold">
                                   <div className="flex flex-col gap-1 items-start">
                                       <span className={cn("px-2 py-1 rounded shadow-sm border", order.status === 'VENTAS' ? 'bg-blue-50 text-blue-700 border-blue-200' : order.status === 'PRODUCCION' ? 'bg-amber-50 text-amber-700 border-amber-200' : order.status === 'VENTAS POR RETIRAR' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 border-slate-200')}>
                                           {order.status}
                                       </span>
                                       {order.status === 'CONTABILIDAD' && accData.isVencido && (
                                           <span className="text-[9px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded shadow-sm">Crédito Vencido</span>
                                       )}
                                       {order.status === 'CONTABILIDAD' && accData.isRetencionPendiente && (
                                           <span className="text-[9px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded shadow-sm">Falta Retención</span>
                                       )}
                                   </div>
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
                                      {showCobrarButton ? (
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
               
               <div className="px-6 py-3 border-t border-slate-200 bg-white text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>Mostrando del <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> al <span className="font-semibold">{endIndex}</span> de un total de <span className="font-semibold text-slate-900">{totalItems}</span> registros</div>
                  <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 px-2 border-slate-300" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</Button>
                      <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded shadow-sm text-blue-700 font-bold min-w-[32px] text-center mx-2">{currentPage} <span className="text-slate-400 font-normal mx-1">/</span> {totalPages || 1}</div>
                      <Button variant="outline" size="sm" className="h-8 px-2 border-slate-300" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages}>Siguiente <ChevronRight className="h-4 w-4 ml-1" /></Button>
                  </div>
               </div>
            </div>
       </div>
    </div>
  );
};

export default WorkAreaList;