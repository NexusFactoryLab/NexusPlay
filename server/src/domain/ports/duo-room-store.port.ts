import type { DuoRoomState } from '../duo-logico/duo-room.js';

export const DUO_ROOM_STORE = Symbol('DUO_ROOM_STORE');

/** Salas en vivo de Dúo Lógico (motor de plataformas). Solo en memoria, como las demás salas. */
export interface DuoRoomStore {
  create(room: DuoRoomState): void;
  get(code: string): DuoRoomState | undefined;
  delete(code: string): void;
  findBySocketId(socketId: string): DuoRoomState | undefined;
  /** Salas en partida: el gateway las hace avanzar en cada tick. */
  all(): Iterable<DuoRoomState>;
}
