import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Dices, Plus, Undo2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import type { AvatarConfig } from '../../services/avatar.service'
import {
  BEARDS,
  CHEEKS,
  DEFAULT_AVATAR,
  EYEBROWS,
  EYES,
  GLASSES,
  HATS,
  MOUTHS,
  NOSES,
  OUTFITS,
  PALETTES,
  PANTS,
  SHOES,
  TOPS,
  normalizeAvatar,
  randomAvatar,
  sameAvatar,
  type ColorField,
  type Option,
} from './avatarConfig'
import { AvatarFigure } from './AvatarFigure'
import { canRedo, canUndo, createHistory, historyShortcut, pushHistory, redoHistory, undoHistory } from './avatarHistory'
import { AvatarPortrait } from './AvatarPortrait'
import './avatar.css'

type Category = 'hair' | 'hats' | 'face' | 'body' | 'torso' | 'pants' | 'shoes' | 'accessories'

/** Categorías de la barra lateral (como el editor de Roblox) y las subcategorías de cada una. */
const CATEGORIES: { id: Category; label: string; emoji: string; subs: { id: string; label: string }[] }[] = [
  { id: 'hair', label: 'Cabello', emoji: '💇', subs: [{ id: 'style', label: 'Peinado' }, { id: 'color', label: 'Color' }] },
  { id: 'hats', label: 'Gorros', emoji: '🧢', subs: [{ id: 'style', label: 'Gorro' }, { id: 'color', label: 'Color' }] },
  {
    id: 'face',
    label: 'Cara',
    emoji: '🙂',
    subs: [
      { id: 'eyes', label: 'Ojos' },
      { id: 'eyebrows', label: 'Cejas' },
      { id: 'mouth', label: 'Boca' },
      { id: 'nose', label: 'Nariz' },
      { id: 'cheeks', label: 'Mejillas' },
    ],
  },
  { id: 'body', label: 'Cuerpo', emoji: '🧍', subs: [{ id: 'skin', label: 'Tono de piel' }] },
  { id: 'torso', label: 'Torso', emoji: '👕', subs: [{ id: 'style', label: 'Prenda' }, { id: 'colors', label: 'Colores' }] },
  { id: 'pants', label: 'Pantalón', emoji: '👖', subs: [{ id: 'style', label: 'Prenda' }, { id: 'color', label: 'Color' }] },
  { id: 'shoes', label: 'Calzado', emoji: '👟', subs: [{ id: 'style', label: 'Tipo' }, { id: 'color', label: 'Color' }] },
  { id: 'accessories', label: 'Accesorios', emoji: '🕶️', subs: [{ id: 'glasses', label: 'Lentes' }, { id: 'beard', label: 'Barba' }] },
]

/** Los torsos con un segundo color (el de la chaqueta) y cómo se llama en cada uno. */
const SECOND_COLOR: Record<string, string> = {
  jacket: 'Chaqueta',
  coat: 'Abrigo',
  suit: 'Saco',
  hoodie: 'Buzo',
  dress: 'Vestido',
  vest: 'Chaleco',
  jersey: 'Mangas',
}

/**
 * "Personaliza tu avatar" (issues #77 y #136, estilo propio sobre Voxel Art de
 * DiceBear), con las categorías en botones como el editor de Roblox: una barra
 * a la izquierda (Cabello, Gorros, Cara, Cuerpo, Torso, Pantalón, Calzado,
 * Accesorios), cada parte por su cuenta, las subcategorías como
 * botones arriba del panel y el avatar al lado. Los cambios son un borrador
 * hasta tocar Guardar; las flechas junto al avatar, Deshacer y Ctrl+Z / Ctrl+Y
 * recorren el historial (issue #138), así se puede volver a la prenda de antes
 * o a un avatar de "Sorpresa".
 */
