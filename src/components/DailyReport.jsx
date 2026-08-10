import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Printer, Loader2, Save, FileSpreadsheet, ChevronLeft, ChevronRight, History, AlertCircle, CheckCircle2, Undo2, Edit2, Bug, Trash2, ExternalLink, Receipt, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { isUserInList } from '@/utils/userMatch';

// 🔥 BÚSQUEDA INTELIGENTE DE NOMBRES 🔥
const normalizeName = (name) => {
    if (!name) return "";
    return String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

// 🔧 REFACTOR: ahora acepta los ids opcionales (idA, idB). Si AMBOS existen, compara por
// id (inmune a que alguien cambie su nombre completo). Si falta alguno, cae al matching
// difuso de nombres de siempre (para filas viejas creadas antes de la migración).
const isUserMatch = (name1, name2, idA, idB) => {
    if (idA && idB) return idA === idB;
    const n1 = normalizeName(name1);
    const n2 = normalizeName(name2);
    if (!n1 || !n2) return false;
    return n1 === n2 || n1.includes(n2) || n2.includes(n1) || n1.substring(0, 4) === n2.substring(0, 4);
};

const DailyReport = ({ orders = [], user, onViewOrder, onDataChanged }) => {
  if (!user) return <div className="p-10 text-center text-slate-500">Cargando perfil...</div>;

  const { toast } = useToast();
  const isAdmin = user.role === 'Administrador';

  const toLocalDateStr = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(date.getTime() - offsetMs);
    return localDate.toISOString().split('T')[0];
  };

  const todayStr = toLocalDateStr(new Date().toISOString());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState(isAdmin ? 'calendar' : 'report'); 
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  
  // 🔧 FIX: antes, targetUserId/targetUserName arrancaban con los datos del
  // propio Admin, así que al abrir la pantalla se disparaba una consulta
  // (costosa) buscando "Administrador" antes de que el Admin eligiera a
  // alguien. Ahora, si es Admin, arranca vacío hasta que elija un vendedor.
  const [targetUserId, setTargetUserId] = useState(isAdmin ? null : user.id);
  const [staffList, setStaffList] = useState([]);
  const [targetUserName, setTargetUserName] = useState(isAdmin ? '' : user.name);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithReport, setDaysWithReport] = useState(new Set()); 
  const [valesDelDia, setValesDelDia] = useState([]);

  const [ledgerData, setLedgerData] = useState({ openingCash: 0, amountToAccounting: 0, manualTransactions: [] });
  
  const [debugInfo, setDebugInfo] = useState(null);
  const [editingOpening, setEditingOpening] = useState(false);
  const isEditable = selectedDate === todayStr || isAdmin;

  // 🔥 DETECCIÓN DE MÉTODO DE PAGO 🔥
  const formatPaymentMethod = (method) => {
      if (!method) return 'EFECTIVO';
      const upper = String(method).toUpperCase();
      if (upper.includes('TRANS')) return 'TRANSFERENCIA';
      if (upper.includes('TARJETA') || upper.includes('TC') || upper.includes('TD')) return 'TARJETA';
      if (upper.includes('CHEQUE') || upper.includes('CHQ')) return 'CHEQUE';
      if (upper.includes('EFECTIVO')) return 'EFECTIVO';
      return upper; 
  };

  useEffect(() => {
    if (isAdmin) {
        const fetchStaff = async () => {
            // 🔧 Solo Vendedores: así el reporte diario y el botón de "Reasignar"
            // nunca permiten dejar un cobro a nombre de Admin/Contabilidad/Producción.
            const { data } = await supabase.from('profiles').select('id, full_name, role').eq('role', 'Vendedor').order('full_name');
            if (data) setStaffList(data);
        };
        fetchStaff();
    }
  }, [isAdmin]);

  useEffect(() => {
      if (isAdmin) {
          // Mientras el Admin no elija a nadie, targetUserId es null y no
          // hacemos nada — así evitamos disparar consultas de "Administrador".
          if (staffList.length > 0 && targetUserId) {
              const selectedUser = staffList.find(u => u.id === targetUserId);
              if (selectedUser) setTargetUserName(selectedUser.full_name);
          }
      } else {
          setTargetUserName(user.name);
      }
  }, [targetUserId, staffList, isAdmin, user.name]);

  useEffect(() => {
    if (targetUserId && targetUserName) {
        loadDailyData(selectedDate, targetUserId, targetUserName);
    }
  }, [selectedDate, targetUserId, targetUserName]);

  const loadDailyData = async (date, userId, userName) => {
    setLoading(true);
    setEditingOpening(false);
    setDebugInfo(null);

    const isToday = date === todayStr;

    try {
      const { data: todosLosValesDB } = await supabase.from('vales_caja').select('*');
          
      const valesFiltrados = (todosLosValesDB || []).filter(v => {
          const fechaValeLimpia = v.fecha ? v.fecha.split('T')[0] : "";
          const coincideFecha = fechaValeLimpia === date;
          const estaAprobado = v.status === 'APROBADO'; 
          return coincideFecha && isUserMatch(v.vendedor, userName, v.vendedor_id, userId) && estaAprobado;
      });
      setValesDelDia(valesFiltrados);

      const { data: currentReport, error } = await supabase.from('daily_closings').select('*').eq('date', date).eq('user_id', userId).maybeSingle();
      if (error) throw error;

      if (currentReport && !isToday) {
        const opening = Number(currentReport.opening_cash) || 0;
        setLedgerData({ openingCash: opening, amountToAccounting: Number(currentReport.amount_to_accounting) || 0, manualTransactions: currentReport.manual_transactions || [] });
        setDebugInfo({ status: "Reporte Histórico Cerrado", source: "DB (Estático)", baseCash: opening, floatingOrders: 0, floatingSum: 0, floatingVales: 0, totalCalculated: opening, searchWindow: "N/A", isSaved: true });
        return; 
      }

      const { data: lastReport } = await supabase.from('daily_closings').select('date, final_balance').eq('user_id', userId).lt('date', date).order('date', { ascending: false }).limit(1).maybeSingle();

      let baseCash = 0; let lastReportDateStr = '2000-01-01'; let foundPrevious = false;
      if (lastReport) { baseCash = Number(lastReport.final_balance); lastReportDateStr = lastReport.date; foundPrevious = true; }

      // 🔧 FIX TIMEOUT DE RAÍZ: en vez de volver a pedirle esto a la base de datos
      // (que seguía dando timeout incluso ya optimizado), filtramos directamente
      // sobre las órdenes que YA tenemos en memoria (el prop 'orders' que App.jsx
      // ya trae completo, sin límite). Cero consultas nuevas = cero riesgo de timeout.
      const userOrders = orders.filter(o =>
          o.recibido_por_anticipo_id === userId ||
          o.recibido_por_saldo_id === userId ||
          (Array.isArray(o.vendedor_ids) && o.vendedor_ids.includes(userId))
      ).sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)).slice(0, 1000);

      let floatingSum = 0; let floatingCount = 0;

      if (userOrders) {
          userOrders.forEach(o => {
              const createdDateStr = toLocalDateStr(o.created_at || o.createdAt);
              const updatedDateStr = toLocalDateStr(o.updated_at || o.updatedAt);
              const balanceDateStr = o.fecha_pago_saldo ? toLocalDateStr(o.fecha_pago_saldo) : updatedDateStr;

              const isAfterLastReport = createdDateStr > lastReportDateStr;
              const isBeforeToday = createdDateStr < date;
              const recibioAnticipo = isUserMatch(o.recibido_por_anticipo, userName, o.recibido_por_anticipo_id, userId)
                  || (!o.recibido_por_anticipo && !o.recibido_por_anticipo_id && isUserInList(o.vendedor_ids, o.vendedor, { id: userId, name: userName }));
              
              const formaAnticipo = formatPaymentMethod(o.formaPagoAnticipo || o.forma_pago_anticipo);
              if (isAfterLastReport && isBeforeToday && recibioAnticipo && formaAnticipo === 'EFECTIVO') {
                  if (Number(o.anticipo) > 0 && o.status !== 'ANULADA') { floatingSum += Number(o.anticipo); floatingCount++; }
              }

              const isUpdatedAfterLastReport = balanceDateStr > lastReportDateStr;
              const isUpdatedBeforeToday = balanceDateStr < date;
              
              // 🔥 SOLUCIÓN AL DINERO FANTASMA: Quitamos 'VENTAS POR RETIRAR' 🔥
              const isClosed = o.status === 'FINALIZADA' || o.status === 'ENTREGADO';
              
              const recibioSaldo = isUserMatch(o.recibido_por_saldo, userName, o.recibido_por_saldo_id, userId)
                  || (!o.recibido_por_saldo && !o.recibido_por_saldo_id && isUserInList(o.vendedor_ids, o.vendedor, { id: userId, name: userName }));
              const saldoCobrado = (Number(o.financials?.total) || 0) - (Number(o.anticipo) || 0) - (Number(o.retencion) || 0);
              
              const formaSaldo = formatPaymentMethod(o.formaPagoSaldo || o.forma_pago_saldo);
              if (isUpdatedAfterLastReport && isUpdatedBeforeToday && isClosed && saldoCobrado > 0 && recibioSaldo && formaSaldo === 'EFECTIVO') {
                  floatingSum += saldoCobrado; floatingCount++;
              }
          });
      }

      let floatingValesSum = 0;
      const valesFlotantes = (todosLosValesDB || []).filter(v => {
          const fechaVale = v.fecha ? v.fecha.split('T')[0] : "";
          return isUserMatch(v.vendedor, userName, v.vendedor_id, userId) && v.status === 'APROBADO' && fechaVale > lastReportDateStr && fechaVale < date;
      });
      floatingValesSum = valesFlotantes.reduce((sum, v) => sum + Number(v.monto), 0);

      const totalCalculatedOpening = baseCash + floatingSum - floatingValesSum;
      setLedgerData({ openingCash: totalCalculatedOpening, amountToAccounting: currentReport ? Number(currentReport.amount_to_accounting) : 0, manualTransactions: currentReport ? (currentReport.manual_transactions || []) : [] });

      setDebugInfo({ status: isToday ? "Modo VIVO (Hoy)" : "Calculado por falta de reporte", source: foundPrevious ? `Cierre del ${lastReportDateStr}` : "Inicio de los tiempos", baseCash: baseCash, floatingOrders: floatingCount, floatingSum: floatingSum, floatingVales: floatingValesSum, totalCalculated: totalCalculatedOpening, searchWindow: `> ${lastReportDateStr} y < ${date}`, isSaved: !!currentReport });

    } catch (error) { toast({ title: "Error", description: "Fallo cálculo.", variant: "destructive" }); } finally { setLoading(false); }
  };

  const handleForceRecalculate = async () => {
      if (!confirm("¿Estás seguro? Esto borrará el cierre guardado de este día y forzará al sistema a recalcular el saldo acumulado histórico.")) return;
      setRecalculating(true);
      try {
          const { error } = await supabase.from('daily_closings').delete().match({ date: selectedDate, user_id: targetUserId });
          if (error) throw error;
          toast({ title: "Reporte Reiniciado", description: "Recalculando saldos..." });
          await loadDailyData(selectedDate, targetUserId, targetUserName);
      } catch (error) { toast({ title: "Error", description: "No se pudo reiniciar el reporte.", variant: "destructive" }); } finally { setRecalculating(false); }
  };

  useEffect(() => { if (targetUserId && targetUserName) fetchCalendarDots(); }, [viewMode, currentMonth, targetUserId, targetUserName, orders]);

  const fetchCalendarDots = async () => {
    const year = currentMonth.getFullYear(); const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0]; const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const activityDates = new Set();

    try {
        const { data } = await supabase.from('daily_closings').select('date').eq('user_id', targetUserId).gte('date', firstDay).lte('date', lastDay);
        if (data) data.forEach(item => activityDates.add(item.date));
        
        const { data: vales } = await supabase.from('vales_caja').select('fecha, vendedor, vendedor_id, status').gte('fecha', firstDay).lte('fecha', lastDay);
        if (vales) {
            vales.forEach(v => { if (isUserMatch(v.vendedor, targetUserName, v.vendedor_id, targetUserId) && v.status === 'APROBADO') { activityDates.add(v.fecha); } });
        }
    } catch (e) {}

    orders.forEach(o => {
        const tocoDinero = isUserInList(o.vendedor_ids, o.vendedor, { id: targetUserId, name: targetUserName })
            || isUserMatch(o.recibido_por_anticipo, targetUserName, o.recibido_por_anticipo_id, targetUserId)
            || isUserMatch(o.recibido_por_saldo, targetUserName, o.recibido_por_saldo_id, targetUserId);
        if (tocoDinero) { const dateStr = toLocalDateStr(o.created_at || o.createdAt); if (dateStr >= firstDay && dateStr <= lastDay) activityDates.add(dateStr); }
    });
    setDaysWithReport(activityDates);
  };

  const handleMonthChange = (inc) => { const d = new Date(currentMonth); d.setMonth(d.getMonth() + inc); setCurrentMonth(d); };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear(); const month = currentMonth.getMonth(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const startDayOfWeek = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(<div key={`e-${i}`} className="h-24 bg-slate-50/50 border border-slate-100"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hasReport = daysWithReport.has(dateStr); const isSelected = selectedDate === dateStr; const isToday = dateStr === todayStr;
        const dayClass = cn("h-24 border border-slate-200 p-2 cursor-pointer transition-all hover:bg-blue-50 relative flex flex-col justify-between group", isSelected ? "bg-blue-100 border-blue-300 shadow-inner" : "bg-white");
        days.push(
            <div key={dateStr} onClick={() => { setSelectedDate(dateStr); setViewMode('report'); }} className={dayClass}>
                <div className="flex justify-between items-start"><span className={cn("text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full", isToday ? "bg-blue-600 text-white" : "text-slate-700")}>{d}</span>{hasReport && <div className="h-3 w-3 rounded-full bg-green-500 shadow-sm animate-pulse"></div>}</div>
                {hasReport && <span className="text-[10px] text-green-700 font-medium bg-green-100 px-1 rounded self-start mt-1">Ver Reporte</span>}
                {!hasReport && isSelected && !isAdmin && <span className="text-[10px] text-blue-600 font-medium self-end opacity-0 group-hover:opacity-100">Crear</span>}
            </div>
        );
    }
    return days;
  };

  const automaticTransactions = useMemo(() => {
    const txs = [];
    const relevantOrders = orders.filter(o =>
        isUserInList(o.vendedor_ids, o.vendedor, { id: targetUserId, name: targetUserName })
        || isUserMatch(o.recibido_por_anticipo, targetUserName, o.recibido_por_anticipo_id, targetUserId)
        || isUserMatch(o.recibido_por_saldo, targetUserName, o.recibido_por_saldo_id, targetUserId)
    );

    relevantOrders.forEach(o => {
      const creationDate = toLocalDateStr(o.createdAt || o.created_at);
      if (creationDate === selectedDate) {
          const cobroAnticipo = isUserMatch(o.recibido_por_anticipo, targetUserName, o.recibido_por_anticipo_id, targetUserId)
              || (!o.recibido_por_anticipo && !o.recibido_por_anticipo_id && isUserInList(o.vendedor_ids, o.vendedor, { id: targetUserId, name: targetUserName }));
          if (cobroAnticipo && Number(o.anticipo) > 0) {
              const numOrden = o.order_number || o.orderNumber || o.id;
              txs.push({
                id: `sale-${o.id}`, type: 'VENTA', description: o.cliente, details: `${o.tipoLetrero || o.tipo_trabajo || ''} — Anticipo #${numOrden}`, orderNumber: numOrden, income: Number(o.anticipo), expense: 0, balanceNote: o.financials?.saldo > 0 ? `Saldo pdte` : 'PAGADO', isManual: false, isAnulada: false, originalOrder: o, paymentMethod: o.formaPagoAnticipo || o.forma_pago_anticipo || 'EFECTIVO' 
              });
          }
      }
      
      (o.abonos || []).forEach(abono => {
          const abonoDateStr = toLocalDateStr(abono.fecha);
          if (abonoDateStr === selectedDate && isUserMatch(abono.cobrador, targetUserName, abono.cobrador_id, targetUserId)) {
               const numOrden = o.order_number || o.orderNumber || o.id;
               txs.push({
                  id: `abono-${abono.id}`, type: 'ABONO', description: o.cliente, details: `${o.tipoLetrero || o.tipo_trabajo || ''} — Abono #${numOrden} ${abono.nota ? `(${abono.nota})` : ''}`, orderNumber: numOrden, income: Number(abono.monto), expense: 0, balanceNote: 'ABONO REGISTRADO', isManual: false, isAnulada: false, originalOrder: o, abonoId: abono.id, paymentMethod: abono.metodoPago || abono.metodo_pago || abono.forma_pago || abono.formaPago || 'EFECTIVO' 
               });
          }
      });
    });

    relevantOrders.forEach(o => {
      const updatedDate = toLocalDateStr(o.updatedAt || o.updated_at);
      const paymentDate = o.fecha_pago_saldo ? toLocalDateStr(o.fecha_pago_saldo) : updatedDate;
      
      // 🔥 SOLUCIÓN AL DINERO FANTASMA: Quitamos 'VENTAS POR RETIRAR' 🔥
      const isRelevantStatus = o.status === 'FINALIZADA' || o.status === 'ENTREGADO';
      
      const saldoCobrado = (Number(o.financials?.total) || 0) - (Number(o.anticipo) || 0) - (Number(o.retencion) || 0);
      const totalAbonado = (o.abonos || []).reduce((acc, a) => acc + Number(a.monto), 0);
      const saldoFinalReal = saldoCobrado - totalAbonado;

      if (paymentDate === selectedDate && isRelevantStatus && saldoFinalReal > 0) {
          const cobroSaldo = isUserMatch(o.recibido_por_saldo, targetUserName, o.recibido_por_saldo_id, targetUserId)
              || (!o.recibido_por_saldo && !o.recibido_por_saldo_id && isUserInList(o.vendedor_ids, o.vendedor, { id: targetUserId, name: targetUserName }));
          if (cobroSaldo) {
              const numOrden = o.order_number || o.orderNumber || o.id;
              txs.push({ id: `pickup-${o.id}`, type: 'COBRO SALDO', description: o.cliente, details: `${o.tipoLetrero || o.tipo_trabajo || ''} — Saldo Final #${numOrden}`, orderNumber: numOrden, income: saldoFinalReal, expense: 0, balanceNote: 'COMPLETADO', isManual: false, isAnulada: false, originalOrder: o, paymentMethod: o.formaPagoSaldo || o.forma_pago_saldo || 'EFECTIVO' });
          }
      }
    });

    relevantOrders.forEach(o => {
        const updatedDate = toLocalDateStr(o.updatedAt || o.updated_at);
        if (o.status === 'ANULADA' && updatedDate === selectedDate) {
            const cobroOriginal = isUserMatch(o.recibido_por_anticipo, targetUserName, o.recibido_por_anticipo_id, targetUserId)
                || (!o.recibido_por_anticipo && !o.recibido_por_anticipo_id && isUserInList(o.vendedor_ids, o.vendedor, { id: targetUserId, name: targetUserName }));
            if (cobroOriginal && Number(o.anticipo) > 0) {
                const numOrden = o.order_number || o.orderNumber || o.id;
                txs.push({ id: `cancel-${o.id}`, type: 'ANULACIÓN', description: o.cliente, details: `${o.tipoLetrero || o.tipo_trabajo || ''} — Anulación #${numOrden}`, orderNumber: numOrden, income: 0, expense: Number(o.anticipo), balanceNote: 'ANULADO', isManual: false, isAnulada: true, originalOrder: o, paymentMethod: o.formaPagoAnticipo || o.forma_pago_anticipo || 'EFECTIVO' });
            }
        }
    });
    
    valesDelDia.forEach(vale => {
        txs.push({ id: `vale-${vale.id}`, type: 'VALE CAJA', description: vale.concepto, details: vale.recibido_por ? `A: ${vale.recibido_por} (Aprobado)` : '(Aprobado)', orderNumber: `VC-${String(vale.id).padStart(5, '0')}`, income: 0, expense: Number(vale.monto), balanceNote: 'EGRESO', isManual: false, isAnulada: false, isVale: true, paymentMethod: 'EFECTIVO' });
    });

    return txs;
  }, [orders, selectedDate, targetUserName, valesDelDia]);

  // 🔧 NUEVO: buscador dentro del reporte del día actual (declarado aquí, antes de
  // usarse en visibleTransactions más abajo)
  const [txSearchTerm, setTxSearchTerm] = useState('');

  const allTransactions = useMemo(() => [...automaticTransactions, ...ledgerData.manualTransactions], [automaticTransactions, ledgerData]);

  // 🔧 NUEVO: filtro de búsqueda (por descripción/cliente, detalle, o Nº de orden)
  const visibleTransactions = useMemo(() => {
      const term = txSearchTerm.trim().toLowerCase();
      if (!term) return allTransactions;
      return allTransactions.filter(tx =>
          String(tx.description || '').toLowerCase().includes(term) ||
          String(tx.details || '').toLowerCase().includes(term) ||
          String(tx.orderNumber || '').toLowerCase().includes(term)
      );
  }, [allTransactions, txSearchTerm]);

  const totals = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalOtrosMedios = 0;

    allTransactions.forEach(tx => {
        const isEfectivo = formatPaymentMethod(tx.paymentMethod) === 'EFECTIVO';
        if (isEfectivo) {
            totalIncome += Number(tx.income || 0);
            totalExpense += Number(tx.expense || 0);
        } else {
            totalOtrosMedios += Number(tx.income || 0) - Number(tx.expense || 0);
        }
    });

    const cashInHand = Number(ledgerData.openingCash) + totalIncome - totalExpense;
    const nextDayBalance = cashInHand - Number(ledgerData.amountToAccounting);
    return { totalIncome, totalExpense, cashInHand, nextDayBalance, totalOtrosMedios };
  }, [allTransactions, ledgerData]);

  const saveToCloud = async () => {
    setSaving(true);
    try {
      const payload = { date: selectedDate, user_id: targetUserId, opening_cash: Number(ledgerData.openingCash), amount_to_accounting: Number(ledgerData.amountToAccounting), final_balance: Number(totals.nextDayBalance), manual_transactions: ledgerData.manualTransactions, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('daily_closings').upsert(payload, { onConflict: 'date, user_id' });
      if (error) throw error;
      toast({ title: "Guardado Correctamente", description: "El saldo ha sido registrado para mañana." });
      fetchCalendarDots(); setDebugInfo(prev => ({ ...prev, status: "Guardado ahora mismo", isSaved: true }));
    } catch (error) { toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" }); } finally { setSaving(false); }
  };

  const updateLedger = (newData) => { setLedgerData(newData); };
  const updateField = (field, value) => updateLedger({ ...ledgerData, [field]: value });
  
  const addManualTransaction = (type) => {
    const newTx = { id: Date.now(), type, description: '', orderNumber: '', income: 0, expense: 0, balanceNote: '', paymentMethod: 'EFECTIVO', isManual: true };
    updateLedger({ ...ledgerData, manualTransactions: [...ledgerData.manualTransactions, newTx] });
  };
  const updateManualTransaction = (id, field, value) => {
    const updated = ledgerData.manualTransactions.map(tx => tx.id === id ? { ...tx, [field]: value } : tx);
    updateLedger({ ...ledgerData, manualTransactions: updated });
  };
  const removeManualTransaction = (id) => {
    const updated = ledgerData.manualTransactions.filter(tx => tx.id !== id);
    updateLedger({ ...ledgerData, manualTransactions: updated });
  };

  // 🔧 NUEVO: reasignar un cobro (venta, saldo, abono o anulación) a otro
  // usuario. Útil cuando una orden quedó registrada con la persona
  // equivocada y por eso no aparecía en el reporte del vendedor correcto.
  const [reassigningTxId, setReassigningTxId] = useState(null);
  const [reassigning, setReassigning] = useState(false);

  const handleReassignTx = async (tx, newUserId) => {
    const newUser = staffList.find(u => u.id === newUserId);
    if (!newUser) return;

    setReassigning(true);
    try {
      const orderId = tx.originalOrder.id;

      if (tx.type === 'VENTA' || tx.type === 'ANULACIÓN') {
          const { error } = await supabase.from('ordenes').update({
              recibido_por_anticipo: newUser.full_name,
              recibido_por_anticipo_id: newUser.id,
          }).eq('id', orderId);
          if (error) throw error;

      } else if (tx.type === 'COBRO SALDO') {
          const { error } = await supabase.from('ordenes').update({
              recibido_por_saldo: newUser.full_name,
              recibido_por_saldo_id: newUser.id,
          }).eq('id', orderId);
          if (error) throw error;

      } else if (tx.type === 'ABONO') {
          // Traemos los abonos frescos para no pisar cambios de otra persona
          const { data: dbOrder, error: fetchError } = await supabase.from('ordenes').select('abonos').eq('id', orderId).single();
          if (fetchError) throw fetchError;

          const abonosActualizados = (dbOrder.abonos || []).map(a =>
              a.id === tx.abonoId ? { ...a, cobrador: newUser.full_name, cobrador_id: newUser.id } : a
          );

          const { error } = await supabase.from('ordenes').update({ abonos: abonosActualizados }).eq('id', orderId);
          if (error) throw error;
      }

      toast({ title: "Reasignado", description: `Este cobro ahora aparece en el reporte de ${newUser.full_name}.` });
      setReassigningTxId(null);
      if (onDataChanged) await onDataChanged(); // 🔧 refresca 'orders' en App.jsx de inmediato, sin esperar a Realtime
      await loadDailyData(selectedDate, targetUserId, targetUserName);
    } catch (error) {
      toast({ title: "Error al reasignar", description: error.message, variant: "destructive" });
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-20 print:p-0 print:w-full">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">{isAdmin ? 'Auditoría de Cajas' : 'Reporte Diario de Caja'}</h2>
            <p className="text-slate-500 text-sm">{isAdmin ? 'Selecciona un vendedor:' : `Caja de: ${user.name}`}</p>
         </div>
         <div className="flex bg-slate-100 p-1 rounded-lg">
             <button onClick={() => setViewMode('report')} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", viewMode === 'report' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700")}>Reporte del Día</button>
             <button onClick={() => setViewMode('calendar')} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2", viewMode === 'calendar' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700")}><History className="h-4 w-4" /> Historial</button>
         </div>
      </div>

      {viewMode === 'calendar' && (
         <div className="space-y-6 animate-in fade-in duration-500">
            {isAdmin && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {staffList.map(emp => (
                        <div key={emp.id} onClick={() => setTargetUserId(emp.id)} className={cn("cursor-pointer rounded-xl p-4 border transition-all flex flex-col items-center gap-2 text-center", targetUserId === emp.id ? "bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-md transform scale-105" : "bg-white border-slate-200 hover:bg-slate-50")}>
                            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg", targetUserId === emp.id ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600")}>{emp.full_name?.charAt(0) || 'U'}</div>
                            <div><h4 className="font-bold text-sm text-slate-800 line-clamp-1">{emp.full_name}</h4></div>
                            {targetUserId === emp.id && <CheckCircle2 className="h-4 w-4 text-blue-600 mt-1" />}
                        </div>
                    ))}
                </div>
            )}
            <Card className="animate-in zoom-in-95 duration-300 border-t-4 border-t-blue-600">
                <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <Button variant="outline" onClick={() => handleMonthChange(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                        <div className="text-center"><h3 className="text-xl font-bold uppercase text-slate-800">{currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h3></div>
                        <Button variant="outline" onClick={() => handleMonthChange(1)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                        {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map(day => <div key={day} className="bg-slate-100 p-2 text-center text-xs font-bold text-slate-500">{day}</div>)}
                        {renderCalendar()}
                    </div>
                </CardContent>
            </Card>
         </div>
      )}

      {viewMode === 'report' && (
        <>
            <div className="flex justify-between items-center mb-2 print:hidden">
                 <Button variant="ghost" onClick={() => setViewMode('calendar')} className="text-slate-500 hover:text-slate-800"><ChevronLeft className="h-4 w-4 mr-1"/> Volver</Button>
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={() => toast({title:"Exportar", description: "Función de exportar lista."})} className="gap-2 border-green-200 hover:bg-green-50 text-green-700"><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
                    <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
                    {isEditable && (
                        <Button onClick={() => saveToCloud()} disabled={saving} className="gap-2 bg-blue-900 hover:bg-blue-800 text-white min-w-[140px]">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'Guardando...' : 'Guardar Cierre'}
                        </Button>
                    )}
                 </div>
            </div>

            {/* Buscador (única parte, junto con la tabla, que sí queríamos cambiar) */}
            <div className="print:hidden relative max-w-sm">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                    type="text"
                    placeholder="Buscar cliente, descripción o Nº orden en este día..."
                    className="pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
                    value={txSearchTerm}
                    onChange={(e) => setTxSearchTerm(e.target.value)}
                />
                {txSearchTerm && (
                    <button onClick={() => setTxSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-dashed"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />Calculando saldos...</div>
            ) : (
                <div className="bg-white shadow-xl print:shadow-none min-h-[800px] flex flex-col font-sans text-xs md:text-sm border-2 border-slate-900">
                    <div className="bg-blue-300 border-b-2 border-slate-900 p-3 flex justify-between items-center print:bg-blue-300 print:print-color-adjust-exact">
                        <div>
                            <div className="font-black text-lg uppercase tracking-wider">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                            <div className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">VENDEDOR: <span className="bg-white px-1 rounded">{targetUserName}</span></div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-700 uppercase">SALDO INICIAL (ACUMULADO)</span>
                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border-2 border-slate-900 shadow-sm relative group">
                                {isAdmin && isEditable ? (
                                    <><span className="text-slate-500 mr-1 cursor-pointer" onClick={() => setEditingOpening(!editingOpening)}><Edit2 className="h-3 w-3"/></span>
                                        {editingOpening ? <input type="number" className="w-24 font-bold text-lg text-slate-900 outline-none bg-transparent" autoFocus value={ledgerData.openingCash} onChange={(e) => updateField('openingCash', e.target.value)} /> : <span className="font-bold text-lg text-slate-900">${Number(ledgerData.openingCash).toFixed(2)}</span>}
                                    </>
                                ) : <span className="font-bold text-lg text-slate-900">${Number(ledgerData.openingCash).toFixed(2)}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 text-xs uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-3 text-center w-10">#</th>
                                <th className="px-3 py-3 text-left font-bold">Descripción del Movimiento</th>
                                <th className="px-3 py-3 text-center">Orden</th>
                                <th className="px-3 py-3 text-center">Método</th>
                                <th className="px-3 py-3 text-right font-bold text-green-700">Ingreso</th>
                                <th className="px-3 py-3 text-right font-bold text-red-700">Egreso</th>
                                <th className="px-3 py-3 text-center">Nota</th>
                                <th className="px-2 py-3 text-center print:hidden w-16">Acc.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {visibleTransactions.map((tx, idx) => {
                            const isEfectivo = formatPaymentMethod(tx.paymentMethod) === 'EFECTIVO';
                            const tipoColor = tx.isAnulada ? 'text-red-600' : tx.isVale ? 'text-red-700' : tx.type === 'VENTA' ? 'text-blue-700' : tx.type === 'ABONO' ? 'text-emerald-700' : tx.type === 'COBRO SALDO' ? 'text-orange-700' : 'text-purple-700';
                            
                            return (
                            <tr 
                                key={tx.id} 
                                onClick={() => { if (!tx.isManual && tx.originalOrder && onViewOrder) { onViewOrder(tx.originalOrder); } }} 
                                className={cn(
                                    "transition-colors group",
                                    !tx.isManual && !tx.isVale ? "cursor-pointer" : "",
                                    tx.isAnulada ? "bg-red-50/50" : tx.isVale ? "bg-red-50/30" : !isEfectivo ? "bg-indigo-50/30 hover:bg-indigo-50" : "hover:bg-blue-50"
                                )}
                            >
                                <td className="px-3 py-2.5 text-center text-slate-400 font-bold text-xs">{idx + 1}</td>
                                
                                <td className="px-3 py-2.5">
                                    <div className="flex flex-wrap items-center gap-1 text-xs">
                                        {tx.isAnulada && <Undo2 className="h-3 w-3 text-red-600 shrink-0" />}
                                        {tx.isVale && <Receipt className="h-3 w-3 text-red-600 shrink-0" />}
                                        {tx.isManual && isEditable ? (
                                            <input className="flex-1 bg-transparent border-b border-dotted outline-none font-semibold" value={tx.description} onChange={(e) => updateManualTransaction(tx.id, 'description', e.target.value)} />
                                        ) : (
                                            <span className="font-bold uppercase leading-tight">
                                                <span className={tipoColor}>{tx.type}</span>
                                                <span className="text-slate-400 mx-1">-</span>
                                                <span className="text-slate-800">{tx.description}</span>
                                                {tx.details && <><span className="text-slate-400 mx-1">-</span><span className="text-slate-500 font-medium normal-case">{tx.details}</span></>}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                
                                <td className="px-3 py-2.5 text-center font-mono font-medium text-slate-600 text-xs">
                                   {tx.isManual && isEditable ? <input className="w-full text-center bg-transparent outline-none" value={tx.orderNumber} onChange={(e) => updateManualTransaction(tx.id, 'orderNumber', e.target.value)} /> : tx.orderNumber}
                                </td>

                                <td className="px-3 py-2.5 text-center">
                                    {tx.isManual && isEditable ? (
                                        <select className="w-full bg-transparent outline-none uppercase text-center text-xs cursor-pointer" value={tx.paymentMethod || 'EFECTIVO'} onChange={(e) => updateManualTransaction(tx.id, 'paymentMethod', e.target.value)}>
                                            <option value="EFECTIVO">EFECTIVO</option><option value="TRANSFERENCIA">TRANSFERENCIA</option><option value="TARJETA">TARJETA</option><option value="CHEQUE">CHEQUE</option>
                                        </select>
                                    ) : (
                                        <span className={cn("text-xs px-2 py-1 rounded-md font-medium inline-block", isEfectivo ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700")}>
                                            {formatPaymentMethod(tx.paymentMethod).split('-')[0].trim()}
                                        </span>
                                    )}
                                </td>
                                
                                <td className="px-3 py-2.5 text-right font-bold">
                                   {tx.isManual && isEditable ? <input type="number" className="w-full text-right bg-transparent outline-none" value={tx.income} onChange={(e) => updateManualTransaction(tx.id, 'income', e.target.value)} /> : (Number(tx.income) > 0 ? (
                                       <div className="flex flex-col items-end">
                                           <span className={isEfectivo ? "text-green-600" : "text-indigo-600 opacity-80"}>${Number(tx.income).toFixed(2)}</span>
                                           {!isEfectivo && <span className="text-[9px] leading-none uppercase text-indigo-500 mt-0.5">No suma a caja</span>}
                                       </div>
                                   ) : <span className="text-slate-300">-</span>)}
                                </td>
                                
                                <td className="px-3 py-2.5 text-right font-bold">
                                   {tx.isManual && isEditable ? <input type="number" className="w-full text-right bg-transparent outline-none" value={tx.expense} onChange={(e) => updateManualTransaction(tx.id, 'expense', e.target.value)} /> : (Number(tx.expense) > 0 ? (
                                       <div className="flex flex-col items-end">
                                           <span className={isEfectivo ? "text-red-600" : "text-indigo-600 opacity-80"}>${Number(tx.expense).toFixed(2)}</span>
                                           {!isEfectivo && <span className="text-[9px] leading-none uppercase text-indigo-500 mt-0.5">No suma a caja</span>}
                                       </div>
                                   ) : <span className="text-slate-300">-</span>)}
                                </td>
                                
                                <td className="px-3 py-2.5 text-center text-xs text-slate-600">
                                   {tx.isManual && isEditable ? <input className="w-full bg-transparent outline-none text-center" value={tx.balanceNote} onChange={(e) => updateManualTransaction(tx.id, 'balanceNote', e.target.value)} /> : <span className={cn(tx.balanceNote?.includes('DEBE') ? "text-red-600 bg-red-50 px-1.5 py-0.5 rounded" : "text-green-700")}>{tx.balanceNote}</span>}
                                </td>
                                
                                <td className="px-2 py-2.5 print:hidden">
                                <div className="flex items-center justify-center gap-1">
                                    {tx.isManual && isEditable ? (
                                        <button onClick={(e) => { e.stopPropagation(); removeManualTransaction(tx.id); }} className="text-red-400 hover:text-red-600 font-bold">X</button>
                                    ) : (
                                        <>
                                            {!tx.isManual && !tx.isVale && <ExternalLink className="h-4 w-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            {/* 🔧 reasignar el cobro a otro usuario (solo Admin, solo si viene de una orden real) */}
                                            {isAdmin && !tx.isManual && !tx.isVale && tx.originalOrder && (
                                                reassigningTxId === tx.id ? (
                                                    <select
                                                        autoFocus
                                                        disabled={reassigning}
                                                        className="text-[9px] border border-blue-400 rounded bg-white outline-none"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => { e.stopPropagation(); if (e.target.value) handleReassignTx(tx, e.target.value); }}
                                                        onBlur={() => setReassigningTxId(null)}
                                                        defaultValue=""
                                                    >
                                                        <option value="" disabled>Mover a...</option>
                                                        {staffList.map(u => (
                                                            <option key={u.id} value={u.id}>{u.full_name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <button
                                                        title="Reasignar a otro usuario"
                                                        onClick={(e) => { e.stopPropagation(); setReassigningTxId(tx.id); }}
                                                        className="text-slate-400 hover:text-blue-600"
                                                    >
                                                        <Users className="h-3.5 w-3.5" />
                                                    </button>
                                                )
                                            )}
                                        </>
                                    )}
                                </div>
                                </td>
                            </tr>
                        )})}
                        </tbody>
                    </table>
                        {isEditable && isAdmin && (
                           <div className="p-4 flex gap-4 bg-slate-100 print:hidden border-t border-slate-300">
                               <Button variant="outline" onClick={() => addManualTransaction('GASTO')} className="border-red-300 text-red-700 hover:bg-red-50">+ Gasto Manual</Button>
                               <Button variant="outline" onClick={() => addManualTransaction('INGRESO')} className="border-green-300 text-green-700 hover:bg-green-50">+ Ingreso Extra</Button>
                           </div>
                        )}
                    </div>

                    <div className="border-t-2 border-slate-900">
                        {/* 🔥 3 COLUMNAS: INGRESOS CAJA | EGRESOS CAJA | OTROS MEDIOS 🔥 */}
                        <div className="bg-slate-800 text-white p-2 grid grid-cols-3 gap-4 text-center print:print-color-adjust-exact">
                            <div><div className="text-[10px] text-slate-400">INGRESOS FÍSICOS (CAJA)</div><div className="text-lg font-bold text-green-400">${totals.totalIncome.toFixed(2)}</div></div>
                            <div><div className="text-[10px] text-slate-400">EGRESOS FÍSICOS (CAJA)</div><div className="text-lg font-bold text-red-400">${totals.totalExpense.toFixed(2)}</div></div>
                            <div className="border-l border-slate-600"><div className="text-[10px] text-slate-400">OTROS MEDIOS (BANCOS)</div><div className="text-lg font-bold text-indigo-300">${totals.totalOtrosMedios.toFixed(2)}</div></div>
                        </div>
                        <div className="flex flex-col md:flex-row border-t-2 border-slate-900 h-auto md:h-24 text-sm">
                            <div className="flex-1 border-r-2 border-slate-900 bg-blue-50 p-4 flex flex-col justify-center items-center">
                                <span className="font-bold text-xs uppercase text-slate-500 mb-2">TOTAL EN CAJA</span>
                                <div className="text-3xl font-black text-slate-800">${totals.cashInHand.toFixed(2)}</div>
                            </div>
                            <div className="flex-1 border-r-2 border-slate-900 bg-yellow-50 p-4 flex flex-col justify-center items-center print:bg-yellow-50 print:print-color-adjust-exact">
                                <span className="font-bold text-xs uppercase text-slate-700 mb-2">ENTREGAR A CONTABILIDAD</span>
                                <div className="flex items-center justify-center gap-2 w-full max-w-[200px] border-b-2 border-slate-800 pb-1">
                                    <span className="font-bold text-2xl text-slate-700">$</span>
                                    <input type="number" step="0.01" className="w-full font-bold text-3xl text-center outline-none bg-transparent text-slate-900 placeholder:text-slate-300" placeholder="0" value={ledgerData.amountToAccounting} onChange={(e) => updateField('amountToAccounting', e.target.value)} disabled={!isEditable} />
                                </div>
                            </div>
                            <div className={cn("flex-1 p-4 font-black uppercase flex flex-col justify-center items-center text-white print:print-color-adjust-exact", totals.nextDayBalance >= 0 ? "bg-green-700" : "bg-red-700")}>
                                <span className="text-[10px] opacity-80 mb-2">SALDO PARA MAÑANA</span>
                                <span className="text-4xl">${totals.nextDayBalance.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {!isEditable && <div className="text-xs text-amber-600 mt-4 print:hidden flex items-center gap-2 justify-center bg-amber-50 p-2 rounded border border-amber-200"><AlertCircle className="h-4 w-4" /> Reporte histórico. No se pueden realizar cambios.</div>}
            
            {isAdmin && debugInfo && (
                <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-xs shadow-2xl animate-in slide-in-from-bottom-10 print:hidden relative">
                    <div className="flex items-center gap-2 mb-2 text-green-400 font-bold uppercase"><Bug className="h-4 w-4"/> Diagnóstico del Cálculo</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-1">
                            <div><span className="text-slate-500">Estado:</span> {debugInfo.status}</div>
                            <div><span className="text-slate-500">Origen Saldo Base:</span> <span className="text-white font-bold">{debugInfo.source}</span></div>
                            <div><span className="text-slate-500">Saldo Base ($):</span> <span className="text-green-400">${(debugInfo.baseCash || 0).toFixed(2)}</span></div>
                        </div>
                        <div className="space-y-1">
                            <div><span className="text-slate-500">Ventana de Búsqueda:</span> {debugInfo.searchWindow}</div>
                            <div><span className="text-slate-500">Órdenes Flotantes:</span> {debugInfo.floatingOrders}</div>
                            <div><span className="text-slate-500">Vales Flotantes ($):</span> <span className="text-red-400">-${(debugInfo.floatingVales || 0).toFixed(2)}</span></div>
                            <div><span className="text-slate-500">Suma Flotante Efectivo ($):</span> <span className="text-yellow-400">${(debugInfo.floatingSum || 0).toFixed(2)}</span></div>
                            <div className="pt-2 border-t border-slate-700 mt-1"><span className="text-slate-500">TOTAL CALCULADO:</span> <span className="text-white font-bold text-sm">${(debugInfo.totalCalculated || 0).toFixed(2)}</span></div>
                        </div>
                    </div>
                    {debugInfo.isSaved && (
                        <div className="border-t border-slate-700 pt-4 flex justify-end">
                            <Button variant="destructive" size="sm" onClick={handleForceRecalculate} disabled={recalculating} className="gap-2">
                                {recalculating ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>} BORRAR REPORTE Y RECALCULAR
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default DailyReport;