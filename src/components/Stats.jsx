import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, 
  Settings, 
  PackageCheck, 
  Calculator, 
  CreditCard 
} from 'lucide-react';

const Stats = ({ orders }) => {
  // 1. Ingresadas -> "VENTAS"
  const ventasCount = orders.filter(o => o.status === 'VENTAS').length;

  // 2. En Producción -> "PRODUCCION"
  const produccionCount = orders.filter(o => o.status === 'PRODUCCION').length;

  // 3. Por Retirar -> "VENTAS POR RETIRAR"
  const retirarCount = orders.filter(o => o.status === 'VENTAS POR RETIRAR').length;

  // 4. En Contabilidad -> "CONTABILIDAD"
  const contabilidadCount = orders.filter(o => o.status === 'CONTABILIDAD').length;

  // 5. Con Crédito -> (Any active order with payment method 'Crédito')
  // We assume 'active' means not finalized/anulada/archivada for credit tracking generally, 
  // or specifically those marked as Credit.
  // The filter logic from App.jsx for 'ordenes-credito' is:
  // (o.formaPagoAnticipo === 'Crédito' || o.formaPagoSaldo === 'Crédito' || o.status === 'CONTABILIDAD') && o.status !== 'ARCHIVADA'
  // Let's stick to a similar logic but maybe focus on active debts.
  const creditCount = orders.filter(o => 
    (o.formaPagoAnticipo === 'Crédito' || o.formaPagoSaldo === 'Crédito') && 
    o.status !== 'ARCHIVADA' && 
    o.status !== 'ANULADA' &&
    o.status !== 'FINALIZADA'
  ).length;

  const cards = [
    {
      title: 'Ingresadas',
      value: ventasCount,
      icon: ShoppingCart,
      color: 'bg-blue-500',
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100'
    },
    {
      title: 'En Producción',
      value: produccionCount,
      icon: Settings,
      color: 'bg-orange-500',
      textColor: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-100'
    },
    {
      title: 'Por Retirar',
      value: retirarCount,
      icon: PackageCheck,
      color: 'bg-purple-500',
      textColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-100'
    },
    {
      title: 'En Contabilidad',
      value: contabilidadCount,
      icon: Calculator,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-100'
    },
    {
      title: 'Con Crédito',
      value: creditCount,
      icon: CreditCard,
      color: 'bg-pink-500',
      textColor: 'text-pink-500',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 rounded-xl border ${card.borderColor} ${card.bgColor} shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.title}</p>
                <h4 className={`text-2xl font-bold ${card.textColor} mt-1`}>{card.value}</h4>
              </div>
              <div className={`p-2 rounded-lg bg-white bg-opacity-60`}>
                <Icon className={`h-5 w-5 ${card.textColor}`} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default Stats;