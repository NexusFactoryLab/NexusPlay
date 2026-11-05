import type { SignAgreementPayload, TournamentAgreement } from '../../../services/tournament-agreement.service'

export const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'TI', label: 'Tarjeta de identidad' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'RC', label: 'Registro civil' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
  { value: 'OTRO', label: 'Otro' },
] as const

export type AgreementFormValues = {
  fullName: string
  documentType: string
  documentNumber: string
  contactEmail: string
  birthDate: string
  signatureName: string
  acceptedConfidentiality: boolean
  acceptedDataProcessing: boolean
  guardianFullName: string
  guardianDocumentType: string
  guardianDocumentNumber: string
  guardianRelationship: string
  guardianAccepted: boolean
}

export const EMPTY_AGREEMENT_FORM: AgreementFormValues = {
  fullName: '',
  documentType: '',
  documentNumber: '',
  contactEmail: '',
  birthDate: '',
  signatureName: '',
  acceptedConfidentiality: false,
  acceptedDataProcessing: false,
  guardianFullName: '',
  guardianDocumentType: '',
  guardianDocumentNumber: '',
  guardianRelationship: '',
  guardianAccepted: false,
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Edad cumplida hoy a partir de AAAA-MM-DD; null si la fecha no es válida o es futura. */
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const born = new Date(`${birthDate}T00:00:00Z`)
  if (Number.isNaN(born.getTime()) || born.getTime() > now.getTime()) return null
  let age = now.getUTCFullYear() - born.getUTCFullYear()
  const month = now.getUTCMonth() - born.getUTCMonth()
  if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1
  return age > 120 ? null : age
}

export type AgreementErrors = Partial<Record<keyof AgreementFormValues, string>>

/** Mismas reglas que el servidor (que las vuelve a verificar): aquí solo se adelanta el mensaje. */
export function validateAgreementForm(values: AgreementFormValues, now: Date = new Date()): AgreementErrors {
  const errors: AgreementErrors = {}
  const name = values.fullName.trim()
  if (name.length < 3 || name.split(/\s+/).length < 2) errors.fullName = 'Escribe tu nombre completo.'
  const age = ageFromBirthDate(values.birthDate, now)
  if (age === null) errors.birthDate = 'Indica una fecha de nacimiento válida.'
  if (values.documentNumber.trim() && !values.documentType) errors.documentType = 'Elige el tipo de documento.'
  if (values.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())) {
    errors.contactEmail = 'El correo no es válido.'
  }
  if (!values.signatureName.trim() || normalize(values.signatureName) !== normalize(name)) {
    errors.signatureName = 'La firma debe ser tu nombre completo, igual al de arriba.'
  }
  if (!values.acceptedConfidentiality) errors.acceptedConfidentiality = 'Debes aceptar la confidencialidad.'
  if (!values.acceptedDataProcessing) errors.acceptedDataProcessing = 'Debes autorizar el tratamiento de tus datos.'
  if (age !== null && age < 18) {
    if (values.guardianFullName.trim().length < 3) errors.guardianFullName = 'Escribe el nombre de tu representante legal.'
    if (!values.guardianDocumentType) errors.guardianDocumentType = 'Elige el tipo de documento.'
    if (!values.guardianDocumentNumber.trim()) errors.guardianDocumentNumber = 'Escribe el documento de tu representante.'
    if (!values.guardianRelationship.trim()) errors.guardianRelationship = 'Indica la relación (madre, padre, tutor...).'
    if (!values.guardianAccepted) errors.guardianAccepted = 'Tu representante legal debe aceptar.'
  }
  return errors
}

export function buildSignPayload(values: AgreementFormValues, agreement: TournamentAgreement, now: Date = new Date()): SignAgreementPayload {
  const minor = (ageFromBirthDate(values.birthDate, now) ?? 18) < 18
  return {
    fullName: values.fullName.trim(),
    documentType: values.documentType || undefined,
    documentNumber: values.documentNumber.trim() || undefined,
    contactEmail: values.contactEmail.trim() || undefined,
    birthDate: values.birthDate,
    acceptedConfidentiality: values.acceptedConfidentiality,
    acceptedDataProcessing: values.acceptedDataProcessing,
    signatureName: values.signatureName.trim(),
    textVersion: agreement.version,
    textHash: agreement.hash,
    guardian: minor
      ? {
          fullName: values.guardianFullName.trim(),
          documentType: values.guardianDocumentType,
          documentNumber: values.guardianDocumentNumber.trim(),
          relationship: values.guardianRelationship.trim(),
          accepted: values.guardianAccepted,
        }
      : undefined,
  }
}
