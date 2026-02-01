
import React, { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const IVA_RATE = 0.12;

const InvoiceForm = ({ 
  user, 
  initialOrder = null, 
  nextInvoiceNumber, 
  onSubmit, 
  onCancel 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientData, setClientData] = useState({
    name: '',
    ruc: '',
    address: '',
    email: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [items, setItems] = useState([]);
  const [observations, setObservations] = useState('');
  
  // Computed State
  const [totals, setTotals] = useState({ subtotal: 0, iva: 0, total: 0 });

  // Initialize from Order if provided
  useEffect(() => {
    if (initialOrder) {
      setClientData({
        name: initialOrder.cliente || '',
        ruc: initialOrder.clienteRuc || '', // Assuming these might exist or user fills them
        address: initialOrder.clienteDireccion || '',
        email: initialOrder.clienteEmail || '',
        phone: initialOrder.clienteTelefono || ''
      });

      if (initialOrder.productos) {
        const mappedItems = initialOrder.productos.map(p => ({
          description: p.descripcion,
          quantity: parseFloat(p.cantidad) || 1,
          unitPrice: parseFloat(p.precio) || 0,
          discount: 0
        }));
        setItems(mappedItems);
      }
      
      setObservations(`Referencia: Orden #${initialOrder.orderNumber}`);
    } else {
       // Default empty item
       setItems([{ description: '', quantity: 1, unitPrice: 0, discount: 0 }]);
    }
  }, [initialOrder]);

  // Recalculate totals
  useEffect(() => {
    const subtotal = items.reduce((acc, item) => {
      const itemTotal = (item.quantity * item.unitPrice) - (item.discount || 0);
      return acc + itemTotal;
    }, 0);
    
    const iva = subtotal * IVA_RATE;
    const total = subtotal + iva;

    setTotals({ subtotal, iva, total });
  }, [items]);

  const handleClientChange = (e) => {
    const { name, value } = e.target;
    setClientData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, discount: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!clientData.name) {
      toast({ title: "Error", description: "El nombre del cliente es obligatorio.", variant: "destructive" });
      return false;
    }
    if (!clientData.ruc || (clientData.ruc.length !== 10 && clientData.ruc.length !== 13)) {
       toast({ title: "Error", description: "RUC/CI inválido (10 o 13 dígitos).", variant: "destructive" });
       return false;
    }
    if (items.length === 0 || items.some(i => !i.description || i.quantity <= 0)) {
       toast({ title: "Error", description: "Revise los ítems de la factura.", variant: "destructive" });
       return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      const invoiceData = {
        sequential: nextInvoiceNumber,
        date,
        clientData,
        items,
        financials: totals,
        paymentMethod,
        observations,
        status: 'EMITIDA',
        linkedOrderId: initialOrder?.id || null,
        linkedOrderNumber: initialOrder?.orderNumber || null,
        createdBy: user.name
      };

      onSubmit(invoiceData);
      setLoading(false);
    }, 800);
  };

  if (user.role !== 'Vendedor' && user.role !== 'Contabilidad' && user.role !== 'Administrador') {
    return <div className="p-8 text-center text-red-500">No tienes permisos para emitir facturas.</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg flex flex-col h-full max-h-[90vh]">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Nueva Factura
          </h2>
          <p className="text-sm text-slate-500">
            Secuencial: <span className="font-mono font-bold text-blue-600">#{String(nextInvoiceNumber).padStart(9, '0')}</span>
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-5 w-5 text-slate-400" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Client Info */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-bold text-sm text-slate-700 mb-3 uppercase tracking-wider">Datos del Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <Label htmlFor="name">Razón Social / Nombre *</Label>
               <Input 
                 id="name" name="name" 
                 value={clientData.name} onChange={handleClientChange} 
                 className="bg-white"
                 placeholder="Nombre del cliente"
               />
             </div>
             <div>
               <Label htmlFor="ruc">RUC / CI *</Label>
               <Input 
                 id="ruc" name="ruc" 
                 value={clientData.ruc} onChange={handleClientChange} 
                 className="bg-white"
                 placeholder="9999999999001"
                 maxLength={13}
               />
             </div>
             <div className="md:col-span-2">
               <Label htmlFor="address">Dirección</Label>
               <Input 
                 id="address" name="address" 
                 value={clientData.address} onChange={handleClientChange} 
                 className="bg-white"
                 placeholder="Dirección completa"
               />
             </div>
             <div>
               <Label htmlFor="date">Fecha Emisión</Label>
               <Input 
                 id="date" type="date"
                 value={date} onChange={(e) => setDate(e.target.value)}
                 className="bg-white"
               />
             </div>
             <div>
               <Label htmlFor="payment">Forma de Pago</Label>
               <select 
                 id="payment"
                 value={paymentMethod}
                 onChange={(e) => setPaymentMethod(e.target.value)}
                 className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
               >
                 <option value="Efectivo">Efectivo</option>
                 <option value="Transferencia">Transferencia Bancaria</option>
                 <option value="Cheque">Cheque</option>
                 <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
               </select>
             </div>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wider">Detalle de Factura</h3>
            <Button size="sm" variant="outline" onClick={addItem} className="h-8 gap-1">
              <Plus className="h-3 w-3" /> Agregar Ítem
            </Button>
          </div>
          
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 font-semibold">
                <tr>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-center w-20">Cant.</th>
                  <th className="px-3 py-2 text-right w-32">P. Unit</th>
                  <th className="px-3 py-2 text-right w-24">Desc.</th>
                  <th className="px-3 py-2 text-right w-32">Total</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2">
                      <Input 
                        value={item.description} 
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        placeholder="Descripción del producto..."
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" min="1" step="0.01"
                        value={item.quantity} 
                        onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-center"
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" min="0" step="0.01"
                        value={item.unitPrice} 
                        onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number" min="0" step="0.01"
                        value={item.discount} 
                        onChange={(e) => handleItemChange(idx, 'discount', parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-right text-red-500"
                      />
                    </td>
                    <td className="p-2 text-right font-medium text-slate-700">
                      ${((item.quantity * item.unitPrice) - (item.discount || 0)).toFixed(2)}
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        onClick={() => removeItem(idx)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer: Notes & Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div>
              <Label htmlFor="obs">Observaciones</Label>
              <textarea 
                 id="obs"
                 value={observations}
                 onChange={(e) => setObservations(e.target.value)}
                 className="w-full mt-1 rounded-md border border-slate-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                 placeholder="Notas adicionales para la factura..."
              />
           </div>
           
           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 self-start">
              <div className="space-y-2 text-sm">
                 <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-medium">${totals.subtotal.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-slate-600">
                    <span>IVA ({IVA_RATE * 100}%)</span>
                    <span className="font-medium">${totals.iva.toFixed(2)}</span>
                 </div>
                 <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between text-lg font-bold text-slate-900">
                    <span>TOTAL</span>
                    <span className="text-blue-600">${totals.total.toFixed(2)}</span>
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
         <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
         <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 min-w-[150px]">
            {loading ? 'Emitiendo...' : 'Emitir Factura'}
         </Button>
      </div>
    </div>
  );
};

export default InvoiceForm;
