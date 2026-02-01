
import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  'EMITIDA': 'bg-green-100 text-green-700 border-green-200',
  'ANULADA': 'bg-red-100 text-red-700 border-red-200',
  'PENDIENTE': 'bg-yellow-100 text-yellow-700 border-yellow-200'
};

const InvoiceStatusBadge = ({ status, className }) => {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold border",
      STATUS_STYLES[status] || 'bg-gray-100 text-gray-800',
      className
    )}>
      {status}
    </span>
  );
};

export default InvoiceStatusBadge;
