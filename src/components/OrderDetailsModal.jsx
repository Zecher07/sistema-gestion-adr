
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Image as ImageIcon, ArrowRightCircle, Archive, Edit2, FileText, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// Define workflows locally to determine next step text
const WORKFLOW_VPVC = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];
const WORKFLOW_VC = ['VENTAS', 'CONTABILIDAD', 'FINALIZADA'];

const OrderDetailsModal = ({ 
  order, 
  user, 
  staffUsers = [],
  onClose, 
  onProductToggle, 
  isTaskView, 
  onAdvanceWorkflow, 
  onArchiveOrder,
  onUpdateOrder,
  onGenerateInvoice
}) => {
  const [previewImage, setPreviewImage] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (order) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [order]);

  const isAdmin = user?.role === 'Administrador';
  
  const validSellers = useMemo(() => {
     const sellers = getValidSellers(staffUsers);
     return removeDuplicateUsers(sellers);
  }, [staffUsers]);

  if (!order) return null;

  const handleResponsableChange = (e) => {
    if (onUpdateOrder) {
       onUpdateOrder(order.id, { vendedor: e.target.value });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const formatDateFull = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (e) { return ''; }
  };

  const calculateDaysDiff = (dateString) => {
    if (!dateString) return '';
    const target = new Date(dateString);
    const now = new Date();
    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    if (isNaN(diffDays)) return '';
    return diffDays > 0 ? `(+${diffDays} días)` : `(${diffDays} días)`;
  };

  const formatOrderId = (id) => (order.orderNumber || id).toString().padStart(7, '0');
  
  const isAnulada = order.status === 'ANULADA';
  const isArchivada = order.status === 'ARCHIVADA';
  const isFinalizada = order.status === 'FINALIZADA';

  const fin = order.financials || { subtotal: 0, iva: 0, total: 0, saldo: 0 };

  const canArchive = isAdmin && isFinalizada;
  
  // Logic for Invoicing Button
  const canInvoice = 
    !isAnulada &&
    (user.role === 'Vendedor' || user.role === 'Contabilidad' || user.role === 'Administrador') &&
    ['VENTAS', 'PRODUCCION', 'CONTABILIDAD', 'FINALIZADA'].includes(order.status);
    
  // Workflow button logic
  const showWorkflowButton = !isAnulada && !isFinalizada && !isArchivada && (isTaskView || !isAdmin);

  // Dynamic Button Text Logic
  const getWorkflowButtonConfig = () => {
     const isVC = order.tipoOrden && order.tipoOrden.includes('(VC)');
     const workflow = isVC ? WORKFLOW_VC : WORKFLOW_VPVC;
     const currentIndex = workflow.indexOf(order.status);
     
     if (currentIndex === -1 || currentIndex >= workflow.length - 1) {
         return { text: 'Continuar flujo', helper: '' };
     }

     const nextStatus = workflow[currentIndex + 1];
     let text = `Pasar a ${nextStatus}`;

     // Determine text based on Current Status -> Target (Role perspective)
     switch (order.status) {
         case 'VENTAS':
             if (nextStatus === 'PRODUCCION') text = "Pasar a Producción";
             else if (nextStatus === 'CONTABILIDAD') text = "Pasar a Contabilidad";
             break;
         case 'PRODUCCION':
             // Assuming next is VENTAS POR RETIRAR or similar hand-off
             text = `Pasar a Ventas – ${order.vendedor || 'Sin asignar'}`;
             break;
         case 'VENTAS POR RETIRAR':
             if (nextStatus === 'CONTABILIDAD') text = "Pasar a Contabilidad";
             break;
         case 'CONTABILIDAD':
             if (nextStatus === 'FINALIZADA') text = "Finalizar orden";
             break;
         default:
             break;
     }
     
     return { text, helper: `Siguiente paso: ${nextStatus}` };
  };

  const workflowConfig = getWorkflowButtonConfig();

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto animate-in fade-in duration-200 flex flex-col">
        {/* Watermark */}
        {isAnulada && (
          <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="text-red-500/10 font-bold text-[15vw] rotate-[-30deg] border-[12px] border-red-500/10 px-20 py-10 uppercase whitespace-nowrap select-none">
              ANULADA
            </div>
          </div>
        )}

        {/* Header Strip */}
        <div className="bg-[#1e3a8a] text-white px-6 py-2 flex justify-between items-center text-xs print:hidden shrink-0 relative z-10">
            <span className="font-bold">Detalles de Orden</span>
            <div className="flex items-center gap-2 opacity-80">
                <span>Home</span>
                <span>{'>'}</span>
                <span>{isTaskView ? 'Tareas' : 'Ordenes'}</span>
                <span>{'>'}</span>
                <span>Detalles</span>
            </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 relative z-10 sticky top-0 shadow-sm print:static">
            <div className="flex items-center gap-4 text-blue-600 whitespace-nowrap overflow-x-auto max-w-full">
                <span className="cursor-not-allowed opacity-50 flex items-center gap-1 font-mono text-sm">
                   {'< - '} 0000000
                </span>
                <span className="font-bold text-slate-900 text-2xl mx-2">
                   Orden: <span className="font-mono">{formatOrderId(order.id)}</span>
                </span>
                <span className="cursor-not-allowed opacity-50 flex items-center gap-1 font-mono text-sm">
                   0000000 {' - >'}
                </span>
            </div>
            <div className="flex items-center gap-3 print:hidden">
                {canInvoice && onGenerateInvoice && (
                   <Button 
                      size="sm"
                      onClick={() => onGenerateInvoice(order)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                   >
                      <FileText className="h-4 w-4" /> Generar Factura
                   </Button>
                )}
                <Button 
                   size="sm" 
                   className="bg-[#3b82f6] hover:bg-blue-600 text-white gap-2"
                   onClick={() => window.print()}
                >
                    <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button 
                   size="sm" 
                   variant="outline" 
                   className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2"
                   onClick={onClose}
                >
                    <X className="h-4 w-4" /> Cerrar
                </Button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full relative z-0 flex flex-col">
            
            {/* 1. General Info & Observations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-8">
                <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="font-bold text-right text-slate-600">Titulo:</span>
                        <span className="uppercase font-medium text-slate-900">{order.tipoLetrero}</span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                        <span className="font-bold text-right text-slate-600">Autor:</span>
                        {isAdmin ? (
                           <div className="flex items-center gap-2">
                             <select 
                               className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                               value={order.vendedor || ''}
                               onChange={handleResponsableChange}
                             >
                                <option value="">Seleccionar...</option>
                                {validSellers.map(u => (
                                   <option key={u.id} value={u.name}>{formatResponsableName(u)}</option>
                                ))}
                             </select>
                             <Edit2 className="h-3 w-3 text-slate-400" />
                           </div>
                        ) : (
                           <span className="text-slate-900">{order.vendedor || 'Sistema'}</span>
                        )}
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="font-bold text-right text-slate-600">Fecha:</span>
                        <span className="text-slate-900">{formatDateFull(order.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="font-bold text-right text-slate-600">Fecha entrega:</span>
                        <span className="text-red-600 font-bold">
                            {formatDateFull(order.fechaEntrega)} <span className="text-xs ml-1 font-normal text-red-500">{calculateDaysDiff(order.fechaEntrega)}</span>
                        </span>
                    </div>
                     <div className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="font-bold text-right text-slate-600">Fecha Finaliz:</span>
                        <span className="text-slate-900">{isFinalizada ? formatDateFull(order.updatedAt) : ''}</span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-2 mt-4">
                        <span className="font-bold text-right text-slate-600">Cliente:</span>
                        <span className="text-blue-600 font-bold cursor-pointer hover:underline uppercase tracking-wide">
                            {order.cliente}
                        </span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <span className="font-bold text-slate-600 text-sm">Observaciones:</span>
                        <div className="border border-green-200 rounded-md p-3 min-h-[60px] bg-white text-sm text-slate-700 w-full shadow-sm">
                            {order.notas}
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <span className="font-bold text-slate-600 text-sm">Motivo Anulada:</span>
                        <div className="border border-green-200 rounded-md p-3 min-h-[40px] bg-white text-sm text-red-600 font-medium w-full shadow-sm">
                            {isAnulada ? (order.motivoAnulacion || "Orden Anulada") : ""}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Productions Table (Items ONLY) */}
            <div className="mb-6">
                 <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    Producciones
                    <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        {order.tipoOrden || 'VPVC'}
                    </span>
                 </h3>
                 <div className="border border-gray-300 rounded-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-[#003366] text-white">
                            <tr>
                                <th className="px-4 py-2 text-left font-bold w-16">Item</th>
                                <th className="px-4 py-2 text-left font-bold">Descripción</th>
                                <th className="px-4 py-2 text-right font-bold w-32">Unitario</th>
                                <th className="px-4 py-2 text-center font-bold w-24">Cant.</th>
                                <th className="px-4 py-2 text-right font-bold w-32">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {order.productos.map((prod, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-center text-slate-500">{idx + 1}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900 uppercase">{prod.descripcion}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{Number(prod.precio).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-center text-slate-600">{prod.cantidad}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(prod.precio * prod.cantidad)}</td>
                                </tr>
                            ))}
                            {order.productos.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic">No hay productos registrados</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. Payments Section */}
            <div className="mb-6 bg-slate-50/50 p-4 border border-slate-200 rounded-lg">
                <h3 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">Pagos</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Anticipo */}
                    <div className="bg-white border border-blue-200 rounded p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2">
                             <span className="text-blue-800 font-bold text-sm">Anticipo</span>
                             <span className="text-lg font-bold text-slate-800">{Number(order.anticipo || 0).toFixed(2)}</span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                             <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-medium text-slate-900">{order.formaPagoAnticipo || '-'}</span></div>
                             {order.formaPagoAnticipo === 'Crédito' && (
                               <div className="flex justify-between"><span>Vence:</span> <span>{order.creditoVenceAnticipo || '-'}</span></div>
                             )}
                             {order.notaAnticipo && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaAnticipo}</div>}
                        </div>
                    </div>
                    
                    {/* Retención */}
                    <div className="bg-white border border-blue-200 rounded p-4 shadow-sm flex flex-col justify-center items-center">
                        <span className="text-blue-800 font-bold text-sm mb-1">Retención</span>
                        <span className="text-2xl font-bold text-slate-800">{Number(order.retencion || 0).toFixed(2)}</span>
                    </div>

                    {/* Saldo */}
                    <div className="bg-white border border-blue-200 rounded p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2">
                             <span className="text-blue-800 font-bold text-sm">Saldo</span>
                             <span className={`text-lg font-bold ${fin.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>{fin.saldo?.toFixed(2)}</span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                             <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-medium text-slate-900">{order.formaPagoSaldo || '-'}</span></div>
                             {order.formaPagoSaldo === 'Crédito' && (
                               <div className="flex justify-between"><span>Vence:</span> <span>{order.creditoVenceSaldo || '-'}</span></div>
                             )}
                             {order.notaSaldo && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaSaldo}</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Totals Summary */}
            <div className="mb-8 flex justify-end">
                <div className="w-full max-w-sm bg-white border border-slate-300 rounded-sm shadow-sm overflow-hidden">
                    <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                         <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">SubTotal</div>
                         <div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.subtotal)}</div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                         <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">Dscto</div>
                         <div className="px-4 py-2 text-right text-slate-900">0.00</div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                         <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">SubTotal - Dscto</div>
                         <div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.subtotal)}</div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                         <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">IVA (15%)</div>
                         <div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.iva)}</div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-200 bg-blue-50 text-base">
                         <div className="px-4 py-3 text-right font-bold text-blue-900">TOTAL</div>
                         <div className="px-4 py-3 text-right font-bold text-blue-900">{formatCurrency(fin.total)}</div>
                    </div>
                </div>
            </div>

            <hr className="border-gray-200 mb-8" />

            {/* 5. Art/Design */}
            <div className="pb-8 mb-auto">
                <h3 className="font-bold text-slate-700 mb-3">Arte / Diseño</h3>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 min-h-[250px] flex items-center justify-center bg-slate-50 relative group hover:bg-slate-100 transition-colors">
                   {order.imagen ? (
                       <div className="cursor-pointer flex flex-col items-center" onClick={() => setPreviewImage(order.imagen)}>
                          <img 
                            src={order.imagen} 
                            alt="Arte de referencia" 
                            className="max-h-[400px] object-contain shadow-md rounded-sm"
                          />
                          <p className="mt-2 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Clic para ampliar</p>
                       </div>
                   ) : (
                       <div className="flex flex-col items-center text-slate-400">
                           <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
                           <span className="italic">Sin imagen de referencia adjunta</span>
                       </div>
                   )}
                </div>
            </div>

            {/* 6. WORKFLOW ACTION BUTTON */}
            {showWorkflowButton && (
                <div className="mt-8 pt-6 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur py-4 -mx-6 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end">
                     <div className="flex flex-col items-end gap-1">
                        <Button 
                          size="lg"
                          className="bg-green-600 hover:bg-green-700 text-white font-bold text-lg px-8 py-6 shadow-lg transition-all hover:scale-105 flex items-center gap-3"
                          onClick={() => onAdvanceWorkflow(order)}
                        >
                          {workflowConfig.text}
                          <ArrowRightCircle className="h-6 w-6" />
                        </Button>
                        <span className="text-xs text-slate-500 font-medium px-2">
                           {workflowConfig.helper}
                        </span>
                     </div>
                </div>
            )}
            
            {/* 7. ARCHIVE BUTTON (Admin Only) */}
            {canArchive && (
               <div className="mt-8 pt-6 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur py-4 -mx-6 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end">
                  <Button 
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 py-6 shadow-lg transition-all hover:scale-105 flex items-center gap-3"
                    onClick={() => {
                       onArchiveOrder(order);
                    }}
                  >
                    ARCHIVAR Orden
                    <Archive className="h-6 w-6" />
                  </Button>
               </div>
            )}

        </div>

        {/* Full Screen Image Preview Overlay */}
        <AnimatePresence>
            {previewImage && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" 
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewImage(null);
                }}
              >
                <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full transition-colors">
                  <X className="h-8 w-8" />
                </button>
                <img src={previewImage} alt="Referencia Full" className="max-w-full max-h-[95vh] rounded shadow-2xl" />
              </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

export default OrderDetailsModal;
