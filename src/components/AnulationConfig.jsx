import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldAlert, Users, Percent, Save, Loader2 } from 'lucide-react';
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
      
      // 1. Cargar Permisos desde role_permissions (OPTIMIZADO)
      const { data: rolesData } = await supabase
        .from('role_permissions')
        .select('*')
        .neq('role', 'Administrador') // Opcional: Ocultar Admin porque siempre tiene permiso
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

  // --- HANDLER PERMISOS ---
  const handleToggleRole = async (rolName, currentValue) => {
    // Optimista
    const updated = rolesConfig.map(r => r.role === rolName ? { ...r, can_anulate: !currentValue } : r);
    setRolesConfig(updated);

    try {
      // Actualizamos en la tabla unificada
      const { error } = await supabase
        .from('role_permissions')
        .update({ can_anulate: !currentValue })
        .eq('role', rolName);

      if (error) throw error;
      
      toast({ description: `Permiso para ${rolName} actualizado.` });
    } catch (error) {
      fetchData(); // Revertir
      toast({ title: "Error", variant: "destructive" });
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

  if (loading) return <div className="p-10 text-center">Cargando configuración...</div>;

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in space-y-8 p-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Configuración de Órdenes</h2>
            <p className="text-slate-500">Parámetros globales y permisos del sistema.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* SECCIÓN IVA */}
            <Card className="border-blue-100 shadow-md">
                <CardHeader className="bg-blue-50/50 pb-4">
                    <CardTitle className="flex items-center gap-2 text-blue-800"><Percent className="h-5 w-5"/> Impuestos Globales</CardTitle>
                    <CardDescription>IVA automático para nuevas órdenes.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex items-end gap-4">
                        <div className="space-y-2 flex-1">
                            <label className="text-sm font-medium text-slate-700">Porcentaje (%)</label>
                            <Input type="number" value={ivaGlobal} onChange={(e) => setIvaGlobal(e.target.value)} className="text-lg font-bold" />
                        </div>
                        <Button onClick={handleSaveIva} disabled={savingIva} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                            {savingIva ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Save className="h-4 w-4 mr-2"/> Guardar</>}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* SECCIÓN PERMISOS */}
            <Card className="border-slate-200 shadow-md">
                <CardHeader className="bg-slate-50/50 pb-4">
                    <CardTitle className="flex items-center gap-2 text-slate-800"><ShieldAlert className="h-5 w-5 text-red-600"/> Permisos de Anulación</CardTitle>
                    <CardDescription>Define qué roles pueden ANULAR órdenes.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        <div className="flex justify-between items-center px-6 py-4 bg-slate-50/30">
                            <div className="flex items-center gap-3"><div className="bg-slate-200 p-2 rounded-full"><Users className="h-4 w-4 text-slate-500"/></div><span className="font-semibold text-slate-700">Administrador</span></div>
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">SIEMPRE ACTIVO</span>
                        </div>
                        {rolesConfig.map((item) => (
                            <div key={item.id} className="flex justify-between items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                                <span className="font-medium text-slate-700">{item.role}</span>
                                <Switch checked={item.can_anulate} onCheckedChange={() => handleToggleRole(item.role, item.can_anulate)} />
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