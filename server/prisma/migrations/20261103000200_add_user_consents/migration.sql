-- Historial de consentimientos (solo de anexar), empezando por aparecer en el
-- ranking público de la landing. Aditiva: un enum y una tabla nuevos, sin tocar
-- "users" ni rellenar datos. Nadie tiene filas al aplicarla, así que todas las
-- cuentas quedan en "nunca se le preguntó" y nadie aparece en el ranking hasta
-- que acepte.

-- CreateEnum
CREATE TYPE "consent_type" AS ENUM ('PUBLIC_RANKING');

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "consent_type" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Última decisión por (usuario, tipo) sin ordenar: perfil y ranking público.
CREATE INDEX "user_consents_user_type_created_idx" ON "user_consents"("user_id", "type", "created_at" DESC);

-- AddForeignKey
-- Borrar la cuenta borra su historial.
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
