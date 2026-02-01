
import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const ImageUploadModal = ({ isOpen, onClose, onUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrls, setPreviewUrls] = useState([]);
  const inputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (files) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const handleSubmit = () => {
    if (previewUrls.length > 0) {
      onUpload(previewUrls);
      setPreviewUrls([]);
      onClose();
    }
  };

  const removePreview = (index) => {
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Subir Imágenes</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div 
            className={cn(
              "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer",
              dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:bg-slate-50"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input 
              ref={inputRef}
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={handleChange}
            />
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <p className="font-medium text-slate-700">Haz clic para subir o arrastra aquí</p>
            <p className="text-xs text-slate-500 mt-1">Soporta JPG, PNG, WEBP</p>
          </div>

          {/* Previews */}
          {previewUrls.length > 0 && (
             <div className="mt-6 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Vistas Previas</h4>
                <div className="grid grid-cols-3 gap-2">
                   <AnimatePresence>
                     {previewUrls.map((url, idx) => (
                       <motion.div 
                         key={idx} 
                         initial={{ opacity: 0, scale: 0.8 }}
                         animate={{ opacity: 1, scale: 1 }}
                         exit={{ opacity: 0, scale: 0.8 }}
                         className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group"
                       >
                          <img src={url} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                            onClick={(e) => { e.stopPropagation(); removePreview(idx); }}
                            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                             <X className="h-3 w-3" />
                          </button>
                       </motion.div>
                     ))}
                   </AnimatePresence>
                </div>
             </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
           <Button variant="outline" onClick={onClose}>Cancelar</Button>
           <Button onClick={handleSubmit} disabled={previewUrls.length === 0} className="bg-blue-600 hover:bg-blue-700">
              Agregar {previewUrls.length > 0 && `(${previewUrls.length})`}
           </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageUploadModal;
