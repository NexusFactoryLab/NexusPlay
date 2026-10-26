import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import type { GameDraft } from '../../../services/ai-game-assistant.service'
import {
  EMPTY_AI_IDENTITY,
  IDENTITY_FIELD_LABELS,
  confirmSuggestion,
  planIdentityApplication,
  reconcileEdits,
  suggestedFields,
  type AiIdentityState,
  type IdentityField,
} from './aiIdentity'

type Options = {
  title: string
  description: string
  categoryId: string
  /** Ids de las áreas que el formulario conoce; una sugerencia fuera de esta lista se ignora. */
  categoryIds: string[]
  setTitle: (value: string) => void
  setDescription: (value: string) => void
  setCategoryId: (value: string) => void
  /** Lleva al usuario a la fase de Identidad tras generar (formularios con fases). */
  goToIdentity?: () => void
}

/**
 * Aplica al formulario el título, la descripción y el área que sugiere la IA (todos los tipos de
 * juego) sin pisar lo que el usuario escribió, y lleva la cuenta de qué campos muestran la
 * etiqueta "Sugerido por IA". Se usa desde `onDraftReady`: `onDraft(draft, meta)`.
 */
export function useAiIdentity(options: Options) {
  const [state, setState] = useState<AiIdentityState>(EMPTY_AI_IDENTITY)
  // Los borradores llegan desde un proceso asíncrono con un cierre antiguo: siempre se lee lo último.
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  // Editar un campo sugerido le quita la etiqueta.
  const { title, description, categoryId } = options
  useEffect(() => {
    setState((current) => reconcileEdits(current, { title, description, categoryId }))
  }, [title, description, categoryId])

  function onDraft(draft: GameDraft, meta?: { final: boolean }) {
    if (!meta?.final) return
    const o = latest.current
    const plan = planIdentityApplication(
      draft,
      { title: o.title, description: o.description, categoryId: o.categoryId },
      stateRef.current,
      o.categoryIds,
    )
    if (plan.values.title !== undefined) o.setTitle(plan.values.title)
    if (plan.values.description !== undefined) o.setDescription(plan.values.description)
    if (plan.values.categoryId !== undefined) o.setCategoryId(plan.values.categoryId)
    stateRef.current = plan.state
    setState(plan.state)
    // Se lleva a Identidad aunque la IA no haya sugerido nada nuevo: ahí se revisa lo que falte.
    o.goToIdentity?.()
  }

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  function confirm(field: IdentityField) {
    setState((current) => confirmSuggestion(current, field))
  }

  return { state, onDraft, confirm, fields: suggestedFields(state) }
}

/** Fila de etiquetas "Sugerido por IA" (una por campo sugerido); se ponen sobre el campo de título. */
export function AiIdentityBadges({ ai }: { ai: ReturnType<typeof useAiIdentity> }) {
  if (ai.fields.length === 0) return null
  return (
    <div
      className="flex animate-[fade-in-up_0.25s_ease-out] flex-wrap items-center gap-2 text-[16px] text-text-h motion-reduce:animate-none"
      role="status"
    >
      <Sparkles className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      <span className="font-semibold">Sugerido por IA:</span>
      {ai.fields.map((field) => (
        <button
          key={field}
          type="button"
          onClick={() => ai.confirm(field)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border px-3 text-[16px] font-medium transition-colors duration-200 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
          style={{ background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))' }}
          aria-label={`${IDENTITY_FIELD_LABELS[field]} sugerido por IA: confirmar`}
          title="Toca para confirmar; si lo editas, la etiqueta desaparece"
        >
          {IDENTITY_FIELD_LABELS[field]}
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
