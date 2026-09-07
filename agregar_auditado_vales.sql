-- CAMBIO 9 — check de auditoría por vale en el Centro de Notificaciones.
-- Marca cada vale del día como revisado por Admin. Junto con las cajas
-- verificadas y el check de "Depósito Bancario Verificado", habilita el
-- botón "Archivar Jornada".
ALTER TABLE vales_caja
  ADD COLUMN IF NOT EXISTS auditado boolean NOT NULL DEFAULT false;
