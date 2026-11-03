-- Puntos de plataforma por partida (ranking general): los calcula el servidor.
-- Aditiva y sin bloqueos largos: columna con DEFAULT constante + índices.

-- AlterTable
ALTER TABLE "game_play_results" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;

-- Relleno de lo ya registrado, para no dejar partidas sin puntos: la misma fórmula
-- que usa el servidor (10 de participación + 5 por acierto − 2 por error, mínimo 0).
-- Hasta hoy solo Memory Match registraba partidas.
UPDATE "game_play_results"
SET "points" = GREATEST(0, 10 + 5 * "correct_count" - 2 * "incorrect_count");

-- CreateIndex
CREATE INDEX "game_play_results_played_at_idx" ON "game_play_results"("played_at");

-- CreateIndex
CREATE INDEX "game_play_results_student_game_played_idx" ON "game_play_results"("student_user_id", "game_id", "played_at");
