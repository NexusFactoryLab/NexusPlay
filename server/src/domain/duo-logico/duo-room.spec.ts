import { describe, expect, it } from 'vitest';
import {
  DUO_COUNTDOWN_MS,
  DUO_CRATE_LEASE_MS,
  DUO_RECONNECT_GRACE_MS,
  DUO_REVEAL_FAIL_MS,
  DUO_REVEAL_SUCCESS_MS,
  answerDuoQuestion,
  applyClientState,
  chooseRole,
  createDuoRoom,
  disconnectDuoPlayer,
  joinDuoRoom,
  setDuoReady,
  tickDuoRoom,
  toDuoRoomView,
  voteDuoRetry,
  type DuoRoomState,
} from './duo-room.js';
import { DUO_QUESTION_BANK, optionsFor } from './duo-questions.js';
import { standPoint } from './shared/duoLevel.js';
import { BOSQUE } from './shared/levels/bosque.js';
import { pedestalRect } from './shared/duoLevel.js';
import type { DuoPlayerNet, DuoRole } from './shared/duoTypes.js';

const ANA = { userId: 'ana', displayName: 'Ana', socketId: 's-ana' };
const LUIS = { userId: 'luis', displayName: 'Luis', socketId: 's-luis' };
const rng = () => 0.42;

function body(x: number, y: number): DuoPlayerNet {
  return { x, y, vx: 0, vy: 0, facing: 1, anim: 'idle', dead: false };
}

function playingRoom(): { room: DuoRoomState; now: number } {
  const room = createDuoRoom({ code: 'ABC123', gameId: 'g1', gameTitle: 'Bosque', user: ANA, role: 'FIRE', now: 0 });
  joinDuoRoom(room, LUIS);
  setDuoReady(room, 'ana', true, 0);
  setDuoReady(room, 'luis', true, 0);
  tickDuoRoom(room, DUO_COUNTDOWN_MS, rng);
  return { room, now: DUO_COUNTDOWN_MS };
}

function onPedestal(gateIndex: number, role: DuoRole): DuoPlayerNet {
  const top = pedestalRect(BOSQUE.gates[gateIndex].pedestals[role]);
  return body(top.x + top.w / 2, top.y);
}

/** Lleva a los dos a sus pedestales de la puerta indicada y abre la pregunta. */
function reachGate(room: DuoRoomState, gateIndex: number, now: number) {
  applyClientState(room, 'ana', { player: onPedestal(gateIndex, 'FIRE'), crates: [] }, now);
  applyClientState(room, 'luis', { player: onPedestal(gateIndex, 'WATER'), crates: [] }, now);
  tickDuoRoom(room, now, rng);
}

/** Índice (en la vista barajada del jugador) de la opción correcta o de una incorrecta. */
function pick(room: DuoRoomState, userId: string, correct: boolean): number {
  const view = toDuoRoomView(room, userId, 0).question!;
  const role = room.players.find((p) => p.userId === userId)!.role;
  const right = optionsFor(room.question!.question, role)[0];
  return view.options.findIndex((o) => (o === right) === correct);
}

