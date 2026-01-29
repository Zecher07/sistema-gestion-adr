
import React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity,
  ClipboardList, 
  Settings, 
  Truck, 
  FileText, 
  CheckCircle2, 
  CreditCard 
} from 'lucide-react';

const Stats = ({ orders = [] }) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  
  const stats = {
    activas: safeOrders.filter(o => o.status !== 'FINALIZADA').length,
    ventas: safeOrders.filter(o => o.status === 'VENTAS').length,
    produccion: safeOrders.filter(o => o.status === 'PRODUCCION').length,
    porRetirar: safeOrders.filter(o => o.status === 'VENTAS POR RETIRAR').length,
    contabilidad: safeOrders.filter(o => o.status === 'CONTABILIDAD').length,
    finalizadas: safeOrders.filter(o => o.status === 'FINALIZADA').length,
    credito: safeOrders.filter(o => o.formaPagoSaldo === 'Crédito' || o.formaPagoAnticipo === 'Crédito').length
  };

  const statCards = [
    {
      title: 'Órdenes Activas',
      value: stats.activas,
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
      border: 'border-blue-200'
    },
    {
      title: 'Ingresadas',
      value: stats.ventas,
      icon: ClipboardList,
      color: 'text-sky-600',
      bg: 'bg-sky-100',
      border: 'border-sky-200'
    },
    {
      title: 'En Producción',
      value: stats.produccion,
      icon: Settings,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
      border: 'border-orange-200'
    },
    {
      title: 'Por Retirar',
      value: stats.porRetirar,
      icon: Truck,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
      border: 'border-purple-200'
    },
    {
      title: 'En Contabilidad',
      value: stats.contabilidad,
      icon: FileText,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100',
      border: 'border-indigo-200'
    },
    {
      title: 'Finalizadas',
      value: stats.finalizadas,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
      border: 'border-emerald-200'
    },
    {
      title: 'Con Crédito',
      value: stats.credito,
      icon: CreditCard,
      color: 'text-rose-600',
      bg: 'bg-rose-100',
      border: 'border-rose-200'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`bg-white rounded-lg shadow-sm p-3 border ${stat.border} flex flex-col justify-between hover:shadow-md transition-all duration-200`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate pr-1" title={stat.title}>
                {stat.title}
              </span>
              <div className={`p-1.5 rounded-full ${stat.bg} flex-shrink-0`}>
                <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
              </div>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-2xl font-bold text-slate-800 leading-none">
                {stat.value}
              </span>
              <span className="text-[10px] text-slate-400 font-medium mb-0.5">ordenes</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default Stats;
