import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { X, Save, DollarSign, Calendar, FileText, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// 🔥 Métodos de pago actualizados (Tarjeta unificada, Cheque agregado) 🔥
const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Depósito', 'Tarjeta', 'Cheque'];

const AbonosModal = ({ order, user, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    monto: '',
    metodoPago: 'Efectivo',
    referencia: '',
    nota: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const total = Number(order.financials?.total) || 0;
  const anticipo = Number(order.anticipo) || 0;
  const retencion = Number(order.retencion) || 0;
  const abonosPrevios = (order.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
  const saldoActual = Math.max(total - anticipo - retencion - abonosPrevios, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const montoNum = parseFloat(formData.monto);
    
    if (isNaN(montoNum) || montoNum <= 0) {
        toast({ title: "Monto inválido", variant: "destructive" });
        return;
    }
    if (montoNum > saldoActual + 0.05) {
        toast({ title: "Monto excede el saldo", description: `El saldo máximo a cobrar es $${saldoActual.toFixed(2)}`, variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
        let metodoFinal = formData.metodoPago;
        if (formData.metodoPago !== 'Efectivo' && formData.referencia.trim()) {
            metodoFinal = `${formData.metodoPago} - Ref: ${formData.referencia}`;
        }

        const nuevoAbono = {
            id: Date.now(),
            monto: montoNum,
            metodoPago: metodoFinal,
            fecha: `${formData.fecha}T12:00:00`,
            nota: formData.nota,
            cobrador: user.name
        };

        const abonosActualizados = [...(order.abonos || []), nuevoAbono];
        const nuevoSaldoReal = Math.max(total - anticipo - retencion - abonosActualizados.reduce((acc, a) => acc + Number(a.monto), 0), 0);

        // Actualizamos en base de datos
        const { error } = await supabase.from('ordenes').update({ 
            abonos: abonosActualizados,
            financials: { ...order.financials, saldo: nuevoSaldoReal }
        }).eq('id', order.id);

        if (error) throw error;

        toast({ title: "Abono Registrado", description: "Se ha descontado del saldo pendiente correctamente." });
        if(onSuccess) onSuccess();
        onClose();
    } catch (error) {
        toast({ title: "Error al registrar", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="bg-green-600 text-white px-6 py-4 flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6"/> Registrar Cobro / Abono</h2>
            <button onClick={onClose} className="hover:bg-green-700 p-1 rounded-full transition-colors"><X className="h-5 w-5"/></button>
        </div>

        <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
                <div className="text-sm font-bold text-slate-500 uppercase">Orden #{order.orderNumber || order.order_number || order.id}</div>
                <div className="font-bold text-slate-800 uppercase">{order.cliente || order.cliente_nombre}</div>
            </div>
            <div className="text-right">
                <div className="text-xs font-bold text-slate-500 uppercase">Saldo Pendiente</div>
                <div className="text-2xl font-black text-red-600">${saldoActual.toFixed(2)}</div>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><DollarSign className="h-3 w-3"/> Monto a Cobrar</label>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 font-bold text-slate-400">$</span>
                        <input type="number" step="0.01" min="0.01" max={saldoActual.toFixed(2)} required autoFocus className="w-full pl-7 pr-3 py-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 outline-none font-bold text-green-700 bg-green-50 text-lg" value={formData.monto} onChange={e => setFormData({...formData, monto: e.target.value})} placeholder="0.00" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><Calendar className="h-3 w-3"/> Fecha</label>
                    <input type="date" required className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><CreditCard className="h-3 w-3"/> Método de Pago</label>
                <select className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white font-medium" value={formData.metodoPago} onChange={e => setFormData({...formData, metodoPago: e.target.value})}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            {formData.metodoPago !== 'Efectivo' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                    <label className="text-xs font-bold text-blue-600 uppercase">N° Referencia / Lote</label>
                    <input type="text" className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={formData.referencia} onChange={e => setFormData({...formData, referencia: e.target.value})} placeholder="Opcional..." />
                </div>
            )}

            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1"><FileText className="h-3 w-3"/> Nota / Observación</label>
                <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={formData.nota} onChange={e => setFormData({...formData, nota: e.target.value})} placeholder="Ej: Pago realizado en taller..." />
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading || !formData.monto} className="bg-green-600 hover:bg-green-700 text-white font-bold gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>} Guardar Cobro
                </Button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AbonosModal;