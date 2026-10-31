/**
 * Preguntas de opción múltiple del Camión Reciclador (issue #103): sale una
 * pregunta y sus respuestas quedan repartidas por el mapa; el camión tiene
 * que llegar a la correcta. Una respuesta incorrecta quita una vida.
 *
 * Quien crea el juego escribe sus propias preguntas (`config.questions`); los
 * juegos que no tienen usan este banco. Cada pregunta enseña un concepto de
 * ciudad sostenible y cómo se aplica en una ciudad de Colombia (no datos
 * sueltos para memorizar).
 *
 * Fuentes: Alcaldía de Bogotá y TransMilenio (flota eléctrica, TransMiCable,
 * Ciclovía, humedales), estudio TrUST sobre TransMiCable, PNUMA / ONU Medio
 * Ambiente (Corredores Verdes de Medellín), WWF (Montería en el One Planet
 * City Challenge), Ministerio de Vivienda (recicladores de oficio), ONU (ODS 11).
 */
import type { MazeLayout } from './mazeCollectorTypes'

// En el banco la correcta va primero por claridad; el juego baraja las respuestas al mostrarlas.
export type MazeQuestion = {
  question: string
  /** Entre 2 y 4 respuestas; en el mapa se marcan A, B, C, D. */
  options: string[]
  /** Posición de la respuesta correcta dentro de `options`. */
  correctIndex: number
}

export const MIN_QUESTION_OPTIONS = 2
export const MAX_QUESTION_OPTIONS = 4
export const MIN_MAZE_QUESTIONS = 3
export const MAX_MAZE_QUESTIONS = 30
export const MAX_QUESTION_LENGTH = 160
export const MAX_OPTION_LENGTH = 60
export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'] as const

