import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { PencilLine, Sparkles, X } from 'lucide-react'
import { AiDraftAppliedContext, AiPanelVariantContext } from './aiDraftContext'

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

  // Primero el aviso se muestra al frente con el fondo desenfocado (es
  // importante que se lea); al confirmarlo queda fijo arriba de los campos.
  const [spotlightOpen, setSpotlightOpen] = useState(false)

  // Issue #52: primero la pantalla grande de IA; "Llenar manualmente" (o
  // aplicar un borrador de IA) pasa al formulario. El formulario y el chat
  // siguen montados en ambas etapas, así que no se pierde lo escrito.
  const [stage, setStage] = useState<'ai' | 'manual'>('ai')

  const markAiDraftApplied = useCallback(() => {
    setStage('manual')
    setAiDraftCount((count) => count + 1)
    setNoticeDismissed(false)
    setSpotlightOpen(true)
  }, [])

  // Al cerrar el aviso destacado se lleva el aviso fijo a la vista (en mobile queda más abajo).
  useEffect(() => {
    if (aiDraftCount > 0 && !spotlightOpen) noticeRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [aiDraftCount, spotlightOpen])

  useEffect(() => {
    if (!spotlightOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') setSpotlightOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [spotlightOpen])

  const showAiNotice = aiDraftCount > 0 && !noticeDismissed

  return (
    <AiDraftAppliedContext.Provider value={markAiDraftApplied}>
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
            onClick={() => setStage('ai')}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
            Volver al chat de IA
          </button>
        )}

        <div
          className={
            stage === 'ai'
              ? 'grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-stretch lg:gap-8'
              : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_380px]'
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
              stage === 'ai' ? 'order-1' : 'order-1 lg:order-2 lg:sticky lg:top-8'
            }
          >
            {aiPanel}
          </aside>
          <div className={`order-2 w-full lg:order-1 ${formMaxWidthClassName} ${stage === 'ai' ? 'hidden' : ''}`}>
            {showAiNotice && (
              <div
                ref={noticeRef}
                role="status"
                className="mb-5 flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-[13px] leading-relaxed text-text-h"
              >
                <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
                <p className="flex-1">
                  La IA llenó el contenido y los ajustes del juego. <strong>Ahora te toca a ti:</strong> escribe el{' '}
                  <strong>nombre del juego</strong> y la <strong>descripción</strong>, y elige la{' '}
                  <strong>materia</strong> — la IA no los completa. Revisa también lo que generó antes de crear el
                  juego.
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
          {stage === 'ai' && (
            <button
              type="button"
              className="order-2 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-accent bg-accent/10 p-6 text-center transition-colors hover:bg-accent/20"
              onClick={() => setStage('manual')}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white">
                <PencilLine className="h-7 w-7" strokeWidth={2.2} />
              </span>
              <span className="text-[18px] font-bold text-text-h">Llenar manualmente</span>
              <span className="text-[13px] leading-snug text-text">
                Prefieres escribirlo tú: completa el formulario a tu ritmo. Podrás volver al chat de IA cuando quieras.
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
    {spotlightOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-5 backdrop-blur-md animate-[fade-in-up_0.25s_ease-out_backwards]"
        onClick={() => setSpotlightOpen(false)}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ai-draft-spotlight-title"
          className="w-full max-w-[460px] rounded-2xl border border-accent/40 bg-surface p-6 text-center shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <span
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            <PencilLine className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <h3 id="ai-draft-spotlight-title" className="mb-2 text-[18px] font-semibold text-text-h">
            ¡La IA llenó tu juego! Ahora te toca a ti
          </h3>
          <p className="mb-5 text-[14px] leading-relaxed text-text">
            La IA completó el contenido y los ajustes. Para poder crear el juego, escribe tú el{' '}
            <strong className="text-text-h">nombre del juego</strong> y la{' '}
            <strong className="text-text-h">descripción</strong>, y elige la{' '}
            <strong className="text-text-h">materia</strong>. Revisa también lo que generó la IA.
          </p>
          <button
            type="button"
            autoFocus
            className="w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            onClick={() => setSpotlightOpen(false)}
          >
            Entendido, completar los datos
          </button>
        </div>
      </div>
    )}
    </AiPanelVariantContext.Provider>
    </AiDraftAppliedContext.Provider>
  )
}
