import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Plus, Undo2 } from 'lucide-react'
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
import { CategoryRail } from './CategoryRail'
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
  const surprise = useCallback(() => setHistory((current) => pushHistory(current, randomAvatar())), [])
  const selectCategory = useCallback((id: string) => setCategory(id as Category), [])

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
              <AvatarPortrait config={preview} focus={focus} deferred />
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

        <CategoryRail categories={CATEGORIES} current={category} onSelect={selectCategory} onSurprise={surprise} />

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
