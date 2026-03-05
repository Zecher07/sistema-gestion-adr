import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Receipt, Plus, Trash2, Loader2, Save, X, Search, Calendar, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

const ValesCajaPanel = ({ user }) => {
  const { toast } = useToast();
  const [vales, setVales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingVale, setEditingVale] = useState(null); 
  const [staffList, setStaffList] = useState([]); // Para el Admin

  const isAdmin = user?.role === 'Administrador';

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    vendedor: user?.name || '',
    concepto: '',
    monto: ''
  });

  useEffect(() => {
    fetchVales();
    if (isAdmin) {
        fetchStaff();
    }
  }, [isAdmin]);

  const fetchStaff = async () => {
      const { data } = await supabase.from('profiles').select('full_name').order('full_name');
      if (data) setStaffList(data);
  };

  const fetchVales = async () => {
    setLoading(true);
    try {
      let query = supabase.from('vales_caja').select('*').order('fecha', { ascending: false }).order('id', { ascending: false });
      
      // Si NO es admin, solo ve los suyos
      if (!isAdmin) {
          query = query.eq('vendedor', user?.name);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVales(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar los vales", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (vale = null) => {
      if (vale) {
          setEditingVale(vale);
          setFormData({
              fecha: vale.fecha,
              vendedor: vale.vendedor,
              concepto: vale.concepto,
              monto: vale.monto
          });
      } else {
          setEditingVale(null);
          setFormData({ fecha: new Date().toISOString().split('T')[0], vendedor: user?.name || '', concepto: '', monto: '' });
      }
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.concepto.trim() || !formData.monto || formData.monto <= 0) {
        return toast({ title: "Atención", description: "Ingrese un concepto y un monto válido.", variant: "destructive" });
    }
    if (!formData.vendedor) {
        return toast({ title: "Atención", description: "Debe asignar un vendedor.", variant: "destructive" });
    }

    setSaving(true);
    try {
      const payload = {
          fecha: formData.fecha,
          vendedor: formData.vendedor,
          concepto: formData.concepto.trim(),
          monto: parseFloat(formData.monto)
      };

      if (editingVale) {
          const { error } = await supabase.from('vales_caja').update(payload).eq('id', editingVale.id);
          if (error) throw error;
          toast({ title: "Actualizado", description: "El vale ha sido modificado exitosamente." });
      } else {
          const { error } = await supabase.from('vales_caja').insert([payload]);
          if (error) throw error;
          toast({ title: "Vale Registrado", description: "El vale aparecerá en el Reporte Diario." });
      }
      
      setIsModalOpen(false);
      fetchVales();
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Seguro que deseas eliminar este vale? Esto devolverá el dinero a la caja diaria.")) return;
    try {
      const { error } = await supabase.from('vales_caja').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Vale Eliminado", description: "El registro ha sido borrado." });
      fetchVales();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const filteredVales = vales.filter(v => 
      v.vendedor.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.concepto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Receipt className="h-6 w-6 text-red-600" /> Vales de Caja
                </h2>
                <p className="text-slate-500">Registra retiros menores y anticipos. El cuadre se verá en el Reporte Diario.</p>
            </div>
            <Button onClick={() => handleOpenModal()} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                <Plus className="h-4 w-4" /> Nuevo Vale
            </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-0">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Buscar por vendedor o concepto..." className="pl-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-800 text-white">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">Fecha</th>
                                    <th className="px-6 py-3 font-semibold">Vendedor</th>
                                    <th className="px-6 py-3 font-semibold">Concepto</th>
                                    <th className="px-6 py-3 font-semibold text-right">Monto</th>
                                    {isAdmin && <th className="px-6 py-3 font-semibold text-center w-28">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {loading ? (
                                    <tr><td colSpan={isAdmin ? "5" : "4"} className="text-center py-10 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando vales...</td></tr>
                                ) : filteredVales.length === 0 ? (
                                    <tr><td colSpan={isAdmin ? "5" : "4"} className="text-center py-10 text-slate-500">No hay vales registrados.</td></tr>
                                ) : (
                                    filteredVales.map(vale => (
                                        <tr key={vale.id} className="hover:bg-red-50 transition-colors group">
                                            <td className="px-6 py-3 text-slate-600 whitespace-nowrap"><Calendar className="inline h-3 w-3 mr-1 opacity-50"/>{vale.fecha}</td>
                                            <td className="px-6 py-3 font-medium text-slate-800">{vale.vendedor}</td>
                                            <td className="px-6 py-3 text-slate-600">{vale.concepto}</td>
                                            <td className="px-6 py-3 text-right font-bold text-red-600">-$ {Number(vale.monto).toFixed(2)}</td>
                                            {/* Solo el Admin puede editar y borrar */}
                                            {isAdmin && (
                                                <td className="px-6 py-3 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleOpenModal(vale)} className="text-blue-400 hover:text-blue-600 opacity-50 group-hover:opacity-100 transition-opacity" title="Editar">
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleDelete(vale.id)} className="text-red-400 hover:text-red-600 opacity-50 group-hover:opacity-100 transition-opacity" title="Eliminar">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
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
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Receipt className="h-5 w-5"/> {editingVale ? 'Editar Vale' : 'Registrar Vale'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-700 p-1 rounded"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha</label>
                            <Input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} disabled={!isAdmin} />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Vendedor / Responsable</label>
                            {isAdmin ? (
                                <select 
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-blue-500"
                                    value={formData.vendedor}
                                    onChange={e => setFormData({...formData, vendedor: e.target.value})}
                                >
                                    <option value="">Seleccione un vendedor</option>
                                    {staffList.map(s => (
                                        <option key={s.full_name} value={s.full_name}>{s.full_name}</option>
                                    ))}
                                </select>
                            ) : (
                                <Input value={formData.vendedor} readOnly className="bg-slate-100 text-slate-600 font-semibold cursor-not-allowed" />
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Concepto / Motivo *</label>
                            <Input value={formData.concepto} onChange={e => setFormData({...formData, concepto: e.target.value})} placeholder="Ej: Anticipo pasajes, Comida..." />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto a retirar ($) *</label>
                            <Input type="number" step="0.01" min="0" value={formData.monto} onChange={e => setFormData({...formData, monto: e.target.value})} placeholder="0.00" className="text-xl font-bold text-red-600" />
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>} {editingVale ? 'Actualizar' : 'Registrar Retiro'}
                        </Button>
                    </div>
                </motion.div>
            </div>
        )}
    </div>
  );
};

export default ValesCajaPanel;