-- Consentimiento para aparecer en el ranking público de la landing.
-- Aditiva y sin relleno: ambas columnas aceptan NULL y no llevan DEFAULT, así que
-- no reescribe la tabla ni bloquea. Todas las cuentas existentes quedan en NULL
-- ("nunca se le preguntó"): nadie aparece en el ranking hasta que acepte.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "ranking_consent" BOOLEAN,
ADD COLUMN "ranking_consent_at" TIMESTAMPTZ;
