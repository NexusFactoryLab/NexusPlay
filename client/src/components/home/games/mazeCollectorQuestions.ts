/**
 * Preguntas de opción múltiple de "Salvando el mundo con sostenibilidad"
 * (issues #103, #150 y #160): sale una pregunta y sus respuestas quedan
 * repartidas por el mapa; el muñeco tiene que llegar a la correcta. Una
 * respuesta incorrecta quita una vida.
 *
 * Quien crea el juego escribe sus propias preguntas (`config.questions`); los
 * juegos que no tienen usan el banco fijo del mapa. TODOS los bancos salen del
 * libro guía "Voces sobre Ciudades Sostenibles y Resilientes" (Ministerio de
 * Ambiente y Desarrollo Sostenible, 2019) y cada pregunta indica en `book` la
 * página donde está la respuesta, así el libro es necesario para jugar.
 */
import type { MazeLayout } from './mazeCollectorTypes'

// En el banco la correcta va primero por claridad; el juego baraja las respuestas al mostrarlas.
/** Dónde está la respuesta en el libro guía (issue #160). */
export type MazeQuestionBook = {
  /** Página IMPRESA en el libro (la que se ve al pie de cada hoja). */
  page: number
  /** Capítulo del libro, en corto. */
  chapter: string
}

export const BOOK_TITLE = 'Voces sobre Ciudades Sostenibles y Resilientes'
/** El PDF trae portadas y guardas: su página es la impresa + 2 (la impresa 22 es la 24 del visor). */
export const BOOK_PDF_OFFSET = 2

export function bookPdfPage(book: MazeQuestionBook): number {
  return book.page + BOOK_PDF_OFFSET
}

export type MazeQuestion = {
  question: string
  /** Entre 2 y 4 respuestas; en el mapa se marcan A, B, C, D. */
  options: string[]
  /** Posición de la respuesta correcta dentro de `options`. */
  correctIndex: number
  /** Página del libro guía donde está la respuesta (los bancos fijos siempre la traen; las preguntas del docente, no). */
  book?: MazeQuestionBook
}

export const MIN_QUESTION_OPTIONS = 2
export const MAX_QUESTION_OPTIONS = 4
export const MIN_MAZE_QUESTIONS = 3
export const MAX_MAZE_QUESTIONS = 30
export const MAX_QUESTION_LENGTH = 160
export const MAX_OPTION_LENGTH = 60
export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'] as const

// Capítulos del libro (nombre corto) que se muestran junto a la página.
const CH_PROLOGO = 'Prólogo'
const CH_CARRIZOSA = 'Construir nuevas ciudades'
const CH_AMAZONIA = 'Asentamientos urbanos en armonía con la biodiversidad y la cultura amazónicas'
const CH_BARRANQUILLA = 'Retos de la gestión ambiental urbana en una ciudad caribeña: Barranquilla'
const CH_MADDOX = 'Ecosistemas para todos'
const CH_BOSQUES = 'La importancia de los bosques urbanos'
const CH_CONSERVACION = 'Los municipios en la gestión de áreas de conservación local'
const CH_MOVILIDAD = 'Movilidad con cero emisiones'
const CH_INFRAESTRUCTURA = 'El aporte de la infraestructura verde al bienestar humano'
const CH_ENERGIA = 'Energías renovables para el desarrollo sostenible urbano'
const CH_RESIDUOS = 'Desafíos y prioridades en la gestión de residuos sólidos'
const CH_RETROCD = 'RetroCD: residuos posconsumo de aparatos eléctricos y electrónicos'
const CH_RESTAURACION = 'Lecciones aprendidas en restauración ecológica'
const CH_LLUVIA = 'Cosechar el agua lluvia'
const CH_CORDOBA = 'El papel de la ciudadanía en la gestión de humedales urbanos (humedal Córdoba)'
const CH_ABURRA = 'Complejidades territoriales en el Valle de Aburrá'

/**
 * Estación 4 — Metrópolis, espacio público y gobernanza (mapa Ciudad). Prólogo
 * y capítulos urbanos del libro guía.
 */
