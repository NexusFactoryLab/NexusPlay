-- El historial de llamadas de IA dice qué agente hizo cada una. Columna nueva
-- y opcional: las filas existentes quedan en NULL (se muestran como "—").
ALTER TABLE "ai_provider_attempts" ADD COLUMN "agent" TEXT;
