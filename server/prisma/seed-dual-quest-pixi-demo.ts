import 'dotenv/config';
import { MongoClient } from 'mongodb';

/**
 * Siembra el nivel de ejemplo de Dúo Lógico (motor PixiJS): mismo criterio
 * que los demás seeds, para Dúo Lógico (DUAL_QUEST_PIXI)
 * — física real, gravedad, nadar en el propio elemento. Los datos son el
 * mismo `level1EnergiaRenovable` del cliente
 * (client/src/components/home/games/dual-quest-pixi/levels/level1EnergiaRenovable.ts),
 * copiados aquí como objeto plano porque el seed corre en el servidor sin
 * acceso al código del cliente — si el nivel cambia allá, hay que
 * reflejarlo aquí a mano.
 *
 * Es idempotente: correrlo dos veces no duplica el juego (upsert por slug).
 *
 * Uso: npm run db:seed:dual-quest-pixi-demo
 */

const SLUG = 'ciudad-sostenible-dual-quest-pixi';
const GAME_ID = 'seed-dual-quest-pixi-ciudad-sostenible-1';
const CATEGORY_NAME = 'Ciencias Naturales';
const CATEGORY_SLUG = 'ciencias-naturales';

// Dúo Lógico nuevo (#105/#108): los escenarios vienen hechos en el código; el
// juego elige cuáles incluye. Sin preguntas propias: usa el banco por defecto.
const CONFIG = { levels: ['bosque', 'solar'] };
const CONTENT: unknown[] = [];

async function ensureCategory(
  categories: import('mongodb').Collection,
  name: string,
  slug: string,
): Promise<string> {
  // Busca por nombre O por slug: si ya existe una categoría con este slug
  // pero un `name` que no calza exacto (mayúsculas, espacios, tilde
  // distinta), buscar solo por `name` no la encuentra y el insertOne de
  // abajo revienta contra el índice único de slug en vez de reusarla.
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
      title: 'Ciudad Sostenible I: Energía que se comparte (motor físico)',
      description:
        'Cooperativo de 2 jugadores con física real: Lumen salta y nada libre en la lava, Gota nada libre en el agua — cada uno muere en el elemento del otro. Empujen una caja, manden al perro a sostener un botón y crucen un canal de lava contenido para juntar las 4 fichas y llegar juntos al portal.',
      gameType: 'DUAL_QUEST_PIXI',
      theme: { primaryColor: '#1f8a5f', coverImageUrl: null },
      categoryId,
      // Sin creador humano: es contenido del equipo, no de un usuario (mismo
      // criterio que seed-maze-collector-demos.ts).
      creatorUserId: 'system',
      status: 'PUBLISHED',
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
      console.log(`"${document.title}" sembrado como juego PUBLISHED (slug: ${SLUG}).`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
