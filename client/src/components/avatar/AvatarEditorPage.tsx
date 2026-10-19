import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Dices, Plus, RotateCcw, RotateCw, Undo2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import type { AvatarConfig, AvatarPieceSlot } from '../../services/avatar.service'
import { AVATAR_FACE_IDS, AVATAR_SKINS } from './avatarCatalog.generated'
import {
  DEFAULT_AVATAR,
  changeSkin,
  findPiece,
  normalizeAvatar,
  piecesFor,
  randomAvatar,
  sameAvatar,
  wearPiece,
} from './avatarConfig'
import { faceUrl, preloadPiece, thumbUrl } from './avatarAssets'
import type { AvatarLayerSlot } from './avatarTypes'
import { AvatarFigure } from './AvatarFigure'
import { AvatarPortrait } from './AvatarPortrait'
import './avatar.css'

type ClosetSlot = Exclude<AvatarLayerSlot, 'hair'>

const CLOSET_TABS: { slot: ClosetSlot; label: string; emoji: string; none: string }[] = [
  { slot: 'top', label: 'Arriba', emoji: '👕', none: 'Sin camiseta' },
  { slot: 'outer', label: 'Abrigos', emoji: '🧥', none: 'Sin abrigo' },
  { slot: 'bottom', label: 'Abajo', emoji: '👖', none: 'Sin pantalón' },
  { slot: 'dress', label: 'Vestidos', emoji: '👗', none: 'Sin vestido' },
  { slot: 'shoes', label: 'Calzado', emoji: '👟', none: 'Descalzo' },
  { slot: 'hat', label: 'Gorros', emoji: '🧢', none: 'Sin gorro' },
]

const HISTORY_LIMIT = 50

/** Descripción para lectores de pantalla: tono y prendas puestas. */
function describe(config: AvatarConfig): string {
  const skin = AVATAR_SKINS.find((item) => item.id === config.skin)?.label.toLowerCase() ?? ''
  const pieces = (['hair', 'hat', 'top', 'outer', 'dress', 'bottom', 'shoes'] as const)
    .map((slot) => findPiece(config[slot])?.label)
    .filter(Boolean)
  return [`piel ${skin}`, ...pieces].join(', ')
}

/**
 * "Personaliza tu avatar" (issue #77): panel Estilo (cabello, tono y foto de
 * perfil), el avatar sobre su isla y el Armario por pestañas. Se abre desde
 * Configuración → "Configurar avatar" y desde el menú de la cuenta. Los
 * cambios son un borrador hasta tocar Guardar; Deshacer recorre el historial.
 */
