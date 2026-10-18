import type { CSSProperties } from 'react'
import { Gamepad2 } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { stepFromPath } from './steps'
import { headerSegmentFill } from './fieldAssist'
import { CreateGameProgressProvider, useCreateGameProgress } from './CreateGameProgressContext'
import { ScrollMoreHint } from '../../../ScrollMoreHint'
import { MeadowScenery } from '../../FantasyDecor'

function CreateGameLayoutContent() {
  const location = useLocation()
  const { subPhase, fill } = useCreateGameProgress()
  const { label, step, total } = stepFromPath(location.pathname, subPhase)

  return (
    <div className="create-game-layout fixed inset-0 flex flex-col bg-bg">
      <MeadowScenery />
      <header className="create-game-header shrink-0 border-b border-border px-5 pb-3 pt-4 sm:px-8">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            <Gamepad2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight tracking-tight text-text-h">Crear juego</p>
            <p key={label} className="nx-step-label truncate text-[12.5px] text-text">
              {label}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-code-bg px-3 py-1 text-[12px] font-semibold text-text-h">
            Paso {step} de {total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step}
          aria-label={`Paso ${step} de ${total}: ${label}`}
          className="mt-3 flex gap-1.5"
        >
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className="nx-progress-seg"
              data-state={index + 1 < step ? 'done' : index + 1 === step ? 'current' : 'todo'}
              style={
                index + 1 === step && subPhase
                  ? ({ '--nx-fill': headerSegmentFill(fill) } as CSSProperties)
                  : undefined
              }
            />
          ))}
        </div>
      </header>
      {/* `app-main`: mismas piezas de Fantasía que las secciones del inicio (ver index.css). */}
      <main className="app-main flex-1 overflow-y-auto">
        {/* Issue #69: "Continuar" otro borrador del mismo tipo cambia solo el query; la clave remonta el formulario. */}
        <Outlet key={location.pathname + location.search} />
        <ScrollMoreHint />
      </main>
    </div>
  )
}

/** Contenedor inmersivo del flujo de creación de juegos: página completa, sin Sidebar. */
export function CreateGameLayout() {
  return (
    <CreateGameProgressProvider>
      <CreateGameLayoutContent />
    </CreateGameProgressProvider>
  )
}
