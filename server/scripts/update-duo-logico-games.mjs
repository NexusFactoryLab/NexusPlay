// Deja los 3 juegos de Dúo Lógico de la base listos tras el rediseño (#108):
//  - "Dúo Lógico" (antes el demo de autenticación web) pasa a ser el juego
//    principal: publicado, destacado, con portada y el banco por defecto
//    (ciudades sostenibles en Colombia), igual que MatchMente o Dominexo.
//  - Los dos del Sylabus «El poder de las probabilidades» reciben preguntas
//    propias de su tema (muestreo y sesgo; probabilidad y Bayes) y dejan de
//    estar destacados.
//
//   npm run build                                      (usa el validador compilado)
//   node scripts/update-duo-logico-games.mjs           → vista previa
//   node scripts/update-duo-logico-games.mjs --apply --backup <archivo.json>
import 'dotenv/config';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { BSON, MongoClient } from 'mongodb';
import { DualQuestPixiContentValidator } from '../dist/application/content-validators/dual-quest-pixi.content-validator.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const backupPath = args.includes('--backup') ? args[args.indexOf('--backup') + 1] : null;
const LEVELS = ['bosque', 'solar'];

const q = (level, format, fields) => ({ level, format, ...fields });

const MUESTREO = [
  q('bosque', 'MIRROR', {
    prompt: 'Una investigadora quiere saber cuántas horas duermen los estudiantes de su colegio y pregunta a 50 de ellos. ¿Qué son esos 50 estudiantes?',
    options: ['Una muestra', 'La población', 'Un parámetro', 'Un sesgo'],
    hints: ['Son solo una parte del grupo que interesa.', 'El grupo completo sería todo el colegio.'],
    explanation: 'La población es el grupo completo que se quiere estudiar (todo el colegio); la muestra es la parte que de verdad se observa (los 50 estudiantes).',
  }),
  q('bosque', 'SPLIT', {
    prompt: '¿Qué porcentaje de la población quedó en la muestra?',
    clues: { FIRE: 'El colegio tiene 800 estudiantes.', WATER: 'Se encuestó a 80 estudiantes.' },
    options: ['10 %', '8 %', '80 %', '1 %'],
    hints: ['Uno conoce la población y el otro el tamaño de la muestra.', 'Divide la muestra entre la población.'],
    explanation: '80 de 800 es la décima parte: la muestra es el 10 % de la población.',
  }),
  q('bosque', 'TWO_PART', {
    prompt: 'Se quiere estimar la estatura promedio de los estudiantes de un colegio.',
    parts: {
      FIRE: { prompt: '¿Cuál es la población del estudio?', options: ['Todos los estudiantes del colegio', 'Los 30 estudiantes que se midieron', 'La estatura promedio', 'Los profesores del colegio'] },
      WATER: { prompt: '¿Cuál es una muestra adecuada?', options: ['30 estudiantes elegidos al azar de todos los cursos', 'Los 30 jugadores del equipo de baloncesto', 'Solo los estudiantes de grado 11', 'Los primeros 30 que lleguen al colegio'] },
    },
    hints: ['Una parte es el grupo completo; la otra, cómo tomar una parte justa de él.', 'Los basquetbolistas suelen ser más altos.'],
    explanation: 'La población son todos los estudiantes; una muestra al azar de todos los cursos la representa mejor que un grupo especial como el equipo de baloncesto.',
  }),
  q('solar', 'MIRROR', {
    prompt: 'Para conocer qué opina una ciudad del transporte público, se encuesta solo a personas en una estación de bicicletas. ¿Qué problema tiene esta muestra?',
    options: ['Está sesgada: no representa a toda la ciudad', 'Es la población completa', 'Es demasiado aleatoria', 'No tiene ningún problema'],
    hints: ['¿Todos en la ciudad usan bicicleta?', 'Un sesgo es una inclinación sistemática en cómo se elige.'],
    explanation: 'Elegir solo a ciclistas deja por fuera a quienes usan bus, metro o carro: la muestra está sesgada y sus conclusiones no valen para toda la ciudad.',
  }),
  q('solar', 'SPLIT', {
    prompt: '¿Cuál es la media de horas de sueño de los cinco estudiantes?',
    clues: { FIRE: 'Tres estudiantes durmieron 6, 7 y 8 horas.', WATER: 'Los otros dos durmieron 9 y 5 horas.' },
    options: ['7 horas', '8 horas', '6 horas', '35 horas'],
    hints: ['Junten los cinco datos.', 'La media es la suma dividida entre cuántos datos hay.'],
    explanation: '6 + 7 + 8 + 9 + 5 = 35 horas, y 35 ÷ 5 = 7: la media de la muestra es 7 horas.',
  }),
  q('solar', 'TWO_PART', {
    prompt: 'Un curso quiere elegir 20 estudiantes al azar de una lista de 400.',
    parts: {
      FIRE: { prompt: '¿Qué método es un muestreo aleatorio simple?', options: ['Sortear 20 números entre los 400 de la lista', 'Elegir a los 20 primeros de la lista', 'Pedir 20 voluntarios', 'Escoger a 20 amigos del curso'] },
      WATER: { prompt: '¿Por qué conviene elegirlos al azar?', options: ['Para que todos tengan la misma probabilidad de salir elegidos', 'Para que la muestra sea más pequeña', 'Para elegir a los mejores estudiantes', 'Porque así no hay que contar'] },
    },
    hints: ['Una parte es el cómo y la otra el porqué.', 'Los voluntarios suelen tener algo en común.'],
    explanation: 'En el muestreo aleatorio simple cada integrante tiene la misma probabilidad de ser elegido; eso reduce el sesgo de elegir a dedo o pedir voluntarios.',
  }),
];