export const SUSTAINABLE_CITY_QUESTIONS: MazeQuestion[] = [
  // ---- Qué es una ciudad sostenible ----
  {
    question: '¿Qué es una ciudad sostenible?',
    options: [
      'Cuida el ambiente, a su gente y su economía, hoy y mañana',
      'Tiene muchos edificios altos',
      'Todos andan en carro',
      'Solo siembra árboles',
    ],
    correctIndex: 0,
  },
  {
    question: '¿Qué Objetivo de Desarrollo Sostenible (ODS) busca ciudades inclusivas, seguras y sostenibles?',
    options: ['El ODS 11', 'El ODS 1', 'El ODS 4', 'El ODS 14'],
    correctIndex: 0,
  },
  // ---- Movilidad sostenible ----
  {
    question: 'Bogotá tiene una de las flotas de buses eléctricos más grandes del mundo fuera de China. ¿Por qué ayuda a la ciudad?',
    options: ['No echan humo: el aire queda más limpio', 'Van más rápido que un avión', 'No necesitan conductor', 'Son más baratos de pintar'],
    correctIndex: 0,
  },
  {
    question: 'El TransMiCable de Ciudad Bolívar (Bogotá) es un cable aéreo. ¿Qué cambió para quienes viven en esas lomas?',
    options: ['Llegan mucho más rápido al resto de la ciudad', 'Ya no pueden salir del barrio', 'Tienen que pagar peaje', 'Hay más trancones en la loma'],
    correctIndex: 0,
  },
  {
    question: 'Medellín unió sus barrios de montaña al metro con el Metrocable. ¿Qué idea de ciudad sostenible muestra?',
    options: [
      'Transporte público que incluye a todos los barrios',
      'Que cada familia compre su carro',
      'Cerrar los barrios de montaña',
      'Quitar el metro de la ciudad',
    ],
    correctIndex: 0,
  },
  {
    question: 'Los domingos y festivos la Ciclovía de Bogotá cierra calles a los carros. ¿Qué gana la ciudad?',
    options: ['Espacio para caminar, pedalear y hacer ejercicio', 'Más ruido de motores', 'Más parqueaderos', 'Menos gente en la calle'],
    correctIndex: 0,
  },
  {
    question: 'Montería fue reconocida por WWF por su plan de movilidad sostenible. ¿Qué medio de transporte impulsó?',
    options: ['La bicicleta, con ciclorrutas', 'El avión para viajes cortos', 'Las motos sin casco', 'Los carros de un solo pasajero'],
    correctIndex: 0,
  },
  // ---- Naturaleza en la ciudad ----
  {
    question: 'Una «isla de calor» es una zona de la ciudad con mucho cemento y pocas plantas. ¿Qué le pasa?',
    options: ['Se calienta mucho más que su alrededor', 'Se inunda de nieve', 'Se queda sin luz', 'Se vuelve una isla de verdad'],
    correctIndex: 0,
  },
  {
    question: 'Medellín sembró árboles y plantas en calles y quebradas: los Corredores Verdes. ¿Qué lograron?',
    options: ['Bajar la temperatura y mejorar el aire', 'Más tráfico en esas calles', 'Que llueva menos', 'Tapar las quebradas'],
    correctIndex: 0,
  },
  {
    question: 'Bogotá protege sus humedales. ¿Para qué le sirven a la ciudad?',
    options: ['Guardan el agua de lluvia y son hogar de aves', 'Sirven para botar escombros', 'Producen plástico', 'Calientan el aire'],
    correctIndex: 0,
  },
  {
    question: 'Cuando llueve fuerte, ¿qué ayuda a que una ciudad no se inunde?',
    options: ['Parques, zonas verdes y humedales que absorben el agua', 'Pavimentar todo', 'Tapar los desagües', 'Construir sobre los ríos'],
    correctIndex: 0,
  },
  // ---- Residuos y economía circular ----
  {
    question: '¿Qué es la economía circular?',
    options: [
      'Volver a usar y reciclar los materiales en lugar de botarlos',
      'Comprar y botar cada vez más rápido',
      'Pagar todo con monedas',
      'Enterrar la basura en círculos',
    ],
    correctIndex: 0,
  },
  {
    question: 'En Colombia los recicladores de oficio son parte del servicio de aseo. ¿Cómo les ayudamos desde la casa?',
    options: ['Separando lo reciclable limpio y seco', 'Mezclando todo en una bolsa', 'Quemando la basura', 'Botando los residuos al río'],
    correctIndex: 0,
  },
  {
    question: 'En Colombia se recicla menos del 20 % de la basura. ¿Qué haría subir esa cifra?',
    options: ['Separar los residuos en casa, donde se producen', 'Usar más bolsas de un solo uso', 'Botar todo junto', 'Producir más basura'],
    correctIndex: 0,
  },
  // ---- Energía y calidad del aire ----
  {
    question: 'La Guajira tiene mucho sol y viento. ¿Por qué es importante para una Colombia sostenible?',
    options: ['Puede producir energía limpia solar y eólica', 'Allí se quema más carbón', 'No tiene ninguna importancia', 'Porque allí no llueve nunca'],
    correctIndex: 0,
  },
  {
    question: 'Cuando el aire del Valle de Aburrá (Medellín) está muy contaminado, ¿qué medida ayuda?',
    options: ['Usar menos el carro y más el transporte público', 'Quemar hojas en el patio', 'Prender más motores', 'Cerrar los parques'],
    correctIndex: 0,
  },
]

/**
 * Bancos fijos de los mapas temáticos (issue #150). Salen de la actividad
 * "Territorios en Juego: El Desafío de la BiodiverCiudad" y de su libro guía,
 * "Voces sobre Ciudades Sostenibles y Resilientes" (Ministerio de Ambiente y
 * Desarrollo Sostenible, 2019): cada mapa corresponde a una estación de la
 * actividad y sus preguntas a los capítulos del libro de esa región.
 */

