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

/**
 * Lo provee GameFormShell: el panel de IA avisa cuándo está generando para
 * que el shell muestre, al lado del chat, el formulario "armándose".
 */
export const AiGeneratingContext = createContext<((generating: boolean) => void) | null>(null)

export function useSetAiGenerating(): ((generating: boolean) => void) | null {
  return useContext(AiGeneratingContext)
}

/**
 * Lo provee GameFormShell: el panel lo llama en cada paso del llenado
 * animado del borrador (índice 0 = ajustes) para que el shell lleve la vista
 * hasta el campo que acaba de llenarse y lo resalte.
 */
export const AiFillStepContext = createContext<((stepIndex: number) => void) | null>(null)

export function useAiFillStep(): ((stepIndex: number) => void) | null {
  return useContext(AiFillStepContext)
}

/**
 * Lo provee GameFormShell: en modo manual, el botón "Generar con IA" del panel
 * vuelve a la pantalla del chat (en vez de abrir un modal) para que
 * regenerar siga el mismo flujo y la vista nunca quede desincronizada.
 */
export const AiRequestChatContext = createContext<(() => void) | null>(null)

export function useRequestAiChat(): (() => void) | null {
  return useContext(AiRequestChatContext)
}
