import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text'; 
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { LogIn, Loader2 } from 'lucide-react';

const DOMINIO_INTERNO = "@graficasadr.com"; 

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState(''); 
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const emailCompleto = `${username.trim()}${DOMINIO_INTERNO}`;

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailCompleto,
        password,
      });

      if (authError) throw authError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      onLogin({
        id: profileData.id,
        name: profileData.full_name || username,
        role: profileData.role
      });

      toast({ title: "Bienvenido", description: `Hola, ${profileData.full_name}` });

    } catch (error) {
      console.error(error);
      toast({ 
        title: "Error de acceso", 
        description: "Usuario o contraseña incorrectos",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      {/* Aumenté la sombra a shadow-xl y suavicé el borde */}
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 border border-slate-100">
        
        {/* Encabezado con más margen inferior (mb-10) */}
        <div className="text-center mb-10">
          <div className="h-14 w-14 bg-blue-900 rounded-xl mx-auto mb-4 flex items-center justify-center shadow-md">
            <LogIn className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gráficas ADR</h1>
          <p className="text-slate-500 text-sm mt-2">Sistema de Gestión de Producción</p>
        </div>

        {/* Aumenté el espaciado vertical global a space-y-6 */}
        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Grupo Usuario: Espaciado interno label-input de space-y-2 */}
          <div className="space-y-2">
            <Label htmlFor="username" className="text-slate-700 font-medium">Usuario</Label>
            <div className="relative">
              <Input 
                id="username" 
                type="text" 
                placeholder="Ej: juanperez"
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all" // Input más alto y con fondo suave
                required
              />
              <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-mono pointer-events-none">
                {DOMINIO_INTERNO}
              </span>
            </div>
          </div>

          {/* Grupo Contraseña */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-slate-700 font-medium">Contraseña</Label>
            </div>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-all"
              required
            />
          </div>

          {/* Botón separado con padding top (pt-2) */}
          <div className="pt-2">
            <Button 
                type="submit" 
                className="w-full bg-blue-900 hover:bg-blue-800 h-12 text-base font-semibold shadow-md transition-all hover:shadow-lg" 
                disabled={loading}
            >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </Button>
          </div>
        </form>
        
        <div className="mt-8 text-center text-xs text-slate-400">
          ¿Problemas para ingresar? Contacta al soporte técnico.
        </div>
      </div>
    </div>
  );
};

export default Login;