export const SUSTAINABLE_CITY_QUESTIONS: MazeQuestion[] = [
  {
    question: 'El prólogo resume su apuesta para las ciudades colombianas en una premisa. ¿Cuál es?',
    options: ['Producir conservando y conservar produciendo', 'Producir primero y conservar después', 'Conservar sin producir nada', 'Crecer hoy y reparar mañana'],
    correctIndex: 0,
    book: { page: 8, chapter: CH_PROLOGO },
  },
  {
    question: 'El Presidente adoptó un concepto para un desarrollo urbano que conserva la base natural. ¿Cuál?',
    options: ['Biodiverciudad', 'Ciudad dormitorio', 'Megaciudad cerrada', 'Ciudad de cemento'],
    correctIndex: 0,
    book: { page: 8, chapter: CH_PROLOGO },
  },
  {
    question: 'Según Carrizosa, ¿qué tamaño óptimo tienen las ciudades sobre terrenos planos y de buena capacidad de sustentación?',
    options: ['Entre uno y tres millones de habitantes', 'Menos de diez mil habitantes', 'Más de veinte millones', 'No existe un tamaño óptimo'],
    correctIndex: 0,
    book: { page: 16, chapter: CH_CARRIZOSA },
  },
  {
    question: 'Carrizosa: cuando las grandes ciudades siguen creciendo sin límite, ¿qué generan?',
    options: ['Deseconomías que afectan la economía del país', 'Más ahorro para todo el país', 'Menos contaminación en las cuencas', 'Más suelos fértiles'],
    correctIndex: 0,
    book: { page: 16, chapter: CH_CARRIZOSA },
  },
  {
    question: 'Según el IDEAM, ¿qué lugar ocupa Bogotá en vulnerabilidad al cambio climático?',
    options: ['El primer puesto', 'El último puesto', 'Ninguno: no es vulnerable', 'Un puesto intermedio'],
    correctIndex: 0,
    book: { page: 14, chapter: CH_CARRIZOSA },
  },
  {
    question: 'El crecimiento de Bogotá y de Cali provoca la pérdida de un recurso. ¿Cuál?',
    options: ['Suelos de alta fertilidad', 'Montañas de nieve', 'Mares y playas', 'Bosques de manglar'],
    correctIndex: 0,
    book: { page: 14, chapter: CH_CARRIZOSA },
  },
  {
    question: 'Según Maddox, ¿dónde tienden a vivir los más pobres de las ciudades?',
    options: ['En las llanuras inundables', 'En las tierras altas', 'En el centro histórico', 'Junto a los parques'],
    correctIndex: 0,
    book: { page: 34, chapter: CH_MADDOX },
  },
  {
    question: 'El plan PlaNYC de Nueva York propone que todos los neoyorquinos estén a cierta distancia de un parque. ¿Cuál?',
    options: ['Cinco minutos a pie', 'Una hora en bus', 'Diez kilómetros', 'Un día de viaje'],
    correctIndex: 0,
    book: { page: 35, chapter: CH_MADDOX },
  },
  {
    question: 'Según el libro, ¿cómo se llama al diésel por sus efectos en la salud?',
    options: ['«El cigarrillo del siglo XXI»', '«El oro líquido»', '«El aire de las montañas»', '«La energía del futuro»'],
    correctIndex: 0,
    book: { page: 78, chapter: CH_MOVILIDAD },
  },
  {
    question: '26 grandes ciudades se comprometieron en 2018 con una meta desde 2025. ¿Cuál?',
    options: ['Solo flotas de transporte de cero emisiones', 'Prohibir las bicicletas', 'Duplicar el uso del carro', 'Cerrar el transporte público'],
    correctIndex: 0,
    book: { page: 78, chapter: CH_MOVILIDAD },
  },
  {
    question: 'Además de limpiar el aire, ¿qué servicio presta la infraestructura verde en la ciudad?',
    options: ['Promueve la biodiversidad y mitiga la isla de calor', 'Sube la temperatura de los edificios', 'Reemplaza al transporte público', 'Hace más ruido en las calles'],
    correctIndex: 0,
    book: { page: 84, chapter: CH_INFRAESTRUCTURA },
  },
  {
    question: '¿Qué fuente genera la mayor parte de la electricidad de Colombia?',
    options: ['La hidráulica', 'La solar', 'La eólica', 'La biomasa'],
    correctIndex: 0,
    book: { page: 90, chapter: CH_ENERGIA },
  },
  {
    question: 'En Alemania casi la mitad de las energías renovables es propiedad de la gente. ¿Cómo se llama eso?',
    options: ['Democracia energética', 'Monopolio energético', 'Mercado cerrado', 'Subsidio al diésel'],
    correctIndex: 0,
    book: { page: 91, chapter: CH_ENERGIA },
  },
  {
    question: '¿Qué metales pesados cancerígenos hay en todos los aparatos electrónicos?',
    options: ['Plomo, níquel y cadmio', 'Oro, plata y cobre', 'Hierro, calcio y sodio', 'Helio, neón y argón'],
    correctIndex: 0,
    book: { page: 116, chapter: CH_RETROCD },
  },
  {
    question: 'En 2016 el Valle de Aburrá pasó 23 días seguidos en alerta por PM2.5. ¿Qué pasó en 2017 con el Protocolo y el PIGECA?',
    options: ['Solo 4 días de prevención y menos de 2 de alerta roja', 'Subieron a 46 días seguidos de alerta', 'Se mantuvieron igual: 23 días', 'Dejó de medirse el aire'],
    correctIndex: 0,
    book: { page: 143, chapter: CH_ABURRA },
  },
]

