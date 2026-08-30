import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, Filter, Download, FileSpreadsheet, Users, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../supabaseClient';
import { isUserInList } from '@/utils/userMatch';

const StatisticsCharts = ({
  orders = []
}) => {
  // 🔧 NUEVO: como las comisiones se pagan por mes, la pantalla ahora arranca
  // mostrando el MES ACTUAL completo por defecto, en vez de estar vacía y
  // obligarte a armar el rango de fechas a mano cada vez.
  const getRangoDelMes = (fechaBase) => {
      const anio = fechaBase.getFullYear();
      const mes = fechaBase.getMonth();
      const primerDia = new Date(anio, mes, 1);
      const ultimoDia = new Date(anio, mes + 1, 0);
      const formatear = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { start: formatear(primerDia), end: formatear(ultimoDia) };
  };

  const [dateRange, setDateRange] = useState(() => getRangoDelMes(new Date()));
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Al elegir un mes del selector, arma el rango de fechas de ese mes completo
  const handleCambiarMes = (valorMes) => {
      setMesSeleccionado(valorMes);
      const [anio, mes] = valorMes.split('-').map(Number);
      setDateRange(getRangoDelMes(new Date(anio, mes - 1, 1)));
  };

  // 🔧 NUEVO: filtro por vendedor específico (para cuadrar comisiones)
  const [vendedorFilterId, setVendedorFilterId] = useState('');
  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
      const fetchStaff = async () => {
          const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'Vendedor').order('full_name');
          if (data) setStaffList(data);
      };
      fetchStaff();
  }, []);

  // --- Filter Logic for KPI Cards (General stats respecting date) ---
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 🔧 FIX: el campo real es 'created_at' (snake_case), no 'createdAt' — por eso
      // el filtro de fechas nunca filtraba nada (comparaba contra una fecha inválida).
      const fechaCreacion = o.created_at || o.createdAt;
      if (dateRange.start) {
        if (new Date(fechaCreacion) < new Date(dateRange.start + 'T00:00:00')) return false;
      }
      if (dateRange.end) {
        if (new Date(fechaCreacion) > new Date(dateRange.end + 'T23:59:59')) return false;
      }
      // 🔧 NUEVO: filtro por vendedor específico
      if (vendedorFilterId) {
        const selectedUser = staffList.find(u => u.id === vendedorFilterId);
        if (!isUserInList(o.vendedor_ids, o.vendedor, { id: vendedorFilterId, name: selectedUser?.full_name })) return false;
      }
      return true;
    });
  }, [orders, dateRange, vendedorFilterId, staffList]);

  // 🔧 FIX PRINCIPAL: "Finalizadas" siempre daba $0 al filtrar un rango corto
  // (como "hoy"), porque antes exigía que la orden se hubiera CREADO dentro del
  // rango Y ya estuviera finalizada — pero una orden creada hoy nunca puede
  // estar finalizada hoy mismo (toma días pasar por producción). Ahora se
  // calcula por separado: cuenta según la fecha en que la orden SE FINALIZÓ
  // (se entregó y se cobró), sin importar cuándo se creó originalmente.
  const ordenesFinalizadasEnRango = useMemo(() => {
    return orders.filter(o => {
      // 🔧 FIX: una orden ARCHIVADA ya pasó por FINALIZADA antes de archivarse —
      // sigue siendo una venta cerrada de verdad, no debe desaparecer del conteo
      // solo porque después se guardó/archivó.
      if (o.status !== 'FINALIZADA' && o.status !== 'ARCHIVADA') return false;
      const fechaFinal = o.fecha_pago_saldo || o.updated_at || o.updatedAt;
      if (!fechaFinal) return false;
      if (dateRange.start && new Date(fechaFinal) < new Date(dateRange.start + 'T00:00:00')) return false;
      if (dateRange.end && new Date(fechaFinal) > new Date(dateRange.end + 'T23:59:59')) return false;
      if (vendedorFilterId) {
        const selectedUser = staffList.find(u => u.id === vendedorFilterId);
        if (!isUserInList(o.vendedor_ids, o.vendedor, { id: vendedorFilterId, name: selectedUser?.full_name })) return false;
      }
      return true;
    });
  }, [orders, dateRange, vendedorFilterId, staffList]);

  // --- KPI Metrics (General Counts) ---
  const metrics = useMemo(() => {
    const total = filteredOrders.length;
    const finalizedMonth = ordenesFinalizadasEnRango.length; // 🔧 FIX: ahora sí respeta el rango elegido, no el mes actual fijo
    const archived = filteredOrders.filter(o => o.status === 'ARCHIVADA').length;

    // Tiempo promedio: se calcula sobre las órdenes que se FINALIZARON en el
    // rango (no las creadas en el rango), para que coincida con "Finalizadas"
    let avgDays = 0;
    if (ordenesFinalizadasEnRango.length > 0) {
      const totalDays = ordenesFinalizadasEnRango.reduce((acc, curr) => {
        const start = new Date(curr.created_at || curr.createdAt);
        const end = new Date(curr.fecha_pago_saldo || curr.updated_at || curr.updatedAt);
        const diff = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        return acc + diff;
      }, 0);
      avgDays = (totalDays / ordenesFinalizadasEnRango.length).toFixed(1);
    }
    return {
      total,
      finalizedMonth,
      archived,
      avgDays
    };
  }, [filteredOrders, ordenesFinalizadasEnRango]);

  // --- Commissions Data Logic (Amounts) ---
  // 🔧 FIX: antes agrupaba por 'order.vendedor' (el nombre, tal cual estaba guardado
  // en cada orden) — esto se rompe si alguien cambió de nombre, y además podía incluir
  // roles que no son Vendedor. Ahora agrupa por id, usando la lista real de Vendedores,
  // y agrega la cantidad de órdenes (lo que pediste para cuadrar comisiones).
  const commissionsData = useMemo(() => {
    const stats = {};
    staffList.forEach(u => {
        stats[u.id] = { id: u.id, name: u.full_name, totalSales: 0, finalizedSales: 0, finalizedDelPeriodo: 0, finalizedDeAntes: 0, orderCount: 0 };
    });

    // Ventas Totales y N° de Órdenes: según la fecha de CREACIÓN de la orden
    filteredOrders.forEach(order => {
      const amount = parseFloat(order.financials?.total || 0);
      const idsDeEstaOrden = Array.isArray(order.vendedor_ids) && order.vendedor_ids.length > 0
          ? order.vendedor_ids
          : []; // si la orden no tiene ids (muy vieja, sin migrar), no se cuenta aquí

      idsDeEstaOrden.forEach(vendedorId => {
          if (!stats[vendedorId]) return; // no es un Vendedor activo (ya no está, o cambió de rol)
          stats[vendedorId].totalSales += amount;
          stats[vendedorId].orderCount += 1;
      });
    });

    // 🔧 FIX: Ventas Finalizadas se suman aparte, según la fecha en que cada
    // orden se FINALIZÓ — así una orden creada hace una semana pero cerrada
    // hoy sí cuenta como finalizada de hoy, aunque no haya sido "creada hoy".
    // 🔧 NUEVO: además se separa cuánto de eso viene de órdenes CREADAS en el
    // mismo período (normal) vs. órdenes que venían de ANTES y se cerraron
    // ahora — esto es lo que puede hacer que Finalizadas supere a Totales,
    // y así queda claro por qué, en vez de verse como un error.
    const fechaInicioRango = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
    ordenesFinalizadasEnRango.forEach(order => {
      const amount = parseFloat(order.financials?.total || 0);
      const idsDeEstaOrden = Array.isArray(order.vendedor_ids) && order.vendedor_ids.length > 0
          ? order.vendedor_ids
          : [];
      const fechaCreacionOrden = new Date(order.created_at || order.createdAt);
      const esDelMismoPeriodo = !fechaInicioRango || fechaCreacionOrden >= fechaInicioRango;

      idsDeEstaOrden.forEach(vendedorId => {
          if (!stats[vendedorId]) return;
          stats[vendedorId].finalizedSales += amount;
          if (esDelMismoPeriodo) stats[vendedorId].finalizedDelPeriodo += amount;
          else stats[vendedorId].finalizedDeAntes += amount;
      });
    });

    return Object.values(stats)
        .filter(s => !vendedorFilterId || s.id === vendedorFilterId) // si hay filtro, solo esa fila
        .sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredOrders, ordenesFinalizadasEnRango, staffList, vendedorFilterId, dateRange]);

  // --- Totals Calculation ---
  const totals = useMemo(() => {
    return commissionsData.reduce((acc, curr) => ({
      totalSales: acc.totalSales + curr.totalSales,
      finalizedSales: acc.finalizedSales + curr.finalizedSales,
      finalizedDelPeriodo: acc.finalizedDelPeriodo + curr.finalizedDelPeriodo
    }), {
      totalSales: 0,
      finalizedSales: 0,
      finalizedDelPeriodo: 0
    });
  }, [commissionsData]);
  // 🔧 NUEVO: dos efectividades — la "de este mes" (comparando manzanas con
  // manzanas: solo lo creado y cerrado en el mismo período) y la "total"
  // (incluye lo que se cerró ahora pero venía de antes).
  const totalEffectivenessDelMes = totals.totalSales > 0 ? (totals.finalizedDelPeriodo / totals.totalSales * 100).toFixed(1) : '0.0';
  const totalEffectiveness = totals.totalSales > 0 ? (totals.finalizedSales / totals.totalSales * 100).toFixed(1) : '0.0';
  const formatCurrency = val => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(val || 0);

  // --- Export CSV ---
  const handleExport = () => {
    const headers = ['Vendedor', 'N° Órdenes', 'Ventas Totales ($)', 'Ventas Finalizadas ($)', 'Efectividad Este Mes %', 'Efectividad Total %'];
    const rows = commissionsData.map(d => {
      const percentageDelMes = d.totalSales > 0 ? (d.finalizedDelPeriodo / d.totalSales * 100).toFixed(1) : '0.0';
      const percentage = d.totalSales > 0 ? (d.finalizedSales / d.totalSales * 100).toFixed(1) : '0.0';
      return [`"${d.name}"`, d.orderCount, d.totalSales.toFixed(2), d.finalizedSales.toFixed(2), percentageDelMes, percentage];
    });

    // Add Totals Row to CSV
    rows.push(['"TOTALES"', commissionsData.reduce((acc, d) => acc + d.orderCount, 0), totals.totalSales.toFixed(2), totals.finalizedSales.toFixed(2), totalEffectivenessDelMes, totalEffectiveness]);
    const csvContent = "data:text/csv;charset=utf-8," + ["sep=,", headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reporte_comisiones_ventas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Estadísticas</h2>
          <p className="text-slate-500">Reporte de ventas totales y finalizadas por vendedor.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2" onClick={handleExport}>
             <FileSpreadsheet className="h-4 w-4 text-green-600" /> Exportar CSV
           </Button>
           <Button variant="default" className="gap-2" onClick={() => window.print()}>
             <Download className="h-4 w-4" /> Imprimir / PDF
           </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end print:hidden">
         {/* 🔧 NUEVO: selector rápido de mes — como las comisiones se pagan por
             mes, esto arma el rango de fechas de ese mes completo de un solo clic */}
         <div className="w-full md:w-52">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Ver Mes Completo</label>
            <input type="month" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={mesSeleccionado} onChange={e => handleCambiarMes(e.target.value)} />
         </div>
         <div className="flex-1 w-full md:max-w-md">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">O un rango específico (Desde - Hasta)</label>
            <div className="flex items-center gap-2">
               <input type="date" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" value={dateRange.start} onChange={e => setDateRange({
            ...dateRange,
            start: e.target.value
          })} />
               <span className="text-slate-400">-</span>
               <input type="date" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" value={dateRange.end} onChange={e => setDateRange({
            ...dateRange,
            end: e.target.value
          })} />
            </div>
         </div>
         {/* 🔧 NUEVO: filtro por vendedor específico (para comisiones) */}
         <div className="w-full md:w-64">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Vendedor</label>
            <select className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={vendedorFilterId} onChange={e => setVendedorFilterId(e.target.value)}>
               <option value="">Todos los vendedores</option>
               {staffList.map(u => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
            </select>
         </div>
         <Button variant="ghost" onClick={() => { const rangoMesActual = getRangoDelMes(new Date()); setDateRange(rangoMesActual); const d = new Date(); setMesSeleccionado(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); setVendedorFilterId(''); }}>
            Volver al Mes Actual
         </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <KpiCard title="Total Órdenes" value={metrics.total} icon={BarChart3} color="blue" subtitle="En rango seleccionado" />
         <KpiCard title="Finalizadas" value={metrics.finalizedMonth} icon={TrendingUp} color="emerald" subtitle="En rango seleccionado" />
         <KpiCard title="Tiempo Promedio" value={`${metrics.avgDays} días`} icon={Calendar} color="orange" subtitle="Entrega vs Creación" />
         <KpiCard title="Archivadas" value={metrics.archived} icon={Filter} color="slate" subtitle="Total en rango" />
      </div>

      {/* Commissions Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
               <Users className="h-5 w-5 text-blue-600" /> 
               Desglose de Ventas por Vendedor
            </h3>
            {/* 🔧 NUEVO: explicación de qué significa % Efectividad, para que quede claro */}
            <p className="text-xs text-slate-500 mt-1.5 max-w-2xl">
               <span className="font-semibold text-slate-600">% Efectividad</span> = (ventas de órdenes ya <span className="font-semibold">Finalizadas</span>) ÷ (ventas totales del vendedor en el rango seleccionado). 
               Las órdenes que todavía están en Ventas, Producción o Contabilidad cuentan en el total pero no como "finalizadas" porque aún no terminan su proceso — por eso este número sube solo, sin ninguna acción, a medida que las órdenes se van completando. No refleja un problema del vendedor.
               <br className="hidden md:block"/>
               <span className="font-semibold text-slate-600">Finalizadas</span> se cuenta según la fecha en que la orden se <span className="font-semibold">cerró</span> (se entregó y se cobró), no según cuándo se creó — por eso puede superar el 100% si el vendedor cerró en este período trabajo pendiente de un período anterior.
            </p>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-xs">
                 <tr>
                    <th className="px-6 py-4">Usuario / Vendedor</th>
                    <th className="px-6 py-4 text-center">N° Órdenes</th>
                    <th className="px-6 py-4 text-center">Ventas Totales</th>
                    <th className="px-6 py-4 text-center">Ventas Finalizadas</th>
                    <th className="px-6 py-4 text-right">% Efect. Este Mes</th>
                    <th className="px-6 py-4 text-right">% Efect. Total</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {commissionsData.length > 0 ? <>
                        {commissionsData.map((row, idx) => {
                const percentageDelMes = row.totalSales > 0 ? (row.finalizedDelPeriodo / row.totalSales * 100).toFixed(1) : '0.0';
                const percentage = row.totalSales > 0 ? (row.finalizedSales / row.totalSales * 100).toFixed(1) : '0.0';
                return <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-800">
                                    {row.name}
                                </td>
                                <td className="px-6 py-4 text-center text-slate-700 font-bold">
                                    {row.orderCount}
                                </td>
                                <td className="px-6 py-4 text-center text-slate-700 font-semibold">
                                    {formatCurrency(row.totalSales)}
                                </td>
                                <td className="px-6 py-4 text-center text-emerald-600 font-bold">
                                    <div>{formatCurrency(row.finalizedSales)}</div>
                                    {/* 🔧 NUEVO: desglose para que quede claro por qué Finalizadas puede
                                        superar a Ventas Totales — se separa lo que es de este período
                                        (normal) de lo que venía de antes y recién se cerró ahora. */}
                                    {row.finalizedDeAntes > 0 && (
                                        <div className="text-[10px] font-normal text-slate-400 mt-0.5 leading-tight">
                                            {formatCurrency(row.finalizedDelPeriodo)} de este período<br/>
                                            + {formatCurrency(row.finalizedDeAntes)} de antes, cerrado ahora
                                        </div>
                                    )}
                                </td>
                                {/* 🔧 NUEVO: dos columnas — "de este mes" compara solo lo creado Y
                                    cerrado en el mismo período (manzanas con manzanas); "total"
                                    incluye también lo que se cerró ahora pero venía de antes. */}
                                <td className="px-6 py-4 text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${Number(percentageDelMes) >= 80 ? 'bg-green-100 text-green-700' : Number(percentageDelMes) >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {percentageDelMes}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${Number(percentage) >= 80 ? 'bg-green-100 text-green-700' : Number(percentage) >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {percentage}%
                                    </span>
                                </td>
                            </tr>;
              })}
                        {/* Totals Row */}
                        <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                           <td className="px-6 py-4 text-slate-800 uppercase tracking-wide">
                              TOTALES
                           </td>
                           <td className="px-6 py-4 text-center text-slate-800">
                              {commissionsData.reduce((acc, d) => acc + d.orderCount, 0)}
                           </td>
                           <td className="px-6 py-4 text-center text-slate-800">
                              {formatCurrency(totals.totalSales)}
                           </td>
                           <td className="px-6 py-4 text-center text-emerald-700">
                              {formatCurrency(totals.finalizedSales)}
                           </td>
                           <td className="px-6 py-4 text-right">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${Number(totalEffectivenessDelMes) >= 80 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                {totalEffectivenessDelMes}%
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${Number(totalEffectiveness) >= 80 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                {totalEffectiveness}%
                              </span>
                           </td>
                        </tr>
                    </> : <tr>
                       <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                          No hay datos disponibles para el rango de fechas seleccionado.
                       </td>
                    </tr>}
              </tbody>
           </table>
        </div>
      </div>
    </div>;
};
const KpiCard = ({
  title,
  value,
  icon: Icon,
  color,
  subtitle
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100'
  };
  const selectedColor = colorClasses[color] || colorClasses.slate;
  return <div className={`p-4 rounded-xl border shadow-sm bg-white flex flex-col justify-between`}>
         <div className="flex justify-between items-start mb-2">
            <div>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
               <h4 className="text-2xl font-bold text-slate-800 mt-1">{value}</h4>
            </div>
            <div className={`p-2 rounded-lg ${selectedColor}`}>
               <Icon className="h-5 w-5" />
            </div>
         </div>
         {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>;
};
export default StatisticsCharts;