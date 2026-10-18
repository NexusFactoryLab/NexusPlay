import { ApiError } from '../utils/http'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

export type UploadFolder = 'game-covers' | 'memory-cards' | 'guess-who-cards'
export type UploadAudioFolder = 'guess-who-audio'

async function uploadFile(
  endpoint: 'image' | 'audio',
  token: string,
  file: File,
  folder: string,
  errorMessage: string,
  onProgress?: (percent: number) => void,
): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)

  // Con onProgress se usa XHR (fetch no expone el avance de la subida).
  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_URL}/uploads/${endpoint}?folder=${folder}`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.withCredentials = true
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
      }
      xhr.onerror = () => reject(new ApiError(errorMessage, 0))
      xhr.onload = () => {
        let payload: unknown = null
        try {
          payload = JSON.parse(xhr.responseText)
        } catch {
          payload = null
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          const message =
            payload && typeof payload === 'object' && 'message' in payload
              ? String((payload as { message: unknown }).message)
              : errorMessage
          reject(new ApiError(message, xhr.status))
          return
        }
        resolve(payload as { url: string })
      }
      xhr.send(formData)
    })
  }

  const response = await fetch(`${API_URL}/uploads/${endpoint}?folder=${folder}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: formData,
  })

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : errorMessage
    throw new ApiError(message, response.status)
  }

  return payload as { url: string }
}

/** POST /uploads/image — sube una imagen a Cloudinary y devuelve su URL pública. */
export function uploadImage(
  token: string,
  file: File,
  folder: UploadFolder,
  onProgress?: (percent: number) => void,
): Promise<{ url: string }> {
  return uploadFile('image', token, file, folder, 'No se pudo subir la imagen.', onProgress)
}

/** POST /uploads/audio — sube un audio a Cloudinary y devuelve su URL pública. */
export function uploadAudio(
  token: string,
  file: File,
  folder: UploadAudioFolder,
): Promise<{ url: string }> {
  return uploadFile('audio', token, file, folder, 'No se pudo subir el audio.')
}
