import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, PieChart, TrendingUp, Calendar, Filter, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLORS = {
  'VENTAS': 'bg-sky-500',
  'PRODUCCION': 'bg-orange-500',
  'VENTAS POR RETIRAR': 'bg-purple-500',
  'CONTABILIDAD': 'bg-indigo-500',
  'FINALIZADA': 'bg-emerald-500',
  'ANULADA': 'bg-red-500',
  'ARCHIVADA': 'bg-slate-500'
};

const StatisticsCharts = ({ orders = [] }) => {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  // --- Filtering Logic ---
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Date Filter
      if (dateRange.start) {
        if (new Date(o.createdAt) < new Date(dateRange.start + 'T00:00:00')) return false;
      }
      if (dateRange.end) {
        if (new Date(o.createdAt) > new Date(dateRange.end + 'T23:59:59')) return false;
      }
      // Client Filter
      if (clientFilter && !o.cliente.toLowerCase().includes(clientFilter.toLowerCase())) return false;
      // Status Filter
      if (statusFilter !== 'TODOS' && o.status !== statusFilter) return false;
      
      return true;
    });
  }, [orders, dateRange, clientFilter, statusFilter]);

  // --- KPI Metrics ---
  const metrics = useMemo(() => {
    const total = filteredOrders.length;
    
    // Finalized this month (based on filtered list context or strict current month if no filter?)
    // Let's use strict current month for the "Mes Actual" card, but using filtered data
    const now = new Date();
    const finalizedMonth = filteredOrders.filter(o => 
      o.status === 'FINALIZADA' && 
      new Date(o.updatedAt).getMonth() === now.getMonth() &&
      new Date(o.updatedAt).getFullYear() === now.getFullYear()
    ).length;

    const archived = filteredOrders.filter(o => o.status === 'ARCHIVADA').length;

    // Avg Delivery Time (Days) for finalized orders in the filtered set
    const finalized = filteredOrders.filter(o => o.status === 'FINALIZADA');
    let avgDays = 0;
    if (finalized.length > 0) {
      const totalDays = finalized.reduce((acc, curr) => {
         const start = new Date(curr.createdAt);
         const end = new Date(curr.updatedAt);
         const diff = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
         return acc + diff;
      }, 0);
      avgDays = (totalDays / finalized.length).toFixed(1);
    }

    return { total, finalizedMonth, archived, avgDays };
  }, [filteredOrders]);

  // --- Chart Data Preparation ---
  const statusDistribution = useMemo(() => {
    const counts = {};
    filteredOrders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    const total = filteredOrders.length || 1;
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      percentage: ((count / total) * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);
  }, [filteredOrders]);

  // --- Simple CSV Export ---
  const handleExport = () => {
     const headers = ['ID', 'Cliente', 'Estado', 'Fecha Creacion', 'Total'];
     const rows = filteredOrders.map(o => [
       o.orderNumber || o.id,
       `"${o.cliente}"`,
       o.status,
       o.createdAt.split('T')[0],
       (o.financials?.total || 0).toFixed(2)
     ]);
     const csvContent = "data:text/csv;charset=utf-8," + ["sep=,", headers.join(','), ...rows.map(e => e.join(','))].join('\n');
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", "reporte_estadisticas.csv");
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Panel de Gráficos y Estadísticas</h2>
          <p className="text-slate-500">Visualización de métricas de rendimiento y estado de órdenes.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2" onClick={handleExport}>
             <FileSpreadsheet className="h-4 w-4 text-green-600" /> Exportar Excel
           </Button>
           <Button variant="default" className="gap-2" onClick={() => window.print()}>
             <Download className="h-4 w-4" /> Imprimir / PDF
           </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end print:hidden">
         <div className="flex-1 w-full">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Rango de Fechas</label>
            <div className="flex items-center gap-2">
               <input 
                 type="date" 
                 className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                 value={dateRange.start}
                 onChange={e => setDateRange({...dateRange, start: e.target.value})}
               />
               <span className="text-slate-400">-</span>
               <input 
                 type="date" 
                 className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                 value={dateRange.end}
                 onChange={e => setDateRange({...dateRange, end: e.target.value})}
               />
            </div>
         </div>
         <div className="flex-1 w-full">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Cliente</label>
            <input 
              type="text" 
              placeholder="Filtrar por cliente..." 
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
            />
         </div>
         <div className="flex-1 w-full">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Estado</label>
            <select 
               className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
               value={statusFilter}
               onChange={e => setStatusFilter(e.target.value)}
            >
               <option value="TODOS">Todos</option>
               {Object.keys(COLORS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
         </div>
         <Button variant="ghost" onClick={() => { setDateRange({start:'', end:''}); setClientFilter(''); setStatusFilter('TODOS'); }}>
            Limpiar
         </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <KpiCard title="Total Órdenes" value={metrics.total} icon={BarChart3} color="blue" subtitle="En selección actual" />
         <KpiCard title="Finalizadas (Mes)" value={metrics.finalizedMonth} icon={TrendingUp} color="emerald" subtitle="Mes en curso" />
         <KpiCard title="Tiempo Promedio" value={`${metrics.avgDays} días`} icon={Calendar} color="orange" subtitle="Entrega vs Creación" />
         <KpiCard title="Archivadas" value={metrics.archived} icon={Filter} color="slate" subtitle="Histórico total" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Bar Chart (Horizontal Bars using HTML/Tailwind) */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
               <BarChart3 className="h-5 w-5 text-slate-400" /> Distribución por Estado
            </h3>
            <div className="space-y-4">
               {statusDistribution.map((item) => (
                  <div key={item.status} className="space-y-1">
                     <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.status}</span>
                        <span className="text-slate-500">{item.count} ({item.percentage}%)</span>
                     </div>
                     <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <motion.div 
                           initial={{ width: 0 }}
                           animate={{ width: `${item.percentage}%` }}
                           transition={{ duration: 1, ease: "easeOut" }}
                           className={`h-full rounded-full ${COLORS[item.status] || 'bg-slate-400'}`}
                        />
                     </div>
                  </div>
               ))}
               {statusDistribution.length === 0 && <p className="text-center text-slate-400 py-10">No hay datos para mostrar</p>}
            </div>
         </div>

         {/* Summary Table */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
               <PieChart className="h-5 w-5 text-slate-400" /> Resumen Detallado
            </h3>
            <div className="overflow-x-auto flex-1">
               <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                     <tr>
                        <th className="px-4 py-2">Estado</th>
                        <th className="px-4 py-2 text-right">Cantidad</th>
                        <th className="px-4 py-2 text-right">% Total</th>
                        <th className="px-4 py-2 text-center">Tendencia</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {statusDistribution.map((item) => (
                        <tr key={item.status} className="hover:bg-slate-50">
                           <td className="px-4 py-3 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${COLORS[item.status] || 'bg-slate-400'}`}></span>
                              {item.status}
                           </td>
                           <td className="px-4 py-3 text-right font-bold text-slate-700">{item.count}</td>
                           <td className="px-4 py-3 text-right text-slate-600">{item.percentage}%</td>
                           <td className="px-4 py-3 text-center text-slate-400">-</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon: Icon, color, subtitle }) => {
   const colorClasses = {
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      orange: 'bg-orange-50 text-orange-600 border-orange-100',
      slate: 'bg-slate-50 text-slate-600 border-slate-100'
   };
   const selectedColor = colorClasses[color] || colorClasses.slate;

   return (
      <div className={`p-4 rounded-xl border shadow-sm bg-white flex flex-col justify-between`}>
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
      </div>
   );
};

export default StatisticsCharts;