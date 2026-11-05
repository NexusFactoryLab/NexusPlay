import { useState } from 'react'
import { Check, Layers, Puzzle, UserRoundSearch, Globe } from 'lucide-react'

/**
 * Simulación de crear un juego, al final del Tutorial Completo (issue #171):
 * solo quien puede crear juegos (profesor/admin) la ve. Es una maqueta del
 * formulario real de /juegos/crear — nada de lo que se "guarda" aquí llega al
 * servidor — para que entienda las funciones completas sin detenerse mucho
 * tiempo: elige un tipo, escribe algo de contenido y ve el resultado.
 */
const DEMO_TYPES = [
  { id: 'cards', name: 'Parejas', icon: Layers, color: '#a78bfa' },
  { id: 'guess-who', name: '¿Quién Es?', icon: UserRoundSearch, color: '#06b6d4' },
  { id: 'domino', name: 'Dominó', icon: Puzzle, color: '#ff7a1a' },
  { id: 'maze', name: 'Salvando el mundo', icon: Globe, color: '#22c55e' },
] as const

type DemoStep = 'type' | 'content' | 'done'

export function TutorialCreateGameDemo({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<DemoStep>('type')
  const [typeId, setTypeId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')

  const chosen = DEMO_TYPES.find((type) => type.id === typeId)

  return (
    <div role="dialog" aria-modal="true" aria-label="Simulación de crear un juego" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="nx-stage-in w-full max-w-lg rounded-3xl border border-border bg-surface p-6 text-left shadow-[var(--shadow)] sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">Simulación · nada se guarda</p>

        {step === 'type' && (
          <>
            <h1 className="mt-1 text-xl font-extrabold text-text-h">Elige un tipo de juego</h1>
            <p className="mt-1 text-sm text-text/80">Así se ve al crear uno de verdad.</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {DEMO_TYPES.map((type) => {
                const Icon = type.icon
                const selected = typeId === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTypeId(type.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center transition-colors ${selected ? 'border-accent' : 'border-border hover:border-accent/50'}`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${type.color} 25%, transparent)`, color: type.color }}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-text-h">{type.name}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" disabled={!typeId} onClick={() => setStep('content')} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                Siguiente →
              </button>
            </div>
          </>
        )}

        {step === 'content' && chosen && (
          <>
            <h1 className="mt-1 text-xl font-extrabold text-text-h">Dale contenido a tu {chosen.name}</h1>
            <p className="mt-1 text-sm text-text/80">Un título y una pregunta de ejemplo — así se completa el real.</p>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-text-h">
                Título del juego
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ej. Capitales de Suramérica"
                  className="rounded-xl border border-border bg-bg px-3 py-2 text-sm font-normal text-text"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-text-h">
                Una pregunta
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ej. ¿Capital de Colombia?"
                  className="rounded-xl border border-border bg-bg px-3 py-2 text-sm font-normal text-text"
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button type="button" onClick={() => setStep('type')} className="rounded-lg px-2 py-2 text-sm text-text/80 hover:bg-code-bg">Atrás</button>
              <button type="button" onClick={() => setStep('done')} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white">
                Guardar →
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
            </span>
            <h1 className="mt-3 text-xl font-extrabold text-text-h">¡Así de fácil!</h1>
            <p className="mt-1 text-sm text-text/80">
              Esto era una demostración: no se guardó nada de verdad. Cuando crees tu primer juego real, lo encontrarás en «Mis juegos».
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" autoFocus onClick={onFinish} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white">
                Terminar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