const BAYES = [
  q('bosque', 'MIRROR', {
    prompt: 'Se lanza un dado justo de seis caras. ¿Cuál es la probabilidad de sacar un número par?',
    options: ['1/2', '1/3', '1/6', '2/3'],
    hints: ['Los pares son 2, 4 y 6.', 'Casos favorables entre casos posibles.'],
    explanation: 'Hay 3 resultados pares entre 6 posibles: 3/6 = 1/2.',
  }),
  q('bosque', 'SPLIT', {
    prompt: 'Se saca una bola al azar de la bolsa. ¿Cuál es la probabilidad de que sea roja?',
    clues: { FIRE: 'En la bolsa hay 3 bolas rojas.', WATER: 'En total hay 12 bolas en la bolsa.' },
    options: ['1/4', '1/3', '3/4', '1/12'],
    hints: ['Uno sabe cuántas rojas hay; el otro, cuántas en total.', 'Simplifiquen la fracción.'],
    explanation: '3 rojas entre 12 bolas: 3/12 = 1/4.',
  }),
  q('bosque', 'TWO_PART', {
    prompt: 'En un curso de 30 estudiantes, 12 juegan fútbol y, de esos 12, 3 también practican natación.',
    parts: {
      FIRE: { prompt: '¿Cuál es la probabilidad de que un estudiante al azar juegue fútbol?', options: ['12/30', '3/30', '3/12', '30/12'] },
      WATER: { prompt: 'Si el estudiante juega fútbol, ¿cuál es la probabilidad de que también nade?', options: ['3/12', '3/30', '12/30', '12/3'] },
    },
    hints: ['Una pregunta mira a todo el curso; la otra, solo a los futbolistas.', 'En la condicional el total cambia.'],
    explanation: 'P(fútbol) = 12/30. La probabilidad condicional P(natación | fútbol) solo mira a los 12 futbolistas: 3/12 = 1/4.',
  }),
  q('solar', 'MIRROR', {
    prompt: '¿Qué permite calcular el teorema de Bayes?',
    options: ['La probabilidad de una causa después de observar un efecto', 'El promedio de una muestra', 'El número de resultados posibles de un experimento', 'La moda de un conjunto de datos'],
    hints: ['Actualiza lo que creemos cuando llega información nueva.', 'Invierte una probabilidad condicional.'],
    explanation: 'Bayes combina la probabilidad previa con la evidencia para obtener la probabilidad de la causa dado lo observado: P(A | B) = P(B | A)·P(A) / P(B).',
  }),
  q('solar', 'SPLIT', {
    prompt: '¿Cuál es la probabilidad de que ocurran A y B a la vez?',
    clues: { FIRE: 'La probabilidad de A es 0,5.', WATER: 'Si ocurre A, la probabilidad de B es 0,4.' },
    options: ['0,2', '0,9', '0,1', '0,8'],
    hints: ['Uno tiene P(A) y el otro P(B | A).', 'P(A y B) = P(A) · P(B | A).'],
    explanation: 'P(A y B) = P(A) · P(B | A) = 0,5 · 0,4 = 0,2.',
  }),
  q('solar', 'TWO_PART', {
    prompt: 'Una prueba detecta una enfermedad. De 100 personas, 10 están enfermas: la prueba da positivo en 9 de ellas y también en 9 de las 90 sanas.',
    parts: {
      FIRE: { prompt: '¿Cuántos resultados positivos hay en total?', options: ['18', '9', '10', '90'] },
      WATER: { prompt: 'De quienes dan positivo, ¿qué fracción está enferma de verdad?', options: ['9/18 = 1/2', '9/10', '10/100', '9/90'] },
    },
    hints: ['Sumen los positivos de enfermos y de sanos.', 'Solo cuentan quienes dieron positivo.'],
    explanation: 'Hay 9 + 9 = 18 positivos y solo 9 son enfermos: P(enfermo | positivo) = 9/18 = 1/2. Aunque la prueba acierte casi siempre, un positivo no es certeza: eso es Bayes.',
  }),
];

