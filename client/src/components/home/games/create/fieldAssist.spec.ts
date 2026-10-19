import { describe, expect, it } from 'vitest'
import {
  examplesFor,
  headerSegmentFill,
  identityFeedback,
  identityKind,
  missingHint,
  summarizeProgress,
} from './fieldAssist'

describe('fieldAssist', () => {
  it('detecta título y descripción por etiqueta', () => {
    expect(identityKind('Título del juego')).toBe('title')
    expect(identityKind('Descripción')).toBe('description')
    expect(identityKind('Imagen')).toBeNull()
  })

  it('da feedback amable solo cuando hay texto', () => {
    expect(identityFeedback('title', '')).toBeNull()
    expect(identityFeedback('title', 'ab')).toEqual({ tone: 'hint', text: 'Casi: falta 1 carácter.' })
    expect(identityFeedback('description', 'corta')?.text).toBe('Casi: faltan 5 caracteres.')
    expect(identityFeedback('title', 'Animales')?.tone).toBe('ok')
  })

  it('resume el avance de la fase', () => {
    expect(summarizeProgress({ ready: 0, total: 0 }).label).toBe('')
    expect(summarizeProgress({ ready: 2, total: 5 })).toMatchObject({ label: '2 de 5 listos', complete: false, missing: 3 })
    expect(summarizeProgress({ ready: 5, total: 5 })).toMatchObject({ label: '¡Fase lista!', complete: true })
    expect(summarizeProgress({ ready: 9, total: 5 }).fraction).toBe(1)
  })

  it('redacta lo que falta', () => {
    expect(missingHint(0)).toBe('Todo listo para continuar')
    expect(missingHint(1)).toBe('Te falta 1 campo')
    expect(missingHint(3)).toBe('Te faltan 3 campos')
  })

  it('el segmento del header va de 0.12 a 1', () => {
    expect(headerSegmentFill(0)).toBe(0.12)
    expect(headerSegmentFill(1)).toBe(1)
    expect(headerSegmentFill(5)).toBe(1)
  })

  it('ofrece ejemplo por tipo y uno genérico de respaldo', () => {
    expect(examplesFor('MatchMente: parejas').title).toContain('Animales')
    expect(examplesFor('Otro').title).toBeTruthy()
  })
})
