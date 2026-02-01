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
    const end = addDays(getStartOfWeek(lastDay), 6); // Simple approximation, usually safe for grid
    
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

  const getOrdersForDay = (date) => {
    return orders.filter(o => {
      if (!o.fechaEntrega) return false;
      const d = new Date(o.fechaEntrega);
      return isSameDay(d, date);
    });
  };

  // Color mapping based on status? Or just red as in screenshot
  const getEventStyle = (order) => {
     // Screenshot uses red for almost everything, blue/orange occasionally
     // Let's use status mapping
     switch(order.status) {
       case 'FINALIZADA': return 'bg-green-500 text-white';
       case 'VENTAS': return 'bg-blue-500 text-white';
       case 'PRODUCCION': return 'bg-red-500 text-white';
       default: return 'bg-slate-500 text-white';
     }
  };

  const renderEvent = (order) => (
    <div 
       key={order.id}
       onClick={() => onViewOrder(order)}
       className={cn(
         "text-[10px] px-1 py-0.5 rounded mb-1 truncate cursor-pointer hover:opacity-80 shadow-sm",
         getEventStyle(order)
       )}
       title={`${order.tipoLetrero} - ${order.cliente}`}
    >
       {order.tipoLetrero}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-full flex flex-col">
       {/* Header */}
       <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-semibold text-slate-800">Calendario</h2>
             <div className="flex bg-slate-100 rounded-lg p-1">
                <button onClick={() => setView('month')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", view === 'month' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900")}>Mes</button>
                <button onClick={() => setView('week')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", view === 'week' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900")}>Semana</button>
                <button onClick={() => setView('day')} className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", view === 'day' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900")}>Día</button>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <span className="text-lg font-medium text-slate-700">
                {view === 'week' && `${getStartOfWeek(currentDate).getDate()} – ${addDays(getStartOfWeek(currentDate), 6).getDate()} de `}
                {MONTHS[currentDate.getMonth()]} de {currentDate.getFullYear()}
             </span>
             <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date())}>Hoy</Button>
                <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
             </div>
          </div>
       </div>

       {/* Calendar Body */}
       <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
          {view === 'month' && (
             <div className="grid grid-cols-7 h-full min-h-[600px]">
                {/* Headers */}
                {DAYS.map(day => (
                   <div key={day} className="p-2 border-b border-r border-slate-100 bg-slate-50 text-center font-semibold text-slate-600 uppercase text-xs">
                      {day}
                   </div>
                ))}
                {/* Days */}
                {getMonthDays(currentDate).map((date, i) => {
                   const isToday = isSameDay(date, new Date());
                   const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                   const dayOrders = getOrdersForDay(date);

                   return (
                      <div key={i} className={cn("min-h-[100px] border-b border-r border-slate-100 p-1 flex flex-col", !isCurrentMonth && "bg-slate-50/50")}>
                         <div className={cn("text-xs font-medium mb-1 ml-1 w-6 h-6 flex items-center justify-center rounded-full", isToday ? "bg-blue-600 text-white" : "text-slate-700")}>
                            {date.getDate()}
                         </div>
                         <div className="flex-1 overflow-y-auto">
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
                   dayOrders.sort((a, b) => new Date(a.fechaEntrega) - new Date(b.fechaEntrega));

                   return (
                      <div key={i} className="flex-1 border-r border-slate-200 last:border-r-0 flex flex-col min-w-[120px]">
                         <div className={cn("p-2 text-center border-b border-slate-200", isToday ? "bg-blue-50" : "bg-slate-50")}>
                            <div className={cn("text-xs uppercase font-semibold", isToday ? "text-blue-600" : "text-slate-500")}>{DAYS[date.getDay()]}</div>
                            <div className={cn("text-lg font-bold", isToday ? "text-blue-700" : "text-slate-800")}>{date.getDate()}</div>
                         </div>
                         
                         {/* Hour Grid Simulation (simplified to stack items, since we support time now) */}
                         <div className="flex-1 p-1 space-y-1 bg-slate-50/10 overflow-y-auto">
                            {dayOrders.length > 0 ? dayOrders.map((order, idx) => {
                               const d = new Date(order.fechaEntrega);
                               const timeStr = d.getHours() + ':' + d.getMinutes().toString().padStart(2, '0');
                               return (
                                 <div 
                                    key={idx}
                                    onClick={() => onViewOrder(order)}
                                    className={cn("p-2 rounded text-xs cursor-pointer shadow-sm hover:ring-2 ring-offset-1 transition-all", getEventStyle(order))}
                                 >
                                    <div className="font-bold opacity-75 mb-0.5">{timeStr}</div>
                                    <div className="font-semibold truncate">{order.tipoLetrero}</div>
                                    <div className="truncate opacity-90">{order.cliente}</div>
                                 </div>
                               );
                            }) : (
                               <div className="h-full flex items-center justify-center">
                                  <span className="text-slate-300 text-xs">-</span>
                               </div>
                            )}
                         </div>
                      </div>
                   );
                })}
             </div>
          )}

          {view === 'day' && (
             <div className="h-full p-4">
                 <div className="max-w-3xl mx-auto">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 text-center border-b pb-4">
                       Agenda para {currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <div className="space-y-2">
                       {getOrdersForDay(currentDate).length > 0 ? getOrdersForDay(currentDate).map(order => (
                          <div key={order.id} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => onViewOrder(order)}>
                             <div className="text-xl font-bold text-slate-400 w-20 text-center">
                                {new Date(order.fechaEntrega).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                             </div>
                             <div className="w-1 bg-blue-500 h-10 rounded-full"></div>
                             <div className="flex-1">
                                <h4 className="font-bold text-slate-800">{order.tipoLetrero}</h4>
                                <p className="text-sm text-slate-600">{order.cliente}</p>
                             </div>
                             <StatusBadge status={order.status} />
                          </div>
                       )) : (
                          <div className="text-center py-12 text-slate-400">
                             No hay entregas programadas para este día.
                          </div>
                       )}
                    </div>
                 </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default WorkAreaCalendar;