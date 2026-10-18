import { request } from '../utils/http'
import type { GameDraft } from './ai-game-assistant.service'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

/** Archivo que se subió a la IA; vive en Cloudinary y el borrador guarda su URL. */
export type CreationDraftFileInfo = { filename: string; mimeType: string; sizeBytes: number; url: string }

/** Fila de la lista "Ver borradores". */
export type CreationDraftSummary = {
  id: string
  gameType: string
  mode: string
  gameName: string
  updatedAt: string
}

/**
 * Borrador de creación de juego guardado en el servidor (issue #69). No
 * confundir con `GameDraft`, que es lo que devuelve la IA (va en `aiResult`).
 */
export type GameCreationDraft = {
  id: string
  gameType: string
  mode: string
  /** Estado completo del formulario, tal como lo serializó cada formulario. */
  formState: Record<string, unknown> | null
  aiResult: GameDraft | null
  aiMessage: string | null
  aiFiles: CreationDraftFileInfo[]
  updatedAt: string
}

export function listCreationDrafts(token: string): Promise<CreationDraftSummary[]> {
  return request<CreationDraftSummary[]>('/creation-drafts', { token })
}

export function getCreationDraft(token: string, id: string): Promise<GameCreationDraft> {
  return request<GameCreationDraft>(`/creation-drafts/${id}`, { token })
}

export async function saveCreationDraftForm(
  token: string,
  id: string,
  gameType: string,
  mode: string,
  formState: Record<string, unknown>,
): Promise<void> {
  await request(`/creation-drafts/${id}`, { method: 'PUT', token, body: { gameType, mode, formState } })
}

/** Guarda el resultado de la IA; el servidor sube los archivos a Cloudinary y guarda sus URLs. */
export async function saveCreationDraftAi(
  token: string,
  id: string,
  gameType: string,
  mode: string,
  result: GameDraft,
  message: string,
  files: File[],
): Promise<void> {
  const formData = new FormData()
  formData.append('gameType', gameType)
  if (mode) formData.append('mode', mode)
  formData.append('result', JSON.stringify(result))
  if (message.trim()) formData.append('message', message.trim())
  for (const file of files) formData.append('files', file)
  const response = await fetch(`${API_URL}/creation-drafts/${id}/ai`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) throw new Error('No se pudo guardar el borrador de la IA.')
}

/** Descartar: el servidor borra el borrador, sus archivos y sus imágenes. */
export async function discardCreationDraft(token: string, id: string): Promise<void> {
  await request(`/creation-drafts/${id}`, { method: 'DELETE', token })
}
