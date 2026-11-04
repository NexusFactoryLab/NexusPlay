import { useId } from 'react'
import {
  INSTITUTION_TYPES,
  INSTITUTION_TYPE_LABELS,
  isInstitutionType,
  type InstitutionType,
} from '../../services/organization.service'

/** Valor del `<select>` para «Sin clasificar» (null). */
const UNCLASSIFIED = ''

type InstitutionTypeSelectProps = {
  value: InstitutionType | null
  onChange: (value: InstitutionType | null) => void
  disabled?: boolean
  /** `compact` para el encabezado de la institución; `field` (por defecto) para formularios. */
  size?: 'field' | 'compact'
  /** Ayuda bajo el campo (solo en `field`). */
  hint?: string
}

/**
 * Selector «Tipo de institución» (Universidad / Colegio / Otro / Sin
 * clasificar). Lo usan el formulario de crear organización y el encabezado de
 * la institución, donde quien la administra puede cambiarlo. El tipo se
 * muestra en el ranking público de la página de inicio.
 */
export function InstitutionTypeSelect({
  value,
  onChange,
  disabled,
  size = 'field',
  hint,
}: InstitutionTypeSelectProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const compact = size === 'compact'

  return (
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-1.5'}>
      <label
        htmlFor={id}
        className={compact ? 'text-[12.5px] font-medium text-text' : 'text-[13px] font-medium text-text-h'}
      >
        Tipo de institución
      </label>
      <select
        id={id}
        value={value ?? UNCLASSIFIED}
        disabled={disabled}
        aria-describedby={hint && !compact ? hintId : undefined}
        onChange={(event) => {
          const next = event.target.value
          onChange(isInstitutionType(next) ? next : null)
        }}
        className={`rounded-lg border border-border bg-bg text-text-h outline-none focus:border-accent focus-visible:ring-3 focus-visible:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'px-2.5 py-1.5 text-[12.5px]' : 'px-3.5 py-2.5 text-[14px]'
        }`}
      >
        {INSTITUTION_TYPES.map((type) => (
          <option key={type} value={type}>
            {INSTITUTION_TYPE_LABELS[type]}
          </option>
        ))}
        <option value={UNCLASSIFIED}>Sin clasificar</option>
      </select>
      {hint && !compact && (
        <span id={hintId} className="text-[12px] text-text">
          {hint}
        </span>
      )}
    </div>
  )
}
