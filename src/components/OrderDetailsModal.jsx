
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, Calendar, CheckSquare, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from '@/components/StatusBadge';

const OrderDetailsModal = ({ order, user, onClose, onProductToggle }) => {
  const [previewImage, setPreviewImage] = useState(null);

  if (!order) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return '-'; }
  };

  const formatOrderId = (id) => id.toString().slice(-8).padStart(8, '0');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Orden #{formatOrderId(order.id)}</h3>
            <p className="text-sm text-slate-500">{order.tipoLetrero}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 mb-6">
             <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="h-4 w-4" /> <span>{order.cliente}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="h-4 w-4" /> <span>Entrega: {formatDate(order.fechaEntrega)}</span>
                </div>
                {order.vendedor && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="font-semibold text-xs bg-slate-100 px-2 py-0.5 rounded">Vendedor: {order.vendedor}</span>
                  </div>
                )}
             </div>
             <div className="text-right space-y-1">
                <StatusBadge status={order.status} />
             </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Productos & Servicios</h4>
            <div className="space-y-2">
              {order.productos.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded border border-slate-100 shadow-sm">
                  {user.role === 'Producción' ? (
                    <Checkbox 
                      checked={p.completed} 
                      onCheckedChange={() => onProductToggle(order, idx)}
                    />
                  ) : (
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${p.completed ? 'bg-green-500 border-green-500' : 'border-slate-300 bg-slate-100'}`}>
                      {p.completed && <CheckSquare className="h-3 w-3 text-white" />}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${p.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {p.descripcion}
                    </p>
                    <p className="text-xs text-slate-500">Cantidad: {p.cantidad}</p>
                  </div>
                  <div className="text-sm font-semibold text-slate-600">
                    {formatCurrency(p.precio * p.cantidad)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
               <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Notas</h4>
               <div className="p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-100 min-h-[80px]">
                  {order.notas || "Sin notas adicionales."}
               </div>
               
               {order.imagen && (
                  <Button variant="outline" size="sm" onClick={() => setPreviewImage(order.imagen)} className="w-full mt-4">
                    <ImageIcon className="h-4 w-4 mr-2" /> Ver Imagen de Referencia
                  </Button>
               )}
            </div>

            <div className="bg-slate-100 p-4 rounded-lg">
               <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Resumen Financiero</h4>
               <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span>{formatCurrency(order.financials?.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">IVA (15%):</span>
                    <span>{formatCurrency(order.financials?.iva)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2">
                    <span>Total:</span>
                    <span>{formatCurrency(order.financials?.total)}</span>
                  </div>
                  <div className="flex justify-between text-green-600 pt-2">
                    <span>Abonado ({order.formaPagoAnticipo}):</span>
                    <span>- {formatCurrency(order.anticipo)}</span>
                  </div>
                  <div className="flex justify-between text-red-600 font-bold border-t border-slate-200 pt-2 mt-1 text-lg">
                    <span>Saldo Pendiente:</span>
                    <span>{formatCurrency(order.financials?.saldo)}</span>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {previewImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4" onClick={(e) => {
            e.stopPropagation();
            setPreviewImage(null);
          }}>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300">
              <X className="h-8 w-8" />
            </button>
            <img src={previewImage} alt="Referencia" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default OrderDetailsModal;
