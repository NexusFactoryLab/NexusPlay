import { describe, expect, it } from 'vitest'
import { nextPickerState, optionId, visibleModels } from './modelPickerLogic'
import type { PickerKeyState } from './modelPickerLogic'

const MODELS = ['b-modelo', 'a-modelo', 'llama-3', 'gpt-4o']

describe('visibleModels', () => {
  it('sin filtrar muestra todos, y con filtro solo los que contienen lo escrito (sin distinguir mayúsculas)', () => {
    expect(visibleModels(MODELS, 'GPT', false)).toEqual(MODELS)
    expect(visibleModels(MODELS, 'GPT', true)).toEqual(['gpt-4o'])
    expect(visibleModels(MODELS, '  modelo ', true)).toEqual(['b-modelo', 'a-modelo'])
  })

  it('un filtro vacío o sin coincidencias', () => {
    expect(visibleModels(MODELS, '   ', true)).toEqual(MODELS)
    expect(visibleModels(MODELS, 'zzz', true)).toEqual([])
  })

  it('el recomendado va siempre primero, sin duplicarse', () => {
    expect(visibleModels(MODELS, '', false, 'llama-3')).toEqual(['llama-3', 'b-modelo', 'a-modelo', 'gpt-4o'])
    expect(visibleModels(MODELS, 'modelo', true, 'a-modelo')).toEqual(['a-modelo', 'b-modelo'])
  })

  it('un recomendado que no está en la lista (o no coincide con el filtro) no se agrega', () => {
    expect(visibleModels(MODELS, '', false, 'inexistente')).toEqual(MODELS)
    expect(visibleModels(MODELS, 'gpt', true, 'llama-3')).toEqual(['gpt-4o'])
  })
})

describe('optionId', () => {
  it('compone un id estable por posición', () => {
    expect(optionId(':r1:', 3)).toBe(':r1:-option-3')
  })
})

describe('nextPickerState (teclado del combobox)', () => {
  const base: PickerKeyState = { hasList: true, open: true, activeIndex: -1, count: 4, selectedIndex: -1 }
  const press = (key: string, overrides: Partial<PickerKeyState> = {}) => nextPickerState(key, { ...base, ...overrides })

  it('sin lista de modelos no intercepta nada (es un texto normal)', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab']) {
      expect(press(key, { hasList: false, open: false })).toMatchObject({ handled: false, select: false, open: false })
    }
  })

  describe('flecha abajo', () => {
    it('cerrada: abre y deja activa la opción del valor actual, o la primera', () => {
      expect(press('ArrowDown', { open: false, selectedIndex: 2 })).toEqual({ open: true, activeIndex: 2, select: false, handled: true })
      expect(press('ArrowDown', { open: false })).toMatchObject({ open: true, activeIndex: 0, handled: true })
    })

    it('abierta: baja una opción y se detiene en la última', () => {
      expect(press('ArrowDown', { activeIndex: -1 }).activeIndex).toBe(0)
      expect(press('ArrowDown', { activeIndex: 1 }).activeIndex).toBe(2)
      expect(press('ArrowDown', { activeIndex: 3 }).activeIndex).toBe(3)
    })

    it('sin opciones visibles no hay opción activa', () => {
      expect(press('ArrowDown', { open: false, count: 0 })).toMatchObject({ open: true, activeIndex: -1 })
      expect(press('ArrowDown', { count: 0 })).toMatchObject({ activeIndex: -1, handled: true })
    })
  })

  describe('flecha arriba', () => {
    it('cerrada: abre y deja activa la del valor actual, o la última', () => {
      expect(press('ArrowUp', { open: false, selectedIndex: 1 })).toMatchObject({ open: true, activeIndex: 1, handled: true })
      expect(press('ArrowUp', { open: false })).toMatchObject({ open: true, activeIndex: 3 })
    })

    it('abierta: sube una opción, se detiene en la primera, y sin activa va a la última', () => {
      expect(press('ArrowUp', { activeIndex: 2 }).activeIndex).toBe(1)
      expect(press('ArrowUp', { activeIndex: 0 }).activeIndex).toBe(0)
      expect(press('ArrowUp', { activeIndex: -1 }).activeIndex).toBe(3)
    })
  })

  it('Inicio y Fin saltan a la primera y última solo con la lista abierta', () => {
    expect(press('Home', { activeIndex: 2 })).toMatchObject({ activeIndex: 0, handled: true })
    expect(press('End', { activeIndex: 0 })).toMatchObject({ activeIndex: 3, handled: true })
    // Cerrada: la tecla conserva su función normal (mover el cursor del texto).
    expect(press('Home', { open: false })).toMatchObject({ handled: false })
    expect(press('End', { open: false })).toMatchObject({ handled: false })
    expect(press('Home', { count: 0 })).toMatchObject({ handled: false })
  })

  describe('Enter', () => {
    it('elige la opción activa y cierra', () => {
      expect(press('Enter', { activeIndex: 2 })).toEqual({ open: false, activeIndex: -1, select: true, handled: true })
    })

    it('sin opción activa, o con la lista cerrada, no se intercepta (el formulario sigue su curso)', () => {
      expect(press('Enter', { activeIndex: -1 })).toMatchObject({ select: false, handled: false })
      expect(press('Enter', { open: false, activeIndex: 1 })).toMatchObject({ select: false, handled: false })
    })

    it('una activa fuera de rango (la lista se achicó) no elige nada', () => {
      expect(press('Enter', { activeIndex: 5, count: 2 })).toMatchObject({ select: false, handled: false })
    })
  })

  it('Escape cierra y limpia la activa; cerrada no hace nada', () => {
    expect(press('Escape', { activeIndex: 1 })).toEqual({ open: false, activeIndex: -1, select: false, handled: true })
    expect(press('Escape', { open: false })).toMatchObject({ handled: false })
  })

  it('Tab cierra SIN elegir y deja avanzar el foco (no se previene)', () => {
    expect(press('Tab', { activeIndex: 2 })).toEqual({ open: false, activeIndex: -1, select: false, handled: false })
    expect(press('Tab', { open: false })).toMatchObject({ open: false, select: false, handled: false })
  })

  it('otras teclas no cambian nada', () => {
    expect(press('a', { activeIndex: 1 })).toEqual({ open: true, activeIndex: 1, select: false, handled: false })
  })
})
