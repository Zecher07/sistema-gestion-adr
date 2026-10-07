import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { isUserInList } from '@/utils/userMatch';
import { rangoDelMes, resumenVentasMes } from '@/utils/comisiones';

// 🔧 Tarjeta "Ventas Finalizadas" del Inicio, como BARRA DE PROGRESO de efectividad de cobro:
//   monto cobrado (grande) · meta = Ventas Totales del mes · % = finalizadas ÷ totales · lo que falta por cobrar.
// Vendedor = SUS números; Administrador = total de toda la empresa. Usa las mismas reglas que Estadísticas
// (utils/comisiones.js), incluido el margen de días y el ciclo extra del crédito, así ambas pantallas coinciden.
const formatoUSD = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ProgresoVentasMes = ({ orders = [], user }) => {
  const esAdmin = user?.role === 'Administrador';

  // Mismo margen "Finalizadas (días)" que edita el Admin en Estadísticas (configuracion_global)
  const [margenDias, setMargenDias] = useState(4);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.from('configuracion_global').select('margen_dias_finalizadas').maybeSingle();
        if (vivo && data && data.margen_dias_finalizadas !== null && data.margen_dias_finalizadas !== undefined) setMargenDias(data.margen_dias_finalizadas);
      } catch (error) { console.error(error); }
    })();
    return () => { vivo = false; };
  }, []);

  const { r, nombreMes } = useMemo(() => {
    const ahora = new Date();
    const pertenece = (o) => esAdmin || isUserInList(o.vendedor_ids, o.vendedor, user);
    return {
      r: resumenVentasMes(orders, rangoDelMes(ahora), margenDias, pertenece),
      nombreMes: ahora.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
    };
  }, [orders, user, margenDias, esAdmin]);

  const pct = Math.min(100, Math.max(0, r.porcentaje));
  const completo = r.totalSales > 0 && r.falta < 0.005;
  const anchoRelleno = pct > 0 ? Math.max(pct, 2) : 0; // que siempre se note aunque sea muy poco

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <TrendingUp className="h-7 w-7 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
            Ventas Finalizadas ({nombreMes}){esAdmin ? ' · Toda la empresa' : ''}
          </p>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <p className="text-3xl md:text-4xl font-black text-blue-700">{formatoUSD(r.propias)} USD</p>
            <p className="text-base md:text-lg font-semibold text-slate-400">/ {formatoUSD(r.totalSales)} USD Meta Vendida</p>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <div
              className="flex-1 h-6 rounded-full bg-slate-200/80 overflow-hidden"
              role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
              aria-label="Efectividad de cobro del mes"
            >
              {anchoRelleno > 0 && (
                <div
                  className={`h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700 ${completo ? 'bg-green-500' : 'bg-blue-600'}`}
                  style={{ width: `${anchoRelleno}%` }}
                >
                  {pct >= 14 && <span className="text-[11px] font-bold text-white">{pct.toFixed(1)}%</span>}
                </div>
              )}
            </div>
            <span className={`text-lg md:text-xl font-black shrink-0 ${completo ? 'text-green-600' : 'text-blue-700'}`}>{pct.toFixed(1)}%</span>
          </div>

          <p className="text-sm text-slate-600 mt-2">
            {r.totalSales <= 0 ? (
              <>Todavía no hay ventas registradas este mes.</>
            ) : completo ? (
              <>🎉 <span className="font-semibold">¡Excelente!</span> Todo lo vendido este mes ya está entregado y cobrado.</>
            ) : (
              <>💡 Falta por entregar y cobrar <span className="font-bold text-slate-800">{formatoUSD(r.falta)} USD</span> para completar el 100% de lo vendido en el mes.</>
            )}
          </p>

          {r.carrySales > 0 && (
            <p className="text-xs text-indigo-700 font-semibold mt-1.5">
              + {formatoUSD(r.carrySales)} USD de ventas a crédito del mes anterior ya cobradas ({r.carryCount}) — también suman a la comisión (no cuentan en el %).
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgresoVentasMes;
