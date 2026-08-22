import React, { useState, useEffect, useMemo } from 'react';
import { Bell, UserPlus, Info, Receipt, FileText, ExternalLink, X, CheckCircle2, ArrowRight, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ShieldCheck, DollarSign, Landmark, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '../supabaseClient';
import { isUserInList } from '@/utils/userMatch';
import { cn } from '@/lib/utils';

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
  const [cerrandoDia, setCerrandoDia] = useState(false);
  const [comprobanteGeneral, setComprobanteGeneral] = useState(null);

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
          .filter(fecha => {
              const reporte = accountingReports.find(r => r.fecha === fecha);
              return !reporte || reporte.estado !== 'CERRADO';
          })
          .sort((a, b) => new Date(a) - new Date(b)); // más antigua primero
  }, [dailyClosings, accountingReports, hoyStr]);

  const reporteDelDiaActual = accountingReports.find(r => r.fecha === fechaMaestra);
  const diaEstaCerrado = reporteDelDiaActual?.estado === 'CERRADO';

  // Sube el comprobante general (igual que en AccountingPanel.jsx)
  const handleUploadComprobante = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onloadend = () => setComprobanteGeneral(reader.result);
      reader.readAsDataURL(file);
  };

  // 🔧 NUEVO: "Finalizar y Archivar Jornada de Hoy" — misma validación y misma
  // tabla que el botón "Cerrar Día" de AccountingPanel.jsx, para no tener dos
  // lugares con lógicas distintas de cuándo se puede cerrar un día.
  const handleFinalizarJornada = async () => {
      const resumen = getResumenContableDelDia(fechaMaestra);
      const faltantes = resumen.totals.totalSellers - resumen.totals.verifiedCount;
      if (faltantes > 0) {
          return alert(`No se puede finalizar: faltan ${faltantes} caja(s) de vendedores por verificar en Control Contable.`);
      }
      if (!comprobanteGeneral && resumen.totals.cash > 0) {
          return alert('Debes subir el comprobante de depósito general de efectivo antes de finalizar.');
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
              comprobante_general: comprobanteGeneral,
              estado: 'CERRADO',
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
                    <span className={cn("text-xs font-bold px-3 py-2 rounded-lg uppercase", diaEstaCerrado ? "bg-green-100 text-green-700" : fechaMaestra === hoyStr ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700")}>
                        {diaEstaCerrado ? 'Día Cerrado' : fechaMaestra === hoyStr ? 'Hoy - En Curso' : 'Pendiente'}
                    </span>
                    {!diaEstaCerrado && (
                        <Button onClick={handleFinalizarJornada} disabled={cerrandoDia} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                            {cerrandoDia ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}
                            Finalizar y Archivar Jornada
                        </Button>
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
                            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full uppercase", diaEstaCerrado ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                                {diaEstaCerrado ? 'Día Cerrado' : 'Abierto'}
                            </span>
                        </div>
                        <div className="p-4">
                            {loadingResumen ? (
                                <div className="p-8 text-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div>
                            ) : (() => {
                                const resumen = getResumenContableDelDia(fechaMaestra);
                                const comprobanteActual = diaEstaCerrado ? reporteDelDiaActual?.comprobante_general : comprobanteGeneral;
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
                                            ) : !diaEstaCerrado && (
                                                <label className="text-[10px] text-indigo-600 font-bold cursor-pointer hover:underline">
                                                    Subir <input type="file" accept="image/*" className="hidden" onChange={handleUploadComprobante}/>
                                                </label>
                                            )}
                                        </div>

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
                                        <Button size="sm" variant="outline" className="w-full text-xs h-7 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => onViewChange('contabilidad-cierre')}>
                                            Ir a Control Contable <ArrowRight className="h-3 w-3 ml-1"/>
                                        </Button>
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
                            <p className="text-[10px] text-slate-400">Fecha: {new Date(fechaMaestra + 'T12:00:00').toLocaleDateString('es-ES')} · Total Egresos</p>
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
                                                <span className="text-xs font-black text-red-600 shrink-0">-{formatCurrency(vale.monto)}</span>
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

            {/* COLUMNA DERECHA: ÓRDENES DE TRABAJO PENDIENTES */}
            <div className="xl:col-span-2">
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