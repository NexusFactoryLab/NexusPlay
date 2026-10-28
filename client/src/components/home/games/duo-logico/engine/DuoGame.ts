import { Application, Container, Graphics, TilingSprite } from 'pixi.js'
import { crateSpawn, mirrorRect, standPoint, type DuoLevel } from '../shared/duoLevel'
import { STEP, createPlayer, stepCrate, stepPlayer, toNet, type CrateSim, type DeathCause, type PlayerSim } from '../shared/duoPhysics'
import { checkpointFor, collectCoins, isOnPedestal, litMirrorCount, updateSwitches } from '../shared/duoWorld'
import { otherRole, type DuoEmote, type DuoPlayerNet, type DuoRole, type DuoSnapshot, type DuoWorldState } from '../shared/duoTypes'
import type { DuoPhase } from '../shared/duoProtocol'
import { CharacterView } from './characterView'
import { loadDuoAssets, loadThemeAssets, type DuoAssets, type DuoThemeAssets } from './duoAssets'
import { DuoInputState } from './duoInput'
import { LevelView } from './levelView'
import { SnapshotBuffer } from './snapshotBuffer'

/** Cada cuánto se manda la posición propia (ms): 20 por segundo. */
const SEND_EVERY_MS = 50
/** Una caja empujada sigue siendo "mía" este tiempo después del último empujón. */
const CRATE_HOLD_MS = 350
/** Tras soltar una caja, se espera hasta este tiempo a que el servidor confirme dónde quedó (sin rebotar). */
const CRATE_SETTLE_MS = 1000
/** Distancia (px) a la que aparece el panel de un espejo; la misma que acepta el servidor. */
const MIRROR_REACH = 80

/** Espejo junto al que está el personaje, para el panel de React. */
export interface NearMirror {
  id: string
  angle: number
  /** El espejo ya apunta bien. */
  aligned: boolean
  /** La luz llega hasta este espejo (los anteriores están bien). */
  lit: boolean
}

/** Celdas de alto que se quieren ver (la cámara acerca o aleja según la pantalla). */
const VIEW_ROWS = 10.5

export interface DuoGameOptions {
  level: DuoLevel
  role: DuoRole
  names: Record<DuoRole, string>
  /** `reliable`: el envío no puede perderse (p. ej. al soltar una caja). */
  sendState: (state: { player: DuoPlayerNet; crates: Array<{ id: string; x: number; y: number }> }, reliable?: boolean) => void
  onFainted?: (role: DuoRole, cause: DeathCause | null) => void
  /** Cambió el espejo cercano (o su ángulo); null al alejarse. */
  onNearMirror?: (mirror: NearMirror | null) => void
}

/**
 * El juego en el navegador: simula al personaje propio (respuesta inmediata),
 * dibuja al compañero con las posiciones que reparte el servidor y pinta todo
 * con Pixi. React solo le pasa la fase de la sala y las posiciones; nunca toca
 * el canvas.
 */
export class DuoGame {
  readonly input = new DuoInputState()
  private app: Application | null = null
  private assets!: DuoAssets
  private theme!: DuoThemeAssets
  /** Diferencia del reloj del servidor que trae la vista de la sala (antes de la primera posición). */
  private clockSkew = 0
  private readonly worldLayer = new Container()
  private readonly hud = new Container()
  private background!: TilingSprite
  private levelView!: LevelView
  private views = {} as Record<DuoRole, CharacterView>
  private readonly partnerArrow = new Graphics()

  private me: PlayerSim
  private crates: CrateSim[]
  /** Cajas que mueve el compañero (o nadie): se interpolan igual que su personaje. */
  private crateTracks = new Map<string, SnapshotBuffer<{ x: number; y: number }>>()
  private ownedUntil = new Map<string, number>()
  /** Cajas que acabo de soltar (hora local de cuando las solté). */
  private releasedAt = new Map<string, number>()
  /** Cajas que mandé en el último envío, para avisar con un envío seguro cuando las suelto. */
  private lastSentCrates = new Set<string>()
  private serverWorld: DuoWorldState
  private localWorld: DuoWorldState
  private readonly partner = new SnapshotBuffer()
  private partnerDead = false
  /** Al entrar a mitad de partida (recargar la página), el personaje retoma donde estaba. */
  private resumeFromServer = true
  private phase: DuoPhase = 'WAITING'
  private runId = -1
  private accumulator = 0
  private sinceSend = 0
  private cam = { x: 0, y: 0, ready: false }
  private destroyed = false
  /** Mientras el panel del espejo está abierto, el personaje no se mueve. */
  private frozen = false
  private nearMirrorKey = ''

