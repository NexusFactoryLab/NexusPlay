import { describe, expect, it } from 'vitest'
import {
  formatQuestion,
  newTraitId,
  traitCatalogFromCards,
  traitIdsOf,
  traitsForCard,
  validateTraits,
} from './guessWhoTraits'

const EUROPA = { id: 'europa', question: '¿Es un país de Europa?' }
const ESPANOL = { id: 'habla-espanol', question: '¿La mayoría de su población habla español?' }

describe('preguntas guiadas en el formulario de ¿Quién Es? (issue #58)', () => {
  it('arma el catálogo con los rasgos de un borrador, sin repetir ids y descartando basura', () => {
    const catalog = traitCatalogFromCards([
      { traits: [EUROPA, ESPANOL] },
      { traits: [{ id: 'europa', question: '¿Está en Europa?' }, { id: '', question: '¿Vacío?' }, 'texto'] },
      { traits: undefined },
      {},
    ])
    expect(catalog).toEqual([EUROPA, ESPANOL])
    expect(traitIdsOf({ traits: [ESPANOL, { id: 'otro', question: '¿Otro?' }] }, catalog)).toEqual(['habla-espanol'])
  })

  it('sin preguntas la tarjeta queda sin clasificar; con preguntas toda tarjeta lleva su lista', () => {
    expect(traitsForCard(['europa'], [])).toBeUndefined()
    expect(traitsForCard([], [EUROPA])).toEqual([])
    expect(traitsForCard(['europa'], [EUROPA, { id: 'x', question: 'es de américa' }])).toEqual([EUROPA])
    expect(traitsForCard(['x'], [{ id: 'x', question: ' es de américa ' }])).toEqual([{ id: 'x', question: '¿es de américa?' }])
  })

  it('agrega los signos de pregunta si faltan, sin duplicarlos', () => {
    expect(formatQuestion('Es un mamífero')).toBe('¿Es un mamífero?')
    expect(formatQuestion('¿¿Es un mamífero??')).toBe('¿Es un mamífero?')
    expect(formatQuestion('  ¿ ? ')).toBe('')
  })

  it('crea ids nuevos que no chocan con los existentes', () => {
    expect(newTraitId([])).toBe('pregunta-1')
    expect(newTraitId([{ id: 'pregunta-2', question: '¿A?' }])).toBe('pregunta-3')
    expect(newTraitId([{ id: 'pregunta-2', question: '¿A?' }, { id: 'pregunta-3', question: '¿B?' }])).toBe('pregunta-4')
  })

  it('exige al menos 4 preguntas, con texto, y que cada una separe: algunas tarjetas responden Sí, pero no todas', () => {
    const more = [1, 2, 3].map((n) => ({ id: `r${n}`, question: `¿Rasgo ${n}?` }))
    const marks = (ids: string[]) => [[...ids, 'r1', 'r2', 'r3'], []]
    expect(validateTraits([], [[], []])).toMatch(/al menos 4/)
    expect(validateTraits([EUROPA], [['europa'], []])).toMatch(/al menos 4/)
    expect(validateTraits([EUROPA, ...more], marks(['europa']))).toBeNull()
    expect(validateTraits([{ id: 'p', question: '  ' }, ...more], marks(['p']))).toMatch(/Escribe el texto/)
    expect(validateTraits([EUROPA, ...more], marks([]))).toMatch(/no separa/)
    expect(validateTraits([{ id: 'p', question: 'x'.repeat(141) }, ...more], marks(['p']))).toMatch(/muy larga/)
  })
})
