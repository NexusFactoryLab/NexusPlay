import type { AvatarConfig } from '../../services/avatar.service'
import { sameAvatar } from './avatarConfig'

/**
 * Historial del editor de avatar (issue #138): las flechas Atrás / Adelante,
 * el botón Deshacer y Ctrl+Z / Ctrl+Y recorren la misma lista. Un cambio nuevo
 * después de ir hacia atrás borra lo que había "adelante", como en cualquier editor.
 */
export type AvatarHistory = {
  past: AvatarConfig[]
  present: AvatarConfig
  future: AvatarConfig[]
}

export const HISTORY_LIMIT = 50

export function createHistory(present: AvatarConfig): AvatarHistory {
  return { past: [], present, future: [] }
}

/** Pone un avatar nuevo; si es igual al actual no cambia nada (ni gasta un paso). */
export function pushHistory(history: AvatarHistory, next: AvatarConfig): AvatarHistory {
  if (sameAvatar(next, history.present)) return history
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] }
}

export function undoHistory(history: AvatarHistory): AvatarHistory {
  const previous = history.past[history.past.length - 1]
  if (!previous) return history
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future].slice(0, HISTORY_LIMIT) }
}

export function redoHistory(history: AvatarHistory): AvatarHistory {
  const [next, ...rest] = history.future
  if (!next) return history
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: rest }
}

export const canUndo = (history: AvatarHistory) => history.past.length > 0
export const canRedo = (history: AvatarHistory) => history.future.length > 0

/** Ctrl+Z (Cmd+Z en Mac) es atrás; Ctrl+Y y Ctrl+Shift+Z, adelante. */
export function historyShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): 'undo' | 'redo' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !event.shiftKey) return 'redo'
  return null
}
