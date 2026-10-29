import { useEffect, useRef, useState } from 'react'
import { BookOpenCheck, Compass, Hammer, Play, Trophy, X, Zap } from 'lucide-react'
import truckArt from './games/assets/maze-collector/truck-drive.webp'
import cloudArt from './games/assets/maze-collector/cloud-chaser.webp'
import robotArt from './games/true-false-maze/assets/spaceship/robot/robot-down-0.png'
import jellyArt from './games/true-false-maze/assets/spaceship/jellyfish/jelly-down-0.png'
import './welcomeCard.css'

/** Las tres formas de empezar, en una palabra cada una (iconos de Lucide en una ficha de color). */
const HIGHLIGHTS = [
  { Icon: BookOpenCheck, title: 'Estudia', from: '#0ea5e9', to: '#6366f1' },
  { Icon: Trophy, title: 'Compite', from: '#f59e0b', to: '#f97316' },
  { Icon: Hammer, title: 'Crea', from: '#ec4899', to: '#8b5cf6' },
] as const

/**
 * Los personajes de los juegos destacados flotando en el escenario de arriba.
 * `x`/`y` en % del escenario, `size` en px y `delay` desfasa la flotación; `strip` es una tira
 * de fotogramas cuadrados (solo se muestra el primero).
 */
const CAST = [
  { src: '/assets/duo-logico/lumen-portrait.webp', label: 'Lumen, de Dúo Lógico', x: 8, y: 18, size: 74, delay: 0, strip: false },
  { src: truckArt, label: 'Camión Reciclador', x: 30, y: 40, size: 96, delay: 0.6, strip: true },
  { src: robotArt, label: 'Robot de Misión Galáctica', x: 56, y: 22, size: 70, delay: 1.2, strip: false },
  { src: '/assets/duo-logico/gota-portrait.webp', label: 'Gota, de Dúo Lógico', x: 78, y: 40, size: 72, delay: 0.3, strip: false },
  { src: jellyArt, label: '', x: 72, y: 4, size: 40, delay: 0.9, strip: false },
  { src: cloudArt, label: '', x: 2, y: 58, size: 50, delay: 1.5, strip: true },
] as const

// Relleno lavanda de la tarjeta (`light-dark` sigue el `color-scheme` de cada
// tema: en claro el lavanda fijo del diseño, en oscuro un tinte del acento).
const CARD_TINT = 'light-dark(#e7e3fc, color-mix(in srgb, var(--accent) 14%, var(--surface)))'
// Violeta apagado del título (en claro #814dbf; en oscuro, un violeta claro sacado del acento).
const TITLE_COLOR =
  'light-dark(#814dbf, color-mix(in srgb, color-mix(in srgb, var(--accent) 85%, var(--accent-2)) 70%, var(--text)))'

// Piso de la reducción: ventanas absurdamente bajas (< ~180px) no pueden mostrarla entera; hasta ahí siempre cabe.
const MIN_FIT = 0.3
// Margen del overlay (p-4) arriba y abajo.
const OVERLAY_PADDING = 32

type WelcomeCardProps = {
  /** "¡Empezar a jugar!", la X, Escape y el clic fuera: todo lleva al inicio. */
  onClose: () => void
  /** "Ver guía rápida": abre el recorrido paso a paso. */
  onQuickGuide: () => void
}

/**
 * Tarjeta de bienvenida que sale en cada carga o login (ver `WelcomeTour`):
 * logo, los personajes de los juegos, título corto y dos salidas —
 * "¡Empezar a jugar!" (cierra) y "Ver guía rápida" (abre el recorrido). El
 * resto de la pantalla queda desenfocada y oscurecida detrás.
 *
 * Nunca tiene scroll: si la ventana es más baja que la tarjeta (~589px en
 * escritorio, bastante más en el diseño 2×2 de móvil o ventanas angostas), se
 * reduce en proporción hasta caber entera y centrada; si cabe, el tamaño es el
 * de siempre (612px de ancho máximo).
 *
 * Colores y tipografía salen de los tokens del tema (acento, superficie,
 * texto), así que en oscuro/kids se adapta sola; los dibujos son WebP con
 * fondo transparente para no dejar recuadros claros sobre esos fondos.
 */
