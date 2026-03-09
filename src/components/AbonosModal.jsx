import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Save, Coins, Banknote, Calendar, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const AbonosModal = ({ order, user, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [nota, setNota] = useState('');

  const saldoActual = Number(order.financials?.saldo || 0);
  const abonos = order.abonos || [];

  const handleSave = async () => {
    const abonoValue = Number(monto);
    if (abonoValue <= 0) return toast({ title: "Error", description: "El abono debe ser mayor a $0", variant: "destructive" });
    if (abonoValue > saldoActual) return toast({ title: "Error", description: "El abono no puede ser mayor al saldo pendiente", variant: "destructive" });

    setSaving(true);
    try {
      const nuevoAbono = {
        id: Date.now().toString(),
        fecha: new Date().toISOString(),
        monto: abonoValue,
        metodoPago,
        nota: nota.trim() || 'Sin nota',
        cobrador: user.name
      };

      const abonosActualizados = [...abonos, nuevoAbono];
      const nuevoSaldo = Math.max(0, saldoActual - abonoValue);

      const { error } = await supabase.from('ordenes').update({
        abonos: abonosActualizados,
        financials: { ...order.financials, saldo: nuevoSaldo }
      }).eq('id', order.id);

      if (error) throw error;

      toast({ title: "Abono Registrado", description: `Se ha restado $${abonoValue.toFixed(2)} al saldo.` });
      onSuccess();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo registrar el abono", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2"><Coins className="h-5 w-5"/> Historial de Abonos: Orden #{order.order_number || order.id}</h3>
            <button onClick={onClose} className="hover:bg-emerald-700 p-1.5 rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6">
            {/* Saldo Actual */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 flex justify-between items-center">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Cliente</p>
                    <p className="font-bold text-slate-800">{order.cliente}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 uppercase">Saldo Pendiente</p>
                    <p className="font-black text-2xl text-emerald-600">${saldoActual.toFixed(2)}</p>
                </div>
            </div>

            {/* Historial de Abonos */}
            <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 mb-2 border-b pb-1">Abonos Anteriores</h4>
                {abonos.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No hay abonos registrados.</p>
                ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {abonos.map((a, i) => (
                            <div key={a.id || i} className="bg-white border border-slate-200 p-2 rounded text-xs flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="font-bold text-slate-800 flex items-center gap-1"><Calendar className="h-3 w-3 text-slate-400"/> {new Date(a.fecha).toLocaleDateString()}</div>
                                    <div className="text-slate-500">Cobrado por: {a.cobrador} | Vía: {a.metodoPago}</div>
                                    {a.nota && <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><FileText className="h-3 w-3"/>{a.nota}</div>}
                                </div>
                                <span className="font-black text-emerald-600 text-sm">+ ${Number(a.monto).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Formulario Nuevo Abono */}
            {saldoActual > 0 && (
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                    <h4 className="text-sm font-bold text-emerald-800 mb-3">Registrar Nuevo Abono</h4>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <label className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">Monto ($)</label>
                            <Input type="number" step="0.01" max={saldoActual} value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" className="font-bold text-lg text-emerald-900 border-emerald-300" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">Método de Pago</label>
                            <select className="w-full border border-emerald-300 rounded-md px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500 h-10 font-medium text-emerald-800" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Transferencia">Transferencia</option>
                                <option value="Depósito">Depósito</option>
                                <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">Nota (Opcional)</label>
                            <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: Abono de la mitad pendiente..." className="border-emerald-300 text-sm" />
                        </div>
                    </div>
                    <Button onClick={handleSave} disabled={saving || !monto || Number(monto) <= 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Banknote className="h-4 w-4"/>} Guardar Abono
                    </Button>
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
};

export default AbonosModal;