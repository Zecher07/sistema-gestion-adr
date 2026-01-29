
import React, { useState } from 'react';
import { Search, UserPlus, FileSpreadsheet, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ClientsPanel = ({ clients = [], onCreateNew }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado de clientes
  const filteredClients = clients.filter(client => 
    client.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cedulaRuc.includes(searchTerm) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return '-'; }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '-'; }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex gap-2 w-full md:w-auto">
             <Button onClick={onCreateNew} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full md:w-auto">
               <UserPlus className="h-4 w-4" /> Nuevo Cliente
             </Button>
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
             <Button variant="outline" size="sm" className="gap-2 text-slate-600">
               <FileSpreadsheet className="h-4 w-4 text-green-600" /> Exportar
             </Button>
             <Button variant="outline" size="sm" className="gap-2 text-slate-600" onClick={() => window.print()}>
               <Printer className="h-4 w-4 text-slate-600" /> Imprimir
             </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, RUC o email..." 
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-bold">Razón Social</th>
                <th className="px-6 py-3 font-bold">Email</th>
                <th className="px-6 py-3 font-bold">CED / RUC</th>
                <th className="px-6 py-3 font-bold">Dirección</th>
                <th className="px-6 py-3 font-bold">Celular</th>
                <th className="px-6 py-3 font-bold">Fecha</th>
                <th className="px-6 py-3 font-bold">Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {client.razonSocial}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {client.email || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {client.cedulaRuc}
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={client.direccion}>
                      {client.direccion || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {client.celular}
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      {formatDate(client.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap text-xs">
                      {formatTime(client.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                    No se encontraron clientes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500">
          Total de registros: {filteredClients.length}
        </div>
      </div>
    </div>
  );
};

export default ClientsPanel;
