import type { GuessWhoTrait } from './guessWhoTypes'

/**
 * Preguntas guiadas de ¿Quién Es? en el formulario (issue #58). El juego
 * guarda en cada tarjeta sus rasgos completos (`{ id, question }`); el
 * formulario los edita como un catálogo de preguntas más, en cada tarjeta,
 * los ids para los que la respuesta es «Sí». Así una pregunta se escribe una
 * sola vez y quitar una tarjeta se lleva sus marcas.
 */

/** Mismos topes que el validador del servidor: una tarjeta tiene como mucho 12 rasgos. */
export const MAX_TRAITS = 12
export const MAX_TRAIT_QUESTION_LENGTH = 140

/** Texto de la pregunta que el juego usa cuando no hay rasgos (ver guided-questions.ts del servidor). */
export const FALLBACK_QUESTION = '¿Tu tarjeta está en este grupo?'

type WithTraits = { traits?: unknown }

/** Catálogo de preguntas a partir de los rasgos de las tarjetas (de un borrador de IA o de un juego adaptado). */
export function traitCatalogFromCards(cards: WithTraits[]): GuessWhoTrait[] {
  const catalog = new Map<string, string>()
  for (const card of cards) {
    for (const trait of readTraits(card.traits)) {
      if (!catalog.has(trait.id)) catalog.set(trait.id, trait.question)
    }
  }
  return [...catalog].slice(0, MAX_TRAITS).map(([id, question]) => ({ id, question }))
}

/** Ids de los rasgos de una tarjeta que están en el catálogo. */
export function traitIdsOf(card: WithTraits, catalog: GuessWhoTrait[]): string[] {
  const known = new Set(catalog.map((trait) => trait.id))
  return [...new Set(readTraits(card.traits).map((trait) => trait.id))].filter((id) => known.has(id))
}

/**
 * Rasgos que se guardan en una tarjeta. Sin preguntas, `undefined`: la
 * tarjeta queda sin clasificar y el juego usa la pregunta del grupo. Con
 * preguntas, TODA tarjeta lleva su lista (vacía si responde «No» a todas):
 * el servidor solo usa los rasgos si todas las tarjetas están clasificadas.
 */
export function traitsForCard(traitIds: string[], catalog: GuessWhoTrait[]): GuessWhoTrait[] | undefined {
  if (catalog.length === 0) return undefined
  return catalog
    .filter((trait) => traitIds.includes(trait.id))
    .map((trait) => ({ id: trait.id, question: formatQuestion(trait.question) }))
}

/** "es un país de europa" -> "¿es un país de europa?": los signos se agregan solos si faltan. */
export function formatQuestion(text: string): string {
  const body = text.trim().replace(/^¿+/, '').replace(/\?+$/, '').trim()
  return body ? `¿${body}?` : ''
}

/** Id nuevo que no choca con los del catálogo (los de la IA son palabras: "europa", "habla-espanol"). */
export function newTraitId(catalog: GuessWhoTrait[]): string {
  const taken = new Set(catalog.map((trait) => trait.id))
  let n = catalog.length + 1
  while (taken.has(`pregunta-${n}`)) n += 1
  return `pregunta-${n}`
}

/** Error de la fase de preguntas, o null si todas sirven. `cardTraitIds[i]` son los ids marcados en la tarjeta i. */
export function validateTraits(catalog: GuessWhoTrait[], cardTraitIds: string[][]): string | null {
  for (const [index, trait] of catalog.entries()) {
    const question = formatQuestion(trait.question)
    const name = question || `la pregunta ${index + 1}`
    if (!question) return `Escribe el texto de la pregunta ${index + 1} o quítala.`
    if (question.length > MAX_TRAIT_QUESTION_LENGTH) {
      return `La pregunta ${index + 1} es muy larga (máximo ${MAX_TRAIT_QUESTION_LENGTH} caracteres).`
    }
    const yes = cardTraitIds.filter((ids) => ids.includes(trait.id)).length
    if (yes === 0 || yes === cardTraitIds.length) {
      return `${name} no separa ninguna tarjeta: márcala en algunas tarjetas, pero no en todas.`
    }
  }
  return null
}

function readTraits(raw: unknown): GuessWhoTrait[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const trait = (item ?? {}) as Record<string, unknown>
    return typeof trait.id === 'string' && trait.id.trim() && typeof trait.question === 'string' && trait.question.trim()
      ? [{ id: trait.id.trim(), question: trait.question.trim() }]
      : []
  })
}