export function WelcomeCard({ onClose, onQuickGuide }: WelcomeCardProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const fitBoxRef = useRef<HTMLDivElement>(null)
  // Factor (0.7–1) que hace caber la tarjeta en el alto de la ventana.
  const [fit, setFit] = useState(1)

  useEffect(() => {
    // Enfocar el diálogo (no un botón) deja el foco dentro sin dibujar un anillo sobre "Empezar a jugar".
    // Solo al abrir: `onClose` cambia en cada render del padre y no debe quitarle el foco a quien navega con Tab.
    dialogRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const box = fitBoxRef.current
    if (!box) return
    function update() {
      // `offsetHeight` es el alto de layout: no lo alteran ni la escala ni la animación de entrada.
      const wanted = (window.innerHeight - OVERLAY_PADDING) / (box as HTMLDivElement).offsetHeight
      const next = wanted < 1 ? Math.max(wanted, MIN_FIT) : 1
      setFit((previous) => (Math.abs(previous - next) > 0.004 ? next : previous))
    }
    // Se ejecuta al observar por primera vez (antes de pintar) y cuando cambia el alto de la tarjeta (fuentes, imágenes).
    const observer = new ResizeObserver(update)
    observer.observe(box)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/55 p-4 backdrop-blur-sm animate-[modal-backdrop-in_0.2s_ease-out]"
      onClick={onClose}
      role="presentation"
    >
      {/* La escala va en este contenedor y no en la tarjeta: la animación de entrada de la tarjeta también usa `transform` y la pisaría.
          Sin `my-auto` ni scroll en el overlay: el centrado (items-center) es simétrico aunque el alto natural sea mayor que la ventana. */}
      <div
        ref={fitBoxRef}
        className="w-full max-w-[560px]"
        style={fit < 1 ? { transform: `scale(${fit})` } : undefined}
      >
        <section
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-card-title"
          className="welcome-card-panel relative outline-none rounded-[22px] border-[4px] border-transparent px-5 pt-[30px] pb-[14px] text-center shadow-[0_24px_70px_-18px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.5)] animate-[modal-panel-in_0.25s_cubic-bezier(0.16,1,0.3,1)]"
          style={{
            // Dos fondos: el relleno lavanda recortado al padding y, debajo, el
            // degradado rosa → violeta (al 65 %, como en el diseño) que asoma
            // solo en el borde de 4px.
            background: `linear-gradient(${CARD_TINT}, ${CARD_TINT}) padding-box, linear-gradient(90deg, color-mix(in srgb, var(--accent-2) 65%, transparent), color-mix(in srgb, var(--accent) 65%, transparent)) border-box`,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar bienvenida"
            className="absolute top-[11px] right-[14px] rounded-full p-1.5 text-text transition-colors hover:bg-accent/10 hover:text-text-h focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden="true" />
          </button>

          <div className="flex items-center justify-center gap-3">
            <span
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              aria-hidden="true"
            >
              <Zap className="h-[22px] w-[22px]" fill="currentColor" strokeWidth={0} />
            </span>
            <span className="text-[28px] font-medium tracking-tight text-text-h">NexusPlay</span>
          </div>

          {/* Escenario: los personajes de los juegos flotando sobre un cielo nocturno con estrellas. */}
          <div className="welcome-stage relative mx-auto mt-4 h-[150px] overflow-hidden rounded-[18px]" aria-hidden="true">
            {CAST.map((item) => (
              <img
                key={item.src}
                src={item.src}
                alt=""
                draggable={false}
                className={`welcome-float absolute ${item.strip ? 'object-cover object-left' : 'object-contain'} drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)]`}
                style={{ left: `${item.x}%`, top: `${item.y}%`, width: item.size, height: item.size, animationDelay: `${item.delay}s` }}
              />
            ))}
          </div>

          {/* `font-sans`: la app pone Space Grotesk a los h2/h3; el diseño usa Manrope. */}
          <h2
            id="welcome-card-title"
            className="mt-5 font-sans text-[30.5px] leading-tight font-bold tracking-tight"
            style={{ color: TITLE_COLOR }}
          >
            ¡Bienvenido a NexusPlay!
          </h2>
          <p className="mt-1.5 text-[15px] font-medium text-text-h">Aprende jugando, solo o con amigos.</p>

          <ul className="mt-4 flex flex-wrap justify-center gap-2">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.title}
                className="flex items-center gap-1.5 rounded-full bg-surface/80 px-3.5 py-1.5 text-[13.5px] font-bold text-text-h shadow-sm ring-1 ring-accent/20"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                  style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
                  aria-hidden="true"
                >
                  <item.Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {item.title}
              </li>
            ))}
          </ul>

          <div className="mt-6 mb-3 flex flex-col-reverse items-stretch justify-center gap-3 min-[480px]:flex-row">
            <button
              type="button"
              onClick={onQuickGuide}
              className="flex items-center justify-center gap-2 rounded-[14px] border-2 border-accent bg-surface px-6 py-3 text-[14.5px] font-bold text-accent shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Compass className="h-5 w-5" aria-hidden="true" /> Ver guía rápida
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-[14px] px-6 py-3 text-[14.5px] font-bold text-white shadow-[-6px_10px_20px_-8px_color-mix(in_srgb,var(--accent-2)_70%,transparent),6px_10px_20px_-8px_color-mix(in_srgb,var(--accent)_70%,transparent)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{ background: 'linear-gradient(90deg, var(--accent-2), var(--accent))' }}
            >
              <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" /> ¡Empezar a jugar!
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
