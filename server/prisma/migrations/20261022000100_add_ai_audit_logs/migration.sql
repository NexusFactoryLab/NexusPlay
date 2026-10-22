-- Registro de cambios del panel de IA (auditoría). Solo crea una tabla nueva;
-- no modifica ni borra datos existentes. `details` nunca contiene API keys.
CREATE TABLE "ai_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "target_label" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_audit_logs_created_at_idx" ON "ai_audit_logs"("created_at");
