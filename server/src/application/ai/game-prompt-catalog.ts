import type { GameTypeName } from '../../domain/value-objects/game-type.vo.js';
import { DOMINO_ICON_CATALOG } from './domino-icon-catalog.js';
import { DUO_LEVEL_DEFS } from '../../domain/duo-logico/shared/levels/index.js';

/**
 * Instrucciones + forma de JSON esperada por cada `gameType` (y, para
 * MEMORY_MATCH, por `mode`) soportado por el asistente de IA. Se construyen a
 * partir de las interfaces que ya definen los `content-validators` (misma
 * fuente de verdad, sin duplicar reglas) — agregar un tipo de juego nuevo al
 * asistente es agregar una entrada acá, nada más.
 */
export interface GamePromptSpec {
  /** Instrucciones para el modelo: qué debe producir y con qué criterio pedagógico. */
  instructions: string;
  /** Ejemplo de la forma exacta de JSON esperada (se incluye literal en el prompt). */
  jsonShapeExample: string;
  /**
   * Cuando el tipo de juego necesita una imagen por elemento (Quién Es,
   * Parejas): si el usuario sube sus imágenes, SON ESAS las que se usan y la
   * IA solo las organiza — les asigna un concepto y arma el contenido,
   * referenciándolas por índice (`imageIndex`) en vez de por URL, para no
   * depender de que el modelo "recuerde" URLs reales. Si no sube ninguna, la
   * IA arma el contenido con el tema y se le consigue o crea una imagen por
   * elemento (ver `textOnlyInstructions` y `ContentImageResolver`).
   * `null` significa que el juego no necesita este flujo (o porque no usa
   * imágenes, o porque son opcionales y se agregan a mano después, como en
   * Opuestos).
   */
  imageRequirement: {
    min: number;
    max: number;
    /**
     * `false` desactiva el bloqueo estricto de "menos de `min` imágenes es un
     * error" (issue #208, Quién Es) — `min` pasa a ser solo una
     * recomendación para la instrucción/UI, nunca una cantidad exacta
     * obligatoria: el usuario puede subir menos (completa el resto a mano
     * después) sin importar cómo las subió (sueltas, o dentro de un
     * PDF/Word con varias fotos adentro). `max` SIEMPRE se sigue exigiendo
     * como tope. Por defecto (`undefined`) se comporta como `true`: bloqueo
     * estricto de siempre.
     *
     * Sin NINGUNA imagen (issue #238) ya no es un error si el usuario
     * escribió el tema en `message` (o subió un documento con texto): la IA
     * genera el contenido completo con `textOnlyInstructions`/
     * `textOnlyJsonShapeExample` de abajo y consigue o crea ella misma las
     * imágenes (issues #240/#21) — sin mensaje ni documento, sigue siendo
     * obligatorio al menos un archivo.
     */
    enforceMinimum?: boolean;
  } | null;
  /** Carpeta de Cloudinary donde subir las imágenes de contenido (mismas que usa la subida manual). */
  contentImageFolder?: string;
  /**
   * Tipos sin `imageRequirement` cuyas imágenes son opcionales (Opuestos):
   * después de generar el contenido, se completan solas con
   * `ContentImageFiller` (issue #75) a partir del `imageQuery`, `emoji` y
   * `color` que propone el modelo para cada lado.
   */
  fillsMissingImages?: boolean;
  /**
   * Solo relevante cuando `imageRequirement` no es `null`: instrucciones
   * alternativas para cuando el usuario no subió NINGUNA imagen (ni suelta
   * ni incrustada en un PDF/Word) pero sí escribió un tema en `message` o
   * subió un documento con texto (issue #238). La IA genera el contenido
   * completo (labels/info/config) solo con ese texto, sin `imageIndex` ni
   * `imageUrl`, y con un `imageQuery` (búsqueda de una foto libre), un
   * `emoji` y un `color` por elemento: el caso de uso busca la foto (issue
   * #240) y, si no hay, crea una ilustración básica con ese emoji y color
   * (issue #21). `undefined` en tipos sin `imageRequirement` (nunca se usa ahí).
   */
  textOnlyInstructions?: string;
  /** Forma de JSON esperada junto con `textOnlyInstructions` (con `imageQuery`/`emoji`/`color`, sin `imageIndex`/`imageUrl`). */
  textOnlyJsonShapeExample?: string;
}

