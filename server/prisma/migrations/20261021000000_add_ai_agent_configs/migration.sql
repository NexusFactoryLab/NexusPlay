-- Configuración por agente de IA (Jugador, Configurador de juegos): enfoque
-- (instrucciones) y proveedor/modelo propios. Solo crea una tabla nueva; no
-- modifica ni borra datos existentes. Sin filas = valores por defecto.
CREATE TABLE "ai_agent_configs" (
    "agent_key" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "provider_id" TEXT,
    "model_override" TEXT,
    "fallback_to_default" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agent_configs_pkey" PRIMARY KEY ("agent_key")
);
