import { useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Dices, Plus, RotateCcw, RotateCw, Undo2 } from 'lucide-react'
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
  TOPS,
  isHat,
  normalizeAvatar,
  randomAvatar,
  sameAvatar,
  type ColorField,
  type Option,
} from './avatarConfig'
import { AvatarFigure } from './AvatarFigure'
import { AvatarPortrait } from './AvatarPortrait'
import './avatar.css'

type ClosetTab = 'outfit' | 'shoes' | 'hats'

const CLOSET_TABS: { id: ClosetTab; label: string; emoji: string }[] = [
  { id: 'outfit', label: 'Ropa', emoji: '👕' },
  { id: 'shoes', label: 'Calzado', emoji: '👟' },
  { id: 'hats', label: 'Gorros', emoji: '🧢' },
]

const HISTORY_LIMIT = 50

/** Los atuendos que usan el color de la chaqueta (el vestido también lo usa). */
const USES_JACKET = new Set(['jacket', 'coat', 'suit', 'dress', 'hoodie'])

/**
 * "Personaliza tu avatar" (issue #77) con el estilo Voxel Art de DiceBear:
 * panel Estilo (cabello, piel y cara), el avatar sobre su isla y el Armario
 * por pestañas. Cada opción se muestra con el avatar actual ya cambiado. Los
 * cambios son un borrador hasta tocar Guardar; Deshacer recorre el historial.
 */
