import { Application, Container, Graphics, TilingSprite } from 'pixi.js'
import { crateSpawn, mirrorRect, moverRect, standPoint, type DuoLevel } from '../shared/duoLevel'
import { STEP, createPlayer, stepCrate, stepPlayer, toNet, type CrateSim, type DeathCause, type PlayerSim } from '../shared/duoPhysics'
import { checkpointFor, collectCoins, collectGems, isOnPedestal, litMirrorCount, updateSwitches } from '../shared/duoWorld'
import { otherRole, type DuoEmote, type DuoPeerState, type DuoPlayerNet, type DuoRole, type DuoSnapshot, type DuoWorldState } from '../shared/duoTypes'
import type { DuoPhase } from '../shared/duoProtocol'
import { CharacterView, isAirborne } from './characterView'
import { loadDuoAssets, loadThemeAssets, type DuoAssets, type DuoThemeAssets } from './duoAssets'
import { DuoInputState } from './duoInput'
import { recordTrace } from './duoTrace'
import { Fx, Shake, makeFxTextures } from './fx'
import { LevelView } from './levelView'
import { SnapshotBuffer } from './snapshotBuffer'

/** Cada cuánto se manda la posición propia (ms): 30 por segundo. */
const SEND_EVERY_MS = 33
/** Duración de un paso de física (ms). */
const STEP_MS = STEP * 1000
/** Si la pestaña estuvo dormida más que esto, no se recupera paso a paso: se retoma desde ahora. */
const MAX_CATCH_UP_MS = 250
/** Un cambio mayor entre dos pasos es un salto (reaparecer): no se suaviza. */
const TELEPORT_PX = 96
/** Lo más que se corrige por cuadro el reloj de las plataformas móviles (ms): sin saltos visibles. */
const MOVER_CLOCK_SLEW_MS = 2
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

