import { describe, expect, it } from 'vitest'
import { ageFromBirthDate, buildSignPayload, EMPTY_AGREEMENT_FORM, validateAgreementForm } from './tournamentAgreementForm'

const NOW = new Date('2026-11-05T15:00:00Z')
const adult = {
  ...EMPTY_AGREEMENT_FORM,
  fullName: 'Ana María Pérez',
  signatureName: 'ana maria perez',
  birthDate: '2000-01-10',
  acceptedConfidentiality: true,
  acceptedDataProcessing: true,
}
const agreement = { version: 'v1', hash: 'h', sections: [], text: '' }

describe('tournamentAgreementForm', () => {
  it('calcula la edad y rechaza fechas inválidas o futuras', () => {
    expect(ageFromBirthDate('2008-11-06', NOW)).toBe(17)
    expect(ageFromBirthDate('2008-11-05', NOW)).toBe(18)
    expect(ageFromBirthDate('2030-01-01', NOW)).toBeNull()
    expect(ageFromBirthDate('no', NOW)).toBeNull()
  })

  it('un adulto con todo en regla no tiene errores', () => {
    expect(validateAgreementForm(adult, NOW)).toEqual({})
  })

  it('las dos casillas son obligatorias y separadas', () => {
    const errors = validateAgreementForm({ ...adult, acceptedConfidentiality: false, acceptedDataProcessing: false }, NOW)
    expect(Object.keys(errors).sort()).toEqual(['acceptedConfidentiality', 'acceptedDataProcessing'])
  })

  it('la firma debe coincidir con el nombre (sin importar tildes ni mayúsculas)', () => {
    expect(validateAgreementForm({ ...adult, signatureName: 'Otra Persona' }, NOW).signatureName).toBeTruthy()
  })

  it('el documento exige su tipo y el correo debe ser válido', () => {
    const errors = validateAgreementForm({ ...adult, documentNumber: '123', contactEmail: 'x' }, NOW)
    expect(errors.documentType).toBeTruthy()
    expect(errors.contactEmail).toBeTruthy()
  })

  it('un menor exige todos los datos y la aceptación del representante', () => {
    const minor = { ...adult, birthDate: '2012-03-01' }
    expect(Object.keys(validateAgreementForm(minor, NOW)).sort()).toEqual([
      'guardianAccepted', 'guardianDocumentNumber', 'guardianDocumentType', 'guardianFullName', 'guardianRelationship',
    ])
    const ok = {
      ...minor, guardianFullName: 'Luis Pérez', guardianDocumentType: 'CC', guardianDocumentNumber: '1', guardianRelationship: 'Padre', guardianAccepted: true,
    }
    expect(validateAgreementForm(ok, NOW)).toEqual({})
    expect(buildSignPayload(ok, agreement, NOW).guardian?.relationship).toBe('Padre')
  })

  it('el payload de un adulto no envía acudiente y lleva versión y hash', () => {
    const payload = buildSignPayload(adult, agreement, NOW)
    expect(payload.guardian).toBeUndefined()
    expect(payload).toMatchObject({ textVersion: 'v1', textHash: 'h' })
  })
})
