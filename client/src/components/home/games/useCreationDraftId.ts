import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DRAFT_QUERY_PARAM } from './creationDraftSupport'

/**
 * Id del borrador de esta sesión de creación (issue #69). Con `?borrador=<id>`
 * (botón Continuar de "Ver borradores") se retoma ese borrador; si no, se
 * genera uno nuevo. El id se fija al abrir el formulario: el servidor lo usa
 * como clave del borrador y como etiqueta `draft-<id>` de las subidas.
 */
export function useCreationDraftId(): { draftId: string; resuming: boolean } {
  const [params] = useSearchParams()
  const [session] = useState(() => {
    const fromUrl = params.get(DRAFT_QUERY_PARAM)
    return { draftId: fromUrl ?? crypto.randomUUID(), resuming: !!fromUrl }
  })
  return session
}
