import { Injectable, type OnModuleInit } from '@nestjs/common';
import { MongoServerError, type ClientSession } from 'mongodb';
import type {
  FindAllGamesFilter,
  GameRepository,
  PaginatedGames,
} from '../../../domain/ports/game.repository.port.js';
import type { Game } from '../../../domain/entities/game.entity.js';
import { GameNotFoundError, GameSlugAlreadyTakenError } from '../../../application/errors/application.errors.js';
import { GameVersionConflictError } from '../../../domain/errors/game.errors.js';
import { MongoService } from './mongo.service.js';
import { GameMapper, type GameDocument } from './game.mapper.js';
import { GAMES_COLLECTION_JSON_SCHEMA } from './games.collection-schema.js';
import { TtlCache } from '../../cache/ttl-cache.js';

const DUPLICATE_KEY_ERROR_CODE = 11000;

const COLLECTION = 'games';

/**
 * Conteo de juegos publicados por área (`GET /subjects`): una agregación
 * sobre toda la colección en cada listado. Se invalida en cada escritura
 * que pueda cambiarlo (guardar, insertar en lote, borrar, publicar en
 * cascada); el TTL cubre cambios hechos por fuera de la app.
 */
const PUBLISHED_COUNTS_TTL_MS = 30_000;
const publishedCountsCache = new TtlCache<Array<[string, number]>>(PUBLISHED_COUNTS_TTL_MS, 50);

