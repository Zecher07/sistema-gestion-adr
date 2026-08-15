import React, { useRef, useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Printer, CheckCircle, FileText, Image as ImageIcon, CreditCard, DollarSign, Calendar as CalendarIcon, 
  MapPin, Phone, User, Clock, Check, XCircle, ArrowLeft, ArrowRight, FileCheck, Info, Lock, AlertOctagon, Loader2, Search, Edit2, ArrowRightCircle, ArrowLeftCircle, Archive, Ban, Play, CheckCircle2, RotateCcw, Undo2, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';
import { isUserInList } from '@/utils/userMatch';
import ClientExpedienteModal from './ClientExpedienteModal';

const WORKFLOW_VPVC = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];
const WORKFLOW_VC = ['VENTAS', 'CONTABILIDAD', 'FINALIZADA'];

const getPrintDesc = (prod) => {
    const text = prod.descripcion || prod.nombre || '';
    if (text.includes('[Nota:')) {
        return text.split('[Nota:')[0].trim();
    }
    return text.trim();
};

const InlineComprobante = ({ items = [], onClickImage }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="shrink-0 flex flex-wrap gap-2 border-l border-slate-200 pl-4 ml-2 items-center">
            {items.map((img, i) => (
                <div key={i} className="w-12 h-12 border border-slate-300 bg-slate-50 rounded-md overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-all" onClick={() => onClickImage && onClickImage(img.url)} title="Ver comprobante original">
                    <img src={img.url} className="w-full h-full object-cover hover:opacity-80 transition-opacity" alt="Comprobante" />
                </div>
            ))}
        </div>
    );
};