/**
 * Bancos fijos de los mapas temáticos (issues #150 y #160). Salen de la
 * actividad "Territorios en Juego: El Desafío de la BiodiverCiudad" y de su
 * libro guía, "Voces sobre Ciudades Sostenibles y Resilientes" (Ministerio de
 * Ambiente y Desarrollo Sostenible, 2019): cada mapa corresponde a una estación
 * de la actividad y cada pregunta apunta a la página del libro donde está la
 * respuesta (`book.page` es la página impresa; en el visor del PDF es la +2).
 */

/**
 * Estación 1 — Amazonia (Leticia y Puerto Asís). Capítulo del Instituto Sinchi
 * y la sede del Sinchi en Leticia ("Cosechar el agua lluvia").
 */
export const AMAZON_QUESTIONS: MazeQuestion[] = [
  {
    question: 'Según el Sinchi, ¿cuáles son los principales problemas ambientales urbanos de la Amazonia?',
    options: ['Vivienda y saneamiento inadecuados, en zonas de riesgo', 'Demasiados rascacielos y centros comerciales', 'Exceso de metros y tranvías', 'Falta de turistas en las ciudades'],
    correctIndex: 0,
    book: { page: 21, chapter: CH_AMAZONIA },
  },
  {
    question: 'El Sinchi afirma que no hay «ciudades amazónicas», sino ciudades en la Amazonia. ¿Qué implica?',
    options: ['No hay un modelo único: cada ciudad es distinta', 'Que en la selva no puede haber ciudades', 'Que todas deben copiar el modelo de Bogotá', 'Que sus ciudades no causan problemas'],
    correctIndex: 0,
    book: { page: 21, chapter: CH_AMAZONIA },
  },
  {
    question: '¿Cuántos centros urbanos con características de ciudad hay en la Amazonia, según el Sinchi?',
    options: ['Tal vez no pasan de diez', 'Más de cien', 'Solo uno: Leticia', 'Unos cincuenta'],
    correctIndex: 0,
    book: { page: 21, chapter: CH_AMAZONIA },
  },
  {
    question: '¿Cuál de estos lugares es capital departamental de la Amazonia colombiana?',
    options: ['Mitú', 'Puerto Asís', 'Orito', 'Villagarzón'],
    correctIndex: 0,
    book: { page: 21, chapter: CH_AMAZONIA },
  },
  {
    question: '¿Cómo crecen los centros urbanos de la Amazonia, según el Sinchi?',
    options: ['En forma desordenada, sin planificación acorde al entorno', 'Con planes que respetan la selva', 'Siguiendo un único modelo de ciudad', 'No crecen: están estancados'],
    correctIndex: 0,
    book: { page: 22, chapter: CH_AMAZONIA },
  },
  {
    question: 'Según el libro, ¿qué son las ciudades sostenibles?',
    options: ['Dan calidad de vida y reducen su impacto en la naturaleza', 'Crecen sin límite para atraer más gente', 'Solo buscan que la economía crezca', 'Se diseñan pensando solo en los carros'],
    correctIndex: 0,
    book: { page: 22, chapter: CH_AMAZONIA },
  },
  {
    question: '¿Qué es el «derecho a la ciudad»?',
    options: ['Disfrutar de trabajo, educación, salud y vivienda digna', 'Tener un carro propio', 'No pagar servicios públicos', 'Construir donde cada uno quiera'],
    correctIndex: 0,
    book: { page: 22, chapter: CH_AMAZONIA },
  },
  {
    question: 'El Sinchi critica las ciudades pensadas «para los automóviles». ¿Qué propone revivir?',
    options: ['La dimensión humana: espacios para compartir', 'Más autopistas dentro de la ciudad', 'Un parqueadero en cada cuadra', 'Calles solo para motos'],
    correctIndex: 0,
    book: { page: 22, chapter: CH_AMAZONIA },
  },
  {
    question: 'Para participar en el destino de su ciudad, ¿qué deben saber los ciudadanos?',
    options: ['Valorar la oferta ambiental del lugar donde viven', 'Solo las leyes de tránsito', 'Los precios de la vivienda en otras ciudades', 'Nada: deciden las empresas'],
    correctIndex: 0,
    book: { page: 22, chapter: CH_AMAZONIA },
  },
  {
    question: 'La «urbano-diversidad» pide mirar toda la riqueza de la región. ¿Qué incluye?',
    options: ['Su historia, su cultura, su entorno natural y su gente', 'Solo su economía urbana', 'Únicamente sus edificios', 'Solo sus vías y puentes'],
    correctIndex: 0,
    book: { page: 23, chapter: CH_AMAZONIA },
  },
  {
    question: 'Mocoa e Inírida sufrieron tragedias por lluvias. ¿Qué pide repensar el libro?',
    options: ['Cómo aprovechar el agua lluvia, recurso gratuito del cielo', 'Cómo evitar que llueva en la selva', 'Cómo tapar los ríos de la ciudad', 'Cómo mudar los pueblos a las montañas'],
    correctIndex: 0,
    book: { page: 128, chapter: CH_LLUVIA },
  },
  {
    question: 'La sede del Instituto Sinchi en Leticia se adapta al clima amazónico. ¿Cómo?',
    options: ['Recoge agua lluvia y tiene paneles solares', 'Usa aire acondicionado con plantas diésel', 'Compra el agua en botellas', 'No tiene ninguna adaptación'],
    correctIndex: 0,
    book: { page: 129, chapter: CH_LLUVIA },
  },
]

