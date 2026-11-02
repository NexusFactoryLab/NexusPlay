import { describe, expect, it, vi } from 'vitest';
import type { TournamentHistoryDetail, TournamentHistoryItem, TournamentHistoryRepository } from '../../../domain/ports/tournament-history.repository.port.js';
import type { TournamentSettings, TournamentSettingsRepository } from '../../../domain/ports/tournament-settings.repository.port.js';
import { CachedTournamentHistoryRepository, TournamentHistoryCache } from './cached-tournament-history.repository.js';
import { CachedTournamentSettingsRepository, createTournamentSettingsCache } from './cached-tournament-settings.repository.js';

const settings = (rounds = 3): TournamentSettings => ({
  games: [{ gameId: 'g', level: 'MEDIUM' }],
  maxParticipants: 40,
  totalRounds: rounds,
  updatedByUserId: 'admin',
  updatedAt: new Date('2026-11-01T10:00:00Z'),
});

function settingsInner(initial: TournamentSettings | null = settings()) {
  let current = initial;
  return {
    get: vi.fn(async () => current),
    save: vi.fn(async (next: TournamentSettings) => {
      current = next;
    }),
    clear: vi.fn(async () => {
      current = null;
    }),
  } satisfies TournamentSettingsRepository;
}

describe('torneo habilitado con caché (#147)', () => {
  it('consulta la base una sola vez y luego responde de la caché', async () => {
    const inner = settingsInner();
    const repo = new CachedTournamentSettingsRepository(inner, createTournamentSettingsCache());
    expect((await repo.get())?.totalRounds).toBe(3);
    await repo.get();
    await repo.get();
    expect(inner.get).toHaveBeenCalledTimes(1);
  });

  it('también guarda «no hay torneo», que es lo más común', async () => {
    const inner = settingsInner(null);
    const repo = new CachedTournamentSettingsRepository(inner, createTournamentSettingsCache());
    expect(await repo.get()).toBeNull();
    expect(await repo.get()).toBeNull();
    expect(inner.get).toHaveBeenCalledTimes(1);
  });

  it('las lecturas simultáneas comparten una sola consulta', async () => {
    const inner = settingsInner();
    const repo = new CachedTournamentSettingsRepository(inner, createTournamentSettingsCache());
    await Promise.all([repo.get(), repo.get(), repo.get()]);
    expect(inner.get).toHaveBeenCalledTimes(1);
  });

  it('guardar o deshabilitar descarta la caché y la siguiente lectura ve lo nuevo', async () => {
    const inner = settingsInner();
    const repo = new CachedTournamentSettingsRepository(inner, createTournamentSettingsCache());
    await repo.get();
    await repo.save(settings(7));
    expect((await repo.get())?.totalRounds).toBe(7);
    await repo.clear();
    expect(await repo.get()).toBeNull();
    expect(inner.get).toHaveBeenCalledTimes(3);
  });

  it('dos instancias con la misma caché (HTTP y sala) se descartan entre sí', async () => {
    const inner = settingsInner();
    const cache = createTournamentSettingsCache();
    const reader = new CachedTournamentSettingsRepository(inner, cache);
    const writer = new CachedTournamentSettingsRepository(inner, cache);
    await reader.get();
    await writer.save(settings(9));
    expect((await reader.get())?.totalRounds).toBe(9);
  });

  it('una lectura que empezó antes de una escritura no deja guardado el valor viejo', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const inner = settingsInner();
    inner.get.mockImplementationOnce(async () => {
      await gate;
      return settings(3);
    });
    const repo = new CachedTournamentSettingsRepository(inner, createTournamentSettingsCache());
    const slow = repo.get();
    await repo.save(settings(5));
    release();
    await slow;
    expect((await repo.get())?.totalRounds).toBe(5);
  });

  it('vence solo: pasado el tiempo vuelve a consultar', async () => {
    let now = 0;
    const inner = settingsInner();
    const repo = new CachedTournamentSettingsRepository(inner, createTournamentSettingsCache(() => now));
    await repo.get();
    now += 61_000;
    await repo.get();
    expect(inner.get).toHaveBeenCalledTimes(2);
  });
});

