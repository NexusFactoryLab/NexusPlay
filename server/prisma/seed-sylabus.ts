import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { MongoClient } from 'mongodb';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { buildSylabusGames, SYLABUS_CATEGORY, type SylabusImages } from './sylabus-games.js';

/**
 * Siembra los juegos del Sylabus «El poder de las probabilidades» (FFPO0005): una adaptación por
 * cada mecánica de NexusPlay (ver `sylabus-games.ts`). Las imágenes de MatchMente e Identidad
 * Oculta salen de Cloudinary: antes hay que correr `node scripts/sylabus-upload-images.mjs`, que
 * deja el manifiesto `prisma/sylabus-images.json` (con autoría y licencia de cada imagen).
 *
 * Es idempotente: correrlo dos veces no duplica nada (upsert por slug; el área se reutiliza).
 *
 * Uso: npm run db:seed:sylabus            (escribe en la base de MONGODB_URI)
 *      npm run db:seed:sylabus -- --dry-run   (solo lista lo que haría, sin conectarse)
 */

const DRY_RUN = process.argv.includes('--dry-run');

function loadImages(): SylabusImages {
  const file = resolve(process.cwd(), 'prisma/sylabus-images.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as SylabusImages;
  } catch {
    throw new Error(`No se pudo leer ${file}. Corre primero: node scripts/sylabus-upload-images.mjs`);
  }
}

/**
 * Las áreas viven en Postgres (`subjects`) y el juego apunta a ellas por id: sin esa fila el área
 * no aparece en el catálogo. Mongo (`categories`) se mantiene en paralelo, como los otros seeds,
 * con el mismo id.
 */
async function ensureArea(
  categories: import('mongodb').Collection,
  prisma: PrismaClient,
): Promise<string> {
  const { name, slug } = SYLABUS_CATEGORY;
  const subject = await prisma.subjectModel.upsert({
    where: { slug },
    create: { id: `seed-category-${slug}`, name, slug, status: 'PUBLIC' },
    update: {},
  });

  if (!(await categories.findOne({ _id: subject.id } as never))) {
    await categories.insertOne({
      _id: subject.id,
      name,
      slug,
      creatorUserId: null,
      createdAt: new Date(),
    } as never);
  }
  return subject.id;
}

async function main(): Promise<void> {
  const sylabusGames = buildSylabusGames(loadImages());

  if (DRY_RUN) {
    for (const game of sylabusGames) {
      console.log(`[dry-run] ${game.gameType.padEnd(16)} ${game.slug} — "${game.title}" (${game.content.length} elementos)`);
    }
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no está configurada.');
  }

  const client = new MongoClient(uri);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    await client.connect();
    const db = client.db();
    const categoryId = await ensureArea(db.collection('categories'), prisma);
    const games = db.collection('games');
    const now = new Date();

    for (const game of sylabusGames) {
      const document = {
        slug: game.slug,
        title: game.title,
        description: game.description,
        gameType: game.gameType,
        theme: { primaryColor: game.primaryColor, coverImageUrl: game.coverImageUrl },
        categoryId,
        // Contenido del equipo, no de un usuario (mismo criterio que los otros seeds).
        creatorUserId: 'system',
        status: 'PUBLISHED',
        config: game.config,
        content: game.content,
        updatedAt: now,
      };

      const existing = await games.findOne({ slug: game.slug });
      if (existing) {
        await games.updateOne({ slug: game.slug }, { $set: document });
        console.log(`"${game.title}" actualizado (slug: ${game.slug}).`);
      } else {
        // `version` es obligatorio en el esquema de la colección (ver games.collection-schema.ts).
        await games.insertOne({ _id: game.id, ...document, version: 1, createdAt: now } as never);
        console.log(`"${game.title}" sembrado como juego PUBLISHED (slug: ${game.slug}).`);
      }
    }
  } finally {
    await client.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
