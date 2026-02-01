
import React, { useState, useMemo } from 'react';
import { Search, Filter, X, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/Text';
import CompletedTaskCard from './CompletedTaskCard';
import { AnimatePresence } from 'framer-motion';

const CompletedTasksList = ({ tasks, orders, onViewOrder }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Get unique responsibles (columns)
  // We extract all unique responsibles from the full dataset to ensure structure consistency during search
  const columns = useMemo(() => {
    const uniqueResponsibles = [...new Set(tasks.map(t => t.columnId || 'Sin Asignar'))];
    return uniqueResponsibles.sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  // 2. Filter tasks
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const lowerQuery = searchQuery.toLowerCase();
    return tasks.filter(task => 
      task.title.toLowerCase().includes(lowerQuery) ||
      (task.description && task.description.toLowerCase().includes(lowerQuery)) ||
      (task.columnId && task.columnId.toLowerCase().includes(lowerQuery))
    );
  }, [tasks, searchQuery]);

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col bg-slate-50/50 rounded-xl">
       {/* Toolbar */}
       <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm mx-1 mt-1">
          <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
             <CheckCircle2 className="h-4 w-4" />
             <span className="text-sm font-bold">Historial de Completados</span>
          </div>
          
          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          <div className="relative flex-1 max-w-md">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
             <Input 
               placeholder="Buscar por título, responsable o descripción..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-9 h-9 bg-slate-50 border-slate-200 focus-visible:ring-green-500/50 text-sm"
             />
             {searchQuery && (
               <button 
                 onClick={() => setSearchQuery('')}
                 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 hover:bg-slate-200 rounded-full transition-colors"
               >
                 <X className="h-3 w-3" />
               </button>
             )}
          </div>
          
          <div className="text-xs text-slate-500 font-medium px-2 whitespace-nowrap">
             {filteredTasks.length} {filteredTasks.length === 1 ? 'tarea' : 'tareas'}
          </div>
       </div>

       {/* Kanban Board Layout */}
       <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 px-1">
         <div className="flex h-full gap-5 min-w-max">
            {columns.length > 0 ? (
               columns.map(columnId => {
                 const columnTasks = filteredTasks.filter(t => (t.columnId || 'Sin Asignar') === columnId);
                 // Sort by most recently completed
                 columnTasks.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

                 return (
                    <div key={columnId} className="w-80 flex flex-col bg-slate-100/80 rounded-xl border border-slate-200/60 flex-shrink-0 group">
                       {/* Column Header */}
                       <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 rounded-t-xl sticky top-0 z-10">
                          <h3 className="font-bold text-slate-600 text-sm truncate max-w-[200px] uppercase tracking-wide opacity-80 group-hover:opacity-100 transition-opacity">
                             {columnId}
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm transition-colors ${columnTasks.length > 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                             {columnTasks.length}
                          </span>
                       </div>

                       {/* Tasks Container */}
                       <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-100/30">
                          <AnimatePresence mode='popLayout'>
                             {columnTasks.length > 0 ? (
                                columnTasks.map(task => {
                                   const order = orders.find(o => o.id === task.orderId || o.orderNumber === task.orderId);
                                   return (
                                      <CompletedTaskCard 
                                         key={task.id}
                                         task={task}
                                         order={order}
                                         onClickTaskLink={onViewOrder}
                                      />
                                   );
                                })
                             ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2 opacity-50">
                                   <div className="h-12 w-12 bg-slate-200/50 rounded-full flex items-center justify-center">
                                      <Filter className="h-5 w-5 text-slate-400" />
                                   </div>
                                   <span className="text-xs italic">Sin resultados</span>
                                </div>
                             )}
                          </AnimatePresence>
                       </div>
                    </div>
                 );
               })
            ) : (
               <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <div className="text-center bg-white p-8 rounded-2xl border border-dashed border-slate-300 shadow-sm">
                     <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-200" />
                     <h3 className="text-lg font-medium text-slate-600">Todo limpio por aquí</h3>
                     <p className="text-sm text-slate-500 max-w-xs mx-auto">Aún no hay tareas completadas para mostrar.</p>
                  </div>
               </div>
            )}
         </div>
       </div>
    </div>
  );
};

export default CompletedTasksList;
