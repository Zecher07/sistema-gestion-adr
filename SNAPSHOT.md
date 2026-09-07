# SNAPSHOT — sistema-gestion-adr
_(Última actualización: Cambio 9 — check depósito bancario + auditoría por vale +
botón "Archivar Jornada" (estado ARCHIVADA) + banner de descuadre en Inventario)_

## Stack
- Frontend: React + Vite
- Backend: Supabase (Postgres + Auth + Storage), proyecto `zvxergddoczxmstmgxbu`
- Deploy: Vercel → sistema.adrprintsystem.com

## Componentes principales y su rol

| Archivo | Rol |
|---|---|
| `App.jsx` | Raíz: routing por `currentView` (switch), fetch global de datos, conversión Proforma→Orden, pantalla de Inicio (con botones rápidos y tarjeta de Ventas Finalizadas, ocultos para Producción) |
| `OrderForm.jsx` | Crear/editar Orden de Venta. Tabla de productos con vista compacta (nombre + recuadro de descripción) / edición completa al hacer clic. Respeta `isEffectivelyReadOnly` (Vendedor viendo orden que ya avanzó de paso). |
| `OrderDetailsModal.jsx` | Ver Orden (pantalla) + su versión imprimible (Orden de Producción). Contiene `ProductProductionRow` (fila de "Desglose de Producción" que ve Producción — con Nota Técnica visible SOLO si no es Producción, vía `showFinancials`). |
| `ProformaForm.jsx` | Crear/editar Cotización. Mismo patrón de vista compacta que OrderForm. Selector de Responsable (requiere `staffUsers` como prop). Total editable a mano para productos por m². |
| `ProformaDetailsModal.jsx` | Ver Cotización (pantalla) + 2 vistas imprimibles: normal y formato SRI. |
| `ProformaPrintTemplate.jsx` | Plantilla de impresión de cotización (la que se abre con "Imprimir" normal, no el botón "(SRI)"). |
| `ProformasPanel.jsx` | Listado/tabla de cotizaciones. Su div raíz tiene `print:hidden` (para no colarse en la segunda hoja al imprimir una cotización individual). |
| `WorkAreaList.jsx` | "Área de Trabajo" — bandeja de tareas por rol. Ordenada por Fecha de Entrega (más urgente primero) con semáforo rojo/naranja/verde. |
| `InventoryPanel.jsx` | Gestión de Inventario. Botones: Agregar Compra (todos), Registrar Consumo (SOLO Admin), Cuadre/Auditoría (todos). Campo Nº Factura/Proveedor en "Agregar Compra" SOLO visible para Admin. Al montar lee `sessionStorage['descuadreARevisar']` y pinta un banner rojo con el detalle del descuadre si se llegó desde "Revisar Descuadre". |
| `NotificationsPanel.jsx` | Centro de Notificaciones. Columna izquierda = cosas por fecha (Resumen de Cierre Diario + check "Depósito Bancario Verificado", Vales Emitidos + botón "Auditar" por vale). Columna derecha = Bandeja de Tareas de Inventario (Admin) + Bandeja de Trabajo (según rol). Botón "Archivar Jornada" arriba: habilitado solo con todos los checks; pone `estado='ARCHIVADA'`. Constante de módulo `FECHA_INICIO_AUDITORIA='2026-09-01'`. |
| `AccountingPanel.jsx` | Control Contable — verificación de caja por vendedor, usa `id` único como key (no nombre, por el tema de cuentas duplicadas tipo Fiorella). |

## Tablas de Supabase relevantes

- `orders` — órdenes de venta/producción. Campo `productos` (jsonb, array de items).
- `proformas` — cotizaciones. Campo `items` (jsonb).
- `inventario` — materiales. Campos de precio: `valor_perdida`, `valor_compra` (NO existe
  campo `precio` genérico).
- `historial_inventario` — TODO movimiento de inventario (compras, consumos, cuadres).
  Campos: `material_id`, `material_nombre`, `cantidad_cambio`, `cantidad_resultante`,
  `tipo` ('INGRESO'/'EGRESO'), `motivo` (texto libre, con prefijos como "Cuadre de
  Inventario: ..." o "... Fac/Ref: ..."), `usuario`, `created_at`, `revisado` (bool,
  NUEVO — para la Bandeja de Tareas).
- `cierres_contables` — cierre diario contable. Key por `fecha`. Campos: `estado`
  ('CERRADO' = lo cierra Contabilidad / 'ARCHIVADA' = jornada archivada desde
  Notificaciones con todos los checks / 'PENDIENTE'), `comprobante_general`,
  `total_efectivo_esperado`, `total_transferencias_esperado`, `detalles_vendedores`
  (jsonb), `deposito_verificado` (bool — check manual del depósito bancario).
- `vales_caja` — vales de caja chica/egresos. Campo `status`
  ('PENDIENTE'/'APROBADO'/'RECHAZADO' — CONFIRMADO). Campo `auditado` (bool, NUEVO
  cambio 9 — se marca desde "Vales Emitidos" del Centro de Notificaciones; requisito
  para archivar la jornada).
- `profiles` — perfiles de usuario, con trigger automático `on_auth_user_created`.
- `configuracion_global` — incluye `margen_dias_finalizadas` (días de margen para
  contar ventas finalizadas en comisiones).

## Roles y visibilidad (resumen — ver CLAUDE.md para detalle completo)

- **Administrador**: todo.
- **Vendedor**: sus órdenes + todas las cotizaciones; comisiones por Ventas Finalizadas
  del mes (solo lo creado Y cerrado ese mismo mes, + margen de días configurable).
- **Producción**: solo Bandeja de Tareas; sin precios, sin botones de crear
  orden/cotización, sin Registrar Consumo, sin Nº Factura/Proveedor, sin Nota Técnica
  en "Ver Orden".
- **Contabilidad**: control contable/cierres.

## Convención de fecha de corte

`FECHA_INICIO_AUDITORIA = '2026-09-01'` en NotificationsPanel.jsx — el aviso de
"jornadas sin auditar" y toda la lógica de "jornada pendiente de archivar" NO aplican
antes de esta fecha (datos históricos inconsistentes por cambios seguidos al sistema —
era la causa del 8-jun saliendo "pendiente" disque por cajas sin verificar).
