import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { BookOpen, Search, Plus, Save, Edit2, Trash2, Loader2, RefreshCw, X, Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';

const CatalogPanel = ({ user }) => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const fileInputRef = useRef(null);
  
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  
  const canEditCatalog = user?.role === 'Administrador' || user?.role === 'Producción';
  const isReadOnly = !canEditCatalog; 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ 
      codigo: '', categoria: '', nombre: '', descripcion: '', observaciones: '', precio: 0,
      precios_escalonados: [] 
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { 
      fetchCatalog(activeSearchTerm); 
  }, [activeSearchTerm]);

  const fetchCatalog = async (searchTerm = '') => {
    setLoading(true);
    try {
      let query = supabase.from('catalogo_productos').select('*');
      if (searchTerm) {
          query = query.or(`nombre.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`);
      }
      query = query.order('categoria').order('nombre').limit(200);

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar el catálogo", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSearchKeyDown = (e) => {
      if (e.key === 'Enter') setActiveSearchTerm(searchInput);
  };

  const handleOpenModal = (item = null) => {
    if (isReadOnly) return;
    if (item) {
        setEditingItem(item);
        setFormData({ 
            codigo: item.codigo || '', 
            categoria: item.categoria || '', 
            nombre: item.nombre, 
            descripcion: item.descripcion || '', 
            observaciones: item.observaciones || '',
            precio: item.precio || 0,
            precios_escalonados: item.precios_escalonados || []
        });
    } else {
        setEditingItem(null);
        setFormData({ codigo: '', categoria: '', nombre: '', descripcion: '', observaciones: '', precio: 0, precios_escalonados: [] });
    }
    setIsModalOpen(true);
  };

  // --- LÓGICA DE PRECIOS ESCALONADOS (MANUAL) ---
  const addTier = () => {
      setFormData(prev => ({
          ...prev, 
          precios_escalonados: [...prev.precios_escalonados, { cantidad: '', precio: '' }]
      }));
  };

  const updateTier = (index, field, value) => {
      const newTiers = [...formData.precios_escalonados];
      newTiers[index][field] = Number(value);
      setFormData({ ...formData, precios_escalonados: newTiers });
  };

  const removeTier = (index) => {
      const newTiers = formData.precios_escalonados.filter((_, i) => i !== index);
      setFormData({ ...formData, precios_escalonados: newTiers });
  };

  const handleSave = async () => {
      if (!formData.nombre) return toast({ title: "Atención", description: "El nombre es obligatorio", variant: "destructive" });
      setSaving(true);
      try {
          const cleanedTiers = formData.precios_escalonados.filter(t => t.cantidad > 0 && t.precio > 0);
          const finalData = { ...formData, precios_escalonados: cleanedTiers };
          
          if (cleanedTiers.length > 0) {
             finalData.precio = cleanedTiers.sort((a, b) => a.cantidad - b.cantidad)[0].precio; // Tomar el precio base
          }

          if (editingItem) {
              const { error } = await supabase.from('catalogo_productos').update(finalData).eq('id', editingItem.id);
              if (error) throw error;
              toast({ title: "Actualizado", description: "Producto actualizado." });
          } else {
              const { error } = await supabase.from('catalogo_productos').insert([finalData]);
              if (error) throw error;
              toast({ title: "Creado", description: "Producto añadido al catálogo." });
          }
          setIsModalOpen(false);
          fetchCatalog(activeSearchTerm);
      } catch (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
      if (isReadOnly || !confirm("¿Seguro que deseas eliminar este producto del catálogo?")) return;
      try {
          const { error } = await supabase.from('catalogo_productos').delete().eq('id', id);
          if (error) throw error;
          toast({ title: "Eliminado", description: "Producto borrado." });
          fetchCatalog(activeSearchTerm);
      } catch (error) {
          toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
      }
  };

  // --- 🔥 LECTOR INTELIGENTE DE EXCEL/CSV 🔥 ---
  const parseCSVLine = (text) => {
      const re = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 
      return text.split(re).map(val => val.replace(/^"|"$/g, '').trim());
  };

  const handleCSVUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingCSV(true);

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const text = event.target.result;
              const lines = text.split('\n');
              
              let currentCategory = 'General';
              let idxNombre = -1, idxCodigo = -1, idxDesc = -1, idxObs = -1;
              let cantIndexes = []; 
              
              const productsToInsert = [];

              for (let i = 0; i < lines.length; i++) {
                  if (!lines[i].trim()) continue;
                  const row = parseCSVLine(lines[i]);

                  // 1. Detectar si la fila es un título de Categoría (Ej: "CATEGORÍA: STIKERS...")
                  const possibleCategory = row.find(cell => cell.toUpperCase().includes('CATEGORÍA:'));
                  if (possibleCategory) {
                      currentCategory = possibleCategory.replace(/CATEGORÍA:/i, '').replace(/"/g, '').trim();
                      continue;
                  }

                  // 2. Detectar la fila de Encabezados
                  if (row.some(cell => cell.toUpperCase().includes('NOMBRE DE PRODUCTO'))) {
                      idxNombre = row.findIndex(c => c.toUpperCase().includes('NOMBRE DE PRODUCTO'));
                      idxCodigo = row.findIndex(c => c.toUpperCase().includes('PRODUCTO') && !c.toUpperCase().includes('NOMBRE'));
                      idxDesc = row.findIndex(c => c.toUpperCase().includes('DESCRIPCI'));
                      idxObs = row.findIndex(c => c.toUpperCase().includes('OBSERVACIONES'));
                      
                      cantIndexes = [];
                      row.forEach((col, index) => {
                          if (col.toUpperCase().trim() === 'CANT') {
                              cantIndexes.push(index);
                          }
                      });
                      continue;
                  }

                  // 3. Procesar las filas de productos (solo si ya encontramos el encabezado)
                  if (idxNombre !== -1 && row[idxNombre]) {
                      const nombre = row[idxNombre];
                      if (!nombre || nombre.trim() === '') continue;

                      const codigo = idxCodigo !== -1 ? row[idxCodigo] : null;
                      const descripcion = idxDesc !== -1 ? row[idxDesc] : null;
                      const observaciones = idxObs !== -1 ? row[idxObs] : null;

                      let precios_escalonados = [];
                      cantIndexes.forEach(cantIdx => {
                          const cantVal = Number(row[cantIdx]);
                          const precioValStr = row[cantIdx + 1] ? row[cantIdx + 1].replace('$', '').trim() : '';
                          const precioVal = Number(precioValStr);

                          if (cantVal > 0 && precioVal > 0) {
                              precios_escalonados.push({ cantidad: cantVal, precio: precioVal });
                          }
                      });

                      const basePrecio = precios_escalonados.length > 0 ? precios_escalonados[0].precio : 0;

                      productsToInsert.push({
                          codigo,
                          categoria: currentCategory,
                          nombre,
                          descripcion,
                          observaciones,
                          precio: basePrecio,
                          precios_escalonados
                      });
                  }
              }

              if (productsToInsert.length > 0) {
                  // Agregamos en bloques para no saturar Supabase
                  const { error } = await supabase.from('catalogo_productos').insert(productsToInsert);
                  if (error) throw error;
                  toast({ title: "✅ Importación Exitosa", description: `Se importaron ${productsToInsert.length} productos con sus escalas de precios y categorías.` });
                  fetchCatalog(activeSearchTerm);
              } else {
                  toast({ title: "Atención", description: "No se encontraron productos válidos para importar.", variant: "destructive" });
              }

          } catch (error) {
              toast({ title: "Error de Importación", description: error.message, variant: "destructive" });
          } finally {
              setUploadingCSV(false);
              if (fileInputRef.current) fileInputRef.current.value = ''; 
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="h-6 w-6 text-purple-600" /> Catálogo de Precios</h2>
                <p className="text-slate-500">Consulta los productos y sus escalas de precios por volumen</p>
            </div>
            {!isReadOnly && (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCSVUpload} />
                    <Button variant="outline" onClick={() => fileInputRef.current.click()} disabled={uploadingCSV} className="border-purple-200 text-purple-700 hover:bg-purple-50">
                        {uploadingCSV ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Upload className="h-4 w-4 mr-2" />} Cargar CSV Múltiple
                    </Button>
                    <Button onClick={() => handleOpenModal()} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                        <Plus className="h-4 w-4" /> Nuevo Producto
                    </Button>
                </div>
            )}
        </div>

        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
                    <div className="relative w-full max-w-md flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Buscar código, nombre..." 
                                className="pl-9 bg-white" 
                                value={searchInput} 
                                onChange={(e) => setSearchInput(e.target.value)} 
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                        <Button variant="secondary" onClick={() => setActiveSearchTerm(searchInput)}>Buscar</Button>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => fetchCatalog(activeSearchTerm)} disabled={loading}><RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}/></Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="px-4 py-3 font-semibold w-24">Código</th>
                                <th className="px-4 py-3 font-semibold">Categoría / Producto</th>
                                <th className="px-4 py-3 font-semibold">Observaciones</th>
                                <th className="px-4 py-3 font-semibold text-right w-48">Precios por Volumen</th>
                                {!isReadOnly && <th className="px-4 py-3 font-semibold text-center w-24">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-10 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando...</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-10 text-slate-500">No se encontraron productos.</td></tr>
                            ) : (
                                items.map(item => (
                                    <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500 align-top">{item.codigo || '-'}</td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="text-[10px] font-bold text-purple-600 mb-0.5 uppercase tracking-wider">{item.categoria}</div>
                                            <div className="font-bold text-slate-800 uppercase">{item.nombre}</div>
                                            <div className="text-xs text-slate-500 mt-1 line-clamp-2" title={item.descripcion}>{item.descripcion}</div>
                                        </td>
                                        <td className="px-4 py-3 align-top text-xs text-slate-600">
                                            {item.observaciones || <span className="italic text-slate-400">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right align-top">
                                            {item.precios_escalonados && item.precios_escalonados.length > 0 ? (
                                                <div className="space-y-1 text-xs bg-slate-50 p-1.5 rounded border border-slate-200">
                                                    {item.precios_escalonados.sort((a,b) => a.cantidad - b.cantidad).map((tier, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-slate-600 border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                                            <span className="font-medium bg-white px-1 border border-slate-200 rounded">≥ {tier.cantidad} ud</span>
                                                            <span className="font-bold text-green-700">${Number(tier.precio).toFixed(2)} c/u</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="font-bold text-green-700 text-base">${Number(item.precio || 0).toFixed(2)}</div>
                                            )}
                                        </td>
                                        {!isReadOnly && (
                                            <td className="px-4 py-3 align-top">
                                                <div className="flex justify-center gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => handleOpenModal(item)} className="h-7 w-7 text-blue-600"><Edit2 className="h-3 w-3" /></Button>
                                                    <Button variant="outline" size="icon" onClick={() => handleDelete(item.id)} className="h-7 w-7 text-red-600"><Trash2 className="h-3 w-3" /></Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>

        {/* 🔥 MODAL PARA EDITAR/CREAR CON PRECIOS DINÁMICOS 🔥 */}
        {isModalOpen && !isReadOnly && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-lg">{editingItem ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-700 p-1 rounded"><X className="h-5 w-5" /></button>
                    </div>
                    
                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Código ID</label><Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} placeholder="Ej: OTR001" /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoría</label><Input value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Ej: Láminas" /></div>
                        </div>
                        
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre de Producto *</label><Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} /></div>
                        
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descripción Técnica</label><textarea className="w-full border border-slate-300 rounded p-2 text-sm outline-none" rows="2" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} /></div>
                        
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Observaciones / Condiciones Comerciales</label><textarea className="w-full border border-slate-300 rounded p-2 text-sm outline-none" rows="2" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Ej: Entrega inmediata confirmado pago..." /></div>

                        {/* SECCIÓN DINÁMICA DE PRECIOS ESCALONADOS */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><FileText className="h-4 w-4"/> Precios por Volumen</h4>
                                <span className="text-xs text-slate-500 italic">Deje vacío si tiene precio único</span>
                            </div>
                            
                            {formData.precios_escalonados.length > 0 && (
                                <div className="space-y-2 mb-3">
                                    {formData.precios_escalonados.map((tier, index) => (
                                        <div key={index} className="flex items-end gap-3 bg-white p-3 rounded shadow-sm border border-slate-200">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-slate-500 uppercase font-bold">A partir de (Cant):</label>
                                                <Input type="number" min="1" value={tier.cantidad} onChange={e => updateTier(index, 'cantidad', e.target.value)} placeholder="Ej: 3" className="h-8 text-sm font-mono"/>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] text-green-700 uppercase font-bold">Precio Unitario ($):</label>
                                                <Input type="number" step="0.01" value={tier.precio} onChange={e => updateTier(index, 'precio', e.target.value)} placeholder="Ej: 12.50" className="h-8 text-sm font-bold text-green-700"/>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => removeTier(index)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200"><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <Button type="button" variant="outline" size="sm" onClick={addTier} className="w-full border-dashed border-slate-300 text-slate-700 bg-white hover:bg-slate-100">
                                <Plus className="h-4 w-4 mr-2" /> Añadir precio por cantidad
                            </Button>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>} Guardar Catálogo</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CatalogPanel;