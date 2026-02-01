
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Calendar, Upload, FileImage, Calculator, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';

const IVA_RATE = 0.15; 
const PAYMENT_METHODS = ['No aplica', 'Efectivo', 'Cheque', 'Transferencia', 'Depósito', 'Tarjeta', 'Crédito'];

// Updated order types
const ORDER_TYPES = [
  'VENTA CON PRODUCCION (VPVC) (4 pasos)',
  'VENTA CORTA (VC) (2 pasos)'
];

// Generate 15-min time slots from 8:00 AM to 8:00 PM
const TIME_SLOTS = [];
for (let h = 8; h <= 20; h++) {
  const hour = h.toString().padStart(2, '0');
  if (h === 20) {
    TIME_SLOTS.push(`${hour}:00`);
    continue;
  }
  ['00', '15', '30', '45'].forEach(m => TIME_SLOTS.push(`${hour}:${m}`));
}

const OrderForm = ({ 
  currentUser, 
  clients = [], 
  staffUsers = [],
  onSubmit, 
  onCancel, 
  initialData = null, 
  mode = 'create',
  nextOrderNumber,
  onCheckAvailability,
  onCreateClient
}) => {
  const { toast } = useToast();
  const isReadOnly = mode === 'payment_only';
  const isAdmin = currentUser?.role === 'Administrador';

  const [formData, setFormData] = useState(initialData || {
    orderNumber: nextOrderNumber,
    vendedor: currentUser?.name || '',
    cliente: '',
    tipoLetrero: '',
    tipoOrden: 'VENTA CON PRODUCCION (VPVC) (4 pasos)',
    fechaEntrega: '',
    productos: Array(5).fill({ descripcion: '', precio: 0, cantidad: 0, completed: false }), 
    
    // Contable
    anticipo: 0,
    retencion: 0,
    formaPagoAnticipo: 'No aplica',
    creditoVenceAnticipo: '',
    notaAnticipo: '',
    
    saldo: 0,
    formaPagoSaldo: 'No aplica',
    creditoVenceSaldo: '',
    notaSaldo: '',

    // Config
    descuentoPorcentaje: 0,
    aplicarIva: true,
    origenProformaId: '',
    
    // Archivos
    imagenes: [],
    notas: ''
  });

  const [financials, setFinancials] = useState({
    subtotal: 0,
    descuentoVal: 0,
    baseImponible: 0,
    iva: 0,
    total: 0,
    saldoPendiente: 0
  });

  // Determine valid responsables
  const isSeller = currentUser?.role === 'Vendedor';
  
  const validSellers = useMemo(() => {
    const sellers = getValidSellers(staffUsers);
    return removeDuplicateUsers(sellers);
  }, [staffUsers]);

  // Auto-assign if seller and creating
  useEffect(() => {
    if (mode === 'create' && isSeller) {
       setFormData(prev => ({ ...prev, vendedor: currentUser.name }));
    }
  }, [mode, isSeller, currentUser]);

  // Derived Date/Time parts for inputs
  const currentDatePart = formData.fechaEntrega ? formData.fechaEntrega.split('T')[0] : '';
  const currentTimePart = formData.fechaEntrega ? new Date(formData.fechaEntrega).toTimeString().slice(0,5) : '12:00';

  const handleDateTimeChange = (date, time) => {
    if (!date) {
      setFormData(prev => ({ ...prev, fechaEntrega: '' }));
      return;
    }
    const t = time || '12:00';
    setFormData(prev => ({ ...prev, fechaEntrega: `${date}T${t}:00` }));
  };

  // Ensure products array has at least some rows
  useEffect(() => {
    if (formData.productos.length === 0) {
      setFormData(prev => ({ ...prev, productos: Array(5).fill({ descripcion: '', precio: 0, cantidad: 0 }) }));
    }
  }, []);

  // Calculation Logic
  useEffect(() => {
    const subtotal = formData.productos.reduce((sum, p) => {
      if (!p.descripcion) return sum;
      return sum + ((parseFloat(p.cantidad) || 0) * (parseFloat(p.precio) || 0));
    }, 0);

    const descuentoVal = subtotal * (formData.descuentoPorcentaje / 100);
    const baseImponible = subtotal - descuentoVal;
    const iva = formData.aplicarIva ? baseImponible * IVA_RATE : 0;
    const total = baseImponible + iva;
    
    const anticipo = parseFloat(formData.anticipo) || 0;
    const retencion = parseFloat(formData.retencion) || 0;
    const saldoPendiente = total - anticipo - retencion;

    setFinancials({
      subtotal,
      descuentoVal,
      baseImponible,
      iva,
      total,
      saldoPendiente
    });
  }, [formData.productos, formData.descuentoPorcentaje, formData.aplicarIva, formData.anticipo, formData.retencion]);

  const handleProductChange = (index, field, value) => {
    const newProducts = [...formData.productos];
    newProducts[index] = { ...newProducts[index], [field]: value };
    // If typing in the last row, add a new one automatically
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

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.size > 2000000) { // 2MB limit
        toast({ title: "⚠️ Archivo muy grande", description: `${file.name} excede 2MB`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          imagenes: [...(prev.imagenes || []), { name: file.name, url: reader.result }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Strict Role Validation for Editing
    if (mode === 'edit' && !isAdmin) {
       toast({ title: "⛔ Permiso denegado", description: "No tienes permiso para editar órdenes existentes.", variant: "destructive" });
       return;
    }

    if (!formData.cliente) {
      toast({ title: "⚠️ Campo requerido", description: "Seleccione un cliente", variant: "destructive" });
      return;
    }
    
    const validProducts = formData.productos.filter(p => p.descripcion && p.descripcion.trim() !== '');
    
    if (validProducts.length === 0) {
      toast({ title: "⚠️ Sin productos", description: "Agregue al menos un item a producir", variant: "destructive" });
      return;
    }

    const submissionData = {
      ...formData,
      productos: validProducts,
      financials: {
        total: financials.total,
        saldo: financials.saldoPendiente,
        iva: financials.iva,
        subtotal: financials.subtotal
      }
    };

    onSubmit(submissionData);
  };

  const getDisplayedOrderNumber = () => {
     return (formData.orderNumber || '').toString().padStart(7, '0');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white shadow-xl rounded-lg flex flex-col h-full border border-slate-300"
    >
      {/* Header Bar */}
      <div className="bg-slate-100 border-b border-slate-300 px-6 py-3 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 uppercase">
          {mode === 'create' 
            ? `Orden de Producción NUEVA (${getDisplayedOrderNumber()})` 
            : `Editar Orden #${getDisplayedOrderNumber()}`
          }
        </h2>
        <div className="flex items-center gap-2">
           <div className="text-xs text-slate-500 mr-4">
              <span className="font-semibold">Inicio &gt;</span> Orden de Producción NUEVA
           </div>
           <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
             <X className="h-5 w-5 text-slate-500" />
           </Button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 bg-white">
        <form id="orderForm" onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: GENERAL INFO */}
          <div className="space-y-3 pb-6 border-b border-slate-200">
             <h3 className="font-bold text-slate-700 text-sm border-b border-blue-500 pb-1 mb-3 inline-block">NUEVA Orden</h3>
             
             <div className="grid grid-cols-12 gap-4 items-center">
                {/* Row 1 */}
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Titulo / Referencia:</label>
                <div className="col-span-12 md:col-span-10">
                   <input 
                     type="text" 
                     className="w-full md:w-1/2 border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                     value={formData.tipoLetrero}
                     onChange={e => setFormData({...formData, tipoLetrero: e.target.value})}
                     readOnly={isReadOnly}
                     required
                   />
                </div>

                {/* Row 2 */}
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Tipo de Orden:</label>
                <div className="col-span-12 md:col-span-4">
                   <select 
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                      value={formData.tipoOrden}
                      onChange={e => setFormData({...formData, tipoOrden: e.target.value})}
                      disabled={isReadOnly}
                   >
                      {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>

                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700 md:text-right px-4">Responsable:</label>
                <div className="col-span-12 md:col-span-4">
                   {isAdmin && !isReadOnly ? (
                      <select 
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                        value={formData.vendedor}
                        onChange={e => setFormData({...formData, vendedor: e.target.value})}
                      >
                         <option value="">Seleccionar...</option>
                         {validSellers.map(u => (
                            <option key={u.id} value={u.name}>{formatResponsableName(u)}</option>
                         ))}
                      </select>
                   ) : (
                      <input 
                        type="text" 
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-slate-100"
                        value={formData.vendedor}
                        readOnly
                      />
                   )}
                </div>

                {/* Row 3 */}
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Cliente:</label>
                <div className="col-span-12 md:col-span-10 flex gap-2 items-center">
                   <input 
                      list="clients-list"
                      className="w-full md:w-1/2 border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                      value={formData.cliente}
                      onChange={e => setFormData({...formData, cliente: e.target.value})}
                      placeholder="Buscar cliente..."
                      readOnly={isReadOnly}
                      required
                   />
                   <datalist id="clients-list">
                      {clients.map(c => (
                        <option key={c.id} value={`${c.razonSocial} - ${c.ruc || ''}`} />
                      ))}
                   </datalist>
                   {!isReadOnly && (
                     <Button type="button" size="sm" variant="outline" onClick={onCreateClient} className="h-7 text-xs px-2 border-blue-400 text-blue-600 hover:bg-blue-50">
                        + Cliente
                     </Button>
                   )}
                </div>

                {/* Row 4 */}
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Fecha entrega:</label>
                <div className="col-span-12 md:col-span-4 flex items-center gap-2">
                   <input 
                      type="date" 
                      className="border border-slate-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none flex-1"
                      value={currentDatePart}
                      onChange={e => handleDateTimeChange(e.target.value, currentTimePart)}
                      readOnly={isReadOnly}
                      required
                   />
                   <select
                      className="border border-slate-300 rounded px-2 py-1 text-sm bg-white w-24"
                      value={currentTimePart}
                      onChange={e => handleDateTimeChange(currentDatePart, e.target.value)}
                      disabled={isReadOnly}
                   >
                     {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <button 
                     type="button" 
                     onClick={onCheckAvailability}
                     className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                   >
                      <Calendar className="h-3 w-3" />
                   </button>
                </div>
                
                {/* Proforma Link */}
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700 md:text-right px-4">Proforma:</label>
                <div className="col-span-12 md:col-span-4">
                   {formData.origenProformaId ? (
                      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded border border-blue-200">
                         <Link className="h-3 w-3" />
                         <span className="text-sm font-semibold">#{String(formData.origenProformaId).padStart(7,'0')}</span>
                      </div>
                   ) : (
                      <div className="text-slate-400 text-sm italic px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
                         N/A
                      </div>
                   )}
                </div>
             </div>
          </div>

          {/* SECTION 2: PRODUCTIONS TABLE */}
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
                        const rowTotal = (parseFloat(row.cantidad) || 0) * (parseFloat(row.precio) || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 group">
                             <td className="py-1 px-2 text-slate-400 text-xs text-center">{idx + 1}</td>
                             <td className="py-1 px-2">
                                <input 
                                  type="text" 
                                  className="w-full border-none bg-transparent focus:ring-0 text-sm p-0 placeholder-slate-300"
                                  placeholder={idx === formData.productos.length - 1 ? "Agregar item..." : ""}
                                  value={row.descripcion}
                                  onChange={e => handleProductChange(idx, 'descripcion', e.target.value)}
                                  readOnly={isReadOnly}
                                />
                             </td>
                             <td className="py-1 px-2">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full text-right border-none bg-transparent focus:ring-0 text-sm p-0"
                                  value={row.precio || ''}
                                  onChange={e => handleProductChange(idx, 'precio', e.target.value)}
                                  readOnly={isReadOnly}
                                />
                             </td>
                             <td className="py-1 px-2">
                                <input 
                                  type="number" 
                                  step="1"
                                  className="w-full text-center border-none bg-transparent focus:ring-0 text-sm p-0"
                                  value={row.cantidad || ''}
                                  onChange={e => handleProductChange(idx, 'cantidad', e.target.value)}
                                  readOnly={isReadOnly}
                                />
                             </td>
                             <td className="py-1 px-2 text-right font-medium text-slate-700">
                                $ {rowTotal.toFixed(2)}
                             </td>
                             <td className="py-1 px-1 text-center">
                                {!isReadOnly && row.descripcion && (
                                  <button type="button" onClick={() => handleRemoveProductRow(idx)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity">
                                     <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                             </td>
                          </tr>
                        );
                      })}
                   </tbody>
                   <tfoot className="bg-slate-50 text-xs font-medium text-slate-700 border-t border-slate-300">
                      <tr>
                         <td colSpan="4" className="text-right py-1 px-2">SubTotal</td>
                         <td className="text-right py-1 px-2">$ {financials.subtotal.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="4" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                            <span>Dscto ($)</span>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-16 text-right border border-slate-300 rounded px-1 text-xs"
                              value={financials.descuentoVal > 0 ? financials.descuentoVal.toFixed(2) : ''}
                              placeholder="0.00"
                              onChange={e => {
                                 const val = parseFloat(e.target.value) || 0;
                                 const percent = financials.subtotal > 0 ? (val / financials.subtotal) * 100 : 0;
                                 setFormData({...formData, descuentoPorcentaje: percent});
                              }}
                              readOnly={isReadOnly}
                            />
                            <span>(%)</span>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-12 text-right border border-slate-300 rounded px-1 text-xs"
                              value={formData.descuentoPorcentaje > 0 ? formData.descuentoPorcentaje.toFixed(2) : ''}
                              placeholder="0"
                              onChange={e => setFormData({...formData, descuentoPorcentaje: parseFloat(e.target.value) || 0})}
                              readOnly={isReadOnly}
                            />
                         </td>
                         <td className="text-right py-1 px-2 text-red-500">- $ {financials.descuentoVal.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="4" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                             <Checkbox 
                               checked={formData.aplicarIva} 
                               onCheckedChange={(checked) => setFormData({...formData, aplicarIva: checked})}
                               disabled={isReadOnly && mode !== 'payment_only'}
                             />
                             <span>IVA ({IVA_RATE * 100}%)</span>
                         </td>
                         <td className="text-right py-1 px-2">$ {financials.iva.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
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
             <div className="text-xs text-slate-500 italic border-b border-slate-200 pb-1">Info contable</div>
             
             <div className="border border-slate-300 rounded p-4 bg-slate-50/50 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {/* Left Col: Anticipo */}
                <div className="space-y-2">
                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-16">Anticipo:</label>
                      <div className="relative flex-1">
                         <span className="absolute left-2 top-1 text-xs text-slate-500">$</span>
                         <input 
                            type="number" step="0.01"
                            className="w-full pl-5 pr-2 py-1 border border-slate-300 rounded text-sm"
                            value={formData.anticipo}
                            onChange={e => setFormData({...formData, anticipo: parseFloat(e.target.value) || 0})}
                            readOnly={mode === 'read_only'}
                         />
                      </div>
                      <label className="text-xs font-bold w-16 text-right">Retencion:</label>
                      <div className="relative w-24">
                         <input 
                            type="number" step="0.01"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right"
                            value={formData.retencion}
                            onChange={e => setFormData({...formData, retencion: parseFloat(e.target.value) || 0})}
                            readOnly={mode === 'read_only'}
                         />
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-16">Forma:</label>
                      <select 
                         className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                         value={formData.formaPagoAnticipo}
                         onChange={e => {
                             const val = e.target.value;
                             setFormData(prev => ({
                               ...prev, 
                               formaPagoAnticipo: val,
                               creditoVenceAnticipo: val === 'Crédito' ? prev.creditoVenceAnticipo : ''
                             }));
                         }}
                         disabled={mode === 'read_only'}
                      >
                         {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                   </div>

                   {formData.formaPagoAnticipo === 'Crédito' && (
                     <div className="flex items-center gap-2">
                        <label className="text-xs font-bold w-16 whitespace-nowrap">Crédito Vence:</label>
                        <input 
                           type="date"
                           className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                           value={formData.creditoVenceAnticipo}
                           onChange={e => setFormData({...formData, creditoVenceAnticipo: e.target.value})}
                           readOnly={mode === 'read_only'}
                        />
                     </div>
                   )}

                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-16">Nota:</label>
                      <input 
                         type="text"
                         className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                         value={formData.notaAnticipo}
                         onChange={e => setFormData({...formData, notaAnticipo: e.target.value})}
                         readOnly={mode === 'read_only'}
                      />
                   </div>
                </div>

                {/* Right Col: Saldo */}
                <div className="space-y-2">
                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-16">Saldo:</label>
                      <div className="relative flex-1">
                         <span className="absolute left-2 top-1 text-xs text-slate-500">$</span>
                         <input 
                            type="number" step="0.01"
                            className="w-full pl-5 pr-2 py-1 border border-slate-300 rounded text-sm bg-slate-100 font-bold text-slate-700"
                            value={financials.saldoPendiente.toFixed(2)}
                            readOnly
                         />
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-16">Forma:</label>
                      <select 
                         className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                         value={formData.formaPagoSaldo}
                         onChange={e => {
                             const val = e.target.value;
                             setFormData(prev => ({
                               ...prev, 
                               formaPagoSaldo: val,
                               creditoVenceSaldo: val === 'Crédito' ? prev.creditoVenceSaldo : ''
                             }));
                         }}
                         disabled={mode === 'read_only'}
                      >
                         {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                   </div>

                   {formData.formaPagoSaldo === 'Crédito' && (
                     <div className="flex items-center gap-2">
                        <label className="text-xs font-bold w-16 whitespace-nowrap">Crédito Vence:</label>
                        <input 
                           type="date"
                           className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                           value={formData.creditoVenceSaldo}
                           onChange={e => setFormData({...formData, creditoVenceSaldo: e.target.value})}
                           readOnly={mode === 'read_only'}
                        />
                     </div>
                   )}

                   <div className="flex items-center gap-2">
                      <label className="text-xs font-bold w-16">Nota:</label>
                      <input 
                         type="text"
                         className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                         value={formData.notaSaldo}
                         onChange={e => setFormData({...formData, notaSaldo: e.target.value})}
                         readOnly={mode === 'read_only'}
                      />
                   </div>
                </div>
             </div>
          </div>

          {/* SECTION 4: FILES & NOTES */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
             <div className="text-xs text-slate-500 italic">Arte/Diseño (solamente Imágenes)</div>
             
             <div className="border border-slate-300 p-4 rounded-sm">
                <div className="min-h-[60px] border border-slate-200 bg-slate-50 mb-3 p-2 flex flex-wrap gap-2">
                   {(!formData.imagenes || formData.imagenes.length === 0) && (
                      <span className="text-slate-400 text-sm p-1">Ningún archivo seleccionado</span>
                   )}
                   {formData.imagenes?.map((img, i) => (
                      <div key={i} className="relative group border border-slate-300 bg-white p-1 rounded">
                         <div className="flex items-center gap-2 text-xs">
                            <FileImage className="h-4 w-4 text-blue-500" />
                            <span className="max-w-[150px] truncate" title={img.name}>{img.name || 'Imagen ' + (i+1)}</span>
                         </div>
                         {!isReadOnly && (
                            <button 
                              type="button" 
                              onClick={() => removeImage(i)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                               <X className="h-3 w-3" />
                            </button>
                         )}
                      </div>
                   ))}
                </div>
                
                {!isReadOnly && (
                   <div>
                      <input 
                         type="file" 
                         id="file-upload" 
                         multiple 
                         accept="image/*"
                         className="hidden" 
                         onChange={handleImageUpload}
                      />
                      <label htmlFor="file-upload" className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded cursor-pointer transition-colors">
                         <Plus className="h-3 w-3" /> Agregar...
                      </label>
                   </div>
                )}
             </div>

             <div className="pt-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Observaciones / Notas:</label>
                <textarea 
                   className="w-full border border-slate-300 rounded p-2 text-sm h-20 resize-none focus:border-blue-500 focus:outline-none"
                   value={formData.notas}
                   onChange={e => setFormData({...formData, notas: e.target.value})}
                   readOnly={isReadOnly}
                />
             </div>
          </div>
          
        </form>
      </div>

      {/* Footer Actions */}
      <div className="bg-slate-50 border-t border-slate-300 p-4 flex justify-end gap-3">
         <Button type="button" variant="outline" onClick={onCancel} className="bg-white">Cancelar</Button>
         <Button type="submit" form="orderForm" className="bg-[#004080] hover:bg-blue-900 text-white px-8">
            {mode === 'create' ? 'Guardar Orden' : 'Actualizar Orden'}
         </Button>
      </div>
    </motion.div>
  );
};

export default OrderForm;
