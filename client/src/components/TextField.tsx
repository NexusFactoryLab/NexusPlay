import { useContext, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { FieldAssistContext, identityFeedback, identityKind } from './home/games/create/fieldAssist'

type TextFieldProps = {
  label: string
  type: 'text' | 'email' | 'password' | 'date'
  value: string
  error?: string
  autoComplete?: string
  placeholder?: string
  /** Ayuda corta (una frase) bajo el campo; se oculta si hay error. */
  hint?: string
  disabled?: boolean
  autoFocus?: boolean
  /** Solo relevante para type="date": acota el selector de calendario. */
  min?: string
  max?: string
  onChange: (value: string) => void
  onBlur: (value: string) => void
  /** Contenido opcional al final del campo, p. ej. mostrar/ocultar clave. */
  action?: ReactNode
}

export function TextField({
  label,
  type,
  value,
  error,
  autoComplete,
  placeholder,
  hint,
  disabled,
  autoFocus,
  min,
  max,
  onChange,
  onBlur,
  action,
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  // Ayuda del flujo de creación (solo dentro de GameFormShell): ejemplo editable
  // para título/descripción y mensaje amable al salir del campo.
  const assist = useContext(FieldAssistContext)
  const kind = assist ? identityKind(label) : null
  const example = kind && assist ? assist.examples[kind] : undefined
  const [touched, setTouched] = useState(false)
  const feedback = kind && touched && !error ? identityFeedback(kind, value) : null
  const shownPlaceholder = placeholder ?? (example ? `Ej. ${example}` : undefined)

  return (
    <div className="nx-field flex flex-col gap-[7px]" data-nx-field>
      <label className="nx-label text-sm font-medium text-text-h" htmlFor={id}>
        {label}
      </label>
      <div
        className={`nx-input flex items-center rounded-lg border bg-bg transition-[border-color,box-shadow] ${
          error
            ? 'border-danger focus-within:ring-3 focus-within:ring-danger/15'
            : 'border-border focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/10'
        }`}
      >
        <input
          id={id}
          type={type}
          value={value}
          placeholder={shownPlaceholder}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          min={min}
          max={max}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            setTouched(true)
            onBlur(event.target.value)
          }}
          className="min-w-0 flex-1 bg-transparent px-[13px] py-[11px] text-[15px] leading-normal text-text-h placeholder:text-text/75 outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        {action}
      </div>
      {example && !disabled && value.trim().length === 0 && (
        <button
          type="button"
          className="nx-example-btn self-start rounded-md px-1 py-0.5 text-[12px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => onChange(example)}
        >
          Usar ejemplo
        </button>
      )}
      {feedback && (
        <p
          role="status"
          className={`nx-feedback text-[12px] leading-snug ${feedback.tone === 'ok' ? 'font-medium text-accent' : 'text-text'}`}
        >
          {feedback.text}
        </p>
      )}
      {hint && !error && !feedback && <p className="nx-hint text-[12px] leading-snug text-text">{hint}</p>}
      {error && (
        <p className="nx-error text-[13px] leading-tight text-danger" id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}
