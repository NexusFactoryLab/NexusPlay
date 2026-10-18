/**
 * Interruptor «Descarte automático» de ¿Quién Es? (issue #64). Activado, la
 * respuesta a una pregunta descarta sola las tarjetas que no coinciden;
 * desactivado, cada jugador decide qué descartar con lo que sabe del tema.
 * Lo usan el lobby de la sala (solo lo cambia el anfitrión) y la elección de
 * partida contra el bot.
 */
export function AutoDiscardToggle({
  enabled,
  onChange,
  disabled = false,
  readOnlyNote,
}: {
  enabled: boolean
  /** Sin `onChange` se muestra solo como información (ej. jugadores que no son anfitriones). */
  onChange?: (enabled: boolean) => void
  disabled?: boolean
  readOnlyNote?: string
}) {
  const editable = Boolean(onChange)
  return (
    <div className="rounded-[22px] border border-border bg-surface p-4 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3">
        <span id="auto-discard-label" className="text-[13px] font-medium text-text-h">
          Descarte automático
        </span>
        {editable ? (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby="auto-discard-label"
            disabled={disabled}
            onClick={() => onChange?.(!enabled)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${enabled ? 'bg-accent' : 'bg-border'}`}
          >
            <span
              className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`}
            />
          </button>
        ) : (
          <strong className="text-[13px] text-text-h">{enabled ? 'Activado' : 'Desactivado'}</strong>
        )}
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-text">
        {enabled
          ? 'Al responder una pregunta, el juego descarta solo las tarjetas que no coinciden.'
          : 'Tú decides qué tarjetas descartar con lo que sabes del tema: más reto y se aprende más.'}
      </p>
      {!editable && readOnlyNote && <p className="mt-1 text-[11.5px] text-text">{readOnlyNote}</p>}
    </div>
  )
}
