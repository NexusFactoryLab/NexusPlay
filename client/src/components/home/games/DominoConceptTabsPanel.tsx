import { AlertTriangle, Check, CheckCircle2, Palette, type LucideIcon } from 'lucide-react'
import { TextField } from '../../TextField'
import { IconPickerField } from './IconPickerField'
import { DominoLevelQuestions } from './DominoLevelQuestions'
import { DOMINO_ICON_LABELS } from './dominoTypes'
import { DOMINO_LEVEL_INFO } from './dominoLevels'
import { reviewStatusOf } from './dominoReview'
import { conceptLevelWarnings } from './dominoLevelsDraft'
import { CONCEPT_TABS, tabForWarning, tabHint, tabStatus, type ConceptTab } from './dominoConceptTabs'
import { DOMINO_LIMITS, type ConceptDraft } from './dominoContentDraft'

const fieldClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-[16px] leading-snug text-text-h outline-none transition-colors focus:border-accent disabled:opacity-60'
const labelClass = 'mb-1.5 block text-[16px] font-medium text-text-h'
const helpClass = 'mt-1 text-[16px] leading-snug text-text'

type TabMeta = { label: string; icon: LucideIcon; color: string }
const TAB_META: Record<ConceptTab, TabMeta> = {
  CONCEPT: { label: 'Concepto', icon: Palette, color: 'var(--accent)' },
  EASY: { label: DOMINO_LEVEL_INFO.EASY.label, icon: DOMINO_LEVEL_INFO.EASY.icon, color: DOMINO_LEVEL_INFO.EASY.color },
  MEDIUM: { label: DOMINO_LEVEL_INFO.MEDIUM.label, icon: DOMINO_LEVEL_INFO.MEDIUM.icon, color: DOMINO_LEVEL_INFO.MEDIUM.color },
  ADVANCED: { label: DOMINO_LEVEL_INFO.ADVANCED.label, icon: DOMINO_LEVEL_INFO.ADVANCED.icon, color: DOMINO_LEVEL_INFO.ADVANCED.color },
}

type Props = {
  concept: ConceptDraft
  index: number
  disabled?: boolean
  /** Pestaña abierta; la controla el formulario para que resumen y avisos puedan abrir una concreta. */
  tab: ConceptTab
  onTabChange: (tab: ConceptTab) => void
  /** Cualquier edición del profesor; el formulario decide si cuenta como revisión. */
  onChange: (next: ConceptDraft) => void
  /** "Marcar como revisado" sin editar nada. */
  onApprove: () => void
}

/**
 * Panel del concepto con una pestaña POR NIVEL, cada una distinta:
 * Concepto (nombre, ícono, color, definición) · Fácil (ejemplo, sin preguntas) ·
 * Intermedio (solo preguntas) · Universitario (caso de aplicación + preguntas).
 * Cada pestaña lleva su color/ícono y un punto de estado (completa o falta algo).
 */
