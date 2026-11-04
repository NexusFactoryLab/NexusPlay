-- Información que el ranking público de la landing vuelve a mostrar: qué tipo
-- de institución es cada organización (universidad, colegio u otra) y, de
-- forma opcional, la facultad o carrera que cada persona indica en su perfil.
-- Aditiva y sin relleno: las organizaciones existentes quedan sin clasificar
-- (NULL) hasta que quien las administra elija el tipo, y nadie tiene programa
-- hasta que lo escriba. El programa solo se publica en el ranking de quien
-- aceptó aparecer (la consulta del ranking ya exige ese consentimiento).

-- CreateEnum
CREATE TYPE "institution_type" AS ENUM ('UNIVERSITY', 'SCHOOL', 'OTHER');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "institution_type" "institution_type";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "academic_program" VARCHAR(80);
