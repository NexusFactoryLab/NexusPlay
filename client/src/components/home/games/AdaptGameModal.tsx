import { useEffect, useState } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Dices,
  Flame,
  Ghost,
  Info,
  Layers,
  Loader2,
  Puzzle,
  UserRoundSearch,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import {
  adaptGame,
  getAdaptationOptions,
  type AdaptationEngine,
  type AdaptationOptions,
} from '../../../services/game-adaptation.service'
import { listAllGameTypeSettings, type GameDetail } from '../../../services/game.service'
import { ApiError } from '../../../utils/http'
import { AiSparklesIcon } from './AiSparklesIcon'
import { InfoBubble } from './create/InfoBubble'
import { Modal } from './Modal'

type AdaptTarget = {
  key: string
  title: string
  description: string
  targetType: string
  mode?: string
  route: string
  icon: LucideIcon
  /** Los destinos con el mismo `group` se muestran como UN solo juego con variantes (Memoria: parejas/opuestos). */
  group?: string
  groupTitle?: string
  /** Nombre de la variante dentro de su grupo. */
  variantLabel?: string
}

/** Un juego tal como lo ve el usuario: uno o varios destinos (variantes) detrás. */
type TargetGroup = {
  key: string
  title: string
  description: string
  icon: LucideIcon
  variants: AdaptTarget[]
}

const TARGETS: AdaptTarget[] = [
  {
    key: 'DOMINO',
    title: 'Dominó',
    description: 'Cada mitad de ficha es un concepto del tema.',
    targetType: 'DOMINO',
    route: '/juegos/crear/domino',
    icon: Puzzle,
  },
  {
    key: 'MAZE_COLLECTOR',
    title: 'Recolector de laberinto',
    description: 'Recolecta los conceptos del tema esquivando enemigos.',
    targetType: 'MAZE_COLLECTOR',
    route: '/juegos/crear/laberinto',
    icon: Ghost,
  },
  {
    key: 'SNAKES_LADDERS',
    title: 'Escaleras y Serpientes',
    description: 'El avance depende de responder preguntas del tema.',
    targetType: 'SNAKES_LADDERS',
    route: '/juegos/crear/escaleras-serpientes',
    icon: Dices,
  },
  {
    key: 'GUESS_WHO',
    title: '¿Quién Es?',
    description: 'Adivina la tarjeta secreta del otro jugador.',
    targetType: 'GUESS_WHO',
    route: '/juegos/crear/quien-es',
    icon: UserRoundSearch,
  },
  {
    key: 'PAIRS',
    title: 'Memoria: parejas',
    description: 'Une cada imagen con su concepto.',
    targetType: 'MEMORY_MATCH',
    mode: 'PAIRS',
    route: '/juegos/crear/cartas/parejas',
    icon: Layers,
    group: 'MEMORY',
    groupTitle: 'Memoria',
    variantLabel: 'Parejas',
  },
  {
    key: 'OPPOSITES',
    title: 'Memoria: opuestos',
    description: 'Une cada concepto con su opuesto.',
    targetType: 'MEMORY_MATCH',
    mode: 'OPPOSITES',
    route: '/juegos/crear/cartas/opuestos',
    icon: Layers,
    group: 'MEMORY',
    groupTitle: 'Memoria',
    variantLabel: 'Opuestos',
  },
  {
    key: 'DUAL_QUEST',
    title: 'Dúo Lógico',
    description: 'Dos personajes resuelven retos del tema en cooperación.',
    targetType: 'DUAL_QUEST',
    route: '/juegos/crear/dual-quest',
    icon: Flame,
  },
]

type AdaptGameModalProps = {
  game: GameDetail
  onClose: () => void
}

function isSameTarget(game: GameDetail, target: AdaptTarget): boolean {
  if (game.gameType !== target.targetType) return false
  if (game.gameType !== 'MEMORY_MATCH') return true
  return (game.config as { mode?: string }).mode === target.mode
}

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--accent), var(--accent-2))'

const INFO_TEXT =
  'Crea un juego nuevo con el mismo tema en otro tipo de juego. Elige cómo armarlo: rápido sin IA (gratis, menos preciso) o con IA (más preciso, consume cuota). Lo revisas antes de guardar y el original no cambia.'

/** Agrupa los destinos por juego: Memoria (parejas/opuestos) es UN solo juego con dos modos. */
function buildGroups(game: GameDetail): TargetGroup[] {
  const groups: TargetGroup[] = []
  for (const target of TARGETS) {
    if (isSameTarget(game, target)) continue
    const key = target.group ?? target.key
    const existing = groups.find((group) => group.key === key)
    if (existing) {
      existing.variants.push(target)
    } else {
      groups.push({
        key,
        title: target.groupTitle ?? target.title,
        description: target.description,
        icon: target.icon,
        variants: [target],
      })
    }
  }
  return groups
}

