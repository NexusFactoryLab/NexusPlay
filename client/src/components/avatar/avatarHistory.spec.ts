import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR } from './avatarConfig'
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  createHistory,
  historyShortcut,
  pushHistory,
  redoHistory,
  undoHistory,
} from './avatarHistory'

const a = DEFAULT_AVATAR
const b = { ...DEFAULT_AVATAR, outfit: 'tank' }
const c = { ...DEFAULT_AVATAR, outfit: 'vest' }

describe('historial del avatar (issue #138)', () => {
  it('al empezar no hay atrás ni adelante', () => {
    const history = createHistory(a)
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
    expect(undoHistory(history)).toBe(history)
    expect(redoHistory(history)).toBe(history)
  })

  it('atrás vuelve a la prenda anterior y adelante la recupera', () => {
    let history = pushHistory(pushHistory(createHistory(a), b), c)
    history = undoHistory(history)
    expect(history.present).toEqual(b)
    history = undoHistory(history)
    expect(history.present).toEqual(a)
    expect(canUndo(history)).toBe(false)
    history = redoHistory(redoHistory(history))
    expect(history.present).toEqual(c)
    expect(canRedo(history)).toBe(false)
  })

  it('un cambio nuevo después de ir atrás borra lo de adelante', () => {
    let history = undoHistory(pushHistory(createHistory(a), b))
    history = pushHistory(history, c)
    expect(history.present).toEqual(c)
    expect(canRedo(history)).toBe(false)
    expect(undoHistory(history).present).toEqual(a)
  })

  it('elegir lo mismo que ya está puesto no gasta un paso', () => {
    const history = createHistory(a)
    expect(pushHistory(history, { ...a })).toBe(history)
  })

  it('guarda como máximo HISTORY_LIMIT pasos hacia atrás', () => {
    let history = createHistory(a)
    for (let step = 0; step < HISTORY_LIMIT + 20; step += 1) history = pushHistory(history, { ...a, hairColor: step.toString(16).padStart(6, '0') })
    expect(history.past).toHaveLength(HISTORY_LIMIT)
    for (let step = 0; step < HISTORY_LIMIT; step += 1) history = undoHistory(history)
    expect(canUndo(history)).toBe(false)
    expect(history.future).toHaveLength(HISTORY_LIMIT)
  })

  it('atajos: Ctrl+Z atrás; Ctrl+Y y Ctrl+Shift+Z adelante; lo demás nada', () => {
    const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra })
    expect(historyShortcut(key('z', { ctrlKey: true }))).toBe('undo')
    expect(historyShortcut(key('Z', { metaKey: true }))).toBe('undo')
    expect(historyShortcut(key('y', { ctrlKey: true }))).toBe('redo')
    expect(historyShortcut(key('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo')
    expect(historyShortcut(key('z'))).toBeNull()
    expect(historyShortcut(key('z', { ctrlKey: true, altKey: true }))).toBeNull()
    expect(historyShortcut(key('s', { ctrlKey: true }))).toBeNull()
  })
})
