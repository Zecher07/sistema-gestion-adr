
import React, { useState, useMemo } from 'react';
import { Eye, Ban, Printer, FileSpreadsheet, Search, Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InvoiceStatusBadge from './InvoiceStatusBadge';
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

const InvoicesPanel = ({ 
  invoices = [], 
  onViewInvoice, 
  onAnulateInvoice 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [anulateConfirm, setAnulateConfirm] = useState(null);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        String(inv.sequential).includes(searchTerm) ||
        inv.clientData.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.clientData.ruc.includes(searchTerm);
      
      const matchesStatus = statusFilter === 'TODOS' || inv.status === statusFilter;
      
      let matchesDate = true;
      if (dateStart) matchesDate = matchesDate && inv.date >= dateStart;
      if (dateEnd) matchesDate = matchesDate && inv.date <= dateEnd;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [invoices, searchTerm, statusFilter, dateStart, dateEnd]);

  // Stats
  const stats = useMemo(() => {
    return {
      totalCount: filteredInvoices.length,
      totalAmount: filteredInvoices.filter(i => i.status !== 'ANULADA').reduce((sum, i) => sum + i.financials.total, 0),
      anulatedCount: filteredInvoices.filter(i => i.status === 'ANULADA').length
    };
  }, [filteredInvoices]);

  const handleExportCSV = () => {
    const headers = ['Secuencial', 'Fecha', 'Cliente', 'RUC', 'Total', 'Estado', 'Forma Pago'];
    const rows = filteredInvoices.map(i => [
      i.sequential,
      i.date,
      `"${i.clientData.name}"`,
      i.clientData.ruc,
      i.financials.total.toFixed(2),
      i.status,
      i.paymentMethod
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      ["sep=,", headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `facturas_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setDateStart('');
    setDateEnd('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       {/* Header */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
             <div>
                <h2 className="text-xl font-bold text-slate-800">Gestión de Facturación</h2>
                <p className="text-slate-500 text-sm">Administra y emite documentos electrónicos SRI</p>
             </div>
             <Button variant="outline" onClick={handleExportCSV} className="gap-2 text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200">
                <FileSpreadsheet className="h-4 w-4" /> Exportar Reporte
             </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <span className="text-xs font-bold text-blue-600 uppercase">Total Facturado</span>
                <p className="text-2xl font-bold text-blue-900">${stats.totalAmount.toFixed(2)}</p>
             </div>
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-600 uppercase">Documentos Emitidos</span>
                <p className="text-2xl font-bold text-slate-900">{stats.totalCount}</p>
             </div>
             <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <span className="text-xs font-bold text-red-600 uppercase">Anuladas</span>
                <p className="text-2xl font-bold text-red-900">{stats.anulatedCount}</p>
             </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar cliente, RUC, secuencial..." 
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             
             <div>
                <select 
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="TODOS">Todos los estados</option>
                  <option value="EMITIDA">Emitida</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="ANULADA">Anulada</option>
                </select>
             </div>

             <div className="flex gap-2">
                <input 
                  type="date" 
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
                <input 
                  type="date" 
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
             </div>

             <Button variant="ghost" onClick={handleResetFilters} className="text-slate-500 hover:text-red-600">
                <RotateCcw className="h-4 w-4 mr-2" /> Limpiar
             </Button>
          </div>
       </div>

       {/* Table */}
       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left">
             <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                   <th className="px-6 py-4">Secuencial</th>
                   <th className="px-6 py-4">Fecha</th>
                   <th className="px-6 py-4">Cliente</th>
                   <th className="px-6 py-4">RUC / CI</th>
                   <th className="px-6 py-4 text-right">Total</th>
                   <th className="px-6 py-4 text-center">Estado</th>
                   <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {filteredInvoices.length > 0 ? (
                   filteredInvoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 font-mono text-slate-600 font-bold">
                            #{String(inv.sequential).padStart(9, '0')}
                         </td>
                         <td className="px-6 py-4 text-slate-600">
                            {inv.date}
                         </td>
                         <td className="px-6 py-4 font-medium text-slate-800">
                            {inv.clientData.name}
                         </td>
                         <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                            {inv.clientData.ruc}
                         </td>
                         <td className="px-6 py-4 text-right font-bold text-slate-900">
                            ${inv.financials.total.toFixed(2)}
                         </td>
                         <td className="px-6 py-4 text-center">
                            <InvoiceStatusBadge status={inv.status} />
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                               <button 
                                 onClick={() => onViewInvoice(inv)}
                                 className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                 title="Ver Detalle"
                               >
                                  <Eye className="h-4 w-4" />
                               </button>
                               {inv.status !== 'ANULADA' && (
                                  <button 
                                    onClick={() => setAnulateConfirm(inv)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Anular Factura"
                                  >
                                     <Ban className="h-4 w-4" />
                                  </button>
                               )}
                            </div>
                         </td>
                      </tr>
                   ))
                ) : (
                   <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-slate-400 italic">
                         No se encontraron facturas con los filtros seleccionados.
                      </td>
                   </tr>
                )}
             </tbody>
          </table>
       </div>

       {/* Anulate Confirm Modal */}
       <AlertDialog open={!!anulateConfirm} onOpenChange={(open) => !open && setAnulateConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular Factura?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea anular la factura #{anulateConfirm ? String(anulateConfirm.sequential).padStart(9,'0') : ''}? 
              Esta acción cambiará el estado a ANULADA y no podrá revertirse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                onAnulateInvoice(anulateConfirm);
                setAnulateConfirm(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar Anulación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default InvoicesPanel;