function catalogKey(gameType: GameTypeName, mode?: string): string {
  return mode ? `${gameType}:${mode}` : gameType;
}

const DOMINO_SPEC: GamePromptSpec = {
  instructions: `Genera el contenido de un juego de Dominó educativo a partir del texto fuente.
Extrae entre 6 y 10 conceptos clave del texto (términos, personajes, fechas, eventos — lo que
tenga más sentido para el tema). Cada concepto necesita una "label" corta (máximo 60 caracteres)
y un color hexadecimal distinto y armonioso para cada uno. Para "icon" elige UNA clave de esta
lista, la que mejor represente el SIGNIFICADO del concepto (no inventes claves):
${DOMINO_ICON_CATALOG.join(', ')}.
Reglas de íconos: cada concepto lleva un ícono distinto; evita "star" y "heart" (y "smile") salvo que el
concepto trate justamente de eso; piensa qué objeto o escena lo evoca (bien: Evaporación -> "sun", Condensación -> "cloud",
Precipitación -> "cloudRain", Bastilla -> "building", Fracción -> "pizza"; mal: usar "star" o "heart" porque no se te ocurre otro).

Además, CADA concepto lleva material para los tres niveles del juego (todos son obligatorios):
- "definition": una frase clara que defina el concepto (máximo 300 caracteres). Nivel Fácil.
- "example": un ejemplo cotidiano y sencillo, pensado para niños (máximo 300 caracteres). Nivel Fácil.
- "application": un CASO concreto donde se aplica, para nivel universitario (máximo 400 caracteres).
  Nivel Universitario: sin este caso el nivel no queda disponible, así que NUNCA lo omitas.
  Debe ser una SITUACIÓN de 1 a 3 frases con quién (una persona, comunidad o institución), qué problema o hecho
  ocurre y cómo se conecta con el concepto. NO es una definición ni una generalidad.
  Bien: "Una agricultora nota que su huerta se seca al mediodía y decide regar de noche para que el sol evapore menos agua."
  Mal: "En la modelación climática, la evaporación de los océanos se cuantifica para estimar el balance hídrico." (suena a definición)
- "questions": entre 2 y 3 preguntas distintas sobre ESE concepto (nunca más de 6; la primera es obligatoria).
  Cada pregunta lleva "levels": lista con "MEDIUM" (Intermedio: comprensión directa del concepto),
  "ADVANCED" (Universitario: aplicación o análisis del caso de "application") o ambos. Cada concepto debe
  tener AL MENOS una pregunta que incluya "MEDIUM" y AL MENOS una que incluya "ADVANCED"; una misma pregunta
  puede servir para ambos (["MEDIUM","ADVANCED"]). Las de "ADVANCED" deben apoyarse en el caso, sin inventar datos.
  Varía el tipo: una conceptual (MEDIUM), una de identificación (ambos) y una de aplicación (ADVANCED). Cada pregunta tiene
  "text" (máximo 300 caracteres), "options" (SIEMPRE 4 opciones distintas, máximo 120 caracteres cada una),
  "correctIndex" (posición 0 a 3 de la opción correcta; el servidor mezcla las opciones después) y
  "explanation" (por qué es correcta, máximo 400 caracteres).
  Calidad de las preguntas:
  - Los distractores deben ser plausibles y de la MISMA categoría que la respuesta (si la correcta es una fecha,
    todas son fechas; si es un personaje, todos son personajes), con longitud parecida. Evita opciones absurdas
    como "Luna / Marte / Satélite" para "¿Cuál orbita alrededor del Sol?".
  - Las 4 opciones tienen una longitud SIMILAR (la más larga no debe pasar del doble de la más corta) y la
    respuesta correcta NO debe ser la más larga ni la más detallada: si necesita más palabras, agrégaselas también
    a los distractores o acorta la correcta.
  - Las 4 opciones deben significar cosas DISTINTAS: ningún distractor es sinónimo o reformulación de la respuesta
    ni de otro distractor. Mal: "Se congela" y "Se vuelve hielo" en la misma pregunta (dicen lo mismo).
    Bien: "Se evapora", "Se congela", "Se condensa", "Se filtra" (cuatro procesos diferentes).
  - La explicación debe confirmar la opción correcta y nunca contradecirla ni a la pregunta.
  - Si el mensaje del usuario indica un nivel (primaria, colegio, universidad), ajusta la dificultad y el
    vocabulario de las preguntas a ese nivel.
  - No inventes fuentes, citas, cifras ni fechas. Si no estás seguro de un dato, prefiere una pregunta
    conceptual en vez de una de datos exactos. Solo hechos verificables a partir del texto fuente o de
    conocimiento bien establecido; nada dudoso.
Recuerda: un ícono distinto y con significado para cada concepto (sin "star" ni "heart" de relleno).`,
  jsonShapeExample: `{
  "config": { "handSize": 7 },
  "content": [
    {
      "label": "Fotosíntesis", "icon": "sprout", "color": "#22c55e",
      "definition": "Proceso por el que las plantas convierten luz, agua y dióxido de carbono en azúcar y oxígeno.",
      "example": "Una planta en la ventana que crece gracias a la luz del sol.",
      "application": "Una productora de lechuga nota que sus plantas crecen lento en el invernadero y decide aumentar la luz y el CO2 para que hagan más fotosíntesis.",
      "questions": [
        { "text": "¿Qué gas liberan las plantas durante la fotosíntesis?", "options": ["Oxígeno", "Nitrógeno", "Metano", "Helio"], "correctIndex": 0, "levels": ["MEDIUM"], "explanation": "La fotosíntesis produce azúcar y libera oxígeno." },
        { "text": "¿De dónde obtiene la planta la energía para la fotosíntesis?", "options": ["Del viento", "De la luz del sol", "De las rocas", "De la luna"], "correctIndex": 1, "levels": ["MEDIUM", "ADVANCED"], "explanation": "La luz aporta la energía que impulsa el proceso." },
        { "text": "En el invernadero del caso, ¿qué ajuste aumenta la producción de lechuga?", "options": ["Subir la luz y el CO2", "Apagar todas las lámparas", "Cubrir el invernadero con tela negra", "Quitar el CO2 del aire"], "correctIndex": 0, "levels": ["ADVANCED"], "explanation": "Más luz y CO2 elevan la fotosíntesis, como describe el caso." }
      ]
    },
    { "label": "Clorofila", "icon": "leaf", "color": "#16a34a",
      "definition": "Pigmento verde de las plantas que absorbe la luz.",
      "example": "Por la clorofila las hojas se ven verdes.",
      "application": "Un agricultor ve que las hojas de su cafetal se ponen amarillas y concluye que les falta clorofila por falta de nutrientes.",
      "questions": [
      { "text": "¿Qué pigmento da el color verde a las hojas?", "options": ["Clorofila", "Hemoglobina", "Melanina", "Queratina"], "correctIndex": 0, "levels": ["MEDIUM", "ADVANCED"], "explanation": "La clorofila absorbe la luz y refleja el verde." }
    ] }
  ]
}`,
  imageRequirement: null,
};

