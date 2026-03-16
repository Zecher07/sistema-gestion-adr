import React, { useState, useEffect, useMemo } from 'react';
import { 
  Eye, Edit, Trash2,
  ArrowLeft, ArrowRight,
  Search,
  Printer, Plus,
  ChevronLeft, ChevronRight, RotateCcw,
  FileSpreadsheet, Calendar as CalendarIcon,
  Archive, RotateCw, Coins, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '../supabaseClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FILTER_STATUSES = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA', 'ANULADA', 'ARCHIVADA'];

const OrdersPanel = ({ 
  orders = [], 
  user, 
  onUpdateStatus, 
  onDeleteOrder, 
  onUpdateOrder, 
  onEditOrder, 
  onCreateOrder,
  onViewOrder,
  currentView,
  onAbonoOrder 
}) => {
  const { toast } = useToast();

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return '-'; }
  };
  
  const formatTime = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '-'; }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const formatOrderId = (order) => {
      const num = order.orderNumber || order.order_number || order.id || '';
      return String(num).padStart(7, '0');
  };

  const getOrderTypeLabel = (order) => {
    const tipo1 = order.tipoOrden;
    const tipo2 = order.tipo_trabajo;
    const tipo3 = order.tipoLetrero;
    const tipoDefinitivo = String(tipo1 || tipo2 || tipo3 || '').toUpperCase();
    
    if (tipoDefinitivo.includes('(VC)') || tipoDefinitivo === 'VC' || tipoDefinitivo === 'VENTA CORTA') {
        return 'VC';
    }
    return 'VPVC';
  };

  const isAdmin = user.role === 'Administrador';

  const actionConfig = useMemo(() => {
    return {
      showView: true,
      showEdit: true,
      showArchive: true,
      showUnarchive: true
    };
  }, []);

  const roleFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (user.role === 'Administrador' || user.role === 'Vendedor' || user.role === 'Contabilidad') return true;
      if (user.role === 'Producción') {
        return order.status === 'PRODUCCION';
      }
      return false;
    });
  }, [orders, user.role]);

  const filteredOrders = useMemo(() => {
    return roleFilteredOrders.filter(order => {
      const searchLower = searchTerm.toLowerCase();
      
      const idStr = String(order.orderNumber || order.order_number || order.id || '');
      const clienteStr = String(order.cliente || order.cliente_nombre || '');
      const rucStr = String(order.ruc || order.cedula || ''); 
      const tituloStr = String(order.tipoLetrero || order.tipo_trabajo || '');
      const vendedorStr = String(order.vendedor || '');

      const matchesSearch = 
        idStr.toLowerCase().includes(searchLower) ||
        clienteStr.toLowerCase().includes(searchLower) ||
        rucStr.toLowerCase().includes(searchLower) ||
        tituloStr.toLowerCase().includes(searchLower) ||
        vendedorStr.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
      if (statusFilter !== 'TODOS' && order.status !== statusFilter) return false;
      
      if (startDate) {
        const orderDate = new Date(order.createdAt || order.created_at);
        const start = new Date(startDate + 'T00:00:00'); 
        if (orderDate < start) return false;
      }
      if (endDate) {
        const orderDate = new Date(order.createdAt || order.created_at);
        const end = new Date(endDate + 'T23:59:59.999'); 
        if (orderDate > end) return false;
      }

      return true;
    });
  }, [roleFilteredOrders, searchTerm, statusFilter, startDate, endDate]);

  const dynamicTotals = useMemo(() => {
    return filteredOrders.reduce((acc, order) => {
      const financials = order.financials || {};
      
      const anticipoInicial = parseFloat(order.anticipo) || 0;
      const abonosPosteriores = (order.abonos || []).reduce((sum, a) => sum + Number(a.monto), 0);
      const abonoTotal = anticipoInicial + abonosPosteriores;
      
      const totalVal = parseFloat(financials.total) || 0;
      const saldoVal = Math.max(0, totalVal - abonoTotal); 

      return {
        abono: acc.abono + abonoTotal,
        saldo: acc.saldo + saldoVal,
        total: acc.total + totalVal
      };
    }, { abono: 0, saldo: 0, total: 0 });
  }, [filteredOrders]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, startDate, endDate, itemsPerPage]);

  const handleStatusChange = (order, direction, e) => {
    e.stopPropagation();

    if (order.status === 'ANULADA' || order.status === 'ARCHIVADA') return;

    const WORKFLOW_VPVC = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];
    const WORKFLOW_VC = ['VENTAS', 'CONTABILIDAD', 'FINALIZADA'];
    
    const tipo = String(order.tipoOrden || order.tipo_trabajo || order.tipoLetrero || '').toUpperCase();
    const isVentaCorta = tipo.includes('(VC)') || tipo === 'VC' || tipo === 'VENTA CORTA';

    const workflow = isVentaCorta ? WORKFLOW_VC : WORKFLOW_VPVC;
    const currentIndex = workflow.indexOf(order.status);
    
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'next' && currentIndex < workflow.length - 1) newIndex = currentIndex + 1;
    else if (direction === 'prev' && currentIndex > 0) newIndex = currentIndex - 1;
    else return;
    
    onUpdateStatus(order.id, workflow[newIndex]);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setStartDate('');
    setEndDate('');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Fecha', 'Tipo', 'Cliente', 'RUC/Cedula', 'Titulo', 'Estado', 'Proforma Origen', 'Vendedor', 'Total', 'Abono', 'Saldo'];
    const rows = filteredOrders.map(o => {
        const fin = o.financials || {};
        const origen = o.origenProformaInfo || o.origenProformaId || '-';
        return [
          formatOrderId(o),
          formatDate(o.createdAt || o.created_at),
          getOrderTypeLabel(o), 
          `"${o.cliente || o.cliente_nombre || ''}"`,
          `"${o.ruc || o.cedula || ''}"`,
          `"${o.tipoLetrero || o.tipo_trabajo || ''}"`,
          o.status,
          origen,
          o.vendedor || '-',
          (fin.total || 0).toFixed(2),
          (o.anticipo || 0).toFixed(2),
          (fin.saldo || 0).toFixed(2)
        ];
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      ["sep=,", headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ordenes_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getOrderToDelete = () => {
    if (!deleteConfirm) return null;
    return orders.find(o => o.id === deleteConfirm);
  };

  const deleteOrderData = getOrderToDelete();
  const isPermanentDelete = deleteOrderData?.status === 'ANULADA';

  const handleConfirmDelete = async () => {
    if (isPermanentDelete) {
        onDeleteOrder(deleteConfirm);
        setDeleteConfirm(null);
    } else {
        if (!cancelReason.trim()) {
            toast({ title: "Atención", description: "Debe ingresar el motivo de la anulación.", variant: "destructive" });
            return;
        }
        setIsCancelling(true);
        try {
            const { error } = await supabase.from('ordenes').update({
                status: 'ANULADA',
                motivoAnulacion: cancelReason,
                updated_at: new Date().toISOString()
            }).eq('id', deleteConfirm);
            
            if (error) throw error;
            toast({ title: "Orden Anulada", description: "La orden ha sido cancelada correctamente." });
            onUpdateStatus(deleteConfirm, 'ANULADA'); 
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "No se pudo anular la orden.", variant: "destructive" });
        } finally {
            setIsCancelling(false);
            setDeleteConfirm(null);
            setCancelReason('');
        }
    }
  };

  // 🔥 REGLA DE EDICIÓN: Vendedor solo edita si está en VENTAS. Admin edita todo (excepto si está Anulada/Archivada) 🔥
  const canEdit = (status) => {
    if (status === 'ANULADA' || status === 'ARCHIVADA') return false;
    if (isAdmin) return true;
    return status === 'VENTAS';
  };
  
  const canArchive = (status) => isAdmin && status === 'FINALIZADA';
  const canUnarchive = (status) => isAdmin && status === 'ARCHIVADA';
  const canMoveStatus = () => true; 

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-4">
          <div className="w-full md:w-auto">
             <Button onClick={onCreateOrder} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white gap-2">
               <Plus className="h-4 w-4" /> Añadir Orden de Producción
             </Button>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="flex-1 md:flex-none gap-2 text-slate-600">
              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 md:flex-none gap-2 text-slate-600">
              <Printer className="h-4 w-4 text-slate-600" /> Imprimir
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-12 lg:col-span-4">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Buscar (Cliente, RUC, Vendedor...)</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Escribe nombre, RUC/Cédula, ID..." 
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="md:col-span-4 lg:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Estado</label>
            <select 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="TODOS">Todos</option>
              {FILTER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="md:col-span-4 lg:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Desde
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-4 lg:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Hasta
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-4 lg:col-span-2">
            <Button variant="ghost" onClick={handleResetFilters} className="w-full text-slate-500 hover:text-red-600 hover:bg-red-50 gap-2 h-[38px] border border-transparent hover:border-red-100">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex justify-between items-center">
             <span className="text-xs font-bold text-green-700 uppercase">Total Abonos</span>
             <span className="text-lg font-bold text-green-800">{formatCurrency(dynamicTotals.abono)}</span>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex justify-between items-center">
             <span className="text-xs font-bold text-red-700 uppercase">Saldo Pendiente</span>
             <span className="text-lg font-bold text-red-800">{formatCurrency(dynamicTotals.saldo)}</span>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
             <span className="text-xs font-bold text-blue-700 uppercase">Total General</span>
             <span className="text-lg font-bold text-blue-800">{formatCurrency(dynamicTotals.total)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50 gap-4 print:hidden">
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
               <option value={100}>100</option>
             </select>
             <span>registros</span>
           </div>
           
           <div className="flex items-center gap-2">
             <Button 
               variant="outline" size="icon" className="h-8 w-8" 
               onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
               disabled={currentPage === 1}
             >
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <span className="text-sm font-medium text-slate-600">
               Página <span className="text-slate-900">{currentPage}</span> de {totalPages || 1}
             </span>
             <Button 
               variant="outline" size="icon" className="h-8 w-8" 
               onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
               disabled={currentPage >= totalPages}
             >
               <ChevronRight className="h-4 w-4" />
             </Button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-bold">Orden</th>
                <th className="px-4 py-3 font-bold">Creación</th>
                <th className="px-4 py-3 font-bold text-center">Tipo</th>
                <th className="px-4 py-3 font-bold">Título</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold text-right">Abono</th>
                <th className="px-4 py-3 font-bold text-right">Saldo</th>
                <th className="px-4 py-3 font-bold text-right">Total</th>
                <th className="px-4 py-3 font-bold">Proforma Origen</th>
                <th className="px-4 py-3 font-bold">Responsable</th>
                <th className="px-4 py-3 font-bold">Entrega</th>
                <th className="px-4 py-3 font-bold text-center">Estado</th>
                <th className="px-4 py-3 font-bold text-center print:hidden">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => {
                  const financials = order.financials || { subtotal: 0, iva: 0, total: 0, saldo: 0 };
                  const isAnulada = order.status === 'ANULADA';
                  const isArchivada = order.status === 'ARCHIVADA';
                  
                  const typeLabel = getOrderTypeLabel(order);
                  
                  const anticipoInicial = parseFloat(order.anticipo) || 0;
                  const abonosPosteriores = (order.abonos || []).reduce((sum, a) => sum + Number(a.monto), 0);
                  const abonoTotal = anticipoInicial + abonosPosteriores;
                  const saldoReal = Math.max(0, (parseFloat(financials.total) || 0) - abonoTotal);

                  const origenProformaInfo = order.origenProformaInfo || order.origenProformaId;

                  return (
                    <tr key={order.id} className={`transition-colors ${isAnulada ? 'bg-red-50 hover:bg-red-100' : isArchivada ? 'bg-slate-100 opacity-75' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {formatOrderId(order)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{formatDate(order.createdAt || order.created_at)}</span>
                          <span className="text-xs text-slate-400">{formatTime(order.createdAt || order.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${typeLabel === 'VC' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate" title={order.tipoLetrero || order.tipo_trabajo}>
                        {order.tipoLetrero || order.tipo_trabajo}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate" title={order.cliente || order.cliente_nombre}>
                        <div>{order.cliente || order.cliente_nombre}</div>
                        {(order.ruc || order.cedula) && <div className="text-[10px] text-slate-400">{order.ruc || order.cedula}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(abonoTotal)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${saldoReal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(saldoReal)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(financials.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {origenProformaInfo ? (
                           <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                              #{String(origenProformaInfo).padStart(7,'0')}
                           </span>
                        ) : (
                           <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {order.vendedor || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(order.fechaEntrega || order.fecha_entrega)}
                      </td>
                      <td className="px-4 py-3">
                        {isAnulada ? (
                          <div className="flex justify-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              ANULADA
                            </span>
                          </div>
                        ) : isArchivada ? (
                           <div className="flex justify-center">
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600 border border-slate-300 italic">
                               ARCHIVADA
                             </span>
                           </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {canMoveStatus(order, 'prev') && (
                              <button 
                                onClick={(e) => handleStatusChange(order, 'prev', e)}
                                className="p-1 rounded-full hover:bg-slate-200 text-slate-600 print:hidden"
                                title="Estado anterior"
                              >
                                <ArrowLeft className="h-4 w-4" />
                              </button>
                            )}
                            <StatusBadge status={order.status} />
                            {canMoveStatus(order, 'next') && (
                              <button 
                                onClick={(e) => handleStatusChange(order, 'next', e)}
                                className="p-1 rounded-full hover:bg-slate-200 text-slate-600 print:hidden"
                                title="Estado siguiente"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 print:hidden">
                        <div className="flex gap-1 justify-end">
                          {actionConfig.showView && (
                            <Button variant="ghost" size="icon" onClick={() => onViewOrder(order)} className="h-8 w-8 text-blue-600 hover:bg-blue-50" title="Ver detalles">
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {actionConfig.showEdit && canEdit(order.status) && (
                            <Button variant="ghost" size="icon" onClick={() => onEditOrder(order)} className="h-8 w-8 text-amber-600 hover:bg-amber-50" title="Editar orden">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {saldoReal > 0 && onAbonoOrder && (
                            <Button variant="ghost" size="icon" onClick={() => onAbonoOrder(order)} title="Registrar Abono" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50">
                                <Coins className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {/* 🔥 BASURERO SIEMPRE DISPONIBLE PARA ANULAR O ELIMINAR 🔥 */}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => { setDeleteConfirm(order.id); setCancelReason(''); }} 
                            className="h-8 w-8 text-red-600 hover:bg-red-100 bg-red-50/50" 
                            title={isAnulada ? "Eliminar permanentemente" : "Anular orden"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          {actionConfig.showArchive && canArchive(order.status) && (
                            <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(order.id, 'ARCHIVADA')} className="h-8 w-8 text-slate-600 hover:bg-slate-100" title="Archivar orden">
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                          {actionConfig.showUnarchive && canUnarchive(order.status) && (
                            <Button variant="ghost" size="icon" onClick={() => onUpdateStatus(order.id, 'FINALIZADA')} className="h-8 w-8 text-slate-600 hover:bg-slate-100" title="Desarchivar orden">
                              <RotateCw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="13" className="px-4 py-8 text-center text-slate-500">
                    No hay órdenes que coincidan con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-100 bg-slate-50/50 gap-4 print:hidden">
           <div className="text-sm text-slate-600">
             Mostrando <span className="font-semibold">{paginatedOrders.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> a <span className="font-semibold">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> de <span className="font-semibold">{filteredOrders.length}</span> órdenes
           </div>
           
           <div className="flex items-center gap-2">
             <Button 
               variant="outline" size="icon" className="h-8 w-8" 
               onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
               disabled={currentPage === 1}
             >
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <span className="text-sm font-medium text-slate-600">
               Página <span className="text-slate-900">{currentPage}</span> de {totalPages || 1}
             </span>
             <Button 
               variant="outline" size="icon" className="h-8 w-8" 
               onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
               disabled={currentPage >= totalPages}
             >
               <ChevronRight className="h-4 w-4" />
             </Button>
           </div>
        </div>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={isPermanentDelete ? 'text-slate-800' : 'text-red-600'}>
              {isPermanentDelete ? 'Eliminar Orden Anulada' : `Anular Orden #${deleteOrderData ? formatOrderId(deleteOrderData) : ''}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isPermanentDelete 
                ? `¿Está seguro de que desea eliminar permanentemente la orden? Esta acción no se puede deshacer.`
                : `¿Está seguro de que desea anular esta orden? Se cambiará el estado a ANULADA.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {!isPermanentDelete && (
              <div className="my-4">
                 <label className="text-sm font-bold text-slate-700 mb-2 block">Motivo de la anulación *</label>
                 <textarea 
                    className="w-full border border-slate-300 rounded-md p-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none"
                    rows="3"
                    placeholder="Ej: El cliente canceló el proyecto..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                 />
              </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelReason('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={isCancelling || (!isPermanentDelete && !cancelReason.trim())}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : (isPermanentDelete ? 'Eliminar' : 'Confirmar Anulación')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPanel;