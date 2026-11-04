-- Issue #102: torneos grupales persistentes con soft delete. Tablas nuevas;
-- no modifica ni borra datos existentes.
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "game_title" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "max_participants" INTEGER NOT NULL,
    "total_rounds" INTEGER NOT NULL,
    "current_round" INTEGER NOT NULL DEFAULT 0,
    "winner_user_id" TEXT,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tournament_participants" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "bot_matches" INTEGER NOT NULL DEFAULT 0,
    "questions_asked" INTEGER NOT NULL DEFAULT 0,
    "wrong_accusations" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tournaments_code_key" ON "tournaments"("code");
CREATE INDEX "tournaments_creator_user_id_created_at_idx" ON "tournaments"("creator_user_id", "created_at");
CREATE INDEX "tournaments_deleted_at_idx" ON "tournaments"("deleted_at");
CREATE UNIQUE INDEX "tournament_participants_tournament_id_user_id_key" ON "tournament_participants"("tournament_id", "user_id");
CREATE INDEX "tournament_participants_user_id_idx" ON "tournament_participants"("user_id");

ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