describe('sala de Dúo Lógico', () => {
  it('el segundo jugador recibe el personaje que falta y pueden intercambiarlo', () => {
    const room = createDuoRoom({ code: 'X', gameId: 'g', gameTitle: 't', user: ANA, role: 'WATER', now: 0 });
    expect(joinDuoRoom(room, LUIS).role).toBe('FIRE');
    chooseRole(room, 'luis', 'WATER');
    expect(room.players.map((p) => p.role)).toEqual(['FIRE', 'WATER']);
    expect(() => joinDuoRoom(room, { userId: 'eva', displayName: 'Eva', socketId: 's-eva' })).toThrow('llena');
  });

  it('arranca con cuenta regresiva cuando los dos están listos', () => {
    const room = createDuoRoom({ code: 'X', gameId: 'g', gameTitle: 't', user: ANA, role: 'FIRE', now: 0 });
    setDuoReady(room, 'ana', true, 0);
    expect(room.phase).toBe('WAITING');
    joinDuoRoom(room, LUIS);
    setDuoReady(room, 'luis', true, 100);
    expect(room.phase).toBe('COUNTDOWN');
    tickDuoRoom(room, 100 + DUO_COUNTDOWN_MS - 1, rng);
    expect(room.phase).toBe('COUNTDOWN');
    tickDuoRoom(room, 100 + DUO_COUNTDOWN_MS, rng);
    expect(room.phase).toBe('PLAYING');
    expect(room.runId).toBe(1);
  });

  it('el servidor activa el botón que pisa un jugador y recoge las fichas', () => {
    const { room, now } = playingRoom();
    const button = standPoint(BOSQUE.buttons[0]);
    applyClientState(room, 'ana', { player: body(button.x, button.y), crates: [] }, now);
    const coin = BOSQUE.coins[0];
    applyClientState(room, 'luis', { player: body(coin.col * 64 + 32, coin.row * 64 + 50), crates: [] }, now);
    const notices = tickDuoRoom(room, now, rng);
    expect(room.world.switches['boton-orilla']).toBe(true);
    expect(room.world.coins['ficha-puente']).toBe('WATER');
    expect(notices).toContainEqual({ kind: 'coin', by: 'WATER', hintsForGate: 1 });
  });

  it('cada pedestal es de su dueño: cambiados no abren la pregunta', () => {
    const { room, now } = playingRoom();
    applyClientState(room, 'ana', { player: onPedestal(0, 'WATER'), crates: [] }, now);
    applyClientState(room, 'luis', { player: onPedestal(0, 'FIRE'), crates: [] }, now);
    tickDuoRoom(room, now, rng);
    expect(room.phase).toBe('PLAYING');
    reachGate(room, 0, now);
    expect(room.phase).toBe('QUESTION');
    expect(room.question?.question.format).toBe('MIRROR');
  });

  it('la respuesta es secreta: el compañero solo sabe que ya respondiste', () => {
    const { room, now } = playingRoom();
    reachGate(room, 0, now);
    answerDuoQuestion(room, 'ana', pick(room, 'ana', true), now);
    const luisView = toDuoRoomView(room, 'luis', now);
    expect(luisView.question?.partnerAnswered).toBe(true);
    expect(luisView.question?.myAnswer).toBeNull();
    expect(room.phase).toBe('QUESTION');
    // Nadie recibe cuál es la correcta.
    const anaView = toDuoRoomView(room, 'ana', now);
    expect(JSON.stringify(anaView)).not.toContain('correct');
  });

  it('si los dos aciertan se abre la puerta y siguen jugando', () => {
    const { room, now } = playingRoom();
    reachGate(room, 0, now);
    answerDuoQuestion(room, 'ana', pick(room, 'ana', true), now);
    answerDuoQuestion(room, 'luis', pick(room, 'luis', true), now);
    expect(room.phase).toBe('REVEAL');
    expect(toDuoRoomView(room, 'ana', now).reveal).toMatchObject({ success: true, mine: { correct: true }, partner: { correct: true } });
    expect(toDuoRoomView(room, 'ana', now).reveal?.explanation).toBeTruthy();
    const notices = tickDuoRoom(room, now + DUO_REVEAL_SUCCESS_MS, rng);
    expect(room.phase).toBe('PLAYING');
    expect(room.world.gates['puerta-1']).toBe(true);
    expect(room.hearts).toBe(3);
    expect(notices).toContainEqual({ kind: 'gate-opened', gateId: 'puerta-1' });
  });

  it('si uno falla pierden un corazón y vuelven a intentar con las opciones barajadas', () => {
    const { room, now } = playingRoom();
    reachGate(room, 0, now);
    answerDuoQuestion(room, 'ana', pick(room, 'ana', true), now);
    answerDuoQuestion(room, 'luis', pick(room, 'luis', false), now);
    expect(room.hearts).toBe(2);
    const reveal = toDuoRoomView(room, 'ana', now).reveal;
    expect(reveal).toMatchObject({ success: false, mine: { correct: true }, partner: { correct: false }, explanation: null });
    tickDuoRoom(room, now + DUO_REVEAL_FAIL_MS, () => 0.9);
    expect(room.phase).toBe('QUESTION');
    expect(room.question?.attempt).toBe(2);
    expect(toDuoRoomView(room, 'ana', now).question?.myAnswer).toBeNull();
  });

  it('sin corazones termina en derrota y pueden volver a jugar si los dos votan', () => {
    const { room, now } = playingRoom();
    reachGate(room, 0, now);
    let t = now;
    for (let i = 0; i < 3; i++) {
      answerDuoQuestion(room, 'ana', pick(room, 'ana', false), t);
      answerDuoQuestion(room, 'luis', pick(room, 'luis', false), t);
      t += DUO_REVEAL_FAIL_MS;
      tickDuoRoom(room, t, rng);
    }
    expect(room.phase).toBe('DEFEAT');
    voteDuoRetry(room, 'ana', t);
    expect(room.phase).toBe('DEFEAT');
    voteDuoRetry(room, 'luis', t);
    expect(room.phase).toBe('COUNTDOWN');
    expect(room.hearts).toBe(3);
    expect(room.runId).toBe(2);
    expect(room.world.gates).toEqual({});
  });

  it('las tres puertas usan los tres formatos y el portal da la victoria', () => {
    const { room, now } = playingRoom();
    let t = now;
    const formats: string[] = [];
    for (let gate = 0; gate < 3; gate++) {
      reachGate(room, gate, t);
      formats.push(room.question!.question.format);
      const view = toDuoRoomView(room, 'ana', t).question!;
      if (view.format === 'SPLIT') expect(view.myClue).toBeTruthy();
      if (view.format === 'TWO_PART') expect(view.myPrompt).not.toBe(view.partnerPrompt);
      answerDuoQuestion(room, 'ana', pick(room, 'ana', true), t);
      answerDuoQuestion(room, 'luis', pick(room, 'luis', true), t);
      t += DUO_REVEAL_SUCCESS_MS;
      tickDuoRoom(room, t, rng);
    }
    expect(formats).toEqual(['MIRROR', 'SPLIT', 'TWO_PART']);
    expect(room.phase).toBe('VICTORY');
  });

  it('las fichas del tramo destapan pistas en la pregunta de su puerta', () => {
    const { room, now } = playingRoom();
    room.world.coins['ficha-lava'] = 'FIRE';
    room.world.coins['ficha-agua'] = 'WATER';
    room.world.gates['puerta-1'] = true;
    reachGate(room, 1, now);
    expect(toDuoRoomView(room, 'luis', now).question?.hints).toHaveLength(2);
  });

  it('una caja es de quien la empuja; el otro no la mueve hasta que se suelta', () => {
    const { room, now } = playingRoom();
    const crate = room.world.crates[0];
    applyClientState(room, 'ana', { player: body(100, 640), crates: [{ id: crate.id, x: crate.x + 10, y: crate.y }] }, now);
    expect(crate.owner).toBe('FIRE');
    const x = crate.x;
    applyClientState(room, 'luis', { player: body(200, 640), crates: [{ id: crate.id, x: x + 50, y: crate.y }] }, now + 10);
    expect(crate.x).toBe(x);
    tickDuoRoom(room, now + DUO_CRATE_LEASE_MS + 20, rng);
    expect(crate.owner).toBeNull();
    applyClientState(room, 'luis', { player: body(200, 640), crates: [{ id: crate.id, x: x + 50, y: crate.y }] }, now + DUO_CRATE_LEASE_MS + 30);
    expect(crate.owner).toBe('WATER');
    expect(crate.x).toBe(x + 50);
  });

  it('ignora posiciones mal formadas', () => {
    const { room, now } = playingRoom();
    applyClientState(room, 'ana', { player: { ...body(100, 100), x: Number.NaN }, crates: [] }, now);
    expect(room.players[0].state).toBeNull();
    applyClientState(room, 'ana', { player: body(1e9, 100), crates: [] }, now);
    expect(room.players[0].state?.x).toBe(72 * 64);
  });

  it('si alguien se desconecta en plena partida se le espera; si vuelve, sigue', () => {
    const { room, now } = playingRoom();
    disconnectDuoPlayer(room, 's-luis', now);
    expect(room.waitingPartnerUntil).toBe(now + DUO_RECONNECT_GRACE_MS);
    expect(toDuoRoomView(room, 'ana', now).players[1].connected).toBe(false);
    joinDuoRoom(room, { ...LUIS, socketId: 's-luis-2' });
    expect(room.waitingPartnerUntil).toBeNull();
    expect(room.phase).toBe('PLAYING');
  });

  it('si no vuelve a tiempo, la partida se cierra', () => {
    const { room, now } = playingRoom();
    disconnectDuoPlayer(room, 's-luis', now);
    tickDuoRoom(room, now + DUO_RECONNECT_GRACE_MS, rng);
    expect(room.phase).toBe('ABANDONED');
  });

  it('el banco tiene al menos dos preguntas por formato, con 4 opciones y 2 pistas', () => {
    for (const format of ['MIRROR', 'SPLIT', 'TWO_PART'] as const) {
      expect(DUO_QUESTION_BANK.filter((q) => q.format === format).length).toBeGreaterThanOrEqual(2);
    }
    for (const q of DUO_QUESTION_BANK) {
      for (const role of ['FIRE', 'WATER'] as const) {
        const options = optionsFor(q, role);
        expect(options).toHaveLength(4);
        expect(new Set(options).size).toBe(4);
      }
      expect(q.hints.length).toBeGreaterThanOrEqual(2);
    }
  });
});
