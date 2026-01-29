
import React, { useState } from 'react';
import { Save, X, User, Mail, MapPin, Phone, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const ClientForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    razonSocial: '',
    email: '',
    cedulaRuc: '',
    direccion: '',
    celular: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
    >
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Nuevo Cliente</h2>
          <p className="text-sm text-slate-500">Ingrese la información del cliente para registrarlo en el sistema.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-5 w-5 text-slate-400" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Razón Social */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" /> Razón Social / Nombre Completo
            </label>
            <input
              required
              name="razonSocial"
              value={formData.razonSocial}
              onChange={handleChange}
              placeholder="Ej: Empresa S.A. o Juan Pérez"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* CED/RUC */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" /> Cédula o RUC
            </label>
            <input
              required
              name="cedulaRuc"
              value={formData.cedulaRuc}
              onChange={handleChange}
              placeholder="Ej: 1712345678001"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Celular */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" /> Celular / Teléfono
            </label>
            <input
              required
              name="celular"
              value={formData.celular}
              onChange={handleChange}
              placeholder="Ej: 0991234567"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Email */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" /> Correo Electrónico
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="correo@ejemplo.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Dirección */}
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" /> Dirección
            </label>
            <textarea
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Dirección completa del cliente..."
              rows="3"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Save className="h-4 w-4" /> Guardar Cliente
          </Button>
        </div>
      </form>
    </motion.div>
  );
};

export default ClientForm;
