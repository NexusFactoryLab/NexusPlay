// Agrega a cada tarjeta del demo Identidad Oculta (banderas) los rasgos de las preguntas guiadas (issue #58).
// Vista previa por defecto (muestra qué rasgos recibe cada país). --apply exige --backup con una ruta local no versionada.
// node server/scripts/add-identidad-oculta-traits.mjs --env-file server/.env
// node server/scripts/add-identidad-oculta-traits.mjs --env-file server/.env --apply --backup ./identidad-oculta-antes.json
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parse } from 'dotenv';
import { BSON, MongoClient } from 'mongodb';

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const target = {
  _id: '71fb158c-0b6d-42e9-b2e8-dbc363db661b',
  slug: 'quien-es-de-banderas',
  gameType: 'GUESS_WHO',
};

// Solo datos objetivos y estables: nada que cambie con el tiempo (por ejemplo,
// quién ganó el último Mundial) ni cifras cerca del límite. Las de la bandera
// se pueden comprobar mirando la tarjeta.
const TRAITS = {
  america: '¿Es un país de América?',
  sudamerica: '¿Es un país de Sudamérica?',
  europa: '¿Es un país de Europa?',
  'habla-espanol': '¿La mayoría de su población habla español?',
  'capital-hemisferio-sur': '¿Su capital está en el hemisferio sur?',
  'mas-100-millones': '¿Tiene más de 100 millones de habitantes?',
  'franjas-verticales': '¿Su bandera tiene franjas verticales?',
  'franjas-horizontales': '¿Su bandera tiene franjas horizontales?',
  'tres-franjas': '¿Su bandera tiene exactamente tres franjas?',
  estrella: '¿Su bandera tiene al menos una estrella?',
  verde: '¿El verde es uno de los colores principales de su bandera?',
};

const BY_LABEL = {
  Colombia: ['america', 'sudamerica', 'habla-espanol', 'franjas-horizontales', 'tres-franjas'],
  Argentina: ['america', 'sudamerica', 'habla-espanol', 'capital-hemisferio-sur', 'franjas-horizontales', 'tres-franjas'],
  Brasil: ['america', 'sudamerica', 'capital-hemisferio-sur', 'mas-100-millones', 'estrella', 'verde'],
  México: ['america', 'habla-espanol', 'mas-100-millones', 'franjas-verticales', 'tres-franjas', 'verde'],
  Francia: ['europa', 'franjas-verticales', 'tres-franjas'],
  Italia: ['europa', 'franjas-verticales', 'tres-franjas', 'verde'],
  Japón: ['mas-100-millones'],
  Alemania: ['europa', 'franjas-horizontales', 'tres-franjas'],
  España: ['europa', 'habla-espanol', 'franjas-horizontales', 'tres-franjas'],
  Perú: ['america', 'sudamerica', 'habla-espanol', 'capital-hemisferio-sur', 'franjas-verticales', 'tres-franjas'],
  Chile: ['america', 'sudamerica', 'habla-espanol', 'capital-hemisferio-sur', 'franjas-horizontales', 'estrella'],
  'Estados Unidos': ['america', 'mas-100-millones', 'franjas-horizontales', 'estrella'],
};

const traitsFor = (label) => BY_LABEL[label].map((id) => ({ id, question: TRAITS[id] }));
const unchanged = ({ content, updatedAt, version, ...rest }) => rest;
const withoutTraits = (content) => content.map(({ traits, ...card }) => card);

function checkDataset() {
  for (const ids of Object.values(BY_LABEL)) for (const id of ids) assert.ok(TRAITS[id], `Rasgo desconocido: ${id}`);
  // Cada país debe distinguirse de los demás solo con los rasgos.
  const keys = Object.values(BY_LABEL).map((ids) => [...ids].sort().join('|'));
  assert.equal(new Set(keys).size, keys.length, 'Dos países tienen exactamente los mismos rasgos');
  // Y cada rasgo debe separar: lo tienen algunos países, no todos.
  const total = Object.keys(BY_LABEL).length;
  for (const id of Object.keys(TRAITS)) {
    const count = Object.values(BY_LABEL).filter((ids) => ids.includes(id)).length;
    assert.ok(count > 0 && count < total, `El rasgo ${id} no separa a ningún país`);
  }
}

async function main() {
  checkDataset();
  const envFile = args.includes('--env-file') ? option('--env-file') : null;
  const env = envFile ? parse(readFileSync(envFile)) : process.env;
  assert.ok(env.MONGODB_URI, 'Falta MONGODB_URI');
  const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const games = client.db().collection('games');
    const before = await games.findOne(target);
    assert.ok(before, 'No se encontró la actividad esperada');
    assert.equal(before.status, 'PUBLISHED');
    const labels = before.content.map((card) => card.label);
    assert.deepEqual([...labels].sort(), Object.keys(BY_LABEL).sort(), 'Las tarjetas cambiaron; revisar antes de actualizar');

    const content = before.content.map((card) => ({ ...card, traits: traitsFor(card.label) }));
    if (JSON.stringify(before.content) === JSON.stringify(content)) {
      console.log(JSON.stringify({ status: 'already_updated', id: before._id, slug: before.slug }));
      return;
    }
    assert.ok(before.content.every((card) => !('traits' in card)), 'Algunas tarjetas ya tienen rasgos distintos; revisar antes de actualizar');

    if (!args.includes('--apply')) {
      console.log(JSON.stringify({ status: 'preview', id: before._id, slug: before.slug, questions: TRAITS }, null, 2));
      console.table(Object.fromEntries(content.map((card) => [card.label, Object.fromEntries(Object.keys(TRAITS).map((id) => [id, BY_LABEL[card.label].includes(id) ? 'Sí' : '']))])));
      return;
    }
    assert.ok(args.includes('--backup') && option('--backup'), 'Se requiere --backup');
    writeFileSync(option('--backup'), BSON.EJSON.stringify(before, null, 2, { relaxed: false }), { flag: 'wx', mode: 0o600 });
    const result = await games.updateOne({
      ...target,
      status: before.status,
      version: before.version === undefined ? { $exists: false } : before.version,
      updatedAt: before.updatedAt === undefined ? { $exists: false } : before.updatedAt,
    }, {
      $set: { content, updatedAt: new Date() },
      $inc: { version: 1 },
    });
    assert.equal(result.matchedCount, 1, 'El registro cambió concurrentemente; no se actualizó');
    assert.equal(result.modifiedCount, 1);
    const after = await games.findOne({ _id: before._id });
    assert.equal(after.version, (before.version ?? 0) + 1);
    assert.deepEqual(withoutTraits(after.content), before.content, 'Cambió un dato de las tarjetas ajeno a los rasgos');
    assert.deepEqual(unchanged(after), unchanged(before), 'Cambió un campo ajeno al cambio solicitado');
    console.log(JSON.stringify({ status: 'verified', modifiedCount: result.modifiedCount, id: after._id, slug: after.slug, cardsWithTraits: after.content.length, otherGameFieldsUnchanged: true }));
  } finally {
    await client.close();
  }
}

main().catch(error => {
  // Los errores de conexión pueden contener credenciales: no imprimir su mensaje.
  console.error(JSON.stringify({ status: 'failed', type: error.name, code: error.code, message: error.name === 'AssertionError' ? error.message : 'Operación fallida; detalles de conexión omitidos.' }));
  process.exitCode = 1;
});
