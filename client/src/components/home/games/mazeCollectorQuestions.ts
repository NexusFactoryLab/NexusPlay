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

/** Las preguntas válidas de la configuración del juego, o el banco por defecto si no trae ninguna. */
export function questionsForGame(configured: unknown): MazeQuestion[] {
  if (!Array.isArray(configured)) return SUSTAINABLE_CITY_QUESTIONS
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
  return valid.length > 0 ? valid : SUSTAINABLE_CITY_QUESTIONS
}
