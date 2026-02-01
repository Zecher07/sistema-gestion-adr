
import React, { useMemo } from 'react';
import { X, Printer, Edit, FileCheck, Calendar, User, DollarSign, FileText, ArrowRight, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ProformaStatusBadge from '@/components/ProformaStatusBadge';
import { cn } from '@/lib/utils';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';

const ProformaDetailsModal = ({ 
  proforma, 
  onClose, 
  onEdit, 
  onConvert, 
  onUpdateProforma,
  user,
  staffUsers = []
}) => {
  const { toast } = useToast();

  const isAdmin = user?.role === 'Administrador';

  const validSellers = useMemo(() => {
     const sellers = getValidSellers(staffUsers);
     return removeDuplicateUsers(sellers);
  }, [staffUsers]);

  if (!proforma) return null;

  const handleResponsableChange = (e) => {
     if (onUpdateProforma) {
        onUpdateProforma({ responsable: e.target.value });
     }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  // Status checks
  const isBorrador = proforma.status === 'BORRADOR';
  const isAprobada = proforma.status === 'APROBADA';
  
  const canEdit = isBorrador;
  const canConvert = isBorrador; // Only draft can be converted, which approves it
  
  // Read-only check for Aprobada status
  const isReadOnly = isAprobada;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:max-w-none print:h-full">
        
        {/* Header - Hidden in Print */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 print:hidden">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              Proforma #{String(proforma.proformaNumber).padStart(7, '0')}
              <ProformaStatusBadge status={proforma.status} />
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Creada el {formatDate(proforma.createdAt)} por {proforma.responsable}
            </p>
          </div>
          <div className="flex gap-2">
             {canConvert && (
                <Button onClick={() => onConvert(proforma)} className="gap-2 bg-green-600 hover:bg-green-700">
                   <FileCheck className="h-4 w-4" /> Convertir a Orden
                </Button>
             )}
             {canEdit && (
                <Button onClick={() => onEdit(proforma)} variant="outline" className="gap-2">
                   <Edit className="h-4 w-4" /> Editar
                </Button>
             )}
             <Button onClick={handlePrint} variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir
             </Button>
             <Button onClick={onClose} variant="ghost" size="icon">
                <X className="h-5 w-5" />
             </Button>
          </div>
        </div>

        {/* Content - Printable Area */}
        <div className="flex-1 overflow-y-auto p-8 print:p-8 print:overflow-visible">
          
          {/* Printable Header */}
          <div className="hidden print:flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-4">
             <div>
                <h1 className="text-3xl font-black text-slate-900">PROFORMA</h1>
                <p className="text-slate-600 mt-1">#{String(proforma.proformaNumber).padStart(7, '0')}</p>
             </div>
             <div className="text-right">
                <h3 className="font-bold text-lg">ADR Company</h3>
                <p className="text-sm text-slate-500">Servicios de Impresión y Publicidad</p>
                <p className="text-sm text-slate-500">Fecha: {formatDate(proforma.createdAt)}</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
             {/* Client Info */}
             <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 print:bg-transparent print:border print:border-slate-300">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                   <User className="h-4 w-4" /> Cliente
                </h3>
                <div className="space-y-2">
                   <p className="text-lg font-bold text-slate-900">{proforma.clienteData?.razonSocial || 'Cliente General'}</p>
                   <p className="text-sm text-slate-600">RUC/CI: {proforma.clienteData?.cedulaRuc || 'N/A'}</p>
                   <p className="text-sm text-slate-600">{proforma.clienteData?.direccion || 'Dirección no registrada'}</p>
                   <p className="text-sm text-slate-600">{proforma.clienteData?.telefono || 'Teléfono no registrado'}</p>
                   <p className="text-sm text-slate-600">{proforma.clienteData?.email || 'Email no registrado'}</p>
                </div>
             </div>

             {/* Proforma Details */}
             <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 print:bg-transparent print:border print:border-slate-300">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                   <FileText className="h-4 w-4" /> Detalles
                </h3>
                <div className="space-y-3 text-sm">
                   <div className="flex justify-between">
                      <span className="text-slate-600">Tiempo de Entrega:</span>
                      <span className="font-medium">{proforma.tiempoEntrega || 'No especificado'}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-slate-600">Forma de Pago:</span>
                      <span className="font-medium">{proforma.formaPago}</span>
                   </div>
                   {proforma.formaPago === 'Crédito' && (
                     <div className="flex justify-between">
                        <span className="text-slate-600">Vencimiento Crédito:</span>
                        <span className="font-medium">{proforma.creditoVence || 'No especificado'}</span>
                     </div>
                   )}
                   <div className="flex justify-between items-center">
                      <span className="text-slate-600">Responsable:</span>
                      {isAdmin && !isReadOnly ? (
                          <div className="flex items-center gap-2">
                             <select 
                               className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none print:hidden"
                               value={proforma.responsable || ''}
                               onChange={handleResponsableChange}
                             >
                                <option value="">Seleccionar...</option>
                                {validSellers.map(u => (
                                   <option key={u.id} value={u.name}>{formatResponsableName(u)}</option>
                                ))}
                             </select>
                             <span className="hidden print:inline font-medium">{proforma.responsable}</span>
                             <Edit2 className="h-3 w-3 text-slate-400 print:hidden" />
                          </div>
                      ) : (
                          <span className="font-medium">{proforma.responsable}</span>
                      )}
                   </div>
                   {proforma.convertedToOrderId && (
                      <div className="flex justify-between text-green-600 font-bold bg-green-50 p-1 rounded mt-2 border border-green-200">
                         <span>Orden de Prod.:</span>
                         <span>#{proforma.convertedToOrderId}</span>
                      </div>
                   )}
                </div>
             </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
             <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200 print:bg-slate-100 print:print-color-adjust-exact">
                   <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-700">Descripción</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-700 w-24">Cant.</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700 w-32">P. Unit</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-700 w-32">Total</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {proforma.items.map((item, idx) => (
                      <tr key={idx}>
                         <td className="px-4 py-3 text-slate-800">{item.producto}</td>
                         <td className="px-4 py-3 text-center text-slate-600">{item.cantidad}</td>
                         <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.precioUnitario)}</td>
                         <td className="px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(item.cantidad * item.precioUnitario)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
             <div className="w-full md:w-1/2 lg:w-1/3 space-y-2">
                <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                   <span className="text-slate-600">Subtotal</span>
                   <span className="font-medium">{formatCurrency(proforma.financials?.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                   <span className="text-slate-600">Descuento</span>
                   <span className="font-medium text-red-500">-{formatCurrency(proforma.financials?.descuento)}</span>
                </div>
                <div className="flex justify-between text-sm py-1 border-b border-slate-100">
                   <span className="text-slate-600">IVA (15%)</span>
                   <span className="font-medium">{formatCurrency(proforma.financials?.impuesto)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold py-2 bg-slate-100 px-2 rounded print:bg-slate-100 print:print-color-adjust-exact">
                   <span className="text-slate-900">TOTAL</span>
                   <span className="text-blue-600 print:text-black">{formatCurrency(proforma.financials?.total)}</span>
                </div>
             </div>
          </div>

          {/* Footer Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
             <div>
                <h4 className="font-bold text-slate-800 mb-2">Condiciones Comerciales</h4>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print:bg-transparent print:border print:border-slate-300 space-y-2">
                   <div className="flex justify-between">
                     <span className="text-slate-600">Anticipo ({proforma.advancePercentage || 50}%):</span>
                     <span className="font-medium">{formatCurrency(proforma.anticipoMonto)}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-slate-600">Saldo contra entrega ({proforma.balancePercentage || 50}%):</span>
                     <span className="font-medium">{formatCurrency(proforma.saldoMonto)}</span>
                   </div>
                   <p className="text-slate-500 text-xs mt-3 italic">Esta proforma tiene una validez de 15 días.</p>
                </div>
             </div>
             <div>
                {proforma.notasInternas && (
                   <div className="print:hidden">
                      <h4 className="font-bold text-slate-800 mb-2">Notas Internas</h4>
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-slate-700 italic">
                         {proforma.notasInternas}
                      </div>
                   </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProformaDetailsModal;
