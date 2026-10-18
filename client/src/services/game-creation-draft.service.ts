import { request } from '../utils/http'
import type { GameDraft } from './ai-game-assistant.service'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

/** Valor de un control del formulario, en el orden en que aparece en pantalla. */
export type FormControlSnapshot = { label: string; value: string }

export type FormStateSnapshot = { controls: FormControlSnapshot[] }

export type CreationDraftFileInfo = { id: string; filename: string; mimeType: string; sizeBytes: number }

/**
 * Borrador de creación de juego guardado en el servidor (issue #69). No
 * confundir con `GameDraft`, que es lo que devuelve la IA (va en `aiResult`).
 */
export type GameCreationDraft = {
  gameType: string
  mode: string
  formState: FormStateSnapshot | null
  aiResult: GameDraft | null
  aiMessage: string | null
  updatedAt: string
  files: CreationDraftFileInfo[]
}

function query(gameType: string, mode?: string): string {
  const params = new URLSearchParams({ gameType })
  if (mode !== undefined) params.set('mode', mode)
  return params.toString()
}

export function getCreationDraft(token: string, gameType: string, mode: string): Promise<GameCreationDraft | null> {
  return request<GameCreationDraft | null>(`/games/creation-drafts?${query(gameType, mode)}`, { token })
}

export async function saveCreationDraftForm(
  token: string,
  gameType: string,
  mode: string,
  formState: FormStateSnapshot,
): Promise<void> {
  await request('/games/creation-drafts', { method: 'PUT', token, body: { gameType, mode, formState } })
}

/** Guarda el resultado de la IA junto con los archivos y el mensaje que se le enviaron. */
export async function saveCreationDraftAi(
  token: string,
  gameType: string,
  mode: string,
  result: GameDraft,
  message: string,
  files: File[],
): Promise<void> {
  const formData = new FormData()
  formData.append('gameType', gameType)
  formData.append('mode', mode)
  formData.append('result', JSON.stringify(result))
  if (message.trim()) formData.append('message', message.trim())
  for (const file of files) formData.append('files', file)
  const response = await fetch(`${API_URL}/games/creation-drafts/ai`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) throw new Error('No se pudo guardar el borrador de la IA.')
}

/** Descarga un archivo guardado del borrador y lo devuelve como `File`. */
export async function downloadCreationDraftFile(token: string, info: CreationDraftFileInfo): Promise<File> {
  const response = await fetch(`${API_URL}/games/creation-drafts/files/${info.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })
  if (!response.ok) throw new Error('No se pudo recuperar un archivo del borrador.')
  const blob = await response.blob()
  return new File([blob], info.filename, { type: info.mimeType })
}

/** Sin `mode` borra los borradores de todos los modos de ese tipo de juego. */
export async function deleteCreationDraft(token: string, gameType: string, mode?: string): Promise<void> {
  await request(`/games/creation-drafts?${query(gameType, mode)}`, { method: 'DELETE', token })
}
