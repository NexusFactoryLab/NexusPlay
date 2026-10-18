import type { GameDraft } from '../../../services/ai-game-assistant.service'
import { classifySaveError } from './creationDraftSupport'

/** Resultado de la IA (con el mensaje y los archivos que se le enviaron) pendiente de guardar. */
export type AiSavePayload = { result: GameDraft; message: string; files: File[] }

export type DraftSaveDeps = {
  saveForm: (state: Record<string, unknown>) => Promise<void>
  saveAi: (payload: AiSavePayload) => Promise<void>
  /** Descarta el borrador en curso en el servidor (borra la fila si existe y sus recursos con la etiqueta). */
  discard: () => Promise<void>
  /** El guardado chocó con el tope de borradores. `first` es true solo la primera vez del bloqueo. */
  onBlocked: (first: boolean) => void
  /** Ya no hay bloqueo (se guardó o se descartó). */
  onUnblocked: () => void
  /** Cualquier otro fallo de guardado. */
  onOtherError: (error: unknown) => void
}

/**
 * Lleva el estado de guardado de un borrador frente al tope de 5 (issue #69):
 * cuando el servidor rechaza un borrador NUEVO, retiene en memoria el resultado
 * de la IA para no perderlo, avisa una sola vez y reintenta con el siguiente
 * cambio sin volver a pedir atención. Al liberar un cupo, `retryAfterFreeingSlot`
 * guarda el formulario y el resultado de IA retenido sin más pasos de la persona.
 */
export class DraftSaveController {
  blocked = false
  pendingAi: AiSavePayload | null = null
  private promptShown = false

  deps: DraftSaveDeps

  constructor(deps: DraftSaveDeps) {
    this.deps = deps
  }

  /** Guarda el formulario; si entra, también sube el resultado de IA retenido. */
  async saveForm(state: Record<string, unknown>): Promise<boolean> {
    try {
      await this.deps.saveForm(state)
    } catch (error) {
      this.handleError(error)
      return false
    }
    this.markSaved()
    await this.flushPendingAi()
    return true
  }

  /** Guarda el resultado de la IA; si el tope lo rechaza, queda retenido en memoria. */
  async saveAi(payload: AiSavePayload): Promise<boolean> {
    try {
      await this.deps.saveAi(payload)
    } catch (error) {
      if (classifySaveError(error) === 'limit') this.pendingAi = payload
      this.handleError(error)
      return false
    }
    this.pendingAi = null
    this.markSaved()
    return true
  }

  /** Tras eliminar otro borrador: guarda ya el formulario y el resultado de IA retenido. */
  async retryAfterFreeingSlot(state: Record<string, unknown>): Promise<boolean> {
    const formSaved = await this.saveForm(state)
    return formSaved && this.pendingAi === null && !this.blocked
  }

  /** Descartar el progreso: se olvida lo retenido y se borra lo que haya en el servidor. */
  async discardProgress(): Promise<void> {
    await this.deps.discard()
    this.pendingAi = null
    this.blocked = false
    this.promptShown = false
    this.deps.onUnblocked()
  }

  private async flushPendingAi(): Promise<void> {
    const pending = this.pendingAi
    if (!pending) return
    this.pendingAi = null
    try {
      await this.deps.saveAi(pending)
    } catch (error) {
      this.pendingAi = pending
      this.handleError(error)
    }
  }

  private handleError(error: unknown): void {
    if (classifySaveError(error) === 'limit') {
      this.blocked = true
      const first = !this.promptShown
      this.promptShown = true
      this.deps.onBlocked(first)
    } else {
      this.deps.onOtherError(error)
    }
  }

  private markSaved(): void {
    if (!this.blocked && !this.promptShown) return
    this.blocked = false
    this.promptShown = false
    this.deps.onUnblocked()
  }
}
