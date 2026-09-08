import React, { useState, useEffect, useMemo } from 'react';
import { Bell, UserPlus, Info, Receipt, FileText, ExternalLink, X, CheckCircle2, ArrowRight, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ShieldCheck, DollarSign, Landmark, Calendar, ShoppingCart, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../supabaseClient';
import { isUserInList } from '@/utils/userMatch';
import { cn } from '@/lib/utils';

// 🔧 CAMBIO 9: el aviso de "jornadas sin auditar" y toda la maquinaria de
// "jornada pendiente de archivar" SOLO aplican desde esta fecha en adelante.
// Antes de septiembre 2026 hubo muchos cambios seguidos al sistema y los días
// viejos daban falsos positivos (ej. el 8 de junio salía como "pendiente"
// disque porque las cajas no estaban verificadas por Contabilidad, lo cual
// era falso). No extender hacia atrás sin revisar esto primero.
const FECHA_INICIO_AUDITORIA = '2026-09-01';

// 🔧 NUEVO: calendario propio (un <input type="date"> normal no permite marcar
// días con datos adentro del calendario nativo del navegador). Este sí lo hace:
// pinta un puntito en los días que tienen información, y deja moverse a
// CUALQUIER día — tenga datos o no — con un solo clic.
const MiniCalendario = ({ fecha, onChange, tieneDatos, colorPunto = 'bg-indigo-500', colorBoton = 'indigo' }) => {
    const [abierto, setAbierto] = useState(false);
    const [posicion, setPosicion] = useState({ top: 0, left: 0 });
    const [mesVisible, setMesVisible] = useState(() => { const d = new Date(fecha + 'T12:00:00'); d.setDate(1); return d; });
    const botonRef = React.useRef(null);

    const fechaLegible = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

    // 🔧 FIX: antes el calendario usaba "absolute" dentro de la tarjeta, y como
    // las tarjetas están apiladas una debajo de otra (mismo nivel), la que
    // sigue abajo lo tapaba a medias. Ahora se calcula la posición real en la
    // pantalla (con "fixed") para que siempre aparezca completo, encima de todo.
    const abrirCalendario = () => {
        if (botonRef.current) {
            const rect = botonRef.current.getBoundingClientRect();
            const anchoCalendario = 256;
            let left = rect.right - anchoCalendario;
            if (left < 8) left = 8;
            setPosicion({ top: rect.bottom + 4, left });
        }
        setAbierto(v => !v);
    };

    const cambiarMes = (delta) => {
        const nuevo = new Date(mesVisible);
        nuevo.setMonth(nuevo.getMonth() + delta);
        setMesVisible(nuevo);
    };

    const diasDelMes = useMemo(() => {
        const anio = mesVisible.getFullYear();
        const mes = mesVisible.getMonth();
        const primerDiaSemana = new Date(anio, mes, 1).getDay(); // 0=domingo
        const totalDias = new Date(anio, mes + 1, 0).getDate();
        const celdas = [];
        for (let i = 0; i < primerDiaSemana; i++) celdas.push(null);
        for (let dia = 1; dia <= totalDias; dia++) {
            const mm = String(mes + 1).padStart(2, '0');
            const dd = String(dia).padStart(2, '0');
            celdas.push(`${anio}-${mm}-${dd}`);
        }
        return celdas;
    }, [mesVisible]);

    const colorClases = {
        indigo: 'border-indigo-300 hover:bg-indigo-50',
        red: 'border-red-300 hover:bg-red-50',
    };

    return (
        <div className="relative">
            <button
                ref={botonRef}
                onClick={abrirCalendario}
                className={cn("flex items-center gap-1.5 text-xs border rounded px-2 py-1 bg-white", colorClases[colorBoton] || colorClases.indigo)}
            >
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {fechaLegible}
            </button>

            {abierto && (
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setAbierto(false)}></div>
                    <div
                        className="fixed bg-white border border-slate-200 rounded-lg shadow-2xl z-[9999] p-3 w-64"
                        style={{ top: `${posicion.top}px`, left: `${posicion.left}px` }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <button onClick={() => cambiarMes(-1)} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft className="h-4 w-4" /></button>
                            <span className="text-xs font-bold text-slate-700 capitalize">{mesVisible.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                            <button onClick={() => cambiarMes(1)} className="p-1 hover:bg-slate-100 rounded"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-400 mb-1">
                            {['D','L','M','M','J','V','S'].map((d, i) => <div key={i}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {diasDelMes.map((diaStr, idx) => {
                                if (!diaStr) return <div key={idx}></div>;
                                const esSeleccionado = diaStr === fecha;
                                const tieneInfo = tieneDatos(diaStr);
                                const numeroDia = parseInt(diaStr.split('-')[2], 10);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => { onChange(diaStr); setAbierto(false); }}
                                        className={cn(
                                            "relative h-7 w-7 rounded-full text-[10px] font-medium flex items-center justify-center transition-colors",
                                            esSeleccionado ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
                                        )}
                                    >
                                        {numeroDia}
                                        {tieneInfo && !esSeleccionado && <span className={cn("absolute bottom-0.5 h-1 w-1 rounded-full", colorPunto)}></span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-[9px] text-slate-400">
                            <span className={cn("h-1.5 w-1.5 rounded-full", colorPunto)}></span> Con datos guardados
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const NotificationsPanel = ({ 
  user, 
  orders = [], 
  staffUsers = [],
  realtimeEvents = [], 
  onClearEvent,        
  onViewOrder,
  onViewChange       
}) => {
  const [pendingVales, setPendingVales] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'Administrador';

  // 🔧 CAMBIO: se unifica en una sola fecha (con flechas para moverse día a día,
  // más el calendario), en vez de 3 fechas independientes — coincide con el
  // diseño de "jornada del día" que se revisa y se cierra completa de una vez.
  const hoyStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const [fechaMaestra, setFechaMaestra] = useState(hoyStr);
  const [dailyClosings, setDailyClosings] = useState([]);
  const [accountingReports, setAccountingReports] = useState([]);
  const [todosLosVales, setTodosLosVales] = useState([]);
  const [loadingResumen, setLoadingResumen] = useState(true);
  // 🔧 NUEVO: compras recientes registradas en Inventario (Admin ve un
  // registro de cada compra, con quién la hizo, qué material, y la
  // factura/proveedor si él mismo la ingresó).
  const [comprasRecientes, setComprasRecientes] = useState([]);
  // 🔧 NUEVO: cuadres de inventario (auditorías) recientes — para que Admin
  // se entere apenas alguien ejecuta un cuadre, en vez de que quede "en el aire".
  const [cuadresRecientes, setCuadresRecientes] = useState([]);
  const [preciosInventario, setPreciosInventario] = useState({}); // { material_id: precio }
  const [marcandoRevisado, setMarcandoRevisado] = useState(null); // id del grupo que se está guardando
  const [cerrandoDia, setCerrandoDia] = useState(false);
  const [comprobanteGeneral, setComprobanteGeneral] = useState(null);
  // 🔧 CAMBIO 9: verificación MANUAL del depósito bancario del día. Admin revisa
  // la cuenta por fuera y marca este check; se guarda al instante (no espera al
  // botón de archivar). Se bloquea una vez que el día queda archivado/cerrado.
  const [depositoVerificado, setDepositoVerificado] = useState(false);
  const [guardandoDeposito, setGuardandoDeposito] = useState(false);
  // 🔧 CAMBIO 9: id del vale que se está marcando como auditado (spinner local).
  const [auditandoVale, setAuditandoVale] = useState(null);
  // 🔧 CAMBIO 9: id del grupo de auditoría cuyo detalle de descuadre está abierto.
  const [auditoriaExpandida, setAuditoriaExpandida] = useState(null);

  // 🔧 FIX: esta función se había perdido en una edición anterior — es la que
  // hace que las flechitas de navegar día a día realmente funcionen.
  const cambiarDia = (delta) => {
      const d = new Date(fechaMaestra + 'T12:00:00');
      d.setDate(d.getDate() + delta);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setFechaMaestra(`${d.getFullYear()}-${mm}-${dd}`);
  };

  // 🔧 NUEVO: detecta jornadas anteriores que tuvieron actividad (algún cierre
  // de caja de vendedor) pero nunca se marcaron como "CERRADO" en cierres_contables
  // — para avisar que hay que auditarlas en orden, antes de seguir avanzando.
  const jornadasSinAuditar = useMemo(() => {
      const diasConActividad = new Set(dailyClosings.map(c => c.date ? String(c.date).split('T')[0].trim() : null).filter(Boolean));
      return Array.from(diasConActividad)
          .filter(fecha => fecha < hoyStr) // solo días pasados, no hoy
          .filter(fecha => fecha >= FECHA_INICIO_AUDITORIA) // 🔧 CAMBIO 9: no mirar días previos a sept-2026
          .filter(fecha => {
              const reporte = accountingReports.find(r => r.fecha === fecha);
              return !reporte || reporte.estado !== 'CERRADO';
          })
          .sort((a, b) => new Date(a) - new Date(b)); // más antigua primero
  }, [dailyClosings, accountingReports, hoyStr]);

  const reporteDelDiaActual = accountingReports.find(r => r.fecha === fechaMaestra);
  // "ARCHIVADA" = jornada archivada desde aquí con TODOS los checks. "CERRADO" =
  // estado viejo que ponía el panel de Contabilidad (ya en retiro).
  // 🔧 AJUSTE: el Admin SIEMPRE puede editar los checks y (re)archivar, aunque el
  // día figure como cerrado/archivado — es Admin. Antes había un `diaEstaCerrado`
  // que bloqueaba todos los botones; se eliminó. Solo queda `diaEstaArchivado`
  // para saber si mostrar "Archivar" o "Reabrir".
  const diaEstaArchivado = reporteDelDiaActual?.estado === 'ARCHIVADA';

  // 🔧 CAMBIO 9: al cambiar de día, sincroniza el check de depósito con lo guardado.
  useEffect(() => {
      setDepositoVerificado(reporteDelDiaActual?.deposito_verificado === true);
  }, [fechaMaestra, reporteDelDiaActual?.deposito_verificado]);

  // Sube el comprobante general (igual que en AccountingPanel.jsx)
  const handleUploadComprobante = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onloadend = () => setComprobanteGeneral(reader.result);
      reader.readAsDataURL(file);
  };

  // 🔧 CAMBIO 9: marca/desmarca "Depósito Bancario Verificado" del día y lo
  // guarda de inmediato en cierres_contables (upsert por fecha). No espera al
  // botón de archivar. El Admin puede hacerlo aunque el día ya esté
  // cerrado/archivado (es Admin).
  const toggleDepositoVerificado = async () => {
      if (!isAdmin || guardandoDeposito) return;
      const nuevoValor = !depositoVerificado;
      setDepositoVerificado(nuevoValor); // feedback inmediato
      setGuardandoDeposito(true);
      try {
          const { error } = await supabase.from('cierres_contables').upsert(
              { fecha: fechaMaestra, deposito_verificado: nuevoValor, updated_at: new Date().toISOString() },
              { onConflict: 'fecha' }
          );
          if (error) throw error;
          const { data: accData } = await supabase.from('cierres_contables').select('*').order('fecha', { ascending: false }).limit(60);
          setAccountingReports(accData || []);
      } catch (error) {
          setDepositoVerificado(!nuevoValor); // revertir si falló
          alert('No se pudo guardar la verificación del depósito: ' + error.message);
      } finally {
          setGuardandoDeposito(false);
      }
  };

  // 🔧 CAMBIO 9: marca un vale del día como auditado (revisado por Admin). Se
  // guarda en la columna nueva vales_caja.auditado (ver agregar_auditado_vales.sql).
  const toggleValeAuditado = async (vale) => {
      if (!isAdmin || auditandoVale) return;
      const nuevoValor = !vale.auditado;
      setAuditandoVale(vale.id);
      try {
          const { error } = await supabase.from('vales_caja').update({ auditado: nuevoValor }).eq('id', vale.id);
          if (error) throw error;
          setTodosLosVales(prev => prev.map(v => v.id === vale.id ? { ...v, auditado: nuevoValor } : v));
      } catch (error) {
          alert('No se pudo marcar el vale: ' + error.message);
      } finally {
          setAuditandoVale(null);
      }
  };

  // 🔧 NUEVO: "Finalizar y Archivar Jornada de Hoy" — misma validación y misma
  // tabla que el botón "Cerrar Día" de AccountingPanel.jsx, para no tener dos
  // lugares con lógicas distintas de cuándo se puede cerrar un día.
  const handleFinalizarJornada = async () => {
      const resumen = getResumenContableDelDia(fechaMaestra);
      // 🔧 CAMBIO 10 (traído adelante): ya NO se exige "cajas de vendedores
      // verificadas una por una" — eso lo hacía Contabilidad (rol eliminado).
      // Queda: comprobante/papeleta (si hubo efectivo) + check de depósito + vales.
      const comprobanteYaGuardado = comprobanteGeneral || reporteDelDiaActual?.comprobante_general;
      if (!comprobanteYaGuardado && resumen.totals.cash > 0) {
          return alert('Debes subir el comprobante de depósito general de efectivo antes de finalizar.');
      }
      // 🔧 CAMBIO 9: además de las cajas y el comprobante, exige el check manual
      // de depósito bancario y que TODOS los vales del día estén auditados.
      if (!depositoVerificado) {
          return alert('Debes marcar el check "Depósito Bancario Verificado" antes de archivar la jornada.');
      }
      const valesDelDiaAux = valesPorDia[fechaMaestra] || [];
      const valesSinAuditarAux = valesDelDiaAux.filter(v => !v.auditado).length;
      if (valesSinAuditarAux > 0) {
          return alert(`No se puede archivar: faltan ${valesSinAuditarAux} vale(s) del día por auditar.`);
      }
      setCerrandoDia(true);
      try {
          const payload = {
              fecha: fechaMaestra,
              responsable: user.name,
              responsable_id: user.id,
              total_efectivo_esperado: resumen.totals.cash,
              total_transferencias_esperado: resumen.totals.transfers,
              detalles_vendedores: reporteDelDiaActual?.detalles_vendedores || [],
              comprobante_general: comprobanteGeneral || reporteDelDiaActual?.comprobante_general || null,
              deposito_verificado: true,
              estado: 'ARCHIVADA',
              updated_at: new Date().toISOString()
          };
          const { error } = await supabase.from('cierres_contables').upsert(payload, { onConflict: 'fecha' });
          if (error) throw error;
          const { data: accData } = await supabase.from('cierres_contables').select('*').order('fecha', { ascending: false }).limit(60);
          setAccountingReports(accData || []);
      } catch (error) {
          alert('Error al finalizar la jornada: ' + error.message);
      } finally {
          setCerrandoDia(false);
      }
  };

  // 🔧 AJUSTE: reabrir una jornada ya archivada / cerrada. Solo Admin. Deja el
  // día editable de nuevo (los checks se conservan) para corregir algo y volver
  // a archivarlo.
  const handleReabrirJornada = async () => {
      if (!isAdmin) return;
      if (!window.confirm('¿Reabrir esta jornada? Podrás corregir los checks y volver a archivarla.')) return;
      setCerrandoDia(true);
      try {
          const { error } = await supabase.from('cierres_contables').upsert(
              { fecha: fechaMaestra, estado: null, updated_at: new Date().toISOString() },
              { onConflict: 'fecha' }
          );
          if (error) throw error;
          const { data: accData } = await supabase.from('cierres_contables').select('*').order('fecha', { ascending: false }).limit(60);
          setAccountingReports(accData || []);
      } catch (error) {
          alert('No se pudo reabrir la jornada: ' + error.message);
      } finally {
          setCerrandoDia(false);
      }
  };

  const toLocalDateStr = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const offsetMs = date.getTimezoneOffset() * 60 * 1000;
        return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
    } catch(e) {
        return String(isoString).split('T')[0];
    }
  };

  // Trae los cierres de caja, cierres contables, y TODOS los vales (no solo
  // pendientes) de los últimos ~60 días, para armar el resumen por día.
  useEffect(() => {
    if (!isAdmin) { setLoadingResumen(false); return; }
    const fetchResumenData = async () => {
      setLoadingResumen(true);
      try {
        const { data: closingsData } = await supabase.from('daily_closings').select('*').order('date', { ascending: false }).limit(300);
        setDailyClosings(closingsData || []);

        const { data: accData } = await supabase.from('cierres_contables').select('*').order('fecha', { ascending: false }).limit(60);
        setAccountingReports(accData || []);

        const { data: valesData } = await supabase.from('vales_caja').select('*').order('fecha', { ascending: false }).limit(300);
        setTodosLosVales(valesData || []);

        const { data: comprasData } = await supabase.from('historial_inventario').select('*').eq('tipo', 'INGRESO').order('created_at', { ascending: false }).limit(50);
        setComprasRecientes(comprasData || []);

        const { data: cuadresData } = await supabase.from('historial_inventario').select('*').like('motivo', 'Cuadre de Inventario:%').order('created_at', { ascending: false }).limit(50);
        setCuadresRecientes(cuadresData || []);

        const { data: inventarioData } = await supabase.from('inventario').select('id, valor_perdida, valor_compra');
        const mapaPrecios = {};
        (inventarioData || []).forEach(m => { mapaPrecios[m.id] = Number(m.valor_perdida || m.valor_compra) || 0; });
        setPreciosInventario(mapaPrecios);
      } catch (error) {
        console.error("Error cargando resumen diario:", error);
      } finally {
        setLoadingResumen(false);
      }
    };
    fetchResumenData();
  }, [isAdmin]);

  // Buscar Vales Pendientes (Solo Admin)
  useEffect(() => {
    const fetchPendingVales = async () => {
      if (!isAdmin) {
          setLoading(false);
          return;
      }
      try {
        const { data, error } = await supabase
          .from('vales_caja')
          .select('*')
          .eq('status', 'PENDIENTE')
          .order('fecha', { ascending: false });
        
        if (!error && data) {
            setPendingVales(data);
        }
      } catch (error) {
        console.error("Error cargando vales", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingVales();
  }, [isAdmin]);

  // Filtrar Órdenes Pendientes según Rol (Igual que la campanita)
  const getWorkItems = () => {
    if (!user || !orders) return [];

    return orders.filter(order => {
      if (order.status === 'ANULADA' || order.status === 'ARCHIVADA') return false;

      if (user.role === 'Administrador') return order.status === 'FINALIZADA';
      
      if (user.role === 'Vendedor') {
        const isMyOrder = isUserInList(order.vendedor_ids, order.vendedor, user);
        const isRelevantStatus = order.status === 'VENTAS' || order.status === 'VENTAS POR RETIRAR';
        return isMyOrder && isRelevantStatus;
      }

      if (user.role === 'Contabilidad') return order.status === 'CONTABILIDAD';
      if (user.role === 'Producción') return order.status === 'PRODUCCION';

      return false;
    });
  };

  const workItems = getWorkItems();
  const totalCount = realtimeEvents.length + workItems.length + pendingVales.length;

  // Vales agrupados por fecha (para buscar rápido los del día elegido)
  const valesPorDia = useMemo(() => {
      const grupos = {};
      todosLosVales.forEach(v => {
          if (!v.fecha) return;
          if (!grupos[v.fecha]) grupos[v.fecha] = [];
          grupos[v.fecha].push(v);
      });
      return grupos;
  }, [todosLosVales]);

  // 🔧 NUEVO: para pintar los puntos en el calendario — un día "tiene datos
  // contables" si hay un cierre de caja guardado ese día; "tiene vales" si
  // hay al menos un vale registrado ese día.
  const diasConDatosContables = useMemo(() => new Set(dailyClosings.map(c => c.date ? String(c.date).split('T')[0].trim() : null).filter(Boolean)), [dailyClosings]);
  const diasConVales = useMemo(() => new Set(Object.keys(valesPorDia)), [valesPorDia]);
  const diasConAlgunDato = useMemo(() => new Set([...diasConDatosContables, ...diasConVales]), [diasConDatosContables, diasConVales]);

  // 🔧 NUEVO: agrupa filas de historial_inventario en "sesiones" (mismo
  // usuario + mismo minuto), para mostrar un cuadre o una compra con varios
  // materiales como UNA sola tarea, tal como se ve en el diseño del cliente.
  const agruparPorSesion = (filas) => {
      const grupos = {};
      filas.forEach(f => {
          const minuto = (f.created_at || '').slice(0, 16); // "2026-09-02T14:30"
          const clave = `${f.usuario || 'Sistema'}|${minuto}`;
          if (!grupos[clave]) grupos[clave] = { id: clave, usuario: f.usuario, fecha: f.created_at, filas: [] };
          grupos[clave].filas.push(f);
      });
      return Object.values(grupos).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  };

  // Tareas de AUDITORÍA: sesiones de cuadre con al menos una pérdida, sin revisar
  const tareasAuditoria = useMemo(() => {
      const pendientes = cuadresRecientes.filter(c => !c.revisado);
      return agruparPorSesion(pendientes).filter(g => g.filas.some(f => f.cantidad_cambio < 0));
  }, [cuadresRecientes]);

  // Tareas de RECEPCIÓN: sesiones de compra hechas por alguien que NO es
  // Admin (porque a ellos les escondimos el campo de Factura/Proveedor),
  // todavía sin costear.
  const tareasRecepcion = useMemo(() => {
      const pendientes = comprasRecientes.filter(c => !c.revisado && !(c.motivo || '').includes('Fac/Ref:'));
      return agruparPorSesion(pendientes);
  }, [comprasRecientes]);

  // Marca todas las filas de una sesión (cuadre o compra) como revisadas
  const marcarSesionRevisada = async (grupo, tipo) => {
      setMarcandoRevisado(grupo.id);
      try {
          const ids = grupo.filas.map(f => f.id);
          await supabase.from('historial_inventario').update({ revisado: true }).in('id', ids);
          if (tipo === 'auditoria') setCuadresRecientes(prev => prev.map(c => ids.includes(c.id) ? { ...c, revisado: true } : c));
          else setComprasRecientes(prev => prev.map(c => ids.includes(c.id) ? { ...c, revisado: true } : c));
      } catch (error) {
          console.error('Error al marcar como revisado:', error);
      } finally {
          setMarcandoRevisado(null);
      }
  };

  // Calcula el resumen de Control Contable para UN día específico — misma
  // lógica (ya corregida) de AccountingPanel.jsx, agrupando por id de
  // vendedor en vez de por texto de nombre para no duplicar filas.
  const getResumenContableDelDia = (fecha) => {
      const closingsDelDia = dailyClosings.filter(c => (c.date ? String(c.date).split('T')[0].trim() : '') === fecha);
      const reporteDelDia = accountingReports.find(r => r.fecha === fecha) || { estado: 'PENDIENTE', detalles_vendedores: [] };

      const activeSellers = new Map();
      const addSeller = (nombreCrudo) => {
          if (!nombreCrudo) return;
          const match = staffUsers.find(su => su.name?.toLowerCase().trim() === nombreCrudo?.toLowerCase().trim());
          const key = match ? match.id : `sin-id:${nombreCrudo.toLowerCase().trim()}`;
          if (!activeSellers.has(key)) activeSellers.set(key, match ? match.name : nombreCrudo);
      };
      closingsDelDia.forEach(c => {
          const usr = staffUsers.find(su => String(su.id) === String(c.user_id));
          if (usr) activeSellers.set(usr.id, usr.name);
      });
      orders.forEach(o => {
          const createdDateStr = toLocalDateStr(o.created_at || o.createdAt);
          const balanceDateStr = toLocalDateStr(o.fecha_pago_saldo || o.updated_at || o.updatedAt);
          if (createdDateStr === fecha) addSeller(o.recibido_por_anticipo || o.vendedor);
          if (balanceDateStr === fecha && (o.status === 'FINALIZADA' || o.status === 'ENTREGADO')) addSeller(o.recibido_por_saldo || o.vendedor);
      });

      const sellersData = Array.from(activeSellers.values()).map(sellerName => {
          const sellerUser = staffUsers.find(su => su.name?.toLowerCase().trim() === sellerName?.toLowerCase().trim());
          const closing = sellerUser ? closingsDelDia.find(c => String(c.user_id) === String(sellerUser.id)) : null;
          const amountToAccounting = closing ? Number(closing.amount_to_accounting || 0) : 0;

          let totalTransfers = 0;
          orders.forEach(o => {
              const createdDateStr = toLocalDateStr(o.created_at || o.createdAt);
              const balanceDateStr = toLocalDateStr(o.fecha_pago_saldo || o.updated_at || o.updatedAt);
              const isClosed = o.status === 'FINALIZADA' || o.status === 'ENTREGADO';

              if (createdDateStr === fecha) {
                  const cobradorAnt = o.recibido_por_anticipo || o.vendedor;
                  const matchesAnt = o.recibido_por_anticipo_id ? (sellerUser && o.recibido_por_anticipo_id === sellerUser.id) : (cobradorAnt?.toLowerCase().trim() === sellerName?.toLowerCase().trim());
                  if (matchesAnt) {
                      const val = Number(o.anticipo) || 0;
                      if (val > 0 && (o.forma_pago_anticipo?.includes('Transferencia') || o.forma_pago_anticipo?.includes('Depósito'))) totalTransfers += val;
                  }
              }
              if (balanceDateStr === fecha && isClosed) {
                  const cobradorSal = o.recibido_por_saldo || o.vendedor;
                  const matchesSal = o.recibido_por_saldo_id ? (sellerUser && o.recibido_por_saldo_id === sellerUser.id) : (cobradorSal?.toLowerCase().trim() === sellerName?.toLowerCase().trim());
                  if (matchesSal) {
                      const saldoCobrado = (Number(o.financials?.total) || 0) - (Number(o.anticipo) || 0) - (Number(o.retencion) || 0);
                      if (saldoCobrado > 0 && (o.forma_pago_saldo?.includes('Transferencia') || o.forma_pago_saldo?.includes('Depósito'))) totalTransfers += saldoCobrado;
                  }
              }
          });

          const savedDetails = reporteDelDia?.detalles_vendedores || [];
          const verification = savedDetails.find(d => sellerUser && d.vendedor_id ? d.vendedor_id === sellerUser.id : d.vendedor?.toLowerCase().trim() === sellerName?.toLowerCase().trim()) || { status: 'PENDIENTE' };

          return { name: sellerName, expectedCash: amountToAccounting, expectedTransfers: totalTransfers, hasData: amountToAccounting > 0 || totalTransfers > 0 || closing !== null, verification };
      }).filter(s => s.hasData);

      const totals = sellersData.reduce((acc, curr) => {
          acc.cash += curr.expectedCash;
          acc.transfers += curr.expectedTransfers;
          if (curr.verification.status === 'VERIFICADO') acc.verifiedCount += 1;
          return acc;
      }, { cash: 0, transfers: 0, verifiedCount: 0, totalSellers: sellersData.length });

      return { sellersData, totals, estado: reporteDelDia.estado };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
    } catch (e) { return '-'; }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  // 🔧 CAMBIO 9: ¿están TODOS los checks del día? Recién ahí se habilita el botón
  // "Archivar Jornada" de arriba. Mientras falte algo, la jornada sale como
  // PENDIENTE y el botón queda gris con un tooltip de qué falta.
  const construirEstadoArchivo = () => {
      if (!isAdmin) return { listo: false, faltantes: [] };
      if (diaEstaArchivado) return { listo: false, faltantes: [] }; // ya archivada (se muestra botón "Reabrir")
      if (fechaMaestra < FECHA_INICIO_AUDITORIA) return { listo: false, faltantes: ['Esta fecha es anterior a septiembre 2026 (no se audita).'] };
      const resumen = getResumenContableDelDia(fechaMaestra);
      const faltantes = [];
      // 🔧 CAMBIO 10 (traído adelante): sin requisito de "cajas por vendedor".
      const comprobanteOk = comprobanteGeneral || reporteDelDiaActual?.comprobante_general;
      if (resumen.totals.cash > 0 && !comprobanteOk) faltantes.push('Falta subir el comprobante de depósito del efectivo.');
      if (!depositoVerificado) faltantes.push('Falta marcar el check "Depósito Bancario Verificado".');
      const valesDelDia = valesPorDia[fechaMaestra] || [];
      const valesSinAuditar = valesDelDia.filter(v => !v.auditado).length;
      if (valesSinAuditar > 0) faltantes.push(`${valesSinAuditar} vale(s) del día sin auditar.`);
      return { listo: faltantes.length === 0, faltantes };
  };
  const estadoArchivo = construirEstadoArchivo();

  return (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Bell className="h-6 w-6 text-blue-600" /> Centro de Notificaciones y Tareas
                </h2>
                <p className="text-slate-500">
                    Tienes <strong className="text-blue-600">{totalCount}</strong> asuntos pendientes que requieren tu atención.
                </p>
            </div>
            {/* 🔧 NUEVO: navegación de la jornada (flechas + calendario), estado del
                día, y el botón de finalizar/archivar — todo sobre UNA sola fecha. */}
            {isAdmin && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1 py-1">
                        <button onClick={() => cambiarDia(-1)} className="p-1.5 hover:bg-slate-200 rounded"><ChevronLeft className="h-4 w-4 text-slate-500"/></button>
                        <MiniCalendario fecha={fechaMaestra} onChange={setFechaMaestra} tieneDatos={(d) => diasConAlgunDato.has(d)} colorPunto="bg-purple-500" colorBoton="indigo" />
                        <button onClick={() => cambiarDia(1)} disabled={fechaMaestra >= hoyStr} className="p-1.5 hover:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight className="h-4 w-4 text-slate-500"/></button>
                    </div>
                    <span className={cn("text-xs font-bold px-3 py-2 rounded-lg uppercase", diaEstaArchivado ? "bg-green-100 text-green-700" : fechaMaestra === hoyStr ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700")}>
                        {diaEstaArchivado ? 'Jornada Archivada' : fechaMaestra === hoyStr ? 'Hoy - En Curso' : 'Pendiente'}
                    </span>
                    {diaEstaArchivado ? (
                        <Button
                            onClick={handleReabrirJornada}
                            disabled={cerrandoDia}
                            variant="outline"
                            className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                            {cerrandoDia ? <Loader2 className="h-4 w-4 animate-spin"/> : <ChevronLeft className="h-4 w-4"/>}
                            Reabrir Jornada
                        </Button>
                    ) : (
                        <div className="flex flex-col items-end gap-1">
                            <Button
                                onClick={handleFinalizarJornada}
                                disabled={cerrandoDia || !estadoArchivo.listo}
                                title={estadoArchivo.listo ? 'Archivar esta jornada' : 'Faltan pasos para archivar:\n• ' + estadoArchivo.faltantes.join('\n• ')}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {cerrandoDia ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}
                                Archivar Jornada
                            </Button>
                            {!estadoArchivo.listo && estadoArchivo.faltantes.length > 0 && (
                                <span className="text-[10px] text-slate-400 max-w-[260px] text-right leading-tight">
                                    Faltan {estadoArchivo.faltantes.length} paso(s): {estadoArchivo.faltantes[0]}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* 🔧 NUEVO: aviso si hay jornadas anteriores sin auditar — hay que revisar
            y cerrar los días en orden, para no perder el hilo del control de caja. */}
        {isAdmin && jornadasSinAuditar.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                    <Info className="h-5 w-5 shrink-0"/>
                    <span>
                        <strong>Atención:</strong> Tienes {jornadasSinAuditar.length} jornada{jornadasSinAuditar.length > 1 ? 's' : ''} anterior{jornadasSinAuditar.length > 1 ? 'es' : ''} sin auditar ({jornadasSinAuditar[0]}). Debes revisar y cerrar los días en orden cronológico.
                    </span>
                </div>
                <Button size="sm" onClick={() => setFechaMaestra(jornadasSinAuditar[0])} className="bg-amber-500 hover:bg-amber-600 text-white shrink-0">
                    Ir a Auditar {jornadasSinAuditar[0]}
                </Button>
            </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* COLUMNA IZQUIERDA: ALERTAS Y VALES */}
            <div className="xl:col-span-1 space-y-6">
                
                {/* CONTROL Y CIERRE CONTABLE (solo Admin) — antes era "Alertas Recientes" */}
                {isAdmin ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center gap-2">
                            <div>
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-indigo-500"/> Resumen de Cierre Diario
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Fecha: {new Date(fechaMaestra + 'T12:00:00').toLocaleDateString('es-ES')}</p>
                            </div>
                            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full uppercase", diaEstaArchivado ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                                {diaEstaArchivado ? 'Archivada' : 'Pendiente'}
                            </span>
                        </div>
                        <div className="p-4">
                            {loadingResumen ? (
                                <div className="p-8 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div>
                            ) : (() => {
                                const resumen = getResumenContableDelDia(fechaMaestra);
                                const comprobanteActual = comprobanteGeneral || reporteDelDiaActual?.comprobante_general;
                                return (
                                    <div className="text-xs space-y-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-green-50 border border-green-200 rounded p-2">
                                                <div className="flex items-center gap-1 text-green-700 text-[9px] font-bold uppercase"><DollarSign className="h-3 w-3"/> Efectivo</div>
                                                <p className="text-sm font-black text-green-700">${resumen.totals.cash.toFixed(2)}</p>
                                            </div>
                                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                                <div className="flex items-center gap-1 text-blue-700 text-[9px] font-bold uppercase"><Landmark className="h-3 w-3"/> Transf.</div>
                                                <p className="text-sm font-black text-blue-700">${resumen.totals.transfers.toFixed(2)}</p>
                                            </div>
                                            <div className={cn("border rounded p-2", resumen.totals.verifiedCount === resumen.totals.totalSellers && resumen.totals.totalSellers > 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-100 border-slate-200")}>
                                                <div className="flex items-center gap-1 text-slate-700 text-[9px] font-bold uppercase"><CheckCircle2 className="h-3 w-3"/> Cajas</div>
                                                <p className="text-sm font-black text-slate-700">{resumen.totals.verifiedCount}/{resumen.totals.totalSellers}</p>
                                            </div>
                                        </div>

                                        {/* Comprobante general de depósito */}
                                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded p-2">
                                            <span className={cn("flex items-center gap-1.5 font-medium", comprobanteActual ? "text-green-700" : "text-slate-400")}>
                                                {comprobanteActual ? <CheckCircle2 className="h-3.5 w-3.5"/> : <Info className="h-3.5 w-3.5"/>}
                                                {comprobanteActual ? 'Comprobante Adjunto' : 'Sin comprobante'}
                                            </span>
                                            {comprobanteActual ? (
                                                <img src={comprobanteActual} className="h-8 w-8 object-cover rounded border border-slate-300" alt="comprobante"/>
                                            ) : (
                                                <label className="text-[10px] text-indigo-600 font-bold cursor-pointer hover:underline">
                                                    Subir <input type="file" accept="image/*" className="hidden" onChange={handleUploadComprobante}/>
                                                </label>
                                            )}
                                        </div>

                                        {/* 🔧 CAMBIO 9: check manual de depósito bancario — lo marca Admin
                                            tras verificar el ingreso en la cuenta. Se guarda al instante. */}
                                        <button
                                            type="button"
                                            onClick={toggleDepositoVerificado}
                                            disabled={guardandoDeposito}
                                            className={cn(
                                                "w-full flex items-center justify-between rounded p-2 border transition-colors text-left",
                                                depositoVerificado ? "bg-green-50 border-green-300" : "bg-white border-slate-200 hover:bg-slate-50",
                                                guardandoDeposito && "opacity-60 cursor-not-allowed"
                                            )}
                                        >
                                            <span className={cn("flex items-center gap-1.5 font-medium", depositoVerificado ? "text-green-700" : "text-slate-500")}>
                                                {guardandoDeposito ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Landmark className="h-3.5 w-3.5"/>}
                                                Depósito Bancario Verificado
                                            </span>
                                            <span className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", depositoVerificado ? "bg-green-600 border-green-600" : "border-slate-300")}>
                                                {depositoVerificado && <CheckCircle2 className="h-3 w-3 text-white"/>}
                                            </span>
                                        </button>

                                        {resumen.sellersData.length > 0 ? (
                                            <div className="bg-white border border-slate-200 rounded overflow-hidden">
                                                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 py-1 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase">
                                                    <span>Usuario</span><span>Efectivo</span><span>Transf.</span><span>Estado</span>
                                                </div>
                                                {resumen.sellersData.map((s, i) => (
                                                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-2 py-1.5 border-t border-slate-100">
                                                        <span className="font-medium text-slate-700 truncate">{s.name}</span>
                                                        <span className="text-slate-500 text-right">${s.expectedCash.toFixed(2)}</span>
                                                        <span className="text-slate-500 text-right">${s.expectedTransfers.toFixed(2)}</span>
                                                        <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold text-center", s.verification.status === 'VERIFICADO' ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{s.verification.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-slate-400 italic text-center py-2">Sin datos para esta fecha.</p>
                                        )}
                                        {/* 🔧 CAMBIO 10: se quitó el botón "Ir a Control Contable"
                                            (pantalla eliminada junto con el rol Contabilidad). */}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Info className="h-4 w-4 text-blue-500"/> Alertas Recientes
                        </h3>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">{realtimeEvents.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                        {realtimeEvents.length > 0 ? realtimeEvents.map(event => (
                            <div key={event.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3 relative group">
                                <div className="mt-0.5">
                                    {event.type === 'assignment' ? <UserPlus className="h-5 w-5 text-blue-600"/> : <Info className="h-5 w-5 text-purple-600"/>}
                                </div>
                                <div className="flex-1 min-w-0 pr-6">
                                    <p className="text-sm font-bold text-slate-800">{event.title}</p>
                                    <p className="text-xs text-slate-600 mt-1">{event.message}</p>
                                </div>
                                <button onClick={() => onClearEvent(event.id)} className="absolute top-4 right-4 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-slate-400 text-sm italic">No hay alertas nuevas.</div>
                        )}
                    </div>
                </div>
                )}

                {/* VALES DE CAJA (Admin: todos los del día elegido — antes solo mostraba los pendientes) */}
                {isAdmin ? (() => {
                    const valesDelDia = valesPorDia[fechaMaestra] || [];
                    const totalEgresos = valesDelDia.reduce((acc, v) => acc + Number(v.monto || 0), 0);
                    return (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-red-50 p-4 border-b border-red-100">
                            <div className="flex justify-between items-center gap-2 mb-1">
                                <h3 className="font-bold text-red-800 flex items-center gap-2">
                                    <Receipt className="h-4 w-4"/> Vales Emitidos {fechaMaestra === hoyStr ? 'Hoy' : ''}
                                </h3>
                                <span className="text-sm font-black text-red-600">-${totalEgresos.toFixed(2)}</span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                                Fecha: {new Date(fechaMaestra + 'T12:00:00').toLocaleDateString('es-ES')} · Total Egresos
                                {valesDelDia.length > 0 && (
                                    <> · <span className={cn("font-bold", valesDelDia.every(v => v.auditado) ? "text-green-600" : "text-amber-600")}>
                                        {valesDelDia.filter(v => v.auditado).length}/{valesDelDia.length} auditados
                                    </span></>
                                )}
                            </p>
                        </div>
                        <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                            {loadingResumen ? (
                                <div className="p-8 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div>
                            ) : (
                                <>
                                    {valesDelDia.length > 0 ? (
                                        valesDelDia.map(vale => (
                                            <div key={vale.id} className="flex justify-between items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800">VC-{String(vale.id).padStart(5, '0')} · {vale.vendedor}</p>
                                                    <p className="text-[10px] text-slate-500 truncate">{vale.concepto}</p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs font-black text-red-600">-{formatCurrency(vale.monto)}</span>
                                                    {/* 🔧 CAMBIO 9: check de auditoría por vale */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleValeAuditado(vale)}
                                                        disabled={auditandoVale === vale.id}
                                                        className={cn(
                                                            "text-[10px] font-bold px-2 py-1 rounded border flex items-center gap-1 transition-colors",
                                                            vale.auditado ? "bg-green-100 border-green-300 text-green-700" : "bg-white border-slate-300 text-slate-500 hover:bg-slate-50",
                                                            auditandoVale === vale.id && "opacity-60 cursor-not-allowed"
                                                        )}
                                                    >
                                                        {auditandoVale === vale.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <CheckCircle2 className="h-3 w-3"/>}
                                                        {vale.auditado ? 'Auditado' : 'Auditar'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-6 text-center text-slate-400 text-sm italic">Sin vales registrados esta fecha.</div>
                                    )}
                                    <Button size="sm" variant="outline" className="w-full text-xs h-7 border-red-200 text-red-700 hover:bg-red-50" onClick={() => onViewChange('vales')}>
                                        Ver todos los vales <ArrowRight className="h-3 w-3 ml-1" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                    );
                })() : null}

            </div>

            {/* COLUMNA DERECHA: TAREAS DE INVENTARIO + ÓRDENES DE TRABAJO */}
            <div className="xl:col-span-2 space-y-6">
                {/* 🔧 NUEVO: Bandeja de Tareas de Inventario (solo Admin) — auditorías
                    con descuadre y recepciones de material pendientes de costear,
                    como tareas accionables (no una lista pasiva). */}
                {isAdmin && (tareasAuditoria.length > 0 || tareasRecepcion.length > 0) && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-indigo-500"/> Bandeja de Tareas de Inventario
                            </h3>
                            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">{tareasAuditoria.length + tareasRecepcion.length} Tareas</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {tareasAuditoria.map(grupo => {
                                const perdidaTotal = grupo.filas.reduce((acc, f) => {
                                    if (f.cantidad_cambio >= 0) return acc;
                                    return acc + (Math.abs(f.cantidad_cambio) * (preciosInventario[f.material_id] || 0));
                                }, 0);
                                const detalles = grupo.filas.map(f => `${f.material_nombre} (${f.cantidad_cambio > 0 ? '+' : ''}${f.cantidad_cambio})`).join(', ');
                                const estaExpandida = auditoriaExpandida === grupo.id;
                                // 🔧 CAMBIO 9: al pulsar "Revisar Descuadre" se guarda el detalle
                                // de esta sesión de cuadre para que la pantalla de Inventario lo
                                // muestre en un recuadro rojo al llegar (no solo "te lleva").
                                const irARevisarDescuadre = () => {
                                    try {
                                        sessionStorage.setItem('descuadreARevisar', JSON.stringify({
                                            usuario: grupo.usuario || 'Sistema',
                                            fecha: grupo.fecha,
                                            perdidaTotal,
                                            filas: grupo.filas.map(f => ({
                                                material_nombre: f.material_nombre,
                                                cantidad_cambio: f.cantidad_cambio,
                                                cantidad_resultante: f.cantidad_resultante,
                                                motivo: f.motivo,
                                                perdida: f.cantidad_cambio < 0 ? Math.abs(f.cantidad_cambio) * (preciosInventario[f.material_id] || 0) : 0,
                                            })),
                                        }));
                                    } catch (e) { /* sessionStorage no disponible: seguimos igual */ }
                                    onViewChange('inventario-gestionar');
                                };
                                return (
                                    <div key={grupo.id} className="p-4 bg-red-50/50">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                            <div className="flex items-start gap-3">
                                                <Info className="h-5 w-5 text-red-500 shrink-0 mt-0.5"/>
                                                <div>
                                                    <p className="text-sm font-bold text-red-800">AUDITORÍA: DESCUADRE CON PÉRDIDA REGISTRADO POR {(grupo.usuario || '').toUpperCase()}</p>
                                                    <p className="text-xs text-slate-600 mt-0.5">
                                                        {perdidaTotal > 0 && <>Pérdida monetaria: <span className="font-bold">{formatCurrency(perdidaTotal)}</span>. </>}
                                                        Detalles: {detalles}.
                                                    </p>
                                                    <button onClick={() => setAuditoriaExpandida(estaExpandida ? null : grupo.id)} className="text-[11px] font-bold text-red-600 hover:underline mt-1">
                                                        {estaExpandida ? 'Ocultar detalle ▲' : 'Ver detalle del descuadre ▼'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0 self-end md:self-center">
                                                <Button size="sm" variant="outline" className="text-xs h-8 border-red-300 text-red-700 hover:bg-red-100" onClick={irARevisarDescuadre}>
                                                    Revisar Descuadre
                                                </Button>
                                                <Button size="sm" className="text-xs h-8 bg-red-600 hover:bg-red-700 text-white" disabled={marcandoRevisado === grupo.id} onClick={() => marcarSesionRevisada(grupo, 'auditoria')}>
                                                    {marcandoRevisado === grupo.id ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <CheckCircle2 className="h-3 w-3 mr-1"/>} Marcar como revisado
                                                </Button>
                                            </div>
                                        </div>
                                        {estaExpandida && (
                                            <div className="mt-3 bg-white border border-red-200 rounded-lg overflow-hidden">
                                                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-1.5 bg-red-50 text-[9px] font-bold text-red-400 uppercase">
                                                    <span>Material</span><span className="text-right">Diferencia</span><span className="text-right">Quedó en</span><span className="text-right">Pérdida</span>
                                                </div>
                                                {grupo.filas.map((f, fi) => (
                                                    <div key={fi} className="px-3 py-2 border-t border-red-100">
                                                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-[11px]">
                                                            <span className="font-medium text-slate-700">{f.material_nombre}</span>
                                                            <span className={cn("text-right font-bold", f.cantidad_cambio < 0 ? "text-red-600" : "text-green-600")}>{f.cantidad_cambio > 0 ? '+' : ''}{f.cantidad_cambio}</span>
                                                            <span className="text-right text-slate-500">{f.cantidad_resultante}</span>
                                                            <span className="text-right text-red-600 font-medium">{f.cantidad_cambio < 0 ? formatCurrency(Math.abs(f.cantidad_cambio) * (preciosInventario[f.material_id] || 0)) : '—'}</span>
                                                        </div>
                                                        {f.motivo && <p className="text-[10px] text-slate-400 mt-1">Motivo: {String(f.motivo).replace('Cuadre de Inventario: ', '')}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {tareasRecepcion.map(grupo => {
                                const materiales = grupo.filas.map(f => f.material_nombre).join(', ');
                                return (
                                    <div key={grupo.id} className="p-4 bg-emerald-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                        <div className="flex items-start gap-3">
                                            <Info className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5"/>
                                            <div>
                                                <p className="text-sm font-bold text-emerald-800">RECEPCIÓN: MATERIALES PENDIENTES DE COSTEO</p>
                                                <p className="text-xs text-slate-600 mt-0.5">Nuevos materiales ingresados por {grupo.usuario || 'Producción'} ({materiales})</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0 self-end md:self-center">
                                            <Button size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={marcandoRevisado === grupo.id} onClick={() => { onViewChange('inventario-gestionar'); marcarSesionRevisada(grupo, 'recepcion'); }}>
                                                {marcandoRevisado === grupo.id ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : null} Costear y Asignar Proveedor
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-indigo-500"/> Bandeja de Trabajo ({user?.role})
                        </h3>
                        <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">{workItems.length} Tareas</span>
                    </div>
                    
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3">Orden</th>
                                    <th className="px-4 py-3">Cliente</th>
                                    <th className="px-4 py-3">Detalle / Proyecto</th>
                                    <th className="px-4 py-3 text-center">Estado</th>
                                    <th className="px-4 py-3 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {workItems.length > 0 ? workItems.map(order => (
                                    <tr key={order.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-4 py-3 font-mono font-bold text-slate-500 whitespace-nowrap">
                                            #{String(order.orderNumber || order.order_number || order.id).padStart(7, '0')}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-slate-800 max-w-[200px] truncate" title={order.cliente || order.cliente_nombre}>
                                            {order.cliente || order.cliente_nombre}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 max-w-[250px] truncate" title={order.tipoLetrero || order.tipo_trabajo}>
                                            {order.tipoLetrero || order.tipo_trabajo}
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className="text-[10px] font-bold px-2 py-1 rounded border bg-slate-100 text-slate-700 border-slate-300">
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Button size="sm" onClick={() => onViewOrder(order)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8">
                                                <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                                            </Button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-16 text-center text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle2 className="h-10 w-10 text-green-400" />
                                                <span className="text-lg font-medium text-slate-600">¡Bandeja Limpia!</span>
                                                <span className="text-sm">No tienes órdenes pendientes en tu departamento.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default NotificationsPanel;