  private readonly options: DuoGameOptions

  constructor(options: DuoGameOptions) {
    this.options = options
    this.me = createPlayer(options.role, standPoint(options.level.def.spawns[options.role]))
    this.crates = this.freshCrates()
    this.serverWorld = this.emptyWorld()
    this.localWorld = this.emptyWorld()
  }

  private get level(): DuoLevel {
    return this.options.level
  }

  private get role(): DuoRole {
    return this.options.role
  }

  private emptyWorld(): DuoWorldState {
    const switches: Record<string, boolean> = {}
    for (const b of this.level.def.buttons) switches[b.id] = false
    for (const l of this.level.def.levers) switches[l.id] = false
    const mirrors = Object.fromEntries((this.level.def.mirrors ?? []).map((m) => [m.id, m.start]))
    return { switches, crates: this.crates.map((c) => ({ id: c.id, x: c.x, y: c.y, owner: null })), coins: {}, gates: {}, mirrors }
  }

  private freshCrates(): CrateSim[] {
    return this.level.def.crates.map((c) => ({ id: c.id, ...crateSpawn(c), vy: 0 }))
  }

  async mount(host: HTMLElement): Promise<void> {
    ;[this.assets, this.theme] = await Promise.all([loadDuoAssets(), loadThemeAssets(this.level.def.theme)])
    if (this.destroyed) return
    const app = new Application()
    await app.init({
      resizeTo: host,
      background: 0x9fd3c7,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })
    if (this.destroyed) {
      app.destroy(true)
      return
    }
    this.app = app
    app.canvas.setAttribute('aria-label', 'Escenario del juego')
    host.appendChild(app.canvas)

    this.background = new TilingSprite({ texture: this.theme.background, width: app.screen.width, height: app.screen.height })
    this.levelView = new LevelView(this.assets, this.theme, this.level)
    const other = otherRole(this.role)
    this.views[this.role] = new CharacterView(this.assets, this.role, this.options.names[this.role], true)
    this.views[other] = new CharacterView(this.assets, other, this.options.names[other], false)
    this.worldLayer.addChild(this.levelView.back, this.views[other].root, this.views[this.role].root, this.levelView.front)
    this.hud.addChild(this.partnerArrow)
    app.stage.addChild(this.background, this.worldLayer, this.hud)

    this.input.attach()
    app.ticker.add((ticker) => this.frame(ticker.deltaMS))
  }

  destroy(): void {
    this.destroyed = true
    this.input.detach()
    this.app?.destroy(true, { children: true })
    this.app = null
  }

  /** La sala cambió de fase. Un `runId` nuevo es una partida nueva: todo vuelve al inicio. */
  setPhase(phase: DuoPhase, runId: number): void {
    if (runId !== this.runId) {
      // Partida nueva (no la primera vista): todos arrancan del inicio.
      if (this.runId !== -1) this.resumeFromServer = false
      this.runId = runId
      this.me = createPlayer(this.role, standPoint(this.level.def.spawns[this.role]))
      this.crates = this.freshCrates()
      this.crateTracks.clear()
      this.ownedUntil.clear()
      this.releasedAt.clear()
      this.lastSentCrates.clear()
      this.serverWorld = this.emptyWorld()
      this.localWorld = this.emptyWorld()
      this.partner.clear()
      this.cam.ready = false
    }
    this.phase = phase
    this.me.cheering = phase === 'VICTORY'
  }

