import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, ImageOff, MousePointerClick, Plus } from 'lucide-react'

type ItemGridEditorProps = {
  /** Nombre en singular del elemento: "Pareja", "Concepto"… */
  itemLabel: string
  /** Texto del botón de agregar, p. ej. "+ Agregar pareja". Debe empezar por "+" (lo reconoce el shell). */
  addLabel: string
  count: number
  minItems: number
  selected: number
  onSelect: (index: number) => void
  onAdd: () => void
  onRemove: (index: number) => void
  disabled?: boolean
  isComplete: (index: number) => boolean
  /** Texto corto de la tarjeta (nombre del concepto). */
  tileText: (index: number) => string
  /** Miniatura de la tarjeta; sin imagen se muestra un marcador. */
  tileImage?: (index: number) => string | null | undefined
  /** Campos del elemento seleccionado. */
  renderEditor: (index: number) => ReactNode
}

/**
 * Lista larga como cuadrícula de tarjetas pequeñas + un panel que edita solo
 * el elemento elegido. El formulario no crece con cada elemento nuevo:
 * veinte parejas ocupan unas pocas filas y se editan una a una en el panel.
 * Una burbuja titilante le indica al usuario qué hacer hasta que toca la
 * primera tarjeta; las incompletas conservan un punto suave que parpadea.
 */
export function ItemGridEditor({
  itemLabel,
  addLabel,
  count,
  minItems,
  selected,
  onSelect,
  onAdd,
  onRemove,
  disabled,
  isComplete,
  tileText,
  tileImage,
  renderEditor,
}: ItemGridEditorProps) {
  const [touched, setTouched] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const tilesRef = useRef<HTMLDivElement>(null)
  const current = Math.min(Math.max(selected, 0), Math.max(count - 1, 0))
  const completeCount = Array.from({ length: count }, (_, index) => isComplete(index)).filter(Boolean).length

  // La tarjeta elegida siempre queda a la vista dentro de la cuadrícula.
  useEffect(() => {
    const tile = tilesRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    tile?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [current, count])

  function choose(index: number) {
    setTouched(true)
    onSelect(index)
    // En pantallas angostas el panel va debajo: se lleva la vista hasta él.
    if (window.matchMedia?.('(max-width: 1023px)').matches) {
      window.setTimeout(() => panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 60)
    }
  }

  function add() {
    setTouched(true)
    onAdd()
    onSelect(count)
  }

  return (
    <div className="nx-gi" data-nx-wide>
      <div className="nx-gi-head">
        <span className="nx-gi-count">
          <strong>{count}</strong> {count === 1 ? itemLabel.toLowerCase() : `${itemLabel.toLowerCase()}s`}
          <span className="nx-gi-count-sep" aria-hidden="true">·</span>
          <span data-all={completeCount === count}>{completeCount} completas</span>
        </span>
        {!touched && (
          <span className="nx-gi-hint" role="status">
            <MousePointerClick className="h-4 w-4" strokeWidth={2.3} />
            Toca una tarjeta para editarla
          </span>
        )}
      </div>

      <div className="nx-gi-layout">
        <div className="nx-gi-tiles" ref={tilesRef} role="list" aria-label={`${itemLabel}s`}>
          {Array.from({ length: count }, (_, index) => {
            const complete = isComplete(index)
            const image = tileImage?.(index)
            const text = tileText(index).trim()
            return (
              <button
                key={index}
                type="button"
                role="listitem"
                className="nx-gi-tile"
                data-selected={index === current}
                data-complete={complete}
                data-pulse={!touched && index === 0}
                aria-current={index === current}
                aria-label={`${itemLabel} ${index + 1}: ${text || 'sin nombre'}${complete ? ', completa' : ', incompleta'}`}
                onClick={() => choose(index)}
                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              >
                <span className="nx-gi-num" aria-hidden="true">{index + 1}</span>
                <span className="nx-gi-thumb" aria-hidden="true">
                  {image ? <img src={image} alt="" loading="lazy" /> : <ImageOff className="h-5 w-5" strokeWidth={1.8} />}
                </span>
                <span className="nx-gi-name">{text || 'Sin nombre'}</span>
                <span className="nx-gi-status" aria-hidden="true">
                  {complete ? <Check className="h-3 w-3" strokeWidth={3.4} /> : <i className="nx-gi-dot" />}
                </span>
              </button>
            )
          })}
          <button type="button" className="nx-gi-add" disabled={disabled} onClick={add}>
            <Plus className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
            {addLabel}
          </button>
        </div>

        <div className="nx-gi-panel nx-item" ref={panelRef} data-nx-nocount>
          <div className="nx-gi-panel-head">
            <span className="nx-gi-panel-num" aria-hidden="true">{current + 1}</span>
            <p className="nx-gi-panel-title">
              {itemLabel} <span>{current + 1} de {count}</span>
            </p>
            <div className="nx-gi-nav">
              <button
                type="button"
                className="nx-gi-nav-btn"
                aria-label={`${itemLabel} anterior`}
                disabled={current === 0}
                onClick={() => choose(current - 1)}
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2.6} />
              </button>
              <button
                type="button"
                className="nx-gi-nav-btn"
                aria-label={`${itemLabel} siguiente`}
                disabled={current >= count - 1}
                onClick={() => choose(current + 1)}
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </div>
          </div>
          <div key={current} className="nx-gi-fields">
            {renderEditor(current)}
          </div>
          {count > minItems && (
            <button type="button" className="nx-remove nx-gi-remove" disabled={disabled} onClick={() => onRemove(current)}>
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
