import { DUO_LEVEL_DEFS, duoLevel } from './shared/levels/index.js';
import { MIRROR_ANGLES, TILE, mirrorRect, type DuoGateDef, type DuoLevel } from './shared/duoLevel.js';
import {
  coinsForGate,
  collectCoins,
  collectGems,
  createWorldState,
  gateWithBothOnPedestals,
  scaleSideOf,
  updateFlags,
  updateKeys,
  updateScales,
  updateSwitches,
} from './shared/duoWorld.js';
import { stepHeavyCrates } from './shared/duoPhysics.js';
import {
  DUO_EMOTES,
  DUO_ROLES,
  otherRole,
  type DuoAnim,
  type DuoClientState,
  type DuoEmote,
  type DuoPeerState,
  type DuoPlayerNet,
  type DuoRole,
  type DuoSnapshot,
  type DuoWorldState,
} from './shared/duoTypes.js';
import type { DuoNotice, DuoPhase, DuoQuestionView, DuoRevealView, DuoRoomView } from './shared/duoProtocol.js';
import { optionsFor, questionsOf, type DuoQuestion } from './duo-questions.js';

/**
 * Reglas de una sala de Dúo Lógico, sin sockets: el gateway llama estas
 * funciones y reparte lo que devuelven. Así se prueban con un reloj falso.
 *
 * Reparto de autoridad: cada jugador mueve a su personaje en su navegador (se
 * siente inmediato) y manda su posición; el servidor decide todo lo demás —
 * botones, palancas, fichas, cajas, pedestales, preguntas y corazones.
 */

export const DUO_MAX_HEARTS = 3;
export const DUO_COUNTDOWN_MS = 3_000;
export const DUO_REVEAL_SUCCESS_MS = 5_000;
export const DUO_REVEAL_FAIL_MS = 3_500;
/** Cuánto se espera a que vuelva un jugador que se desconectó en plena partida. */
export const DUO_RECONNECT_GRACE_MS = 90_000;
/** Una caja deja de ser de alguien si no la mueve en este tiempo. */
export const DUO_CRATE_LEASE_MS = 400;

export function levelById(id: string): DuoLevel {
  return duoLevel(id);
}

export interface DuoRoomPlayer {
  userId: string;
  displayName: string;
  socketId: string | null;
  role: DuoRole;
  ready: boolean;
  state: DuoPlayerNet | null;
  /** Hora en que llegó `state`. */
  stateAt?: number;
}

interface ActiveQuestion {
  gate: DuoGateDef;
  question: DuoQuestion;
  /** Orden en que ve las opciones cada rol: order[i] = índice original. */
  order: Record<DuoRole, number[]>;
  answers: Partial<Record<DuoRole, number>>;
  attempt: number;
  hintsRevealed: number;
}

interface Reveal {
  gateId: string;
  success: boolean;
  picked: Record<DuoRole, { option: string; correct: boolean }>;
  explanation: string | null;
  final: boolean;
}

export interface DuoRoomState {
  code: string;
  gameId: string;
  gameTitle: string;
  levelId: string;
  /** Escenarios que eligió el profesor, en el orden en que se juegan. */
  campaign: string[];
  /** Preguntas que escribió el profesor; si un escenario no tiene, se usa el banco. */
  customQuestions: DuoQuestion[];
  hostUserId: string;
  phase: DuoPhase;
  runId: number;
  players: DuoRoomPlayer[];
  world: DuoWorldState;
  hearts: number;
  countdownEndsAt: number | null;
  question: ActiveQuestion | null;
  reveal: Reveal | null;
  revealEndsAt: number | null;
  waitingPartnerUntil: number | null;
  crateLeases: Record<string, number>;
  /** Velocidad de caída de cada caja de metal (las mueve el servidor). */
  heavyFall: Record<string, number>;
  /** Hora del último tick en juego (para el paso de las cajas de metal y las básculas). */
  lastTickAt: number | null;
  usedQuestionIds: string[];
  retryVotes: DuoRole[];
  startedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
}

const IN_GAME: readonly DuoPhase[] = ['COUNTDOWN', 'PLAYING', 'QUESTION', 'REVEAL'];

export function isInGame(room: DuoRoomState): boolean {
  return IN_GAME.includes(room.phase);
}