const MAZE_COLLECTOR_SPEC: GamePromptSpec = {
  instructions: `Genera el contenido de un juego de laberinto recolector educativo a partir del texto
fuente. Extrae entre 4 y 16 objetos/conceptos temáticos del texto, cada uno con "label" corta
(máximo 60 caracteres), un "color" hexadecimal, y opcionalmente un "fact" (dato educativo breve,
máximo 200 caracteres) que resuma por qué ese concepto importa. Para "icon" usa siempre el valor
"star". También define "collectorLabel"/"enemyLabel" (nombres temáticos cortos acordes al tema del
texto, ej. si el texto es sobre reciclaje: collectorLabel="Camión reciclador", enemyLabel="Nube de
contaminación") y usa "star" también para "collectorIcon"/"enemyIcon". Deja "layout":"CLASSIC",
"lives":3 y "enemySpeed":2 salvo que el texto sugiera claramente otra cosa.`,
  jsonShapeExample: `{
  "config": {
    "layout": "CLASSIC", "lives": 3, "enemySpeed": 2,
    "collectorLabel": "Camión reciclador", "collectorIcon": "star",
    "enemyLabel": "Nube de contaminación", "enemyIcon": "star"
  },
  "content": [
    { "label": "Vidrio", "icon": "star", "color": "#3b82f6", "fact": "Tarda miles de años en degradarse." }
  ]
}`,
  imageRequirement: null,
};

