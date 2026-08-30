import React, { useState, useEffect } from 'react';
import { Save, X, User, Mail, MapPin, Phone, FileText, DollarSign, CreditCard, ShieldAlert, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

const ClientForm = ({ onCancel, clienteAEditar = null, onSuccess, user }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // 🔥 VALIDACIÓN DE ROL PARA CRÉDITO Y TARIFA MAYORISTA 🔥
  const canEditCredit = user?.role === 'Administrador' || user?.role === 'Contabilidad';
  const isAdmin = user?.role === 'Administrador';

  const [formData, setFormData] = useState({
    razonSocial: '',
    email: '',
    cedulaRuc: '',
    sinRuc: false,
    sinCelular: false,
    sinEmail: false,
    direccion: '',
    celular: '',
    permiteCredito: false, 
    limiteCredito: 0,
    esMayorista: false // 🔥 Nuevo campo de estado 🔥
  });

  const RUCS_DE_RELLENO = ['099999999999', '0999999999', '9999999999', '9999999999999'];
  const EMAIL_DE_RELLENO = 'sincorreo@gmail.com';

  useEffect(() => {
    if (clienteAEditar) {
      const rucViejo = clienteAEditar.empresa || '';
      const emailViejo = clienteAEditar.email || '';
      setFormData({
        razonSocial: clienteAEditar.nombre || '',
        email: EMAIL_DE_RELLENO === emailViejo.toLowerCase() ? '' : emailViejo,
        sinEmail: !emailViejo || EMAIL_DE_RELLENO === emailViejo.toLowerCase(),
        cedulaRuc: RUCS_DE_RELLENO.includes(rucViejo) ? '' : rucViejo,
        sinRuc: !rucViejo || RUCS_DE_RELLENO.includes(rucViejo),
        direccion: clienteAEditar.direccion || '',
        celular: clienteAEditar.telefono || '',
        sinCelular: !clienteAEditar.telefono,
        permiteCredito: clienteAEditar.permiteCredito || false,
        limiteCredito: clienteAEditar.limiteCredito || 0,
        esMayorista: clienteAEditar.es_mayorista || false // Rescatar estado de la BD
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
        email: formData.sinEmail ? null : formData.email,
        telefono: formData.sinCelular ? null : formData.celular,
        direccion: formData.direccion,
        empresa: formData.sinRuc ? null : formData.cedulaRuc,
        // Conservamos los valores de crédito intactos si no es admin/contabilidad
        permiteCredito: canEditCredit ? formData.permiteCredito : (clienteAEditar?.permiteCredito || false),
        limiteCredito: canEditCredit ? (formData.permiteCredito ? Number(formData.limiteCredito) : 0) : (clienteAEditar?.limiteCredito || 0),
        // Conservamos el valor de mayorista si no es admin
        es_mayorista: isAdmin ? formData.esMayorista : (clienteAEditar?.es_mayorista || false)
      };

      let error;

      if (clienteAEditar && clienteAEditar.id) {
        const { error: updateError } = await supabase
          .from('clientes')
          .update(datosParaEnviar)
          .eq('id', clienteAEditar.id); 
        error = updateError;
      } else {
        // 🔧 FIX: esta búsqueda de duplicados ya existía, pero su resultado
        // nunca se revisaba. Ahora si encuentra un cliente con el mismo
        // nombre EXACTO, o el mismo RUC/Cédula REAL, avisa y no deja crear
        // otro. Si marcaste "Sin RUC/Cédula", el valor se guarda como NULL de
        // verdad — nunca cuenta como coincidencia entre distintos clientes.
        let filtroExistentes = `nombre.eq.${formData.razonSocial}`;
        if (!formData.sinRuc && formData.cedulaRuc) {
            filtroExistentes += `,empresa.eq.${formData.cedulaRuc}`;
        }

        const { data: existentes } = await supabase
          .from('clientes')
          .select('id, nombre, empresa')
          .or(filtroExistentes);

        if (existentes && existentes.length > 0) {
          const coincidencia = existentes[0];
          toast({
            variant: "destructive",
            title: "⚠️ Cliente ya existe",
            description: `Ya hay un cliente registrado como "${coincidencia.nombre}" (RUC/CI: ${coincidencia.empresa || 'sin RUC'}). Búscalo y edítalo en vez de crear uno nuevo.`,
            duration: 6000,
          });
          setLoading(false);
          return;
        }

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
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" /> Cédula o RUC
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                        <input type="checkbox" name="sinRuc" checked={formData.sinRuc} onChange={(e) => setFormData(prev => ({ ...prev, sinRuc: e.target.checked, cedulaRuc: e.target.checked ? '' : prev.cedulaRuc }))} className="h-3.5 w-3.5" />
                        Sin RUC/Cédula
                    </label>
                </div>
                <input required={!formData.sinRuc} disabled={formData.sinRuc} name="cedulaRuc" value={formData.cedulaRuc} onChange={handleChange} maxLength={13} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" placeholder="Ej: 0991234567001" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" /> Celular / Teléfono
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                        <input type="checkbox" name="sinCelular" checked={formData.sinCelular} onChange={(e) => setFormData(prev => ({ ...prev, sinCelular: e.target.checked, celular: e.target.checked ? '' : prev.celular }))} className="h-3.5 w-3.5" />
                        Sin Teléfono
                    </label>
                </div>
                <input required={!formData.sinCelular} disabled={formData.sinCelular} name="celular" value={formData.celular} onChange={handleChange} maxLength={10} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" placeholder="Ej: 0991234567" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" /> Correo Electrónico {!formData.sinEmail && <span className="text-red-500">*</span>}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                        <input type="checkbox" name="sinEmail" checked={formData.sinEmail} onChange={(e) => setFormData(prev => ({ ...prev, sinEmail: e.target.checked, email: e.target.checked ? '' : prev.email }))} className="h-3.5 w-3.5" />
                        Sin Correo
                    </label>
                </div>
                <input required={!formData.sinEmail} disabled={formData.sinEmail} type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" placeholder="cliente@ejemplo.com" />
                <p className="text-[11px] text-slate-400">Se usa para la facturación electrónica — márcalo "Sin Correo" solo si el cliente de verdad no tiene.</p>
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
                       <ShieldAlert className="h-3 w-3" /> Solo el área de Contabilidad o Administración pueden modificar el crédito.
                   </p>
                </div>
            )}

            {/* 🔥 SECCIÓN DE TARIFA MAYORISTA DINÁMICA SEGÚN EL ROL 🔥 */}
            {isAdmin ? (
                <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200 mt-4">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <Star className="h-4 w-4 text-indigo-600" /> Clasificación Comercial
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">Define si este cliente recibe precios especiales de distribuidor automáticamente en el sistema.</p>
                    
                    <label className="flex items-center gap-3 cursor-pointer group bg-white p-3 rounded-md border border-slate-200 hover:border-indigo-400 transition-colors w-full sm:w-auto shadow-sm">
                        <div className="relative flex items-center">
                            <input type="checkbox" name="esMayorista" checked={formData.esMayorista} onChange={handleChange} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </div>
                        <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-700">Cliente Mayorista (Distribuidor)</span>
                    </label>
                </div>
            ) : (
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 mt-4 opacity-80 pointer-events-none">
                   <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                       <Star className="h-4 w-4 text-slate-400" /> Clasificación Comercial Actual
                   </h3>
                   <div className="bg-white p-3 rounded-md border border-slate-200">
                       <p className="text-sm font-bold text-slate-700">
                           {formData.esMayorista 
                               ? '🏷️ Tarifa Mayorista Activa (Aplica descuentos automáticos)' 
                               : '👤 Tarifa de Consumidor Final.'}
                       </p>
                   </div>
                   <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                       <ShieldAlert className="h-3 w-3" /> Solo el área de Administración puede modificar esta clasificación.
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