/** Colores de cada elemento para sus partículas (brasas de Lumen, gotas de Gota). */
const ELEMENT_COLORS: Record<DuoRole, number[]> = {
  FIRE: [0xffd166, 0xff9f1c, 0xff6b35],
  WATER: [0xbfefff, 0x7dd3fc, 0x38bdf8],
}
const DUST_COLORS = [0xe7e5e4, 0xd6d3d1, 0xc8bfb5]
const CONFETTI_COLORS = [0xfde047, 0xf472b6, 0x60a5fa, 0x4ade80, 0xfb923c, 0xffffff]

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
 *
 * Relojes:
 * - la física avanza a pasos fijos de 1/60 s con su propio reloj, y se dibuja
 *   entre el paso anterior y el último (suave también en pantallas de 90/120 Hz);
 * - el compañero y sus cajas, con el reloj de dibujo de `SnapshotBuffer`;
 * - las plataformas móviles, con la hora del servidor estimada (corregida de a poco).
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
  private fx!: Fx
  private readonly shake = new Shake()
  /** Para los efectos de cada personaje: su estado del cuadro anterior y cuándo soltó partículas. */
  private readonly prevNet: Partial<Record<DuoRole, DuoPlayerNet>> = {}
  private readonly trailAt: Record<DuoRole, number> = { FIRE: 0, WATER: 0 }
  private readonly dustAt: Record<DuoRole, number> = { FIRE: 0, WATER: 0 }
  private cheerAt = 0

  private me: PlayerSim
  private crates: CrateSim[]
  /** Cajas que mueve el compañero (o nadie): se interpolan igual que su personaje. */
  private crateTracks = new Map<string, SnapshotBuffer<{ x: number; y: number }>>()
  /** Básculas: su desplazamiento se interpola con el reloj del compañero (sin saltos de 30 por segundo). */
  private scaleTracks = new Map<string, SnapshotBuffer<{ x: number; y: number }>>()
  private ownedUntil = new Map<string, number>()
  /** Cajas que acabo de soltar (hora local de cuando las solté). */
  private releasedAt = new Map<string, number>()
  /** Cajas que mandé en el último envío, para avisar con un envío seguro cuando las suelto. */
  private lastSentCrates = new Set<string>()
  private serverWorld: DuoWorldState
  private localWorld: DuoWorldState
  private readonly partner = new SnapshotBuffer()
  /** El compañero tal como se dibuja en este cuadro. */
  private partnerDrawn: DuoPlayerNet | null = null
  private partnerDead = false
  /** Al entrar a mitad de partida (recargar la página), el personaje retoma donde estaba. */
  private resumeFromServer = true
  private phase: DuoPhase = 'WAITING'
  private runId = -1
  /** Hora local (performance.now) del último paso de física. */
  private simClock: number | null = null
  /** Hora del servidor (s) del último paso de física: ubica las plataformas móviles. */
  private stepLabel = 0
  /** Posiciones del paso anterior, para dibujar entre pasos. */
  private readonly prevMe = { x: 0, y: 0 }
  private readonly prevCrates = new Map<string, { x: number; y: number }>()
  /** Diferencia con el reloj del servidor que usan las plataformas móviles (ms). */
  private moverOffset: number | null = null
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
    this.prevMe.x = this.me.x
    this.prevMe.y = this.me.y
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
    for (const l of this.level.def.latches ?? []) switches[l.id] = false
    const mirrors = Object.fromEntries((this.level.def.mirrors ?? []).map((m) => [m.id, m.start]))
    const scales = Object.fromEntries((this.level.def.scales ?? []).map((s) => [s.id, 0]))
    return { switches, crates: this.crates.map((c) => ({ id: c.id, x: c.x, y: c.y, owner: null })), coins: {}, gates: {}, mirrors, gems: {}, keys: {}, locks: {}, flags: {}, scales }
  }

  private freshCrates(): CrateSim[] {
    return this.level.def.crates.map((c) => ({ id: c.id, ...crateSpawn(c), vy: 0 }))
  }

  async mount(host: HTMLElement): Promise<void> {
    ;[this.assets, this.theme] = await Promise.all([loadDuoAssets(), loadThemeAssets(this.level.def.theme)])
    if (this.destroyed) return
    // En pantallas táctiles (celulares) se ahorra el suavizado de bordes: con la
    // densidad de esas pantallas casi no se nota y libera trabajo de la GPU.
    const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    const app = new Application()
    await app.init({
      resizeTo: host,
      background: 0x9fd3c7,
      antialias: !touch,
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
    this.fx = new Fx(makeFxTextures(app.renderer))
    this.levelView = new LevelView(this.assets, this.theme, this.level, this.fx, (power, ms) => this.shake.start(power, ms, performance.now()))
    const other = otherRole(this.role)
    this.views[this.role] = new CharacterView(this.assets, this.role, this.options.names[this.role], true)
    this.views[other] = new CharacterView(this.assets, other, this.options.names[other], false)
    this.worldLayer.addChild(this.levelView.back, this.views[other].root, this.views[this.role].root, this.levelView.front, this.fx.layer)
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
      this.prevMe.x = this.me.x
      this.prevMe.y = this.me.y
      this.crates = this.freshCrates()
      this.prevCrates.clear()
      this.crateTracks.clear()
      this.scaleTracks.clear()
      this.ownedUntil.clear()
      this.releasedAt.clear()
      this.lastSentCrates.clear()
      this.serverWorld = this.emptyWorld()
      this.localWorld = this.emptyWorld()
      this.partner.clear()
      this.partnerDrawn = null
      this.fx?.clear()
      delete this.prevNet.FIRE
      delete this.prevNet.WATER
      this.cam.ready = false
    }
    this.phase = phase
    this.me.cheering = phase === 'VICTORY'
  }

  /** Lo que reparte el servidor ~30 veces por segundo: el mundo, las cajas y (de respaldo) las posiciones. */
  applySnapshot(snapshot: DuoSnapshot, receivedAt: number): void {
    this.serverWorld = snapshot.world
    if (this.resumeFromServer) {
      this.resumeFromServer = false
      const mine = snapshot.players[this.role]
      if (mine && !mine.dead) {
        this.me.x = this.prevMe.x = mine.x
        this.me.y = this.prevMe.y = mine.y
        this.cam.ready = false
      }
    }
    const other = otherRole(this.role)
    const partner = snapshot.players[other]
    if (partner) this.takePartner(partner, snapshot.t, snapshot.at?.[other] ?? snapshot.t, receivedAt)
    for (const crate of snapshot.world.crates) {
      this.takeCrate(crate.id, crate.x, crate.y, crate.owner, snapshot.t, crate.at ?? snapshot.t, receivedAt)
    }
    for (const [id, offset] of Object.entries(snapshot.world.scales ?? {})) {
      let track = this.scaleTracks.get(id)
      if (!track) {
        track = new SnapshotBuffer<{ x: number; y: number }>(this.partner.clock)
        this.scaleTracks.set(id, track)
      }
      track.push(snapshot.t, { x: 0, y: offset }, receivedAt)
    }
  }

  /** La posición del compañero (y las cajas que movió), reenviada por el servidor apenas llegó. */
  applyPeer(peer: DuoPeerState, receivedAt: number): void {
    if (peer.role === this.role) return
    this.takePartner(peer.player, peer.at, peer.at, receivedAt)
    for (const crate of peer.crates) this.takeCrate(crate.id, crate.x, crate.y, peer.role, peer.at, peer.at, receivedAt)
  }

  private takePartner(state: DuoPlayerNet, t: number, at: number, receivedAt: number): void {
    // La misma posición llega dos veces (al instante y en la instantánea): solo cuenta la primera.
    if (!this.partner.push(t, state, receivedAt, at)) return
    if (state.dead && !this.partnerDead) this.options.onFainted?.(otherRole(this.role), null)
    this.partnerDead = state.dead
  }

  private takeCrate(id: string, x: number, y: number, owner: DuoRole | null, t: number, at: number, receivedAt: number): void {
    const now = performance.now()
    const partnerMoves = owner === otherRole(this.role)
    const mine = (this.ownedUntil.get(id) ?? 0) > now
    // Si el servidor dice que la mueve el compañero, se le cede aunque yo la estuviera empujando.
    if (mine && !partnerMoves) return
    const local = this.crates.find((c) => c.id === id)
    const released = this.releasedAt.get(id)
    if (released !== undefined && !partnerMoves && local) {
      // Recién soltada: el servidor puede traer aún una posición vieja; se espera a que confirme.
      const confirmed = Math.abs(local.x - x) < 2 && Math.abs(local.y - y) < 2
      if (!confirmed && now - released < CRATE_SETTLE_MS) return
    }
    this.releasedAt.delete(id)
    this.ownedUntil.delete(id)
    let track = this.crateTracks.get(id)
    if (!track) {
      track = new SnapshotBuffer<{ x: number; y: number }>(this.partner.clock)
      this.crateTracks.set(id, track)
    }
    track.push(t, { x, y }, receivedAt, at)
  }

  /** Diferencia del reloj del servidor según la vista de la sala (ms). */
  setClockSkew(ms: number): void {
    this.clockSkew = ms
  }

  /** Acerca de a poco el reloj de las plataformas a la diferencia estimada (sin saltos). */
  private updateMoverClock(): void {
    const raw = this.partner.clockOffset() ?? this.clockSkew
    if (this.moverOffset === null || Math.abs(raw - this.moverOffset) > 1000) this.moverOffset = raw
    else this.moverOffset += Math.max(-MOVER_CLOCK_SLEW_MS, Math.min(MOVER_CLOCK_SLEW_MS, raw - this.moverOffset))
  }

  /** Segundos del reloj del servidor a la hora local `wallMs` (Date.now): los dos ven las plataformas en el mismo lugar. */
  private serverSecondsAt(wallMs: number): number {
    return (wallMs + (this.moverOffset ?? this.clockSkew)) / 1000
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
    const wallNow = Date.now()
    const playing = this.phase === 'PLAYING'
    // Con el panel del espejo abierto no se simula, pero el reloj sigue.
    const simulating = playing && !this.frozen
    this.updateMoverClock()

    // --- Física a pasos fijos, con su propio reloj ---
    if (this.simClock === null || now - this.simClock > MAX_CATCH_UP_MS) {
      this.simClock = now - STEP_MS
      this.prevMe.x = this.me.x
      this.prevMe.y = this.me.y
    }
    while (this.simClock + STEP_MS <= now) {
      this.simClock += STEP_MS
      this.stepLabel = this.serverSecondsAt(wallNow - (now - this.simClock))
      this.prevMe.x = this.me.x
      this.prevMe.y = this.me.y
      for (const crate of this.crates) {
        const prev = this.prevCrates.get(crate.id)
        if (prev) {
          prev.x = crate.x
          prev.y = crate.y
        } else this.prevCrates.set(crate.id, { x: crate.x, y: crate.y })
      }
      if (simulating) this.simulate(this.simClock, this.stepLabel)
    }
    // Cuánto del paso siguiente ya pasó: se dibuja entre el paso anterior y el último.
    const alpha = Math.min(1, Math.max(0, (now - this.simClock) / STEP_MS))
    const drawTime = this.stepLabel - (1 - alpha) * STEP

    // Cajas que mueve el otro (o nadie): se dibujan en el mismo instante que su personaje.
    for (const crate of this.crates) {
      if ((this.ownedUntil.get(crate.id) ?? 0) > now || this.releasedAt.has(crate.id)) continue
      const target = this.crateTracks.get(crate.id)?.sample(wallNow)
      if (!target) continue
      crate.x = target.x
      crate.y = target.y
      crate.vy = 0
      const prev = this.prevCrates.get(crate.id)
      if (prev) {
        prev.x = target.x
        prev.y = target.y
      }
    }

    const sampled = this.partner.sample(wallNow)
    this.partnerDrawn = sampled ? this.onMover(sampled, drawTime) : null
    this.localWorld = this.predictWorld()

    if (playing) {
      this.sinceSend += deltaMs
      if (this.sinceSend >= SEND_EVERY_MS) {
        // Se descuenta (no se reinicia): así salen 30 por segundo aunque los cuadros no calcen.
        this.sinceSend = Math.min(this.sinceSend - SEND_EVERY_MS, SEND_EVERY_MS)
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

    this.render(now, deltaMs, alpha, drawTime)
    this.reportNearMirror()
  }

  /** El compañero sobre una plataforma móvil se dibuja pegado a ella, donde la plataforma está ahora. */
  private onMover(partner: DuoPlayerNet, time: number): DuoPlayerNet {
    const riding = partner.mover
    if (!riding || partner.dead) return partner
    const mover = this.level.def.movers?.find((m) => m.id === riding.id)
    if (!mover) return partner
    const rect = moverRect(mover, time)
    return { ...partner, x: rect.x + riding.dx, y: rect.y }
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

  /** Un paso de física. `now`: hora local del paso; `time`: segundos del servidor. */
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
    if (event?.kind === 'bounced') {
      this.views[this.role]?.stretch()
      this.levelView?.springBounce(this.me.x, this.me.y)
    }
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
      gems: { ...this.serverWorld.gems },
      keys: { ...this.serverWorld.keys },
      locks: { ...this.serverWorld.locks },
      flags: { ...this.serverWorld.flags },
      scales: this.drawnScales(),
    }
    const bodies = { [this.role]: toNet(this.me), [otherRole(this.role)]: this.partnerDrawn ?? undefined }
    updateSwitches(this.level, world, bodies)
    // Las palancas y los cerrojos no se desactivan: lo que el servidor ya activó sigue activo.
    const permanent = new Set([...this.level.def.levers.map((l) => l.id), ...(this.level.def.latches ?? []).map((l) => l.id)])
    for (const [id, on] of Object.entries(this.serverWorld.switches)) {
      if (on && permanent.has(id)) world.switches[id] = true
    }
    collectCoins(this.level, world, { [this.role]: toNet(this.me) })
    collectGems(this.level, world, { [this.role]: toNet(this.me) })
    return world
  }

  /** Desplazamiento de cada báscula tal como se dibuja (interpolado con el reloj del compañero). */
  private drawnScales(): Record<string, number> {
    const out: Record<string, number> = {}
    const now = Date.now()
    for (const scale of this.level.def.scales ?? []) {
      out[scale.id] = this.scaleTracks.get(scale.id)?.sample(now)?.y ?? this.serverWorld.scales?.[scale.id] ?? 0
    }
    return out
  }

  private render(now: number, deltaMs: number, alpha: number, drawTime: number): void {
    const app = this.app!
    const other = otherRole(this.role)
    const smooth = (from: number, to: number) => (Math.abs(to - from) > TELEPORT_PX ? to : from + (to - from) * alpha)
    const mine = toNet(this.me)
    mine.x = smooth(this.prevMe.x, this.me.x)
    mine.y = smooth(this.prevMe.y, this.me.y)
    let partner = this.partnerDrawn
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
    this.characterFx(this.role, mine, now)
    if (this.partnerDrawn) this.characterFx(other, partner, now)
    if (this.phase === 'VICTORY' && now >= this.cheerAt) {
      // ¡Lo lograron!: confeti sobre los dos.
      this.cheerAt = now + 320
      for (const who of [mine, partner]) {
        this.fx.burst({ x: who.x, y: who.y - 90, count: 6, texture: 'star', tint: CONFETTI_COLORS, speed: [120, 260], angle: [-Math.PI * 0.85, -Math.PI * 0.15], life: [700, 1100], scale: [0.7, 0.3], gravity: 420, spin: [-6, 6] })
      }
    }
    this.fx.update(deltaMs)
    recordTrace(this.me, this.partnerDrawn)

    const gate = this.level.def.gates.find((g) => !this.serverWorld.gates[g.id])
    const onPedestal = gate ? { [gate.id]: { [this.role]: isOnPedestal(gate, this.role, mine), [other]: isOnPedestal(gate, other, partner) } as Record<DuoRole, boolean> } : {}
    const crates = this.crates.map((c) => {
      const prev = this.prevCrates.get(c.id)
      return prev ? { id: c.id, x: smooth(prev.x, c.x), y: smooth(prev.y, c.y) } : c
    })
    this.levelView.update(this.localWorld, crates, onPedestal, now, drawTime, deltaMs, { [this.role]: mine, [other]: partner })

    // --- Cámara ---
    const sw = app.screen.width
    const sh = app.screen.height
    const zoom = Math.max(0.42, Math.min(1.35, sh / (VIEW_ROWS * 64), sw / (8 * 64)))
    const worldW = this.level.widthPx * zoom
    const worldH = this.level.heightPx * zoom
    const targetX = mine.x - sw / 2 / zoom + (this.me.facing * 60)
    const targetY = mine.y - sh * 0.62 / zoom
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
    const jolt = this.shake.offset(now)
    this.worldLayer.position.set((worldW < sw ? (sw - worldW) / 2 : -camX * zoom) + jolt.x, -camY * zoom + jolt.y)
    this.levelView.setView(camX, camY, sw / zoom, sh / zoom)

    // Fondo con paralaje: se mueve más lento que el mundo.
    this.background.width = sw
    this.background.height = sh
    const bgScale = sh / this.theme.background.frame.height
    this.background.tileScale.set(bgScale)
    this.background.tilePosition.x = -camX * zoom * 0.3

    this.drawPartnerArrow(partner, zoom, sw, sh)
  }

  /**
   * Partículas de un personaje según cómo cambió su estado: polvo al saltar y
   * al caer, humo al apagarse, destellos al reaparecer, el rastro de su
   * elemento (brasas de Lumen, gotitas de Gota), polvo al correr y burbujas al nadar.
   */
  private characterFx(role: DuoRole, s: DuoPlayerNet, now: number): void {
    const view = this.views[role]
    const prev = this.prevNet[role]
    this.prevNet[role] = s
    if (!prev) return
    const fx = this.fx
    const colors = ELEMENT_COLORS[role]
    const grounded = (a: DuoPlayerNet) => !a.dead && !isAirborne(a.anim) && a.anim !== 'swim'
    // Lanzado por un hongo (el compañero: se ve por el salto repentino).
    if (role !== this.role && prev.vy > 200 && s.vy < -900) {
      view.stretch()
      this.levelView.springBounce(s.x, s.y)
    }
    if (grounded(prev) && s.anim === 'rise') {
      view.stretch()
      fx.burst({ x: s.x, y: s.y - 2, count: 6, texture: 'soft', tint: DUST_COLORS, speed: [40, 110], angle: [-Math.PI, 0], life: [300, 500], scale: [0.35, 0.8], alpha: [0.6, 0], drag: 4, spread: [24, 2] })
    }
    if (isAirborne(prev.anim) && grounded(s)) {
      const strength = Math.min(1, Math.max(0, prev.vy) / 900)
      view.land(strength)
      fx.burst({ x: s.x, y: s.y - 2, count: 5 + Math.round(8 * strength), texture: 'soft', tint: DUST_COLORS, speed: [50, 160], angle: [-Math.PI, 0], life: [320, 560], scale: [0.35, 0.95], alpha: [0.65, 0], drag: 4, spread: [34, 2] })
    }
    if (!prev.dead && s.dead) {
      // Se apagó: una nube de humo y chispas de su elemento.
      fx.burst({ x: s.x, y: s.y - 30, count: 14, texture: 'soft', tint: [0xf5f5f4, 0xd6d3d1, 0xa8a29e], speed: [30, 120], angle: [-Math.PI, 0], life: [700, 1100], scale: [0.6, 1.6], alpha: [0.7, 0], gravity: -40, drag: 1.5, spread: 14 })
      fx.burst({ x: s.x, y: s.y - 30, count: 10, texture: 'star', tint: colors, speed: [90, 220], angle: [0, Math.PI * 2], life: [380, 620], scale: [0.7, 0.1], glow: true, drag: 2 })
    }
    if (prev.dead && !s.dead) {
      // Reapareció: crece con un anillo de destellos.
      view.respawn()
      fx.burst({ x: s.x, y: s.y - 40, count: 20, texture: 'star', tint: [0xfde047, ...colors], speed: [90, 210], angle: [0, Math.PI * 2], life: [420, 700], scale: [0.85, 0.1], glow: true, drag: 2.2 })
    }
    if (s.dead) return
    // El rastro del elemento: más seguido mientras se mueve.
    const moving = Math.abs(s.vx) > 60 || isAirborne(s.anim)
    if (now >= this.trailAt[role] && fx.count < 360) {
      this.trailAt[role] = now + (moving ? 70 : 240)
      if (role === 'FIRE') {
        fx.burst({ x: s.x + (Math.random() - 0.5) * 22, y: s.y - 48 - Math.random() * 12, count: 1, texture: 'dot', tint: colors, speed: [30, 80], angle: [-Math.PI * 0.65, -Math.PI * 0.35], life: [500, 900], scale: [0.55, 0.05], glow: true, gravity: -40, sway: 5 })
      } else if (moving || s.anim === 'swim') {
        fx.burst({ x: s.x + (Math.random() - 0.5) * 18, y: s.y - 26, count: 1, texture: 'drop', tint: colors, speed: [20, 70], angle: [Math.PI * 0.25, Math.PI * 0.75], life: [380, 620], scale: [0.5, 0.25], alpha: [0.9, 0], gravity: 520 })
      }
    }
    if (s.anim === 'walk' && Math.abs(s.vx) > 180 && now >= this.dustAt[role]) {
      this.dustAt[role] = now + 150
      fx.burst({ x: s.x - Math.sign(s.vx) * 12, y: s.y - 2, count: 1, texture: 'soft', tint: DUST_COLORS, speed: [15, 45], angle: [-Math.PI * 0.9, -Math.PI * 0.1], life: [260, 420], scale: [0.25, 0.6], alpha: [0.5, 0], drag: 3 })
    }
    if (s.anim === 'swim' && now >= this.dustAt[role]) {
      // Nadando en su elemento: burbujas (Gota) o brasas (Lumen) que suben.
      this.dustAt[role] = now + 140
      fx.burst(
        role === 'WATER'
          ? { x: s.x + (Math.random() - 0.5) * 24, y: s.y - 30, count: 1, texture: 'ring', tint: [0xe0f2fe, 0xbae6fd], speed: [40, 80], angle: -Math.PI / 2, life: [500, 800], scale: [0.35, 0.6], alpha: [0.9, 0], sway: 3 }
          : { x: s.x + (Math.random() - 0.5) * 24, y: s.y - 30, count: 2, texture: 'dot', tint: colors, speed: [60, 120], angle: [-Math.PI * 0.7, -Math.PI * 0.3], life: [400, 700], scale: [0.6, 0.1], glow: true, gravity: -30 },
      )
    }
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
