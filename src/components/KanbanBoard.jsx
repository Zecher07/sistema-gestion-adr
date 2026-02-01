import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, MoreHorizontal } from 'lucide-react';
import KanbanCard from './KanbanCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';

const KanbanBoard = ({ tasks, orders, staffUsers, onTaskUpdate, onTaskCreate, onTaskDelete, onViewOrder }) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState(null);

  // Group tasks by columnId (user)
  // CRITICAL: Filter OUT 'Completada' tasks, they go to the specific view
  const activeTasks = tasks.filter(t => t.status !== 'Completada');

  const columns = staffUsers.map(user => {
     return {
        id: user.name,
        title: user.name, 
        tasks: activeTasks.filter(t => t.columnId === user.name)
     };
  });

  const handleCreateTask = (columnId) => {
    if (!newTaskTitle.trim()) return;
    
    onTaskCreate({
       title: newTaskTitle,
       columnId: columnId,
       status: 'Pendiente',
       description: '',
       images: []
    });
    
    setNewTaskTitle('');
    setAddingToColumn(null);
  };

  const handleCompleteTask = (taskId) => {
    onTaskUpdate(taskId, {
       status: 'Completada',
       completedAt: new Date().toISOString()
    });
  };

  return (
    <div className="h-[calc(100vh-200px)] overflow-x-auto overflow-y-hidden pb-4">
      <div className="flex h-full gap-6 px-4 min-w-max">
         {columns.map(col => (
            <div key={col.id} className="w-80 flex flex-col bg-slate-950 rounded-xl shadow-xl border border-slate-800/50 flex-shrink-0">
               {/* Column Header */}
               <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-xl backdrop-blur-sm">
                  <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wide truncate max-w-[200px]" title={col.title}>
                    {col.title}
                  </h3>
                  <div className="flex items-center gap-1">
                     <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                        {col.tasks.length}
                     </span>
                     <button className="text-slate-600 hover:text-slate-400">
                        <MoreHorizontal className="h-4 w-4" />
                     </button>
                  </div>
               </div>

               {/* Tasks Container */}
               <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {col.tasks.map(task => {
                     const relatedOrder = orders.find(o => o.id === task.orderId || o.orderNumber === task.orderId);
                     return (
                        <KanbanCard 
                           key={task.id}
                           task={task}
                           order={relatedOrder}
                           onStatusChange={(id, status) => onTaskUpdate(id, { status })}
                           onAddImages={(id, newImages) => onTaskUpdate(id, { images: [...(task.images || []), ...newImages] })}
                           onDelete={onTaskDelete}
                           onClickTaskLink={onViewOrder}
                           onComplete={handleCompleteTask}
                        />
                     );
                  })}
               </div>

               {/* Footer: Add Card */}
               <div className="p-3 border-t border-slate-800 bg-slate-900/30 rounded-b-xl">
                  {addingToColumn === col.id ? (
                     <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                        <Input 
                           autoFocus
                           placeholder="Título de la tarea..."
                           value={newTaskTitle}
                           onChange={(e) => setNewTaskTitle(e.target.value)}
                           className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-600 focus-visible:ring-slate-600"
                           onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateTask(col.id);
                              if (e.key === 'Escape') setAddingToColumn(null);
                           }}
                        />
                        <div className="flex gap-2">
                           <Button size="sm" onClick={() => handleCreateTask(col.id)} className="bg-blue-600 hover:bg-blue-500 text-white flex-1">
                              Añadir
                           </Button>
                           <Button size="sm" variant="ghost" onClick={() => setAddingToColumn(null)} className="text-slate-400 hover:text-slate-300 hover:bg-slate-800">
                              <Plus className="h-4 w-4 rotate-45" />
                           </Button>
                        </div>
                     </div>
                  ) : (
                     <button 
                        onClick={() => setAddingToColumn(col.id)}
                        className="w-full flex items-center gap-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 p-2 rounded transition-colors text-sm font-medium"
                     >
                        <Plus className="h-4 w-4" />
                        Añade una tarjeta
                     </button>
                  )}
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};

export default KanbanBoard;