export function createDuoRoom(input: {
  code: string;
  gameId: string;
  gameTitle: string;
  user: { userId: string; displayName: string; socketId: string };
  role: DuoRole;
  now: number;
  /** Escenarios del juego; por defecto, todos. */
  campaign?: string[];
  customQuestions?: DuoQuestion[];
}): DuoRoomState {
  const campaign = input.campaign && input.campaign.length > 0 ? input.campaign : DUO_LEVEL_DEFS.map((def) => def.id);
  const level = levelById(campaign[0]);
  return {
    code: input.code,
    gameId: input.gameId,
    gameTitle: input.gameTitle,
    levelId: level.def.id,
    campaign,
    customQuestions: input.customQuestions ?? [],
    hostUserId: input.user.userId,
    phase: 'WAITING',
    runId: 0,
    players: [{ ...input.user, role: input.role, ready: false, state: null }],
    world: createWorldState(level),
    hearts: DUO_MAX_HEARTS,
    countdownEndsAt: null,
    question: null,
    reveal: null,
    revealEndsAt: null,
    waitingPartnerUntil: null,
    crateLeases: {},
    heavyFall: {},
    lastTickAt: null,
    usedQuestionIds: [],
    retryVotes: [],
    startedAt: null,
    finishedAt: null,
    createdAt: input.now,
  };
}

function playerOf(room: DuoRoomState, userId: string): DuoRoomPlayer {
  const player = room.players.find((p) => p.userId === userId);
  if (!player) throw new Error('No estás en esta sala.');
  return player;
}

/** Entra a la sala o vuelve a ella (mismo usuario, conexión nueva). */
export function joinDuoRoom(room: DuoRoomState, user: { userId: string; displayName: string; socketId: string }): DuoRoomPlayer {
  const existing = room.players.find((p) => p.userId === user.userId);
  if (existing) {
    existing.socketId = user.socketId;
    if (room.phase === 'WAITING') existing.ready = false;
    if (room.players.every((p) => p.socketId)) room.waitingPartnerUntil = null;
    return existing;
  }
  if (room.phase !== 'WAITING') throw new Error('La partida ya empezó.');
  if (room.players.length >= 2) throw new Error('La sala ya está llena.');
  const player: DuoRoomPlayer = { ...user, role: otherRole(room.players[0].role), ready: false, state: null };
  room.players.push(player);
  return player;
}

/** Cambia de personaje en la sala de espera (solo si el otro está libre). */
export function chooseRole(room: DuoRoomState, userId: string, role: DuoRole): void {
  if (room.phase !== 'WAITING') throw new Error('Ya no se puede cambiar de personaje.');
  if (!DUO_ROLES.includes(role)) throw new Error('Ese personaje no existe.');
  const player = playerOf(room, userId);
  const other = room.players.find((p) => p.userId !== userId);
  if (other) {
    // Con dos jugadores, cambiar es intercambiar: nunca dos del mismo.
    if (player.role === role) return;
    other.role = player.role;
    other.ready = false;
  }
  player.role = role;
  player.ready = false;
}

/** Se cayó la conexión. Devuelve true si la sala quedó vacía (hay que borrarla). */
export function disconnectDuoPlayer(room: DuoRoomState, socketId: string, now: number): boolean {
  const player = room.players.find((p) => p.socketId === socketId);
  if (!player) return false;
  if (room.phase === 'WAITING' || room.phase === 'VICTORY' || room.phase === 'DEFEAT' || room.phase === 'ABANDONED') {
    room.players = room.players.filter((p) => p !== player);
    for (const p of room.players) p.ready = false;
    if (room.players.length > 0 && !room.players.some((p) => p.userId === room.hostUserId)) room.hostUserId = room.players[0].userId;
    room.retryVotes = [];
    return room.players.length === 0;
  }
  // En plena partida se le guarda el puesto un rato.
  player.socketId = null;
  room.waitingPartnerUntil = now + DUO_RECONNECT_GRACE_MS;
  return room.players.every((p) => !p.socketId);
}