/**
 * Convierte el tema de un juego a otro tipo de juego (issues #8 y #50). Tres
 * caminos: rápida sin IA (algoritmo), con IA, o formulario vacío a mano. El
 * borrador viaja por `location.state` al formulario del tipo elegido, que lo
 * aplica con las mismas funciones del asistente de IA. Nada se guarda hasta
 * que el usuario crea el juego nuevo desde ese formulario.
 *
 * Elegir un tipo no gasta nada: la llamada al servidor (y la IA) ocurre solo
 * al elegir el camino. Los tipos de juego inactivos (archivados) aparecen
 * deshabilitados; el servidor los rechaza igual, antes de gastar IA.
 */
export function AdaptGameModal({ game, onClose }: AdaptGameModalProps) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [group, setGroup] = useState<TargetGroup | null>(null)
  const [variantKey, setVariantKey] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [pendingEngine, setPendingEngine] = useState<AdaptationEngine | null>(null)
  // `null` mientras carga. Si falla, se asume solo IA (el servidor valida igual).
  const [options, setOptions] = useState<AdaptationOptions | null>(null)
  const [error, setError] = useState<string | null>(null)
  // `null` mientras carga o si la consulta falla: en ese caso no se bloquea
  // nada en pantalla y la validación definitiva la hace el servidor.
  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    listAllGameTypeSettings(token)
      .then((settings) => {
        if (cancelled) return
        setActiveTypes(new Set(settings.filter((s) => !s.isArchived).map((s) => s.gameType)))
      })
      .catch(() => {})
    getAdaptationOptions(token, game.id)
      .then((result) => {
        if (!cancelled) setOptions(result)
      })
      .catch(() => {
        if (!cancelled) setOptions({ aiAvailable: true, algorithmTargets: [], sourceHasConcepts: true })
      })
    return () => {
      cancelled = true
    }
  }, [token, game.id])

  function isUnavailable(target: AdaptTarget): boolean {
    return activeTypes !== null && !activeTypes.has(target.targetType)
  }

  function isGroupUnavailable(candidate: TargetGroup): boolean {
    return candidate.variants.every(isUnavailable)
  }

  function openGroup(candidate: TargetGroup) {
    setError(null)
    setGroup(candidate)
    // Con una sola variante disponible no hay nada que elegir.
    const open = candidate.variants.filter((variant) => !isUnavailable(variant))
    setVariantKey(open.length === 1 ? open[0].key : null)
  }

  function backToTypes() {
    setError(null)
    setGroup(null)
    setVariantKey(null)
  }

  async function handleAdapt(target: AdaptTarget, engine: AdaptationEngine) {
    if (!token || pendingKey) return
    setPendingKey(target.key)
    setPendingEngine(engine)
    setError(null)
    try {
      const adaptation = await adaptGame(token, game.id, {
        engine,
        targetType: target.targetType,
        mode: target.mode,
      })
      navigate(target.route, { state: { adaptation } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo adaptar el juego.')
      setPendingKey(null)
      setPendingEngine(null)
    }
  }

  const busy = pendingKey !== null
  const groups = buildGroups(game)
  const availableVariants = group?.variants.filter((variant) => !isUnavailable(variant)) ?? []
  const selected = availableVariants.find((variant) => variant.key === variantKey) ?? null
  const GroupIcon = group?.icon

  return (
    <Modal
      onClose={busy ? () => {} : onClose}
      maxWidthClassName="max-w-[560px]"
      ariaLabelledBy="adapt-game-title"
    >
      <div className="relative">
        <div className="flex items-center gap-3 pr-10">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
            style={{ background: ACCENT_GRADIENT }}
          >
            <AiSparklesIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="adapt-game-title" className="text-[18px] font-semibold leading-tight text-text-h">
              Convertir a otro tipo de juego
            </h2>
            <p className="truncate text-[12.5px] text-text">«{game.title}»</p>
          </div>
        </div>
        <InfoBubble placement="corner" label="Ayuda: convertir a otro tipo de juego" text={INFO_TEXT} />
      </div>

      {group === null || GroupIcon === undefined ? (
        <div key="types" className="adapt-step">
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-text">
            ¿A qué tipo de juego?
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {groups.map((item, index) => {
              const Icon = item.icon
              const unavailable = isGroupUnavailable(item)
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={unavailable}
                  title={unavailable ? 'Este tipo de juego está inactivo por ahora.' : item.description}
                  style={{ '--adapt-i': index } as React.CSSProperties}
                  className="adapt-option group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-4 text-center shadow-[var(--shadow)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:bg-surface"
                  onClick={() => openGroup(item)}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform duration-200 group-hover:scale-110 group-disabled:scale-100">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="text-[13.5px] font-semibold leading-tight text-text-h">{item.title}</span>
                  {unavailable && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-text">
                      Inactivo
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {groups.some(isGroupUnavailable) && (
            <p className="mt-3 flex items-start gap-2 text-[12px] leading-snug text-text">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.2} />
              Los tipos marcados como «Inactivo» están desactivados por el momento y no se pueden elegir.
            </p>
          )}
        </div>
      ) : (
        <div key="engines" className="adapt-step">
          <button
            type="button"
            disabled={busy}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 px-3.5 py-1.5 text-[13px] font-semibold text-accent transition-colors hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            onClick={backToTypes}
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.6} />
            Cambiar tipo de juego
          </button>

          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <GroupIcon className="h-5 w-5" strokeWidth={2} />
            </span>
            <p className="text-[16px] font-semibold text-text-h">{group.title}</p>
          </div>

          {availableVariants.length > 1 && (
            <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Variante del juego">
              {availableVariants.map((variant) => (
                <button
                  key={variant.key}
                  type="button"
                  role="radio"
                  aria-checked={variant.key === variantKey}
                  disabled={busy}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    variant.key === variantKey
                      ? 'border-accent bg-accent text-white shadow-sm'
                      : 'border-border text-text-h hover:border-accent/60'
                  }`}
                  onClick={() => setVariantKey(variant.key)}
                >
                  {variant.variantLabel ?? variant.title}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const key = selected
              ? selected.mode
                ? `${selected.targetType}:${selected.mode}`
                : selected.targetType
              : null
            const loading = options === null
            const algorithmAvailable = key !== null && (options?.algorithmTargets.includes(key) ?? false)
            const needsVariant = selected === null
            const cards: Array<{
              id: string
              label: string
              hint: string
              icon: React.ReactNode
              disabled: boolean
              accent?: boolean
              onClick: () => void
            }> = [
              {
                id: 'ALGORITHM',
                label: 'Rápida',
                hint: !loading && !needsVariant && !algorithmAvailable ? 'Solo con IA' : 'Sin IA · gratis',
                icon:
                  pendingEngine === 'ALGORITHM' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Zap className="h-5 w-5" strokeWidth={2.2} />
                  ),
                disabled: busy || loading || needsVariant || !algorithmAvailable,
                onClick: () => selected && void handleAdapt(selected, 'ALGORITHM'),
              },
              {
                id: 'AI',
                label: 'Con IA',
                hint: options?.aiAvailable === false ? 'No disponible en tu plan' : 'Más precisa',
                icon:
                  pendingEngine === 'AI' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <AiSparklesIcon className="h-5 w-5" />
                  ),
                disabled: busy || loading || needsVariant || options?.aiAvailable === false,
                accent: true,
                onClick: () => selected && void handleAdapt(selected, 'AI'),
              },
            ]

            // Por qué algo está deshabilitado, dicho con claridad: un botón
            // apagado sin explicación deja al usuario sin saber qué hacer.
            let notice: string | null = null
            if (needsVariant) {
              notice = `Elige ${availableVariants.map((variant) => variant.variantLabel ?? variant.title).join(' u ')} para continuar.`
            } else if (!loading && !algorithmAvailable) {
              const name = selected?.variantLabel ? `${group.title}: ${selected.variantLabel}` : group.title
              notice =
                options?.sourceHasConcepts === false
                  ? 'La opción Rápida no está disponible: este juego es de preguntas y no tiene conceptos que reacomodar. Usa «Con IA».'
                  : `La opción Rápida no está disponible para «${name}»: necesita contenido nuevo (como el opuesto de cada concepto o preguntas redactadas). Usa «Con IA».`
            }
            if (!loading && options?.aiAvailable === false) {
              notice = `${notice ? `${notice} ` : ''}La IA no está disponible en tu plan.`
            }

            return (
              <>
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {cards.map((card, index) => (
                  <button
                    key={card.id}
                    type="button"
                    disabled={card.disabled}
                    style={
                      {
                        '--adapt-i': index,
                        ...(card.accent ? { background: ACCENT_GRADIENT } : {}),
                      } as React.CSSProperties
                    }
                    className={`adapt-option flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:translate-y-0 ${
                      card.accent
                        ? 'border-transparent text-white shadow-md'
                        : 'border-border bg-surface text-text-h shadow-[var(--shadow)] hover:border-accent hover:bg-accent/5'
                    }`}
                    onClick={card.onClick}
                  >
                    <span className={card.accent ? 'text-white' : 'text-accent'}>{card.icon}</span>
                    <span className="text-[14px] font-semibold leading-tight">{card.label}</span>
                    <span className={`text-[11.5px] leading-tight ${card.accent ? 'text-white/85' : 'text-text'}`}>
                      {card.hint}
                    </span>
                  </button>
                ))}
              </div>
              {notice && (
                <p
                  role="status"
                  className="adapt-option mt-3 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5 text-[12.5px] leading-snug text-text-h"
                  style={{ '--adapt-i': 3 } as React.CSSProperties}
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
                  <span>{notice}</span>
                </p>
              )}
              </>
            )
          })()}
        </div>
      )}

      {busy && (
        <p className="mt-3 text-[12.5px] text-text" role="status">
          {pendingEngine === 'AI'
            ? 'Armando el borrador con IA… puede tardar unos segundos.'
            : 'Adaptando los conceptos…'}
        </p>
      )}
      {error && (
        <p className="mt-3 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end border-t border-border pt-4">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-border bg-surface px-5 py-2 text-[13.5px] font-semibold text-text-h shadow-[var(--shadow)] transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onClose}
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
