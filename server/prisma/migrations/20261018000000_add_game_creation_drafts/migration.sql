-- Issue #69: borradores automáticos de creación de juego (por usuario, con el
-- estado completo del formulario, el resultado de la IA y las URLs de los
-- archivos subidos a la IA, que viven en Cloudinary). Solo crea una tabla
-- nueva; no modifica ni borra datos existentes.
CREATE TABLE "game_creation_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT '',
    "form_state" JSONB,
    "ai_result" JSONB,
    "ai_message" TEXT,
    "ai_files" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_creation_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "game_creation_drafts_user_id_updated_at_idx" ON "game_creation_drafts"("user_id", "updated_at");

CREATE INDEX "game_creation_drafts_updated_at_idx" ON "game_creation_drafts"("updated_at");

ALTER TABLE "game_creation_drafts" ADD CONSTRAINT "game_creation_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
