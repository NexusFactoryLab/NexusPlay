import type { TournamentLevel } from './tournament-store.port.js';

export const TOURNAMENT_SETTINGS_REPOSITORY = Symbol('TOURNAMENT_SETTINGS_REPOSITORY');

/** Límites del torneo: los usa el caso de uso al guardar y el gateway al crear la sala. */
export const TOURNAMENT_MAX_PARTICIPANTS = 40;
export const TOURNAMENT_MIN_PARTICIPANTS = 2;
export const TOURNAMENT_MAX_ROUNDS = 10;
export const TOURNAMENT_MAX_GAMES = 5;

/**
 * Torneo habilitado por un ADMIN (issue #102): qué juegos entran, con qué
 * complejidad, el cupo y las rondas. Mientras exista, el Inicio ofrece a todos
 * entrar con código y el administrador puede abrir la sala; cada ronda sortea
 * uno de estos juegos al azar. Es un único documento: no hay varios torneos
 * habilitados a la vez.
 */
export interface TournamentSettings {
  games: { gameId: string; level: TournamentLevel }[];
  maxParticipants: number;
  totalRounds: number;
  updatedByUserId: string;
  updatedAt: Date;
}

export interface TournamentSettingsRepository {
  /** `null` = no hay torneo habilitado. */
  get(): Promise<TournamentSettings | null>;
  save(settings: TournamentSettings): Promise<void>;
  clear(): Promise<void>;
}
