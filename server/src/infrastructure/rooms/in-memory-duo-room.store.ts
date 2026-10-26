import { Injectable } from '@nestjs/common';
import type { DuoRoomStore } from '../../domain/ports/duo-room-store.port.js';
import type { DuoRoomState } from '../../domain/duo-logico/duo-room.js';

@Injectable()
export class InMemoryDuoRoomStore implements DuoRoomStore {
  private readonly rooms = new Map<string, DuoRoomState>();

  create(room: DuoRoomState): void {
    this.rooms.set(room.code, room);
  }

  get(code: string): DuoRoomState | undefined {
    return this.rooms.get(code);
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  findBySocketId(socketId: string): DuoRoomState | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((player) => player.socketId === socketId)) return room;
    }
    return undefined;
  }

  all(): Iterable<DuoRoomState> {
    return this.rooms.values();
  }
}
