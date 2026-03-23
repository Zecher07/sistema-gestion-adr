import React, { useState, useEffect } from 'react';
import { Save, X, User, Mail, MapPin, Phone, FileText, DollarSign, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const ClientForm = ({ onCancel, clienteAEditar = null, onSuccess, user }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // 🔥 VALIDACIÓN DE ROL PARA EL CRÉDITO 🔥
  const canEditCredit = user?.role === 'Administrador' || user?.role === 'Contabilidad';

  const [formData, setFormData] = useState({
    razonSocial: '',
    email: '',
    cedulaRuc: '',
    direccion: '',
    celular: '',
    permiteCredito: false, 
    limiteCredito: 0       
  });

  useEffect(() => {
    if (clienteAEditar) {
      setFormData({
        razonSocial: clienteAEditar.nombre || '',
        email: clienteAEditar.email || '',
        cedulaRuc: clienteAEditar.empresa || '', 
        direccion: clienteAEditar.direccion || '',
        celular: clienteAEditar.telefono || '',  
        permiteCredito: clienteAEditar.permiteCredito || false,
        limiteCredito: clienteAEditar.limiteCredito || 0
      });
    }
  }, [clienteAEditar]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'cedulaRuc' || name === 'celular') {
      if (!/^\d*$/.test(value)) return;
    }

    setFormData(prev => ({ 
        ...prev, 
        [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const datosParaEnviar = {
        nombre: formData.razonSocial,
        email: formData.email,
        telefono: formData.celular,
        direccion: formData.direccion,
        empresa: formData.cedulaRuc,
        // Conservamos los valores de crédito intactos si es un vendedor
        permiteCredito: canEditCredit ? formData.permiteCredito : (clienteAEditar?.permiteCredito || false),
        limiteCredito: canEditCredit ? (formData.permiteCredito ? Number(formData.limiteCredito) : 0) : (clienteAEditar?.limiteCredito || 0)
      };

      let error;

      if (clienteAEditar && clienteAEditar.id) {
        const { error: updateError } = await supabase
          .from('clientes')
          .update(datosParaEnviar)
          .eq('id', clienteAEditar.id); 
        error = updateError;
      } else {
        const { data: existentes } = await supabase
          .from('clientes')
          .select('id')
          .or(`nombre.eq.${formData.razonSocial},empresa.eq.${formData.cedulaRuc}`);
          
        const { error: insertError } = await supabase
          .from('clientes')
          .insert([datosParaEnviar])
          .select(); 
        
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: (clienteAEditar && clienteAEditar.id) ? "✅ Cliente Actualizado" : "✅ Cliente Registrado",
        description: `Los datos de ${formData.razonSocial} se guardaron correctamente.`,
        duration: 3000,
      });

      if (onSuccess) {
        const { data: nuevoCliente } = await supabase
            .from('clientes')
            .select('*')
            .eq('nombre', formData.razonSocial)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
        onSuccess(nuevoCliente); 
      }
      if (onCancel) onCancel();
      
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: error.message || "Ocurrió un error inesperado.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden w-full max-w-3xl mx-auto max-h-[90vh] flex flex-col"
    >
      <div className="bg-slate-800 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <User className="h-5 w-5 text-blue-400" />
            {clienteAEditar ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {clienteAEditar ? 'Modifique los datos necesarios.' : 'Ingrese la información del nuevo cliente.'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-300 hover:text-white hover:bg-slate-700">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
          <form id="client-form" onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  Razón Social / Nombre
                </label>
                <input required name="razonSocial" value={formData.razonSocial} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Juan Pérez o Empresa S.A." />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" /> Cédula o RUC
                </label>
                <input required name="cedulaRuc" value={formData.cedulaRuc} onChange={handleChange} maxLength={13} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: 0991234567001" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" /> Celular / Teléfono
                </label>
                <input required name="celular" value={formData.celular} onChange={handleChange} maxLength={10} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: 0991234567" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" /> Correo Electrónico
                </label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" placeholder="cliente@ejemplo.com" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" /> Dirección
                </label>
                <textarea name="direccion" value={formData.direccion} onChange={handleChange} rows="2" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Dirección completa..." />
              </div>
            </div>

            {/* 🔥 SECCIÓN DE CRÉDITO DINÁMICA SEGÚN EL ROL 🔥 */}
            {canEditCredit ? (
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 mt-6">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-indigo-600" /> Configuración de Crédito Financiero
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Define si este cliente está autorizado para generar órdenes a crédito y su límite máximo permitido en dólares.</p>
                    
                    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                        <label className="flex items-center gap-3 cursor-pointer group bg-white p-3 rounded-md border border-slate-200 hover:border-indigo-400 transition-colors w-full sm:w-auto shadow-sm">
                            <div className="relative flex items-center">
                                <input type="checkbox" name="permiteCredito" checked={formData.permiteCredito} onChange={handleChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                            <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">Autorizar Crédito</span>
                        </label>

                        {formData.permiteCredito && (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-300 w-full sm:w-auto">
                                <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1 mb-1.5">
                                    <DollarSign className="h-3 w-3 text-green-600" /> Límite Máximo Aprobado
                                </label>
                                <input 
                                    type="number" min="0" step="0.01" 
                                    name="limiteCredito" 
                                    value={formData.limiteCredito} 
                                    onChange={handleChange} 
                                    className="w-full sm:w-48 px-3 py-2 border-2 border-green-400 focus:border-green-600 rounded-md outline-none text-lg font-bold text-green-700 shadow-inner" 
                                />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 mt-6 opacity-80 pointer-events-none">
                   <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                       <CreditCard className="h-4 w-4 text-slate-400" /> Estado de Crédito Actual
                   </h3>
                   <div className="bg-white p-3 rounded-md border border-slate-200">
                       <p className="text-sm font-bold text-slate-700">
                           {formData.permiteCredito 
                               ? `✅ Crédito Autorizado por $${formData.limiteCredito}` 
                               : '🚫 Sin crédito autorizado.'}
                       </p>
                   </div>
                   <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                       🔒 Solo el área de Contabilidad o Administración pueden modificar el crédito.
                   </p>
                </div>
            )}

          </form>
      </div>

      <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" form="client-form" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 min-w-[140px]" disabled={loading}>
          {loading ? 'Guardando...' : (clienteAEditar ? 'Actualizar Cliente' : 'Guardar Cliente')}
        </Button>
      </div>
    </motion.div>
  );
};

export default ClientForm;