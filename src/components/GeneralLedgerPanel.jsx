import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Printer, Loader2, BookOpen, DollarSign, Building, TrendingDown, Filter, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FILTROS = ['TODOS', 'EFECTIVO', 'BANCOS / TRANSFERENCIAS', 'SOLO INGRESOS', 'SOLO EGRESOS'];

const GeneralLedgerPanel = ({ orders = [], staffUsers = [], user }) => {
  const toLocalDateStr = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date().toISOString()));
  const [valesDelDia, setValesDelDia] = useState([]);
  const [rawClosings, setRawClosings] = useState([]);
  const [profilesList, setProfilesList] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Estados de Filtros
  const [filtroActivo, setFiltroActivo] = useState('TODOS');
  const [filtroVendedor, setFiltroVendedor] = useState('TODOS');
  const [filtroOrden, setFiltroOrden] = useState('');

  // 🔧 NUEVO: búsqueda global — a diferencia del filtro de abajo (que solo filtra
  // las transacciones del día actual), esto busca en TODAS las órdenes por número
  // o por nombre de cliente, sin importar la fecha, para poder saltar al día correcto.
  const globalSearchResults = useMemo(() => {
      const term = filtroOrden.trim().toLowerCase();
      if (term.length < 2) return [];
      return orders
          .filter(o => {
              const numOrden = String(o.orderNumber || o.order_number || o.id || '').toLowerCase();
              const cliente = String(o.cliente || o.cliente_nombre || '').toLowerCase();
              return numOrden.includes(term) || cliente.includes(term);
          })
          .map(o => ({
              id: o.id,
              numOrden: o.orderNumber || o.order_number || o.id,
              cliente: o.cliente || o.cliente_nombre,
              fecha: toLocalDateStr(o.created_at || o.createdAt),
          }))
          .filter(r => r.fecha) // descarta si no se pudo determinar la fecha
          .slice(0, 8); // no saturar la pantalla
  }, [orders, filtroOrden]);

  // 1. CARGA DE DATOS PRINCIPALES
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [valesRes, closingsRes, profRes] = await Promise.all([
          // 🔥 AQUÍ SE RESTRINGIÓ PARA QUE SOLO TRAIGA LOS APROBADOS 🔥
          supabase.from('vales_caja').select('*').eq('status', 'APROBADO').eq('fecha', selectedDate),
          supabase.from('daily_closings').select('*'),
          supabase.from('profiles').select('*') 
        ]);

        if (!valesRes.error) setValesDelDia(valesRes.data || []);
        if (!closingsRes.error) setRawClosings(closingsRes.data || []);
        if (!profRes.error) setProfilesList(profRes.data || []);

      } catch (error) {
        console.error("Error cargando datos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedDate]);

  // 2. CÁLCULO DE TRANSACCIONES DEL DÍA
  const transactions = useMemo(() => {
    const txs = [];

    orders.forEach(o => {
      const createdDateStr = toLocalDateStr(o.createdAt || o.created_at);
      const updatedDateStr = toLocalDateStr(o.updatedAt || o.updated_at);
      const balanceDateStr = o.fecha_pago_saldo ? toLocalDateStr(o.fecha_pago_saldo) : updatedDateStr;
      
      const oId = o.id || Math.random().toString(36).substring(7);
      const numOrden = formatOrderId(o);
      const cliente = o.cliente || o.cliente_nombre || 'Cliente General';
      const titulo = o.tipoLetrero || o.tipo_trabajo || 'Sin Título';

      // ANTICIPOS (VENTAS)
      if (createdDateStr === selectedDate && Number(o.anticipo) > 0) {
        txs.push({
          id: `ant-${oId}`,
          tipo: 'VENTA',
          cliente, titulo, orden: numOrden,
          vendedor: o.recibido_por_anticipo || o.vendedor || 'Sistema',
          vendedorId: o.recibido_por_anticipo_id || (o.vendedor_ids && o.vendedor_ids[0]) || null,
          metodo: o.formaPagoAnticipo || o.forma_pago_anticipo || 'Efectivo',
          ingreso: Number(o.anticipo), egreso: 0
        });
      }

      // ABONOS
      (o.abonos || []).forEach((abono, idx) => {
        if (toLocalDateStr(abono.fecha) === selectedDate) {
          txs.push({
            id: `abo-${oId}-${idx}`, 
            tipo: 'ABONO',
            cliente, titulo, orden: numOrden,
            vendedor: abono.cobrador || 'Sistema',
            vendedorId: abono.cobrador_id || null,
            metodo: abono.metodoPago || 'Efectivo',
            ingreso: Number(abono.monto), egreso: 0
          });
        }
      });

      // SALDOS (RETIROS)
      // 🔥 SOLUCIÓN AL DINERO FANTASMA: Quitamos 'VENTAS POR RETIRAR' 🔥
      const isRelevantStatus = ['FINALIZADA', 'ENTREGADO'].includes(o.status);
      const saldoCobrado = (Number(o.financials?.total) || 0) - (Number(o.anticipo) || 0) - (Number(o.retencion) || 0);
      const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
      const saldoFinalReal = saldoCobrado - totalAbonado;

      if (balanceDateStr === selectedDate && isRelevantStatus && saldoFinalReal > 0) {
        txs.push({
          id: `sal-${oId}`,
          tipo: 'RETIRO',
          cliente, titulo, orden: numOrden,
          vendedor: o.recibido_por_saldo || o.vendedor || 'Sistema',
          vendedorId: o.recibido_por_saldo_id || (o.vendedor_ids && o.vendedor_ids[0]) || null,
          metodo: o.formaPagoSaldo || 'Efectivo',
          ingreso: saldoFinalReal, egreso: 0
        });
      }

      // ANULACIONES
      if (o.status === 'ANULADA' && updatedDateStr === selectedDate && Number(o.anticipo) > 0) {
        txs.push({
          id: `anu-${oId}`,
          tipo: 'ANULACIÓN',
          cliente, titulo, orden: numOrden,
          vendedor: o.recibido_por_anticipo || o.vendedor || 'Sistema',
          vendedorId: o.recibido_por_anticipo_id || (o.vendedor_ids && o.vendedor_ids[0]) || null,
          metodo: o.formaPagoAnticipo || 'Efectivo',
          ingreso: 0, egreso: Number(o.anticipo)
        });
      }
    });

    // VALES DE CAJA (Solo llegarán los aprobados según la consulta)
    valesDelDia.forEach((vale, idx) => {
      txs.push({
        id: `val-${vale.id || idx}`,
        tipo: 'VALE DE CAJA',
        cliente: 'USO INTERNO', titulo: vale.concepto, orden: `VC-${String(vale.id).padStart(5, '0')}`,
        vendedor: vale.vendedor || 'Sistema',
        vendedorId: vale.vendedor_id || null,
        metodo: 'Efectivo', 
        ingreso: 0, egreso: Number(vale.monto)
      });
    });

    return txs.sort((a, b) => b.ingreso - a.ingreso);
  }, [orders, selectedDate, valesDelDia]);

  // 3. CÁLCULO MÁGICO DE CAJAS POR VENDEDOR (Inicio, Cierre, Entregado, Saldo Mañana)
  const cajasData = useMemo(() => {
    const filtrados = rawClosings.filter(c => c.date && c.date.split('T')[0] === selectedDate);
    
    const breakdown = filtrados.map(c => {
      const prof = profilesList.find(p => String(p.id) === String(c.user_id)) || staffUsers?.find(p => String(p.id) === String(c.user_id));
      const nombreReal = prof ? (prof.full_name || prof.name || prof.nombre || prof.email) : null;
      const vendedorName = nombreReal || `Usuario #${String(c.user_id).substring(0,5)}`;

      const inicial = Number(c.opening_cash || 0);
      const entregado = Number(c.amount_to_accounting || 0);

      // Calculamos cuánto sumó o restó EN EFECTIVO este vendedor durante el día
      // 🔧 REFACTOR: agrupamos por id (c.user_id) primero, que es inmune a cambios de
      // nombre. Solo caemos al nombre normalizado para transacciones viejas sin vendedorId.
      const normalize = (s) => (s || '').toLowerCase().trim();
      const txsVendedor = transactions.filter(tx => 
          tx.vendedorId ? tx.vendedorId === c.user_id : normalize(tx.vendedor) === normalize(vendedorName)
      ).filter(tx => tx.metodo.toLowerCase().includes('efectivo'));

      let ingresosEfectivo = 0;
      let egresosEfectivo = 0;
      txsVendedor.forEach(tx => {
          ingresosEfectivo += tx.ingreso;
          egresosEfectivo += tx.egreso;
      });

      // El Cierre Físico es: Con cuánto empezó + Lo que cobró - Lo que salió (vales aprobados)
      const cierreCalculado = inicial + ingresosEfectivo - egresosEfectivo;
      
      // Saldo que queda físicamente en caja para mañana
      const saldoManana = cierreCalculado - entregado;

      return {
        vendedor: vendedorName,
        inicial: inicial,
        cierre: cierreCalculado,
        entregado: entregado,
        saldoManana: saldoManana
      };
    });

    const inicialTotal = breakdown.reduce((sum, b) => sum + b.inicial, 0);
    const cierreTotal = breakdown.reduce((sum, b) => sum + b.cierre, 0);
    const entregadoTotal = breakdown.reduce((sum, b) => sum + b.entregado, 0);
    const saldoMananaTotal = breakdown.reduce((sum, b) => sum + b.saldoManana, 0);

    return { breakdown, inicialTotal, cierreTotal, entregadoTotal, saldoMananaTotal };
  }, [rawClosings, selectedDate, staffUsers, profilesList, transactions]);

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
          const term = filtroOrden.trim().toLowerCase();
          filtradas = filtradas.filter(tx => 
              tx.orden.toLowerCase().includes(term) || 
              (tx.cliente || '').toLowerCase().includes(term)
          );
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

  const handlePrint = () => {
     setTimeout(() => { window.print(); }, 100);
  };

  return (
    <>
      {/* ================================================================= */}
      {/* 1. VISTA EN PANTALLA (Oculta al imprimir)                         */}
      {/* ================================================================= */}
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
              <Button variant="outline" onClick={handlePrint} className="gap-2 border-slate-300 hover:bg-slate-50 text-slate-700">
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
                           placeholder="Buscar Nº Orden o Cliente (en todos los días)..."
                           className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-md text-sm w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                           value={filtroOrden}
                           onChange={e => setFiltroOrden(e.target.value)}
                       />
                       {/* 🔧 NUEVO: resultados de la búsqueda global, con la fecha real de cada orden */}
                       {globalSearchResults.length > 0 && (
                           <div className="absolute top-full left-0 mt-1 w-full md:w-80 bg-white border border-slate-200 rounded-md shadow-lg z-20 overflow-hidden max-h-64 overflow-y-auto">
                               {globalSearchResults.map(r => (
                                   <button
                                       key={r.id}
                                       onClick={() => { setSelectedDate(r.fecha); setFiltroOrden(''); }}
                                       className={cn(
                                           "w-full text-left px-3 py-2 text-xs border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors flex justify-between items-center",
                                           r.fecha === selectedDate ? "bg-blue-50/50" : ""
                                       )}
                                   >
                                       <span className="font-bold text-slate-700">#{String(r.numOrden).padStart(5, '0')} — {r.cliente}</span>
                                       <span className={cn("font-mono ml-2 shrink-0", r.fecha === selectedDate ? "text-blue-600 font-bold" : "text-slate-400")}>
                                           {r.fecha === selectedDate ? "Hoy en vista" : r.fecha}
                                       </span>
                                   </button>
                               ))}
                           </div>
                       )}
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
                          <th className="px-4 py-3 text-center w-12">#</th>
                          <th className="px-4 py-3 font-bold">Descripción del Movimiento</th>
                          <th className="px-4 py-3 text-center">Orden</th>
                          <th className="px-4 py-3 font-bold">Vendedor</th>
                          <th className="px-4 py-3 text-center">Método</th>
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

        {/* 🔥 TABLAS RESUMEN CONDESADAS AL FINAL EN PANTALLA 🔥 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
            <div className="xl:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
                <h3 className="text-base font-bold text-slate-700 uppercase tracking-wider mb-4 border-b pb-2">Resumen de Flujos del Día</h3>
                <table className="w-full text-sm text-left border-collapse border border-slate-200">
                    <tbody className="divide-y divide-slate-200">
                        <tr><td className="p-3 font-medium text-slate-700">Ingresos Efectivo (Caja)</td><td className="p-3 text-right font-bold text-green-700">{formatCurrency(summary.efectivo)}</td></tr>
                        <tr><td className="p-3 font-medium text-slate-700">Bancos (Transferencias)</td><td className="p-3 text-right font-bold text-blue-700">{formatCurrency(summary.bancos)}</td></tr>
                        <tr className="bg-slate-50 font-bold"><td className="p-3 uppercase text-slate-800">Total Ingresos Día</td><td className="p-3 text-right font-black text-slate-900">{formatCurrency(summary.totalIngresos)}</td></tr>
                        <tr><td className="p-3 font-medium text-slate-700">Egresos Totales (Vales)</td><td className="p-3 text-right font-bold text-red-600">-{formatCurrency(summary.egresos)}</td></tr>
                    </tbody>
                </table>
            </div>

            {/* 🔥 NUEVA TABLA: ARQUEO DE CAJAS POR VENDEDOR CON SALDO MAÑANA 🔥 */}
            <div className="xl:col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-x-auto">
                <h3 className="text-base font-bold text-slate-700 uppercase tracking-wider mb-4 border-b pb-2">Arqueo Individual de Cajas</h3>
                <table className="w-full text-sm text-left border-collapse border border-slate-200 min-w-[600px]">
                    <thead className="bg-slate-800 text-white font-bold text-xs uppercase">
                        <tr>
                            <th className="p-3 border-r border-slate-700">Vendedor / Usuario</th>
                            <th className="p-3 text-right border-r border-slate-700 w-28">Caja Inicio</th>
                            <th className="p-3 text-right border-r border-slate-700 w-28">Caja Cierre</th>
                            <th className="p-3 text-right border-r border-slate-700 w-32">Entregado Contab.</th>
                            <th className="p-3 text-right w-32">Saldo Mañana</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {cajasData.breakdown.map((cv, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-bold text-slate-800 uppercase">{cv.vendedor}</td>
                                <td className="p-3 text-right font-mono text-slate-500 font-bold">{formatCurrency(cv.inicial)}</td>
                                <td className="p-3 text-right font-mono text-indigo-600 font-bold">{formatCurrency(cv.cierre)}</td>
                                <td className="p-3 text-right font-mono text-emerald-600 font-black">{formatCurrency(cv.entregado)}</td>
                                <td className="p-3 text-right font-mono text-orange-600 font-black">{formatCurrency(cv.saldoManana)}</td>
                            </tr>
                        ))}
                        {cajasData.breakdown.length === 0 && (
                            <tr><td colSpan="5" className="p-4 text-center text-slate-400 italic">No hay cierres de caja registrados hoy.</td></tr>
                        )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
                        <tr>
                            <td className="p-3 uppercase text-slate-700 font-black">TOTALES CONSOLIDADOS:</td>
                            <td className="p-3 text-right font-mono text-slate-700 font-black text-sm">{formatCurrency(cajasData.inicialTotal)}</td>
                            <td className="p-3 text-right font-mono text-indigo-900 font-black text-sm">{formatCurrency(cajasData.cierreTotal)}</td>
                            <td className="p-3 text-right font-mono text-emerald-800 font-black text-sm">{formatCurrency(cajasData.entregadoTotal)}</td>
                            <td className="p-3 text-right font-mono text-orange-800 font-black text-sm">{formatCurrency(cajasData.saldoMananaTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. VISTA DE IMPRESIÓN (Visible SOLO al mandar a imprimir)        */}
      {/* ================================================================= */}
      <div 
        className="hidden print:block print:absolute print:inset-0 print:w-full print:bg-white print:z-[9999]"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
      >
        <div className="w-full max-w-[900px] mx-auto p-8 font-sans text-black">
            
            {/* CABECERA IMPRESIÓN */}
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

            {/* FILTROS APLICADOS */}
            {(filtroActivo !== 'TODOS' || filtroVendedor !== 'TODOS' || filtroOrden.trim() !== '') && (
                <div className="mb-4 text-xs font-bold italic text-slate-700 bg-slate-100 p-2 rounded border border-slate-300">
                    * Filtros aplicados a esta impresión: 
                    <span className="ml-2 font-normal">
                        {[
                            filtroActivo !== 'TODOS' ? `Tipo: ${filtroActivo}` : null,
                            filtroVendedor !== 'TODOS' ? `Vendedor: ${filtroVendedor}` : null,
                            filtroOrden.trim() !== '' ? `Orden: ${filtroOrden}` : null
                        ].filter(Boolean).join(' | ')}
                    </span>
                </div>
            )}

            {/* TABLA PRINCIPAL DE TRANSACCIONES EN EL PDF */}
            <table className="w-full border-collapse border border-black text-[11px] mb-8">
                <thead>
                    <tr className="bg-gray-200 border-b border-black font-bold">
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
                        <tr><td colSpan="7" className="p-4 text-center italic">No se encontraron movimientos registrados.</td></tr>
                    ) : (
                        transaccionesFiltradas.map((tx, idx) => (
                            <tr key={tx.id} className="border-b border-black">
                                <td className="border-r border-black p-1.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                <td className="border-r border-black p-1.5 uppercase font-medium">
                                    <span className="font-bold">{tx.tipo}</span> - <span>{tx.cliente}</span> - <span className="text-slate-600 font-normal">{tx.titulo}</span>
                                </td>
                                <td className="border-r border-black p-1.5 text-center font-mono">{tx.orden}</td>
                                <td className="border-r border-black p-1.5 font-medium">{tx.vendedor}</td>
                                <td className="border-r border-black p-1.5 text-center uppercase text-[9px]">{tx.metodo.split('-')[0].trim()}</td>
                                <td className="border-r border-black p-1.5 text-right font-bold text-green-700">{tx.ingreso > 0 ? formatCurrency(tx.ingreso) : ''}</td>
                                <td className="p-1.5 text-right font-bold text-red-700">{tx.egreso > 0 ? formatCurrency(tx.egreso) : ''}</td>
                            </tr>
                        ))
                    )}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 border-t-2 border-black font-bold">
                        <td colSpan="5" className="border-r border-black p-2 text-right uppercase text-slate-700">Totales de la Tabla:</td>
                        <td className="border-r border-black p-2 text-right text-green-800 font-black">{formatCurrency(totalesTabla.ingresos)}</td>
                        <td className="p-2 text-right text-red-800 font-black">{formatCurrency(totalesTabla.egresos)}</td>
                    </tr>
                </tfoot>
            </table>

            {/* 🔥 NUEVAS TABLAS CONSOLIDADAS AL FINAL DEL PDF CON SALDO MAÑANA 🔥 */}
            <div className="grid grid-cols-[1fr_2fr] gap-4 mt-8" style={{ pageBreakInside: 'avoid' }}>
                
                {/* SUBTABLA 1: Resumen de flujos */}
                <div>
                    <h3 className="text-[11px] font-black uppercase tracking-wider mb-2 border-b border-black pb-1">Resumen Económico</h3>
                    <table className="w-full border-collapse border border-black text-[10px]">
                        <tbody>
                            <tr className="border-b border-black"><td>Efectivo Neto Recibido</td><td className="text-right font-bold text-green-700">{formatCurrency(summary.efectivo)}</td></tr>
                            <tr className="border-b border-black"><td>Transferencias Bancarias</td><td className="text-right font-bold text-blue-700">{formatCurrency(summary.bancos)}</td></tr>
                            <tr className="border-b border-black bg-gray-100 font-bold"><td>TOTAL INGRESOS BRUTOS</td><td className="text-right font-black">{formatCurrency(summary.totalIngresos)}</td></tr>
                            <tr><td>Egresos Totales (Vales)</td><td className="text-right font-bold text-red-600">-{formatCurrency(summary.egresos)}</td></tr>
                        </tbody>
                    </table>
                </div>

                {/* SUBTABLA 2: Arqueo individual por cada vendedor */}
                <div>
                    <h3 className="text-[11px] font-black uppercase tracking-wider mb-2 border-b border-black pb-1">Arqueo de Cajas por Vendedor</h3>
                    <table className="w-full border-collapse border border-black text-[10px]">
                        <thead>
                            <tr className="bg-gray-100 border-b border-black font-bold text-slate-700">
                                <th className="p-1.5 border-r border-black text-left">Vendedor</th>
                                <th className="p-1.5 border-r border-black text-right w-16">Inicio</th>
                                <th className="p-1.5 border-r border-black text-right w-16">Cierre</th>
                                <th className="p-1.5 border-r border-black text-right w-20">Entregado</th>
                                <th className="p-1.5 text-right w-20">Para Mañana</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cajasData.breakdown.map((cv, idx) => (
                                <tr key={`print-row-${idx}`} className="border-b border-black uppercase font-medium">
                                    <td className="p-1.5 border-r border-black font-bold">{cv.vendedor}</td>
                                    <td className="p-1.5 border-r border-black text-right font-mono text-slate-600">{formatCurrency(cv.inicial)}</td>
                                    <td className="p-1.5 border-r border-black text-right font-mono text-slate-800 font-bold">{formatCurrency(cv.cierre)}</td>
                                    <td className="p-1.5 border-r border-black text-right font-mono text-emerald-800 font-bold">{formatCurrency(cv.entregado)}</td>
                                    <td className="p-1.5 text-right font-mono text-orange-800 font-bold">{formatCurrency(cv.saldoManana)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-200 font-bold">
                            <tr>
                                <td className="p-1.5 border-r border-black uppercase">TOTALES:</td>
                                <td className="p-1.5 border-r border-black text-right font-mono">{formatCurrency(cajasData.inicialTotal)}</td>
                                <td className="p-1.5 border-r border-black text-right font-mono">{formatCurrency(cajasData.cierreTotal)}</td>
                                <td className="p-1.5 border-r border-black text-right font-mono">{formatCurrency(cajasData.entregadoTotal)}</td>
                                <td className="p-1.5 text-right font-mono">{formatCurrency(cajasData.saldoMananaTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

            </div>

            {/* PIE DE PÁGINA IMPRESIÓN */}
            <div className="mt-12 text-center text-[9px] text-slate-400 italic">
                * Documento contable interno generado desde el Libro Diario de Cykes AdR.
            </div>

        </div>
      </div>
    </>
  );
};

export default GeneralLedgerPanel;