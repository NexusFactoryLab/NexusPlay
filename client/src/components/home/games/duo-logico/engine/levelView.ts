import { AnimatedSprite, Container, Graphics, Sprite, Text, TilingSprite, type Texture } from 'pixi.js'
import {
  BRIDGE_H,
  CRATE_SIZE,
  PEDESTAL_H,
  TILE,
  bridgeRect,
  gateWallRect,
  isSolidTile,
  moverRect,
  standPoint,
  tileAt,
  type DuoLevel,
  type TileKind,
} from '../shared/duoLevel'
import { isConditionMet, litMirrorCount } from '../shared/duoWorld'
import type { DuoRole, DuoWorldState } from '../shared/duoTypes'
import type { DuoAssets, DuoThemeAssets } from './duoAssets'
import type { Fx } from './fx'

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

/** 0→1 con un pequeño rebote al final (para lo que "salta" a su lugar). */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Cada cuánto cambia de cuadro la superficie de la lava, el lodo y el agua (ms). */
const SURFACE_FRAME_MS = 180
/** Lo que tarda en formarse (o deshacerse) un puente de luz (ms). */
const BRIDGE_BUILD_MS = 380
/** Cuadros de la puerta al abrirse: cerrada → entreabierta → abierta. */
const DOOR_FRAME_MS = 140
/** Lo que tarda una ficha recogida en subir y desvanecerse (ms). */
const COIN_TAKE_MS = 450

const ROLE_COLORS: Record<DuoRole, number[]> = {
  FIRE: [0xffd166, 0xff9f1c, 0xff6b35],
  WATER: [0xbfefff, 0x7dd3fc, 0x38bdf8],
}

interface LiquidSurface {
  sprite: TilingSprite
  frames: Texture[]
}

interface BridgeView {
  gfx: Graphics
  on: boolean | null
  /** 0 = apagado, 1 = formado; se acerca con el tiempo. */
  progress: number
}

interface Firefly {
  sprite: Sprite
  x: number
  y: number
  phase: number
  speed: number
}

/**
 * Dibuja el escenario: el terreno queda fijo; botones, palancas, puentes,
 * puertas, fichas, cajas y portal se actualizan con el estado del mundo y se
 * animan (y sueltan partículas por `fx`) cuando algo cambia. Capas: `back`
 * (detrás de los personajes) y `front` (líquido por delante, para que quien
 * nada se vea sumergido).
 */
export class LevelView {
  readonly back = new Container()
  readonly front = new Container()
  private readonly surfaces: LiquidSurface[] = []
  private readonly water = new Graphics()
  private readonly waterRuns: Run[]
  private readonly lavaRuns: Run[]
  private readonly sludgeRuns: Run[]
  private readonly buttons = new Map<string, { sprite: Sprite; on: boolean | null; pressedAt: number; baseScale: number }>()
  private readonly levers = new Map<string, { sprite: Sprite; on: boolean | null; flippedAt: number }>()
  private readonly bridges = new Map<string, BridgeView>()
  private readonly gates = new Map<string, { barrier: Container; door: Sprite; opened: boolean | null; openedAt: number; doorX: number; doorY: number }>()
  private readonly pedestals = new Map<string, Record<DuoRole, { sprite: Sprite; glow: Graphics; emitAt: number }>>()
  private readonly coins = new Map<string, { sprite: AnimatedSprite; baseY: number; baseScale: number; takenAt: number | null; glintAt: number }>()
  private readonly crates = new Map<string, { sprite: Sprite; x: number; y: number; dustAt: number }>()
  private portal: AnimatedSprite | null = null
  private portalAt = 0
  private readonly portalGlow = new Graphics()
  private readonly mirrors = new Map<string, { sprite: Sprite; angle: number | null }>()
  private readonly receivers = new Map<string, { sprite: Sprite; on: boolean | null; baseScale: number }>()
  private readonly beam = new Graphics()
  private readonly movers = new Map<string, Sprite>()
  private readonly sparks = new Graphics()
  private readonly sparkRuns: Run[] = []
  private readonly fireflies: Firefly[] = []
  private ambientAt = 0
  private liquidAt = 0
  /** Lo que se ve en pantalla (coordenadas del mundo), para soltar el ambiente donde se mira. */
  private view = { x: 0, y: 0, w: 1280, h: 720 }

  private readonly assets: DuoAssets
  private readonly theme: DuoThemeAssets
  private readonly level: DuoLevel
  private readonly fx: Fx
  private readonly onShake: (power: number, ms: number) => void

