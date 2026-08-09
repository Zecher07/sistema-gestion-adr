import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { isUserInList } from '@/utils/userMatch';
import { supabase } from '../supabaseClient';
import { 
  ShoppingCart, 
  Settings, 
  PackageCheck, 
  Calculator, 
  CreditCard,
  AlertCircle,
  FileText,
  Users
} from 'lucide-react';

// Helper para obtener la fecha local exacta sin errores de zona horaria
const getLocalDate = () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

// 🔥 Calculador Inteligente de Estados Contables (Idéntico a WorkAreaList) 🔥
// 🔧 CAMBIO: antes una orden solo podía tener UN estado (si estaba impaga, ocultaba
// que también le faltaba la retención). Ahora se calculan por separado, así que una
// orden con saldo pendiente Y retención sin subir aparece en AMBAS tarjetas.
const getOrderAccountingStatus = (o) => {
    const total = Number(o.financials?.total) || 0;
    const anticipo = Number(o.anticipo) || 0;
    const retencion = Number(o.retencion || o.financials?.retencion) || 0;
    const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
    const saldoFinalReal = total - anticipo - retencion - totalAbonado;

    const pSaldo = String(o.formaPagoSaldo || o.financials?.formaPagoSaldo || '').toLowerCase();
    const pAnticipo = String(o.formaPagoAnticipo || o.forma_pago_anticipo || '').toLowerCase();
    const isCredito = pSaldo.includes('crédit') || pSaldo.includes('credit') || 
                      pAnticipo.includes('crédit') || pAnticipo.includes('credit');

    const today = getLocalDate();
    const fechaVence = o.financials?.creditoVenceSaldo || o.creditoVenceSaldo || o.credito_vence_saldo || o.creditoVenceAnticipo || o.credito_vence_anticipo || o.financials?.creditoVenceAnticipo || '';
    
    const isVencido = isCredito && fechaVence && fechaVence < today;

    let retDocs = [];
    if (o.comprobantes && !Array.isArray(o.comprobantes) && o.comprobantes.retencion) {
        retDocs = o.comprobantes.retencion;
    }
    const isRetencionPendiente = retencion > 0 && retDocs.length === 0;

    const isImpaga = saldoFinalReal > 0.01 && (!isCredito || isVencido);
    const isCreditoActivo = saldoFinalReal > 0.01 && isCredito && !isVencido;
    const isPorFinalizar = !isImpaga && !isRetencionPendiente && !isCreditoActivo;

    return {
        isImpaga,
        isRetencionPendiente,
        isCreditoActivo,
        isPorFinalizar,
        // se mantiene 'status' (un solo valor) por compatibilidad con otras pantallas
        // que ya lo usan así (ej. WorkAreaList) — prioridad: impaga > retención > crédito
        status: isImpaga ? 'impagas' : isRetencionPendiente ? 'retenciones' : isCreditoActivo ? 'creditos' : 'por_finalizar'
    };
};

