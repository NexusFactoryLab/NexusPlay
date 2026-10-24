import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Compass, Gamepad2, Hand, Keyboard, Plus, UserRound, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthUser } from '../../services/auth.service'
import { getWelcomeSteps, hasGreetedThisSession, hasSeenWelcome, initialWelcomePhase, markGreetedThisSession, markWelcomeSeen, phaseAfterGreeting, welcomeStorageKey } from './welcomeTourSteps'
import type { WelcomeOptions, WelcomePhase, WelcomeStep } from './welcomeTourSteps'
import { WelcomeCard } from './WelcomeCard'
import { TourSpotlight } from './TourSpotlight'
import { pickCardCorner, tourCardBounds, useSpotlightRect } from './tourSpotlightLayout'
import { getTourAway, setTourAway, useTourAway } from './tourProgress'
import { isKidsMode } from '../../utils/kidsMode'

const icons = { play: Gamepad2, create: Plus, explore: Compass, profile: UserRound }
/** Si tocar el elemento no cambió de página en este tiempo, el paso se hizo sin salir del inicio. */
const NAVIGATION_GRACE_MS = 600
const STUCK_MS = 12000
const GENERIC_AWAY ='Esta es otra sección de NexusPlay. Mírala con calma y vuelve a la guía para seguir.'

/** Toques que cuentan como "hacer" el paso: en un contenedor (los mundos de Kids) solo valen sus botones y enlaces. */
function isActionClick(target: HTMLElement, event: Event) {
  if (target.matches('button, a, [role="button"]')) return true
  const clicked = event.target instanceof Element ? event.target.closest('button, a, [role="button"]') : null
  return !!clicked && target.contains(clicked)
}

/**
 * Toda carga o login (F5 incluido) que cae en el inicio abre primero la
 * tarjeta de bienvenida (`WelcomeCard`), sin importar si la cuenta es nueva o
 * antigua: se cierra con "¡Empezar a jugar!", la X, Escape o un clic fuera, o
 * abre el recorrido paso a paso con "Ver guía rápida". Una vez cerrada, no
 * vuelve a salir por simple navegación dentro de la app (salir de un juego,
 * terminar una partida y volver al lobby): solo una recarga real de la
 * página la trae de vuelta (ver `hasGreetedThisSession` en welcomeTourSteps).
 *
 * La primera vez que una cuenta entra, el botón "Guía" se vuelve obligatorio:
 * el resto de la pantalla se ve desenfocada y bloqueada (el overlay absorbe
 * los clics) hasta que la persona hace clic en el botón — no hay "Ahora no"
 * ni Escape para saltárselo, así todo el mundo pasa por el recorrido al
 * menos una vez.
 *
 * El recorrido es interactivo: cada paso pide HACER algo (tocar "Crear
 * juego", abrir Áreas, buscar…) y solo avanza cuando la persona lo hace. Si
 * el paso la lleva a otra página, el progreso queda en `tourProgress` y
 * `TourReturnBar` (en toda la app) le explica la página y la obliga a
 * "Volver a la guía", que la trae de nuevo aquí, al paso siguiente.
 */
