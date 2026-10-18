import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { InfoBubble } from './InfoBubble'

type FormSectionProps = {
  icon: LucideIcon
  title: string
  /** Una línea que explica para qué sirve esta sección. */
  subtitle?: string
  /** Contenido de la sección. Por defecto se apila con espacio generoso. */
  children: ReactNode
  /** Cambia el color del ícono (se alterna entre la paleta del formulario). */
  tone?: 1 | 2 | 3 | 4
  /** Sin fondo de tarjeta: solo el encabezado (para listas cuyos elementos ya son tarjetas). */
  bare?: boolean
  className?: string
  /** Explicación de la sección: aparece en una burbuja (i) en la esquina de la tarjeta. */
  info?: string
}

/**
 * Tarjeta con encabezado (ícono + título + subtítulo) que agrupa los campos
 * de una fase de los formularios de creación. Usa clases `nx-*` propias (no
 * las combinaciones `rounded border-border` que los temas Fantasía/Pradera
 * reescriben), así que se ve bien en todos los temas y en claro/oscuro.
 */
export function FormSection({ icon: Icon, title, subtitle, children, tone = 1, bare = false, className = '', info }: FormSectionProps) {
  return (
    <section className={`nx-card ${bare ? 'nx-card-bare' : ''} ${className}`} data-tone={tone}>
      {info && <InfoBubble placement="corner" label={`Ayuda: ${title}`} text={info} />}
      <header className="nx-card-head">
        <span className="nx-card-icon" aria-hidden="true">
          <Icon className="h-[19px] w-[19px]" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h3 className="nx-card-title">{title}</h3>
          {subtitle && <p className="nx-card-sub">{subtitle}</p>}
        </div>
      </header>
      <div className="nx-card-body">{children}</div>
    </section>
  )
}

/** Cabecera de fase: "Fase 2 de 3" + nombre, como una pastilla con puntos de avance. */
export function PhaseLabel({ phase, total, label }: { phase: number; total: number; label: string }) {
  return (
    <p className="nx-phase" aria-label={`Fase ${phase} de ${total}: ${label}`}>
      <span className="nx-phase-dots" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <i key={index} data-on={index < phase} />
        ))}
      </span>
      <span>
        Fase {phase} de {total}
      </span>
      <span className="nx-phase-name">· {label}</span>
    </p>
  )
}
