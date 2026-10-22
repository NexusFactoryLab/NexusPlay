-- Las instrucciones de un agente pasan a ser opcionales: NULL = "usa el texto de
-- fábrica vigente del catálogo" (así, mejorar ese texto en el código llega a los
-- agentes ya guardados); '' = "sin instrucciones" explícito. Solo relaja la
-- columna: no modifica ni borra datos existentes.
ALTER TABLE "ai_agent_configs"
    ALTER COLUMN "instructions" DROP NOT NULL,
    ALTER COLUMN "instructions" DROP DEFAULT;