/**
 * Estación 2 — Caribe (Barranquilla y Ciénaga de Mallorquín). Capítulos de
 * Barranquilla, residuos sólidos y agua lluvia (corales del Caribe y San Andrés).
 */
export const OCEAN_QUESTIONS: MazeQuestion[] = [
  {
    question: '¿Cuánto espejo de agua perdió la Ciénaga de Mallorquín entre 1980 y 2010?',
    options: ['Unas 650 hectáreas: casi la mitad (43 %)', 'Unas 6 hectáreas: casi nada', 'Unas 65.000 hectáreas: todo', 'Nada: creció'],
    correctIndex: 0,
    book: { page: 26, chapter: CH_BARRANQUILLA },
  },
  {
    question: '¿Qué ecosistema estratégico protege la Ciénaga de Mallorquín, en el norte de Barranquilla?',
    options: ['El bosque de manglar', 'El páramo', 'El desierto', 'El bosque de niebla'],
    correctIndex: 0,
    book: { page: 26, chapter: CH_BARRANQUILLA },
  },
  {
    question: '¿Qué afecta la calidad del agua de la Ciénaga de Mallorquín, según el libro?',
    options: ['Vertimientos de desechos y falta de saneamiento básico', 'El exceso de lluvias de verano', 'La pesca con caña', 'La arena de las playas'],
    correctIndex: 0,
    book: { page: 27, chapter: CH_BARRANQUILLA },
  },
  {
    question: '¿De qué área Ramsar hace parte la Ciénaga de Mallorquín?',
    options: ['Delta Estuarino del Magdalena–Ciénaga Grande de Santa Marta', 'Parque Tayrona y Sierra Nevada', 'Delta del Orinoco y Llanos', 'Bahía de Cartagena e Islas del Rosario'],
    correctIndex: 0,
    book: { page: 27, chapter: CH_BARRANQUILLA },
  },
  {
    question: 'Cuando llueve y la gente arroja basura a la calle, ¿qué pasa en Barranquilla?',
    options: ['Se tapan los canales y los arroyos se desbordan', 'La lluvia limpia todo y no pasa nada', 'Los arroyos quedan más limpios', 'Baja la temperatura de la ciudad'],
    correctIndex: 0,
    book: { page: 28, chapter: CH_BARRANQUILLA },
  },
  {
    question: 'En Barranquilla la mitad de la gente no separa sus residuos. ¿Por qué, según el estudio?',
    options: ['No sabe a quién entregárselos', 'Está prohibido separar', 'No produce basura', 'Todo se recicla solo'],
    correctIndex: 0,
    book: { page: 28, chapter: CH_BARRANQUILLA },
  },
  {
    question: '¿Qué hace el programa «Barranquilla sin Arroyos»?',
    options: ['Canaliza los arroyos pluviales más peligrosos', 'Siembra manglar en cada arroyo', 'Prohíbe usar los arroyos', 'Convierte los arroyos en playas'],
    correctIndex: 0,
    book: { page: 28, chapter: CH_BARRANQUILLA },
  },
  {
    question: '¿Cuántos recicladores carnetizó Barranquilla en 2018 en su Red de Recuperadores Ambientales?',
    options: ['987', '98', '9.870', '1.987'],
    correctIndex: 0,
    book: { page: 29, chapter: CH_BARRANQUILLA },
  },
  {
    question: '¿Qué programa de Barranquilla busca sembrar y mantener 250.000 árboles?',
    options: ['Barranquilla Siembra', 'Barranquilla sin Arroyos', 'Barranquilla Recicla', 'Barranquilla Azul'],
    correctIndex: 0,
    book: { page: 29, chapter: CH_BARRANQUILLA },
  },
  {
    question: 'Colombia genera cada vez más residuos y aprovecha cerca del 17 %. ¿Qué modelo persiste?',
    options: ['La economía lineal: usar y botar', 'La economía circular', 'El residuo cero', 'El trueque de materiales'],
    correctIndex: 0,
    book: { page: 94, chapter: CH_RESIDUOS },
  },
  {
    question: '¿Qué es la Responsabilidad Extendida del Productor (REP)?',
    options: ['Los productores responden por sus productos ya usados', 'Los consumidores pagan doble impuesto', 'El Estado recoge todo gratis', 'Se prohíben los envases'],
    correctIndex: 0,
    book: { page: 96, chapter: CH_RESIDUOS },
  },
  {
    question: 'Según el libro, ¿qué está matando los arrecifes de coral de Cartagena y Santa Marta?',
    options: ['Los vertimientos de aguas servidas al mar Caribe', 'Los turistas que nadan', 'El agua demasiado limpia', 'Los peces de colores'],
    correctIndex: 0,
    book: { page: 127, chapter: CH_LLUVIA },
  },
  {
    question: '¿Qué es el «acueducto celestial» de las casas raizales de San Andrés?',
    options: ['Recoger y guardar el agua lluvia en cada casa', 'Un tubo que trae agua del mar', 'Agua en botellas importadas', 'Un pozo de petróleo'],
    correctIndex: 0,
    book: { page: 128, chapter: CH_LLUVIA },
  },
]

