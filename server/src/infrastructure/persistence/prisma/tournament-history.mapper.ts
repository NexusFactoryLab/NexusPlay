import type {
  TournamentHistoryDetail,
  TournamentHistoryInsight,
  TournamentHistoryItem,
  TournamentHistoryRound,
  TournamentHistoryStatus,
} from '../../../domain/ports/tournament-history.repository.port.js';
import type { TournamentState } from '../../../domain/ports/tournament-store.port.js';
import { rankTournamentParticipants } from '../../../domain/services/tournament-ranking.js';

/** Una fila de `tournaments` tal como la devuelve Prisma (solo lo que el historial usa). */
export interface TournamentHistoryRow {
  code: string;
  phase: string;
  totalRounds: number;
  currentRound: number;
  createdAt: Date;
  finishedAt: Date | null;
  deletedAt: Date | null;
  snapshot: unknown;
}

/** Un fallo de una afirmación o concepto solo se señala si se intentó al menos esto. */
const MIN_ATTEMPTS_FOR_INSIGHT = 2;
const MAX_INSIGHTS = 10;
const BOT_NAME = 'Bot Nexus';

function stateOf(row: TournamentHistoryRow): Partial<TournamentState> {
  return (row.snapshot ?? {}) as Partial<TournamentState>;
}

function statusOf(row: TournamentHistoryRow): TournamentHistoryStatus {
  if (row.phase === 'FINISHED') return 'FINISHED';
  // Cerrar el torneo es un borrado lógico: si no había terminado, quedó cerrado a medias.
  if (row.deletedAt) return 'CLOSED';
  return row.phase === 'RUNNING' ? 'RUNNING' : 'WAITING';
}

export function buildHistoryItem(row: TournamentHistoryRow): TournamentHistoryItem {
  const state = stateOf(row);
  const players = (state.participants ?? []).filter((p) => !p.kicked);
  const winner = (state.participants ?? []).find((p) => p.userId === state.winnerUserId);
  const games = [...new Set((state.games ?? []).map((g) => g.title))];
  return {
    code: row.code,
    name: state.name?.trim() || null,
    status: statusOf(row),
    totalRounds: row.totalRounds,
    roundsStarted: row.currentRound,
    participants: players.length,
    winnerName: winner && !winner.kicked ? winner.displayName : null,
    games: games.length > 0 ? games : state.gameTitle ? [state.gameTitle] : [],
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function buildRounds(state: Partial<TournamentState>): TournamentHistoryRound[] {
  const participants = state.participants ?? [];
  const nameOf = (userId: string) => (userId.startsWith('bot:') ? BOT_NAME : (participants.find((p) => p.userId === userId)?.displayName ?? '—'));
  const byRound = new Map<number, NonNullable<TournamentState['matches']>>();
  for (const match of state.matches ?? []) {
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, matches]) => {
      const first = matches[0];
      return {
        round,
        game: first ? { title: first.gameTitle ?? state.gameTitle ?? '—', level: first.level ?? 'MEDIUM', gameType: first.gameType ?? 'GUESS_WHO' } : null,
        results: matches
          .filter((match) => !match.isBye)
          .map((match) => {
            if (match.gameType === 'TRUE_FALSE_MAZE') {
              const who = nameOf(match.playerUserIds[0] ?? '');
              return `${who} (solo) — ${match.winnerUserId ? 'todo bien' : match.phase === 'FINISHED' ? 'sin punto' : 'en curso'}`;
            }
            const versus = match.playerUserIds.map(nameOf).join(' vs ');
            const outcome = match.winnerUserId ? `ganó ${nameOf(match.winnerUserId)}` : match.phase === 'FINISHED' ? 'sin ganador' : 'en curso';
            return `${versus} — ${outcome}`;
          }),
      };
    });
}

function buildInsights(state: Partial<TournamentState>): TournamentHistoryInsight[] {
  return Object.values(state.insights ?? {})
    .filter((item) => item.attempts >= MIN_ATTEMPTS_FOR_INSIGHT && item.misses > 0)
    .map((item) => ({ kind: item.kind, label: item.label, attempts: item.attempts, misses: item.misses, missRate: item.misses / item.attempts }))
    .sort((a, b) => b.missRate - a.missRate || b.attempts - a.attempts || a.label.localeCompare(b.label, 'es'))
    .slice(0, MAX_INSIGHTS);
}

export function buildHistoryDetail(row: TournamentHistoryRow): TournamentHistoryDetail {
  const state = stateOf(row);
  const participants = state.participants ?? [];
  const ranked = rankTournamentParticipants(participants.filter((p) => !p.kicked));
  return {
    ...buildHistoryItem(row),
    standings: ranked.map((p, index) => ({
      position: index + 1,
      name: p.displayName,
      points: p.points,
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      correctAnswers: p.correctAnswers ?? 0,
      wrongAccusations: p.wrongAccusations ?? 0,
    })),
    kicked: participants.filter((p) => p.kicked).map((p) => p.displayName),
    rounds: buildRounds(state),
    insights: buildInsights(state),
  };
}