  constructor(assets: DuoAssets, theme: DuoThemeAssets, level: DuoLevel, fx: Fx, onShake: (power: number, ms: number) => void = () => {}) {
    this.assets = assets
    this.theme = theme
    this.level = level
    this.fx = fx
    this.onShake = onShake
    const def = level.def
    const t = theme.terrain.textures
    const o = assets.objects.textures

    // --- Líquidos (detrás) ---
    const liquidBack = new Container()
    this.waterRuns = runs(level, (k) => k === 'water')
    this.lavaRuns = runs(level, (k) => k === 'lava')
    this.sludgeRuns = runs(level, (k) => k === 'sludge')
    for (const kind of ['lava', 'sludge'] as const) {
      const fill = kind === 'lava' ? assets.lava : assets.sludge
      const tops = kind === 'lava' ? assets.lavaTop : assets.sludgeTop
      for (const run of kind === 'lava' ? this.lavaRuns : this.sludgeRuns) {
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
      const dirt = new TilingSprite({ texture: theme.fill, width: w, height: TILE })
      dirt.position.set(x, y)
      dirt.tilePosition.set(-x, -y)
      ground.addChild(dirt)
    }
    const grassRuns = runs(level, (k, col, row) => k === 'ground' && !isSolidTile(tileAt(level, col, row - 1)))
    const grassLayer = new Container()
    for (const run of grassRuns) {
      const x = run.c0 * TILE
      const w = (run.c1 - run.c0 + 1) * TILE
      const grass = new TilingSprite({ texture: theme.top, width: w + 8, height: 46 })
      grass.position.set(x - 4, run.row * TILE - 14)
      grass.tileScale.set(46 / theme.top.frame.height)
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
    for (const run of runs(level, (k) => k === 'branch')) this.back.addChild(this.threeSlice(run, theme.thinPrefix, 40, -12))

    // --- Espinas o chispas (celdas ^) ---
    for (const run of runs(level, (k) => k === 'thorns')) {
      if (theme.hazard === 'electric') {
        this.sparkRuns.push(run)
        continue
      }
      const w = (run.c1 - run.c0 + 1) * TILE
      const thorns = new TilingSprite({ texture: assets.thorns, width: w, height: 46 })
      thorns.position.set(run.c0 * TILE, (run.row + 1) * TILE - 44)
      thorns.tileScale.set(46 / assets.thorns.frame.height)
      this.back.addChild(thorns)
    }
    this.back.addChild(this.sparks)

    // --- Decoración ---
    const decorHeight: Record<string, number> = { flowers: 40, bush: 44, fern: 48, mushroom: 34, rock: 26, panel: 44, sign: 30, battery: 36, valve: 34, beacon: 28 }
    for (const d of def.decor) {
      const texture = t[d.kind]
      if (!texture) continue
      const s = sized(texture, decorHeight[d.kind] ?? 40)
      s.anchor.set(0.5, 1)
      const p = standPoint(d)
      s.position.set(p.x, p.y + 4)
      this.back.addChild(s)
    }

    // --- Objetos ---
    for (const b of def.bridges) {
      const gfx = new Graphics()
      this.bridges.set(b.id, { gfx, on: null, progress: 0 })
      this.back.addChild(gfx)
    }
    for (const b of def.buttons) {
      const s = sized(o['button-up'], 30)
      s.anchor.set(0.5, 1)
      const p = standPoint(b)
      s.position.set(p.x, p.y + 2)
      this.buttons.set(b.id, { sprite: s, on: null, pressedAt: -Infinity, baseScale: s.scale.y })
      this.back.addChild(s)
    }
    for (const l of def.levers) {
      const s = sized(o['lever-off'], 58)
      s.anchor.set(0.5, 1)
      const p = standPoint(l)
      s.position.set(p.x, p.y + 2)
      this.levers.set(l.id, { sprite: s, on: null, flippedAt: -Infinity })
      this.back.addChild(s)
    }
    for (const gate of def.gates) {
      const pair = {} as Record<DuoRole, { sprite: Sprite; glow: Graphics; emitAt: number }>
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
        glow.blendMode = 'add'
        this.back.addChild(glow, sprite)
        pair[role] = { sprite, glow, emitAt: 0 }
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
        this.gates.set(gate.id, { barrier, door, opened: null, openedAt: -Infinity, doorX: door.x, doorY: door.y })
      }
      if (gate.portal) {
        const p = standPoint(gate.portal)
        // Se abre (de perfil a de frente) y luego gira en bucle.
        const opening = assets.objects.animations['portal-open'] ?? assets.objects.animations.portal
        const portal = new AnimatedSprite(opening)
        portal.anchor.set(0.5)
        portal.scale.set(120 / assets.objects.animations.portal[0].frame.height)
        portal.position.set(p.x, p.y - 64)
        portal.animationSpeed = 0.1
        portal.loop = false
        portal.onComplete = () => {
          portal.textures = assets.objects.animations.portal
          portal.loop = true
          portal.animationSpeed = 0.12
          portal.play()
        }
        portal.play()
        this.portalGlow.circle(p.x, p.y - 64, 70).fill({ color: 0x5eead4, alpha: 0.18 }).circle(p.x, p.y - 64, 46).fill({ color: 0x99f6e4, alpha: 0.12 })
        this.portalGlow.blendMode = 'add'
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
      this.coins.set(c.id, { sprite: coin, baseY: coin.y, baseScale: coin.scale.x, takenAt: null, glintAt: Math.random() * 2500 })
      this.back.addChild(coin)
    }
    // --- Espejos, receptores y el rayo de luz ---
    const so = theme.objects?.textures ?? {}
    this.beam.blendMode = 'add'
    this.back.addChild(this.beam)
    for (const m of def.mirrors ?? []) {
      const s = sized(so['mirror-0'] ?? o['crate'], 60)
      s.anchor.set(0.5, 1)
      const p = standPoint(m)
      s.position.set(p.x, p.y + 2)
      this.mirrors.set(m.id, { sprite: s, angle: null })
      this.back.addChild(s)
    }
    for (const r of def.receivers ?? []) {
      const s = sized(so['receiver-off'] ?? o['crate'], 34)
      s.anchor.set(0.5, 1)
      const p = standPoint(r)
      s.position.set(p.x, p.y + 2)
      this.receivers.set(r.id, { sprite: s, on: null, baseScale: s.scale.x })
      this.back.addChild(s)
    }
    // --- Plataformas móviles ---
    for (const m of def.movers ?? []) {
      const s = new Sprite(so['mover'] ?? o['crate'])
      s.width = m.width * TILE
      s.height = 30
      this.movers.set(m.id, s)
      this.back.addChild(s)
    }

    for (const c of def.crates) {
      const s = new Sprite(o.crate)
      s.anchor.set(0)
      s.width = CRATE_SIZE
      s.height = CRATE_SIZE
      this.crates.set(c.id, { sprite: s, x: Number.NaN, y: Number.NaN, dustAt: 0 })
      this.back.addChild(s)
    }

    // --- Ambiente: luciérnagas en el bosque ---
    if (def.theme === 'bosque') {
      const count = Math.round(level.cols / 4)
      for (let i = 0; i < count; i++) {
        const sprite = new Sprite(fx.textures.soft)
        sprite.anchor.set(0.5)
        sprite.tint = i % 3 === 0 ? 0xfff3a0 : 0xd9f99d
        sprite.blendMode = 'add'
        sprite.scale.set(0.45)
        const col = (i + 0.5) * (level.cols / count)
        this.fireflies.push({ sprite, x: col * TILE, y: (3 + Math.random() * 6) * TILE, phase: Math.random() * 100, speed: 0.6 + Math.random() * 0.8 })
        this.back.addChild(sprite)
      }
    }

    // --- Líquido por delante: tinte sobre quien nada, el agua y su ola ---
    const liquidFront = new Container()
    for (const kind of ['lava', 'sludge'] as const) {
      for (const run of kind === 'lava' ? this.lavaRuns : this.sludgeRuns) {
        const surface = tileAt(level, run.c0, run.row - 1) !== kind
        const overlay = new Graphics()
          .rect(run.c0 * TILE, run.row * TILE + (surface ? 16 : 0), (run.c1 - run.c0 + 1) * TILE, TILE - (surface ? 16 : 0))
          .fill({ color: kind === 'lava' ? 0xf97316 : 0x6b21a8, alpha: 0.35 })
        liquidFront.addChild(overlay)
      }
    }
    if (assets.water && assets.waterTop.length > 0) {
      // Agua dibujada (translúcida): quien nada queda detrás, como sumergido.
      for (const run of this.waterRuns) {
        const x = run.c0 * TILE
        const w = (run.c1 - run.c0 + 1) * TILE
        const surface = tileAt(level, run.c0, run.row - 1) !== 'water'
        const body = new TilingSprite({ texture: assets.water, width: w, height: TILE + (surface ? -22 : 0) })
        body.position.set(x, run.row * TILE + (surface ? 22 : 0))
        body.tilePosition.set(-body.x, -body.y)
        body.alpha = 0.92
        liquidFront.addChild(body)
        if (surface) {
          const top = new TilingSprite({ texture: assets.waterTop[0], width: w, height: 52 })
          top.position.set(x, run.row * TILE - 16)
          top.tileScale.set(52 / assets.waterTop[0].frame.height)
          liquidFront.addChild(top)
          this.surfaces.push({ sprite: top, frames: assets.waterTop })
        }
      }
    } else {
      liquidFront.addChild(this.water)
    }
    this.front.addChild(liquidFront)
  }

  /** Lo que se ve en pantalla (coordenadas del mundo), para soltar el ambiente cerca de la cámara. */
  setView(x: number, y: number, w: number, h: number): void {
    this.view = { x, y, w, h }
  }

  /**
   * La luz baja de la fuente al primer espejo y sigue por cada espejo bien
   * orientado; si llega al receptor, todo el camino brilla.
   */
  private drawBeam(world: DuoWorldState, now: number): void {
    const g = this.beam.clear()
    const def = this.level.def
    if (!def.lightSource) return
    const center = (cell: { col: number; row: number }, dy: number) => ({ x: cell.col * TILE + TILE / 2, y: cell.row * TILE + dy })
    for (const receiver of def.receivers ?? []) {
      const lit = litMirrorCount(this.level, world, receiver.id)
      const points = [center(def.lightSource, TILE / 2)]
      for (let i = 0; i < receiver.mirrors.length && i <= lit; i++) {
        const mirror = (def.mirrors ?? []).find((m) => m.id === receiver.mirrors[i])
        if (mirror) points.push(center(mirror, 30))
      }
      const reached = lit === receiver.mirrors.length
      if (reached) points.push(center(receiver, 44))
      const pulse = 0.75 + Math.sin(now / 120) * 0.25
      for (const [width, color, alpha] of [[16, 0xfde68a, 0.25], [6, 0xfef08a, 0.85], [2, 0xffffff, 1]] as const) {
        g.moveTo(points[0].x, points[0].y)
        for (const p of points.slice(1)) g.lineTo(p.x, p.y)
        g.stroke({ color, width, alpha: alpha * (reached ? 1 : 0.7) * pulse })
      }
    }
    const sun = center(def.lightSource, TILE / 2)
    g.circle(sun.x, sun.y, 34).fill({ color: 0xfef9c3, alpha: 0.35 }).circle(sun.x, sun.y, 22).fill({ color: 0xfde047, alpha: 0.95 })
  }

  /**
   * Plataforma de 3 piezas (punta, centro repetido, punta). Las tres salen del
   * mismo dibujo y se escalan igual (el centro mide `height`), alineadas por
   * arriba: calzan sin escalón aunque las puntas bajen más que el centro.
   */
  private threeSlice(run: Run, prefix: string, height: number, dy: number): Container {
    const t = this.theme.terrain.textures
    const c = new Container()
    const x = run.c0 * TILE
    const y = run.row * TILE + dy
    const w = (run.c1 - run.c0 + 1) * TILE
    const midTexture = t[`${prefix}-mid`]
    const k = height / midTexture.frame.height
    const left = new Sprite(t[`${prefix}-left`])
    const right = new Sprite(t[`${prefix}-right`])
    left.anchor.set(0, 0)
    right.anchor.set(0, 0)
    left.scale.set(k)
    right.scale.set(k)
    // En una plataforma angosta, cada punta ocupa a lo sumo un tercio (se angosta, no se aplana).
    if (left.width > w / 3) left.width = w / 3
    if (right.width > w / 3) right.width = w / 3
    left.position.set(x, y)
    right.position.set(x + w - right.width, y)
    // El centro se repite (copias del mismo trozo, que empalma consigo mismo).
    const span = w - left.width - right.width + 4
    const piece = midTexture.frame.width * k
    const copies = Math.max(1, Math.round(span / piece))
    for (let i = 0; i < copies; i++) {
      const mid = new Sprite(midTexture)
      mid.anchor.set(0, 0)
      mid.scale.set(k)
      mid.width = span / copies + 1
      mid.position.set(x + left.width - 2 + (i * span) / copies, y)
      c.addChild(mid)
    }
    c.addChild(left, right)
    return c
  }

  /** `time`: segundos del reloj del servidor (plataformas móviles); `now`: hora local (ms). */
  update(
    world: DuoWorldState,
    crates: Array<{ id: string; x: number; y: number }>,
    onPedestal: Partial<Record<string, Record<DuoRole, boolean>>>,
    now: number,
    time: number,
    dtMs = 16,
  ): void {
    const o = this.assets.objects.textures
    const so = this.theme.objects?.textures ?? {}
    for (const m of this.level.def.movers ?? []) {
      const r = moverRect(m, time)
      this.movers.get(m.id)?.position.set(r.x, r.y - 6)
    }
    for (const m of this.level.def.mirrors ?? []) {
      const angle = world.mirrors[m.id] ?? 0
      const view = this.mirrors.get(m.id)
      const texture = so['mirror-' + angle]
      if (!view || !texture) continue
      if (view.angle !== null && view.angle !== angle) {
        // Al girarlo: un destello en el espejo.
        const p = standPoint(m)
        this.fx.burst({ x: p.x, y: p.y - 34, count: 10, texture: 'star', tint: [0xffffff, 0xfef08a], speed: [60, 160], angle: [0, Math.PI * 2], life: [260, 420], scale: [0.7, 0.1], glow: true, drag: 3 })
      }
      view.angle = angle
      view.sprite.texture = texture
    }
    this.drawBeam(world, now)
    for (const r of this.level.def.receivers ?? []) {
      const on = !!world.switches[r.id]
      const view = this.receivers.get(r.id)
      const texture = so[on ? 'receiver-on' : 'receiver-off']
      if (!view || !texture) continue
      if (view.on === false && on) {
        const p = standPoint(r)
        this.fx.burst({ x: p.x, y: p.y - 18, count: 18, texture: 'star', tint: [0xfef08a, 0xbef264, 0xffffff], speed: [80, 220], angle: [-Math.PI, 0], life: [400, 700], scale: [0.8, 0.1], glow: true, gravity: 220 })
      }
      view.on = on
      view.sprite.texture = texture
      // Encendido, late.
      view.sprite.scale.set(view.baseScale * (on ? 1 + Math.sin(now / 160) * 0.035 : 1))
    }
    this.updateSparks(now)
    const frame = Math.floor(now / SURFACE_FRAME_MS)
    for (const s of this.surfaces) s.sprite.texture = s.frames[frame % s.frames.length]
    if (!this.assets.water) this.drawWater(now)
    this.updateLiquids(now)

    for (const [id, b] of this.buttons) {
      const on = !!world.switches[id]
      if (b.on !== null && on !== b.on) {
        b.pressedAt = now
        const p = b.sprite.position
        // Al pisarlo: polvo a los lados; al soltarlo, un clic de luz.
        if (on) this.fx.burst({ x: p.x, y: p.y - 4, count: 8, texture: 'soft', tint: [0xe7e5e4, 0xd6d3d1], speed: [40, 110], angle: [-Math.PI, 0], life: [300, 520], scale: [0.35, 0.8], alpha: [0.7, 0], drag: 4, spread: [30, 4] })
        else this.fx.burst({ x: p.x, y: p.y - 14, count: 5, texture: 'star', tint: 0xfca5a5, speed: [40, 90], angle: [-Math.PI, 0], life: [220, 360], scale: [0.5, 0.1], glow: true })
      }
      b.on = on
      b.sprite.texture = on ? o['button-down'] : o['button-up']
      // Se hunde un poco más al pisarlo y rebota a su lugar.
      const k = Math.min(1, (now - b.pressedAt) / 220)
      b.sprite.scale.y = b.baseScale * (k < 1 ? 1 - 0.18 * (1 - easeOutBack(k)) : 1)
    }
    for (const [id, l] of this.levers) {
      const on = !!world.switches[id]
      if (l.on === false && on) {
        l.flippedAt = now
        const p = l.sprite.position
        this.fx.burst({ x: p.x, y: p.y - 40, count: 14, texture: 'star', tint: [0xbef264, 0x4ade80, 0xfef08a], speed: [80, 200], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [380, 620], scale: [0.7, 0.1], glow: true, gravity: 260 })
      }
      l.on = on
      l.sprite.texture = on ? o['lever-on'] : o['lever-off']
      // Al bajarla: se sacude y se queda.
      const k = (now - l.flippedAt) / 420
      l.sprite.rotation = k < 1 ? Math.sin(k * Math.PI * 4) * 0.12 * (1 - k) : 0
    }

    for (const b of this.level.def.bridges) {
      const on = isConditionMet(b.when, world.switches)
      const view = this.bridges.get(b.id)!
      const r = bridgeRect(b)
      const wasOn = view.on
      view.on = on
      // Se forma (o se deshace) de a poco desde un extremo.
      const target = on ? 1 : 0
      const before = view.progress
      view.progress = wasOn === null ? target : Math.max(0, Math.min(1, view.progress + (on ? 1 : -1) * (dtMs / BRIDGE_BUILD_MS)))
      if (view.progress !== before) {
        const edgeX = r.x + r.w * view.progress
        this.fx.burst({ x: edgeX, y: r.y + BRIDGE_H / 2, count: 2, texture: 'star', tint: [0xa5f3fc, 0xffffff], speed: [30, 120], angle: [-Math.PI, Math.PI], life: [240, 420], scale: [0.6, 0.1], glow: true })
      }
      this.drawBridge(view, r, now)
    }

    for (const [id, gate] of this.gates) {
      const open = !!world.gates[id]
      if (gate.opened === false && open) {
        gate.openedAt = now
        // Se abre: polvo en la base, chispas violeta y un temblor.
        this.fx.burst({ x: gate.doorX, y: gate.doorY - 6, count: 22, texture: 'soft', tint: [0xd6d3d1, 0xa8a29e, 0xe7e5e4], speed: [60, 200], angle: [-Math.PI, 0], life: [500, 900], scale: [0.5, 1.4], alpha: [0.75, 0], drag: 2.5, spread: [70, 10] })
        this.fx.burst({ x: gate.doorX, y: gate.doorY - 120, count: 26, texture: 'star', tint: [0xc4b5fd, 0xa78bfa, 0xffffff], speed: [60, 220], angle: [-Math.PI, Math.PI], life: [500, 900], scale: [0.8, 0.1], glow: true, gravity: 120, spread: [30, 140] })
        this.onShake(7, 380)
      }
      if (gate.opened === null && open) gate.openedAt = -Infinity
      gate.opened = open
      const since = now - gate.openedAt
      gate.door.texture = !open ? o['door-closed'] : since < DOOR_FRAME_MS ? o['door-closed'] : since < DOOR_FRAME_MS * 2 ? (o['door-half'] ?? o['door-open']) : o['door-open']
      // La barrera se desvanece; cerrada, late.
      gate.barrier.alpha = open ? Math.max(0, gate.barrier.alpha - dtMs / 400) : 0.8 + Math.sin(now / 300) * 0.2
    }

    for (const [gateId, pair] of this.pedestals) {
      const active = onPedestal[gateId]
      for (const role of ['FIRE', 'WATER'] as const) {
        const on = !!active?.[role]
        const ped = pair[role]
        ped.glow.visible = on
        ped.glow.alpha = 0.7 + Math.sin(now / 180) * 0.3
        ped.sprite.tint = on ? 0xffffff : 0xd4d4d8
        if (on && now >= ped.emitAt) {
          // Llamitas o burbujas que suben del pedestal ocupado.
          ped.emitAt = now + 90
          const p = ped.sprite.position
          this.fx.burst(
            role === 'FIRE'
              ? { x: p.x, y: p.y - PEDESTAL_H, count: 1, texture: 'soft', tint: ROLE_COLORS.FIRE, speed: [40, 90], angle: [-Math.PI * 0.6, -Math.PI * 0.4], life: [500, 800], scale: [0.55, 0.1], glow: true, spread: [34, 4] }
              : { x: p.x, y: p.y - PEDESTAL_H, count: 1, texture: 'ring', tint: ROLE_COLORS.WATER, speed: [30, 70], angle: [-Math.PI * 0.6, -Math.PI * 0.4], life: [600, 900], scale: [0.5, 0.9], alpha: [0.9, 0], sway: 4, spread: [34, 4] },
          )
        }
      }
    }

    for (const [id, coin] of this.coins) {
      const taken = !!world.coins[id]
      const s = coin.sprite
      if (taken && coin.takenAt === null) {
        coin.takenAt = now
        // Al recogerla: estalla en destellos dorados.
        this.fx.burst({ x: s.x, y: s.y, count: 18, texture: 'star', tint: [0xfde047, 0xfacc15, 0xffffff], speed: [90, 240], angle: [0, Math.PI * 2], life: [380, 680], scale: [0.85, 0.1], glow: true, drag: 2.5 })
        this.fx.burst({ x: s.x, y: s.y, count: 1, texture: 'ring', tint: 0xfde047, speed: 0, angle: 0, life: 380, scale: [1, 4.5], alpha: [0.9, 0], glow: true })
      }
      if (!taken) {
        coin.takenAt = null
        s.visible = true
        s.alpha = 1
        s.scale.set(coin.baseScale)
        s.y = coin.baseY + Math.sin(now / 300 + s.x) * 4
        // De vez en cuando, un destello.
        if (now >= coin.glintAt) {
          coin.glintAt = now + 2200 + Math.random() * 1800
          this.fx.burst({ x: s.x + 8, y: s.y - 10, count: 1, texture: 'star', tint: 0xffffff, speed: 0, angle: 0, life: 420, scale: [0.2, 0.9], alpha: [1, 0], glow: true, spin: 3 })
        }
      } else if (coin.takenAt !== null) {
        // Sube, crece y se desvanece (por tiempo, igual a cualquier velocidad de pantalla).
        const k = Math.min(1, (now - coin.takenAt) / COIN_TAKE_MS)
        s.y = coin.baseY - 40 * k
        s.scale.set(coin.baseScale * (1 + 0.5 * k))
        s.alpha = 1 - k
        s.visible = k < 1
      }
    }

    for (const c of crates) {
      const view = this.crates.get(c.id)
      if (!view) continue
      // Al arrastrarla por el piso, polvo en la base.
      const moved = Math.abs(c.x - view.x)
      if (moved > 0.4 && Math.abs(c.y - view.y) < 0.5 && now >= view.dustAt) {
        view.dustAt = now + 110
        const behind = c.x > view.x ? c.x + 4 : c.x + CRATE_SIZE - 4
        this.fx.burst({ x: behind, y: c.y + CRATE_SIZE - 2, count: 2, texture: 'soft', tint: [0xd6d3d1, 0xa8a29e], speed: [20, 60], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [300, 520], scale: [0.3, 0.7], alpha: [0.6, 0], drag: 3 })
      }
      view.x = c.x
      view.y = c.y
      view.sprite.position.set(c.x, c.y)
    }

    if (this.portal) {
      this.portal.rotation = now / 1400
      this.portalGlow.alpha = 0.6 + Math.sin(now / 350) * 0.4
      if (now >= this.portalAt) {
        // Chispas que giran hacia el centro.
        this.portalAt = now + 110
        const a = Math.random() * Math.PI * 2
        const r = 62
        this.fx.burst({ x: this.portal.x + Math.cos(a) * r, y: this.portal.y + Math.sin(a) * r, count: 1, texture: 'star', tint: [0x99f6e4, 0x5eead4, 0xffffff], speed: 70, angle: a + Math.PI * 0.75, life: 700, scale: [0.7, 0.05], glow: true, spin: 4 })
      }
    }

    this.updateAmbient(now)
  }

  /** Puente de luz: brilla, tiene un reflejo que corre y se forma desde la izquierda. */
  private drawBridge(view: BridgeView, r: { x: number; y: number; w: number }, now: number): void {
    const g = view.gfx.clear()
    if (view.progress <= 0) {
      // Apagado: solo la guía punteada de dónde aparecerá.
      for (let x = r.x; x < r.x + r.w; x += 22) g.rect(x, r.y + 6, 12, 3).fill({ color: 0x67e8f9, alpha: 0.35 })
      g.alpha = 1
      return
    }
    const w = r.w * view.progress
    g.roundRect(r.x - 4, r.y - 4, w + 8, BRIDGE_H + 8, 8)
      .fill({ color: 0x22d3ee, alpha: 0.25 })
      .roundRect(r.x, r.y, w, BRIDGE_H, 6)
      .fill({ color: 0x67e8f9, alpha: 0.9 })
      .rect(r.x + 4, r.y + 4, Math.max(0, w - 8), 3)
      .fill({ color: 0xffffff, alpha: 0.9 })
    // Reflejo que corre a lo largo.
    const shine = ((now / 900) % 1) * (w + 60) - 30
    if (shine > 0 && shine < w) g.rect(r.x + shine, r.y + 2, 18, BRIDGE_H - 4).fill({ color: 0xffffff, alpha: 0.45 })
    g.alpha = 0.85 + Math.sin(now / 200) * 0.15
  }

  /** Chispas que saltan por el piso electrificado. */
  private updateSparks(now: number): void {
    const sg = this.sparks.clear()
    for (const run of this.sparkRuns) {
      const x0 = run.c0 * TILE
      const x1 = (run.c1 + 1) * TILE
      const base = (run.row + 1) * TILE - 18
      for (const [color, width, phase] of [[0xfde047, 4, 0], [0xffffff, 1.5, 1.7]] as const) {
        sg.moveTo(x0, base)
        for (let x = x0; x <= x1; x += 14) sg.lineTo(x, base + Math.sin(x * 0.9 + now / 60 + phase) * 9 * Math.sin(now / 140 + x))
        sg.stroke({ color, width, alpha: 0.9 })
      }
      sg.rect(x0, base + 8, x1 - x0, 12).fill({ color: 0xfacc15, alpha: 0.18 + Math.sin(now / 90) * 0.08 })
    }
  }

  /** Agua dibujada a mano (si no cargó su textura): cuerpo translúcido y una ola. */
  private drawWater(now: number): void {
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
  }

  /** Brasas que suben de la lava, burbujas del lodo y del agua, chispas eléctricas. */
  private updateLiquids(now: number): void {
    if (now < this.liquidAt || this.fx.count > 300) return
    this.liquidAt = now + 120
    const visible = (run: Run) => (run.c1 + 1) * TILE > this.view.x - 64 && run.c0 * TILE < this.view.x + this.view.w + 64
    const surfaceY = (run: Run) => run.row * TILE + 6
    const top = (rs: Run[]) => rs.filter((r) => visible(r) && (r.row === 0 || tileAt(this.level, r.c0, r.row - 1) !== tileAt(this.level, r.c0, r.row)))
    for (const run of top(this.lavaRuns)) {
      if (Math.random() > 0.55) continue
      const x = (run.c0 + Math.random() * (run.c1 - run.c0 + 1)) * TILE
      this.fx.burst({ x, y: surfaceY(run), count: 1, texture: 'dot', tint: [0xffd166, 0xff9f1c, 0xff6b35], speed: [50, 130], angle: [-Math.PI * 0.62, -Math.PI * 0.38], life: [700, 1200], scale: [0.7, 0.15], glow: true, gravity: -20, sway: 6 })
    }
    for (const run of top(this.sludgeRuns)) {
      if (Math.random() > 0.4) continue
      const x = (run.c0 + Math.random() * (run.c1 - run.c0 + 1)) * TILE
      this.fx.burst({ x, y: surfaceY(run) + 4, count: 1, texture: 'ring', tint: [0xa3e635, 0xc084fc], speed: [8, 24], angle: -Math.PI / 2, life: [500, 800], scale: [0.4, 1.3], alpha: [0.95, 0] })
    }
    for (const run of top(this.waterRuns)) {
      if (Math.random() > 0.35) continue
      const x = (run.c0 + Math.random() * (run.c1 - run.c0 + 1)) * TILE
      this.fx.burst({ x, y: surfaceY(run) + 40, count: 1, texture: 'ring', tint: [0xe0f2fe, 0xbae6fd], speed: [30, 60], angle: -Math.PI / 2, life: [600, 900], scale: [0.35, 0.6], alpha: [0.8, 0], sway: 3 })
    }
    for (const run of this.sparkRuns) {
      if (!visible(run) || Math.random() > 0.5) continue
      const x = (run.c0 + Math.random() * (run.c1 - run.c0 + 1)) * TILE
      this.fx.burst({ x, y: (run.row + 1) * TILE - 18, count: 3, texture: 'dot', tint: [0xfef08a, 0xffffff], speed: [80, 220], angle: [-Math.PI * 0.85, -Math.PI * 0.15], life: [180, 320], scale: [0.45, 0.1], glow: true, gravity: 600 })
    }
  }

  /** Luciérnagas y hojas en el bosque; motas de polvo y destellos en la planta solar. */
  private updateAmbient(now: number): void {
    for (const f of this.fireflies) {
      const t = now / 1000 * f.speed + f.phase
      f.sprite.position.set(f.x + Math.sin(t * 0.7) * 46 + Math.sin(t * 1.9) * 12, f.y + Math.cos(t * 0.9) * 28)
      // Se prenden y se apagan despacio.
      f.sprite.alpha = 0.25 + 0.75 * Math.max(0, Math.sin(t * 1.3))
    }
    if (now < this.ambientAt || this.fx.count > 280) return
    const v = this.view
    if (this.level.def.theme === 'bosque') {
      this.ambientAt = now + 900 + Math.random() * 900
      // Una hoja que cae meciéndose desde arriba de lo que se ve.
      this.fx.burst({ x: v.x + Math.random() * v.w, y: v.y - 20, count: 1, texture: 'leaf', tint: [0x84cc16, 0x65a30d, 0xa3e635, 0xeab308], speed: [20, 50], angle: [Math.PI * 0.3, Math.PI * 0.7], life: [5000, 7500], scale: [0.9, 0.8], alpha: [0.95, 0.6], gravity: 6, spin: [-1.6, 1.6], sway: 40 })
    } else {
      this.ambientAt = now + 260 + Math.random() * 260
      // Motas que flotan con el calor.
      this.fx.burst({ x: v.x + Math.random() * v.w, y: v.y + v.h * (0.3 + Math.random() * 0.6), count: 1, texture: 'soft', tint: [0xfff7d6, 0xfde68a], speed: [6, 20], angle: [-Math.PI * 0.75, -Math.PI * 0.25], life: [2500, 4000], scale: [0.25, 0.1], alpha: [0.7, 0], glow: true, sway: 10 })
    }
  }
}
