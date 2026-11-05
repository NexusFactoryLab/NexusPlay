import { useEffect, useId, useState } from 'react'
import { Modal } from './Modal'
import {
  downloadTournamentSignaturesCsv,
  listTournamentSignatures,
  type TournamentSignatureRow,
} from '../../../services/tournament-agreement.service'

type Props = { code: string; token: string; onClose: () => void }

/** Respaldo de firmas del acuerdo para quien modera el torneo (issue #173): quién firmó, cuándo y qué versión. */
export function TournamentSignaturesModal({ code, token, onClose }: Props) {
  const titleId = useId()
  const [rows, setRows] = useState<TournamentSignatureRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listTournamentSignatures(token, code)
      .then((value) => alive && setRows(value))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'No se pudo cargar el respaldo.'))
    return () => {
      alive = false
    }
  }, [token, code])

  return (
    <Modal onClose={onClose} ariaLabelledBy={titleId} maxWidthClassName="max-w-[720px]" maxHeightClassName="max-h-[90vh]">
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <h2 id={titleId} className="font-heading text-lg font-semibold text-text-h">
          Firmas del acuerdo · torneo {code}
        </h2>
        {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
        {!rows && !error && <p role="status" className="text-[14px] text-text">Cargando...</p>}
        {rows && rows.length === 0 && <p className="text-[14px] text-text">Nadie ha firmado todavía.</p>}
        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] text-text">
              <caption className="sr-only">Personas que firmaron el acuerdo</caption>
              <thead>
                <tr className="border-b border-border text-text-h">
                  <th scope="col" className="py-1 pr-3">Nombre</th>
                  <th scope="col" className="py-1 pr-3">Firmó (UTC)</th>
                  <th scope="col" className="py-1 pr-3">Versión</th>
                  <th scope="col" className="py-1">Menor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.userId}-${index}`} className="border-b border-border/50">
                    <td className="py-1 pr-3">{row.fullName}</td>
                    <td className="py-1 pr-3">{row.signedAt.replace('T', ' ').slice(0, 19)}</td>
                    <td className="py-1 pr-3">{row.textVersion}</td>
                    <td className="py-1">{row.isMinor ? `Sí (acudiente: ${row.guardianFullName ?? ''})` : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => void downloadTournamentSignaturesCsv(token, code).catch((e) => setError(e.message))} disabled={!rows?.length} className="rounded-lg border border-border px-3 py-2 text-[13px] text-text disabled:opacity-50 hover:border-accent/50">
            Descargar CSV
          </button>
          <button type="button" onClick={onClose} className="rounded-lg bg-accent px-3 py-2 text-[13px] font-semibold text-white">
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
