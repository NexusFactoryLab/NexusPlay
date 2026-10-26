import { AnimatedSprite, Container, Graphics, Sprite, Text, TilingSprite, type Texture } from 'pixi.js'
import {
  BRIDGE_H,
  CRATE_SIZE,
  PEDESTAL_H,
  TILE,
  bridgeRect,
  gateWallRect,
  isSolidTile,
  standPoint,
  tileAt,
  type DuoLevel,
  type TileKind,
} from '../shared/duoLevel'
import { isConditionMet } from '../shared/duoWorld'
import type { DuoRole, DuoWorldState } from '../shared/duoTypes'
import type { DuoAssets } from './duoAssets'

interface Run {
  row: number
  c0: number
  c1: number
}

/** Tramos horizontales seguidos de celdas que cumplen `match`. */
function runs(level: DuoLevel, match: (kind: TileKind, col: number, row: number) => boolean): Run[] {
  const out: Run[] = []
  for (let row = 0; row < level.rows; row++) {
    let start = -1
    for (let col = 0; col <= level.cols; col++) {
      const hit = col < level.cols && match(level.tiles[row][col], col, row)
      if (hit && start < 0) start = col
      if (!hit && start >= 0) {
        out.push({ row, c0: start, c1: col - 1 })
        start = -1
      }
    }
  }
  return out
}

function sized(texture: Texture, height: number): Sprite {
  const s = new Sprite(texture)
  s.scale.set(height / texture.frame.height)
  return s
}

/** Cada cuánto cambia de cuadro la superficie de la lava y el lodo (ms). */
const SURFACE_FRAME_MS = 180

interface LiquidSurface {
  sprite: TilingSprite
  frames: Texture[]
}

/**
 * Dibuja el escenario: el terreno queda fijo; botones, palancas, puentes,
 * puertas, fichas, cajas y portal se actualizan con el estado del mundo.
 * Capas: `back` (detrás de los personajes) y `front` (líquido por delante,
 * para que quien nada se vea sumergido).
 */
export class LevelView {
  readonly back = new Container()
  readonly front = new Container()
  private readonly surfaces: LiquidSurface[] = []
  private readonly water = new Graphics()
  private readonly waterRuns: Run[]
  private readonly buttons = new Map<string, Sprite>()
  private readonly levers = new Map<string, Sprite>()
  private readonly bridges = new Map<string, Graphics>()
  private readonly bridgeOn = new Map<string, boolean | null>()
  private readonly gates = new Map<string, { barrier: Container; door: Sprite; opened: boolean }>()
  private readonly pedestals = new Map<string, Record<DuoRole, { sprite: Sprite; glow: Graphics }>>()
  private readonly coins = new Map<string, { sprite: AnimatedSprite; baseY: number }>()
  private readonly crates = new Map<string, Sprite>()
  private portal: AnimatedSprite | null = null
  private readonly portalGlow = new Graphics()

  private readonly assets: DuoAssets
  private readonly level: DuoLevel

