// Tipos compartidos entre el servidor y el cliente de Dúo Lógico.
//
// La carpeta `shared/` existe idéntica en server/src/domain/duo-logico/shared
// y en client/src/components/home/games/duo-logico/shared: la copia del
// cliente se genera con `npm run sync:duo-shared` (en server/) y una prueba
// del servidor falla si las dos se separan. Nada aquí puede importar de
// fuera de esta carpeta.

export type DuoRole = 'FIRE' | 'WATER';
export const DUO_ROLES: readonly DuoRole[] = ['FIRE', 'WATER'];

export function otherRole(role: DuoRole): DuoRole {
  return role === 'FIRE' ? 'WATER' : 'FIRE';
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DuoInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  /** Bajar de una rama (plataforma que se atraviesa). */
  down: boolean;
}

export const NO_INPUT: DuoInput = { left: false, right: false, jump: false, down: false };

export type DuoAnim = 'idle' | 'walk' | 'rise' | 'peak' | 'fall' | 'push' | 'swim' | 'cheer' | 'hurt';

/** Lo que cada cliente cuenta de su propio personaje (y de las cajas que empuja). */
export interface DuoPlayerNet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  anim: DuoAnim;
  /** Murió y está esperando reaparecer: el compañero lo ve desvanecerse. */
  dead: boolean;
}

export interface DuoCrateNet {
  id: string;
  x: number;
  y: number;
}

export interface DuoClientState {
  player: DuoPlayerNet;
  crates: DuoCrateNet[];
}

export interface DuoCrateState extends DuoCrateNet {
  owner: DuoRole | null;
  /** Hora del servidor en que llegó su última posición (para interpolarla sin saltos). */
  at?: number;
}

/** Estado del mundo que arbitra el servidor y reparte a los dos. */
export interface DuoWorldState {
  /** Botones (activos mientras algo los pisa) y palancas (quedan activas). */
  switches: Record<string, boolean>;
  crates: DuoCrateState[];
  /** Fichas de pista ya recogidas, con quién las tomó. */
  coins: Record<string, DuoRole>;
  /** Puertas del Saber ya abiertas (pregunta respondida bien por los dos). */
  gates: Record<string, boolean>;
  /** Ángulo actual de cada espejo (0 a MIRROR_ANGLES - 1). */
  mirrors: Record<string, number>;
}

export interface DuoSnapshot {
  /** Reloj del servidor (ms) — el cliente interpola al compañero con él. */
  t: number;
  players: Partial<Record<DuoRole, DuoPlayerNet>>;
  /** Hora del servidor en que llegó la posición de cada uno: si no cambió, el cliente no la cuenta como nueva. */
  at: Partial<Record<DuoRole, number>>;
  world: DuoWorldState;
}

export type DuoEmote = 'here' | 'wait' | 'button' | 'go' | 'thanks' | 'idea';
export const DUO_EMOTES: readonly DuoEmote[] = ['here', 'wait', 'button', 'go', 'thanks', 'idea'];

