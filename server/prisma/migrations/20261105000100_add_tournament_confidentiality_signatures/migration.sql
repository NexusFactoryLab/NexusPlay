-- Firmas del acuerdo de confidencialidad y autorización de datos de torneos (issue #173).
-- Aditiva: una tabla nueva, sin tocar tablas existentes. Solo se anexa: un trigger impide UPDATE y DELETE.
-- Sin clave foránea a "users" a propósito: la prueba de la firma no debe borrarse en cascada al eliminar la
-- cuenta; su conservación y supresión se rigen por el plazo de retención definido por el responsable.

-- CreateTable
CREATE TABLE "tournament_confidentiality_signatures" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tournament_code" TEXT NOT NULL,
    "tournament_creator_user_id" TEXT,
    "full_name" TEXT NOT NULL,
    "document_type" TEXT,
    "document_number" TEXT,
    "contact_email" TEXT,
    "birth_date" DATE NOT NULL,
    "is_minor" BOOLEAN NOT NULL,
    "guardian_full_name" TEXT,
    "guardian_document_type" TEXT,
    "guardian_document_number" TEXT,
    "guardian_relationship" TEXT,
    "accepted_confidentiality" BOOLEAN NOT NULL,
    "accepted_data_processing" BOOLEAN NOT NULL,
    "guardian_accepted" BOOLEAN,
    "signature_name" TEXT NOT NULL,
    "text_version" TEXT NOT NULL,
    "text_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "signed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tournament_confidentiality_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Firma vigente de una persona para un torneo y una versión del texto (chequeo al unirse).
CREATE INDEX "tcs_user_tournament_version_idx" ON "tournament_confidentiality_signatures"("user_id", "tournament_code", "text_version");

-- CreateIndex
-- Listado de respaldo de un torneo, en orden cronológico.
CREATE INDEX "tcs_tournament_signed_idx" ON "tournament_confidentiality_signatures"("tournament_code", "signed_at");

-- Inmutabilidad: ninguna fila se actualiza ni se borra.
CREATE FUNCTION "tcs_block_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'tournament_confidentiality_signatures es de solo anexar (% no permitido)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "tcs_no_update_delete"
BEFORE UPDATE OR DELETE ON "tournament_confidentiality_signatures"
FOR EACH ROW EXECUTE FUNCTION "tcs_block_mutation"();
