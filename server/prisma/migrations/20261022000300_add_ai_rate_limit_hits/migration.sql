-- Contador de llamadas por minuto compartido entre instancias del servidor
-- (solo se usa con AI_RATE_LIMIT_STORE=postgres). Tabla nueva; no modifica ni
-- borra datos existentes. "key" es un hash, nunca una API key.
CREATE TABLE "ai_rate_limit_hits" (
    "key" TEXT NOT NULL,
    "window_start" BIGINT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_rate_limit_hits_pkey" PRIMARY KEY ("key", "window_start")
);
