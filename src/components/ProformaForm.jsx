import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, Loader2, Search, ShoppingCart, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { getValidSellers, formatResponsableName, removeDuplicateUsers } from '@/lib/utils';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import ClientForm from './ClientForm';

const ProformaForm = ({ 
  initialData = null,
  clients = [],
  staffUsers = [],
  onSubmit,
  onCancel,
  mode = 'create', 
  currentUser,
  nextProformaNumber,
  onReloadClients
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Estados para el Cliente Nuevo
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🔥 SOLUCIÓN: Congelamos el nombre del nuevo cliente 🔥
  const newClientInitialData = useMemo(() => {
      return showNewClientModal ? { nombre: searchTerm } : null;
  }, [showNewClientModal]);

  // Estados para el Catálogo
  const [catalogItems, setCatalogItems] = useState([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [searchCatalog, setSearchCatalog] = useState('');
  const [activeProductSearchRow, setActiveProductSearchRow] = useState(null);
  const [productSuggestions, setProductSuggestions] = useState([]);

  const [formData, setFormData] = useState({
    cliente: '',
    clienteData: null,
    items: [{ producto: '', cantidad: 0, precioUnitario: 0, es_por_metro: false }],
    descuentoTipo: 'porcentaje', 
    descuentoValor: 0,
    impuestoTasa: 15, 
    
    formaPago: 'Efectivo',
    creditoVence: '',
    
    deliveryTime: '', 
    advancePercentage: 50,
    balancePercentage: 50,
    notasInternas: '',
    responsable: currentUser?.name || '',
    
    esMayorista: false
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        advancePercentage: initialData.advancePercentage || 50,
        balancePercentage: initialData.balancePercentage || 50,
        deliveryTime: initialData.deliveryTime || initialData.tiempoEntrega || '',
        esMayorista: initialData.esMayorista || false,
        items: (initialData.items || []).map(p => ({
            ...p,
            precioUnitario: p.precioUnitario !== undefined ? p.precioUnitario : p.precio || 0
        }))
      });
      if (initialData.clienteData?.nombre) {
         setSearchTerm(initialData.clienteData.nombre);
      }
    }
  }, [initialData]);

  const isAdmin = currentUser?.role === 'Administrador';
  const isSeller = currentUser?.role === 'Vendedor';
  
  const validSellers = useMemo(() => removeDuplicateUsers(getValidSellers(staffUsers)), [staffUsers]);

  useEffect(() => {
    if (mode === 'create' && isSeller) {
       setFormData(prev => ({ ...prev, responsable: currentUser.name }));
    }
  }, [mode, isSeller, currentUser]);

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data } = await supabase.from('catalogo_productos').select('*').order('nombre');
      if (data) setCatalogItems(data);
    };
    fetchCatalog();
  }, []);

  const formasPago = ['Efectivo', 'Transferencia', 'Cheque', 'Crédito', 'Tarjeta'];

  const handleClientChange = (e) => {
    const clientId = e.target.value;
    const clientName = e.target.options[e.target.selectedIndex].text;
    const selectedClient = clients.find(c => c.id === clientId) || { razonSocial: clientName.split(' - ')[0], id: clientId };
    
    setFormData(prev => ({ ...prev, cliente: clientId, clienteData: selectedClient }));
    setSearchTerm(clientName.split(' - ')[0]);
    if (errors.cliente) setErrors(prev => ({ ...prev, cliente: null }));
  };

  const handleNewClientCreated = (newClient) => {
    const clientData = Array.isArray(newClient) ? newClient[0] : newClient;
    if(clientData) {
        setFormData(prev => ({ ...prev, cliente: clientData.id, clienteData: clientData }));
        setSearchTerm(clientData.nombre || clientData.razonSocial);
        setShowNewClientModal(false);
        if(onReloadClients) onReloadClients();
    }
  };

  const getPriceForQty = (qty, item, applyMayorista = false) => {
      const tiersKey = applyMayorista ? 'precios_distribuidor' : 'precios_escalonados';
      const baseKey = applyMayorista ? 'precioDistribuidorBase' : 'precioBaseOriginal';
      const fallbackBaseKey = applyMayorista ? 'precio_distribuidor' : 'precio';

      const tiers = [...(item[tiersKey] || [])].sort((a,b) => b.cantidad - a.cantidad);
      const tier = tiers.find(t => qty >= t.cantidad);
      if (tier) return tier.precio;
      
      return Number(item[baseKey] || item[fallbackBaseKey] || 0);
  };

  const toggleMayorista = (checked) => {
      setFormData(prev => {
          const newItems = prev.items.map(p => {
              if (!p.producto) return p;
              if (p.es_por_metro) return p; 
              const qty = parseInt(p.cantidad, 10) || 0;
              const newPrice = getPriceForQty(qty, p, checked);
              return { ...p, precioUnitario: newPrice };
          });
          return { ...prev, esMayorista: checked, items: newItems };
      });
  };

  const handleCatalogSelect = (item) => {
    const minQty = item.venta_minima !== undefined && item.venta_minima !== null ? parseInt(item.venta_minima, 10) : 1;
    const computedPrice = item.es_por_metro ? '' : getPriceForQty(minQty, item, formData.esMayorista);

    let finalDesc = item.nombre;
    if (item.descripcion) finalDesc += ` - ${item.descripcion}`;

    setFormData(prev => {
        const newItems = [...prev.items];
        const emptyIndex = newItems.findIndex(p => !p.producto || p.producto.trim() === '');

        const newItem = {
            cantidad: minQty,
            venta_minima: minQty,
            producto: finalDesc,
            precioUnitario: computedPrice,
            precioBaseOriginal: Number(item.precio) || 0,
            precios_escalonados: item.precios_escalonados || [],
            precioDistribuidorBase: Number(item.precio_distribuidor) || 0,
            precios_distribuidor: item.precios_distribuidor || [],
            es_por_metro: item.es_por_metro || false,
        };

        if (emptyIndex !== -1) {
            newItems[emptyIndex] = newItem;
            if (emptyIndex === newItems.length - 1) newItems.push({ producto: '', cantidad: 0, precioUnitario: 0, es_por_metro: false });
        } else {
            newItems.push(newItem);
            newItems.push({ producto: '', cantidad: 0, precioUnitario: 0, es_por_metro: false });
        }
        return { ...prev, items: newItems };
    });
    
    setIsCatalogOpen(false);
    toast({ title: "Producto Añadido", description: `${item.nombre} agregado a la proforma.` });
  };

  const handleProductSearchRequest = async (index, value) => {
      handleItemChange(index, 'producto', value);
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
      const computedPrice = product.es_por_metro ? '' : getPriceForQty(minQty, product, formData.esMayorista);

      let finalDesc = product.nombre;
      if (product.descripcion) finalDesc += ` - ${product.descripcion}`;

      setFormData(prev => {
          const newItems = [...prev.items];
          newItems[index] = { 
              ...newItems[index], 
              producto: finalDesc,
              precioUnitario: computedPrice,
              precioBaseOriginal: Number(product.precio) || 0,
              precios_escalonados: product.precios_escalonados || [],
              precioDistribuidorBase: Number(product.precio_distribuidor) || 0,
              precios_distribuidor: product.precios_distribuidor || [],
              venta_minima: minQty,
              cantidad: minQty,
              es_por_metro: product.es_por_metro || false,
          };
          if (index === newItems.length - 1) newItems.push({ producto: '', cantidad: 0, precioUnitario: 0, es_por_metro: false });
          return { ...prev, items: newItems };
      });
      setProductSuggestions([]);
      setActiveProductSearchRow(null);
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
        const newItems = [...prev.items];
        let item = { ...newItems[index], [field]: value };

        if (field === 'cantidad') {
            let qty = parseInt(value, 10);
            if (isNaN(qty)) qty = 0;
            item.cantidad = qty;
            if (!item.es_por_metro && item.precioBaseOriginal !== undefined) {
                item.precioUnitario = getPriceForQty(qty, item, prev.esMayorista);
            }
        }

        if (index === newItems.length - 1 && value !== '' && field === 'producto') {
           newItems.push({ producto: '', cantidad: 0, precioUnitario: 0, es_por_metro: false });
        }

        newItems[index] = item;
        return { ...prev, items: newItems };
    });
  };

  const handleQuantityBlur = (index, value) => {
      const item = formData.items[index];
      if (!item.producto) return;
      
      const min = item.venta_minima !== undefined && item.venta_minima !== null ? parseInt(item.venta_minima, 10) : 1;
      let qty = parseInt(value, 10);
      if (isNaN(qty)) qty = 0;
      
      if (qty > 0 && min > 0 && qty < min) {
          toast({ title: "Venta Mínima", description: `Este producto exige mínimo ${min} unidades.`, variant: "destructive" });
          handleItemChange(index, 'cantidad', min);
      } else {
          handleItemChange(index, 'cantidad', qty);
      }
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const subtotal = formData.items.reduce((sum, item) => {
    if (!item.producto) return sum;
    const qty = parseInt(item.cantidad, 10) || 0;
    const multiplier = (item.es_por_metro && qty === 0) ? 1 : qty;
    return sum + (multiplier * Number(item.precioUnitario));
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
      toast({ title: "Formulario incompleto", description: "Complete todos los campos requeridos", variant: "destructive" });
      return;
    }

    const validItems = formData.items.filter(item => item.producto.trim() !== '');

    setIsSavingDraft(true);
    try {
      // 🔥 REMOVEMOS esMayorista del payload porque no existe en la tabla de proformas 🔥
      const { esMayorista, ...restFormData } = formData;
      
      const proformaData = {
        ...restFormData,
        items: validItems,
        proformaNumber: initialData?.proformaNumber || nextProformaNumber,
        status, 
        financials: { subtotal, descuento, impuesto, total },
        anticipoMonto,
        saldoMonto,
        tiempoEntrega: formData.deliveryTime
      };

      await onSubmit(proformaData);
      toast({ title: "✅ Guardado exitoso", description: `Proforma #${String(proformaData.proformaNumber).padStart(7, '0')} guardada` });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar la proforma", variant: "destructive" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const getDisplayedNumber = () => String(initialData?.proformaNumber || nextProformaNumber).padStart(7, '0');

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white shadow-xl rounded-lg flex flex-col h-full border border-slate-300 relative">
      <div className="bg-slate-100 border-b border-slate-300 px-6 py-3 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 uppercase">
          {mode === 'create' ? `Nueva Proforma (${getDisplayedNumber()})` : `Editar Proforma #${getDisplayedNumber()}`}
        </h2>
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0"><X className="h-5 w-5 text-slate-500" /></Button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 bg-white">
        <div className="space-y-6">
          
          <div className="space-y-3 pb-6 border-b border-slate-200">
             <h3 className="font-bold text-slate-700 text-sm border-b border-blue-500 pb-1 mb-3 inline-block">Información General</h3>
             
             <div className="grid grid-cols-12 gap-4 items-center">
                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Responsable:</label>
                <div className="col-span-12 md:col-span-4">
                   {isAdmin ? (
                      <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white" value={formData.responsable} onChange={(e) => setFormData({...formData, responsable: e.target.value})}>
                         <option value="">Seleccionar...</option>
                         {validSellers.map(u => (<option key={u.id} value={u.name}>{formatResponsableName(u)}</option>))}
                      </select>
                   ) : (<input type="text" className="w-full border border-slate-300 rounded px-2 py-1 text-sm bg-slate-100" value={formData.responsable} readOnly />)}
                </div>

                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700 md:text-right px-4">Cliente:</label>
                <div className="col-span-12 md:col-span-4 flex gap-2">
                   <select value={formData.cliente} onChange={handleClientChange} className={cn("w-full border rounded px-2 py-1 text-sm bg-white focus:outline-none", errors.cliente ? "border-red-500" : "border-slate-300")}>
                    <option value="">Seleccionar...</option>
                    {clients.map(client => (<option key={client.id} value={client.id}>{client.razonSocial} - {client.ruc || client.cedulaRuc}</option>))}
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowNewClientModal(true)} className="h-8 px-2 border-blue-400 text-blue-600 hover:bg-blue-50 shrink-0">+</Button>
                </div>

                <label className="col-span-12 md:col-span-2 text-xs font-bold text-slate-700">Tiempo Entrega:</label>
                <div className="col-span-12 md:col-span-10">
                   <input type="text" className={cn("w-full md:w-1/3 border rounded px-2 py-1 text-sm focus:outline-none", errors.deliveryTime ? "border-red-500" : "border-slate-300")} value={formData.deliveryTime} onChange={e => setFormData({...formData, deliveryTime: e.target.value})} placeholder="Ej: 5 días laborales" />
                </div>
             </div>
          </div>

          <div className="space-y-2">
             <div className="flex justify-between items-center mb-1">
                 <h3 className="text-xs text-slate-500 italic">Detalle de Productos / Servicios</h3>
                 <div className="flex gap-2 items-center">
                     <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-200 shadow-sm transition-colors hover:bg-indigo-100">
                         <Checkbox checked={formData.esMayorista || false} onCheckedChange={toggleMayorista} />
                         Tarifa Mayorista
                     </label>
                     <Button type="button" onClick={() => setIsCatalogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-7 text-xs px-3">
                         <ShoppingCart className="h-3 w-3" /> Catálogo
                     </Button>
                     <Button size="sm" type="button" onClick={() => {
                         setFormData(prev => ({...prev, items: [...prev.items, { producto: '', cantidad: 0, precioUnitario: 0, es_por_metro: false }]}));
                     }} variant="outline" className="border-green-500 text-green-700 hover:bg-green-50 h-7 text-xs px-3">
                         <Plus className="h-3 w-3 mr-1" /> Manual
                     </Button>
                 </div>
             </div>

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
                        const rowQty = parseInt(row.cantidad, 10) || 0;
                        const rowPrice = parseFloat(row.precioUnitario) || 0;
                        const multiplier = (row.es_por_metro && rowQty === 0) ? 1 : rowQty;
                        const rowTotal = multiplier * rowPrice;

                        return (
                          <tr key={idx} className="hover:bg-slate-50 group">
                             <td className="py-1 px-2 relative">
                                <textarea 
                                    className="w-full border-none bg-transparent focus:ring-0 text-sm p-0 placeholder-slate-300 resize-y min-h-[40px]" 
                                    placeholder={idx === formData.items.length - 1 ? "Buscar catálogo o añadir manual..." : ""} 
                                    value={row.producto} 
                                    onChange={(e) => handleProductSearchRequest(idx, e.target.value)}
                                    onFocus={() => { if((row.producto)?.length >= 2) handleProductSearchRequest(idx, row.producto); }}
                                    onBlur={() => setTimeout(() => setActiveProductSearchRow(null), 350)}
                                />
                                {activeProductSearchRow === idx && productSuggestions.length > 0 && (
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
                             <td className="py-1 px-2 relative">
                                <input 
                                  type="number" 
                                  step="1"
                                  className="w-full text-center border-none bg-transparent focus:ring-0 text-sm p-0"
                                  value={row.cantidad !== undefined ? row.cantidad : ''}
                                  onChange={e => handleItemChange(idx, 'cantidad', e.target.value)}
                                  onKeyDown={e => { if (e.key === '.' || e.key === ',') e.preventDefault(); }}
                                  onBlur={e => handleQuantityBlur(idx, e.target.value)}
                                />
                             </td>
                             <td className="py-1 px-2">
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full text-right border-none bg-transparent focus:ring-0 text-sm p-0"
                                  value={row.precioUnitario !== undefined ? row.precioUnitario : ''}
                                  onChange={e => handleItemChange(idx, 'precioUnitario', e.target.value)}
                                />
                             </td>
                             <td className="py-1 px-2 text-right font-medium text-slate-700 relative">
                                $ {rowTotal.toFixed(2)}
                                {(row.es_por_metro && row.cantidad === 0) && <div className="text-[9px] text-purple-600 font-bold leading-none mt-1" title="Precio base por cantidad 0">(Precio Base)</div>}
                             </td>
                             <td className="py-1 px-1 text-center">
                                {row.producto && formData.items.length > 1 && (
                                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"><Trash2 className="h-3 w-3" /></button>
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
                               <select className="text-xs px-1 py-0.5 border-r border-slate-200 outline-none" value={formData.descuentoTipo} onChange={e => setFormData({...formData, descuentoTipo: e.target.value})}>
                                  <option value="porcentaje">%</option>
                                  <option value="fijo">$</option>
                               </select>
                               <input type="number" step="0.01" className="w-16 text-right px-1 py-0.5 outline-none text-xs" value={formData.descuentoValor} onChange={e => setFormData({...formData, descuentoValor: parseFloat(e.target.value) || 0})} />
                            </div>
                         </td>
                         <td className="text-right py-1 px-2 text-red-500">- $ {descuento.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="3" className="text-right py-1 px-2 flex items-center justify-end gap-2">
                             <span>IVA (%)</span>
                             <input type="number" step="0.01" className="w-12 text-right border border-slate-300 rounded px-1 text-xs" value={formData.impuestoTasa} onChange={e => setFormData({...formData, impuestoTasa: parseFloat(e.target.value) || 0})} />
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

          <div className="space-y-4 pt-2">
             <div className="text-xs text-slate-500 italic border-b border-slate-200 pb-1">Condiciones Comerciales</div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <label className="text-xs font-bold text-slate-700">Anticipo (%):</label>
                       <div className="flex items-center gap-2">
                          <input type="number" className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-right" value={formData.advancePercentage} onChange={e => { const val = parseFloat(e.target.value) || 0; setFormData({...formData, advancePercentage: val, balancePercentage: 100 - val}); }} />
                          <span className="text-sm font-bold w-24 text-right">$ {anticipoMonto.toFixed(2)}</span>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <label className="text-xs font-bold text-slate-700">Saldo contra entrega (%):</label>
                       <div className="flex items-center gap-2">
                          <input type="number" className="w-16 border border-slate-300 rounded px-2 py-1 text-sm text-right" value={formData.balancePercentage} onChange={e => { const val = parseFloat(e.target.value) || 0; setFormData({...formData, balancePercentage: val, advancePercentage: 100 - val}); }} />
                          <span className="text-sm font-bold w-24 text-right">$ {saldoMonto.toFixed(2)}</span>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <div className="flex items-center gap-2">
                       <label className="text-xs font-bold text-slate-700 w-24">Forma Pago:</label>
                       <select className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white" value={formData.formaPago} onChange={e => { const val = e.target.value; setFormData({...formData, formaPago: val, creditoVence: val === 'Crédito' ? formData.creditoVence : ''}); }}>
                          {formasPago.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                       </select>
                    </div>
                    
                    {formData.formaPago === 'Crédito' && (
                       <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-slate-700 w-24">Vencimiento:</label>
                          <input type="date" className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm" value={formData.creditoVence} onChange={e => setFormData({...formData, creditoVence: e.target.value})} />
                       </div>
                    )}
                 </div>
             </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
             <label className="text-xs font-bold text-slate-700 block mb-1">Notas Internas:</label>
             <textarea className="w-full border border-slate-300 rounded p-2 text-sm h-20 resize-none focus:outline-none" value={formData.notasInternas} onChange={e => setFormData({...formData, notasInternas: e.target.value})} placeholder="Observaciones para uso interno..." />
          </div>

        </div>
      </div>

      <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
         <Button type="button" variant="outline" onClick={onCancel} className="bg-white">Cancelar</Button>
         <Button type="button" onClick={() => handleSubmit('BORRADOR')} className="bg-[#004080] hover:bg-blue-900 text-white px-8 gap-2" disabled={isSavingDraft}>
            {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Proforma
         </Button>
      </div>

      {/* 🔥 CATÁLOGO LATERAL 🔥 */}
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
                {catalogItems.length === 0 && <div className="text-center py-10 text-slate-400">Catálogo vacío.</div>}
            </div>
        </div>
      )}
      
      {showNewClientModal && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in fade-in duration-200 p-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-lg">Nuevo Cliente</h3><Button size="sm" variant="ghost" onClick={()=>setShowNewClientModal(false)}><X/></Button></div>
            <div className="flex-1 overflow-y-auto"><ClientForm user={currentUser} onCancel={()=>setShowNewClientModal(false)} onSuccess={handleNewClientCreated} clienteAEditar={newClientInitialData} /></div>
        </div>
      )}
    </motion.div>
  );
};

export default ProformaForm;