const STATS_NOTE = 'Basado en el Sylabus «El poder de las probabilidades» (FFPO0005). Material de refuerzo: no sustituye el análisis de datos reales con software estadístico.';

const CHANGES = [
  {
    _id: 'seed-dual-quest-auth-flow',
    set: {
      title: 'Dúo Lógico',
      description: 'Conéctate con un amigo: Lumen y Gota superan escenarios juntos y solo avanzan si los dos responden bien cada Puerta del Saber.',
      categoryId: 'seed-category-medio-ambiente',
      status: 'PUBLISHED',
      featured: true,
      'theme.coverImageUrl': '/assets/duo-logico/cover.webp',
      config: { levels: LEVELS },
      content: [],
    },
  },
  {
    _id: 'seed-sylabus-duo-logico-pixi-muestreo',
    set: {
      title: 'Sylabus · Dúo Lógico: del muestreo al sesgo',
      description: `Cooperativo de 2 jugadores: Lumen y Gota recorren el bosque y la planta solar y, en cada Puerta del Saber, responden juntos sobre población, muestra, muestreo y sesgo. ${STATS_NOTE}`,
      featured: false,
      config: { levels: LEVELS },
      content: MUESTREO,
    },
  },
  {
    _id: 'seed-sylabus-duo-logico-bayes',
    set: {
      title: 'Sylabus · Dúo Lógico: Bayes en pareja',
      description: `Cooperativo de 2 jugadores: Lumen y Gota recorren el bosque y la planta solar y, en cada Puerta del Saber, resuelven juntos problemas de probabilidad condicional y del teorema de Bayes. ${STATS_NOTE}`,
      featured: false,
      config: { levels: LEVELS },
      content: BAYES,
    },
  },
];

// Las preguntas pasan por el mismo validador que la creación desde el formulario.
const validator = new DualQuestPixiContentValidator();
for (const change of CHANGES) {
  const config = validator.validateConfig(change.set.config);
  change.set.content = validator.validateContent(change.set.content, config);
}

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const games = client.db().collection('games');
  const before = await games.find({ _id: { $in: CHANGES.map((c) => c._id) } }).toArray();
  assert.equal(before.length, CHANGES.length, 'No se encontraron los 3 juegos de Dúo Lógico');
  for (const doc of before) assert.equal(doc.gameType, 'DUAL_QUEST_PIXI', `${doc._id} no es DUAL_QUEST_PIXI (¿falta migrate-duo-logico.mjs?)`);
  for (const change of CHANGES) {
    const doc = before.find((d) => d._id === change._id);
    console.log(`\n${doc._id}\n  título: ${doc.title} → ${change.set.title}\n  destacado: ${doc.featured ?? false} → ${change.set.featured}\n  preguntas propias: ${(doc.content ?? []).length} → ${change.set.content.length}`);
  }
  if (!APPLY) {
    console.log('\nVista previa: no se cambió nada. Para aplicar: --apply --backup <archivo.json>');
  } else {
    assert.ok(backupPath, 'Se requiere --backup <archivo.json>');
    writeFileSync(backupPath, BSON.EJSON.stringify(before, null, 2, { relaxed: false }), { flag: 'wx', mode: 0o600 });
    for (const change of CHANGES) {
      const result = await games.updateOne({ _id: change._id, gameType: 'DUAL_QUEST_PIXI' }, { $set: { ...change.set, updatedAt: new Date() }, $inc: { version: 1 } });
      assert.equal(result.matchedCount, 1, `${change._id} cambió mientras tanto; no se actualizó`);
    }
    const after = await games.find({ _id: { $in: CHANGES.map((c) => c._id) } }).toArray();
    for (const doc of after) {
      const change = CHANGES.find((c) => c._id === doc._id);
      assert.equal(doc.title, change.set.title);
      assert.equal(doc.featured, change.set.featured);
      assert.deepEqual(doc.config, change.set.config);
      assert.equal(doc.content.length, change.set.content.length);
    }
    console.log(`\nAplicado y verificado. Respaldo en ${backupPath}`);
  }
} finally {
  await client.close();
}
