import { describe, expect, it } from 'vitest'
import { dominoCloudLines } from './DominoInfoCloud'
import type { DominoConcept } from './dominoTypes'

const concept: DominoConcept = {
  conceptId: 'c0',
  label: 'Reciclaje',
  icon: 'recycle',
  color: '#14b8a6',
  definition: 'Convertir residuos en materiales nuevos.',
  example: 'Separar botellas y papel.',
  application: 'Un colegio reduce su basura con puntos de reciclaje.',
}

describe('dominoCloudLines', () => {
  it('Fácil explica con definición y ejemplo', () => {
    expect(dominoCloudLines(concept, 'EASY').map((line) => line.title)).toEqual(['Qué es', 'Ejemplo'])
  })

  it('Intermedio solo da la definición', () => {
    expect(dominoCloudLines(concept, 'MEDIUM').map((line) => line.title)).toEqual(['Qué es'])
  })

  it('Universitario da la definición y el caso', () => {
    expect(dominoCloudLines(concept, 'ADVANCED').map((line) => line.title)).toEqual(['Qué es', 'Caso'])
  })

  it('un concepto viejo sin definición ni extras no tiene nubecita', () => {
    const old: DominoConcept = { conceptId: 'c1', label: 'Sol', icon: 'sun', color: '#f59e0b' }
    for (const level of ['EASY', 'MEDIUM', 'ADVANCED'] as const) expect(dominoCloudLines(old, level)).toEqual([])
  })
})
