import { describe, expect, it } from 'vitest';
import { BELT_SPEED, CURRENT_SPEED, FLOAT_RISE, TILE, floaterMoverId, parseLevel, pressDrop, standPoint, type DuoLevel, type DuoLevelDef } from './shared/duoLevel.js';
import { STEP, createPlayer, stepCrate, stepPlayer, type CrateSim, type PlayerSim, type StepEvent } from './shared/duoPhysics.js';
import { createWorldState, floaterSurfaces, isBarrierActive, updatePools } from './shared/duoWorld.js';
import { NO_INPUT, type DuoInput, type DuoWorldState } from './shared/duoTypes.js';

/**
 * Mecánicas de los escenarios Río, Reciclaje y Ciudad (issue #132): estanques
 * con válvula, troncos que flotan, corrientes, cintas, prensas y semáforos.
 */

const EMPTY = '........................';
const FLOOR_ROW = '########################';
const FLOOR = 5 * TILE;

function testLevel(extra: Partial<DuoLevelDef> = {}, map: string[] = [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, FLOOR_ROW]): DuoLevel {
  return parseLevel({
    id: 'prueba',
    title: 'Prueba',
    theme: 'rio',
    tagline: '',
    map,
    spawns: { FIRE: { col: 1, row: 4 }, WATER: { col: 2, row: 4 } },
    buttons: [],
    levers: [],
    bridges: [],
    crates: [],
    coins: [],
    gates: [],
    decor: [],
    ...extra,
  });
}

/** Corre la física; `each` se llama antes de cada paso (para mover el agua, por ejemplo). */
function run(level: DuoLevel, world: DuoWorldState, p: PlayerSim, input: Partial<DuoInput>, seconds: number, each?: (time: number) => void, t0 = 0) {
  const events: StepEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    const time = t0 + i * STEP;
    each?.(time);
    const ev = stepPlayer(p, { ...NO_INPUT, ...input }, { level, world, crates: [], canPush: () => true, respawnAt: standPoint(level.def.spawns[p.role]), time }, STEP);
    if (ev) events.push(ev);
  }
  return events;
}

const died = (events: StepEvent[]) => events.find((e) => e?.kind === 'died');

describe('estanque con válvula y troncos', () => {
  const level = testLevel({
    buttons: [{ id: 'valvula', col: 2, row: 4 }],
    pools: [{ id: 'charca', col: 6, row: 2, width: 6, depth: 3, low: 0, high: 2, when: { any: ['valvula'] } }],
    floaters: [{ id: 'tronco', pool: 'charca', col: 7, width: 2, kind: 'log' }],
  });

  it('el agua sube mientras la válvula está abierta y baja al soltarla', () => {
    const world = createWorldState(level);
    expect(world.pools.charca).toBe(0);
    world.switches.valvula = true;
    for (let i = 0; i < 60; i++) updatePools(level, world, 1 / 30);
    expect(world.pools.charca).toBe(2 * TILE);
    world.switches.valvula = false;
    for (let i = 0; i < 15; i++) updatePools(level, world, 1 / 30);
    expect(world.pools.charca).toBeGreaterThan(0);
    expect(world.pools.charca).toBeLessThan(2 * TILE);
    for (let i = 0; i < 60; i++) updatePools(level, world, 1 / 30);
    expect(world.pools.charca).toBe(0);
  });

  it('Lumen sobre el tronco sube con el agua y no se apaga', () => {
    const world = createWorldState(level);
    const log = floaterSurfaces(level, world)[0].rect;
    const lumen = createPlayer('FIRE', { x: log.x + log.w / 2, y: log.y });
    world.switches.valvula = true;
    const events = run(level, world, lumen, {}, 2.4, () => updatePools(level, world, STEP));
    expect(died(events)).toBeUndefined();
    expect(lumen.standingOn).toBe(floaterMoverId('tronco'));
    expect(lumen.y).toBeCloseTo(FLOOR - 2 * TILE - FLOAT_RISE, 0);
  });

  it('el agua que sube apaga a Lumen si no está en el tronco, y Gota nada', () => {
    const world = createWorldState(level);
    world.switches.valvula = true;
    const lumen = createPlayer('FIRE', standPoint({ col: 10, row: 4 }));
    expect(died(run(level, world, lumen, {}, 1.5, () => updatePools(level, world, STEP)))).toEqual({ kind: 'died', cause: 'water' });

    const world2 = createWorldState(level);
    world2.switches.valvula = true;
    const gota = createPlayer('WATER', standPoint({ col: 10, row: 4 }));
    const events = run(level, world2, gota, {}, 1.5, () => updatePools(level, world2, STEP));
    expect(died(events)).toBeUndefined();
    expect(gota.swimming).toBe(true);
  });

  it('una caja que cae al agua del estanque vuelve a su lugar', () => {
    const world = createWorldState(level);
    world.pools.charca = 2 * TILE;
    const crate: CrateSim = { id: 'c', x: 10 * TILE, y: FLOOR - 2 * TILE - 70, vy: 0 };
    let alive = true;
    for (let i = 0; i < 60 && alive; i++) alive = stepCrate(level, world, [crate], crate, STEP);
    expect(alive).toBe(false);
  });
});