const TRUE_FALSE_MAZE_SPEC: GamePromptSpec = {
  instructions: `Genera un laberinto de Verdadero o Falso educativo. La fuente puede ser un texto, la
descripción de imágenes que subió el usuario, o solo el tema que escribió: si no hay texto fuente,
apóyate en las instrucciones del usuario y en hechos bien establecidos del tema.

CONTENIDO ("content"): escribe entre 8 y 15 afirmaciones ("statement", entre 5 y 160 caracteres)
que se puedan juzgar como verdaderas o falsas con lo que dice la fuente: cada una afirma UNA sola
idea, sin dobles negaciones ni trampas de redacción. Mezcla verdaderas y falsas en proporción
parecida (nunca todas iguales); las falsas deben ser errores plausibles que un estudiante podría
creer, no absurdos. "answer" es true o false (booleano, nunca texto). Agrega "explanation"
(máximo 240 caracteres) que explique por qué la afirmación es verdadera, o cuál es el dato
correcto si es falsa. Si el usuario pide una cantidad concreta de afirmaciones, respétala (mínimo
3, máximo 30).

PARÁMETROS DE LA PARTIDA ("config"): ajústalos a lo que pida el usuario (nivel, edad o
dificultad); si no dice nada, usa los valores del ejemplo.
- "lives": vidas del robot, entero de 1 a 5 (más vidas = más fácil).
- "enemyCount": medusas en la nave, entero de 1 a 4.
- "enemySpeed": velocidad de las medusas, entero de 1 (lenta) a 3 (rápida).
- "relocateSeconds": cada cuánto cambian de lugar las salas VERDADERO/FALSO. SOLO uno de estos
  valores: 0 (solo al cambiar de pregunta), 30 (tranquilo), 20 (recomendado) o 12 (frenético).
- "shuffleQuestions": true para barajar el orden de las preguntas en cada partida.
- "lightsOut": true activa apagones donde solo se ve alrededor del robot; ponlo en false para
  niños pequeños o nivel fácil.
- "skin": siempre "NAVE_ESPACIAL".
Guía de dificultad. FÁCIL (primaria, "fácil", "para niños"): lives 5, enemyCount 1, enemySpeed 1,
relocateSeconds 0, lightsOut false. MEDIO (por defecto): los valores del ejemplo. DIFÍCIL
(bachillerato, universidad, "difícil", "reto"): lives 2, enemyCount 4, enemySpeed 3,
relocateSeconds 12, lightsOut true.`,
  jsonShapeExample: `{
  "config": {
    "skin": "NAVE_ESPACIAL", "lives": 3, "enemyCount": 3, "enemySpeed": 2,
    "relocateSeconds": 20, "shuffleQuestions": true, "lightsOut": true
  },
  "content": [
    { "statement": "Las plantas producen oxígeno durante la fotosíntesis.", "answer": true, "explanation": "La fotosíntesis libera oxígeno como subproducto." },
    { "statement": "La fotosíntesis ocurre en las mitocondrias.", "answer": false, "explanation": "Ocurre en los cloroplastos; las mitocondrias hacen la respiración celular." }
  ]
}`,
  imageRequirement: null,
};

const SNAKES_LADDERS_SPEC: GamePromptSpec = {
  instructions: `Genera el contenido de un juego de Escaleras y Serpientes educativo a partir del
texto fuente. Primero define "boardSize" (entero entre 25 y 40), y una lista de "ladders"
(escaleras, "to" > "from") y "snakes" (serpientes, "to" < "from") usando casillas entre 2 y
boardSize-1, sin que ninguna casilla se repita como origen. Luego, en "content", genera una
pregunta de opción múltiple (con "prompt", entre 2 y 6 "options" y "correctOptionIndex") basada en
el texto fuente para CADA escalera y CADA serpiente que declaraste (con el "cellNumber" y
"triggerType" LADDER o SNAKE correspondiente a su casilla de origen), más al menos 5 preguntas
adicionales de "triggerType":"CELL" en otras casillas normales del tablero. Todas las preguntas
deben evaluar contenido real extraído del texto fuente, nunca trivia genérica.`,
  jsonShapeExample: `{
  "config": {
    "boardSize": 30, "turnDurationSeconds": 45,
    "ladders": [{ "from": 4, "to": 14 }],
    "snakes": [{ "from": 20, "to": 8 }]
  },
  "content": [
    { "cellNumber": 4, "triggerType": "LADDER", "prompt": "¿...?", "options": ["A", "B"], "correctOptionIndex": 0 },
    { "cellNumber": 20, "triggerType": "SNAKE", "prompt": "¿...?", "options": ["A", "B"], "correctOptionIndex": 1 },
    { "cellNumber": 7, "triggerType": "CELL", "prompt": "¿...?", "options": ["A", "B", "C"], "correctOptionIndex": 2 }
  ]
}`,
  imageRequirement: null,
};

