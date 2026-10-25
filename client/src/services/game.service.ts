import { request } from '../utils/http'

export type GameTheme = {
  primaryColor: string
  coverImageUrl: string | null
}

export type GameSummary = {
  id: string
  slug: string
  title: string
  description: string
  gameType: string
  theme: GameTheme
  categoryId: string
  status: 'DRAFT' | 'PUBLISHED' | 'FLAGGED' | 'REMOVED'
  creatorUserId: string
  /** `null` = juego personal; con valor = institucional de esa organización. */
  organizationId: string | null
  /** Juego del que se adaptó este (issue #8); `null` si se creó desde cero. */
  sourceGameId: string | null
  /** Destacado por un ADMIN: es lo que muestra el Inicio. */
  featured: boolean
  /** Torneos habilitados por un ADMIN para este juego (issue #102). */
  tournamentEnabled: boolean
  /** Solo viene en el listado de "Comunidad". */
  creatorDisplayName?: string
  createdAt: string
  updatedAt: string
}

export type GameDetail = GameSummary & {
  config: Record<string, unknown>
  content: unknown[]
}

export type PaginatedGames = {
  items: GameSummary[]
  total: number
  page: number
  pageSize: number
}

export type ListGamesParams = {
  page?: number
  pageSize?: number
  search?: string
  status?: GameSummary['status']
  onlyMine?: boolean
  /** Sección "Comunidad": todos los juegos publicados, con el nombre del creador. */
  community?: boolean
  /** Inicio: solo los juegos destacados por un ADMIN. */
  featured?: boolean
  /** Solo los juegos con torneo habilitado (acceso temporal del Inicio, issue #102). */
  tournamentEnabled?: boolean
  categoryId?: string
  /** Filtra por tipo de juego exacto (vista de catálogo de tipos, issue #156). */
  gameType?: string
  /** Juegos institucionales de una organización concreta (issue #226, Juegos de la institución). */
  organizationId?: string
}

/** GET /games — catálogo paginado; sin filtro solo trae juegos publicados. */
export function listGames(token: string, params: ListGamesParams = {}): Promise<PaginatedGames> {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.onlyMine) query.set('onlyMine', 'true')
  if (params.community) query.set('community', 'true')
  if (params.featured) query.set('featured', 'true')
  if (params.tournamentEnabled) query.set('tournamentEnabled', 'true')
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.gameType) query.set('gameType', params.gameType)
  if (params.organizationId) query.set('organizationId', params.organizationId)

  const queryString = query.toString()
  return request<PaginatedGames>(`/games${queryString ? `?${queryString}` : ''}`, { token })
}

/** GET /games/slug/:slug — detalle por URL amigable, para la pantalla de descripción. */
export function getGameBySlug(token: string, slug: string): Promise<GameDetail> {
  return request<GameDetail>(`/games/slug/${encodeURIComponent(slug)}`, { token })
}

export type OppositesPairInput = {
  posTitle: string
  posDescription: string
  posImageUrl: string | null
  negTitle: string
  negDescription: string
  negImageUrl: string | null
}

export type SimplePairInput = {
  imageUrl: string
  label: string
}

export type DominoConceptInput = {
  label: string
  /** Clave del catálogo DOMINO_ICONS del cliente. */
  icon: string
  /** Color hexadecimal (#rgb o #rrggbb). */
  color: string
  /** Fácil: definición breve (opcional). */
  definition?: string
  /** Fácil: ejemplo cotidiano (opcional). */
  example?: string
  /** Universitario: caso o situación de aplicación (opcional). */
  application?: string
  /** Intermedio: banco de 1 a 6 preguntas por concepto (la creación exige al menos 1). */
  questions?: DominoQuestionInput[]
}

export type DominoQuestionInput = {
  text: string
  /** De 3 a 4 opciones distintas. */
  options: string[]
  correctIndex: number
  explanation: string
  /** Niveles en los que sale la pregunta; ausente = Intermedio y Universitario. */
  levels?: Array<'MEDIUM' | 'ADVANCED'>
}

export type GuessWhoCardInput = {
  imageUrl: string
  label: string
  audioUrl: string | null
}

export type MazeCollectorItemInput = {
  label: string
  /** Clave del catálogo DOMINO_ICONS del cliente (reutilizado, ver mazeCollectorTypes.ts). */
  icon: string
  color: string
  fact?: string
}

export type DualQuestGateInput = { gateId: string; position: { row: number; col: number } }

export type DualQuestTriggerInput = {
  triggerId: string
  kind: 'SWITCH' | 'QUESTION'
  activatedByRole: 'FIRE' | 'WATER'
  switchPosition: { row: number; col: number }
  gateId: string
  prompt?: string
  options?: string[]
  correctOptionIndex?: number
}