  applySnapshot(snapshot: DuoSnapshot, receivedAt: number): void {
    this.serverWorld = snapshot.world
    if (this.resumeFromServer) {
      this.resumeFromServer = false
      const mine = snapshot.players[this.role]
      if (mine && !mine.dead) {
        this.me.x = mine.x
        this.me.y = mine.y
        this.cam.ready = false
      }
    }
    const partner = snapshot.players[otherRole(this.role)]
    if (partner) {
      this.partner.push(snapshot.t, partner, receivedAt, snapshot.at?.[otherRole(this.role)] ?? snapshot.t)
      if (partner.dead && !this.partnerDead) this.options.onFainted?.(otherRole(this.role), null)
      this.partnerDead = partner.dead
    }
    const now = performance.now()
    const partnerMoves = (owner: DuoRole | null) => owner === otherRole(this.role)
    for (const crate of snapshot.world.crates) {
      const mine = (this.ownedUntil.get(crate.id) ?? 0) > now
      // Si el servidor dice que la mueve el compañero, se le cede aunque yo la estuviera empujando.
      if (mine && !partnerMoves(crate.owner)) continue
      const local = this.crates.find((c) => c.id === crate.id)
      const released = this.releasedAt.get(crate.id)
      if (released !== undefined && !partnerMoves(crate.owner) && local) {
        // Recién soltada: el servidor puede traer aún una posición vieja; se espera a que confirme.
        const confirmed = Math.abs(local.x - crate.x) < 2 && Math.abs(local.y - crate.y) < 2
        if (!confirmed && now - released < CRATE_SETTLE_MS) continue
      }
      this.releasedAt.delete(crate.id)
      this.ownedUntil.delete(crate.id)
      let track = this.crateTracks.get(crate.id)
      if (!track) {
        track = new SnapshotBuffer<{ x: number; y: number }>(this.partner.clock)
        this.crateTracks.set(crate.id, track)
      }
      track.push(snapshot.t, { x: crate.x, y: crate.y }, receivedAt, crate.at ?? snapshot.t)
    }
  }

  /** Diferencia del reloj del servidor según la vista de la sala (ms). */
  setClockSkew(ms: number): void {
    this.clockSkew = ms
  }

  /** Segundos del reloj del servidor, para que los dos vean las plataformas móviles en el mismo lugar. */
  private serverSeconds(): number {
    return (Date.now() + (this.partner.clockOffset() ?? this.clockSkew)) / 1000
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen
    if (frozen) this.me.vx = 0
  }

  showEmote(role: DuoRole, emote: DuoEmote): void {
    this.views[role]?.showEmote(emote, performance.now())
  }

  private frame(deltaMs: number): void {
    const app = this.app
    if (!app) return
    const now = performance.now()
    const playing = this.phase === 'PLAYING'
    // Con el panel del espejo abierto no se simula, pero se sigue contando la posición (quieto).
    const simulating = playing && !this.frozen

    this.accumulator = Math.min(this.accumulator + deltaMs, 250)
    const time = this.serverSeconds()
    let pending = Math.floor(this.accumulator / (STEP * 1000))
    while (pending > 0) {
      this.accumulator -= STEP * 1000
      pending -= 1
      if (simulating) this.simulate(now, time - pending * STEP)
    }

    // Cajas que mueve el otro (o nadie): se dibujan en el mismo instante que su personaje.
    const wallNow = Date.now()
    for (const crate of this.crates) {
      if ((this.ownedUntil.get(crate.id) ?? 0) > now || this.releasedAt.has(crate.id)) continue
      const target = this.crateTracks.get(crate.id)?.sample(wallNow)
      if (!target) continue
      crate.x = target.x
      crate.y = target.y
      crate.vy = 0
    }

    this.localWorld = this.predictWorld()

    if (playing) {
      this.sinceSend += deltaMs
      if (this.sinceSend >= SEND_EVERY_MS) {
        this.sinceSend = 0
        const ownedIds = new Set(this.crates.filter((c) => (this.ownedUntil.get(c.id) ?? 0) > now).map((c) => c.id))
        // Las que acabo de soltar van una última vez, en un envío que no se puede perder.
        const justReleased = [...this.lastSentCrates].filter((id) => !ownedIds.has(id))
        for (const id of justReleased) this.releasedAt.set(id, now)
        const crates = this.crates
          .filter((c) => ownedIds.has(c.id) || justReleased.includes(c.id))
          .map((c) => ({ id: c.id, x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 }))
        this.lastSentCrates = ownedIds
        this.options.sendState({ player: toNet(this.me), crates }, justReleased.length > 0)
      }
    }

    this.render(now, deltaMs, time)
    this.reportNearMirror()
  }

