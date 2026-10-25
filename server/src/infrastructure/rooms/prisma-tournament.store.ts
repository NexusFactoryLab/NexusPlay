import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { TournamentState, TournamentStore } from '../../domain/ports/tournament-store.port.js';
import { PrismaService } from '../persistence/prisma/prisma.service.js';
import { InMemoryTournamentStore } from './in-memory-tournament.store.js';

/** Cada cuánto se vuelca a la BD un torneo que cambia seguido (descartes, preguntas…). */
const PERSIST_DEBOUNCE_MS = 2_000;

/**
 * Torneo "write-through" (issue #102): la memoria sigue siendo la fuente viva
 * —los timers y los sockets no se pueden guardar en una BD—, pero cada cambio
 * se vuelca a Postgres para tener trazabilidad: quién entró, quién salió,
 * puntos y métricas. Nada se borra: cerrar el torneo o salirse de la sala
 * solo marca `deletedAt` (soft delete).
 *
 * `snapshot` guarda el estado sin las cartas de cada match (pesan mucho y se
 * reconstruyen desde el juego). Al arrancar solo se rehidratan los torneos
 * que seguían en espera; uno en curso no se puede reanudar (sus timers
 * murieron con el proceso) y queda registrado tal como estaba.
 */
@Injectable()
export class PrismaTournamentStore implements TournamentStore, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaTournamentStore.name);
  private readonly memory = new InMemoryTournamentStore();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** Cola por código: las escrituras de un mismo torneo nunca se pisan entre sí. */
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.prisma.tournamentModel.findMany({
        where: { deletedAt: null, phase: 'WAITING' },
      });
      for (const row of rows) {
        const state = row.snapshot as unknown as TournamentState;
        // Los sockets de antes ya no existen: cada quien vuelve a unirse con el código.
        state.moderatorSocketId = null;
        for (const participant of state.participants) participant.socketId = '';
        this.memory.create(state);
      }
      if (rows.length) this.logger.log(`Torneos en espera recuperados: ${rows.length}`);
    } catch (error) {
      this.logger.warn(`No se pudieron recuperar los torneos: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.timers.keys()].map((code) => this.flush(code)));
  }

  create(tournament: TournamentState): void {
    this.memory.create(tournament);
    this.schedule(tournament.code, true);
  }

  get(code: string): TournamentState | undefined {
    return this.memory.get(code);
  }

  set(tournament: TournamentState): void {
    this.memory.set(tournament);
    // Los cambios de fase se guardan de inmediato; el resto, agrupados.
    this.schedule(tournament.code, this.phaseChanged(tournament));
  }

  delete(code: string): void {
    const tournament = this.memory.get(code);
    this.memory.delete(code);
    if (!tournament) return;
    this.enqueue(code, async () => {
      await this.write(tournament);
      const deletedAt = new Date();
      await this.prisma.tournamentModel.update({
        where: { code },
        data: { deletedAt, participants: { updateMany: { where: { deletedAt: null }, data: { deletedAt } } } },
      });
    });
  }

  findBySocketId(socketId: string): TournamentState | undefined {
    return this.memory.findBySocketId(socketId);
  }

  private readonly lastPhase = new Map<string, string>();

  private phaseChanged(tournament: TournamentState): boolean {
    const key = `${tournament.phase}:${tournament.currentRound}`;
    const changed = this.lastPhase.get(tournament.code) !== key;
    this.lastPhase.set(tournament.code, key);
    return changed;
  }

  private schedule(code: string, immediate: boolean): void {
    if (immediate) {
      clearTimeout(this.timers.get(code));
      this.timers.delete(code);
      void this.flush(code);
      return;
    }
    if (this.timers.has(code)) return;
    this.timers.set(code, setTimeout(() => void this.flush(code), PERSIST_DEBOUNCE_MS));
  }

  private async flush(code: string): Promise<void> {
    clearTimeout(this.timers.get(code));
    this.timers.delete(code);
    const tournament = this.memory.get(code);
    if (!tournament) return;
    await this.enqueue(code, () => this.write(tournament));
  }

  private enqueue(code: string, job: () => Promise<void>): Promise<void> {
    const next = (this.queues.get(code) ?? Promise.resolve())
      .then(job)
      .catch((error) => this.logger.warn(`No se pudo guardar el torneo ${code}: ${error instanceof Error ? error.message : String(error)}`));
    this.queues.set(code, next);
    return next;
  }

  private async write(tournament: TournamentState): Promise<void> {
    const snapshot = {
      ...tournament,
      matches: tournament.matches.map((match) => ({ ...match, cards: [], guidedChat: [], pendingQuestion: null })),
    };
    const data = {
      gameId: tournament.gameId,
      gameTitle: tournament.gameTitle,
      creatorUserId: tournament.creatorUserId,
      phase: tournament.phase,
      maxParticipants: tournament.maxParticipants,
      totalRounds: tournament.totalRounds,
      currentRound: tournament.currentRound,
      winnerUserId: tournament.winnerUserId,
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      ...(tournament.phase !== 'WAITING' ? { startedAt: new Date(tournament.createdAt) } : {}),
      ...(tournament.phase === 'FINISHED' ? { finishedAt: new Date() } : {}),
    };
    const row = await this.prisma.tournamentModel.upsert({
      where: { code: tournament.code },
      create: { code: tournament.code, ...data },
      update: data,
    });

    const present = new Set(tournament.participants.map((p) => p.userId));
    for (const p of tournament.participants) {
      const stats = {
        displayName: p.displayName,
        points: p.points,
        wins: p.wins ?? 0,
        losses: p.losses ?? 0,
        botMatches: p.botMatches ?? 0,
        questionsAsked: p.questionsAsked ?? 0,
        wrongAccusations: p.wrongAccusations ?? 0,
      };
      await this.prisma.tournamentParticipantModel.upsert({
        where: { tournamentId_userId: { tournamentId: row.id, userId: p.userId } },
        create: { tournamentId: row.id, userId: p.userId, ...stats },
        // Si vuelve a entrar tras haber salido, se reactiva el mismo registro.
        update: { ...stats, deletedAt: null },
      });
    }
    // Quien salió de la sala (ya no está en el estado) queda con soft delete.
    await this.prisma.tournamentParticipantModel.updateMany({
      where: { tournamentId: row.id, deletedAt: null, userId: { notIn: [...present] } },
      data: { deletedAt: new Date() },
    });
  }
}
