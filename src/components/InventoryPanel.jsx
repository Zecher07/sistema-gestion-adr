import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Search, Plus, Save, Edit2, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text'; // Usamos Text.jsx según tu proyecto
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';

const InventoryPanel = ({ user, mode = 'manage' }) => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🔥 LÓGICA DE PERMISOS
  // Si entra a 'inventario-ver' es solo lectura. 
  // Además, doble validación: si es Ventas o Contabilidad, forzamos lectura.
  const isReadOnly = mode === 'view' || (user?.role !== 'Administrador' && user?.role !== 'Producción');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [formData, setFormData] = useState({ nombre: '', cantidad: 0, unidad: 'Unidades', ubicacion: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

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

  const handleOpenModal = (item = null) => {
    if (isReadOnly) return; // Bloqueo de seguridad

    if (item) {
        setEditingItem(item);
        setFormData({ nombre: item.nombre, cantidad: item.cantidad, unidad: item.unidad || 'Unidades', ubicacion: item.ubicacion || '' });
    } else {
        setEditingItem(null);
        setFormData({ nombre: '', cantidad: 0, unidad: 'Unidades', ubicacion: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
      if (!formData.nombre) return toast({ title: "Atención", description: "El nombre es obligatorio", variant: "destructive" });
      
      setSaving(true);
      try {
          if (editingItem) {
              const { error } = await supabase.from('inventario').update(formData).eq('id', editingItem.id);
              if (error) throw error;
              toast({ title: "Actualizado", description: "Inventario actualizado." });
          } else {
              const { error } = await supabase.from('inventario').insert([formData]);
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

  const filteredItems = items.filter(item => item.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in">
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
            
            {/* Solo muestra el botón de añadir si NO es modo lectura */}
            {!isReadOnly && (
                <Button onClick={() => handleOpenModal()} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
                    <Plus className="h-4 w-4" /> Añadir Material
                </Button>
            )}
        </div>

        <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Buscar material..." className="pl-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchInventory} disabled={loading}><RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`}/></Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="px-6 py-3 font-semibold rounded-tl-lg">Material / Producto</th>
                                <th className="px-6 py-3 font-semibold text-center w-32">Cantidad</th>
                                <th className="px-6 py-3 font-semibold">Ubicación</th>
                                {/* Columna de Acciones solo visible si no es modo lectura */}
                                {!isReadOnly && <th className="px-6 py-3 font-semibold text-center w-40 rounded-tr-lg">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {loading ? (
                                <tr><td colSpan={isReadOnly ? "3" : "4"} className="text-center py-10 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando inventario...</td></tr>
                            ) : filteredItems.length === 0 ? (
                                <tr><td colSpan={isReadOnly ? "3" : "4"} className="text-center py-10 text-slate-500">No se encontraron materiales.</td></tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800 uppercase">{item.nombre} <span className="text-xs font-normal text-slate-500 lowercase">({item.unidad})</span></td>
                                        <td className="px-6 py-4">
                                            {isReadOnly ? (
                                                /* MODO LECTURA: Solo muestra el número */
                                                <div className="flex justify-center items-center">
                                                    <span className={`font-bold text-lg ${item.cantidad <= 5 ? 'text-red-600' : 'text-slate-900'}`}>{item.cantidad}</span>
                                                </div>
                                            ) : (
                                                /* MODO GESTIÓN: Muestra botones + y - */
                                                <div className="flex items-center justify-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200">
                                                    <button onClick={() => updateQuantity(item.id, item.cantidad, -1)} className="h-6 w-6 flex items-center justify-center rounded-full bg-white shadow hover:bg-red-100 hover:text-red-600 font-bold">-</button>
                                                    <span className={`font-bold w-8 text-center ${item.cantidad <= 5 ? 'text-red-600' : 'text-slate-900'}`}>{item.cantidad}</span>
                                                    <button onClick={() => updateQuantity(item.id, item.cantidad, 1)} className="h-6 w-6 flex items-center justify-center rounded-full bg-white shadow hover:bg-green-100 hover:text-green-600 font-bold">+</button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{item.ubicacion || '-'}</td>
                                        
                                        {!isReadOnly && (
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => handleOpenModal(item)} className="h-8 w-8 text-blue-600 hover:bg-blue-50 border-blue-200"><Edit2 className="h-4 w-4" /></Button>
                                                    {user.role === 'Administrador' && (
                                                        <Button variant="outline" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-red-600 hover:bg-red-50 border-red-200"><Trash2 className="h-4 w-4" /></Button>
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
            </CardContent>
        </Card>

        {/* Modal Crear/Editar (Solo se renderiza en modo gestión) */}
        {isModalOpen && !isReadOnly && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold text-lg">{editingItem ? 'Editar Material' : 'Nuevo Material'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-700 p-1 rounded"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre del Material *</label>
                            <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Lona Vinilica Blanca" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cantidad Inicial *</label>
                                <Input type="number" min="0" value={formData.cantidad} onChange={e => setFormData({...formData, cantidad: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Unidad de Medida</label>
                                <select className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-blue-500" value={formData.unidad} onChange={e => setFormData({...formData, unidad: e.target.value})}>
                                    <option value="Unidades">Unidades</option>
                                    <option value="Metros">Metros (m)</option>
                                    <option value="Rollos">Rollos</option>
                                    <option value="Litros">Litros (L)</option>
                                    <option value="Cajas">Cajas</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ubicación (Opcional)</label>
                            <Input value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} placeholder="Ej: Bodega 1, Estante B..." />
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>} Guardar
                        </Button>
                    </div>
                </motion.div>
            </div>
        )}
    </div>
  );
};

export default InventoryPanel;