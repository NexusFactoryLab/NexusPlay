import 'dotenv/config';
import { MongoClient } from 'mongodb';

/**
 * Siembra el juego principal de "Salvando el mundo con sostenibilidad"
 * (issue #152): "Territorios en Juego: El Desafío de la BiodiverCiudad", la
 * actividad de la Universidad EAN basada en el libro "Voces sobre Ciudades
 * Sostenibles y Resilientes" (MADS, 2019). Es UN juego en modo expedición:
 * recorre las 4 estaciones de la guía (Amazonia → Caribe → Andes → Metrópolis),
 * cada una en su mapa y con su banco fijo de preguntas, y queda DESTACADO en
 * el Inicio.
 *
 * Es idempotente: correrlo dos veces no duplica el juego (upsert por slug).
 *
 * Uso: npm run db:seed:salvando-el-mundo
 */

const SLUG = 'territorios-en-juego-biodiverciudad';
const ID = 'seed-maze-territorios-en-juego';
const CATEGORY = { name: 'Medio Ambiente', slug: 'medio-ambiente' };

const GAME = {
  title: 'Territorios en Juego: El Desafío de la BiodiverCiudad',
  description:
    'Año 2035: varias regiones de Colombia llegaron a un punto de quiebre. Recorre la Amazonia, el Caribe, los Andes y la metrópoli respondiendo con el libro guía para ganar Puntos de Bio-Resiliencia y firmar el Pacto Territorial.',
  theme: { primaryColor: '#16a34a', coverImageUrl: null },
  config: {
    layout: 'AMAZON',
    stations: ['AMAZON', 'OCEAN', 'PARAMO', 'CITY'],
    lives: 3,
    enemySpeed: 2,
    collectorLabel: 'Consorcio sostenible',
    collectorIcon: 'leaf',
    enemyLabel: 'Contaminación',
    enemyIcon: 'cloud',
  },
  // Los coleccionables de bonificación: cada uno trae un dato del libro guía.
  content: [
    {
      itemId: 'humedal-artificial',
      label: 'Humedal artificial',
      icon: 'droplets',
      color: '#0ea5e9',
      fact: 'En la Amazonia, el saneamiento con humedales evita que las aguas residuales contaminen las cuencas.',
    },
    {
      itemId: 'sendero-palafitico',
      label: 'Sendero palafítico',
      icon: 'tree',
      color: '#16a34a',
      fact: 'Los senderos palafíticos comunitarios permiten el ecoturismo sin rellenar las rondas de los ríos.',
    },
    {
      itemId: 'manglar',
      label: 'Manglar',
      icon: 'waves',
      color: '#14b8a6',
      fact: 'La Ciénaga de Mallorquín perdió unas 650 hectáreas entre 1980 y 2010, con parches de manglar.',
    },
    {
      itemId: 'reciclador',
      label: 'Reciclador de oficio',
      icon: 'recycle',
      color: '#22c55e',
      fact: 'En 2018 Barranquilla carnetizó a 987 recicladores de su Red de Recuperadores Ambientales.',
    },
    {
      itemId: 'agua-lluvia',
      label: 'Cosecha de agua lluvia',
      icon: 'cloudRain',
      color: '#3b82f6',
      fact: 'En San Andrés las casas raizales guardan el agua lluvia: el "acueducto celestial".',
    },
    {
      itemId: 'bosque-nativo',
      label: 'Bosque nativo',
      icon: 'sprout',
      color: '#65a30d',
      fact: 'Un bosque urbano recrea un bosque nativo con criterios de restauración, no es solo sembrar árboles.',
    },
    {
      itemId: 'parque-lineal',
      label: 'Parque lineal',
      icon: 'mountain',
      color: '#84cc16',
      fact: 'Un parque lineal junto a una quebrada reparte la naturaleza y conecta los cerros con la ciudad.',
    },
    {
      itemId: 'bus-electrico',
      label: 'Bus de cero emisiones',
      icon: 'bus',
      color: '#f59e0b',
      fact: 'Los sistemas de buses deben incorporar vehículos de cero emisiones para limpiar el aire.',
    },
  ],
};

async function ensureCategory(categories: import('mongodb').Collection): Promise<string> {
  const existing = await categories.findOne({ $or: [{ name: CATEGORY.name }, { slug: CATEGORY.slug }] });
  if (existing) return String(existing._id);
  const categoryId = `seed-category-${CATEGORY.slug}`;
  await categories.insertOne({
    _id: categoryId,
    name: CATEGORY.name,
    slug: CATEGORY.slug,
    creatorUserId: null,
    createdAt: new Date(),
  } as never);
  console.log(`Área creada: ${CATEGORY.name}`);
  return categoryId;
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI no está configurada.');

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const games = db.collection('games');
    const categoryId = await ensureCategory(db.collection('categories'));
    const now = new Date();

    const document = {
      slug: SLUG,
      title: GAME.title,
      description: GAME.description,
      gameType: 'MAZE_COLLECTOR',
      theme: GAME.theme,
      categoryId,
      // Contenido del equipo, no de un usuario (mismo criterio que los demás seeds).
      creatorUserId: 'system',
      status: 'PUBLISHED',
      config: GAME.config,
      content: GAME.content,
      // Destacado: es el juego principal de "Salvando el mundo" en el Inicio.
      featured: true,
      updatedAt: now,
    };

    const existing = await games.findOne({ slug: SLUG });
    if (existing) {
      await games.updateOne({ slug: SLUG }, { $set: document });
      console.log(`"${GAME.title}" actualizado y destacado (slug: ${SLUG}).`);
    } else {
      await games.insertOne({ _id: ID, ...document, createdAt: now } as never);
      console.log(`"${GAME.title}" sembrado como juego PUBLISHED y destacado (slug: ${SLUG}).`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
