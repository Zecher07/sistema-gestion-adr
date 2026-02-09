import React, { useState } from 'react';
import { X, Printer, CheckCircle2, FileText, User, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area'; <--- LINEA ELIMINADA PORQUE DABA ERROR
import ProformaPrintTemplate from './ProformaPrintTemplate';

const ProformaDetailsModal = ({ 
  proforma, 
  onClose, 
  onConvert, 
  onEdit,
  user
}) => {
  const [converting, setConverting] = useState(false);

  if (!proforma) return null;

  // Helpers de formato
  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  const formatDate = (dateString) => {
    try { return new Date(dateString).toLocaleDateString('es-ES'); } catch { return '-'; }
  };

  // Mapeo seguro de datos
  const data = {
    numero: proforma.proformaNumber || proforma.numero || proforma.id,
    cliente: proforma.cliente_nombre || 'Cliente General',
    ruc: proforma.cliente_identificacion || proforma.ruc || '',
    telefono: proforma.cliente_telefono || '',
    direccion: proforma.cliente_direccion || '',
    email: proforma.cliente_email || '',
    autor: proforma.responsable || proforma.responsable_nombre || 'Sistema',
    fechaCreacion: proforma.createdAt || proforma.created_at,
    descripcion: proforma.notas || '',
    status: proforma.status,
    financials: {
        subtotal: Number(proforma.subtotal || proforma.financials?.subtotal || 0),
        iva: Number(proforma.iva || proforma.financials?.iva || 0),
        total: Number(proforma.total || proforma.financials?.total || 0),
        ivaPercentage: Number(proforma.iva_percentage || proforma.financials?.ivaPercentage || 15)
    },
    productos: proforma.items || []
  };

  // Handler para convertir
  const handleConvertClick = async () => {
    setConverting(true);
    await onConvert(proforma); 
    setConverting(false);
  };

  return (
    <>
      {/* ESTE COMPONENTE SOLO SE VE AL IMPRIMIR */}
      <ProformaPrintTemplate data={data} />

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 print:hidden">
        <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
          
          {/* HEADER */}
          <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="h-6 w-6 text-slate-400"/>
                      Proforma #{String(data.numero).padStart(6, '0')}
                  </h2>
                  <span className={`px-2 py-1 rounded text-xs font-bold border ${data.status === 'APROBADA' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {data.status}
                  </span>
              </div>
              <p className="text-slate-500 text-sm flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> Creada el {formatDate(data.fechaCreacion)} por {data.autor}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200">
              <X className="h-6 w-6 text-slate-500" />
            </Button>
          </div>

          {/* CONTENIDO CON SCROLL (CORREGIDO: Usamos un div normal en lugar de ScrollArea) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">

              {/* DATOS CLIENTE */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Cliente</span>
                      <div className="font-bold text-slate-800 text-lg">{data.cliente}</div>
                      {data.ruc && <div className="text-sm text-slate-500">ID: {data.ruc}</div>}
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                      {data.email && <div>✉️ {data.email}</div>}
                      {data.telefono && <div>📞 {data.telefono}</div>}
                      {data.direccion && <div>📍 {data.direccion}</div>}
                  </div>
              </div>

              {/* TABLA PRODUCTOS */}
              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Items Cotizados</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                          <thead className="bg-slate-100 text-slate-600 font-semibold">
                              <tr>
                                  <th className="px-4 py-2 text-center w-16">Cant.</th>
                                  <th className="px-4 py-2 text-left">Descripción</th>
                                  <th className="px-4 py-2 text-right">P. Unit</th>
                                  <th className="px-4 py-2 text-right">Total</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {data.productos.map((prod, idx) => (
                                  <tr key={idx}>
                                      <td className="px-4 py-2 text-center text-slate-500">{prod.cantidad}</td>
                                      <td className="px-4 py-2 font-medium uppercase">{prod.descripcion}</td>
                                      <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(prod.precioUnitario)}</td>
                                      <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatCurrency(prod.cantidad * prod.precioUnitario)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* TOTALES */}
              <div className="flex justify-end">
                  <div className="w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between text-sm text-slate-600">
                          <span>Subtotal</span>
                          <span>{formatCurrency(data.financials.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
                          <span>IVA ({data.financials.ivaPercentage}%)</span>
                          <span>{formatCurrency(data.financials.iva)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-300 pt-2">
                          <span>Total</span>
                          <span>{formatCurrency(data.financials.total)}</span>
                      </div>
                  </div>
              </div>

              {/* NOTAS */}
              {data.descripcion && (
                  <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-sm text-yellow-800">
                      <span className="font-bold block mb-1">Notas / Condiciones:</span>
                      {data.descripcion}
                  </div>
              )}

          </div>

          {/* FOOTER ACCIONES */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-3 flex-shrink-0">
              <div className="flex gap-2">
                  <Button variant="outline" onClick={() => window.print()} className="gap-2">
                      <Printer className="h-4 w-4" /> Imprimir Proforma
                  </Button>
                  {data.status === 'BORRADOR' && onEdit && (
                      <Button variant="ghost" onClick={() => onEdit(proforma)}>Editar</Button>
                  )}
              </div>

              <div className="flex gap-2">
                  <Button variant="secondary" onClick={onClose}>Cerrar</Button>
                  
                  {/* BOTÓN MÁGICO: APROBAR */}
                  {data.status === 'BORRADOR' && (
                      <Button 
                          onClick={handleConvertClick} 
                          disabled={converting}
                          className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-md hover:scale-105 transition-all"
                      >
                          {converting ? 'Procesando...' : 'Aprobar y Crear Orden'}
                          {!converting && <CheckCircle2 className="h-4 w-4" />}
                      </Button>
                  )}
              </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default ProformaDetailsModal;