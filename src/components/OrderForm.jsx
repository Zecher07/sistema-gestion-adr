import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { 
  Save, X, Calendar as CalendarIcon, User, Search, Calculator, 
  FileText, Loader2, UserPlus, FileImage, Check, CheckCircle2, Trash2, Plus, CreditCard, Lock, Users, Info, Ban, ShoppingCart, DollarSign, Image as ImageIcon, AlertOctagon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/Text';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '../supabaseClient';
import ClientForm from './ClientForm';
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
import { getValidSellers } from '@/lib/utils';

const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Cheque', 'Depósito', 'Tarjeta', 'Crédito', 'No aplica'];

const ORDER_TYPES = [
  'VENTA CON PRODUCCION (VPVC) (4 pasos)',
  'VENTA CORTA (VC) (2 pasos)'
];

const TIME_SLOTS = [];
for (let h = 8; h <= 20; h++) {
  const hour = h.toString().padStart(2, '0');
  if (h === 20) { TIME_SLOTS.push(`${hour}:00`); continue; }
  ['00', '15', '30', '45'].forEach(m => TIME_SLOTS.push(`${hour}:${m}`));
}

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

const ImageGallery = memo(({ images, isReadOnly, onRemove, onAdd, isProcessing }) => {
    const onDrop = useCallback(acceptedFiles => { onAdd(acceptedFiles); }, [onAdd]);
    const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: {'image/*': []}, disabled: isProcessing || isReadOnly });
  
    return (
      <div className="border border-slate-300 p-4 rounded-sm bg-slate-50/50">
         <div className="min-h-[100px] mb-3 flex flex-wrap gap-4">
            {images.map((img, i) => (
               <div key={i} className="relative group w-24 h-24 border border-slate-300 bg-white rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all">
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" title={img.name} loading="lazy" decoding="async" />
                  {!isReadOnly && <button type="button" onClick={() => onRemove(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"><X className="h-3 w-3" /></button>}
               </div>
            ))}
            {isProcessing && (
                <div className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50 rounded-md animate-pulse">
                    <Loader2 className="h-6 w-6 text-blue-500 animate-spin"/>
                    <span className="text-[10px] text-blue-500 font-medium mt-1">Optimizando...</span>
                </div>
            )}
            {!isProcessing && images.length === 0 && (<div className="w-full flex flex-col items-center justify-center text-slate-400 text-xs py-4"><FileImage className="h-8 w-8 mb-2 opacity-50" /><span>Sin imágenes adjuntas</span></div>)}
         </div>
         {!isReadOnly && (
             <div>
                 <input {...getInputProps()} className="hidden" />
                 <label {...getRootProps()} className={`inline-flex items-center gap-1 ${isProcessing ? 'bg-slate-400 cursor-wait' : 'bg-green-600 hover:bg-green-700 cursor-pointer'} text-white text-xs px-3 py-1.5 rounded transition-colors`}>
                     <Plus className="h-3 w-3" /> {isProcessing ? 'Procesando...' : 'Agregar Imágenes'}
                 </label>
             </div>
         )}
      </div>
    );
});

const InlineComprobanteEdit = ({ type, abonoIndex, items = [], onAdd, onRemove, isProcessing, disabled = false }) => {
    const onDrop = useCallback(files => onAdd(files, type, abonoIndex), [onAdd, type, abonoIndex]);
    const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: {'image/*': []}, disabled: isProcessing || disabled });

    return (
        <div className="mt-2 pt-2 border-t border-dashed border-slate-300 w-full animate-in fade-in zoom-in-95">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><FileText className="h-3 w-3"/> Soportes de pago adjuntos</div>
            <div className="flex flex-wrap gap-2 items-center">
                {items.map((img, i) => (
                    <div key={i} className="relative group w-12 h-12 border border-slate-300 bg-slate-50 rounded overflow-hidden shadow-sm cursor-pointer" onClick={() => window.open(img.url, '_blank')}>
                        <img src={img.url} className="w-full h-full object-cover hover:opacity-80 transition-opacity" alt="Comprobante" />
                        {!disabled && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(type, abonoIndex, i); }} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                ))}
                {isProcessing && <div className="w-12 h-12 flex items-center justify-center border border-dashed border-blue-300 bg-blue-50 rounded"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /></div>}
                
                {!disabled && (
                    <div {...getRootProps()} className={`cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded px-2 flex items-center gap-1 text-[10px] font-bold border border-emerald-200 transition-colors h-12 shadow-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input {...getInputProps()} />
                        <Plus className="w-3 h-3" /> {items.length === 0 ? 'Adjuntar' : 'Añadir'}
                    </div>
                )}
            </div>
        </div>
    );
};

const OrderForm = ({ currentUser, clients = [], staffUsers = [], orders = [], onSuccess, onCancel, initialData = null, mode = 'create', nextOrderNumber, onReloadClients }) => {
  const { toast } = useToast();
  const isAdmin = currentUser?.role === 'Administrador';
  
  // BLOQUEO ESTRICTO DE ORDEN
  const isPastPaso1 = initialData && initialData.id && initialData.status !== 'VENTAS' && initialData.status !== 'BORRADOR';
  const isEffectivelyReadOnly = isAdmin ? false : isPastPaso1;
  const isEditMode = !!(initialData && initialData.id);
  const isBottomReadOnly = isEffectivelyReadOnly;

  const [loading, setLoading] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [localClients, setLocalClients] = useState(clients);
  const searchRef = useRef(null);

  const newClientInitialData = useMemo(() => {
      return showNewClientModal ? { nombre: searchTerm } : null;
  }, [showNewClientModal]);

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [searchCatalog, setSearchCatalog] = useState('');
  const [activeProductSearchRow, setActiveProductSearchRow] = useState(null);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [localDiscountVal, setLocalDiscountVal] = useState('');
  const [localDiscountPercent, setLocalDiscountPercent] = useState('');
  
  const [isSellerDropdownOpen, setIsSellerDropdownOpen] = useState(false);

  const [abonos, setAbonos] = useState([]);
  const hasAbonosExtras = abonos && abonos.length > 0; 
  
  const [comprobantesData, setComprobantesData] = useState({ anticipo: [], saldo: [], abonos: {} });
  const [isProcessingComprobantes, setIsProcessingComprobantes] = useState(false);
  
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [abonoFormData, setAbonoFormData] = useState({
      monto: '', metodoPago: 'Efectivo', referencia: '', nota: '', fecha: new Date().toISOString().split('T')[0]
  });
  const [abonoComprobantes, setAbonoComprobantes] = useState([]);
  const [isProcessingAbonoImages, setIsProcessingAbonoImages] = useState(false);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  useEffect(() => { setLocalClients(clients); }, [clients]);

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data } = await supabase.from('catalogo_productos').select('*').order('nombre');
      if (data) setCatalogItems(data);
    };
    fetchCatalog();
  }, []);

  const [paymentMode, setPaymentMode] = useState('partial'); 
  const [applyRetention, setApplyRetention] = useState(false);
  const [localAnticipo, setLocalAnticipo] = useState(''); 

  const [formData, setFormData] = useState({
    orderNumber: nextOrderNumber, vendedor: currentUser?.name || '', cliente: '', clienteId: '', tipoLetrero: '', tipoOrden: 'VENTA CON PRODUCCION (VPVC) (4 pasos)', fechaEntrega: '',
    productos: Array(5).fill({ nombre: '', descripcion: '', observaciones: '', precioUnitario: 0, cantidad: 1, base: '', altura: '', completed: false, es_por_metro: false }), 
    anticipo: 0, retencion: 0, retentionPercent: 0, formaPagoAnticipo: 'Efectivo', referenciaPago: '', notaAnticipo: '', creditoVenceAnticipo: '', 
    saldo: 0, formaPagoSaldo: 'No aplica', creditoVenceSaldo: '', notaSaldo: '',
    descuentoMonto: 0, aplicarIva: true, ivaPercentage: 15, origenProformaInfo: '', imagenes: [], notas: '',
    esMayorista: false
  });

  const [financials, setFinancials] = useState({ subtotal: 0, descuentoVal: 0, baseImponible: 0, iva: 0, total: 0, saldoPendiente: 0 });

  const validSellers = useMemo(() => {
     return getValidSellers(staffUsers);
  }, [staffUsers]);

  const selectedClientData = useMemo(() => {
      return localClients.find(c => c.id === formData.clienteId) || null;
  }, [localClients, formData.clienteId]);

  const limiteCredito = selectedClientData?.permiteCredito ? Number(selectedClientData.limiteCredito) || 0 : 0;
  
  const deudaActual = useMemo(() => {
      if (!formData.clienteId) return 0;
      let deuda = 0;
      orders.forEach(o => {
          if (initialData?.id && o.id === initialData.id) return; 
          
          if (o.cliente_id === formData.clienteId && o.status !== 'ANULADA' && o.status !== 'ARCHIVADA') {
              const total = Number(o.financials?.total) || 0;
              const anticipo = Number(o.anticipo) || 0;
              const retencion = Number(o.retencion) || 0;
              const abonosSum = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
              const saldo = Math.max(total - anticipo - retencion - abonosSum, 0);
              deuda += saldo;
          }
      });
      return deuda;
  }, [formData.clienteId, orders, initialData]);
  
  const creditoDisponible = Math.max(limiteCredito - deudaActual, 0);

  useEffect(() => {
    const fetchGlobalConfig = async () => {
      if (!initialData || (initialData && initialData.aplicarIva === undefined)) {
        try {
          const { data } = await supabase.from('configuracion_global').select('iva_porcentaje').maybeSingle();
          if (data && data.iva_porcentaje !== undefined) {
            setFormData(prev => ({ ...prev, ivaPercentage: data.iva_porcentaje }));
          }
        } catch (error) { console.error(error); }
      }
    };
    fetchGlobalConfig();
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      let finData = {};
      if (initialData.financials) {
          if (typeof initialData.financials === 'string') {
              try { finData = JSON.parse(initialData.financials); } catch(e) {}
          } else { finData = initialData.financials; }
      }

      const saldoDB = finData.saldo || initialData.saldo || 0;
      const isFull = saldoDB <= 0.01; 
      setPaymentMode(isFull ? 'full' : 'partial');
      
      const retentionVal = initialData.retencion || finData.retencion || 0;
      setApplyRetention(retentionVal > 0);

      const savedAnticipo = initialData.anticipo || finData.anticipo || 0;
      const savedDescuentoMonto = initialData.descuentoMonto || finData.descuentoMonto || 0;
      
      // 🔥 CORRECCIÓN DEL IVA 🔥
      const savedIva = initialData.iva || finData.iva || 0;
      let shouldApplyIva = true;
      if (initialData.aplicarIva !== undefined) {
          shouldApplyIva = initialData.aplicarIva;
      } else if (finData.aplicarIva !== undefined) {
          shouldApplyIva = finData.aplicarIva;
      } else {
          shouldApplyIva = savedIva > 0; // Si no hay registro explícito, deduce por el monto
      }

      let savedPaymentMethod = initialData.forma_pago_anticipo || initialData.formaPagoAnticipo || finData.formaPago || 'Efectivo';
      let savedReference = '';

      if (savedPaymentMethod && savedPaymentMethod.includes(' - Ref: ')) {
          const parts = savedPaymentMethod.split(' - Ref: ');
          savedPaymentMethod = parts[0];
          savedReference = parts[1] || '';
      }

      let calculatedFechaEntrega = initialData.fecha_entrega || initialData.fechaEntrega || '';
      const isProformaConversion = !initialData.order_number && !initialData.orderNumber;
      const diasLaborales = parseInt(initialData.dias_entrega || finData.diasEntrega || 0, 10);
      
      if (isProformaConversion && !calculatedFechaEntrega && diasLaborales > 0) {
          let date = new Date(); let added = 0;
          while (added < diasLaborales) {
              date.setDate(date.getDate() + 1);
              if (date.getDay() !== 0 && date.getDay() !== 6) { added++; }
          }
          const yyyy = date.getFullYear(); const mm = String(date.getMonth() + 1).padStart(2, '0'); const dd = String(date.getDate()).padStart(2, '0');
          calculatedFechaEntrega = `${yyyy}-${mm}-${dd}T17:00`;
      }

      const tipoOriginal = String(initialData.tipo_trabajo || initialData.tipoOrden || initialData.tipoLetrero || '').toUpperCase();
      const isVentaCorta = tipoOriginal.includes('(VC)') || tipoOriginal === 'VC' || tipoOriginal === 'VENTA CORTA';

      setFormData(prev => ({
        ...prev, ...initialData,
        orderNumber: initialData.order_number || initialData.orderNumber || nextOrderNumber,
        cliente: initialData.cliente_nombre || initialData.cliente,
        clienteId: initialData.cliente_id || initialData.clienteId,
        tipoLetrero: initialData.tipo_trabajo || initialData.tipoLetrero || initialData.titulo || '',
        tipoOrden: isVentaCorta ? ORDER_TYPES[1] : ORDER_TYPES[0], 
        origenProformaInfo: initialData.origenProformaInfo || initialData.proformaNumber || initialData.numero || '',
        productos: (initialData.productos || initialData.items || []).map(p => ({
            ...p,
            precioUnitario: p.precioUnitario !== undefined ? p.precioUnitario : p.precio || 0,
            base: p.base || '',
            altura: p.altura || '',
            cantidad: p.cantidad !== undefined ? p.cantidad : 1
        })),
        fechaEntrega: calculatedFechaEntrega,
        vendedor: initialData.vendedor || initialData.responsable_nombre || currentUser.name,
        aplicarIva: shouldApplyIva, // 🔥 Aplicamos la deducción correcta aquí 🔥
        anticipo: savedAnticipo, formaPagoAnticipo: savedPaymentMethod, referenciaPago: savedReference, notaAnticipo: initialData.notaAnticipo || '', creditoVenceAnticipo: initialData.creditoVenceAnticipo || '',
        retencion: retentionVal, retentionPercent: finData.retentionPercent || initialData.retentionPercent || 0,
        formaPagoSaldo: finData.formaPagoSaldo || 'No aplica', creditoVenceSaldo: finData.creditoVenceSaldo || '', notaSaldo: finData.notaSaldo || '',
        imagenes: initialData.imagenes || [], notas: initialData.notas || '',
        descuentoMonto: savedDescuentoMonto, ivaPercentage: finData.ivaPercentage || initialData.ivaPercentage || prev.ivaPercentage,
        esMayorista: initialData.esMayorista || initialData.es_mayorista || false
      }));
      
      setLocalDiscountVal(savedDescuentoMonto > 0 ? savedDescuentoMonto.toFixed(2) : '');
      setLocalAnticipo(savedAnticipo > 0 ? savedAnticipo.toString() : ''); 
      setSearchTerm(initialData.cliente_nombre || initialData.cliente || '');

      setAbonos(initialData.abonos || []);
      
      if (initialData.id) {
          const fetchMissingData = async () => {
              try {
                  const { data } = await supabase.from('ordenes').select('imagenes, comprobantes').eq('id', initialData.id).single();
                  if (data) {
                      if (data.imagenes && Array.isArray(data.imagenes)) {
                          setFormData(prev => ({ ...prev, imagenes: data.imagenes }));
                      }
                      if (data.comprobantes) {
                          let cData = data.comprobantes;
                          if (Array.isArray(cData)) cData = { anticipo: cData, saldo: [], abonos: {} };
                          setComprobantesData({
                              anticipo: cData.anticipo || [],
                              saldo: cData.saldo || [],
                              abonos: cData.abonos || {}
                          });
                      }
                  }
              } catch(e) {}
          };
          fetchMissingData();
      }
    }
  }, [initialData, nextOrderNumber, currentUser]);

  const currentDatePart = formData.fechaEntrega ? formData.fechaEntrega.split('T')[0] : '';
  const currentTimePart = formData.fechaEntrega && formData.fechaEntrega.includes('T') ? formData.fechaEntrega.split('T')[1].slice(0,5) : '12:00';

  const handleDateTimeChange = (date, time) => {
    if (!date) { setFormData(prev => ({ ...prev, fechaEntrega: '' })); return; }
    const t = time || '12:00';
    setFormData(prev => ({ ...prev, fechaEntrega: `${date}T${t}:00` }));
  };

  useEffect(() => {
    if (!formData.productos || formData.productos.length === 0) {
      setFormData(prev => ({ ...prev, productos: Array(5).fill({ nombre: '', descripcion: '', observaciones: '', precioUnitario: 0, cantidad: 1, base: '', altura: '', completed: false, es_por_metro: false }) }));
    }
  }, []);

  useEffect(() => {
    const subtotal = formData.productos.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const descuentoDirectoTotal = Number(formData.descuentoMonto) || 0;
    const tasaIva = formData.aplicarIva ? (formData.ivaPercentage / 100) : 0;
    
    const descuentoBase = formData.aplicarIva ? (descuentoDirectoTotal / (1 + tasaIva)) : descuentoDirectoTotal;
    const baseImponible = Math.max(0, subtotal - descuentoBase);
    const iva = formData.aplicarIva ? baseImponible * tasaIva : 0;
    const total = baseImponible + iva;

    let retencionValor = 0;
    if (applyRetention) { retencionValor = baseImponible * (formData.retentionPercent / 100); }

    let anticipoCalculado = parseFloat(formData.anticipo) || 0;
    if (paymentMode === 'full') {
        anticipoCalculado = total - retencionValor;
        if (Math.abs(parseFloat(localAnticipo || 0) - anticipoCalculado) > 0.01) { setLocalAnticipo(anticipoCalculado > 0 ? anticipoCalculado.toFixed(2) : ''); }
    }

    const abonosTotal = abonos.reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);
    const saldoPendiente = Math.max(total - anticipoCalculado - retencionValor - abonosTotal, 0);

    setFinancials({ subtotal, descuentoVal: descuentoBase, baseImponible, iva, total, saldoPendiente });
    
    if (document.activeElement?.name !== 'discountPercentInput') {
        const perc = subtotal > 0 ? (descuentoBase / subtotal) * 100 : 0;
        setLocalDiscountPercent(perc > 0 ? perc.toFixed(2) : '');
    }

    setFormData(prev => {
        if (prev.retencion !== retencionValor || (paymentMode === 'full' && prev.anticipo !== anticipoCalculado)) {
            return { ...prev, retencion: retencionValor, anticipo: paymentMode === 'full' ? anticipoCalculado : prev.anticipo };
        }
        return prev;
    });

  }, [formData.productos, formData.descuentoMonto, formData.aplicarIva, formData.anticipo, formData.ivaPercentage, formData.retentionPercent, applyRetention, paymentMode, abonos]);

  const porcentajeAnticipoUI = financials.total > 0 ? ((formData.anticipo / financials.total) * 100).toFixed(1) : '0.0';
  const porcentajeSaldoUI = financials.total > 0 ? ((financials.saldoPendiente / financials.total) * 100).toFixed(1) : '0.0';

  const handleAnticipoChange = (e) => {
      const valStr = e.target.value;
      setLocalAnticipo(valStr); 
      const valNum = parseFloat(valStr) || 0;
      setFormData(prev => ({ ...prev, anticipo: valNum }));
  };

  const handleAnticipoBlur = () => {
      const valNum = parseFloat(localAnticipo) || 0;
      const maximoPosible = financials.total - formData.retencion;
      if (valNum > maximoPosible + 0.01) { 
          toast({ title: "Monto ajustado", description: "El anticipo no puede ser mayor al Total.", variant: "warning" });
          const ajustado = maximoPosible > 0 ? maximoPosible : 0;
          setLocalAnticipo(ajustado.toFixed(2));
          setFormData(prev => ({ ...prev, anticipo: ajustado }));
      } else {
          if (valNum > 0) setLocalAnticipo(valNum.toFixed(2));
      }
  };

  const getPriceForQty = (qty, item, applyMayorista = false) => {
      if (applyMayorista) {
          const tiersDist = [...(item.precios_distribuidor || [])].sort((a,b) => b.cantidad - a.cantidad);
          const tierDist = tiersDist.find(t => qty >= t.cantidad);
          if (tierDist && Number(tierDist.precio) > 0) return Number(tierDist.precio);
          
          const baseDist = Number(item.precioDistribuidorBase || item.precio_distribuidor || 0);
          if (baseDist > 0) return baseDist;
      }

      const tiersNorm = [...(item.precios_escalonados || [])].sort((a,b) => b.cantidad - a.cantidad);
      const tierNorm = tiersNorm.find(t => qty >= t.cantidad);
      if (tierNorm && Number(tierNorm.precio) > 0) return Number(tierNorm.precio);
      
      return Number(item.precioBaseOriginal || item.precio || 0);
  };

  const recalculatePrices = (itemsList, isWholesale) => {
      return itemsList.map(p => {
          if (!p.descripcion) return p;
          const q = parseFloat(p.cantidad) || 0;
          const PRECIO_MINIMO_ITEM = getPriceForQty(1, p, isWholesale);
          
          if (p.es_por_metro) {
              const b = parseFloat(p.base) || 0;
              const a = parseFloat(p.altura) || 0;
              const areaIndividual = (b/100) * (a/100);
              const areaTotalCalculada = parseFloat((areaIndividual * q).toFixed(2));
              
              const newPrice = getPriceForQty(areaTotalCalculada, p, isWholesale);
              
              let precioPorPieza = areaIndividual * newPrice;
              if (areaIndividual > 0 && precioPorPieza < PRECIO_MINIMO_ITEM) {
                  precioPorPieza = PRECIO_MINIMO_ITEM;
              }
              
              return { ...p, precioUnitario: areaTotalCalculada > 0 ? newPrice : '', total: parseFloat((precioPorPieza * q).toFixed(2)) };
          } else {
              const newPrice = getPriceForQty(q, p, isWholesale);
              return { ...p, precioUnitario: newPrice, total: parseFloat((q * newPrice).toFixed(2)) };
          }
      });
  };

  const handleCatalogSelect = (item) => {
    const minQty = item.venta_minima !== undefined && item.venta_minima !== null ? parseInt(item.venta_minima, 10) : 1;
    
    let computedPrice = 0;
    if (!item.es_por_metro) {
        computedPrice = getPriceForQty(minQty, item, formData.esMayorista);
    }

    let finalDesc = item.nombre;
    if (item.descripcion) finalDesc += ` - ${item.descripcion}`;

    setFormData(prev => {
        const newProducts = [...prev.productos];
        const emptyIndex = newProducts.findIndex(p => !p.descripcion || p.descripcion.trim() === '');

        const newProduct = {
            cantidad: minQty > 0 ? minQty : 1, 
            venta_minima: minQty > 0 ? minQty : 1,
            base: '', altura: '',
            descripcion: finalDesc,
            observaciones: item.observaciones || '', 
            precioUnitario: computedPrice || '', 
            precioBaseOriginal: Number(item.precio) || 0,
            precios_escalonados: item.precios_escalonados || [],
            precioDistribuidorBase: Number(item.precio_distribuidor) || 0,
            precios_distribuidor: item.precios_distribuidor || [],
            es_por_metro: item.es_por_metro || false,
            total: item.es_por_metro ? 0 : parseFloat((computedPrice * (minQty > 0 ? minQty : 1)).toFixed(2))
        };

        if (emptyIndex !== -1) {
            newProducts[emptyIndex] = newProduct;
            if (emptyIndex === newProducts.length - 1) newProducts.push({ descripcion: '', observaciones: '', precioUnitario: '', cantidad: 1, base: '', altura: '', total: 0, venta_minima: 1, es_por_metro: false });
        } else {
            newProducts.push(newProduct);
            newProducts.push({ descripcion: '', observaciones: '', precioUnitario: '', cantidad: 1, base: '', altura: '', total: 0, venta_minima: 1, es_por_metro: false });
        }
        return { ...prev, productos: newProducts };
    });
    
    setIsCatalogOpen(false);
    toast({ title: "Producto Añadido", description: `${item.nombre} agregado a la orden.` });
  };

  const handleProductSearchRequest = async (index, value) => {
      updateProduct(index, 'descripcion', value);
      if (value.trim().length < 2) {
          setProductSuggestions([]);
          setActiveProductSearchRow(null);
          return;
      }
      setActiveProductSearchRow(index);
      
      const terms = value.trim().split(/\s+/);
      let query = supabase.from('catalogo_productos').select('*');
      terms.forEach(term => {
          query = query.or(`nombre.ilike.%${term}%,categoria.ilike.%${term}%,codigo.ilike.%${term}%`);
      });

      const { data } = await query.limit(12);
      setProductSuggestions(data || []);
  };

  const handleSelectProductSuggestion = (index, product) => {
      const minQty = product.venta_minima !== undefined && product.venta_minima !== null ? parseInt(product.venta_minima, 10) : 1;
      
      let computedPrice = 0;
      if (!product.es_por_metro) {
          computedPrice = getPriceForQty(minQty, product, formData.esMayorista);
      }

      let finalDesc = product.nombre;
      if (product.descripcion) finalDesc += ` - ${product.descripcion}`;

      setFormData(prev => {
          const newProducts = [...prev.productos];
          newProducts[index] = { 
              ...newProducts[index], 
              descripcion: finalDesc,
              observaciones: product.observaciones || '', 
              precioUnitario: computedPrice || '',
              precioBaseOriginal: Number(product.precio) || 0,
              precios_escalonados: product.precios_escalonados || [],
              precioDistribuidorBase: Number(product.precio_distribuidor) || 0,
              precios_distribuidor: product.precios_distribuidor || [],
              venta_minima: minQty > 0 ? minQty : 1,
              cantidad: minQty > 0 ? minQty : 1, 
              base: '', altura: '',
              es_por_metro: product.es_por_metro || false,
              total: product.es_por_metro ? 0 : parseFloat(((minQty > 0 ? minQty : 1) * computedPrice).toFixed(2))
          };
          if (index === newProducts.length - 1) newProducts.push({ descripcion: '', observaciones: '', precioUnitario: '', cantidad: 1, base: '', altura: '', total: 0, venta_minima: 1, es_por_metro: false });
          return { ...prev, productos: newProducts };
      });
      setProductSuggestions([]);
      setActiveProductSearchRow(null);
  };

  const updateProduct = (index, field, value) => {
    setFormData(prev => {
        const newProducts = [...prev.productos];
        let item = { ...newProducts[index], [field]: value };
        
        const q = parseFloat(item.cantidad) || 0; 
        const b = parseFloat(item.base) || 0; 
        const a = parseFloat(item.altura) || 0; 
        const PRECIO_MINIMO_ITEM = getPriceForQty(1, item, prev.esMayorista);

        if (item.es_por_metro) {
            const areaIndividual = (b / 100) * (a / 100); 
            const areaTotalCalculada = parseFloat((areaIndividual * q).toFixed(2));
            
            if (['base', 'altura', 'cantidad'].includes(field) && item.precioBaseOriginal !== undefined) {
                if (areaTotalCalculada > 0) {
                    item.precioUnitario = getPriceForQty(areaTotalCalculada, item, prev.esMayorista);
                } else {
                    item.precioUnitario = '';
                }
            }

            const pUnit = parseFloat(item.precioUnitario) || 0;
            let precioPorPieza = areaIndividual * pUnit;

            if (areaIndividual > 0 && precioPorPieza < PRECIO_MINIMO_ITEM) {
                precioPorPieza = PRECIO_MINIMO_ITEM;
            }

            item.total = parseFloat((precioPorPieza * q).toFixed(2));

        } else {
            if (field === 'cantidad' && item.precioBaseOriginal !== undefined) {
                item.precioUnitario = getPriceForQty(q, item, prev.esMayorista);
            }
            const price = parseFloat(item.precioUnitario) || 0;
            item.total = parseFloat((q * price).toFixed(2));
        }

        if (field === 'precioUnitario' && !item.es_por_metro) {
            const price = parseFloat(value) || 0;
            item.total = parseFloat((q * price).toFixed(2));
        } else if (field === 'precioUnitario' && item.es_por_metro) {
            const price = parseFloat(value) || 0;
            const areaIndividual = (b / 100) * (a / 100);
            let precioPorPieza = areaIndividual * price;
            if (areaIndividual > 0 && precioPorPieza < PRECIO_MINIMO_ITEM) {
                precioPorPieza = PRECIO_MINIMO_ITEM;
            }
            item.total = parseFloat((precioPorPieza * q).toFixed(2));
        }

        if (field === 'descripcion' && index === newProducts.length - 1 && value !== '') {
            newProducts.push({ descripcion: '', observaciones: '', precioUnitario: '', cantidad: 1, base: '', altura: '', total: 0, venta_minima: 1, es_por_metro: false });
        }

        newProducts[index] = item;
        return { ...prev, productos: newProducts };
    });
  };

  const handleQuantityBlur = (index, value) => {
      const item = formData.productos[index];
      if (!item.descripcion) return;
      
      const min = item.venta_minima !== undefined && item.venta_minima !== null ? parseInt(item.venta_minima, 10) : 1;
      let qty = parseInt(value, 10);
      if (isNaN(qty)) qty = 0;
      
      if (qty > 0 && min > 0 && qty < min) {
          toast({ title: "Venta Mínima", description: `Este producto exige mínimo ${min} unidades.`, variant: "destructive" });
          updateProduct(index, 'cantidad', min);
      } else {
          updateProduct(index, 'cantidad', qty);
      }
  };

  const removeProduct = (idx) => {
    setFormData(prev => {
        if (prev.productos.length <= 1) return prev;
        const newProducts = prev.productos.filter((_, i) => i !== idx);
        return { ...prev, productos: newProducts };
    });
  };

  const addProduct = () => {
    setFormData(prev => ({
        ...prev,
        productos: [...prev.productos, { descripcion: '', observaciones: '', precioUnitario: '', cantidad: 1, base: '', altura: '', total: 0, venta_minima: 1, es_por_metro: false }]
    }));
  };

  const filteredClients = localClients.filter(c => c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (c.empresa && c.empresa.toLowerCase().includes(searchTerm.toLowerCase())));

  const handleSelectClient = (client) => {
    const isWholesale = client.es_mayorista || false;
    setFormData(prev => {
        const newProducts = recalculatePrices(prev.productos, isWholesale);
        return { 
            ...prev, 
            clienteId: client.id, 
            cliente: client.nombre, 
            esMayorista: isWholesale,
            productos: newProducts
        };
    });
    setSearchTerm(client.nombre);
    setIsSearching(false);
  };

  const handleNewClientCreated = (newClient) => {
    const clientData = Array.isArray(newClient) ? newClient[0] : newClient;
    if(clientData) {
        setLocalClients([clientData, ...localClients]);
        handleSelectClient(clientData);
        setShowNewClientModal(false);
        if(onReloadClients) onReloadClients();
    }
  };

  const handleResponsableToggle = (sellerName) => {
    setFormData(prev => {
        let currentSellers = prev.vendedor ? prev.vendedor.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (currentSellers.includes(sellerName)) {
            currentSellers = currentSellers.filter(s => s !== sellerName);
        } else {
            currentSellers.push(sellerName);
        }
        return { ...prev, vendedor: currentSellers.join(', ') };
    });
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) setIsSearching(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchRef]);

  const handleAddImages = async (files) => {
      setIsProcessingImages(true);
      const newImages = [];
      for (const file of files) {
          if (file.size > 15000000) { toast({ title: "Archivo demasiado grande", description: `"${file.name}" supera el límite.`, variant: "destructive" }); continue; }
          try {
              const compressed = await compressImage(file);
              newImages.push(compressed);
          } catch (e) {
              toast({ title: "Error", description: "No se pudo procesar la imagen.", variant: "destructive" });
          }
      }
      setFormData(prev => ({ ...prev, imagenes: [...(prev.imagenes || []), ...newImages] }));
      setIsProcessingImages(false);
  };

  const removeImage = (index) => {
    setFormData(prev => ({ ...prev, imagenes: prev.imagenes.filter((_, i) => i !== index) }));
  };

  const requiresComprobante = (method) => {
      if (!method) return false;
      const m = method.toLowerCase();
      return !m.includes('efectivo') && !m.includes('no aplica') && !m.includes('tarjeta');
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

      setComprobantesData(prev => {
          const updated = { ...prev };
          if (type === 'abono') {
              updated.abonos = { ...(updated.abonos || {}) };
              updated.abonos[abonoIndex] = [...(updated.abonos[abonoIndex] || []), ...newImages];
          } else {
              updated[type] = [...(updated[type] || []), ...newImages];
          }
          return updated;
      });
      setIsProcessingComprobantes(false);
  };

  const handleRemoveComprobante = (type, abonoIndex, imgIndex) => {
      setComprobantesData(prev => {
          const updated = { ...prev };
          if (type === 'abono') {
              updated.abonos = { ...(updated.abonos || {}) };
              updated.abonos[abonoIndex] = updated.abonos[abonoIndex].filter((_, i) => i !== imgIndex);
          } else {
              updated[type] = updated[type].filter((_, i) => i !== imgIndex);
          }
          return updated;
      });
  };

  const onDropAbono = useCallback(async (acceptedFiles) => {
      setIsProcessingAbonoImages(true);
      const newImages = [];
      for (const file of acceptedFiles) {
          if (file.size > 15000000) { toast({ title: "Archivo muy grande", variant: "destructive" }); continue; }
          try {
              const compressed = await compressImage(file);
              newImages.push(compressed);
          } catch (e) { toast({ title: "Error al procesar", variant: "destructive" }); }
      }
      setAbonoComprobantes(prev => [...prev, ...newImages]);
      setIsProcessingAbonoImages(false);
  }, [toast]);
  
  const { getRootProps: getRootPropsAbono, getInputProps: getInputPropsAbono } = useDropzone({ onDrop: onDropAbono, accept: {'image/*': []} });

  const openAbonoModal = (isFullBalance = false) => {
      setAbonoFormData({ 
          monto: isFullBalance ? financials.saldoPendiente.toFixed(2) : '', 
          metodoPago: 'Efectivo', 
          referencia: '', 
          nota: isFullBalance ? 'Liquidación de saldo final' : '', 
          fecha: new Date().toISOString().split('T')[0] 
      });
      setAbonoComprobantes([]);
      setIsAbonoModalOpen(true);
  };

  const handleSaveLocalAbono = (e) => {
      e.preventDefault();
      const montoNum = parseFloat(abonoFormData.monto);
      if (isNaN(montoNum) || montoNum <= 0) {
          toast({ title: "Monto inválido", variant: "destructive" });
          return;
      }
      if (montoNum > financials.saldoPendiente + 0.05) {
          toast({ title: "Monto excede el saldo", description: `El saldo máximo a cobrar es $${financials.saldoPendiente.toFixed(2)}`, variant: "destructive" });
          return;
      }

      let metodoFinal = abonoFormData.metodoPago;
      if (requiresComprobante(abonoFormData.metodoPago) && abonoFormData.referencia.trim()) {
          metodoFinal = `${abonoFormData.metodoPago} - Ref: ${abonoFormData.referencia}`;
      }

      const nuevoAbono = {
          monto: montoNum,
          metodoPago: metodoFinal,
          fecha: `${abonoFormData.fecha}T12:00:00`,
          nota: abonoFormData.nota,
          cobrador: currentUser.name
      };

      const newAbonos = [...abonos, nuevoAbono];
      setAbonos(newAbonos);

      if (abonoComprobantes.length > 0) {
          setComprobantesData(prev => {
              const updated = { ...prev, abonos: { ...(prev.abonos || {}) } };
              updated.abonos[newAbonos.length - 1] = abonoComprobantes;
              return updated;
          });
      }

      setIsAbonoModalOpen(false);
  };

  const removeAbonoLocal = (index) => {
      setAbonos(prev => prev.filter((_, i) => i !== index));
      setComprobantesData(prev => {
          const updated = { ...prev, abonos: { ...prev.abonos } };
          const newAbonos = {};
          let newIdx = 0;
          Object.keys(updated.abonos).forEach(key => {
              if (parseInt(key) !== index) {
                  newAbonos[newIdx] = updated.abonos[key];
                  newIdx++;
              }
          });
          updated.abonos = newAbonos;
          return updated;
      });
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
        toast({ title: "Atención", description: "Debe ingresar el motivo de la anulación.", variant: "destructive" });
        return;
    }
    setLoading(true);
    try {
        const { error } = await supabase.from('ordenes').update({
            status: 'ANULADA',
            motivoAnulacion: cancelReason,
            updated_at: new Date().toISOString()
        }).eq('id', initialData.id);

        if (error) throw error;
        
        toast({ title: "Orden Anulada", description: "La orden ha sido cancelada correctamente." });
        setIsCancelModalOpen(false);
        if(onSuccess) onSuccess();
    } catch (error) {
        toast({ title: "Error", description: "No se pudo anular la orden.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.clienteId && !formData.cliente) {
      toast({ title: "⚠️ Falta Cliente", variant: "destructive" });
      setLoading(false); return;
    }
    const validProducts = formData.productos.filter(p => p.descripcion && p.descripcion.trim() !== '');
    if (validProducts.length === 0) {
      toast({ title: "⚠️ Sin productos", variant: "destructive" });
      setLoading(false); return;
    }

    const invalidMetroProducts = validProducts.filter(p => p.es_por_metro && (p.base === '' || p.altura === ''));
    if (invalidMetroProducts.length > 0) {
      toast({ title: "Medidas Requeridas", description: "Debe colocar base y altura en cm para los productos por metro.", variant: "destructive" });
      setLoading(false); return;
    }

    if (financials.saldoPendiente < -0.02) {
        toast({ title: "Error en montos", description: "La suma de anticipos y abonos supera el total.", variant: "destructive" });
        setLoading(false); return;
    }

    const isCreditoAnticipo = formData.formaPagoAnticipo === 'Crédito';
    const isCreditoSaldo = paymentMode === 'partial' && formData.formaPagoSaldo === 'Crédito';

    if (isCreditoAnticipo || isCreditoSaldo) {
        if (!selectedClientData?.permiteCredito) {
            toast({ title: "Crédito no autorizado", description: "Este cliente no tiene crédito habilitado.", variant: "destructive" });
            setLoading(false); return;
        }
        
        let montoUsandoCredito = 0;
        if (isCreditoAnticipo && paymentMode === 'full') {
            montoUsandoCredito += (financials.total - formData.retencion);
        } else if (isCreditoAnticipo && paymentMode === 'partial') {
            montoUsandoCredito += (parseFloat(formData.anticipo) || 0);
        }
        
        if (isCreditoSaldo && paymentMode === 'partial') {
            montoUsandoCredito += (parseFloat(financials.saldoPendiente) || 0);
        }
        
        if (montoUsandoCredito > creditoDisponible + 0.05) { 
            toast({ 
                title: "Límite de crédito excedido", 
                description: `El cliente solo dispone de $${creditoDisponible.toFixed(2)}. Intentas aplicar $${montoUsandoCredito.toFixed(2)} a crédito.`, 
                variant: "destructive" 
            });
            setLoading(false); return;
        }
    }

    let finalPaymentString = formData.formaPagoAnticipo;
    if (requiresComprobante(formData.formaPagoAnticipo) && formData.referenciaPago) {
        finalPaymentString = `${formData.formaPagoAnticipo} - Ref: ${formData.referenciaPago}`;
    }

    let finalTitle = formData.tipoLetrero || '';
    const isVentaCortaSelected = formData.tipoOrden === ORDER_TYPES[1] || formData.tipoOrden === 'VC';
    
    if (isVentaCortaSelected && !finalTitle.toUpperCase().includes('(VC)')) {
        finalTitle = `${finalTitle} (VC)`;
    } 
    else if (!isVentaCortaSelected && finalTitle.toUpperCase().includes('(VC)')) {
        finalTitle = finalTitle.replace(/\(VC\)/gi, '').trim();
    }

    const processedProducts = validProducts.map(p => {
        if (p.es_por_metro && p.base && p.altura) {
            let cleanDesc = p.descripcion.replace(/\(\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*cm\s*\)/g, '').trim();
            const medidaString = `(${p.base}x${p.altura}cm)`;
            return { ...p, descripcion: `${cleanDesc} ${medidaString}` };
        }
        return p;
    });

    try {
        const payload = {
            cliente_id: formData.clienteId,
            cliente_nombre: formData.cliente,
            tipo_trabajo: finalTitle, 
            tipoOrden: formData.tipoOrden, 
            fecha_entrega: formData.fechaEntrega || null,
            vendedor: formData.vendedor, 
            notas: formData.notas,
            prioridad: 'Normal',
            origenProformaInfo: formData.origenProformaInfo,
            productos: processedProducts, 
            abonos: abonos,
            comprobantes: comprobantesData,
            financials: { 
                ...financials, 
                saldo: financials.saldoPendiente,
                descuentoMonto: formData.descuentoMonto, 
                descuentoVal: financials.descuentoVal, 
                ivaPercentage: formData.ivaPercentage, 
                retentionPercent: formData.retentionPercent,
                retencion: formData.retencion,
                formaPagoSaldo: formData.formaPagoSaldo,
                creditoVenceSaldo: formData.creditoVenceSaldo,
                notaSaldo: formData.notaSaldo,
                aplicarIva: formData.aplicarIva // 🔥 Lo dejamos dentro de financials
            },
            anticipo: formData.anticipo,
            retencion: formData.retencion,
            forma_pago_anticipo: finalPaymentString,
            nota_anticipo: formData.notaAnticipo, 
            credito_vence_anticipo: formData.creditoVenceAnticipo, 
            imagenes: formData.imagenes, 
            updated_at: new Date().toISOString()
        };

        if (!initialData || !initialData.id || initialData.status === 'BORRADOR') {
            payload.status = 'VENTAS';
            payload.created_at = new Date().toISOString();
            payload.recibido_por_anticipo = currentUser.name; 
        } else if (isAdmin && initialData.vendedor !== formData.vendedor) {
            toast({ title: "Orden Reasignada", description: `Vendedores actualizados.` });
        }

        if (initialData?.id && initialData.status !== 'BORRADOR') {
            const { error } = await supabase.from('ordenes').update(payload).eq('id', initialData.id);
            if(error) throw error;
        } else {
            const { error } = await supabase.from('ordenes').insert([payload]);
            if(error) throw error;
        }

        toast({ title: "✅ Orden Guardada", description: `Total: $${financials.total.toFixed(2)}` });
        if(onSuccess) onSuccess();

    } catch (error) {
        toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  const getDisplayedOrderNumber = () => {
    if (initialData && initialData.order_number) return String(initialData.order_number).padStart(7, '0');
    if (initialData && initialData.orderNumber) return String(initialData.orderNumber).padStart(7, '0');
    return 'Automático'; 
  };

  const canCancelOrder = useMemo(() => {
      if (!initialData || !initialData.id || initialData.status === 'ANULADA') return false;
      if (isAdmin) return true;
      if (currentUser?.role === 'Vendedor') {
          return (initialData.vendedor || '').includes(currentUser?.name) && initialData.status === 'VENTAS';
      }
      return false;
  }, [initialData, isAdmin, currentUser]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white shadow-xl rounded-lg flex flex-col h-full border border-slate-300 relative">
      <div className="bg-slate-100 border-b border-slate-300 px-6 py-3 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 uppercase">
          {(!initialData || !initialData.id || initialData.status === 'BORRADOR') ? `Orden NUEVA (${getDisplayedOrderNumber()})` : `Editar Orden #${getDisplayedOrderNumber()}`}
        </h2>
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0"><X className="h-5 w-5 text-slate-500" /></Button>
        </div>
      </div>

      {isPastPaso1 && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 px-6 shadow-sm">
            <div className="flex items-start gap-3">
                <AlertOctagon className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-amber-800">Orden en etapa: {initialData.status}</h4>
                    <p className="text-xs text-amber-700 mt-1">
                        Esta orden ya salió de VENTAS. Los datos del pedido están bloqueados por seguridad. 
                        <b> Solo puedes registrar la Liquidación de Saldo Final o nuevos Abonos.</b>
                    </p>
                </div>
            </div>
        </div>
      )}

      <div className="p-6 overflow-y-auto flex-1 bg-white">
        <form id="orderForm" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3 pb-6 border-b border-slate-200">
             <div className="grid grid-cols-12 gap-4 items-center">
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Titulo / Referencia:</label>
                <div className="col-span-12 md:col-span-10 flex items-center gap-3">
                   <input type="text" className="w-full md:w-1/2 border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none" value={formData.tipoLetrero} onChange={e => setFormData({...formData, tipoLetrero: e.target.value})} required readOnly={isEffectivelyReadOnly} />
                   
                   {formData.origenProformaInfo && (
                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                           <Info className="h-3 w-3" /> Proviene de: Proforma #{formData.origenProformaInfo}
                       </span>
                   )}
                </div>
                
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Tipo de Orden:</label>
                <div className="col-span-12 md:col-span-4">
                   <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white font-semibold text-purple-900 border-purple-200 bg-purple-50 focus:ring-purple-500 transition-colors" value={formData.tipoOrden} onChange={e => setFormData({...formData, tipoOrden: e.target.value})} disabled={isEffectivelyReadOnly}>
                     {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>

                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700 md:text-right px-4">Responsable(s):</label>
                <div className="col-span-12 md:col-span-4 relative">
                   {isAdmin && !isEffectivelyReadOnly ? (
                       <div className="relative">
                           <div 
                               className="flex items-center justify-between cursor-pointer w-full border border-blue-300 bg-blue-50 rounded px-2 py-1.5 text-sm font-semibold text-blue-800 focus:outline-none appearance-none"
                               onClick={() => setIsSellerDropdownOpen(!isSellerDropdownOpen)}
                           >
                               <span className="truncate block pr-6">{formData.vendedor || 'Seleccionar...'}</span>
                               <Users className="absolute right-2 top-2 h-4 w-4 text-blue-500 pointer-events-none" />
                           </div>

                           {isSellerDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-slate-200 shadow-xl rounded-md z-50 p-2 space-y-1 max-h-60 overflow-y-auto">
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-2 border-b pb-1">
                                        <span>Asignar Colaboradores</span>
                                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setIsSellerDropdownOpen(false)}><X className="h-4 w-4"/></Button>
                                    </div>
                                    {validSellers.map(u => {
                                        const isAssigned = (formData.vendedor || '').includes(u.name);
                                        return (
                                            <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-blue-50 rounded cursor-pointer border border-transparent hover:border-blue-100 transition-colors">
                                                <input 
                                                   type="checkbox" 
                                                   checked={isAssigned}
                                                   onChange={() => handleResponsableToggle(u.name)}
                                                   className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                />
                                                <span className="text-sm font-medium text-slate-700">{u.name}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                       </div>
                   ) : (
                       <>
                           <input type="text" className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-slate-100 font-semibold text-slate-600 cursor-not-allowed" value={formData.vendedor} readOnly />
                           <Lock className="absolute right-2 top-1.5 h-3 w-3 text-slate-400" />
                       </>
                   )}
                </div>

                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Cliente:</label>
                <div className="col-span-12 md:col-span-10 relative" ref={searchRef}>
                   <div className="flex flex-col gap-2 w-full md:w-1/2">
                       <div className="flex items-center gap-2 w-full">
                           <div className="relative w-full">
                               <input type="text" className={`w-full border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none pl-8 ${formData.clienteId ? 'bg-green-50 border-green-400' : ''}`} placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsSearching(true); if(e.target.value==='') setFormData(p=>({...p, clienteId:''})); }} onFocus={() => setIsSearching(true)} readOnly={isEffectivelyReadOnly} />
                               <Search className="absolute left-2 top-1.5 h-4 w-4 text-slate-400" />
                               {formData.clienteId && <Check className="absolute right-2 top-1.5 h-4 w-4 text-green-600" />}
                           </div>
                           {!isEffectivelyReadOnly && <Button type="button" size="sm" variant="outline" onClick={()=>setShowNewClientModal(true)} className="h-7 text-xs px-2 border-blue-400 text-blue-600 hover:bg-blue-50 whitespace-nowrap">+ Cliente</Button>}
                       </div>

                       {formData.clienteId && (
                           <div>
                               {selectedClientData?.permiteCredito ? (
                                   <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border bg-indigo-50 border-indigo-200 text-indigo-700 text-xs font-bold">
                                       <span>Límite Crédito: ${limiteCredito.toFixed(2)}</span>
                                       <span className="text-indigo-300">|</span>
                                       <span className={creditoDisponible <= 0 ? 'text-red-600' : 'text-indigo-700'}>
                                           Disponible: ${creditoDisponible.toFixed(2)}
                                       </span>
                                   </div>
                               ) : (
                                   <span className="inline-flex px-2.5 py-1 rounded-md border bg-slate-100 border-slate-200 text-slate-500 text-xs font-medium italic">
                                       Cliente sin crédito habilitado
                                   </span>
                               )}
                           </div>
                       )}
                   </div>
                   
                   {isSearching && (
                       <div className="absolute z-50 w-full md:w-1/2 mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-60 overflow-y-auto">
                           {filteredClients.length > 0 ? filteredClients.map(c => (
                               <div key={c.id} className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm border-b border-slate-50" onClick={() => handleSelectClient(c)}>
                                   <div className="font-bold text-slate-800">{c.nombre}</div>
                                   {c.empresa && <div className="text-xs text-slate-500">{c.empresa}</div>}
                               </div>
                           )) : (<div className="p-2 text-center text-xs text-slate-500">No encontrado.</div>)}
                       </div>
                   )}
                </div>
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Fecha entrega:</label>
                <div className="col-span-12 md:col-span-4 flex items-center gap-2">
                   <input type="date" className="border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 flex-1" value={currentDatePart} onChange={e => handleDateTimeChange(e.target.value, currentTimePart)} required readOnly={isEffectivelyReadOnly} />
                   <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white w-24" value={currentTimePart} onChange={e => handleDateTimeChange(currentDatePart, e.target.value)} disabled={isEffectivelyReadOnly}>
                     {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>
             </div>
          </div>

          <div className="space-y-2">
             <div className="flex justify-between items-center mb-1">
                 <h3 className="text-xs text-slate-500 italic">Detalle de Producción</h3>
                 {!isEffectivelyReadOnly && (
                     <div className="flex gap-2 items-center">
                         {formData.esMayorista && <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-1 rounded shadow-sm border border-indigo-200">TARIFA MAYORISTA APLICADA</span>}
                         <Button size="sm" type="button" onClick={() => setIsCatalogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-7 text-xs px-3">
                             <ShoppingCart className="h-3 w-3" /> Catálogo
                         </Button>
                         <Button size="sm" type="button" onClick={addProduct} variant="outline" className="border-green-500 text-green-700 hover:bg-green-50 h-7 text-xs px-3">
                             <Plus className="h-3 w-3 mr-1" /> Item Manual
                         </Button>
                     </div>
                 )}
             </div>
             
             <div className="border border-slate-300 rounded-sm overflow-hidden">
                <table className="w-full text-sm">
                   <thead className="bg-[#004080] text-white text-xs">
                      <tr>
                         <th className="py-2 px-2 text-left w-10">#</th>
                         <th className="py-2 px-2 text-left">Producto y Detalles</th>
                         <th className="py-2 px-2 text-center w-20">Cant.</th>
                         <th className="py-2 px-2 text-right w-24">Unitario</th>
                         <th className="py-2 px-2 text-right w-24">Total</th>
                         <th className="w-8"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-200">
                      {formData.productos.map((row, idx) => {
                        const b = parseFloat(row.base) || 0;
                        const a = parseFloat(row.altura) || 0;
                        const q = parseFloat(row.cantidad) || 0;
                        const pUnitario = parseFloat(row.precioUnitario) || 0;
                        
                        const areaIndividual = (b / 100) * (a / 100);
                        const areaTotalCalculada = areaIndividual * q;
                        const precioMinimoCatalogo = getPriceForQty(1, row, formData.esMayorista);
                        const precioPorPieza = areaIndividual * pUnitario;
                        
                        const aplicaMinimo = row.es_por_metro && areaIndividual > 0 && precioPorPieza > 0 && precioPorPieza < precioMinimoCatalogo;
                        const cleanDescription = (row.descripcion || '').replace(/\(\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*cm\s*\)/g, '').trim();

                        return (
                          <tr key={idx} className="hover:bg-slate-50 group">
                             <td className="py-2 px-2 text-slate-400 text-xs text-center align-top pt-4">{idx + 1}</td>
                             <td className="py-2 px-2 relative align-top pt-3">
                                <textarea 
                                    className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:border-blue-500 resize-y min-h-[60px]" 
                                    placeholder={idx === formData.productos.length - 1 ? "Buscar catálogo o añadir manual..." : ""} 
                                    value={cleanDescription} 
                                    onChange={(e) => handleProductSearchRequest(idx, e.target.value)}
                                    onFocus={() => { if(cleanDescription && cleanDescription.length >= 2) handleProductSearchRequest(idx, cleanDescription); }}
                                    onBlur={() => setTimeout(() => setActiveProductSearchRow(null), 350)}
                                    readOnly={isEffectivelyReadOnly}
                                />
                                {row.observaciones && (
                                    <div className="text-[10px] text-slate-500 italic mt-1 leading-tight">
                                        {row.observaciones}
                                    </div>
                                )}
                                
                                {row.es_por_metro && (
                                    <div className="flex flex-wrap items-center gap-2 mt-2 bg-purple-50 p-2 rounded-md border border-purple-200">
                                        <span className="text-xs font-bold text-purple-700">Medidas (cm):</span>
                                        <div className="flex items-center gap-1">
                                            <Input 
                                                type="number" step="1" min="0" placeholder="Ancho" 
                                                className="h-7 w-16 text-xs text-center px-1 py-0" 
                                                value={row.base !== undefined ? row.base : ''} 
                                                onChange={e => updateProduct(idx, 'base', e.target.value)} 
                                                readOnly={isEffectivelyReadOnly} 
                                            />
                                            <span className="text-xs text-purple-500 font-bold">x</span>
                                            <Input 
                                                type="number" step="1" min="0" placeholder="Alto" 
                                                className="h-7 w-16 text-xs text-center px-1 py-0" 
                                                value={row.altura !== undefined ? row.altura : ''} 
                                                onChange={e => updateProduct(idx, 'altura', e.target.value)} 
                                                readOnly={isEffectivelyReadOnly} 
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-purple-800 ml-2">
                                            = {areaIndividual.toFixed(2)} m² c/u
                                        </span>
                                        <span className="text-[10px] font-black text-indigo-800 ml-2 pl-2 border-l border-purple-300">
                                            Total: {areaTotalCalculada.toFixed(2)} m²
                                        </span>

                                        {aplicaMinimo && (
                                            <span className="text-[9px] font-bold text-red-600 ml-2 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                                                Mín. Aplicado (${precioMinimoCatalogo.toFixed(2)})
                                            </span>
                                        )}
                                    </div>
                                )}

                                {!isEffectivelyReadOnly && activeProductSearchRow === idx && productSuggestions.length > 0 && (
                                    <div className="absolute z-50 w-full min-w-[300px] mt-1 bg-white border border-slate-300 rounded shadow-xl max-h-60 overflow-y-auto left-0">
                                        {productSuggestions.map(prod => (
                                            <div 
                                                key={prod.id} 
                                                className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-sm border-b border-slate-100" 
                                                onMouseDown={(e) => { e.preventDefault(); handleSelectProductSuggestion(idx, prod); }}
                                            >
                                                <div className="font-bold text-slate-800">{prod.nombre}</div>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-[10px] text-slate-500 font-mono">{prod.codigo || ''}</span>
                                                    <span className="text-xs text-green-600 font-bold">${Number(prod.precio).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                             </td>
                             <td className="py-2 px-2 relative align-top pt-3">
                                 <input 
                                    type="number" 
                                    step="1" 
                                    className="w-full text-center border-none bg-transparent focus:ring-0 text-sm p-0 font-bold h-9" 
                                    min="1" 
                                    value={row.cantidad !== undefined ? row.cantidad : ''} 
                                    onChange={e => updateProduct(idx, 'cantidad', e.target.value)} 
                                    onKeyDown={e => {
                                        if (!row.es_por_metro && (e.key === '.' || e.key === ',')) e.preventDefault();
                                    }}
                                    onBlur={e => handleQuantityBlur(idx, e.target.value)}
                                    readOnly={isEffectivelyReadOnly}
                                 />
                                 {row.es_por_metro && <span className="absolute bottom-[-2px] left-0 w-full text-center text-[9px] text-purple-600 font-bold leading-tight">Piezas</span>}
                             </td>
                             <td className="py-2 px-2 align-top pt-4">
                                 <input 
                                     type="number" step="0.01" 
                                     className="w-full text-right border-none bg-transparent focus:ring-0 text-sm p-0 text-green-700 font-bold h-9" 
                                     value={row.precioUnitario !== undefined ? row.precioUnitario : ''} 
                                     onChange={e => updateProduct(idx, 'precioUnitario', e.target.value)} 
                                     readOnly={isEffectivelyReadOnly}
                                 />
                             </td>
                             <td className="py-2 px-2 text-right font-bold text-slate-800 align-top pt-5 bg-slate-50/50">
                                 $ {Number(row.total || 0).toFixed(2)}
                             </td>
                             <td className="py-2 px-1 text-center align-top pt-4">
                                 {!isEffectivelyReadOnly && (row.nombre || row.descripcion) ? (
                                     <button type="button" onClick={() => removeProduct(idx)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity">
                                         <Trash2 className="h-4 w-4" />
                                     </button>
                                 ) : null}
                             </td>
                          </tr>
                        );
                      })}
                   </tbody>
                   <tfoot className="bg-slate-100 font-medium text-slate-700 border-t border-slate-300 text-xs">
                      <tr><td colSpan="4" className="text-right py-1 px-2">SubTotal</td><td className="text-right py-1 px-2">$ {financials.subtotal.toFixed(2)}</td><td></td></tr>
                      <tr>
                         <td colSpan="4" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                            <span className="text-slate-500 font-bold" title="Este valor se restará directamente del Total Final">Ajuste al Total ($)</span>
                            {isEffectivelyReadOnly ? (
                                <span className="font-bold text-red-600 ml-2">${Number(localDiscountVal || 0).toFixed(2)} ({Number(localDiscountPercent || 0).toFixed(2)}%)</span>
                            ) : (
                                <>
                                    <input 
                                        name="discountValInput" 
                                        type="number" step="0.01" 
                                        className="w-16 text-right border border-slate-300 rounded px-1 text-xs bg-white font-bold text-red-600" 
                                        placeholder="0.00" 
                                        value={localDiscountVal} 
                                        onChange={e => {
                                            setLocalDiscountVal(e.target.value);
                                            setFormData(prev => ({...prev, descuentoMonto: parseFloat(e.target.value) || 0}));
                                        }} 
                                    />
                                    <span className="text-slate-500">(%)</span>
                                    <input 
                                        name="discountPercentInput" 
                                        type="number" step="0.01" 
                                        className="w-12 text-right border border-slate-300 rounded px-1 text-xs bg-white" 
                                        placeholder="0" 
                                        value={localDiscountPercent} 
                                        onChange={e => {
                                            setLocalDiscountPercent(e.target.value);
                                            const perc = parseFloat(e.target.value) || 0;
                                            const subtotal = financials.subtotal || 0;
                                            const tasaIva = formData.aplicarIva ? (formData.ivaPercentage / 100) : 0;
                                            const baseDesc = subtotal * (perc / 100);
                                            const finalDesc = formData.aplicarIva ? baseDesc * (1 + tasaIva) : baseDesc;
                                            setLocalDiscountVal(finalDesc > 0 ? finalDesc.toFixed(2) : '');
                                            setFormData(prev => ({...prev, descuentoMonto: finalDesc}));
                                        }} 
                                    />
                                </>
                            )}
                         </td>
                         <td className="text-right py-1 px-2 text-red-500">- $ {financials.descuentoVal.toFixed(2)}</td><td></td>
                      </tr>
                      <tr>
                         <td colSpan="4" className="text-right py-1 px-2 flex items-center justify-end gap-2 whitespace-nowrap">
                            <Checkbox id="iva-check" checked={formData.aplicarIva} onCheckedChange={(c) => setFormData({...formData, aplicarIva: c})} disabled={isEffectivelyReadOnly}/>
                            <label htmlFor="iva-check" className={`cursor-pointer flex items-center gap-1 ${isEffectivelyReadOnly ? 'opacity-50' : ''}`}>IVA {isAdmin && !isEffectivelyReadOnly ? (<span className="flex items-center">(<input type="number" className="w-8 text-center bg-transparent border-b border-slate-400 text-xs focus:outline-none focus:border-blue-600" value={formData.ivaPercentage} onChange={(e) => setFormData({...formData, ivaPercentage: parseFloat(e.target.value) || 0})} />%)</span>) : (<span>({formData.ivaPercentage}%)</span>)}</label>
                         </td>
                         <td className="text-right py-1 px-2">$ {financials.iva.toFixed(2)}</td><td></td>
                      </tr>
                      <tr className="bg-slate-200 font-bold text-slate-900 border-t border-slate-300">
                         <td colSpan="4" className="text-right py-2 px-2">TOTAL</td><td className="text-right py-2 px-2">$ {financials.total.toFixed(2)}</td><td></td>
                      </tr>
                   </tfoot>
                </table>
             </div>
          </div>

          <div className="space-y-4 pt-2">
             <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 italic">Info contable</span>
                    {hasAbonosExtras && <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider font-bold shadow-sm">Anticipo Bloqueado por Abonos</span>}
                </div>
                <div className="flex bg-slate-100 rounded-md p-1 gap-1 relative">
                    {(hasAbonosExtras || isEffectivelyReadOnly) && <div className="absolute inset-0 z-10 cursor-not-allowed" title="No puede cambiar modalidad"></div>}
                    <button type="button" onClick={() => !hasAbonosExtras && setPaymentMode('full')} className={`text-xs px-3 py-1 rounded transition-colors ${paymentMode === 'full' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-500 hover:bg-slate-200'} ${hasAbonosExtras ? 'opacity-50' : ''}`}>Pago Completo</button>
                    <button type="button" onClick={() => !hasAbonosExtras && setPaymentMode('partial')} className={`text-xs px-3 py-1 rounded transition-colors ${paymentMode === 'partial' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-500 hover:bg-slate-200'} ${hasAbonosExtras ? 'opacity-50' : ''}`}>Anticipo</button>
                </div>
             </div>
             
             <div className={`border rounded p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 transition-colors ${paymentMode === 'full' ? 'bg-green-50/50 border-green-200' : 'bg-orange-50/50 border-orange-200'} ${hasAbonosExtras ? 'opacity-80' : ''}`}>
                <div className="space-y-3">
                   <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">{paymentMode === 'full' ? 'Pago Total Inmediato' : 'Pago del Anticipo'}</h4>
                   
                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-20">{paymentMode === 'full' ? 'Monto Total:' : 'Monto Anticipo:'}</label>
                      <div className="relative flex-1">
                          <span className="absolute left-2 top-1.5 text-xs text-slate-500">$</span>
                          {isEffectivelyReadOnly || hasAbonosExtras || paymentMode === 'full' ? (
                              <div className="w-full pl-6 pr-12 py-1 border border-slate-200 rounded text-sm font-bold bg-slate-100 text-slate-600 uppercase">{Number(localAnticipo || 0).toFixed(2)}</div>
                          ) : (
                              <input type="number" step="0.01" className="w-full pl-6 pr-12 py-1 border rounded text-sm font-bold bg-white border-slate-300" value={localAnticipo} onChange={handleAnticipoChange} onBlur={handleAnticipoBlur} placeholder="0.00" />
                          )}
                          <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold bg-slate-100 px-1 rounded">{porcentajeAnticipoUI}%</span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-20">Forma Pago:</label>
                      {isEffectivelyReadOnly || hasAbonosExtras ? (
                          <div className="flex-1 px-2 py-1 text-sm bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold uppercase">{formData.formaPagoAnticipo || 'Efectivo'}</div>
                      ) : (
                          <select className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white" value={formData.formaPagoAnticipo} onChange={e => setFormData({...formData, formaPagoAnticipo: e.target.value})}>
                              {PAYMENT_METHODS.map(m => (
                                   <option key={m} value={m} disabled={m === 'Crédito' && !selectedClientData?.permiteCredito}>
                                       {m === 'Crédito' && !selectedClientData?.permiteCredito ? 'Crédito (No Autorizado)' : m}
                                   </option>
                              ))}
                          </select>
                      )}
                   </div>

                   {requiresComprobante(formData.formaPagoAnticipo) && (
                       <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                           <label className="text-xs font-bold text-blue-600 uppercase">N° Referencia / Lote</label>
                           {isEffectivelyReadOnly || hasAbonosExtras ? (
                               <div className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold">{formData.referenciaPago || '-'}</div>
                           ) : (
                               <input type="text" className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={formData.referenciaPago} onChange={e => setFormData({...formData, referenciaPago: e.target.value})} placeholder="Opcional..." />
                           )}
                       </div>
                   )}
                   
                   {requiresComprobante(formData.formaPagoAnticipo) && (
                       <InlineComprobanteEdit 
                           type="anticipo" 
                           items={comprobantesData.anticipo || []} 
                           onAdd={handleAddComprobantes} 
                           onRemove={handleRemoveComprobante} 
                           isProcessing={isProcessingComprobantes} 
                           disabled={isEffectivelyReadOnly || hasAbonosExtras}
                       />
                   )}

                   {formData.formaPagoAnticipo === 'Crédito' && (
                       <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                           <label className="text-xs font-bold w-20 text-orange-600">Vence el:</label>
                           {isEffectivelyReadOnly || hasAbonosExtras ? (
                               <div className="flex-1 px-2 py-1 text-sm bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold">{formData.creditoVenceAnticipo || '-'}</div>
                           ) : (
                               <input type="date" className="flex-1 border border-orange-300 bg-orange-50 rounded px-2 py-1 text-sm focus:border-orange-500 focus:outline-none" value={formData.creditoVenceAnticipo} onChange={e => setFormData({...formData, creditoVenceAnticipo: e.target.value})} />
                           )}
                       </div>
                   )}

                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-20 text-slate-500">Notas Pago:</label>
                      {isEffectivelyReadOnly || hasAbonosExtras ? (
                          <div className="flex-1 px-2 py-1 text-xs bg-slate-100 border border-slate-200 rounded text-slate-600 min-h-[28px]">{formData.notaAnticipo || '-'}</div>
                      ) : (
                          <input type="text" placeholder={formData.formaPagoAnticipo === 'Efectivo' ? "Ej: Billete de $100, vuelto $20" : "Notas adicionales del pago..."} className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 bg-slate-50" value={formData.notaAnticipo} onChange={e => setFormData({...formData, notaAnticipo: e.target.value})} />
                      )}
                   </div>

                   <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-slate-300">
                        {isEffectivelyReadOnly || hasAbonosExtras ? (
                            <>
                                <Checkbox id="chk-ret" checked={applyRetention} disabled />
                                <label htmlFor="chk-ret" className="text-xs select-none opacity-50 cursor-not-allowed">¿Aplica Retención?</label>
                                {applyRetention && (<div className="flex items-center gap-1 ml-auto"><span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">RET: {formData.retentionPercent}% (- $ {formData.retencion.toFixed(2)})</span></div>)}
                            </>
                        ) : (
                            <>
                                <Checkbox id="chk-ret" checked={applyRetention} onCheckedChange={setApplyRetention} />
                                <label htmlFor="chk-ret" className="text-xs select-none cursor-pointer">¿Aplica Retención?</label>
                                {applyRetention && (<div className="flex items-center gap-1 ml-auto"><span className="text-xs text-slate-500">%</span><input type="number" step="0.01" className="w-12 text-center text-xs border-b border-slate-400 bg-transparent focus:outline-none" value={formData.retentionPercent} onChange={e => setFormData({...formData, retentionPercent: parseFloat(e.target.value) || 0})} title="Porcentaje de Retención" /><span className="text-xs font-bold text-red-600">- $ {formData.retencion.toFixed(2)}</span></div>)}
                            </>
                        )}
                   </div>
                </div>

                {paymentMode === 'partial' ? (
                    <div className="space-y-3 opacity-100 transition-opacity">
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Saldo Pendiente</h4>
                        
                        {financials.saldoPendiente <= 0.01 ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 shadow-inner">
                                <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
                                <div>
                                    <p className="text-green-800 font-bold text-sm tracking-tight">ORDEN PAGADA EN SU TOTALIDAD</p>
                                    <p className="text-green-600 text-xs mt-0.5">El saldo es $0.00. No se requieren más abonos.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold w-20">Saldo Restante:</label>
                                    <div className="relative flex-1">
                                        <span className="absolute left-2 top-1.5 text-xs text-slate-500">$</span>
                                        <div className="w-full pl-6 pr-12 py-1 border border-slate-300 rounded text-sm bg-red-50 font-bold text-red-700">{financials.saldoPendiente.toFixed(2)}</div>
                                        <span className="absolute right-2 top-1.5 text-[10px] text-red-400 font-bold bg-red-100 px-1 rounded">{porcentajeSaldoUI}%</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                   <label className="text-xs font-bold w-20">Condición Saldo:</label>
                                   <select className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white" value={formData.formaPagoSaldo} onChange={e => setFormData({...formData, formaPagoSaldo: e.target.value})}>
                                       {PAYMENT_METHODS.map(m => (
                                            <option key={m} value={m} disabled={m === 'Crédito' && !selectedClientData?.permiteCredito}>
                                                {m === 'Crédito' && !selectedClientData?.permiteCredito ? 'Crédito (No Autorizado)' : m}
                                            </option>
                                       ))}
                                   </select>
                                </div>

                                {formData.formaPagoSaldo === 'Crédito' && (
                                   <div className="bg-indigo-50 border border-indigo-200 rounded p-3 mt-2 flex items-start gap-3 shadow-inner">
                                       <Info className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                                       <div>
                                           <p className="text-xs text-indigo-800 font-bold uppercase tracking-tight">Saldo a Crédito Aprobado</p>
                                           <p className="text-[10px] text-indigo-600 leading-snug mt-0.5">El cliente puede retirar. Contabilidad gestionará la cobranza de este saldo luego.</p>
                                       </div>
                                   </div>
                                )}

                                {formData.formaPagoSaldo === 'Crédito' && (
                                   <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 mt-2">
                                       <label className="text-xs font-bold w-20 text-orange-600">Vence el:</label>
                                       <input type="date" className="flex-1 border border-orange-300 bg-orange-50 rounded px-2 py-1 text-sm focus:border-orange-500 focus:outline-none" value={formData.creditoVenceSaldo} onChange={e => setFormData({...formData, creditoVenceSaldo: e.target.value})} />
                                   </div>
                                )}

                                <div className="flex items-center gap-2 mt-2">
                                    <label className="text-xs font-bold w-20 text-slate-500">Nota Saldo:</label>
                                    <input type="text" placeholder="Ej: Paga al retirar el material" className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 bg-slate-50" value={formData.notaSaldo} onChange={e => setFormData({...formData, notaSaldo: e.target.value})} />
                                </div>
                            </>
                        )}
                    </div>
                ) : (<div className="flex flex-col items-center justify-center text-slate-400 text-xs italic border border-dashed border-slate-300 rounded bg-slate-50"><CheckCircle2 className="h-6 w-6 mb-1 text-green-500" />Orden pagada en su totalidad.<br/>Saldo Pendiente: $0.00</div>)}
             </div>

             <div className="mt-4 border-t border-slate-200 pt-4">
                 <div className="flex justify-between items-center mb-3">
                     <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Pagos Adicionales / Abonos</h4>
                     {financials.saldoPendiente > 0.01 && (
                         <div className="flex gap-2">
                             <Button type="button" size="sm" variant="outline" onClick={() => openAbonoModal(false)} className="border-blue-400 text-blue-600 hover:bg-blue-50 h-7 text-xs px-2">
                                 <Plus className="h-3 w-3 mr-1" /> Añadir Abono Parcial
                             </Button>
                             <Button type="button" size="sm" onClick={() => openAbonoModal(true)} className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs px-2 shadow-sm font-bold">
                                 <DollarSign className="h-3 w-3 mr-1" /> Liquidar Saldo Completo
                             </Button>
                         </div>
                     )}
                 </div>
                 
                 {abonos.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {abonos.map((abono, idx) => (
                             <div key={idx} className="bg-red-50 border border-red-200 rounded p-3 shadow-sm relative group flex flex-col">
                                 <button type="button" onClick={() => removeAbonoLocal(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4"/></button>
                                 <div className="flex justify-between items-start w-full pr-6 mb-2">
                                     <div>
                                         <div className="text-[10px] text-slate-500 font-bold">{abono.fecha ? abono.fecha.split('T')[0] : ''}</div>
                                         <div className="text-xs font-bold text-red-700 uppercase">{abono.metodoPago || abono.metodo_pago}</div>
                                     </div>
                                     <div className="font-black text-red-600 text-lg">
                                         +{formatCurrency(abono.monto)}
                                     </div>
                                 </div>
                                 
                                 {requiresComprobante(abono.metodoPago || abono.metodo_pago) && (
                                     <InlineComprobanteEdit 
                                         type="abono" 
                                         abonoIndex={idx} 
                                         items={(comprobantesData.abonos || {})[idx] || []} 
                                         onAdd={handleAddComprobantes} 
                                         onRemove={handleRemoveComprobante} 
                                         isProcessing={isProcessingComprobantes} 
                                     />
                                 )}
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="text-xs text-slate-400 italic">No hay abonos ni pagos registrados.</div>
                 )}
             </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
             <div className="text-xs text-slate-500 italic">Arte/Diseño</div>
             <ImageGallery 
                images={formData.imagenes} 
                isReadOnly={isEffectivelyReadOnly} 
                onRemove={removeImage} 
                onAdd={handleAddImages} 
                isProcessing={isProcessingImages}
             />
             <div className="pt-2"><label className="text-xs font-bold text-slate-700 block mb-1">Notas Internas (No salen en impresión):</label><textarea className="w-full border border-slate-300 rounded p-2 text-sm h-20 resize-none focus:border-blue-500 outline-none" value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} readOnly={isEffectivelyReadOnly} /></div>
          </div>
        </form>
      </div>

      <div className="bg-slate-50 border-t border-slate-300 p-4 flex justify-between items-center gap-3">
         <div>
            {canCancelOrder && (
              <Button type="button" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 gap-2" onClick={() => setIsCancelModalOpen(true)}>
                 <Ban className="h-4 w-4" /> Anular Orden
              </Button>
            )}
         </div>
         <div className="flex gap-3">
             <Button type="button" variant="outline" onClick={onCancel} className="bg-white">Cancelar</Button>
             <Button type="submit" form="orderForm" disabled={loading} className="bg-[#004080] hover:bg-blue-900 text-white px-8 shadow-md">
                {loading ? 'Guardando...' : (mode === 'create' ? 'Guardar Orden' : 'Actualizar Orden')}
             </Button>
         </div>
      </div>

      {isAbonoModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-green-600 text-white px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6"/> {abonoFormData.nota === 'Liquidación de saldo final' ? 'Liquidar Saldo' : 'Añadir Abono'}</h2>
                <button type="button" onClick={() => setIsAbonoModalOpen(false)} className="hover:bg-green-700 p-1 rounded-full transition-colors"><X className="h-5 w-5"/></button>
            </div>

            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <div className="text-sm font-bold text-slate-500 uppercase">Cliente</div>
                    <div className="font-bold text-slate-800 uppercase">{formData.cliente || 'Cliente General'}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-500 uppercase">Saldo Pendiente</div>
                    <div className="text-2xl font-black text-red-600">${financials.saldoPendiente.toFixed(2)}</div>
                </div>
            </div>

            <div className="p-6 space-y-5 bg-white">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><DollarSign className="h-3 w-3"/> Monto a Cobrar</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                            <input type="number" step="0.01" min="0.01" max={financials.saldoPendiente.toFixed(2)} className="w-full pl-7 pr-3 py-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none font-bold text-green-700 bg-green-50 text-lg" value={abonoFormData.monto} onChange={e => setAbonoFormData({...abonoFormData, monto: e.target.value})} placeholder="0.00" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><CalendarIcon className="h-3 w-3"/> Fecha</label>
                        <input type="date" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" value={abonoFormData.fecha} onChange={e => setAbonoFormData({...abonoFormData, fecha: e.target.value})} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><CreditCard className="h-3 w-3"/> Método de Pago</label>
                    <select className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white font-medium" value={abonoFormData.metodoPago} onChange={e => setAbonoFormData({...abonoFormData, metodoPago: e.target.value})}>
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {requiresComprobante(abonoFormData.metodoPago) && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                        <label className="text-xs font-bold text-blue-600 uppercase">N° Referencia / Lote</label>
                        <input type="text" className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={abonoFormData.referencia} onChange={e => setAbonoFormData({...abonoFormData, referencia: e.target.value})} placeholder="Opcional..." />
                    </div>
                )}

                {requiresComprobante(abonoFormData.metodoPago) && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                        <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                            <ImageIcon className="h-3 w-3"/> Comprobante (Opcional)
                        </label>
                        <div className="border border-slate-300 p-2 rounded-md bg-slate-50 flex flex-wrap gap-2 items-center">
                            {abonoComprobantes.map((img, i) => (
                                <div key={i} className="relative group w-12 h-12 border border-slate-300 bg-white rounded overflow-hidden shadow-sm">
                                    <img src={img.url} className="w-full h-full object-cover" alt="Comprobante" />
                                    <button type="button" onClick={() => setAbonoComprobantes(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {isProcessingAbonoImages && <Loader2 className="w-4 h-4 animate-spin text-blue-500 mx-2" />}
                            {!isProcessingAbonoImages && (
                                <div {...getRootPropsAbono()} className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded px-2 flex items-center justify-center gap-1 text-[10px] font-bold border border-emerald-200 transition-colors h-12 shadow-sm">
                                    <input {...getInputPropsAbono()} />
                                    <Plus className="h-3 w-3" /> {abonoComprobantes.length === 0 ? 'Adjuntar' : 'Añadir'}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><FileText className="h-3 w-3"/> Nota / Observación</label>
                    <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={abonoFormData.nota} onChange={e => setAbonoFormData({...abonoFormData, nota: e.target.value})} placeholder="Ej: Pago final..." />
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsAbonoModalOpen(false)}>Cancelar</Button>
                    <Button type="button" onClick={handleSaveLocalAbono} disabled={!abonoFormData.monto} className="bg-green-600 hover:bg-green-700 text-white font-bold gap-2">
                        <Save className="h-4 w-4"/> Confirmar Cobro
                    </Button>
                </div>
            </div>
          </div>
        </div>
      )}

      {isCatalogOpen && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl z-[100] flex flex-col border-l border-slate-200 animate-in slide-in-from-right">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5"/> Catálogo de Precios</h3>
                <Button variant="ghost" size="icon" onClick={() => setIsCatalogOpen(false)} className="hover:bg-slate-700"><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-4 border-b border-slate-200 shrink-0 bg-slate-50">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input autoFocus placeholder="Buscar por código, nombre o categoría..." className="pl-9 bg-white" value={searchCatalog} onChange={e => setSearchCatalog(e.target.value)} />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                {catalogItems.filter(item => 
                    (item.nombre || '').toLowerCase().includes(searchCatalog.toLowerCase()) || 
                    (item.codigo || '').toLowerCase().includes(searchCatalog.toLowerCase()) ||
                    (item.categoria || '').toLowerCase().includes(searchCatalog.toLowerCase())
                ).map(item => (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group" onClick={() => handleCatalogSelect(item)}>
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm text-slate-800 group-hover:text-blue-700 uppercase">{item.nombre}</span>
                            <span className="font-bold text-green-700">${Number(item.precio).toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] font-bold text-purple-600 mb-1">{item.categoria}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{item.descripcion || item.observaciones}</div>
                        
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {item.es_por_metro && <span className="text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded">Precio Fijo/Rango</span>}
                            {item.venta_minima > 1 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">Mínimo: {item.venta_minima}</span>}
                            {item.precios_escalonados && item.precios_escalonados.length > 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Descuentos por volumen</span>}
                        </div>
                    </div>
                ))}
                {catalogItems.length === 0 && <div className="text-center py-10 text-slate-400">Catálogo vacío. Agrega productos en el módulo de Catálogo.</div>}
            </div>
        </div>
      )}

      {showNewClientModal && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200 p-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-lg">Nuevo Cliente</h3><Button size="sm" variant="ghost" onClick={()=>setShowNewClientModal(false)}><X/></Button></div>
            <div className="flex-1 overflow-y-auto"><ClientForm user={currentUser} onCancel={()=>setShowNewClientModal(false)} onSuccess={handleNewClientCreated} clienteAEditar={newClientInitialData} /></div>
        </div>
      )}

      <AlertDialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
               <Ban className="h-5 w-5" /> Anular Orden #{getDisplayedOrderNumber()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea anular esta orden? Una vez anulada no se podrá recuperar ni procesar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-4">
             <label className="text-sm font-bold text-slate-700 mb-2 block">Motivo de la anulación *</label>
             <textarea 
                className="w-full border border-slate-300 rounded-md p-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none"
                rows="3"
                placeholder="Ej: El cliente canceló el proyecto, error en datos..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                autoFocus
             />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsCancelModalOpen(false); setCancelReason(''); }}>Volver</AlertDialogCancel>
            <AlertDialogAction 
                onClick={handleCancelOrder} 
                disabled={loading || !cancelReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Anulación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </motion.div>
  );
};

export default OrderForm;