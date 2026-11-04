import { describe, expect, it } from 'vitest';
import { CRATE_SIZE, TILE, crateSpawn, parseLevel, scaleSideId, standPoint, type DuoLevel, type DuoLevelDef } from './shared/duoLevel.js';
import { STEP, createPlayer, stepHeavyCrates, stepPlayer, toNet, type CrateSim, type PlayerSim, type StepEvent } from './shared/duoPhysics.js';
import {
  checkpointFor,
  collectGems,
  createWorldState,
  dynamicSolids,
  isBarrierActive,
  updateFlags,
  updateKeys,
  updateScales,
  updateSwitches,
} from './shared/duoWorld.js';
import { NO_INPUT, type DuoInput, type DuoPlayerNet, type DuoWorldState } from './shared/duoTypes.js';

/** Escenario mínimo: piso plano en la fila 5 (se camina en la fila 4, y = 320). */
function testLevel(extra: Partial<DuoLevelDef> = {}, map?: string[]): DuoLevel {
  return parseLevel({
    id: 'prueba',
    title: 'Prueba',
    theme: 'bosque',
    tagline: '',
    map: map ?? ['........................', '........................', '........................', '........................', '........................', '########################'],
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

const FLOOR = 5 * TILE;
const net = (x: number, extra: Partial<DuoPlayerNet> = {}): DuoPlayerNet => ({ x, y: FLOOR, vx: 0, vy: 0, facing: 1, anim: 'idle', dead: false, ...extra });

/** Corre la física de un personaje en un escenario (con las cajas dadas). */
function run(level: DuoLevel, world: DuoWorldState, p: PlayerSim, input: Partial<DuoInput>, seconds: number, crates: CrateSim[] = []) {
  const events: StepEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    const ev = stepPlayer(p, { ...NO_INPUT, ...input }, { level, world, crates, canPush: () => true, respawnAt: standPoint(level.def.spawns[p.role]), time: i * STEP }, STEP);
    if (ev) events.push(ev);
  }
  return events;
}

describe('caja de metal', () => {
  const level = testLevel({ crates: [{ id: 'metal', col: 8, row: 4, heavy: true }] });

  it('uno solo no la mueve: se queda empujando contra ella', () => {
    const world = createWorldState(level);
    const crate = world.crates[0];
    const sim: CrateSim = { id: 'metal', x: crate.x, y: crate.y, vy: 0 };
    const p = createPlayer('FIRE', standPoint({ col: 6, row: 4 }));
    run(level, world, p, { right: true }, 1.2, [sim]);
    expect(sim.x).toBe(crateSpawn({ col: 8, row: 4 }).x);
    expect(p.x).toBeLessThan(sim.x);
    expect(toNet(p).anim).toBe('push');
  });

  it('el servidor la mueve solo si los dos empujan hacia el mismo lado', () => {
    const world = createWorldState(level);
    const crate = world.crates[0];
    const startX = crate.x;
    const pusher = (extra: Partial<DuoPlayerNet> = {}) => net(crate.x - 20, { anim: 'push', facing: 1, ...extra });
    const fall: Record<string, number> = {};
    // Solo Lumen empuja: nada.
    for (let i = 0; i < 30; i++) stepHeavyCrates(level, world, { FIRE: pusher(), WATER: net(100) }, 1 / 30, i / 30, fall);
    expect(crate.x).toBe(startX);
    // Uno a cada lado: tampoco.
    for (let i = 0; i < 30; i++) stepHeavyCrates(level, world, { FIRE: pusher(), WATER: net(crate.x + CRATE_SIZE + 20, { anim: 'push', facing: -1 }) }, 1 / 30, i / 30, fall);
    expect(crate.x).toBe(startX);
    // Los dos por la izquierda: avanza.
    for (let i = 0; i < 30; i++) stepHeavyCrates(level, world, { FIRE: pusher(), WATER: pusher() }, 1 / 30, i / 30, fall);
    expect(crate.x).toBeGreaterThan(startX + 80);
  });
});

describe('llave y puerta con candado', () => {
  const level = testLevel({ keys: [{ id: 'llave', col: 3, row: 4, lock: 'candado' }], locks: [{ id: 'candado', col: 10, row: 3, height: 2 }] });

  it('quien la toca la lleva; si se apaga vuelve a su lugar; con ella, la puerta se abre', () => {
    const world = createWorldState(level);
    // La puerta cerrada bloquea.
    expect(dynamicSolids(level, world).solid.length).toBe(1);
    expect(updateKeys(level, world, { WATER: net(3 * TILE + 32) })).toEqual([{ kind: 'key-taken', id: 'llave', by: 'WATER' }]);
    expect(world.keys.llave).toBe('WATER');
    // Lumen pasa por ahí y no se la quita.
    updateKeys(level, world, { FIRE: net(3 * TILE + 32), WATER: net(6 * TILE) });
    expect(world.keys.llave).toBe('WATER');
    // Gota se apaga: la llave vuelve.
    expect(updateKeys(level, world, { WATER: net(6 * TILE, { dead: true }) })).toEqual([{ kind: 'key-dropped', id: 'llave' }]);
    expect(world.keys.llave).toBeUndefined();
    updateKeys(level, world, { FIRE: net(3 * TILE + 32) });
    expect(updateKeys(level, world, { FIRE: net(10 * TILE - 4) })).toEqual([{ kind: 'lock-opened', id: 'candado', by: 'FIRE' }]);
    expect(world.locks.candado).toBe(true);
    expect(world.keys.llave).toBe('used');
    expect(dynamicSolids(level, world).solid.length).toBe(0);
  });

  it('la puerta cerrada no se atraviesa', () => {
    const world = createWorldState(level);
    const p = createPlayer('FIRE', standPoint({ col: 8, row: 4 }));
    run(level, world, p, { right: true }, 1.5);
    expect(p.x).toBeLessThan(10 * TILE + 10);
  });
});

describe('barrera', () => {
  const level = testLevel({ buttons: [{ id: 'boton', col: 2, row: 4 }], barriers: [{ id: 'muro', col: 10, row: 2, height: 3, off: { any: ['boton'] } }] });

  it('encendida apaga a quien la toca; con el botón pisado se puede cruzar', () => {
    const world = createWorldState(level);
    expect(isBarrierActive(level, world, 'muro')).toBe(true);
    const p = createPlayer('WATER', standPoint({ col: 8, row: 4 }));
    expect(run(level, world, p, { right: true }, 1.5)).toContainEqual({ kind: 'died', cause: 'electric' });

    const q = createPlayer('WATER', standPoint({ col: 8, row: 4 }));
    updateSwitches(level, world, { FIRE: net(2 * TILE + 32) });
    expect(isBarrierActive(level, world, 'muro')).toBe(false);
    expect(run(level, world, q, { right: true }, 1.2).filter((e) => e?.kind === 'died')).toHaveLength(0);
    expect(q.x).toBeGreaterThan(11 * TILE);
  });
});

describe('hongo saltarín', () => {
  const level = testLevel({ springs: [{ id: 'hongo', col: 6, row: 4 }] });

  it('al caer encima rebota mucho más alto que un salto', () => {
    const world = createWorldState(level);
    const p = createPlayer('FIRE', { x: 6 * TILE + 32, y: 2 * TILE });
    const events: StepEvent[] = [];
    let highest = p.y;
    for (let i = 0; i < 90; i++) {
      const ev = stepPlayer(p, NO_INPUT, { level, world, crates: [], canPush: () => true, respawnAt: { x: 0, y: 0 }, time: 0 }, STEP);
      if (ev) events.push(ev);
      if (events.length > 0) highest = Math.min(highest, p.y);
    }
    expect(events[0]).toEqual({ kind: 'bounced' });
    // Sube más de 4 celdas sobre el hongo (un salto normal llega a ~2,5).
    expect(FLOOR - 30 - highest).toBeGreaterThan(4 * TILE);
  });
});

describe('bandera de control', () => {
  const level = testLevel({ flags: [{ id: 'bandera', col: 12, row: 4 }] });

  it('al tocarla, los dos reaparecen ahí', () => {
    const world = createWorldState(level);
    expect(checkpointFor(level, world, 'FIRE')).toEqual({ col: 1, row: 4 });
    expect(updateFlags(level, world, { WATER: net(12 * TILE + 32) })).toEqual(['bandera']);
    expect(updateFlags(level, world, { WATER: net(12 * TILE + 32) })).toEqual([]);
    expect(checkpointFor(level, world, 'FIRE')).toEqual({ col: 12, row: 4 });
    expect(checkpointFor(level, world, 'WATER')).toEqual({ col: 13, row: 4 });
  });
});

describe('báscula', () => {
  const level = testLevel(
    { scales: [{ id: 'balanza', left: { col: 4, row: 3, width: 2 }, right: { col: 9, row: 3, width: 2 }, travel: 2 }] },
    ['........................', '........................', '........................', '........................', '........................', '########################'],
  );

  it('el lado con más peso baja y el otro sube; con el mismo peso quedan parejas', () => {
    const world = createWorldState(level);
    const onLeft = net(5 * TILE, { mover: { id: scaleSideId('balanza', 'left'), dx: 32 } });
    const onRight = net(10 * TILE, { mover: { id: scaleSideId('balanza', 'right'), dx: 32 } });
    for (let i = 0; i < 60; i++) updateScales(level, world, { FIRE: onLeft }, 1 / 30);
    expect(world.scales.balanza).toBe(2 * TILE);
    for (let i = 0; i < 60; i++) updateScales(level, world, { FIRE: onLeft, WATER: onRight }, 1 / 30);
    expect(world.scales.balanza).toBe(0);
    for (let i = 0; i < 60; i++) updateScales(level, world, { WATER: onRight }, 1 / 30);
    expect(world.scales.balanza).toBe(-2 * TILE);
  });

  it('quien va parado en un lado sube o baja con él (y lo cuenta para el servidor)', () => {
    const world = createWorldState(level);
    const p = createPlayer('WATER', { x: 4 * TILE + 60, y: 2 * TILE });
    run(level, world, p, {}, 0.6);
    expect(p.y).toBe(3 * TILE);
    expect(toNet(p).mover?.id).toBe(scaleSideId('balanza', 'left'));
    world.scales.balanza = 40;
    run(level, world, p, {}, 0.1);
    expect(p.y).toBe(3 * TILE + 40);
    world.scales.balanza = -60;
    run(level, world, p, {}, 0.1);
    expect(p.y).toBe(3 * TILE - 60);
  });
});

describe('gemas de color', () => {
  const level = testLevel({ gems: [{ id: 'roja', col: 3, row: 4, color: 'FIRE' }, { id: 'azul', col: 5, row: 4, color: 'WATER' }, { id: 'verde', col: 7, row: 4, color: 'BOTH' }] });

  it('la roja solo la toma Lumen, la azul solo Gota y la verde cualquiera', () => {
    const world = createWorldState(level);
    expect(collectGems(level, world, { WATER: net(3 * TILE + 32), FIRE: net(5 * TILE + 32) })).toEqual([]);
    expect(collectGems(level, world, { FIRE: net(3 * TILE + 32), WATER: net(5 * TILE + 32) })).toEqual([
      { id: 'roja', by: 'FIRE' },
      { id: 'azul', by: 'WATER' },
    ]);
    expect(collectGems(level, world, { WATER: net(7 * TILE + 32) })).toEqual([{ id: 'verde', by: 'WATER' }]);
  });
});