describe('cintas transportadoras', () => {
  const level = testLevel({
    buttons: [{ id: 'reversa', col: 1, row: 4 }, { id: 'parada', col: 2, row: 4 }],
    flows: [{ id: 'cinta', kind: 'belt', col: 4, row: 5, width: 16, dir: 1, reverse: { any: ['reversa'] }, stop: { any: ['parada'] } }],
  });

  it('arrastra a quien va parado encima, al revés con su botón y nada si está detenida', () => {
    const start = standPoint({ col: 10, row: 4 });
    const still = (switches: Record<string, boolean>) => {
      const world = createWorldState(level);
      Object.assign(world.switches, switches);
      const p = createPlayer('FIRE', start);
      run(level, world, p, {}, 1);
      return p.x - start.x;
    };
    expect(still({})).toBeGreaterThan(BELT_SPEED * 0.85);
    expect(still({ reversa: true })).toBeLessThan(-BELT_SPEED * 0.85);
    expect(still({ parada: true })).toBeCloseTo(0, 5);
  });

  it('contra la cinta se avanza más despacio', () => {
    const world = createWorldState(level);
    const start = standPoint({ col: 16, row: 4 });
    const p = createPlayer('FIRE', start);
    run(level, world, p, { left: true }, 1);
    const against = start.x - p.x;
    expect(against).toBeGreaterThan(60);
    expect(against).toBeLessThan(200);
  });
});

describe('corrientes', () => {
  const water = '....WWWWWWWWWWWWWWWW....';
  const level = testLevel(
    {
      levers: [{ id: 'compuerta', col: 1, row: 4 }],
      flows: [{ id: 'corriente', kind: 'current', col: 4, row: 3, width: 16, height: 2, dir: -1, stop: { any: ['compuerta'] } }],
    },
    [EMPTY, EMPTY, EMPTY, water, water, FLOOR_ROW],
  );

  it('arrastra a Gota mientras nada, y la compuerta cerrada la detiene', () => {
    const start = { x: 14 * TILE, y: FLOOR };
    const world = createWorldState(level);
    const gota = createPlayer('WATER', start);
    run(level, world, gota, {}, 1);
    expect(start.x - gota.x).toBeGreaterThan(CURRENT_SPEED * 0.7);

    const calm = createWorldState(level);
    calm.switches.compuerta = true;
    const gota2 = createPlayer('WATER', start);
    run(level, calm, gota2, {}, 1);
    expect(Math.abs(gota2.x - start.x)).toBeLessThan(2);
  });
});

describe('prensa hidráulica', () => {
  const level = testLevel({
    buttons: [{ id: 'freno', col: 2, row: 4 }],
    presses: [{ id: 'prensa', col: 8, row: 1, width: 1, drop: 3, period: 2, stop: { any: ['freno'] } }],
  });

  it('baja, se queda abajo un momento y vuelve a subir', () => {
    const press = level.def.presses![0];
    expect(pressDrop(press, 0.2)).toBe(0);
    expect(pressDrop(press, 1.3)).toBe(1);
    expect(pressDrop(press, 1.7)).toBeGreaterThan(0);
    expect(pressDrop(press, 1.7)).toBeLessThan(1);
    expect(pressDrop(press, 2.2)).toBe(0);
  });

  it('apaga a quien se queda debajo, salvo mientras alguien pisa el freno', () => {
    const under = standPoint({ col: 8, row: 4 });
    const world = createWorldState(level);
    expect(died(run(level, world, createPlayer('WATER', under), {}, 2))).toEqual({ kind: 'died', cause: 'press' });
    const stopped = createWorldState(level);
    stopped.switches.freno = true;
    expect(died(run(level, stopped, createPlayer('WATER', under), {}, 2))).toBeUndefined();
  });

  it('arriba no hace daño: se pasa por debajo a tiempo', () => {
    const world = createWorldState(level);
    // Sale de la columna 6 cuando la prensa está arriba y la cruza corriendo.
    const p = createPlayer('FIRE', standPoint({ col: 6, row: 4 }));
    expect(died(run(level, world, p, { right: true }, 0.9))).toBeUndefined();
    expect(p.x).toBeGreaterThan(10 * TILE);
  });
});

describe('semáforo', () => {
  const level = testLevel({
    buttons: [{ id: 'pulsador', col: 2, row: 4 }],
    barriers: [{ id: 'paso', col: 10, row: 3, height: 2, off: { any: ['pulsador'] }, cycle: { period: 4, red: 2 } }],
  });

  it('en rojo apaga, en verde deja pasar, y el pulsador lo pone en verde', () => {
    const world = createWorldState(level);
    expect(isBarrierActive(level, world, 'paso', 0.5)).toBe(true);
    expect(isBarrierActive(level, world, 'paso', 2.5)).toBe(false);
    expect(isBarrierActive(level, world, 'paso', 4.5)).toBe(true);
    world.switches.pulsador = true;
    expect(isBarrierActive(level, world, 'paso', 0.5)).toBe(false);
  });

  it('cruzar en rojo apaga; en verde se pasa', () => {
    const world = createWorldState(level);
    const red = createPlayer('FIRE', standPoint({ col: 8, row: 4 }));
    expect(died(run(level, world, red, { right: true }, 0.8, undefined, 0))).toEqual({ kind: 'died', cause: 'electric' });
    const green = createPlayer('FIRE', standPoint({ col: 8, row: 4 }));
    expect(died(run(level, world, green, { right: true }, 0.8, undefined, 2.2))).toBeUndefined();
    expect(green.x).toBeGreaterThan(11 * TILE);
  });
});