const ProductProductionRow = ({ product, index, order, user, onProductUpdate }) => {
    const { toast } = useToast();
    const isProduction = user?.role === 'Producción' || user?.role === 'Administrador';
    const showFinancials = user?.role !== 'Producción'; 
    const status = product.estado_prod || 'PENDIENTE';
    const [loading, setLoading] = useState(false);
    
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    
    const [usedMaterials, setUsedMaterials] = useState(product.materiales || []);
    const [noMaterials, setNoMaterials] = useState(product.sin_materiales || false);

    const handleSearch = async (val) => {
       setSearchTerm(val);
       if (val.trim().length < 2) { setSuggestions([]); setIsSearching(false); return; }
       setIsSearching(true);
       const { data } = await supabase.from('inventario').select('*').ilike('nombre', `%${val}%`).limit(20);
       setSuggestions(data || []);
    };

    const addMaterial = (mat) => {
       if (usedMaterials.find(m => m.id === mat.id)) return;
       setUsedMaterials([...usedMaterials, { ...mat, cant_usada: 1 }]);
       setSearchTerm('');
       setSuggestions([]);
       setIsSearching(false);
       setNoMaterials(false);
    };

    const updateMaterialQty = (id, qty) => {
       setUsedMaterials(usedMaterials.map(m => m.id === id ? { ...m, cant_usada: qty } : m));
    };

    const removeMaterial = (id) => {
       setUsedMaterials(usedMaterials.filter(m => m.id !== id));
    };

    const handleStart = async () => {
        setLoading(true);
        const updated = { ...product, estado_prod: 'EN_PROCESO' };
        await onProductUpdate(index, updated);
        setLoading(false);
    };

    const handleRevert = async () => {
        if (!window.confirm("¿Revertir este producto a 'En Proceso'? Si se había descontado material del inventario, este se devolverá automáticamente al stock para corregir el error.")) return;

        setLoading(true);
        try {
            if (!product.sin_materiales && product.materiales && product.materiales.length > 0) {
                for (const mat of product.materiales) {
                    const qtyToRestore = Number(mat.cant_usada);
                    if (qtyToRestore > 0) {
                        const { data: currentItem, error: fetchErr } = await supabase.from('inventario').select('cantidad, nombre').eq('id', mat.id).single();
                        if (fetchErr) throw fetchErr;
                        
                        const stockActual = Number(currentItem?.cantidad || 0);
                        const newQty = stockActual + qtyToRestore;
                        
                        const { error: updateErr } = await supabase.from('inventario').update({ cantidad: newQty }).eq('id', mat.id);
                        if (updateErr) throw updateErr;
                        
                        const orderRef = String(order.orderNumber || order.order_number || order.id).padStart(7, '0');
                        await supabase.from('historial_inventario').insert([{
                            material_id: mat.id,
                            material_nombre: mat.nombre,
                            cantidad_cambio: qtyToRestore,
                            cantidad_resultante: newQty,
                            tipo: 'INGRESO',
                            motivo: `Reversión de Producción (Admin) - Orden #${orderRef}`,
                            usuario: user?.name || 'Administrador'
                        }]);
                    }
                }
            }

            const updated = { ...product, estado_prod: 'EN_PROCESO' };
            await onProductUpdate(index, updated);
            toast({ title: "Producto Revertido", description: "El producto ha vuelto a En Proceso y el inventario ha sido restaurado." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Hubo un problema al revertir el inventario.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleFinish = async () => {
        if (!noMaterials && usedMaterials.length === 0) {
            toast({ title: "Faltan Materiales", description: "Debe agregar materiales de inventario o marcar 'No usar inventario'.", variant: "destructive" });
            return;
        }

        if (!noMaterials) {
             const invalidQty = usedMaterials.some(m => !m.cant_usada || Number(m.cant_usada) <= 0);
             if (invalidQty) {
                 toast({ title: "Cantidades Inválidas", description: "Verifique las cantidades de los materiales.", variant: "destructive" });
                 return;
             }
        }

        setLoading(true);
        
        try {
            if (!noMaterials && usedMaterials.length > 0) {
                const stockUpdates = [];
                for (const mat of usedMaterials) {
                    const qtyToDeduct = Number(mat.cant_usada);
                    if (qtyToDeduct > 0) {
                        const { data: currentItem, error: fetchErr } = await supabase.from('inventario').select('cantidad, nombre').eq('id', mat.id).single();
                        if (fetchErr) throw fetchErr;
                        
                        const stockActual = Number(currentItem?.cantidad || 0);
                        
                        if (stockActual < qtyToDeduct) {
                            toast({ 
                                title: "Stock Insuficiente", 
                                description: `No hay suficiente "${mat.nombre}". Disponible: ${stockActual}, Requerido: ${qtyToDeduct}.`, 
                                variant: "destructive" 
                            });
                            setLoading(false);
                            return; 
                        }
                        
                        stockUpdates.push({ 
                            id: mat.id, 
                            nombre: mat.nombre, 
                            newQty: stockActual - qtyToDeduct, 
                            qtyDeducted: qtyToDeduct 
                        });
                    }
                }

                for (const update of stockUpdates) {
                    const { error: updateErr } = await supabase.from('inventario').update({ cantidad: update.newQty }).eq('id', update.id);
                    if (updateErr) throw updateErr;
                    
                    const orderRef = String(order.orderNumber || order.order_number || order.id).padStart(7, '0');
                    const { error: histErr } = await supabase.from('historial_inventario').insert([{
                        material_id: update.id,
                        material_nombre: update.nombre,
                        cantidad_cambio: -update.qtyDeducted,
                        cantidad_resultante: update.newQty,
                        tipo: 'EGRESO',
                        motivo: `Consumo en Producción - Orden #${orderRef}`,
                        usuario: user?.name || 'Sistema'
                    }]);
                    
                    if (histErr) {
                        console.error("Error guardando historial (pero se descontó el stock correctamente):", histErr);
                    }
                }
            }

            const updated = { ...product, estado_prod: 'FINALIZADO', materiales: usedMaterials, sin_materiales: noMaterials };
            await onProductUpdate(index, updated);
            toast({ title: "Producto Finalizado", description: "Se ha registrado la producción y descontado el inventario." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error de Guardado", description: error.message || "Ocurrió un problema al finalizar el producto.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

    return (
        <tr className="hover:bg-slate-50 border-b border-slate-200">
             <td className="px-4 py-4 text-center text-slate-500 font-medium align-top">{index + 1}</td>
             <td className="px-4 py-4 font-bold text-slate-900 uppercase align-top whitespace-pre-wrap">{product.descripcion || product.nombre}</td>
             {showFinancials && <td className="px-4 py-4 text-right text-slate-600 align-top">{formatCurrency(product.precio || product.precioUnitario)}</td>}
             <td className="px-4 py-4 text-center text-slate-600 font-bold align-top">{product.cantidad}</td>
             {showFinancials && <td className="px-4 py-4 text-right font-bold text-slate-900 align-top">{formatCurrency(product.total || ((product.precio || product.precioUnitario) * product.cantidad))}</td>}
             
             <td className="px-4 py-3 align-top min-w-[280px] bg-slate-50/50 border-l border-slate-200">
                  {status === 'PENDIENTE' && (
                       isProduction ? (
                           <Button size="sm" onClick={handleStart} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white w-full shadow-sm">
                               {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 mr-2"/>} Comenzar Producción
                           </Button>
                       ) : (
                           <span className="text-slate-500 font-bold text-xs uppercase bg-slate-200 px-3 py-1 rounded-full shadow-inner inline-flex items-center gap-1">Pendiente</span>
                       )
                  )}

                  {status === 'EN_PROCESO' && (
                       <div className="space-y-3 bg-blue-50/80 p-3 rounded-lg border border-blue-200 shadow-sm animate-in fade-in zoom-in-95">
                           <div className="text-xs font-black text-blue-800 uppercase tracking-wider flex items-center gap-2 mb-2">
                               <Loader2 className="w-4 h-4 animate-spin text-blue-600"/> En Proceso
                           </div>
                           {isProduction ? (
                               <div className="space-y-3">
                                   <div className="relative">
                                       <Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400"/>
                                       <input 
                                          type="text" placeholder="Buscar material usado..." 
                                          className="w-full text-xs pl-8 pr-2 py-1.5 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-inner bg-white"
                                          value={searchTerm} onChange={e => handleSearch(e.target.value)} disabled={noMaterials}
                                       />
                                       {suggestions.length > 0 && (
                                           <div className="absolute z-20 w-full bg-white border border-slate-300 shadow-xl max-h-[300px] overflow-y-auto mt-1 rounded-md text-xs">
                                               {suggestions.map(s => {
                                                   const isOutOfStock = Number(s.cantidad) <= 0;
                                                   return (
                                                       <div 
                                                           key={s.id} 
                                                           className={`p-2 border-b border-slate-100 flex justify-between items-center transition-colors ${isOutOfStock ? 'opacity-70 cursor-not-allowed bg-red-50' : 'hover:bg-blue-50 cursor-pointer'}`} 
                                                           onClick={() => {
                                                               if (isOutOfStock) {
                                                                   toast({ title: "Sin Stock", description: "No puedes seleccionar un material sin inventario.", variant: "destructive" });
                                                                   return;
                                                               }
                                                               addMaterial(s);
                                                           }}
                                                       >
                                                           <span className={`font-bold ${isOutOfStock ? 'text-red-700 line-through' : 'text-slate-700'}`}>{s.nombre}</span>
                                                           <span className={`text-[10px] font-mono px-1 rounded border ${isOutOfStock ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                               Stock: {s.cantidad} {s.unidad}
                                                           </span>
                                                       </div>
                                                   );
                                               })}
                                           </div>
                                       )}
                                   </div>

                                   {usedMaterials.length > 0 && (
                                       <div className="space-y-2 bg-white p-2 rounded border border-blue-100 shadow-inner max-h-[250px] overflow-y-auto">
                                           {usedMaterials.map(m => (
                                               <div key={m.id} className="flex items-center gap-2 text-xs">
                                                   <span className="flex-1 truncate font-medium text-slate-700" title={m.nombre}>{m.nombre}</span>
                                                   <input type="number" min="0.01" step="0.01" className="w-16 border border-slate-300 rounded px-1 py-1 outline-none focus:border-blue-500 font-mono text-center bg-slate-50" value={m.cant_usada} onChange={e => updateMaterialQty(m.id, e.target.value)} />
                                                   <span className="text-[10px] text-slate-500 w-10 truncate">{m.unidad}</span>
                                                   <button onClick={() => removeMaterial(m.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1 rounded transition-colors"><X className="w-3 h-3"/></button>
                                               </div>
                                           ))}
                                       </div>
                                   )}

                                   <label className="flex items-center gap-2 text-xs cursor-pointer select-none bg-white border border-slate-200 p-2 rounded hover:bg-slate-50 transition-colors">
                                       <input type="checkbox" checked={noMaterials} onChange={e => { setNoMaterials(e.target.checked); if(e.target.checked) setUsedMaterials([]); }} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"/>
                                       <span className="text-slate-700 font-medium">No utiliza inventario</span>
                                   </label>

                                   <Button size="sm" onClick={handleFinish} disabled={loading || (!noMaterials && usedMaterials.length === 0)} className="w-full bg-green-600 hover:bg-green-700 text-white shadow font-bold">
                                       {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <CheckCircle2 className="w-4 h-4 mr-2"/>} Finalizar Producto
                                   </Button>
                               </div>
                           ) : (<span className="text-xs text-blue-600 font-medium italic">El taller está trabajando en esto...</span>)}
                       </div>
                  )}

                  {status === 'FINALIZADO' && (
                       <div className="bg-green-50/80 p-3 rounded-lg border border-green-200 shadow-sm animate-in fade-in">
                           <div className="flex justify-between items-start mb-2">
                               <div className="text-xs font-black text-green-700 uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Finalizado</div>
                               
                               {user?.role === 'Administrador' && (
                                   <Button 
                                       size="sm" 
                                       variant="outline" 
                                       onClick={handleRevert} 
                                       disabled={loading} 
                                       className="h-6 text-[10px] px-2 py-0 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors"
                                       title="Deshacer finalización y devolver materiales al inventario"
                                   >
                                       {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : <RotateCcw className="w-3 h-3 mr-1"/>} Revertir
                                   </Button>
                               )}
                           </div>
                           
                           <div className="bg-white rounded border border-green-100 p-2">
                               {product.sin_materiales ? (
                                   <div className="text-[10px] text-slate-500 italic flex items-center gap-1"><Ban className="w-3 h-3"/> No se usó inventario</div>
                               ) : (
                                   <div className="text-[10px] space-y-1">
                                       <div className="font-bold text-slate-400 mb-1 uppercase tracking-wider border-b pb-1">Materiales Consumidos</div>
                                       {(product.materiales || []).map(m => (
                                           <div key={m.id} className="flex justify-between items-center text-slate-600"><span className="truncate pr-2">• {m.nombre}</span><span className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1 rounded">{m.cant_usada} <span className="text-[9px] font-normal">{m.unidad}</span></span></div>
                                       ))}
                                   </div>
                               )}
                           </div>
                       </div>
                  )}
             </td>
        </tr>
    );
};

const OrderDetailsModal = ({ order, user, staffUsers = [], clients = [], orders = [], onEditClient, onSwitchOrder, onOpenClientProfileNewTab, onClose, onProductToggle, isTaskView, onAdvanceWorkflow, onRegressWorkflow, onArchiveOrder, onUpdateOrder, onGenerateInvoice, canEdit, onAbonoOrder }) => {
  const [previewImage, setPreviewImage] = useState(null);
  // 🔧 NUEVO: popup del expediente del cliente (historial + editar), sin salir de la orden
  const [showClientExpediente, setShowClientExpediente] = useState(false);
  const { toast } = useToast();
  const [localProducts, setLocalProducts] = useState([]);
  const [localVendedor, setLocalVendedor] = useState('');
  
  const [localImages, setLocalImages] = useState([]); 
  const [loadingImages, setLoadingImages] = useState(false); 
  const [isAdvancing, setIsAdvancing] = useState(false);

  const [comprobantesData, setComprobantesData] = useState({ anticipo: [], saldo: [], abonos: {}, retencion: [], verificacion_anticipo: [], verificacion_abonos: {} });
  const [loadingComprobantes, setLoadingComprobantes] = useState(false);
  
  const printRef = useRef();

  const showFinancials = user?.role !== 'Producción'; 
  const isAdmin = user?.role === 'Administrador';
  const isVendedor = user?.role === 'Vendedor';
  const isProduccion = user?.role === 'Producción';
  const isContabilidad = user?.role === 'Contabilidad';
  
  const canEditProductionStatus = isAdmin || isProduccion;
  const isCancelled = order?.status === 'ANULADA';
  const isArchived = order?.status === 'ARCHIVADA';

  const canActuallyEdit = canEdit || isAdmin || (isContabilidad && order?.status === 'CONTABILIDAD');

  useEffect(() => {
    if (order) {
      setLocalProducts(order.productos || []);
      setLocalVendedor(order.vendedor || '');
      setIsAdvancing(false); 
      setPreviewImage(null);
      document.body.style.overflow = 'hidden';

      const fetchImages = async () => {
          setLoadingImages(true);
          try {
              const { data } = await supabase.from('ordenes').select('imagenes').eq('id', order.id).single();
              if (data && Array.isArray(data.imagenes) && data.imagenes.length > 0) setLocalImages(data.imagenes);
              else setLocalImages([]);
          } catch (err) { setLocalImages([]); } 
          finally { setLoadingImages(false); }
      };

      const fetchComprobantes = async () => {
          if (!showFinancials) return;
          setLoadingComprobantes(true);
          try {
              const { data } = await supabase.from('ordenes').select('comprobantes').eq('id', order.id).single();
              if (data && data.comprobantes) {
                  if (Array.isArray(data.comprobantes)) {
                      setComprobantesData({ anticipo: data.comprobantes, saldo: [], abonos: {}, retencion: [], verificacion_anticipo: [], verificacion_abonos: {} });
                  } else {
                      setComprobantesData({
                          anticipo: data.comprobantes.anticipo || [],
                          saldo: data.comprobantes.saldo || [],
                          abonos: data.comprobantes.abonos || {},
                          retencion: data.comprobantes.retencion || [],
                          verificacion_anticipo: data.comprobantes.verificacion_anticipo || [],
                          verificacion_abonos: data.comprobantes.verificacion_abonos || {}
                      });
                  }
              } else {
                  setComprobantesData({ anticipo: [], saldo: [], abonos: {}, retencion: [], verificacion_anticipo: [], verificacion_abonos: {} });
              }
          } catch (err) { setComprobantesData({ anticipo: [], saldo: [], abonos: {}, retencion: [], verificacion_anticipo: [], verificacion_abonos: {} }); } 
          finally { setLoadingComprobantes(false); }
      };

      fetchImages(); 
      fetchComprobantes();
    }
    
    return () => { document.body.style.overflow = 'unset'; };
  }, [order, showFinancials]);

  const validSellers = useMemo(() => removeDuplicateUsers(getValidSellers(staffUsers)), [staffUsers]);
  const allProductsFinished = useMemo(() => {
      if (!localProducts || localProducts.length === 0) return true;
      return localProducts.every(p => p.estado_prod === 'FINALIZADO');
  }, [localProducts]);

  const rawFinancials = order?.financials || {};
  let parsedFinancials = rawFinancials;
  if (typeof rawFinancials === 'string') {
      try { parsedFinancials = JSON.parse(rawFinancials); } catch (e) { parsedFinancials = {}; }
  }

  const fin = {
      subtotal: Number(parsedFinancials.subtotal || 0),
      baseImponible: Number(parsedFinancials.baseImponible || parsedFinancials.subtotal || 0),
      iva: Number(parsedFinancials.iva || 0),
      total: Number(parsedFinancials.total || order?.financials?.total || 0),
      descuentoVal: Number(parsedFinancials.descuentoMonto || parsedFinancials.descuentoVal || parsedFinancials.descuento || 0),
      ivaPercentage: Number(parsedFinancials.ivaPercentage || 15),
      preciosIncluyenIva: parsedFinancials.preciosIncluyenIva
  };

  const nroFacturaDisplay = order?.nro_factura || order?.numero_factura || parsedFinancials.nroFactura || order?.numeroFactura || order?.facturaNumber || order?.invoiceNumber || 'PENDIENTE';

  const anticipoVal = Number(order?.anticipo || 0);
  const retencion = Number(order?.retencion || parsedFinancials.retencion || 0);
  
  const abonosArray = Array.isArray(order?.abonos) ? order.abonos : [];
  const totalAbonos = abonosArray.reduce((acc, a) => acc + Number(a.monto), 0);
  
  const saldoCalculado = Math.max(fin.total - anticipoVal - retencion - totalAbonos, 0);

  const pSaldo = String(order?.formaPagoSaldo || parsedFinancials.formaPagoSaldo || '').toLowerCase();
  const pAnticipo = String(order?.formaPagoAnticipo || order?.forma_pago_anticipo || '').toLowerCase();
  
  const isCredito = pSaldo.includes('crédit') || pSaldo.includes('credit') || 
                    pAnticipo.includes('crédit') || pAnticipo.includes('credit');

  const isVCStatus = order?.tipoOrden && order.tipoOrden.includes('(VC)');
  const isGoingToContabilidad = order?.status === 'VENTAS POR RETIRAR' || (order?.status === 'VENTAS' && isVCStatus);

  const lockToContabilidad = isGoingToContabilidad && !isCredito && saldoCalculado > 0 && !isAdmin;

  const historialCredito = parsedFinancials.historialFechasCredito || [];

  const canAdvance = useMemo(() => {
      if (!order) return false;
      if (isAdmin) return true;
      switch (order.status) {
          case 'VENTAS': return user?.role === 'Vendedor';
          case 'PRODUCCION': return user?.role === 'Producción';
          case 'VENTAS POR RETIRAR': return user?.role === 'Vendedor' || user?.role === 'Contabilidad';
          case 'CONTABILIDAD': return user?.role === 'Contabilidad';
          default: return false;
      }
  }, [order, user, isAdmin]);

  if (!order) return null; 

  const handlePrint = () => { 
      setTimeout(() => { window.print(); }, 100); 
  };

  // 🔧 REFACTOR: el <select> ahora envía el ID del vendedor (estable), no el nombre.
  // Guardamos AMBOS: 'vendedor' (nombre, para mostrar/imprimir) y 'vendedor_ids' (para
  // que los filtros de "mis órdenes" sigan funcionando aunque luego cambien el nombre.
  const handleResponsableChange = async (e) => {
    const nuevoVendedorId = e.target.value;
    const seller = validSellers.find(u => u.id === nuevoVendedorId);
    const nuevoVendedorNombre = seller ? seller.name : '';
    setLocalVendedor(nuevoVendedorNombre);
    try {
        const { error } = await supabase.from('ordenes').update({
            vendedor: nuevoVendedorNombre,
            vendedor_ids: seller ? [seller.id] : [],
        }).eq('id', order.id);
        if (error) throw error;
        toast({ title: "Responsable Actualizado" });
    } catch (err) {
        setLocalVendedor(order.vendedor); 
        toast({ title: "Error al actualizar", variant: "destructive" });
    }
  };

  const handleProductUpdateLocal = async (idx, updatedProduct) => {
      const newProducts = [...localProducts];
      newProducts[idx] = updatedProduct;
      setLocalProducts(newProducts);
      try {
          const { error } = await supabase.from('ordenes').update({ productos: newProducts }).eq('id', order.id);
          if (error) throw error;
      } catch (err) {
          toast({ title: "Error", description: "No se guardó el estado de producción.", variant: "destructive" });
          setLocalProducts(order.productos || []); 
      }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  // 🔧 AJUSTE: después de migrar la columna fecha_entrega de "solo fecha" a
  // "fecha y hora" en la base de datos, todas las órdenes viejas quedaron con
  // 00:00 (medianoche) como hora — porque nunca tuvieron una hora real y Postgres
  // rellena con medianoche por defecto al convertir el tipo. Como nadie entrega
  // pedidos a medianoche, tratamos 00:00 como "sin hora real" y mostramos 08:00
  // en su lugar (hora de apertura típica), en vez de una medianoche confusa.
  const formatDateFull = (dateString) => {
    if (!dateString) return '';
    try {
      const str = String(dateString);
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(str);
      const d = new Date(isDateOnly ? `${str}T12:00:00` : str);
      if (isNaN(d.getTime())) return '';
      const fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (isDateOnly) return fecha; // no había hora real que mostrar
      const horas = d.getHours();
      const minutos = d.getMinutes();
      if (horas === 0 && minutos === 0) return `${fecha} 08:00`; // medianoche = sin hora real registrada
      return `${fecha} ${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
    } catch (e) { return ''; }
  };

  // Se mantiene por si algún otro lugar del código todavía la usa para forzar "solo fecha".
  const formatDateOnly = (dateString) => {
    if (!dateString) return '';
    try {
      const soloFecha = String(dateString).split('T')[0];
      const d = new Date(`${soloFecha}T12:00:00`);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch (e) { return ''; }
  };

  const calculateDaysDiff = (dateString) => {
    if (!dateString) return '';
    const diffDays = Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24)); 
    if (isNaN(diffDays)) return '';
    return diffDays > 0 ? `(+${diffDays} días)` : `(${diffDays} días)`;
  };

  const formatOrderId = (id) => (order.orderNumber || order.order_number || id).toString().padStart(7, '0');
  
  const isFinalizada = order.status === 'FINALIZADA';
  const canArchive = isAdmin && isFinalizada;
  
  const getWorkflowButtonConfig = () => {
     const isVC = order.tipoOrden && order.tipoOrden.includes('(VC)');
     const workflow = isVC ? WORKFLOW_VC : WORKFLOW_VPVC;
     const currentIndex = workflow.indexOf(order.status);
     
     const prevStatus = currentIndex > 0 ? workflow[currentIndex - 1] : null;
     
     if (currentIndex === -1 || currentIndex >= workflow.length - 1) return { text: 'Continuar flujo', helper: '', prevStatus };

     const nextStatus = workflow[currentIndex + 1];
     let text = `Pasar a ${nextStatus}`;

     switch (order.status) {
         case 'VENTAS': text = nextStatus === 'PRODUCCION' ? "Pasar a Producción" : "Pasar a Contabilidad"; break;
         case 'PRODUCCION': text = `Pasar a Por Retirar – ${localVendedor || 'Sin asignar'}`; break;
         case 'VENTAS POR RETIRAR': if (nextStatus === 'CONTABILIDAD') text = "Pasar a Contabilidad"; break;
         case 'CONTABILIDAD': if (nextStatus === 'FINALIZADA') text = "Finalizar orden"; break;
         default: break;
     }
     return { text, helper: `Siguiente paso: ${nextStatus}`, nextStatus, prevStatus };
  };
  
  const workflowConfig = getWorkflowButtonConfig();
  const showWorkflowButton = !isCancelled && !isArchived && (workflowConfig.nextStatus || (isAdmin && workflowConfig.prevStatus));

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'VENTAS': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'PRODUCCION': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'VENTAS POR RETIRAR': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'CONTABILIDAD': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'FINALIZADA': return 'bg-green-100 text-green-800 border-green-300';
      case 'ENTREGADO': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'ANULADA': return 'bg-red-100 text-red-800 border-red-300';
      case 'ARCHIVADA': return 'bg-slate-200 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const observacionesPublicas = parsedFinancials.observaciones || order.observaciones || '';

  return (
    <>
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto animate-in fade-in duration-200 flex flex-col print:hidden">
            {isCancelled && (
              <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <div className="text-red-500/10 font-bold text-[15vw] rotate-[-30deg] border-[12px] border-red-500/10 px-20 py-10 uppercase whitespace-nowrap select-none">
                  ANULADA
                </div>
              </div>
            )}

            <div className="bg-[#1e3a8a] text-white px-6 py-2 flex justify-between items-center text-xs shrink-0 relative z-10">
                <span className="font-bold">Detalles de Orden</span>
                <div className="flex items-center gap-2 opacity-80"><span>Home</span><span>{'>'}</span><span>{isTaskView ? 'Tareas' : 'Ordenes'}</span><span>{'>'}</span><span>Detalles</span></div>
            </div>

            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 relative z-10 sticky top-0 shadow-sm">
                <div className="flex items-center gap-4 text-blue-600 whitespace-nowrap overflow-x-auto max-w-full">
                    <span className="cursor-not-allowed opacity-50 flex items-center gap-1 font-mono text-sm">{'< - '} 0000000</span>
                    <span className="font-bold text-slate-900 text-2xl mx-2">Orden: <span className="font-mono">{formatOrderId(order.id)}</span></span>
                    <span className="cursor-not-allowed opacity-50 flex items-center gap-1 font-mono text-sm">0000000 {' - >'}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {canActuallyEdit && <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-2" onClick={() => onUpdateOrder && onUpdateOrder()}><Edit2 className="h-4 w-4" /> Editar Orden</Button>}
                    
                    <Button size="sm" variant="ghost" className="text-amber-700 hover:bg-amber-100 bg-amber-50 gap-2 font-bold border border-amber-200" onClick={handlePrint}>
                        <Printer className="h-4 w-4" /> Imprimir Orden
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2 ml-1" onClick={onClose}><X className="h-4 w-4" /> Cerrar</Button>
                </div>
            </div>

            <div className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full relative z-0 flex flex-col">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-8">
                    <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-[140px_1fr] gap-2"><span className="font-bold text-right text-slate-600">Titulo:</span><span className="uppercase font-medium text-slate-900">{order.tipoLetrero || order.tipo_trabajo}</span></div>
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                            <span className="font-bold text-right text-slate-600">Autor:</span>
                            {isAdmin ? (<div className="flex items-center gap-2"><select className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={validSellers.find(u => u.name === localVendedor)?.id || ''} onChange={handleResponsableChange}><option value="">Seleccionar...</option>{validSellers.map(u => (<option key={u.id} value={u.id}>{formatResponsableName(u)}</option>))}</select><Edit2 className="h-3 w-3 text-slate-400" /></div>) : (<span className="text-slate-900">{localVendedor || 'Sistema'}</span>)}
                        </div>
                        <div className="grid grid-cols-[140px_1fr] gap-2"><span className="font-bold text-right text-slate-600">Fecha:</span><span className="text-slate-900">{formatDateFull(order.createdAt || order.created_at)}</span></div>
                        <div className="grid grid-cols-[140px_1fr] gap-2"><span className="font-bold text-right text-slate-600">Fecha entrega:</span><span className="text-red-600 font-bold">{formatDateFull(order.fechaEntrega || order.fecha_entrega)} <span className="text-xs ml-1 font-normal text-red-500">{calculateDaysDiff(order.fechaEntrega || order.fecha_entrega)}</span></span></div>
                         <div className="grid grid-cols-[140px_1fr] gap-2"><span className="font-bold text-right text-slate-600">Fecha Finaliz:</span><span className="text-slate-900">{isFinalizada ? formatDateFull(order.updatedAt || order.updated_at) : ''}</span></div>
                        
                        <div className="grid grid-cols-[140px_1fr] gap-2 mt-4">
                            <span className="font-bold text-right text-slate-600">Cliente:</span>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    {/* 🔧 NUEVO: es un <a> real con href (no solo un botón con onClick) para
                                        que el clic derecho del navegador -> "Abrir en pestaña nueva" funcione.
                                        El clic normal sigue abriendo el popup local, como siempre. */}
                                    <a
                                        href={`#cliente=${order.clienteId || order.cliente_id || ''}`}
                                        onClick={(e) => { e.preventDefault(); setShowClientExpediente(true); }}
                                        className="text-blue-600 font-bold uppercase tracking-wide hover:text-blue-800 hover:underline text-left transition-colors cursor-pointer"
                                        title="Clic para ver el historial de órdenes y editar los datos de este cliente (clic derecho para pestaña nueva)"
                                    >
                                        {order.cliente || order.cliente_nombre}
                                    </a>
                                    {/* Icono aparte, por si prefieren un botón explícito para pestaña nueva */}
                                    {onOpenClientProfileNewTab && (
                                        <button
                                            onClick={() => onOpenClientProfileNewTab(order.clienteId || order.cliente_id)}
                                            className="text-slate-400 hover:text-blue-600 transition-colors"
                                            title="Abrir ficha del cliente en una pestaña nueva"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                                {(order.ruc || order.cedula || order.cliente_identificacion) && (<span className="text-xs text-slate-500 font-mono mt-0.5">ID/RUC: {order.ruc || order.cedula || order.cliente_identificacion}</span>)}
                            </div>
                        </div>

                        <div className="grid grid-cols-[140px_1fr] gap-2 mt-1">
                            <span className="font-bold text-right text-slate-600">N° Factura:</span>
                            <div className="flex items-center">
                                {nroFacturaDisplay !== 'PENDIENTE' ? (
                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 shadow-sm">
                                        <FileText className="h-3 w-3" /> {nroFacturaDisplay}
                                    </span>
                                ) : (
                                    <span className="text-xs font-medium text-slate-400 italic flex items-center gap-1">
                                        No asignada
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {(order.origenProformaInfo || order.origenProformaId) && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 mt-1">
                                <span className="font-bold text-right text-slate-600">Origen:</span>
                                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 self-start">Proforma #{order.origenProformaInfo || order.origenProformaId}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mt-1 mb-4">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${getOrderStatusColor(order.status)}`}>
                                {order.status}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <span className="font-bold text-slate-600 text-sm">Observaciones:</span>
                            <div className="border border-green-200 rounded-md p-3 min-h-[60px] bg-white text-sm text-slate-700 w-full shadow-sm whitespace-pre-wrap">{observacionesPublicas || <span className="text-slate-400 italic font-normal">Ninguna observación registrada.</span>}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="font-bold text-slate-600 text-sm">Motivo Anulada:</span>
                            <div className="border border-red-200 rounded-md p-3 min-h-[40px] bg-white text-sm text-red-600 font-medium w-full shadow-sm">{isCancelled ? (order.motivoAnulacion || "Orden Anulada") : <span className="text-slate-400 italic font-normal">-</span>}</div>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                     <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">Desglose de Producción<span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">{order.tipoOrden || 'VPVC'}</span></h3>
                     <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-[#1e293b] text-white">
                                <tr>
                                    <th className="px-4 py-3 text-center font-bold w-12">#</th>
                                    <th className="px-4 py-3 text-left font-bold">Item a Producir</th>
                                    {showFinancials && <th className="px-4 py-3 text-right font-bold w-24">Unitario</th>}
                                    <th className="px-4 py-3 text-center font-bold w-16">Cant.</th>
                                    {showFinancials && <th className="px-4 py-3 text-right font-bold w-24">Total</th>}
                                    <th className="px-4 py-3 text-left font-bold w-[300px]">Estado / Inventario</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {localProducts.map((prod, idx) => (
                                    <ProductProductionRow key={idx} product={prod} index={idx} order={order} user={user} onProductUpdate={handleProductUpdateLocal} />
                                ))}
                                {(!localProducts || localProducts.length === 0) && (<tr><td colSpan={showFinancials ? "6" : "4"} className="px-4 py-8 text-center text-slate-400 italic">No hay productos registrados</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>

                {showFinancials && (
                    <div className="mb-6 flex justify-end">
                        <div className="w-full max-w-sm bg-white border border-slate-300 rounded-sm shadow-sm overflow-hidden">
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                                <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">SubTotal</div>
                                <div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.subtotal)}</div>
                            </div>
                            {Number(fin.descuentoVal) > 0 && (
                                <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                                    <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">Dscto Total</div>
                                    <div className="px-4 py-2 text-right text-red-500">-{formatCurrency(fin.descuentoVal)}</div>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                                <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">Base Imponible</div>
                                <div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.baseImponible)}</div>
                            </div>
                            
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                                <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">
                                    IVA ({parseFloat(Number(fin.ivaPercentage || 15).toFixed(2))}%)
                                    {fin.preciosIncluyenIva && <span className="block text-[9px] font-normal text-slate-400 leading-tight mt-0.5">Extraído del precio final</span>}
                                </div>
                                <div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.iva)}</div>
                            </div>
                            
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-slate-100 text-base">
                                <div className="px-4 py-2 text-right font-bold text-slate-800">TOTAL FACTURA</div>
                                <div className="px-4 py-2 text-right font-bold text-slate-800">{formatCurrency(fin.total)}</div>
                            </div>
                            
                            {retencion > 0 && (
                                <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-orange-50 text-sm">
                                    <div className="px-4 py-2 text-right font-bold text-orange-800">Retención ({parseFloat(Number(parsedFinancials.retentionPercent || 0).toFixed(2))}%)</div>
                                    <div className="px-4 py-2 text-right font-bold text-orange-800">-{formatCurrency(retencion)}</div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 divide-x divide-slate-200 bg-blue-50 text-base">
                                <div className="px-4 py-3 text-right font-bold text-blue-900">TOTAL A PAGAR</div>
                                <div className="px-4 py-3 text-right font-bold text-blue-900">{formatCurrency(fin.total - retencion)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {showFinancials && (
                    <div className="mb-6 bg-slate-50/50 p-4 border border-slate-200 rounded-lg">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
                            <h3 className="font-bold text-slate-700">Pagos y Comprobantes</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            <div className="flex flex-col gap-2">
                                <div className="bg-white border border-blue-200 rounded p-4 shadow-sm flex items-center justify-between gap-4">
                                    <div className="flex-1 w-full">
                                        <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2">
                                            <span className="text-blue-800 font-bold text-sm">Anticipo Original</span>
                                            <span className="text-lg font-bold text-slate-800">{Number(order.anticipo || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="space-y-1 text-xs text-slate-600">
                                             <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-medium text-slate-900">{order.formaPagoAnticipo || order.forma_pago_anticipo || '-'}</span></div>
                                             {(pAnticipo.includes('crédit') || pAnticipo.includes('credit')) && (
                                                <div className="flex justify-between items-center border-t border-slate-100 pt-1 mt-1">
                                                    <span>Vence el:</span> 
                                                    <div className="text-right">
                                                        <span className="font-bold text-orange-600">{order.creditoVenceAnticipo || order.credito_vence_anticipo || '-'}</span>
                                                        {historialCredito.filter(h => h.tipo === 'Anticipo').length > 0 && (
                                                            <div className="text-[9px] text-red-600 font-medium bg-red-50 border border-red-100 px-1 rounded mt-0.5" title="Muestra las fechas pasadas que no se cumplieron">
                                                                {historialCredito.filter(h => h.tipo === 'Anticipo').length} prórroga(s) registradas
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                             )}
                                             {(order.notaAnticipo || order.nota_anticipo) && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaAnticipo || order.nota_anticipo}</div>}
                                        </div>
                                    </div>
                                    <InlineComprobante items={comprobantesData.anticipo || []} onClickImage={setPreviewImage} />
                                </div>
                                
                                {comprobantesData.verificacion_anticipo?.length > 0 && (
                                    <div className="bg-emerald-50/80 border border-emerald-300 rounded p-3 shadow-sm flex items-center justify-between gap-4 md:ml-12 ml-6 border-l-4 border-l-emerald-500">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                            <div>
                                                <span className="text-emerald-800 font-bold text-xs uppercase block">Verificación de Banco</span>
                                                <span className="text-emerald-600 text-[10px]">Aprobado por Contabilidad</span>
                                            </div>
                                        </div>
                                        <InlineComprobante items={comprobantesData.verificacion_anticipo} onClickImage={setPreviewImage} />
                                    </div>
                                )}
                            </div>
                            
                            <div className="bg-white border border-blue-200 rounded p-4 shadow-sm flex items-center justify-between gap-4">
                                <div className="flex-1 w-full">
                                    <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2">
                                        <span className="text-blue-800 font-bold text-sm">Saldo Pendiente (Real)</span>
                                        <span className={`text-lg font-bold ${saldoCalculado > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(saldoCalculado)}</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600 mb-2">
                                         <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-bold text-slate-900 uppercase">{order.formaPagoSaldo || parsedFinancials.formaPagoSaldo || '-'}</span></div>
                                         {(pSaldo.includes('crédit') || pSaldo.includes('credit')) && (
                                            <div className="flex justify-between items-center border-t border-slate-100 pt-1 mt-1">
                                                <span>Vence el:</span> 
                                                <div className="text-right">
                                                    <span className="font-bold text-orange-600">{order.creditoVenceSaldo || parsedFinancials.creditoVenceSaldo || '-'}</span>
                                                    {historialCredito.filter(h => h.tipo === 'Saldo').length > 0 && (
                                                        <div className="text-[9px] text-red-600 font-medium bg-red-50 border border-red-100 px-1 rounded mt-0.5" title="Muestra las fechas pasadas que no se cumplieron">
                                                            {historialCredito.filter(h => h.tipo === 'Saldo').length} prórroga(s) registradas
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                         )}
                                         {(order.notaSaldo || parsedFinancials.notaSaldo) && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaSaldo || parsedFinancials.notaSaldo}</div>}
                                    </div>
                                </div>
                            </div>

                            {retencion > 0 && comprobantesData.retencion && comprobantesData.retencion.length > 0 && (
                                <div className="bg-white border border-orange-300 rounded p-4 shadow-sm flex items-center justify-between gap-4">
                                    <div className="flex-1 w-full">
                                        <div className="flex justify-between items-center mb-2 border-b border-orange-100 pb-2">
                                            <span className="text-orange-800 font-bold text-sm">Retención Registrada</span>
                                            <span className="text-lg font-bold text-orange-800">{formatCurrency(retencion)}</span>
                                        </div>
                                        <p className="text-[10px] text-orange-600 font-medium">Documento subido por Contabilidad</p>
                                    </div>
                                    <InlineComprobante items={comprobantesData.retencion} onClickImage={setPreviewImage} />
                                </div>
                            )}

                        </div>

                        {order.abonos && order.abonos.length > 0 && (
                            <div className="mt-6 border-t border-slate-300 pt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <h4 className="font-bold text-red-700 text-xs mb-3 uppercase border-b border-red-200 pb-1">Abonos y Devoluciones Extras</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {order.abonos.map((a, i) => {
                                        const isDevolucion = a.monto < 0;
                                        return (
                                            <div key={i} className="flex flex-col gap-2">
                                                <div className={`border rounded p-4 shadow-sm flex items-center justify-between gap-4 ${isDevolucion ? 'bg-orange-50 border-orange-300' : 'bg-red-50/50 border-red-200'}`}>
                                                    <div className="flex-1 w-full">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div>
                                                                <div className="text-[10px] text-slate-500 font-bold">{a.fecha ? a.fecha.split('T')[0] : ''}</div>
                                                                <div className={`text-xs font-bold uppercase ${isDevolucion ? 'text-orange-700' : 'text-red-700'}`}>{a.metodoPago || a.metodo_pago}</div>
                                                            </div>
                                                            <div className={`font-black text-lg ${isDevolucion ? 'text-orange-600' : 'text-red-600'}`}>
                                                                {isDevolucion ? formatCurrency(a.monto) : `+${formatCurrency(a.monto)}`}
                                                            </div>
                                                        </div>
                                                        {a.nota && <div className="text-[10px] text-slate-600 italic bg-white/50 p-1 rounded inline-block">{a.nota}</div>}
                                                    </div>
                                                    <InlineComprobante items={(comprobantesData.abonos || {})[i] || []} onClickImage={setPreviewImage} />
                                                </div>

                                                {(comprobantesData.verificacion_abonos || {})[i]?.length > 0 && (
                                                    <div className="bg-emerald-50/80 border border-emerald-300 rounded p-3 shadow-sm flex items-center justify-between gap-4 md:ml-12 ml-6 border-l-4 border-l-emerald-500">
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                                            <div>
                                                                <span className="text-emerald-800 font-bold text-xs uppercase block">Verificación de Banco</span>
                                                                <span className="text-emerald-600 text-[10px]">Aprobado por Contabilidad</span>
                                                            </div>
                                                        </div>
                                                        <InlineComprobante items={(comprobantesData.verificacion_abonos || {})[i]} onClickImage={setPreviewImage} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {order.notas && (
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">Notas Internas (Solo Sistema)</h3>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-sm">
                            <p className="text-sm text-amber-800 whitespace-pre-wrap font-medium leading-relaxed">{order.notas}</p>
                        </div>
                    </div>
                )}

                <hr className="border-gray-200 mb-8" />

                <div className="pb-8 mb-auto">
                    <h3 className="font-bold text-slate-700 mb-3">Arte / Diseño</h3>
                    {loadingImages ? (
                        <div className="flex justify-center items-center p-8 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                            <span className="ml-2 text-slate-500 font-medium">Cargando artes de la base de datos...</span>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 min-h-[200px] flex flex-wrap gap-4 items-center justify-center bg-slate-50">
                            {localImages.length > 0 ? (
                                localImages.map((img, index) => (
                                    <div key={index} className="relative group cursor-pointer" onClick={() => setPreviewImage(img.url)}>
                                        <img src={img.url} alt={img.name || `Arte ${index + 1}`} className="h-40 w-40 object-cover shadow-md rounded border border-slate-300 transition-transform hover:scale-105" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center"><Search className="text-white h-6 w-6" /></div>
                                    </div>
                                ))
                            ) : (<div className="flex flex-col items-center text-slate-400"><ImageIcon className="h-12 w-12 mb-2 opacity-50" /><span className="italic">Sin imágenes de referencia adjuntas en la orden.</span></div>)}
                        </div>
                    )}
                </div>

                {showWorkflowButton && (
                    <div className="mt-8 pt-6 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur py-4 -mx-6 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-between items-center">
                         
                         <div>
                             {isAdmin && workflowConfig.prevStatus && (
                                 <Button 
                                   size="lg" disabled={isAdvancing}
                                   variant="outline"
                                   className="border-orange-300 text-orange-700 hover:bg-orange-50 font-bold text-lg px-6 py-6 shadow-sm flex items-center gap-2 transition-all"
                                   onClick={async () => { 
                                       setIsAdvancing(true); 
                                       try { 
                                           onClose(); 
                                           await onRegressWorkflow(order); 
                                       } catch(e) {
                                           setIsAdvancing(false);
                                       } 
                                   }}
                                 >
                                   <ArrowLeftCircle className="h-6 w-6" />
                                   Revertir a {workflowConfig.prevStatus}
                                 </Button>
                             )}
                         </div>

                         <div className="flex flex-col items-end gap-1">
                            {workflowConfig.nextStatus && (
                                <>
                                    {!canAdvance ? (
                                         <Button size="lg" className="bg-slate-300 cursor-not-allowed text-slate-500 font-bold text-lg px-8 py-6 shadow-sm flex items-center gap-3" title="Tu rol no tiene permisos para avanzar esta orden">{workflowConfig.text}<Ban className="h-6 w-6 opacity-50" /></Button>
                                    ) : lockToContabilidad ? (
                                         <Button size="lg" className="bg-amber-500 cursor-not-allowed text-white font-bold text-lg px-8 py-6 shadow-sm flex items-center gap-3" title="Debes cobrar el saldo pendiente antes de pasar a Contabilidad">{workflowConfig.text}<Ban className="h-6 w-6 opacity-50" /></Button>
                                    ) : order.status === 'PRODUCCION' && !allProductsFinished ? (
                                         <Button size="lg" className="bg-slate-400 cursor-not-allowed text-white font-bold text-lg px-8 py-6 shadow-sm flex items-center gap-3" title="Debes finalizar todos los productos primero">{workflowConfig.text}<Ban className="h-6 w-6 opacity-50" /></Button>
                                    ) : (
                                         <Button 
                                           size="lg" disabled={isAdvancing}
                                           className="bg-green-600 hover:bg-green-700 text-white font-bold text-lg px-8 py-6 shadow-lg transition-all hover:scale-105 flex items-center gap-3 disabled:opacity-75 disabled:hover:scale-100 disabled:cursor-wait"
                                           onClick={async () => { 
                                               if (workflowConfig.nextStatus === 'FINALIZADA') {
                                                   const pAnticipoTemp = (order.formaPagoAnticipo || order.forma_pago_anticipo || '').toLowerCase();
                                                   const pSaldoTemp = (order.formaPagoSaldo || fin.formaPagoSaldo || '').toLowerCase();
                                                   
                                                   const checkTransfer = (method) => method.includes('transfer') || method.includes('depósito') || method.includes('deposito') || method.includes('cheque') || method.includes('tarjeta');
                                                   
                                                   if (anticipoVal > 0 && checkTransfer(pAnticipoTemp)) {
                                                       if (!comprobantesData.verificacion_anticipo || comprobantesData.verificacion_anticipo.length === 0) {
                                                           toast({title: "Verificación de Banco Requerida", description: "Contabilidad debe adjuntar la captura del banco para el Anticipo antes de finalizar la orden.", variant: "destructive"});
                                                           setIsAdvancing(false);
                                                           return;
                                                       }
                                                   }

                                                   if (order.abonos && order.abonos.length > 0) {
                                                       for (let i = 0; i < order.abonos.length; i++) {
                                                           const a = order.abonos[i];
                                                           const method = (a.metodoPago || a.metodo_pago || '').toLowerCase();
                                                           if (a.monto > 0 && checkTransfer(method)) {
                                                               if (!comprobantesData.verificacion_abonos || !comprobantesData.verificacion_abonos[i] || comprobantesData.verificacion_abonos[i].length === 0) {
                                                                   toast({title: "Verificación de Banco Requerida", description: `Contabilidad debe adjuntar la captura del banco/tarjeta para el Abono #${i + 1} antes de finalizar.`, variant: "destructive"});
                                                                   setIsAdvancing(false);
                                                                   return;
                                                               }
                                                           }
                                                       }
                                                   }

                                                   let isTransfer = checkTransfer(pAnticipoTemp) || checkTransfer(pSaldoTemp);
                                                   if (!isTransfer && order.abonos) {
                                                       isTransfer = order.abonos.some(a => checkTransfer(a.metodoPago || a.metodo_pago));
                                                   }
                                                                                                     
                                                   if (isTransfer && (!comprobantesData.anticipo || comprobantesData.anticipo.length === 0) && (!comprobantesData.saldo || comprobantesData.saldo.length === 0) && Object.keys(comprobantesData.abonos || {}).length === 0) {
                                                       toast({title: "Comprobante del Vendedor Requerido", description: "El vendedor no subió fotos de transferencias, depósitos, cheques o tarjetas. Es necesario adjuntarlos.", variant: "destructive"});
                                                       setIsAdvancing(false);
                                                       return; 
                                                   }

                                                   if (retencion > 0 && (!comprobantesData.retencion || comprobantesData.retencion.length === 0)) {
                                                       toast({title: "Falta Retención", description: "Debe adjuntar la foto o comprobante de la retención antes de finalizar la orden.", variant: "destructive"});
                                                       setIsAdvancing(false);
                                                       return;
                                                   }
                                               }

                                               onClose(); 
                                               await onAdvanceWorkflow(order); 
                                           }}
                                         >
                                           {workflowConfig.text}
                                           <ArrowRightCircle className="h-6 w-6" />
                                         </Button>
                                    )}
                                    <span className="text-xs text-slate-500 font-medium px-2">
                                        {!canAdvance ? '⚠️ Tu rol no permite avanzar esta etapa' : lockToContabilidad ? '⚠️ Debes registrar el cobro del saldo antes de enviar a Contabilidad' : (order.status === 'PRODUCCION' && !allProductsFinished ? '⚠️ Debes finalizar todos los productos en la tabla superior' : workflowConfig.helper)}
                                    </span>
                                </>
                            )}
                         </div>
                    </div>
                )}
                
                {canArchive && (
                   <div className="mt-8 pt-6 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur py-4 -mx-6 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end">
                      <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 py-6 shadow-lg transition-all hover:scale-105 flex items-center gap-3" onClick={() => { onArchiveOrder(order); onClose(); }}>ARCHIVAR Orden<Archive className="h-6 w-6" /></Button>
                   </div>
                )}
            </div>

            <AnimatePresence>
                {previewImage && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}>
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full transition-colors"><X className="h-8 w-8" /></button>
                    <img src={previewImage} alt="Referencia Full" className="max-w-full max-h-[95vh] rounded shadow-2xl" />
                  </motion.div>
                )}
            </AnimatePresence>

            {/* 🔧 NUEVO: popup del expediente del cliente, sin salir de la orden */}
            {showClientExpediente && (() => {
                const clienteId = order.clienteId || order.cliente_id;
                const clienteObj = clients?.find(c => c.id === clienteId);
                if (!clienteObj) {
                    // Si no se encuentra la ficha completa, al menos avisamos en vez de fallar en silencio
                    return (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={() => setShowClientExpediente(false)}>
                            <div className="bg-white rounded-xl p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
                                <p className="font-bold text-slate-700 mb-3">No se pudo ubicar la ficha completa de este cliente.</p>
                                <Button onClick={() => setShowClientExpediente(false)}>Cerrar</Button>
                            </div>
                        </div>
                    );
                }
                return (
                    <ClientExpedienteModal
                        cliente={clienteObj}
                        orders={orders}
                        onClose={() => setShowClientExpediente(false)}
                        onEditClient={onEditClient ? (c) => { setShowClientExpediente(false); onEditClient(c); } : null}
                        onViewOrder={onSwitchOrder ? (o) => { setShowClientExpediente(false); onSwitchOrder(o); } : null}
                        canViewOrderDetails={true}
                    />
                );
            })()}
        </div>

        {/* 🔥 CONTENEDOR INVISIBLE DE IMPRESIÓN 🔥 */}
        <div id="modal-print-container" className="hidden print:block absolute top-0 left-0 w-full bg-white z-[10000] text-black" style={{ minHeight: '100vh', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #modal-print-container, #modal-print-container * { visibility: visible; }
                    #modal-print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                }
            `}</style>

            <div className="w-full max-w-[850px] mx-auto p-4 md:p-6 font-sans text-black">
                
                <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
                    <div className="w-1/2">
                         <img src="/logo.png" alt="Logo" className="w-40 h-auto object-contain mb-2" />
                         <div className="text-[10px] text-slate-700 leading-tight font-medium">
                             <p className="font-bold text-black text-xs mb-0.5">RUC: 0993397285001</p>
                             <p>📍 Av. Zenon Macias y calle la Merced, General Villamil, Guayas, Ecuador</p>
                             <p>📞 Tel: 0990761566 - 0982657066</p>
                             <p>🌐 Redes: @graficasadr</p>
                         </div>
                    </div>
                    <div className="text-right w-1/2">
                         <h1 className="text-xl font-black tracking-widest text-slate-900 mb-1 uppercase">Orden de Producción</h1>
                         <div className="text-lg font-bold text-slate-800">N° ORDEN: {formatOrderId(order.id)}</div>
                         <div className="text-[11px] font-bold text-slate-700 mt-1">FECHA INGRESO: {formatDateFull(order.createdAt || order.created_at)}</div>
                    </div>
                </div>

                <div className="border-2 border-black rounded-lg p-3 mb-6 bg-gray-50">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                         <div><span className="font-bold">CLIENTE:</span> <span className="uppercase text-base font-black">{order.cliente || order.cliente_nombre}</span></div>
                         <div><span className="font-bold">RUC/C.I.:</span> <span className="uppercase">{order.ruc || order.cedula || order.cliente_identificacion || 'CONSUMIDOR FINAL'}</span></div>

                         <div><span className="font-bold">CELULAR:</span> <span className="uppercase">{order.cliente_telefono || 'N/A'}</span></div>
                         <div><span className="font-bold">TÍTULO/PROYECTO:</span> <span className="uppercase text-xs">{order.tipoLetrero || order.tipo_trabajo}</span></div>
                         <div><span className="font-bold">FECHA ENTREGA:</span> <span className="font-bold uppercase">{(order.fechaEntrega || order.fecha_entrega) ? formatDateFull(order.fechaEntrega || order.fecha_entrega) : 'Por Definir'}</span></div>
                         
                         <div><span className="font-bold">VENDEDOR:</span> <span className="uppercase">{order.vendedor || 'SISTEMA'}</span></div>
                         <div><span className="font-bold">N° FACTURA:</span> <span className="uppercase">{nroFacturaDisplay}</span></div>

                         <div className="col-span-2"><span className="font-bold">VIENE DE PROFORMA:</span> <span className="uppercase">{order.origenProformaInfo || order.origenProformaId ? `#${order.origenProformaInfo || order.origenProformaId}` : 'NO'}</span></div>
                    </div>
                </div>

                <div className="mb-8">
                    <table className="w-full border-collapse border-2 border-black text-sm mb-0">
                        <thead>
                            <tr className="bg-gray-200 border-b-2 border-black text-[11px]">
                                <th className="border-r-2 border-black p-2 w-12 text-center uppercase">CANT.</th>
                                <th className="border-r-2 border-black p-2 text-left uppercase">DESCRIPCIÓN</th>
                                <th className="border-r-2 border-black p-2 text-right w-24 uppercase">V. UNITARIO</th>
                                <th className="p-2 text-right w-24 uppercase">V. TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(order.productos || []).map((prod, idx) => (
                                <tr key={idx} className="border-b border-black">
                                    <td className="border-r-2 border-black p-2 text-center font-bold text-base align-middle">{prod.cantidad}</td>
                                    <td className="border-r-2 border-black p-2 uppercase font-medium whitespace-pre-wrap text-xs align-top">
                                        {getPrintDesc(prod)}
                                    </td>
                                    <td className="border-r-2 border-black p-2 font-medium align-middle text-right">
                                        {formatCurrency(prod.precio || prod.precioUnitario)}
                                    </td>
                                    <td className="p-2 font-bold align-middle text-right">
                                        {formatCurrency(prod.total || (prod.cantidad * (prod.precio || prod.precioUnitario)))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {observacionesPublicas && (
                    <div className="border-2 border-black rounded-lg p-3 mb-6 bg-white" style={{ pageBreakInside: 'avoid' }}>
                        <div className="font-bold text-[11px] mb-1 uppercase tracking-wider">Observaciones y Condiciones del Proyecto:</div>
                        <div className="text-xs whitespace-pre-line text-slate-800 font-medium">
                            {observacionesPublicas}
                        </div>
                    </div>
                )}

                <div className="flex border-2 border-black text-xs bg-white mb-8" style={{ pageBreakInside: 'avoid' }}>
                    
                    <div className="flex-1 border-r-2 border-black p-4 flex flex-col justify-center gap-3">
                        {/* 🔥 MUESTRA FORMA DE PAGO EN ANTICIPO 🔥 */}
                        <div className="flex justify-between items-center border-b border-dashed border-gray-400 pb-1">
                            <div className="flex flex-col">
                                <span className="font-bold text-sm text-slate-700">ANTICIPO INICIAL:</span>
                                <span className="text-[10px] text-slate-600 uppercase font-medium">PAGO: {order.formaPagoAnticipo || order.forma_pago_anticipo || 'Efectivo'}</span>
                            </div>
                            <span className="font-bold text-sm text-slate-800">{formatCurrency(anticipoVal)}</span>
                        </div>
                        
                        {/* 🔥 MUESTRA FORMA DE PAGO EN ABONOS 🔥 */}
                        {order.abonos && order.abonos.map((a, i) => (
                            <div key={i} className={`flex justify-between items-center border-b border-dashed pb-1 ${a.monto < 0 ? 'border-orange-300 text-orange-700' : 'border-red-300 text-red-700'}`}>
                                <div className="flex flex-col">
                                    <span className="font-bold">{a.monto < 0 ? 'DEVOLUCIÓN' : 'ABONO'} {i+1} ({a.fecha ? formatDateFull(a.fecha).split(' ')[0] : ''}):</span>
                                    <span className="text-[10px] uppercase font-medium">PAGO: {a.metodoPago || a.metodo_pago || '-'}</span>
                                </div>
                                <span className="font-bold">{formatCurrency(a.monto)}</span>
                            </div>
                        ))}

                        <div className="flex justify-between items-center pt-2">
                            <span className="font-black text-base text-red-600">SALDO PENDIENTE:</span>
                            <span className="font-black text-base text-red-600">{formatCurrency(saldoCalculado)}</span>
                        </div>
                    </div>

                    <div className="w-[40%] flex flex-col">
                        <div className="flex justify-between items-center p-1.5 border-b border-black bg-gray-50">
                            <span className="font-bold">SUBTOTAL</span>
                            <span className="font-medium">{formatCurrency(fin.subtotal)}</span>
                        </div>
                        {Number(fin.descuentoVal) > 0 && (
                            <div className="flex justify-between items-center p-1.5 border-b border-black bg-gray-50">
                                <span className="font-bold">DESCUENTO</span>
                                <span className="font-medium">-{formatCurrency(fin.descuentoVal)}</span>
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center p-1.5 border-b border-black bg-gray-50">
                            <span className="font-bold">BASE IMPONIBLE</span>
                            <span className="font-medium">{formatCurrency(fin.baseImponible)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-1.5 border-b border-black bg-gray-50">
                            <span className="font-bold">IVA ({parseFloat(Number(fin.ivaPercentage || 15).toFixed(2))}%)</span>
                            <span className="font-medium">{formatCurrency(fin.iva)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-1.5 border-b border-black bg-gray-200">
                            <span className="font-black text-sm">TOTAL FACTURA</span>
                            <span className="font-black text-sm">{formatCurrency(fin.total)}</span>
                        </div>
                        
                        {retencion > 0 && (
                            <div className="flex justify-between items-center p-1.5 border-b border-black bg-orange-50">
                                <span className="font-bold text-orange-800">RETENCIÓN ({parseFloat(Number(parsedFinancials.retentionPercent || 0).toFixed(2))}%)</span>
                                <span className="font-bold text-orange-800">-{formatCurrency(retencion)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center p-2 bg-blue-100 h-full border-t border-black">
                            <span className="font-black text-sm">TOTAL A PAGAR</span>
                            <span className="font-black text-sm">{formatCurrency(fin.total - retencion)}</span>
                        </div>
                    </div>
                </div>

                {localImages.length > 0 && (
                    <div className="border-2 border-black rounded-lg p-3" style={{ pageBreakInside: 'avoid' }}>
                        <div className="font-bold text-xs mb-3 uppercase">Artes y Diseños Adjuntos:</div>
                        <div className="flex flex-wrap gap-2 items-start justify-center">
                           {localImages.map((img, index) => (
                               <img 
                                 key={index}
                                 src={img.url} 
                                 alt={img.name || `Arte ${index + 1}`} 
                                 className="max-w-[48%] max-h-[220px] object-contain border border-gray-300 rounded shadow-sm"
                               />
                           ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    </>
  );
};

export default OrderDetailsModal;