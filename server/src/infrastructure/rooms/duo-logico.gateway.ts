import { Inject, type OnModuleDestroy, type OnModuleInit, UseFilters } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { GAME_REPOSITORY, type GameRepository } from '../../domain/ports/game.repository.port.js';
import { DUO_ROOM_STORE, type DuoRoomStore } from '../../domain/ports/duo-room-store.port.js';
import {
  answerDuoQuestion,
  applyClientState,
  chooseDuoLevel,
  chooseRole,
  createDuoRoom,
  disconnectDuoPlayer,
  isInGame,
  joinDuoRoom,
  leaveDuoRoom,
  setDuoReady,
  tickDuoRoom,
  toDuoRoomView,
  toDuoSnapshot,
  validEmote,
  voteDuoRetry,
  type DuoRoomState,
} from '../../domain/duo-logico/duo-room.js';
import { DUO_EVENTS } from '../../domain/duo-logico/shared/duoProtocol.js';
import type { DuoClientState, DuoRole } from '../../domain/duo-logico/shared/duoTypes.js';
import { AnalyticsTrackerService } from '../../application/services/analytics-tracker.service.js';
import { WsExceptionFilter } from './ws-exception.filter.js';
import { RoomsGateway } from './rooms.gateway.js';

interface AuthenticatedSocket extends Socket {
  data: { userId: string; displayName: string };
}

/** Cada cuánto avanza el servidor las salas en partida y reparte posiciones (20 por segundo). */
const TICK_MS = 50;
const MAX_CHAT_LENGTH = 300;

/**
 * Salas en vivo de Dúo Lógico (motor de plataformas con sprites, issue #105).
 * Comparte el namespace /rooms con RoomsGateway — y por eso su middleware de
 * autenticación —, pero vive aparte: las reglas están en domain/duo-logico y
 * aquí solo se conectan con los sockets y un reloj.
 */
