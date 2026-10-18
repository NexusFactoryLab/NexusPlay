import type { GameDraft } from '../../../services/ai-game-assistant.service'
import type { CreationDraftFileInfo } from '../../../services/game-creation-draft.service'

/** Query param con el que "Continuar" abre un formulario con un borrador guardado. */
export const DRAFT_QUERY_PARAM = 'borrador'

// --- Cuándo se autoguarda ----------------------------------------------------

/**
 * Un cambio del estado del formulario se guarda solo si el borrador ya está
 * listo (no se está cargando uno que se retoma) y la persona interactuó. Un
 * formulario que nace de "Adaptar con IA" cuenta como interactuado desde el
 * inicio: su contenido ya adaptado es trabajo que no debe perderse.
 */
export function shouldAutosave(state: { persistReady: boolean; touched: boolean }): boolean {
  return state.persistReady && state.touched
}

/** Valor inicial de "interactuó": true si el formulario se abrió con un borrador adaptado. */
export function initialTouched(adaptation: unknown): boolean {
  return adaptation !== undefined && adaptation !== null
}

// --- Reutilización del resultado de la IA (ahorro de tokens) -----------------

type SignedFile = { name: string; size: number }

type StoredMarker = { nxStored?: { url: string; sizeBytes: number } }

/**
 * Firma de un archivo para decidir si es "el mismo": nombre y tamaño. Los
 * archivos recuperados del borrador (ya en Cloudinary) traen su tamaño original.
 */
export function fileSignature(file: SignedFile): string {
  const stored = (file as StoredMarker).nxStored
  return `${file.name}:${stored?.sizeBytes ?? file.size}`
}

export type AiResultCache = { message: string; signatures: string[]; result: GameDraft }

export function buildAiCache(message: string, files: SignedFile[], result: GameDraft): AiResultCache {
  return { message: message.trim(), signatures: files.map(fileSignature).sort(), result }
}

/** Resultado guardado si el mensaje y los archivos son exactamente los mismos; si no, `null`. */
export function findCachedAiResult(
  cache: AiResultCache | null,
  message: string,
  files: SignedFile[],
): GameDraft | null {
  if (!cache || cache.message !== message.trim()) return null
  const signatures = files.map(fileSignature).sort()
  const same = signatures.length === cache.signatures.length && signatures.every((sig, i) => sig === cache.signatures[i])
  return same ? cache.result : null
}

// --- Archivos de la IA recuperados desde Cloudinary --------------------------

/**
 * Archivo "marcador" de un archivo ya subido a Cloudinary: se ve y se firma
 * como el original, pero no tiene contenido; `materializeFiles` lo descarga si
 * hay que reenviarlo a la IA.
 */
export function createStoredFile(info: CreationDraftFileInfo): File {
  const file = new File([], info.filename, { type: info.mimeType })
  ;(file as File & StoredMarker).nxStored = { url: info.url, sizeBytes: info.sizeBytes }
  return file
}

export function isStoredFile(file: File): boolean {
  return !!(file as File & StoredMarker).nxStored
}

/** Reemplaza los marcadores por el archivo real (descargado de Cloudinary). */
export async function materializeFiles(
  files: File[],
  fetcher: typeof fetch = fetch,
): Promise<File[]> {
  return Promise.all(
    files.map(async (file) => {
      const stored = (file as File & StoredMarker).nxStored
      if (!stored) return file
      const response = await fetcher(stored.url)
      if (!response.ok) throw new Error('No se pudo recuperar un archivo del borrador.')
      return new File([await response.blob()], file.name, { type: file.type })
    }),
  )
}

// --- Lectura defensiva del estado guardado de un formulario ------------------

export type SavedState = Record<string, unknown>

export function asSavedState(value: unknown): SavedState {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SavedState) : {}
}

export function savedString(state: SavedState, key: string, fallback: string): string {
  const value = state[key]
  return typeof value === 'string' ? value : fallback
}

export function savedNullableString(state: SavedState, key: string): string | null {
  const value = state[key]
  return typeof value === 'string' ? value : null
}

export function savedNumber(state: SavedState, key: string, fallback: number): number {
  const value = state[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function savedBoolean(state: SavedState, key: string, fallback: boolean): boolean {
  const value = state[key]
  return typeof value === 'boolean' ? value : fallback
}

/** Lista guardada, o `null` si falta o no es una lista (entonces no se pisa el valor actual). */
export function savedList<T>(state: SavedState, key: string): T[] | null {
  const value = state[key]
  return Array.isArray(value) ? (value as T[]) : null
}

export function savedObject<T extends object>(state: SavedState, key: string): T | null {
  const value = state[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null
}

/** Índice seleccionado dentro del rango de la lista (por si la lista cambió). */
export function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(0, Math.trunc(index)), Math.max(0, length - 1))
}

// --- Navegación desde "Ver borradores" ---------------------------------------

const ROUTE_BY_GAME_TYPE: Record<string, string> = {
  GUESS_WHO: '/juegos/crear/quien-es',
  DOMINO: '/juegos/crear/domino',
  MAZE_COLLECTOR: '/juegos/crear/laberinto',
  SNAKES_LADDERS: '/juegos/crear/escaleras-serpientes',
  DUAL_QUEST: '/juegos/crear/dual-quest',
  TRUE_FALSE_MAZE: '/juegos/crear/laberinto-vf',
}

export const GAME_TYPE_LABEL: Record<string, string> = {
  MEMORY_MATCH: 'Cartas',
  GUESS_WHO: '¿Quién Es?',
  DOMINO: 'Dominó',
  MAZE_COLLECTOR: 'Laberinto coleccionista',
  SNAKES_LADDERS: 'Escaleras y serpientes',
  DUAL_QUEST: 'Dúo Lógico',
  TRUE_FALSE_MAZE: 'Laberinto V/F',
}

/** Etiqueta del tipo de juego (con el modo para Cartas). */
export function draftTypeLabel(gameType: string, mode: string): string {
  if (gameType === 'MEMORY_MATCH') return mode === 'OPPOSITES' ? 'Cartas · Opuestos' : 'Cartas · Parejas'
  return GAME_TYPE_LABEL[gameType] ?? gameType
}

/** Ruta del formulario que continúa un borrador. */
export function draftResumePath(draft: { id: string; gameType: string; mode: string }): string {
  const base =
    draft.gameType === 'MEMORY_MATCH'
      ? draft.mode === 'OPPOSITES'
        ? '/juegos/crear/cartas/opuestos'
        : '/juegos/crear/cartas/parejas'
      : (ROUTE_BY_GAME_TYPE[draft.gameType] ?? '/juegos/crear')
  return `${base}?${DRAFT_QUERY_PARAM}=${encodeURIComponent(draft.id)}`
}
