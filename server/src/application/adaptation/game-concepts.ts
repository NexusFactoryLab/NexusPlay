import type { Game } from '../../domain/entities/game.entity.js';

/**
 * Concepto "canónico" de un juego (issue #50): lo mínimo que comparten los
 * tipos de juego basados en conceptos (Dominó, Laberinto, Parejas, Quién Es,
 * Opuestos). Es el puente de la adaptación sin IA: cada tipo sabe SACAR sus
 * conceptos (`extractConcepts`) y cada destino sabe ARMARSE desde ellos
 * (`deterministic-game-adapter.ts`), así que agregar un tipo cuesta uno más
 * en cada lado y no un adaptador por cada par.
 */
export interface GameConcept {
  label: string;
  /** Dato o descripción breve del concepto, si el tipo de origen lo tenía. */
  info?: string;
  imageUrl?: string;
  color?: string;
}

/** Clave estable de un tipo de juego + modo (solo MEMORY_MATCH tiene modo): `DOMINO`, `MEMORY_MATCH:PAIRS`. */
export function gameKindKey(gameType: string, mode?: string): string {
  return gameType === 'MEMORY_MATCH' && mode ? `${gameType}:${mode}` : gameType;
}

/** Modo del juego (solo MEMORY_MATCH): `PAIRS` u `OPPOSITES`. */
export function sourceModeOf(game: Game): string | undefined {
  return game.gameType.getName() === 'MEMORY_MATCH' && typeof game.config.mode === 'string'
    ? game.config.mode
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecords(content: unknown[]): Array<Record<string, unknown>> {
  return content.filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
  );
}

function compact(concept: GameConcept): GameConcept | null {
  if (!concept.label) return null;
  return Object.fromEntries(
    Object.entries(concept).filter(([, value]) => value !== undefined),
  ) as unknown as GameConcept;
}

function fromItems(
  items: Array<Record<string, unknown>>,
  pick: (item: Record<string, unknown>) => GameConcept[],
): GameConcept[] {
  const concepts: GameConcept[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const concept of pick(item)) {
      const clean = compact(concept);
      if (!clean) continue;
      // Dos conceptos con el mismo nombre dejarían fichas/tarjetas indistinguibles.
      const key = clean.label.toLocaleLowerCase('es');
      if (seen.has(key)) continue;
      seen.add(key);
      concepts.push(clean);
    }
  }
  return concepts;
}

/**
 * Conceptos del juego origen, o `null` si su tipo no se basa en conceptos
 * (Escaleras y Serpientes, Dúo Lógico y V/F manejan preguntas: eso solo lo
 * resuelve la IA).
 */
export function extractConcepts(game: Game): GameConcept[] | null {
  const items = asRecords(game.content);

  switch (gameKindKey(game.gameType.getName(), sourceModeOf(game))) {
    case 'DOMINO':
      return fromItems(items, (item) => [
        { label: text(item.label) ?? '', color: text(item.color) },
      ]);
    case 'MAZE_COLLECTOR':
      return fromItems(items, (item) => [
        { label: text(item.label) ?? '', color: text(item.color), info: text(item.fact) },
      ]);
    case 'MEMORY_MATCH:PAIRS':
      return fromItems(items, (item) => [
        { label: text(item.label) ?? '', imageUrl: text(item.imageUrl) },
      ]);
    case 'MEMORY_MATCH:OPPOSITES':
      // Cada pareja aporta sus dos lados como conceptos independientes.
      return fromItems(items, (item) => [
        {
          label: text(item.posTitle) ?? '',
          info: text(item.posDescription),
          imageUrl: text(item.posImageUrl),
        },
        {
          label: text(item.negTitle) ?? '',
          info: text(item.negDescription),
          imageUrl: text(item.negImageUrl),
        },
      ]);
    case 'GUESS_WHO':
      return fromItems(items, (item) => [
        { label: text(item.label) ?? '', imageUrl: text(item.imageUrl), info: text(item.info) },
      ]);
    default:
      return null;
  }
}
