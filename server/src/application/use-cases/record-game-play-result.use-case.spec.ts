import { describe, expect, it, vi } from 'vitest';
import {
  RecordGamePlayResultUseCase,
  type RecordGamePlayResultCommand,
} from './record-game-play-result.use-case.js';
import {
  GameNotFoundError,
  GamePlayResultRateLimitedError,
  GamePlayResultRejectedError,
} from '../errors/application.errors.js';

const NOW = new Date('2026-11-01T12:00:00Z');

function fakeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1',
    title: 'Parejas reales',
    categoryId: 'subject-1',
    creatorUserId: 'teacher',
    gameType: { getName: () => 'MEMORY_MATCH' },
    status: { isPublished: () => true },
    config: { timePerZoneSeconds: 90 },
    content: new Array(8).fill({}),
    ...overrides,
  };
}

function build(
  options: {
    game?: unknown;
    enrolledClassIds?: string[];
    classesWithGame?: string[];
    lastPlayedAt?: Date | null;
    lastHourCount?: number;
    earnedToday?: number;
  } = {},
) {
  const record = vi.fn().mockResolvedValue(undefined);
  const classRepository = {
    findClassIdsContainingGame: vi.fn().mockResolvedValue(options.classesWithGame ?? []),
    findClassIdsEnrolledByUserId: vi.fn().mockResolvedValue(options.enrolledClassIds ?? []),
    findEnrollment: vi.fn(async (classId: string) => ((options.enrolledClassIds ?? []).includes(classId) ? { classId } : null)),
  };
  const results = {
    findLastPlayedAt: vi.fn().mockResolvedValue(options.lastPlayedAt ?? null),
    countByStudentSince: vi.fn().mockResolvedValue(options.lastHourCount ?? 0),
    sumPointsForGameSince: vi.fn().mockResolvedValue(options.earnedToday ?? 0),
  };
  const useCase = new RecordGamePlayResultUseCase(
    { record } as never,
    { findById: vi.fn().mockResolvedValue(options.game === undefined ? fakeGame() : options.game) } as never,
    classRepository as never,
    { findById: vi.fn().mockResolvedValue({ id: 'subject-1', name: 'Biología' }) } as never,
    results as never,
  );
  return { useCase, record, classRepository, results };
}

const command = (overrides: Partial<RecordGamePlayResultCommand> = {}): RecordGamePlayResultCommand => ({
  gameId: 'game-1',
  gameTitle: 'Título mentiroso del cliente',
  score: 500,
  correctCount: 5,
  incorrectCount: 1,
  timePlayedMs: 60_000,
  requestingUserId: 'student',
  ...overrides,
});

describe('RecordGamePlayResultUseCase', () => {
  it('guarda la partida con el título y el área reales del juego, no los del cliente', async () => {
    const { useCase, record } = build();
    const outcome = await useCase.execute(command({ subjectName: 'Inventada' }), NOW);
    expect(outcome.counted).toBe(true);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ studentUserId: 'student', gameId: 'game-1', gameTitle: 'Parejas reales', subjectId: 'subject-1', subjectName: 'Biología', score: 500 }),
    );
  });

  it('los puntos de plataforma salen de aciertos y errores, no del puntaje del cliente', async () => {
    // 10 de participación + 5 × 5 aciertos − 2 × 1 error = 33
    const { useCase, record } = build();
    const outcome = await useCase.execute(command({ score: 3000 }), NOW);
    expect(outcome.pointsAwarded).toBe(33);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ points: 33, score: 3000 }));
  });

  it('respeta el tope diario por juego: solo suma lo que cabe', async () => {
    const { useCase, record, results } = build({ earnedToday: 190 });
    const outcome = await useCase.execute(command(), NOW);
    expect(outcome.pointsAwarded).toBe(10);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ points: 10 }));
    // el día se mide desde la medianoche de Colombia (05:00 UTC)
    expect((results.sumPointsForGameSince.mock.calls[0][2] as Date).toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('con el tope lleno la partida se guarda con 0 puntos', async () => {
    const { useCase, record } = build({ earnedToday: 200 });
    const outcome = await useCase.execute(command(), NOW);
    expect(outcome).toEqual({ counted: true, pointsAwarded: 0 });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ points: 0 }));
  });

  it('el juego debe existir', async () => {
    const { useCase, record } = build({ game: null });
    await expect(useCase.execute(command(), NOW)).rejects.toBeInstanceOf(GameNotFoundError);
    expect(record).not.toHaveBeenCalled();
  });

  it('rechaza un puntaje imposible y no guarda nada', async () => {
    const { useCase, record } = build();
    await expect(useCase.execute(command({ score: 150_000 }), NOW)).rejects.toBeInstanceOf(GamePlayResultRejectedError);
    expect(record).not.toHaveBeenCalled();
  });

  it('jugar tu propio juego se guarda para las métricas pero suma 0 puntos', async () => {
    const { useCase, record } = build({ game: fakeGame({ creatorUserId: 'student' }) });
    expect(await useCase.execute(command(), NOW)).toEqual({ counted: false, pointsAwarded: 0 });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ points: 0 }));
  });

  it('un borrador ajeno suma 0, salvo que estés matriculado en una clase que lo incluye', async () => {
    const draft = fakeGame({ status: { isPublished: () => false } });

    const outside = build({ game: draft });
    expect((await outside.useCase.execute(command(), NOW)).counted).toBe(false);

    const enrolled = build({ game: draft, classesWithGame: ['c1'], enrolledClassIds: ['c1'] });
    expect((await enrolled.useCase.execute(command(), NOW)).counted).toBe(true);
  });

  it('los juegos que no puntúan por respuestas (dominó, serpientes…) no suman por este endpoint', async () => {
    const domino = build({ game: fakeGame({ gameType: { getName: () => 'DOMINO' } }) });
    const outcome = await domino.useCase.execute(command({ score: 100, correctCount: 0, incorrectCount: 0 }), NOW);
    expect(outcome).toEqual({ counted: false, pointsAwarded: 0 });
    expect(domino.results.sumPointsForGameSince).not.toHaveBeenCalled();
  });

  it('la clase solo se guarda si estás matriculado; si no, queda sin clase', async () => {
    const member = build({ enrolledClassIds: ['c1'] });
    await member.useCase.execute(command({ classId: 'c1' }), NOW);
    expect(member.record).toHaveBeenCalledWith(expect.objectContaining({ classId: 'c1' }));

    const stranger = build({ enrolledClassIds: [] });
    await stranger.useCase.execute(command({ classId: 'c-ajena' }), NOW);
    expect(stranger.record).toHaveBeenCalledWith(expect.objectContaining({ classId: null }));
  });

  it('frena repetir el mismo juego a los pocos segundos', async () => {
    const { useCase, record } = build({ lastPlayedAt: new Date(NOW.getTime() - 2_000) });
    await expect(useCase.execute(command(), NOW)).rejects.toBeInstanceOf(GamePlayResultRateLimitedError);
    expect(record).not.toHaveBeenCalled();
  });

  it('permite repetir el juego pasado el intervalo', async () => {
    const { useCase } = build({ lastPlayedAt: new Date(NOW.getTime() - 60_000) });
    expect((await useCase.execute(command(), NOW)).counted).toBe(true);
  });

  it('frena el exceso de partidas en una hora', async () => {
    const { useCase } = build({ lastHourCount: 60 });
    await expect(useCase.execute(command(), NOW)).rejects.toBeInstanceOf(GamePlayResultRateLimitedError);
  });
});
