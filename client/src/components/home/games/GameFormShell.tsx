import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PencilLine, Sparkles, X } from 'lucide-react'
import {
  AiDraftAppliedContext,
  AiFillStepContext,
  AiGeneratingContext,
  AiPanelVariantContext,
  AiRequestChatContext,
} from './aiDraftContext'

type GameFormShellProps = {
  /** Texto del botón de volver, sin la flecha (ej. "Cambiar modo"). */
  backLabel: string
  onBack: () => void
  title: string
  description: ReactNode
  /** El panel de <AiGameAssistantPanel /> ya configurado por el formulario. */
  aiPanel: ReactNode
  /**
   * Ancho máximo de la columna de campos en pantallas grandes. Por defecto
   * ahora no limita (solo lg:max-w-none) — el grid ya reparte el espacio
   * entre esta columna y el panel de IA, así que restringir el ancho acá
   * solo dejaba espacio muerto en pantallas anchas (feedback tras probar el
   * wizard multifase, issue #218).
   */
  formMaxWidthClassName?: string
  children: ReactNode
}

/**
 * Layout compartido por los 7 formularios de creación de juego: antes cada
 * uno centraba una sola columna angosta (max-w-[640/680/760px]) dejando
 * mucho espacio vacío a los lados en pantallas anchas. Ahora el panel de IA
 * pasa a una columna lateral fija (sticky en desktop, arriba del formulario
 * en mobile) sobre un fondo con desenfoques de color, aprovechando ese
 * espacio en vez de dejarlo muerto. El contenedor exterior también crece con
 * la pantalla (xl/2xl) en vez de topar siempre en 1180px, para que en
 * monitores grandes el formulario "respire" en vez de quedar en una columna
 * angosta centrada — en mobile sigue siendo una sola columna apilada.
 */
