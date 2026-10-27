import { describe, expect, it } from 'vitest';
import { TILE, moverRect, standPoint } from './shared/duoLevel.js';
import { STEP, createPlayer, stepPlayer, type PlayerSim, type StepEvent } from './shared/duoPhysics.js';
import { createWorldState, isReceiverLit, litMirrorCount, updateSwitches } from './shared/duoWorld.js';
import { DUO_LEVEL_DEFS, duoLevel, nextDuoLevelId } from './shared/levels/index.js';
import { SOLAR } from './shared/levels/solar.js';
import { NO_INPUT, type DuoInput, type DuoPlayerNet } from './shared/duoTypes.js';
import { DUO_QUESTION_BANK, optionsFor } from './duo-questions.js';
import {
  DUO_COUNTDOWN_MS,
  DUO_REVEAL_SUCCESS_MS,
  answerDuoQuestion,
  applyClientState,
  chooseDuoLevel,
  createDuoRoom,
  rotateDuoMirror,
  joinDuoRoom,
  setDuoReady,
  tickDuoRoom,
  toDuoRoomView,
  voteDuoRetry,
} from './duo-room.js';
import { pedestalRect } from './shared/duoLevel.js';

const solar = duoLevel('solar');
const net = (p: { x: number; y: number }): DuoPlayerNet => ({ x: p.x, y: p.y, vx: 0, vy: 0, facing: 1, anim: 'idle', dead: false });

/** Corre la física con el reloj del servidor avanzando desde `t0`. */
function run(p: PlayerSim, input: (p: PlayerSim, t: number) => Partial<DuoInput>, seconds: number, t0: number, world = createWorldState(solar)) {
  const events: StepEvent[] = [];
  let t = t0;
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    t += STEP;
    const ev = stepPlayer(p, { ...NO_INPUT, ...input(p, t) }, { level: solar, world, crates: [], canPush: () => true, respawnAt: standPoint(SOLAR.spawns[p.role]), time: t }, STEP);
    if (ev) events.push(ev);
  }
  return { events, t };
}

describe('Planta solar', () => {
  it('la plataforma móvil cruza el foso electrificado llevando a quien va encima', () => {
    const mover = SOLAR.movers![0];
    // A t=0 la plataforma está pegada al borde izquierdo del foso.
    const p = createPlayer('WATER', standPoint({ col: 9, row: 9 }));
    // Se sube caminando y se queda quieto encima hasta que llega al otro lado.
    const first = run(p, (q) => ({ right: q.x < mover.col * TILE + TILE / 2 }), 0.6, 0);
    expect(first.events).toHaveLength(0);
    const ride = run(p, () => ({}), 2.6, first.t);
    expect(ride.events).toHaveLength(0);
    expect(p.x).toBeGreaterThan(14 * TILE);
    const off = run(p, () => ({ right: true }), 1, ride.t);
    expect(off.events).toHaveLength(0);
    expect(p.x).toBeGreaterThan(17 * TILE);
    expect(p.y).toBe(10 * TILE);
  });

  it('sin la plataforma, el foso apaga a cualquiera', () => {
    const p = createPlayer('FIRE', standPoint({ col: 9, row: 9 }));
    // A mitad del periodo la plataforma está lejos del borde.
    const { events } = run(p, () => ({ right: true }), 2, SOLAR.movers![0].period / 2);
    expect(events[0]).toMatchObject({ kind: 'died' });
  });

  it('el ascensor sube del piso al mirador', () => {
    const lift = SOLAR.movers![1];
    expect(moverRect(lift, 0).y).toBe(10 * TILE);
    expect(moverRect(lift, lift.period / 2).y).toBe(5 * TILE);
    const p = createPlayer('FIRE', standPoint({ col: 47, row: 9 }));
    // Empujando hacia el mirador mientras sube: el muro lo frena hasta que asoma por arriba.
    const up = run(p, () => ({ right: true }), lift.period / 2 + 0.5, 0);
    expect(up.events).toHaveLength(0);
    expect(p.y).toBe(5 * TILE);
    expect(p.x).toBeGreaterThan(49 * TILE);
  });

  it('con los dos espejos bien orientados se enciende el receptor y el puente', () => {
    const world = createWorldState(solar);
    const [m1, m2] = SOLAR.mirrors!;
    world.mirrors[m1.id] = m1.target;
    expect(litMirrorCount(solar, world, 'receptor')).toBe(1);
    expect(isReceiverLit(solar, world, 'receptor')).toBe(false);
    world.mirrors[m2.id] = m2.target;
    updateSwitches(solar, world, {});
    expect(world.switches['receptor']).toBe(true);
  });

  it('Gota sostiene el botón del fondo del tanque de agua', () => {
    const world = createWorldState(solar);
    const button = SOLAR.buttons[0];
    updateSwitches(solar, world, { WATER: net(standPoint(button)) });
    expect(world.switches['boton-fondo']).toBe(true);
  });
});

