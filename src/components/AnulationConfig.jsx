import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldAlert, Users, Percent, Save, Loader2, Edit3, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/Text'; 
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const AnulationConfig = () => {
  const [rolesConfig, setRolesConfig] = useState([]);
  const [ivaGlobal, setIvaGlobal] = useState(15);
  const [loading, setLoading] = useState(true);
  const [savingIva, setSavingIva] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Cargar Permisos desde role_permissions
      const { data: rolesData } = await supabase
        .from('role_permissions')
        .select('*')
        .neq('role', 'Administrador') // Ocultamos Admin (siempre tiene permiso)
        .order('role');
        
      if (rolesData) setRolesConfig(rolesData);

      // 2. Cargar IVA Global
      const { data: configData } = await supabase
        .from('configuracion_global')
        .select('iva_porcentaje')
        .eq('id', 1)
        .single();
      
      if (configData) setIvaGlobal(configData.iva_porcentaje);

    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo cargar la configuración", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLER GENÉRICO PARA PERMISOS (EDITAR O ANULAR) ---
  const handleTogglePermission = async (rolName, field, currentValue) => {
    // 1. Actualización Optimista en UI
    const updated = rolesConfig.map(r => 
        r.role === rolName ? { ...r, [field]: !currentValue } : r
    );
    setRolesConfig(updated);

    try {
      // 2. Actualización en Base de Datos
      const { error } = await supabase
        .from('role_permissions')
        .update({ [field]: !currentValue }) // Actualiza can_anulate O can_edit
        .eq('role', rolName);

      if (error) throw error;
      
      const actionName = field === 'can_edit' ? 'Edición' : 'Anulación';
      toast({ description: `Permiso de ${actionName} actualizado para ${rolName}.` });

    } catch (error) {
      console.error(error);
      fetchData(); // Revertir si falla
      toast({ title: "Error", description: "No se pudo guardar el cambio.", variant: "destructive" });
    }
  };

  const handleSaveIva = async () => {
    setSavingIva(true);
    try {
      const { error } = await supabase
        .from('configuracion_global')
        .update({ iva_porcentaje: ivaGlobal })
        .eq('id', 1);

      if (error) throw error;
      toast({ title: "✅ IVA Actualizado", description: `Valor global: ${ivaGlobal}%` });
    } catch (error) {
      toast({ title: "Error al guardar IVA", variant: "destructive" });
    } finally {
      setSavingIva(false);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600"/></div>;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in space-y-8 p-4 pb-20">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Configuración del Sistema</h2>
            <p className="text-slate-500">Parámetros operativos y permisos de acción crítica.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. SECCIÓN IVA */}
            <Card className="border-blue-100 shadow-md lg:col-span-2">
                <CardHeader className="bg-blue-50/50 pb-4">
                    <CardTitle className="flex items-center gap-2 text-blue-800"><Percent className="h-5 w-5"/> Impuestos Globales</CardTitle>
                    <CardDescription>Este valor se aplicará automáticamente a todas las nuevas órdenes.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex items-end gap-4 max-w-md">
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium text-slate-700">Porcentaje de IVA (%)</label>
                            <Input type="number" value={ivaGlobal} onChange={(e) => setIvaGlobal(e.target.value)} className="text-lg font-bold" />
                        </div>
                        <Button onClick={handleSaveIva} disabled={savingIva} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                            {savingIva ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Save className="h-4 w-4 mr-2"/> Guardar</>}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 2. PERMISOS DE EDICIÓN (NUEVO) */}
            <Card className="border-amber-200 shadow-md">
                <CardHeader className="bg-amber-50/50 pb-4">
                    <CardTitle className="flex items-center gap-2 text-amber-800"><Edit3 className="h-5 w-5"/> Permisos de Edición</CardTitle>
                    <CardDescription>Roles que pueden <b>modificar</b> órdenes activas.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {/* Admin Fijo */}
                        <div className="flex justify-between items-center px-6 py-4 bg-slate-50/30">
                            <div className="flex items-center gap-3"><div className="bg-slate-200 p-2 rounded-full"><Lock className="h-4 w-4 text-slate-500"/></div><span className="font-semibold text-slate-700">Administrador</span></div>
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">SIEMPRE</span>
                        </div>
                        {/* Lista Roles */}
                        {rolesConfig.map((item) => (
                            <div key={`edit-${item.role}`} className="flex justify-between items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                                <span className="font-medium text-slate-700">{item.role}</span>
                                <Switch 
                                    checked={item.can_edit || false} 
                                    onCheckedChange={() => handleTogglePermission(item.role, 'can_edit', item.can_edit)} 
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* 3. PERMISOS DE ANULACIÓN */}
            <Card className="border-red-200 shadow-md">
                <CardHeader className="bg-red-50/50 pb-4">
                    <CardTitle className="flex items-center gap-2 text-red-800"><ShieldAlert className="h-5 w-5"/> Permisos de Anulación</CardTitle>
                    <CardDescription>Roles que pueden <b>cancelar/anular</b> órdenes.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {/* Admin Fijo */}
                        <div className="flex justify-between items-center px-6 py-4 bg-slate-50/30">
                            <div className="flex items-center gap-3"><div className="bg-slate-200 p-2 rounded-full"><Lock className="h-4 w-4 text-slate-500"/></div><span className="font-semibold text-slate-700">Administrador</span></div>
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">SIEMPRE</span>
                        </div>
                        {/* Lista Roles */}
                        {rolesConfig.map((item) => (
                            <div key={`anulate-${item.role}`} className="flex justify-between items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                                <span className="font-medium text-slate-700">{item.role}</span>
                                <Switch 
                                    checked={item.can_anulate || false} 
                                    onCheckedChange={() => handleTogglePermission(item.role, 'can_anulate', item.can_anulate)} 
                                    className="data-[state=checked]:bg-red-500"
                                />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

        </div>
    </div>
  );
};

export default AnulationConfig; 