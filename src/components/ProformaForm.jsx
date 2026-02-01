
import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';
import { motion } from 'framer-motion';

const ProformaForm = ({ 
  initialData = null,
  clients = [],
  staffUsers = [],
  onSubmit,
  onCancel,
  mode = 'create', // 'create' or 'edit'
  currentUser,
  nextProformaNumber
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [formData, setFormData] = useState({
    cliente: '',
    clienteData: null,
    items: [{ producto: '', cantidad: 1, precioUnitario: 0 }],
    descuentoTipo: 'porcentaje', // 'porcentaje' o 'fijo'
    descuentoValor: 0,
    impuestoTasa: 15, // IVA 15%
    
    // Payment Terms
    formaPago: 'Efectivo',
    creditoVence: '',
    
    // New Fields
    deliveryTime: '', // text for "días laborales"
    advancePercentage: 50,
    balancePercentage: 50,
    
    // Notes
    notasInternas: '',
    
    responsable: currentUser?.name || ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        // Ensure default values for new fields if editing old data
        advancePercentage: initialData.advancePercentage || 50,
        balancePercentage: initialData.balancePercentage || 50,
        deliveryTime: initialData.deliveryTime || initialData.tiempoEntrega || '',
      });
    }
  }, [initialData]);

  // Determine valid responsables
  const isAdmin = currentUser?.role === 'Administrador';
  const isSeller = currentUser?.role === 'Vendedor';
  
  const validSellers = useMemo(() => {
    const sellers = getValidSellers(staffUsers);
    return removeDuplicateUsers(sellers);
  }, [staffUsers]);

  // Auto-assign if seller and creating
  useEffect(() => {
    if (mode === 'create' && isSeller) {
       setFormData(prev => ({ ...prev, responsable: currentUser.name }));
    }
  }, [mode, isSeller, currentUser]);

  const formasPago = ['Efectivo', 'Transferencia', 'Cheque', 'Crédito', 'Tarjeta'];

  const handleClientChange = (e) => {
    const clientId = e.target.value;
    const clientName = e.target.options[e.target.selectedIndex].text;
    
    // Parse client name if it's in format "Name - RUC"
    const selectedClient = clients.find(c => c.id === clientId) || { razonSocial: clientName.split(' - ')[0], id: clientId };
    
    setFormData(prev => ({
      ...prev,
      cliente: clientId,
      clienteData: selectedClient
    }));
    if (errors.cliente) {
      setErrors(prev => ({ ...prev, cliente: null }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    // Auto-add row if typing in last row
    if (index === newItems.length - 1 && value !== '' && field === 'producto') {
       newItems.push({ producto: '', cantidad: 1, precioUnitario: 0 });
    }
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Calculations
  const subtotal = formData.items.reduce((sum, item) => {
    if (!item.producto) return sum;
    return sum + (Number(item.cantidad) * Number(item.precioUnitario));
  }, 0);

  const descuento = formData.descuentoTipo === 'porcentaje' 
    ? (subtotal * Number(formData.descuentoValor)) / 100
    : Number(formData.descuentoValor);

  const subtotalConDescuento = subtotal - descuento;
  const impuesto = (subtotalConDescuento * Number(formData.impuestoTasa)) / 100;
  const total = subtotalConDescuento + impuesto;

  const anticipoMonto = (total * (formData.advancePercentage || 0)) / 100;
  const saldoMonto = (total * (formData.balancePercentage || 0)) / 100;

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.cliente) newErrors.cliente = 'Seleccione un cliente';
    
    const validItems = formData.items.filter(item => item.producto.trim() !== '');
    if (validItems.length === 0) newErrors.items = 'Agregue al menos un producto válido';
    
    if (!formData.deliveryTime) newErrors.deliveryTime = 'Ingrese tiempo de entrega';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (status = 'BORRADOR') => {
    if (!validateForm()) {
      toast({
        title: "Formulario incompleto",
        description: "Complete todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    // Filter empty items
    const validItems = formData.items.filter(item => item.producto.trim() !== '');

    setIsSavingDraft(true);

    try {
      const proformaData = {
        ...formData,
        items: validItems,
        proformaNumber: initialData?.proformaNumber || nextProformaNumber,
        status, // Usually BORRADOR on creation
        financials: {
          subtotal,
          descuento,
          impuesto,
          total
        },
        anticipoMonto,
        saldoMonto,
        tiempoEntrega: formData.deliveryTime // Map for compatibility
      };

      await onSubmit(proformaData);
      
      toast({
        title: "✅ Guardado exitoso",
        description: `Proforma #${String(proformaData.proformaNumber).padStart(7, '0')} guardada`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la proforma",
        variant: "destructive"
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const getDisplayedNumber = () => {
     const num = initialData?.proformaNumber || nextProformaNumber;
     return String(num).padStart(7, '0');
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
            ? `Nueva Proforma (${getDisplayedNumber()})` 
            : `Editar Proforma #${getDisplayedNumber()}`
          }
        </h2>
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
             <X className="h-5 w-5 text-slate-500" />
           </Button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 bg-white">
        <div className="space-y-6">
          
          {/* SECTION 1: GENERAL INFO */}
          <div className="space-y-3 pb-6 border-b border-slate-200">
             <h3 className="font-bold text-slate-700 text-sm border-b border-blue-500 pb-1 mb-3 inline-block">Información General</h3>
             
             <div className="grid grid-cols-12 gap-4 items-center">
                {/* Responsable */}
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Responsable:</label>
                <div className="col-span-12 md:col-span-4">
                   {isAdmin ? (
                      <select 
                        className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                        value={formData.responsable}
                        onChange={(e) => setFormData({...formData, responsable: e.target.value})}
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
                        value={formData.responsable}
                        readOnly
                      />
                   )}
                </div>

                {/* Cliente */}
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700 md:text-right px-4">Cliente:</label>
                <div className="col-span-12 md:col-span-4">
                   <select
                      value={formData.cliente}
                      onChange={handleClientChange}
                      className={cn(
                        "w-full border rounded px-2 py-1 text-sm bg-white focus:outline-none",
                        errors.cliente ? "border-red-500" : "border-slate-300"
                      )}
                   >
                    <option value="">Seleccionar...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.razonSocial} - {client.ruc || client.cedulaRuc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tiempo Entrega */}
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Tiempo Entrega:</label>
                <div className="col-span-12 md:col-span-10">
                   <input 
                      type="text" 
                      className={cn(
                        "w-full md:w-1/3 border rounded px-2 py-1 text-sm focus:outline-none",
                        errors.deliveryTime ? "border-red-500" : "border-slate-300"
                      )}
                      value={formData.deliveryTime}
                      onChange={e => setFormData({...formData, deliveryTime: e.target.value})}
                      placeholder="Ej: 5 días laborales"
                   />
                </div>
             </div>
          </div>

          {/* SECTION 2: ITEMS TABLE */}
          <div className="space-y-2">
             <div className="text-xs text-slate-500 italic">Detalle de Productos / Servicios</div>
             <div className="border border-slate-300 rounded-sm overflow-hidden">
                <table className="w-full text-sm">
                   <thead className="bg-[#004080] text-white text-xs">
                      <tr>
                         <th className="py-1 px-2 text-left">Descripción</th>
                         <th className="py-1 px-2 text-center w-24">Cantidad</th>
                         <th className="py-1 px-2 text-right w-32">P. Unitario</th>
                         <th className="py-1 px-2 text-right w-32">Total</th>
                         <th className="w-8"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-200">
                      {formData.items.map((row, idx) => {
                        const rowTotal = (parseFloat(row.cantidad) || 0) * (parseFloat(row.precioUnitario) || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 group">
                             <td className="py-1 px-2">
                                <input 
                                  type="text" 
                                  className="w-full border-none bg-transparent focus:ring-0 text-sm p-0 placeholder-slate-300"
                                  placeholder={idx === formData.items.length - 1 ? "Agregar item..." : ""}
                                  value={row.producto}
                                  onChange={e => handleItemChange(idx, 'producto', e.target.value)}
                                />
                             </td>
                             <td className="py-1 px-2">
                                <input 
                                  type="number" 
                                  step="1"
                                  className="w-full text-center border-none bg-transparent focus:ring-0 text-sm p-0"
                                  value={row.cantidad || ''}
                                  onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                                />
                             </td>
                             <td className="py-1 px-2">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full text-right border-none bg-transparent focus:ring-0 text-sm p-0"
                                  value={row.precioUnitario || ''}
                                  onChange={e => handleItemChange(idx, 'precioUnitario', e.target.value)}
                                />
                             </td>
                             <td className="py-1 px-2 text-right font-medium text-slate-700">
                                $ {rowTotal.toFixed(2)}
                             </td>
                             <td className="py-1 px-1 text-center">
                                {row.producto && formData.items.length > 1 && (
                                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity">
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
                         <td colSpan="3" className="text-right py-1 px-2">SubTotal</td>
                         <td className="text-right py-1 px-2">$ {subtotal.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="3" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                            <span>Descuento</span>
                            <div className="flex items-center border border-slate-300 rounded bg-white overflow-hidden">
                               <select 
                                  className="text-xs px-1 py-0.5 border-r border-slate-200 outline-none"
                                  value={formData.descuentoTipo}
                                  onChange={e => setFormData({...formData, descuentoTipo: e.target.value})}
                               >
                                  <option value="porcentaje">%</option>
                                  <option value="fijo">$</option>
                               </select>
                               <input 
                                 type="number" step="0.01"
                                 className="w-16 text-right px-1 py-0.5 outline-none text-xs"
                                 value={formData.descuentoValor}
                                 onChange={e => setFormData({...formData, descuentoValor: parseFloat(e.target.value) || 0})}
                               />
                            </div>
                         </td>
                         <td className="text-right py-1 px-2 text-red-500">- $ {descuento.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="3" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                             <span>IVA (%)</span>
                             <input 
                               type="number" step="0.01"
                               className="w-12 text-right border border-slate-300 rounded px-1 text-xs"
                               value={formData.impuestoTasa}
                               onChange={e => setFormData({...formData, impuestoTasa: parseFloat(e.target.value) || 0})}
                             />
                         </td>
                         <td className="text-right py-1 px-2">$ {impuesto.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                         <td colSpan="3" className="text-right py-2 px-2">TOTAL</td>
                         <td className="text-right py-2 px-2">$ {total.toFixed(2)}</td>
                         <td></td>
                      </tr>
                   </tfoot>
                </table>
             </div>
          </div>

          {/* SECTION 3: COMMERCIAL TERMS */}
          <div className="space-y-4 pt-2">
             <div className="text-xs text-slate-500 italic border-b border-slate-200 pb-1">Condiciones Comerciales</div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <label className="text-xs font-bold text-slate-700">Anticipo (%):</label>
                       <div className="flex items-center gap-2">
                          <input 
                             type="number" 
                             className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-right"
                             value={formData.advancePercentage}
                             onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setFormData({...formData, advancePercentage: val, balancePercentage: 100 - val});
                             }}
                          />
                          <span className="text-sm font-bold w-24 text-right">$ {anticipoMonto.toFixed(2)}</span>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <label className="text-xs font-bold text-slate-700">Saldo contra entrega (%):</label>
                       <div className="flex items-center gap-2">
                          <input 
                             type="number" 
                             className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-right"
                             value={formData.balancePercentage}
                             onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setFormData({...formData, balancePercentage: val, advancePercentage: 100 - val});
                             }}
                          />
                          <span className="text-sm font-bold w-24 text-right">$ {saldoMonto.toFixed(2)}</span>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <label className="text-xs font-bold text-slate-700 w-24">Forma Pago:</label>
                       <select 
                          className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                          value={formData.formaPago}
                          onChange={e => {
                             const val = e.target.value;
                             setFormData({...formData, formaPago: val, creditoVence: val === 'Crédito' ? formData.creditoVence : ''});
                          }}
                       >
                          {formasPago.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                       </select>
                    </div>
                    
                    {formData.formaPago === 'Crédito' && (
                       <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-slate-700 w-24">Vencimiento:</label>
                          <input 
                             type="date"
                             className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
                             value={formData.creditoVence}
                             onChange={e => setFormData({...formData, creditoVence: e.target.value})}
                          />
                       </div>
                    )}
                 </div>
             </div>
          </div>

          {/* SECTION 4: NOTES */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
             <label className="text-xs font-bold text-slate-700 block mb-1">Notas Internas:</label>
             <textarea 
                className="w-full border border-slate-300 rounded p-2 text-sm h-20 resize-none focus:outline-none"
                value={formData.notasInternas}
                onChange={e => setFormData({...formData, notasInternas: e.target.value})}
                placeholder="Observaciones para uso interno..."
             />
          </div>

        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-slate-50 border-t border-slate-300 p-4 flex justify-end gap-3">
         <Button type="button" variant="outline" onClick={onCancel} className="bg-white">Cancelar</Button>
         <Button 
            type="button" 
            onClick={() => handleSubmit('BORRADOR')} 
            className="bg-[#004080] hover:bg-blue-900 text-white px-8 gap-2"
            disabled={isSavingDraft}
         >
            {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Proforma
         </Button>
      </div>
    </motion.div>
  );
};

export default ProformaForm;
