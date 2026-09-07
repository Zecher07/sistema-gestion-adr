# BACKLOG — sistema-gestion-adr

## >CONTINÚA AQUÍ

**"Cambio 8/9" — Bandeja de Tareas de Inventario + Jornada Archivada — COMPLETO.**
Falta que el cliente CORRA LOS SQL y suba los 2 archivos editados a producción:
- SQL a correr: `agregar_revisado_inventario.sql`, `agregar_deposito_verificado.sql`
  (`deposito_verificado` en `cierres_contables`), `agregar_auditado_vales.sql`
  (`auditado` en `vales_caja` — NUEVO en cambio 9).
- Archivos editados: `src/components/NotificationsPanel.jsx`, `src/components/InventoryPanel.jsx`.

Hecho en cambio 8:
- [x] "Bandeja de Tareas de Inventario" (Admin): AUDITORÍA (descuadre con pérdida,
      agrupado por sesión de cuadre) y RECEPCIÓN (compra de Producción pendiente de
      costear). Botones navegan a `inventario-gestionar` (OJO: ese nombre, NO
      `'inventario'` — ese solo abre el submenú y queda en blanco).

Hecho en cambio 9 (esta sesión):
- [x] `FECHA_INICIO_AUDITORIA = '2026-09-01'` como constante de módulo; `jornadasSinAuditar`
      ahora filtra `fecha >= FECHA_INICIO_AUDITORIA` (arregla el falso positivo del 8-jun).
- [x] Estado `depositoVerificado` (useState) + `useEffect` que lo sincroniza con
      `reporteDelDiaActual?.deposito_verificado` al cambiar `fechaMaestra`.
- [x] Checkbox "Depósito Bancario Verificado" en la tarjeta "Resumen de Cierre Diario"
      (solo Admin, upsert inmediato por `fecha`, bloqueado si `diaEstaCerrado`).
- [x] Botón "Auditar" por cada vale del día → `vales_caja.auditado`. Contador
      `X/Y auditados` en el encabezado de "Vales Emitidos".
- [x] Botón de arriba renombrado a "Archivar Jornada", deshabilitado (gris + tooltip
      con lo que falta) hasta que: cajas verificadas + comprobante (si hay efectivo) +
      depósito verificado + todos los vales auditados. Badge del día = "Pendiente"
      mientras tanto. Al archivar: `estado = 'ARCHIVADA'` (nuevo, distinto de `'CERRADO'`);
      `diaEstaArchivado` / `diaEstaCerrado` bloquean el día.
- [x] "Revisar Descuadre" guarda el detalle de la sesión de cuadre en
      `sessionStorage['descuadreARevisar']`; `InventoryPanel.jsx` lo lee al montar y lo
      pinta en un recuadro rojo arriba (material, diferencia, quedó en, pérdida $,
      motivo), con X para cerrar. La tarjeta de auditoría en Notificaciones también es
      expandible ("Ver detalle del descuadre").

Confirmado en esta sesión: `vales_caja` NO tenía columna de auditoría (solo `status`
PENDIENTE/APROBADO/RECHAZADO). Se creó columna dedicada `auditado` (bool) — no se
reusó `status` para no confundir "aprobado" con "auditado".

## Pendientes de sesiones anteriores (no resueltos aún)

- [ ] Copiar archivos de Storage del proyecto Supabase viejo (yqnkhtocppyjbvpmzagh) al
      nuevo (zvxergddoczxmstmgxbu) — bloqueado por cuota excedida en el proyecto viejo.
      Scripts ya listos: `copiar_storage.js` + `actualizar_urls_storage.sql`.
- [ ] Decisión sobre cuenta duplicada de "FIORELLA VAQUE" — la vieja de Contabilidad
      (da4ac4b9-...) vs la nueva de Vendedora (3342c955-...). Cliente no ha respondido
      qué hacer (¿borrar la vieja? ¿cambiarle el rol?).
- [ ] Correr `migrar_imagenes_viejas.js` (convertir imágenes base64 antiguas a Storage)
      — baja prioridad.
- [ ] Evaluar VPS propio (OVHcloud, datacenter Canadá) para auto-hospedar Supabase —
      cliente mostró interés por precio y latencia desde Ecuador, sin decisión aún.

## Ideas / mejoras sugeridas por el cliente (sin decisión de implementar aún)

- Cliente sugirió (como opción, no pedido firme) que en OrderForm/ProformaForm, en vez
  de que la Nota Técnica/Descripción se apilen hacia abajo (agrandando la lista de
  ítems), podrían mostrarse como columnas a la derecha, tipo vista "momentánea". Se le
  explicó que es un cambio de diseño más grande — no se implementó, evaluar si insiste.
