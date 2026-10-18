import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

type FormFieldProps = {
  label: string
  /** Id del control, para asociar la etiqueta. Sin él se usa un <p>. */
  htmlFor?: string
  /** Ayuda corta (una frase) bajo el campo. */
  hint?: string
  /** Explicación más larga, solo en el tooltip del icono (i). */
  tooltip?: string
  error?: string
  children: ReactNode
}

/**
 * Campo común de los formularios de creación: etiqueta, ayuda corta con
 * tooltip opcional y error. El shell (GameFormShell) lee `data-nx-field` para
 * marcar campos pendientes/inválidos sin que cada formulario lo implemente.
 */
export function FormField({ label, htmlFor, hint, tooltip, error, children }: FormFieldProps) {
  const LabelTag = htmlFor ? 'label' : 'p'
  return (
    <div className="nx-field flex flex-col gap-1.5" data-nx-field>
      <div className="flex items-center gap-1.5">
        <LabelTag
          className="nx-label text-[13px] font-medium text-text-h"
          {...(htmlFor ? { htmlFor } : {})}
        >
          {label}
        </LabelTag>
        {tooltip && (
          <span title={tooltip} aria-label={tooltip} role="img" className="inline-flex text-text">
            <Info className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="nx-hint text-[12px] leading-snug text-text">{hint}</p>}
      {error && (
        <p className="nx-error text-[12.5px] leading-tight text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
