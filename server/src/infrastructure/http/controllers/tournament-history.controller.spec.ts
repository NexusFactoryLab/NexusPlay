import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { TournamentHistoryDetail, TournamentHistoryItem, TournamentHistoryRepository } from '../../../domain/ports/tournament-history.repository.port.js';
import { GetTournamentHistoryUseCase, ListTournamentHistoryUseCase } from '../../../application/use-cases/tournament-history.use-cases.js';
import { TournamentHistoryController } from './tournament-history.controller.js';

const item = (code: string): TournamentHistoryItem => ({
  code,
  status: 'FINISHED',
  totalRounds: 3,
  roundsStarted: 3,
  participants: 4,
  winnerName: 'Ana',
  games: ['Banderas'],
  createdAt: '2026-10-31T15:00:00.000Z',
  finishedAt: null,
});

/** Repositorio de prueba con dos administradores: cada uno solo debe ver lo suyo. */
function fakeRepository(): TournamentHistoryRepository & { calls: string[] } {
  const owners: Record<string, string> = { AAA111: 'admin-1', BBB222: 'admin-2' };
  const calls: string[] = [];
  return {
    calls,
    async listByCreator(creator) {
      calls.push(`list:${creator}`);
      return Object.entries(owners).filter(([, owner]) => owner === creator).map(([code]) => item(code));
    },
    async findByCode(creator, code) {
      calls.push(`find:${creator}:${code}`);
      if (owners[code] !== creator) return null;
      return { ...item(code), standings: [], kicked: [], rounds: [], insights: [] } satisfies TournamentHistoryDetail;
    },
  };
}

function controller() {
  const repo = fakeRepository();
  return { repo, controller: new TournamentHistoryController(new ListTournamentHistoryUseCase(repo), new GetTournamentHistoryUseCase(repo)) };
}

describe('TournamentHistoryController (#147)', () => {
  it('lista solo los torneos de quien lo pide', async () => {
    const { controller: c } = controller();
    expect((await c.list('admin-1')).map((t) => t.code)).toEqual(['AAA111']);
    expect((await c.list('admin-2')).map((t) => t.code)).toEqual(['BBB222']);
    expect(await c.list('otra-persona')).toEqual([]);
  });

  it('entrega el detalle de un torneo propio', async () => {
    const { controller: c } = controller();
    expect((await c.get('admin-1', 'AAA111')).code).toBe('AAA111');
  });

  it('un torneo ajeno o inexistente es un 404 igual, para no revelar que existe', async () => {
    const { controller: c } = controller();
    await expect(c.get('admin-1', 'BBB222')).rejects.toBeInstanceOf(NotFoundException);
    await expect(c.get('admin-1', 'ZZZ999')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el filtro por creador llega siempre al repositorio, con el usuario de la sesión', async () => {
    const { controller: c, repo } = controller();
    await c.list('admin-1');
    await c.get('admin-1', 'AAA111');
    expect(repo.calls).toEqual(['list:admin-1', 'find:admin-1:AAA111']);
  });
});