/**
 * Estación 1 — Amazonia (Leticia y Puerto Asís). Capítulo "Asentamientos
 * urbanos en armonía con la biodiversidad y la cultura amazónicas" (Instituto
 * Sinchi) y la sede del Sinchi en Leticia ("Cosechar el agua lluvia").
 */
export const AMAZON_QUESTIONS: MazeQuestion[] = [
  {
    question: 'Cuando Leticia o Puerto Asís crecen, ¿qué altera más la oferta de la selva?',
    options: [
      'Crecer sobre rondas de río sin saneamiento básico',
      'Demasiados carros en el centro',
      'Que falten centros comerciales',
      'Cambiar cultivos por industria pesada',
    ],
    correctIndex: 0,
  },
  {
    question: 'Según el Instituto Sinchi, ¿cuáles son los principales problemas ambientales de las ciudades en la Amazonia?',
    options: [
      'Vivienda y saneamiento inadecuados, en zonas de riesgo',
      'Demasiados rascacielos',
      'Exceso de parques',
      'Demasiados metros y tranvías',
    ],
    correctIndex: 0,
  },
  {
    question: 'El Sinchi dice que no hay "ciudades amazónicas", sino ciudades en la Amazonia. ¿Qué quiere decir?',
    options: [
      'Cada ciudad debe planearse según su propio entorno',
      'Todas deben copiar el modelo de Bogotá',
      'En la selva no puede haber ciudades',
      'Las ciudades de la selva no contaminan',
    ],
    correctIndex: 0,
  },
  {
    question: 'El municipio tiene $500 millones para turismo en el río. ¿Qué proyecto preserva la oferta de la selva?',
    options: [
      'Saneamiento con humedales y senderos palafíticos',
      'Un gran muelle de concreto para cruceros',
      'Rellenar la orilla del río para hacer vías',
      'Talar selva para construir hoteles',
    ],
    correctIndex: 0,
  },
  {
    question: '¿Qué pasa cuando un pueblo de la selva vierte sus aguas residuales sin tratar al río?',
    options: [
      'Contamina la cuenca y corta la conexión entre ecosistemas',
      'El río se limpia solo en pocos días',
      'Llegan más peces al río',
      'Nada, la selva es muy grande',
    ],
    correctIndex: 0,
  },
  {
    question: 'La sede del Instituto Sinchi en Leticia está adaptada al clima amazónico. ¿Cómo?',
    options: [
      'Recoge agua lluvia y tiene paneles solares',
      'Usa aire acondicionado todo el día',
      'Compra agua en botellas',
      'Funciona con plantas de diésel',
    ],
    correctIndex: 0,
  },
  {
    question: 'Para el capítulo amazónico del libro, ¿qué es una ciudad sostenible?',
    options: [
      'Da calidad de vida y reduce su impacto en la naturaleza',
      'Crece sin ningún límite',
      'Solo piensa en ganar dinero',
      'Está diseñada para los carros',
    ],
    correctIndex: 0,
  },
  {
    question: 'El Sinchi critica las ciudades "pensadas para los automóviles". ¿Qué propone para las ciudades de la Amazonia?',
    options: [
      'Ciudades caminables, seguras y felices',
      'Más autopistas entre la selva',
      'Un parqueadero en cada cuadra',
      'Calles solo para motos',
    ],
    correctIndex: 0,
  },
  {
    question: 'En las ciudades amazónicas la gente casi no participa en planear su ciudad. ¿Qué propone el Sinchi?',
    options: [
      'Pedagogía y diálogo para que valoren su entorno',
      'Que decidan solo personas de afuera',
      'Dejar que los barrios crezcan sin plan',
      'Trasladar a todos al campo',
    ],
    correctIndex: 0,
  },
  {
    question: 'El libro habla del "derecho a la ciudad". ¿A qué se refiere?',
    options: [
      'Acceso a trabajo, salud, educación y vivienda digna',
      'A tener carro propio',
      'A no pagar servicios públicos',
      'A construir donde cada uno quiera',
    ],
    correctIndex: 0,
  },
  {
    question: 'Muchos barrios en la Amazonia nacen en lotes irregulares junto a los ríos. ¿Qué riesgo corren sus familias?',
    options: [
      'Inundaciones y agua contaminada',
      'Recibir demasiados turistas',
      'Que el río quede más limpio',
      'Ninguno, es el mejor lugar',
    ],
    correctIndex: 0,
  },
  {
    question: '¿Qué significa "producir conservando y conservar produciendo" en la Amazonia?',
    options: [
      'Generar ingresos sin destruir la biodiversidad',
      'Detener toda actividad económica',
      'Explotar la selva al máximo',
      'Privatizar las reservas naturales',
    ],
    correctIndex: 0,
  },
]

/**
 * Estación 2 — Caribe (Barranquilla y Ciénaga de Mallorquín). Capítulos
 * "Retos de la gestión ambiental urbana en una ciudad caribeña", "Desafíos y
 * prioridades en la gestión integral y aprovechamiento de residuos sólidos" y
 * "Cosechar el agua lluvia" (corales del Caribe y San Andrés).
 */
export const OCEAN_QUESTIONS: MazeQuestion[] = [
  {
    question: '¿Por qué canalizar los arroyos con concreto no basta frente al cambio climático?',
    options: [
      'Acelera el agua y lleva la inundación aguas abajo',
      'Porque el concreto es demasiado barato',
      'Los arroyos secos no necesitan obras',
      'Impide el paso de los barcos',
    ],
    correctIndex: 0,
  },
  {
    question: 'Entre 1980 y 2010 la Ciénaga de Mallorquín perdió casi la mitad de su espejo de agua. ¿Cuánto?',
    options: ['Unas 650 hectáreas (43%)', 'Unas 5 hectáreas', 'Más de 10.000 hectáreas', 'No perdió nada'],
    correctIndex: 0,
  },
  {
    question: 'Según el libro, ¿qué contamina el agua de la Ciénaga de Mallorquín?',
    options: [
      'Vertimientos industriales, domésticos y basuras',
      'La arena de la playa',
      'Los peces que viven allí',
      'El viento del mar',
    ],
    correctIndex: 0,
  },
  {
    question: '¿Qué ecosistema estratégico protege la Ciénaga de Mallorquín?',
    options: ['El bosque de manglar', 'El páramo', 'El desierto', 'El bosque de niebla'],
    correctIndex: 0,
  },
  {
    question: 'La Ciénaga de Mallorquín hace parte de un sitio Ramsar. ¿Qué significa?',
    options: [
      'Es un humedal de importancia internacional',
      'Es una zona industrial',
      'Es un puerto para cruceros',
      'Es un relleno sanitario',
    ],
    correctIndex: 0,
  },
  {
    question: 'En Barranquilla, ¿qué pasa cuando llueve y la gente bota basura a la calle?',
    options: [
      'Se taponan los canales y los arroyos se desbordan',
      'La lluvia se lleva todo y no pasa nada',
      'Los arroyos quedan más limpios',
      'Baja la temperatura de la ciudad',
    ],
    correctIndex: 0,
  },
  {
    question: 'En Barranquilla la mitad de la gente no separa sus residuos en la fuente. ¿Por qué, según el estudio?',
    options: [
      'No sabe a quién entregarlos',
      'Está prohibido separar',
      'No produce basura',
      'Todo se recicla solo',
    ],
    correctIndex: 0,
  },
  {
    question: 'En 2018 Barranquilla carnetizó a 987 recicladores en su Red de Recuperadores Ambientales. ¿Para qué?',
    options: [
      'Para formalizarlos y reducir los impactos ambientales',
      'Para prohibirles trabajar',
      'Para cobrarles un impuesto',
      'Para reemplazarlos por máquinas',
    ],
    correctIndex: 0,
  },
  {
    question: 'Toneladas de plástico llegan a la Ciénaga por los arroyos. ¿Qué negocio verde propone la actividad?',
    options: [
      'Recicladores atrapan el plástico antes del estuario',
      'Quemar el plástico en la orilla',
      'Enterrarlo en el manglar',
      'Esperar a que el mar se lo lleve',
    ],
    correctIndex: 0,
  },
  {
    question: 'Colombia solo aprovecha cerca del 17% de sus residuos. Según el libro, ¿qué modelo sigue dominando?',
    options: ['La economía lineal: usar y botar', 'La economía circular', 'El residuo cero', 'El trueque'],
    correctIndex: 0,
  },
  {
    question: '¿Qué es la Responsabilidad Extendida del Productor (REP) para envases y empaques?',
    options: [
      'Las marcas responden por sus envases ya usados',
      'El consumidor paga doble',
      'Se prohíben todos los envases',
      'El Estado recoge todo gratis',
    ],
    correctIndex: 0,
  },
  {
    question: 'Según el libro, ¿qué está matando los arrecifes de coral en las bahías de Cartagena y Santa Marta?',
    options: [
      'Los vertimientos de aguas servidas sin tratar',
      'Los turistas que nadan',
      'El agua demasiado limpia',
      'Los peces de colores',
    ],
    correctIndex: 0,
  },
  {
    question: 'Las casas raizales de San Andrés tienen el "acueducto celestial". ¿Qué es?',
    options: [
      'Recoger y guardar agua lluvia en cada casa',
      'Un tubo que trae agua del mar',
      'Agua en botellas importadas',
      'Un pozo de petróleo',
    ],
    correctIndex: 0,
  },
]