export type DualQuestGemInput = {
  gemId: string
  role: 'FIRE' | 'WATER'
  position: { row: number; col: number }
  label: string
  order: number
}

export type SnakesLaddersQuestionInput = {
  cellNumber: number
  triggerType: 'CELL' | 'LADDER' | 'SNAKE'
  prompt: string
  options: string[]
  correctOptionIndex: number
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH'
}

export type TrueFalseMazeQuestionInput = {
  questionId?: string
  statement: string
  answer: boolean
  explanation?: string
}

type CreateGameInputBase =
  | {
      title: string
      description: string
      gameType: 'MEMORY_MATCH'
      categoryId: string
      /** Si viene, el juego nace institucional de esa organización. */
      organizationId?: string | null
      theme?: { primaryColor?: string; coverImageUrl?: string | null }
      config?: { mode: 'OPPOSITES' } & Record<string, unknown>
      content: OppositesPairInput[]
    }
  | {
      title: string
      description: string
      gameType: 'MEMORY_MATCH'
      categoryId: string
      organizationId?: string | null
      theme?: { primaryColor?: string; coverImageUrl?: string | null }
      config: { mode: 'PAIRS' } & Record<string, unknown>
      content: SimplePairInput[]
    }
  | {
      title: string
      description: string
      gameType: 'GUESS_WHO'
      categoryId: string
      organizationId?: string | null
      theme?: { primaryColor?: string; coverImageUrl?: string | null }
      config?: Record<string, unknown>
      content: GuessWhoCardInput[]
    }
  | {
      title: string
      description: string
      gameType: 'DOMINO'
      categoryId: string
      organizationId?: string | null
      theme?: { primaryColor?: string; coverImageUrl?: string | null }
      config?: { handSize?: number } & Record<string, unknown>
      content: DominoConceptInput[]
    }
  | {
      title: string
      description: string
      gameType: 'MAZE_COLLECTOR'
      categoryId: string
      organizationId?: string | null
      theme?: { primaryColor?: string; coverImageUrl?: string | null }
      config?: Record<string, unknown>
      content: MazeCollectorItemInput[]
    }
  | {
      title: string
      description: string
      gameType: 'SNAKES_LADDERS'
      categoryId: string
      organizationId?: string | null
      theme?: { primaryColor?: string; coverImageUrl?: string | null }
      config: {
        boardSize: number
        turnDurationSeconds?: number
        ladders: Array<{ from: number; to: number }>
        snakes: Array<{ from: number; to: number }>
      }
      content: SnakesLaddersQuestionInput[]
    }
  | {
      title: string
      description: string
      gameType: 'DUAL_QUEST'
      categoryId: string
      organizationId?: string | null
      theme?: { primaryColor?: string; coverImageUrl?: string | null }
      config: {
        coreQuestion: string
        gridCols: number
        gridRows: number
        grid: number[][]
        fireStart: { row: number; col: number }
        waterStart: { row: number; col: number }
        corePosition: { row: number; col: number }
        gates: DualQuestGateInput[]
        triggers: DualQuestTriggerInput[]
      }
      content: DualQuestGemInput[]
    }
  | {
      title: string
      description: string
      gameType: 'TRUE_FALSE_MAZE'
      categoryId: string
      organizationId?: string | null
      theme?: { primaryColor?: string; coverImageUrl?: string | null }
      config: {
        skin: 'NAVE_ESPACIAL'
        lives: number
        enemyCount: number
        enemySpeed: number
        relocateSeconds: number
        shuffleQuestions: boolean
        lightsOut: boolean
      }
      content: TrueFalseMazeQuestionInput[]
    }

export type CreateGameInput = CreateGameInputBase & {
  /** Juego del que se adaptó este (issue #8); solo trazabilidad. */
  sourceGameId?: string | null
  /**
   * Borrador de creación del que sale el juego (issue #69): el servidor le
   * quita la etiqueta de borrador a sus imágenes y elimina el borrador.
   */
  creationDraftId?: string
}

/** POST /games — crea un juego en estado DRAFT. Cualquier usuario autenticado puede llamarlo. */
export function createGame(token: string, input: CreateGameInput): Promise<GameDetail> {
  return request<GameDetail>('/games', {
    method: 'POST',
    token,
    body: input,
  })
}

/** PATCH /games/:id — edición parcial; solo el creador o un admin. */
export function updateGame(
  token: string,
  gameId: string,
  input: {
    config?: Record<string, unknown>
    theme?: { primaryColor?: string; coverImageUrl?: string | null }
  },
): Promise<GameDetail> {
  return request<GameDetail>(`/games/${gameId}`, {
    method: 'PATCH',
    token,
    body: input,
  })
}

