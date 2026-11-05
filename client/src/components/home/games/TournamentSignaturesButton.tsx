import { useState } from 'react'
import { FileSignature } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { TournamentSignaturesModal } from './TournamentSignaturesModal'

/** Abre el respaldo de firmas del acuerdo del torneo (issue #173). Solo se monta para quien modera. */
export function TournamentSignaturesButton({ code }: { code: string }) {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)
  if (!token) return null
  return (
    <>
      <button
        type="button"
        className="flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-text-h transition-all duration-200 hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={() => setOpen(true)}
      >
        <FileSignature className="h-4 w-4" strokeWidth={2} />
        Firmas del acuerdo
      </button>
      {open && <TournamentSignaturesModal code={code} token={token} onClose={() => setOpen(false)} />}
    </>
  )
}
