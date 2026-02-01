import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Paperclip, ArrowRight, MoreHorizontal, Image as ImageIcon, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ImageUploadModal from './ImageUploadModal';
import { cn } from '@/lib/utils';

const KanbanCard = ({ 
  task, 
  order, 
  onStatusChange, 
  onAddImages, 
  onClickTaskLink, 
  onDelete,
  onComplete
}) => {
  const [showImageModal, setShowImageModal] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const statusColors = {
    'Pendiente': 'bg-red-500/20 text-red-200 border-red-500/30',
    'En proceso': 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30'
    // 'Completado' removed from here as it shouldn't be selectable via dropdown in active view
  };

  const handleStatusSelect = (newStatus) => {
    onStatusChange(task.id, newStatus);
  };

  const handleImageUpload = (images) => {
    onAddImages(task.id, images);
    setShowImageModal(false);
  };

  const handleComplete = () => {
    setIsCompleting(true);
    // Add small delay for visual feedback if needed, or execute immediately
    setTimeout(() => {
       if (onComplete) onComplete(task.id);
       setIsCompleting(false);
    }, 300);
  };

  // Cover image is the first image if available
  const coverImage = task.images && task.images.length > 0 ? task.images[0] : null;

  return (
    <>
      <motion.div
        layoutId={task.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, scale: isCompleting ? 0.95 : 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="group relative bg-slate-900 text-slate-100 rounded-lg shadow-sm hover:shadow-xl hover:ring-1 hover:ring-slate-700 transition-all border border-slate-800 flex flex-col overflow-hidden"
      >
        {/* Cover Image - Trello Style */}
        {coverImage && (
           <div 
              className="h-32 w-full bg-slate-800 overflow-hidden cursor-pointer relative group/image"
              onClick={() => setViewImage(coverImage)}
           >
              <img src={coverImage} alt="Cover" className="w-full h-full object-cover transition-transform group-hover/image:scale-105" />
              <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors" />
           </div>
        )}

        <div className="p-3 flex flex-col gap-2">
           {/* Header: Order Link & Options */}
           <div className="flex justify-between items-start">
             <div className="flex flex-wrap gap-2">
                 {/* Status Badge */}
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <button className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105 border",
                        statusColors[task.status] || 'bg-slate-800 text-slate-400 border-slate-700'
                     )}>
                        {task.status}
                     </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                     <DropdownMenuItem onClick={() => handleStatusSelect('Pendiente')}>Pendiente</DropdownMenuItem>
                     <DropdownMenuItem onClick={() => handleStatusSelect('En proceso')}>En proceso</DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>

               {order ? (
                 <button 
                   onClick={() => onClickTaskLink(order)}
                   className="text-[10px] font-mono font-bold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors py-0.5"
                 >
                   OP {order.orderNumber}
                 </button>
               ) : (
                 <span className="text-[10px] font-mono text-slate-500 py-0.5">Sin Orden</span>
               )}
             </div>
             
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <button className="text-slate-500 hover:text-slate-300 transition-colors -mr-1">
                      <MoreHorizontal className="h-4 w-4" />
                   </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                   <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-600 focus:text-red-600">
                      Eliminar Tarea
                   </DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>
           </div>

           {/* Content */}
           <div>
              <h4 className="font-semibold text-sm leading-snug mb-1 text-slate-100">{task.title}</h4>
              {task.description && (
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{task.description}</p>
              )}
           </div>

           {/* Footer: Attachments & Complete Button */}
           <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1">
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-6 w-6 text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                   onClick={() => setShowImageModal(true)}
                   title="Adjuntar imagen"
                 >
                    <ImageIcon className="h-3 w-3" />
                 </Button>
                 
                 {(task.images && task.images.length > 0) && (
                    <div className="flex items-center gap-1 text-slate-500 text-xs px-1" title="Adjuntos">
                       <Paperclip className="h-3 w-3" />
                       <span>{task.images.length}</span>
                    </div>
                 )}
              </div>

              <Button 
                 size="sm"
                 onClick={handleComplete}
                 className="h-7 px-3 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold uppercase tracking-wide rounded-md shadow-sm flex items-center gap-1.5 transition-all hover:shadow-green-900/20"
              >
                 <Check className="h-3 w-3" />
                 Completada
              </Button>
           </div>
        </div>
      </motion.div>

      <ImageUploadModal 
         isOpen={showImageModal}
         onClose={() => setShowImageModal(false)}
         onUpload={handleImageUpload}
      />

      {/* Full Image Preview */}
      {viewImage && (
         <div 
           className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
           onClick={() => setViewImage(null)}
         >
            <button className="absolute top-4 right-4 text-white hover:text-gray-300">
               <X className="h-8 w-8" />
            </button>
            <img src={viewImage} alt="Full view" className="max-w-full max-h-[90vh] rounded shadow-2xl" onClick={e => e.stopPropagation()} />
         </div>
      )}
    </>
  );
};

export default KanbanCard;