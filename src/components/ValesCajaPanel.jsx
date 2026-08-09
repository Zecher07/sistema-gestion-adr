import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Receipt, Plus, Trash2, Loader2, Save, X, Search, Calendar, Edit2, CheckCircle, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { isUserMatch } from '@/utils/userMatch';

// 🔥 FUNCIÓN QUE OBLIGA AL SISTEMA A USAR LA HORA LOCAL DE ECUADOR 🔥
const getLocalDate = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const ValesCajaPanel = ({ user, orders = [] }) => {
  const { toast } = useToast();
  const [vales, setVales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingVale, setEditingVale] = useState(null); 
  const [staffList, setStaffList] = useState([]); 

  // 🔥 NUEVO: PERMISO COMBINADO ADMIN + CONTABILIDAD 🔥
  const isAdminOrContabilidad = user?.role === 'Administrador' || user?.role === 'Contabilidad';

  const [formData, setFormData] = useState({
    fecha: getLocalDate(), 
    vendedor: user?.name || '',
    vendedor_id: user?.id || '',
    concepto: '',
    monto: '',
    recibido_por: '' 
  });

  useEffect(() => {
    fetchVales();
    if (isAdminOrContabilidad) {
        fetchStaff();
    }
  }, [isAdminOrContabilidad]);

  const fetchStaff = async () => {
      // 🔧 Solo Vendedores, y con id (antes solo traía el nombre)
      const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'Vendedor').order('full_name');
      if (data) setStaffList(data);
  };

  const fetchVales = async () => {
    setLoading(true);
    try {
      let query = supabase.from('vales_caja').select('*').order('fecha', { ascending: false }).order('id', { ascending: false });
      
      if (!isAdminOrContabilidad) {
          // 🔧 FIX: filtrar por id, no por nombre (así no se rompe si cambia el nombre)
          query = query.eq('vendedor_id', user?.id);
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

  const checkAvailableCash = async (vendedorId, vendedorNombre, fechaStr, montoRequerido, excludeValeId = null) => {
      const { data: lastReport } = await supabase.from('daily_closings')
          .select('date, final_balance').eq('user_id', vendedorId).lt('date', fechaStr)
          .order('date', { ascending: false }).limit(1).maybeSingle();

      const baseCash = lastReport ? Number(lastReport.final_balance) : 0;
      const lastDate = lastReport ? lastReport.date : '2000-01-01';

      // 🔧 FIX TIMEOUT: en vez de volver a pedirle 'ordenes' a la base de datos (lo
      // cual causaba timeout), filtramos sobre las órdenes que la app ya tiene
      // cargadas en memoria (prop 'orders'). Cero consultas nuevas, cero riesgo.
      const userOrders = orders.filter(o =>
          o.recibido_por_anticipo_id === vendedorId ||
          o.recibido_por_saldo_id === vendedorId ||
          (Array.isArray(o.vendedor_ids) && o.vendedor_ids.includes(vendedorId))
      );

      let floatingSum = 0;
      let todayIncome = 0;
      let todayExpense = 0;

      const toLocalDateStr = (iso) => {
          if (!iso) return '';
          const d = new Date(iso);
          return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      };

      if (userOrders) {
          userOrders.forEach(o => {
              const createdDateStr = toLocalDateStr(o.created_at || o.createdAt);
              const updatedDateStr = toLocalDateStr(o.updated_at || o.updatedAt);
              const balanceDateStr = o.fecha_pago_saldo ? toLocalDateStr(o.fecha_pago_saldo) : updatedDateStr;

              // 🔧 FIX: comparar por id primero (inmune a cambios de nombre), con
              // respaldo al nombre solo si la orden todavía no tiene id guardado.
              const recibioAnticipo = isUserMatch(o.recibido_por_anticipo_id, o.recibido_por_anticipo, { id: vendedorId, name: vendedorNombre })
                  || (!o.recibido_por_anticipo && !o.recibido_por_anticipo_id && o.vendedor === vendedorNombre);
              const recibioSaldo = isUserMatch(o.recibido_por_saldo_id, o.recibido_por_saldo, { id: vendedorId, name: vendedorNombre })
                  || (!o.recibido_por_saldo && !o.recibido_por_saldo_id && o.vendedor === vendedorNombre);
              const saldoCobrado = (Number(o.financials?.total) || 0) - (Number(o.anticipo) || 0) - (Number(o.retencion) || 0);
              const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
              const saldoFinalReal = saldoCobrado - totalAbonado;

              if (createdDateStr > lastDate && createdDateStr < fechaStr && recibioAnticipo && o.status !== 'ANULADA') {
                  floatingSum += Number(o.anticipo || 0);
              }
              if (balanceDateStr > lastDate && balanceDateStr < fechaStr && ['FINALIZADA', 'VENTAS POR RETIRAR', 'ENTREGADO'].includes(o.status) && saldoFinalReal > 0 && recibioSaldo) {
                  floatingSum += saldoFinalReal;
              }

              if (createdDateStr === fechaStr && recibioAnticipo && Number(o.anticipo) > 0 && o.status !== 'ANULADA') {
                  todayIncome += Number(o.anticipo);
              }
              (o.abonos || []).forEach(abono => {
                  if (toLocalDateStr(abono.fecha) === fechaStr && isUserMatch(abono.cobrador_id, abono.cobrador, { id: vendedorId, name: vendedorNombre })) {
                      todayIncome += Number(abono.monto);
                  }
              });
              if (balanceDateStr === fechaStr && ['FINALIZADA', 'VENTAS POR RETIRAR', 'ENTREGADO'].includes(o.status) && saldoFinalReal > 0 && recibioSaldo) {
                  todayIncome += saldoFinalReal;
              }

              if (o.status === 'ANULADA' && updatedDateStr === fechaStr && recibioAnticipo && Number(o.anticipo) > 0) {
                  todayExpense += Number(o.anticipo);
              }
          });
      }

      // 🔧 FIX TIMEOUT: reutilizamos 'vales' (ya cargado en el estado) en vez de
      // hacer otra consulta. Para Admin/Contabilidad ya trae TODOS los vales;
      // para un vendedor normal, ya trae solo los suyos (ver fetchVales arriba).
      const valesAprobados = vales.filter(v =>
          v.status === 'APROBADO' &&
          (v.vendedor_id ? v.vendedor_id === vendedorId : v.vendedor === vendedorNombre) &&
          v.fecha > lastDate && v.fecha <= fechaStr
      );
      
      if (valesAprobados) {
          valesAprobados.forEach(v => {
              if (v.id !== excludeValeId) { 
                  if (v.fecha === fechaStr) {
                      todayExpense += Number(v.monto);
                  } else {
                      floatingSum -= Number(v.monto); 
                  }
              }
          });
      }

      const cashInHand = baseCash + floatingSum + todayIncome - todayExpense;

      if (montoRequerido > cashInHand) {
          return { isValid: false, cashInHand };
      }
      return { isValid: true, cashInHand };
  };

  const handleOpenModal = (vale = null) => {
      if (vale) {
          setEditingVale(vale);
          setFormData({
              fecha: vale.fecha,
              vendedor: vale.vendedor,
              vendedor_id: vale.vendedor_id || '',
              concepto: vale.concepto,
              monto: vale.monto,
              recibido_por: vale.recibido_por || '' 
          });
      } else {
          setEditingVale(null);
          setFormData({ fecha: getLocalDate(), vendedor: user?.name || '', vendedor_id: user?.id || '', concepto: '', monto: '', recibido_por: '' }); 
      }
      setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.recibido_por.trim()) {
        return toast({ title: "Atención", description: "Debe indicar quién recibió el dinero.", variant: "destructive" });
    }
    if (!formData.concepto.trim() || !formData.monto || formData.monto <= 0) {
        return toast({ title: "Atención", description: "Ingrese un concepto y un monto válido.", variant: "destructive" });
    }
    if (!formData.vendedor || !formData.vendedor_id) {
        return toast({ title: "Atención", description: "Debe asignar un vendedor de origen.", variant: "destructive" });
    }

    setSaving(true);
    try {
      const montoRequerido = parseFloat(formData.monto);
      const excludeId = editingVale ? editingVale.id : null;
      const { isValid, cashInHand } = await checkAvailableCash(formData.vendedor_id, formData.vendedor, formData.fecha, montoRequerido, excludeId);

      if (!isValid) {
          toast({ 
              title: "Fondos insuficientes", 
              description: `La caja actual de ${formData.vendedor} es de $${cashInHand.toFixed(2)}. No puede solicitar un vale por $${montoRequerido.toFixed(2)}.`, 
              variant: "destructive" 
          });
          setSaving(false);
          return;
      }

      const payload = {
          fecha: formData.fecha,
          vendedor: formData.vendedor,
          vendedor_id: formData.vendedor_id,
          concepto: formData.concepto.trim(),
          monto: montoRequerido,
          recibido_por: formData.recibido_por.trim(),
          status: editingVale ? editingVale.status : 'PENDIENTE' 
      };

      if (editingVale) {
          const { error } = await supabase.from('vales_caja').update(payload).eq('id', editingVale.id);
          if (error) throw error;
          toast({ title: "Actualizado", description: "El vale ha sido modificado y está pendiente de revisión." });
      } else {
          const { error } = await supabase.from('vales_caja').insert([payload]);
          if (error) throw error;
          toast({ title: "Vale Registrado", description: "El vale está pendiente de aprobación." });
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
    if (!confirm("¿Seguro que deseas eliminar este vale? Esta acción no se puede deshacer.")) return;
    try {
      const { error } = await supabase.from('vales_caja').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Vale Eliminado", description: "El registro ha sido borrado." });
      fetchVales();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (vale, newStatus) => {
    setApprovingId(vale.id);
    try {
      if (newStatus === 'APROBADO') {
          const { isValid, cashInHand } = await checkAvailableCash(vale.vendedor_id, vale.vendedor, vale.fecha, vale.monto, vale.id);
          if (!isValid) {
              toast({ 
                  title: "No se puede aprobar", 
                  description: `La caja actual de ${vale.vendedor} es de $${cashInHand.toFixed(2)}. Aprobar un vale de $${vale.monto.toFixed(2)} dejaría la caja en negativo.`, 
                  variant: "destructive" 
              });
              setApprovingId(null);
              return;
          }
      }

      const { error } = await supabase.from('vales_caja').update({ status: newStatus }).eq('id', vale.id);
      if (error) throw error;
      
      toast({ 
        title: newStatus === 'APROBADO' ? "Vale Aprobado" : "Vale Rechazado", 
        description: newStatus === 'APROBADO' ? "El dinero se descontará del reporte de caja." : "Este vale no afectará la caja.",
        variant: newStatus === 'RECHAZADO' ? "destructive" : "default" 
      });
      fetchVales();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cambiar el estado.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const filteredVales = vales.filter(v => 
      v.vendedor.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.recibido_por && v.recibido_por.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Receipt className="h-6 w-6 text-red-600" /> Vales de Caja
                </h2>
                <p className="text-slate-500">
                    {isAdminOrContabilidad ? "Administra y aprueba los vales de caja de los vendedores." : "Registra tus retiros. Un administrador o contabilidad debe aprobarlos para que sean válidos."}
                </p>
            </div>
            <Button onClick={() => handleOpenModal()} className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-sm">
                <Plus className="h-4 w-4" /> Nuevo Vale
            </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-0">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input placeholder="Buscar por origen, receptor o concepto..." className="pl-9 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-800 text-white">
                                <tr>
                                    <th className="px-3 py-3 font-semibold whitespace-nowrap">N°</th>
                                    <th className="px-6 py-3 font-semibold">Fecha</th>
                                    <th className="px-6 py-3 font-semibold">Caja Origen</th>
                                    <th className="px-6 py-3 font-semibold">Entregado a</th>
                                    <th className="px-6 py-3 font-semibold">Concepto</th>
                                    <th className="px-6 py-3 font-semibold text-center">Estado</th>
                                    <th className="px-6 py-3 font-semibold text-right">Monto</th>
                                    {isAdminOrContabilidad && <th className="px-6 py-3 font-semibold text-center">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {loading ? (
                                    <tr><td colSpan={isAdminOrContabilidad ? "8" : "7"} className="text-center py-10 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/> Cargando vales...</td></tr>
                                ) : filteredVales.length === 0 ? (
                                    <tr><td colSpan={isAdminOrContabilidad ? "8" : "7"} className="text-center py-10 text-slate-500">No hay vales registrados.</td></tr>
                                ) : (
                                    filteredVales.map(vale => {
                                        const isAprobado = vale.status === 'APROBADO';
                                        const isPendiente = vale.status === 'PENDIENTE' || !vale.status;
                                        const isRechazado = vale.status === 'RECHAZADO';
                                        const isProcessingThis = approvingId === vale.id;

                                        return (
                                        <tr key={vale.id} className={cn("transition-colors group", isRechazado ? "bg-slate-50 opacity-60" : "hover:bg-red-50")}>
                                            {/* 🔧 NUEVO: numeración automática del vale, para poder referirse a "Vale #X" */}
                                            <td className="px-3 py-3 font-mono font-bold text-slate-500 whitespace-nowrap">VC-{String(vale.id).padStart(5, '0')}</td>
                                            <td className="px-6 py-3 text-slate-600 whitespace-nowrap"><Calendar className="inline h-3 w-3 mr-1 opacity-50"/>{vale.fecha}</td>
                                            <td className="px-6 py-3 font-medium text-slate-800">{vale.vendedor}</td>
                                            <td className="px-6 py-3 font-bold text-blue-800">{vale.recibido_por || '-'}</td>
                                            <td className={cn("px-6 py-3 text-slate-600", isRechazado && "line-through")}>{vale.concepto}</td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={cn(
                                                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                    isAprobado ? "bg-green-100 text-green-700 border border-green-200" : 
                                                    isPendiente ? "bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse" : 
                                                    "bg-slate-200 text-slate-500 border border-slate-300"
                                                )}>
                                                    {vale.status || 'PENDIENTE'}
                                                </span>
                                            </td>
                                            <td className={cn("px-6 py-3 text-right font-bold", isRechazado ? "text-slate-400 line-through" : "text-red-600")}>
                                                -$ {Number(vale.monto).toFixed(2)}
                                            </td>
                                            
                                            {isAdminOrContabilidad && (
                                                <td className="px-6 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {isProcessingThis ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                                        ) : (
                                                            <>
                                                                {isPendiente && (
                                                                    <>
                                                                        <button onClick={() => handleUpdateStatus(vale, 'APROBADO')} className="bg-green-100 p-1.5 rounded text-green-600 hover:bg-green-600 hover:text-white transition-colors" title="Aprobar Vale">
                                                                            <CheckCircle className="h-4 w-4" />
                                                                        </button>
                                                                        <button onClick={() => handleUpdateStatus(vale, 'RECHAZADO')} className="bg-red-100 p-1.5 rounded text-red-600 hover:bg-red-600 hover:text-white transition-colors" title="Rechazar Vale">
                                                                            <XCircle className="h-4 w-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <div className="h-4 w-px bg-slate-200 mx-1"></div>
                                                                <button onClick={() => handleOpenModal(vale)} className="text-blue-400 hover:text-blue-600 transition-opacity" title="Editar">
                                                                    <Edit2 className="h-4 w-4" />
                                                                </button>
                                                                <button onClick={() => handleDelete(vale.id)} className="text-red-400 hover:text-red-600 transition-opacity" title="Eliminar Permanente">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )})
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Receipt className="h-5 w-5"/> {editingVale ? 'Editar Vale' : 'Registrar Vale'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-700 p-1 rounded"><X className="h-5 w-5" /></button>
                    </div>
                    
                    <div className="bg-yellow-50 text-yellow-800 text-xs p-3 border-b border-yellow-200 flex items-start gap-2">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>Los vales creados o editados pasarán a estado <strong>PENDIENTE</strong> hasta que un administrador o contabilidad los apruebe.</p>
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fecha</label>
                            <Input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} disabled={!isAdminOrContabilidad} className={!isAdminOrContabilidad ? "bg-slate-50 cursor-not-allowed" : ""} />
                        </div>
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Caja de Origen (Vendedor)</label>
                            {isAdminOrContabilidad ? (
                                <select 
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:border-blue-500"
                                    value={formData.vendedor_id}
                                    onChange={e => {
                                        const seller = staffList.find(s => s.id === e.target.value);
                                        setFormData({...formData, vendedor: seller ? seller.full_name : '', vendedor_id: e.target.value});
                                    }}
                                >
                                    <option value="">Seleccione origen</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </select>
                            ) : (
                                <Input value={formData.vendedor} readOnly className="bg-slate-100 text-slate-600 font-semibold cursor-not-allowed" />
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-blue-600 uppercase mb-1 block">Entregado a / Recibido por *</label>
                            <Input value={formData.recibido_por} onChange={e => setFormData({...formData, recibido_por: e.target.value})} placeholder="Ej: Nombre de la persona o gasto..." className="border-blue-300 focus:border-blue-500 font-semibold text-slate-800"/>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Concepto / Motivo *</label>
                            <Input value={formData.concepto} onChange={e => setFormData({...formData, concepto: e.target.value})} placeholder="Ej: Anticipo de sueldo, Combustible..." />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Monto a retirar ($) *</label>
                            <Input type="number" step="0.01" min="0" value={formData.monto} onChange={e => setFormData({...formData, monto: e.target.value})} placeholder="0.00" className="text-xl font-bold text-red-600 bg-red-50 border-red-200 focus:border-red-500" />
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white shadow-md">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Save className="h-4 w-4 mr-2"/>} {editingVale ? 'Actualizar' : 'Solicitar Retiro'}
                        </Button>
                    </div>
                </motion.div>
            </div>
        )}
    </div>
  );
};

export default ValesCajaPanel;