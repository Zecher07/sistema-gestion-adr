import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Save, Shield, Lock } from 'lucide-react';

const MyProfile = ({ user }) => {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  // 🔧 NUEVO: cambio de contraseña propia (Vendedor, Producción, Contabilidad, Admin)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
        getProfile();
    }
  }, [user]);

  const getProfile = async () => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error) throw error;
        setFullName(data.full_name);
        setRole(data.role);
    } catch (error) {
        console.error(error);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Llamamos a la función segura que creamos en SQL
      const { error } = await supabase.rpc('update_own_profile', {
        new_name: fullName
      });

      if (error) throw error;

      toast({ 
        title: "Perfil Actualizado", 
        description: "Tu nombre ha sido modificado correctamente." 
      });
      
      // Actualizamos el localStorage para que se vea el cambio arriba a la derecha
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      if (currentUser) {
          currentUser.name = fullName;
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
      
      // Recargar la página para ver el cambio en el menú lateral
      setTimeout(() => window.location.reload(), 1000);

    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 🔧 NUEVO: cada quien cambia su propia contraseña — esto es autoservicio normal
  // de Supabase Auth (supabase.auth.updateUser), no requiere permisos de Admin ni
  // ninguna función especial, porque solo afecta la sesión de quien está logueado.
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
        toast({ title: "Contraseña muy corta", description: "Debe tener al menos 6 caracteres.", variant: "destructive" });
        return;
    }
    if (newPassword !== confirmPassword) {
        toast({ title: "Las contraseñas no coinciden", description: "Escribe la misma contraseña en ambos campos.", variant: "destructive" });
        return;
    }

    setChangingPassword(true);
    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        toast({ title: "Contraseña Actualizada", description: "La próxima vez que inicies sesión, usa tu nueva contraseña." });
        setNewPassword('');
        setConfirmPassword('');
    } catch (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
        setChangingPassword(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <User className="h-6 w-6 text-blue-600" /> Mi Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleUpdate} className="space-y-6">
            
            {/* Campo de Rol (Bloqueado) */}
            <div>
              <Label className="text-slate-500 text-xs uppercase font-bold">Tu Cargo / Rol</Label>
              <div className="flex items-center gap-2 mt-1 p-2 bg-slate-100 rounded border text-slate-600">
                <Shield className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{role}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                * Solo el Administrador puede cambiar tu rol.
              </p>
            </div>

            {/* Campo de Nombre (Editable) */}
            <div>
              <Label htmlFor="name">Nombre Completo</Label>
              <Input 
                id="name"
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                className="mt-1"
                placeholder="Tu nombre"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-blue-900 hover:bg-blue-800">
              {loading ? 'Guardando...' : <><Save className="mr-2 h-4 w-4" /> Guardar Cambios</>}
            </Button>

          </form>
        </CardContent>
      </Card>

      {/* 🔧 NUEVO: tarjeta separada para cambiar la contraseña propia */}
      <Card className="mt-6">
        <CardHeader className="border-b bg-slate-50">
          <CardTitle className="flex items-center gap-2 text-slate-800 text-base">
            <Lock className="h-5 w-5 text-blue-600" /> Cambiar mi Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nueva Contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Repetir Nueva Contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
                placeholder="Escribe la misma contraseña"
                required
              />
            </div>
            <Button type="submit" disabled={changingPassword} className="w-full bg-slate-700 hover:bg-slate-800">
              {changingPassword ? 'Actualizando...' : <><Lock className="mr-2 h-4 w-4" /> Actualizar Contraseña</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyProfile;