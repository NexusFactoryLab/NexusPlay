import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode }

type ParsedOption = { value: string; label: ReactNode; text: string; disabled: boolean }

/** Desde cuántas opciones se ofrece el buscador cuando `searchable` no se indica. */
const AUTO_SEARCH_FROM = 8

type FormSelectProps = {
  id?: string
  value: string | number
  disabled?: boolean
  /** Se ignora: el estilo lo da `.nx-select-*`. Existe para poder cambiar `<select>` por `<FormSelect>` sin más ajustes. */
  className?: string
  /** Muestra un buscador arriba de la lista. Por defecto aparece con 8 opciones o más. */
  searchable?: boolean
  /** `<option>` como en un `<select>` nativo. */
  children: ReactNode
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

function parseOptions(children: ReactNode): ParsedOption[] {
  return Children.toArray(children)
    .filter((child): child is ReactElement<OptionProps> => isValidElement(child) && child.type === 'option')
    .map((child) => {
      const text = textOf(child.props.children)
      return {
        value: String(child.props.value ?? text),
        label: child.props.children,
        text,
        disabled: !!child.props.disabled,
      }
    })
}

/** Sin tildes ni mayúsculas, para que "matematicas" encuentre "Matemáticas". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Reemplazo de `<select>` con el estilo del formulario. La lista desplegable
 * nativa no se puede estilizar con CSS (por eso se veía distinta al resto),
 * así que esta usa un botón + lista propia (teclado completo, buscador en
 * listas largas, cierra con Escape o al pulsar fuera) dentro de un portal para
 * que ningún contenedor la recorte. Mantiene un `<select>` nativo oculto con el
 * mismo valor: el formulario lo lee para el avance, los errores y los cambios
 * sin guardar.
 */
export function FormSelect({ id, value, disabled, searchable, children, onChange }: FormSelectProps) {
  const options = parseOptions(children)
  const current = String(value)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [query, setQuery] = useState('')
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const nativeRef = useRef<HTMLSelectElement>(null)
  const hasSearch = searchable ?? options.length >= AUTO_SEARCH_FROM
  const selected = options.find((option) => option.value === current)
  const showingPlaceholder = !selected || selected.value === ''

  // Opciones visibles según lo escrito (la opción vacía/placeholder no se filtra por texto).
  const needle = normalize(query.trim())
  const visible = options.filter((option) => !needle || (option.value !== '' && normalize(option.text).includes(needle)))
  const activeIndex = Math.min(active, visible.length - 1)

  const place = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const box = button.getBoundingClientRect()
    const room = window.innerHeight - box.bottom
    const up = room < 320 && box.top > room
    setRect({ top: up ? box.top : box.bottom, left: box.left, width: box.width, up })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Al abrir, el foco va al buscador (si hay) para escribir de inmediato.
  useEffect(() => {
    if (open && hasSearch) window.requestAnimationFrame(() => searchRef.current?.focus())
  }, [open, hasSearch])

  // La opción activa siempre queda visible dentro de la lista.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current?.querySelectorAll('[role=option]')[activeIndex]?.scrollIntoView?.({ block: 'nearest' })
  }, [open, activeIndex])

  function openList() {
    if (disabled) return
    setQuery('')
    const index = options.findIndex((option) => option.value === current)
    setActive(index >= 0 ? index : options.findIndex((option) => !option.disabled))
    setOpen(true)
  }

  function closeList(refocus = true) {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }

  function choose(index: number) {
    const option = visible[index]
    if (!option || option.disabled) return
    closeList()
    if (option.value === current) return
    onChange({ target: { value: option.value }, currentTarget: { value: option.value } } as unknown as ChangeEvent<HTMLSelectElement>)
    // Avisa al formulario (cambios sin guardar) como lo haría un <select> nativo.
    window.requestAnimationFrame(() => nativeRef.current?.dispatchEvent(new Event('change', { bubbles: true })))
  }

  function move(step: 1 | -1) {
    if (visible.length === 0) return
    let next = activeIndex
    for (let tries = 0; tries < visible.length; tries += 1) {
      next = (next + step + visible.length) % visible.length
      if (!visible[next]?.disabled) break
    }
    setActive(next)
  }

  /** Teclado compartido por el botón y el buscador. */
  function handleKeys(event: KeyboardEvent<HTMLElement>, fromSearch: boolean) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        if (fromSearch) return
        event.preventDefault()
        setActive(visible.findIndex((option) => !option.disabled))
        break
      case 'End':
        if (fromSearch) return
        event.preventDefault()
        setActive(visible.length - 1 - [...visible].reverse().findIndex((option) => !option.disabled))
        break
      case 'Enter':
        event.preventDefault()
        choose(activeIndex)
        break
      case ' ':
        if (fromSearch) return
        event.preventDefault()
        choose(activeIndex)
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        closeList()
        break
      case 'Tab':
        closeList(false)
        break
      default:
        if (!fromSearch && !hasSearch && event.key.length === 1) {
          const letter = normalize(event.key)
          const next = visible.findIndex((option) => !option.disabled && normalize(option.text).startsWith(letter))
          if (next >= 0) setActive(next)
        }
    }
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    handleKeys(event, false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        className="nx-select-btn"
        data-open={open}
        data-placeholder={showingPlaceholder}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={onButtonKeyDown}
      >
        <span className="nx-select-value">{selected?.label ?? ''}</span>
        <ChevronDown className="nx-select-chevron h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
      </button>
      <select ref={nativeRef} aria-hidden="true" tabIndex={-1} className="sr-only" value={current} onChange={() => {}} disabled={disabled}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.text}
          </option>
        ))}
      </select>
      {open &&
        rect &&
        createPortal(
          <div
            className="nx-select-pop"
            data-up={rect.up}
            style={{
              left: rect.left,
              width: rect.width,
              ...(rect.up ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.top + 8 }),
            }}
          >
            {hasSearch && (
              <label className="nx-select-search">
                <Search className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  placeholder="Buscar…"
                  aria-label="Buscar en la lista"
                  aria-controls={listId}
                  autoComplete="off"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActive(0)
                  }}
                  onKeyDown={(event) => handleKeys(event, true)}
                />
              </label>
            )}
            <ul ref={listRef} id={listId} role="listbox" className="nx-select-list">
              {visible.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={option.value === current}
                  aria-disabled={option.disabled || undefined}
                  className="nx-select-option"
                  data-active={index === activeIndex}
                  data-selected={option.value === current}
                  data-empty={option.value === ''}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                  style={{ animationDelay: `${Math.min(index, 8) * 22}ms` }}
                >
                  <span className="nx-select-option-label">{option.label}</span>
                  {option.value === current && option.value !== '' && <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden="true" />}
                </li>
              ))}
              {visible.length === 0 && <li className="nx-select-none">Sin resultados</li>}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
