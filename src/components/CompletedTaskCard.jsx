
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Image as ImageIcon, CheckCircle2, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const CompletedTaskCard = ({ task, order, onClickTaskLink }) => {
  const hasImages = task.images && task.images.length > 0;
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-slate-50 border border-green-200/60 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col gap-2 hover:bg-white"
    >
      <div className="absolute top-0 right-0 p-2 opacity-30 group-hover:opacity-100 transition-opacity">
         <CheckCircle2 className="h-5 w-5 text-green-500" />
      </div>

      {/* Header: Responsible & Date */}
      <div className="flex justify-between items-start pr-6">
         <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{task.columnId || 'Sin Asignar'}</span>
         </div>
      </div>

      {/* Content */}
      <div>
         <h4 className="font-bold text-sm text-slate-700 leading-tight mb-1 group-hover:text-green-700 transition-colors">
            {task.title}
         </h4>
         {task.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
               {task.description}
            </p>
         )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
         <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-400" title="Fecha Completado">
               <Calendar className="h-3 w-3" />
               {task.completedAt ? new Date(task.completedAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : '-'}
            </div>
            
             {hasImages && (
               <div className="text-slate-400 flex items-center gap-0.5" title={`${task.images.length} imágenes`}>
                  <ImageIcon className="h-3 w-3" />
                  <span className="text-[10px]">{task.images.length}</span>
               </div>
            )}
         </div>

         {order ? (
            <button 
              onClick={() => onClickTaskLink(order)}
              className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
            >
              OP {order.orderNumber} <ArrowRight className="h-2 w-2" />
            </button>
         ) : (
            <span className="text-[10px] font-mono text-slate-300">
               N/A
            </span>
         )}
      </div>
    </motion.div>
  );
};

export default CompletedTaskCard;
