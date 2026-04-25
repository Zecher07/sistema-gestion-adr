import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, 
  Settings, 
  PackageCheck, 
  Calculator, 
  CreditCard,
  AlertCircle
} from 'lucide-react';

const Stats = ({ orders, user }) => {
  // Verificamos si el usuario es Administrador para mostrar el desglose
  const isAdmin = user?.role === 'Administrador';

  // Función para obtener el desglose por vendedor
  const getBreakdown = (filteredOrders) => {
    if (!isAdmin) return null;
    const bd = {};
    filteredOrders.forEach(o => {
      const v = o.vendedor || 'Sin asignar';
      bd[v] = (bd[v] || 0) + 1;
    });
    // Convertir a array y ordenar de mayor a menor
    return Object.entries(bd)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  // 1. Ingresadas -> "VENTAS"
  const ventasOrders = orders.filter(o => o.status === 'VENTAS');

  // 2. En Producción -> "PRODUCCION"
  const produccionOrders = orders.filter(o => o.status === 'PRODUCCION');

  // 3. Por Retirar -> "VENTAS POR RETIRAR"
  const retirarOrders = orders.filter(o => o.status === 'VENTAS POR RETIRAR');

  // 4. En Contabilidad -> "CONTABILIDAD"
  const contabilidadOrders = orders.filter(o => o.status === 'CONTABILIDAD');

  // 5. Con Crédito
  const creditOrders = orders.filter(o => 
    (o.formaPagoAnticipo === 'Crédito' || o.formaPagoSaldo === 'Crédito' || o.forma_pago_anticipo === 'Crédito') && 
    o.status !== 'ARCHIVADA' && 
    o.status !== 'ANULADA' &&
    o.status !== 'FINALIZADA'
  );

  // 6. Impagas (Cualquier orden activa que tenga saldo pendiente > 0)
  const impagasOrders = orders.filter(o => {
    if (o.status === 'ANULADA' || o.status === 'ARCHIVADA' || o.status === 'FINALIZADA') return false;
    
    const total = Number(o.financials?.total) || 0;
    const anticipo = Number(o.anticipo) || 0;
    const retencion = Number(o.retencion) || 0;
    const abonos = (o.abonos || []).reduce((sum, a) => sum + Number(a.monto), 0);
    
    const saldoPendiente = total - anticipo - retencion - abonos;
    
    return saldoPendiente > 0.01; // Si el saldo es mayor a cero, está impaga
  });

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
      color: 'bg-orange-500',
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-100'
    },
    {
      title: 'Por Retirar',
      value: retirarOrders.length,
      breakdown: getBreakdown(retirarOrders),
      icon: PackageCheck,
      color: 'bg-purple-500',
      textColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100'
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.title}</p>
                <h4 className={`text-2xl font-bold ${card.textColor} mt-1`}>{card.value}</h4>
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
  );
};

export default Stats;