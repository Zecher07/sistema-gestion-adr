import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Users, Trash2, Pencil, X, Lock, AlertTriangle } from 'lucide-react';

const DOMINIO_INTERNO = "@graficasadr.com"; 

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ username: '', password: '', fullName: '', role: 'Vendedor' });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [originalUsername, setOriginalUsername] = useState(''); // 🔧 NUEVO: para saber si de verdad cambió
  const [userToDelete, setUserToDelete] = useState(null); 
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  const handleEditClick = (user) => {
    setEditingId(user.id);
    const simpleUser = user.email ? user.email.replace(DOMINIO_INTERNO, '') : '';
    setOriginalUsername(simpleUser);
    setFormData({
      username: simpleUser,
      password: '', 
      fullName: user.full_name,
      role: user.role
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setOriginalUsername('');
    setFormData({ username: '', password: '', fullName: '', role: 'Vendedor' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.fullName,
            role: formData.role
          })
          .eq('id', editingId);

        if (profileError) throw profileError;

        // 🔧 NUEVO: si el usuario de acceso cambió, actualizarlo también
        const nuevoUsername = formData.username.trim().replace(/\s+/g, '').toLowerCase();
        if (nuevoUsername && nuevoUsername !== originalUsername) {
            const { error: usernameError } = await supabase.rpc('admin_update_username', {
                target_user_id: editingId,
                new_username: nuevoUsername
            });
            if (usernameError) throw usernameError;
        }

        if (formData.password && formData.password.trim() !== '') {
            const { error: passwordError } = await supabase.rpc('admin_update_password', {
                target_user_id: editingId,
                new_password: formData.password
            });
            if (passwordError) throw passwordError;
            toast({ title: "Datos Actualizados", description: "Perfil, usuario y contraseña modificados." });
        } else {
            toast({ title: "Datos Actualizados", description: "Perfil modificado correctamente." });
        }

      } else {
        if (!formData.password) throw new Error("La contraseña es obligatoria");
        
        const emailFalso = `${formData.username.trim().replace(/\s+/g, '')}${DOMINIO_INTERNO}`;
        
        const { error } = await supabase.auth.signUp({
          email: emailFalso,
          password: formData.password,
          options: {
            data: { full_name: formData.fullName, role: formData.role }
          }
        });

        if (error) throw error;
        toast({ title: "Usuario Creado", description: `Usuario: ${formData.username}` });
      }

      handleCancelEdit();
      setTimeout(fetchUsers, 1000); 

    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: error.message || "Error al procesar", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setLoading(true);
    try {
        const { error } = await supabase.rpc('admin_delete_user', {
            target_user_id: userToDelete.id
        });
        
        if (error) throw error;
        
        setUsers(users.filter(u => u.id !== userToDelete.id));
        toast({ title: "Usuario Eliminado", description: `Se ha eliminado a ${userToDelete.full_name} y todos sus datos.` });
        
        setUserToDelete(null); 

    } catch (error) {
        console.error(error);
        toast({ title: "Error al eliminar", description: error.message || "No se pudo borrar el usuario.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Users className="h-6 w-6" /> Gestión de Personal
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* --- FORMULARIO --- */}
        <Card className={`border-slate-200 shadow-sm ${editingId ? 'border-yellow-400 bg-yellow-50' : ''}`}>
          <CardHeader className="bg-white/50 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              {editingId ? <Pencil className="h-5 w-5 text-yellow-600" /> : <UserPlus className="h-5 w-5 text-blue-600" />}
              {editingId ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nombre Completo</Label>
                <Input 
                  value={formData.fullName} 
                  onChange={e => setFormData({...formData, fullName: e.target.value})} 
                  required
                />
              </div>
              
              <div>
                <Label className="text-blue-700 font-bold">Usuario de Acceso</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={formData.username} 
                    onChange={e => setFormData({...formData, username: e.target.value.toLowerCase()})} 
                    placeholder="ej: juanperez"
                    required
                  />
                  <span className="text-xs text-gray-400 font-mono hidden md:block">{DOMINIO_INTERNO}</span>
                </div>
                {editingId && (
                    <p className="text-[10px] text-amber-600 mt-1">
                        ⚠️ Si lo cambias, esta persona deberá volver a entrar con el nuevo usuario la próxima vez.
                    </p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-2">
                    Contraseña 
                    {editingId && <span className="text-[10px] bg-yellow-200 px-2 rounded text-yellow-800 font-bold">Opcional: Solo si quieres cambiarla</span>}
                </Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input 
                        type="password" 
                        placeholder={editingId ? "Nueva contraseña (O dejar vacío)" : "Crear contraseña"}
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        className="pl-9"
                        required={!editingId}
                    />
                </div>
              </div>

              <div>
                <Label>Rol (Permisos)</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Vendedor">Vendedor</option>
                  <option value="Producción">Producción</option>
                  <option value="Contabilidad">Contabilidad</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={loading} className={`flex-1 ${editingId ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-900 hover:bg-blue-800'}`}>
                  {loading ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Crear Usuario')}
                </Button>
                
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    <X className="h-4 w-4" /> Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* --- LISTA --- */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-lg">Personal Activo</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="p-3 border rounded-lg flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                  <div className="overflow-hidden">
                    <div className="font-bold text-slate-800 truncate">{u.full_name}</div>
                    <div className="text-xs text-blue-600 font-mono">
                       User: {u.email ? u.email.replace(DOMINIO_INTERNO, '') : '...'}
                    </div>
                    <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                        u.role === 'Administrador' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        u.role === 'Producción' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        u.role === 'Contabilidad' ? 'bg-green-100 text-green-700 border-green-200' :
                        'bg-blue-100 text-blue-700 border-blue-200'
                      }`}>
                        {u.role}
                    </span>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-yellow-600" onClick={() => handleEditClick(u)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-500 hover:text-red-600" 
                        onClick={() => setUserToDelete(u)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {userToDelete && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                 {/* Encabezado Rojo */}
                 <div className="bg-red-50 p-6 flex flex-col items-center justify-center border-b border-red-100">
                     <div className="bg-red-100 p-3 rounded-full mb-3">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                     </div>
                     <h3 className="text-xl font-bold text-red-900">¿Estás seguro?</h3>
                     <p className="text-red-700 text-center text-sm mt-2">
                        Estás a punto de eliminar permanentemente a:
                     </p>
                     <p className="font-bold text-lg text-red-800 mt-1">{userToDelete.full_name}</p>
                 </div>

                 {/* Cuerpo del Mensaje */}
                 <div className="p-6">
                     <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-600 mb-6">
                        <p className="font-bold mb-1">Advertencia de Seguridad:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Se borrará su acceso al sistema.</li>
                            <li>Se eliminarán todos sus <strong>Reportes de Caja</strong>.</li>
                            <li>Esta acción <strong>NO se puede deshacer</strong>.</li>
                        </ul>
                     </div>

                     <div className="flex gap-3">
                         <Button 
                            variant="outline" 
                            onClick={() => setUserToDelete(null)}
                            className="flex-1 h-12 text-slate-600 border-slate-300 hover:bg-slate-50"
                         >
                            Cancelar
                         </Button>
                         <Button 
                            onClick={confirmDeleteUser} 
                            disabled={loading}
                            className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white font-bold"
                         >
                            {loading ? 'Eliminando...' : 'Sí, Eliminar Definitivamente'}
                         </Button>
                     </div>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default UserManagement;