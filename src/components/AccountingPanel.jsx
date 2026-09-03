import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldCheck, Calendar, DollarSign, Landmark, CheckCircle2, AlertCircle, X, Save, FileText, Upload, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Text';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { isUserMatch } from '@/utils/userMatch';

const AccountingPanel = ({ user, orders = [], staffUsers = [], onViewOrder }) => {
  const { toast } = useToast();
  
  const toLocalDateStr = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const offsetMs = date.getTimezoneOffset() * 60 * 1000;
        return new Date(date.getTime() - offsetMs).toISOString().split('T')[0];
    } catch(e) {
        return isoString.split('T')[0];
    }
  };

  const todayStr = toLocalDateStr(new Date().toISOString());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dailyClosings, setDailyClosings] = useState([]); 
  const [accountingReport, setAccountingReport] = useState(null); 

  const [verifyModal, setVerifyModal] = useState(null); 
  const [generalProofImage, setGeneralProofImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: closingsData } = await supabase
          .from('daily_closings')
          .select('*')
          .order('updated_at', { ascending: false }) 
          .limit(100); 
          
      const reportesDeHoy = (closingsData || []).filter(c => {
          const cleanDate = c.date ? String(c.date).split('T')[0].trim() : '';
          return cleanDate === selectedDate;
      });
      
      setDailyClosings(reportesDeHoy);

      const { data: accData } = await supabase
          .from('cierres_contables')
          .select('*')
          .eq('fecha', selectedDate)
          .maybeSingle();
          
      if (accData) {
          setAccountingReport(accData);
          setGeneralProofImage(accData.comprobante_general);
      } else {
          setAccountingReport({ estado: 'PENDIENTE', detalles_vendedores: [] });
          setGeneralProofImage(null);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sellersData = useMemo(() => {
     // 🔧 FIX: antes se agrupaba por el TEXTO del nombre (un Set de strings). Si una
     // orden vieja tenía el nombre guardado con una diferencia mínima (un espacio, otra
     // mayúscula) respecto al nombre actual del perfil, el mismo vendedor terminaba
     // apareciendo dos veces como si fueran personas distintas. Ahora se agrupa por
     // el id real del vendedor — solo puede haber una fila por persona, sin importar
     // cuántas variantes de su nombre existan en órdenes viejas.
     const activeSellers = new Map(); // key: id del vendedor (o nombre normalizado si no se encuentra) -> nombre a mostrar

     const addSeller = (nombreCrudo) => {
         if (!nombreCrudo) return;
         const match = staffUsers.find(su => su.name?.toLowerCase().trim() === nombreCrudo?.toLowerCase().trim());
         const key = match ? match.id : `sin-id:${nombreCrudo.toLowerCase().trim()}`;
         if (!activeSellers.has(key)) activeSellers.set(key, match ? match.name : nombreCrudo);
     };

     staffUsers.filter(u => u.role === 'Vendedor').forEach(u => activeSellers.set(u.id, u.name));

     dailyClosings.forEach(c => {
         const usr = staffUsers.find(su => String(su.id) === String(c.user_id));
         if (usr) activeSellers.set(usr.id, usr.name);
     });

     orders.forEach(o => {
        const createdDateStr = toLocalDateStr(o.created_at || o.createdAt);
        const updatedDateStr = toLocalDateStr(o.updated_at || o.updatedAt);
        const balanceDateStr = o.fecha_pago_saldo ? toLocalDateStr(o.fecha_pago_saldo) : updatedDateStr;

        if (createdDateStr === selectedDate) {
            addSeller(o.recibido_por_anticipo || o.vendedor);
        }

        // 🔥 SOLUCIÓN AL DINERO FANTASMA: Quitamos 'VENTAS POR RETIRAR' 🔥
        const isClosed = o.status === 'FINALIZADA' || o.status === 'ENTREGADO';
        if (balanceDateStr === selectedDate && isClosed) {
            addSeller(o.recibido_por_saldo || o.vendedor);
        }
     });

     // 🔧 FIX: antes esto convertía el Map de vuelta a solo NOMBRES
     // (Array.from(activeSellers.values())), y luego volvía a buscar el id
     // por nombre otra vez — si dos personas distintas comparten exactamente
     // el mismo nombre (por ejemplo, dos cuentas ambas llamadas "Fiorella
     // Vaque"), esa segunda búsqueda podía agarrar a la persona equivocada,
     // haciendo que el dinero de una no se reflejara nunca. Ahora se usa el
     // id que ya quedó guardado como clave del Map, sin volver a pasar por
     // el nombre para nada.
     return Array.from(activeSellers.entries()).map(([sellerKey, sellerName]) => {
         const esIdReal = !String(sellerKey).startsWith('sin-id:');
         const sellerUser = esIdReal ? staffUsers.find(su => String(su.id) === String(sellerKey)) : null;
         const closing = sellerUser ? dailyClosings.find(c => String(c.user_id) === String(sellerUser.id)) : null;

         const amountToAccounting = closing ? Number(closing.amount_to_accounting || 0) : 0;

         let totalTransfers = 0;
         let transactions = []; 

         orders.forEach(o => {
            const createdDateStr = toLocalDateStr(o.created_at || o.createdAt);
            const updatedDateStr = toLocalDateStr(o.updated_at || o.updatedAt);
            const balanceDateStr = o.fecha_pago_saldo ? toLocalDateStr(o.fecha_pago_saldo) : updatedDateStr;
            
            const processPayment = (monto, formaPago, tipoPago) => {
                const val = parseFloat(monto) || 0;
                if (val > 0) {
                    if (formaPago?.includes('Transferencia') || formaPago?.includes('Depósito')) {
                        totalTransfers += val;
                    }
                    
                    transactions.push({
                        orderId: o.id,
                        orderNumber: o.order_number || o.orderNumber || o.id,
                        client: o.cliente,
                        amount: val,
                        method: formaPago || 'Efectivo',
                        type: tipoPago,
                        originalOrder: o
                    });
                }
            };

            if (createdDateStr === selectedDate) {
                const cobradorAnt = o.recibido_por_anticipo || o.vendedor;
                const cobradorAntId = o.recibido_por_anticipo_id;
                const matchesAnt = cobradorAntId
                    ? (sellerUser && cobradorAntId === sellerUser.id)
                    : (cobradorAnt?.toLowerCase().trim() === sellerName?.toLowerCase().trim());
                if (matchesAnt) {
                    processPayment(o.anticipo, o.forma_pago_anticipo, 'Anticipo');
                }
            }
            
            // 🔥 SOLUCIÓN AL DINERO FANTASMA: Quitamos 'VENTAS POR RETIRAR' 🔥
            const isClosed = o.status === 'FINALIZADA' || o.status === 'ENTREGADO';
            if (balanceDateStr === selectedDate && isClosed) {
                const cobradorSal = o.recibido_por_saldo || o.vendedor;
                const cobradorSalId = o.recibido_por_saldo_id;
                const saldoCobrado = (Number(o.financials?.total) || 0) - (Number(o.anticipo) || 0) - (Number(o.retencion) || 0);
                const matchesSal = cobradorSalId
                    ? (sellerUser && cobradorSalId === sellerUser.id)
                    : (cobradorSal?.toLowerCase().trim() === sellerName?.toLowerCase().trim());
                if (matchesSal) {
                    processPayment(saldoCobrado, o.forma_pago_saldo, 'Saldo');
                }
            }
         });

         const savedDetails = accountingReport?.detalles_vendedores || [];
         const verification = savedDetails.find(d =>
             sellerUser && d.vendedor_id ? d.vendedor_id === sellerUser.id
             : d.vendedor?.toLowerCase().trim() === sellerName?.toLowerCase().trim()
         ) || { status: 'PENDIENTE', cash_ok: false };

         return {
             name: sellerName,
             expectedCash: amountToAccounting,
             expectedTransfers: totalTransfers,
             hasData: amountToAccounting > 0 || totalTransfers > 0 || closing !== null,
             transactions, 
             verification
         };
     }).filter(s => s.hasData); 
  }, [staffUsers, dailyClosings, orders, selectedDate, accountingReport]);

  const globalTotals = useMemo(() => {
      return sellersData.reduce((acc, curr) => {
          acc.cash += curr.expectedCash;
          acc.transfers += curr.expectedTransfers;
          if (curr.verification.status === 'VERIFICADO') acc.verifiedCount += 1;
          return acc;
      }, { cash: 0, transfers: 0, verifiedCount: 0, totalSellers: sellersData.length });
  }, [sellersData]);

  const handleImageUpload = (e, callback) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          return toast({ title: "Error", description: "La imagen es muy pesada (Máx 5MB).", variant: "destructive" });
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSellerVerification = async () => {
      const sellerUser = staffUsers.find(su => su.name?.toLowerCase().trim() === verifyModal.name?.toLowerCase().trim());
      const currentDetails = accountingReport.detalles_vendedores || [];
      const newDetails = currentDetails.filter(d =>
          sellerUser && d.vendedor_id ? d.vendedor_id !== sellerUser.id : d.vendedor !== verifyModal.name
      );
      
      newDetails.push({
          vendedor: verifyModal.name,
          vendedor_id: sellerUser?.id || null,
          status: 'VERIFICADO',
          cash_ok: verifyModal.cash_ok
      });

      const updatedReport = { ...accountingReport, detalles_vendedores: newDetails };
      setAccountingReport(updatedReport);
      setVerifyModal(null);
      
      try {
          const payload = {
              fecha: selectedDate,
              responsable: user.name,
              responsable_id: user.id,
              detalles_vendedores: newDetails,
              estado: accountingReport?.estado || 'PENDIENTE',
              updated_at: new Date().toISOString()
          };
          await supabase.from('cierres_contables').upsert(payload, { onConflict: 'fecha' });
          toast({ title: "Caja Verificada y Bloqueada", description: `La caja de ${verifyModal.name} fue confirmada exitosamente.` });
      } catch (error) {
          toast({ title: "Aviso", description: "Verificado localmente pero hubo error de red.", variant: "warning" });
      }
  };

  const handleCloseDay = async () => {
      const faltantes = globalTotals.totalSellers - globalTotals.verifiedCount;
      if (faltantes > 0) {
          return toast({ 
              title: "Acción Denegada", 
              description: `No puede cerrar el día. Faltan ${faltantes} caja(s) de vendedores por verificar.`, 
              variant: "destructive" 
          });
      }

      if (!generalProofImage && globalTotals.cash > 0) {
          return toast({ title: "Comprobante Obligatorio", description: "Debe subir el comprobante de depósito general de efectivo para cerrar el día.", variant: "destructive" });
      }

      setSaving(true);
      try {
          const payload = {
              fecha: selectedDate,
              responsable: user.name,
              responsable_id: user.id,
              total_efectivo_esperado: globalTotals.cash,
              total_transferencias_esperado: globalTotals.transfers,
              detalles_vendedores: accountingReport.detalles_vendedores,
              comprobante_general: generalProofImage,
              estado: 'CERRADO',
              updated_at: new Date().toISOString()
          };

          const { error } = await supabase.from('cierres_contables').upsert(payload, { onConflict: 'fecha' });
          if (error) throw error;

          toast({ title: "Día Cerrado Correctamente", description: "El reporte contable se ha guardado con éxito." });
          fetchData();
      } catch (error) {
          toast({ title: "Error", description: "Fallo al guardar en la base de datos.", variant: "destructive" });
      } finally {
          setSaving(false);
      }
  };

  const isClosed = accountingReport?.estado === 'CERRADO';

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-indigo-600" /> Control y Cierre Contable
                </h2>
                <p className="text-slate-500">Recepción de efectivo y verificación de transferencias.</p>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                <Calendar className="h-4 w-4 text-slate-400" />
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-white" />
                <span className={cn("px-3 py-1 rounded text-xs font-bold uppercase", isClosed ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>
                    {isClosed ? 'CERRADO' : 'ABIERTO'}
                </span>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-green-50 border-green-200">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="h-6 w-6 text-green-600" /></div>
                        <h3 className="text-sm font-bold text-green-800 uppercase tracking-wider">Efectivo por Recibir</h3>
                    </div>
                    <p className="text-3xl font-black text-green-700">${globalTotals.cash.toFixed(2)}</p>
                    <p className="text-xs text-green-600 mt-1">Suma del dinero reportado por vendedores</p>
                </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg"><Landmark className="h-6 w-6 text-blue-600" /></div>
                        <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider">Transferencias / Depósitos</h3>
                    </div>
                    <p className="text-3xl font-black text-blue-700">${globalTotals.transfers.toFixed(2)}</p>
                    <p className="text-xs text-blue-600 mt-1">Bancos a conciliar hoy</p>
                </CardContent>
            </Card>

            <Card className={cn("border", globalTotals.verifiedCount === globalTotals.totalSellers && globalTotals.totalSellers > 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200")}>
                <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={cn("p-2 rounded-lg", globalTotals.verifiedCount === globalTotals.totalSellers && globalTotals.totalSellers > 0 ? "bg-emerald-100" : "bg-slate-200")}>
                            <CheckCircle2 className={cn("h-6 w-6", globalTotals.verifiedCount === globalTotals.totalSellers && globalTotals.totalSellers > 0 ? "text-emerald-600" : "text-slate-600")} />
                        </div>
                        <h3 className={cn("text-sm font-bold uppercase tracking-wider", globalTotals.verifiedCount === globalTotals.totalSellers && globalTotals.totalSellers > 0 ? "text-emerald-800" : "text-slate-700")}>Progreso de Verificación</h3>
                    </div>
                    <p className="text-3xl font-black text-slate-800">{globalTotals.verifiedCount} <span className="text-xl text-slate-400">/ {globalTotals.totalSellers}</span></p>
                    <p className="text-xs text-slate-500 mt-1">Cajas validadas</p>
                </CardContent>
            </Card>
        </div>

        <Card className="shadow-sm border-slate-200">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Validación por Vendedor / Usuario</h3>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}><Loader2 className={cn("h-4 w-4 text-slate-500", loading ? "animate-spin" : "")}/></Button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800 text-white">
                        <tr>
                            <th className="px-6 py-3 font-semibold">Usuario</th>
                            <th className="px-6 py-3 font-semibold text-right">Efectivo (Entregar)</th>
                            <th className="px-6 py-3 font-semibold text-right">Transferencias</th>
                            <th className="px-6 py-3 font-semibold text-center">Estado</th>
                            <th className="px-6 py-3 font-semibold text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {loading ? (
                            <tr><td colSpan="5" className="text-center py-10 text-slate-400"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2"/>Buscando datos...</td></tr>
                        ) : sellersData.length === 0 ? (
                            <tr><td colSpan="5" className="text-center py-10 text-slate-500">Nadie ha reportado movimientos de dinero para esta fecha.</td></tr>
                        ) : (
                            sellersData.map(seller => (
                                <tr key={seller.name} className={cn("transition-colors", seller.verification.status === 'VERIFICADO' ? "bg-emerald-50/30" : "hover:bg-slate-50")}>
                                    <td className="px-6 py-4 font-bold text-slate-800 uppercase">{seller.name}</td>
                                    <td className="px-6 py-4 text-right font-bold text-green-700">${seller.expectedCash.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-bold text-blue-700">${seller.expectedTransfers.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", seller.verification.status === 'VERIFICADO' ? "bg-green-100 text-green-700 border border-green-200" : "bg-yellow-100 text-yellow-700 border border-yellow-200")}>
                                            {seller.verification.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className={cn("text-xs font-bold transition-colors", 
                                                seller.verification.status === 'VERIFICADO' 
                                                ? "bg-slate-100 text-green-700 border-green-300 opacity-60 cursor-not-allowed" 
                                                : "text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                                            )}
                                            onClick={() => {
                                                if (seller.verification.status !== 'VERIFICADO') {
                                                    setVerifyModal({ ...seller, cash_ok: seller.verification.cash_ok });
                                                }
                                            }}
                                            disabled={seller.verification.status === 'VERIFICADO'}
                                        >
                                            {seller.verification.status === 'VERIFICADO' ? 'Validado (Bloqueado)' : 'Verificar Detalles'}
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mt-8 shadow-sm">
            <h3 className="font-bold text-indigo-900 mb-4 text-lg flex items-center gap-2"><Landmark className="h-5 w-5" /> Cierre de Día (Depósito General)</h3>
            <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1 space-y-4">
                    <p className="text-sm text-indigo-700">Para finalizar la caja del día, debes subir el comprobante de depósito bancario (o de transferencias globales) que sustente el cierre de la jornada.</p>
                    
                    <div className="bg-white p-4 rounded border border-indigo-100">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Comprobante de Depósito / Cierre *</label>
                        <div className="flex items-center gap-4">
                            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                                <Upload className="h-4 w-4" /> Seleccionar Imagen
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setGeneralProofImage)} disabled={isClosed} />
                            </label>
                            {generalProofImage && (
                                <span className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/> Imagen Adjunta</span>
                            )}
                        </div>
                        {generalProofImage && (
                            <div className="mt-4 relative inline-block">
                                <img src={generalProofImage} alt="Comprobante Cierre" className="h-32 rounded border border-slate-200 shadow-sm cursor-pointer" onClick={() => setPreviewImage(generalProofImage)} />
                                {!isClosed && <button onClick={() => setGeneralProofImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"><X className="h-3 w-3"/></button>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="shrink-0 w-full md:w-64 flex flex-col items-center justify-center p-6 bg-white border border-indigo-200 rounded-lg shadow-inner">
                    <span className="text-xs font-bold text-slate-500 uppercase mb-2">Total Efectivo a Depositar</span>
                    <span className="text-4xl font-black text-indigo-700">${globalTotals.cash.toFixed(2)}</span>
                    <Button 
                        onClick={handleCloseDay} 
                        disabled={saving || isClosed} 
                        className={cn("w-full mt-4 font-bold py-6 text-lg shadow-lg transition-all", isClosed ? "bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700 text-white")}
                    >
                        {saving ? <Loader2 className="h-5 w-5 animate-spin"/> : isClosed ? 'Día Cerrado' : 'CERRAR DÍA'}
                    </Button>
                </div>
            </div>
        </div>

        <AnimatePresence>
            {verifyModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200">
                        
                        <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-400"/> Verificar Caja y Transferencias: {verifyModal.name}</h3>
                            <button onClick={() => setVerifyModal(null)} className="hover:bg-slate-700 p-1.5 rounded-full"><X className="h-5 w-5" /></button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                            <div className="p-6 space-y-6 border-r border-slate-200">
                                <h4 className="font-bold text-slate-700 mb-2 border-b border-slate-200 pb-2">1. Recepción y Evidencias</h4>
                                
                                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div>
                                        <span className="text-xs font-bold text-green-800 uppercase tracking-wider block mb-1">Efectivo a recibir</span>
                                        <span className="text-3xl font-black text-green-700">${verifyModal.expectedCash.toFixed(2)}</span>
                                        <p className="text-[10px] text-green-600 mt-1">*Monto declarado en su Reporte Diario.</p>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-3 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                                        <input type="checkbox" className="w-5 h-5 text-green-600 rounded focus:ring-green-500" checked={verifyModal.cash_ok} onChange={(e) => setVerifyModal({...verifyModal, cash_ok: e.target.checked})} />
                                        <span className="font-bold text-slate-700 text-sm">Recibido</span>
                                    </label>
                                </div>

                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">Transferencias / Bancos</span>
                                            <span className="text-2xl font-black text-blue-700">${verifyModal.expectedTransfers.toFixed(2)}</span>
                                            <p className="text-[10px] text-blue-600 mt-1">*Las evidencias de transferencia se subirán en el Cierre de Día Global abajo.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 overflow-y-auto max-h-[60vh]">
                                <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2">2. Desglose de Movimientos (Órdenes de Hoy)</h4>
                                
                                {verifyModal.transactions.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 text-sm">
                                        No hay órdenes cobradas por este usuario hoy.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {verifyModal.transactions.map((tx, idx) => (
                                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center hover:border-indigo-300 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">#{tx.orderNumber}</span>
                                                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", tx.type === 'Anticipo' ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700")}>{tx.type}</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-800 uppercase line-clamp-1">{tx.client}</p>
                                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                        Via: <span className="font-medium text-slate-700">{tx.method}</span>
                                                    </p>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className={cn("font-black text-sm", tx.method.includes('Efectivo') ? "text-green-600" : "text-blue-600")}>
                                                        ${tx.amount.toFixed(2)}
                                                    </span>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-6 text-[10px] bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 px-2" 
                                                        onClick={() => onViewOrder(tx.originalOrder)}
                                                    >
                                                        Ver Orden <ExternalLink className="ml-1 h-3 w-3"/>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setVerifyModal(null)}>Cancelar</Button>
                            <Button onClick={handleSaveSellerVerification} disabled={!verifyModal.cash_ok} className="bg-green-600 hover:bg-green-700 text-white font-bold gap-2 shadow-md">
                                <CheckCircle2 className="h-4 w-4" /> Marcar Verificado
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        <AnimatePresence>
            {previewImage && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" onClick={() => setPreviewImage(null)}>
                <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full transition-colors"><X className="h-8 w-8" /></button>
                <img src={previewImage} alt="Referencia" className="max-w-full max-h-[95vh] rounded shadow-2xl" />
              </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

export default AccountingPanel;