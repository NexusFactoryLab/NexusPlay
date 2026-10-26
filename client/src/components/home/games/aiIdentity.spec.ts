import { describe, expect, it } from 'vitest'
import {
  EMPTY_AI_IDENTITY,
  confirmSuggestion,
  planIdentityApplication,
  reconcileEdits,
  suggestedFields,
} from './aiIdentity'

const IDS = ['c1', 'c2']
const empty = { title: '', description: '', categoryId: '' }
const draft = { title: 'Mi juego', description: 'Una descripción larga.', categoryId: 'c2' }

describe('planIdentityApplication', () => {
  it('llena los campos vacíos y los marca como sugeridos', () => {
    const plan = planIdentityApplication(draft, empty, EMPTY_AI_IDENTITY, IDS)
    expect(plan.values).toEqual({ title: 'Mi juego', description: 'Una descripción larga.', categoryId: 'c2' })
    expect(plan.applied).toBe(true)
    expect(suggestedFields(plan.state)).toEqual(['title', 'description', 'categoryId'])
  })

  it('no pisa lo que escribió el usuario', () => {
    const plan = planIdentityApplication(draft, { title: 'Mío', description: '', categoryId: 'c1' }, EMPTY_AI_IDENTITY, IDS)
    expect(plan.values).toEqual({ description: 'Una descripción larga.' })
    expect(suggestedFields(plan.state)).toEqual(['description'])
  })

  it('reemplaza una sugerencia anterior de la IA que el usuario no tocó', () => {
    const first = planIdentityApplication({ title: 'Primero' }, empty, EMPTY_AI_IDENTITY, IDS)
    const second = planIdentityApplication({ title: 'Segundo' }, { ...empty, title: 'Primero' }, first.state, IDS)
    expect(second.values.title).toBe('Segundo')
  })

  it('no reemplaza una sugerencia que el usuario editó', () => {
    const first = planIdentityApplication({ title: 'Primero' }, empty, EMPTY_AI_IDENTITY, IDS)
    const second = planIdentityApplication({ title: 'Segundo' }, { ...empty, title: 'Primero editado' }, first.state, IDS)
    expect(second.values).toEqual({})
  })

  it('ignora un área desconocida, null o vacía', () => {
    expect(planIdentityApplication({ categoryId: 'zzz' }, empty, EMPTY_AI_IDENTITY, IDS).values).toEqual({})
    expect(planIdentityApplication({ categoryId: null }, empty, EMPTY_AI_IDENTITY, IDS).applied).toBe(false)
    expect(planIdentityApplication({ title: '  ' }, empty, EMPTY_AI_IDENTITY, IDS).applied).toBe(false)
  })
})

describe('etiqueta "Sugerido por IA"', () => {
  it('desaparece al editar el campo', () => {
    const { state } = planIdentityApplication(draft, empty, EMPTY_AI_IDENTITY, IDS)
    const edited = reconcileEdits(state, { title: 'Otro título', description: draft.description, categoryId: 'c2' })
    expect(suggestedFields(edited)).toEqual(['description', 'categoryId'])
  })

  it('se mantiene si el valor no cambió', () => {
    const { state } = planIdentityApplication(draft, empty, EMPTY_AI_IDENTITY, IDS)
    expect(reconcileEdits(state, draft as never)).toBe(state)
  })

  it('desaparece al confirmar, sin tocar los demás', () => {
    const { state } = planIdentityApplication(draft, empty, EMPTY_AI_IDENTITY, IDS)
    expect(suggestedFields(confirmSuggestion(state, 'description'))).toEqual(['title', 'categoryId'])
  })
})