/** Salida voluntaria: deja la sala de inmediato. */
export function leaveDuoRoom(room: DuoRoomState, userId: string, now: number): boolean {
  const player = room.players.find((p) => p.userId === userId);
  if (!player) return room.players.length === 0;
  room.players = room.players.filter((p) => p !== player);
  if (room.players.length === 0) return true;
  if (isInGame(room)) {
    room.phase = 'ABANDONED';
    room.finishedAt = now;
  } else {
    for (const p of room.players) p.ready = false;
  }
  if (!room.players.some((p) => p.userId === room.hostUserId)) room.hostUserId = room.players[0].userId;
  return false;
}

/** El anfitrión elige en la sala de espera desde qué escenario empiezan. */
export function chooseDuoLevel(room: DuoRoomState, userId: string, levelId: unknown): void {
  if (room.phase !== 'WAITING') throw new Error('Ya no se puede cambiar de escenario.');
  if (room.hostUserId !== userId) throw new Error('Solo quien creó la sala elige el escenario.');
  if (typeof levelId !== 'string' || !room.campaign.includes(levelId)) throw new Error('Ese escenario no está en este juego.');
  room.levelId = levelId;
  room.world = createWorldState(levelById(levelId));
  for (const p of room.players) p.ready = false;
}

export function setDuoReady(room: DuoRoomState, userId: string, ready: boolean, now: number): void {
  if (room.phase !== 'WAITING') return;
  if (typeof ready !== 'boolean') throw new Error('Indica si estás listo.');
  playerOf(room, userId).ready = ready;
  if (room.players.length === 2 && room.players.every((p) => p.ready && p.socketId)) startRun(room, now);
}

function startRun(room: DuoRoomState, now: number): void {
  const level = levelById(room.levelId);
  room.runId += 1;
  room.phase = 'COUNTDOWN';
  room.countdownEndsAt = now + DUO_COUNTDOWN_MS;
  room.world = createWorldState(level);
  room.hearts = DUO_MAX_HEARTS;
  room.question = null;
  room.reveal = null;
  room.revealEndsAt = null;
  room.crateLeases = {};
  room.heavyFall = {};
  room.lastTickAt = null;
  room.usedQuestionIds = [];
  room.retryVotes = [];
  room.startedAt = null;
  room.finishedAt = null;
  for (const p of room.players) p.state = null;
}

const ANIMS: readonly DuoAnim[] = ['idle', 'walk', 'rise', 'peak', 'fall', 'push', 'swim', 'cheer', 'hurt'];

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Posición que manda un jugador. Se ignora fuera del juego activo o si viene
 * mal formada. Devuelve lo aceptado, para reenviárselo al compañero en el acto.
 */
export function applyClientState(room: DuoRoomState, userId: string, state: DuoClientState, now: number): DuoPeerState | null {
  if (room.phase !== 'PLAYING' || room.waitingPartnerUntil) return null;
  const player = room.players.find((p) => p.userId === userId);
  if (!player || !state || typeof state !== 'object') return null;
  const level = levelById(room.levelId);
  const s = state.player;
  if (!s || !finite(s.x) || !finite(s.y) || !finite(s.vx) || !finite(s.vy)) return null;
  player.state = {
    x: Math.max(0, Math.min(level.widthPx, s.x)),
    y: Math.max(-200, Math.min(level.heightPx + 300, s.y)),
    vx: Math.max(-2000, Math.min(2000, s.vx)),
    vy: Math.max(-2000, Math.min(2000, s.vy)),
    facing: s.facing === -1 ? -1 : 1,
    anim: ANIMS.includes(s.anim) ? s.anim : 'idle',
    dead: s.dead === true,
  };
  const riding = s.mover && typeof s.mover === 'object' ? s.mover : null;
  if (riding && typeof riding.id === 'string' && finite(riding.dx)) {
    // Plataforma móvil o un lado de báscula que existan en el escenario.
    const mover = level.def.movers?.find((m) => m.id === riding.id);
    const side = scaleSideOf(level, riding.id);
    const width = mover ? mover.width : side ? side.scale[side.side].width : null;
    if (width !== null) player.state.mover = { id: riding.id, dx: Math.max(-TILE, Math.min((width + 1) * TILE, riding.dx)) };
  }
  player.stateAt = now;
  const peer: DuoPeerState = { role: player.role, at: now, player: player.state, crates: [] };
  if (!Array.isArray(state.crates)) return peer;
  for (const update of state.crates.slice(0, room.world.crates.length)) {
    const crate = room.world.crates.find((c) => c.id === update?.id);
    if (!crate || !finite(update.x) || !finite(update.y)) continue;
    // La caja de metal la mueve el servidor (cuando la empujan los dos).
    if (level.def.crates.find((c) => c.id === crate.id)?.heavy) continue;
    const leaseOver = (room.crateLeases[crate.id] ?? 0) < now;
    if (crate.owner && crate.owner !== player.role && !leaseOver) continue;
    crate.x = Math.max(0, Math.min(level.widthPx, update.x));
    crate.y = Math.max(-200, Math.min(level.heightPx, update.y));
    crate.owner = player.role;
    crate.at = now;
    room.crateLeases[crate.id] = now + DUO_CRATE_LEASE_MS;
    peer.crates.push({ id: crate.id, x: crate.x, y: crate.y });
  }
  return peer;
}

