import { describe, expect, it } from 'vitest';
import { CRATE_SIZE, TILE, lockRect, standPoint, type DuoLevel } from './shared/duoLevel.js';
import { STEP, createPlayer, stepHeavyCrates, stepPlayer, toNet, type PlayerSim, type StepEvent } from './shared/duoPhysics.js';
import { collectGems, createWorldState, isBarrierActive, isBridgeOn, updateKeys, updateSwitches } from './shared/duoWorld.js';
import { duoLevel } from './shared/levels/index.js';
import { NO_INPUT, type DuoInput, type DuoPlayerNet, type DuoWorldState } from './shared/duoTypes.js';

/**
 * Los retos de los escenarios se pueden resolver con la física real (y solo
 * como se pensaron: con ayuda del compañero). Cada prueba juega un tramo
 * como lo haría una persona, por fases: saltar, soltar, caer donde quiere.
 */
const bosque = duoLevel('bosque');
const solar = duoLevel('solar');

/** Una fase devuelve la entrada de este paso, o null cuando ya cumplió y sigue la próxima. */
type Phase = (p: PlayerSim) => Partial<DuoInput> | null;

function play(level: DuoLevel, world: DuoWorldState, p: PlayerSim, phases: Phase[], seconds: number, each?: (p: PlayerSim) => void): StepEvent[] {
  const events: StepEvent[] = [];
  let current = 0;
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    let input: Partial<DuoInput> | null = null;
    while (current < phases.length && (input = phases[current](p)) === null) current += 1;
    const ev = stepPlayer(p, { ...NO_INPUT, ...input }, { level, world, crates: [], canPush: () => true, respawnAt: standPoint(level.def.spawns[p.role]), time: i * STEP }, STEP);
    if (ev) events.push(ev);
    each?.(p);
  }
  return events;
}

/**
 * Salta (manteniendo el salto) hacia la derecha y suelta la flecha pasada
 * `stopX`; termina al aterrizar. Antes espera a estar parado en el piso.
 */
function jumpRightTo(stopX: number): Phase {
  let ready = false;
  let leftGround = false;
  return (p) => {
    if (!ready) {
      ready = p.grounded;
      return {};
    }
    if (!p.grounded) leftGround = true;
    if (leftGround && p.grounded) return null;
    return { right: p.x < stopX, jump: true };
  };
}

/** Camina hacia la derecha hasta `x`. */
const walkRightTo = (x: number): Phase => (p) => (p.x >= x ? null : { right: true });

const net = (p: { x: number; y: number }, extra: Partial<DuoPlayerNet> = {}): DuoPlayerNet => ({ x: p.x, y: p.y, vx: 0, vy: 0, facing: 1, anim: 'idle', dead: false, ...extra });

