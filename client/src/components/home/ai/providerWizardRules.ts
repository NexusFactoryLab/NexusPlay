import type { AiProviderKind } from '../../../services/ai-provider-config.service'

/** Reglas puras del asistente de alta/edición de proveedor (3 pasos: Conexión → Modelos → Ajustes). */

/** Una URL con pinta de dirección: http(s) hacia `localhost` o un dominio con punto. El servidor valida el resto. */
export const URL_PATTERN = /^https?:\/\/(localhost|[^\s/]+\.[^\s/]+)/i

/** Largo mínimo de una API key recién pegada (el servidor exige lo mismo). */
export const MIN_API_KEY_LENGTH = 8

export const LAST_STEP = 2

/**
 * ¿Ya se puede pasar del paso de Conexión? Gemini no necesita URL; el resto
 * sí. La key debe estar pegada, salvo al editar (se conserva la guardada).
 */
export function connectionReady(input: {
  kind: AiProviderKind
  baseUrl: string
  typedKey: string
  isEdit: boolean
}): boolean {
  const hasAddress = input.kind === 'gemini' || URL_PATTERN.test(input.baseUrl.trim())
  const hasKey = input.typedKey.trim().length >= MIN_API_KEY_LENGTH || input.isEdit
  return hasAddress && hasKey
}

/** Botón "Siguiente/Guardar" deshabilitado: guardando, conexión incompleta o consultando modelos. */
export function isNextDisabled(input: {
  step: number
  submitting: boolean
  connectionReady: boolean
  modelsLoading: boolean
}): boolean {
  return input.submitting || (input.step === 0 && !input.connectionReady) || (input.step === 1 && input.modelsLoading)
}

export type StepCheck = { ok: true } | { ok: false; error: string | null }

/**
 * ¿Se puede salir de este paso? `error: null` = no avanza pero sin mensaje
 * (el botón ya está deshabilitado); con texto, es lo que se le muestra al usuario.
 */
export function checkStep(input: { step: number; connectionReady: boolean; textModel: string }): StepCheck {
  if (input.step === 0) return input.connectionReady ? { ok: true } : { ok: false, error: null }
  if (input.step === 1) {
    return input.textModel.trim() ? { ok: true } : { ok: false, error: 'Elige o escribe el modelo de texto.' }
  }
  return { ok: true }
}

/** Identidad de la conexión: dos escrituras equivalentes de la URL (mayúsculas del host, barras finales, espacios) son la misma. */
export function connectionKey(kind: AiProviderKind, baseUrl: string): string {
  if (kind === 'gemini') return 'gemini'
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  try {
    const url = new URL(trimmed)
    return `${kind}|${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return `${kind}|${trimmed}`
  }
}

/**
 * Los modelos (la lista consultada y los ya elegidos) pertenecen a UNA
 * conexión. Si cambió el tipo o la URL base, los que había quedan obsoletos y
 * deben limpiarse; si solo cambió el formato de lo escrito, se conservan.
 */
export function modelsAreStale(
  previous: { kind: AiProviderKind; baseUrl: string },
  next: { kind: AiProviderKind; baseUrl: string },
): boolean {
  return connectionKey(previous.kind, previous.baseUrl) !== connectionKey(next.kind, next.baseUrl)
}
