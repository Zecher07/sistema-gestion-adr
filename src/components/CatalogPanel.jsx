import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BookOpen, Search, Plus, Save, Edit2, Trash2, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text'; // O input, según tu configuración
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';

const CatalogPanel = ({ user }) => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Para la búsqueda optimizada (Server-Side)
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  
  const canEditCatalog = user?.role === 'Administrador' || user?.role === 'Producción';
  const isReadOnly = !canEditCatalog; 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ codigo: '', categoria: '', nombre: '', descripcion: '', precio: 0 });
  const [saving, setSaving] = useState(false);

  // Se ejecuta al cargar y cuando cambia el término de búsqueda activo
  useEffect(() => { 
      fetchCatalog(activeSearchTerm); 
  }, [activeSearchTerm]);

  const fetchCatalog = async (searchTerm = '') => {
    setLoading(true);
    try {
      let query = supabase.from('catalogo_productos').select('*');
      
      // 🔥 LA MAGIA DE LA OPTIMIZACIÓN: Si hay texto, busca en la DB. 
      if (searchTerm) {
          query = query.or(`nombre.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`);
      }
      
      // 🔥 Límite de 100 productos en pantalla para no saturar la memoria RAM
      query = query.order('nombre').limit(100);

      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar el catálogo", variant: "destructive" });
    } finally { setLoading(false); }
  };

  // Retraso para no buscar por cada letra (Debounce manual)
  const handleSearchKeyDown = (e) => {
      if (e.key === 'Enter') {
          setActiveSearchTerm(searchInput);
      }
  };

  const handleOpenModal = (item = null) => {
    if (isReadOnly) return;
    if (item) {
        setEditingItem(item);
        setFormData({ codigo: item.codigo || '', categoria: item.categoria || '', nombre: item.nombre, descripcion: item.descripcion || '', precio: item.precio || 0 });
    } else {
        setEditingItem(null);
        setFormData({ codigo: '', categoria: '', nombre: '', descripcion: '', precio: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
      if (!formData.nombre) return toast({ title: "Atención", description: "El nombre es obligatorio", variant: "destructive" });
      setSaving(true);
      try {
          if (editingItem) {
              const { error } = await supabase.from('catalogo_productos').update(formData).eq('id', editingItem.id);
              if (error) throw error;
              toast({ title: "Actualizado", description: "Producto actualizado." });
          } else {
              const { error } = await supabase.from('catalogo_productos').insert([formData]);
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

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="h-6 w-6 text-purple-600" /> Catálogo de Precios</h2>
                <p className="text-slate-500">Consulta los productos y precios estandarizados</p>
            </div>
            {!isReadOnly && (
                <Button onClick={() => handleOpenModal()} className="bg-purple-600 hover:bg-purple-700 text-white gap-2"><Plus className="h-4 w-4" /> Nuevo Producto</Button>
            )}
        </div>

        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
                    <div className="relative w-full max-w-md flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Escribe y presiona Enter para buscar..." 
                                className="pl-9 bg-white" 
                                value={searchInput} 
                                onChange={(e) => setSearchInput(e.target.value)} 
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                        <Button variant="secondary" onClick={() => setActiveSearchTerm(searchInput)}>Buscar</Button>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500">Mostrando máx. 100 resultados</span>
                        <Button variant="ghost" size="icon" onClick={() => fetchCatalog(activeSearchTerm)} disabled={loading}><RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}/></Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="px-4 py-3 font-semibold rounded-tl-lg w-24">Código</th>
                                <th className="px-4 py-3 font-semibold">Producto / Descripción</th>
                                <th className="px-4 py-3 font-semibold text-right w-32">Precio Base</th>
                                {!isReadOnly && <th className="px-4 py-3 font-semibold text-center w-24 rounded-tr-lg">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {loading ? (
                                <tr><td colSpan={isReadOnly ? "3" : "4"} className="text-center py-10 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando catálogo...</td></tr>
                            ) : items.length === 0 ? (
                                <tr><td colSpan={isReadOnly ? "3" : "4"} className="text-center py-10 text-slate-500">No se encontraron productos. Intenta otra búsqueda.</td></tr>
                            ) : (
                                items.map(item => (
                                    <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-500">{item.codigo || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800 uppercase">{item.nombre}</div>
                                            <div className="text-xs text-slate-500 line-clamp-1" title={item.descripcion}>{item.descripcion}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-green-700">${Number(item.precio).toFixed(2)}</td>
                                        {!isReadOnly && (
                                            <td className="px-4 py-3">
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

        {isModalOpen && !isReadOnly && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold text-lg">{editingItem ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-700 p-1 rounded"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Código</label><Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} placeholder="Ej: P001" /></div>
                            <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Precio Base ($) *</label><Input type="number" step="0.01" min="0" value={formData.precio} onChange={e => setFormData({...formData, precio: Number(e.target.value)})} /></div>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre de Producto *</label><Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} /></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Descripción (Opcional)</label><textarea className="w-full border border-slate-300 rounded p-2 text-sm outline-none" rows="3" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} /></div>
                    </div>
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>} Guardar</Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default CatalogPanel;