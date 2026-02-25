import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Save, X, Plus, Trash2, User, Search, Calculator, FileText, Loader2, UserPlus, Mail, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';

const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Cheque', 'Depósito', 'Tarjeta', 'Crédito', 'No aplica'];

const ProformaForm = ({ 
  onSuccess, 
  onCancel, 
  clients = [], 
  user, 
  initialData = null,
  nextProformaNumber,
  onCreateClient 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // --- ESTADOS ---
  const [titulo, setTitulo] = useState(''); 
  
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClient, setSelectedClient] = useState({
    nombre: '',
    identificacion: '',
    telefono: '',
    direccion: '',
    email: '' 
  });

  const [products, setProducts] = useState([
    { cantidad: 1, descripcion: '', precioUnitario: 0, total: 0 }
  ]);
  
  // --- LÓGICA AUTOCOMPLETADO DE PRODUCTOS ---
  const [activeProductSearchRow, setActiveProductSearchRow] = useState(null);
  const [productSuggestions, setProductSuggestions] = useState([]);

  // --- NUEVOS ESTADOS FINANCIEROS (Dscto, Anticipo, Saldo, Forma Pago) ---
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0);
  const [localDiscountVal, setLocalDiscountVal] = useState('');
  const [localDiscountPercent, setLocalDiscountPercent] = useState('');
  
  const [anticipo, setAnticipo] = useState(0);
  const [localAnticipo, setLocalAnticipo] = useState('');
  const [formaPago, setFormaPago] = useState('Transferencia');

  const [financials, setFinancials] = useState({ subtotalBruto: 0, descuentoVal: 0, subtotal: 0, iva: 0, total: 0, saldo: 0 });
  const [notes, setNotes] = useState('');
  const [ivaPercentage, setIvaPercentage] = useState(15); 
  const [applyIva, setApplyIva] = useState(true);

  // --- HELPER PARA ENCONTRAR EL ID (RUC/CEDULA) ---
  const findClientId = (c) => {
      if (!c) return '';
      return c.ruc || c.cedula || c.identificacion || c.dni || c.empresa || ''; 
  };

  // --- 1. CARGAR CONFIGURACIÓN GLOBAL DE IVA ---
  useEffect(() => {
    const fetchGlobalConfig = async () => {
      try {
        if (initialData) {
            setIvaPercentage(initialData.ivaPercentage || initialData.iva_percentage || initialData.financials?.ivaPercentage || 15);
            setApplyIva((initialData.iva_total || initialData.iva || initialData.financials?.iva) > 0);
            return;
        }
        const { data } = await supabase.from('configuracion_global').select('iva_porcentaje').single();
        if (data) setIvaPercentage(data.iva_porcentaje);
      } catch (error) { console.error(error); }
    };
    fetchGlobalConfig();
  }, [initialData]);

  // --- 2. CARGAR DATOS (EDICIÓN) ---
  useEffect(() => {
    if (initialData) {
      setTitulo(initialData.titulo || initialData.tipo_trabajo || ''); 
      setClientSearch(initialData.cliente_nombre || '');
      setSelectedClient({
        nombre: initialData.cliente_nombre || '',
        identificacion: initialData.cliente_identificacion || '',
        telefono: initialData.cliente_telefono || '',
        direccion: initialData.cliente_direccion || '',
        email: initialData.cliente_email || ''
      });
      const items = Array.isArray(initialData.items) ? initialData.items : [];
      setProducts(items.length > 0 ? items : [{ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0 }]);
      setNotes(initialData.notas || '');

      // Cargar Descuentos, Anticipos y Forma de Pago si existen
      const savedPercent = initialData.financials?.descuentoPorcentaje || 0;
      setDescuentoPorcentaje(savedPercent);
      setLocalDiscountPercent(savedPercent > 0 ? savedPercent.toString() : '');
      
      const savedAnticipo = initialData.financials?.anticipo || 0;
      setAnticipo(savedAnticipo);
      setLocalAnticipo(savedAnticipo > 0 ? savedAnticipo.toString() : '');

      setFormaPago(initialData.financials?.formaPago || 'Transferencia');
    }
  }, [initialData]);

  // --- 3. CÁLCULOS ROBUSTOS ---
  useEffect(() => {
    const subtotalBruto = products.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
    const descuentoVal = subtotalBruto * (descuentoPorcentaje / 100);
    const subtotal = subtotalBruto - descuentoVal;
    
    const iva = applyIva ? subtotal * (ivaPercentage / 100) : 0;
    const total = subtotal + iva;
    const saldo = total - anticipo;

    setFinancials({ subtotalBruto, descuentoVal, subtotal, iva, total, saldo });

    // Sincronizar inputs locales si no están siendo editados en este instante
    if (document.activeElement?.name !== 'discountValInput') {
        setLocalDiscountVal(descuentoVal > 0 ? descuentoVal.toFixed(2) : '');
    }
    if (document.activeElement?.name !== 'discountPercentInput') {
        setLocalDiscountPercent(descuentoPorcentaje > 0 ? Math.round(descuentoPorcentaje).toString() : '');
    }
  }, [products, ivaPercentage, applyIva, descuentoPorcentaje, anticipo]);


  // PORCENTAJES DINÁMICOS PARA LA UI (Como en OrderForm)
  const porcentajeAnticipoUI = financials.total > 0 ? ((anticipo / financials.total) * 100).toFixed(1) : '0.0';
  const porcentajeSaldoUI = financials.total > 0 ? ((Math.max(0, financials.saldo) / financials.total) * 100).toFixed(1) : '0.0';


  // --- HANDLERS FINANCIEROS (Dscto y Anticipo) ---
  const commitDiscountValue = () => {
      const val = parseFloat(localDiscountVal) || 0;
      const percent = financials.subtotalBruto > 0 ? (val / financials.subtotalBruto) * 100 : 0;
      setDescuentoPorcentaje(percent);
  };

  const commitDiscountPercent = () => {
      const intPercent = parseInt(localDiscountPercent) || 0;
      setDescuentoPorcentaje(intPercent);
      setLocalDiscountPercent(intPercent > 0 ? intPercent.toString() : '');
  };

  const handleKeyDown = (e, commitFunction) => { if (e.key === 'Enter') { e.preventDefault(); commitFunction(); e.target.blur(); } };

  const handleAnticipoChange = (e) => {
      const val = e.target.value;
      setLocalAnticipo(val);
      setAnticipo(parseFloat(val) || 0);
  };

  const handleAnticipoBlur = () => {
      let valNum = parseFloat(localAnticipo) || 0;
      if (valNum > financials.total) {
          valNum = financials.total;
          toast({ title: "Monto ajustado", description: "El anticipo sugerido no puede ser mayor al total.", variant: "warning" });
      }
      setLocalAnticipo(valNum > 0 ? valNum.toFixed(2) : '');
      setAnticipo(valNum);
  };

  const handleSetAnticipoPercent = (percent) => {
      const val = financials.total * (percent / 100);
      setAnticipo(val);
      setLocalAnticipo(val.toFixed(2));
  };


  // --- HANDLERS CLIENTE ---
  const filteredClients = clients.filter(c => {
    const term = clientSearch.toLowerCase().trim();
    if (!term) return false;
    
    const name = (c.nombre || c.razonSocial || c.full_name || '').toLowerCase();
    const id = String(findClientId(c));

    return name.includes(term) || id.includes(term);
  });

  const handleClientSelect = (client) => {
    const idFound = findClientId(client);
    setSelectedClient({
      nombre: client.nombre || client.razonSocial || client.full_name,
      identificacion: idFound,
      telefono: client.telefono || client.celular || '',
      direccion: client.direccion || '',
      email: client.email || client.correo || ''
    });
    setClientSearch(client.nombre || client.razonSocial || client.full_name);
    setShowClientSuggestions(false);
  };

  const handleNewClient = () => {
    if (onCreateClient) onCreateClient(); 
    else {
        setSelectedClient({ nombre: '', identificacion: '', telefono: '', direccion: '', email: '' });
        setClientSearch('');
    }
  };

  // --- HANDLERS PRODUCTOS ---
  const addProduct = () => setProducts(prev => [...prev, { cantidad: 1, descripcion: '', precioUnitario: 0, total: 0 }]);
  const removeProduct = (idx) => setProducts(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  
  const updateProduct = (index, field, value) => {
    setProducts(prev => {
        const newProducts = [...prev];
        const item = { ...newProducts[index], [field]: value };
        if (field === 'cantidad' || field === 'precioUnitario') {
          const qty = field === 'cantidad' ? Number(value) : Number(item.cantidad);
          const price = field === 'precioUnitario' ? Number(value) : Number(item.precioUnitario);
          item.total = qty * price;
        }
        newProducts[index] = item;
        return newProducts;
    });
  };

  const handleProductSearchRequest = async (index, value) => {
      updateProduct(index, 'descripcion', value);
      
      if (value.trim().length < 2) {
          setProductSuggestions([]);
          setActiveProductSearchRow(null);
          return;
      }
      
      setActiveProductSearchRow(index);
      const { data } = await supabase
          .from('catalogo_productos')
          .select('*')
          .ilike('nombre', `%${value}%`)
          .limit(8);
          
      setProductSuggestions(data || []);
  };

  const handleSelectProductSuggestion = (index, product) => {
      const desc = product.nombre + (product.descripcion ? ` - ${product.descripcion}` : '');
      
      setProducts(prev => {
          const newProducts = [...prev];
          const currentItem = newProducts[index];
          const qty = Number(currentItem.cantidad) || 1;
          
          newProducts[index] = { 
              ...currentItem, 
              descripcion: desc, 
              precioUnitario: product.precio,
              total: qty * Number(product.precio)
          };
          return newProducts;
      });

      setProductSuggestions([]);
      setActiveProductSearchRow(null);
  };
  
  // --- GUARDAR ---
  const handleSubmit = async () => {
    const finalName = selectedClient.nombre || clientSearch;
    if (!finalName) {
      toast({ title: "Falta Cliente", description: "Ingrese el nombre del cliente.", variant: "destructive" });
      return;
    }
    
    if (!titulo.trim()) {
      toast({ title: "Falta Título", description: "Por favor, agregue un título o referencia a la cotización.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        titulo: titulo, 
        cliente_nombre: finalName,
        cliente_identificacion: selectedClient.identificacion,
        cliente_telefono: selectedClient.telefono,
        cliente_direccion: selectedClient.direccion,
        cliente_email: selectedClient.email,
        items: products, 
        subtotal: financials.subtotal, 
        iva: financials.iva,
        total: financials.total,
        iva_percentage: applyIva ? ivaPercentage : 0,
        financials: { 
            subtotalBruto: financials.subtotalBruto,
            descuentoVal: financials.descuentoVal,
            descuentoPorcentaje: descuentoPorcentaje,
            subtotal: financials.subtotal, 
            iva: financials.iva, 
            total: financials.total, 
            ivaPercentage: applyIva ? ivaPercentage : 0,
            anticipo: anticipo,
            saldo: financials.saldo,
            formaPago: formaPago
        },
        notas: notes,
        responsable_nombre: user.name, 
        status: initialData ? initialData.status : 'BORRADOR',
        updated_at: new Date().toISOString()
      };

      if (!initialData) {
          payload.numero = nextProformaNumber;
          payload.proformaNumber = nextProformaNumber;
          payload.created_at = new Date().toISOString();
          payload.creado_por = user.id;
      }

      let error;
      if (initialData) {
        const { error: updateError } = await supabase.from('proformas').update(payload).eq('id', initialData.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('proformas').insert([payload]);
        error = insertError;
      }

      if (error) throw error;
      toast({ title: "✅ Guardado", description: "Proforma registrada con éxito." });
      onSuccess();
    } catch (error) {
      console.error("Error DB:", error);
      toast({ title: "Error", description: error.message || "No se pudo guardar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="h-6 w-6 text-blue-600" />{initialData ? 'Editar Proforma' : 'Nueva Cotización'}</h2><p className="text-sm text-slate-500">{initialData ? `Editando #${String(initialData.numero || initialData.proformaNumber).padStart(6,'0')}` : `Consecutivo #${String(nextProformaNumber || '...').padStart(6,'0')}`}</p></div>
        <Button variant="ghost" onClick={onCancel} className="hover:bg-slate-100 rounded-full h-10 w-10 p-0"><X className="h-6 w-6 text-slate-500" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* TARJETA DATOS CLIENTE */}
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-2"><div className="flex items-center gap-2 text-blue-700 font-semibold"><User className="h-5 w-5" /> Datos Generales</div></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Título / Referencia del Trabajo <span className="text-red-500">*</span></label>
                    <Input placeholder="Ej: Letrero luminoso para local principal" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="font-semibold text-blue-800" />
                </div>

                <div className="relative md:col-span-2 flex gap-2 items-end">
                  <div className="relative flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Buscar Cliente</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input placeholder="Buscar por Nombre o RUC..." className="pl-9" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(prev => ({...prev, nombre: e.target.value})); setShowClientSuggestions(true); }} onFocus={() => setShowClientSuggestions(true)} onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)} />
                    </div>
                    {showClientSuggestions && clientSearch.length > 1 && filteredClients.length > 0 && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-md shadow-xl mt-1 max-h-60 overflow-y-auto">
                        {filteredClients.map(client => {
                           const displayId = findClientId(client) || 'S/N';
                           return (
                            <div key={client.id} className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm border-b border-slate-100 last:border-0" onMouseDown={() => handleClientSelect(client)}>
                              <div className="font-bold text-slate-800">{client.nombre || client.razonSocial || client.full_name}</div>
                              <div className="text-xs text-slate-500">ID: {displayId}</div>
                            </div>
                           );
                        })}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleNewClient} className="bg-green-600 hover:bg-green-700 text-white min-w-[140px] mb-[1px]" type="button"><UserPlus className="h-4 w-4 mr-2" /> Nuevo Cliente</Button>
                </div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">RUC / ID</label><Input value={selectedClient.identificacion} onChange={(e) => setSelectedClient({...selectedClient, identificacion: e.target.value})} placeholder="099..." /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Teléfono</label><Input value={selectedClient.telefono} onChange={(e) => setSelectedClient({...selectedClient, telefono: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Email</label><Input value={selectedClient.email} onChange={(e) => setSelectedClient({...selectedClient, email: e.target.value})} placeholder="correo@ejemplo.com" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dirección</label><Input value={selectedClient.direccion} onChange={(e) => setSelectedClient({...selectedClient, direccion: e.target.value})} /></div>
              </div>
            </CardContent>
          </Card>

          {/* TARJETA DE PRODUCTOS */}
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <div className="flex items-center gap-2 text-blue-700 font-semibold"><Calculator className="h-5 w-5" /> Items Cotizados</div>
                <Button size="sm" type="button" onClick={addProduct} variant="outline" className="border-green-500 text-green-700 hover:bg-green-50"><Plus className="h-4 w-4 mr-1" /> Agregar Item</Button>
              </div>
              
              <div className="border border-slate-300 rounded-sm overflow-visible">
                <table className="w-full text-sm">
                   <thead className="bg-[#004080] text-white text-xs">
                      <tr>
                         <th className="py-2 px-3 text-left">Descripción del Item</th>
                         <th className="py-2 px-3 text-center w-24">Cantidad</th>
                         <th className="py-2 px-3 text-right w-32">P. Unitario</th>
                         <th className="py-2 px-3 text-right w-32">Total</th>
                         <th className="w-10"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-200 bg-white">
                      {products.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 group">
                           <td className="py-1 px-3 relative">
                              <Input 
                                  className="h-9 w-full border-transparent focus:border-blue-300 focus:ring-0 shadow-none px-1" 
                                  placeholder="Escribe para buscar catálogo o añade manual..." 
                                  value={row.descripcion} 
                                  onChange={(e) => handleProductSearchRequest(idx, e.target.value)}
                                  onFocus={() => { if(row.descripcion.length >= 2) handleProductSearchRequest(idx, row.descripcion); }}
                                  onBlur={() => setTimeout(() => setActiveProductSearchRow(null), 350)}
                              />
                              {activeProductSearchRow === idx && productSuggestions.length > 0 && (
                                  <div className="absolute z-50 w-full min-w-[300px] mt-1 bg-white border border-slate-300 rounded shadow-2xl max-h-60 overflow-y-auto left-0">
                                      {productSuggestions.map(prod => (
                                          <div 
                                              key={prod.id} 
                                              className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-sm border-b border-slate-100" 
                                              onClick={() => handleSelectProductSuggestion(idx, prod)}
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
                           <td className="py-1 px-3"><Input type="number" className="text-center h-8 border-slate-200" min="1" value={row.cantidad} onChange={(e) => updateProduct(idx, 'cantidad', e.target.value)} /></td>
                           <td className="py-1 px-3"><Input type="number" className="text-right h-8 border-slate-200" min="0" step="0.01" value={row.precioUnitario} onChange={(e) => updateProduct(idx, 'precioUnitario', e.target.value)} /></td>
                           <td className="py-1 px-3 text-right font-medium text-slate-700 bg-slate-50/50">$ {Number(row.total).toFixed(2)}</td>
                           <td className="py-1 px-2 text-center"><button type="button" onClick={() => removeProduct(idx)} className="text-red-400 opacity-50 group-hover:opacity-100 hover:text-red-600 transition-opacity" disabled={products.length === 1}><Trash2 className="h-4 w-4 mx-auto" /></button></td>
                        </tr>
                      ))}
                   </tbody>

                   {/* --- SECCIÓN FINANCIERA INTEGRADA A LA TABLA --- */}
                   <tfoot className="bg-slate-100 font-medium text-slate-700 border-t border-slate-300 text-xs">
                      <tr>
                          <td colSpan="3" className="text-right py-2 px-3">SubTotal</td>
                          <td className="text-right py-2 px-3 font-bold">$ {financials.subtotalBruto.toFixed(2)}</td>
                          <td></td>
                      </tr>
                      <tr>
                         <td colSpan="3" className="text-right py-1 px-3 flex items-center justify-end gap-2">
                            <span className="text-slate-500">Dscto ($)</span>
                            <input name="discountValInput" type="number" step="0.01" className="w-16 text-right border border-slate-300 rounded px-1 text-xs bg-white py-1" placeholder="0.00" value={localDiscountVal} onChange={e => setLocalDiscountVal(e.target.value)} onBlur={commitDiscountValue} onKeyDown={(e) => handleKeyDown(e, commitDiscountValue)} />
                            <span className="text-slate-500">(%)</span>
                            <input name="discountPercentInput" type="number" step="1" className="w-12 text-right border border-slate-300 rounded px-1 text-xs bg-white py-1" placeholder="0" value={localDiscountPercent} onChange={e => setLocalDiscountPercent(e.target.value)} onBlur={commitDiscountPercent} onKeyDown={(e) => handleKeyDown(e, commitDiscountPercent)} />
                         </td>
                         <td className="text-right py-1 px-3 text-red-500 font-bold whitespace-nowrap">- $ {financials.descuentoVal.toFixed(2)}</td>
                         <td></td>
                      </tr>
                      <tr>
                         <td colSpan="3" className="text-right py-2 px-3 flex items-center justify-end gap-2 whitespace-nowrap">
                            <Switch checked={applyIva} onCheckedChange={setApplyIva} className="scale-75 data-[state=checked]:bg-blue-600" />
                            <label className="cursor-pointer flex items-center gap-1">IVA ({ivaPercentage}%)</label>
                         </td>
                         <td className="text-right py-2 px-3">$ {financials.iva.toFixed(2)}</td>
                         <td></td>
                      </tr>
                   </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Condiciones / Notas para el cliente</label>
                <textarea className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-[220px] resize-none" placeholder="Tiempos de entrega, validez de la oferta..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            
            <div className="md:col-span-5">
                <Card className="bg-slate-50 border-slate-200 shadow-sm h-full">
                  <CardContent className="p-5 h-full flex flex-col justify-between">
                    
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-xl text-slate-800">TOTAL:</span>
                        <span className="font-bold text-3xl text-blue-700">${financials.total.toFixed(2)}</span>
                      </div>
                      
                      <div className="pt-4 border-t border-slate-300 space-y-4">
                         <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Condiciones de Pago (Sugerido)</h4>
                         
                         <div className="flex items-center justify-between text-sm">
                            <label className="text-xs font-bold text-slate-700">Forma de Pago:</label>
                            <select 
                               className="border border-slate-300 rounded px-2 py-1 text-sm bg-white w-40 focus:border-blue-500 outline-none" 
                               value={formaPago} 
                               onChange={e => setFormaPago(e.target.value)}
                            >
                               {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                         </div>

                         <div className="flex justify-between items-center text-sm">
                             <span className="text-slate-700 font-bold">Abono Inicial:</span>
                             <div className="flex items-center gap-2">
                                 <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2 py-0 border-blue-300 text-blue-700 hover:bg-blue-50 bg-white" onClick={() => handleSetAnticipoPercent(50)}>50%</Button>
                                 <div className="relative w-32 shadow-sm">
                                     <span className="absolute left-2 top-1.5 text-sm text-slate-500">$</span>
                                     <input
                                         type="number"
                                         step="0.01"
                                         className="w-full pl-6 pr-10 py-1.5 border border-slate-300 rounded text-right font-bold text-orange-600 focus:outline-none focus:border-orange-500 bg-white"
                                         value={localAnticipo}
                                         onChange={handleAnticipoChange}
                                         onBlur={handleAnticipoBlur}
                                         placeholder="0.00"
                                     />
                                     <span className="absolute right-1 top-2 text-[10px] text-slate-400 font-bold bg-slate-100 px-1 rounded">{porcentajeAnticipoUI}%</span>
                                 </div>
                             </div>
                         </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm bg-red-50 p-3 rounded-lg border border-red-100 shadow-inner mt-4">
                         <span className="text-red-700 font-bold uppercase text-xs">Saldo a Pagar:</span>
                         <div className="flex items-center gap-2">
                             <span className="text-[10px] text-red-400 font-bold bg-red-100 px-1 rounded">{porcentajeSaldoUI}%</span>
                             <span className="font-bold text-xl text-red-700">${Math.max(0, financials.saldo).toFixed(2)}</span>
                         </div>
                     </div>

                  </CardContent>
                </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3 sticky bottom-0 z-20">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px]">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} {initialData ? 'Actualizar Proforma' : 'Guardar Proforma'}</Button>
      </div>
    </div>
  );
};

export default ProformaForm;