import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Calendar, FileImage, Link, Search, Check, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '../supabaseClient';
import ClientForm from './ClientForm';

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

const OrderForm = ({ 
  currentUser, 
  clients = [], 
  onSuccess,
  onCancel, 
  initialData = null, 
  mode = 'create',
  nextOrderNumber,
  onCheckAvailability,
  onReloadClients
}) => {
  const { toast } = useToast();
  const isReadOnly = mode === 'payment_only';
  const isAdmin = currentUser?.role === 'Administrador';
  
  const [loading, setLoading] = useState(false);

  // --- LÓGICA BUSCADOR CLIENTES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [localClients, setLocalClients] = useState(clients);
  const searchRef = useRef(null);

  useEffect(() => { setLocalClients(clients); }, [clients]);

  // --- ESTADO DEL FORMULARIO ---
  const [paymentMode, setPaymentMode] = useState('partial'); // 'full' | 'partial'
  const [applyRetention, setApplyRetention] = useState(false);

  // --- ESTADOS LOCALES PARA INPUTS (Anti-Glitch) ---
  const [localDiscountVal, setLocalDiscountVal] = useState('');
  const [localDiscountPercent, setLocalDiscountPercent] = useState('');
  const [localAnticipo, setLocalAnticipo] = useState(''); 

  const [formData, setFormData] = useState({
    orderNumber: nextOrderNumber,
    vendedor: currentUser?.name || '',
    cliente: '',
    clienteId: '',
    tipoLetrero: '',
    tipoOrden: 'VENTA CON PRODUCCION (VPVC) (4 pasos)',
    fechaEntrega: '',
    productos: Array(5).fill({ descripcion: '', precio: 0, cantidad: 0, completed: false }), 
    
    // Contable
    anticipo: 0,
    retencion: 0, 
    retentionPercent: 0, 
    formaPagoAnticipo: 'Efectivo',
    
    // Saldo
    saldo: 0,
    formaPagoSaldo: 'No aplica',
    creditoVenceSaldo: '',
    notaSaldo: '',

    // Config
    descuentoPorcentaje: 0,
    aplicarIva: true,
    ivaPercentage: 15,
    origenProformaId: '',
    imagenes: [],
    notas: ''
  });

  const [financials, setFinancials] = useState({
    subtotal: 0, descuentoVal: 0, baseImponible: 0, iva: 0, total: 0, saldoPendiente: 0
  });

  // Cargar datos (Edición)
  useEffect(() => {
    if (initialData) {
      const saldoDB = initialData.financials?.saldo || 0;
      const isFull = saldoDB <= 0.01; 
      setPaymentMode(isFull ? 'full' : 'partial');
      
      const retentionVal = initialData.retencion || initialData.financials?.retencion || 0;
      setApplyRetention(retentionVal > 0);

      const savedPercent = initialData.financials?.descuentoPorcentaje || 0;
      const savedAnticipo = initialData.anticipo || 0;

      setFormData({
        ...initialData,
        orderNumber: initialData.order_number || initialData.orderNumber,
        cliente: initialData.cliente_nombre || initialData.cliente,
        clienteId: initialData.cliente_id || initialData.clienteId,
        tipoLetrero: initialData.tipo_trabajo || initialData.tipoLetrero,
        fechaEntrega: initialData.fecha_entrega || '',
        productos: initialData.productos || [],
        
        anticipo: savedAnticipo,
        formaPagoAnticipo: initialData.forma_pago_anticipo || 'Efectivo',
        
        retencion: retentionVal,
        retentionPercent: initialData.financials?.retentionPercent || 0,

        formaPagoSaldo: initialData.financials?.formaPagoSaldo || 'No aplica',
        creditoVenceSaldo: initialData.financials?.creditoVenceSaldo || '',
        notaSaldo: initialData.financials?.notaSaldo || '',

        imagenes: initialData.imagenes || [],
        notas: initialData.notas || '',
        descuentoPorcentaje: savedPercent,
        ivaPercentage: initialData.financials?.ivaPercentage || 15 
      });
      
      setLocalDiscountPercent(savedPercent > 0 ? savedPercent.toString() : '');
      setLocalAnticipo(savedAnticipo > 0 ? savedAnticipo.toString() : ''); 
      setSearchTerm(initialData.cliente_nombre || initialData.cliente || '');
    }
  }, [initialData]);

  // Manejo Fechas
  const currentDatePart = formData.fechaEntrega ? formData.fechaEntrega.split('T')[0] : '';
  const currentTimePart = formData.fechaEntrega ? new Date(formData.fechaEntrega).toTimeString().slice(0,5) : '12:00';

  const handleDateTimeChange = (date, time) => {
    if (!date) { setFormData(prev => ({ ...prev, fechaEntrega: '' })); return; }
    const t = time || '12:00';
    setFormData(prev => ({ ...prev, fechaEntrega: `${date}T${t}:00` }));
  };

  useEffect(() => {
    if (!formData.productos || formData.productos.length === 0) {
      setFormData(prev => ({ ...prev, productos: Array(5).fill({ descripcion: '', precio: 0, cantidad: 0 }) }));
    }
  }, []);

  // --- CÁLCULOS FINANCIEROS Y SINCRONIZACIÓN ---
  useEffect(() => {
    const subtotal = formData.productos.reduce((sum, p) => {
      if (!p.descripcion) return sum;
      return sum + ((parseFloat(p.cantidad) || 0) * (parseFloat(p.precio) || 0));
    }, 0);

    const descuentoVal = subtotal * (formData.descuentoPorcentaje / 100);
    const baseImponible = subtotal - descuentoVal;
    
    const tasaIva = formData.ivaPercentage / 100;
    const iva = formData.aplicarIva ? baseImponible * tasaIva : 0;
    const total = baseImponible + iva;

    // Retención
    let retencionValor = 0;
    if (applyRetention) {
        retencionValor = baseImponible * (formData.retentionPercent / 100);
    }

    // Lógica Pago Completo vs Parcial
    let anticipoCalculado = parseFloat(formData.anticipo) || 0;
    
    if (paymentMode === 'full') {
        anticipoCalculado = total - retencionValor;
        // Solo actualizamos input local si difiere significativamente
        if (Math.abs(parseFloat(localAnticipo || 0) - anticipoCalculado) > 0.01) {
             setLocalAnticipo(anticipoCalculado > 0 ? anticipoCalculado.toFixed(2) : '');
        }
    }

    const saldoPendiente = total - anticipoCalculado - retencionValor;

    setFinancials({ subtotal, descuentoVal, baseImponible, iva, total, saldoPendiente });
    
    if (document.activeElement.name !== 'discountValInput') {
        setLocalDiscountVal(descuentoVal > 0 ? descuentoVal.toFixed(2) : '');
    }
    if (document.activeElement.name !== 'discountPercentInput') {
        setLocalDiscountPercent(formData.descuentoPorcentaje > 0 ? Math.round(formData.descuentoPorcentaje).toString() : '');
    }

    setFormData(prev => {
        if (prev.retencion !== retencionValor || (paymentMode === 'full' && prev.anticipo !== anticipoCalculado)) {
            return { ...prev, retencion: retencionValor, anticipo: paymentMode === 'full' ? anticipoCalculado : prev.anticipo };
        }
        return prev;
    });

  }, [
    formData.productos, 
    formData.descuentoPorcentaje, 
    formData.aplicarIva, 
    formData.anticipo, 
    formData.ivaPercentage,
    formData.retentionPercent,
    applyRetention,
    paymentMode
  ]);

  // --- HANDLERS DESCUENTO ---
  const commitDiscountValue = () => {
    const val = parseFloat(localDiscountVal) || 0;
    const percent = financials.subtotal > 0 ? (val / financials.subtotal) * 100 : 0;
    setFormData(prev => ({ ...prev, descuentoPorcentaje: percent }));
  };

  const commitDiscountPercent = () => {
    const intPercent = parseInt(localDiscountPercent) || 0;
    setFormData(prev => ({ ...prev, descuentoPorcentaje: intPercent }));
    setLocalDiscountPercent(intPercent > 0 ? intPercent.toString() : '');
  };

  const handleKeyDown = (e, commitFunction) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        commitFunction();
        e.target.blur();
    }
  };

  // --- HANDLERS ANTICIPO CON VALIDACIÓN ---
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
          toast({
              title: "Monto ajustado", 
              description: "El anticipo no puede ser mayor al Total a pagar.",
              variant: "warning"
          });
          const ajustado = maximoPosible > 0 ? maximoPosible : 0;
          setLocalAnticipo(ajustado.toFixed(2));
          setFormData(prev => ({ ...prev, anticipo: ajustado }));
      } else {
          if (valNum > 0) setLocalAnticipo(valNum.toFixed(2));
      }
  };

  // ----------------------------------------

  const handleProductChange = (index, field, value) => {
    const newProducts = [...formData.productos];
    newProducts[index] = { ...newProducts[index], [field]: value };
    if (index === newProducts.length - 1 && value !== '') {
       newProducts.push({ descripcion: '', precio: 0, cantidad: 0 });
    }
    setFormData({ ...formData, productos: newProducts });
  };

  const handleRemoveProductRow = (index) => {
    if (formData.productos.length <= 1) return;
    const newProducts = formData.productos.filter((_, i) => i !== index);
    setFormData({ ...formData, productos: newProducts });
  };

  const filteredClients = localClients.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.empresa && c.empresa.includes(searchTerm))
  );

  const handleSelectClient = (client) => {
    setFormData({ ...formData, clienteId: client.id, cliente: client.nombre });
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearching(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchRef]);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.size > 2000000) { toast({ title: "⚠️ Archivo muy grande", variant: "destructive" }); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imagenes: [...(prev.imagenes || []), { name: file.name, url: reader.result }] }));
      };
      reader.readAsDataURL(file);
    });
  };
  const removeImage = (index) => {
    setFormData(prev => ({ ...prev, imagenes: prev.imagenes.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.clienteId && !formData.cliente) {
      toast({ title: "⚠️ Falta Cliente", description: "Seleccione un cliente.", variant: "destructive" });
      setLoading(false); return;
    }
    const validProducts = formData.productos.filter(p => p.descripcion && p.descripcion.trim() !== '');
    if (validProducts.length === 0) {
      toast({ title: "⚠️ Sin productos", description: "Agregue items.", variant: "destructive" });
      setLoading(false); return;
    }

    if (financials.saldoPendiente < -0.02) {
        toast({ title: "Error en montos", description: "El anticipo supera el total a pagar.", variant: "destructive" });
        setLoading(false); return;
    }

    try {
        const payload = {
            cliente_id: formData.clienteId,
            cliente_nombre: formData.cliente, 
            tipo_trabajo: formData.tipoLetrero,
            fecha_entrega: formData.fechaEntrega || null,
            vendedor: formData.vendedor,
            notas: formData.notas,
            prioridad: 'Normal',
            productos: validProducts,
            financials: { 
                ...financials, 
                saldo: financials.saldoPendiente,
                descuentoPorcentaje: formData.descuentoPorcentaje,
                ivaPercentage: formData.ivaPercentage, 
                retentionPercent: formData.retentionPercent,
                retencion: formData.retencion,
                formaPagoSaldo: formData.formaPagoSaldo,
                creditoVenceSaldo: formData.creditoVenceSaldo,
                notaSaldo: formData.notaSaldo
            },
            anticipo: formData.anticipo,
            retencion: formData.retencion,
            forma_pago_anticipo: formData.formaPagoAnticipo,
            imagenes: formData.imagenes,
            ...(!initialData && { order_number: formData.orderNumber.toString(), status: 'VENTAS' })
        };

        if (initialData?.id) {
            const { error } = await supabase.from('ordenes').update(payload).eq('id', initialData.id);
            if(error) throw error;
        } else {
            const { error } = await supabase.from('ordenes').insert([payload]);
            if(error) throw error;
        }

        toast({ title: "✅ Orden Guardada", description: `Total: $${financials.total.toFixed(2)}` });
        if(onSuccess) onSuccess();

    } catch (error) {
        console.error(error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  const getDisplayedOrderNumber = () => (formData.orderNumber || '').toString().padStart(7, '0');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white shadow-xl rounded-lg flex flex-col h-full border border-slate-300 relative"
    >
      <div className="bg-slate-100 border-b border-slate-300 px-6 py-3 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 uppercase">
          {mode === 'create' ? `Orden NUEVA (${getDisplayedOrderNumber()})` : `Editar Orden #${getDisplayedOrderNumber()}`}
        </h2>
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0"><X className="h-5 w-5 text-slate-500" /></Button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 bg-white">
        <form id="orderForm" onSubmit={handleSubmit} className="space-y-6">
          
          {/* GENERAL INFO */}
          <div className="space-y-3 pb-6 border-b border-slate-200">
             <div className="grid grid-cols-12 gap-4 items-center">
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Titulo / Referencia:</label>
                <div className="col-span-12 md:col-span-10">
                   <input type="text" className="w-full md:w-1/2 border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                     value={formData.tipoLetrero} onChange={e => setFormData({...formData, tipoLetrero: e.target.value})} required readOnly={isReadOnly} />
                </div>

                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Tipo de Orden:</label>
                <div className="col-span-12 md:col-span-4">
                   <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                     value={formData.tipoOrden} onChange={e => setFormData({...formData, tipoOrden: e.target.value})} disabled={isReadOnly}>
                     {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>

                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700 md:text-right px-4">Responsable:</label>
                <div className="col-span-12 md:col-span-4">
                   <input type="text" className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-slate-100 font-semibold text-slate-600"
                     value={formData.vendedor} readOnly />
                </div>

                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Cliente:</label>
                <div className="col-span-12 md:col-span-10 relative" ref={searchRef}>
                   <div className="flex items-center gap-2 w-full md:w-1/2">
                       <div className="relative w-full">
                           <input type="text" className={`w-full border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none pl-8 ${formData.clienteId ? 'bg-green-50 border-green-400' : ''}`}
                             placeholder="Buscar cliente..." value={searchTerm}
                             onChange={(e) => { setSearchTerm(e.target.value); setIsSearching(true); if(e.target.value==='') setFormData(p=>({...p, clienteId:''})); }}
                             onFocus={() => setIsSearching(true)} readOnly={isReadOnly} />
                           <Search className="absolute left-2 top-1.5 h-4 w-4 text-slate-400" />
                           {formData.clienteId && <Check className="absolute right-2 top-1.5 h-4 w-4 text-green-600" />}
                       </div>
                       {!isReadOnly && <Button type="button" size="sm" variant="outline" onClick={()=>setShowNewClientModal(true)} className="h-7 text-xs px-2 border-blue-400 text-blue-600 hover:bg-blue-50 whitespace-nowrap">+ Cliente</Button>}
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
                   <input type="date" className="border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 flex-1"
                     value={currentDatePart} onChange={e => handleDateTimeChange(e.target.value, currentTimePart)} required readOnly={isReadOnly} />
                   <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white w-24"
                     value={currentTimePart} onChange={e => handleDateTimeChange(currentDatePart, e.target.value)} disabled={isReadOnly}>
                     {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>
             </div>
          </div>

          {/* PRODUCTS TABLE */}
          <div className="space-y-2">
             <div className="text-xs text-slate-500 italic">Producciones</div>
             <div className="border border-slate-300 rounded-sm overflow-hidden">
                <table className="w-full text-sm">
                   <thead className="bg-[#004080] text-white text-xs">
                      <tr>
                         <th className="py-1 px-2 text-left w-10">#</th>
                         <th className="py-1 px-2 text-left">Items a Producir</th>
                         <th className="py-1 px-2 text-right w-32">Unitario</th>
                         <th className="py-1 px-2 text-center w-24">Cantidad</th>
                         <th className="py-1 px-2 text-right w-32">Total</th>
                         <th className="w-8"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-200">
                      {formData.productos.map((row, idx) => {
                        const rowTotal = (parseFloat(row.cantidad)||0) * (parseFloat(row.precio)||0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 group">
                             <td className="py-1 px-2 text-slate-400 text-xs text-center">{idx + 1}</td>
                             <td className="py-1 px-2"><input type="text" className="w-full border-none bg-transparent focus:ring-0 text-sm p-0 placeholder-slate-300" placeholder={idx === formData.productos.length - 1 ? "Agregar item..." : ""} value={row.descripcion} onChange={e => handleProductChange(idx, 'descripcion', e.target.value)} readOnly={isReadOnly}/></td>
                             <td className="py-1 px-2"><input type="number" step="0.01" className="w-full text-right border-none bg-transparent focus:ring-0 text-sm p-0" value={row.precio||''} onChange={e => handleProductChange(idx, 'precio', e.target.value)} readOnly={isReadOnly}/></td>
                             <td className="py-1 px-2"><input type="number" step="1" className="w-full text-center border-none bg-transparent focus:ring-0 text-sm p-0" value={row.cantidad||''} onChange={e => handleProductChange(idx, 'cantidad', e.target.value)} readOnly={isReadOnly}/></td>
                             <td className="py-1 px-2 text-right font-medium text-slate-700">$ {rowTotal.toFixed(2)}</td>
                             <td className="py-1 px-1 text-center">{!isReadOnly && row.descripcion && (<button type="button" onClick={() => handleRemoveProductRow(idx)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"><Trash2 className="h-3 w-3" /></button>)}</td>
                          </tr>
                        );
                      })}
                   </tbody>
                   <tfoot className="bg-slate-100 font-medium text-slate-700 border-t border-slate-300 text-xs">
                      <tr>
                         <td colSpan="4" className="text-right py-1 px-2">SubTotal</td>
                         <td className="text-right py-1 px-2">$ {financials.subtotal.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="4" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                            <span className="text-slate-500">Dscto ($)</span>
                            <input 
                                name="discountValInput"
                                type="number" step="0.01" 
                                className="w-16 text-right border border-slate-300 rounded px-1 text-xs bg-white"
                                placeholder="0.00"
                                value={localDiscountVal}
                                onChange={e => setLocalDiscountVal(e.target.value)}
                                onBlur={commitDiscountValue}
                                onKeyDown={(e) => handleKeyDown(e, commitDiscountValue)}
                                readOnly={isReadOnly}
                            />
                            <span className="text-slate-500">(%)</span>
                            <input 
                                name="discountPercentInput"
                                type="number" step="1"
                                className="w-12 text-right border border-slate-300 rounded px-1 text-xs bg-white"
                                placeholder="0"
                                value={localDiscountPercent}
                                onChange={e => setLocalDiscountPercent(e.target.value)}
                                onBlur={commitDiscountPercent}
                                onKeyDown={(e) => handleKeyDown(e, commitDiscountPercent)}
                                readOnly={isReadOnly}
                            />
                         </td>
                         <td className="text-right py-1 px-2 text-red-500">- $ {financials.descuentoVal.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="4" className="text-right py-1 px-2 flex items-center justify-end gap-2 whitespace-nowrap">
                            <Checkbox id="iva-check" checked={formData.aplicarIva} onCheckedChange={(c) => setFormData({...formData, aplicarIva: c})} disabled={isReadOnly && mode !== 'payment_only'}/>
                            <label htmlFor="iva-check" className="cursor-pointer flex items-center gap-1">
                                IVA 
                                {isAdmin ? (
                                    <span className="flex items-center">
                                        (<input type="number" className="w-8 text-center bg-transparent border-b border-slate-400 text-xs focus:outline-none focus:border-blue-600" value={formData.ivaPercentage} onChange={(e) => setFormData({...formData, ivaPercentage: parseFloat(e.target.value) || 0})} />%)
                                    </span>
                                ) : (<span>({formData.ivaPercentage}%)</span>)}
                            </label>
                         </td>
                         <td className="text-right py-1 px-2">$ {financials.iva.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr className="bg-slate-200 font-bold text-slate-900 border-t border-slate-300">
                         <td colSpan="4" className="text-right py-2 px-2">TOTAL</td>
                         <td className="text-right py-2 px-2">$ {financials.total.toFixed(2)}</td>
                         <td></td>
                      </tr>
                   </tfoot>
                </table>
             </div>
          </div>

          {/* SECTION 3: INFO CONTABLE */}
          <div className="space-y-4 pt-2">
             <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                <div className="text-xs text-slate-500 italic">Info contable</div>
                
                <div className="flex bg-slate-100 rounded-md p-1 gap-1">
                    <button type="button" onClick={() => setPaymentMode('full')} className={`text-xs px-3 py-1 rounded transition-colors ${paymentMode === 'full' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-500 hover:bg-slate-200'}`}>Pago Completo</button>
                    <button type="button" onClick={() => setPaymentMode('partial')} className={`text-xs px-3 py-1 rounded transition-colors ${paymentMode === 'partial' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-slate-500 hover:bg-slate-200'}`}>Anticipo</button>
                </div>
             </div>
             
             <div className={`border rounded p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 transition-colors ${paymentMode === 'full' ? 'bg-green-50/50 border-green-200' : 'bg-orange-50/50 border-orange-200'}`}>
                <div className="space-y-3">
                   <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">{paymentMode === 'full' ? 'Pago Total Inmediato' : 'Pago del Anticipo'}</h4>
                   
                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-20">{paymentMode === 'full' ? 'Monto Total:' : 'Monto Anticipo:'}</label>
                      <div className="relative flex-1">
                          <span className="absolute left-2 top-1.5 text-xs text-slate-500">$</span>
                          <input 
                            type="number" step="0.01" 
                            className={`w-full pl-6 pr-2 py-1 border rounded text-sm font-bold ${paymentMode === 'full' ? 'bg-slate-100 text-green-700' : 'bg-white border-slate-300'}`} 
                            // USAMOS EL ESTADO LOCAL AQUÍ
                            value={localAnticipo} 
                            onChange={handleAnticipoChange}
                            onBlur={handleAnticipoBlur} 
                            readOnly={paymentMode === 'full' || mode==='read_only'}
                            placeholder="0.00"
                          />
                      </div>
                   </div>

                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-20">Forma Pago:</label>
                      <select className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white" value={formData.formaPagoAnticipo} onChange={e => setFormData({...formData, formaPagoAnticipo: e.target.value})} disabled={mode==='read_only'}>
                         {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                   </div>

                   <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed border-slate-300">
                        <Checkbox id="chk-ret" checked={applyRetention} onCheckedChange={setApplyRetention} />
                        <label htmlFor="chk-ret" className="text-xs cursor-pointer select-none">¿Aplica Retención?</label>
                        {applyRetention && (
                            <div className="flex items-center gap-1 ml-auto">
                                <span className="text-xs text-slate-500">%</span>
                                {/* MODIFICACIÓN AQUÍ: INPUT DE RETENCIÓN LIBERADO */}
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className="w-12 text-center text-xs border-b border-slate-400 bg-transparent focus:outline-none" 
                                    value={formData.retentionPercent} 
                                    onChange={e => setFormData({...formData, retentionPercent: parseFloat(e.target.value) || 0})} 
                                    readOnly={mode === 'read_only'} 
                                    title="Porcentaje de Retención"
                                />
                                <span className="text-xs font-bold text-red-600">- $ {formData.retencion.toFixed(2)}</span>
                            </div>
                        )}
                   </div>
                </div>

                {paymentMode === 'partial' ? (
                    <div className="space-y-3 opacity-100 transition-opacity">
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Saldo Pendiente</h4>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold w-20">Saldo Restante:</label>
                            <div className="relative flex-1"><span className="absolute left-2 top-1.5 text-xs text-slate-500">$</span><input type="number" className="w-full pl-6 pr-2 py-1 border border-slate-300 rounded text-sm bg-red-50 font-bold text-red-700" value={financials.saldoPendiente.toFixed(2)} readOnly/></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold w-20">Forma Saldo:</label>
                            <select className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white" value={formData.formaPagoSaldo} onChange={e => setFormData({...formData, formaPagoSaldo: e.target.value})} disabled={mode==='read_only'}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold w-20">Nota Saldo:</label>
                            <input type="text" placeholder="Ej: Paga al retirar" className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" value={formData.notaSaldo} onChange={e => setFormData({...formData, notaSaldo: e.target.value})} />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 text-xs italic border border-dashed border-slate-300 rounded bg-slate-50">
                        <CheckCircle2 className="h-6 w-6 mb-1 text-green-500" />Orden pagada en su totalidad.<br/>Saldo Pendiente: $0.00
                    </div>
                )}
             </div>
          </div>

          {/* IMAGES & NOTES */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
             <div className="text-xs text-slate-500 italic">Arte/Diseño</div>
             <div className="border border-slate-300 p-4 rounded-sm">
                <div className="min-h-[100px] border border-slate-200 bg-slate-50 mb-3 p-3 flex flex-wrap gap-4">
                   {(!formData.imagenes || formData.imagenes.length === 0) && (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs py-4">
                            <FileImage className="h-8 w-8 mb-2 opacity-50" /><span>Sin imágenes adjuntas</span>
                        </div>
                   )}
                   {formData.imagenes?.map((img, i) => (
                      <div key={i} className="relative group w-24 h-24 border border-slate-300 bg-white rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all">
                         <img src={img.url} alt={img.name} className="w-full h-full object-cover" title={img.name} />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1"><span className="text-[10px] text-white truncate w-full">{img.name}</span></div>
                         {!isReadOnly && <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"><X className="h-3 w-3" /></button>}
                      </div>
                   ))}
                </div>
                {!isReadOnly && (<div><input type="file" id="file-upload" multiple accept="image/*" className="hidden" onChange={handleImageUpload}/><label htmlFor="file-upload" className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded cursor-pointer"><Plus className="h-3 w-3" /> Agregar...</label></div>)}
             </div>
             <div className="pt-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Observaciones:</label>
                <textarea className="w-full border border-slate-300 rounded p-2 text-sm h-20 resize-none focus:border-blue-500 outline-none" value={formData.notas} onChange={e => setFormData({...formData, notas: e.target.value})} readOnly={isReadOnly} />
             </div>
          </div>
        </form>
      </div>

      <div className="bg-slate-50 border-t border-slate-300 p-4 flex justify-end gap-3">
         <Button type="button" variant="outline" onClick={onCancel} className="bg-white">Cancelar</Button>
         <Button type="submit" form="orderForm" disabled={loading} className="bg-[#004080] hover:bg-blue-900 text-white px-8">
            {loading ? 'Guardando...' : (mode === 'create' ? 'Guardar Orden' : 'Actualizar Orden')}
         </Button>
      </div>

      {showNewClientModal && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200 p-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="font-bold text-lg">Nuevo Cliente</h3>
                <Button size="sm" variant="ghost" onClick={()=>setShowNewClientModal(false)}><X/></Button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <ClientForm onCancel={()=>setShowNewClientModal(false)} onSuccess={handleNewClientCreated} clienteAEditar={{nombre: searchTerm}} />
            </div>
        </div>
      )}
    </motion.div>
  );
};

export default OrderForm;