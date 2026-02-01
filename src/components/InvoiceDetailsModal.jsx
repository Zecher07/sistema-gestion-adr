
import React from 'react';
import { X, Printer, Ban, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InvoiceStatusBadge from './InvoiceStatusBadge';

const InvoiceDetailsModal = ({ 
  invoice, 
  onClose, 
  onAnulate,
  onViewOrder
}) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const isAnulada = invoice.status === 'ANULADA';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:h-full relative overflow-hidden">
        
        {/* Watermark for Anulada */}
        {isAnulada && (
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
             <div className="text-red-500/10 font-bold text-[10vw] -rotate-12 border-8 border-red-500/10 px-10 py-4">ANULADA</div>
          </div>
        )}

        {/* Header - Hidden in Print */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 print:hidden relative z-10 bg-white">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
              Factura #{String(invoice.sequential).padStart(9, '0')}
              <InvoiceStatusBadge status={invoice.status} />
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Emitida el {new Date(invoice.date).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
             {!isAnulada && (
               <Button onClick={() => onAnulate(invoice)} variant="outline" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                  <Ban className="h-4 w-4" /> Anular
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

        {/* Printable Content */}
        <div className="flex-1 overflow-y-auto p-8 print:p-8 relative z-10">
           
           {/* Invoice Header */}
           <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-800">
              <div>
                 <h1 className="text-3xl font-black text-slate-900 tracking-tight">FACTURA</h1>
                 <p className="text-lg font-mono text-slate-600 mt-1">No. {String(invoice.sequential).padStart(9, '0')}</p>
                 <div className="mt-4 text-sm text-slate-500">
                    <p className="font-bold text-slate-800">ADR Company</p>
                    <p>RUC: 1799999999001</p>
                    <p>Matriz: Av. Principal y Calle 1</p>
                    <p>Quito - Ecuador</p>
                 </div>
              </div>
              <div className="text-right">
                 <div className="bg-slate-50 p-4 rounded border border-slate-200 inline-block text-left min-w-[200px]">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Fecha de Emisión</p>
                    <p className="font-medium text-lg">{new Date(invoice.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                 </div>
                 {invoice.linkedOrderNumber && (
                    <div className="mt-2 text-sm">
                       <span className="text-slate-500">Ref: </span>
                       <button 
                         onClick={() => onViewOrder && onViewOrder(invoice.linkedOrderId)} 
                         className="text-blue-600 hover:underline font-bold print:no-underline print:text-slate-800"
                       >
                         Orden #{invoice.linkedOrderNumber}
                       </button>
                    </div>
                 )}
              </div>
           </div>

           {/* Client Info */}
           <div className="mb-8 bg-slate-50/50 p-5 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                 <div>
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Cliente</p>
                    <p className="font-bold text-slate-800 text-lg">{invoice.clientData.name}</p>
                 </div>
                 <div>
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">RUC / CI</p>
                    <p className="font-mono text-slate-800">{invoice.clientData.ruc}</p>
                 </div>
                 <div className="md:col-span-2">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Dirección</p>
                    <p className="text-slate-800">{invoice.clientData.address || 'No registrada'}</p>
                 </div>
              </div>
           </div>

           {/* Items Table */}
           <div className="mb-8">
              <table className="w-full text-sm">
                 <thead className="bg-slate-800 text-white print:bg-slate-200 print:text-black">
                    <tr>
                       <th className="px-4 py-2 text-left">Descripción</th>
                       <th className="px-4 py-2 text-center w-20">Cant</th>
                       <th className="px-4 py-2 text-right w-32">P. Unit</th>
                       <th className="px-4 py-2 text-right w-24">Desc</th>
                       <th className="px-4 py-2 text-right w-32">Total</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                       <tr key={idx}>
                          <td className="px-4 py-3 font-medium text-slate-700">{item.description}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-600">${Number(item.unitPrice).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{Number(item.discount) > 0 ? `-$${Number(item.discount).toFixed(2)}` : '-'}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                             ${((item.quantity * item.unitPrice) - (item.discount || 0)).toFixed(2)}
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           {/* Footer Summary */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                 <h4 className="font-bold text-slate-700 text-sm mb-2">Información Adicional</h4>
                 <div className="text-sm space-y-1 text-slate-600">
                    <p><span className="font-medium">Forma de Pago:</span> {invoice.paymentMethod}</p>
                    {invoice.observations && (
                       <div className="mt-2 p-3 bg-yellow-50 rounded border border-yellow-100 text-xs italic">
                          {invoice.observations}
                       </div>
                    )}
                 </div>
              </div>
              
              <div>
                 <div className="space-y-2 text-sm border-t border-slate-200 pt-4">
                    <div className="flex justify-between text-slate-600">
                       <span>Subtotal</span>
                       <span className="font-medium">${invoice.financials.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                       <span>IVA (12%)</span>
                       <span className="font-medium">${invoice.financials.iva.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-black text-slate-900 border-t border-slate-800 pt-2 mt-2">
                       <span>TOTAL</span>
                       <span>${invoice.financials.total.toFixed(2)}</span>
                    </div>
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailsModal;
