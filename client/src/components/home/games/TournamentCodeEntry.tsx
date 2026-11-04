import { useRef } from 'react'

const CODE_LENGTH = 6

type Props = {
  value: string
  onChange: (value: string) => void
  /** Se llama solo cuando el código está completo (también al pegarlo). */
  onComplete: (code: string) => void
  disabled?: boolean
  invalid?: boolean
}

/**
 * Código de sala en seis casillas grandes: se escribe o se pega de una vez,
 * pasa a mayúsculas solo y, al completarse, entra sin pedir otro clic. Un
 * único <input> real queda encima de las casillas, así el teclado del
 * celular, el pegado y los lectores de pantalla funcionan como siempre.
 */
export function TournamentCodeEntry({ value, onChange, onComplete, disabled = false, invalid = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(raw: string) {
    const next = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
    onChange(next)
    if (next.length === CODE_LENGTH) onComplete(next)
  }

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <div className="flex justify-center gap-2 sm:gap-2.5" aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const filled = index < value.length
          const current = index === Math.min(value.length, CODE_LENGTH - 1)
          return (
            <div
              key={index}
              className={`flex h-14 w-11 items-center justify-center rounded-xl border-2 bg-surface text-[26px] font-bold text-text-h transition-all duration-200 sm:h-16 sm:w-12 ${
                invalid
                  ? 'border-danger/60'
                  : filled
                    ? 'border-accent/60 shadow-[0_6px_16px_-10px_var(--accent)]'
                    : current && !disabled
                      ? 'border-accent'
                      : 'border-border'
              }`}
            >
              <span className={filled ? 'chip-pop' : undefined} key={value[index] ?? `empty-${index}`}>
                {value[index] ?? ''}
              </span>
            </div>
          )
        })}
      </div>
      <input
        ref={inputRef}
        autoFocus
        value={value}
        disabled={disabled}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Código del torneo (6 caracteres)"
        aria-invalid={invalid}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={CODE_LENGTH * 2}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
    </div>
  )
}
