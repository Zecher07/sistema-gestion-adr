import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Save, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// --- DEFINICIÓN COMPLETA DE TODOS LOS PERMISOS DEL SISTEMA ---
const ALL_MENU_ITEMS = [
  // 1. INICIO
  { id: 'inicio', label: 'Inicio / Dashboard (Vista Principal)', category: 'Inicio' },

  // 2. CLIENTES
  { id: 'clientes', label: 'Clientes (Menú Lateral)', category: 'Clientes' },
  { id: 'clientes-lista', label: 'Ver Lista de Clientes', category: 'Clientes' },
  { id: 'clientes-nuevo', label: 'Crear / Editar Clientes', category: 'Clientes' },

  // 3. COTIZACIONES (PROFORMAS)
  { id: 'proformas', label: 'Cotizaciones / Proformas (Panel Completo)', category: 'Cotizaciones' },

  // 4. ÓRDENES DE PRODUCCIÓN
  { id: 'ordenes', label: 'Órdenes (Menú Lateral)', category: 'Producción' },
  { id: 'ordenes-todas', label: 'Ver Todas las Órdenes', category: 'Producción' },
  { id: 'ordenes-nueva', label: 'Crear Nueva Orden', category: 'Producción' },
  { id: 'ordenes-sin-factura', label: 'Filtro: Sin Factura', category: 'Producción' },
  { id: 'ordenes-con-factura', label: 'Filtro: Con Factura', category: 'Producción' },
  { id: 'ordenes-credito', label: 'Filtro: Crédito', category: 'Producción' },
  { id: 'ordenes-archivadas', label: 'Ver Archivo Muerto (Papelera)', category: 'Producción' },

  // 5. FACTURACIÓN
  { id: 'facturacion-panel', label: 'Módulo de Facturación', category: 'Facturación' },

  // 6. ÁREA DE TRABAJO (KANBAN)
  { id: 'trabajo', label: 'Área de Trabajo (Menú Lateral)', category: 'Área de Trabajo' },
  { id: 'trabajo-listado', label: 'Vista Lista (Global)', category: 'Área de Trabajo' },
  { id: 'trabajo-mistareas', label: 'Vista Tablero (Kanban)', category: 'Área de Trabajo' },
  { id: 'trabajo-disponibilidad', label: 'Vista Calendario', category: 'Área de Trabajo' },

  // 7. ESTADÍSTICAS Y CAJA
  { id: 'estadisticas', label: 'Estadísticas (Menú Lateral)', category: 'Reportes' },
  { id: 'estadisticas-graficos', label: 'Gráficos de Rendimiento', category: 'Reportes' },
  { id: 'estadisticas-reporte', label: 'Cierre de Caja Diario', category: 'Reportes' },

  // 8. ADMINISTRACIÓN
  { id: 'usuarios', label: 'Admin (Menú Lateral)', category: 'Administración' },
  { id: 'admin-usuarios', label: 'Gestión de Personal (Usuarios)', category: 'Administración' },
  { id: 'roles-permisos', label: 'Configurar Roles y Permisos', category: 'Administración' },
  
  // 9. OTROS
  { id: 'mi-perfil', label: 'Mi Perfil', category: 'General' },
];

const ROLES = ['Administrador', 'Vendedor', 'Producción', 'Contabilidad'];

// Agrupamos los items por categoría para pintarlos bonitos
const ITEMS_BY_CATEGORY = ALL_MENU_ITEMS.reduce((acc, item) => {
  if (!acc[item.category]) acc[item.category] = [];
  acc[item.category].push(item);
  return acc;
}, {});

const RolesPermissions = () => {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase.from('role_permissions').select('*');
      if (error) throw error;

      // Convertir array de DB a objeto { Rol: [vistas...] }
      const permObj = {};
      data.forEach(row => { permObj[row.role] = row.allowed_views || []; });
      
      // Asegurar que existan todos los roles aunque sea vacíos
      ROLES.forEach(r => { if (!permObj[r]) permObj[r] = []; });

      setPermissions(permObj);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar los permisos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (role, viewId) => {
    if (role === 'Administrador') return; // Admin siempre tiene todo, no dejar quitar

    const currentViews = permissions[role] || [];
    let newViews;
    if (currentViews.includes(viewId)) {
      newViews = currentViews.filter(id => id !== viewId); // Quitar
    } else {
      newViews = [...currentViews, viewId]; // Poner
    }
    setPermissions({ ...permissions, [role]: newViews });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Preparar actualizaciones para Supabase
      const updates = Object.keys(permissions).map(role => {
        return supabase
          .from('role_permissions')
          .upsert({ role: role, allowed_views: permissions[role] }, { onConflict: 'role' });
      });

      await Promise.all(updates);
      
      toast({ 
        title: "✅ Permisos Actualizados", 
        description: "Los cambios se aplicarán la próxima vez que los usuarios inicien sesión." 
      });
      
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600"/></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Encabezado */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Shield className="h-7 w-7 text-blue-600" /> Control de Acceso
            </h2>
            <p className="text-slate-500 text-sm">Define qué puede ver y hacer cada rol en el sistema.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 min-w-[150px] h-11 text-base">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            {saving ? 'Guardando...' : 'Guardar Matriz'}
        </Button>
      </div>

      {/* Matriz de Permisos */}
      <Card className="border-slate-200 shadow-lg overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-lg text-slate-700">Matriz de Permisos por Rol</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-700 uppercase bg-slate-100 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 w-1/3 min-w-[250px]">Módulo / Vista</th>
                        {ROLES.map(role => (
                            <th key={role} className={`px-6 py-4 text-center min-w-[100px] ${role === 'Administrador' ? 'text-blue-700 bg-blue-50' : ''}`}>
                                {role}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {Object.keys(ITEMS_BY_CATEGORY).map((category) => (
                        <React.Fragment key={category}>
                            {/* Título de Categoría */}
                            <tr className="bg-slate-50/80">
                                <td colSpan={ROLES.length + 1} className="px-6 py-2 font-bold text-slate-800 text-xs uppercase tracking-wider border-y border-slate-200">
                                    {category}
                                </td>
                            </tr>
                            {/* Items de la Categoría */}
                            {ITEMS_BY_CATEGORY[category].map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors bg-white">
                                    <td className="px-6 py-3 font-medium text-slate-900 border-r border-slate-100">
                                        {item.label}
                                        <div className="text-[10px] text-slate-400 font-mono">{item.id}</div>
                                    </td>
                                    {ROLES.map(role => {
                                        const isChecked = role === 'Administrador' ? true : (permissions[role]?.includes(item.id) || false);
                                        const isAdmin = role === 'Administrador';
                                        
                                        return (
                                            <td key={role} className={`px-6 py-3 text-center border-r border-slate-50 ${isAdmin ? 'bg-blue-50/30' : ''}`}>
                                                <div className="flex justify-center">
                                                    <input 
                                                        type="checkbox" 
                                                        className={`w-5 h-5 rounded border-slate-300 focus:ring-blue-500 cursor-pointer ${isAdmin ? 'opacity-50 cursor-not-allowed accent-blue-600' : 'accent-blue-600'}`}
                                                        checked={isChecked} 
                                                        disabled={isAdmin}
                                                        onChange={() => togglePermission(role, item.id)} 
                                                    />
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default RolesPermissions;