  /** Avisa a React cuando el personaje queda junto a un espejo (o se aleja). */
  private reportNearMirror(): void {
    let near: NearMirror | null = null
    if (this.phase === 'PLAYING' && !this.me.dead) {
      for (const receiver of this.level.def.receivers ?? []) {
        const lit = litMirrorCount(this.level, this.serverWorld, receiver.id)
        receiver.mirrors.forEach((id, index) => {
          const mirror = (this.level.def.mirrors ?? []).find((m) => m.id === id)
          if (!mirror || near) return
          const r = mirrorRect(mirror)
          const dx = Math.max(r.x - this.me.x, 0, this.me.x - (r.x + r.w))
          const dy = Math.max(r.y - this.me.y, 0, this.me.y - (r.y + r.h))
          if (dx > MIRROR_REACH - 10 || dy > MIRROR_REACH - 10) return
          const angle = this.serverWorld.mirrors[id] ?? mirror.start
          near = { id, angle, aligned: angle === mirror.target, lit: index <= lit }
        })
      }
    }
    const current = near as NearMirror | null
    const key = current ? `${current.id}:${current.angle}:${current.lit}` : ''
    if (key === this.nearMirrorKey) return
    this.nearMirrorKey = key
    this.options.onNearMirror?.(current)
  }

  private simulate(now: number, time: number): void {
    const ctx = {
      level: this.level,
      world: this.localWorld,
      crates: this.crates,
      canPush: (id: string) => this.serverWorld.crates.find((c) => c.id === id)?.owner !== otherRole(this.role),
      onPush: (id: string) => this.ownedUntil.set(id, now + CRATE_HOLD_MS),
      respawnAt: standPoint(checkpointFor(this.level, this.serverWorld, this.role)),
      time,
    }
    const event = stepPlayer(this.me, this.input.read(), ctx, STEP)
    if (event?.kind === 'died') this.options.onFainted?.(this.role, event.cause)
    for (const crate of this.crates) {
      if ((this.ownedUntil.get(crate.id) ?? 0) <= now) continue
      if (!stepCrate(this.level, this.localWorld, this.crates, crate, STEP, time)) {
        const def = this.level.def.crates.find((c) => c.id === crate.id)
        if (def) Object.assign(crate, crateSpawn(def), { vy: 0 })
      }
      // Mientras cae, la caja sigue siendo mía hasta asentarse.
      if (crate.vy > 0) this.ownedUntil.set(crate.id, now + CRATE_HOLD_MS)
    }
  }

  /** Mundo del servidor + lo que este cliente ya sabe antes de que llegue la confirmación. */
  private predictWorld(): DuoWorldState {
    const world: DuoWorldState = {
      switches: { ...this.serverWorld.switches },
      crates: this.crates.map((c) => ({ id: c.id, x: c.x, y: c.y, owner: null })),
      coins: { ...this.serverWorld.coins },
      gates: { ...this.serverWorld.gates },
      mirrors: { ...this.serverWorld.mirrors },
    }
    const bodies = { [this.role]: toNet(this.me), [otherRole(this.role)]: this.partnerNow() ?? undefined }
    updateSwitches(this.level, world, bodies)
    // Las palancas no se desactivan: lo que el servidor ya activó sigue activo.
    for (const [id, on] of Object.entries(this.serverWorld.switches)) {
      if (on && this.level.def.levers.some((l) => l.id === id)) world.switches[id] = true
    }
    collectCoins(this.level, world, { [this.role]: toNet(this.me) })
    return world
  }

  private partnerNow(): DuoPlayerNet | null {
    // El mismo reloj con el que se anotó la llegada de los paquetes (Date.now), no performance.now.
    return this.partner.sample(Date.now())
  }

