import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Search, Plus, FileDown, Printer, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/Text'
import { useToast } from '@/components/ui/use-toast'
import ClientForm from './ClientForm'

export function ClientsPanel() {
  const [clientes, setClientes] = useState([])
  const [searchTerm, setSearchTerm] = useState("")  
  const [loading, setLoading] = useState(true)
  const [clienteEditando, setClienteEditando] = useState(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchClientes()
  }, [])

  async function fetchClientes() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (data) setClientes(data)
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleBorrar = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro que deseas eliminar al cliente "${nombre}"?`)) return

    try {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error
      setClientes(clientes.filter(c => c.id !== id))
      toast({ title: "🗑️ Cliente eliminado", description: "El cliente ha sido borrado exitosamente." })
    } catch (error) {
      toast({ variant: "destructive", title: "Error al eliminar", description: error.message })
    }
  }

  const handleExport = () => {
    const cabeceras = "Nombre,RUC/Cedula,Email,Telefono,Direccion\n"
    const filas = clientesFiltrados.map(c => 
      `${c.nombre},${c.empresa || ''},${c.email || ''},${c.telefono || ''},"${c.direccion || ''}"`
    ).join("\n")
    const blob = new Blob([cabeceras + filas], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes_${new Date().toLocaleDateString()}.csv`
    a.click()
  }

  const clientesFiltrados = clientes.filter(cliente => {
    const texto = searchTerm.toLowerCase()
    return (
      cliente.nombre?.toLowerCase().includes(texto) ||
      cliente.empresa?.toLowerCase().includes(texto) ||
      cliente.email?.toLowerCase().includes(texto) ||
      cliente.telefono?.toLowerCase().includes(texto)
    )
  })

  return (
    <div id="printable-area" className="p-6 space-y-6 animate-in fade-in duration-500 relative bg-slate-50 min-h-screen">
      
      {/* --- HEADER VISIBLE SOLO EN IMPRESIÓN --- */}
      <div className="hidden print:block mb-8 text-center border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-900">Reporte de Clientes</h1>
        <p className="text-slate-500">
          Fecha de emisión: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
        </p>
        {searchTerm && (
          <p className="text-sm text-slate-400 mt-1">Filtro aplicado: "{searchTerm}"</p>
        )}
      </div>

      {/* --- HEADER NORMAL --- */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm no-print">
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h1>
        <p className="text-sm text-slate-500 mt-1">Administra la base de datos de clientes.</p>
      </div>

      {/* --- TOOLBAR --- */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4 no-print">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <Button 
            onClick={() => setClienteEditando({})} 
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full md:w-auto"
          >
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
          <Input
            placeholder="Buscar por nombre, RUC o email..."
            className="pl-10 w-full border-slate-200 bg-slate-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* --- TABLA --- */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs print:bg-white print:border-b-2 print:border-black">
              <tr>
                <th className="px-6 py-4">Razón Social</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Ced / RUC</th>
                <th className="px-6 py-4">Dirección</th>
                <th className="px-6 py-4">Celular</th>
                <th className="px-6 py-4 text-center no-print">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-300">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-12 text-slate-500">Cargando...</td></tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-12 text-slate-500">No se encontraron datos.</td></tr>
              ) : (
                clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent">
                    <td className="px-6 py-4 font-medium text-slate-900">{cliente.nombre}</td>
                    <td className="px-6 py-4 text-slate-600">{cliente.email || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{cliente.empresa || '-'}</td>
                    <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate print:whitespace-normal print:overflow-visible">
                      {cliente.direccion || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{cliente.telefono || '-'}</td>
                    <td className="px-6 py-4 text-center no-print">
                      <div className="flex justify-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setClienteEditando(cliente)}>
                          <Pencil size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleBorrar(cliente.id, cliente.nombre)}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 text-xs text-slate-500 print:bg-white print:mt-4 print:text-right">
          Total de registros: {clientesFiltrados.length}
        </div>
      </div>

      {/* MODAL */}
      {clienteEditando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
          <div className="w-full max-w-3xl animate-in zoom-in duration-200">
            <ClientForm 
              clienteAEditar={clienteEditando.id ? clienteEditando : null} 
              onCancel={() => setClienteEditando(null)}
              onSuccess={() => { setClienteEditando(null); fetchClientes(); }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ESTO ES IMPORTANTE PARA EVITAR EL ERROR DE IMPORTACIÓN
export default ClientsPanel;