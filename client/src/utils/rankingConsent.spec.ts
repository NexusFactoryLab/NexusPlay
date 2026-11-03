import { afterEach, describe, expect, it, vi } from 'vitest'
import { canDecideRankingConsent, isUnderAdultAge, shouldAskRankingConsent } from './rankingConsent'

const calm = { atHome: true, welcomeBusy: false, dismissedThisSession: false }
const eligibleUndecided = { rankingConsent: null, rankingConsentEligible: true }

describe('shouldAskRankingConsent', () => {
  it('pregunta a quien es elegible y nunca ha decidido, en un momento tranquilo', () => {
    expect(shouldAskRankingConsent({ user: eligibleUndecided, ...calm })).toBe(true)
  })

  it('trata un perfil sin el campo (servidor viejo) como no elegible', () => {
    expect(shouldAskRankingConsent({ user: {} as never, ...calm })).toBe(false)
  })

  it('no pregunta a quien no es elegible (menor de 14 o sin fecha de nacimiento)', () => {
    expect(shouldAskRankingConsent({ user: { rankingConsent: null, rankingConsentEligible: false }, ...calm })).toBe(false)
  })

  it('no vuelve a preguntar si ya aceptó o rechazó', () => {
    expect(shouldAskRankingConsent({ user: { rankingConsent: true, rankingConsentEligible: true }, ...calm })).toBe(false)
    expect(shouldAskRankingConsent({ user: { rankingConsent: false, rankingConsentEligible: true }, ...calm })).toBe(false)
  })

  it('espera a que se cierre la bienvenida o el recorrido', () => {
    expect(shouldAskRankingConsent({ user: eligibleUndecided, ...calm, welcomeBusy: true })).toBe(false)
  })

  it('solo en el inicio', () => {
    expect(shouldAskRankingConsent({ user: eligibleUndecided, ...calm, atHome: false })).toBe(false)
  })

  it('respeta el «ahora no» de esta sesión', () => {
    expect(shouldAskRankingConsent({ user: eligibleUndecided, ...calm, dismissedThisSession: true })).toBe(false)
  })

  it('sin usuario no hay aviso', () => {
    expect(shouldAskRankingConsent({ user: null, ...calm })).toBe(false)
  })
})

describe('canDecideRankingConsent', () => {
  it('solo es true cuando el servidor lo confirma', () => {
    expect(canDecideRankingConsent({ rankingConsent: null, rankingConsentEligible: true })).toBe(true)
    expect(canDecideRankingConsent({ rankingConsent: null, rankingConsentEligible: false })).toBe(false)
    expect(canDecideRankingConsent(undefined)).toBe(false)
  })
})

describe('isUnderAdultAge', () => {
  afterEach(() => vi.useRealTimers())

  it('es true para 16 años y false para 18 cumplidos o sin fecha', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 3, 12))
    expect(isUnderAdultAge('2010-05-10')).toBe(true)
    expect(isUnderAdultAge('2008-10-30')).toBe(false)
    expect(isUnderAdultAge('2008-11-10')).toBe(true)
    expect(isUnderAdultAge(null)).toBe(false)
  })
})