/**
 * `search` viaja tal cual del cliente al `$regex` de Mongo — sin escapar,
 * un input como `(a+)+$` puede provocar backtracking catastrófico en el
 * motor de regex y degradar la base de datos para todos (ReDoS).
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class MongoGameRepository implements GameRepository, OnModuleInit {
  constructor(private readonly mongo: MongoService) {}

  private get collection() {
    return this.mongo.collection<GameDocument>(COLLECTION);
  }

  /**
   * El `existsBySlug` en CreateGameUseCase es check-then-act, no atómico:
   * dos creaciones concurrentes con el mismo título pueden pasar ambas esa
   * verificación. Este índice es la garantía real de unicidad; el `save()`
   * de abajo traduce el error de duplicado que produce a un error de
   * aplicación legible en vez de dejarlo escapar como un 500 genérico.
   *
   * Los otros tres índices cubren, cada uno, un filtro real y ya existente
   * de `findAll` (ver más abajo) — sin ellos, cada listado del catálogo, de
   * "mis juegos" o de una organización es un escaneo completo de la
   * colección. No se agregan índices para filtros que no se usan hoy.
   */
  async onModuleInit(): Promise<void> {
    await this.collection.createIndex({ slug: 1 }, { unique: true });
    await this.collection.createIndex({ status: 1, categoryId: 1, createdAt: -1 });
    await this.collection.createIndex({ creatorUserId: 1, status: 1 });
    await this.collection.createIndex({ organizationId: 1, status: 1 });

    // Defensa adicional bajo los content-validators de la app, no un
    // sustituto: `warn` (no `error`) para que un desajuste de esquema no
    // pueda tumbar escrituras en producción antes de verificarse contra
    // datos reales. `collMod` porque la colección ya existe.
    await this.mongo.getDb().command({
      collMod: COLLECTION,
      validator: GAMES_COLLECTION_JSON_SCHEMA,
      validationLevel: 'moderate',
      validationAction: 'warn',
    });
  }

  /**
   * `expectedVersion` presente = edición de un juego existente: el filtro
   * exige que la versión en base de datos siga siendo esa (upsert
   * deshabilitado, ya debe existir). Si no matchea ningún documento, se
   * distingue entre "ya no existe" y "alguien más lo modificó primero" con
   * una lectura extra — un único `updateOne` sigue siendo suficiente para la
   * atomicidad real; no hace falta ninguna transacción para guardar UN
   * documento.
   */
  async save(game: Game, expectedVersion?: number): Promise<void> {
    const doc = GameMapper.toPersistence(game);
    const filter: Record<string, unknown> = { _id: doc._id };
    if (expectedVersion !== undefined) {
      // Los juegos anteriores al control de versiones (y los sembrados) no
      // tienen el campo `version`: el mapper los lee como 0, pero `{ version: 0 }`
      // no encuentra un documento sin ese campo y toda edición fallaba con
      // "modificado por otra operación". Ese `$set` ya escribe `version`.
      filter.version = expectedVersion === 0 ? { $in: [0, null] } : expectedVersion;
    }

    try {
      const result = await this.collection.updateOne(
        filter,
        { $set: doc },
        { upsert: expectedVersion === undefined },
      );

      publishedCountsCache.clear();

      if (expectedVersion !== undefined && result.matchedCount === 0) {
        const stillExists = await this.collection.countDocuments({ _id: doc._id }, { limit: 1 });
        if (stillExists) throw new GameVersionConflictError(doc._id);
        throw new GameNotFoundError(doc._id);
      }
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR_CODE) {
        throw new GameSlugAlreadyTakenError(doc.slug);
      }
      throw error;
    }
  }

  /**
   * `session` (si viene) es el `ClientSession` que abrió `MongoSessionFactory`
   * dentro de `session.withTransaction(...)` — todas las inserciones de un
   * mismo lote comparten esa sesión, así que confirman o revierten juntas.
   * El cast es el único punto del código que sabe que el "handle opaco" del
   * puerto es en realidad un `ClientSession` de Mongo.
   */
  async bulkInsert(games: Game[], session?: unknown): Promise<void> {
    if (games.length === 0) return;
    const docs = games.map(GameMapper.toPersistence);

    try {
      await this.collection.insertMany(docs, { session: session as ClientSession | undefined });
      publishedCountsCache.clear();
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR_CODE) {
        throw new GameSlugAlreadyTakenError('uno o más juegos del lote');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Game | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? GameMapper.toDomain(doc) : null;
  }

  async findByIds(ids: string[]): Promise<Game[]> {
    if (ids.length === 0) return [];
    const docs = await this.collection.find({ _id: { $in: ids } }).toArray();
    return docs.map(GameMapper.toDomain);
  }

  async findBySlug(slug: string): Promise<Game | null> {
    const doc = await this.collection.findOne({ slug });
    return doc ? GameMapper.toDomain(doc) : null;
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const count = await this.collection.countDocuments({ slug }, { limit: 1 });
    return count > 0;
  }

  async findAll(filter: FindAllGamesFilter): Promise<PaginatedGames> {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.creatorUserId) query.creatorUserId = filter.creatorUserId;
    if (filter.featured) query.featured = true;
    if (filter.categoryId) query.categoryId = filter.categoryId;
    if (filter.organizationId) query.organizationId = filter.organizationId;
    // El caller (list-games.use-case.ts) ya corta antes de llegar aquí si
    // `gameType` está dentro de `excludeGameTypes`, así que cuando ambos
    // vienen presentes el tipo exacto manda — si no, el `$nin` sobrescribía
    // el filtro exacto y la query devolvía todos los tipos no archivados.
    if (filter.gameType) {
      query.gameType = filter.gameType;
    } else if (filter.excludeGameTypes && filter.excludeGameTypes.length > 0) {
      query.gameType = { $nin: filter.excludeGameTypes };
    }
    if (filter.search) {
      const safePattern = escapeRegex(filter.search);
      query.$or = [
        { title: { $regex: safePattern, $options: 'i' } },
        { description: { $regex: safePattern, $options: 'i' } },
      ];
    }

    const skip = (filter.page - 1) * filter.pageSize;

    const [docs, total] = await Promise.all([
      this.collection
        .find(query)
        // Los listados solo muestran el resumen: `content` (todas las
        // preguntas/tarjetas) y `config` son lo más pesado del documento y
        // no se usan ahí. Se rellenan vacíos para poder armar la entidad.
        .project<GameDocument>({ content: 0, config: 0 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filter.pageSize)
        .toArray(),
      this.collection.countDocuments(query),
    ]);

    return {
      items: docs.map((doc) => GameMapper.toDomain({ ...doc, content: [], config: {} })),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: id });
    publishedCountsCache.clear();
  }

  async countPublishedByCategory(excludeGameTypes?: string[]): Promise<Map<string, number>> {
    const excluded = [...(excludeGameTypes ?? [])].sort();
    const counts = await publishedCountsCache.getOrLoad(excluded.join(','), async () => {
      const match: Record<string, unknown> = { status: 'PUBLISHED' };
      if (excluded.length > 0) match.gameType = { $nin: excluded };
      const results = await this.collection
        .aggregate<{ _id: string; count: number }>([
          { $match: match },
          { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        ])
        .toArray();
      return results.map((row) => [row._id, row.count] as [string, number]);
    });
    return new Map(counts);
  }

  async publishAllDraftsByCategory(categoryId: string): Promise<number> {
    const result = await this.collection.updateMany(
      { categoryId, status: 'DRAFT' },
      { $set: { status: 'PUBLISHED', updatedAt: new Date() }, $inc: { version: 1 } },
    );
    publishedCountsCache.clear();
    return result.modifiedCount;
  }

  async setFeatured(id: string, featured: boolean): Promise<boolean> {
    const result = await this.collection.updateOne({ _id: id }, { $set: { featured } });
    return result.matchedCount > 0;
  }
}
