import { Check } from 'lucide-react'
import type { GuessWhoTrait } from './guessWhoTypes'
import { FALLBACK_QUESTION, MAX_TRAITS, MAX_TRAIT_QUESTION_LENGTH } from './guessWhoTraits'

type EditorCard = { imageUrl: string | null; label: string; traitIds: string[] }

/**
 * Fase "Preguntas guiadas" del formulario de ¿Quién Es? (issue #58): cada
 * pregunta de Sí/No con las tarjetas que responden «Sí». Sirve para revisar
 * y corregir lo que propuso la IA (una marca equivocada haría que el juego
 * diera una respuesta falsa) y para escribir preguntas en un juego hecho a
 * mano.
 */
export function GuessWhoTraitsEditor({
  catalog,
  cards,
  disabled,
  onAdd,
  onRemove,
  onChangeQuestion,
  onToggleCard,
}: {
  catalog: GuessWhoTrait[]
  cards: EditorCard[]
  disabled: boolean
  onAdd: () => void
  onRemove: (traitId: string) => void
  onChangeQuestion: (traitId: string, question: string) => void
  onToggleCard: (cardIndex: number, traitId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 animate-[fade-in-up_0.25s_ease-out_backwards]">
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-[13px] leading-snug">
        <p className="font-semibold text-text-h">Preguntas de Sí/No de la partida</p>
        <p className="mt-1 text-text">
          Los jugadores eligen estas preguntas para descubrir la tarjeta del rival, y la respuesta descarta
          tarjetas sola. Escribe preguntas sobre el tema y marca las tarjetas para las que la respuesta es «Sí».
        </p>
        <p className="mt-1 text-text">Es opcional: sin preguntas, el juego propone «{FALLBACK_QUESTION}».</p>
      </div>

      {catalog.map((trait, index) => {
        const yes = cards.filter((card) => card.traitIds.includes(trait.id)).length
        return (
          <div key={trait.id} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[13px] font-semibold text-text-h" htmlFor={`trait-${trait.id}`}>
                Pregunta {index + 1}
              </label>
              <button
                type="button"
                className="text-[12px] font-medium text-danger"
                onClick={() => onRemove(trait.id)}
                disabled={disabled}
              >
                Quitar
              </button>
            </div>
            <input
              id={`trait-${trait.id}`}
              type="text"
              maxLength={MAX_TRAIT_QUESTION_LENGTH}
              className="w-full rounded-lg border border-border bg-bg px-[13px] py-[11px] text-[14px] text-text-h outline-none focus:border-accent"
              placeholder="¿Es un país de Europa?"
              value={trait.question}
              disabled={disabled}
              onChange={(event) => onChangeQuestion(trait.id, event.target.value)}
            />
            <p className="mt-2 text-[12px] text-text">
              Responden «Sí»: {yes} de {cards.length} tarjetas
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Tarjetas que responden «Sí» a la pregunta ${index + 1}`}>
              {cards.map((card, cardIndex) => {
                const checked = card.traitIds.includes(trait.id)
                return (
                  <li key={cardIndex}>
                    <button
                      type="button"
                      aria-pressed={checked}
                      disabled={disabled}
                      onClick={() => onToggleCard(cardIndex, trait.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                        checked ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-h hover:border-accent/60'
                      }`}
                    >
                      {card.imageUrl && <img src={card.imageUrl} alt="" className="h-5 w-5 rounded object-cover" />}
                      {card.label.trim() || `Tarjeta ${cardIndex + 1}`}
                      {checked && <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      <button
        type="button"
        className="self-start rounded-lg border border-dashed border-border px-3.5 py-2 text-[13px] font-medium text-text-h disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onAdd}
        disabled={disabled || catalog.length >= MAX_TRAITS}
      >
        + Agregar pregunta
      </button>
      {catalog.length >= MAX_TRAITS && <p className="text-[11.5px] text-text">Máximo {MAX_TRAITS} preguntas.</p>}
    </div>
  )
}