/**
 * Estación 3 — Región andina (cerros, páramos y humedales). Capítulos
 * "Lecciones aprendidas en materia de restauración ecológica" (Cerros
 * Orientales de Bogotá), "Bosques urbanos", "Los municipios en la gestión de
 * áreas de conservación local", "Cosechar el agua lluvia" (ríos del cielo de
 * Sumapaz) y "El papel de la ciudadanía en la gestión de humedales urbanos"
 * (humedal Córdoba).
 */
export const PARAMO_QUESTIONS: MazeQuestion[] = [
  {
    question: '¿Qué ventaja tiene un parque lineal a lo largo de una quebrada frente a un solo gran parque en un barrio rico?',
    options: [
      'Reparte la naturaleza y conecta los ecosistemas',
      'Cuesta menos de jardinería',
      'Evita caminar para hacer deporte',
      'Deja espacio para una autopista encima',
    ],
    correctIndex: 0,
  },
  {
    question: '¿Qué especie invasora frena la regeneración del bosque nativo en los cerros de Bogotá?',
    options: ['El retamo', 'El frailejón', 'El roble', 'El musgo'],
    correctIndex: 0,
  },
  {
    question: 'Además de las especies invasoras, ¿qué otras barreras frenan la restauración en los cerros?',
    options: [
      'El fuego y los suelos que fueron potreros o cultivos',
      'Que llueva agua demasiado limpia',
      'Que haya demasiadas aves',
      'Los senderos para caminar',
    ],
    correctIndex: 0,
  },
  {
    question: 'Casi todos los árboles plantados en un cerro sobrevivieron, pero años después sigue siendo un potrero. ¿Qué falló?',
    options: [
      'Solo se midieron árboles vivos, no si el bosque volvía',
      'Plantaron muy pocos árboles',
      'Nada, ya está restaurado',
      'Faltó echarle cemento',
    ],
    correctIndex: 0,
  },
  {
    question: 'Los "ríos del cielo" que atraviesan el Páramo de Sumapaz conectan ¿qué regiones?',
    options: ['La Amazonia, la Orinoquia y los Andes', 'Europa y Asia', 'Solo Bogotá y Soacha', 'El Caribe y el Pacífico'],
    correctIndex: 0,
  },
  {
    question: 'El libro propone invertir lo que se ahorre al cosechar agua lluvia. ¿En qué?',
    options: [
      'En conservar páramos y en educación ambiental',
      'En comprar más agua embotellada',
      'En construir autopistas',
      'En nada, solo guardarlo',
    ],
    correctIndex: 0,
  },
  {
    question: 'El humedal Córdoba recibe agua limpia de la quebrada Santa Bárbara, que nace en los cerros. ¿Qué logró?',
    options: ['Más oxígeno en el agua y más vida', 'Que el humedal se secara', 'Más malos olores', 'Que se fueran las aves'],
    correctIndex: 0,
  },
  {
    question: '¿Qué actividad ayudó más a que los vecinos conocieran y cuidaran el humedal Córdoba?',
    options: ['La observación de aves', 'Cerrarlo con muros', 'Convertirlo en parqueadero', 'Rellenarlo con tierra'],
    correctIndex: 0,
  },
  {
    question: 'Una ciclorruta muy ambiciosa amenazó al humedal Córdoba. ¿Qué ponía en riesgo?',
    options: ['Más de 1.500 árboles y sus aves', 'Nada, era solo pintura', 'Los carros de la zona', 'Las tiendas del barrio'],
    correctIndex: 0,
  },
  {
    question: '¿Por qué el libro recomienda crear bosques urbanos y periurbanos?',
    options: [
      'Son soluciones basadas en la naturaleza ante el clima',
      'Tapan la vista de los cerros',
      'Quitan espacio a la vivienda',
      'Solo sirven de adorno',
    ],
    correctIndex: 0,
  },
  {
    question: 'Según el libro, ¿cuánto puede bajar un bosque urbano el uso de aire acondicionado en los edificios?',
    options: ['Hasta un 30%', 'Nada', 'El 100%', 'Al contrario, lo aumenta'],
    correctIndex: 0,
  },
  {
    question: 'Crear un bosque urbano es más que sembrar árboles. ¿Por qué, según Fundación Natura?',
    options: [
      'Recrea un bosque nativo con criterios de restauración',
      'Basta sembrar cualquier árbol',
      'Debe usar solo especies extranjeras',
      'No necesita ningún cuidado',
    ],
    correctIndex: 0,
  },
  {
    question: 'Si cada municipio protege su área natural sin coordinarse con los vecinos, ¿qué riesgo hay?',
    options: ['Que los ecosistemas se fragmenten', 'Más conexión entre ecosistemas', 'Menos trámites', 'Ninguno'],
    correctIndex: 0,
  },
]