  constructor(assets: DuoAssets, level: DuoLevel) {
    this.assets = assets
    this.level = level
    const def = level.def
    const t = assets.terrain.textures
    const o = assets.objects.textures

    // --- Líquidos (detrás) ---
    const liquidBack = new Container()
    this.waterRuns = runs(level, (k) => k === 'water')
    for (const kind of ['lava', 'sludge'] as const) {
      const fill = kind === 'lava' ? assets.lava : assets.sludge
      const tops = kind === 'lava' ? assets.lavaTop : assets.sludgeTop
      for (const run of runs(level, (k) => k === kind)) {
        const x = run.c0 * TILE
        const w = (run.c1 - run.c0 + 1) * TILE
        const surface = tileAt(level, run.c0, run.row - 1) !== kind
        const body = new TilingSprite({ texture: fill, width: w, height: TILE + (surface ? -24 : 0) })
        body.position.set(x, run.row * TILE + (surface ? 24 : 0))
        // Mosaico alineado al mundo: las filas seguidas empalman sin franjas.
        body.tilePosition.set(-body.x, -body.y)
        liquidBack.addChild(body)
        if (surface) {
          const top = new TilingSprite({ texture: tops[0], width: w, height: 52 })
          top.position.set(x, run.row * TILE - 14)
          top.tileScale.set(52 / tops[0].frame.height)
          liquidBack.addChild(top)
          this.surfaces.push({ sprite: top, frames: tops })
        }
      }
    }
    this.back.addChild(liquidBack)

    // --- Suelo: tierra en mosaico alineada al mundo, pasto arriba y bordes ---
    const ground = new Container()
    const edges = new Graphics()
    for (const run of runs(level, (k) => k === 'ground')) {
      const x = run.c0 * TILE
      const y = run.row * TILE
      const w = (run.c1 - run.c0 + 1) * TILE
      const dirt = new TilingSprite({ texture: assets.dirt, width: w, height: TILE })
      dirt.position.set(x, y)
      dirt.tilePosition.set(-x, -y)
      ground.addChild(dirt)
    }
    const grassRuns = runs(level, (k, col, row) => k === 'ground' && !isSolidTile(tileAt(level, col, row - 1)))
    const grassLayer = new Container()
    for (const run of grassRuns) {
      const x = run.c0 * TILE
      const w = (run.c1 - run.c0 + 1) * TILE
      const grass = new TilingSprite({ texture: assets.grass, width: w + 8, height: 46 })
      grass.position.set(x - 4, run.row * TILE - 14)
      grass.tileScale.set(46 / assets.grass.frame.height)
      grass.tilePosition.x = -x
      grassLayer.addChild(grass)
      // Pasto que cae por los bordes expuestos.
      if (!isSolidTile(tileAt(level, run.c0 - 1, run.row)) && run.c0 > 0) {
        const cap = sized(t['cap-left'], 74)
        cap.position.set(x - 8, run.row * TILE - 16)
        grassLayer.addChild(cap)
      }
      if (!isSolidTile(tileAt(level, run.c1 + 1, run.row)) && run.c1 < level.cols - 1) {
        const cap = sized(t['cap-right'], 74)
        cap.anchor.set(1, 0)
        cap.position.set(x + w + 8, run.row * TILE - 16)
        grassLayer.addChild(cap)
      }
    }
    // Bordes laterales oscuros donde el suelo da al vacío.
    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.cols; col++) {
        if (level.tiles[row][col] !== 'ground') continue
        const x = col * TILE
        const y = row * TILE
        const leftOpen = col > 0 && !isSolidTile(tileAt(level, col - 1, row))
        const rightOpen = col < level.cols - 1 && !isSolidTile(tileAt(level, col + 1, row))
        if (leftOpen) edges.rect(x, y, 5, TILE).fill({ color: 0x3b2414, alpha: 0.85 })
        if (rightOpen) edges.rect(x + TILE - 5, y, 5, TILE).fill({ color: 0x3b2414, alpha: 0.85 })
      }
    }
    ground.addChild(edges, grassLayer)
    this.back.addChild(ground)

    // --- Plataformas flotantes y ramas ---
    for (const run of runs(level, (k) => k === 'float')) this.back.addChild(this.threeSlice(run, 'float', 76, -10))
    for (const run of runs(level, (k) => k === 'branch')) this.back.addChild(this.threeSlice(run, 'branch', 40, -12))

    // --- Espinas ---
    for (const run of runs(level, (k) => k === 'thorns')) {
      const w = (run.c1 - run.c0 + 1) * TILE
      const thorns = new TilingSprite({ texture: assets.thorns, width: w, height: 46 })
      thorns.position.set(run.c0 * TILE, (run.row + 1) * TILE - 44)
      thorns.tileScale.set(46 / assets.thorns.frame.height)
      this.back.addChild(thorns)
    }

    // --- Decoración ---
    const decorHeight = { flowers: 40, bush: 44, fern: 48, mushroom: 34, rock: 26 }
    for (const d of def.decor) {
      const s = sized(t[d.kind], decorHeight[d.kind])
      s.anchor.set(0.5, 1)
      const p = standPoint(d)
      s.position.set(p.x, p.y + 4)
      this.back.addChild(s)
    }

    // --- Objetos ---
    for (const b of def.bridges) {
      const g = new Graphics()
      this.bridges.set(b.id, g)
      this.bridgeOn.set(b.id, null)
      this.back.addChild(g)
    }
    for (const b of def.buttons) {
      const s = sized(o['button-up'], 30)
      s.anchor.set(0.5, 1)
      const p = standPoint(b)
      s.position.set(p.x, p.y + 2)
      this.buttons.set(b.id, s)
      this.back.addChild(s)
    }
    for (const l of def.levers) {
      const s = sized(o['lever-off'], 58)
      s.anchor.set(0.5, 1)
      const p = standPoint(l)
      s.position.set(p.x, p.y + 2)
      this.levers.set(l.id, s)
      this.back.addChild(s)
    }
    for (const gate of def.gates) {
      const pair = {} as Record<DuoRole, { sprite: Sprite; glow: Graphics }>
      for (const role of ['FIRE', 'WATER'] as const) {
        const sprite = sized(o[role === 'FIRE' ? 'pedestal-fire' : 'pedestal-water'], PEDESTAL_H + 4)
        sprite.anchor.set(0.5, 1)
        const p = standPoint(gate.pedestals[role])
        sprite.position.set(p.x, p.y + 2)
        // Brillo del color del elemento cuando su dueño está encima.
        const glow = new Graphics()
          .ellipse(p.x, p.y - PEDESTAL_H, 46, 18)
          .fill({ color: role === 'FIRE' ? 0xfb923c : 0x38bdf8, alpha: 0.55 })
          .ellipse(p.x, p.y - PEDESTAL_H / 2, 34, PEDESTAL_H / 2 + 10)
          .fill({ color: role === 'FIRE' ? 0xf97316 : 0x0ea5e9, alpha: 0.25 })
        glow.visible = false
        this.back.addChild(glow, sprite)
        pair[role] = { sprite, glow }
      }
      this.pedestals.set(gate.id, pair)
      if (gate.wall) {
        const rect = gateWallRect(gate.wall)
        const barrier = new Container()
        const glow = new Graphics()
          .rect(rect.x - 6, rect.y, rect.w + 12, rect.h - 70)
          .fill({ color: 0x8b5cf6, alpha: 0.18 })
          .rect(rect.x + rect.w / 2 - 6, rect.y, 12, rect.h - 70)
          .fill({ color: 0xc4b5fd, alpha: 0.75 })
        const mark = new Text({ text: '?', style: { fontFamily: 'system-ui, sans-serif', fontSize: 40, fontWeight: '900', fill: 0xffffff, stroke: { color: 0x6d28d9, width: 6 } } })
        mark.anchor.set(0.5)
        mark.position.set(rect.x + rect.w / 2, rect.y + (rect.h - 70) / 2)
        barrier.addChild(glow, mark)
        const door = sized(o['door-closed'], 96)
        door.anchor.set(0.5, 1)
        door.position.set(rect.x + rect.w / 2, rect.y + rect.h + 2)
        this.back.addChild(barrier, door)
        this.gates.set(gate.id, { barrier, door, opened: false })
      }
      if (gate.portal) {
        const p = standPoint(gate.portal)
        const portal = new AnimatedSprite(assets.objects.animations.portal)
        portal.anchor.set(0.5)
        portal.scale.set(120 / portal.texture.frame.height)
        portal.position.set(p.x, p.y - 64)
        portal.animationSpeed = 0.12
        portal.play()
        this.portalGlow.circle(p.x, p.y - 64, 70).fill({ color: 0x5eead4, alpha: 0.18 })
        this.back.addChild(this.portalGlow, portal)
        this.portal = portal
      }
    }
    for (const c of def.coins) {
      const coin = new AnimatedSprite(assets.objects.animations.coin)
      coin.anchor.set(0.5)
      coin.scale.set(38 / coin.texture.frame.height)
      coin.position.set(c.col * TILE + TILE / 2, c.row * TILE + TILE / 2)
      coin.animationSpeed = 0.14
      coin.play()
      this.coins.set(c.id, { sprite: coin, baseY: coin.y })
      this.back.addChild(coin)
    }
    for (const c of def.crates) {
      const s = new Sprite(o.crate)
      s.anchor.set(0)
      s.width = CRATE_SIZE
      s.height = CRATE_SIZE
      this.crates.set(c.id, s)
      this.back.addChild(s)
    }

    // --- Líquido por delante: tinte sobre quien nada y la ola del agua ---
    const liquidFront = new Container()
    for (const kind of ['lava', 'sludge'] as const) {
      for (const run of runs(level, (k) => k === kind)) {
        const surface = tileAt(level, run.c0, run.row - 1) !== kind
        const overlay = new Graphics()
          .rect(run.c0 * TILE, run.row * TILE + (surface ? 16 : 0), (run.c1 - run.c0 + 1) * TILE, TILE - (surface ? 16 : 0))
          .fill({ color: kind === 'lava' ? 0xf97316 : 0x6b21a8, alpha: 0.35 })
        liquidFront.addChild(overlay)
      }
    }
    liquidFront.addChild(this.water)
    this.front.addChild(liquidFront)
  }

  /** Plataforma de 3 piezas (punta, centro estirado, punta). */
  private threeSlice(run: Run, prefix: 'float' | 'branch', height: number, dy: number): Container {
    const t = this.assets.terrain.textures
    const c = new Container()
    const x = run.c0 * TILE
    const w = (run.c1 - run.c0 + 1) * TILE
    const left = sized(t[`${prefix}-left`], height)
    const right = sized(t[`${prefix}-right`], height)
    const capW = Math.min(left.width, w / 3)
    left.width = capW
    right.width = Math.min(right.width, w / 3)
    right.anchor.set(0, 0)
    const mid = sized(t[`${prefix}-mid`], height)
    mid.x = x + capW - 2
    mid.width = w - capW - right.width + 4
    left.position.set(x, run.row * TILE + dy)
    mid.y = run.row * TILE + dy
    right.position.set(x + w - right.width, run.row * TILE + dy)
    c.addChild(mid, left, right)
    return c
  }

  update(world: DuoWorldState, crates: Array<{ id: string; x: number; y: number }>, onPedestal: Partial<Record<string, Record<DuoRole, boolean>>>, now: number): void {
    const o = this.assets.objects.textures
    const frame = Math.floor(now / SURFACE_FRAME_MS)
    for (const s of this.surfaces) s.sprite.texture = s.frames[frame % s.frames.length]

    // Agua: cuerpo translúcido y una ola que se mueve.
    const g = this.water.clear()
    for (const run of this.waterRuns) {
      const x0 = run.c0 * TILE
      const x1 = (run.c1 + 1) * TILE
      const y = run.row * TILE
      const surface = tileAt(this.level, run.c0, run.row - 1) !== 'water'
      g.rect(x0, y + (surface ? 6 : 0), x1 - x0, TILE - (surface ? 6 : 0)).fill({ color: 0x0ea5e9, alpha: 0.45 })
      if (surface) {
        g.moveTo(x0, y + 6)
        for (let x = x0; x <= x1; x += 8) g.lineTo(x, y + 6 + Math.sin(x / 26 + now / 260) * 3)
        g.stroke({ color: 0xe0f2fe, width: 3, alpha: 0.9 })
      }
    }

    for (const [id, s] of this.buttons) s.texture = world.switches[id] ? o['button-down'] : o['button-up']
    for (const [id, s] of this.levers) s.texture = world.switches[id] ? o['lever-on'] : o['lever-off']

    for (const b of this.level.def.bridges) {
      const on = isConditionMet(b.when, world.switches)
      const gfx = this.bridges.get(b.id)!
      const r = bridgeRect(b)
      if (this.bridgeOn.get(b.id) !== on) {
        this.bridgeOn.set(b.id, on)
        gfx.clear()
        if (on) {
          gfx
            .roundRect(r.x - 4, r.y - 4, r.w + 8, BRIDGE_H + 8, 8)
            .fill({ color: 0x22d3ee, alpha: 0.25 })
            .roundRect(r.x, r.y, r.w, BRIDGE_H, 6)
            .fill({ color: 0x67e8f9, alpha: 0.9 })
            .rect(r.x + 4, r.y + 4, r.w - 8, 3)
            .fill({ color: 0xffffff, alpha: 0.9 })
        } else {
          for (let x = r.x; x < r.x + r.w; x += 22) gfx.rect(x, r.y + 6, 12, 3).fill({ color: 0x67e8f9, alpha: 0.35 })
        }
      }
      gfx.alpha = on ? 0.85 + Math.sin(now / 200) * 0.15 : 1
    }

    for (const [id, gate] of this.gates) {
      const open = !!world.gates[id]
      if (open !== gate.opened) {
        gate.opened = open
        gate.door.texture = open ? o['door-open'] : o['door-closed']
      }
      gate.barrier.alpha = open ? Math.max(0, gate.barrier.alpha - 0.04) : 0.8 + Math.sin(now / 300) * 0.2
    }

    for (const [gateId, pair] of this.pedestals) {
      const active = onPedestal[gateId]
      for (const role of ['FIRE', 'WATER'] as const) {
        const on = !!active?.[role]
        pair[role].glow.visible = on
        pair[role].glow.alpha = 0.7 + Math.sin(now / 180) * 0.3
        pair[role].sprite.tint = on ? 0xffffff : 0xd4d4d8
      }
    }

    for (const [id, { sprite: coin, baseY }] of this.coins) {
      const taken = !!world.coins[id]
      if (taken && coin.visible) {
        // Al recogerla crece, sube y se desvanece.
        coin.scale.set(coin.scale.x * 1.06)
        coin.y -= 2
        coin.alpha -= 0.06
        if (coin.alpha <= 0) coin.visible = false
      }
      if (!taken) coin.y = baseY + Math.sin(now / 300 + coin.x) * 4
    }

    for (const c of crates) {
      const s = this.crates.get(c.id)
      s?.position.set(c.x, c.y)
    }

    if (this.portal) {
      this.portal.rotation = now / 1400
      this.portalGlow.alpha = 0.6 + Math.sin(now / 350) * 0.4
    }
  }
}
