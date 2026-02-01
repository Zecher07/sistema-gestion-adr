
import React from 'react';

const STATUS_STYLES = {
  'BORRADOR': 'bg-gray-100 text-gray-700 border-gray-200',
  'APROBADA': 'bg-green-100 text-green-700 border-green-200',
  // Legacy support for safe rendering if old data exists, mapped to neutral or specific
  'ENVIADA': 'bg-blue-100 text-blue-700 border-blue-200', 
  'RECHAZADA': 'bg-red-100 text-red-700 border-red-200'
};

const ProformaStatusBadge = ({ status }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold border ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

export default ProformaStatusBadge;
