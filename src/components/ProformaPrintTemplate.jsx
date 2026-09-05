import React from 'react';

// --- 🔥 FUNCIÓN 100% INFALIBLE PARA LIMPIAR NOTAS 🔥 ---
const getPrintDesc = (item) => {
    const text = item.descripcion || item.nombre || '';
    // Corta el texto en el momento exacto que encuentra "[Nota:" y se queda solo con la primera parte
    if (text.includes('[Nota:')) {
        return text.split('[Nota:')[0].trim();
    }
    return text.trim();
};

// 🔧 NUEVO: al elegir un producto del catálogo, el texto queda armado como
// "NOMBRE DEL PRODUCTO - descripción extra" (ver ProformaForm.jsx). Esto
// separa las dos partes para poder imprimir el nombre arriba (grande) y la
// descripción extra abajo (chica y gris) — mismo criterio que ya usamos en
// las Órdenes de Producción.
const getPrintDescParts = (item) => {
    const textoCompleto = getPrintDesc(item);
    const idx = textoCompleto.indexOf(' - ');
    if (idx === -1) return { nombre: textoCompleto, detalle: '' };
    return {
        nombre: textoCompleto.slice(0, idx).trim(),
        detalle: textoCompleto.slice(idx + 3).trim()
    };
};

const ProformaPrintTemplate = ({ data }) => {
  if (!data) return null;

  return (
    <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-10 font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-wider text-slate-900">PROFORMA</h1>
          <p className="text-sm text-slate-500 mt-1">Soluciones Integrales de Publicidad</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-red-600">#{String(data.numero || data.proformaNumber).padStart(6, '0')}</h2>
          <p className="text-sm text-slate-600 mt-1">Fecha: {new Date(data.fechaCreacion).toLocaleDateString()}</p>
        </div>
      </div>

      {/* INFO CLIENTE Y EMPRESA */}
      <div className="flex justify-between mb-10 gap-8">
        <div className="w-1/2">
          <h3 className="text-xs font-bold uppercase text-slate-400 mb-2 border-b">Cliente</h3>
          <p className="font-bold text-lg uppercase">{data.cliente}</p>
          <p className="text-sm">ID/RUC: {data.ruc || 'N/A'}</p>
          <p className="text-sm">{data.telefono}</p>
          <p className="text-sm">{data.direccion}</p>
          <p className="text-sm">{data.email}</p>
        </div>
        <div className="w-1/2 text-right">
          <h3 className="text-xs font-bold uppercase text-slate-400 mb-2 border-b">Emitido Por</h3>
          <p className="font-bold text-lg">ADRCOMPANY SAS</p>
          <p className="text-sm">RUC: 0993397285001</p>
          <p className="text-sm">Guayas, Ecuador</p>
          <p className="text-sm">imprenta_milena@hotmail.com</p>
          <p className="text-sm">Vendedor: {data.autor}</p>
        </div>
      </div>

      {/* TABLA DE ITEMS */}
      <div className="mb-8">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="py-2 px-2 text-center w-16 font-bold">Cant.</th>
              <th className="py-2 px-2 text-left font-bold">Descripción</th>
              <th className="py-2 px-2 text-right w-32 font-bold">P. Unitario</th>
              <th className="py-2 px-2 text-right w-32 font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.productos.map((item, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="py-3 px-2 text-center">{item.cantidad}</td>
                <td className="py-3 px-2 uppercase whitespace-pre-wrap">
                    {(() => {
                        const { nombre, detalle } = getPrintDescParts(item);
                        return (
                            <>
                                <div className="font-bold">{nombre}</div>
                                {detalle && <div className="font-normal normal-case text-[10px] text-gray-500 mt-0.5">{detalle}</div>}
                            </>
                        );
                    })()}
                </td>
                {/* 🔧 FIX: Total ÷ Cantidad, para que cuadre con lo que ve el cliente
                    (evita mostrar el precio interno por m² sin explicación). */}
                <td className="py-3 px-2 text-right">${(Number(item.total || (item.cantidad * (item.precioUnitario || item.precio))) / (Number(item.cantidad) || 1)).toFixed(2)}</td>
                <td className="py-3 px-2 text-right font-medium">${Number(item.total || (item.cantidad * (item.precioUnitario || item.precio))).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TOTALES */}
      <div className="flex justify-end mb-12">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span className="font-medium">${data.financials.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>IVA ({data.financials.ivaPercentage}%):</span>
            <span className="font-medium">${data.financials.iva.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold border-t border-slate-800 pt-2 mt-2">
            <span>Total:</span>
            <span>${data.financials.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* NOTAS Y FIRMAS */}
      <div className="border-t-2 border-slate-100 pt-6">
        <div className="grid grid-cols-2 gap-10">
          <div>
            <h4 className="font-bold text-xs uppercase mb-2">Condiciones / Notas:</h4>
            <p className="text-xs text-slate-500 whitespace-pre-wrap">{data.descripcion || 'Sin notas adicionales.'}</p>
            <p className="text-xs text-slate-400 mt-2 italic">* Esta cotización tiene una validez de 15 días.</p>
          </div>
          <div className="flex flex-col justify-end items-center mt-10">
            <div className="border-t border-slate-400 w-48 mb-2"></div>
            <p className="text-xs font-bold uppercase">Firma Autorizada</p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ProformaPrintTemplate;