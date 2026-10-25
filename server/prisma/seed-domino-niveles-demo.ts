import 'dotenv/config';
import { MongoClient } from 'mongodb';

/**
 * Siembra un Dominexo de demostración con contenido para los tres niveles
 * (Fácil, Intermedio y Universitario): cada concepto trae `definition` y
 * `example` (Fácil), `questions` (Intermedio, 3 por concepto) y `application` (Universitario).
 *
 * Sirve para probar el flujo de niveles de punta a punta sin depender del
 * agente de IA de creación. Es idempotente: correrlo dos veces no duplica el
 * juego (upsert por slug).
 *
 * Uso: npm run db:seed:domino-niveles-demo
 */

const SLUG = 'dominexo-niveles-demo';
const GAME_ID = 'seed-dominexo-niveles-demo';

type Question = { text: string; options: string[]; correctIndex: number; explanation: string };
type Concept = {
  conceptId: string;
  label: string;
  icon: string;
  color: string;
  definition: string;
  example: string;
  /** Banco de preguntas (el servidor las rota para no repetir). */
  questions: Question[];
  application: string;
};

const CONCEPTS: Concept[] = [
  {
    conceptId: 'concept-0',
    label: 'Paneles Solares',
    icon: 'sun',
    color: '#f59e0b',
    definition: 'Dispositivos que convierten la luz del sol en electricidad usando celdas fotovoltaicas.',
    example: 'El techo de una escuela con paneles que alimentan sus luces y computadores.',
    questions: [
      {
        text: '¿Qué convierten los paneles solares en electricidad?',
        options: ['El viento', 'La luz del sol', 'El agua de lluvia', 'El calor de la tierra'],
        correctIndex: 1,
        explanation: 'Las celdas fotovoltaicas transforman la luz del sol en electricidad y no necesitan quemar combustibles.',
      },
      {
        text: '¿Cuál de estos aparatos funciona con paneles solares?',
        options: ['Una calculadora solar', 'Una estufa de leña', 'Una vela', 'Un molino de agua'],
        correctIndex: 0,
        explanation: 'Las calculadoras solares tienen una pequeña celda fotovoltaica que les da la energía para funcionar.',
      },
      {
        text: 'Una finca sin red eléctrica quiere bombear agua de día. ¿Qué le conviene instalar?',
        options: ['Paneles solares', 'Una chimenea', 'Un generador de carbón', 'Más bombillos'],
        correctIndex: 0,
        explanation: 'Los paneles producen electricidad justo cuando hay sol, que es cuando se necesita bombear el agua.',
      },
    ],
    application:
      'Una escuela rural sin red eléctrica estable necesita iluminar sus aulas y cargar computadores durante el día: los paneles generan la electricidad en el mismo sitio, justo cuando hay clases.',
  },
  {
    conceptId: 'concept-1',
    label: 'Zonas Verdes',
    icon: 'leaf',
    color: '#22c55e',
    definition: 'Espacios con árboles, plantas y césped dentro de la ciudad, como parques y jardines.',
    example: 'Un parque del barrio donde los niños juegan bajo la sombra de los árboles.',
    questions: [
      {
        text: '¿Cuál es un beneficio de las zonas verdes en la ciudad?',
        options: [
          'Aumentan el ruido del tráfico',
          'Consumen más energía eléctrica',
          'Producen más basura',
          'Reducen el calor y mejoran el aire',
        ],
        correctIndex: 3,
        explanation: 'Los árboles dan sombra, enfrían el ambiente y atrapan parte del dióxido de carbono y del polvo del aire.',
      },
      {
        text: '¿Cuál de estos lugares es una zona verde?',
        options: ['Un parque con árboles', 'Un parqueadero', 'Una bodega', 'Una autopista'],
        correctIndex: 0,
        explanation: 'Los parques y jardines tienen árboles, plantas y césped: son las zonas verdes de una ciudad.',
      },
      {
        text: 'En una tarde muy calurosa, ¿dónde se siente más fresco el ambiente?',
        options: ['Sobre el asfalto', 'Junto a una pared de concreto', 'Bajo los árboles de un parque'],
        correctIndex: 2,
        explanation: 'Los árboles dan sombra y liberan vapor de agua, por eso el aire bajo ellos es más fresco.',
      },
    ],
    application:
      'En una ciudad con olas de calor, un barrio sin árboles es varios grados más caliente que uno con parques: sembrar zonas verdes baja la temperatura y mejora la calidad del aire.',
  },
  {
    conceptId: 'concept-2',
    label: 'Movilidad Eléctrica',
    icon: 'zap',
    color: '#3b82f6',
    definition: 'Uso de vehículos movidos por electricidad, como bicicletas, buses y carros eléctricos.',
    example: 'Un bus eléctrico que recorre la ciudad sin soltar humo por el escape.',
    questions: [
      {
        text: '¿Qué sale por el escape de un bus eléctrico?',
        options: ['Humo negro', 'Vapor de agua', 'Nada: no tiene escape', 'Gases de petróleo'],
        correctIndex: 2,
        explanation: 'Los vehículos eléctricos no queman combustible, por eso no tienen escape ni emiten gases mientras circulan.',
      },
      {
        text: '¿Cuál de estos vehículos es un ejemplo de movilidad eléctrica?',
        options: ['Una bicicleta eléctrica', 'Una moto de gasolina', 'Un camión diésel'],
        correctIndex: 0,
        explanation: 'La bicicleta eléctrica usa un motor y una batería en lugar de quemar combustible.',
      },
      {
        text: 'Para que un carro eléctrico recupere su energía, ¿qué necesita?',
        options: ['Llenar el tanque de gasolina', 'Cambiar el aceite', 'Cargar su batería'],
        correctIndex: 2,
        explanation: 'Los carros eléctricos guardan la energía en una batería, que se recarga conectándola a la electricidad.',
      },
    ],
    application:
      'Una ciudad con aire contaminado por el tráfico cambia sus buses diésel por eléctricos: bajan las emisiones locales y el ruido, y el efecto total depende de cómo se genere esa electricidad.',
  },
  {
    conceptId: 'concept-3',
    label: 'Reciclaje',
    icon: 'recycle',
    color: '#14b8a6',
    definition: 'Proceso de convertir residuos usados en materiales nuevos para no tirarlos.',
    example: 'Separar botellas de plástico, papel y vidrio en canecas de distintos colores.',
    questions: [
      {
        text: '¿Cuál de estos residuos va en la caneca de reciclaje de papel y cartón?',
        options: ['Una caja de cartón limpia', 'Restos de comida', 'Una pila usada', 'Un pañal'],
        correctIndex: 0,
        explanation: 'El papel y el cartón limpios y secos se reciclan; los restos de comida, las pilas y los pañales tienen otro manejo.',
      },
      {
        text: '¿En qué consiste reciclar?',
        options: ['Quemar la basura', 'Convertir residuos usados en materiales nuevos', 'Enterrar todo lo que se usa', 'Comprar productos nuevos'],
        correctIndex: 1,
        explanation: 'Reciclar es transformar los residuos en materia prima para fabricar nuevos productos y generar menos basura.',
      },
      {
        text: 'Una escuela junta muchas botellas de plástico. ¿Qué es lo más adecuado hacer con ellas?',
        options: ['Tirarlas al río', 'Quemarlas en el patio', 'Entregarlas a un punto de reciclaje'],
        correctIndex: 2,
        explanation: 'En un punto de reciclaje el plástico se recoge y se transforma en material nuevo, en vez de contaminar.',
      },
    ],
    application:
      'Un colegio genera cada semana cientos de botellas y hojas: con puntos de separación y recolección esa basura se vuelve materia prima y llega menos al relleno sanitario.',
  },
  {
    conceptId: 'concept-4',
    label: 'Purificación de Agua',
    icon: 'droplets',
    color: '#06b6d4',
    definition: 'Procesos que eliminan suciedad y microbios para que el agua sea segura de beber.',
    example: 'Hervir el agua o usar un filtro antes de tomarla.',
    questions: [
      {
        text: '¿Para qué se purifica el agua antes de beberla?',
        options: [
          'Para darle color',
          'Para hacerla más salada',
          'Para eliminar microbios y suciedad',
          'Para que pese menos',
        ],
        correctIndex: 2,
        explanation: 'La purificación retira partículas y mata microorganismos que causan enfermedades, así el agua es segura para consumo.',
      },
      {
        text: '¿Cuál de estas acciones ayuda a purificar el agua en casa?',
        options: ['Dejarla al sol sin tapar', 'Hervirla', 'Mezclarla con tierra', 'Congelarla una vez'],
        correctIndex: 1,
        explanation: 'Hervir el agua mata los microbios que pueda tener, y por eso es una forma sencilla de hacerla segura.',
      },
      {
        text: 'Un río baja turbio después de una tormenta. ¿Qué conviene hacer antes de tomar su agua?',
        options: ['Filtrarla y desinfectarla', 'Tomarla fría', 'Agregarle azúcar'],
        correctIndex: 0,
        explanation: 'Filtrar quita la suciedad visible y desinfectar elimina los microbios que no se ven.',
      },
    ],
    application:
      'Tras una inundación, una comunidad solo tiene agua turbia del río: filtrarla y desinfectarla antes de consumirla evita enfermedades como la diarrea.',
  },
  {
    conceptId: 'concept-5',
    label: 'Energía Eólica',
    icon: 'wind',
    color: '#8b5cf6',
    definition: 'Electricidad que se produce con la fuerza del viento al mover las aspas de un aerogenerador.',
    example: 'Los molinos gigantes que giran en una colina ventosa.',
    questions: [
      {
        text: '¿Qué mueve las aspas de un aerogenerador?',
        options: ['El agua', 'El carbón', 'El viento', 'Un motor de gasolina'],
        correctIndex: 2,
        explanation: 'La fuerza del viento hace girar las aspas, y ese giro mueve un generador que produce electricidad.',
      },
      {
        text: '¿Dónde conviene más instalar un parque eólico?',
        options: ['En un valle sin viento', 'En una colina o costa con vientos constantes', 'Dentro de una cueva'],
        correctIndex: 1,
        explanation: 'Un parque eólico necesita viento frecuente y fuerte, algo habitual en colinas abiertas y zonas costeras.',
      },
      {
        text: 'Una turbina eólica gira y produce electricidad. ¿Qué tipo de energía se aprovecha?',
        options: ['Energía del petróleo', 'Energía nuclear', 'Energía del viento', 'Energía del carbón'],
        correctIndex: 2,
        explanation: 'El movimiento del aire es energía del viento, una fuente renovable que no se agota al usarla.',
      },
    ],
    application:
      'Una zona costera con vientos constantes tiene poco espacio para paneles: los aerogeneradores aprovechan el viento todo el día, incluso de noche cuando no hay sol.',
  },
];