/**
 * Estación 3 — Región Andina (cerros, páramos y humedales). Capítulos de
 * Maddox, restauración ecológica, bosques urbanos, áreas de conservación local,
 * agua lluvia y humedal Córdoba.
 */
export const PARAMO_QUESTIONS: MazeQuestion[] = [
  {
    question: '¿Por qué un parque lineal da acceso a más gente que uno cuadrado del mismo tamaño?',
    options: ['Tiene más perímetro: más gente vive cerca', 'Tiene más árboles por metro cuadrado', 'Cuesta menos de mantener', 'Siempre queda en el centro'],
    correctIndex: 0,
    book: { page: 37, chapter: CH_MADDOX },
  },
  {
    question: '¿Qué especie invasora frena la regeneración del bosque nativo en los cerros de Bogotá?',
    options: ['El retamo', 'El frailejón', 'El roble', 'El musgo'],
    correctIndex: 0,
    book: { page: 121, chapter: CH_RESTAURACION },
  },
  {
    question: 'Además de las especies invasoras, ¿qué otras barreras frenan la restauración?',
    options: ['El fuego y los suelos con legado agropecuario', 'El agua demasiado limpia', 'Que haya demasiadas aves', 'Los senderos para caminar'],
    correctIndex: 0,
    book: { page: 121, chapter: CH_RESTAURACION },
  },
  {
    question: 'Casi todos los árboles plantados sobrevivieron, pero el sitio sigue siendo un potrero. ¿Qué falló?',
    options: ['Se midieron árboles vivos, no si el bosque volvía', 'Se plantaron muy pocos árboles', 'Nada: ya está restaurado', 'Faltó echarle cemento'],
    correctIndex: 0,
    book: { page: 120, chapter: CH_RESTAURACION },
  },
  {
    question: 'Los «ríos del cielo» que cruzan el Páramo de Sumapaz conectan ¿qué regiones?',
    options: ['La Amazonia, la Orinoquia y los Andes', 'Europa y Asia', 'Solo Bogotá y Soacha', 'El Caribe y el Pacífico'],
    correctIndex: 0,
    book: { page: 128, chapter: CH_LLUVIA },
  },
  {
    question: 'El libro propone invertir lo que se ahorre al cosechar agua lluvia. ¿En qué?',
    options: ['En conservar páramos y en educación ambiental', 'En comprar más agua embotellada', 'En construir autopistas', 'En nada: guardarlo'],
    correctIndex: 0,
    book: { page: 129, chapter: CH_LLUVIA },
  },
  {
    question: 'El humedal Córdoba recibe agua limpia de una quebrada de los cerros. ¿Qué logró?',
    options: ['Más oxígeno en el agua y más vida', 'Que el humedal se secara', 'Más malos olores', 'Que se fueran las aves'],
    correctIndex: 0,
    book: { page: 160, chapter: CH_CORDOBA },
  },
  {
    question: '¿Qué actividad se volvió la estrategia por excelencia para conservar el humedal Córdoba?',
    options: ['La observación de aves', 'Cerrarlo con muros', 'Convertirlo en parqueadero', 'Rellenarlo con tierra'],
    correctIndex: 0,
    book: { page: 159, chapter: CH_CORDOBA },
  },
  {
    question: 'Una ambiciosa ciclorruta puso en peligro al humedal Córdoba. ¿Qué amenazaba?',
    options: ['Más de 1.500 árboles y sus aves', 'Solo unas pocas flores', 'Los carros del barrio', 'Las tiendas de la zona'],
    correctIndex: 0,
    book: { page: 159, chapter: CH_CORDOBA },
  },
  {
    question: 'Fundación Natura propone bosques urbanos y periurbanos. ¿Qué tipo de solución son?',
    options: ['Soluciones basadas en la naturaleza, no solo en obras', 'Obras de concreto para las cuencas', 'Adornos para los parques', 'Canchas deportivas'],
    correctIndex: 0,
    book: { page: 48, chapter: CH_BOSQUES },
  },
  {
    question: '¿Cuánto puede bajar un bosque urbano el uso de aire acondicionado en los edificios?',
    options: ['Hasta un 30 %', 'Nada', 'El 100 %', 'Al contrario: lo aumenta'],
    correctIndex: 0,
    book: { page: 48, chapter: CH_BOSQUES },
  },
  {
    question: 'Según Fundación Natura, en los bosques urbanos hablamos de ¿qué?',
    options: ['Restauración, y no solo de sembrar árboles', 'Sembrar cualquier árbol sin cuidado', 'Usar solo especies extranjeras', 'Cubrir todo con pavimento'],
    correctIndex: 0,
    book: { page: 49, chapter: CH_BOSQUES },
  },
  {
    question: 'Si cada municipio protege su área natural sin coordinarse con los vecinos, ¿qué riesgo hay?',
    options: ['Que los ecosistemas se fragmenten', 'Más conexión entre ecosistemas', 'Menos trámites', 'Ninguno'],
    correctIndex: 0,
    book: { page: 56, chapter: CH_CONSERVACION },
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