const item = (code: string, status: TournamentHistoryItem['status'] = 'FINISHED'): TournamentHistoryItem => ({
  code,
  name: null,
  status,
  totalRounds: 3,
  roundsStarted: 3,
  participants: 4,
  winnerName: 'Ana',
  games: ['Banderas'],
  createdAt: '2026-11-01T10:00:00.000Z',
  finishedAt: null,
});
const detailOf = (code: string, status: TournamentHistoryItem['status'] = 'FINISHED'): TournamentHistoryDetail => ({
  ...item(code, status),
  standings: [],
  kicked: [],
  rounds: [],
  insights: [],
});

function historyInner(statusByCode: Record<string, TournamentHistoryItem['status']> = {}) {
  return {
    listByCreator: vi.fn(async (creator: string) => (creator === 'admin' ? [item('AAA111', statusByCode.AAA111 ?? 'FINISHED')] : [])),
    findByCode: vi.fn(async (creator: string, code: string) => (creator === 'admin' ? detailOf(code, statusByCode[code] ?? 'FINISHED') : null)),
  } satisfies TournamentHistoryRepository;
}

describe('historial de torneos con caché (#147)', () => {
  it('la lista se consulta una vez por administrador', async () => {
    const inner = historyInner();
    const repo = new CachedTournamentHistoryRepository(inner, new TournamentHistoryCache());
    await repo.listByCreator('admin');
    await repo.listByCreator('admin');
    await repo.listByCreator('otro');
    expect(inner.listByCreator).toHaveBeenCalledTimes(2);
  });

  it('el detalle de un torneo terminado se guarda, y es por administrador: otro nunca lo recibe', async () => {
    const inner = historyInner();
    const repo = new CachedTournamentHistoryRepository(inner, new TournamentHistoryCache());
    expect((await repo.findByCode('admin', 'AAA111'))?.code).toBe('AAA111');
    await repo.findByCode('admin', 'aaa111');
    expect(inner.findByCode).toHaveBeenCalledTimes(1);
    expect(await repo.findByCode('otro', 'AAA111')).toBeNull();
    expect(await repo.findByCode('otro', 'AAA111')).toBeNull();
  });

  it('el detalle de uno en espera o en curso no se guarda: cambia con cada jugada', async () => {
    const inner = historyInner({ LIVE01: 'RUNNING', WAIT01: 'WAITING' });
    const repo = new CachedTournamentHistoryRepository(inner, new TournamentHistoryCache());
    await repo.findByCode('admin', 'LIVE01');
    await repo.findByCode('admin', 'LIVE01');
    await repo.findByCode('admin', 'WAIT01');
    await repo.findByCode('admin', 'WAIT01');
    expect(inner.findByCode).toHaveBeenCalledTimes(4);
  });

  it('invalidar descarta la lista de ese administrador y el detalle de ese torneo, y no lo de otros', async () => {
    const inner = historyInner();
    const cache = new TournamentHistoryCache();
    const repo = new CachedTournamentHistoryRepository(inner, cache);
    await repo.listByCreator('admin');
    await repo.findByCode('admin', 'AAA111');
    await repo.listByCreator('otro');
    cache.invalidate('admin', 'AAA111');
    await repo.listByCreator('admin');
    await repo.findByCode('admin', 'AAA111');
    await repo.listByCreator('otro');
    expect(inner.listByCreator).toHaveBeenCalledTimes(3);
    expect(inner.findByCode).toHaveBeenCalledTimes(2);
  });

  it('invalidar un código deja el detalle de los demás', async () => {
    const inner = historyInner();
    const cache = new TournamentHistoryCache();
    const repo = new CachedTournamentHistoryRepository(inner, cache);
    await repo.findByCode('admin', 'AAA111');
    await repo.findByCode('admin', 'BBB222');
    cache.invalidate('admin', 'bbb222');
    await repo.findByCode('admin', 'AAA111');
    await repo.findByCode('admin', 'BBB222');
    expect(inner.findByCode).toHaveBeenCalledTimes(3);
  });

  it('una lectura que empezó antes de un descarte no deja guardado el dato viejo', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const inner = historyInner();
    inner.listByCreator.mockImplementationOnce(async () => {
      await gate;
      return [item('VIEJO1')];
    });
    const cache = new TournamentHistoryCache();
    const repo = new CachedTournamentHistoryRepository(inner, cache);
    const slow = repo.listByCreator('admin');
    cache.invalidate('admin', 'VIEJO1');
    release();
    await slow;
    expect((await repo.listByCreator('admin'))[0].code).toBe('AAA111');
  });
});
