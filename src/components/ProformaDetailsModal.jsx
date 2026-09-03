import React, { useState } from 'react';
import { X, Printer, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

// --- 🔥 FUNCIÓN ESTRICTA PARA LIMPIAR NOTAS DEL PDF 🔥 ---
const getPrintDesc = (prod) => {
    const text = prod.descripcion || prod.nombre || '';
    // Cortamos automáticamente todo desde la palabra "Nota:" (con o sin corchetes)
    return text.split(/\[?nota:/i)[0].trim();
};

// 🔧 NUEVO: separa "NOMBRE DEL PRODUCTO - descripción extra" en sus dos
// partes, mismo criterio que en Órdenes de Producción y en el PDF de la
// proforma — nombre arriba en negrita, descripción extra abajo chica y gris.
const getPrintDescParts = (prod) => {
    const textoCompleto = getPrintDesc(prod);
    const idx = textoCompleto.indexOf(' - ');
    if (idx === -1) return { nombre: textoCompleto, detalle: '' };
    return {
        nombre: textoCompleto.slice(0, idx).trim(),
        detalle: textoCompleto.slice(idx + 3).trim()
    };
};

const ProformaDetailsModal = ({ 
  proforma, 
  onClose, 
  onConvert, 
  onEdit,
  user
}) => {
  const [converting, setConverting] = useState(false);

  if (!proforma) return null;

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  const formatDate = (dateString) => {
    try { 
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); 
    } catch { return '-'; }
  };

  const fin = proforma.financials || {};
  
  // 🔥 SOLUCIÓN AL ERROR DE PORCENTAJE 100% / 0% 🔥
  // Validamos de forma estricta para que el 0% no sea reemplazado por 50%
  const anticipoPorcVal = (fin.anticipoPorc !== undefined && fin.anticipoPorc !== null && fin.anticipoPorc !== '') ? Number(fin.anticipoPorc) : 50;
  const saldoPorcVal = (fin.saldoPorc !== undefined && fin.saldoPorc !== null && fin.saldoPorc !== '') ? Number(fin.saldoPorc) : (100 - anticipoPorcVal);

  const data = {
    numero: proforma.proformaNumber || proforma.numero || proforma.id,
    cliente: proforma.cliente_nombre || 'Cliente General',
    ruc: proforma.cliente_identificacion || proforma.ruc || '9999999999999',
    telefono: proforma.cliente_telefono || '',
    direccion: proforma.cliente_direccion || 'S/N',
    email: proforma.cliente_email || '',
    autor: proforma.responsable || proforma.responsable_nombre || 'Sistema',
    fechaCreacion: proforma.createdAt || proforma.created_at || new Date(),
    descripcion: proforma.notas || '',
    titulo: proforma.titulo || proforma.tipo_trabajo || '',
    status: proforma.status,
    financials: {
        subtotal: Number(proforma.subtotal || fin.subtotal || 0),
        descuentoVal: Number(fin.descuento || 0),
        descuentoPorc: Number(fin.descuentoPorc || 0),
        iva: Number(proforma.iva || fin.iva || 0),
        total: Number(proforma.total || fin.total || 0),
        ivaPercentage: Number(proforma.iva_percentage || fin.ivaPercentage || 15),
        anticipoPorc: anticipoPorcVal,
        anticipoValor: Number(fin.anticipoValor || 0),
        saldoPorc: saldoPorcVal,
        saldoValor: Number(fin.saldoValor || 0),
        diasEntrega: Number(fin.diasEntrega || proforma.dias_entrega || 0)
    },
    productos: proforma.items || []
  };

  if (data.financials.anticipoValor === 0 && data.financials.total > 0) {
      data.financials.anticipoValor = data.financials.total * (data.financials.anticipoPorc / 100);
      data.financials.saldoValor = data.financials.total - data.financials.anticipoValor;
  }

  const handleConvertClick = async () => {
    setConverting(true);
    await onConvert(proforma); 
    setConverting(false);
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 1. VISTA EN PANTALLA (WEB)                               */}
      {/* ======================================================== */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 print:hidden">
        <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
          
          <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="h-6 w-6 text-slate-400"/>
                      Cotización / Proforma #{String(data.numero).padStart(6, '0')}
                  </h2>
                  <span className={`px-2 py-1 rounded text-xs font-bold border ${data.status === 'APROBADA' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {data.status}
                  </span>
              </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 border-slate-300">
                    <Printer className="h-4 w-4" /> Imprimir (SRI)
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200 text-slate-500">
                  <X className="h-5 w-5" />
                </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Cliente</span>
                      <div className="font-bold text-slate-800 text-lg uppercase">{data.cliente}</div>
                      {data.ruc && <div className="text-sm text-slate-500">ID: {data.ruc}</div>}
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                      {data.titulo && <div><strong>Proyecto:</strong> {data.titulo}</div>}
                      {data.financials.diasEntrega > 0 && <div><strong>Entrega:</strong> {data.financials.diasEntrega} Días Laborables</div>}
                      {data.email && <div>✉️ {data.email}</div>}
                      {data.telefono && <div>📞 {data.telefono}</div>}
                  </div>
              </div>

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
                                      <td className="px-4 py-2 font-medium uppercase whitespace-pre-wrap">
                                          {(() => {
                                              const { nombre, detalle } = getPrintDescParts(prod);
                                              return (
                                                  <>
                                                      <div className="font-bold">{nombre}</div>
                                                      {detalle && <div className="font-normal normal-case text-xs text-slate-500 mt-0.5">{detalle}</div>}
                                                  </>
                                              );
                                          })()}
                                      </td>
                                      <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(prod.precioUnitario)}</td>
                                      <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatCurrency(prod.total || (prod.cantidad * prod.precioUnitario))}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* 🔥 FOTOS EN VISTA PANTALLA 🔥 */}
              {proforma.imagenes && proforma.imagenes.length > 0 && (
                  <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Artes Adjuntos</h3>
                      <div className="flex flex-wrap gap-4">
                          {proforma.imagenes.map((img, i) => (
                              <a key={i} href={img.url} target="_blank" rel="noreferrer" className="relative w-24 h-24 border border-slate-300 rounded shadow-sm overflow-hidden block hover:opacity-80 transition-opacity">
                                  <img src={img.url} alt="Referencia" className="w-full h-full object-cover" />
                              </a>
                          ))}
                      </div>
                  </div>
              )}

              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                  <div className="w-full md:w-1/2 space-y-4">
                      {data.descripcion && (
                          <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg text-sm text-yellow-800">
                              <span className="font-bold block mb-1">Notas / Condiciones Comerciales:</span>
                              <span className="whitespace-pre-line">{data.descripcion}</span>
                          </div>
                      )}
                      
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-sm text-slate-700">
                          <span className="font-bold block mb-2 uppercase text-xs text-slate-500 tracking-wider">Forma de Pago</span>
                          <div className="flex justify-between items-center font-bold mb-1">
                              <span>Anticipo {data.financials.anticipoPorc}%:</span>
                              <span>{formatCurrency(data.financials.anticipoValor)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-500">
                              <span>Saldo contra entrega {data.financials.saldoPorc}%:</span>
                              <span>{formatCurrency(data.financials.saldoValor)}</span>
                          </div>
                      </div>
                  </div>

                  <div className="w-full md:w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 shrink-0">
                      <div className="flex justify-between text-sm text-slate-600">
                          <span>Subtotal</span>
                          <span>{formatCurrency(data.financials.subtotal)}</span>
                      </div>
                      {data.financials.descuentoVal > 0 && (
                          <div className="flex justify-between text-sm text-red-500 font-bold">
                              <span>Dscto {data.financials.descuentoPorc > 0 ? `(${data.financials.descuentoPorc}%)` : ''}</span>
                              <span>-{formatCurrency(data.financials.descuentoVal)}</span>
                          </div>
                      )}
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
          </div>

          <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center gap-3 flex-shrink-0 print:hidden">
              <div className="flex gap-2">
                  {data.status === 'BORRADOR' && onEdit && (
                      <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => onEdit(proforma)}>Editar Cotización</Button>
                  )}
              </div>
              <div className="flex gap-2">
                  <Button variant="secondary" onClick={onClose}>Cerrar</Button>
                  {data.status === 'BORRADOR' && (
                      <Button 
                          onClick={handleConvertClick} disabled={converting}
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

      {/* ======================================================== */}
      {/* 2. VISTA DE IMPRESIÓN (PROFORMA SRI)                     */}
      {/* ======================================================== */}
      <div className="hidden print:block absolute top-0 left-0 w-full bg-white z-[9999]" style={{ minHeight: '100vh', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div className="w-full max-w-[850px] mx-auto p-4 font-sans text-[11px] leading-snug text-black">
                
                {/* HEADER */}
                <div className="grid grid-cols-[1fr_2fr] gap-6 mb-4 w-full items-center">
                    {/* IZQUIERDA: Solo Logo */}
                    <div className="w-full flex items-center justify-center p-2">
                        <img src="/logo.png" alt="Rótulos ADR" className="max-h-[110px] max-w-full object-contain" />
                    </div>

                    {/* DERECHA: Toda la info de empresa agrupada */}
                    <div className="w-full border border-black rounded-xl p-3 flex flex-col text-center shadow-sm">
                        <div className="font-bold text-[16px] mb-1 uppercase tracking-wider">ADRCOMPANY SAS</div>
                        <div className="text-[11px] leading-tight text-slate-800">
                            AV. ZENON MACIAS 306 Y CALLE LA MERCED • PLAYAS - GUAYAS
                        </div>
                        <div className="text-[11px] leading-tight mb-2 text-slate-800">
                            <span className="font-bold">Tel:</span> +593 98 265 7066 &nbsp;|&nbsp; <span className="font-bold">Email:</span> imprenta_milena@hotmail.com
                        </div>
                        
                        <div className="border-t border-black pt-2 mt-1 flex justify-around items-center">
                            <div className="text-sm"><span className="font-bold">R.U.C.:</span> 0993397285001</div>
                            <div className="text-xl font-black tracking-widest uppercase">PROFORMA</div>
                            <div className="text-[14px]"><span className="font-bold">No.</span> {String(data.numero).padStart(7, '0')}</div>
                        </div>
                    </div>
                </div>

                {/* DATOS DEL CLIENTE */}
                <div className="border border-black rounded-xl p-3 mb-4 w-full">
                    <div className="grid grid-cols-[2fr_1fr] gap-4 w-full">
                        <div className="space-y-1">
                            <div><span className="font-bold">Razón Social / Nombres:</span> <span className="uppercase">{data.cliente}</span></div>
                            <div><span className="font-bold">Identificación:</span> {data.ruc}</div>
                            <div><span className="font-bold">Fecha:</span> {formatDate(data.fechaCreacion)}</div>
                            <div><span className="font-bold">Dirección:</span> {data.direccion}</div>
                        </div>
                        <div className="space-y-1">
                            <div><span className="font-bold">Guía Remisión:</span></div>
                            <div><span className="font-bold">Ref/Proyecto:</span> <span className="uppercase">{data.titulo}</span></div>
                            <div><span className="font-bold">Vendedor:</span> <span className="uppercase">{data.autor}</span></div>
                        </div>
                    </div>
                </div>

                {/* TABLA DE PRODUCTOS */}
                <div className="mb-4 w-full min-h-[120px]">
                    <table className="w-full border-collapse border border-black">
                        <thead>
                            <tr className="border-b border-black bg-gray-100">
                                <th className="border-r border-black p-1.5 font-bold text-center w-16">Cod. Principal</th>
                                <th className="border-r border-black p-1.5 font-bold text-center w-12">Cant.</th>
                                <th className="border-r border-black p-1.5 font-bold text-left">Descripción</th>
                                <th className="border-r border-black p-1.5 font-bold text-right w-20">Precio Unitario</th>
                                <th className="border-r border-black p-1.5 font-bold text-right w-16">Descuento</th>
                                <th className="p-1.5 font-bold text-right w-20">Precio Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.productos.map((prod, idx) => (
                                <tr key={idx} className="border-b border-black">
                                    <td className="border-r border-black p-1.5 text-center">P{String(idx+1).padStart(3,'0')}</td>
                                    <td className="border-r border-black p-1.5 text-center">{prod.cantidad}</td>
                                    <td className="border-r border-black p-1.5 uppercase whitespace-pre-wrap">
                                        {(() => {
                                            const { nombre, detalle } = getPrintDescParts(prod);
                                            return (
                                                <>
                                                    <div className="font-bold">{nombre}</div>
                                                    {detalle && <div className="font-normal normal-case text-[10px] text-gray-500 mt-0.5">{detalle}</div>}
                                                </>
                                            );
                                        })()}
                                    </td>
                                    <td className="border-r border-black p-1.5 text-right">{formatCurrency(prod.precioUnitario)}</td>
                                    <td className="border-r border-black p-1.5 text-right">$0.00</td>
                                    <td className="p-1.5 text-right">{formatCurrency(prod.total || (prod.cantidad * prod.precioUnitario))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* IMÁGENES DE REFERENCIA EN MEDIO (SI HAY) */}
                {proforma.imagenes && proforma.imagenes.length > 0 && (
                    <div className="mb-4 pt-2" style={{ pageBreakInside: 'avoid' }}>
                        <div className="font-bold text-[11px] mb-2 uppercase border-b border-black inline-block pb-0.5">Artes / Referencias Adjuntas:</div>
                        <div className="flex flex-wrap gap-4 items-start justify-center">
                            {proforma.imagenes.map((img, i) => (
                                <img key={i} src={img.url} alt="Arte" className="max-w-[48%] max-h-[220px] object-contain border border-gray-300 rounded shadow-sm" />
                            ))}
                        </div>
                    </div>
                )}

                {/* BLOQUE INFERIOR DIVIDIDO EN 2 */}
                <div className="grid grid-cols-2 gap-4 w-full items-start" style={{ pageBreakInside: 'avoid' }}>
                    <div className="w-full">
                        
                        {/* 🔥 NOTAS AÑADIDAS ENCIMA DE LA TABLA (Sin cuadro adicional) 🔥 */}
                        {data.descripcion && (
                            <div className="mb-3 text-[11px] text-slate-800">
                                <span className="font-bold block mb-0.5">Notas / Condiciones Adicionales:</span>
                                <span className="whitespace-pre-line block">{data.descripcion}</span>
                            </div>
                        )}

                        <div className="border border-black rounded-xl overflow-hidden w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-black bg-gray-100">
                                        <th className="p-2 font-bold border-r border-black w-[70%]">Condiciones de Pago</th>
                                        <th className="p-2 font-bold text-right w-[30%]">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-black">
                                        <td className="p-2 border-r border-black uppercase text-[10px]">ANTICIPO REQUERIDO ({data.financials.anticipoPorc}%)</td>
                                        <td className="p-2 text-right font-bold">{formatCurrency(data.financials.anticipoValor)}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-2 border-r border-black uppercase text-[10px]">SALDO CONTRA ENTREGA ({data.financials.saldoPorc}%)</td>
                                        <td className="p-2 text-right font-bold">{formatCurrency(data.financials.saldoValor)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="mt-3 px-1">
                            <p className="italic text-[12px] font-medium text-slate-800">
                                Tiempo de entrega estimado: {data.financials.diasEntrega > 0 ? `${data.financials.diasEntrega} días laborables` : 'Por Definir'}.
                            </p>
                            <p className="italic text-[10px] text-gray-500 mt-0.5">Validez de la cotización: 15 días.</p>
                        </div>
                    </div>

                    <div className="w-full">
                        <table className="w-full border-collapse border border-black text-[11px]">
                            <tbody>
                                <tr className="border-b border-black">
                                    <td className="p-1.5 border-r border-black">SUBTOTAL {data.financials.ivaPercentage}%</td>
                                    <td className="p-1.5 text-right">{formatCurrency(data.financials.subtotal)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1.5 border-r border-black">SUBTOTAL 0%</td>
                                    <td className="p-1.5 text-right">$0.00</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1.5 border-r border-black">SUBTOTAL SIN IMP.</td>
                                    <td className="p-1.5 text-right">{formatCurrency(data.financials.subtotal)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                    <td className="p-1.5 border-r border-black">TOTAL Descuento</td>
                                    <td className="p-1.5 text-right text-red-600">-{formatCurrency(data.financials.descuentoVal)}</td>
                                </tr>
                                <tr className="border-b border-black bg-gray-50">
                                    <td className="p-1.5 border-r border-black font-bold">IVA {data.financials.ivaPercentage}%</td>
                                    <td className="p-1.5 text-right font-bold">{formatCurrency(data.financials.iva)}</td>
                                </tr>
                                <tr>
                                    <td className="p-2 border-r border-black font-black text-sm">VALOR TOTAL</td>
                                    <td className="p-2 text-right font-black text-sm">{formatCurrency(data.financials.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
          </div>
      </div>
    </>
  );
};

export default ProformaDetailsModal;