export function AvatarEditorPage() {
  const { user, saveAvatar } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const saved = useMemo(() => normalizeAvatar(user?.avatarConfig), [user?.avatarConfig])
  const [draft, setDraft] = useState<AvatarConfig>(() => saved ?? DEFAULT_AVATAR)
  const [history, setHistory] = useState<AvatarConfig[]>([])
  const [closetTab, setClosetTab] = useState<ClosetSlot>('top')
  const [spin, setSpin] = useState<'left' | 'right' | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = !sameAvatar(draft, saved)

  if (!user) return null

  function update(next: AvatarConfig) {
    if (sameAvatar(next, draft)) return
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), draft])
    setDraft(next)
  }

  function wear(slot: AvatarPieceSlot, id: string | null) {
    update(wearPiece(draft, slot, id))
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
    const index = CLOSET_TABS.findIndex((tab) => tab.slot === closetTab)
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = CLOSET_TABS[(index + step + CLOSET_TABS.length) % CLOSET_TABS.length]
    setClosetTab(next.slot)
    document.getElementById(`avatar-tab-${next.slot}`)?.focus()
  }

  const activeTab = CLOSET_TABS.find((tab) => tab.slot === closetTab) ?? CLOSET_TABS[0]
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
            <section className="avatar-section" aria-labelledby="avatar-hair-title">
              <h3 id="avatar-hair-title" className="avatar-section-title">
                Cabello
              </h3>
              <div className="avatar-grid">
                <NoneTile label="Sin cabello" pressed={!draft.hair} onClick={() => wear('hair', null)} />
                {piecesFor('hair').map((piece) => (
                  <PieceTile key={piece.id} id={piece.id} label={piece.label} pressed={draft.hair === piece.id} onClick={() => wear('hair', piece.id)} />
                ))}
              </div>
            </section>

            <section className="avatar-section" aria-labelledby="avatar-skin-title">
              <h3 id="avatar-skin-title" className="avatar-section-title">
                Tono
              </h3>
              <div className="avatar-swatches">
                {AVATAR_SKINS.map((skin) => (
                  <button
                    key={skin.id}
                    type="button"
                    className="avatar-swatch"
                    style={{ background: skin.swatch }}
                    aria-pressed={draft.skin === skin.id}
                    aria-label={`Tono ${skin.label.toLowerCase()}`}
                    title={skin.label}
                    onClick={() => update(changeSkin(draft, skin.id))}
                  />
                ))}
              </div>
            </section>

            <section className="avatar-section" aria-labelledby="avatar-photo-title">
              <h3 id="avatar-photo-title" className="avatar-section-title">
                Foto de perfil
              </h3>
              <p className="avatar-section-hint">Así te ven en el menú y en las salas de juego: tu avatar o una cara lista.</p>
              <div className="avatar-grid">
                <button
                  type="button"
                  className="avatar-tile avatar-tile-portrait avatar-portrait-bg"
                  aria-pressed={!draft.portrait}
                  aria-label="Usar mi avatar como foto"
                  title="Mi avatar"
                  onClick={() => update({ ...draft, portrait: null })}
                >
                  <AvatarPortrait config={{ ...draft, portrait: null }} />
                </button>
                {AVATAR_FACE_IDS.map((face, index) => (
                  <button
                    key={face}
                    type="button"
                    className="avatar-tile avatar-tile-portrait avatar-portrait-bg"
                    aria-pressed={draft.portrait === face}
                    aria-label={`Cara lista ${index + 1}`}
                    onClick={() => update({ ...draft, portrait: face })}
                  >
                    <img src={faceUrl(face)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <div className="avatar-stage avatar-area-stage">
          <span className="avatar-island" aria-hidden="true" />
          <span className="avatar-shadow" aria-hidden="true" />
          <div
            className={`avatar-stage-figure ${spin ? `is-spinning-${spin}` : ''}`}
            onAnimationEnd={() => setSpin(null)}
          >
            <AvatarFigure config={draft} label={`Tu avatar: ${describe(draft)}`} />
          </div>
        </div>

        <aside className="avatar-panel avatar-area-closet" aria-labelledby="avatar-closet-title">
          <h2 id="avatar-closet-title" className="avatar-panel-plaque">
            Armario
          </h2>
          <div className="avatar-tabs" role="tablist" aria-label="Partes del armario" onKeyDown={handleTabKeys}>
            {CLOSET_TABS.map((tab) => (
              <button
                key={tab.slot}
                id={`avatar-tab-${tab.slot}`}
                type="button"
                role="tab"
                className="avatar-tab"
                aria-selected={closetTab === tab.slot}
                aria-controls="avatar-closet-panel"
                tabIndex={closetTab === tab.slot ? 0 : -1}
                onClick={() => setClosetTab(tab.slot)}
              >
                <span aria-hidden="true">{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div
            id="avatar-closet-panel"
            className="avatar-panel-body"
            role="tabpanel"
            aria-labelledby={`avatar-tab-${activeTab.slot}`}
          >
            {activeTab.slot === 'dress' && (
              <p className="avatar-section-hint mt-1">Un vestido reemplaza la parte de arriba y la de abajo.</p>
            )}
            <div className="avatar-grid">
              <NoneTile label={activeTab.none} pressed={!draft[activeTab.slot]} onClick={() => wear(activeTab.slot, null)} />
              {piecesFor(activeTab.slot).map((piece) => (
                <PieceTile
                  key={piece.id}
                  id={piece.id}
                  label={piece.label}
                  pressed={draft[activeTab.slot] === piece.id}
                  onClick={() => wear(activeTab.slot, piece.id)}
                />
              ))}
            </div>
          </div>
        </aside>

        <div className="avatar-area-status">
          <button type="button" className="avatar-btn avatar-btn-random" onClick={() => update(randomAvatar(draft))}>
            <Dices className="h-5 w-5" strokeWidth={2.5} />
            Sorpréndeme
          </button>
          <p className="avatar-status" role="status">
            {!dirty && <Check className="mr-1 inline h-4 w-4" strokeWidth={3} />}
            {status}
          </p>
        </div>

        <div className="avatar-turn avatar-area-turn">
          <button
            type="button"
            className="avatar-turn-arrow"
            aria-label="Girar a la izquierda"
            title="Girar"
            onClick={() => setSpin((current) => current ?? 'left')}
          >
            <RotateCcw className="h-5 w-5" strokeWidth={2.75} />
          </button>
          <span className="avatar-pill">Mi Avatar</span>
          <button
            type="button"
            className="avatar-turn-arrow"
            aria-label="Girar a la derecha"
            title="Girar"
            onClick={() => setSpin((current) => current ?? 'right')}
          >
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

function PieceTile({ id, label, pressed, onClick }: { id: string; label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="avatar-tile"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerEnter={() => preloadPiece(id)}
      onFocus={() => preloadPiece(id)}
    >
      <img src={thumbUrl(id)} alt="" loading="lazy" draggable={false} />
    </button>
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