export function DominoConceptTabsPanel({ concept, index, disabled, tab, onTabChange, onChange, onApprove }: Props) {
  const status = reviewStatusOf(concept)
  const allWarnings = [...new Set([...(concept.aiWarnings ?? []), ...conceptLevelWarnings(concept)])]

  return (
    <div className="flex flex-col gap-3">
      {status !== 'none' && (
        <div
          className="flex flex-col gap-2 rounded-2xl border border-border p-3"
          style={{
            background:
              status === 'pending' ? 'color-mix(in srgb, #f59e0b 14%, var(--surface))' : 'color-mix(in srgb, var(--nx-ok) 12%, var(--surface))',
          }}
          role="region"
          aria-label="Revisión de IA"
        >
          <div className="flex flex-wrap items-center gap-3">
            {status === 'pending' ? <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />}
            <p className="min-w-0 flex-1 text-[16px] font-semibold leading-snug text-text-h">
              Revisión de IA · {status === 'pending' ? 'revisa este concepto antes de publicar' : 'revisado'}
            </p>
            {status === 'pending' && (
              <button
                type="button"
                onClick={onApprove}
                disabled={disabled}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-[16px] font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:active:scale-100"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              >
                <Check className="h-5 w-5" aria-hidden="true" />
                Marcar como revisado
              </button>
            )}
          </div>
          {allWarnings.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Advertencias automáticas">
              {allWarnings.map((warning) => {
                const target = tabForWarning(warning)
                return (
                  <li key={warning}>
                    <button
                      type="button"
                      onClick={() => onTabChange(target)}
                      title={`Abrir ${TAB_META[target].label}`}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[16px] font-medium text-text-h transition-colors duration-200 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
                      style={{ background: 'color-mix(in srgb, #f59e0b 30%, var(--surface))' }}
                    >
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      {warning}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <div role="tablist" aria-label="Secciones del concepto" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CONCEPT_TABS.map((key) => {
          const { label, icon: Icon, color } = TAB_META[key]
          const active = tab === key
          const ok = tabStatus(concept, key) === 'ok'
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`domino-tab-${key}-${index}`}
              aria-selected={active}
              aria-controls={`domino-tabpanel-${index}`}
              onClick={() => onTabChange(key)}
              className="relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-2 py-2 text-[16px] font-bold text-text-h transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
              style={{
                borderColor: active ? color : 'var(--border)',
                background: active ? `color-mix(in srgb, ${color} 16%, var(--surface))` : 'var(--surface)',
                boxShadow: active ? `0 2px 0 ${color}` : undefined,
              }}
            >
              <Icon className="h-6 w-6" style={{ color }} strokeWidth={2.2} aria-hidden="true" />
              {label}
              <span
                className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
                role="img"
                aria-label={ok ? 'Completo' : 'Falta algo'}
              >
                {ok ? <Check className="h-3 w-3" strokeWidth={4} /> : <span className="text-[12px] font-black leading-none">!</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div
        key={tab}
        role="tabpanel"
        id={`domino-tabpanel-${index}`}
        aria-labelledby={`domino-tab-${tab}-${index}`}
        className="flex animate-[fade-in-up_0.25s_ease-out] flex-col gap-3 motion-reduce:animate-none"
      >
        {tabStatus(concept, tab) === 'warn' && tab !== 'CONCEPT' && (
          <p className="text-[16px] font-medium text-text-h" role="status">
            ⚠ {tabHint(concept, tab)}
          </p>
        )}

        {tab === 'CONCEPT' && (
          <div className="flex flex-col gap-3">
            <TextField
              label="Nombre"
              type="text"
              value={concept.label}
              disabled={disabled}
              onChange={(value) => onChange({ ...concept, label: value })}
              onBlur={() => {}}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor={`concept-icon-${index}`}>Ícono</label>
                <IconPickerField id={`concept-icon-${index}`} value={concept.icon} labels={DOMINO_ICON_LABELS} disabled={disabled} onChange={(key) => onChange({ ...concept, icon: key })} />
              </div>
              <div>
                <label className={labelClass} htmlFor={`concept-color-${index}`}>Color</label>
                <input
                  id={`concept-color-${index}`}
                  type="color"
                  className="h-[44px] w-full cursor-pointer rounded-lg border border-border bg-bg px-2 py-1.5 outline-none focus:border-accent"
                  value={concept.color}
                  disabled={disabled}
                  onChange={(event) => onChange({ ...concept, color: event.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor={`domino-definition-${index}`}>Qué es (definición)</label>
              <textarea id={`domino-definition-${index}`} rows={2} maxLength={DOMINO_LIMITS.definition} className={fieldClass} disabled={disabled}
                value={concept.definition} onChange={(e) => onChange({ ...concept, definition: e.target.value })} />
              <p className={helpClass}>Una frase que explica el concepto. Se ve en la nubecita de la ficha y como retroalimentación al colocarla.</p>
            </div>
          </div>
        )}

        {tab === 'EASY' && (
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor={`domino-example-${index}`}>Ejemplo cotidiano</label>
            <textarea id={`domino-example-${index}`} rows={3} maxLength={DOMINO_LIMITS.example} className={fieldClass} disabled={disabled}
              value={concept.example} onChange={(e) => onChange({ ...concept, example: e.target.value })} />
            <p className={helpClass}>Pensado para niños. Sale en la nubecita del nivel Fácil, donde no se hacen preguntas.</p>
          </div>
        )}

        {tab === 'MEDIUM' && (
          <>
            <p className={helpClass.replace('mt-1 ', '')}>En Intermedio solo hay preguntas: el jugador responde una antes de colocar la ficha.</p>
            <DominoLevelQuestions concept={concept} index={index} level="MEDIUM" disabled={disabled} onChange={onChange} />
          </>
        )}

        {tab === 'ADVANCED' && (
          <>
            <div
              className="flex flex-col gap-1 rounded-2xl border-2 p-4"
              style={{ borderColor: DOMINO_LEVEL_INFO.ADVANCED.color, background: `color-mix(in srgb, ${DOMINO_LEVEL_INFO.ADVANCED.color} 8%, var(--surface))` }}
            >
              <label className="text-[18px] font-bold text-text-h" htmlFor={`domino-application-${index}`}>
                Caso de aplicación <span className="text-[16px] font-semibold" style={{ color: DOMINO_LEVEL_INFO.ADVANCED.color }}>(obligatorio para ofrecer este nivel)</span>
              </label>
              <textarea id={`domino-application-${index}`} rows={5} maxLength={DOMINO_LIMITS.application} className={fieldClass} disabled={disabled}
                placeholder="Ej.: Una escuela rural sin red eléctrica necesita iluminar sus aulas durante el día…"
                value={concept.application} onChange={(e) => onChange({ ...concept, application: e.target.value })} />
              <p className={helpClass}>
                Una situación real donde se aplica el concepto. En Universitario el jugador lee el caso y luego responde la pregunta.
              </p>
            </div>
            <DominoLevelQuestions concept={concept} index={index} level="ADVANCED" disabled={disabled} onChange={onChange} />
          </>
        )}
      </div>
    </div>
  )
}
