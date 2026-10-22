-- Proveedores de IA configurables desde el panel de administración. Solo crea
-- una tabla nueva; no modifica ni borra datos existentes. La API key se guarda
-- cifrada (AES-256-GCM), nunca en claro.
CREATE TABLE "ai_provider_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "base_url" TEXT,
    "text_model" TEXT NOT NULL,
    "vision_model" TEXT,
    "max_rpm" INTEGER,
    "encrypted_api_key" TEXT NOT NULL,
    "api_key_hint" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "last_test_at" TIMESTAMP(3),
    "last_test_ok" BOOLEAN,
    "last_test_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_provider_configs_name_key" ON "ai_provider_configs"("name");

CREATE INDEX "ai_provider_configs_enabled_priority_idx" ON "ai_provider_configs"("enabled", "priority");
