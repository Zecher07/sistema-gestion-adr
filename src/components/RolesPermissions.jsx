import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Save, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ALL_MENU_ITEMS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'clientes', label: 'Clientes (Menú)' },
  { id: 'ordenes', label: 'Órdenes (Menú)' },
  { id: 'trabajo', label: 'Área de Trabajo' },
  { id: 'usuarios', label: 'Usuarios (Menú)' },
  { id: 'config', label: 'Configuraciones' },
  { id: 'estadisticas', label: 'Estadísticas' },
  { id: 'estadisticas-graficos', label: 'Ver Gráficos' },
  { id: 'estadisticas-reporte', label: 'Ver Reporte Diario' },
  { id: 'mi-perfil', label: 'Mi Perfil' },
  { id: 'admin-usuarios', label: 'Gestión de Usuarios (Submenú)' },
  { id: 'roles-permisos', label: 'Roles y Permisos (Submenú)' },
];

const ROLES = ['Administrador', 'Vendedor', 'Producción', 'Contabilidad'];

const RolesPermissions = () => {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase.from('role_permissions').select('*');
      if (error) throw error;

      const permObj = {};
      data.forEach(row => {
        permObj[row.role] = row.allowed_views || [];
      });
      
      ROLES.forEach(r => {
        if (!permObj[r]) permObj[r] = [];
      });

      setPermissions(permObj);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (role, viewId) => {
    const currentViews = permissions[role] || [];
    let newViews;

    if (currentViews.includes(viewId)) {
      newViews = currentViews.filter(id => id !== viewId); 
    } else {
      newViews = [...currentViews, viewId]; 
    }

    setPermissions({
      ...permissions,
      [role]: newViews
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = Object.keys(permissions).map(role => {
        return supabase
          .from('role_permissions')
          .upsert({ role: role, allowed_views: permissions[role] });
      });

      await Promise.all(updates);
      
      toast({ title: "Cambios Guardados", description: "Los permisos se han actualizado. Los usuarios verán los cambios al recargar." });
      
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" /> Configuración de Roles y Permisos
        </h2>
        <Button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700">
            <Save className="mr-2 h-4 w-4" /> Guardar Cambios
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Matriz de Acceso</CardTitle></CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            <th className="px-6 py-3">Módulo / Vista</th>
                            {ROLES.map(role => (
                                <th key={role} className="px-6 py-3 text-center">{role}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ALL_MENU_ITEMS.map((item) => (
                            <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{item.label}</td>
                                {ROLES.map(role => {
                                    const isChecked = permissions[role]?.includes(item.id) || false ;
                                    const isRestricted = role === 'Administrador' && item.id === 'mi-perfil';
                                    
                                    return (
                                        <td key={role} className="px-6 py-4 text-center">
                                            {isRestricted ? (
                                                <span className="text-xs text-gray-300 italic">No Aplica</span>
                                            ) : (
                                                <input 
                                                    type="checkbox" 
                                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                                    checked={isChecked}
                                                    onChange={() => togglePermission(role, item.id)}
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RolesPermissions;