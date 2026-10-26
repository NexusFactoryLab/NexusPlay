/**
 * Preguntas de opción múltiple del Camión Reciclador (issue #103): sale una
 * pregunta y sus respuestas quedan repartidas por el mapa; el camión tiene
 * que llegar a la correcta. Una respuesta incorrecta quita una vida.
 *
 * Quien crea el juego escribe sus propias preguntas (`config.questions`); los
 * juegos que no tienen usan este banco sobre ciudades sostenibles de Colombia.
 * Fuentes: Resolución 2184 de 2019 (código de colores de las canecas),
 * Ministerio de Vivienda (recicladores de oficio), Semana / La República
 * (tasa de reciclaje cercana al 17 %), Alcaldías de Bogotá, Medellín y Cali.
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
  {
    question: 'En Colombia, ¿de qué color es la caneca para los residuos aprovechables (plástico, vidrio, papel, metal)?',
    options: ['Blanca', 'Negra', 'Verde', 'Roja'],
    correctIndex: 0,
  },
  {
    question: '¿Qué va en la caneca verde?',
    options: ['Restos de comida y cáscaras', 'Botellas de plástico', 'Pilas usadas', 'Latas'],
    correctIndex: 0,
  },
  {
    question: '¿Qué va en la caneca negra?',
    options: ['Papel higiénico y servilletas usadas', 'Botellas de vidrio', 'Cartón limpio', 'Cáscaras de fruta'],
    correctIndex: 0,
  },
  {
    question: '¿Qué ciudad colombiana fue pionera en usar teleféricos (Metrocable) como transporte público?',
    options: ['Medellín', 'Cartagena', 'Barranquilla', 'Santa Marta'],
    correctIndex: 0,
  },
  {
    question: '¿Cómo se llama el sistema de buses de tránsito rápido de Bogotá?',
    options: ['TransMilenio', 'MIO', 'Megabús', 'Metrolínea'],
    correctIndex: 0,
  },
  {
    question: '¿Cómo se llama el sistema de transporte masivo de Cali?',
    options: ['MIO', 'TransMilenio', 'Transcaribe', 'Metroplús'],
    correctIndex: 0,
  },
  {
    question: 'La Ciclovía de Bogotá cierra calles a los carros para bicicletas y peatones. ¿Cuándo?',
    options: ['Domingos y festivos', 'Solo en diciembre', 'Todas las noches', 'Nunca'],
    correctIndex: 0,
  },
  {
    question: '¿Quiénes son los recicladores de oficio?',
    options: ['Personas que recuperan y clasifican material reciclable como trabajo', 'Máquinas que queman basura', 'Turistas', 'Policías de tránsito'],
    correctIndex: 0,
  },
  {
    question: 'Más o menos, ¿cuánto de la basura que se produce en Colombia se recicla?',
    options: ['Menos del 20 %', 'Cerca de la mitad', 'Más del 80 %', 'Toda'],
    correctIndex: 0,
  },
  {
    question: 'Los Corredores Verdes de Medellín llenan calles de árboles y plantas. ¿Para qué sirven?',
    options: ['Bajar el calor y limpiar el aire', 'Tener más parqueaderos', 'Hacer más ruido', 'Gastar más agua'],
    correctIndex: 0,
  },
  {
    question: '¿Qué significa «separar en la fuente»?',
    options: ['Clasificar los residuos en casa, donde se producen', 'Tirar todo a la misma bolsa', 'Lavar la calle', 'Quemar la basura'],
    correctIndex: 0,
  },
  {
    question: '¿Cuáles son las 3R del cuidado ambiental?',
    options: ['Reducir, reutilizar y reciclar', 'Romper, regar y repetir', 'Rápido, ruido y recoger', 'Reír, rodar y remar'],
    correctIndex: 0,
  },
  {
    question: '¿Cuál de estos es un medio de transporte sostenible?',
    options: ['La bicicleta', 'Un carro solo con una persona', 'Una moto vieja que bota humo', 'Un avión para ir a la tienda'],
    correctIndex: 0,
  },
  {
    question: '¿Qué hacen los humedales de ciudades como Bogotá?',
    options: ['Guardan agua y son hogar de aves', 'Producen plástico', 'Contaminan el aire', 'Sirven de basurero'],
    correctIndex: 0,
  },
  {
    question: 'La mayor parte de la electricidad de Colombia se produce con…',
    options: ['Agua (hidroeléctricas)', 'Carbón', 'Petróleo', 'Leña'],
    correctIndex: 0,
  },
  {
    question: '¿Qué Objetivo de Desarrollo Sostenible (ODS) habla de las ciudades?',
    options: ['ODS 11: Ciudades y comunidades sostenibles', 'ODS 1: Fin de la pobreza', 'ODS 4: Educación de calidad', 'ODS 14: Vida submarina'],
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
