// Pasa los dos juegos de Dúo Lógico que eran de estadística (Sylabus «El
// poder de las probabilidades») al formato nuevo de preguntas (#116): cada
// personaje tiene SU pregunta, distinta a la del compañero, sobre el mismo
// concepto. De paso cambian de tema a sistemas:
//  - seed-sylabus-duo-logico-pixi-muestreo → lógica de programación.
//  - seed-sylabus-duo-logico-bayes         → redes e internet.
// El juego principal «Dúo Lógico» no se toca (usa el banco por defecto).
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

/** Una puerta: el concepto, la pregunta de Lumen (FIRE) y la de Gota (WATER); la primera opción es la correcta. */
const q = (level, concept, fire, water, hints, explanation) => ({
  level,
  concept,
  parts: { FIRE: { prompt: fire[0], options: fire[1] }, WATER: { prompt: water[0], options: water[1] } },
  hints,
  explanation,
});

const PROGRAMACION = [
  q(
    'bosque',
    'Algoritmos',
    ['¿Qué es un algoritmo?', ['Una lista de pasos ordenados para resolver un problema', 'Un tipo de computador', 'Un virus informático', 'Un lenguaje de programación']],
    ['Una receta de cocina se parece a un algoritmo porque…', ['Sigue pasos en un orden', 'Usa electricidad', 'Solo la entiende un computador', 'No tiene un final']],
    ['Piensa en instrucciones paso a paso.', 'El orden importa.'],
    'Un algoritmo es una secuencia finita y ordenada de pasos; una receta es un buen ejemplo de la vida diaria.',
  ),
  q(
    'bosque',
    'Variables',
    ['¿Para qué sirve una variable en un programa?', ['Para guardar un dato que puede cambiar', 'Para apagar el computador', 'Para dibujar en pantalla', 'Para conectarse a internet']],
    ['Si x = 5 y luego x = x + 2, ¿cuánto vale x?', ['7', '5', '2', '52']],
    ['Es como una caja con nombre.', 'Primero se lee el valor y luego se guarda el nuevo.'],
    'Una variable es un espacio con nombre que guarda un valor; ese valor se puede leer y cambiar mientras el programa corre.',
  ),
  q(
    'bosque',
    'Condicionales',
    ['¿Qué hace la instrucción «si… entonces» (if)?', ['Ejecuta algo solo si se cumple una condición', 'Repite algo para siempre', 'Borra todos los datos', 'Suma dos números']],
    ['Si edad = 15, ¿qué imprime «si edad >= 18: "adulto" si no: "menor"»?', ['menor', 'adulto', 'Nada', 'Un error']],
    ['Es una decisión.', '15 no es mayor o igual que 18.'],
    'Los condicionales permiten que el programa tome decisiones: según la condición, sigue un camino u otro.',
  ),
  q(
    'solar',
    'Ciclos',
    ['¿Para qué sirve un ciclo (bucle) como «repetir» o «for»?', ['Para repetir instrucciones varias veces', 'Para guardar un archivo', 'Para tomar una sola decisión', 'Para cerrar el programa']],
    ['¿Cuántas veces se ejecuta «repetir 4 veces: saltar»?', ['4', '1', '3', 'Infinitas']],
    ['Evita escribir lo mismo muchas veces.', 'El número dice cuántas vueltas da.'],
    'Un ciclo repite un bloque de instrucciones: así un programa hace muchas veces lo mismo sin copiarlo.',
  ),
  q(
    'solar',
    'Errores (bugs)',
    ['¿Qué es un bug en programación?', ['Un error que hace que el programa falle o funcione mal', 'Un programa muy rápido', 'Un tipo de teclado', 'Una copia de seguridad']],
    ['¿Cómo se llama buscar y corregir errores en un programa?', ['Depurar (debugging)', 'Compilar música', 'Formatear', 'Navegar']],
    ['Su nombre en inglés significa «bicho».', 'Viene de «de-bug».'],
    'Los bugs son errores del programa; depurar es encontrarlos y corregirlos, una parte normal de programar.',
  ),
  q(
    'solar',
    'Funciones',
    ['¿Para qué sirve una función en un programa?', ['Para agrupar pasos y reutilizarlos con un nombre', 'Para apagar la pantalla', 'Para que el programa sea más lento', 'Para borrar variables']],
    ['Si doble(n) devuelve n × 2, ¿cuánto da doble(6)?', ['12', '6', '8', '62']],
    ['Se escribe una vez y se usa muchas.', 'Multiplica el número por dos.'],
    'Una función es un bloque con nombre que recibe datos, hace un trabajo y devuelve un resultado; se puede usar las veces que haga falta.',
  ),
];