const Stats = ({ orders, user }) => {
  // 🔥 REGLA DE SEGURIDAD: Producción NO ve las estadísticas del Dashboard 🔥
  if (user?.role === 'Producción') {
    return null;
  }

  const isAdmin = user?.role === 'Administrador';

  // 🔧 NUEVO: filtro "ver solo este vendedor" — para cuadrar comisiones sin tener
  // que sumar a mano el desglose de cada tarjeta.
  const [staffList, setStaffList] = useState([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState('');

  useEffect(() => {
      if (!isAdmin) return;
      const fetchStaff = async () => {
          const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'Vendedor').order('full_name');
          if (data) setStaffList(data);
      };
      fetchStaff();
  }, [isAdmin]);

  // 🔥 FILTRO DE USUARIO: Los vendedores solo ven SUS propias órdenes 🔥
  const visibleOrders = orders.filter(o => {
      // Si el Admin eligió un vendedor específico, solo se cuentan sus órdenes
      // (para calcular comisiones), sin importar el rol de quien está logueado.
      if (isAdmin && selectedVendedorId) {
          const selectedUser = staffList.find(u => u.id === selectedVendedorId);
          return isUserInList(o.vendedor_ids, o.vendedor, { id: selectedVendedorId, name: selectedUser?.full_name });
      }
      // Admin y Contabilidad ven el global de la empresa
      if (isAdmin || user?.role === 'Contabilidad') return true;
      // Los vendedores solo ven las órdenes donde estén asignados
      return isUserInList(o.vendedor_ids, o.vendedor, user);
  });

  // Función para obtener el desglose por vendedor (Solo para Admin, y solo si no
  // filtró a un vendedor específico — si ya filtró, sería información repetida)
  const getBreakdown = (filteredOrders) => {
    if (!isAdmin || selectedVendedorId) return null;
    const bd = {};
    filteredOrders.forEach(o => {
      const v = o.vendedor || 'Sin asignar';
      bd[v] = (bd[v] || 0) + 1;
    });
    return Object.entries(bd)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  // Clasificación de las órdenes VISIBLES
  const ventasOrders = visibleOrders.filter(o => o.status === 'VENTAS');
  const produccionOrders = visibleOrders.filter(o => o.status === 'PRODUCCION');
  const retirarOrders = visibleOrders.filter(o => o.status === 'VENTAS POR RETIRAR');
  const contabilidadOrders = visibleOrders.filter(o => o.status === 'CONTABILIDAD');

  // 🔥 CRÉDITOS, RETENCIONES E IMPAGAS — ahora independientes entre sí 🔥
  const creditOrders = visibleOrders.filter(o => o.status === 'CONTABILIDAD' && getOrderAccountingStatus(o).isCreditoActivo);
  const retencionesOrders = visibleOrders.filter(o => o.status === 'CONTABILIDAD' && getOrderAccountingStatus(o).isRetencionPendiente);
  const impagasOrders = visibleOrders.filter(o => o.status === 'CONTABILIDAD' && getOrderAccountingStatus(o).isImpaga);

  const cards = [
    {
      title: 'Ingresadas',
      value: ventasOrders.length,
      breakdown: getBreakdown(ventasOrders),
      icon: ShoppingCart,
      color: 'bg-blue-500',
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100'
    },
    {
      title: 'En Producción',
      value: produccionOrders.length,
      breakdown: getBreakdown(produccionOrders),
      icon: Settings,
      color: 'bg-amber-500',
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100'
    },
    {
      title: 'Por Retirar',
      value: retirarOrders.length,
      breakdown: getBreakdown(retirarOrders),
      icon: PackageCheck,
      color: 'bg-green-500',
      textColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100'
    },
    {
      title: 'Contabilidad',
      value: contabilidadOrders.length,
      breakdown: getBreakdown(contabilidadOrders),
      icon: Calculator,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-100'
    },
    {
      title: 'Créditos',
      value: creditOrders.length,
      breakdown: getBreakdown(creditOrders),
      icon: CreditCard,
      color: 'bg-pink-500',
      textColor: 'text-pink-500',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-100'
    },
    {
      title: 'Retenciones',
      value: retencionesOrders.length,
      breakdown: getBreakdown(retencionesOrders),
      icon: FileText,
      color: 'bg-orange-500',
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-100'
    },
    {
      title: 'Impagas',
      value: impagasOrders.length,
      breakdown: getBreakdown(impagasOrders),
      icon: AlertCircle,
      color: 'bg-red-500',
      textColor: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-100'
    }
  ];

  return (
    <div className="space-y-3">
      {/* 🔧 NUEVO: filtro por vendedor + total de órdenes (para cuadrar comisiones) */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Comisiones — Ver:</span>
          </div>
          <select
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedVendedorId}
            onChange={(e) => setSelectedVendedorId(e.target.value)}
          >
            <option value="">Todos (vista global de la empresa)</option>
            {staffList.map(u => (<option key={u.id} value={u.id}>{u.full_name}</option>))}
          </select>
          {selectedVendedorId && (
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full ml-auto">
              Total de órdenes de {staffList.find(u => u.id === selectedVendedorId)?.full_name}: {visibleOrders.length}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 rounded-xl border ${card.borderColor} ${card.bgColor} shadow-sm hover:shadow-md transition-shadow flex flex-col`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{card.title}</p>
                <h4 className={`text-2xl font-black ${card.textColor} mt-1`}>{card.value}</h4>
              </div>
              <div className={`p-2 rounded-lg bg-white bg-opacity-60 shrink-0`}>
                <Icon className={`h-5 w-5 ${card.textColor}`} />
              </div>
            </div>

            {/* 🔥 DESGLOSE POR VENDEDOR (SÓLO VISIBLE PARA ADMIN) 🔥 */}
            {isAdmin && card.breakdown && (
              <div className="mt-auto pt-3 border-t border-black/10 space-y-1.5">
                {card.breakdown.length > 0 ? (
                  card.breakdown.map(b => (
                    <div key={b.name} className="flex justify-between items-center text-[10px] text-slate-600">
                      <span className="truncate pr-2 font-medium" title={b.name}>{b.name}</span>
                      <span className={`font-bold bg-white px-1.5 py-0.5 rounded shadow-sm ${card.textColor}`}>{b.count}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-400 italic text-center">Sin órdenes</div>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
      </div>
    </div>
  );
};

export default Stats;