export function AvatarEditorPage({ onSkip }: { onSkip?: () => void } = {}) {
  const { user, saveAvatar } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const saved = useMemo(() => normalizeAvatar(user?.avatarConfig), [user?.avatarConfig])
  const [history, setHistory] = useState(() => createHistory(saved ?? DEFAULT_AVATAR))
  const [category, setCategory] = useState<Category>('hair')
  const [subByCategory, setSubByCategory] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const draft = history.present
  const dirty = !sameAvatar(draft, saved)
  const undo = useCallback(() => setHistory(undoHistory), [])
  const redo = useCallback(() => setHistory(redoHistory), [])

  // Ctrl+Z / Ctrl+Y en toda la página, salvo mientras se escribe en un campo.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const action = historyShortcut(event)
      if (!action) return
      event.preventDefault()
      if (action === 'undo') undo()
      else redo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  const { ref: railRef, moreBelow, thumb, measure: measureRail, scrollDown, onTrackPointerDown, onThumbPointerDown } = useRailScroll(category)

  if (!user) return null

  const current = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0]
  const sub = subByCategory[current.id] ?? current.subs[0].id

  function update(next: AvatarConfig) {
    setHistory((current) => pushHistory(current, next))
  }

  function set<K extends keyof AvatarConfig>(field: K, value: AvatarConfig[K]) {
    update({ ...draft, [field]: value })
  }

  async function save() {
    setSaving(true)
    try {
      await saveAvatar(draft)
      showToast('¡Tu avatar quedó guardado!')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo guardar el avatar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function goBack() {
    if (dirty && !window.confirm('Tienes cambios sin guardar en tu avatar. ¿Salir de todas formas?')) return
    const canGoBack = typeof window.history.state?.idx === 'number' && window.history.state.idx > 0
    if (canGoBack) navigate(-1)
    else navigate('/')
  }

  function handleSubKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const index = current.subs.findIndex((item) => item.id === sub)
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = current.subs[(index + step + current.subs.length) % current.subs.length]
    setSubByCategory((map) => ({ ...map, [current.id]: next.id }))
    document.getElementById(`avatar-sub-${next.id}`)?.focus()
  }

  /** Grilla de opciones: cada miniatura es el avatar actual con esa opción puesta. */
  function options(field: keyof AvatarConfig, list: Option[], focus: 'head' | 'torso' | 'legs', none?: ReactNode) {
    return (
      <div className="avatar-grid">
        {none}
        {list.map((option) => {
          const preview = { ...draft, [field]: option.id }
          return (
            <button
              key={option.id}
              type="button"
              className={`avatar-tile avatar-portrait-bg ${focus === 'head' ? 'avatar-tile-portrait' : 'avatar-tile-zoom'}`}
              aria-pressed={draft[field] === option.id}
              aria-label={option.label}
              title={option.label}
              onClick={() => set(field, option.id as never)}
            >
              <AvatarPortrait config={preview} focus={focus} />
            </button>
          )
        })}
      </div>
    )
  }

  function noneTile(field: keyof AvatarConfig, label: string) {
    return <NoneTile label={label} pressed={draft[field] === null} onClick={() => set(field, null as never)} />
  }

  function colors(field: ColorField, label: string) {
    return (
      <div className="avatar-color-row">
        <span className="avatar-color-label">{label}</span>
        <div className="avatar-swatches avatar-swatches-large" role="group" aria-label={label}>
          {PALETTES[field].map((hex) => (
            <button
              key={hex}
              type="button"
              className="avatar-swatch"
              style={{ background: `#${hex}` }}
              aria-pressed={draft[field] === hex}
              aria-label={`${label}: #${hex}`}
              onClick={() => set(field, hex)}
            />
          ))}
        </div>
      </div>
    )
  }

  function content(): ReactNode {
    switch (`${current.id}/${sub}`) {
      case 'hair/style':
        return (
          <>
            {draft.hat && <p className="avatar-section-hint">El gorro se queda puesto: el pelo asoma por debajo.</p>}
            {options('top', TOPS, 'head', noneTile('top', 'Sin cabello'))}
          </>
        )
      case 'hair/color':
        return colors('hairColor', 'Color del cabello')
      case 'hats/style':
        return options('hat', HATS, 'head', noneTile('hat', 'Sin gorro'))
      case 'hats/color':
        return colors('hatColor', 'Color del gorro')
      case 'face/eyes':
        return options('eyes', EYES, 'head')
      case 'face/eyebrows':
        return options('eyebrows', EYEBROWS, 'head', noneTile('eyebrows', 'Sin cejas'))
      case 'face/mouth':
        return options('mouth', MOUTHS, 'head')
      case 'face/nose':
        return options('nose', NOSES, 'head')
      case 'face/cheeks':
        return options('cheeks', CHEEKS, 'head', noneTile('cheeks', 'Nada'))
      case 'body/skin':
        return colors('skinColor', 'Tono de piel')
      case 'torso/style':
        return options('outfit', OUTFITS, 'torso')
      case 'torso/colors':
        return (
          <>
            {colors('shirtColor', 'Camiseta')}
            {SECOND_COLOR[draft.outfit] && colors('jacketColor', SECOND_COLOR[draft.outfit])}
          </>
        )
      case 'pants/style':
        return options('pants', PANTS, 'legs')
      case 'pants/color':
        return colors('pantsColor', draft.pants === 'skirt' ? 'Color de la falda' : 'Color del pantalón')
      case 'shoes/style':
        return options('shoes', SHOES, 'legs')
      case 'shoes/color':
        return colors('shoesColor', 'Color del calzado')
      case 'accessories/glasses':
        return options('glasses', GLASSES, 'head', noneTile('glasses', 'Sin lentes'))
      case 'accessories/beard':
        return options('beard', BEARDS, 'head', noneTile('beard', 'Sin barba'))
      default:
        return null
    }
  }

  const status = !dirty ? 'Guardado' : saved ? 'Cambios sin guardar' : 'Aún no guardas tu avatar'

  return (
    <div className="avatar-studio">
      <section className="avatar-board" aria-labelledby="avatar-title">
        <span className="avatar-cloud avatar-cloud-1" aria-hidden="true" />
        <span className="avatar-cloud avatar-cloud-2" aria-hidden="true" />
        <span className="avatar-cloud avatar-cloud-3" aria-hidden="true" />
        <span className="avatar-cloud avatar-cloud-4" aria-hidden="true" />

        <div className="avatar-sign">
          <h1 id="avatar-title">
            Personaliza <span>tu avatar</span>
          </h1>
        </div>
        {onSkip ? (
          <button type="button" className="avatar-back avatar-chip-btn avatar-skip" onClick={onSkip}>
            Saltar por ahora
            <ArrowRight className="h-5 w-5" strokeWidth={3} />
          </button>
        ) : (
          <button type="button" className="avatar-back avatar-chip-btn" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
            Volver
          </button>
        )}

        <div className="avatar-rail-wrap avatar-area-rail">
        <nav ref={railRef} className="avatar-rail" aria-label="Categorías del avatar" onScroll={measureRail}>
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="avatar-rail-btn"
              data-category={item.id}
              aria-current={category === item.id ? 'true' : undefined}
              onClick={() => setCategory(item.id)}
            >
              <span className="avatar-rail-icon" aria-hidden="true">
                {item.emoji}
              </span>
              {item.label}
            </button>
          ))}
          <span className="avatar-rail-sep" aria-hidden="true" />
          <button type="button" className="avatar-rail-btn avatar-rail-btn-action" onClick={() => update(randomAvatar())}>
            <span className="avatar-rail-icon" aria-hidden="true">
              <Dices className="h-6 w-6" strokeWidth={2.5} />
            </span>
            Sorpresa
          </button>
          {moreBelow && (
            <button type="button" className="avatar-rail-more" onClick={scrollDown} aria-label="Ver más categorías" title="Ver más categorías">
              <ChevronDown className="h-5 w-5" strokeWidth={3} />
            </button>
          )}
        </nav>
        {thumb && (
          <div className="avatar-rail-track" aria-hidden="true" onPointerDown={onTrackPointerDown}>
            <div
              className="avatar-rail-thumb"
              style={{ height: thumb.size, transform: `translateY(${thumb.offset}px)` }}
              onPointerDown={onThumbPointerDown}
            />
          </div>
        )}
        </div>

        <section className="avatar-panel avatar-area-panel" aria-labelledby="avatar-panel-title">
          <h2 id="avatar-panel-title" className="avatar-panel-plaque">
            {current.label}
          </h2>
          {current.subs.length > 1 && (
            <div className="avatar-tabs" role="tablist" aria-label={`Partes de ${current.label.toLowerCase()}`} onKeyDown={handleSubKeys}>
              {current.subs.map((item) => (
                <button
                  key={item.id}
                  id={`avatar-sub-${item.id}`}
                  type="button"
                  role="tab"
                  className="avatar-tab"
                  aria-selected={sub === item.id}
                  aria-controls="avatar-panel-body"
                  tabIndex={sub === item.id ? 0 : -1}
                  onClick={() => setSubByCategory((map) => ({ ...map, [current.id]: item.id }))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <div
            id="avatar-panel-body"
            className="avatar-panel-body"
            role={current.subs.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={current.subs.length > 1 ? `avatar-sub-${sub}` : 'avatar-panel-title'}
          >
            {content()}
          </div>
        </section>

        <div className="avatar-stage-col avatar-area-stage">
          <div className="avatar-stage">
            <span className="avatar-island" aria-hidden="true" />
            <div className="avatar-stage-figure">
              <AvatarFigure config={draft} label="Tu avatar" />
            </div>
          </div>
          <div className="avatar-turn">
            <button type="button" className="avatar-turn-arrow" aria-label="Atrás: volver al cambio anterior" title="Atrás (Ctrl+Z)" onClick={undo} disabled={!canUndo(history)}>
              <ChevronLeft className="h-6 w-6" strokeWidth={3} />
            </button>
            <span className="avatar-pill">Mi Avatar</span>
            <button type="button" className="avatar-turn-arrow" aria-label="Adelante: rehacer el cambio" title="Adelante (Ctrl+Y)" onClick={redo} disabled={!canRedo(history)}>
              <ChevronRight className="h-6 w-6" strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="avatar-area-status">
          <p className="avatar-status" role="status">
            {!dirty && <Check className="mr-1 inline h-4 w-4" strokeWidth={3} />}
            {status}
          </p>
        </div>

        <div className="avatar-buttons avatar-area-buttons">
          <button type="button" className="avatar-btn avatar-btn-undo" onClick={undo} disabled={!canUndo(history)}>
            <Undo2 className="h-5 w-5" strokeWidth={2.75} />
            Deshacer
          </button>
          <button type="button" className="avatar-btn avatar-btn-save" onClick={save} disabled={!dirty || saving}>
            <Plus className="h-5 w-5" strokeWidth={3} />
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </section>
    </div>
  )
}

/** Margen de la barra de scroll propia dentro de la barra de categorías (px, arriba y abajo). */
const TRACK_INSET = 14
const MIN_THUMB = 36

/**
 * Barra de categorías con scroll (issue #138). El scroll del sistema no siempre
 * se ve (Mac y pantallas táctiles lo esconden), así que se dibuja uno propio,
 * siempre visible, que se puede arrastrar o tocar; además una flecha avisa
 * cuando quedan categorías abajo y la barra se desplaza sola a la elegida.
 */
function useRailScroll(category: string) {
  const ref = useRef<HTMLElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)
  const [thumb, setThumb] = useState<{ size: number; offset: number } | null>(null)

  const measure = useCallback(() => {
    const element = ref.current
    if (!element) return
    const { scrollTop, scrollHeight, clientHeight } = element
    // En el celular la barra es una fila con scroll horizontal: ahí no aplica.
    const overflow = scrollHeight - clientHeight
    const vertical = overflow > 1 && getComputedStyle(element).flexDirection === 'column'
    setMoreBelow(vertical && scrollTop < overflow - 4)
    if (!vertical) {
      setThumb(null)
      return
    }
    const track = clientHeight - TRACK_INSET * 2
    const size = Math.max(MIN_THUMB, Math.round((track * clientHeight) / scrollHeight))
    const offset = Math.round(((track - size) * Math.min(Math.max(scrollTop, 0), overflow)) / overflow)
    setThumb((previous) => (previous && previous.size === size && previous.offset === offset ? previous : { size, offset }))
  }, [])

  /** Cuántos píxeles de scroll equivale mover la barrita un píxel. */
  const scrollPerPixel = useCallback(() => {
    const element = ref.current
    if (!element) return 0
    const track = element.clientHeight - TRACK_INSET * 2
    const size = Math.max(MIN_THUMB, (track * element.clientHeight) / element.scrollHeight)
    return track > size ? (element.scrollHeight - element.clientHeight) / (track - size) : 0
  }, [])

  const onThumbPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const element = ref.current
      if (!element || event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const handle = event.currentTarget
      const startY = event.clientY
      const startTop = element.scrollTop
      const ratio = scrollPerPixel()
      handle.setPointerCapture(event.pointerId)
      handle.classList.add('is-dragging')
      const move = (moveEvent: PointerEvent) => {
        element.scrollTop = startTop + (moveEvent.clientY - startY) * ratio
      }
      const stop = () => {
        handle.classList.remove('is-dragging')
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', stop)
        handle.removeEventListener('pointercancel', stop)
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', stop)
      handle.addEventListener('pointercancel', stop)
    },
    [scrollPerPixel],
  )

  /** Tocar el riel (fuera de la barrita) avanza una página hacia ese lado. */
  const onTrackPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const element = ref.current
    const handle = event.currentTarget.firstElementChild
    if (!element || !handle || event.button !== 0) return
    const above = event.clientY < handle.getBoundingClientRect().top
    element.scrollBy({ top: (above ? -1 : 1) * element.clientHeight * 0.8, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => {
    const button = ref.current?.querySelector<HTMLElement>(`[data-category="${category}"]`)
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [category])

  const scrollDown = useCallback(() => {
    const element = ref.current
    element?.scrollBy({ top: element.clientHeight * 0.7, behavior: 'smooth' })
  }, [])

  return { ref, moreBelow, thumb, measure, scrollDown, onTrackPointerDown, onThumbPointerDown }
}

function NoneTile({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" className="avatar-tile" aria-pressed={pressed} title={label} onClick={onClick}>
      <span className="avatar-tile-none">
        <span aria-hidden="true" className="mb-0.5 block text-[20px]">
          ∅
        </span>
        {label}
      </span>
    </button>
  )
}
