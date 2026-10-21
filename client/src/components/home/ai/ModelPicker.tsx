import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'

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
}: Props) {
  const [open, setOpen] = useState(false)
  const [filtering, setFiltering] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Solo se filtra mientras el usuario escribe; al abrir con la flecha se ve la lista completa.
  const visible = useMemo(() => {
    const query = value.trim().toLowerCase()
    const matching = filtering && query ? models.filter((model) => model.toLowerCase().includes(query)) : models
    // El recomendado siempre primero.
    return recommended && matching.includes(recommended)
      ? [recommended, ...matching.filter((model) => model !== recommended)]
      : matching
  }, [models, value, filtering, recommended])

  const hasList = models.length > 0

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        className={`${inputClass} ${hasList || loading ? 'pr-10' : ''}`}
        value={value}
        required={required}
        maxLength={120}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role={hasList ? 'combobox' : undefined}
        aria-expanded={hasList ? open : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          setFiltering(true)
          if (hasList) setOpen(true)
        }}
        onFocus={() => hasList && setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'ArrowDown' && hasList) setOpen(true)
        }}
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

      {open && hasList && (
        <ul
          role="listbox"
          className="ai-pop-in absolute left-0 right-0 z-20 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)]"
        >
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-[12.5px] text-text">Ningún modelo coincide: se usará el nombre que escribiste.</li>
          ) : (
            visible.map((model) => (
              <li key={model} role="option" aria-selected={model === value}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent/10 ${
                    model === value ? 'font-semibold text-accent' : 'text-text-h'
                  }`}
                  onClick={() => {
                    onChange(model)
                    setOpen(false)
                  }}
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
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
