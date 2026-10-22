import { describe, expect, it } from 'vitest'
import { auditActionLabel, auditDetailSummary, auditTargetLabel } from './aiAuditFormat'

describe('aiAuditFormat', () => {
  it('traduce las acciones conocidas y deja pasar las desconocidas', () => {
    expect(auditActionLabel('provider.disable')).toBe('Deshabilitó el proveedor')
    expect(auditActionLabel('agent.reset')).toBe('Restauró de fábrica el agente')
    expect(auditActionLabel('algo.nuevo')).toBe('algo.nuevo')
  })

  it('resume campos cambiados con nombres legibles', () => {
    expect(auditDetailSummary({ details: { changedFields: ['textModel', 'enabled', 'raro'] } })).toBe(
      'Campos: modelo de texto, habilitado, raro',
    )
  })

  it('en una rotación muestra solo el hint, sin ninguna key', () => {
    const summary = auditDetailSummary({ details: { apiKeyRotated: true, apiKeyHint: '••••4321' } })
    expect(summary).toBe('Nueva key ••••4321')
  })

  it('resume el orden y devuelve guion si no hay detalle', () => {
    expect(auditDetailSummary({ details: { order: ['Groq', 'Gemini'] } })).toBe('Orden: Groq → Gemini')
    expect(auditDetailSummary({ details: {} })).toBe('—')
  })

  it('describe sobre qué se hizo el cambio', () => {
    expect(auditTargetLabel({ targetType: 'agent', targetLabel: 'Agente Jugador' })).toBe('Agente: Agente Jugador')
    expect(auditTargetLabel({ targetType: 'provider', targetLabel: 'Groq' })).toBe('Proveedor: Groq')
  })
})
