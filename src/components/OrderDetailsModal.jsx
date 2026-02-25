import React, { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Image as ImageIcon, ArrowRightCircle, Archive, Edit2, FileText, Ban, ExternalLink, User, Calendar, FileBox, CheckCircle2, PlayCircle, Loader2, Package, Plus, Info, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import StatusBadge from '@/components/StatusBadge';
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

const WORKFLOW_VPVC = ['VENTAS', 'PRODUCCION', 'VENTAS POR RETIRAR', 'CONTABILIDAD', 'FINALIZADA'];
const WORKFLOW_VC = ['VENTAS', 'CONTABILIDAD', 'FINALIZADA'];

const ImageGalleryViewer = memo(({ images, onPreview }) => {
    if (!images || images.length === 0) {
        return (
            <div className="flex flex-col items-center text-slate-400">
                <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
                <span className="italic">Sin imágenes adjuntas</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full">
            {images.map((img, i) => (
                <div 
                    key={i} 
                    className="group relative bg-white border border-slate-200 p-2 rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-all" 
                    onClick={() => onPreview(img.url)}
                >
                    <div className="aspect-square w-full overflow-hidden rounded bg-slate-100 mb-2 relative">
                        <img 
                            src={img.url} 
                            alt={img.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                            loading="lazy" 
                            decoding="async" 
                        />
                    </div>
                    <p className="text-xs text-slate-600 truncate text-center font-medium" title={img.name}>
                        {img.name}
                    </p>
                </div>
            ))}
        </div>
    );
});

const OrderDetailsModal = ({ 
  order, 
  user, 
  staffUsers = [],
  onClose, 
  isTaskView, 
  onAdvanceWorkflow, 
  onArchiveOrder,
  onUpdateOrder, 
  onGenerateInvoice,
  onAnulateOrder,
  canAnulate,
  canEdit
}) => {
  const [previewImage, setPreviewImage] = useState(null);
  const [showAnulateAlert, setShowAnulateAlert] = useState(false);
  
  const [localProdState, setLocalProdState] = useState('Pendiente');
  const [isUpdatingProd, setIsUpdatingProd] = useState(false);
  
  const [inventory, setInventory] = useState([]);
  const [usedMaterials, setUsedMaterials] = useState([]);
  const [materialQty, setMaterialQty] = useState('');
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);

  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showMaterialSuggestions, setShowMaterialSuggestions] = useState(false);

  const { toast } = useToast();
  const isAdmin = user?.role === 'Administrador';

  useEffect(() => {
    if (order) {
      document.body.style.overflow = 'hidden';
      setLocalProdState(order.estado_produccion || 'Pendiente');
      
      let mats = [];
      if (typeof order.materiales_usados === 'string') {
          try { mats = JSON.parse(order.materiales_usados); } catch(e) {}
      } else if (Array.isArray(order.materiales_usados)) {
          mats = order.materiales_usados;
      }
      setUsedMaterials(mats);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [order]);

  useEffect(() => {
      if (order && (user.role === 'Producción' || isAdmin)) {
          const fetchInventory = async () => {
              try {
                  const { data } = await supabase.from('inventario').select('*').order('nombre');
                  if (data) setInventory(data);
              } catch (e) {
                  console.error("Error al cargar inventario:", e);
              }
          };
          fetchInventory();
      }
  }, [order, user, isAdmin]);

  const validSellers = useMemo(() => {
     const sellers = getValidSellers(staffUsers);
     return removeDuplicateUsers(sellers);
  }, [staffUsers]);

  const canAdvanceWorkflow = useMemo(() => {
      if (!order) return false;
      
      const isAnulada = order.status === 'ANULADA';
      const isArchivada = order.status === 'ARCHIVADA';
      const isFinalizada = order.status === 'FINALIZADA';

      if (isAnulada || isArchivada || isFinalizada) return false;
      
      const role = user?.role;
      const status = order.status;

      if (role === 'Administrador') return true;

      switch (status) {
          case 'VENTAS': return role === 'Vendedor';
          case 'PRODUCCION': return role === 'Producción';
          case 'VENTAS POR RETIRAR': return role === 'Vendedor';
          case 'CONTABILIDAD': return role === 'Contabilidad';
          default: return false;
      }
  }, [order, user]);

  if (!order) return null;

  const data = {
      titulo: order.tipoLetrero || order.tipoOrden || order.tipo_trabajo || order.titulo || 'Sin Título',
      cliente: order.cliente || order.cliente_nombre || order.nombre_cliente || 'Cliente Desconocido',
      ruc: order.ruc || order.cedula || order.identificacion || order.empresa || '', 
      autor: order.vendedor || order.responsable || order.user || 'Sin asignar',
      fechaCreacion: order.createdAt || order.created_at || new Date().toISOString(),
      fechaEntrega: order.fechaEntrega || order.fecha_entrega,
      fechaFinaliz: order.status === 'FINALIZADA' ? (order.updatedAt || order.updated_at) : null,
      descripcion: order.descripcion || order.notas || order.observaciones || '',
      financials: {
          total: Number(order.financials?.total || order.total || 0),
          saldo: Number(order.financials?.saldo || order.saldo || 0),
          subtotal: Number(order.financials?.subtotal || order.subtotal || 0),
          iva: Number(order.financials?.iva || order.iva || 0),
          descuentoVal: Number(order.financials?.descuentoVal || 0),
          descuentoPorcentaje: Number(order.financials?.descuentoPorcentaje || 0),
          ivaPercentage: Number(order.financials?.ivaPercentage || 15)
      },
      anticipo: Number(order.anticipo || 0),
      retencion: Number(order.retencion || 0),
      productos: order.products || order.productos || [],
      imagenes: order.imagenes || []
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const formatDateFull = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '-';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (e) { return '-'; }
  };

  const formatOrderId = (id) => {
      const val = order.orderNumber || order.order_number || id;
      return String(val).padStart(7, '0');
  };
  
  const isAnulada = order.status === 'ANULADA';
  const isArchivada = order.status === 'ARCHIVADA';
  const isFinalizada = order.status === 'FINALIZADA';

  const canArchive = isAdmin && isFinalizada;
  const canInvoice = !isAnulada && (user.role === 'Vendedor' || user.role === 'Contabilidad' || user.role === 'Administrador');
    
  const isProductionView = order.status === 'PRODUCCION' && (user.role === 'Producción' || isAdmin);
  
  const showWorkflowButton = canAdvanceWorkflow && (!isProductionView || localProdState === 'Finalizado');

  const getWorkflowButtonConfig = () => {
     const tipo = data.titulo || ''; 
     const isVC = tipo.includes('(VC)');
     const workflow = isVC ? WORKFLOW_VC : WORKFLOW_VPVC;
     const currentIndex = workflow.indexOf(order.status);
     if (currentIndex === -1 || currentIndex >= workflow.length - 1) return { text: 'Continuar', helper: '' };
     const nextStatus = workflow[currentIndex + 1];
     let text = `Pasar a ${nextStatus}`;
     
     if (order.status === 'VENTAS') text = nextStatus === 'PRODUCCION' ? "Enviar a Producción" : "Enviar a Contabilidad";
     if (order.status === 'PRODUCCION') text = `Pasar a Ventas – ${data.autor}`;
     if (order.status === 'VENTAS POR RETIRAR') text = "Entregar / Enviar a Contabilidad";
     if (order.status === 'CONTABILIDAD') text = "Finalizar Orden";
     
     return { text, helper: `Siguiente paso: ${nextStatus}` };
  };

  const workflowConfig = getWorkflowButtonConfig();

  const filteredInventory = inventory.filter(inv => inv.nombre.toLowerCase().includes(materialSearch.toLowerCase()));

  // 🔥 LÓGICA DE GUARDADO INVERTIDA Y BLINDADA 🔥
  const handleAddMaterial = async () => {
      if (!selectedMaterial || !materialQty || parseFloat(materialQty) <= 0) {
          toast({ title: "Error", description: "Selecciona un material de la lista y pon una cantidad válida.", variant: "destructive" });
          return;
      }

      setIsSavingMaterial(true);
      try {
          const qtyNum = parseFloat(materialQty);
          const newInventoryQty = Number(selectedMaterial.cantidad) - qtyNum;

          const newUsage = {
              id: Date.now().toString(),
              materialId: selectedMaterial.id,
              nombre: selectedMaterial.nombre,
              unidad: selectedMaterial.unidad || 'Unidades',
              cantidad: qtyNum,
              registradoPor: user.name,
              fecha: new Date().toISOString()
          };
          
          const updatedMaterials = [...usedMaterials, newUsage];

          // 1. PRIMERO INTENTAMOS GUARDAR EN LA ORDEN 
          const { error: ordError } = await supabase.from('ordenes').update({ materiales_usados: updatedMaterials }).eq('id', order.id);
          if (ordError) throw ordError;

          // 2. SI LA ORDEN SE GUARDÓ CON ÉXITO, ENTONCES SÍ DESCONTAMOS EL INVENTARIO
          const { error: invError } = await supabase.from('inventario').update({ cantidad: newInventoryQty }).eq('id', selectedMaterial.id);
          if (invError) throw invError;

          // 3. ACTUALIZAMOS LA PANTALLA
          setUsedMaterials(updatedMaterials);
          order.materiales_usados = updatedMaterials;
          setInventory(inventory.map(i => i.id === selectedMaterial.id ? { ...i, cantidad: newInventoryQty } : i));
          
          setSelectedMaterial(null);
          setMaterialSearch('');
          setMaterialQty('');
          toast({ title: "Gasto Registrado", description: `Se descontaron ${qtyNum} ${selectedMaterial.unidad} de ${selectedMaterial.nombre}.`, className: "bg-green-500 text-white" });

      } catch (error) {
          console.error(error);
          toast({ 
              title: "Error de Caché en Base de Datos", 
              description: "Por favor limpia el caché en Supabase (Settings > API > Rebuild Schema Cache) o verifica que la columna 'materiales_usados' esté creada.", 
              variant: "destructive" 
          });
      } finally {
          setIsSavingMaterial(false);
      }
  };

  const handleToggleProduction = async (newState) => {
      if (newState === 'Finalizado' && usedMaterials.length === 0) {
          toast({ 
              title: "⚠️ Registro de Materiales Obligatorio", 
              description: "No puedes finalizar la producción sin registrar qué materiales utilizaste en el panel de 'Materiales Consumidos'.", 
              variant: "destructive" 
          });
          return; 
      }

      setIsUpdatingProd(true);
      try {
          const { error } = await supabase.from('ordenes').update({ estado_produccion: newState }).eq('id', order.id);
          if (error) throw error;
          
          order.estado_produccion = newState;
          setLocalProdState(newState); 
          toast({ title: "Producción", description: `Estado cambiado a: ${newState}` });
      } catch (error) {
          toast({ title: "Error", description: "No se guardó el estado.", variant: "destructive" });
      } finally {
          setIsUpdatingProd(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end items-stretch">
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose}
        />

        <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-[1200px] h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col z-10"
            onClick={e => e.stopPropagation()}
        >
            {isAnulada && (
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <div className="text-red-500/10 font-bold text-[10vw] rotate-[-30deg] border-[8px] border-red-500/10 px-10 py-5 uppercase whitespace-nowrap select-none">ANULADA</div>
              </div>
            )}

            <div className="bg-[#1e3a8a] text-white px-6 py-3 flex justify-between items-center text-xs print:hidden shrink-0 relative z-10">
                <span className="font-bold text-sm">Detalles de Orden</span>
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors"><X className="h-4 w-4 text-white" /></button>
                </div>
            </div>

            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 relative z-10 shadow-sm print:static">
                <div className="flex items-center gap-4 text-blue-600 whitespace-nowrap overflow-x-auto max-w-full">
                    <span className="font-bold text-slate-900 text-2xl mx-2 flex items-center gap-2">
                       <FileBox className="h-6 w-6 text-slate-400"/>
                       Orden: <span className="font-mono text-blue-700">#{formatOrderId(order.id)}</span>
                    </span>
                    <StatusBadge status={order.status} />
                </div>
                <div className="flex items-center gap-3 print:hidden">
                    
                    {(canEdit || isAdmin) && !isAnulada && !isArchivada && (
                        <Button size="sm" variant="outline" onClick={() => onUpdateOrder(order)} className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 gap-2">
                            <Edit2 className="h-4 w-4" /> Editar
                        </Button>
                    )}

                    {(canAnulate || isAdmin) && !isAnulada && !isArchivada && (
                        <Button size="sm" variant="destructive" onClick={() => setShowAnulateAlert(true)} className="bg-red-500 hover:bg-red-600 text-white gap-2">
                            <Ban className="h-4 w-4" /> Anular
                        </Button>
                    )}

                    {canInvoice && onGenerateInvoice && (
                       <Button size="sm" onClick={() => onGenerateInvoice(order)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                          <FileText className="h-4 w-4" /> Factura
                       </Button>
                    )}
                    <Button size="sm" className="bg-[#3b82f6] hover:bg-blue-600 text-white gap-2" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" /> Imprimir
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2" onClick={onClose}>
                        <X className="h-4 w-4" /> Cerrar
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 w-full relative z-0 flex flex-col bg-slate-50/30">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
                            <span className="font-bold text-right text-slate-500 flex items-center justify-end gap-2"><FileText className="h-3 w-3"/> Titulo:</span>
                            <span className="uppercase font-bold text-slate-800 text-base leading-tight break-words">{data.titulo}</span>
                        </div>
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                            <span className="font-bold text-right text-slate-500 flex items-center justify-end gap-2"><User className="h-3 w-3"/> Autor:</span>
                            <span className="text-slate-900 font-medium bg-slate-100 px-2 py-0.5 rounded">{data.autor}</span>
                        </div>
                        <div className="grid grid-cols-[140px_1fr] gap-2 mt-4 items-start">
                            <span className="font-bold text-right text-slate-500 flex items-center justify-end gap-2"><User className="h-3 w-3"/> Cliente:</span>
                            <div>
                                <div className="text-blue-700 font-bold uppercase text-base">{data.cliente}</div>
                                {data.ruc && <div className="text-xs text-slate-500 font-mono bg-slate-100 inline-block px-1 rounded mt-1">RUC/ID: {data.ruc}</div>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-[140px_1fr] gap-2">
                            <span className="font-bold text-right text-slate-500 flex items-center justify-end gap-2"><Calendar className="h-3 w-3"/> Fecha:</span>
                            <span className="text-slate-900">{formatDateFull(data.fechaCreacion)}</span>
                        </div>
                        <div className="grid grid-cols-[140px_1fr] gap-2">
                            <span className="font-bold text-right text-slate-500 flex items-center justify-end gap-2"><Calendar className="h-3 w-3"/> Entrega:</span>
                            <span className="text-red-600 font-bold text-base">{formatDateFull(data.fechaEntrega)}</span>
                        </div>
                        <div className="grid grid-cols-[140px_1fr] gap-2 items-center">
                            <span className="font-bold text-right text-slate-500">Fecha Finaliz:</span>
                            <div>
                                {isAnulada ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">🚫 ANULADA</span>
                                ) : data.fechaFinaliz ? (
                                    <span className="text-slate-900 font-medium">{formatDateFull(data.fechaFinaliz)}</span>
                                ) : (
                                    <span className="text-slate-400 italic">En proceso...</span>
                                )}
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="font-bold text-slate-600 text-sm block mb-1">Observaciones:</span>
                            <div className="border border-yellow-200 rounded-md p-3 min-h-[60px] bg-yellow-50/50 text-sm text-slate-700 w-full whitespace-pre-wrap">
                                {data.descripcion || <span className="text-slate-400 italic">Sin observaciones registradas.</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                      <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><FileText className="h-4 w-4"/> Detalle de Productos Vendidos</h3>
                      <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-[#003366] text-white">
                                <tr>
                                    <th className="px-4 py-2 text-left font-bold w-16">#</th>
                                    <th className="px-4 py-2 text-left font-bold">Descripción</th>
                                    <th className="px-4 py-2 text-right font-bold w-32">Unitario</th>
                                    <th className="px-4 py-2 text-center font-bold w-24">Cant.</th>
                                    <th className="px-4 py-2 text-right font-bold w-32">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {data.productos.map((prod, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-center text-slate-500">{idx + 1}</td>
                                        <td className="px-4 py-3 font-medium uppercase">{prod.descripcion || prod.detalle}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{Number(prod.precio || prod.precioUnitario).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-center text-slate-600">{prod.cantidad}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency((prod.precio || prod.precioUnitario) * prod.cantidad)}</td>
                                    </tr>
                                ))}
                                {data.productos.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-slate-400 italic">No hay productos registrados</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mb-8 bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                    <h3 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-600"/> Registro de Materiales Consumidos
                    </h3>
                    
                    {usedMaterials.length > 0 ? (
                        <div className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Material de Bodega</th>
                                        <th className="px-4 py-2 text-center w-32">Cantidad Gastada</th>
                                        <th className="px-4 py-2 text-left w-40">Operario</th>
                                        <th className="px-4 py-2 text-left w-40">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {usedMaterials.map(mat => (
                                        <tr key={mat.id} className="hover:bg-orange-50/30">
                                            <td className="px-4 py-3 font-bold text-slate-800 uppercase">{mat.nombre}</td>
                                            <td className="px-4 py-3 text-center font-bold text-orange-600 text-lg">
                                                {mat.cantidad} <span className="text-xs text-slate-500 font-normal lowercase">{mat.unidad}</span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 flex items-center gap-1"><User className="h-3 w-3"/> {mat.registradoPor}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{formatDateFull(mat.fecha)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-sm text-slate-500 italic mb-4 bg-slate-50 p-4 rounded-md border border-dashed border-slate-300 flex items-center gap-3">
                            <Info className="h-5 w-5 text-blue-400" />
                            Aún no se han registrado materiales de inventario en esta orden.
                        </div>
                    )}

                    {localProdState !== 'Finalizado' && (user.role === 'Producción' || isAdmin) && order.status === 'PRODUCCION' && (
                        <div className="bg-orange-50/50 border border-orange-200 rounded-lg p-5 flex flex-col md:flex-row gap-4 items-end shadow-inner relative">
                            
                            <div className="flex-1 w-full relative">
                                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">Descontar del Inventario:</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="Escribe para buscar material..."
                                        className={`w-full border border-slate-300 rounded-md py-2 pl-9 pr-8 text-sm focus:border-orange-500 outline-none ${selectedMaterial ? 'bg-orange-100 font-bold text-orange-800' : 'bg-white'}`}
                                        value={selectedMaterial ? selectedMaterial.nombre : materialSearch}
                                        onChange={(e) => {
                                            setMaterialSearch(e.target.value);
                                            setSelectedMaterial(null);
                                            setShowMaterialSuggestions(true);
                                        }}
                                        onFocus={() => setShowMaterialSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowMaterialSuggestions(false), 200)}
                                    />
                                    {selectedMaterial && <Check className="absolute right-3 top-2.5 h-4 w-4 text-green-600" />}
                                </div>
                                
                                {showMaterialSuggestions && materialSearch && !selectedMaterial && filteredInventory.length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-300 rounded-md shadow-2xl max-h-48 overflow-y-auto">
                                        {filteredInventory.map(inv => (
                                            <div 
                                                key={inv.id} 
                                                className={`px-4 py-2 text-sm border-b border-slate-100 cursor-pointer ${inv.cantidad <= 0 ? 'bg-slate-100 opacity-50' : 'hover:bg-orange-50'}`}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    if (inv.cantidad > 0) setSelectedMaterial(inv);
                                                }}
                                            >
                                                <div className="font-bold text-slate-800">{inv.nombre}</div>
                                                <div className="text-xs text-slate-500">Disp: {inv.cantidad} {inv.unidad}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="w-full md:w-32">
                                <label className="text-xs font-bold text-slate-700 block mb-1 uppercase tracking-wider">Cantidad:</label>
                                <input 
                                    type="number" 
                                    min="0.01" 
                                    step="0.01" 
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white text-center focus:border-orange-500 outline-none"
                                    value={materialQty}
                                    onChange={(e) => setMaterialQty(e.target.value)}
                                    placeholder="Ej: 2.5"
                                />
                            </div>
                            <Button 
                                onClick={handleAddMaterial} 
                                disabled={isSavingMaterial || !selectedMaterial || !materialQty}
                                className="bg-orange-600 hover:bg-orange-700 text-white gap-2 w-full md:w-auto font-bold h-[38px]"
                            >
                                {isSavingMaterial ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4" />} Descontar
                            </Button>
                        </div>
                    )}
                </div>

                <div className="mb-8 bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                    <h3 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">Estado Financiero</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 border border-blue-100 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2 border-b border-blue-200/50 pb-2">
                                 <span className="text-blue-800 font-bold text-sm">Anticipo</span>
                                 <span className="text-lg font-bold text-slate-800">{formatCurrency(data.anticipo)}</span>
                            </div>
                            <div className="space-y-1 text-xs text-slate-600">
                                 <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-medium text-slate-900">{order.formaPagoAnticipo || '-'}</span></div>
                                 {order.formaPagoAnticipo === 'Crédito' && <div className="flex justify-between"><span>Vence:</span> <span>{order.creditoVenceAnticipo || '-'}</span></div>}
                                 {order.notaAnticipo && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaAnticipo}</div>}
                            </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col justify-center items-center">
                            <span className="text-slate-500 font-bold text-sm mb-1">Retención</span>
                            <span className="text-2xl font-bold text-slate-700">{formatCurrency(data.retencion)}</span>
                        </div>
                        <div className={`bg-slate-50 border rounded-lg p-4 ${data.financials.saldo > 0.01 ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}`}>
                            <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2">
                                 <span className="text-slate-700 font-bold text-sm">Saldo Pendiente</span>
                                 <span className={`text-lg font-bold ${data.financials.saldo > 0.01 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(data.financials.saldo)}</span>
                            </div>
                            <div className="space-y-1 text-xs text-slate-600">
                                 <div className="flex justify-between"><span>Forma Pago:</span> <span className="font-medium text-slate-900">{order.formaPagoSaldo || '-'}</span></div>
                                 {order.formaPagoSaldo === 'Crédito' && <div className="flex justify-between"><span>Vence:</span> <span>{order.creditoVenceSaldo || '-'}</span></div>}
                                 {order.notaSaldo && <div className="mt-1 p-1 bg-yellow-50 text-yellow-800 rounded border border-yellow-100">{order.notaSaldo}</div>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-8 flex justify-end">
                    <div className="w-full max-w-sm bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
                        <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                             <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">SubTotal</div>
                             <div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(data.financials.subtotal)}</div>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                             <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">Dscto ({Math.round(data.financials.descuentoPorcentaje || 0)}%)</div>
                             <div className="px-4 py-2 text-right text-red-600">- {formatCurrency(data.financials.descuentoVal || 0)}</div>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 text-sm">
                             <div className="px-4 py-2 text-right bg-slate-50 font-semibold text-slate-600">IVA ({Math.round(data.financials.ivaPercentage || 15)}%)</div>
                             <div className="px-4 py-2 text-right font-medium text-slate-900">{formatCurrency(data.financials.iva)}</div>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-slate-200 bg-blue-600 text-white text-base">
                             <div className="px-4 py-3 text-right font-bold">TOTAL</div>
                             <div className="px-4 py-3 text-right font-bold">{formatCurrency(data.financials.total)}</div>
                        </div>
                    </div>
                </div>

                <hr className="border-gray-200 mb-8" />

                <div className="pb-8">
                    <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><ImageIcon className="h-4 w-4"/> Arte / Archivos Adjuntos</h3>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 min-h-[250px] flex items-center justify-center bg-white">
                        <ImageGalleryViewer images={data.imagenes} onPreview={setPreviewImage} />
                    </div>
                </div>
            </div>

            <div className="bg-white border-t border-slate-200 p-6 flex justify-end gap-3 shrink-0 relative z-20">
                
                {isProductionView && localProdState !== 'Finalizado' && (
                    <div className="flex flex-col items-end gap-1">
                        {localProdState === 'Pendiente' ? (
                            <Button 
                                size="lg" 
                                disabled={isUpdatingProd}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg px-8 shadow-lg flex items-center gap-3" 
                                onClick={() => handleToggleProduction('En Proceso')}
                            >
                                {isUpdatingProd ? <Loader2 className="h-6 w-6 animate-spin"/> : <PlayCircle className="h-6 w-6" />} INICIAR PRODUCCIÓN
                            </Button>
                        ) : (
                            <Button 
                                size="lg" 
                                disabled={isUpdatingProd}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 shadow-lg flex items-center gap-3" 
                                onClick={() => handleToggleProduction('Finalizado')}
                            >
                                {isUpdatingProd ? <Loader2 className="h-6 w-6 animate-spin"/> : <CheckCircle2 className="h-6 w-6" />} FINALIZAR PRODUCCIÓN
                            </Button>
                        )}
                        <span className="text-xs text-slate-500 font-medium px-2">
                            {localProdState === 'Pendiente' ? 'Haz clic para comenzar a trabajar' : 'Asegúrate de descontar los materiales primero'}
                        </span>
                    </div>
                )}

                {/* 🔥 BOTÓN CON CIERRE AUTOMÁTICO 🔥 */}
                {showWorkflowButton && (
                    <div className="flex flex-col items-end gap-1">
                      <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white font-bold text-lg px-8 shadow-lg flex items-center gap-3" onClick={() => {
                          // Solo avanzamos en la DB y cerramos ventana. NO tocamos el status en memoria local.
                          onAdvanceWorkflow(order);
                          onClose(); 
                      }}>
                        {workflowConfig.text} <ArrowRightCircle className="h-6 w-6" />
                      </Button>
                      <span className="text-xs text-slate-500 font-medium px-2">{workflowConfig.helper}</span>
                    </div>
                )}

                {canArchive && (
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 shadow-lg flex items-center gap-3" onClick={() => onArchiveOrder(order)}>
                      ARCHIVAR Orden <Archive className="h-6 w-6" />
                    </Button>
                )}
            </div>
        </motion.div>

        <AlertDialog open={showAnulateAlert} onOpenChange={setShowAnulateAlert}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600 flex items-center gap-2"><Ban className="h-5 w-5" /> ¿Anular Orden?</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción cambiará el estado de la orden <strong>#{formatOrderId(order.id)}</strong> a "ANULADA". <br/><br/> ¿Estás seguro de continuar?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if(onAnulateOrder) onAnulateOrder(order.id); setShowAnulateAlert(false); }}>Sí, Anular Orden</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AnimatePresence>
            {previewImage && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}>
                <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full"><X className="h-8 w-8" /></button>
                <img src={previewImage} alt="Full" className="max-w-full max-h-[95vh] rounded shadow-2xl" loading="lazy" decoding="async"/>
              </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

export default OrderDetailsModal;