/** PATCH /games/:id/publish — solo el creador o un admin. */
export function publishGame(token: string, gameId: string): Promise<GameDetail> {
  return request<GameDetail>(`/games/${gameId}/publish`, { method: 'PATCH', token })
}

/** PATCH /games/:id/featured — solo ADMIN: fija o quita el juego como destacado del Inicio. */
export function setGameFeatured(token: string, gameId: string, featured: boolean): Promise<GameDetail> {
  return request<GameDetail>(`/games/${gameId}/featured`, { method: 'PATCH', token, body: { featured } })
}

/** PATCH /games/:id/tournament — solo ADMIN: habilita o deshabilita los torneos grupales del juego (issue #102). */
export function setGameTournamentEnabled(token: string, gameId: string, enabled: boolean): Promise<GameDetail> {
  return request<GameDetail>(`/games/${gameId}/tournament`, { method: 'PATCH', token, body: { enabled } })
}

/** DELETE /games/:id — borrado lógico; solo el creador o un admin. */
export function deleteGame(token: string, gameId: string): Promise<void> {
  return request<void>(`/games/${gameId}`, { method: 'DELETE', token })
}

/**
 * PATCH /games/:id/donate — dona un juego personal a una organización.
 * Puede donar: el creador (si es miembro de la organización destino), un
 * ADMIN de esa organización (aunque el juego sea de otro usuario), o el
 * ADMIN global. `creatorUserId` no cambia tras la donación.
 */
export function donateGame(
  token: string,
  gameId: string,
  organizationId: string,
): Promise<GameDetail> {
  return request<GameDetail>(`/games/${gameId}/donate`, {
    method: 'PATCH',
    token,
    body: { organizationId },
  })
}

export type GameTypeSetting = {
  gameType: string
  displayName: string
  description: string | null
  status: 'ACTIVE' | 'ARCHIVED'
  isArchived: boolean
}

export type GameTypeSettingsPage = {
  items: GameTypeSetting[]
  total: number
  page: number
  pageSize: number
}

/**
 * GET /game-types — para no-ADMIN, el backend ya filtra los tipos ARCHIVED
 * (quedan completamente ausentes, no solo marcados). Un ADMIN recibe también
 * los archivados con `isArchived: true`. Paginado (issue #156) para la vista
 * de catálogo con flecha en vez de scroll; sin `page`/`pageSize`, el backend
 * devuelve todo en una sola página.
 */
export function listGameTypeSettings(
  token: string,
  filters?: {
    page?: number
    pageSize?: number
    statusFilter?: 'ACTIVE' | 'ARCHIVED' | 'ALL'
    search?: string
  },
): Promise<GameTypeSettingsPage> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize))
  if (filters?.statusFilter) params.set('statusFilter', filters.statusFilter)
  if (filters?.search) params.set('search', filters.search)
  const query = params.toString()
  return request<GameTypeSettingsPage>(`/game-types${query ? `?${query}` : ''}`, { token })
}

/**
 * Catálogo completo de tipos de juego, sin paginar — para consumidores que
 * necesitan resolver todos los tipos por `gameType` (picker de creación,
 * encabezado de la vista filtrada por tipo). `pageSize` grande porque el
 * catálogo (`VALID_GAME_TYPES`) solo crece con cambios de código, nunca con
 * datos de usuario.
 */
export function listAllGameTypeSettings(token: string): Promise<GameTypeSetting[]> {
  return listGameTypeSettings(token, { pageSize: 100 }).then((result) => result.items)
}

/** PATCH /game-types/:gameType/archive — solo ADMIN. */
export function archiveGameType(token: string, gameType: string): Promise<GameTypeSetting> {
  return request<GameTypeSetting>(`/game-types/${encodeURIComponent(gameType)}/archive`, {
    method: 'PATCH',
    token,
  })
}

/** PATCH /game-types/:gameType/unarchive — solo ADMIN. */
export function unarchiveGameType(token: string, gameType: string): Promise<GameTypeSetting> {
  return request<GameTypeSetting>(`/game-types/${encodeURIComponent(gameType)}/unarchive`, {
    method: 'PATCH',
    token,
  })
}

/** PATCH /game-types/:gameType — renombra/describe un tipo de juego. Solo ADMIN. */
export function updateGameTypeSetting(
  token: string,
  gameType: string,
  input: { displayName: string; description?: string },
): Promise<GameTypeSetting> {
  return request<GameTypeSetting>(`/game-types/${encodeURIComponent(gameType)}`, {
    method: 'PATCH',
    token,
    body: input,
  })
}