  private render(now: number, deltaMs: number, time: number): void {
    const app = this.app!
    const other = otherRole(this.role)
    const mine = toNet(this.me)
    let partner = this.partnerNow()
    if (!partner) {
      const spawn = standPoint(this.level.def.spawns[other])
      partner = { ...spawn, vx: 0, vy: 0, facing: 1, anim: 'idle', dead: false }
    }
    if (this.phase === 'VICTORY') partner = { ...partner, anim: 'cheer' }
    if (this.phase === 'QUESTION' || this.phase === 'REVEAL' || this.phase === 'COUNTDOWN') {
      if (!mine.dead) mine.anim = 'idle'
    }
    this.views[this.role].update(mine, now, deltaMs)
    this.views[other].update(partner, now, deltaMs)

    const gate = this.level.def.gates.find((g) => !this.serverWorld.gates[g.id])
    const onPedestal = gate ? { [gate.id]: { [this.role]: isOnPedestal(gate, this.role, mine), [other]: isOnPedestal(gate, other, partner) } as Record<DuoRole, boolean> } : {}
    this.levelView.update(this.localWorld, this.crates, onPedestal, now, time)

    // --- Cámara ---
    const sw = app.screen.width
    const sh = app.screen.height
    const zoom = Math.max(0.42, Math.min(1.35, sh / (VIEW_ROWS * 64), sw / (8 * 64)))
    const worldW = this.level.widthPx * zoom
    const worldH = this.level.heightPx * zoom
    const targetX = this.me.x - sw / 2 / zoom + (this.me.facing * 60)
    const targetY = this.me.y - sh * 0.62 / zoom
    if (!this.cam.ready) {
      this.cam.x = targetX
      this.cam.y = targetY
      this.cam.ready = true
    }
    this.cam.x += (targetX - this.cam.x) * Math.min(1, deltaMs / 160)
    this.cam.y += (targetY - this.cam.y) * Math.min(1, deltaMs / 220)
    const maxX = Math.max(0, this.level.widthPx - sw / zoom)
    const camX = Math.max(0, Math.min(maxX, this.cam.x))
    const camY = worldH <= sh ? -(sh / zoom - this.level.heightPx) : Math.max(0, Math.min(this.level.heightPx - sh / zoom, this.cam.y))
    this.worldLayer.scale.set(zoom)
    this.worldLayer.position.set(worldW < sw ? (sw - worldW) / 2 : -camX * zoom, -camY * zoom)

    // Fondo con paralaje: se mueve más lento que el mundo.
    this.background.width = sw
    this.background.height = sh
    const bgScale = sh / this.theme.background.frame.height
    this.background.tileScale.set(bgScale)
    this.background.tilePosition.x = -camX * zoom * 0.3

    this.drawPartnerArrow(partner, zoom, sw, sh)
  }

  /** Flecha en el borde de la pantalla cuando el compañero no se ve. */
  private drawPartnerArrow(partner: DuoPlayerNet, zoom: number, sw: number, sh: number): void {
    const g = this.partnerArrow.clear()
    const px = partner.x * zoom + this.worldLayer.position.x
    const py = (partner.y - 40) * zoom + this.worldLayer.position.y
    const margin = 28
    if (px >= 0 && px <= sw && py >= 0 && py <= sh) return
    const x = Math.max(margin, Math.min(sw - margin, px))
    const y = Math.max(margin + 50, Math.min(sh - margin, py))
    const angle = Math.atan2(py - y, px - x)
    const color = otherRole(this.role) === 'FIRE' ? 0xf97316 : 0x0ea5e9
    g.circle(x, y, 18).fill({ color: 0xffffff, alpha: 0.92 }).stroke({ color, width: 4 })
    const tip = { x: x + Math.cos(angle) * 30, y: y + Math.sin(angle) * 30 }
    const l = { x: x + Math.cos(angle + 0.5) * 18, y: y + Math.sin(angle + 0.5) * 18 }
    const r = { x: x + Math.cos(angle - 0.5) * 18, y: y + Math.sin(angle - 0.5) * 18 }
    g.poly([tip.x, tip.y, l.x, l.y, r.x, r.y]).fill({ color })
    g.circle(x, y, 8).fill({ color })
  }
}
