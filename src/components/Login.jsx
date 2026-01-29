import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
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
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-200">
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-blue-900 rounded-lg mx-auto mb-4 flex items-center justify-center">
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Gráficas ADR</h1>
          <p className="text-slate-500 text-sm">Sistema de Gestión de Producción</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <Label htmlFor="username">Usuario</Label>
            <Input 
              id="username" 
              type="text" 
              placeholder="Ej: juanperez"
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="mt-1"
              required
            />
          </div>
          <Button type="submit" className="w-full bg-blue-900 hover:bg-blue-800 h-11 text-base" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </Button>
        </form>
        
        <div className="mt-6 text-center text-xs text-slate-400">
          ¿Olvidaste tu contraseña? Contacta al administrador.
        </div>
      </div>
    </div>
  );
};

export default Login;
