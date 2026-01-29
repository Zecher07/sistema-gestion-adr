
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Eye, Edit, Trash2, CreditCard, 
  ArrowLeft, ArrowRight,
  Search, Download, Printer, Plus,
  ChevronLeft, ChevronRight, RotateCcw,
  FileSpreadsheet, Calendar as CalendarIcon,
  Archive, RotateCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
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

// Definimos el flujo normal de trabajo para los botones de avance/retroceso
const WORKFLOW_STATUSES = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];

// Definimos todos los estados posibles para el filtro
const FILTER_STATUSES = [...WORKFLOW_STATUSES, 'ANULADA', 'ARCHIVADA'];

const OrdersPanel = ({ 
  orders = [], 
  user, 
  onUpdateStatus, 
  onDeleteOrder, 
  onUpdateOrder, 
  onEditOrder, 
  onPaymentOrder,
  onCreateOrder,
  onViewOrder
}) => {
  // --- Estados de UI ---
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // --- Estados de Filtros y Paginación ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [clientFilter, setClientFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- Helpers de Formato ---
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

  const formatOrderId = (id) => id.toString().slice(-8).padStart(8, '0');

  // --- Filtrado Principal ---
  const roleFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (user.role === 'Administrador' || user.role === 'Vendedor' || user.role === 'Contabilidad') return true;
      if (user.role === 'Producción') return order.status === 'PRODUCCION';
      return false;
    });
  }, [orders, user.role]);

  const filteredOrders = useMemo(() => {
    return roleFilteredOrders.filter(order => {
      // 1. Text Search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        order.id.toLowerCase().includes(searchLower) ||
        order.cliente.toLowerCase().includes(searchLower) ||
        order.tipoLetrero.toLowerCase().includes(searchLower) ||
        (order.vendedor && order.vendedor.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // 2. Dropdown Filters
      if (statusFilter !== 'TODOS' && order.status !== statusFilter) return false;
      if (clientFilter && !order.cliente.toLowerCase().includes(clientFilter.toLowerCase())) return false;
      if (vendorFilter && (!order.vendedor || !order.vendedor.toLowerCase().includes(vendorFilter.toLowerCase()))) return false;

      // 3. Date Range Filter
      if (startDate) {
        const orderDate = new Date(order.createdAt);
        const start = new Date(startDate + 'T00:00:00'); // Local Start of day
        if (orderDate < start) return false;
      }
      if (endDate) {
        const orderDate = new Date(order.createdAt);
        const end = new Date(endDate + 'T23:59:59.999'); // Local End of day
        if (orderDate > end) return false;
      }

      return true;
    });
  }, [roleFilteredOrders, searchTerm, statusFilter, clientFilter, vendorFilter, startDate, endDate]);

  // --- Totales Dinámicos ---
  const dynamicTotals = useMemo(() => {
    return filteredOrders.reduce((acc, order) => {
      const financials = order.financials || { total: 0, saldo: 0 };
      return {
        abono: acc.abono + (parseFloat(order.anticipo) || 0),
        saldo: acc.saldo + (parseFloat(financials.saldo) || 0),
        total: acc.total + (parseFloat(financials.total) || 0)
      };
    }, { abono: 0, saldo: 0, total: 0 });
  }, [filteredOrders]);

  // --- Paginación ---
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, clientFilter, vendorFilter, startDate, endDate, itemsPerPage]);

  const handleStatusChange = (orderId, currentStatus, direction, e) => {
    e.stopPropagation();
    // Solo permitimos avanzar en el flujo normal, no hacia/desde ANULADA con flechas
    const currentIndex = WORKFLOW_STATUSES.indexOf(currentStatus);
    if (currentIndex === -1) return; // Si es ANULADA u otro, no hacemos nada

    let newIndex;
    if (direction === 'next' && currentIndex < WORKFLOW_STATUSES.length - 1) newIndex = currentIndex + 1;
    else if (direction === 'prev' && currentIndex > 0) newIndex = currentIndex - 1;
    else return;
    onUpdateStatus(orderId, WORKFLOW_STATUSES[newIndex]);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setClientFilter('');
    setVendorFilter('');
    setStartDate('');
    setEndDate('');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Fecha', 'Cliente', 'Titulo', 'Estado', 'Vendedor', 'Total', 'Abono', 'Saldo'];
    const rows = filteredOrders.map(o => [
      formatOrderId(o.id),
      formatDate(o.createdAt),
      `"${o.cliente}"`,
      `"${o.tipoLetrero}"`,
      o.status,
      o.vendedor || '-',
      (o.financials?.total || 0).toFixed(2),
      (o.anticipo || 0).toFixed(2),
      (o.financials?.saldo || 0).toFixed(2)
    ]);
    
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

  // Helper para obtener la orden actual a borrar/anular
  const getOrderToDelete = () => {
    if (!deleteConfirm) return null;
    return orders.find(o => o.id === deleteConfirm);
  };

  const deleteOrderData = getOrderToDelete();
  const isPermanentDelete = deleteOrderData?.status === 'ANULADA';

  const canDelete = user.role === 'Administrador';
  const canEdit = (status) => user.role === 'Administrador' || (user.role === 'Vendedor' && status === 'VENTAS');
  const canRegisterPayment = () => ['Administrador', 'Vendedor', 'Contabilidad'].includes(user.role);
  const canCreate = user.role === 'Administrador' || user.role === 'Vendedor';
  const canArchive = (status) => user.role === 'Administrador' && status === 'FINALIZADA';
  const canUnarchive = (status) => user.role === 'Administrador' && status === 'ARCHIVADA';

  const canMoveStatus = (status, direction) => {
    if (status === 'ANULADA' || status === 'ARCHIVADA') return false; 
    if (user.role === 'Administrador') return true;
    if (user.role === 'Vendedor') {
      if (status === 'VENTAS' && direction === 'next') return true;
      if (status === 'PRODUCCION' && direction === 'next') return true;
      if (status === 'VENTAS POR RETIRAR' && direction === 'next') return true;
    }
    if (user.role === 'Contabilidad' && status === 'CONTABILIDAD' && direction === 'next') return true;
    return false;
  };

  return (
    <div className="space-y-4">
      {/* --- BARRA DE HERRAMIENTAS --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4 print:hidden">
        {/* Fila Superior: Botones de Acción Global */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-4">
          <div className="w-full md:w-auto">
            {canCreate && (
              <Button onClick={onCreateOrder} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white gap-2">
                <Plus className="h-4 w-4" /> Añadir Orden de Producción
              </Button>
            )}
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

        {/* Fila Media: Búsqueda y Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Row 1 */}
          <div className="md:col-span-4 lg:col-span-3">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="ID, Cliente, Título..." 
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="md:col-span-2">
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

          <div className="md:col-span-3">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Cliente</label>
            <input 
              type="text" 
              placeholder="Filtrar cliente..." 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>

          <div className="md:col-span-3 lg:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Responsable</label>
            <input 
              type="text" 
              placeholder="Vendedor..." 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            />
          </div>

          {/* Row 2 (Wraps naturally) */}
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Fecha Inicio
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Fecha Fin
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-2 lg:col-span-1">
            <Button variant="ghost" onClick={handleResetFilters} className="w-full text-slate-500 hover:text-red-600 hover:bg-red-50 gap-2 h-[38px] border border-transparent hover:border-red-100">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </div>
        </div>

        {/* Fila Inferior: Totales Dinámicos */}
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

      {/* --- TABLA --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Paginación Superior */}
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
                <th className="px-4 py-3 font-bold">Título</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold text-right">Abono</th>
                <th className="px-4 py-3 font-bold text-right">Saldo</th>
                <th className="px-4 py-3 font-bold text-right">Total</th>
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
                  
                  return (
                    <tr key={order.id} className={`transition-colors ${isAnulada ? 'bg-red-50 hover:bg-red-100' : isArchivada ? 'bg-slate-100 opacity-75' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {formatOrderId(order.id)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{formatDate(order.createdAt)}</span>
                          <span className="text-xs text-slate-400">{formatTime(order.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate" title={order.tipoLetrero}>
                        {order.tipoLetrero}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate" title={order.cliente}>
                        {order.cliente}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(order.anticipo)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${financials.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(financials.saldo)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(financials.total)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {order.vendedor || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDate(order.fechaEntrega)}
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
                            <button 
                              onClick={(e) => handleStatusChange(order.id, order.status, 'prev', e)}
                              disabled={!canMoveStatus(order.status, 'prev')}
                              className={`p-1 rounded-full hover:bg-slate-200 text-slate-400 print:hidden ${!canMoveStatus(order.status, 'prev') ? 'opacity-0 pointer-events-none' : ''}`}
                            >
                              <ArrowLeft className="h-3 w-3" />
                            </button>
                            
                            <div className="scale-90">
                              <StatusBadge status={order.status} />
                            </div>

                            <button 
                              onClick={(e) => handleStatusChange(order.id, order.status, 'next', e)}
                              disabled={!canMoveStatus(order.status, 'next')}
                              className={`p-1 rounded-full hover:bg-slate-200 text-slate-400 print:hidden ${!canMoveStatus(order.status, 'next') ? 'opacity-0 pointer-events-none' : ''}`}
                            >
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => onViewOrder(order)}
                            title="Ver Detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {!isAnulada && !isArchivada && canRegisterPayment() && order.status !== 'FINALIZADA' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50"
                              onClick={() => onPaymentOrder(order)}
                              title="Registrar Pago"
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {!isAnulada && !isArchivada && canEdit(order.status) && order.status !== 'FINALIZADA' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                              onClick={() => onEditOrder(order)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}

                          {canArchive(order.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-purple-600 hover:bg-purple-50"
                              onClick={() => onUpdateStatus(order.id, 'ARCHIVADA')}
                              title="Archivar"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}

                          {canUnarchive(order.status) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              onClick={() => onUpdateStatus(order.id, 'FINALIZADA')}
                              title="Desarchivar"
                            >
                              <RotateCw className="h-4 w-4" />
                            </Button>
                          )}
                          
                          {canDelete && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteConfirm(order.id)}
                              title={isAnulada ? "Eliminar Permanentemente" : "Anular Orden"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="px-4 py-8 text-center text-slate-500">
                    No se encontraron órdenes con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-center print:hidden">
           Mostrando {paginatedOrders.length} de {filteredOrders.length} registros (Total Global: {orders.length})
        </div>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
               {isPermanentDelete ? "¿Eliminar orden permanentemente?" : "¿Anular orden de trabajo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
               {isPermanentDelete 
                 ? "Esta acción no se puede deshacer. La orden será eliminada del sistema." 
                 : "La orden se moverá a la sección 'Anuladas' y no aparecerá en el flujo de trabajo activo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
               onClick={() => { 
                  if (isPermanentDelete) {
                    onDeleteOrder(deleteConfirm);
                  } else {
                    onUpdateStatus(deleteConfirm, 'ANULADA');
                  }
                  setDeleteConfirm(null); 
               }} 
               className="bg-red-600 hover:bg-red-700"
            >
               {isPermanentDelete ? "Eliminar" : "Anular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPanel;
