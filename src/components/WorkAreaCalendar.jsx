import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WorkAreaCalendar = ({ orders = [], onViewOrder }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('week'); // 'month', 'week', 'day'

  // --- Helpers ---
  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to make Monday first
    return new Date(d.setDate(diff));
  };

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  };

  const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const getWeekDays = (baseDate) => {
    const start = getStartOfWeek(baseDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getMonthDays = (baseDate) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from previous month to fill week
    const start = getStartOfWeek(firstDay);
    // End to complete week
    const end = addDays(getStartOfWeek(lastDay), 6); 
    
    const days = [];
    let day = start;
    while (day <= end || days.length % 7 !== 0) {
       days.push(new Date(day));
       day = addDays(day, 1);
    }
    return days;
  };

  // --- Render ---
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (view === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  // 🔥 Filtramos para que SOLO salgan las de VENTAS y PRODUCCIÓN
  const getOrdersForDay = (date) => {
    return orders.filter(o => {
      if (o.status !== 'VENTAS' && o.status !== 'PRODUCCION') return false;
      const fechaBase = o.fechaEntrega || o.fecha_entrega;
      if (!fechaBase) return false;
      
      // Parseamos la fecha asegurando que se compare el día exacto localmente
      const [year, month, day] = fechaBase.split('T')[0].split('-');
      const d = new Date(year, month - 1, day);
      
      return isSameDay(d, date);
    });
  };

  const getEventStyle = (order) => {
     if (order.status === 'VENTAS') return 'bg-blue-100 text-blue-800 border border-blue-300';
     if (order.status === 'PRODUCCION') return 'bg-orange-100 text-orange-800 border border-orange-300';
     return 'bg-slate-100 text-slate-800';
  };

  const renderEvent = (order) => (
    <div 
       key={order.id}
       onClick={() => onViewOrder(order)}
       className={cn(
         "text-[10px] px-1.5 py-0.5 rounded mb-1 truncate cursor-pointer hover:opacity-80 shadow-sm font-bold",
         getEventStyle(order)
       )}
       title={`${order.tipoLetrero || order.tipo_trabajo} - ${order.cliente || order.cliente_nombre}`}
    >
       {order.tipoLetrero || order.tipo_trabajo}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
       {/* Header */}
       <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                 <CalIcon className="h-6 w-6 text-blue-600" /> Calendario
             </h2>
             <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button onClick={() => setView('month')} className={cn("px-3 py-1 text-xs font-bold rounded-md transition-colors", view === 'month' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-900")}>Mes</button>
                <button onClick={() => setView('week')} className={cn("px-3 py-1 text-xs font-bold rounded-md transition-colors", view === 'week' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-900")}>Semana</button>
                <button onClick={() => setView('day')} className={cn("px-3 py-1 text-xs font-bold rounded-md transition-colors", view === 'day' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-900")}>Día</button>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <span className="text-lg font-bold text-slate-700 capitalize">
                {view === 'week' && `${getStartOfWeek(currentDate).getDate()} – ${addDays(getStartOfWeek(currentDate), 6).getDate()} de `}
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
             </span>
             <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={handlePrev} className="hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date())} className="w-auto px-3 font-bold hover:bg-slate-100">Hoy</Button>
                <Button variant="outline" size="icon" onClick={handleNext} className="hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></Button>
             </div>
          </div>
       </div>

       {/* Calendar Body */}
       <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-slate-50/50">
          {view === 'month' && (
             <div className="grid grid-cols-7 h-full min-h-[600px]">
                {/* Headers */}
                {DAYS.map(day => (
                   <div key={day} className="p-2 border-b border-r border-slate-200 bg-slate-100 text-center font-bold text-slate-600 uppercase text-xs">
                      {day}
                   </div>
                ))}
                {/* Days */}
                {getMonthDays(currentDate).map((date, i) => {
                   const isToday = isSameDay(date, new Date());
                   const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                   const dayOrders = getOrdersForDay(date);

                   return (
                      <div key={i} className={cn("min-h-[100px] border-b border-r border-slate-200 p-1 flex flex-col transition-colors", !isCurrentMonth ? "bg-slate-100/50" : "bg-white hover:bg-slate-50")}>
                         <div className={cn("text-xs font-bold mb-1 ml-1 w-6 h-6 flex items-center justify-center rounded-full shadow-sm", isToday ? "bg-blue-600 text-white" : "text-slate-600 bg-slate-100")}>
                            {date.getDate()}
                         </div>
                         <div className="flex-1 overflow-y-auto pr-1">
                            {dayOrders.map(renderEvent)}
                         </div>
                      </div>
                   );
                })}
             </div>
          )}

          {view === 'week' && (
             <div className="flex h-full min-h-[600px]">
                {getWeekDays(currentDate).map((date, i) => {
                   const isToday = isSameDay(date, new Date());
                   const dayOrders = getOrdersForDay(date);
                   // Ordenar por hora si existe
                   dayOrders.sort((a, b) => new Date(a.fechaEntrega || a.fecha_entrega) - new Date(b.fechaEntrega || b.fecha_entrega));

                   return (
                      <div key={i} className="flex-1 border-r border-slate-200 last:border-r-0 flex flex-col min-w-[140px] bg-white hover:bg-slate-50 transition-colors">
                         <div className={cn("p-2 text-center border-b border-slate-200", isToday ? "bg-blue-50" : "bg-slate-100")}>
                            <div className={cn("text-xs uppercase font-bold", isToday ? "text-blue-600" : "text-slate-500")}>{DAYS[date.getDay()]}</div>
                            <div className={cn("text-lg font-black", isToday ? "text-blue-700" : "text-slate-800")}>{date.getDate()}</div>
                         </div>
                         
                         <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                            {dayOrders.length > 0 ? dayOrders.map((order, idx) => {
                               const fechaObj = order.fechaEntrega || order.fecha_entrega;
                               const timeStr = fechaObj && fechaObj.includes('T') ? fechaObj.split('T')[1].slice(0,5) : '';
                               
                               return (
                                 <div 
                                    key={idx}
                                    onClick={() => onViewOrder(order)}
                                    className={cn("p-2 rounded text-xs cursor-pointer hover:shadow-md transition-all", getEventStyle(order))}
                                 >
                                    <div className="font-black opacity-80 mb-0.5">{timeStr}</div>
                                    <div className="font-bold truncate text-[11px] leading-tight uppercase">{order.tipoLetrero || order.tipo_trabajo}</div>
                                    <div className="truncate opacity-90 text-[10px] mt-1">{order.cliente || order.cliente_nombre}</div>
                                 </div>
                               );
                            }) : (
                               <div className="h-full flex items-center justify-center">
                                  <span className="text-slate-300 text-xs italic">-</span>
                               </div>
                            )}
                         </div>
                      </div>
                   );
                })}
             </div>
          )}

          {view === 'day' && (
             <div className="h-full p-4 bg-slate-50">
                 <div className="max-w-4xl mx-auto">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 text-center border-b border-slate-300 pb-4 capitalize">
                       Agenda para el {currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <div className="space-y-3">
                       {getOrdersForDay(currentDate).length > 0 ? getOrdersForDay(currentDate).map(order => {
                          const fechaObj = order.fechaEntrega || order.fecha_entrega;
                          const timeStr = fechaObj && fechaObj.includes('T') ? fechaObj.split('T')[1].slice(0,5) : '';
                          const isVentas = order.status === 'VENTAS';

                          return (
                              <div key={order.id} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-300" onClick={() => onViewOrder(order)}>
                                 <div className="text-2xl font-black text-slate-700 w-24 text-center">
                                    {timeStr || '--:--'}
                                 </div>
                                 <div className={cn("w-1.5 h-12 rounded-full", isVentas ? "bg-blue-500" : "bg-orange-500")}></div>
                                 <div className="flex-1 ml-2">
                                    <h4 className="font-black text-slate-800 text-lg uppercase">{order.tipoLetrero || order.tipo_trabajo}</h4>
                                    <p className="text-sm font-medium text-slate-600 mt-1">{order.cliente || order.cliente_nombre}</p>
                                 </div>
                                 <div className="hidden md:block">
                                    <StatusBadge status={order.status} />
                                 </div>
                              </div>
                          );
                       }) : (
                          <div className="text-center py-20 text-slate-400 bg-white border border-dashed border-slate-300 rounded-lg">
                             <CalIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                             <span className="font-medium text-lg">No hay entregas programadas para este día.</span>
                          </div>
                       )}
                    </div>
                 </div>
             </div>
          )}
       </div>

       {/* 🔥 LEYENDA DEL CALENDARIO 🔥 */}
       <div className="pt-4 mt-2 border-t border-slate-200 flex gap-6 text-xs font-bold text-slate-600 justify-center">
           <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300 shadow-sm"></div>
              Paso 1: Ventas / Diseño
           </div>
           <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-100 border border-orange-300 shadow-sm"></div>
              Paso 2: Producción
           </div>
       </div>
    </div>
  );
};

export default WorkAreaCalendar;