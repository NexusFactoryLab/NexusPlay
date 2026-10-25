/**
 * Aplicación de la identidad (título, descripción, área) que sugiere la IA a un formulario
 * de creación de juego. Funciones puras, compartidas por todos los formularios.
 *
 * Regla: solo se sobrescribe lo que el usuario no escribió. Un campo vacío se llena; uno que
 * ya trae una sugerencia anterior de la IA (y sigue igual) se puede reemplazar; uno con texto
 * del usuario no se toca. Un campo sugerido queda marcado hasta que el usuario lo edita o lo confirma.
 */

export type IdentityField = 'title' | 'description' | 'categoryId'

export type IdentityValues = Record<IdentityField, string>

/** Estado de las sugerencias: qué campos son de la IA y qué valor exacto se puso. */
export type AiIdentityState = {
  suggested: Record<IdentityField, boolean>
  applied: Partial<IdentityValues>
}

export type IdentityDraft = { title?: string; description?: string; categoryId?: string | null }

export const EMPTY_AI_IDENTITY: AiIdentityState = {
  suggested: { title: false, description: false, categoryId: false },
  applied: {},
}

export const IDENTITY_FIELD_LABELS: Record<IdentityField, string> = {
  title: 'Título',
  description: 'Descripción',
  categoryId: 'Área',
}

const FIELDS: IdentityField[] = ['title', 'description', 'categoryId']

/** Quita las sugerencias de campos que el usuario cambió después de que la IA los llenó. */
export function reconcileEdits(state: AiIdentityState, current: IdentityValues): AiIdentityState {
  let changed = false
  const suggested = { ...state.suggested }
  for (const field of FIELDS) {
    if (suggested[field] && current[field] !== state.applied[field]) {
      suggested[field] = false
      changed = true
    }
  }
  return changed ? { ...state, suggested } : state
}

/** El usuario confirma una sugerencia: la etiqueta desaparece y el valor queda como suyo. */
export function confirmSuggestion(state: AiIdentityState, field: IdentityField): AiIdentityState {
  if (!state.suggested[field]) return state
  return { ...state, suggested: { ...state.suggested, [field]: false } }
}

export type IdentityPlan = {
  /** Valores a escribir en el formulario (solo los campos que se aplican). */
  values: Partial<IdentityValues>
  state: AiIdentityState
  /** true si se aplicó al menos un campo. */
  applied: boolean
}

/**
 * Decide qué campos de la sugerencia se escriben. `validCategoryIds` son las áreas que el
 * formulario conoce: un área desconocida (o null) no se aplica nunca.
 */
export function planIdentityApplication(
  draft: IdentityDraft,
  current: IdentityValues,
  state: AiIdentityState,
  validCategoryIds: readonly string[],
): IdentityPlan {
  const values: Partial<IdentityValues> = {}
  const suggested = { ...state.suggested }
  const applied = { ...state.applied }

  const candidates: Record<IdentityField, string | null> = {
    title: draft.title?.trim() || null,
    description: draft.description?.trim() || null,
    categoryId: draft.categoryId && validCategoryIds.includes(draft.categoryId) ? draft.categoryId : null,
  }

  for (const field of FIELDS) {
    const next = candidates[field]
    if (!next) continue
    const existing = current[field]
    const isOursAndUntouched = state.suggested[field] && state.applied[field] === existing
    if (existing.trim() === '' || isOursAndUntouched) {
      values[field] = next
      suggested[field] = true
      applied[field] = next
    }
  }
  return { values, state: { suggested, applied }, applied: Object.keys(values).length > 0 }
}

/** Campos que hoy muestran la etiqueta "Sugerido por IA", en orden. */
export function suggestedFields(state: AiIdentityState): IdentityField[] {
  return FIELDS.filter((field) => state.suggested[field])
}
