import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, Filter, Download, FileSpreadsheet, Users, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../supabaseClient';
import { isUserInList } from '@/utils/userMatch';

const StatisticsCharts = ({
  orders = []
}) => {
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });

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

  // --- KPI Metrics (General Counts) ---
  const metrics = useMemo(() => {
    const total = filteredOrders.length;

    // Finalized this month (based on filtered list context)
    const now = new Date();
    const finalizedMonth = filteredOrders.filter(o => o.status === 'FINALIZADA' && new Date(o.updated_at || o.updatedAt).getMonth() === now.getMonth() && new Date(o.updated_at || o.updatedAt).getFullYear() === now.getFullYear()).length;
    const archived = filteredOrders.filter(o => o.status === 'ARCHIVADA').length;

    // Avg Delivery Time (Days) for finalized orders in the filtered set
    const finalized = filteredOrders.filter(o => o.status === 'FINALIZADA');
    let avgDays = 0;
    if (finalized.length > 0) {
      const totalDays = finalized.reduce((acc, curr) => {
        const start = new Date(curr.created_at || curr.createdAt);
        const end = new Date(curr.updated_at || curr.updatedAt);
        const diff = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        return acc + diff;
      }, 0);
      avgDays = (totalDays / finalized.length).toFixed(1);
    }
    return {
      total,
      finalizedMonth,
      archived,
      avgDays
    };
  }, [filteredOrders]);

  // --- Commissions Data Logic (Amounts) ---
  // 🔧 FIX: antes agrupaba por 'order.vendedor' (el nombre, tal cual estaba guardado
  // en cada orden) — esto se rompe si alguien cambió de nombre, y además podía incluir
  // roles que no son Vendedor. Ahora agrupa por id, usando la lista real de Vendedores,
  // y agrega la cantidad de órdenes (lo que pediste para cuadrar comisiones).
  const commissionsData = useMemo(() => {
    const stats = {};
    staffList.forEach(u => {
        stats[u.id] = { id: u.id, name: u.full_name, totalSales: 0, finalizedSales: 0, orderCount: 0 };
    });

    filteredOrders.forEach(order => {
      const amount = parseFloat(order.financials?.total || 0);
      const idsDeEstaOrden = Array.isArray(order.vendedor_ids) && order.vendedor_ids.length > 0
          ? order.vendedor_ids
          : []; // si la orden no tiene ids (muy vieja, sin migrar), no se cuenta aquí

      idsDeEstaOrden.forEach(vendedorId => {
          if (!stats[vendedorId]) return; // no es un Vendedor activo (ya no está, o cambió de rol)
          stats[vendedorId].totalSales += amount;
          stats[vendedorId].orderCount += 1;
          if (order.status === 'FINALIZADA') {
              stats[vendedorId].finalizedSales += amount;
          }
      });
    });

    return Object.values(stats)
        .filter(s => !vendedorFilterId || s.id === vendedorFilterId) // si hay filtro, solo esa fila
        .sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredOrders, staffList, vendedorFilterId]);

  // --- Totals Calculation ---
  const totals = useMemo(() => {
    return commissionsData.reduce((acc, curr) => ({
      totalSales: acc.totalSales + curr.totalSales,
      finalizedSales: acc.finalizedSales + curr.finalizedSales
    }), {
      totalSales: 0,
      finalizedSales: 0
    });
  }, [commissionsData]);
  const totalEffectiveness = totals.totalSales > 0 ? (totals.finalizedSales / totals.totalSales * 100).toFixed(1) : '0.0';
  const formatCurrency = val => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(val || 0);

  // --- Export CSV ---
  const handleExport = () => {
    const headers = ['Vendedor', 'N° Órdenes', 'Ventas Totales ($)', 'Ventas Finalizadas ($)', 'Efectividad %'];
    const rows = commissionsData.map(d => {
      const percentage = d.totalSales > 0 ? (d.finalizedSales / d.totalSales * 100).toFixed(1) : '0.0';
      return [`"${d.name}"`, d.orderCount, d.totalSales.toFixed(2), d.finalizedSales.toFixed(2), percentage];
    });

    // Add Totals Row to CSV
    rows.push(['"TOTALES"', commissionsData.reduce((acc, d) => acc + d.orderCount, 0), totals.totalSales.toFixed(2), totals.finalizedSales.toFixed(2), totalEffectiveness]);
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
         <div className="flex-1 w-full md:max-w-md">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Rango de Fechas (Desde - Hasta)</label>
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
         <Button variant="ghost" onClick={() => { setDateRange({
        start: '',
        end: ''
      }); setVendedorFilterId(''); }}>
            Limpiar Filtros
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
                    <th className="px-6 py-4 text-right">% Efectividad</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {commissionsData.length > 0 ? <>
                        {commissionsData.map((row, idx) => {
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
                                    {formatCurrency(row.finalizedSales)}
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
                              <span className={`px-2 py-1 rounded text-xs font-bold ${Number(totalEffectiveness) >= 80 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                {totalEffectiveness}%
                              </span>
                           </td>
                        </tr>
                    </> : <tr>
                       <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
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