/**
 * Preguntas guiadas de ¿Quién Es? (issue #58): rasgos verificables del tema
 * que reemplazan a las preguntas por letras del nombre. Van en las dos
 * versiones del prompt (con y sin imágenes del usuario).
 */
const GUESS_WHO_TRAITS_INSTRUCTIONS = `PREGUNTAS GUIADAS: durante la partida los jugadores se hacen preguntas de Sí/No para descubrir la
tarjeta secreta del rival, y esas preguntas salen de los rasgos que escribas aquí. El objetivo es APRENDER:
las preguntas deben exigir saber del tema, NO describir lo que se ve en la imagen (nada de colores, formas o
"¿tiene un X dibujado?"). En "config.traits" escribe entre 15 y 25 rasgos, cada uno con un "id" corto
(minúsculas y guiones, ej. "independencia-siglo-19"), una "question" de Sí/No con signos ¿? (máximo 140
caracteres) y una "category" corta que agrupe preguntas del mismo tipo, usando al menos 4 categorías
distintas (ej. para países: "Historia", "Cultura", "Deporte", "Geografía"; para dinosaurios: "Época",
"Alimentación", "Anatomía", "Descubrimiento"). Ejemplos de nivel esperado: "¿Se independizó antes de 1850?",
"¿Su selección de fútbol ganó un Mundial antes de 2026?", "¿Vivió en el período Cretácico?", "¿Sus fósiles
se descubrieron en Norteamérica?". Si hay texto fuente (documentos del usuario), saca los rasgos de ese texto,
para que las preguntas repasen lo que se está estudiando. Cada rasgo debe ser verdadero para ALGUNAS tarjetas
pero no para todas, y entre todos deben permitir distinguir cada tarjeta de las demás. Luego, en cada
tarjeta, "traits" lista los ids de TODOS los rasgos que son verdaderos para esa tarjeta (lista vacía si
ninguno). Revisa cada marca: una marca equivocada hace que el juego dé una respuesta falsa. Usa solo datos
objetivos, verificables y estables: nada de opiniones ni de datos que cambian con el tiempo (resultados
deportivos recientes, cifras que rondan el límite, gobernantes actuales); si un dato depende de la fecha,
fíjala en la pregunta (ej. "antes de 2026").`;

