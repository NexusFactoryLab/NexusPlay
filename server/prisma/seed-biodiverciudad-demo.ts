import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { CONFIG, CONTENT } from './biodiverciudad-content.js';

/**
 * Siembra el juego BIODIVERCIUDAD "Territorios en Juego: El Desafío de la
 * BiodiverCiudad" con las 4 estaciones regionales (Amazonia, Caribe,
 * Andes/Metrópolis y Gobernanza) y 5 preguntas por estación.
 *
 * Fuente única de las preguntas: el libro "Voces sobre Ciudades Sostenibles y
 * Resilientes" (Ministerio de Ambiente y Desarrollo Sostenible, 2019). Cada
 * pregunta lleva autor y página del ensayo. El libro es CC BY-NC-ND: solo se
 * citan fragmentos breves y literales, el resto va parafraseado.
 *
 * Es idempotente: correrlo dos veces no duplica el juego (upsert por slug).
 *
 * Uso: npm run db:seed:biodiverciudad-demo
 */

const SLUG = 'territorios-en-juego-biodiverciudad';
const GAME_ID = 'seed-biodiverciudad-territorios-en-juego';
const CATEGORY_NAME = 'Medio Ambiente';
const CATEGORY_SLUG = 'medio-ambiente';

async function ensureCategory(
  categories: import('mongodb').Collection,
  name: string,
  slug: string,
): Promise<string> {
  const existing = await categories.findOne({ $or: [{ name }, { slug }] });
  if (existing) return String(existing._id);

  const categoryId = `seed-category-${slug}`;
  await categories.insertOne({
    _id: categoryId,
    name,
    slug,
    creatorUserId: null,
    createdAt: new Date(),
  } as never);
  console.log(`Área creada: ${name}`);
  return categoryId;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no está configurada.');
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const categories = db.collection('categories');
    const games = db.collection('games');
    const now = new Date();

    const categoryId = await ensureCategory(categories, CATEGORY_NAME, CATEGORY_SLUG);

    const document = {
      slug: SLUG,
      title: 'Territorios en Juego: El Desafío de la BiodiverCiudad',
      description:
        'Año 2035: cuatro regiones de Colombia están en crisis. Tu consorcio recorre las estaciones (Amazonia, Caribe, Andes y Gobernanza), responde trivias citando el libro "Voces sobre Ciudades Sostenibles y Resilientes" y toma decisiones para ganar Puntos de Bio-Resiliencia.',
      gameType: 'BIODIVERCIUDAD',
      theme: { primaryColor: '#16a34a', coverImageUrl: null },
      categoryId,
      creatorUserId: 'system',
      // DRAFT hasta que exista el reproductor: un juego publicado que no abre es peor que uno oculto.
      status: 'DRAFT',
      config: CONFIG,
      content: CONTENT,
      updatedAt: now,
    };

    const existing = await games.findOne({ slug: SLUG });
    if (existing) {
      await games.updateOne({ slug: SLUG }, { $set: document });
      console.log(`"${document.title}" actualizado (slug: ${SLUG}).`);
    } else {
      await games.insertOne({ _id: GAME_ID, ...document, createdAt: now } as never);
      console.log(`"${document.title}" sembrado como borrador (DRAFT) (slug: ${SLUG}).`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
