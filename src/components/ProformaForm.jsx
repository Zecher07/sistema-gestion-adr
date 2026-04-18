import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Save, X, Plus, Trash2, User, Search, Calculator, FileText, Loader2, UserPlus, Mail, Clock, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';

const ProformaForm = ({ onSuccess, onCancel, clients = [], user, initialData = null, nextProformaNumber, onCreateClient }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [titulo, setTitulo] = useState(''); 
  const [diasEntrega, setDiasEntrega] = useState(''); 
  
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [selectedClient, setSelectedClient] = useState({ nombre: '', identificacion: '', telefono: '', direccion: '', email: '' });

  const [products, setProducts] = useState([
    { cantidad: 1, descripcion: '', precioUnitario: 0, total: 0, venta_minima: 1, precios_escalonados: [], precioBaseOriginal: 0, es_por_metro: false }
  ]);
  
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [searchCatalog, setSearchCatalog] = useState('');

  const [activeProductSearchRow, setActiveProductSearchRow] = useState(null);
  const [productSuggestions, setProductSuggestions] = useState([]);

  const [financials, setFinancials] = useState({ subtotal: 0, iva: 0, total: 0, descuento: 0, descuentoPorc: 0, anticipoPorc: 50, anticipoValor: 0, saldoPorc: 50, saldoValor: 0 });
  const [notes, setNotes] = useState('');
  const [ivaPercentage, setIvaPercentage] = useState(15); 
  const [applyIva, setApplyIva] = useState(true);
  const [esDistribuidor, setEsDistribuidor] = useState(false);

  const findClientId = (c) => { if (!c) return ''; return c.ruc || c.cedula || c.identificacion || c.dni || c.empresa || ''; };

  useEffect(() => { const fetchCatalog = async () => { const { data } = await supabase.from('catalogo_productos').select('*').order('nombre'); if (data) setCatalogItems(data); }; fetchCatalog(); }, []);

  useEffect(() => {
    const fetchGlobalConfig = async () => {
      try {
        if (initialData) { setIvaPercentage(initialData.ivaPercentage || initialData.iva_percentage || 15); setApplyIva((initialData.iva_total || initialData.iva) > 0); return; }
        const { data } = await supabase.from('configuracion_global').select('iva_porcentaje').single(); if (data) setIvaPercentage(data.iva_porcentaje);
      } catch (error) { console.error(error); }
    }; fetchGlobalConfig();
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      setTitulo(initialData.titulo || initialData.tipo_trabajo || ''); setClientSearch(initialData.cliente_nombre || '');
      setSelectedClient({ nombre: initialData.cliente_nombre || '', identificacion: initialData.cliente_identificacion || '', telefono: initialData.cliente_telefono || '', direccion: initialData.cliente_direccion || '', email: initialData.cliente_email || '' });
      const items = Array.isArray(initialData.items) ? initialData.items : [];
      setProducts(items.length > 0 ? items : [{ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0, venta_minima: 1, precios_escalonados: [], precioBaseOriginal: 0, es_por_metro: false }]);
      setNotes(initialData.notas || ''); setDiasEntrega(initialData.financials?.diasEntrega || initialData.dias_entrega || '');
      setEsDistribuidor(initialData.esDistribuidor || false);
      if (initialData.financials) { setFinancials(prev => ({ ...prev, descuento: initialData.financials.descuento || 0, descuentoPorc: initialData.financials.descuentoPorc || 0, anticipoPorc: initialData.financials.anticipoPorc || 50 })); }
    }
  }, [initialData]);

  useEffect(() => {
    const subtotalBruto = products.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
    let valorDescuento = financials.descuento;
    if (financials.descuentoPorc > 0) { valorDescuento = subtotalBruto * (financials.descuentoPorc / 100); }
    const subtotalNeto = Math.max(0, subtotalBruto - valorDescuento);
    const iva = applyIva ? subtotalNeto * (ivaPercentage / 100) : 0; const total = subtotalNeto + iva;
    const anticipoValor = total * ((financials.anticipoPorc || 0) / 100);
    const saldoPorc = 100 - (financials.anticipoPorc || 0); const saldoValor = total - anticipoValor;
    setFinancials(prev => ({ ...prev, subtotal: subtotalBruto, descuento: valorDescuento, iva, total, anticipoValor, saldoPorc, saldoValor }));
  }, [products, ivaPercentage, applyIva, financials.descuentoPorc, financials.descuento, financials.anticipoPorc]);

  const filteredClients = clients.filter(c => { const term = clientSearch.toLowerCase().trim(); if (!term) return false; const name = (c.nombre || c.razonSocial || c.full_name || '').toLowerCase(); const id = String(findClientId(c)); return name.includes(term) || id.includes(term); });
  const handleClientSelect = (client) => { const idFound = findClientId(client); setSelectedClient({ nombre: client.nombre || client.razonSocial || client.full_name, identificacion: idFound, telefono: client.telefono || client.celular || '', direccion: client.direccion || '', email: client.email || client.correo || '' }); setClientSearch(client.nombre || client.razonSocial || client.full_name); setShowClientSuggestions(false); };
  const handleNewClient = () => { if (onCreateClient) onCreateClient(); else { setSelectedClient({ nombre: '', identificacion: '', telefono: '', direccion: '', email: '' }); setClientSearch(''); } };

  const getPriceForQty = (qty, item, isDistributorMode) => {
      if (isDistributorMode && (item.precioDistribuidorBase > 0 || (item.precios_distribuidor && item.precios_distribuidor.length > 0))) {
          const tiers = [...(item.precios_distribuidor || [])].sort((a,b) => b.cantidad - a.cantidad);
          const tier = tiers.find(t => qty >= t.cantidad);
          if (tier) return tier.precio;
          return item.precioDistribuidorBase > 0 ? item.precioDistribuidorBase : (item.precioBaseOriginal || 0);
      } else {
          const tiers = [...(item.precios_escalonados || [])].sort((a,b) => b.cantidad - a.cantidad);
          const tier = tiers.find(t => qty >= t.cantidad);
          if (tier) return tier.precio;
          return item.precioBaseOriginal || 0;
      }
  };

  const handleDistribuidorToggle = (checked) => {
      setEsDistribuidor(checked);
      setProducts(prev => {
          return prev.map(p => {
              if (!p.descripcion || p.descripcion.trim() === '') return p;
              const currentQty = Number(p.cantidad) || 0;
              const newPrice = getPriceForQty(currentQty, p, checked);
              return { ...p, precioUnitario: newPrice, total: p.es_por_metro ? newPrice : currentQty * newPrice };
          });
      });
  };

  const handleCatalogSelect = (item) => {
    const minQty = item.venta_minima || 1;
    const computedPrice = getPriceForQty(minQty, {
        precioBaseOriginal: Number(item.precio) || 0,
        precios_escalonados: item.precios_escalonados || [],
        precioDistribuidorBase: Number(item.precio_distribuidor) || 0,
        precios_distribuidor: item.precios_distribuidor || []
    }, esDistribuidor);

    let finalDesc = item.nombre;
    if (item.descripcion) finalDesc += ` - ${item.descripcion}`;
    if (item.observaciones) finalDesc += `\n[Nota: ${item.observaciones}]`;

    setProducts(prev => {
        const newProducts = [...prev];
        const emptyIndex = newProducts.findIndex(p => !p.descripcion || p.descripcion.trim() === '');

        const newProduct = {
            cantidad: minQty, venta_minima: minQty, descripcion: finalDesc,
            precioUnitario: computedPrice, precioBaseOriginal: Number(item.precio) || 0,
            precios_escalonados: item.precios_escalonados || [],
            precioDistribuidorBase: Number(item.precio_distribuidor) || 0,
            precios_distribuidor: item.precios_distribuidor || [],
            es_por_metro: item.es_por_metro || false,
            total: (item.es_por_metro || false) ? computedPrice : computedPrice * minQty
        };

        if (emptyIndex !== -1) { newProducts[emptyIndex] = newProduct; if (emptyIndex === newProducts.length - 1) newProducts.push({ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0, venta_minima: 1, es_por_metro: false }); } 
        else { newProducts.push(newProduct); newProducts.push({ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0, venta_minima: 1, es_por_metro: false }); }
        return newProducts;
    });
    setIsCatalogOpen(false); toast({ title: "Añadido", description: `${item.nombre} agregado a la proforma.` });
  };

  // 🔥 BÚSQUEDA INTELIGENTE 🔥
  const handleProductSearchRequest = async (index, value) => {
      updateProduct(index, 'descripcion', value);
      if (value.trim().length < 2) { setProductSuggestions([]); setActiveProductSearchRow(null); return; }
      setActiveProductSearchRow(index);
      
      const terms = value.trim().split(/\s+/);
      let query = supabase.from('catalogo_productos').select('*');
      terms.forEach(term => { query = query.or(`nombre.ilike.%${term}%,categoria.ilike.%${term}%,codigo.ilike.%${term}%`); });
      const { data } = await query.limit(12);
      
      setProductSuggestions(data || []);
  };

  const handleSelectProductSuggestion = (index, product) => {
      const minQty = product.venta_minima || 1;
      const computedPrice = getPriceForQty(minQty, {
          precioBaseOriginal: Number(product.precio) || 0,
          precios_escalonados: product.precios_escalonados || [],
          precioDistribuidorBase: Number(product.precio_distribuidor) || 0,
          precios_distribuidor: product.precios_distribuidor || []
      }, esDistribuidor);

      let finalDesc = product.nombre;
      if (product.descripcion) finalDesc += ` - ${product.descripcion}`;
      if (product.observaciones) finalDesc += `\n[Nota: ${product.observaciones}]`;

      setProducts(prev => {
          const newProducts = [...prev];
          newProducts[index] = { 
              ...newProducts[index], descripcion: finalDesc, 
              precioUnitario: computedPrice, precioBaseOriginal: Number(product.precio) || 0,
              precios_escalonados: product.precios_escalonados || [],
              precioDistribuidorBase: Number(product.precio_distribuidor) || 0,
              precios_distribuidor: product.precios_distribuidor || [],
              venta_minima: minQty, cantidad: minQty, es_por_metro: product.es_por_metro || false,
              total: (product.es_por_metro || false) ? computedPrice : minQty * computedPrice 
          };
          if (index === newProducts.length - 1) newProducts.push({ cantidad: 1, descripcion: '', precioUnitario: 0, total: 0, venta_minima: 1, es_por_metro: false });
          return newProducts;
      });
      setProductSuggestions([]); setActiveProductSearchRow(null);
  };

  const updateProduct = (index, field, value) => {
    setProducts(prev => {
        const newProducts = [...prev];
        let item = { ...newProducts[index], [field]: value };
        
        if (field === 'cantidad') {
            const qty = Number(value) || 0;
            item.precioUnitario = getPriceForQty(qty, item, esDistribuidor);
        }

        if (field === 'cantidad' || field === 'precioUnitario') {
          const qty = Number(item.cantidad) || 0;
          const price = Number(item.precioUnitario) || 0;
          // 🔥 TOTAL RESPETA SI ES POR METRO O MULTIPLICADO 🔥
          item.total = item.es_por_metro ? price : qty * price;
        }
        
        newProducts[index] = item; return newProducts;
    });
  };

  const handleQuantityBlur = (index, value) => {
      const item = products[index]; if (!item.descripcion) return;
      const min = item.venta_minima || 1; const qty = Number(value);
      if (qty > 0 && qty < min) { toast({ title: "Venta Mínima", description: `Este producto exige mínimo ${min} unidades.`, variant: "destructive" }); updateProduct(index, 'cantidad', min); }
  };

  const addProduct = () => setProducts(prev => [...prev, { cantidad: 1, descripcion: '', precioUnitario: 0, total: 0, venta_minima: 1, es_por_metro: false }]);
  const removeProduct = (idx) => setProducts(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const handleSubmit = async () => {
    const finalName = selectedClient.nombre || clientSearch;
    if (!finalName) { toast({ title: "Falta Cliente", description: "Ingrese el nombre del cliente.", variant: "destructive" }); return; }
    if (!titulo.trim()) { toast({ title: "Falta Título", description: "Por favor, agregue un título o referencia a la cotización.", variant: "destructive" }); return; }
    const validProducts = products.filter(p => p.descripcion && p.descripcion.trim() !== '');
    if (validProducts.length === 0) { toast({ title: "Sin productos", description: "Añada al menos un producto a la cotización.", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const payload = {
        titulo: titulo, cliente_nombre: finalName, cliente_identificacion: selectedClient.identificacion, cliente_telefono: selectedClient.telefono,
        cliente_direccion: selectedClient.direccion, cliente_email: selectedClient.email, items: validProducts, 
        subtotal: financials.subtotal, iva: financials.iva, total: financials.total, iva_percentage: applyIva ? ivaPercentage : 0, dias_entrega: Number(diasEntrega) || 0,
        financials: { 
            subtotal: financials.subtotal, iva: financials.iva, total: financials.total, ivaPercentage: applyIva ? ivaPercentage : 0, diasEntrega: Number(diasEntrega) || 0,
            descuento: financials.descuento, descuentoPorc: financials.descuentoPorc, anticipoPorc: financials.anticipoPorc, anticipoValor: financials.anticipoValor, saldoPorc: financials.saldoPorc, saldoValor: financials.saldoValor
        },
        notas: notes, responsable_nombre: user.name, status: initialData ? initialData.status : 'BORRADOR', updated_at: new Date().toISOString(), esDistribuidor: esDistribuidor
      };

      if (!initialData) { payload.created_at = new Date().toISOString(); payload.creado_por = user.id; }
      if (initialData) { await supabase.from('proformas').update(payload).eq('id', initialData.id); } 
      else { await supabase.from('proformas').insert([payload]); }

      toast({ title: "✅ Guardado", description: "Proforma registrada con éxito." }); onSuccess();
    } catch (error) { toast({ title: "Error", description: error.message || "No se pudo guardar", variant: "destructive" }); } 
    finally { setLoading(false); }
  };

  const getDisplayedProformaNumber = () => { if (initialData && (initialData.numero || initialData.proformaNumber)) { return String(initialData.numero || initialData.proformaNumber).padStart(6, '0'); } return 'Automático'; };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="h-6 w-6 text-blue-600" />{initialData ? 'Editar Proforma' : 'Nueva Cotización'}</h2><p className="text-sm text-slate-500">{initialData ? `Editando #${getDisplayedProformaNumber()}` : `Consecutivo #${getDisplayedProformaNumber()}`}</p></div>
        <Button variant="ghost" onClick={onCancel} className="hover:bg-slate-100 rounded-full h-10 w-10 p-0"><X className="h-6 w-6 text-slate-500" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-2"><div className="flex items-center gap-2 text-blue-700 font-semibold"><User className="h-5 w-5" /> Datos Generales</div></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Título / Referencia del Trabajo <span className="text-red-500">*</span></label><Input placeholder="Ej: Letrero luminoso..." value={titulo} onChange={(e) => setTitulo(e.target.value)} className="font-semibold text-blue-800" /></div>
                <div className="md:col-span-1"><label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Clock className="h-3 w-3 text-orange-500"/> Días Laborables para Entrega</label><Input type="number" min="0" placeholder="Ej: 5" value={diasEntrega} onChange={(e) => setDiasEntrega(e.target.value)} className="font-semibold text-orange-700 bg-orange-50/50 border-orange-200" /></div>
                
                <div className="relative md:col-span-2 flex gap-2 items-end">
                  <div className="relative flex-1">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Buscar Cliente</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input placeholder="Buscar por Nombre o RUC..." className="pl-9" value={clientSearch} onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(prev => ({...prev, nombre: e.target.value})); setShowClientSuggestions(true); }} onFocus={() => setShowClientSuggestions(true)} onBlur={() => setTimeout(() => setShowClientSuggestions(false), 200)} />
                    </div>
                    <div className="mt-2 flex items-center gap-2 p-2 bg-blue-50/50 border border-blue-100 rounded-md w-fit">
                        <Switch id="chk-dist-prof" checked={esDistribuidor} onCheckedChange={handleDistribuidorToggle} />
                        <label htmlFor="chk-dist-prof" className="text-xs font-bold text-blue-800 cursor-pointer select-none">Aplicar tarifas de Distribuidor a esta proforma</label>
                    </div>
                    {showClientSuggestions && clientSearch.length > 1 && filteredClients.length > 0 && (
                      <div className="absolute z-20 w-full bg-white border border-slate-200 rounded-md shadow-xl mt-1 max-h-60 overflow-y-auto">
                        {filteredClients.map(client => { const displayId = findClientId(client) || 'S/N'; return ( <div key={client.id} className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm border-b border-slate-100 last:border-0" onMouseDown={(e) => { e.preventDefault(); handleClientSelect(client); }}><div className="font-bold text-slate-800">{client.nombre || client.razonSocial || client.full_name}</div><div className="text-xs text-slate-500">ID: {displayId}</div></div> ); })}
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

          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4 border-b pb-2"><div className="flex items-center gap-2 text-blue-700 font-semibold"><Calculator className="h-5 w-5" /> Items a Cotizar</div><div className="flex gap-2"><Button size="sm" type="button" onClick={() => setIsCatalogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2"><ShoppingCart className="h-4 w-4"/> Catálogo</Button><Button size="sm" type="button" onClick={addProduct} variant="outline" className="border-green-500 text-green-700 hover:bg-green-50"><Plus className="h-4 w-4 mr-1" /> Item Manual</Button></div></div>
              <div className="overflow-visible border rounded-lg pb-10 bg-white"> 
                <table className="w-full text-sm">
                   <thead className="bg-slate-100 text-slate-600 font-semibold">
                      <tr><th className="px-3 py-2 text-left">Descripción</th><th className="px-3 py-2 text-center w-24">Cant.</th><th className="px-3 py-2 text-right w-32">P. Unit</th><th className="px-3 py-2 text-right w-32">Total</th><th className="px-3 py-2 w-10"></th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 bg-white">
                      {products.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 group">
                           <td className="p-2 relative align-top pt-3">
                              <textarea 
                                  className="w-full border border-slate-200 rounded p-2 text-sm outline-none focus:border-blue-500 resize-y min-h-[60px]" 
                                  placeholder={idx === products.length - 1 ? "Buscar catálogo o añadir manual..." : ""} 
                                  value={row.descripcion} 
                                  onChange={(e) => handleProductSearchRequest(idx, e.target.value)}
                                  onFocus={() => { if(row.descripcion && row.descripcion.length >= 2) handleProductSearchRequest(idx, row.descripcion); }}
                                  onBlur={() => setTimeout(() => setActiveProductSearchRow(null), 350)}
                              />
                              {activeProductSearchRow === idx && productSuggestions.length > 0 && (
                                  <div className="absolute z-50 w-full min-w-[300px] mt-1 bg-white border border-slate-300 rounded shadow-2xl max-h-60 overflow-y-auto left-0">
                                      {productSuggestions.map(prod => (
                                          <div key={prod.id} className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-sm border-b border-slate-100" onMouseDown={(e) => { e.preventDefault(); handleSelectProductSuggestion(idx, prod); }}>
                                              <div className="font-bold text-slate-800">{prod.nombre}</div>
                                              <div className="flex justify-between items-center mt-1"><span className="text-[10px] text-slate-500 font-mono">{prod.codigo || ''}</span><span className="text-xs text-green-600 font-bold">${Number(prod.precio).toFixed(2)}</span></div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                           </td>
                           <td className="p-2 relative align-top pt-3">
                               <Input type="number" step="0.01" className="text-center h-9 font-bold" min={row.venta_minima || 1} value={row.cantidad||''} onChange={(e) => updateProduct(idx, 'cantidad', e.target.value)} onBlur={(e) => handleQuantityBlur(idx, e.target.value)} />
                               {row.venta_minima > 1 && <span className="absolute bottom-0 left-0 w-full text-center text-[9px] text-red-500 font-bold leading-tight">Mín: {row.venta_minima}</span>}
                           </td>
                           <td className="p-2 align-top pt-3"><Input type="number" className="text-right h-9 font-bold text-green-700" min="0" step="0.01" value={row.precioUnitario||''} onChange={(e) => updateProduct(idx, 'precioUnitario', e.target.value)} /></td>
                           <td className="p-2 text-right font-bold text-slate-800 align-top pt-5">
                               ${Number(row.total || 0).toFixed(2)}
                               {row.es_por_metro && <div className="text-[9px] text-purple-600 font-bold leading-none mt-1" title="Precio fijo por rango">(Fijo)</div>}
                           </td>
                           <td className="p-2 text-center align-top pt-4"><button type="button" onClick={() => removeProduct(idx)} className="text-slate-400 hover:text-red-500 transition-colors" disabled={products.length === 1}><Trash2 className="h-4 w-4" /></button></td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Condiciones / Notas Comerciales</label>
                <textarea className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none" placeholder="El cliente debe enviar el logo en curvas..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            
            <Card className="bg-slate-50 border-slate-200 h-fit">
              <CardContent className="p-5 space-y-3">
                <div className="flex justify-between text-sm text-slate-600"><span>Subtotal:</span><span className="font-medium">${financials.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between items-center text-sm text-slate-600">
                  <span className="flex items-center gap-1">Dscto<input type="number" className="w-12 h-6 border rounded text-center ml-1 text-xs" placeholder="%" value={financials.descuentoPorc || ''} onChange={e => setFinancials(prev => ({...prev, descuentoPorc: Number(e.target.value), descuento: 0}))} />%</span>
                  <div className="flex items-center"><span className="text-red-500 font-bold mr-1">- $</span><input type="number" className="w-16 h-6 border rounded text-right text-xs text-red-500 font-bold" value={financials.descuento || ''} onChange={e => setFinancials(prev => ({...prev, descuento: Number(e.target.value), descuentoPorc: 0}))} /></div>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-600 bg-white p-2 rounded border border-slate-100">
                  <div className="flex items-center gap-2"><Switch checked={applyIva} onCheckedChange={setApplyIva} className="scale-75 data-[state=checked]:bg-blue-600" /><span className={!applyIva ? 'text-slate-400 line-through' : 'font-medium'}>IVA ({ivaPercentage}%)</span></div>
                  <span className={`font-medium ${!applyIva ? 'text-slate-300' : ''}`}>${financials.iva.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-300 pt-3 flex justify-between items-center"><span className="font-bold text-lg text-slate-800">TOTAL:</span><span className="font-bold text-2xl text-blue-700">${financials.total.toFixed(2)}</span></div>
                <div className="border-t border-blue-200 mt-4 pt-3 space-y-2">
                    <span className="text-xs font-bold text-blue-800 uppercase block mb-2">Forma de Pago Requerida</span>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center text-slate-600">Anticipo <input type="number" className="w-12 h-6 border rounded text-center ml-2 text-xs font-bold text-blue-700 bg-blue-50" value={financials.anticipoPorc} onChange={e => { let val = Number(e.target.value); if(val > 100) val = 100; if(val < 0) val = 0; setFinancials(prev => ({...prev, anticipoPorc: val})); }} />%</span>
                        <span className="font-bold text-slate-700">${financials.anticipoValor.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Saldo ({financials.saldoPorc}%)</span><span className="font-bold text-slate-700">${financials.saldoValor.toFixed(2)}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-slate-200 p-4 flex justify-end gap-3 sticky bottom-0 z-20">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[160px]">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} {initialData ? 'Actualizar' : 'Guardar Cotización'}</Button>
      </div>

      {isCatalogOpen && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white shadow-2xl z-[100] flex flex-col border-l border-slate-200 animate-in slide-in-from-right">
            <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5"/> Catálogo de Precios</h3><Button variant="ghost" size="icon" onClick={() => setIsCatalogOpen(false)} className="hover:bg-slate-700"><X className="h-5 w-5" /></Button></div>
            <div className="p-4 border-b border-slate-200 shrink-0 bg-slate-50"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input autoFocus placeholder="Buscar por código, nombre o categoría..." className="pl-9 bg-white" value={searchCatalog} onChange={e => setSearchCatalog(e.target.value)} /></div></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                {catalogItems.filter(item => (item.nombre || '').toLowerCase().includes(searchCatalog.toLowerCase()) || (item.codigo || '').toLowerCase().includes(searchCatalog.toLowerCase()) || (item.categoria || '').toLowerCase().includes(searchCatalog.toLowerCase())).map(item => (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 p-3 rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group" onClick={() => handleCatalogSelect(item)}>
                        <div className="flex justify-between items-start mb-1"><span className="font-bold text-sm text-slate-800 group-hover:text-blue-700 uppercase">{item.nombre}</span><span className="font-bold text-green-700">${Number(item.precio).toFixed(2)}</span></div>
                        <div className="text-[10px] font-bold text-purple-600 mb-1">{item.categoria}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{item.descripcion || item.observaciones}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            {item.es_por_metro && <span className="text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded">Se cobra por Metro</span>}
                            {item.venta_minima > 1 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">Mínimo: {item.venta_minima}</span>}
                            {item.precios_escalonados && item.precios_escalonados.length > 0 && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Descuentos por volumen</span>}
                            {item.precio_distribuidor > 0 && <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">Tarifa Mayorista</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default ProformaForm;