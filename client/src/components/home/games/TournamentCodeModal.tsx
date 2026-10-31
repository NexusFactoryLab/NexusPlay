import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords } from 'lucide-react'
import { Modal } from './Modal'
import { TournamentCodeEntry } from './TournamentCodeEntry'
import { useAuth } from '../../../hooks/useAuth'
import { LIVE_ROOM_ROUTES, resolveRoomCode } from './resolveRoomCode'

/**
 * Entrada al torneo desde el Inicio en un solo paso: se escribe el código y,
 * en cuanto está completo, se valida y se entra a la sala. Sin guía previa ni
 * página intermedia; las instrucciones se consultan ya dentro de la sala.
 */
export function TournamentCodeModal({ onClose }: { onClose: () => void }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function enter(complete: string) {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    resolveRoomCode(token, complete)
      .then((resolved) => {
        const route = LIVE_ROOM_ROUTES[resolved.kind]
        if (route) navigate(route(complete))
        else setError('Ese código no corresponde a una sala disponible.')
      })
      .catch((err: Error) => setError(err.message || 'No existe un torneo con ese código.'))
      .finally(() => setBusy(false))
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-[440px]" ariaLabel="Entrar al torneo">
      <div className="flex flex-col items-center gap-5 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_12px_26px_-12px_var(--accent-2)]"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
        >
          <Swords className="h-6 w-6" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-text-h">Entrar al torneo</h2>
          <p className="mt-1 text-[13px] text-text">Escribe el código de 6 caracteres que te dio el administrador.</p>
        </div>
        <TournamentCodeEntry
          value={code}
          onChange={(next) => {
            setCode(next)
            setError(null)
          }}
          onComplete={enter}
          disabled={busy}
          invalid={error !== null}
        />
        <p className={`min-h-5 text-[13px] transition-colors duration-200 ${error ? 'font-medium text-danger' : 'text-text'}`} role={error ? 'alert' : 'status'}>
          {busy ? 'Buscando el torneo…' : (error ?? '')}
        </p>
        <button
          type="button"
          className="w-full rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-text-h transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