const GUESS_WHO_SPEC: GamePromptSpec = {
  instructions: `Genera el contenido de un juego de "¿Quién Es?" a partir de las imágenes que subió el
usuario (y del texto fuente, si lo hay, como contexto adicional del tema). El usuario ya subió sus
propias imágenes — nunca inventes una URL: cada tarjeta debe referenciar la imagen que le
corresponde con "imageIndex" (el número de imagen, 0-based, de la lista "Imágenes disponibles" de
abajo). Genera EXACTAMENTE una tarjeta por cada imagen disponible, usando cada índice de imagen
UNA sola vez (nunca repitas un imageIndex ni dejes uno sin usar). Para cada imagen, escribe un
"label" corto (máximo 120 caracteres) que identifique con precisión lo que muestra esa imagen
específica (ej. si es la bandera de un país, el nombre de ese país) — basándote en la descripción
de esa imagen. Además, agrega un "info" (dato breve y curioso, máximo 280 caracteres) sobre el tema
específico de esa tarjeta — ej. si es la bandera de un país, un dato interesante de ese país
(capital, población, algo llamativo); si el tema no tiene un dato "de manual" tan obvio, igual
escribe algo breve y relevante sobre ese elemento puntual. Este dato se muestra como una burbuja de
información dentro de la tarjeta durante la partida. No agregues "imageUrl" ni "audioUrl", solo
"imageIndex", "label", "info" y "traits".

${GUESS_WHO_TRAITS_INSTRUCTIONS}`,
  jsonShapeExample: `{
  "config": {
    "maxAccusationCount": 6,
    "turnDurationSeconds": 15,
    "traits": [
      { "id": "habla-espanol", "question": "¿La mayoría de su población habla español?", "category": "Cultura" },
      { "id": "mundial-antes-2026", "question": "¿Su selección ganó un Mundial de fútbol antes de 2026?", "category": "Deporte" }
    ]
  },
  "content": [
    { "imageIndex": 0, "label": "Argentina", "info": "Su capital es Buenos Aires y es el país de habla hispana más grande del mundo.", "traits": ["habla-espanol", "mundial-antes-2026"] },
    { "imageIndex": 1, "label": "Brasil", "info": "Es el único país de Sudamérica cuyo idioma oficial es el portugués.", "traits": ["mundial-antes-2026"] }
  ]
}`,
  imageRequirement: { min: 12, max: 60, enforceMinimum: false },
  contentImageFolder: 'guess-who-cards',
  textOnlyInstructions: `Genera el contenido de un juego de "¿Quién Es?" a partir ÚNICAMENTE del tema que
describe el usuario — el usuario no subió imágenes. Genera entre 12 y 20 tarjetas razonables para ese tema (ni menos de
12, ni más de 20). Para cada tarjeta escribe un "label" corto (máximo 120 caracteres) que identifique con
precisión un elemento concreto y distinto del tema (ej. si el tema es "banderas de Sudamérica", cada label es
el nombre de un país distinto de esa región) y un "info" (dato breve y curioso, máximo 280 caracteres) sobre
ese elemento puntual — mismo criterio que si hubiera imágenes. Elige elementos que tengan una imagen
reconocible (personas, lugares, animales, objetos, banderas…), porque cada tarjeta se juega viendo su imagen.
Si el usuario pide una cantidad concreta de tarjetas, respétala (mínimo 12 recomendado, máximo 60).
Además, para cada elemento escribe tres campos para conseguirle su imagen automáticamente:
(1) "imageQuery": una búsqueda corta EN INGLÉS (2 a 6 palabras) para encontrar en Wikipedia/Wikimedia Commons
una foto o ilustración real que represente ese elemento concreto sin ambigüedad (ej. "Flag of Argentina",
"Bald eagle", "Eiffel Tower", "Right triangle diagram");
(2) "emoji": UN solo emoji que represente ese elemento (ej. 🦅, 🗼, 📐; para una bandera, el emoji de esa bandera).
Cada elemento debe llevar un emoji DISTINTO (nunca repitas uno), porque las tarjetas no deben verse iguales;
(3) "color": un color hexadecimal claro y agradable (ej. "#bae6fd") para el fondo de su ilustración.
Si no se encuentra una foto real, se crea una ilustración básica con ese emoji y ese color.
NO incluyas "imageIndex" ni "imageUrl" en ningún elemento.

${GUESS_WHO_TRAITS_INSTRUCTIONS}`,
  textOnlyJsonShapeExample: `{
  "config": {
    "maxAccusationCount": 6,
    "turnDurationSeconds": 15,
    "traits": [
      { "id": "habla-espanol", "question": "¿La mayoría de su población habla español?", "category": "Cultura" },
      { "id": "mundial-antes-2026", "question": "¿Su selección ganó un Mundial de fútbol antes de 2026?", "category": "Deporte" }
    ]
  },
  "content": [
    { "label": "Argentina", "info": "Su capital es Buenos Aires y es el país de habla hispana más grande del mundo.", "imageQuery": "Flag of Argentina", "emoji": "🇦🇷", "color": "#bae6fd", "traits": ["habla-espanol", "mundial-antes-2026"] },
    { "label": "Brasil", "info": "Es el único país de Sudamérica cuyo idioma oficial es el portugués.", "imageQuery": "Flag of Brazil", "emoji": "🇧🇷", "color": "#bbf7d0", "traits": ["mundial-antes-2026"] }
  ]
}`,
};

