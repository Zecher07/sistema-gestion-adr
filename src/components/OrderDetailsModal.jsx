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

// --- 🔥 FUNCIÓN PARA LIMPIAR NOTAS DEL PDF 🔥 ---
const getPrintDesc = (prod) => {
    const text = prod.descripcion || prod.nombre || '';
    if (text.includes('[Nota:')) {
        return text.split('[Nota:')[0].trim();
    }
    return text.trim();
};

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

// --- 🔥 MINI-COMPONENTE PARA SUBIR FOTOS POR CADA ABONO/PAGO 🔥 ---
const InlineComprobante = ({ type, abonoIndex, items = [], onAdd, onRemove, isProcessing, canEdit }) => {
    const onDrop = useCallback(files => onAdd(files, type, abonoIndex), [onAdd, type, abonoIndex]);
    const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: {'image/*': []}, disabled: !canEdit || isProcessing });

    return (
        <div className="mt-3 pt-3 border-t border-dashed border-slate-300 w-full">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><FileText className="h-3 w-3"/> Soportes de pago adjuntos</div>
            <div className="flex flex-wrap gap-2 items-center">
                {items.map((img, i) => (
                    <div key={i} className="relative group w-12 h-12 border border-slate-300 bg-slate-50 rounded overflow-hidden shadow-sm cursor-pointer" onClick={() => window.open(img.url, '_blank')}>
                        <img src={img.url} className="w-full h-full object-cover hover:opacity-80 transition-opacity" alt="Comprobante" />
                        {canEdit && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(type, abonoIndex, i); }} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                ))}
                {isProcessing && <div className="w-12 h-12 flex items-center justify-center border border-dashed border-blue-300 bg-blue-50 rounded"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>}
                
                {canEdit && (
                    <div {...getRootProps()} className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded px-2 flex items-center gap-1 text-[10px] font-bold border border-emerald-200 transition-colors h-12 shadow-sm">
                        <input {...getInputProps()} />
                        <Plus className="w-3 h-3" /> {items.length === 0 ? 'Adjuntar' : 'Añadir'}
                    </div>
                )}
            </div>
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

  // 🔥 ESTADOS PARA COMPROBANTES DE PAGO SEPARADOS 🔥
  const [comprobantesData, setComprobantesData] = useState({ anticipo: [], saldo: [], abonos: {} });
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

      const fetchComprobantes = async () => {
          if (!showFinancials) return;
          setLoadingComprobantes(true);
          try {
              const { data } = await supabase.from('ordenes').select('comprobantes').eq('id', order.id).single();
              if (data && data.comprobantes) {
                  if (Array.isArray(data.comprobantes)) {
                      // Migrar datos antiguos al nuevo formato
                      setComprobantesData({ anticipo: data.comprobantes, saldo: [], abonos: {} });
                  } else {
                      setComprobantesData({
                          anticipo: data.comprobantes.anticipo || [],
                          saldo: data.comprobantes.saldo || [],
                          abonos: data.comprobantes.abonos || {}
                      });
                  }
              } else {
                  setComprobantesData({ anticipo: [], saldo: [], abonos: {} });
              }
          } catch (err) {} 
          finally { setLoadingComprobantes(false); }
      };

      fetchImages(); 
      fetchComprobantes();
    }
    
    return () => { document.body.style.overflow = 'unset'; };
  }, [order, showFinancials]);

  // 🔥 LÓGICA PARA SABER SI DEBE PEDIR FOTO 🔥
  const requiresComprobante = (method) => {
      if (!method) return false;
      const m = method.toLowerCase();
      // Si el pago NO es efectivo, NO es "no aplica" y NO es crédito -> Requiere Foto
      return !m.includes('efectivo') && !m.includes('no aplica') && !m.includes('crédito') && !m.includes('credito');
  };

  const handleAddComprobantes = async (files, type, abonoIndex = null) => {
      setIsProcessingComprobantes(true);
      const newImages = [];
      for (const file of files) {
          if (file.size > 15000000) { toast({ title: "Archivo muy grande", variant: "destructive" }); continue; }
          try {
              const compressed = await compressImage(file);
              newImages.push(compressed);
          } catch (e) {}
      }

      const updated = { ...comprobantesData };
      if (type === 'abono') {
          updated.abonos = { ...updated.abonos };
          updated.abonos[abonoIndex] = [...(updated.abonos[abonoIndex] || []), ...newImages];
      } else {
          updated[type] = [...(updated[type] || []), ...newImages];
      }

      setComprobantesData(updated);
      
      try {
          await supabase.from('ordenes').update({ comprobantes: updated }).eq('id', order.id);
          toast({title: "Comprobante de pago guardado"});
      } catch(e) { toast({title: "Error al guardar en base de datos", variant: "destructive"}); }
      setIsProcessingComprobantes(false);
  };

  const removeComprobante = async (type, abonoIndex, imgIndex) => {
      if (!isAdmin && user.role !== 'Contabilidad') return;
      const updated = { ...comprobantesData };
      if (type === 'abono') {
          updated.abonos[abonoIndex] = updated.abonos[abonoIndex].filter((_, i) => i !== imgIndex);
      } else {
          updated[type] = updated[type].filter((_, i) => i !== imgIndex);
      }
      setComprobantesData(updated);

      try {
          await supabase.from('ordenes').update({ comprobantes: updated }).eq('id', order.id);
      } catch(e) {}
  };

  const validSellers = useMemo(() => removeDuplicateUsers(getValidSellers(staffUsers)), [staffUsers]);
  const allProductsFinished = useMemo(() => {
      if (!localProducts || localProducts.length === 0) return true;
      return localProducts.every(p => p.estado_prod === 'FINALIZADO');
  }, [localProducts]);

  const fin = order?.financials || { subtotal: 0, iva: 0, total: 0, saldo: 0, descuentoVal: 0 };
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

  const handlePrint = (type) => { 
      setPrintType(type); 
      setTimeout(() => { window.print(); }, 100); 
  };

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
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

                {/* 🔥 BLOQUE DE TOTALES (ARRIBA) 🔥 */}
                {showFinancials && (
                    <div className="mb-6 flex justify-end">
                        <div className="w-full max-w-sm bg-white border border-slate-300 rounded-sm shadow-sm overflow-hidden">
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm"><div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">SubTotal</div><div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.subtotal)}</div></div>
                            {Number(fin.descuentoVal) > 0 && <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm"><div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">Dscto Total</div><div className="px-4 py-2 text-right text-red-500">-{formatCurrency(fin.descuentoVal)}</div></div>}
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm"><div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">Base Imponible</div><div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.baseImponible || fin.subtotal)}</div></div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm"><div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">IVA ({fin.ivaPercentage || 15}%)</div><div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(fin.iva)}</div></div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200 bg-blue-50 text-base"><div className="px-4 py-3 text-right font-bold text-blue-900">TOTAL</div><div className="px-4 py-3 text-right font-bold text-blue-900">{formatCurrency(fin.total)}</div></div>
                        </div>
                    </div>
                )}

                {showFinancials && (
                    <div className="mb-6 bg-slate-50/50 p-4 border border-slate-200 rounded-lg">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
                            <h3 className="font-bold text-slate-700">Pagos, Abonos y Soportes</h3>
                            {saldoCalculado > 0 && onAbonoOrder && (
                                <Button size="sm" onClick={() => onAbonoOrder(order)} className="bg-green-600 hover:bg-green-700 text-white shadow-sm flex items-center justify-center gap-2">
                                    <DollarSign className="h-4 w-4"/> Registrar Cobro Extra
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* CAJA ANTICIPO ORIGINAL */}
                            <div className="bg-white border border-blue-200 rounded p-4 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2">
                                        <span className="text-blue-800 font-bold text-sm">Anticipo Inicial</span>
                                        <span className="text-lg font-bold text-slate-800">{Number(order.anticipo || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600">
                                         <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-bold text-slate-900 uppercase">{order.formaPagoAnticipo || order.forma_pago_anticipo || '-'}</span></div>
                                         {(order.formaPagoAnticipo === 'Crédito' || order.forma_pago_anticipo === 'Crédito') && (<div className="flex justify-between"><span>Vence:</span> <span>{order.creditoVenceAnticipo || order.credito_vence_anticipo || '-'}</span></div>)}
                                         {(order.notaAnticipo || order.nota_anticipo) && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaAnticipo || order.nota_anticipo}</div>}
                                    </div>
                                </div>
                                
                                {/* COMPROBANTE ANTICIPO */}
                                {requiresComprobante(order.formaPagoAnticipo || order.forma_pago_anticipo) && (
                                    <InlineComprobante 
                                        type="anticipo" 
                                        items={comprobantesData.anticipo || []} 
                                        onAdd={handleAddComprobantes} 
                                        onRemove={removeComprobante} 
                                        isProcessing={isProcessingComprobantes} 
                                        canEdit={isAdmin || user.role === 'Contabilidad' || user.role === 'Vendedor'}
                                    />
                                )}
                            </div>
                            
                            {/* CAJA SALDO PENDIENTE */}
                            <div className="bg-white border border-blue-200 rounded p-4 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2 border-b border-blue-100 pb-2">
                                        <span className="text-blue-800 font-bold text-sm">Saldo Pendiente (Real)</span>
                                        <span className={`text-lg font-bold ${saldoCalculado > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(saldoCalculado)}</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600 mb-2">
                                         <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-bold text-slate-900 uppercase">{order.formaPagoSaldo || fin.formaPagoSaldo || '-'}</span></div>
                                         {isCredito && (<div className="flex justify-between"><span>Vence:</span> <span>{order.creditoVenceSaldo || fin.creditoVenceSaldo || '-'}</span></div>)}
                                         {(order.notaSaldo || fin.notaSaldo) && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaSaldo || fin.notaSaldo}</div>}
                                    </div>
                                </div>

                                {/* COMPROBANTE SALDO */}
                                {requiresComprobante(order.formaPagoSaldo || fin.formaPagoSaldo) && (
                                    <InlineComprobante 
                                        type="saldo" 
                                        items={comprobantesData.saldo || []} 
                                        onAdd={handleAddComprobantes} 
                                        onRemove={removeComprobante} 
                                        isProcessing={isProcessingComprobantes} 
                                        canEdit={isAdmin || user.role === 'Contabilidad' || user.role === 'Vendedor'}
                                    />
                                )}
                            </div>
                        </div>

                        {/* 🔥 SECCIÓN DE ABONOS EXTRAS CON SU PROPIA FOTO 🔥 */}
                        {order.abonos && order.abonos.length > 0 && (
                            <div className="mt-6 border-t border-slate-300 pt-4">
                                <h4 className="font-bold text-slate-700 text-xs mb-3 uppercase">Abonos Extras Registrados</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {order.abonos.map((a, i) => (
                                        <div key={i} className="bg-red-50/50 border border-red-200 rounded p-4 shadow-sm flex flex-col justify-between">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-bold mb-1">{a.fecha ? a.fecha.split('T')[0] : ''}</div>
                                                    <div className="text-xs font-bold text-red-700 uppercase">MÉTODO: {a.metodoPago || a.metodo_pago}</div>
                                                </div>
                                                <div className="font-black text-red-600 text-lg">+{formatCurrency(a.monto)}</div>
                                            </div>
                                            
                                            {/* COMPROBANTE ABONO INDIVIDUAL */}
                                            {requiresComprobante(a.metodoPago || a.metodo_pago) && (
                                                <InlineComprobante 
                                                    type="abono" 
                                                    abonoIndex={i}
                                                    items={(comprobantesData.abonos || {})[i] || []} 
                                                    onAdd={handleAddComprobantes} 
                                                    onRemove={removeComprobante} 
                                                    isProcessing={isProcessingComprobantes} 
                                                    canEdit={isAdmin || user.role === 'Contabilidad' || user.role === 'Vendedor'}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
                                           // 🔥 VALIDACIÓN: Verificar que todas las fotos requeridas estén subidas
                                           const nextStatus = workflowConfig.text.replace('Pasar a ', '').replace(' – ', '').trim();
                                           if (nextStatus === 'FINALIZADA') {
                                               let missing = false;
                                               
                                               if (requiresComprobante(order.formaPagoAnticipo || order.forma_pago_anticipo) && (!comprobantesData.anticipo || comprobantesData.anticipo.length === 0)) missing = true;
                                               if (requiresComprobante(order.formaPagoSaldo || fin.formaPagoSaldo) && (!comprobantesData.saldo || comprobantesData.saldo.length === 0)) missing = true;
                                               
                                               (order.abonos || []).forEach((a, i) => {
                                                   if (requiresComprobante(a.metodoPago || a.metodo_pago) && (!(comprobantesData.abonos || {})[i] || (comprobantesData.abonos || {})[i].length === 0)) {
                                                       missing = true;
                                                   }
                                               });

                                               if (missing) {
                                                   toast({title: "Comprobante Requerido", description: "Faltan subir fotos de transferencias, depósitos o cheques registrados.", variant: "destructive"});
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

        {/* ======================================================== */}
        {/* 2. VISTAS DE IMPRESIÓN (OCULTAS EN PANTALLA)            */}
        {/* ======================================================== */}
        {/* 🔥 ESTE CONTENEDOR ESCONDE EL RESTO DEL DOM AL IMPRIMIR 🔥 */}
        <div id="modal-print-container" className="hidden print:block absolute top-0 left-0 w-full bg-white z-[10000] text-black" style={{ minHeight: '100vh', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #modal-print-container, #modal-print-container * { visibility: visible; }
                    #modal-print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                }
            `}</style>

            {/* ---------------- VISTA SRI (FACTURA) ---------------- */}
            {printType === 'sri' && (
                <div className="w-full max-w-[850px] mx-auto p-4 font-sans text-[11px] leading-snug text-black">
                      <div className="grid grid-cols-2 gap-4 mb-4 w-full">
                          <div className="w-full flex flex-col gap-2">
                              <div className="h-28 w-full flex items-center justify-center rounded-xl mb-1 bg-white overflow-hidden p-2">
                                  <img src="/logo.png" alt="Rótulos ADR" className="max-h-full max-w-full object-contain" />
                              </div>
                              <div className="border border-black rounded-xl p-3">
                                  <div className="font-bold text-[13px] mb-1 uppercase">ADRCOMPANY SAS</div>
                                  <div className="mb-1"><span className="font-bold">Dirección Matriz:</span> AV. ZENON MACIAS 306 Y CALLE LA MERCED • PLAYAS - GUAYAS - ECUADOR</div>
                              </div>
                          </div>

                          <div className="w-full border border-black rounded-xl p-3">
                              <div className="text-sm mb-1"><span className="font-bold">R.U.C.:</span> 0993397285001</div>
                              <div className="text-lg font-bold my-2 tracking-widest">COMPROBANTE ORDEN</div>
                              <div className="mb-2 text-[13px]"><span className="font-bold">No.</span> {formatOrderId(order.id)}</div>
                              
                              <div className="flex justify-between mb-4 mt-4">
                                  <span className="font-bold">FECHA Y HORA DE EMISIÓN:</span>
                                  <span>{formatDateFull(order.createdAt || order.created_at)}</span>
                              </div>
                          </div>
                      </div>

                      <div className="border border-black rounded-xl p-3 mb-4 w-full">
                          <div className="grid grid-cols-[2fr_1fr] gap-4 w-full">
                              <div className="space-y-1">
                                  <div><span className="font-bold">Razón Social / Nombres:</span> <span className="uppercase">{order.cliente || order.cliente_nombre}</span></div>
                                  <div><span className="font-bold">Identificación:</span> {order.ruc || order.cedula || order.cliente_identificacion || '9999999999999'}</div>
                                  <div><span className="font-bold">Fecha:</span> {formatDateFull(order.createdAt || order.created_at).split(' ')[0]}</div>
                                  <div><span className="font-bold">Dirección:</span> {order.direccion || 'S/N'}</div>
                              </div>
                              <div className="space-y-1">
                                  <div><span className="font-bold">Guía Remisión:</span></div>
                                  <div><span className="font-bold">Ref/Proyecto:</span> <span className="uppercase">{order.tipoLetrero || order.tipo_trabajo}</span></div>
                              </div>
                          </div>
                      </div>

                      {/* 🔥 TABLA DE PRODUCTOS RESTAURADA 🔥 */}
                      <div className="mb-4 w-full min-h-[150px]">
                          <table className="w-full border-collapse border border-black">
                              <thead>
                                  <tr className="border-b border-black bg-gray-100">
                                      <th className="border-r border-black p-1.5 font-bold text-center w-16">Cod. Principal</th>
                                      <th className="border-r border-black p-1.5 font-bold text-center w-12">Cant.</th>
                                      <th className="border-r border-black p-1.5 font-bold text-left">Descripción</th>
                                      <th className="border-r border-black p-1.5 font-bold text-right w-20">Precio Unitario</th>
                                      <th className="border-r border-black p-1.5 font-bold text-right w-16">Descuento</th>
                                      <th className="p-1.5 font-bold text-right w-20">Precio Total</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {localProducts.map((prod, idx) => (
                                      <tr key={idx} className="border-b border-black">
                                          <td className="border-r border-black p-1.5 text-center">P{String(idx+1).padStart(3,'0')}</td>
                                          <td className="border-r border-black p-1.5 text-center">{prod.cantidad}</td>
                                          <td className="border-r border-black p-1.5 uppercase whitespace-pre-wrap">{getPrintDesc(prod)}</td>
                                          <td className="border-r border-black p-1.5 text-right">{formatCurrency(prod.precio || prod.precioUnitario)}</td>
                                          <td className="border-r border-black p-1.5 text-right">$0.00</td>
                                          <td className="p-1.5 text-right">{formatCurrency(prod.total || (prod.cantidad * (prod.precio || prod.precioUnitario)))}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      <div className="grid grid-cols-3 gap-4 w-full items-start">
                          <div className="col-span-2 flex flex-col gap-4 w-full">
                              <div className="border border-black rounded-xl p-0 overflow-hidden w-full">
                                  <div className="border-b border-black p-2 bg-gray-100 font-bold">Información Adicional</div>
                                  <div className="p-3 grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5">
                                      <span className="font-bold">Email:</span> <span>imprenta_milena@hotmail.com</span>
                                      <span className="font-bold">Teléfono:</span> <span>+593 98 265 7066</span>
                                      <span className="font-bold">Vendedor:</span> <span>{localVendedor || 'Sistema'}</span>
                                      <span className="font-bold">F. Entrega:</span> <span>{order.fechaEntrega || order.fecha_entrega ? (order.fechaEntrega || order.fecha_entrega).split('T')[0] : 'Por Definir'}</span>
                                      <span className="font-bold">N° Proforma:</span> <span>{order.origenProformaInfo || order.origenProformaId ? `#${order.origenProformaInfo || order.origenProformaId}` : 'NO'}</span>
                                      <span className="font-bold">N° Factura:</span> <span>{order.numeroFactura || order.facturaNumber || order.invoiceNumber || order.numero_factura || 'PENDIENTE'}</span>
                                      <span className="font-bold">F. Finalizada:</span> <span>{isFinalizada ? formatDateFull(order.updatedAt || order.updated_at) : 'EN PROCESO'}</span>

                                      {/* Las notas generales SOLO se muestran en SRI si existen */}
                                      {order.notas && (
                                          <>
                                              <span className="font-bold mt-1">Notas:</span>
                                              <span className="whitespace-pre-line mt-1">{order.notas}</span>
                                          </>
                                      )}
                                  </div>
                              </div>

                              <div className="border border-black rounded-xl overflow-hidden w-full">
                                  <table className="w-full text-left border-collapse">
                                      <thead>
                                          <tr className="border-b border-black bg-gray-100">
                                              <th className="p-2 font-bold border-r border-black w-[70%]">Formas de Pago</th>
                                              <th className="p-2 font-bold text-right w-[30%]">Valor</th>
                                      </tr>
                                      </thead>
                                      <tbody>
                                          <tr className="border-b border-black">
                                              <td className="p-2 border-r border-black uppercase text-[10px]">ANTICIPO - {order.formaPagoAnticipo || order.forma_pago_anticipo || 'EFECTIVO'}</td>
                                              <td className="p-2 text-right font-bold">{formatCurrency(order.anticipo || 0)}</td>
                                          </tr>
                                          {order.abonos && order.abonos.map((a, i) => (
                                              <tr key={i} className="border-b border-black text-red-700">
                                                  <td className="p-2 border-r border-black uppercase text-[10px]">ABONO {i+1} - {a.metodoPago || a.metodo_pago}</td>
                                                  <td className="p-2 text-right font-bold">{formatCurrency(a.monto)}</td>
                                              </tr>
                                          ))}
                                          <tr>
                                              <td className="p-2 border-r border-black uppercase text-[10px] text-red-700">SALDO PENDIENTE - {order.formaPagoSaldo || 'EFECTIVO'}</td>
                                              <td className="p-2 text-right font-bold text-red-600">{formatCurrency(saldoCalculado)}</td>
                                          </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </div>

                          <div className="col-span-1 w-full">
                              <table className="w-full border-collapse border border-black text-[11px]">
                                  <tbody>
                                      <tr className="border-b border-black">
                                          <td className="p-1.5 border-r border-black">SUBTOTAL {fin.ivaPercentage || 15}%</td>
                                          <td className="p-1.5 text-right">{formatCurrency(fin.subtotal || 0)}</td>
                                      </tr>
                                      <tr className="border-b border-black">
                                          <td className="p-1.5 border-r border-black">SUBTOTAL 0%</td>
                                          <td className="p-1.5 text-right">$0.00</td>
                                      </tr>
                                      <tr className="border-b border-black">
                                          <td className="p-1.5 border-r border-black">SUBTOTAL SIN IMP.</td>
                                          <td className="p-1.5 text-right">{formatCurrency(fin.subtotal || 0)}</td>
                                      </tr>
                                      <tr className="border-b border-black">
                                          <td className="p-1.5 border-r border-black">TOTAL Descuento</td>
                                          <td className="p-1.5 text-right">{formatCurrency(fin.descuentoVal || 0)}</td>
                                      </tr>
                                      <tr className="border-b border-black bg-gray-50">
                                          <td className="p-1.5 border-r border-black font-bold">IVA {fin.ivaPercentage || 15}%</td>
                                          <td className="p-1.5 text-right font-bold">{formatCurrency(fin.iva || 0)}</td>
                                      </tr>
                                      <tr>
                                          <td className="p-1.5 border-r border-black font-bold text-sm">VALOR TOTAL</td>
                                          <td className="p-1.5 text-right font-bold text-sm">{formatCurrency(fin.total || 0)}</td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      </div>
                </div>
            )}

            {/* ---------------- VISTA PRODUCCIÓN ---------------- */}
            {printType === 'produccion' && (
                <div className="w-full max-w-[850px] mx-auto p-4 md:p-6 font-sans text-black">
                    <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
                        <div className="w-40">
                             <img src="/logo.png" alt="Logo" className="max-w-full h-auto object-contain" />
                        </div>
                        <div className="text-right">
                             <h1 className="text-xl font-black tracking-widest text-slate-900 mb-1 uppercase">Orden de Producción</h1>
                             <div className="text-lg font-bold text-slate-800">N° ORDEN: {formatOrderId(order.id)}</div>
                             <div className="text-[11px] font-bold text-slate-700 mt-1">FECHA INGRESO: {formatDateFull(order.createdAt || order.created_at).split(' ')[0]}</div>
                        </div>
                    </div>

                    <div className="border-2 border-black rounded-lg p-3 mb-6 bg-gray-50">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                             <div><span className="font-bold">CLIENTE:</span> <span className="uppercase">{order.cliente || order.cliente_nombre}</span></div>
                             <div><span className="font-bold">FECHA ENTREGA:</span> <span className="font-bold uppercase">{order.fechaEntrega ? order.fechaEntrega.split('T')[0] : 'Por Definir'}</span></div>
                             
                             <div><span className="font-bold">TÍTULO/PROYECTO:</span> <span className="uppercase text-sm font-bold">{order.tipoLetrero || order.tipo_trabajo}</span></div>
                             <div><span className="font-bold">VENDEDOR:</span> <span className="uppercase">{localVendedor || 'SISTEMA'}</span></div>
                             
                             <div><span className="font-bold">VIENE DE PROFORMA:</span> <span className="uppercase">{order.origenProformaInfo || order.origenProformaId ? `#${order.origenProformaInfo || order.origenProformaId}` : 'NO'}</span></div>
                             <div><span className="font-bold">N° FACTURA:</span> <span className="uppercase">{order.numeroFactura || order.facturaNumber || order.invoiceNumber || order.numero_factura || 'PENDIENTE'}</span></div>
                             
                             <div><span className="font-bold">FECHA FINALIZACIÓN:</span> <span className="uppercase">{isFinalizada ? formatDateFull(order.updatedAt || order.updated_at) : 'EN PRODUCCIÓN'}</span></div>
                             <div></div>
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
                                {localProducts.map((prod, idx) => (
                                    <tr key={idx} className="border-b border-black">
                                        <td className="border-r-2 border-black p-2 text-center font-bold text-base align-middle">{prod.cantidad}</td>
                                        <td className="border-r-2 border-black p-2 uppercase font-medium whitespace-pre-wrap text-xs align-top">
                                            {getPrintDesc(prod)}
                                        </td>
                                        <td className="border-r-2 border-black p-2 font-medium align-middle">
                                            <div className="flex justify-between w-full"><span>$</span> <span>{Number(prod.precio || prod.precioUnitario).toFixed(2)}</span></div>
                                        </td>
                                        <td className="p-2 font-bold align-middle">
                                            <div className="flex justify-between w-full"><span>$</span> <span>{Number(prod.total || (prod.cantidad * (prod.precio || prod.precioUnitario))).toFixed(2)}</span></div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex border-2 border-black text-xs bg-white mb-8" style={{ pageBreakInside: 'avoid' }}>
                        
                        {/* ABONOS Y SALDOS DETALLADOS */}
                        <div className="flex-1 border-r-2 border-black p-4 flex flex-col justify-center gap-3">
                            <div className="flex justify-between items-center border-b border-dashed border-gray-400 pb-1">
                                <span className="font-bold text-sm text-slate-700">ANTICIPO INICIAL:</span>
                                <span className="font-bold text-sm text-slate-800">{formatCurrency(anticipoVal)}</span>
                            </div>
                            
                            {order.abonos && order.abonos.map((a, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-dashed border-red-300 pb-1 text-red-700">
                                    <span className="font-bold">ABONO {i+1} ({a.fecha ? a.fecha.split('T')[0] : ''}):</span>
                                    <span className="font-bold">{formatCurrency(a.monto)}</span>
                                </div>
                            ))}

                            <div className="flex justify-between items-center pt-2">
                                <span className="font-black text-base text-red-600">SALDO PENDIENTE:</span>
                                <span className="font-black text-base text-red-600">{formatCurrency(saldoCalculado)}</span>
                            </div>
                        </div>

                        {/* DESGLOSE FINANCIERO */}
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
                                <span className="font-bold">IVA {fin.ivaPercentage || 15}%</span>
                                <span className="font-medium">{formatCurrency(fin.iva)}</span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-gray-200 h-full">
                                <span className="font-black text-sm">TOTAL</span>
                                <span className="font-black text-sm">{formatCurrency(fin.total)}</span>
                            </div>
                        </div>
                    </div>

                    {localImages.length > 0 && (
                        <div className="mt-6 border-2 border-black rounded-lg p-3" style={{ pageBreakInside: 'avoid' }}>
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
            )}
        </div>
    </>
  );
};

export default OrderDetailsModal;