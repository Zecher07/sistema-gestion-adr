import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Printer, Loader2, Save, FileSpreadsheet, ChevronLeft, ChevronRight, History, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

const DailyReport = ({ orders = [], user }) => {
  if (!user) return <div className="p-10 text-center text-slate-500">Cargando perfil...</div>;

  const { toast } = useToast();
  const isAdmin = user.role === 'Administrador';

  // --- ARREGLO DE FECHA (ZONA HORARIA LOCAL) ---
  const getLocalDateStr = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    const localDate = new Date(now.getTime() - offsetMs);
    return localDate.toISOString().split('T')[0];
  };

  const todayStr = getLocalDateStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState(isAdmin ? 'calendar' : 'report'); 
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // ADMIN
  const [targetUserId, setTargetUserId] = useState(user.id);
  const [staffList, setStaffList] = useState([]);
  const [targetUserName, setTargetUserName] = useState(user.name);

  // Calendario
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [daysWithReport, setDaysWithReport] = useState(new Set()); 

  // --- DATOS DEL REPORTE ---
  const [ledgerData, setLedgerData] = useState({
    openingCash: 0,        
    amountToAccounting: 0, 
    manualTransactions: [] 
  });

  // --- CAMBIO CLAVE AQUÍ ---
  // Se puede editar si es HOY ... O ... si eres ADMINISTRADOR (siempre)
  const isEditable = selectedDate === todayStr || isAdmin;

  // 1. CARGAR STAFF
  useEffect(() => {
    if (isAdmin) {
        const fetchStaff = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name, role').order('full_name');
            if (data) setStaffList(data);
        };
        fetchStaff();
    }
  }, [isAdmin]);

  useEffect(() => {
      if (isAdmin && staffList.length > 0) {
          const selectedUser = staffList.find(u => u.id === targetUserId);
          if (selectedUser) setTargetUserName(selectedUser.full_name);
      } else {
          setTargetUserName(user.name);
      }
  }, [targetUserId, staffList, isAdmin, user.name]);


  // 2. CARGA DE DATOS INTELIGENTE
  useEffect(() => {
    if (targetUserId) {
        loadDailyData(selectedDate, targetUserId);
    }
  }, [selectedDate, targetUserId]); 

  const loadDailyData = async (date, userId) => {
    setLoading(true);
    try {
      const { data: currentReport, error } = await supabase
        .from('daily_closings')
        .select('*')
        .eq('date', date)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (currentReport) {
        setLedgerData({
          openingCash: currentReport.opening_cash || 0,
          amountToAccounting: currentReport.amount_to_accounting || 0, 
          manualTransactions: currentReport.manual_transactions || []
        });
      } else {
        const { data: lastReport } = await supabase
            .from('daily_closings')
            .select('final_balance')
            .eq('user_id', userId)
            .lt('date', date) 
            .order('date', { ascending: false }) 
            .limit(1)
            .maybeSingle();

        setLedgerData({
            openingCash: lastReport?.final_balance || 0, 
            amountToAccounting: 0,
            manualTransactions: []
        });
      }
    } catch (error) {
      console.error("Error cargando caja:", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. CALENDARIO
  useEffect(() => {
    if (targetUserId) fetchCalendarDots();
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

  // 4. CÁLCULOS AUTOMÁTICOS
  const automaticTransactions = useMemo(() => {
    const txs = [];
    const newSales = orders.filter(o => o.createdAt && o.createdAt.startsWith(selectedDate));
    
    newSales.forEach(o => {
      if (Number(o.anticipo) > 0) txs.push({
          id: `auto-sale-${o.id}`, type: 'VENTA', description: o.cliente, details: `Anticipo #${o.orderNumber}`,
          orderNumber: o.orderNumber, income: Number(o.anticipo), expense: 0, 
          balanceNote: o.financials?.saldo > 0 ? `Saldo pdte: $${Number(o.financials.saldo).toFixed(2)}` : 'PAGADO', isManual: false
        });
    });

    const pickups = orders.filter(o => {
      const isUpdatedToday = o.updatedAt && o.updatedAt.startsWith(selectedDate);
      const isRelevantStatus = o.status === 'FINALIZADA' || o.status === 'VENTAS POR RETIRAR';
      return isUpdatedToday && isRelevantStatus && Number(o.financials?.saldo) > 0;
    });

    pickups.forEach(o => txs.push({
        id: `auto-pickup-${o.id}`, type: 'COBRO SALDO', description: o.cliente, details: `Saldo Final #${o.orderNumber}`,
        orderNumber: o.orderNumber, income: Number(o.financials.saldo), expense: 0, balanceNote: 'COMPLETADO', isManual: false
      }));
    
    return txs;
  }, [orders, selectedDate]);

  const allTransactions = useMemo(() => [...automaticTransactions, ...ledgerData.manualTransactions], [automaticTransactions, ledgerData]);

  // TOTALES
  const totals = useMemo(() => {
    const totalIncome = allTransactions.reduce((sum, tx) => sum + Number(tx.income || 0), 0);
    const totalExpense = allTransactions.reduce((sum, tx) => sum + Number(tx.expense || 0), 0);
    const cashInHand = Number(ledgerData.openingCash) + totalIncome - totalExpense;
    const nextDayBalance = cashInHand - Number(ledgerData.amountToAccounting);

    return { totalIncome, totalExpense, cashInHand, nextDayBalance };
  }, [allTransactions, ledgerData]);


  // 5. GUARDAR EN NUBE
  const saveToCloud = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('daily_closings')
        .upsert({
          date: selectedDate,
          user_id: targetUserId,
          opening_cash: ledgerData.openingCash,
          amount_to_accounting: ledgerData.amountToAccounting, 
          final_balance: totals.nextDayBalance, 
          manual_transactions: ledgerData.manualTransactions,
          updated_at: new Date()
        }, { onConflict: 'date, user_id' });

      if (error) throw error;
      toast({ title: "Guardado", description: "Cierre de caja actualizado." });
      fetchCalendarDots();
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleExportExcel = () => {
     toast({ title: "Exportar", description: "Función de exportar lista." });
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-20 print:p-0 print:w-full">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {isAdmin ? 'Auditoría de Cajas' : 'Reporte Diario de Caja'}
            </h2>
            <p className="text-slate-500 text-sm">
                {isAdmin ? 'Selecciona un vendedor:' : `Caja de: ${user.name}`}
            </p>
         </div>
         
         <div className="flex bg-slate-100 p-1 rounded-lg">
             <button onClick={() => setViewMode('report')} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", viewMode === 'report' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700")}>Reporte del Día</button>
             <button onClick={() => setViewMode('calendar')} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2", viewMode === 'calendar' ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700")}><History className="h-4 w-4" /> Historial</button>
         </div>
      </div>

      {/* CALENDARIO */}
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
                        <div className="text-center">
                            <h3 className="text-xl font-bold uppercase text-slate-800">{currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h3>
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

      {/* REPORTE DIARIO */}
      {viewMode === 'report' && (
        <>
            <div className="flex justify-between items-center mb-2 print:hidden">
                 <Button variant="ghost" onClick={() => setViewMode('calendar')} className="text-slate-500 hover:text-slate-800"><ChevronLeft className="h-4 w-4 mr-1"/> Volver</Button>
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportExcel} className="gap-2 border-green-200 hover:bg-green-50 text-green-700"><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
                    <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Imprimir</Button>
                    {isEditable && (
                        <Button onClick={() => saveToCloud()} disabled={saving} className="gap-2 bg-blue-900 hover:bg-blue-800 text-white min-w-[140px]">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? 'Guardando...' : 'Guardar Cierre'}
                        </Button>
                    )}
                 </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-dashed"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />Cargando...</div>
            ) : (
                <div className="bg-white shadow-xl print:shadow-none min-h-[800px] flex flex-col font-sans text-xs md:text-sm border-2 border-slate-900">
                    
                    {/* ENCABEZADO REPORTE */}
                    <div className="bg-blue-300 border-b-2 border-slate-900 p-3 flex justify-between items-center print:bg-blue-300 print:print-color-adjust-exact">
                        <div>
                            <div className="font-black text-lg uppercase tracking-wider">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                            <div className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">VENDEDOR: <span className="bg-white px-1 rounded">{targetUserName}</span></div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-700 uppercase">SALDO INICIAL (AYER)</span>
                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border-2 border-slate-900 shadow-sm">
                                <span className="font-bold text-lg text-slate-900">${Number(ledgerData.openingCash).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* TABLA DE MOVIMIENTOS */}
                    <div className="grid grid-cols-[40px_1fr_100px_100px_100px_200px_40px] bg-orange-300 border-b-2 border-slate-900 font-bold text-center divide-x-2 divide-slate-900 print:bg-orange-300 print:print-color-adjust-exact">
                        <div className="py-2">#</div><div className="py-2">DESCRIPCION</div><div className="py-2 text-[10px] leading-tight flex items-center justify-center">ORDEN</div><div className="py-2">INGRESO</div><div className="py-2">EGRESO</div><div className="py-2">NOTA</div><div className="py-2 bg-slate-200 print:hidden"></div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {allTransactions.map((tx, idx) => (
                            <div key={tx.id} className={cn("grid grid-cols-[40px_1fr_100px_100px_100px_200px_40px] border-b border-slate-300 divide-x divide-slate-300 hover:bg-yellow-50", idx % 2 === 0 ? "bg-white" : "bg-slate-50")}>
                                <div className="py-2 font-bold text-center text-slate-500">{idx + 1}</div>
                                <div className="py-1 px-2 flex flex-col justify-center">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-[10px] font-bold px-1 rounded border border-black uppercase print:border-black", tx.type === 'VENTA' ? 'bg-green-200' : tx.type.includes('GASTO') ? 'bg-red-200' : 'bg-yellow-200')}>{tx.type}</span>
                                        {tx.isManual && isEditable ? <input className="flex-1 bg-transparent border-b border-dotted outline-none font-semibold" value={tx.description} onChange={(e) => updateManualTransaction(tx.id, 'description', e.target.value)} /> : <span className="font-bold uppercase">{tx.description}</span>}
                                    </div>
                                </div>
                                <div className="py-2 text-center font-mono font-bold text-slate-700">{tx.isManual && isEditable ? <input className="w-full text-center bg-transparent outline-none" value={tx.orderNumber} onChange={(e) => updateManualTransaction(tx.id, 'orderNumber', e.target.value)} /> : tx.orderNumber}</div>
                                
                                {/* PROTECCIÓN CONTRA ERRORES: Usamos Number() para evitar crash */}
                                <div className="py-2 px-2 text-right font-bold text-green-700">
                                    {tx.isManual && isEditable ? 
                                        <input type="number" className="w-full text-right bg-transparent outline-none" value={tx.income} onChange={(e) => updateManualTransaction(tx.id, 'income', e.target.value)} /> 
                                        : (Number(tx.income) > 0 ? `$${Number(tx.income).toFixed(2)}` : '-')}
                                </div>
                                <div className="py-2 px-2 text-right font-bold text-red-700">
                                    {tx.isManual && isEditable ? 
                                        <input type="number" className="w-full text-right bg-transparent outline-none" value={tx.expense} onChange={(e) => updateManualTransaction(tx.id, 'expense', e.target.value)} /> 
                                        : (Number(tx.expense) > 0 ? `$${Number(tx.expense).toFixed(2)}` : '-')}
                                </div>
                                
                                <div className="py-2 px-2 text-xs text-slate-600 truncate">{tx.isManual && isEditable ? <input className="w-full bg-transparent outline-none" value={tx.balanceNote} onChange={(e) => updateManualTransaction(tx.id, 'balanceNote', e.target.value)} /> : tx.balanceNote}</div>
                                <div className="flex items-center justify-center bg-slate-50 print:hidden">{tx.isManual && isEditable && <button onClick={() => removeManualTransaction(tx.id)} className="text-red-400 hover:text-red-600 font-bold">X</button>}</div>
                            </div>
                        ))}
                        {isEditable && (
                            <div className="p-4 flex gap-4 bg-slate-100 print:hidden border-t border-slate-300">
                                <Button variant="outline" onClick={() => addManualTransaction('GASTO')} className="border-red-300 text-red-700 hover:bg-red-50">+ Gasto</Button>
                                <Button variant="outline" onClick={() => addManualTransaction('INGRESO')} className="border-green-300 text-green-700 hover:bg-green-50">+ Ingreso Extra</Button>
                            </div>
                        )}
                    </div>

                    {/* --- FOOTER LIMPIO Y CORREGIDO --- */}
                    <div className="border-t-2 border-slate-900">
                        {/* Resumen Superior */}
                        <div className="bg-slate-800 text-white p-2 grid grid-cols-2 gap-4 text-center print:print-color-adjust-exact">
                            <div><div className="text-[10px] text-slate-400">TOTAL INGRESOS</div><div className="text-lg font-bold text-green-400">${totals.totalIncome.toFixed(2)}</div></div>
                            <div><div className="text-[10px] text-slate-400">TOTAL EGRESOS</div><div className="text-lg font-bold text-red-400">${totals.totalExpense.toFixed(2)}</div></div>
                        </div>
                        
                        {/* Fila Principal de Cierre */}
                        <div className="flex flex-col md:flex-row border-t-2 border-slate-900 h-auto md:h-24 text-sm">
                            
                            {/* 1. DINERO TOTAL EN CAJA */}
                            <div className="flex-1 border-r-2 border-slate-900 bg-blue-50 p-4 flex flex-col justify-center items-center">
                                <span className="font-bold text-xs uppercase text-slate-500 mb-2">TOTAL EN CAJA</span>
                                <div className="text-3xl font-black text-slate-800">${totals.cashInHand.toFixed(2)}</div>
                            </div>

                            {/* 2. INPUT DEL VENDEDOR (ENTREGA A CONTABILIDAD) */}
                            <div className="flex-1 border-r-2 border-slate-900 bg-yellow-50 p-4 flex flex-col justify-center items-center print:bg-yellow-50 print:print-color-adjust-exact">
                                <span className="font-bold text-xs uppercase text-slate-700 mb-2">ENTREGAR A CONTABILIDAD</span>
                                <div className="flex items-center justify-center gap-2 w-full max-w-[200px] border-b-2 border-slate-800 pb-1">
                                    <span className="font-bold text-2xl text-slate-700">$</span>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        className="w-full font-bold text-3xl text-center outline-none bg-transparent text-slate-900 placeholder:text-slate-300" 
                                        placeholder="0"
                                        value={ledgerData.amountToAccounting} 
                                        onChange={(e) => updateField('amountToAccounting', e.target.value)}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div>

                            {/* 3. SALDO PARA MAÑANA (Calculado) */}
                            <div className={cn("flex-1 p-4 font-black uppercase flex flex-col justify-center items-center text-white print:print-color-adjust-exact", totals.nextDayBalance >= 0 ? "bg-green-700" : "bg-red-700")}>
                                <span className="text-[10px] opacity-80 mb-2">SALDO PARA MAÑANA</span>
                                <span className="text-4xl">${totals.nextDayBalance.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {!isEditable && <div className="text-xs text-amber-600 mt-4 print:hidden flex items-center gap-2 justify-center bg-amber-50 p-2 rounded border border-amber-200"><AlertCircle className="h-4 w-4" /> Reporte histórico. No se pueden realizar cambios.</div>}
        </>
      )}
    </div>
  );
};

export default DailyReport;