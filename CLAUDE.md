# sistema-gestion-adr — Instrucciones para Claude

**Repo**: https://github.com/Zecher07/sistema-gestion-adr
**Deploy**: sistema.adrprintsystem.com (Vercel)
**Stack**: React + Vite + Supabase (proyecto: zvxergddoczxmstmgxbu)
**Cliente**: Ángel del Rosario (Admin/dueño, ADRCOMPANY / Gráficas ADR)

## Cómo trabajar en este repo

- Antes de editar cualquier archivo, verificar sintaxis con el parser real de Babel
  (`@babel/parser`, plugin `jsx`), NUNCA solo "a ojo". Ejemplo de verificación:
  ```js
  const parser = require('@babel/parser');
  parser.parse(content, { sourceType: 'module', plugins: ['jsx'] });
  ```
- Los archivos productivos viven fuera de este entorno de chat — el cliente los
  sube manualmente a su proyecto real después de cada cambio. Siempre entregar
  el archivo COMPLETO editado, nunca un diff o snippet suelto.
- El cliente prueba en producción real con datos reales de sus vendedores. Los
  bugs que reporta son urgentes (afectan ventas/facturación en curso).
- El cliente no es técnico — explica los bugs en términos de negocio ("se me
  confunde el cliente", "no me cuadra"), no en términos de código. Hay que
  investigar el código para traducir su reporte a la causa real antes de
  proponer un arreglo.
- Cuando el cliente pide "vuelve como estaba", confirmar EXACTAMENTE qué parte
  quiere revertir antes de tocar código — varias veces el problema real no era
  la idea/diseño en sí, sino un bug puntual en la implementación (ver ejemplo
  del `isEffectivelyReadOnly` invertido en OrderForm.jsx).

## Convenciones de negocio ya establecidas

### Roles
- **Administrador**: acceso total.
- **Vendedor**: crea/edita sus propias órdenes y cotizaciones; ve TODAS las
  cotizaciones (no solo las propias); ve todas las órdenes en "Ver Todas" pero
  solo las propias en las demás pestañas.
- **Producción**: solo ve su "Bandeja de Tareas" (Área de Trabajo). NO debe ver:
  precios/financials de las órdenes, botones de crear orden/cotización, tarjeta
  de Ventas Finalizadas (todo eso es tema de comisiones de Ventas), el botón
  "Registrar Consumo" de Inventario, ni el campo Nº Factura/Proveedor al
  registrar una compra (información sensible de negocio). SÍ puede: crear
  órdenes de producción propias del área, agregar compras (sin factura/proveedor),
  ver Nota Técnica en formularios que llena, pero NO en "Ver Orden" (esa nota es
  para Ventas/Admin, no para ellos).
- **Contabilidad**: control contable, cierres de caja.

### Descripción de productos: "NOMBRE - detalle"
Cuando se elige un producto de catálogo, el campo `descripcion` queda armado
como `"NOMBRE DEL PRODUCTO - detalle extra"`. Esto SIEMPRE debe mostrarse
separado en dos partes (nombre en negrita arriba, detalle en su propio
recuadro gris abajo, mismo estilo que "Nota Técnica"), tanto en pantalla como
al imprimir. Función estándar para separar (repetida en varios archivos,
mismo criterio siempre):
```js
const getDescParts = (texto) => {
    if (!texto) return { nombre: '', detalle: '' };
    const idx = texto.indexOf(' - ');
    if (idx === -1) return { nombre: texto, detalle: '' };
    return { nombre: texto.slice(0, idx).trim(), detalle: texto.slice(idx + 3).trim() };
};
```
Lugares donde ya está aplicado: OrderForm.jsx, ProformaForm.jsx,
OrderDetailsModal.jsx (vista y print), ProformaDetailsModal.jsx (vista y
print SRI), ProformaPrintTemplate.jsx.

### Productos por metro cuadrado (es_por_metro)
- Internamente el precio unitario es POR M², y hay un panel de "Medidas
  (Ancho x Alto)" para calcularlo — esto está bien y es solo para uso interno
  (Admin/Vendedor viendo el formulario de edición).
- En CUALQUIER documento impreso o visible para el CLIENTE (Orden de
  Producción impresa, Cotización impresa, vista SRI, vista de detalle de
  cotización), el "V. Unitario" mostrado NUNCA debe ser el precio por m² —
  siempre se calcula como `Total ÷ Cantidad`, para que los números visibles
  cuadren matemáticamente (Cantidad × Unitario = Total) y no confundan/asusten
  al cliente. Esto es transparente para productos normales (da el mismo
  resultado) y solo corrige el caso confuso de m².
- En ProformaForm.jsx, el Total de un producto por m² SÍ debe ser editable a
  mano (input, no texto fijo) — antes se recalculaba solo y pisaba cualquier
  valor manual.

### Nota Técnica vs Descripción vs Observaciones
Son 3 cosas distintas para el cliente:
- **Nombre del producto**: solo, en negrita.
- **Descripción**: el detalle que va después del " - ", SÍ sale impreso,
  visible para todos los roles.
- **Nota Técnica** (`observaciones` por producto): información interna para
  Ventas/Admin, NUNCA para Producción, y NUNCA sale impresa al cliente.

### Conversión Proforma → Orden
Al convertir, `App.jsx` mapea los items del proforma a productos de la orden.
CUALQUIER campo nuevo que se agregue a nivel de item (ej. `observaciones`) hay
que agregarlo también en este mapeo o se pierde silenciosamente al convertir.
Buscar `productos: (proforma.items || []).map(item => ({...}))`.

### Centro de Notificaciones (NotificationsPanel.jsx)
Estructura acordada con el cliente:
- **Columna izquierda**: todo lo que depende de una FECHA específica
  (Resumen de Cierre Diario, Vales Emitidos del día, jornadas sin auditar).
- **Columna derecha**: bandejas de TAREAS pendientes, accionables (no listas
  pasivas) — con botón para resolver/marcar como revisado. Cada tarjeta de
  tarea agrupa varias filas de una misma "sesión" (mismo usuario + mismo
  minuto) en una sola tarea, no una por fila.
- Las validaciones de "jornada sin auditar" / "cierre de día" solo aplican
  desde `FECHA_INICIO_AUDITORIA = '2026-09-01'` en adelante — antes de esa
  fecha hubo muchos cambios seguidos al sistema y los datos históricos pueden
  dar falsos positivos. NO extender validaciones nuevas hacia atrás sin
  revisar esto primero.

### Cierre y archivado de jornada (Cambio 9)
- El **Resumen de Cierre Diario** (columna izquierda, solo Admin) tiene un check
  **"Depósito Bancario Verificado"** que el Admin marca a mano tras confirmar el
  ingreso en la cuenta. Se guarda al instante en `cierres_contables.deposito_verificado`
  (upsert por `fecha`), no espera al botón de archivar. Se bloquea cuando el día
  ya está cerrado/archivado.
- Cada **vale emitido del día** tiene un botón **"Auditar"** que marca
  `vales_caja.auditado = true`. El encabezado muestra el contador `X/Y auditados`.
- El botón **"Archivar Jornada"** (arriba, junto al selector de fecha) solo se
  habilita cuando están TODOS los checks: cajas de vendedores verificadas en
  Control Contable + comprobante de depósito subido (si hubo efectivo) +
  "Depósito Bancario Verificado" marcado + todos los vales del día auditados.
  Mientras falte algo, el botón sale gris con tooltip de qué falta y el badge
  del día dice **"Pendiente"**.
- Al archivar, `cierres_contables.estado = 'ARCHIVADA'` (estado NUEVO, distinto
  de `'CERRADO'` que pone Contabilidad). Ambos bloquean el día (`diaEstaCerrado`).
- Toda esta maquinaria (y el aviso "jornadas sin auditar") solo corre para
  fechas `>= FECHA_INICIO_AUDITORIA`. Esto arregla el falso positivo del 8 de
  junio que salía "pendiente" disque por cajas sin verificar.
- **"Revisar Descuadre"** (Bandeja de Tareas de Inventario) además de navegar a
  `inventario-gestionar`, deja el detalle de esa sesión de cuadre en
  `sessionStorage['descuadreARevisar']`. `InventoryPanel.jsx` lo lee UNA vez al
  montar, lo muestra en un recuadro rojo arriba (material, diferencia, cantidad
  resultante, pérdida $, motivo) y borra la llave. La tarjeta de auditoría en
  Notificaciones también es expandible ("Ver detalle del descuadre").

## Errores ya cometidos (no repetir)

1. Meter una condición de "solo lectura" (`isEffectivelyReadOnly`) dentro de
   la lógica que decide mostrar vista compacta vs. edición completa, de forma
   que quedó al revés (forzaba edición completa en vez de vista limpia).
   Regla: si es de solo lectura, SIEMPRE debe verse la vista más limpia/legible.
2. Forzar que la ÚLTIMA fila de una lista de productos siempre esté en modo
   edición, aunque ya tenga contenido real — solo la fila REALMENTE VACÍA debe
   forzar modo edición (usar `!cleanDescription`, no `esUltimaFila`).
3. Olvidar pasar `staffUsers` como prop a un formulario nuevo (ProformaForm),
   causando que un dropdown de responsables saliera vacío sin ningún error
   visible en consola.
4. Poner `print:hidden` solo en el modal que imprime, mostrando accidentalmente
   la pantalla completa que queda DETRÁS del modal (ej. la lista de
   Cotizaciones) en una segunda hoja al imprimir. Cualquier pantalla de fondo
   debe tener también `print:hidden` en su div raíz.