/** Mismos límites que el validador del servidor, para fallar aquí y no al jugar. */
function assertWithinLimits(concepts: Concept[]): void {
  for (const c of concepts) {
    const checks: Array<[string, string, number]> = [
      ['label', c.label, 60],
      ['definition', c.definition, 300],
      ['example', c.example, 300],
      ['application', c.application, 400],
    ];
    for (const [field, value, max] of checks) {
      if (value.length > max) throw new Error(`${c.label}: ${field} excede ${max} caracteres (${value.length}).`);
    }
    if (c.questions.length < 1 || c.questions.length > 6) throw new Error(`${c.label}: el banco necesita de 1 a 6 preguntas.`);
    const texts = new Set(c.questions.map((q) => q.text.toLowerCase().replace(/\s+/g, ' ')));
    if (texts.size !== c.questions.length) throw new Error(`${c.label}: preguntas repetidas.`);
    for (const [n, q] of c.questions.entries()) {
      const qChecks: Array<[string, string, number]> = [
        [`questions[${n}].text`, q.text, 300],
        [`questions[${n}].explanation`, q.explanation, 400],
        ...q.options.map((o, i): [string, string, number] => [`questions[${n}].options[${i}]`, o, 120]),
      ];
      for (const [field, value, max] of qChecks) {
        if (value.length > max) throw new Error(`${c.label}: ${field} excede ${max} caracteres (${value.length}).`);
      }
      const { options, correctIndex } = q;
      if (options.length < 3 || options.length > 4) throw new Error(`${c.label}: la pregunta ${n} necesita 3 o 4 opciones.`);
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
        throw new Error(`${c.label}: la pregunta ${n} tiene opciones duplicadas.`);
      }
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        throw new Error(`${c.label}: la pregunta ${n} tiene el correctIndex fuera de rango.`);
      }
    }
  }
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no está configurada.');
  }
  assertWithinLimits(CONCEPTS);

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    // Misma área que el dominó semilla "Nexus Play"; si no existe se crea.
    const categories = db.collection('categories');
    const categoryName = 'Medio Ambiente';
    let category = await categories.findOne({ name: categoryName });

    if (!category) {
      const categoryId = 'seed-category-medio-ambiente';
      await categories.insertOne({
        _id: categoryId,
        name: categoryName,
        slug: 'medio-ambiente',
        creatorUserId: null,
        createdAt: new Date(),
      } as never);
      category = await categories.findOne({ _id: categoryId } as never);
      console.log(`Área creada: ${categoryName}`);
    }

    const games = db.collection('games');
    const existing = await games.findOne({ slug: SLUG });
    const now = new Date();

    const document = {
      slug: SLUG,
      title: 'Dominexo: Ecosistemas Sostenibles (niveles)',
      description:
        'Relaciona conceptos de sostenibilidad en tres niveles: Fácil con ejemplos, Intermedio con preguntas antes de cada ficha y Universitario con casos reales.',
      gameType: 'DOMINO',
      theme: { primaryColor: '#22c55e', coverImageUrl: null },
      categoryId: String(category?._id),
      // Contenido del equipo, no de un usuario (ver canBeManagedBy en la entidad Game).
      creatorUserId: 'system',
      status: 'PUBLISHED',
      config: { handSize: 7 },
      content: CONCEPTS,
      updatedAt: now,
    };

    if (existing) {
      await games.updateOne({ slug: SLUG }, { $set: document });
      console.log(`Dominexo de niveles actualizado (slug: ${SLUG}).`);
    } else {
      await games.insertOne({ _id: GAME_ID, ...document, createdAt: now } as never);
      console.log(`Dominexo de niveles sembrado como juego PUBLISHED (slug: ${SLUG}).`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
