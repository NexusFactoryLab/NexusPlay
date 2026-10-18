import { createContext, useContext, useEffect } from 'react'
import type { GameDraft } from '../../../services/ai-game-assistant.service'
import type { CreationDraftFileInfo } from '../../../services/game-creation-draft.service'

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

/**
 * Lo provee GameFormShell (issue #69): persistencia del resultado de la IA en
 * el borrador del servidor. El panel guarda lo que genera (con los archivos
 * que subió), reutiliza un resultado ya guardado en vez de volver a llamar a
 * la IA (ahorro de tokens) y restaura todo cuando la persona elige Continuar.
 */
export type AiDraftPersist = {
  /**
   * Se llena al retomar un borrador: mensaje y archivos (ya en Cloudinary) que
   * se enviaron a la IA. El formulario se restaura aparte, sin volver a llamar
   * a la IA; `nonce` distingue restauraciones.
   */
  restore: { nonce: number; message: string; files: CreationDraftFileInfo[] } | null
  /** Resultado guardado para exactamente este mensaje y estos archivos, si existe. */
  findCached: (message: string, files: File[]) => GameDraft | null
  /** Guarda el resultado recién generado junto con sus archivos y mensaje. */
  save: (result: GameDraft, message: string, files: File[]) => void
}

export const AiDraftPersistContext = createContext<AiDraftPersist | null>(null)

export function useAiDraftPersist(): AiDraftPersist | null {
  return useContext(AiDraftPersistContext)
}

/**
 * Lo provee GameFormShell (issue #69): id del borrador en curso y aviso de
 * edición. Los campos de subida (imagen, audio) mandan el id para que el
 * servidor etiquete el recurso con `draft-<id>`, y avisan al terminar una
 * subida para que se guarde el borrador aunque no hubo evento de teclado.
 */
export type DraftUploadInfo = { draftId: string; markTouched: () => void }

export const DraftUploadContext = createContext<DraftUploadInfo | null>(null)

export function useDraftUpload(): DraftUploadInfo | null {
  return useContext(DraftUploadContext)
}
