import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Search, Plus, Save, Edit2, Trash2, Loader2, RefreshCw, X, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text'; 
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const InventoryPanel = ({ user, mode = 'manage' }) => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Paginación
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  
  // LÓGICA DE PERMISOS
  const isReadOnly = mode === 'view' || (user?.role !== 'Administrador' && user?.role !== 'Producción');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Estados del Formulario
  const [formData, setFormData] = useState({ codigo: '', nombre: '', categoria: '', cantidad: 0, unidad: 'Unidades', ubicacion: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  // Reiniciar página al buscar o cambiar cantidad
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, selectedCategory]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('inventario').select('*').order('nombre');
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo cargar el inventario", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const categories = [...new Set(items.map(i => i.categoria).filter(Boolean))].sort();

  const handleOpenModal = (item = null) => {
    if (isReadOnly) return; 

    if (item) {
        setEditingItem(item);
        setFormData({ 
            codigo: item.codigo || '',
            nombre: item.nombre || '', 
            categoria: item.categoria || '',
            cantidad: item.cantidad || 0, 
            unidad: item.unidad || 'Unidades', 
            ubicacion: item.ubicacion || '' 
        });
    } else {
        setEditingItem(null);
        setFormData({ codigo: '', nombre: '', categoria: '', cantidad: 0, unidad: 'Unidades', ubicacion: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
      if (!formData.nombre) return toast({ title: "Atención", description: "El nombre es obligatorio", variant: "destructive" });
      
      setSaving(true);
      try {
          const payload = {
              ...formData,
              categoria: formData.categoria ? formData.categoria.trim().toUpperCase() : ''
          };

          if (editingItem) {
              const { error } = await supabase.from('inventario').update(payload).eq('id', editingItem.id);
              if (error) throw error;
              toast({ title: "Actualizado", description: "Inventario actualizado." });
          } else {
              const { error } = await supabase.from('inventario').insert([payload]);
              if (error) throw error;
              toast({ title: "Creado", description: "Material añadido al inventario." });
          }
          setIsModalOpen(false);
          fetchInventory();
      } catch (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async (id) => {
      if (isReadOnly || !confirm("¿Seguro que deseas eliminar este material del inventario?")) return;
      try {
          const { error } = await supabase.from('inventario').delete().eq('id', id);
          if (error) throw error;
          toast({ title: "Eliminado", description: "Material borrado." });
          fetchInventory();
      } catch (error) {
          toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
      }
  };

  const updateQuantity = async (id, currentQty, amount) => {
      if (isReadOnly) return;

      const newQty = currentQty + amount;
      if (newQty < 0) return; 
      
      try {
          setItems(items.map(i => i.id === id ? { ...i, cantidad: newQty } : i));
          const { error } = await supabase.from('inventario').update({ cantidad: newQty }).eq('id', id);
          if (error) {
              fetchInventory(); 
              throw error;
          }
      } catch (error) {
          toast({ title: "Error", description: "No se pudo actualizar la cantidad.", variant: "destructive" });
      }
  };

  // Filtrado y Paginación
  const searchFilteredItems = useMemo(() => {
      return items.filter(item => {
          const matchSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (item.codigo && item.codigo.toLowerCase().includes(searchTerm.toLowerCase()));
          const matchCategory = selectedCategory === '' || item.categoria === selectedCategory;
          return matchSearch && matchCategory;
      });
  }, [items, searchTerm, selectedCategory]);

  const totalItems = searchFilteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedItems = searchFilteredItems.slice(startIndex, endIndex);

  return (
    <div className="space-y-4 animate-in fade-in">
        {/* Cabecera Principal */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Package className="h-6 w-6 text-orange-600" /> 
                    {isReadOnly ? 'Inventario Disponible' : 'Gestión de Inventario'}
                </h2>
                <p className="text-slate-500">
                    {isReadOnly ? 'Consulta el material disponible en el área de producción' : 'Controla y actualiza los materiales disponibles'}
                </p>
            </div>
            
            {!isReadOnly && (
                <Button onClick={() => handleOpenModal()} className="bg-orange-600 hover:bg-orange-700 text-white gap-2 font-bold shadow-sm">
                    <Plus className="h-4 w-4" /> Añadir Material
                </Button>
            )}
        </div>

        {/* Tabla Estilo Trabajo */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
            
            {/* Barra de Controles Superior */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
                <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                    <span>Mostrar</span>
                    <select 
                        className="border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800"
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                    <span>registros</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <select 
                            className="border border-slate-300 rounded px-3 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-700 w-full sm:w-48"
                            value={selectedCategory} 
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="">Todas las Categorías</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-sm font-bold text-slate-700">Buscar:</span>
                        <div className="relative w-full">
                            <input 
                                type="text"
                                className="border border-slate-300 rounded pl-3 pr-8 py-1 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Nombre o código..."
                            />
                            {searchTerm && (
                                <X 
                                   className="absolute right-2 top-1.5 h-4 w-4 text-slate-400 hover:text-slate-600 cursor-pointer" 
                                   onClick={() => setSearchTerm('')} 
                                />
                            )}
                        </div>
                    </div>
                    
                    <Button variant="ghost" size="icon" onClick={fetchInventory} disabled={loading} className="hidden sm:flex border border-slate-200 bg-white hover:bg-slate-100">
                        <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}/>
                    </Button>
                </div>
            </div>

            {/* Contenedor de la Tabla */}
            <div className="overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-700 font-bold border-b border-slate-200 bg-white">
                        <tr>
                            <th className="px-6 py-3 whitespace-nowrap">Código</th>
                            <th className="px-6 py-3 whitespace-nowrap">Material / Producto</th>
                            <th className="px-6 py-3 whitespace-nowrap text-center">Categoría</th>
                            <th className="px-6 py-3 whitespace-nowrap text-center w-32">Cantidad</th>
                            <th className="px-6 py-3 whitespace-nowrap">Ubicación</th>
                            {!isReadOnly && <th className="px-6 py-3 whitespace-nowrap text-center w-32">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={isReadOnly ? "5" : "6"} className="text-center py-20 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando inventario...</td></tr>
                        ) : paginatedItems.length === 0 ? (
                            <tr>
                                <td colSpan={isReadOnly ? "5" : "6"} className="px-6 py-12 text-center text-slate-500 italic bg-slate-50/50">
                                    <div className="flex flex-col items-center gap-2">
                                        <Package className="h-8 w-8 text-slate-300" />
                                        <span className="text-lg font-medium text-slate-400">Sin resultados</span>
                                        <span>No se encontraron materiales que coincidan con la búsqueda.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedItems.map(item => (
                                <tr key={item.id} className="hover:bg-orange-50/40 transition-colors group">
                                    <td className="px-6 py-3">
                                        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 font-medium">
                                            {item.codigo || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="font-bold text-slate-800 uppercase">{item.nombre}</div>
                                        <div className="text-[10px] text-slate-500 mt-0.5">MEDIDA: {item.unidad}</div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        {item.categoria ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                                                {item.categoria}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-3">
                                        {isReadOnly ? (
                                            <div className="flex justify-center items-center">
                                                <span className={cn(
                                                    "font-bold text-base px-3 py-1 rounded-md", 
                                                    item.cantidad <= 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-800'
                                                )}>
                                                    {item.cantidad}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-2 bg-white p-1 rounded-full border border-slate-200 shadow-sm w-fit mx-auto">
                                                <button onClick={() => updateQuantity(item.id, item.cantidad, -1)} className="h-6 w-6 flex items-center justify-center rounded-full bg-slate-50 hover:bg-red-100 hover:text-red-600 text-slate-500 font-bold transition-colors">-</button>
                                                <span className={cn(
                                                    "font-bold w-10 text-center text-sm", 
                                                    item.cantidad <= 5 ? 'text-red-600' : 'text-slate-900'
                                                )}>
                                                    {item.cantidad}
                                                </span>
                                                <button onClick={() => updateQuantity(item.id, item.cantidad, 1)} className="h-6 w-6 flex items-center justify-center rounded-full bg-slate-50 hover:bg-green-100 hover:text-green-600 text-slate-500 font-bold transition-colors">+</button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 text-xs font-medium">
                                        {item.ubicacion || '-'}
                                    </td>
                                    
                                    {!isReadOnly && (
                                        <td className="px-6 py-3">
                                            <div className="flex justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50"><Edit2 className="h-4 w-4" /></Button>
                                                {user.role === 'Administrador' && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Paginación Inferior */}
            <div className="px-6 py-3 border-t border-slate-200 bg-white text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
                <div>
                    Mostrando registros del <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> al <span className="font-semibold">{endIndex}</span> de un total de <span className="font-semibold">{totalItems}</span> registros
                </div>
                
                <div className="flex items-center gap-1">
                    <span className="mr-2 text-slate-500 hidden sm:inline">Anterior</span>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2 border-slate-300"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium min-w-[32px] text-center">
                        {currentPage}
                    </div>

                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-2 border-slate-300"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="ml-2 text-slate-500 hidden sm:inline">Siguiente</span>
                </div>
            </div>
        </div>

        {/* Modal Añadir / Editar */}
        <AnimatePresence>
        {isModalOpen && !isReadOnly && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 10 }} 
                    animate={{ scale: 1, opacity: 1, y: 0 }} 
                    exit={{ scale: 0.95, opacity: 0, y: 10 }} 
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
                >
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Package className="h-5 w-5 text-orange-400"/>
                            {editingItem ? 'Editar Material' : 'Nuevo Material'}
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-700 p-1.5 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-5">
                            <div className="col-span-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nombre del Material *</label>
                                <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Lona Vinilica Blanca" className="font-medium text-sm" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Código (Opcional)</label>
                                <Input value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} placeholder="Ej: P001" className="font-mono text-sm" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Categoría</label>
                                <input 
                                    list="category-list"
                                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    value={formData.categoria} 
                                    onChange={e => setFormData({...formData, categoria: e.target.value})} 
                                    placeholder="Selecciona o escribe..." 
                                />
                                <datalist id="category-list">
                                    {categories.map(cat => (
                                        <option key={cat} value={cat} />
                                    ))}
                                </datalist>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Cantidad Inicial *</label>
                                <Input type="number" min="0" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: Number(e.target.value)})} className="font-bold text-lg text-slate-800" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Unidad de Medida</label>
                                <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-orange-500 h-10 font-medium text-slate-700" value={formData.unidad} onChange={e => setFormData({...formData, unidad: e.target.value})}>
                                    <option value="Unidades">Unidades</option>
                                    <option value="Metros">Metros (m)</option>
                                    <option value="Rollos">Rollos</option>
                                    <option value="Litros">Litros (L)</option>
                                    <option value="Cajas">Cajas</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Ubicación (Opcional)</label>
                                <Input value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} placeholder="Ej: Bodega 1, Estante B..." className="text-sm" />
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} className="font-semibold">Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>} {editingItem ? 'Actualizar' : 'Guardar Material'}
                        </Button>
                    </div>
                </motion.div>
            </div>
        )}
        </AnimatePresence>
    </div>
  );
};

export default InventoryPanel;