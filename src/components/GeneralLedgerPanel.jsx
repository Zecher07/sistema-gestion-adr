import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Printer, Loader2, BookOpen, DollarSign, Building, TrendingDown, Filter, Users, Search, Plus, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

const FILTROS = ['TODOS', 'EFECTIVO', 'BANCOS / TRANSFERENCIAS', 'SOLO INGRESOS', 'SOLO EGRESOS'];

// --- FUNCIÓN DE COMPRESIÓN DE IMÁGENES ---
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

const GeneralLedgerPanel = ({ orders = [], user }) => {
  const { toast } = useToast();
  
  const toLocalDateStr = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date().toISOString()));
  const [valesDelDia, setValesDelDia] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estados de Filtros
  const [filtroActivo, setFiltroActivo] = useState('TODOS');
  const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
  const [filtroOrden, setFiltroOrden] = useState('');

  // 🔥 ESTADOS PARA CIERRE DIARIO 🔥
  const [cierreComprobantes, setCierreComprobantes] = useState([]);
  const [loadingCierre, setLoadingCierre] = useState(false);
  const [isProcessingCierre, setIsProcessingCierre] = useState(false);

  useEffect(() => {
    const fetchVales = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('vales_caja')
          .select('*')
          .eq('status', 'APROBADO')
          .eq('fecha', selectedDate); 
        
        if (error) throw error;
        setValesDelDia(data || []);
      } catch (error) {
        console.error("Error cargando vales:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVales();

    // 🔥 CARGAR FOTOS DE CIERRE DIARIO 🔥
    const fetchCierre = async () => {
        setLoadingCierre(true);
        try {
            const { data } = await supabase.from('cierres_diarios').select('comprobantes').eq('fecha', selectedDate).maybeSingle();
            if (data && Array.isArray(data.comprobantes)) setCierreComprobantes(data.comprobantes);
            else setCierreComprobantes([]);
        } catch(e) { setCierreComprobantes([]); }
        setLoadingCierre(false);
    };
    fetchCierre();
  }, [selectedDate]);

  // 🔥 LÓGICA DE SUBIDA DE CIERRE DIARIO 🔥
  const handleAddCierreDocs = async (files) => {
      setIsProcessingCierre(true);
      const newImages = [];
      for (const file of files) {
          if (file.size > 15000000) { toast({ title: "Archivo muy grande", variant: "destructive" }); continue; }
          try {
              const compressed = await compressImage(file);
              newImages.push(compressed);
          } catch (e) {}
      }
      const updated = [...cierreComprobantes, ...newImages];
      setCierreComprobantes(updated);
      
      try {
          await supabase.from('cierres_diarios').upsert({ fecha: selectedDate, comprobantes: updated, cerrador: user.name });
          toast({title: "Soporte de cierre guardado exitosamente."});
      } catch(e) { 
          toast({title: "Cierre Guardado Localmente", description: "Asegúrate de crear la tabla 'cierres_diarios' en Supabase para guardarlo en la nube.", variant: "warning"}); 
      }
      setIsProcessingCierre(false);
  };

  const removeCierreDoc = async (index) => {
      const updated = cierreComprobantes.filter((_, i) => i !== index);
      setCierreComprobantes(updated);
      try {
          await supabase.from('cierres_diarios').upsert({ fecha: selectedDate, comprobantes: updated, cerrador: user.name });
      } catch(e) {}
  };

  const onDropCierre = useCallback(acceptedFiles => { handleAddCierreDocs(acceptedFiles); }, [cierreComprobantes, selectedDate]);
  const { getRootProps: getRootPropsCierre, getInputProps: getInputPropsCierre } = useDropzone({ onDrop: onDropCierre, accept: {'image/*': []}, disabled: isProcessingCierre });

  const transactions = useMemo(() => {
    const txs = [];

    orders.forEach(o => {
      const createdDateStr = toLocalDateStr(o.createdAt || o.created_at);
      const updatedDateStr = toLocalDateStr(o.updatedAt || o.updated_at);
      const balanceDateStr = o.fecha_pago_saldo ? toLocalDateStr(o.fecha_pago_saldo) : updatedDateStr;

      const numOrden = formatOrderId(o);
      const cliente = o.cliente || o.cliente_nombre || 'Cliente General';
      const titulo = o.tipoLetrero || o.tipo_trabajo || 'Sin Título';

      // 1. ANTICIPOS (VENTAS)
      if (createdDateStr === selectedDate && Number(o.anticipo) > 0) {
        const metodo = o.formaPagoAnticipo || o.forma_pago_anticipo || 'Efectivo';
        txs.push({
          id: `ant-${o.id}`,
          tipo: 'VENTA',
          cliente, titulo, orden: numOrden,
          vendedor: o.recibido_por_anticipo || o.vendedor,
          metodo,
          ingreso: Number(o.anticipo), egreso: 0
        });
      }

      // 2. ABONOS
      (o.abonos || []).forEach(abono => {
        if (toLocalDateStr(abono.fecha) === selectedDate) {
          txs.push({
            id: `abo-${abono.id}`,
            tipo: 'ABONO',
            cliente, titulo, orden: numOrden,
            vendedor: abono.cobrador,
            metodo: abono.metodoPago || 'Efectivo',
            ingreso: Number(abono.monto), egreso: 0
          });
        }
      });

      // 3. SALDOS (RETIROS)
      const isRelevantStatus = ['FINALIZADA', 'VENTAS POR RETIRAR', 'ENTREGADO'].includes(o.status);
      const saldoCobrado = (Number(o.financials?.total) || 0) - (Number(o.anticipo) || 0) - (Number(o.retencion) || 0);
      const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
      const saldoFinalReal = saldoCobrado - totalAbonado;

      if (balanceDateStr === selectedDate && isRelevantStatus && saldoFinalReal > 0) {
        txs.push({
          id: `sal-${o.id}`,
          tipo: 'RETIRO',
          cliente, titulo, orden: numOrden,
          vendedor: o.recibido_por_saldo || o.vendedor,
          metodo: o.formaPagoSaldo || 'Efectivo',
          ingreso: saldoFinalReal, egreso: 0
        });
      }

      // 4. ANULACIONES
      if (o.status === 'ANULADA' && updatedDateStr === selectedDate && Number(o.anticipo) > 0) {
        txs.push({
          id: `anu-${o.id}`,
          tipo: 'ANULACIÓN',
          cliente, titulo, orden: numOrden,
          vendedor: o.recibido_por_anticipo || o.vendedor,
          metodo: o.formaPagoAnticipo || 'Efectivo',
          ingreso: 0, egreso: Number(o.anticipo)
        });
      }
    });

    // 5. VALES DE CAJA
    valesDelDia.forEach(vale => {
      txs.push({
        id: `val-${vale.id}`,
        tipo: 'VALE DE CAJA',
        cliente: 'USO INTERNO', titulo: vale.concepto, orden: 'VALE',
        vendedor: vale.vendedor,
        metodo: 'Efectivo', 
        ingreso: 0, egreso: Number(vale.monto)
      });
    });

    return txs.sort((a, b) => b.ingreso - a.ingreso);
  }, [orders, selectedDate, valesDelDia]);

  const vendedoresDisponibles = useMemo(() => {
      const vends = new Set(transactions.map(tx => tx.vendedor));
      return ['TODOS', ...Array.from(vends).filter(Boolean).sort()];
  }, [transactions]);

  const summary = useMemo(() => {
    let efectivo = 0;
    let bancos = 0;
    let egresos = 0;

    transactions.forEach(tx => {
      const isEfectivo = tx.metodo.toLowerCase().includes('efectivo');
      if (tx.ingreso > 0) {
        if (isEfectivo) efectivo += tx.ingreso;
        else bancos += tx.ingreso;
      }
      if (tx.egreso > 0) {
        egresos += tx.egreso;
      }
    });

    return { efectivo, bancos, totalIngresos: efectivo + bancos, egresos };
  }, [transactions]);

  const transaccionesFiltradas = useMemo(() => {
      let filtradas = transactions;

      if (filtroActivo === 'EFECTIVO') filtradas = filtradas.filter(tx => tx.metodo.toLowerCase().includes('efectivo'));
      else if (filtroActivo === 'BANCOS / TRANSFERENCIAS') filtradas = filtradas.filter(tx => !tx.metodo.toLowerCase().includes('efectivo') && tx.ingreso > 0);
      else if (filtroActivo === 'SOLO INGRESOS') filtradas = filtradas.filter(tx => tx.ingreso > 0);
      else if (filtroActivo === 'SOLO EGRESOS') filtradas = filtradas.filter(tx => tx.egreso > 0);

      if (filtroVendedor !== 'TODOS') {
          filtradas = filtradas.filter(tx => tx.vendedor === filtroVendedor);
      }

      if (filtroOrden.trim() !== '') {
          filtradas = filtradas.filter(tx => tx.orden.includes(filtroOrden.trim()));
      }

      return filtradas;
  }, [transactions, filtroActivo, filtroVendedor, filtroOrden]);

  const totalesTabla = useMemo(() => {
      return transaccionesFiltradas.reduce((acc, tx) => {
          acc.ingresos += tx.ingreso || 0;
          acc.egresos += tx.egreso || 0;
          return acc;
      }, { ingresos: 0, egresos: 0 });
  }, [transaccionesFiltradas]);

  function formatOrderId(order) {
    if (order === 'VALE') return 'VALE';
    const num = order.orderNumber || order.order_number || order.id || '';
    return String(num).padStart(7, '0');
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-10 print:hidden">
        
        {/* CABECERA */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
           <div>
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-indigo-600" /> Libro Diario General
              </h2>
              <p className="text-slate-500 text-sm">Resumen de ingresos y egresos de toda la empresa.</p>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                  <CalendarIcon className="h-4 w-4 text-slate-500" />
                  <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={e => setSelectedDate(e.target.value)} 
                    className="bg-transparent border-none outline-none text-sm font-bold text-slate-700" 
                  />
              </div>
              <Button variant="outline" onClick={() => window.print()} className="gap-2 border-slate-300 hover:bg-slate-50 text-slate-700">
                 <Printer className="h-4 w-4" /> Imprimir
              </Button>
           </div>
        </div>

        {/* TARJETAS DE RESUMEN GLOBAL */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="bg-white border-l-4 border-green-500 p-4 rounded-lg shadow-sm flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full"><DollarSign className="h-6 w-6 text-green-600" /></div>
              <div><p className="text-xs font-bold text-slate-500 uppercase">Ingresos en Efectivo</p><p className="text-2xl font-black text-slate-800">{formatCurrency(summary.efectivo)}</p></div>
           </div>
           <div className="bg-white border-l-4 border-blue-500 p-4 rounded-lg shadow-sm flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full"><Building className="h-6 w-6 text-blue-600" /></div>
              <div><p className="text-xs font-bold text-slate-500 uppercase">Transferencias / Bancos</p><p className="text-2xl font-black text-slate-800">{formatCurrency(summary.bancos)}</p></div>
           </div>
           <div className="bg-slate-800 border-l-4 border-indigo-500 p-4 rounded-lg shadow-sm flex items-center gap-4 text-white">
              <div><p className="text-xs font-bold text-slate-400 uppercase">TOTAL INGRESOS DÍA</p><p className="text-3xl font-black text-white">{formatCurrency(summary.totalIngresos)}</p></div>
           </div>
           <div className="bg-white border-l-4 border-red-500 p-4 rounded-lg shadow-sm flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-full"><TrendingDown className="h-6 w-6 text-red-600" /></div>
              <div><p className="text-xs font-bold text-slate-500 uppercase">Total Egresos</p><p className="text-2xl font-black text-slate-800">{formatCurrency(summary.egresos)}</p></div>
           </div>
        </div>

        {/* TABLA DE MOVIMIENTOS Y FILTROS MÚLTIPLES */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-4">
               <div className="flex flex-col md:flex-row justify-between gap-4">
                   <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                       <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                           <Filter className="h-4 w-4" /> Tipo:
                       </div>
                       <div className="flex flex-wrap gap-2">
                           {FILTROS.map(f => (
                               <Button 
                                   key={f} 
                                   variant={filtroActivo === f ? 'default' : 'outline'} 
                                   size="sm"
                                   className={cn("text-xs font-bold transition-all", filtroActivo === f ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 bg-white')}
                                   onClick={() => setFiltroActivo(f)}
                               >
                                   {f}
                               </Button>
                           ))}
                       </div>
                   </div>
                   <div className="flex items-center relative w-full md:w-auto">
                       <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
                       <input
                           type="text"
                           placeholder="Buscar Nº Orden..."
                           className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-sm w-full md:w-48 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                           value={filtroOrden}
                           onChange={e => setFiltroOrden(e.target.value)}
                       />
                   </div>
               </div>

               <div className="flex flex-col md:flex-row items-start md:items-center gap-3 border-t border-slate-200 pt-4">
                   <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                       <Users className="h-4 w-4" /> Vendedor:
                   </div>
                   <div className="flex flex-wrap gap-2">
                       {vendedoresDisponibles.map(v => (
                           <Button 
                               key={v} 
                               variant={filtroVendedor === v ? 'default' : 'outline'} 
                               size="sm"
                               className={cn("text-xs font-bold transition-all", filtroVendedor === v ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 bg-white')}
                               onClick={() => setFiltroVendedor(v)}
                           >
                               {v}
                           </Button>
                       ))}
                   </div>
               </div>
           </div>

           {loading ? (
               <div className="p-10 text-center text-slate-500 flex flex-col items-center"><Loader2 className="h-8 w-8 animate-spin mb-2"/> Cargando movimientos...</div>
           ) : (
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 text-xs uppercase">
                      <tr>
                          <th className="px-4 py-3 font-bold text-center w-12">#</th>
                          <th className="px-4 py-3 font-bold">Descripción del Movimiento</th>
                          <th className="px-4 py-3 font-bold text-center">Orden</th>
                          <th className="px-4 py-3 font-bold">Vendedor</th>
                          <th className="px-4 py-3 font-bold text-center">Método</th>
                          <th className="px-4 py-3 font-bold text-right text-green-700">Ingreso</th>
                          <th className="px-4 py-3 font-bold text-right text-red-700">Egreso</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {transaccionesFiltradas.length === 0 ? (
                          <tr><td colSpan="7" className="p-8 text-center text-slate-500">No hay movimientos que coincidan con los filtros.</td></tr>
                      ) : (
                          transaccionesFiltradas.map((tx, idx) => (
                              <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                  <td className="px-4 py-3">
                                      <div className="font-bold uppercase text-xs flex flex-wrap items-center gap-1">
                                          <span className={cn(
                                              tx.tipo === 'VENTA' ? 'text-blue-700' :
                                              tx.tipo === 'ABONO' ? 'text-emerald-700' :
                                              tx.tipo === 'RETIRO' ? 'text-orange-700' :
                                              tx.tipo === 'ANULACIÓN' ? 'text-red-600' :
                                              'text-purple-700'
                                          )}>
                                              {tx.tipo}
                                          </span>
                                          <span className="text-slate-400 mx-1">-</span>
                                          <span className="text-slate-800">{tx.cliente}</span>
                                          <span className="text-slate-400 mx-1">-</span>
                                          <span className="text-slate-600">{tx.titulo}</span>
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-center font-mono text-slate-600 font-medium">{tx.orden}</td>
                                  <td className="px-4 py-3 font-medium text-slate-700">{tx.vendedor}</td>
                                  <td className="px-4 py-3 text-center">
                                      <span className={cn("text-xs px-2 py-1 rounded-md font-medium", tx.metodo.toLowerCase().includes('efectivo') ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700")}>
                                          {tx.metodo.split('-')[0].trim()}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-green-600">{tx.ingreso > 0 ? formatCurrency(tx.ingreso) : '-'}</td>
                                  <td className="px-4 py-3 text-right font-bold text-red-600">{tx.egreso > 0 ? formatCurrency(tx.egreso) : '-'}</td>
                              </tr>
                          ))
                      )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                      <tr>
                          <td colSpan="5" className="px-4 py-3 text-right uppercase text-slate-600">Total Filtrado:</td>
                          <td className="px-4 py-3 text-right text-lg text-green-700">{formatCurrency(totalesTabla.ingresos)}</td>
                          <td className="px-4 py-3 text-right text-lg text-red-700">{formatCurrency(totalesTabla.egresos)}</td>
                      </tr>
                  </tfoot>
              </table>
           )}
        </div>

        {/* 🔥 SECCIÓN CIERRE DIARIO (FOTOS) 🔥 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6 p-6">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" /> Soportes de Cierre Diario
            </h3>
            <p className="text-sm text-slate-500 mb-4">Adjunta aquí los vouchers de tarjetas, papeletas de depósito o fotos del cierre de caja del día <strong>{selectedDate}</strong>.</p>
            
            <div className="border border-slate-300 p-4 rounded-md bg-slate-50">
                <div className="min-h-[100px] mb-4 flex flex-wrap gap-4">
                    {cierreComprobantes.map((img, i) => (
                       <div key={i} className="relative group w-24 h-24 border border-slate-300 bg-white rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => window.open(img.url, '_blank')}>
                          <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeCierreDoc(i); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"><X className="h-3 w-3" /></button>
                       </div>
                    ))}
                    {loadingCierre || isProcessingCierre ? (
                        <div className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50 rounded-md animate-pulse">
                            <Loader2 className="h-6 w-6 text-blue-500 animate-spin"/>
                        </div>
                    ) : cierreComprobantes.length === 0 && (
                        <div className="w-full flex flex-col items-center justify-center text-slate-400 text-xs py-4">
                           <FileText className="h-8 w-8 mb-2 opacity-50" />
                           <span>Sin soportes adjuntos en este día</span>
                        </div>
                    )}
                </div>
                <div>
                    <input {...getInputPropsCierre()} className="hidden" />
                    <label {...getRootPropsCierre()} className={`inline-flex items-center gap-2 ${isProcessingCierre ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'} text-white text-sm font-bold px-4 py-2 rounded-md transition-colors shadow-sm`}>
                        <Plus className="h-4 w-4" /> {isProcessingCierre ? 'Procesando...' : 'Subir Soporte (Foto)'}
                    </label>
                </div>
            </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. VISTA DE IMPRESIÓN (Visible SOLO al imprimir)                  */}
      {/* ================================================================= */}
      <div 
        className="hidden print:block print:absolute print:inset-0 print:w-full print:bg-white print:z-[9999]"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        <div className="w-full max-w-[900px] mx-auto p-8 font-sans text-black">
            
            <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="Logo" className="h-16 object-contain" />
                    <div>
                        <h1 className="text-xl font-black tracking-widest text-slate-800">ADRCOMPANY SAS</h1>
                        <p className="text-[11px] text-slate-600">AV. ZENON MACIAS 306 Y CALLE LA MERCED • PLAYAS</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-black uppercase tracking-widest text-slate-900 border-2 border-black px-4 py-1 inline-block bg-slate-100">
                        Libro Diario
                    </h2>
                    <p className="text-sm font-bold mt-2 capitalize">{displayDate}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Generado por: {user.name} el {new Date().toLocaleString('es-ES')}</p>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="border border-black rounded-lg p-3 text-center bg-gray-50">
                    <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">Ingresos Efectivo</div>
                    <div className="text-lg font-bold">{formatCurrency(summary.efectivo)}</div>
                </div>
                <div className="border border-black rounded-lg p-3 text-center bg-gray-50">
                    <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">Transf. / Bancos</div>
                    <div className="text-lg font-bold">{formatCurrency(summary.bancos)}</div>
                </div>
                <div className="border-2 border-black rounded-lg p-3 text-center bg-slate-200">
                    <div className="text-[10px] font-black text-slate-800 uppercase mb-1">TOTAL INGRESOS</div>
                    <div className="text-xl font-black">{formatCurrency(summary.totalIngresos)}</div>
                </div>
                <div className="border border-black rounded-lg p-3 text-center bg-gray-50">
                    <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">Total Egresos</div>
                    <div className="text-lg font-bold text-slate-800">{formatCurrency(summary.egresos)}</div>
                </div>
            </div>

            {(filtroActivo !== 'TODOS' || filtroVendedor !== 'TODOS' || filtroOrden.trim() !== '') && (
                <div className="mb-2 text-sm font-bold italic text-slate-700 bg-slate-100 p-2 rounded border border-slate-300">
                    * Filtros aplicados a esta impresión: 
                    <span className="ml-2">
                        {[
                            filtroActivo !== 'TODOS' ? `Tipo: ${filtroActivo}` : null,
                            filtroVendedor !== 'TODOS' ? `Vendedor: ${filtroVendedor}` : null,
                            filtroOrden.trim() !== '' ? `Orden: ${filtroOrden}` : null
                        ].filter(Boolean).join(' | ')}
                    </span>
                </div>
            )}

            <table className="w-full border-collapse border border-black text-xs mb-8">
                <thead>
                    <tr className="bg-gray-200 border-b border-black">
                        <th className="border-r border-black p-2 w-8 text-center">#</th>
                        <th className="border-r border-black p-2 text-left">DESCRIPCIÓN DEL MOVIMIENTO</th>
                        <th className="border-r border-black p-2 text-center">ORDEN</th>
                        <th className="border-r border-black p-2 text-left">VENDEDOR</th>
                        <th className="border-r border-black p-2 text-center">MÉTODO</th>
                        <th className="border-r border-black p-2 text-right w-20">INGRESO</th>
                        <th className="p-2 text-right w-20">EGRESO</th>
                    </tr>
                </thead>
                <tbody>
                    {transaccionesFiltradas.length === 0 ? (
                        <tr><td colSpan="7" className="p-4 text-center italic">No se registraron movimientos que coincidan.</td></tr>
                    ) : (
                        transaccionesFiltradas.map((tx, idx) => (
                            <tr key={tx.id} className="border-b border-black">
                                <td className="border-r border-black p-1.5 text-center">{idx + 1}</td>
                                
                                <td className="border-r border-black p-1.5 uppercase">
                                    <span className="font-bold">{tx.tipo}</span> - <span className="font-bold">{tx.cliente}</span> - <span>{tx.titulo}</span>
                                </td>
                                
                                <td className="border-r border-black p-1.5 text-center font-mono">{tx.orden}</td>
                                <td className="border-r border-black p-1.5">{tx.vendedor}</td>
                                <td className="border-r border-black p-1.5 text-center text-[10px] uppercase">
                                    {tx.metodo.split('-')[0].trim()}
                                </td>
                                <td className="border-r border-black p-1.5 text-right font-bold">
                                    {tx.ingreso > 0 ? formatCurrency(tx.ingreso) : ''}
                                </td>
                                <td className="p-1.5 text-right font-bold text-red-700">
                                    {tx.egreso > 0 ? formatCurrency(tx.egreso) : ''}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-200 border-t-2 border-black">
                        <td colSpan="5" className="border-r border-black p-2 text-right font-bold uppercase">Totales mostrados:</td>
                        <td className="border-r border-black p-2 text-right font-black">{formatCurrency(totalesTabla.ingresos)}</td>
                        <td className="p-2 text-right font-black text-red-700">{formatCurrency(totalesTabla.egresos)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
      </div>
    </>
  );
};

export default GeneralLedgerPanel;