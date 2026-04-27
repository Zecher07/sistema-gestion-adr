import React, { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { X, Save, DollarSign, Calendar, FileText, CreditCard, Loader2, Image as ImageIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useDropzone } from 'react-dropzone';

// 🔥 Métodos de pago (con Tarjeta y Cheque) 🔥
const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Depósito', 'Tarjeta', 'Cheque'];

// Función para comprimir imágenes antes de subirlas a la base de datos
const compressImage = async (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve({ name: file.name, url: dataUrl });
            };
        };
    });
};

const AbonosModal = ({ order, user, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [comprobantesFiles, setComprobantesFiles] = useState([]);
  const [isProcessingComprobantes, setIsProcessingComprobantes] = useState(false);
  
  const [formData, setFormData] = useState({
    monto: '',
    metodoPago: 'Transferencia', // Por defecto Transferencia para que muestre adjuntar
    referencia: '',
    nota: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const total = Number(order.financials?.total) || 0;
  const anticipo = Number(order.anticipo) || 0;
  const retencion = Number(order.retencion) || 0;
  const abonosPrevios = (order.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
  const saldoActual = Math.max(total - anticipo - retencion - abonosPrevios, 0);

  const requiresComprobante = (method) => {
      if (!method) return false;
      const m = method.toLowerCase();
      // Solo pide foto si NO es efectivo, ni tarjeta, ni "no aplica"
      return !m.includes('efectivo') && !m.includes('no aplica') && !m.includes('tarjeta');
  };

  const needsPhoto = requiresComprobante(formData.metodoPago);

  // 🔥 CONFIGURACIÓN PARA ARRASTRAR O SELECCIONAR FOTO 🔥
  const onDrop = useCallback(async (acceptedFiles) => {
      setIsProcessingComprobantes(true);
      const newImages = [];
      for (const file of acceptedFiles) {
          if (file.size > 15000000) { toast({ title: "Archivo muy grande", variant: "destructive" }); continue; }
          try {
              const compressed = await compressImage(file);
              newImages.push(compressed);
          } catch (e) { toast({ title: "Error al procesar", variant: "destructive" }); }
      }
      setComprobantesFiles(prev => [...prev, ...newImages]);
      setIsProcessingComprobantes(false);
  }, [toast]);
  
  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: {'image/*': []} });

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

    if (needsPhoto && comprobantesFiles.length === 0) {
        toast({ title: "Comprobante Requerido", description: "Debe adjuntar la foto del comprobante para este método de pago.", variant: "destructive" });
        return;
    }

    setLoading(true);
    try {
        let metodoFinal = formData.metodoPago;
        if (needsPhoto && formData.referencia.trim()) {
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

        // 1. Obtenemos la orden FRESCA de la base de datos para no borrar otros comprobantes
        const { data: dbOrder, error: fetchError } = await supabase.from('ordenes').select('comprobantes, abonos, financials').eq('id', order.id).single();
        if (fetchError) throw fetchError;

        const abonosActualizados = [...(dbOrder.abonos || []), nuevoAbono];
        const nuevoSaldoReal = Math.max(total - anticipo - retencion - abonosActualizados.reduce((acc, a) => acc + Number(a.monto), 0), 0);

        // 2. Preparamos el formato exacto para los comprobantes
        let currentComprobantes = dbOrder.comprobantes || { anticipo: [], saldo: [], abonos: {} };
        if (Array.isArray(currentComprobantes)) {
            currentComprobantes = { anticipo: currentComprobantes, saldo: [], abonos: {} };
        }
        if (!currentComprobantes.abonos) currentComprobantes.abonos = {};

        // 3. Si subieron la foto, la guardamos vinculada al índice de este nuevo abono
        if (comprobantesFiles.length > 0) {
            currentComprobantes.abonos[abonosActualizados.length - 1] = comprobantesFiles;
        }

        // 4. Subimos todo a la base de datos
        const { error } = await supabase.from('ordenes').update({ 
            abonos: abonosActualizados,
            financials: { ...dbOrder.financials, saldo: nuevoSaldoReal },
            comprobantes: currentComprobantes
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
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

            {needsPhoto && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                    <label className="text-xs font-bold text-blue-600 uppercase">N° Referencia / Lote</label>
                    <input type="text" className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={formData.referencia} onChange={e => setFormData({...formData, referencia: e.target.value})} placeholder="Opcional..." />
                </div>
            )}

            {/* 🔥 SECCIÓN DE COMPROBANTE CONDICIONAL 🔥 */}
            {needsPhoto && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                    <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                        <ImageIcon className="h-3 w-3"/> Comprobante (Obligatorio)
                    </label>
                    <div className="border border-slate-300 p-2 rounded-md bg-slate-50 flex flex-wrap gap-2 items-center">
                        {comprobantesFiles.map((img, i) => (
                            <div key={i} className="relative group w-12 h-12 border border-slate-300 bg-white rounded overflow-hidden shadow-sm">
                                <img src={img.url} className="w-full h-full object-cover" alt="Comprobante" />
                                <button type="button" onClick={() => setComprobantesFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                        
                        {isProcessingComprobantes && <Loader2 className="w-4 h-4 animate-spin text-blue-500 mx-2" />}
                        
                        {!isProcessingComprobantes && (
                            <div {...getRootProps()} className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded px-2 flex items-center justify-center gap-1 text-[10px] font-bold border border-emerald-200 transition-colors h-12 shadow-sm">
                                <input {...getInputProps()} />
                                <Plus className="w-3 h-3" /> {comprobantesFiles.length === 0 ? 'Adjuntar' : 'Añadir'}
                            </div>
                        )}
                    </div>
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