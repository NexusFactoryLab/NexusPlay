/**
 * Identidad del juego que sugiere la IA junto al contenido (todos los tipos de juego):
 * título, descripción corta y el área (categoría) donde encaja. Son funciones puras.
 *
 * Límites: el DTO de creación exige título >= 3 y descripción >= 10 caracteres; no hay
 * máximos en el servidor, así que aquí se acotan a valores razonables para la interfaz.
 * El área SOLO puede ser una de las que el cliente mandó: nunca se crean áreas nuevas.
 */

export const IDENTITY_TITLE_MIN = 3;
export const IDENTITY_TITLE_MAX = 80;
export const IDENTITY_DESCRIPTION_MIN = 10;
export const IDENTITY_DESCRIPTION_MAX = 300;
/** Tope de áreas que se listan en el prompt (evita inflarlo con catálogos enormes). */
export const MAX_PROMPT_CATEGORIES = 60;

export interface CategoryOption {
  id: string;
  name: string;
}

/** Lo que el modelo devuelve en la raíz del JSON, sin validar. */
export interface RawDraftIdentity {
  title?: unknown;
  description?: unknown;
  categoryId?: unknown;
  categoryName?: unknown;
}

export interface DraftIdentity {
  title?: string;
  description?: string;
  /** Id de un área existente, o `null` si ninguna encaja. */
  categoryId: string | null;
}

/** Texto que se agrega a las instrucciones para pedir título, descripción y área. */
export function identityPromptSection(categories: CategoryOption[]): string {
  const list = categories.slice(0, MAX_PROMPT_CATEGORIES);
  const areas = list.length
    ? `"categoryId": el id (copiado EXACTO) del área de esta lista donde mejor encaja el juego, o null si ninguna encaja. NUNCA inventes un área ni un id. Elige la MÁS ESPECÍFICA de la lista que encaje con el tema (por ejemplo, una disciplina concreta antes que una categoría amplia o transversal); si ninguna encaja de verdad, usa null.\nÁreas disponibles:\n${list.map((c) => `- ${c.id}: ${c.name}`).join('\n')}`
    : '"categoryId": null (no hay áreas disponibles).';
  return `\n\nAdemás, en la RAÍZ del JSON (junto a "config" y "content") agrega la identidad del juego:
- "title": nombre atractivo del juego (entre ${IDENTITY_TITLE_MIN} y ${IDENTITY_TITLE_MAX} caracteres), sin comillas ni emojis.
- "description": descripción corta de qué se practica (entre ${IDENTITY_DESCRIPTION_MIN} y ${IDENTITY_DESCRIPTION_MAX} caracteres).
- ${areas}`;
}

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().replace(/\s+/g, ' ') : null;
}

function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * Valida lo que devolvió el modelo: título/descripción solo si cumplen el mínimo (si no, se
 * omiten para no pisar nada), y el área solo si existe en la lista recibida (por id; como
 * respaldo, por nombre exacto sin tildes). Cualquier otra cosa da `categoryId: null`.
 */
export function normalizeIdentity(raw: RawDraftIdentity | null | undefined, categories: CategoryOption[]): DraftIdentity {
  const result: DraftIdentity = { categoryId: null };
  if (!raw) return result;

  const title = clean(raw.title);
  if (title) {
    const t = cut(title.replace(/^["'“«]+|["'”»]+$/g, ''), IDENTITY_TITLE_MAX);
    if (t.length >= IDENTITY_TITLE_MIN) result.title = t;
  }
  const description = clean(raw.description);
  if (description) {
    const d = cut(description, IDENTITY_DESCRIPTION_MAX);
    if (d.length >= IDENTITY_DESCRIPTION_MIN) result.description = d;
  }

  const wantedId = clean(raw.categoryId);
  const byId = wantedId ? categories.find((c) => c.id === wantedId) : undefined;
  if (byId) {
    result.categoryId = byId.id;
  } else {
    const wantedName = clean(raw.categoryName) ?? wantedId;
    const byName = wantedName ? categories.find((c) => fold(c.name) === fold(wantedName)) : undefined;
    if (byName) result.categoryId = byName.id;
  }
  return result;
}

/** Interpreta el campo `categories` del formulario (JSON `[{id,name}]`); inválido => lista vacía. */
export function parseCategoryOptions(raw: unknown): CategoryOption[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: CategoryOption[] = [];
    for (const item of parsed) {
      const id = clean((item as { id?: unknown })?.id);
      const name = clean((item as { name?: unknown })?.name);
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name: cut(name, 80) });
      if (out.length >= 200) break;
    }
    return out;
  } catch {
    return [];
  }
}
