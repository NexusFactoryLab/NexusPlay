-- Issue #69: borradores automáticos de creación de juego (por usuario, tipo y
-- modo) con el resultado de la IA y los archivos subidos. Solo crea tablas
-- nuevas; no modifica ni borra datos existentes.
CREATE TABLE "game_creation_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "game_type" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT '',
    "form_state" JSONB,
    "ai_result" JSONB,
    "ai_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_creation_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_creation_draft_files" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_creation_draft_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_creation_drafts_user_id_game_type_mode_key" ON "game_creation_drafts"("user_id", "game_type", "mode");

CREATE INDEX "game_creation_draft_files_draft_id_idx" ON "game_creation_draft_files"("draft_id");

ALTER TABLE "game_creation_drafts" ADD CONSTRAINT "game_creation_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_creation_draft_files" ADD CONSTRAINT "game_creation_draft_files_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "game_creation_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
