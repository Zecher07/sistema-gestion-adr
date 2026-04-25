import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Image as ImageIcon, ArrowRightCircle, Archive, Edit2, FileText, Ban, Play, CheckCircle2, Search, Loader2, DollarSign, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '../supabaseClient';
import { useDropzone } from 'react-dropzone';

const WORKFLOW_VPVC = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];
const WORKFLOW_VC = ['VENTAS', 'CONTABILIDAD', 'FINALIZADA'];

// --- FUNCIÓN DE COMPRESIÓN DE IMÁGENES ---
const compressImage = async (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve({ name: file.name, url: dataUrl });
            };
        };
    });
};

const getPrintDesc = (prod) => {
    const text = prod.descripcion || prod.nombre || '';
    return text.split(/\[?nota:/i)[0].trim();
};

const ProductProductionRow = ({ product, index, order, user, onProductUpdate }) => {
    // Código idéntico y optimizado (sin cambios)
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
       const { data } = await supabase.from('inventario').select('*').ilike('nombre', `%${val}%`).limit(8);
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
                for (const mat of usedMaterials) {
                    const qtyToDeduct = Number(mat.cant_usada);
                    if (qtyToDeduct > 0) {
                        const { data: currentItem } = await supabase.from('inventario').select('cantidad').eq('id', mat.id).single();
                        if (currentItem) {
                            const newQty = (currentItem.cantidad || 0) - qtyToDeduct;
                            await supabase.from('inventario').update({ cantidad: newQty }).eq('id', mat.id);
                        }
                    }
                }
            }

            const updated = { ...product, estado_prod: 'FINALIZADO', materiales: usedMaterials, sin_materiales: noMaterials };
            await onProductUpdate(index, updated);
            toast({ title: "Producto Finalizado", description: "Se ha registrado la producción y descontado el inventario." });
        } catch (error) {
            toast({ title: "Error", description: "Ocurrió un problema al finalizar el producto.", variant: "destructive" });
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
                                           <div className="absolute z-20 w-full bg-white border border-slate-300 shadow-xl max-h-40 overflow-y-auto mt-1 rounded-md text-xs">
                                               {suggestions.map(s => (
                                                   <div key={s.id} className="p-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 flex justify-between items-center" onClick={() => addMaterial(s)}>
                                                       <span className="font-bold text-slate-700">{s.nombre}</span><span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 rounded border border-slate-200">Stock: {s.cantidad} {s.unidad}</span>
                                                   </div>
                                               ))}
                                           </div>
                                       )}
                                   </div>

                                   {usedMaterials.length > 0 && (
                                       <div className="space-y-2 bg-white p-2 rounded border border-blue-100 shadow-inner max-h-40 overflow-y-auto">
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
                           <div className="text-xs font-black text-green-700 uppercase tracking-wider flex items-center gap-1 mb-2"><CheckCircle2 className="w-4 h-4"/> Finalizado</div>
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

const OrderDetailsModal = ({ order, user, staffUsers = [], onClose, onProductToggle, isTaskView, onAdvanceWorkflow, onArchiveOrder, onUpdateOrder, onGenerateInvoice, canEdit, onAbonoOrder }) => {
  const [previewImage, setPreviewImage] = useState(null);
  const [printType, setPrintType] = useState('sri'); 
  const { toast } = useToast();
  const [localProducts, setLocalProducts] = useState([]);
  const [localVendedor, setLocalVendedor] = useState('');
  
  const [localImages, setLocalImages] = useState([]); 
  const [loadingImages, setLoadingImages] = useState(false); 
  const [isAdvancing, setIsAdvancing] = useState(false);

  // 🔥 ESTADOS PARA COMPROBANTES DE PAGO 🔥
  const [localComprobantes, setLocalComprobantes] = useState([]);
  const [loadingComprobantes, setLoadingComprobantes] = useState(false);
  const [isProcessingComprobantes, setIsProcessingComprobantes] = useState(false);
  
  const showFinancials = user?.role !== 'Producción'; 
  const isAdmin = user?.role === 'Administrador';

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

      // 🔥 FETCH COMPROBANTES 🔥
      const fetchComprobantes = async () => {
          if (!showFinancials) return;
          setLoadingComprobantes(true);
          try {
              const { data } = await supabase.from('ordenes').select('comprobantes').eq('id', order.id).single();
              if (data && Array.isArray(data.comprobantes) && data.comprobantes.length > 0) setLocalComprobantes(data.comprobantes);
              else setLocalComprobantes([]);
          } catch (err) { setLocalComprobantes([]); } 
          finally { setLoadingComprobantes(false); }
      };

      fetchImages(); 
      fetchComprobantes();
    }
    
    return () => { document.body.style.overflow = 'unset'; };
  }, [order, showFinancials]);

  // 🔥 LÓGICA DE SUBIDA DE COMPROBANTES 🔥
  const handleAddComprobantes = async (files) => {
      setIsProcessingComprobantes(true);
      const newImages = [];
      for (const file of files) {
          if (file.size > 15000000) { toast({ title: "Archivo muy grande", variant: "destructive" }); continue; }
          try {
              const compressed = await compressImage(file);
              newImages.push(compressed);
          } catch (e) { toast({ title: "Error al procesar", variant: "destructive" }); }
      }
      const updatedComprobantes = [...localComprobantes, ...newImages];
      setLocalComprobantes(updatedComprobantes);
      
      try {
          await supabase.from('ordenes').update({ comprobantes: updatedComprobantes }).eq('id', order.id);
          toast({title: "Comprobante de pago guardado"});
      } catch(e) { toast({title: "Error al guardar en base de datos", variant: "destructive"}); }
      setIsProcessingComprobantes(false);
  };

  const removeComprobante = async (index) => {
      if (!isAdmin && user.role !== 'Contabilidad') return;
      const updated = localComprobantes.filter((_, i) => i !== index);
      setLocalComprobantes(updated);
      try {
          await supabase.from('ordenes').update({ comprobantes: updated }).eq('id', order.id);
      } catch(e) {}
  };

  const onDropComprobantes = useCallback(acceptedFiles => { handleAddComprobantes(acceptedFiles); }, [localComprobantes]);
  const { getRootProps: getRootPropsComp, getInputProps: getInputPropsComp } = useDropzone({ onDrop: onDropComprobantes, accept: {'image/*': []}, disabled: isProcessingComprobantes || (!isAdmin && user.role !== 'Contabilidad' && user.role !== 'Vendedor') });

  const validSellers = useMemo(() => removeDuplicateUsers(getValidSellers(staffUsers)), [staffUsers]);
  const allProductsFinished = useMemo(() => {
      if (!localProducts || localProducts.length === 0) return true;
      return localProducts.every(p => p.estado_prod === 'FINALIZADO');
  }, [localProducts]);

  const fin = order?.financials || { subtotal: 0, iva: 0, total: 0, saldo: 0 };
  const totalVal = Number(fin.total) || 0;
  const anticipoVal = Number(order?.anticipo) || 0;
  const retencionVal = Number(order?.retencion) || 0;
  const abonosTotal = (order?.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
  
  const saldoCalculado = Math.max(totalVal - anticipoVal - retencionVal - abonosTotal, 0);
  const isCredito = (order?.formaPagoSaldo || '').toLowerCase().includes('crédito') || (order?.formaPagoSaldo || '').toLowerCase().includes('credito') || (order?.formaPagoAnticipo || '').toLowerCase().includes('crédito');

  const lockToContabilidad = order?.status === 'VENTAS POR RETIRAR' && !isCredito && saldoCalculado > 0 && !isAdmin;

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

  const handlePrint = (type) => { setPrintType(type); setTimeout(() => { window.print(); }, 100); };

  const handleResponsableChange = async (e) => {
    const nuevoVendedor = e.target.value;
    setLocalVendedor(nuevoVendedor); 
    try {
        const { error } = await supabase.from('ordenes').update({ vendedor: nuevoVendedor }).eq('id', order.id);
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

  const formatDateFull = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    } catch (e) { return ''; }
  };

  const calculateDaysDiff = (dateString) => {
    if (!dateString) return '';
    const diffDays = Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24)); 
    if (isNaN(diffDays)) return '';
    return diffDays > 0 ? `(+${diffDays} días)` : `(${diffDays} días)`;
  };

  const formatOrderId = (id) => (order.orderNumber || order.order_number || id).toString().padStart(7, '0');
  
  const isAnulada = order.status === 'ANULADA';
  const isArchivada = order.status === 'ARCHIVADA';
  const isFinalizada = order.status === 'FINALIZADA';
  const canArchive = isAdmin && isFinalizada;
  const canInvoice = !isAnulada && (user.role === 'Vendedor' || user.role === 'Contabilidad' || user.role === 'Administrador') && ['VENTAS', 'PRODUCCION', 'CONTABILIDAD', 'FINALIZADA'].includes(order.status);
  const showWorkflowButton = !isAnulada && !isFinalizada && !isArchivada;

  const getWorkflowButtonConfig = () => {
     const isVC = order.tipoOrden && order.tipoOrden.includes('(VC)');
     const workflow = isVC ? WORKFLOW_VC : WORKFLOW_VPVC;
     const currentIndex = workflow.indexOf(order.status);
     
     if (currentIndex === -1 || currentIndex >= workflow.length - 1) return { text: 'Continuar flujo', helper: '' };

     const nextStatus = workflow[currentIndex + 1];
     let text = `Pasar a ${nextStatus}`;

     switch (order.status) {
         case 'VENTAS': text = nextStatus === 'PRODUCCION' ? "Pasar a Producción" : "Pasar a Contabilidad"; break;
         case 'PRODUCCION': text = `Pasar a Ventas – ${localVendedor || 'Sin asignar'}`; break;
         case 'VENTAS POR RETIRAR': if (nextStatus === 'CONTABILIDAD') text = "Pasar a Contabilidad"; break;
         case 'CONTABILIDAD': if (nextStatus === 'FINALIZADA') text = "Finalizar orden"; break;
         default: break;
     }
     return { text, helper: `Siguiente paso: ${nextStatus}` };
  };
  const workflowConfig = getWorkflowButtonConfig();

  return (
    <>
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto animate-in fade-in duration-200 flex flex-col print:hidden">
            {isAnulada && (
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
                    {canInvoice && onGenerateInvoice && <Button size="sm" onClick={() => onGenerateInvoice(order)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"><FileText className="h-4 w-4" /> Generar Factura</Button>}
                    {canEdit && <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-2" onClick={() => onUpdateOrder && onUpdateOrder()}><Edit2 className="h-4 w-4" /> Editar Orden</Button>}
                    
                    <div className="flex bg-slate-100 rounded-md p-1 border border-slate-200">
                        {showFinancials && (
                            <>
                                <Button size="sm" variant="ghost" className="text-blue-700 hover:bg-blue-200 hover:text-blue-800 gap-2 font-bold" onClick={() => handlePrint('sri')}>
                                    <Printer className="h-4 w-4" /> SRI
                                </Button>
                                <div className="w-px bg-slate-300 mx-1"></div>
                            </>
                        )}
                        <Button size="sm" variant="ghost" className="text-amber-700 hover:bg-amber-200 hover:text-amber-800 gap-2 font-bold" onClick={() => handlePrint('produccion')}>
                            <Printer className="h-4 w-4" /> Prod
                        </Button>
                    </div>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2 ml-1" onClick={onClose}><X className="h-4 w-4" /> Cerrar</Button>
                </div>
            </div>

            <div className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full relative z-0 flex flex-col">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-8">
                    <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-[140px_1fr] gap-2"><span className="font-bold text-right text-slate-600">Titulo:</span><span className="uppercase font-medium text-slate-900">{order.tipoLetrero || order.tipo_trabajo}</span></div>
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                            <span className="font-bold text-right text-slate-600">Autor:</span>
                            {isAdmin ? (<div className="flex items-center gap-2"><select className="border border-slate-300 rounded px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={localVendedor} onChange={handleResponsableChange}><option value="">Seleccionar...</option>{validSellers.map(u => (<option key={u.id} value={u.name}>{formatResponsableName(u)}</option>))}</select><Edit2 className="h-3 w-3 text-slate-400" /></div>) : (<span className="text-slate-900">{localVendedor || 'Sistema'}</span>)}
                        </div>
                        <div className="grid grid-cols-[140px_1fr] gap-2"><span className="font-bold text-right text-slate-600">Fecha:</span><span className="text-slate-900">{formatDateFull(order.createdAt || order.created_at)}</span></div>
                        <div className="grid grid-cols-[140px_1fr] gap-2"><span className="font-bold text-right text-slate-600">Fecha entrega:</span><span className="text-red-600 font-bold">{formatDateFull(order.fechaEntrega || order.fecha_entrega)} <span className="text-xs ml-1 font-normal text-red-500">{calculateDaysDiff(order.fechaEntrega || order.fecha_entrega)}</span></span></div>
                         <div className="grid grid-cols-[140px_1fr] gap-2"><span className="font-bold text-right text-slate-600">Fecha Finaliz:</span><span className="text-slate-900">{isFinalizada ? formatDateFull(order.updatedAt || order.updated_at) : ''}</span></div>
                        
                        <div className="grid grid-cols-[140px_1fr] gap-2 mt-4">
                            <span className="font-bold text-right text-slate-600">Cliente:</span>
                            <div className="flex flex-col"><span className="text-blue-600 font-bold uppercase tracking-wide">{order.cliente || order.cliente_nombre}</span>{(order.ruc || order.cedula || order.cliente_identificacion) && (<span className="text-xs text-slate-500 font-mono mt-0.5">ID/RUC: {order.ruc || order.cedula || order.cliente_identificacion}</span>)}</div>
                        </div>
                        
                        {(order.origenProformaInfo || order.origenProformaId) && (
                            <div className="grid grid-cols-[140px_1fr] gap-2 mt-1">
                                <span className="font-bold text-right text-slate-600">Origen:</span>
                                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 self-start">Proforma #{order.origenProformaInfo || order.origenProformaId}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="font-bold text-slate-600 text-sm">Observaciones:</span>
                            <div className="border border-green-200 rounded-md p-3 min-h-[60px] bg-white text-sm text-slate-700 w-full shadow-sm">{order.notas || <span className="text-slate-400 italic">Ninguna observación registrada.</span>}</div>
                        </div>
                        <div className="space-y-1">
                            <span className="font-bold text-slate-600 text-sm">Motivo Anulada:</span>
                            <div className="border border-red-200 rounded-md p-3 min-h-[40px] bg-white text-sm text-red-600 font-medium w-full shadow-sm">{isAnulada ? (order.motivoAnulacion || "Orden Anulada") : <span className="text-slate-400 italic font-normal">-</span>}</div>
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
                    <div className="mb-6 bg-slate-50/50 p-4 border border-slate-200 rounded-lg">
                        <h3 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">Pagos y Comprobantes</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white border border-blue-200 rounded p-4 shadow-sm">
                                <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2"><span className="text-blue-800 font-bold text-sm">Anticipo Original</span><span className="text-lg font-bold text-slate-800">{Number(order.anticipo || 0).toFixed(2)}</span></div>
                                <div className="space-y-1 text-xs text-slate-600">
                                     <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-medium text-slate-900">{order.formaPagoAnticipo || order.forma_pago_anticipo || '-'}</span></div>
                                     {(order.formaPagoAnticipo === 'Crédito' || order.forma_pago_anticipo === 'Crédito') && (<div className="flex justify-between"><span>Vence:</span> <span>{order.creditoVenceAnticipo || order.credito_vence_anticipo || '-'}</span></div>)}
                                     {(order.notaAnticipo || order.nota_anticipo) && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaAnticipo || order.nota_anticipo}</div>}
                                </div>
                            </div>
                            <div className="bg-white border border-blue-200 rounded p-4 shadow-sm flex flex-col justify-center items-center">
                                <span className="text-blue-800 font-bold text-sm mb-1">Retención</span><span className="text-2xl font-bold text-slate-800">{Number(order.retencion || 0).toFixed(2)}</span>
                            </div>
                            <div className="bg-white border border-blue-200 rounded p-4 shadow-sm flex flex-col relative pb-12">
                                <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2"><span className="text-blue-800 font-bold text-sm">Saldo Pendiente (Real)</span><span className={`text-lg font-bold ${saldoCalculado > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(saldoCalculado)}</span></div>
                                <div className="space-y-1 text-xs text-slate-600 mb-2">
                                     <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-medium text-slate-900">{order.formaPagoSaldo || fin.formaPagoSaldo || '-'}</span></div>
                                     {isCredito && (<div className="flex justify-between"><span>Vence:</span> <span>{order.creditoVenceSaldo || fin.creditoVenceSaldo || '-'}</span></div>)}
                                     {(order.notaSaldo || fin.notaSaldo) && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaSaldo || fin.notaSaldo}</div>}
                                </div>
                                {saldoCalculado > 0 && onAbonoOrder && (<div className="absolute bottom-3 left-4 right-4"><Button size="sm" onClick={() => onAbonoOrder(order)} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm flex items-center justify-center gap-2"><DollarSign className="h-4 w-4"/> Registrar Cobro</Button></div>)}
                            </div>
                        </div>

                        {/* 🔥 SECCIÓN DE FOTOS DE TRANSFERENCIAS 🔥 */}
                        <div className="mt-6 border-t border-slate-200 pt-4">
                            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">Comprobantes de Transferencia / Depósito</h4>
                            <div className="border border-slate-300 p-4 rounded-md bg-white flex flex-col md:flex-row gap-4 items-start">
                                <div className="min-h-[80px] flex-1 flex flex-wrap gap-4">
                                   {localComprobantes.map((img, i) => (
                                      <div key={i} className="relative group w-20 h-20 border border-slate-300 bg-slate-50 rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => setPreviewImage(img.url)}>
                                         <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                         {(isAdmin || user.role === 'Contabilidad') && (
                                             <button type="button" onClick={(e) => { e.stopPropagation(); removeComprobante(i); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"><X className="h-3 w-3" /></button>
                                         )}
                                      </div>
                                   ))}
                                   {loadingComprobantes || isProcessingComprobantes ? (
                                       <div className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50 rounded-md animate-pulse">
                                           <Loader2 className="h-5 w-5 text-blue-500 animate-spin"/>
                                       </div>
                                   ) : localComprobantes.length === 0 && (
                                       <div className="w-full flex flex-col items-center justify-center text-slate-400 text-xs py-2">
                                          <FileText className="h-6 w-6 mb-1 opacity-50" />
                                          <span>Sin comprobantes adjuntos</span>
                                       </div>
                                   )}
                                </div>
                                {(isAdmin || user.role === 'Contabilidad' || user.role === 'Vendedor') && (
                                    <div className="shrink-0">
                                        <input {...getInputPropsComp()} className="hidden" />
                                        <label {...getRootPropsComp()} className={`inline-flex items-center gap-1 ${isProcessingComprobantes ? 'bg-slate-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'} text-white text-xs px-4 py-2 rounded-md transition-colors shadow-sm`}>
                                            <Plus className="h-4 w-4" /> {isProcessingComprobantes ? 'Procesando...' : 'Subir Comprobante'}
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {showFinancials && (
                    <div className="mb-8 flex justify-end">
                        <div className="w-full max-w-sm bg-white border border-slate-300 rounded-sm shadow-sm overflow-hidden">
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm"><div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">SubTotal</div><div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.subtotal)}</div></div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm"><div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">Dscto ({fin.descuentoPorcentaje || 0}%)</div><div className="px-4 py-2 text-right text-red-500">-{formatCurrency(fin.descuentoVal)}</div></div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm"><div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">Base Imponible</div><div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.baseImponible || fin.subtotal)}</div></div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm"><div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">IVA ({fin.ivaPercentage || 15}%)</div><div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.iva)}</div></div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200 bg-blue-50 text-base"><div className="px-4 py-3 text-right font-bold text-blue-900">TOTAL</div><div className="px-4 py-3 text-right font-bold text-blue-900">{formatCurrency(fin.total)}</div></div>
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
                    <div className="mt-8 pt-6 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur py-4 -mx-6 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end">
                         <div className="flex flex-col items-end gap-1">
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
                                       setIsAdvancing(true); 
                                       try { 
                                           // 🔥 VALIDACIÓN DE FOTO DE COMPROBANTE AL FINALIZAR 🔥
                                           const nextStatus = workflowConfig.text.replace('Pasar a ', '').replace(' – ', '').trim();
                                           if (nextStatus === 'FINALIZADA') {
                                               const pAnticipo = (order.forma_pago_anticipo || order.formaPagoAnticipo || '').toLowerCase();
                                               const pSaldo = (order.formaPagoSaldo || order.financials?.formaPagoSaldo || '').toLowerCase();
                                               const isTransfer = pAnticipo.includes('transfer') || pAnticipo.includes('depósito') || pAnticipo.includes('deposito') || 
                                                                  pSaldo.includes('transfer') || pSaldo.includes('depósito') || pSaldo.includes('deposito');
                                                                  
                                               if (isTransfer && localComprobantes.length === 0) {
                                                   toast({title: "Comprobante Requerido", description: "Debe adjuntar la foto de la transferencia o depósito antes de finalizar la orden.", variant: "destructive"});
                                                   setIsAdvancing(false);
                                                   return;
                                               }
                                           }

                                           await onAdvanceWorkflow(order); 
                                           onClose(); 
                                       } catch (error) { setIsAdvancing(false); } 
                                   }}
                                 >
                                   {isAdvancing ? 'Pasando orden...' : workflowConfig.text}
                                   {isAdvancing ? <Loader2 className="h-6 w-6 animate-spin" /> : <ArrowRightCircle className="h-6 w-6" />}
                                 </Button>
                            )}
                            <span className="text-xs text-slate-500 font-medium px-2">
                                {!canAdvance ? '⚠️ Tu rol no permite avanzar esta etapa' : lockToContabilidad ? '⚠️ Debes registrar el cobro del saldo antes de enviar a Contabilidad' : (order.status === 'PRODUCCION' && !allProductsFinished ? '⚠️ Debes finalizar todos los productos en la tabla superior' : workflowConfig.helper)}
                            </span>
                         </div>
                    </div>
                )}
                
                {canArchive && (
                   <div className="mt-8 pt-6 border-t border-slate-200 sticky bottom-0 bg-white/95 backdrop-blur py-4 -mx-6 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-end">
                      <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 py-6 shadow-lg transition-all hover:scale-105 flex items-center gap-3" onClick={() => { onArchiveOrder(order); }}>ARCHIVAR Orden<Archive className="h-6 w-6" /></Button>
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
        </div>
    </>
  );
};

export default OrderDetailsModal;