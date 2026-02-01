
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Eye, Edit, Trash2, Plus, Printer, FileSpreadsheet,
  ChevronLeft, ChevronRight, RotateCcw, Calendar as CalendarIcon,
  ArrowUpDown, FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ProformaStatusBadge from '@/components/ProformaStatusBadge';
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

// Updated status filters
const FILTER_STATUSES = ['BORRADOR', 'APROBADA'];

const ProformasPanel = ({ 
  proformas = [], 
  clients = [],
  onCreateNew,
  onViewProforma,
  onEditProforma,
  onDeleteProforma,
  onChangeStatus,
  onConvertToOrder,
  user
}) => {
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [clientFilter, setClientFilter] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Pagination
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

  const formatProformaId = (proforma) => (proforma.proformaNumber || proforma.id).toString().padStart(7, '0');

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.razonSocial || 'Cliente no encontrado';
  };

  const toggleStatusFilter = (status) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Filtering
  const filteredProformas = useMemo(() => {
    return proformas.filter(proforma => {
      // Text search
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (proforma.proformaNumber ? proforma.proformaNumber.toString() : proforma.id).toLowerCase().includes(searchLower) ||
        getClientName(proforma.cliente).toLowerCase().includes(searchLower) ||
        (proforma.responsable && proforma.responsable.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(proforma.status)) return false;

      // Client filter
      if (clientFilter && !getClientName(proforma.cliente).toLowerCase().includes(clientFilter.toLowerCase())) return false;

      // Responsible filter
      if (responsibleFilter && (!proforma.responsable || !proforma.responsable.toLowerCase().includes(responsibleFilter.toLowerCase()))) return false;

      // Date range
      if (startDate) {
        const proformaDate = new Date(proforma.createdAt);
        const start = new Date(startDate + 'T00:00:00');
        if (proformaDate < start) return false;
      }
      if (endDate) {
        const proformaDate = new Date(proforma.createdAt);
        const end = new Date(endDate + 'T23:59:59.999');
        if (proformaDate > end) return false;
      }

      return true;
    });
  }, [proformas, searchTerm, statusFilter, clientFilter, responsibleFilter, startDate, endDate, clients]);

  // Sorting
  const sortedProformas = useMemo(() => {
    const sorted = [...filteredProformas];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'proformaNumber':
          aVal = a.proformaNumber || a.id;
          bVal = b.proformaNumber || b.id;
          break;
        case 'cliente':
          aVal = getClientName(a.cliente);
          bVal = getClientName(b.cliente);
          break;
        case 'total':
          aVal = a.financials?.total || 0;
          bVal = b.financials?.total || 0;
          break;
        case 'createdAt':
        default:
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredProformas, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Pagination
  const totalPages = Math.ceil(sortedProformas.length / itemsPerPage);
  const paginatedProformas = sortedProformas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, clientFilter, responsibleFilter, startDate, endDate, itemsPerPage]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setClientFilter('');
    setResponsibleFilter('');
    setStartDate('');
    setEndDate('');
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    const proforma = proformas.find(p => p.id === deleteConfirm);
    if (proforma?.status !== 'BORRADOR') {
      toast({
        title: "No permitido",
        description: "Solo se pueden eliminar proformas en estado BORRADOR",
        variant: "destructive"
      });
      setDeleteConfirm(null);
      return;
    }
    onDeleteProforma(deleteConfirm);
    setDeleteConfirm(null);
  };

  const handleExportCSV = () => {
    const headers = ['Proforma #', 'Fecha', 'Cliente', 'Total', 'Estado', 'Responsable'];
    const rows = sortedProformas.map(p => [
      formatProformaId(p),
      formatDate(p.createdAt),
      `"${getClientName(p.cliente)}"`,
      (p.financials?.total || 0).toFixed(2),
      p.status,
      p.responsable || '-'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      ["sep=,", headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `proformas_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canEdit = (proforma) => proforma.status === 'BORRADOR';
  const canDelete = (proforma) => proforma.status === 'BORRADOR' && (user.role === 'Administrador' || user.role === 'Vendedor');
  const canConvert = (proforma) => proforma.status === 'BORRADOR';

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Gestión de Proformas</h2>
            <p className="text-slate-500 text-sm">Administra cotizaciones y presupuestos</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onCreateNew} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="h-4 w-4" /> Nueva Proforma
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Buscar</label>
            <input 
              type="text" 
              placeholder="ID, Cliente..." 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Estados</label>
            <div className="flex flex-wrap gap-1">
              {FILTER_STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    statusFilter.includes(status)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Cliente</label>
            <input 
              type="text" 
              placeholder="Filtrar..." 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Desde
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> Hasta
            </label>
            <input 
              type="date" 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleResetFilters} className="gap-2 text-slate-500 hover:text-red-600">
            <RotateCcw className="h-4 w-4" /> Limpiar Filtros
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50 gap-4">
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
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" size="icon" className="h-8 w-8" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-slate-600">
              Página {currentPage} de {totalPages || 1}
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
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-200" onClick={() => handleSort('proformaNumber')}>
                  <div className="flex items-center gap-1">
                    Proforma #
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-200" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center gap-1">
                    Fecha
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 font-bold cursor-pointer hover:bg-slate-200" onClick={() => handleSort('cliente')}>
                  <div className="flex items-center gap-1">
                    Cliente
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 font-bold text-right cursor-pointer hover:bg-slate-200" onClick={() => handleSort('total')}>
                  <div className="flex items-center justify-end gap-1">
                    Total
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="px-4 py-3 font-bold text-center">Estado</th>
                <th className="px-4 py-3 font-bold">Responsable</th>
                <th className="px-4 py-3 font-bold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProformas.length > 0 ? (
                paginatedProformas.map((proforma) => (
                  <tr key={proforma.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {formatProformaId(proforma)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">{formatDate(proforma.createdAt)}</span>
                        <span className="text-xs text-slate-400">{formatTime(proforma.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium max-w-[200px] truncate" title={getClientName(proforma.cliente)}>
                      {getClientName(proforma.cliente)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatCurrency(proforma.financials?.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ProformaStatusBadge status={proforma.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {proforma.responsable || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => onViewProforma(proforma)}
                          title="Ver Detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {canEdit(proforma) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                            onClick={() => onEditProforma(proforma)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}

                        {canConvert(proforma) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50"
                            onClick={() => onViewProforma(proforma)} // Opens details which has convert button
                            title="Ver para Convertir"
                          >
                            <FileCheck className="h-4 w-4" />
                          </Button>
                        )}

                        {canDelete(proforma) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteConfirm(proforma.id)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-100 rounded-full">
                        <FileSpreadsheet className="h-8 w-8 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-slate-600 font-medium">No hay proformas registradas</p>
                        <p className="text-slate-400 text-sm mt-1">Crea tu primera proforma para comenzar</p>
                      </div>
                      <Button onClick={onCreateNew} className="mt-2 gap-2">
                        <Plus className="h-4 w-4" /> Nueva Proforma
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {paginatedProformas.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
            Mostrando {paginatedProformas.length} de {sortedProformas.length} registros
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proforma?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La proforma será eliminada permanentemente del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProformasPanel;
