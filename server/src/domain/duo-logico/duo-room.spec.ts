import { describe, expect, it } from 'vitest';
import {
  DUO_COUNTDOWN_MS,
  DUO_CRATE_LEASE_MS,
  DUO_RECONNECT_GRACE_MS,
  DUO_REVEAL_FAIL_MS,
  DUO_REVEAL_SUCCESS_MS,
  answerDuoQuestion,
  applyClientState,
  toDuoSnapshot,
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
    expect(room.question?.question.level).toBe('bosque');
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

  it('cada uno ve solo su pregunta (distinta, del mismo concepto) y el portal da la victoria', () => {
    const { room, now } = playingRoom();
    let t = now;
    const ids: string[] = [];
    for (let gate = 0; gate < 3; gate++) {
      reachGate(room, gate, t);
      ids.push(room.question!.question.id);
      const mine = toDuoRoomView(room, 'ana', t).question!;
      const theirs = toDuoRoomView(room, 'luis', t).question!;
      expect(mine.concept).toBe(theirs.concept);
      expect(mine.prompt).not.toBe(theirs.prompt);
      expect(JSON.stringify(mine)).not.toContain(theirs.prompt);
      answerDuoQuestion(room, 'ana', pick(room, 'ana', true), t);
      answerDuoQuestion(room, 'luis', pick(room, 'luis', true), t);
      t += DUO_REVEAL_SUCCESS_MS;
      tickDuoRoom(room, t, rng);
    }
    expect(new Set(ids).size).toBe(3);
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

  /** Ningún escenario trae hoy cajas livianas: se prueba con la del bosque como si lo fuera. */
  function withLightCrate(test: () => void) {
    const def = BOSQUE.crates[0];
    const heavy = def.heavy;
    def.heavy = false;
    try {
      test();
    } finally {
      def.heavy = heavy;
    }
  }

  it('la caja de metal no la mueve ningún jugador por su cuenta (la arrastra el servidor)', () => {
    const { room, now } = playingRoom();
    const crate = room.world.crates[0];
    const x = crate.x;
    applyClientState(room, 'ana', { player: body(100, 640), crates: [{ id: crate.id, x: x + 40, y: crate.y }] }, now);
    expect(crate.x).toBe(x);
    expect(crate.owner).toBeNull();
  });

  it('una caja liviana es de quien la empuja; el otro no la mueve hasta que se suelta', () => withLightCrate(() => {
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
  }));

  it('la instantánea dice cuándo llegó cada posición, para no repetir una vieja como nueva', () => withLightCrate(() => {
    const { room, now } = playingRoom();
    const crate = room.world.crates[0];
    applyClientState(room, 'ana', { player: body(100, 640), crates: [{ id: crate.id, x: crate.x + 10, y: crate.y }] }, now);
    applyClientState(room, 'luis', { player: body(200, 640), crates: [] }, now + 30);
    const later = toDuoSnapshot(room, now + 50);
    expect(later.t).toBe(now + 50);
    expect(later.at).toEqual({ FIRE: now, WATER: now + 30 });
    expect(later.world.crates[0].at).toBe(now);
  }));

  it('las gemas, la llave, el candado y las banderas se avisan, y las gemas se cuentan en la vista', () => {
    const { room, now } = playingRoom();
    const tick = (t: number) => tickDuoRoom(room, t, rng);
    expect(toDuoRoomView(room, 'ana', now)).toMatchObject({ gemsCollected: 0, gemsTotal: BOSQUE.gems!.length });
    // Lumen, sobre la isla, toma su gema.
    applyClientState(room, 'ana', { player: body(5 * 64 + 32, 7 * 64), crates: [] }, now);
    expect(tick(now + 10)).toContainEqual({ kind: 'gem', by: 'FIRE' });
    expect(toDuoRoomView(room, 'ana', now + 10).gemsCollected).toBe(1);
    // Gota toca la bandera de los pozos.
    applyClientState(room, 'luis', { player: body(46 * 64 + 32, 10 * 64), crates: [] }, now + 20);
    expect(tick(now + 30)).toContainEqual({ kind: 'flag' });
    // Gota toma la llave de la repisa y abre la puerta con candado.
    applyClientState(room, 'luis', { player: body(66 * 64 + 32, 6 * 64), crates: [] }, now + 40);
    expect(tick(now + 50)).toContainEqual({ kind: 'key', by: 'WATER' });
    applyClientState(room, 'luis', { player: body(69 * 64 - 10, 10 * 64), crates: [] }, now + 60);
    expect(tick(now + 70)).toContainEqual({ kind: 'lock', by: 'WATER' });
    expect(room.world.locks.candado).toBe(true);
  });

  it('acepta que un jugador cuente que va sobre un lado de la báscula', () => {
    const { room, now } = playingRoom();
    applyClientState(room, 'ana', { player: { ...body(58 * 64 + 30, 10 * 64), mover: { id: 'scale:bascula:left', dx: 30 } }, crates: [] }, now);
    expect(room.players[0].state?.mover).toEqual({ id: 'scale:bascula:left', dx: 30 });
    applyClientState(room, 'ana', { player: { ...body(58 * 64 + 30, 10 * 64), mover: { id: 'scale:otra:left', dx: 30 } }, crates: [] }, now + 1);
    expect(room.players[0].state?.mover).toBeUndefined();
    // Con su peso, el plato izquierdo baja.
    tickDuoRoom(room, now + 10, rng);
    tickDuoRoom(room, now + 500, rng);
    expect(room.world.scales.bascula).toBe(0);
    applyClientState(room, 'ana', { player: { ...body(58 * 64 + 30, 10 * 64), mover: { id: 'scale:bascula:left', dx: 30 } }, crates: [] }, now + 510);
    tickDuoRoom(room, now + 520, rng);
    tickDuoRoom(room, now + 620, rng);
    expect(room.world.scales.bascula).toBeGreaterThan(0);
  });

  it('ignora posiciones mal formadas', () => {
    const { room, now } = playingRoom();
    applyClientState(room, 'ana', { player: { ...body(100, 100), x: Number.NaN }, crates: [] }, now);
    expect(room.players[0].state).toBeNull();
    applyClientState(room, 'ana', { player: body(1e9, 100), crates: [] }, now);
    expect(room.players[0].state?.x).toBe(BOSQUE.map[0].length * 64);
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

  it('el banco: dos preguntas distintas por concepto, con 4 opciones y 2 pistas', () => {
    for (const q of DUO_QUESTION_BANK) {
      expect(q.concept).toBeTruthy();
      expect(q.parts.FIRE.prompt).not.toBe(q.parts.WATER.prompt);
      for (const role of ['FIRE', 'WATER'] as const) {
        const options = optionsFor(q, role);
        expect(options).toHaveLength(4);
        expect(new Set(options).size).toBe(4);
      }
      expect(q.hints.length).toBeGreaterThanOrEqual(2);
    }
  });
});