const REDES = [
  q(
    'bosque',
    'Internet',
    ['¿Qué es internet?', ['Una red mundial que conecta millones de computadores', 'Un programa para escribir', 'Un solo computador muy grande', 'Un tipo de cable USB']],
    ['¿Qué necesita un computador para conectarse a internet?', ['Una conexión de red, como wifi o cable', 'Una impresora', 'Más memoria RAM', 'Un mouse inalámbrico']],
    ['Es una red de redes.', 'Puede ser con o sin cables.'],
    'Internet une redes de todo el mundo; cada equipo entra a ella con una conexión, por cable o inalámbrica (wifi).',
  ),
  q(
    'bosque',
    'Direcciones y nombres',
    ['¿Qué es una dirección IP?', ['El número que identifica a un equipo en la red', 'La contraseña del wifi', 'El nombre del dueño del computador', 'La marca del router']],
    ['¿Qué traduce un nombre como «google.com» a una dirección IP?', ['El DNS', 'El teclado', 'La pantalla', 'El antivirus']],
    ['Es como la dirección de una casa.', 'Funciona como una agenda de contactos.'],
    'Cada equipo tiene una IP; el DNS es la «agenda» que convierte nombres fáciles de recordar en esas direcciones.',
  ),
  q(
    'bosque',
    'Equipos de red',
    ['¿Qué aparato reparte el wifi en una casa?', ['El router', 'El monitor', 'El parlante', 'La impresora']],
    ['¿Qué significa que una red sea inalámbrica?', ['Que transmite datos sin cables, por ondas', 'Que no tiene contraseña', 'Que no gasta energía', 'Que solo funciona de noche']],
    ['Suele tener antenas y luces.', 'El wifi viaja por el aire.'],
    'El router conecta los equipos de la casa entre sí y con internet; el wifi lo hace por ondas de radio, sin cables.',
  ),
  q(
    'solar',
    'Navegar seguro',
    ['¿Qué indica el candado y el «https» en la barra del navegador?', ['Que la conexión con la página va cifrada', 'Que la página es gratis', 'Que la página no tiene anuncios', 'Que el computador no tiene virus']],
    ['¿Cuál es la contraseña más segura?', ['Tr3n_Az#l-29', '123456', 'mi nombre', 'contraseña']],
    ['La «s» es de seguro.', 'Mezcla letras, números y símbolos.'],
    'HTTPS cifra lo que viaja entre tu equipo y la página; una contraseña larga y variada es mucho más difícil de adivinar.',
  ),
  q(
    'solar',
    'Velocidad de la red',
    ['¿Qué mide el ancho de banda de una conexión?', ['Cuántos datos pueden pasar por segundo', 'El tamaño de la pantalla', 'La cantidad de cables', 'La edad del router']],
    ['Un archivo de 100 MB a 10 MB por segundo, ¿cuánto tarda en bajar?', ['10 segundos', '100 segundos', '1 segundo', '1.000 segundos']],
    ['Se mide en megas por segundo.', 'Es una división.'],
    'El ancho de banda es la cantidad de datos por segundo: con 10 MB/s, 100 MB tardan 100 ÷ 10 = 10 segundos.',
  ),
  q(
    'solar',
    'La nube',
    ['¿Qué significa guardar archivos «en la nube»?', ['Guardarlos en servidores de internet', 'Guardarlos en una memoria USB', 'Imprimirlos', 'Borrarlos del computador']],
    ['¿Cuál es una ventaja de la nube?', ['Ver los archivos desde cualquier equipo con internet', 'Funciona sin internet siempre', 'Nunca necesita contraseña', 'Hace el computador más pesado']],
    ['Los archivos viven en otros computadores.', 'Solo necesitas conectarte.'],
    'La nube son servidores en internet: tus archivos quedan guardados allí y puedes abrirlos desde cualquier equipo conectado.',
  ),
];

const CHANGES = [
  {
    _id: 'seed-sylabus-duo-logico-pixi-muestreo',
    set: {
      title: 'Dúo Lógico: lógica de programación',
      description: 'Cooperativo de 2 jugadores: Lumen y Gota recorren el bosque y la planta solar y, en cada Puerta del Saber, cada uno responde su pregunta sobre algoritmos, variables, condicionales, ciclos y funciones.',
      categoryId: 'seed-category-programacion',
      featured: false,
      config: { levels: LEVELS },
      content: PROGRAMACION,
    },
  },
  {
    _id: 'seed-sylabus-duo-logico-bayes',
    set: {
      title: 'Dúo Lógico: redes e internet',
      description: 'Cooperativo de 2 jugadores: Lumen y Gota recorren el bosque y la planta solar y, en cada Puerta del Saber, cada uno responde su pregunta sobre internet, direcciones IP, wifi, seguridad y la nube.',
      categoryId: 'seed-category-tecnologia',
      featured: false,
      config: { levels: LEVELS },
      content: REDES,
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
  assert.equal(before.length, CHANGES.length, 'No se encontraron los 2 juegos de Dúo Lógico');
  for (const doc of before) assert.equal(doc.gameType, 'DUAL_QUEST_PIXI', `${doc._id} no es DUAL_QUEST_PIXI`);
  for (const change of CHANGES) {
    const doc = before.find((d) => d._id === change._id);
    console.log(`\n${doc._id}\n  título: ${doc.title} → ${change.set.title}\n  categoría: ${doc.categoryId ?? '(ninguna)'} → ${change.set.categoryId}\n  preguntas propias: ${(doc.content ?? []).length} → ${change.set.content.length}`);
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
      assert.equal(doc.categoryId, change.set.categoryId);
      assert.deepEqual(doc.config, change.set.config);
      assert.equal(doc.content.length, change.set.content.length);
      for (const question of doc.content) assert.ok(question.concept && question.parts?.FIRE && question.parts?.WATER, `${doc._id}: pregunta sin el formato nuevo`);
    }
    console.log(`\nAplicado y verificado. Respaldo en ${backupPath}`);
  }
} finally {
  await client.close();
}