@WebSocketGateway({
  namespace: '/rooms',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim().replace(/\/+$/, '')) ?? 'http://localhost:5173',
    credentials: true,
  },
})
@UseFilters(WsExceptionFilter)
export class DuoLogicoGateway implements OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private ticker: NodeJS.Timeout | null = null;
  /** Lo último que se repartió de cada sala, para mandar la vista solo cuando cambia. */
  private readonly lastSignature = new Map<string, string>();

  constructor(
    @Inject(GAME_REPOSITORY) private readonly gameRepository: GameRepository,
    @Inject(DUO_ROOM_STORE) private readonly store: DuoRoomStore,
    private readonly rooms: RoomsGateway,
    private readonly analyticsTracker: AnalyticsTrackerService,
  ) {
    this.rooms.registerRoomStore({ kind: 'duo-logico', store: this.store });
  }

  onModuleInit() {
    this.ticker = setInterval(() => this.tick(Date.now()), TICK_MS);
  }

  onModuleDestroy() {
    if (this.ticker) clearInterval(this.ticker);
  }

  @SubscribeMessage(DUO_EVENTS.create)
  async handleCreate(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { gameId: string; role?: DuoRole }) {
    const game = await this.gameRepository.findById(body?.gameId);
    if (!game || game.gameType.getName() !== 'DUAL_QUEST_PIXI') throw new Error('Juego no encontrado o no es de Dúo Lógico.');
    this.leaveCurrent(socket);
    const room = createDuoRoom({
      code: this.rooms.generateUniqueRoomCode(),
      gameId: game.id,
      gameTitle: game.title,
      user: { userId: socket.data.userId, displayName: socket.data.displayName, socketId: socket.id },
      role: body?.role === 'WATER' ? 'WATER' : 'FIRE',
      now: Date.now(),
    });
    this.store.create(room);
    await socket.join(this.channel(room));
    this.broadcastRoom(room);
    void this.analyticsTracker.track({ type: 'room_created', userId: socket.data.userId, gameId: game.id, metadata: { mode: 'duo-logico' } });
  }

  @SubscribeMessage(DUO_EVENTS.join)
  async handleJoin(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { code: string }) {
    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
    const room = this.store.get(code);
    if (!room) throw new Error('No existe una sala de Dúo Lógico con ese código.');
    const current = this.store.findBySocketId(socket.id);
    if (current && current !== room) this.leaveCurrent(socket);
    joinDuoRoom(room, { userId: socket.data.userId, displayName: socket.data.displayName, socketId: socket.id });
    await socket.join(this.channel(room));
    this.broadcastRoom(room);
  }

  @SubscribeMessage(DUO_EVENTS.leave)
  handleLeave(@ConnectedSocket() socket: AuthenticatedSocket) {
    this.leaveCurrent(socket);
  }

  @SubscribeMessage(DUO_EVENTS.role)
  handleRole(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { role: DuoRole }) {
    const room = this.roomOf(socket);
    chooseRole(room, socket.data.userId, body?.role);
    this.broadcastRoom(room);
  }

  @SubscribeMessage(DUO_EVENTS.level)
  handleLevel(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { levelId: string }) {
    const room = this.roomOf(socket);
    chooseDuoLevel(room, socket.data.userId, body?.levelId);
    this.broadcastRoom(room);
  }

  @SubscribeMessage(DUO_EVENTS.ready)
  handleReady(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { ready: boolean }) {
    const room = this.roomOf(socket);
    setDuoReady(room, socket.data.userId, body?.ready, Date.now());
    this.broadcastRoom(room);
  }

  @SubscribeMessage(DUO_EVENTS.state)
  handleState(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: DuoClientState) {
    // Llega ~20 veces por segundo: nada de excepciones, si no aplica se ignora.
    const room = this.store.findBySocketId(socket.id);
    if (room) applyClientState(room, socket.data.userId, body, Date.now());
  }

  @SubscribeMessage(DUO_EVENTS.answer)
  handleAnswer(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { optionIndex: number }) {
    const room = this.roomOf(socket);
    answerDuoQuestion(room, socket.data.userId, body?.optionIndex, Date.now());
    this.broadcastRoom(room);
  }

  @SubscribeMessage(DUO_EVENTS.retry)
  handleRetry(@ConnectedSocket() socket: AuthenticatedSocket) {
    const room = this.roomOf(socket);
    voteDuoRetry(room, socket.data.userId, Date.now());
    this.broadcastRoom(room);
  }

  @SubscribeMessage(DUO_EVENTS.emote)
  handleEmote(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { emote: unknown }) {
    const room = this.store.findBySocketId(socket.id);
    const player = room?.players.find((p) => p.socketId === socket.id);
    if (!room || !player || !validEmote(body?.emote)) return;
    this.server.to(this.channel(room)).emit(DUO_EVENTS.emoteShown, { role: player.role, emote: body.emote });
  }

  @SubscribeMessage(DUO_EVENTS.chat)
  handleChat(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() body: { text: unknown }) {
    const room = this.roomOf(socket);
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) throw new Error('No estás en esta sala.');
    if (typeof body?.text !== 'string') throw new Error('El mensaje debe ser texto.');
    const text = body.text.trim().slice(0, MAX_CHAT_LENGTH);
    if (!text) return;
    this.server.to(this.channel(room)).emit(DUO_EVENTS.chatMessage, { userId: player.userId, role: player.role, displayName: player.displayName, text, sentAt: Date.now() });
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    const room = this.store.findBySocketId(socket.id);
    if (!room) return;
    if (disconnectDuoPlayer(room, socket.id, Date.now())) this.remove(room);
    else this.broadcastRoom(room);
  }

  /** Avanza las salas en partida y reparte posiciones. */
  tick(now: number) {
    for (const room of this.store.all()) {
      if (!isInGame(room)) continue;
      const notices = tickDuoRoom(room, now);
      for (const notice of notices) this.server.to(this.channel(room)).emit(DUO_EVENTS.notice, notice);
      if (this.signature(room) !== this.lastSignature.get(room.code)) this.broadcastRoom(room, now);
      if (isInGame(room)) this.server.to(this.channel(room)).volatile.emit(DUO_EVENTS.snapshot, toDuoSnapshot(room, now));
    }
  }

  private signature(room: DuoRoomState): string {
    const q = room.question;
    return [
      room.phase,
      room.levelId,
      room.runId,
      room.hearts,
      q ? `${q.gate.id}:${q.attempt}:${Object.keys(q.answers).length}` : '-',
      room.reveal ? 'r' : '-',
      Object.keys(room.world.coins).length,
      Object.values(room.world.gates).filter(Boolean).length,
      room.waitingPartnerUntil ?? '-',
      room.players.map((p) => `${p.userId}:${p.role}:${p.ready}:${!!p.socketId}`).join(','),
      room.retryVotes.join(','),
    ].join('|');
  }

  private broadcastRoom(room: DuoRoomState, now = Date.now()) {
    this.lastSignature.set(room.code, this.signature(room));
    for (const player of room.players) {
      if (player.socketId) this.server.to(player.socketId).emit(DUO_EVENTS.room, toDuoRoomView(room, player.userId, now));
    }
  }

  private roomOf(socket: AuthenticatedSocket): DuoRoomState {
    const room = this.store.findBySocketId(socket.id);
    if (!room) throw new Error('No estás en una sala de Dúo Lógico.');
    return room;
  }

  private leaveCurrent(socket: AuthenticatedSocket) {
    const room = this.store.findBySocketId(socket.id);
    if (!room) return;
    void socket.leave(this.channel(room));
    if (leaveDuoRoom(room, socket.data.userId, Date.now())) this.remove(room);
    else this.broadcastRoom(room);
  }

  private remove(room: DuoRoomState) {
    this.store.delete(room.code);
    this.lastSignature.delete(room.code);
  }

  private channel(room: DuoRoomState): string {
    return `duo:${room.code}`;
  }
}
