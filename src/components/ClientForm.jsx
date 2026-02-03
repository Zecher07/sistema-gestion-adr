import React, { useState, useEffect } from 'react';
import { Save, X, User, Mail, MapPin, Phone, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
// BORRADO: import { useNavigate } from 'react-router-dom'; (Causaba el error)
import { useToast } from '@/components/ui/use-toast';

export function ClientForm({ onCancel, clienteAEditar = null, onSuccess }) {
  // BORRADO: const navigate = useNavigate(); (Causaba el error)
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    razonSocial: '',
    email: '',
    cedulaRuc: '',
    direccion: '',
    celular: ''
  });

  useEffect(() => {
    if (clienteAEditar) {
      setFormData({
        razonSocial: clienteAEditar.nombre || '',
        email: clienteAEditar.email || '',
        cedulaRuc: clienteAEditar.empresa || '', // Mapeamos 'empresa' a 'cedulaRuc'
        direccion: clienteAEditar.direccion || '',
        celular: clienteAEditar.telefono || ''   // Mapeamos 'telefono' a 'celular'
      });
    }
  }, [clienteAEditar]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Validación numérica simple para RUC y Celular
    if (name === 'cedulaRuc' || name === 'celular') {
      if (!/^\d*$/.test(value)) return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
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
        empresa: formData.cedulaRuc
      };

      let error;

      // CORRECCIÓN AQUÍ: Verificamos si existe el ID, no solo el objeto
      if (clienteAEditar && clienteAEditar.id) {
        // --- MODO EDICIÓN (UPDATE) ---
        const { error: updateError } = await supabase
          .from('clientes')
          .update(datosParaEnviar)
          .eq('id', clienteAEditar.id); 
        error = updateError;
      } else {
        // --- MODO CREACIÓN (INSERT) ---
        // Validación de duplicados antes de insertar
        const { data: existentes } = await supabase
          .from('clientes')
          .select('id')
          .or(`nombre.eq.${formData.razonSocial},empresa.eq.${formData.cedulaRuc}`);
          
        if (existentes && existentes.length > 0) {
           // Opcional: Si quieres permitir duplicados borra este if
           // throw new Error("Ya existe un cliente con ese Nombre o RUC.");
        }

        const { error: insertError } = await supabase
          .from('clientes')
          .insert([datosParaEnviar])
          .select(); // Agregamos .select() para que devuelva el cliente creado
        
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: (clienteAEditar && clienteAEditar.id) ? "✅ Cliente Actualizado" : "✅ Cliente Registrado",
        description: `Los datos de ${formData.razonSocial} se guardaron correctamente.`,
        duration: 3000,
      });

      // Lógica de navegación segura
      if (onSuccess) {
        // Buscamos el cliente recién creado para pasarlo al padre
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
      className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden w-full max-w-3xl mx-auto"
    >
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {clienteAEditar ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
          <p className="text-sm text-slate-500">
            {clienteAEditar ? 'Modifique los datos necesarios.' : 'Ingrese la información del nuevo cliente.'}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-5 w-5 text-slate-400" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" /> Razón Social / Nombre
            </label>
            <input
              required
              name="razonSocial"
              value={formData.razonSocial}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej: Juan Pérez o Empresa S.A."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" /> Cédula o RUC
            </label>
            <input
              required
              name="cedulaRuc"
              value={formData.cedulaRuc}
              onChange={handleChange}
              maxLength={13}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej: 0991234567001"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" /> Celular / Teléfono
            </label>
            <input
              required
              name="celular"
              value={formData.celular}
              onChange={handleChange}
              maxLength={10}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej: 0991234567"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" /> Correo Electrónico
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="cliente@ejemplo.com"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" /> Dirección
            </label>
            <textarea
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              rows="3"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Dirección completa..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" disabled={loading}>
            <Save className="h-4 w-4" /> 
            {loading ? 'Guardando...' : (clienteAEditar ? 'Actualizar Cliente' : 'Guardar Cliente')}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

export default ClientForm;