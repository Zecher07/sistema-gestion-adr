import React, { useState, useMemo, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Search, Plus, FileDown, Printer, Pencil, Trash2, Eye, User, FileText, Phone, ShoppingCart, DollarSign, Wallet, ShieldAlert, History, X, Edit2, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Text'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

const ClientsPanel = ({ clients = [], orders = [], user, onCreateNew, onEditClient, onViewOrder, initialExpedienteClientId, onExpedienteOpened }) => {
  const [searchTerm, setSearchTerm] = useState("")  
  
  // Estados para el Expediente del Cliente
  const [clienteExpediente, setClienteExpediente] = useState(null)
  const [ordenesCliente, setOrdenesCliente] = useState([])
  const [loadingExpediente, setLoadingExpediente] = useState(false)

  // 🔥 ESTADO DE ORDENAMIENTO 🔥
  const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' });

  const { toast } = useToast()

  // 🔥 VALIDACIÓN DE PERMISOS 🔥
  const canDelete = user?.role === 'Administrador' || user?.role === 'Contabilidad';
  const canViewOrderDetails = user?.role === 'Administrador' || user?.role === 'Contabilidad';

  // 🔥 FILTRADO Y CÁLCULO DE ÓRDENES POR CLIENTE 🔥
  const clientesFiltrados = useMemo(() => {
      // 1. Primero, calculamos las órdenes de cada cliente
      const clientsWithCounts = clients.map(cliente => {
          const count = orders.filter(o => {
              const matchIdentificacion = cliente.empresa && (o.ruc === cliente.empresa || o.cedula === cliente.empresa || o.cliente_identificacion === cliente.empresa);
              const matchNombre = (o.cliente || o.cliente_nombre)?.toLowerCase() === cliente.nombre?.toLowerCase();
              return matchIdentificacion || matchNombre;
          }).length;
          
          return { ...cliente, orderCount: count };
      });

      // 2. Luego, aplicamos la búsqueda por texto
      return clientsWithCounts.filter(cliente => {
          const texto = searchTerm.toLowerCase();
          return (
              cliente.nombre?.toLowerCase().includes(texto) ||
              cliente.empresa?.toLowerCase().includes(texto) ||
              cliente.email?.toLowerCase().includes(texto) ||
              cliente.telefono?.toLowerCase().includes(texto)
          );
      });
  }, [clients, orders, searchTerm]);

  // 🔥 LÓGICA DE ORDENAMIENTO 🔥
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedClients = useMemo(() => {
    let sortableItems = [...clientesFiltrados];
    sortableItems.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Caso especial para ordenar por límite de crédito
      if (sortConfig.key === 'limiteCredito') {
        aVal = a.permiteCredito ? Number(a.limiteCredito || 0) : -1;
        bVal = b.permiteCredito ? Number(b.limiteCredito || 0) : -1;
      }

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sortableItems;
  }, [clientesFiltrados, sortConfig]);

  const handleVerExpediente = (cliente) => {
      setClienteExpediente(cliente);
      setLoadingExpediente(true);
      
      setTimeout(() => {
          const ordenadas = orders.filter(o => {
              const matchIdentificacion = cliente.empresa && (o.ruc === cliente.empresa || o.cedula === cliente.empresa || o.cliente_identificacion === cliente.empresa);
              const matchNombre = (o.cliente || o.cliente_nombre)?.toLowerCase() === cliente.nombre?.toLowerCase();
              return matchIdentificacion || matchNombre;
          }).sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
          
          setOrdenesCliente(ordenadas);
          setLoadingExpediente(false);
      }, 300);
  };

  // 🔧 NUEVO: si llegamos aquí desde otra pantalla (ej. clic en el nombre del
  // cliente dentro del detalle de una orden), abrimos su expediente automáticamente.
  useEffect(() => {
      if (initialExpedienteClientId && clients.length > 0) {
          const clienteObj = clients.find(c => c.id === initialExpedienteClientId);
          if (clienteObj) handleVerExpediente(clienteObj);
          if (onExpedienteOpened) onExpedienteOpened(); // avisamos al padre para que no se repita
      }
  }, [initialExpedienteClientId, clients]);

  const handleBorrar = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro que deseas eliminar al cliente "${nombre}"?`)) return

    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error
      toast({ title: "🗑️ Cliente eliminado", description: "El cliente ha sido borrado exitosamente. Desaparecerá en breves segundos." })
    } catch (error) {
      toast({ variant: "destructive", title: "Error al eliminar", description: error.message })
    }
  }

  const handleExport = () => {
    const cabeceras = "Nombre,RUC/Cedula,Email,Telefono,Direccion,Cant_Ordenes\n"
    const filas = sortedClients.map(c => 
      `"${c.nombre || ''}","${c.empresa || ''}","${c.email || ''}","${c.telefono || ''}","${c.direccion || ''}",${c.orderCount || 0}`
    ).join("\n")
    const blob = new Blob([cabeceras + filas], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes_${new Date().toLocaleDateString()}.csv`
    a.click()
  }

  // Cálculos del Expediente Financiero
  const clientStats = useMemo(() => {
      if (!clienteExpediente) return null;

      let totalComprado = 0;
      let deudaActual = 0;
      let ordenesActivas = 0;

      ordenesCliente.forEach(o => {
          if (o.status !== 'ANULADA') {
              const totalOrden = Number(o.financials?.total) || 0;
              totalComprado += totalOrden;

              const anticipo = Number(o.anticipo) || 0;
              const retencion = Number(o.retencion) || 0;
              const totalAbonos = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
              const saldoPendiente = totalOrden - anticipo - retencion - totalAbonos;

              if (saldoPendiente > 0) deudaActual += saldoPendiente;
              if (o.status !== 'FINALIZADA' && o.status !== 'ARCHIVADA') ordenesActivas++;
          }
      });

      const limite = Number(clienteExpediente.limiteCredito) || 0;
      const porcentajeDeuda = limite > 0 ? Math.min((deudaActual / limite) * 100, 100) : 0;
      const sobregirado = deudaActual > limite && limite > 0;

      return { totalComprado, deudaActual, ordenesActivas, limite, porcentajeDeuda, sobregirado };
  }, [clienteExpediente, ordenesCliente]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  // 🔥 COMPONENTE DE CABECERA ORDENABLE 🔥
  const SortableHeader = ({ label, sortKey, align = 'left', width }) => (
      <th 
          className={`px-6 py-4 font-bold cursor-pointer hover:bg-slate-200 transition-colors select-none ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${width ? width : ''}`} 
          onClick={() => requestSort(sortKey)}
      >
          <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
              {label}
              <ArrowUpDown className={`h-3 w-3 ${sortConfig.key === sortKey ? 'text-blue-600' : 'text-slate-400'}`} />
          </div>
      </th>
  );

  return (
    <div id="printable-area" className="p-6 space-y-6 animate-in fade-in duration-500 relative bg-slate-50 min-h-screen">
      
      {/* HEADER IMPRESIÓN */}
      <div className="hidden print:block mb-8 text-center border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Reporte de Clientes</h1>
        <p className="text-slate-500">Fecha de emisión: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        {searchTerm && <p className="text-sm text-slate-400 mt-1">Filtro aplicado: "{searchTerm}"</p>}
      </div>

      {/* HEADER NORMAL */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm no-print">
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h1>
        <p className="text-sm text-slate-500 mt-1">Administra la base de datos, créditos y revisa el historial.</p>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4 no-print">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <Button onClick={onCreateNew} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full md:w-auto">
            <Plus size={18} /> Nuevo Cliente
          </Button>

          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={handleExport} className="text-green-700 hover:bg-green-50 gap-2 flex-1">
              <FileDown size={16} /> Exportar
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="text-slate-700 hover:bg-slate-50 gap-2 flex-1">
              <Printer size={16} /> Imprimir
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar por nombre, RUC o email..." className="pl-10 w-full border-slate-200 bg-slate-50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs print:bg-white print:border-b-2 print:border-black">
              <tr>
                <SortableHeader label="Razón Social" sortKey="nombre" />
                <SortableHeader label="Email" sortKey="email" />
                <SortableHeader label="Ced / RUC" sortKey="empresa" />
                <SortableHeader label="Órdenes" sortKey="orderCount" align="center" />
                <SortableHeader label="Dirección" sortKey="direccion" />
                <SortableHeader label="Estado Crédito" sortKey="limiteCredito" align="center" />
                <th className="px-6 py-4 text-center no-print">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-300">
              {sortedClients.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-12 text-slate-500">No se encontraron clientes.</td></tr>
              ) : (
                sortedClients.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                    <td className="px-6 py-4 font-medium text-slate-900">{cliente.nombre}</td>
                    <td className="px-6 py-4 text-slate-600">{cliente.email || '-'}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono tracking-wider">{cliente.empresa || '-'}</td>
                    
                    <td className="px-6 py-4 text-center">
                        <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold border",
                            cliente.orderCount > 0 
                                ? "bg-blue-100 text-blue-700 border-blue-200" 
                                : "bg-slate-100 text-slate-400 border-slate-200"
                        )}>
                            {cliente.orderCount}
                        </span>
                    </td>

                    <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate print:whitespace-normal print:overflow-visible">
                      {cliente.direccion || '-'}
                    </td>
                    
                    <td className="px-6 py-4 text-center">
                        {cliente.permiteCredito ? (
                            <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-bold border border-green-200">
                                Límite: {formatCurrency(cliente.limiteCredito)}
                            </span>
                        ) : (
                            <span className="text-slate-400 text-xs italic">Sin crédito</span>
                        )}
                    </td>

                    <td className="px-6 py-4 text-center no-print">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" onClick={() => handleVerExpediente(cliente)} title="Ver Historial y Crédito">
                          <Eye size={16} />
                        </Button>
                        
                        {onEditClient && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => onEditClient(cliente)} title="Editar">
                            <Pencil size={16} />
                          </Button>
                        )}

                        {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleBorrar(cliente.id, cliente.nombre)} title="Eliminar">
                              <Trash2 size={16} />
                            </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 text-xs text-slate-500 print:bg-white print:mt-4 print:text-right">
          Total de registros: {sortedClients.length}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 🔥 MODAL EXPEDIENTE DEL CLIENTE (HISTORIAL Y CRÉDITO) 🔥 */}
      {/* ========================================================= */}
      {clienteExpediente && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 sm:p-6 animate-in fade-in duration-200 no-print">
            <div className="w-full max-w-5xl bg-slate-50 h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/20">
               
               <div className="bg-slate-800 p-6 flex justify-between items-start shrink-0">
                  <div className="flex gap-4 items-center text-white">
                      <div className="h-14 w-14 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                          <User className="h-7 w-7 text-blue-300" />
                      </div>
                      <div>
                          <h2 className="text-2xl font-black tracking-wide">{clienteExpediente.nombre}</h2>
                          <div className="flex items-center gap-4 text-sm text-slate-300 mt-1 font-medium">
                              <span className="flex items-center gap-1 font-mono"><FileText className="h-4 w-4"/> RUC: {clienteExpediente.empresa || '-'}</span>
                              <span className="flex items-center gap-1"><Phone className="h-4 w-4"/> {clienteExpediente.telefono || '-'}</span>
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      {onEditClient && (
                          <Button variant="outline" size="sm" onClick={() => { setClienteExpediente(null); onEditClient(clienteExpediente); }} className="bg-slate-700/50 border-slate-600 text-white hover:bg-blue-600 hover:border-blue-500 transition-colors">
                              <Edit2 className="h-4 w-4 mr-2" /> Editar Datos
                          </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setClienteExpediente(null)} className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-full">
                          <X className="h-6 w-6" />
                      </Button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {loadingExpediente ? (
                      <div className="text-center py-20 text-slate-500 font-bold animate-pulse">Cargando datos financieros...</div>
                  ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><ShoppingCart className="h-6 w-6"/></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historial de Compras</p>
                                    <div className="flex items-end gap-2">
                                        <p className="text-2xl font-black text-slate-800">{ordenesCliente.length}</p>
                                        <p className="text-sm text-blue-600 font-bold mb-1">({clientStats?.ordenesActivas} activas)</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center"><DollarSign className="h-6 w-6"/></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volumen Comprado</p>
                                    <p className="text-2xl font-black text-slate-800">{formatCurrency(clientStats?.totalComprado)}</p>
                                </div>
                            </div>
                            <div className={cn("p-5 rounded-xl border shadow-sm flex items-center gap-4", clientStats?.deudaActual > 0 ? "bg-rose-50 border-red-200" : "bg-white border-slate-200")}>
                                <div className={cn("h-12 w-12 rounded-full flex items-center justify-center", clientStats?.deudaActual > 0 ? "bg-red-200 text-red-700" : "bg-slate-100 text-slate-600")}><Wallet className="h-6 w-6"/></div>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Saldo Pendiente (Deuda)</p>
                                    <p className={cn("text-2xl font-black", clientStats?.deudaActual > 0 ? "text-red-700" : "text-slate-800")}>{formatCurrency(clientStats?.deudaActual)}</p>
                                </div>
                            </div>
                        </div>

                        {clienteExpediente.permiteCredito ? (
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-indigo-600"/> Uso de Línea de Crédito</h3>
                                        <p className="text-sm text-slate-500">Límite Aprobado: <span className="font-bold text-slate-800">{formatCurrency(clientStats?.limite)}</span></p>
                                    </div>
                                    <div className="text-right">
                                        <span className={cn("text-xl font-black", clientStats?.sobregirado ? "text-red-600" : "text-indigo-600")}>
                                            {formatCurrency(Math.max((clientStats?.limite || 0) - (clientStats?.deudaActual || 0), 0))}
                                        </span>
                                        <p className="text-xs font-bold text-slate-500 uppercase">Disponible</p>
                                    </div>
                                </div>
                                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative mt-4">
                                    <div className={cn("h-full transition-all duration-1000", clientStats?.sobregirado ? "bg-red-500" : "bg-indigo-500")} style={{ width: `${clientStats?.porcentajeDeuda}%` }}></div>
                                </div>
                                {clientStats?.sobregirado && <p className="text-xs font-bold text-red-600 mt-2 text-center animate-pulse">⚠️ ALERTA: EL CLIENTE HA EXCEDIDO SU LÍMITE DE CRÉDITO PERMITIDO.</p>}
                            </div>
                        ) : (
                            <div className="bg-slate-200/50 border border-slate-300 border-dashed p-4 rounded-xl text-center">
                                <ShieldAlert className="h-6 w-6 text-slate-400 mx-auto mb-1" />
                                <p className="font-bold text-slate-600">Cliente sin Crédito Autorizado</p>
                            </div>
                        )}

                        <div>
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><History className="h-5 w-5 text-slate-500"/> Registro de Órdenes</h3>
                            
                            {/* 🔥 CONTENEDOR CON BARRA DE DESPLAZAMIENTO (SCROLL) Y LÍMITE DE ALTURA 🔥 */}
                            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-y-auto max-h-[600px]">
                                <table className="w-full text-sm text-left relative">
                                    {/* 🔥 CABECERA "PEGADOSA" (STICKY) PARA QUE NO SE PIERDA AL BAJAR 🔥 */}
                                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-600 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3 text-center">Nº Orden</th>
                                            <th className="px-4 py-3">Fecha</th>
                                            <th className="px-4 py-3">Trabajo</th>
                                            <th className="px-4 py-3 text-center">Estado</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                            <th className="px-4 py-3 text-right">Deuda</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {ordenesCliente.length > 0 ? (
                                            ordenesCliente.map(orden => {
                                                const total = Number(orden.financials?.total) || 0;
                                                const anticipo = Number(orden.anticipo) || 0;
                                                const retencion = Number(orden.retencion) || 0;
                                                const abonos = (orden.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
                                                const deuda = Math.max(total - anticipo - retencion - abonos, 0);

                                                return (
                                                    <tr 
                                                        key={orden.id} 
                                                        className={cn("transition-colors", canViewOrderDetails ? "hover:bg-blue-50 cursor-pointer" : "hover:bg-slate-50")}
                                                        onClick={() => {
                                                            if (canViewOrderDetails && onViewOrder) {
                                                                onViewOrder(orden);
                                                            }
                                                        }}
                                                    >
                                                        <td className="px-4 py-3 text-center font-mono font-bold text-blue-600">#{String(orden.orderNumber || orden.order_number || orden.id).slice(-7).padStart(7, '0')}</td>
                                                        <td className="px-4 py-3 text-slate-600">{new Date(orden.created_at || orden.createdAt).toLocaleDateString('es-ES')}</td>
                                                        <td className="px-4 py-3 text-slate-800 text-xs uppercase font-medium">{orden.tipoLetrero || orden.tipo_trabajo || '-'}</td>
                                                        <td className="px-4 py-3 text-center"><span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-700 rounded border">{orden.status}</span></td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-700">{formatCurrency(total)}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-red-600">{deuda > 0 ? formatCurrency(deuda) : '-'}</td>
                                                    </tr>
                                                )
                                            })
                                        ) : (
                                            <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500 italic">No hay historial de compras.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                      </>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  )
}

export default ClientsPanel;