import { request } from '../utils/http'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

export type AgreementSection = { id: string; title: string; paragraphs: string[] }
export type TournamentAgreement = { version: string; hash: string; sections: AgreementSection[]; text: string }

export type GuardianPayload = {
  fullName: string
  documentType: string
  documentNumber: string
  relationship: string
  accepted: boolean
}

export type SignAgreementPayload = {
  fullName: string
  documentType?: string
  documentNumber?: string
  contactEmail?: string
  birthDate: string
  acceptedConfidentiality: boolean
  acceptedDataProcessing: boolean
  signatureName: string
  textVersion: string
  textHash: string
  guardian?: GuardianPayload
}

export type TournamentSignatureRow = {
  userId: string
  fullName: string
  document: string | null
  isMinor: boolean
  guardianFullName: string | null
  guardianRelationship: string | null
  signedAt: string
  textVersion: string
  textHash?: string
  ipAddress?: string | null
}

/** GET /tournament-agreement: texto vigente (versión, hash y secciones). */
export function getTournamentAgreement(): Promise<TournamentAgreement> {
  return request<TournamentAgreement>('/tournament-agreement')
}

/** POST /tournament-agreement/:code/sign: registra la firma; el servidor valida todo otra vez. */
export function signTournamentAgreement(token: string, code: string, payload: SignAgreementPayload) {
  return request<{ signedAt: string; textVersion: string; alreadySigned: boolean }>(
    `/tournament-agreement/${encodeURIComponent(code)}/sign`,
    { method: 'POST', token, body: payload },
  )
}

/** GET /tournament-agreement/:code/signatures: respaldo para quien moderó el torneo o un administrador. */
export function listTournamentSignatures(token: string, code: string) {
  return request<TournamentSignatureRow[]>(`/tournament-agreement/${encodeURIComponent(code)}/signatures`, { token })
}

/** Descarga el respaldo como CSV (con el token en el encabezado, no en la URL). */
export async function downloadTournamentSignaturesCsv(token: string, code: string): Promise<void> {
  const response = await fetch(`${API_URL}/tournament-agreement/${encodeURIComponent(code)}/signatures?format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })
  if (!response.ok) throw new Error('No se pudo descargar el respaldo de firmas.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = `firmas-${code}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