export function GameFormShell({
  backLabel,
  onBack,
  title,
  description,
  aiPanel,
  formMaxWidthClassName = 'lg:max-w-none',
  children,
}: GameFormShellProps) {
  // Cuántas veces se aplicó un borrador de IA (0 = nunca): cada aplicación
  // vuelve a mostrar el aviso aunque el usuario lo haya cerrado antes.
  const [aiDraftCount, setAiDraftCount] = useState(0)
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)
  const formColumnRef = useRef<HTMLDivElement>(null)

  // La IA está generando: al lado del chat se ve el formulario "armándose".
  const [generating, setGenerating] = useState(false)
  // Tras aplicar un borrador, los campos aparecen en cascada unos segundos.
  const [filling, setFilling] = useState(false)

  // Issue #52: primero la pantalla grande de IA; "Llenar manualmente" (o
  // aplicar un borrador de IA) pasa al formulario. El formulario y el chat
  // siguen montados en ambas etapas, así que no se pierde lo escrito.
  const [stage, setStage] = useState<'ai' | 'manual'>('ai')
  // Transición entre etapas: la actual sale (leaving) y la nueva entra
  // (entering) con sus elementos en cascada, en vez de cambiar de golpe.
  const [leaving, setLeaving] = useState(false)
  const [entering, setEntering] = useState(false)
  const transitionTimers = useRef<number[]>([])

  const goToStage = useCallback((next: 'ai' | 'manual') => {
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer))
    setLeaving(true)
    const swap = window.setTimeout(() => {
      setStage(next)
      setLeaving(false)
      setEntering(true)
      window.scrollTo?.({ top: 0, behavior: 'smooth' })
    }, 220)
    const settle = window.setTimeout(() => setEntering(false), 1300)
    transitionTimers.current = [swap, settle]
  }, [])

  useEffect(() => {
    const timersRef = transitionTimers
    return () => timersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const markAiDraftApplied = useCallback(() => {
    setStage('manual')
    setEntering(true)
    setAiDraftCount((count) => count + 1)
    setNoticeDismissed(false)
    setFilling(true)
  }, [])

  useEffect(() => {
    if (!filling) return
    const timer = window.setTimeout(() => setFilling(false), 3000)
    return () => window.clearTimeout(timer)
  }, [filling])

  // Llevar la vista al campo que la IA acaba de llenar (el primero para los
  // ajustes; luego el último campo con contenido) y resaltarlo un momento.
  const onFillStep = useCallback((stepIndex: number) => {
    const root = formColumnRef.current
    if (!root) return
    const fields = Array.from(
      root.querySelectorAll<HTMLInputElement>(
        'input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select',
      ),
    )
    const target =
      stepIndex === 0 ? fields[0] : [...fields].reverse().find((field) => field.value.trim().length > 0)
    if (!target) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    target.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    target.classList.add('nx-just-filled')
    window.setTimeout(() => target.classList.remove('nx-just-filled'), 1000)
  }, [])

  const stageMotion = leaving ? 'nx-stage-out' : entering ? 'nx-stage-in' : ''

  const showAiNotice = aiDraftCount > 0 && !noticeDismissed

  return (
    <AiDraftAppliedContext.Provider value={markAiDraftApplied}>
    <AiGeneratingContext.Provider value={setGenerating}>
    <AiFillStepContext.Provider value={onFillStep}>
    <AiRequestChatContext.Provider value={() => goToStage('ai')}>
    <AiPanelVariantContext.Provider value={stage === 'ai' ? 'inline' : 'compact'}>
    <div className="relative mx-auto max-w-[1180px] p-5 sm:p-8 xl:max-w-[1440px] 2xl:max-w-[1680px]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
        <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-accent/20 blur-[110px]" />
        <div className="absolute top-1/3 -right-44 h-[460px] w-[460px] rounded-full bg-accent-2/20 blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[-8%] h-72 w-72 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="relative">
        <button
          type="button"
          className="mb-3 text-[12.5px] font-medium text-accent hover:underline"
          onClick={onBack}
        >
          ← {backLabel}
        </button>
        <h2 className="mb-1 text-[20px] tracking-tight text-text-h">{title}</h2>
        <p className="mb-6 max-w-[640px] text-[13px] text-text">{description}</p>

        {stage === 'manual' && (
          <button
            type="button"
            className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-1.5 text-[12.5px] font-semibold text-accent hover:bg-accent/10"
            onClick={() => goToStage('ai')}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
            Volver al chat de IA
          </button>
        )}

        <div
          className={
            stage === 'ai'
              ? `${stageMotion} grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8`
              : `${stageMotion} grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_380px]`
          }
        >
          {/*
            Antes esta columna entera tenía su propio max-height + scroll
            interno (independiente del scroll de la página). Con muchos
            archivos subidos, un solo evento de rueda "grande" (mouse/
            trackpad con scroll acelerado) no siempre encadena el scroll
            sobrante hacia el contenedor de la página — algunos navegadores/
            dispositivos sí lo hacen con ticks pequeños, otros no con un
            evento grande, así que el usuario podía quedar "atrapado" sin
            poder bajar hasta el fondo del formulario. Ahora esta columna NO
            tiene scroll propio (solo sticky): AiGameAssistantPanel es solo
            un botón acá — su lista de archivos y el resto del chat viven en
            un modal aparte, con su propio scroll — así que los botones y el
            formulario de abajo siempre son alcanzables con el scroll normal
            de la página.
          */}
          <aside
            className={
              stage === 'ai' ? 'order-1' : `order-1 lg:order-2 lg:sticky lg:top-8 ${entering ? 'nx-slide-in' : ''}`
            }
          >
            {aiPanel}
          </aside>
          <div ref={formColumnRef} className={`order-2 w-full lg:order-1 ${formMaxWidthClassName} ${stage === 'ai' ? 'hidden' : ''} ${filling || (entering && stage === 'manual') ? 'nx-fill' : ''}`}>
            {showAiNotice && (
              <div
                ref={noticeRef}
                role="status"
                className="mb-5 flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-[13px] leading-relaxed text-text-h"
              >
                <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
                <p className="flex-1">
                  <strong>La IA ya llenó el juego.</strong> Falta tu parte: nombre, descripción y materia.
                </p>
                <button
                  type="button"
                  aria-label="Cerrar aviso"
                  className="shrink-0 rounded-md p-0.5 text-text hover:text-text-h"
                  onClick={() => setNoticeDismissed(true)}
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            )}
            {children}
          </div>
          {stage === 'ai' && generating && (
            <div
              role="status"
              aria-label="La IA está armando tu juego"
              className="nx-stage-in order-2 flex flex-col gap-3 rounded-2xl border border-accent/40 bg-surface p-5"
            >
              <p className="flex items-center gap-2 text-[14px] font-semibold text-text-h">
                <Sparkles className="h-4 w-4 animate-pulse text-accent" strokeWidth={2.5} />
                Armando tu juego…
              </p>
              {[70, 100, 85, 100, 60, 90].map((width, index) => (
                <span
                  key={index}
                  className="nx-skeleton block h-9 rounded-lg"
                  style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }}
                />
              ))}
            </div>
          )}
          {stage === 'ai' && !generating && (
            <button
              type="button"
              className="nx-manual-card order-2 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-accent bg-accent/10 p-6 text-center hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => goToStage('manual')}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white">
                <PencilLine className="h-7 w-7" strokeWidth={2.2} />
              </span>
              <span className="text-[18px] font-bold text-text-h">Llenar manualmente</span>
            </button>
          )}
        </div>
      </div>
    </div>
    </AiPanelVariantContext.Provider>
    </AiRequestChatContext.Provider>
    </AiFillStepContext.Provider>
    </AiGeneratingContext.Provider>
    </AiDraftAppliedContext.Provider>
  )
}
