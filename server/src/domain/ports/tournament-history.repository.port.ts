export const TOURNAMENT_HISTORY_REPOSITORY = Symbol('TOURNAMENT_HISTORY_REPOSITORY');

/**
 * Historial de torneos de un administrador (issue #147). Sale de lo que el torneo ya guarda en
 * Postgres (trazabilidad del #102): solo lo consulta quien lo creó. Los estudiantes no tienen
 * historial: su reporte solo existe mientras están en la sala.
 */
export type TournamentHistoryStatus = 'WAITING' | 'RUNNING' | 'FINISHED' | 'CLOSED';

export interface TournamentHistoryItem {
  code: string;
  /** Nombre que el administrador le puso al abrir la sala; `null` si no le puso ninguno. */
  name: string | null;
  /** `CLOSED`: el administrador lo cerró antes de que terminara. */
  status: TournamentHistoryStatus;
  totalRounds: number;
  /** Rondas que llegaron a empezar. */
  roundsStarted: number;
  /** Personas que jugaron (sin contar a quienes se expulsó). */
  participants: number;
  winnerName: string | null;
  /** Títulos de los juegos del torneo. */
  games: string[];
  createdAt: string;
  finishedAt: string | null;
}

export interface TournamentHistoryStanding {
  position: number;
  name: string;
  points: number;
  wins: number;
  losses: number;
  correctAnswers: number;
  wrongAccusations: number;
}

export interface TournamentHistoryRound {
  round: number;
  game: { title: string; level: string; gameType: string } | null;
  /** Una línea por partida: «Ana vs Beto — ganó Ana». */
  results: string[];
}

export interface TournamentHistoryInsight {
  kind: 'DOMINO' | 'MAZE';
  label: string;
  attempts: number;
  misses: number;
  /** Fracción de intentos que se falló (0 a 1). */
  missRate: number;
}

export interface TournamentHistoryDetail extends TournamentHistoryItem {
  standings: TournamentHistoryStanding[];
  kicked: string[];
  rounds: TournamentHistoryRound[];
  /** Lo más fallado primero (solo lo que se intentó al menos 2 veces). */
  insights: TournamentHistoryInsight[];
}

export interface TournamentHistoryRepository {
  listByCreator(creatorUserId: string): Promise<TournamentHistoryItem[]>;
  /** `null` si no existe o no es de ese administrador. */
  findByCode(creatorUserId: string, code: string): Promise<TournamentHistoryDetail | null>;
}
