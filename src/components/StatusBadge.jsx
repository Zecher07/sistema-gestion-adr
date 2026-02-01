import React from 'react';

const STATUS_STYLES = {
  'VENTAS': 'bg-blue-100 text-blue-700 border-blue-200',
  'PRODUCCION': 'bg-orange-100 text-orange-700 border-orange-200',
  'VENTAS POR RETIRAR': 'bg-purple-100 text-purple-700 border-purple-200',
  'CONTABILIDAD': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'FINALIZADA': 'bg-green-100 text-green-700 border-green-200',
  'ANULADA': 'bg-red-100 text-red-700 border-red-200',
  'ARCHIVADA': 'bg-slate-200 text-slate-600 border-slate-300 italic'
};

const StatusBadge = ({ status }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold border ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

export default StatusBadge;