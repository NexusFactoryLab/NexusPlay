import { createContext, useContext, useEffect } from 'react'

/**
 * Lo provee GameFormShell: AiGameAssistantPanel lo llama cuando la IA ya
 * llenó el formulario, para que el shell muestre el aviso de qué falta
 * completar a mano (nombre, descripción, área). `null` fuera de un shell.
 */
export const AiDraftAppliedContext = createContext<(() => void) | null>(null)

export function useMarkAiDraftApplied(): (() => void) | null {
  return useContext(AiDraftAppliedContext)
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

/** Resumen que cada formulario reporta al shell para mostrarlo antes de crear. */
export type CreateSummary = {
  /** Cuántos elementos tiene el juego (parejas, tarjetas, preguntas...). */
  count: number
  /** Nombre en plural del elemento, ej. "parejas". */
  itemsLabel: string
  /** Elementos que aún no tienen imagen (si el tipo de juego usa imágenes). */
  missingImages?: number
}

export const CreateSummaryContext = createContext<((summary: CreateSummary | null) => void) | null>(null)

/** Reporta al shell el resumen del juego; se limpia al desmontar. */
export function useReportCreateSummary(summary: CreateSummary): void {
  const report = useContext(CreateSummaryContext)
  const { count, itemsLabel, missingImages } = summary
  useEffect(() => {
    report?.({ count, itemsLabel, missingImages })
  }, [report, count, itemsLabel, missingImages])
  useEffect(() => () => report?.(null), [report])
}