describe('campaña de escenarios', () => {
  const ANA = { userId: 'ana', displayName: 'Ana', socketId: 's-ana' };
  const LUIS = { userId: 'luis', displayName: 'Luis', socketId: 's-luis' };

  function room(levelId?: string) {
    const r = createDuoRoom({ code: 'C', gameId: 'g', gameTitle: 't', user: ANA, role: 'FIRE', now: 0 });
    joinDuoRoom(r, LUIS);
    if (levelId) chooseDuoLevel(r, 'ana', levelId);
    setDuoReady(r, 'ana', true, 0);
    setDuoReady(r, 'luis', true, 0);
    tickDuoRoom(r, DUO_COUNTDOWN_MS, () => 0.3);
    return r;
  }

  it('el espejo se gira con las flechas del panel, solo estando junto a él', () => {
    const r = room('solar');
    const m1 = SOLAR.mirrors![0];
    const near = standPoint(m1);
    expect(() => rotateDuoMirror(r, 'ana', m1.id, 1)).toThrow('Acércate');
    applyClientState(r, 'ana', { player: net({ x: near.x + 30, y: near.y }), crates: [] }, DUO_COUNTDOWN_MS);
    rotateDuoMirror(r, 'ana', m1.id, 1);
    expect(r.world.mirrors[m1.id]).toBe((m1.start + 1) % 4);
    rotateDuoMirror(r, 'ana', m1.id, -1);
    rotateDuoMirror(r, 'ana', m1.id, -1);
    expect(r.world.mirrors[m1.id]).toBe((m1.start + 3) % 4);
    expect(() => rotateDuoMirror(r, 'ana', m1.id, 2)).toThrow();
    expect(() => rotateDuoMirror(r, 'ana', 'otro', 1)).toThrow('no existe');
    applyClientState(r, 'ana', { player: net({ x: near.x + 400, y: near.y }), crates: [] }, DUO_COUNTDOWN_MS);
    expect(() => rotateDuoMirror(r, 'ana', m1.id, 1)).toThrow('Acércate');
  });

  it('la campaña usa solo los escenarios que eligió el profesor y sus preguntas propias', () => {
    const own = { id: 'p1', level: 'solar', format: 'MIRROR' as const, prompt: '¿Pregunta del profe?', options: ['Sí', 'No', 'Tal vez', 'Nunca'], hints: [], explanation: 'Bien.' };
    const r = createDuoRoom({ code: 'C', gameId: 'g', gameTitle: 't', user: ANA, role: 'FIRE', now: 0, campaign: ['solar'], customQuestions: [own] });
    expect(r.levelId).toBe('solar');
    expect(toDuoRoomView(r, 'ana', 0).levels.map((l) => l.id)).toEqual(['solar']);
    expect(() => chooseDuoLevel(r, 'ana', 'bosque')).toThrow('no está en este juego');
    joinDuoRoom(r, LUIS);
    setDuoReady(r, 'ana', true, 0);
    setDuoReady(r, 'luis', true, 0);
    tickDuoRoom(r, DUO_COUNTDOWN_MS, () => 0.3);
    for (const [id, role] of [['ana', 'FIRE'], ['luis', 'WATER']] as const) {
      const top = pedestalRect(SOLAR.gates[0].pedestals[role]);
      applyClientState(r, id, { player: net({ x: top.x + top.w / 2, y: top.y }), crates: [] }, DUO_COUNTDOWN_MS);
    }
    tickDuoRoom(r, DUO_COUNTDOWN_MS, () => 0.3);
    expect(r.question?.question.id).toBe('p1');
    r.phase = 'VICTORY';
    expect(toDuoRoomView(r, 'ana', 0).nextLevelTitle).toBeNull();
  });

  it('los escenarios van en orden: bosque y luego planta solar', () => {
    expect(DUO_LEVEL_DEFS.map((d) => d.id).slice(0, 2)).toEqual(['bosque', 'solar']);
    expect(nextDuoLevelId('bosque')).toBe('solar');
  });

  it('solo el anfitrión elige el escenario inicial', () => {
    const r = createDuoRoom({ code: 'C', gameId: 'g', gameTitle: 't', user: ANA, role: 'FIRE', now: 0 });
    joinDuoRoom(r, LUIS);
    expect(() => chooseDuoLevel(r, 'luis', 'solar')).toThrow('Solo quien creó');
    expect(() => chooseDuoLevel(r, 'ana', 'marte')).toThrow('no está en este juego');
    chooseDuoLevel(r, 'ana', 'solar');
    expect(toDuoRoomView(r, 'luis', 0)).toMatchObject({ levelId: 'solar', levelTitle: 'La Planta solar' });
  });

  it('las puertas de la planta solar sacan preguntas de energía', () => {
    const r = room('solar');
    expect(r.world.mirrors).toEqual({ 'espejo-1': 0, 'espejo-2': 3 });
    const top = pedestalRect(SOLAR.gates[0].pedestals.FIRE);
    const top2 = pedestalRect(SOLAR.gates[0].pedestals.WATER);
    applyClientState(r, 'ana', { player: net({ x: top.x + top.w / 2, y: top.y }), crates: [] }, DUO_COUNTDOWN_MS);
    applyClientState(r, 'luis', { player: net({ x: top2.x + top2.w / 2, y: top2.y }), crates: [] }, DUO_COUNTDOWN_MS);
    tickDuoRoom(r, DUO_COUNTDOWN_MS, () => 0.3);
    expect(r.question?.question.level).toBe('solar');
  });

  it('al ganar, los dos votan y pasan al siguiente escenario con corazones nuevos', () => {
    const r = room();
    r.phase = 'VICTORY';
    r.hearts = 1;
    expect(toDuoRoomView(r, 'ana', 0).nextLevelTitle).toBe('La Planta solar');
    voteDuoRetry(r, 'ana', 0);
    voteDuoRetry(r, 'luis', 0);
    expect(r.levelId).toBe('solar');
    expect(r.phase).toBe('COUNTDOWN');
    expect(r.hearts).toBe(3);
  });

  it('al perder, se repite el mismo escenario', () => {
    const r = room('solar');
    r.phase = 'DEFEAT';
    voteDuoRetry(r, 'ana', 0);
    voteDuoRetry(r, 'luis', 0);
    expect(r.levelId).toBe('solar');
  });

  it('al ganar el último escenario la campaña vuelve a empezar', () => {
    const last = DUO_LEVEL_DEFS[DUO_LEVEL_DEFS.length - 1].id;
    const r = room(last);
    r.phase = 'VICTORY';
    expect(toDuoRoomView(r, 'ana', 0).nextLevelTitle).toBeNull();
    voteDuoRetry(r, 'ana', 0);
    voteDuoRetry(r, 'luis', 0);
    expect(r.levelId).toBe(DUO_LEVEL_DEFS[0].id);
  });

  it('cada escenario tiene al menos dos preguntas por formato y se pueden contestar', () => {
    for (const def of DUO_LEVEL_DEFS) {
      for (const format of ['MIRROR', 'SPLIT', 'TWO_PART'] as const) {
        expect(DUO_QUESTION_BANK.filter((q) => q.level === def.id && q.format === format).length, `${def.id} ${format}`).toBeGreaterThanOrEqual(2);
      }
    }
    const r = room('solar');
    r.world.gates['puerta-1'] = true;
    r.world.gates['puerta-2'] = true;
    const gate = SOLAR.gates[2];
    for (const [id, role] of [['ana', 'FIRE'], ['luis', 'WATER']] as const) {
      const top = pedestalRect(gate.pedestals[role]);
      applyClientState(r, id, { player: net({ x: top.x + top.w / 2, y: top.y }), crates: [] }, DUO_COUNTDOWN_MS);
    }
    tickDuoRoom(r, DUO_COUNTDOWN_MS, () => 0.3);
    for (const [id, role] of [['ana', 'FIRE'], ['luis', 'WATER']] as const) {
      const right = optionsFor(r.question!.question, role)[0];
      answerDuoQuestion(r, id, toDuoRoomView(r, id, 0).question!.options.indexOf(right), 0);
    }
    tickDuoRoom(r, DUO_COUNTDOWN_MS + DUO_REVEAL_SUCCESS_MS, () => 0.3);
    expect(r.phase).toBe('VICTORY');
  });
});
