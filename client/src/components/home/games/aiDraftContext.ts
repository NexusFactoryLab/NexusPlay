import { createContext, useContext } from 'react'

/**
 * Lo provee GameFormShell: AiGameAssistantPanel lo llama cuando la IA ya
 * llenó el formulario, para que el shell muestre el aviso de qué falta
 * completar a mano (nombre, descripción, materia). `null` fuera de un shell.
 */
export const AiDraftAppliedContext = createContext<(() => void) | null>(null)

export function useMarkAiDraftApplied(): (() => void) | null {
  return useContext(AiDraftAppliedContext)
}

/**
 * Cómo muestra GameFormShell el asistente de IA: `inline` = chat grande en
 * pantalla (primer paso tras elegir el tipo, issue #52); `compact` = botón
 * llamativo que abre el chat en un modal (modo manual). Sin shell: `compact`.
 */
export type AiPanelVariant = 'inline' | 'compact'
export const AiPanelVariantContext = createContext<AiPanelVariant>('compact')

export function useAiPanelVariant(): AiPanelVariant {
  return useContext(AiPanelVariantContext)
}