function shuffled(n: number, rng: () => number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function pickQuestion(room: DuoRoomState, rng: () => number): DuoQuestion {
  const custom = room.customQuestions.filter((q) => q.level === room.levelId);
  const pool = custom.length > 0 ? custom : questionsOf(room.levelId);
  const fresh = pool.filter((q) => !room.usedQuestionIds.includes(q.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(rng() * from.length)];
}

function shuffleOptions(active: ActiveQuestion, rng: () => number): void {
  for (const role of DUO_ROLES) active.order[role] = shuffled(optionsFor(active.question, role).length, rng);
  active.answers = {};
}

function startQuestion(room: DuoRoomState, gate: DuoGateDef, rng: () => number): void {
  const level = levelById(room.levelId);
  const question = pickQuestion(room, rng);
  room.usedQuestionIds.push(question.id);
  const active: ActiveQuestion = {
    gate,
    question,
    order: { FIRE: [], WATER: [] },
    answers: {},
    attempt: 1,
    hintsRevealed: Math.min(question.hints.length, coinsForGate(level, room.world, gate.id)),
  };
  shuffleOptions(active, rng);
  room.question = active;
  room.phase = 'QUESTION';
}

/** Respuesta secreta de un jugador; cuando responden los dos, se revela. */
export function answerDuoQuestion(room: DuoRoomState, userId: string, optionIndex: number, now: number): void {
  const active = room.question;
  if (room.phase !== 'QUESTION' || !active) throw new Error('No hay una pregunta abierta.');
  const player = playerOf(room, userId);
  const options = optionsFor(active.question, player.role);
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) throw new Error('Esa opción no existe.');
  if (active.answers[player.role] !== undefined) return; // ya respondió: no se cambia
  active.answers[player.role] = optionIndex;
  if (active.answers.FIRE === undefined || active.answers.WATER === undefined) return;

  const picked = {} as Reveal['picked'];
  for (const role of DUO_ROLES) {
    const original = active.order[role][active.answers[role] as number];
    picked[role] = { option: optionsFor(active.question, role)[original], correct: original === 0 };
  }
  const success = picked.FIRE.correct && picked.WATER.correct;
  if (!success) room.hearts = Math.max(0, room.hearts - 1);
  room.reveal = {
    gateId: active.gate.id,
    success,
    picked,
    explanation: success ? active.question.explanation : null,
    final: !!active.gate.portal,
  };
  room.phase = 'REVEAL';
  room.revealEndsAt = now + (success ? DUO_REVEAL_SUCCESS_MS : DUO_REVEAL_FAIL_MS);
}

/**
 * Avanza la sala un instante: cuenta regresiva, interruptores, fichas,
 * pedestales y fin del revelado. Devuelve los avisos para repartir.
 */
export function tickDuoRoom(room: DuoRoomState, now: number, rng: () => number = Math.random): DuoNotice[] {
  const notices: DuoNotice[] = [];
  if (room.waitingPartnerUntil) {
    if (now >= room.waitingPartnerUntil) {
      room.phase = 'ABANDONED';
      room.finishedAt = now;
      room.waitingPartnerUntil = null;
    }
    return notices;
  }
  const level = levelById(room.levelId);

  if (room.phase === 'COUNTDOWN' && room.countdownEndsAt !== null && now >= room.countdownEndsAt) {
    room.phase = 'PLAYING';
    room.countdownEndsAt = null;
    room.startedAt = now;
  }

  if (room.phase === 'PLAYING') {
    const dt = room.lastTickAt === null ? 0 : Math.min(0.1, Math.max(0, (now - room.lastTickAt) / 1000));
    room.lastTickAt = now;
    for (const crate of room.world.crates) {
      if (crate.owner && (room.crateLeases[crate.id] ?? 0) < now) crate.owner = null;
    }
    const bodies: Partial<Record<DuoRole, DuoPlayerNet>> = {};
    for (const p of room.players) if (p.state) bodies[p.role] = p.state;
    stepHeavyCrates(level, room.world, bodies, dt, now / 1000, room.heavyFall);
    updateScales(level, room.world, bodies, dt);
    updateSwitches(level, room.world, bodies);
    for (const coin of collectCoins(level, room.world, bodies)) {
      const def = level.def.coins.find((c) => c.id === coin.id);
      notices.push({ kind: 'coin', by: coin.by, hintsForGate: def ? coinsForGate(level, room.world, def.gate) : 0 });
    }
    for (const gem of collectGems(level, room.world, bodies)) notices.push({ kind: 'gem', by: gem.by });
    for (const event of updateKeys(level, room.world, bodies)) {
      if (event.kind === 'key-taken') notices.push({ kind: 'key', by: event.by });
      else if (event.kind === 'lock-opened') notices.push({ kind: 'lock', by: event.by });
      else notices.push({ kind: 'key-lost' });
    }
    if (updateFlags(level, room.world, bodies).length > 0) notices.push({ kind: 'flag' });
    const gate = gateWithBothOnPedestals(level, room.world, bodies);
    if (gate) startQuestion(room, gate, rng);
  } else {
    room.lastTickAt = null;
  }

  if (room.phase === 'REVEAL' && room.revealEndsAt !== null && now >= room.revealEndsAt && room.reveal && room.question) {
    const { success, gateId, final } = room.reveal;
    room.revealEndsAt = null;
    room.reveal = null;
    if (success) {
      room.world.gates[gateId] = true;
      room.question = null;
      if (final) {
        room.phase = 'VICTORY';
        room.finishedAt = now;
      } else {
        room.phase = 'PLAYING';
        notices.push({ kind: 'gate-opened', gateId });
      }
    } else if (room.hearts <= 0) {
      room.phase = 'DEFEAT';
      room.finishedAt = now;
      room.question = null;
    } else {
      room.question.attempt += 1;
      shuffleOptions(room.question, rng);
      room.phase = 'QUESTION';
    }
  }
  return notices;
}

/** Al terminar (victoria o derrota) los dos votan para jugar de nuevo. */
export function voteDuoRetry(room: DuoRoomState, userId: string, now: number): void {
  if (room.phase !== 'VICTORY' && room.phase !== 'DEFEAT') throw new Error('La partida no ha terminado.');
  const role = playerOf(room, userId).role;
  if (!room.retryVotes.includes(role)) room.retryVotes.push(role);
  if (room.players.length !== 2 || !room.players.every((p) => room.retryVotes.includes(p.role) && p.socketId)) return;
  // Tras ganar se pasa al siguiente escenario (o, al final de la campaña, de vuelta al primero).
  if (room.phase === 'VICTORY') room.levelId = nextInCampaign(room) ?? room.campaign[0];
  startRun(room, now);
}

/** El escenario que sigue en la campaña de este juego, o null si es el último. */
function nextInCampaign(room: DuoRoomState): string | null {
  return room.campaign[room.campaign.indexOf(room.levelId) + 1] ?? null;
}

/** Distancia máxima (px) entre el personaje y el espejo para poder girarlo. */
export const MIRROR_REACH = 80;

/**
 * Gira un espejo desde su panel (flechas). Solo quien está junto a él, en
 * plena partida y sin estar apagado; `dir` es 1 (derecha) o -1 (izquierda).
 */
export function rotateDuoMirror(room: DuoRoomState, userId: string, mirrorId: unknown, dir: unknown): void {
  if (room.phase !== 'PLAYING' || room.waitingPartnerUntil) throw new Error('Ahora no se pueden girar los espejos.');
  const level = levelById(room.levelId);
  const mirror = (level.def.mirrors ?? []).find((m) => m.id === mirrorId);
  if (!mirror) throw new Error('Ese espejo no existe.');
  if (dir !== 1 && dir !== -1) throw new Error('Gira el espejo a la izquierda o a la derecha.');
  const player = playerOf(room, userId);
  const state = player.state;
  if (!state || state.dead) throw new Error('Acércate al espejo para girarlo.');
  const rect = mirrorRect(mirror);
  const dx = Math.max(rect.x - state.x, 0, state.x - (rect.x + rect.w));
  const dy = Math.max(rect.y - state.y, 0, state.y - (rect.y + rect.h));
  if (dx > MIRROR_REACH || dy > MIRROR_REACH) throw new Error('Acércate al espejo para girarlo.');
  room.world.mirrors[mirror.id] = ((room.world.mirrors[mirror.id] ?? 0) + dir + MIRROR_ANGLES) % MIRROR_ANGLES;
}

export function validEmote(emote: unknown): emote is DuoEmote {
  return typeof emote === 'string' && (DUO_EMOTES as readonly string[]).includes(emote);
}

// ---------- Vistas ----------

function questionView(room: DuoRoomState, role: DuoRole): DuoQuestionView | null {
  const active = room.question;
  if (!active || (room.phase !== 'QUESTION' && room.phase !== 'REVEAL')) return null;
  const q = active.question;
  const all = optionsFor(q, role);
  return {
    gateId: active.gate.id,
    concept: q.concept,
    prompt: q.parts[role].prompt,
    options: active.order[role].map((i) => all[i]),
    hints: q.hints.slice(0, active.hintsRevealed),
    hintsTotal: q.hints.length,
    myAnswer: active.answers[role] ?? null,
    partnerAnswered: active.answers[otherRole(role)] !== undefined,
    attempt: active.attempt,
  };
}

function revealView(room: DuoRoomState, role: DuoRole): DuoRevealView | null {
  const r = room.reveal;
  if (!r) return null;
  return {
    gateId: r.gateId,
    success: r.success,
    mine: r.picked[role],
    partner: r.picked[otherRole(role)],
    explanation: r.explanation,
    final: r.final,
  };
}

export function toDuoRoomView(room: DuoRoomState, userId: string, now: number): DuoRoomView {
  const level = levelById(room.levelId);
  const me = room.players.find((p) => p.userId === userId);
  return {
    code: room.code,
    gameId: room.gameId,
    gameTitle: room.gameTitle,
    levelId: room.levelId,
    levelTitle: level.def.title,
    levels: room.campaign.map((id) => levelById(id).def).map((def) => ({ id: def.id, title: def.title, tagline: def.tagline })),
    nextLevelTitle: (() => {
      const next = nextInCampaign(room);
      return next ? levelById(next).def.title : null;
    })(),
    hostUserId: room.hostUserId,
    phase: room.phase,
    runId: room.runId,
    you: me?.role ?? null,
    players: room.players.map((p) => ({ userId: p.userId, displayName: p.displayName, role: p.role, ready: p.ready, connected: !!p.socketId })),
    hearts: room.hearts,
    maxHearts: DUO_MAX_HEARTS,
    countdownEndsAt: room.countdownEndsAt,
    serverNow: now,
    question: me ? questionView(room, me.role) : null,
    reveal: me ? revealView(room, me.role) : null,
    revealEndsAt: room.revealEndsAt,
    waitingPartnerUntil: room.waitingPartnerUntil,
    gatesOpened: Object.values(room.world.gates).filter(Boolean).length,
    gatesTotal: level.def.gates.length,
    coinsCollected: Object.keys(room.world.coins).length,
    coinsTotal: level.def.coins.length,
    gemsCollected: Object.keys(room.world.gems).length,
    gemsTotal: level.def.gems?.length ?? 0,
    retryVotes: room.retryVotes,
    startedAt: room.startedAt,
    finishedAt: room.finishedAt,
  };
}

export function toDuoSnapshot(room: DuoRoomState, now: number): DuoSnapshot {
  const players: DuoSnapshot['players'] = {};
  const at: DuoSnapshot['at'] = {};
  for (const p of room.players) {
    if (!p.state) continue;
    players[p.role] = p.state;
    at[p.role] = p.stateAt ?? now;
  }
  return { t: now, players, at, world: room.world };
}