describe('Bosque', () => {
  it('el hongo del inicio lleva a la isla de la gema de Lumen', () => {
    const world = createWorldState(bosque);
    const p = createPlayer('FIRE', { x: 32, y: 7 * TILE });
    let bounced = false;
    const events = play(bosque, world, p, [(q) => {
      if (q.vy < -1000) bounced = true;
      return { right: bounced && q.x < 5 * TILE + 32 };
    }], 2, (q) => collectGems(bosque, world, { FIRE: toNet(q) }));
    expect(events[0]).toEqual({ kind: 'bounced' });
    expect(p.y).toBe(7 * TILE);
    expect(world.gems['gema-isla']).toBe('FIRE');
  });

  it('las zarzas del tramo 2 se retiran mientras alguien pisa uno de sus botones', () => {
    const world = createWorldState(bosque);
    expect(isBarrierActive(bosque, world, 'zarzas')).toBe(true);
    updateSwitches(bosque, world, { FIRE: net(standPoint({ col: 54, row: 9 })) });
    expect(isBarrierActive(bosque, world, 'zarzas')).toBe(false);
  });

  it('la llave de la repisa solo se alcanza con la báscula inclinada por el compañero', () => {
    for (const tilted of [false, true]) {
      const world = createWorldState(bosque);
      // El compañero parado en el plato izquierdo lo hace bajar: el derecho sube dos celdas.
      if (tilted) world.scales.bascula = 2 * TILE;
      const p = createPlayer('WATER', standPoint({ col: 61, row: 9 }));
      // Al plato derecho (cols 62-63), luego a la repisa (cols 65-66) y hasta la llave.
      play(bosque, world, p, [jumpRightTo(62 * TILE + 40), walkRightTo(63 * TILE + 40), jumpRightTo(66 * TILE + 20), walkRightTo(66 * TILE + 30)], 4, (q) =>
        updateKeys(bosque, world, { WATER: toNet(q) }),
      );
      expect(world.keys.llave === 'WATER').toBe(tilted);
    }
  });

  it('con la llave, al tocar la puerta con candado se abre', () => {
    const world = createWorldState(bosque);
    world.keys.llave = 'FIRE';
    const door = lockRect(bosque.def.locks![0]);
    const p = createPlayer('FIRE', standPoint({ col: 67, row: 9 }));
    play(bosque, world, p, [() => ({ right: true })], 1, (q) => updateKeys(bosque, world, { FIRE: toNet(q) }));
    expect(world.locks.candado).toBe(true);
    expect(p.x).toBeGreaterThan(door.x - 30);
  });

  it('el hongo de las ramas lleva a la rama alta y a su botón', () => {
    const world = createWorldState(bosque);
    const p = createPlayer('WATER', { x: 95 * TILE + 32, y: 5 * TILE });
    const landed: Phase = (q) => (q.grounded && q.y === 2 * TILE ? null : { right: q.vy > 0 && q.y < 3 * TILE });
    play(bosque, world, p, [landed, walkRightTo(97 * TILE + 32)], 2.5, (q) => updateSwitches(bosque, world, { WATER: toNet(q) }));
    expect(p.y).toBe(2 * TILE);
    expect(world.switches['boton-par-alto']).toBe(true);
  });

  it('los dos botones pisados a la vez retiran para siempre las zarzas del final', () => {
    const world = createWorldState(bosque);
    updateSwitches(bosque, world, { FIRE: net(standPoint({ col: 100, row: 6 })) });
    expect(isBarrierActive(bosque, world, 'zarzas-final')).toBe(true);
    updateSwitches(bosque, world, { FIRE: net(standPoint({ col: 100, row: 6 })), WATER: net(standPoint({ col: 97, row: 1 })) });
    updateSwitches(bosque, world, {});
    expect(isBarrierActive(bosque, world, 'zarzas-final')).toBe(false);
  });
});

describe('Planta solar', () => {
  it('la caja de metal, empujada por los dos, queda sobre la placa y enciende el puente', () => {
    const world = createWorldState(solar);
    const crate = world.crates[0];
    const fall: Record<string, number> = {};
    for (let i = 0; i < 150; i++) {
      const pusher = { x: crate.x - 18, y: 10 * TILE, vx: 110, vy: 0, facing: 1 as const, anim: 'push' as const, dead: false };
      stepHeavyCrates(solar, world, { FIRE: pusher, WATER: pusher }, 1 / 30, i / 30, fall);
    }
    // El tope la deja justo sobre la placa.
    expect(crate.x + CRATE_SIZE).toBeCloseTo(72 * TILE, 0);
    updateSwitches(solar, world, {});
    expect(world.switches.placa).toBe(true);
    expect(isBridgeOn(solar, world, 'puente-placa')).toBe(true);
  });

  it('el botón alto solo se alcanza con la báscula inclinada por el compañero', () => {
    for (const tilted of [false, true]) {
      const world = createWorldState(solar);
      if (tilted) world.scales.bascula = 2 * TILE;
      const p = createPlayer('FIRE', standPoint({ col: 102, row: 9 }));
      // Al plato derecho (cols 103-104), a la plataforma alta (cols 105-106) y al botón.
      play(solar, world, p, [jumpRightTo(103 * TILE + 40), walkRightTo(104 * TILE + 30), jumpRightTo(106 * TILE + 20), walkRightTo(106 * TILE + 30)], 4, (q) =>
        updateSwitches(solar, world, { FIRE: toNet(q) }),
      );
      expect(world.switches['boton-alto']).toBe(tilted);
    }
  });

  it('Lumen se trae la llave de las sales y abre la puerta con candado', () => {
    const world = createWorldState(solar);
    updateKeys(solar, world, { FIRE: net(standPoint({ col: 90, row: 11 })) });
    expect(world.keys.llave).toBe('FIRE');
    const p = createPlayer('FIRE', standPoint({ col: 94, row: 9 }));
    play(solar, world, p, [() => ({ right: true })], 1, (q) => updateKeys(solar, world, { FIRE: toNet(q) }));
    expect(world.locks.candado).toBe(true);
  });
});
