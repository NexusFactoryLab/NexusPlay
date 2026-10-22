import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { nextPickerState, optionId, visibleModels } from './modelPickerLogic'

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  /** Modelos que el proveedor ofrece; vacío = se escribe a mano. */
  models: string[]
  loading?: boolean
  placeholder?: string
  required?: boolean
  inputClass: string
  /** Si está en `models`, se muestra primero con la etiqueta "Recomendado". */
  recommended?: string
  disabled?: boolean
}

/**
 * Campo de modelo: se puede escribir cualquier nombre, y si el proveedor
 * devolvió su lista se despliega para elegir (filtrando mientras se escribe).
 */
export function ModelPicker({
  id,
  value,
  onChange,
  models,
  loading,
  placeholder,
  required,
  inputClass,
  recommended,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [filtering, setFiltering] = useState(false)
  // Opción "enfocada" visualmente (el foco real se queda en el input: aria-activedescendant).
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = `${id}-listbox`

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Solo se filtra mientras el usuario escribe; al abrir con la flecha se ve la lista completa.
  const visible = useMemo(
    () => visibleModels(models, value, filtering, recommended),
    [models, value, filtering, recommended],
  )

  const hasList = models.length > 0
  const activeOption = open && activeIndex >= 0 && activeIndex < visible.length ? activeIndex : -1

  // La opción activa siempre se ve: si queda fuera del recuadro de la lista, la lista se desplaza hasta ella.
  useEffect(() => {
    if (activeOption < 0) return
    listRef.current?.querySelector(`[id="${optionId(id, activeOption)}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeOption, id])

  function choose(model: string) {
    onChange(model)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Cerrada, la flecha abrirá la lista completa: el índice se calcula sobre esa, no sobre lo filtrado.
    const options = open ? visible : visibleModels(models, value, false, recommended)
    const result = nextPickerState(event.key, {
      hasList,
      open,
      activeIndex: activeOption,
      count: options.length,
      selectedIndex: options.indexOf(value),
    })
    if (result.select) choose(visible[activeOption])
    else {
      setOpen(result.open)
      setActiveIndex(result.activeIndex)
      // Abrir con la flecha muestra la lista completa, no solo lo que coincide con lo escrito.
      if (!open && result.open) setFiltering(false)
    }
    if (result.handled) event.preventDefault()
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        className={`${inputClass} ${hasList || loading ? 'pr-10' : ''}`}
        value={value}
        required={required}
        disabled={disabled}
        maxLength={120}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role={hasList ? 'combobox' : undefined}
        aria-expanded={hasList ? open : undefined}
        aria-controls={hasList ? listId : undefined}
        aria-autocomplete={hasList ? 'list' : undefined}
        aria-activedescendant={activeOption >= 0 ? optionId(id, activeOption) : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          setFiltering(true)
          // La lista cambia al escribir: ninguna opción queda activa hasta que se use el teclado.
          setActiveIndex(-1)
          if (hasList) setOpen(true)
        }}
        onFocus={() => hasList && setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {loading ? (
        <Loader2
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-accent"
          strokeWidth={2.4}
          aria-label="Cargando modelos"
        />
      ) : (
        hasList && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Ver modelos disponibles"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text transition-colors hover:text-text-h"
            onClick={() => {
              setFiltering(false)
              setActiveIndex(-1)
              setOpen((current) => !current)
            }}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              strokeWidth={2.2}
            />
          </button>
        )
      )}

      {/* Siempre en el DOM (oculta si está cerrada) para que `aria-controls` apunte a un elemento real. */}
      {hasList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Modelos disponibles"
          hidden={!open}
          className="ai-pop-in absolute left-0 right-0 z-20 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)]"
        >
          {visible.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-[12.5px] text-text">
              Ningún modelo coincide: se usará el nombre que escribiste.
            </li>
          ) : (
            visible.map((model, index) => (
              // El foco real no sale del input: la opción "activa" se anuncia con aria-activedescendant
              // y `aria-selected` marca la que está activa; la elegida se distingue con el check.
              <li
                key={model}
                id={optionId(id, index)}
                role="option"
                aria-selected={index === activeOption}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  index === activeOption ? 'bg-accent/15 outline outline-1 outline-accent/40' : 'hover:bg-accent/10'
                } ${model === value ? 'font-semibold text-accent' : 'text-text-h'}`}
                // No quitarle el foco al input al pulsar una opción.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(model)}
              >
                <span className="truncate">{model}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {model === recommended && (
                    <span className="rounded-full bg-accent/14 px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                      Recomendado
                    </span>
                  )}
                  {model === value && <Check className="h-4 w-4" strokeWidth={2.4} />}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
