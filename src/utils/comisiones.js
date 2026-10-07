// Reglas de comisión compartidas: las usan la pantalla de Estadísticas y la tarjeta "Ventas Finalizadas" del Inicio,
// para que ambas muestren SIEMPRE los mismos números. Si se cambia una regla, se cambia aquí (una sola vez).

// ===== REGLAS DE COMISIÓN (funciones puras) =====
// "Finalizada" = FINALIZADA o ARCHIVADA. Fecha de cierre = fecha_pago_saldo || updated_at (no existe otra).

// ¿La venta fue a crédito? (anticipo o saldo en "Crédito") — mismo criterio de texto que OrderDetailsModal.
export const esVentaACredito = (o) => {
    const esCredito = (v) => { const t = String(v || '').toLowerCase(); return t.includes('crédit') || t.includes('credit'); };
    let fin = o?.financials;
    if (typeof fin === 'string') { try { fin = JSON.parse(fin); } catch (e) { fin = {}; } }
    return esCredito(o?.formaPagoAnticipo || o?.forma_pago_anticipo) || esCredito(o?.formaPagoSaldo || fin?.formaPagoSaldo);
};

// Regla normal: creada dentro del rango Y cerrada dentro del rango + margen de días.
export const finalizadaPropiaEnRango = (o, dateRange, margenDias) => {
    const fechaCreacion = o.created_at || o.createdAt;
    if (dateRange.start && new Date(fechaCreacion) < new Date(dateRange.start + 'T00:00:00')) return false;
    if (dateRange.end && new Date(fechaCreacion) > new Date(dateRange.end + 'T23:59:59')) return false;
    if (o.status !== 'FINALIZADA' && o.status !== 'ARCHIVADA') return false;
    const fechaFinal = o.fecha_pago_saldo || o.updated_at || o.updatedAt;
    if (!fechaFinal) return false;
    if (dateRange.start && new Date(fechaFinal) < new Date(dateRange.start + 'T00:00:00')) return false;
    if (dateRange.end) {
        const limite = new Date(dateRange.end + 'T23:59:59');
        limite.setDate(limite.getDate() + margenDias);
        if (new Date(fechaFinal) > limite) return false;
    }
    return true;
};

// CICLO EXTRA para ventas a crédito: una venta a crédito creada el MES ANTERIOR al del rango, que no alcanzó
// a cobrarse antes del corte de ese mes (fin de mes + margen), todavía puede sumar si se termina de cobrar
// hasta el corte de ESTE mes. Si tampoco, caduca (en el mes siguiente ya no cumple la ventana). Devuelve la
// ventana de fechas o null si el rango no tiene fecha de inicio.
export const ventanaCicloExtraCredito = (dateRange, margenDias) => {
    if (!dateRange?.start) return null;
    const inicio = new Date(dateRange.start + 'T00:00:00');
    if (isNaN(inicio.getTime())) return null;
    const conMargen = (d) => { const r = new Date(d); r.setDate(r.getDate() + margenDias); return r; };
    const creadasDesde = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1, 0, 0, 0);
    const creadasHasta = new Date(inicio.getFullYear(), inicio.getMonth(), 0, 23, 59, 59);
    let cobradasHasta = conMargen(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59));
    if (dateRange.end) {
        const limiteRango = conMargen(new Date(dateRange.end + 'T23:59:59'));
        if (limiteRango < cobradasHasta) cobradasHasta = limiteRango;
    }
    return { creadasDesde, creadasHasta, cobradasDespues: conMargen(creadasHasta), cobradasHasta };
};

export const creditoDelMesAnteriorEnRango = (o, dateRange, margenDias) => {
    const v = ventanaCicloExtraCredito(dateRange, margenDias);
    if (!v) return false;
    if (o.status !== 'FINALIZADA' && o.status !== 'ARCHIVADA') return false;
    if (!esVentaACredito(o)) return false;
    const creada = new Date(o.created_at || o.createdAt);
    if (isNaN(creada.getTime()) || creada < v.creadasDesde || creada > v.creadasHasta) return false;
    const fechaFinal = o.fecha_pago_saldo || o.updated_at || o.updatedAt;
    if (!fechaFinal) return false;
    const cerrada = new Date(fechaFinal);
    if (isNaN(cerrada.getTime())) return false;
    return cerrada > v.cobradasDespues && cerrada <= v.cobradasHasta;
};
// ===== FIN REGLAS DE COMISIÓN =====

// Rango de un mes completo ('YYYY-MM-DD'), igual que lo arma la pantalla de Estadísticas.
export const rangoDelMes = (fechaBase) => {
    const anio = fechaBase.getFullYear();
    const mes = fechaBase.getMonth();
    const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: f(new Date(anio, mes, 1)), end: f(new Date(anio, mes + 1, 0)) };
};

// Resumen de un rango para UN grupo de órdenes (`pertenece` decide cuáles: todas = Admin, las suyas = Vendedor).
// MISMOS números que la pantalla de Estadísticas:
//   totalSales = Ventas Totales (órdenes CREADAS en el rango, de cualquier estado — igual que Estadísticas)
//   propias    = Ventas Finalizadas de las ventas creadas en el rango (base del % de efectividad)
//   carrySales = crédito del mes anterior cobrado dentro del ciclo extra (suma a la comisión, pero no al %)
export const resumenVentasMes = (orders, dateRange, margenDias, pertenece = () => true) => {
    const monto = (o) => parseFloat(o?.financials?.total || 0) || 0;
    let totalSales = 0, propias = 0, carrySales = 0, carryCount = 0;
    (orders || []).forEach(o => {
        if (!pertenece(o)) return;
        const fechaCreacion = o.created_at || o.createdAt;
        const antes = dateRange.start && new Date(fechaCreacion) < new Date(dateRange.start + 'T00:00:00');
        const despues = dateRange.end && new Date(fechaCreacion) > new Date(dateRange.end + 'T23:59:59');
        if (!antes && !despues) totalSales += monto(o);
        if (finalizadaPropiaEnRango(o, dateRange, margenDias)) propias += monto(o);
        else if (creditoDelMesAnteriorEnRango(o, dateRange, margenDias)) { carrySales += monto(o); carryCount += 1; }
    });
    const porcentaje = totalSales > 0 ? (propias / totalSales) * 100 : 0;
    return { totalSales, propias, carrySales, carryCount, porcentaje, falta: Math.max(0, totalSales - propias) };
};
