import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, FileText, Briefcase, Settings, BarChart2, LogOut, ChevronRight, ChevronDown, UserCircle, Shield, Receipt, FileSpreadsheet, Package, ShieldCheck, BookOpen, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const MenuItem = ({ item, isActive, currentView, onClick, onSubItemClick }) => {
  const Icon = item.icon;
  const hasSubmenu = item.submenu && item.submenu.length > 0;
  const isChildActive = hasSubmenu && item.submenu.some(sub => sub.id === currentView);
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(isChildActive);

  React.useEffect(() => { if (isChildActive) setIsSubmenuOpen(true); }, [isChildActive]);

  const handleClick = () => {
    if (hasSubmenu) setIsSubmenuOpen(!isSubmenuOpen);
    else { onClick(item); if (item.action) item.action(); }
  };

  return (
    <div className="mb-1">
      {/* 🔧 NUEVO: los ítems SIN submenú (páginas de verdad, no "toggles") ahora son
          <a href="#view=..."> reales, para que el clic derecho -> "Abrir en pestaña
          nueva" del navegador funcione. "Cerrar Sesión" y los que abren un submenú
          siguen siendo botones normales, porque no son navegación a una pantalla. */}
      {!hasSubmenu && item.id !== 'salir' ? (
        <a
          href={`#view=${item.id}`}
          onClick={(e) => { e.preventDefault(); handleClick(); }}
          className={cn("w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 group relative cursor-pointer", isActive ? "text-blue-400 bg-slate-800 border-l-4 border-blue-500" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 hover:pl-5 border-l-4 border-transparent")}
        >
          <div className="flex items-center gap-3"><Icon className={cn("h-5 w-5", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} /><span>{item.label}</span></div>
        </a>
      ) : (
        <button onClick={handleClick} className={cn("w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 group relative", isActive ? "text-blue-400 bg-slate-800 border-l-4 border-blue-500" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 hover:pl-5 border-l-4 border-transparent")}>
          <div className="flex items-center gap-3"><Icon className={cn("h-5 w-5", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} /><span>{item.label}</span></div>
          {hasSubmenu && <div className="text-slate-600">{isSubmenuOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>}
        </button>
      )}

      <AnimatePresence>
        {hasSubmenu && isSubmenuOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-900/50">
            {item.submenu.map((subItem, idx) => (
                <a
                    key={idx}
                    href={`#view=${subItem.id}`}
                    onClick={(e) => { e.preventDefault(); onSubItemClick(subItem.id); }}
                    className={cn("block w-full text-left pl-12 pr-4 py-2 text-xs transition-colors border-l-2 cursor-pointer", currentView === subItem.id ? "text-blue-400 border-blue-500 bg-slate-800/30" : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800")}
                >
                  {subItem.label}
                </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Sidebar = ({ user, onLogout, currentView, onViewChange, allowedViews = [] }) => {
  
  const allMenuItems = [
    { id: 'inicio', label: 'Inicio', icon: Home }, 
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell }, // 🔥 NUEVA PESTAÑA AÑADIDA
    { id: 'clientes', label: 'Clientes', icon: Users, submenu: [
        { label: 'Lista de Clientes', id: 'clientes-lista' },
        { label: 'Nuevo Cliente', id: 'clientes-nuevo' }
      ]
    }, 
    { id: 'proformas', label: 'Cotizaciones', icon: FileSpreadsheet },
    { id: 'ordenes', label: 'Órdenes Producción', icon: FileText, submenu: [
        { label: 'Ver Todas', id: 'ordenes-todas' },
        { label: 'Activas', id: 'ordenes-activas' }, 
        { label: 'Nueva Orden', id: 'ordenes-nueva' },
        { label: 'Sin Factura', id: 'ordenes-sin-factura' },
        { label: 'Con Factura', id: 'ordenes-con-factura' },
        { label: 'Crédito', id: 'ordenes-credito' },
        { label: 'Impagas', id: 'ordenes-impagas' },
        { label: 'Vales de Caja', id: 'vales' },
        { label: 'Archivadas', id: 'ordenes-archivadas' }
      ]
    },
    { id: 'facturacion-panel', label: 'Facturación', icon: Receipt },
    { id: 'contabilidad', label: 'Contabilidad', icon: ShieldCheck, submenu: [
        { label: 'Cierre Contable (Órdenes)', id: 'contabilidad-cierre' },
        { label: 'Libro Diario General', id: 'libro-diario-general' }
      ]
    },
    { id: 'inventario', label: 'Inventario', icon: Package, submenu: [
        { label: 'Ver Inventario', id: 'inventario-ver' },
        { label: 'Gestionar Inventario', id: 'inventario-gestionar' },
        { label: 'Catálogo / Precios', id: 'inventario-catalogo' }
      ]
    },
    { id: 'trabajo', label: 'Área de Trabajo', icon: Briefcase, submenu: [
        { label: 'Lista Tareas', id: 'trabajo-listado' }, 
        { label: 'Tablero Kanban', id: 'trabajo-mistareas' },
        { label: 'Calendario', id: 'trabajo-disponibilidad' }
      ]
    }, 
    { id: 'usuarios', label: 'Admin Usuarios', icon: Shield, submenu: [
        { label: 'Gestión Personal', id: 'admin-usuarios' }, 
        { label: 'Roles y Permisos', id: 'roles-permisos' } 
      ]
    },
    { id: 'estadisticas', label: 'Estadísticas', icon: BarChart2, submenu: [
        { label: 'Gráficos', id: 'estadisticas-graficos' }, 
        { label: 'Mi Reporte Diario', id: 'estadisticas-reporte' }
      ]
    }, 
    { id: 'mi-perfil', label: 'Mi Perfil', icon: UserCircle },
    { id: 'salir', label: 'Cerrar Sesión', icon: LogOut, action: onLogout },
  ];

  const isAllowed = (id) => {
      // 1. Los administradores ven todo
      if (user?.role === 'Administrador') return true;
      
      // 2. Vistas básicas permitidas para todos
      if (id === 'salir' || id === 'inicio' || id === 'mi-perfil' || id === 'notificaciones') return true;
      
      // 3. REGLA ESPECIAL PARA 'ACTIVAS': 
      if (id === 'ordenes-activas' && allowedViews.some(v => String(v).startsWith('ordenes'))) {
          return true;
      }

      // 4. Verificación estándar contra la base de datos
      return allowedViews.includes(id);
  };

  const visibleItems = allMenuItems.map(item => {
    if (item.id === 'salir' || item.id === 'inicio' || item.id === 'mi-perfil' || item.id === 'notificaciones') return item;
    if (user?.role === 'Administrador') return item; 

    if (item.submenu) {
        const filteredSub = item.submenu.filter(sub => isAllowed(sub.id));
        
        if (isAllowed(item.id) && filteredSub.length === 0) {
             return item;
        }

        if (filteredSub.length > 0 || isAllowed(item.id)) {
            return { ...item, submenu: filteredSub };
        }
        return null;
    }

    if (!isAllowed(item.id)) return null;

    return item;
  }).filter(Boolean);

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col shadow-2xl border-r border-slate-800 fixed left-0 top-0 z-40 overflow-y-auto print:hidden">
      <div className="p-6 border-b border-slate-800">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-white truncate">{user?.name}</h2>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{user?.role}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 py-4">
        {visibleItems.map(item => (
          <MenuItem 
            key={item.label} 
            item={item} 
            isActive={currentView === item.id || (item.submenu && item.submenu.some(sub => sub.id === currentView))} 
            currentView={currentView} 
            onClick={(item) => item.id && !item.submenu && onViewChange(item.id)} 
            onSubItemClick={(subId) => onViewChange(subId)} 
          />
        ))}
      </div>
      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-600 text-center">Sistema v2.1 - Inventario Roles</div>
    </div>
  );
};

export default Sidebar;