const MEMORY_MATCH_PAIRS_SPEC: GamePromptSpec = {
  instructions: `Genera el contenido de un juego de memoria (parejas imagen-concepto) a partir de las
imágenes que subió el usuario (y del texto fuente, si lo hay, como contexto adicional del tema). El
usuario ya subió sus propias imágenes — nunca inventes una URL: cada pareja debe referenciar su
imagen con "imageIndex" (el número de imagen, 0-based, de la lista "Imágenes disponibles" de abajo).
Genera EXACTAMENTE una pareja por cada imagen disponible, usando cada índice de imagen UNA sola vez.
Para cada imagen, escribe un "label" corto (máximo 120 caracteres) que nombre con precisión el
concepto que muestra esa imagen específica, basándote en su descripción. No agregues "imageUrl",
solo "imageIndex" y "label".`,
  jsonShapeExample: `{
  "config": { "mode": "PAIRS", "perZone": 8, "timePerZoneSeconds": 90, "previewSeconds": 5 },
  "content": [
    { "imageIndex": 0, "label": "Mitocondria" },
    { "imageIndex": 1, "label": "Núcleo celular" }
  ]
}`,
  imageRequirement: { min: 4, max: 40 },
  contentImageFolder: 'memory-cards',
  textOnlyInstructions: `Genera el contenido de un juego de memoria (parejas imagen-concepto) a partir
ÚNICAMENTE del tema que describe el usuario — el usuario no subió imágenes. Genera entre 4 y 10 conceptos razonables para
ese tema, cada uno con un "label" corto (máximo 120 caracteres) que nombre con precisión un concepto concreto
y distinto del tema, y que sea algo representable con una imagen real (ej. si el tema es "geometría
básica": "Triángulo", "Cubo", "Círculo" — no ideas abstractas sin forma visual clara). Si el usuario pide una
cantidad concreta de parejas, respétala (mínimo 4, máximo 40).
Además, para cada elemento escribe tres campos para conseguirle su imagen automáticamente:
(1) "imageQuery": una búsqueda corta EN INGLÉS (2 a 6 palabras) para encontrar en Wikipedia/Wikimedia Commons
una foto o ilustración real que represente ese elemento concreto sin ambigüedad (ej. "Flag of Argentina",
"Bald eagle", "Eiffel Tower", "Right triangle diagram");
(2) "emoji": UN solo emoji que represente ese elemento (ej. 🔺, 🧊, ⚪). Cada elemento debe llevar un
emoji DISTINTO (nunca repitas uno), porque las tarjetas no deben verse iguales;
(3) "color": un color hexadecimal claro y agradable (ej. "#fde68a") para el fondo de su ilustración.
Si no se encuentra una foto real, se crea una ilustración básica con ese emoji y ese color.
NO incluyas "imageIndex" ni "imageUrl" en ningún elemento.`,
  textOnlyJsonShapeExample: `{
  "config": { "mode": "PAIRS", "perZone": 8, "timePerZoneSeconds": 90, "previewSeconds": 5 },
  "content": [
    { "label": "Triángulo", "imageQuery": "Triangle geometry", "emoji": "🔺", "color": "#fecaca" },
    { "label": "Cubo", "imageQuery": "Cube geometric solid", "emoji": "🧊", "color": "#bae6fd" }
  ]
}`,
};

const MEMORY_MATCH_OPPOSITES_SPEC: GamePromptSpec = {
  instructions: `Genera el contenido de un juego de memoria de conceptos OPUESTOS a partir del texto
fuente. Extrae entre 4 y 10 parejas de conceptos contrapuestos del texto (ej. ácido/base,
antes/después de un evento, causa/efecto). Cada pareja necesita "posTitle" y "negTitle" (máximo 120
caracteres cada uno) y "posDescription"/"negDescription" (máximo 500 caracteres cada uno)
explicando brevemente cada lado. Incluye siempre "posImageUrl": null y "negImageUrl": null
(literalmente null, nunca un texto ni una URL inventada): las imágenes se consiguen después.
Para eso, en cada lado agrega "posImageQuery"/"negImageQuery" (búsqueda corta EN INGLÉS de una foto
que represente ese concepto, ej. "lemon acid"), "posEmoji"/"negEmoji" (UN emoji que lo represente) y
"posColor"/"negColor" (color de fondo claro en hexadecimal, ej. "#fde68a").`,
  jsonShapeExample: `{
  "config": { "mode": "OPPOSITES", "perZone": 8, "timePerZoneSeconds": 90, "previewSeconds": 5 },
  "content": [
    {
      "posTitle": "Ácido", "posDescription": "pH menor a 7...", "posImageUrl": null,
      "posImageQuery": "lemon acid", "posEmoji": "🍋", "posColor": "#fef08a",
      "negTitle": "Base", "negDescription": "pH mayor a 7...", "negImageUrl": null,
      "negImageQuery": "soap base alkaline", "negEmoji": "🧼", "negColor": "#bae6fd"
    }
  ]
}`,
  imageRequirement: null,
  contentImageFolder: 'memory-cards',
  fillsMissingImages: true,
};

