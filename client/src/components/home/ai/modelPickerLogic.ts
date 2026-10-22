/** Lógica pura del selector de modelos (sin React), para probarla sin DOM. */

/**
 * Modelos que se muestran: todos, o los que contienen lo escrito (si el
 * usuario está escribiendo). El recomendado, si está en la lista, va primero.
 */
export function visibleModels(
  models: string[],
  query: string,
  filtering: boolean,
  recommended?: string,
): string[] {
  const needle = query.trim().toLowerCase()
  const matching = filtering && needle ? models.filter((model) => model.toLowerCase().includes(needle)) : models
  return recommended && matching.includes(recommended)
    ? [recommended, ...matching.filter((model) => model !== recommended)]
    : matching
}

/** Id estable de cada opción (lo referencia `aria-activedescendant`). */
export function optionId(baseId: string, index: number): string {
  return `${baseId}-option-${index}`
}

export type PickerKeyState = {
  /** ¿Hay una lista de modelos con la que desplegar? Sin lista el campo es un texto normal. */
  hasList: boolean
  open: boolean
  /** Opción activa (la "enfocada" visualmente); -1 = ninguna. */
  activeIndex: number
  /** Cuántas opciones se ven ahora. */
  count: number
  /** Posición del valor actual dentro de las opciones visibles (-1 si no está). */
  selectedIndex: number
}

export type PickerKeyResult = {
  open: boolean
  activeIndex: number
  /** Elegir la opción activa. */
  select: boolean
  /** Si es `true`, hay que llamar a `preventDefault()` (la tecla ya hizo su trabajo aquí). */
  handled: boolean
}

/**
 * Teclado del combobox (patrón ARIA "editable combobox con lista"):
 *  - Flecha abajo / arriba: abren la lista si estaba cerrada; si no, mueven la opción activa.
 *  - Inicio / Fin: primera / última opción (solo con la lista abierta; si no, mueven el cursor del texto).
 *  - Enter: elige la opción activa (sin activa, no se intercepta: sigue su curso en el formulario).
 *  - Escape: cierra la lista. Tab: la cierra SIN elegir y deja avanzar el foco.
 */
export function nextPickerState(key: string, state: PickerKeyState): PickerKeyResult {
  const { hasList, open, activeIndex, count, selectedIndex } = state
  const unchanged: PickerKeyResult = { open, activeIndex, select: false, handled: false }
  if (!hasList) return unchanged

  switch (key) {
    case 'ArrowDown': {
      if (!open) return { open: true, activeIndex: count === 0 ? -1 : selectedIndex >= 0 ? selectedIndex : 0, select: false, handled: true }
      if (count === 0) return { ...unchanged, handled: true }
      return { open, activeIndex: Math.min(activeIndex + 1, count - 1), select: false, handled: true }
    }
    case 'ArrowUp': {
      if (!open) {
        return { open: true, activeIndex: count === 0 ? -1 : selectedIndex >= 0 ? selectedIndex : count - 1, select: false, handled: true }
      }
      if (count === 0) return { ...unchanged, handled: true }
      return { open, activeIndex: activeIndex < 0 ? count - 1 : Math.max(activeIndex - 1, 0), select: false, handled: true }
    }
    case 'Home':
      return open && count > 0 ? { open, activeIndex: 0, select: false, handled: true } : unchanged
    case 'End':
      return open && count > 0 ? { open, activeIndex: count - 1, select: false, handled: true } : unchanged
    case 'Enter':
      return open && activeIndex >= 0 && activeIndex < count
        ? { open: false, activeIndex: -1, select: true, handled: true }
        : unchanged
    case 'Escape':
      return open ? { open: false, activeIndex: -1, select: false, handled: true } : unchanged
    case 'Tab':
      return open ? { open: false, activeIndex: -1, select: false, handled: false } : unchanged
    default:
      return unchanged
  }
}
