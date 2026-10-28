import { useEffect, useId, useRef, useState } from 'react'
import { LogOut, WifiOff } from 'lucide-react'
import { useCountdown } from './MatchBoard'
import { PLAYER_WAIT_MS, joinNames, type PlayerWait } from './playerWait'

type PlayerWaitOverlayProps = {
  wait: PlayerWait
  /** «Sí, salir»: deja la partida (cada juego sabe cómo). */
  onLeave: () => void
}

/**
 * Pausa por desconexión (issue #120), igual en todos los juegos en línea:
 * «Esperando a {nombre}…» con la cuenta regresiva de la espera y un botón
 * Salir que pide confirmación —«Sí, salir» o «No, esperar al jugador»—. La
 * partida sigue sola cuando el otro vuelve (el servidor la reanuda).
 */
export function PlayerWaitOverlay({ wait, onLeave }: PlayerWaitOverlayProps) {
  const [confirming, setConfirming] = useState(false)
  const remainingMs = useCountdown(wait.deadline)
  const seconds = Math.ceil(remainingMs / 1000)
  const plural = wait.names.length > 1
  const titleId = useId()
  const textId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const exitButton = useRef<HTMLButtonElement>(null)
  const stayButton = useRef<HTMLButtonElement>(null)

  // El foco va a la opción segura: al abrir, «Salir»; al confirmar, «No, esperar al jugador».
  useEffect(() => {
    if (confirming) stayButton.current?.focus()
    else exitButton.current?.focus()
  }, [confirming])

  const progress = Math.max(0, Math.min(1, remainingMs / PLAYER_WAIT_MS))

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm animate-[modal-backdrop-in_0.2s_ease-out]"
      role="presentation"
      data-player-wait=""
    >
      <div
        ref={panel}
        role={confirming ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        className="w-full max-w-[400px] rounded-2xl border border-border bg-surface p-5 text-center shadow-[var(--shadow)] animate-[accusation-overlay-pop-in_0.25s_cubic-bezier(0.16,1,0.3,1)] sm:p-6"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && confirming) {
            event.stopPropagation()
            setConfirming(false)
          }
          if (event.key !== 'Tab') return
          const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
          const first = buttons[0]
          const last = buttons[buttons.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
      >
        {confirming ? (
          <div key="confirm" className="animate-[fade-in-up_0.2s_ease-out]">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger" aria-hidden="true">
              <LogOut className="h-7 w-7" strokeWidth={2.2} />
            </span>
            <h2 id={titleId} className="text-[19px] font-extrabold text-text-h">
              ¿Seguro que deseas salir?
            </h2>
            <p id={textId} className="mt-1.5 text-[14px] leading-snug text-text">
              Si sales, la partida termina y {plural ? 'no podrán' : 'no podrá'} seguir jugando contigo.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                ref={stayButton}
                type="button"
                className="flex-1 rounded-xl bg-accent px-4 py-3 text-[14px] font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => setConfirming(false)}
              >
                No, esperar al jugador
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-[14px] font-bold text-danger transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                onClick={onLeave}
              >
                Sí, salir
              </button>
            </div>
          </div>
        ) : (
          <div key="wait" className="animate-[fade-in-up_0.2s_ease-out]">
            <span className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center" aria-hidden="true">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/25 motion-reduce:animate-none" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
                <WifiOff className="h-8 w-8" strokeWidth={2.2} />
              </span>
            </span>
            <h2 id={titleId} className="text-[20px] font-extrabold text-text-h" aria-live="polite">
              Esperando a {joinNames(wait.names)}…
            </h2>
            <p id={textId} className="mt-1.5 text-[14px] leading-snug text-text">
              {plural ? 'Se desconectaron.' : 'Se desconectó.'} La partida sigue cuando {plural ? 'vuelvan' : 'vuelva'}.
            </p>
            <div className="mt-4" role="timer" aria-label={`Quedan ${seconds} segundos de espera`}>
              <div className="h-2 overflow-hidden rounded-full bg-border/60">
                <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] font-semibold tabular-nums text-text-h">Quedan {seconds} s</p>
            </div>
            <button
              ref={exitButton}
              type="button"
              className="mx-auto mt-5 flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-[14px] font-semibold text-text-h transition-colors hover:border-danger/50 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => setConfirming(true)}
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              Salir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
