import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Printer, Loader2, User, AlertCircle, Save, FileSpreadsheet, ChevronLeft, ChevronRight, History, Users, Search, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

const DailyReport = ({ orders = [], user }) => {
  if (!user) return <div className="p-10 text-center text-slate-500">Cargando perfil...</div>;

  const { toast } = useToast();
  const isAdmin = user.role === 'Administrador';

  // --- ESTADOS ---
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  
  // CAMBIO 1: Si es Admin, inicia en 'calendar'. Si es vendedor, en 'report'.
  const [viewMode, setViewMode] = useState(isAdmin ? 'calendar' : 'report'); 
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // ESTADOS ADMIN
  const [targetUserId, setTargetUserId] = useState(user.id);
  const [staffList, setStaffList] = useState([]);
  const [targetUserName, setTargetUserName] = useState(user.name);

  // Calendario
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithReport, setDaysWithReport] = useState(new Set()); 

  // Datos del Reporte
  const [ledgerData, setLedgerData] = useState({
    openingCash: 0, actualClosingCash: 0, dailyDeposit: 0, bankName: '', manualTransactions: [] 
  });

  // 1. CARGAR LISTA DE EMPLEADOS (SOLO ADMIN)
  useEffect(() => {
    if (isAdmin) {
        const fetchStaff = async () => {
            // Traemos todos los perfiles para hacer las tarjetas
            const { data } = await supabase.from('profiles').select('id, full_name, role').order('full_name');
            if (data) setStaffList(data);
        };
        fetchStaff();
    }
  }, [isAdmin]);

  // Actualizar nombre al cambiar objetivo
  useEffect(() => {
      if (isAdmin && staffList.length > 0) {
          const selectedUser = staffList.find(u => u.id === targetUserId);
          if (selectedUser) setTargetUserName(selectedUser.full_name);
      } else {
          setTargetUserName(user.name);
      }
  }, [targetUserId, staffList, isAdmin, user.name]);


  // 2. CARGA DE DATOS
  useEffect(() => {
    if (targetUserId) {
        loadDailyData(selectedDate, targetUserId);
    }
  }, [selectedDate, targetUserId]); 

  const loadDailyData = async (date, userId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_closings')
        .select('*')
        .eq('date', date)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLedgerData({
          openingCash: data.opening_cash || 0,
          actualClosingCash: data.actual_closing_cash || 0,
          dailyDeposit: data.deposit || 0,
          bankName: data.bank_name || '',
          manualTransactions: data.manual_transactions || []
        });
      } else {
        setLedgerData({
            openingCash: 0, actualClosingCash: 0, dailyDeposit: 0, bankName: '', manualTransactions: []
        });
      }
    } catch (error) {
      console.error("Error cargando caja:", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. LOGICA CALENDARIO
  useEffect(() => {
    // Cargar puntos verdes si estamos en modo calendario O si somos admin (para ver rápido)
    if (targetUserId) {
        fetchCalendarDots();
    }
  }, [viewMode, currentMonth, targetUserId]);

  const fetchCalendarDots = async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

    try {
        const { data } = await supabase
            .from('daily_closings')
            .select('date')
            .eq('user_id', targetUserId)
            .gte('date', firstDay)
            .lte('date', lastDay);
        
        const datesSet = new Set((data || []).map(item => item.date));
        setDaysWithReport(datesSet);
    } catch (error) { console.error(error); }
  };

  const handleMonthChange = (increment) => {
      const newDate = new Date(currentMonth);
      newDate.setMonth(newDate.getMonth() + increment);
      setCurrentMonth(newDate);
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = new Date(year, month, 1).getDay();
    const days = [];

    for (let i = 0; i < startDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/50 border border-slate-100"></div>);

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hasReport = daysWithReport.has(dateStr);
        const isSelected = selectedDate === dateStr;
        const isToday = dateStr === todayStr;

        days.push(
            <div key={dateStr} onClick={() => { setSelectedDate(dateStr); setViewMode('report'); }}
                className={cn("h-24 border border-slate-200 p-2 cursor-pointer transition-all hover:bg-blue-50 relative flex flex-col justify-between group", isSelected ? "bg-blue-100 border-blue-300 shadow-inner" : "bg-white")}
            >
                <div className="flex justify-between items-start">
                    <span className={cn("text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full", isToday ? "bg-blue-600 text-white" : "text-slate-700")}>{d}</span>
                    {hasReport && <div className="h-3 w-3 rounded-full bg-green-500 shadow-sm animate-pulse" title="Reporte guardado"></div>}
                </div>
                {hasReport && <span className="text-[10px] text-green-700 font-medium bg-green-100 px-1 rounded self-start mt-1">Ver Reporte</span>}
                {!hasReport && isSelected && !isAdmin && <span className="text-[10px] text-blue-600 font-medium self-end opacity-0 group-hover:opacity-100">Crear</span>}
            </div>
        );
    }
    return days;
  };

  // 4. GUARDAR
  const saveToCloud = async (newData = ledgerData) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('daily_closings')
        .upsert({
          date: selectedDate,
          user_id: targetUserId,
          opening_cash: newData.openingCash,
          actual_closing_cash: newData.actualClosingCash,
          deposit: newData.dailyDeposit,
          bank_name: newData.bankName,
          manual_transactions: newData.manualTransactions,
          updated_at: new Date()
        }, { onConflict: 'date, user_id' });

      if (error) throw error;
      toast({ title: "Guardado", description: "Reporte sincronizado con éxito." });
    } catch (error) {
      toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleExportExcel = () => {
     const headers = ['FECHA', 'RESPONSABLE', 'TIPO', 'DESCRIPCION', 'ORDEN', 'INGRESO', 'EGRESO', 'SALDO/NOTA'];
     const rows = allTransactions.map(tx => [
       selectedDate, targetUserName, tx.type, `"${tx.description} - ${tx.details || ''}"`, tx.orderNumber,
       (tx.income || 0).toFixed(2), (tx.expense || 0).toFixed(2), `"${tx.balanceNote}"`
     ]);
     rows.push([]);
     rows.push(['RESUMEN', '', '', '', '', '', '', '']);
     rows.push(['', '', 'TOTAL INGRESOS', '', '', totals.totalIncome.toFixed(2), '', '']);
     rows.push(['', '', 'TOTAL EGRESOS', '', '', '', totals.totalExpense.toFixed(2), '']);
     rows.push(['', '', 'EFECTIVO SISTEMA', '', '', totals.cashSystem.toFixed(2), '', '']);
     rows.push(['', '', 'CIERRE FISICO', '', '', ledgerData.actualClosingCash, '', '']);
     rows.push(['', '', 'DIFERENCIA', '', '', totals.difference.toFixed(2), '', '']);
     rows.push(['', '', 'BANCO', ledgerData.bankName, '', '', '', '']);

     const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `Caja_${targetUserName.replace(/\s+/g, '_')}_${selectedDate}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const updateLedger = (newData) => { setLedgerData(newData); };
  const updateField = (field, value) => updateLedger({ ...ledgerData, [field]: value });
  
  const addManualTransaction = (type) => {
    const newTx = { id: Date.now(), type, description: '', orderNumber: '', income: 0, expense: 0, balanceNote: '', isManual: true };
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

  const automaticTransactions = useMemo(() => {
    const txs = [];
    const newSales = orders.filter(o => o.createdAt && o.createdAt.startsWith(selectedDate));
    newSales.forEach(o => {
      if (Number(o.anticipo) > 0) txs.push({
          id: `auto-sale-${o.id}`, type: 'VENTA', description: o.cliente, details: `Anticipo #${o.orderNumber}`,
          orderNumber: o.orderNumber, income: Number(o.anticipo), expense: 0, 
          balanceNote: o.financials?.saldo > 0 ? `Saldo: $${Number(o.financials.saldo).toFixed(2)}` : 'CANCELADO', isManual: false
        });
    });
    const pickups = orders.filter(o => {
      const isUpdatedToday = o.updatedAt && o.updatedAt.startsWith(selectedDate);
      const isRelevantStatus = o.status === 'FINALIZADA' || o.status === 'VENTAS POR RETIRAR';
      return isUpdatedToday && isRelevantStatus && Number(o.financials?.saldo) > 0;
    });
    pickups.forEach(o => txs.push({
        id: `auto-pickup-${o.id}`, type: 'COBRO FINAL', description: o.cliente, details: `Saldo #${o.orderNumber}`,
        orderNumber: o.orderNumber, income: Number(o.financials.saldo), expense: 0, balanceNote: 'CANCELADO', isManual: false
      }));
    return txs;
  }, [orders, selectedDate, targetUserId]);

  const allTransactions = useMemo(() => [...automaticTransactions, ...ledgerData.manualTransactions], [automaticTransactions, ledgerData]);

  const totals = useMemo(() => {
    const totalIncome = allTransactions.reduce((sum, tx) => sum + Number(tx.income || 0), 0);
    const totalExpense = allTransactions.reduce((sum, tx) => sum + Number(tx.expense || 0), 0);
    const cashSystem = Number(ledgerData.openingCash) + totalIncome - totalExpense;
    const difference = Number(ledgerData.actualClosingCash) - (cashSystem - Number(ledgerData.dailyDeposit));
    return { totalIncome, totalExpense, cashSystem, difference };
  }, [allTransactions, ledgerData]);

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-20 print:p-0 print:w-full">
      
      {/* HEADER: TÍTULO Y BOTONES DE NAVEGACIÓN */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {isAdmin ? 'Auditoría y Cierre de Caja' : 'Reporte Diario de Caja'}
            </h2>
            <p className="text-slate-500 text-sm">
                {isAdmin 
                    ? 'Selecciona un empleado para revisar su historial.' 
                    : `Usuario: ${user.name}`}
            </p>
         </div>
         
         <div className="flex bg-slate-100 p-1 rounded-lg">
             {/* Si soy Admin, por defecto veo Historial. Si soy User, veo Reporte. */}
             <button onClick={() => setViewMode('report')} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", viewMode === 'report' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700")}>Reporte del Día</button>
             <button onClick={() => setViewMode('calendar')} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2", viewMode === 'calendar' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700")}><History className="h-4 w-4" /> Historial</button>
         </div>
      </div>

      {/* VISTA CALENDARIO (Con Selector Gigante para Admin) */}
      {viewMode === 'calendar' && (
         <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* CAMBIO: SELECTOR GIGANTE (Solo Admin) */}
            {isAdmin && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {staffList.map(emp => (
                        <div 
                            key={emp.id}
                            onClick={() => setTargetUserId(emp.id)}
                            className={cn(
                                "cursor-pointer rounded-xl p-4 border transition-all flex flex-col items-center gap-2 text-center",
                                targetUserId === emp.id 
                                    ? "bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-md transform scale-105" 
                                    : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                            )}
                        >
                            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg", targetUserId === emp.id ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600")}>
                                {emp.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{emp.full_name}</h4>
                                <p className="text-xs text-slate-500">{emp.role}</p>
                            </div>
                            {targetUserId === emp.id && <CheckCircle2 className="h-4 w-4 text-blue-600 mt-1" />}
                        </div>
                    ))}
                </div>
            )}

            <Card className="animate-in zoom-in-95 duration-300 border-t-4 border-t-blue-600">
                <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <Button variant="outline" onClick={() => handleMonthChange(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                        <div className="text-center">
                            <h3 className="text-xl font-bold uppercase text-slate-800">{currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h3>
                            <p className="text-xs text-slate-500">Viendo calendario de: <span className="font-bold text-blue-600">{targetUserName}</span></p>
                        </div>
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

      {/* VISTA REPORTE */}
      {viewMode === 'report' && (
        <>
            <div className="flex justify-between items-center mb-2 print:hidden">
                 <Button variant="ghost" onClick={() => setViewMode('calendar')} className="text-slate-500 hover:text-slate-800"><ChevronLeft className="h-4 w-4 mr-1"/> Volver al Calendario</Button>
                 
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportExcel} className="gap-2 border-green-200 hover:bg-green-50 text-green-700"><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
                    <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
                    <Button onClick={() => saveToCloud()} disabled={saving} className="gap-2 bg-blue-900 hover:bg-blue-800 text-white min-w-[140px]">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'Guardando...' : isAdmin ? 'Guardar Cambios' : 'Guardar Cierre'}
                    </Button>
                 </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-dashed"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />Cargando datos de {targetUserName}...</div>
            ) : (
                <div className="bg-white shadow-xl print:shadow-none min-h-[800px] flex flex-col font-sans text-xs md:text-sm border-2 border-slate-900">
                    <div className="bg-blue-300 border-b-2 border-slate-900 p-3 flex justify-between items-center print:bg-blue-300 print:print-color-adjust-exact">
                        <div>
                            <div className="font-black text-lg uppercase tracking-wider">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                            <div className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">RESPONSABLE: <span className="bg-white px-1 rounded">{targetUserName}</span></div>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border-2 border-slate-900 shadow-sm"><span className="font-bold uppercase text-slate-900">INICIO DE CAJA: $</span><input type="number" step="0.01" className="w-24 font-bold text-lg text-right outline-none bg-transparent" placeholder="0.00" value={ledgerData.openingCash} onChange={(e) => updateField('openingCash', e.target.value)} /></div>
                    </div>

                    <div className="grid grid-cols-[40px_1fr_100px_100px_100px_200px_40px] bg-orange-300 border-b-2 border-slate-900 font-bold text-center divide-x-2 divide-slate-900 print:bg-orange-300 print:print-color-adjust-exact">
                        <div className="py-2">#</div><div className="py-2">DESCRIPCION</div><div className="py-2 text-[10px] leading-tight flex items-center justify-center">ORDEN</div><div className="py-2">INGRESO</div><div className="py-2">EGRESO</div><div className="py-2">OBSERVACION</div><div className="py-2 bg-slate-200 print:hidden"></div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {allTransactions.map((tx, idx) => (
                            <div key={tx.id} className={cn("grid grid-cols-[40px_1fr_100px_100px_100px_200px_40px] border-b border-slate-300 divide-x divide-slate-300 hover:bg-yellow-50", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                <div className="py-2 font-bold text-center text-slate-500">{idx + 1}</div>
                                <div className="py-1 px-2 flex flex-col justify-center">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-[10px] font-bold px-1 rounded border border-black uppercase print:border-black", tx.type === 'VENTA' ? 'bg-green-200' : tx.type.includes('GASTO') ? 'bg-red-200' : 'bg-yellow-200')}>{tx.type}</span>
                                        {tx.isManual ? <input className="flex-1 bg-transparent border-b border-dotted outline-none font-semibold" value={tx.description} onChange={(e) => updateManualTransaction(tx.id, 'description', e.target.value)} /> : <span className="font-bold uppercase">{tx.description}</span>}
                                    </div>
                                    {!tx.isManual && <span className="text-[10px] text-slate-500 italic">{tx.details}</span>}
                                </div>
                                <div className="py-2 text-center font-mono font-bold text-slate-700">{tx.isManual ? <input className="w-full text-center bg-transparent outline-none" value={tx.orderNumber} onChange={(e) => updateManualTransaction(tx.id, 'orderNumber', e.target.value)} /> : tx.orderNumber}</div>
                                <div className="py-2 px-2 text-right font-bold text-green-700">{tx.isManual ? <input type="number" className="w-full text-right bg-transparent outline-none" value={tx.income} onChange={(e) => updateManualTransaction(tx.id, 'income', e.target.value)} /> : (tx.income > 0 ? `$${tx.income.toFixed(2)}` : '-')}</div>
                                <div className="py-2 px-2 text-right font-bold text-red-700">{tx.isManual ? <input type="number" className="w-full text-right bg-transparent outline-none" value={tx.expense} onChange={(e) => updateManualTransaction(tx.id, 'expense', e.target.value)} /> : (tx.expense > 0 ? `$${tx.expense.toFixed(2)}` : '-')}</div>
                                <div className="py-2 px-2 text-xs text-slate-600 truncate">{tx.isManual ? <input className="w-full bg-transparent outline-none" value={tx.balanceNote} onChange={(e) => updateManualTransaction(tx.id, 'balanceNote', e.target.value)} /> : tx.balanceNote}</div>
                                <div className="flex items-center justify-center bg-slate-50 print:hidden">{tx.isManual && <button onClick={() => removeManualTransaction(tx.id)} className="text-red-400 hover:text-red-600 font-bold">X</button>}</div>
                            </div>
                        ))}
                        <div className="p-4 flex gap-4 bg-slate-100 print:hidden border-t border-slate-300">
                            <Button variant="outline" onClick={() => addManualTransaction('GASTO')} className="border-red-300 text-red-700 hover:bg-red-50">+ Gasto</Button>
                            <Button variant="outline" onClick={() => addManualTransaction('INGRESO')} className="border-green-300 text-green-700 hover:bg-green-50">+ Ingreso</Button>
                            <Button variant="outline" onClick={() => addManualTransaction('VALE')} className="border-yellow-300 text-yellow-700 hover:bg-yellow-50">+ Vale</Button>
                        </div>
                    </div>

                    <div className="border-t-2 border-slate-900">
                        <div className="bg-slate-800 text-white p-2 grid grid-cols-4 gap-4 text-center print:print-color-adjust-exact">
                            <div><div className="text-[10px] text-slate-400">INGRESOS</div><div className="text-lg font-bold text-green-400">${totals.totalIncome.toFixed(2)}</div></div>
                            <div><div className="text-[10px] text-slate-400">EGRESOS</div><div className="text-lg font-bold text-red-400">${totals.totalExpense.toFixed(2)}</div></div>
                            <div className="col-span-2 bg-slate-700 rounded border border-slate-600 flex items-center justify-center gap-2"><div className="text-xs text-blue-300 font-bold">EFECTIVO SISTEMA:</div><div className="text-xl font-bold">${totals.cashSystem.toFixed(2)}</div></div>
                        </div>
                        <div className="flex flex-col md:flex-row border-t-2 border-slate-900 h-auto md:h-16 text-sm">
                            <div className="flex-1 border-r-2 border-slate-900 bg-white p-2 flex flex-col justify-center"><span className="font-bold text-xs uppercase text-slate-500">DEPOSITO BANCO:</span><div className="flex items-center gap-1"><span className="font-bold text-lg">$</span><input type="number" step="0.01" className="w-full font-bold text-lg outline-none" value={ledgerData.dailyDeposit} onChange={(e) => updateField('dailyDeposit', e.target.value)} /></div></div>
                            <div className="flex-1 border-r-2 border-slate-900 bg-white p-2 flex flex-col justify-center"><span className="font-bold text-xs uppercase text-slate-500">EFECTIVO REAL:</span><div className="flex items-center gap-1"><span className="font-bold text-lg">$</span><input type="number" step="0.01" className="w-full font-bold text-lg outline-none text-blue-700" value={ledgerData.actualClosingCash} onChange={(e) => updateField('actualClosingCash', e.target.value)} /></div></div>
                            <div className="flex-1 border-r-2 border-slate-900 bg-yellow-100 p-2 flex flex-col justify-center print:bg-yellow-100 print:print-color-adjust-exact"><span className="font-bold text-xs uppercase text-slate-700">BANCO:</span><input className="w-full bg-transparent border-b border-black outline-none font-bold uppercase" placeholder="EJ: PICHINCHA" value={ledgerData.bankName} onChange={(e) => updateField('bankName', e.target.value)} /></div>
                            <div className={cn("flex-1 p-2 font-black uppercase flex flex-col justify-center items-center text-white print:print-color-adjust-exact", totals.difference === 0 ? "bg-green-600" : totals.difference > 0 ? "bg-blue-600" : "bg-red-600")}><span className="text-[10px] opacity-80">DIFERENCIA</span><span className="text-xl">{totals.difference > 0 ? "+ " : ""}{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totals.difference)}</span></div>
                        </div>
                    </div>
                </div>
            )}
            <div className="text-xs text-slate-400 mt-4 print:hidden flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {isAdmin ? "Modo Auditoría: Puedes ver y corregir cualquier reporte." : "Recuerda guardar antes de cerrar."}</div>
        </>
      )}
    </div>
  );
};

export default DailyReport;