/** Escenarios de Dúo Lógico, en el orden de la campaña (para el prompt). */
const DUO_LEVEL_LIST = DUO_LEVEL_DEFS.map((def) => `"${def.id}" (${def.title})`).join(', ');

const DUAL_QUEST_PIXI_SPEC: GamePromptSpec = {
  instructions: `Genera las preguntas de un juego "Dúo Lógico" a partir del texto fuente. Dos estudiantes
(Lumen y Gota) recorren escenarios y en cada "Puerta del Saber" responden una pregunta: solo avanzan
si los DOS aciertan. Los escenarios ya existen: ${DUO_LEVEL_LIST}.
1. En "config.levels" pon los ids de TODOS los escenarios, en ese orden.
2. En "content" escribe EXACTAMENTE 3 preguntas por escenario. Cada pregunta tiene un "concept" corto
   (el tema que une a los dos) y en "parts" una pregunta DISTINTA para cada personaje ("FIRE" es Lumen y
   "WATER" es Gota), cada una con su "prompt" y 4 "options". Las dos preguntas son del mismo concepto pero
   no iguales: cada jugador solo ve la suya.
3. En TODAS las listas de "options", la PRIMERA opción es la correcta (el juego las baraja). Las
   incorrectas deben ser plausibles y distintas entre sí.
4. Cada pregunta lleva "level" (el id del escenario), 2 "hints" cortas que ayudan sin dar la respuesta
   y una "explanation" breve de lo que se aprende.
5. Todo sale del texto fuente, en español, claro para estudiantes de colegio. Enunciados de máximo 150
   caracteres y opciones de máximo 80.`,
  jsonShapeExample: `{
  "config": { "levels": [${DUO_LEVEL_DEFS.map((def) => `"${def.id}"`).join(', ')}] },
  "content": [
    { "level": "bosque", "concept": "Concepto corto", "parts": { "FIRE": { "prompt": "¿Pregunta de Lumen?", "options": ["Correcta", "Incorrecta 1", "Incorrecta 2", "Incorrecta 3"] }, "WATER": { "prompt": "¿Otra pregunta, de Gota?", "options": ["Correcta", "Incorrecta 1", "Incorrecta 2", "Incorrecta 3"] } }, "hints": ["...", "..."], "explanation": "..." }
  ]
}`,
  imageRequirement: null,
};

const CATALOG: Record<string, GamePromptSpec> = {
  [catalogKey('DOMINO')]: DOMINO_SPEC,
  [catalogKey('MAZE_COLLECTOR')]: MAZE_COLLECTOR_SPEC,
  [catalogKey('SNAKES_LADDERS')]: SNAKES_LADDERS_SPEC,
  [catalogKey('GUESS_WHO')]: GUESS_WHO_SPEC,
  [catalogKey('MEMORY_MATCH', 'PAIRS')]: MEMORY_MATCH_PAIRS_SPEC,
  [catalogKey('MEMORY_MATCH', 'OPPOSITES')]: MEMORY_MATCH_OPPOSITES_SPEC,
  [catalogKey('DUAL_QUEST_PIXI')]: DUAL_QUEST_PIXI_SPEC,
  [catalogKey('TRUE_FALSE_MAZE')]: TRUE_FALSE_MAZE_SPEC,
};

export function resolveGamePromptSpec(gameType: string, mode?: string): GamePromptSpec | null {
  return CATALOG[catalogKey(gameType as GameTypeName, mode)] ?? null;
}