/** El banco fijo de cada mapa: la Ciudad conserva el suyo (issue #103). */
export const QUESTIONS_BY_MAP: Record<MazeLayout, MazeQuestion[]> = {
  CITY: SUSTAINABLE_CITY_QUESTIONS,
  AMAZON: AMAZON_QUESTIONS,
  OCEAN: OCEAN_QUESTIONS,
  PARAMO: PARAMO_QUESTIONS,
}

/** Las preguntas válidas de la configuración del juego, o el banco por defecto si no trae ninguna. */
export function questionsForGame(configured: unknown, layout: MazeLayout = 'CITY'): MazeQuestion[] {
  const fallback = QUESTIONS_BY_MAP[layout]
  if (!Array.isArray(configured)) return fallback
  const valid = configured.filter(
    (item): item is MazeQuestion =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as MazeQuestion).question === 'string' &&
      Array.isArray((item as MazeQuestion).options) &&
      (item as MazeQuestion).options.length >= MIN_QUESTION_OPTIONS &&
      Number.isInteger((item as MazeQuestion).correctIndex) &&
      (item as MazeQuestion).correctIndex >= 0 &&
      (item as MazeQuestion).correctIndex < (item as MazeQuestion).options.length,
  )
  return valid.length > 0 ? valid : fallback
}
