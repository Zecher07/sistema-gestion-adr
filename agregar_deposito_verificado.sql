-- CAMBIO 8/9 — check manual de depósito bancario en el Resumen de Cierre Diario.
-- Lo marca Admin tras verificar el ingreso en la cuenta. Se guarda al instante
-- (upsert por fecha) y es requisito para archivar la jornada.
-- (Si ya lo corriste en una sesión anterior, este script no hace nada por el IF NOT EXISTS.)
ALTER TABLE cierres_contables
  ADD COLUMN IF NOT EXISTS deposito_verificado boolean NOT NULL DEFAULT false;