export function WelcomeTour({ user, canAccessOrganization, canGoBackToWorlds }: { user: AuthUser } & WelcomeOptions) {
  const location = useLocation()
  const navigate = useNavigate()
  const isKids = isKidsMode(user)
  const storageKey = welcomeStorageKey(user.id, user.role)
  // No interrumpir enlaces a juegos, salas ni otras secciones.
  const atHome = location.pathname === '/' && !location.search
  const buildSteps = useCallback(
    () => getWelcomeSteps(user.role, isKids, { canAccessOrganization, canGoBackToWorlds }),
    [user.role, isKids, canAccessOrganization, canGoBackToWorlds],
  )
  // Volver de otra página en mitad del recorrido lo retoma donde iba (sin saludo de por medio).
  const [phase, setPhase] = useState<WelcomePhase>(() =>
    getTourAway()?.owner === storageKey && getTourAway()?.status === 'resume' && atHome
      ? 'tour'
      : initialWelcomePhase(atHome, hasSeenWelcome(storageKey), hasGreetedThisSession(storageKey)),
  )
  const [steps, setSteps] = useState(buildSteps)
  const [index, setIndex] = useState(0)
  // El paso actual ya se hizo (abrió el menú, buscó…): ahora toca "Siguiente".
  const [stepDone, setStepDone] = useState(false)
  const [previousRoute, setPreviousRoute] = useState(location.key)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Alto real de la tarjeta (cambia por paso): sirve para elegir la esquina libre y deslizarla hasta ahí.
  const [cardHeight, setCardHeight] = useState<number | null>(null)
  const [cardNode, setCardNode] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!cardNode) return
    const observer = new ResizeObserver(() => setCardHeight(cardNode.offsetHeight))
    observer.observe(cardNode)
    return () => observer.disconnect()
  }, [cardNode])
  const step: WelcomeStep = steps[Math.min(index, steps.length - 1)]
  const visible = atHome && phase !== 'closed'
  // Momento obligatorio: solo antes de que la persona inicie el recorrido.
  const forcedInvite = visible && phase === 'invite'

  // Al volver al inicio desde la barra "Volver a la guía" (o con el botón
  // atrás del navegador) se retoma el paso que seguía.
  const away = useTourAway()
  const resumeFrom = away?.owner === storageKey && away.status === 'resume' && atHome ? away.resumeIndex : null
  useEffect(() => {
    if (resumeFrom === null) return
    setTourAway(null)
    markGreetedThisSession(storageKey)
    markWelcomeSeen(storageKey)
    const fresh = buildSteps()
    setSteps(fresh)
    setStepDone(false)
    if (resumeFrom >= fresh.length) {
      setPhase('closed')
      return
    }
    setIndex(resumeFrom)
    setPhase('tour')
  }, [resumeFrom, storageKey, buildSteps])

  if (previousRoute !== location.key) {
    setPreviousRoute(location.key)
    if (!atHome && phase === 'greeting') setPhase('closed')
  }

  // Una sección dentro del inicio (Áreas, Comunidad…) también es "otra
  // página": se guarda el progreso para que la barra obligue a volver. (En
  // un efecto: el almacén avisa a la barra, y eso no puede pasar en el render.)
  const leftHomeInTour = !atHome && phase === 'tour'
  useEffect(() => {
    if (!leftHomeInTour) return
    if (getTourAway()?.owner !== storageKey) {
      setTourAway({
        owner: storageKey,
        resumeIndex: index + 1,
        totalSteps: steps.length,
        explanation: step.away ?? GENERIC_AWAY,
        stepTitle: step.title,
        status: 'away',
      })
    }
    setPhase('closed')
  }, [leftHomeInTour, storageKey, index, steps.length, step])

  const close = useCallback((restoreFocus = true) => {
    markWelcomeSeen(storageKey)
    setTourAway(null)
    setPhase('closed')
    if (restoreFocus) triggerRef.current?.focus()
  }, [storageKey])

  useEffect(() => {
    // El paso obligatorio (fase "invite") no se puede saltar con Escape;
    // dentro del recorrido sí, salvo justo después de abrir un menú o una
    // ventana: ahí Escape es para cerrar eso, no la guía.
    if (!visible || phase !== 'tour' || stepDone) return
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [visible, phase, stepDone, close])

  // Lo que la persona tiene que hacer en el paso: se escucha en el propio
  // elemento señalado, sin impedir que funcione como siempre.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  useEffect(() => {
    if (!visible || phase !== 'tour') return
    headingRef.current?.focus({ preventScroll: true })
    if (stepDone) return
    const target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    if (!target) return
    target.setAttribute('data-tour-active', 'true')
    // El resaltado visual lo dibuja <TourSpotlight> (ver ahí por qué); esta
    // marca apaga el contorno CSS de [data-tour-active] para no duplicarlo.
    target.setAttribute('data-tour-spotlight', 'true')
    // "center" (en vez de "start") deja margen a ambos lados: con "start" un
    // objetivo pegado al borde superior (como el botón de crear juego) podía
    // terminar justo debajo del encabezado, apenas visible.
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
    let timer = 0
    const onTap = (event: Event) => {
      if (!isActionClick(target, event)) return
      if (!step.away) {
        setStepDone(true)
        return
      }
      // Puede que el toque lleve a otra página (y este componente se desmonte
      // antes de enterarse): el progreso se guarda ya, y si no hubo cambio de
      // página se borra y el paso cuenta como hecho aquí mismo.
      setTourAway({
        owner: storageKey,
        resumeIndex: index + 1,
        totalSteps: steps.length,
        explanation: step.away,
        stepTitle: step.title,
        status: 'away',
      })
      timer = window.setTimeout(() => {
        if (!mountedRef.current || window.location.pathname !== '/') return
        setTourAway(null)
        setStepDone(true)
      }, NAVIGATION_GRACE_MS)
    }
    const onSubmit = () => setStepDone(true)
    if (step.kind === 'tap') target.addEventListener('click', onTap)
    if (step.kind === 'type') target.addEventListener('submit', onSubmit)
    return () => {
      target.removeAttribute('data-tour-active')
      target.removeAttribute('data-tour-spotlight')
      target.removeEventListener('click', onTap)
      target.removeEventListener('submit', onSubmit)
      window.clearTimeout(timer)
    }
  }, [visible, phase, step, index, stepDone, steps.length, storageKey])

  function dismissGreeting() {
    markGreetedThisSession(storageKey)
    setPhase(phaseAfterGreeting(hasSeenWelcome(storageKey)))
  }

  function start() {
    markGreetedThisSession(storageKey)
    markWelcomeSeen(storageKey)
    setTourAway(null)
    setSteps(buildSteps())
    setIndex(0)
    setStepDone(false)
    setPhase('tour')
    if (!atHome) navigate('/')
  }

  function goTo(next: number) {
    setStepDone(false)
    setIndex(next)
  }

  const Icon = icons[step.icon]
  const inTour = visible && phase === 'tour'
  // Con el paso hecho se apaga el resaltado: el menú o la ventana que se abrió
  // queda libre para mirarla y cerrarla.
  const spotlightRect = useSpotlightRect(inTour && !stepDone ? `[data-tour="${step.target}"]` : null)
  // Si el elemento no está en pantalla (menú oculto en el celular, por
  // ejemplo), no se puede pedir que lo toque: el paso se puede pasar.
  const [targetMissing, setTargetMissing] = useState(false)
  useEffect(() => {
    if (!inTour || stepDone || step.kind === 'look') return
    const timer = window.setTimeout(() => {
      const box = document.querySelector(`[data-tour="${step.target}"]`)?.getBoundingClientRect()
      setTargetMissing(!box || (box.width === 0 && box.height === 0))
    }, 400)
    return () => {
      window.clearTimeout(timer)
      setTargetMissing(false)
    }
  }, [inTour, stepDone, step])
  // Válvula de escape: si en un rato no logra el paso (un mundo sin juegos
  // todavía, por ejemplo), aparece "Saltar este paso" para no quedarse trabado.
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (!inTour || stepDone || step.kind === 'look') return
    const timer = window.setTimeout(() => setStuck(true), STUCK_MS)
    return () => {
      window.clearTimeout(timer)
      setStuck(false)
    }
  }, [inTour, stepDone, step, index])
  const canAdvance = stepDone || step.kind === 'look' || targetMissing
  const last = index === steps.length - 1

  // La tarjeta se aparta a otra esquina si taparía el elemento iluminado.
  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const margin = viewport.width >= 640 ? 24 : 12
  const bounds = tourCardBounds(viewport)
  const card = { width: bounds.width, height: cardHeight ?? bounds.height }
  const cardCorner = pickCardCorner(spotlightRect, card, viewport, margin)
  // Posición en píxeles (no clases de esquina) para que la tarjeta se deslice
  // con transición hacia la esquina libre y no tape lo que se está mostrando.
  const cardPosition = {
    left: cardCorner.endsWith('right') ? viewport.width - margin - card.width : margin,
    top: cardCorner.startsWith('bottom') ? Math.max(margin, viewport.height - margin - card.height) : margin,
  }
  const TaskIcon = step.kind === 'type' ? Keyboard : Hand
  return <>
    {forcedInvite && (
      <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" aria-hidden="true" />
    )}
    {inTour && !stepDone && <TourSpotlight rect={spotlightRect} />}

    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={start}
        aria-label="Repetir recorrido de bienvenida"
        data-tour-active={forcedInvite ? 'true' : undefined}
        className={`tour-guide-btn inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-linear-to-r px-3 py-2 text-sm font-semibold shadow-md hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isKids ? 'border-orange-400 from-amber-200 to-orange-300 text-[#3a2a6d] shadow-orange-400/30' : 'border-violet-500 from-violet-600 to-fuchsia-700 text-white shadow-violet-500/25'} ${forcedInvite ? 'relative z-50' : ''}`}
      >
        <Compass className="fx-line-icon h-4 w-4" aria-hidden="true" />
        <span className="fx-emoji tour-guide-compass" aria-hidden="true">🧭</span> Guía
      </button>

      {forcedInvite && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute top-full left-1/2 z-50 mt-3 w-[200px] -translate-x-1/2 animate-bounce text-center"
        >
          <span className="mx-auto block h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-accent" />
          <span className="block rounded-xl bg-accent px-3 py-2 text-[13px] font-semibold text-white shadow-lg">
            Haz clic aquí para aprender a usar NexusPlay
          </span>
        </div>
      )}
    </div>

    {visible && phase === 'greeting' && createPortal(
      <WelcomeCard onClose={dismissGreeting} onQuickGuide={start} />, document.body,
    )}

    {inTour && createPortal(
      <section ref={setCardNode} style={cardPosition} aria-label="Recorrido de NexusPlay" className={`welcome-tour-card fixed z-[45] w-[min(360px,calc(100vw-24px))] rounded-3xl border border-border bg-surface p-5 text-left text-text shadow-[var(--shadow)]`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span key={`icon-${index}`} className="tour-step-icon flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-md" style={{ background: 'linear-gradient(135deg, var(--accent), var(--color-accent-2, var(--accent)))' }}><Icon className="h-6 w-6" aria-hidden="true" /></span>
          <span className="flex-1 text-xs font-semibold text-accent">Paso {index + 1} de {steps.length} · Hazlo tú</span>
          <button type="button" onClick={() => close()} aria-label="Cerrar recorrido" className="rounded-full p-2 text-text hover:bg-code-bg focus-visible:outline-2 focus-visible:outline-accent"><X className="h-5 w-5" /></button>
        </div>
        <div key={index} className="tour-step-in" aria-live="polite" aria-atomic="true">
          {last && stepDone && <FinishConfetti />}
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-text-h outline-none">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed">{step.text}</p>
          {step.task && !stepDone && (
            <p data-tour-task className="tour-task mt-3 flex items-center gap-2.5 rounded-2xl border-2 border-dashed border-accent/60 bg-accent/10 px-3 py-2.5 text-[14px] font-semibold text-text-h">
              <TaskIcon className="tour-task-hand h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              {targetMissing ? 'Esta opción no está a la vista en esta pantalla. Puedes seguir con el próximo paso.' : step.task}
            </p>
          )}
          {stepDone && (
            <p role="status" className="tour-step-in mt-3 flex items-center gap-2.5 rounded-2xl bg-emerald-500/15 px-3 py-2.5 text-[14px] font-semibold text-text-h">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" /></span>
              {step.done ?? '¡Bien hecho!'}
            </p>
          )}
        </div>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">{steps.map((item, i) => <span key={`${item.target}-${i}`} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < index || (i === index && canAdvance) ? 'bg-accent' : 'bg-code-bg'} ${i === index ? 'scale-y-150' : ''}`} />)}</div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" disabled={index === 0} onClick={() => goTo(index - 1)} className="rounded-lg px-2 py-2 text-sm hover:bg-code-bg disabled:opacity-40">Atrás</button>
          {canAdvance ? (
            <button type="button" onClick={() => last ? close() : goTo(index + 1)} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
              {last ? '¡Listo! 🎉' : 'Siguiente →'}
            </button>
          ) : stuck ? (
            <button type="button" onClick={() => (last ? close() : goTo(index + 1))} className="rounded-lg px-2 py-2 text-xs font-semibold text-text/70 underline hover:text-accent">
              Saltar este paso
            </button>
          ) : (
            <span className="text-xs font-semibold text-text/70">Haz el paso para seguir</span>
          )}
        </div>
      </section>, document.body,
    )}
  </>
}

const CONFETTI_COLORS = ['#ff7a1a', '#06b6d4', '#ffcc4d', '#ff4d6d', '#22c55e', '#a78bfa']

/** Explosión de confeti al terminar el último paso: el recorrido termina con celebración. */
function FinishConfetti() {
  return (
    <span aria-hidden="true" className="tour-scene pointer-events-none absolute top-[70px] left-1/2 block">
      {CONFETTI_COLORS.concat(CONFETTI_COLORS).map((color, i) => {
        const angle = (Math.PI * 2 * i) / 12
        return (
          <span
            key={i}
            className="absolute h-2 w-2 rounded-sm"
            style={{
              background: color,
              animation: 'kids-confetti-piece 1s cubic-bezier(0.2, 0.8, 0.4, 1) forwards',
              ['--kids-confetti-dx' as string]: `${Math.cos(angle) * 110}px`,
              ['--kids-confetti-dy' as string]: `${Math.sin(angle) * 80}px`,
            }}
          />
        )
      })}
    </span>
  )
}