export function AvatarEditorPage() {
  const { user, saveAvatar } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const saved = useMemo(() => normalizeAvatar(user?.avatarConfig), [user?.avatarConfig])
  const [draft, setDraft] = useState<AvatarConfig>(() => saved ?? DEFAULT_AVATAR)
  const [history, setHistory] = useState<AvatarConfig[]>([])
  const [closetTab, setClosetTab] = useState<ClosetTab>('outfit')
  const [spin, setSpin] = useState<'left' | 'right' | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = !sameAvatar(draft, saved)

  if (!user) return null

  function update(next: AvatarConfig) {
    if (sameAvatar(next, draft)) return
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), draft])
    setDraft(next)
  }

  function set<K extends keyof AvatarConfig>(field: K, value: AvatarConfig[K]) {
    update({ ...draft, [field]: value })
  }

  function undo() {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory((current) => current.slice(0, -1))
    setDraft(previous)
  }

  async function save() {
    setSaving(true)
    try {
      await saveAvatar(draft)
      setHistory([])
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

  function handleTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const index = CLOSET_TABS.findIndex((tab) => tab.id === closetTab)
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = CLOSET_TABS[(index + step + CLOSET_TABS.length) % CLOSET_TABS.length]
    setClosetTab(next.id)
    document.getElementById(`avatar-tab-${next.id}`)?.focus()
  }

  /** Grilla de opciones: cada miniatura es el avatar actual con esa opción puesta. */
  function options(field: keyof AvatarConfig, list: Option[], view: 'portrait' | 'full', none?: string) {
    return (
      <div className="avatar-grid">
        {none && <NoneTile label={none} pressed={draft[field] === null} onClick={() => set(field, null as never)} />}
        {list.map((option) => {
          const preview = { ...draft, [field]: option.id }
          return (
            <button
              key={option.id}
              type="button"
              className={`avatar-tile ${view === 'portrait' ? 'avatar-tile-portrait avatar-portrait-bg' : ''}`}
              aria-pressed={draft[field] === option.id}
              aria-label={option.label}
              title={option.label}
              onClick={() => set(field, option.id as never)}
            >
              {view === 'portrait' ? <AvatarPortrait config={preview} /> : <AvatarFigure config={preview} className="avatar-tile-figure" />}
            </button>
          )
        })}
      </div>
    )
  }

  function colors(field: ColorField, label: string) {
    return (
      <div className="avatar-color-row">
        <span className="avatar-color-label">{label}</span>
        <div className="avatar-swatches" role="group" aria-label={label}>
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

  const hairOptions = TOPS
  const wearingHat = isHat(draft.top)
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
        <button type="button" className="avatar-back avatar-chip-btn" onClick={goBack}>
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          Volver
        </button>

        <aside className="avatar-panel avatar-area-style" aria-labelledby="avatar-style-title">
          <h2 id="avatar-style-title" className="avatar-panel-plaque">
            Estilo
          </h2>
          <div className="avatar-panel-body">
            <Section title="Cabello">
              {wearingHat && <p className="avatar-section-hint">Tienes un gorro puesto: al elegir un peinado se quita.</p>}
              {options('top', hairOptions, 'portrait', 'Sin cabello')}
              {colors('hairColor', 'Color')}
            </Section>
            <Section title="Piel">{colors('skinColor', 'Tono')}</Section>
            <Section title="Ojos">{options('eyes', EYES, 'portrait')}</Section>
            <Section title="Cejas">{options('eyebrows', EYEBROWS, 'portrait', 'Sin cejas')}</Section>
            <Section title="Boca">{options('mouth', MOUTHS, 'portrait')}</Section>
            <Section title="Nariz">{options('nose', NOSES, 'portrait')}</Section>
            <Section title="Mejillas">{options('cheeks', CHEEKS, 'portrait', 'Nada')}</Section>
            <Section title="Lentes">{options('glasses', GLASSES, 'portrait', 'Sin lentes')}</Section>
            <Section title="Barba">{options('beard', BEARDS, 'portrait', 'Sin barba')}</Section>
          </div>
        </aside>

        <div className="avatar-stage avatar-area-stage">
          <span className="avatar-island" aria-hidden="true" />
          <div className={`avatar-stage-figure ${spin ? `is-spinning-${spin}` : ''}`} onAnimationEnd={() => setSpin(null)}>
            <AvatarFigure config={draft} label="Tu avatar" />
          </div>
        </div>

        <aside className="avatar-panel avatar-area-closet" aria-labelledby="avatar-closet-title">
          <h2 id="avatar-closet-title" className="avatar-panel-plaque">
            Armario
          </h2>
          <div className="avatar-tabs" role="tablist" aria-label="Partes del armario" onKeyDown={handleTabKeys}>
            {CLOSET_TABS.map((tab) => (
              <button
                key={tab.id}
                id={`avatar-tab-${tab.id}`}
                type="button"
                role="tab"
                className="avatar-tab"
                aria-selected={closetTab === tab.id}
                aria-controls="avatar-closet-panel"
                tabIndex={closetTab === tab.id ? 0 : -1}
                onClick={() => setClosetTab(tab.id)}
              >
                <span aria-hidden="true">{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div id="avatar-closet-panel" className="avatar-panel-body" role="tabpanel" aria-labelledby={`avatar-tab-${closetTab}`}>
            {closetTab === 'outfit' && (
              <>
                <Section title="Atuendo">{options('outfit', OUTFITS, 'full')}</Section>
                <Section title="Colores">
                  {colors('shirtColor', 'Camiseta')}
                  {USES_JACKET.has(draft.outfit) && colors('jacketColor', draft.outfit === 'dress' ? 'Vestido' : 'Chaqueta')}
                  {colors('pantsColor', 'Pantalón')}
                </Section>
              </>
            )}
            {closetTab === 'shoes' && <Section title="Zapatos">{colors('shoesColor', 'Color')}</Section>}
            {closetTab === 'hats' && (
              <Section title="Gorros">
                <p className="avatar-section-hint">El gorro reemplaza al peinado.</p>
                {options('top', HATS, 'portrait')}
                {colors('hatColor', 'Color')}
              </Section>
            )}
          </div>
        </aside>

        <div className="avatar-area-status">
          <button type="button" className="avatar-btn avatar-btn-random" onClick={() => update(randomAvatar())}>
            <Dices className="h-5 w-5" strokeWidth={2.5} />
            Sorpréndeme
          </button>
          <p className="avatar-status" role="status">
            {!dirty && <Check className="mr-1 inline h-4 w-4" strokeWidth={3} />}
            {status}
          </p>
        </div>

        <div className="avatar-turn avatar-area-turn">
          <button type="button" className="avatar-turn-arrow" aria-label="Girar a la izquierda" title="Girar" onClick={() => setSpin((current) => current ?? 'left')}>
            <RotateCcw className="h-5 w-5" strokeWidth={2.75} />
          </button>
          <span className="avatar-pill">Mi Avatar</span>
          <button type="button" className="avatar-turn-arrow" aria-label="Girar a la derecha" title="Girar" onClick={() => setSpin((current) => current ?? 'right')}>
            <RotateCw className="h-5 w-5" strokeWidth={2.75} />
          </button>
        </div>

        <div className="avatar-buttons avatar-area-buttons">
          <button type="button" className="avatar-btn avatar-btn-undo" onClick={undo} disabled={history.length === 0}>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="avatar-section">
      <h3 className="avatar-section-title">{title}</h3>
      {children}
    </section>
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
