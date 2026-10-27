import type { DuoQuestionFormat, DuoRole } from './shared/duoTypes.js';

/**
 * Preguntas de las Puertas del Saber. Viven solo en el servidor: el cliente
 * recibe las opciones barajadas y nunca cuál es la correcta.
 *
 * Tres formatos, todos exigen que los dos acierten:
 *  - MIRROR: la misma pregunta para los dos, cada uno responde en secreto.
 *  - SPLIT: cada uno ve solo la mitad de los datos; tienen que contárselos.
 *  - TWO_PART: cada uno resuelve su parte de un mismo problema.
 *
 * El primer elemento de cada lista de opciones es el correcto (se barajan al mostrarlas).
 */
interface QuestionBase {
  id: string;
  /** Escenario al que pertenece (sus puertas solo sacan preguntas de su tema). */
  level: string;
  /** Pistas que se destapan con las fichas recogidas en el tramo. */
  hints: string[];
  /** Se muestra al acertar los dos: lo que se aprende. */
  explanation: string;
}

export interface DuoMirrorQuestion extends QuestionBase {
  format: 'MIRROR';
  prompt: string;
  options: string[];
}

export interface DuoSplitQuestion extends QuestionBase {
  format: 'SPLIT';
  prompt: string;
  clues: Record<DuoRole, string>;
  options: string[];
}

export interface DuoTwoPartQuestion extends QuestionBase {
  format: 'TWO_PART';
  prompt: string;
  parts: Record<DuoRole, { prompt: string; options: string[] }>;
}

export type DuoQuestion = DuoMirrorQuestion | DuoSplitQuestion | DuoTwoPartQuestion;

export const DUO_QUESTION_BANK: readonly DuoQuestion[] = [
  // ---- Espejo ----
  {
    id: 'paramo-agua',
    level: 'bosque',
    format: 'MIRROR',
    prompt: '¿Qué ecosistema de alta montaña funciona como una "fábrica de agua" para ciudades como Bogotá?',
    options: ['El páramo', 'El desierto de la Tatacoa', 'El manglar', 'La sabana de los Llanos'],
    hints: ['Está por encima de los 3.000 metros de altura.', 'Allí crecen los frailejones.'],
    explanation: 'Los páramos, como Chingaza y Sumapaz, atrapan el agua de la niebla y la lluvia y la sueltan poco a poco. Colombia tiene cerca de la mitad de los páramos del mundo.',
  },
  {
    id: 'frailejon',
    level: 'bosque',
    format: 'MIRROR',
    prompt: '¿Qué planta del páramo atrapa el agua de la niebla con sus hojas peludas y la entrega poco a poco al suelo?',
    options: ['El frailejón', 'El cactus', 'La palma de cera', 'El girasol'],
    hints: ['Crece muy despacio: más o menos un centímetro al año.', 'Su nombre empieza por F.'],
    explanation: 'Los frailejones son esponjas vivas del páramo. Como crecen tan despacio, uno de un metro puede tener casi cien años: por eso hay que cuidarlos.',
  },
  {
    id: 'corredor-biologico',
    level: 'bosque',
    format: 'MIRROR',
    prompt: 'En una ciudad sostenible, ¿para qué sirve un corredor biológico?',
    options: [
      'Para unir zonas verdes y que los animales puedan moverse entre ellas',
      'Para que los carros lleguen más rápido',
      'Para construir más centros comerciales',
      'Para guardar los escombros de las obras',
    ],
    hints: ['Piensa en las aves, las ardillas y las abejas de la ciudad.', 'Une parques, quebradas y cerros con árboles.'],
    explanation: 'Los corredores biológicos, como los que unen los cerros con los humedales, permiten que la fauna se mueva, se alimente y se reproduzca dentro de la ciudad.',
  },
  {
    id: 'humedales',
    level: 'bosque',
    format: 'MIRROR',
    prompt: 'Bogotá protege humedales como La Conejera y Juan Amarillo. ¿Por qué son importantes para la ciudad?',
    options: [
      'Guardan agua de lluvia, evitan inundaciones y son hogar de aves',
      'Sirven para botar la basura de los barrios',
      'Son el mejor lugar para construir edificios',
      'Producen la electricidad de la ciudad',
    ],
    hints: ['Funcionan como una esponja cuando llueve mucho.', 'Allí llegan aves migratorias.'],
    explanation: 'Los humedales absorben el agua de los aguaceros, la limpian y dan refugio a muchas especies, entre ellas aves que viajan desde Norteamérica.',
  },
  // ---- Información dividida ----
  {
    id: 'ahorro-agua',
    level: 'bosque',
    format: 'SPLIT',
    prompt: 'Una familia cambió dos hábitos. ¿Cuántos litros de agua ahorra en total cada día?',
    clues: {
      FIRE: 'Cerrar la llave mientras se cepillan los dientes le ahorra 12 litros al día.',
      WATER: 'Bañarse en 5 minutos en vez de 10 le ahorra 40 litros al día.',
    },
    options: ['52 litros', '40 litros', '12 litros', '28 litros'],
    hints: ['Tienen que juntar los dos datos.', 'Es una suma.'],
    explanation: 'Los pequeños hábitos se suman: con 52 litros diarios la familia ahorra más de 18.000 litros en un año.',
  },
  {
    id: 'arboles-faltan',
    level: 'bosque',
    format: 'SPLIT',
    prompt: 'El colegio está reforestando la quebrada con árboles nativos. ¿Cuántos árboles faltan por sembrar?',
    clues: {
      FIRE: 'La meta es sembrar 120 árboles nativos.',
      WATER: 'Ya se sembraron 85 árboles.',
    },
    options: ['35 árboles', '85 árboles', '120 árboles', '205 árboles'],
    hints: ['Uno tiene la meta y el otro lo que ya se hizo.', 'Es una resta.'],
    explanation: 'Los árboles nativos, como el aliso o el guayacán, protegen las orillas de las quebradas y atraen a la fauna de la región.',
  },
  {
    id: 'manglar',
    level: 'bosque',
    format: 'SPLIT',
    prompt: '¿De qué ecosistema colombiano hablan las dos pistas?',
    clues: {
      FIRE: 'Está en la costa, donde los ríos se juntan con el mar.',
      WATER: 'Sus árboles tienen raíces que salen del agua salada y frenan las olas.',
    },
    options: ['El manglar', 'El páramo', 'El bosque seco', 'El nevado'],
    hints: ['Hay en el Pacífico y en el Caribe colombiano.', 'Sus raíces parecen zancos.'],
    explanation: 'Los manglares protegen la costa de la erosión y son guardería de peces y cangrejos. Colombia los tiene en sus dos océanos.',
  },
  {
    id: 'condor',
    level: 'bosque',
    format: 'SPLIT',
    prompt: '¿De qué animal hablan las dos pistas?',
    clues: {
      FIRE: 'Es una de las aves voladoras más grandes del mundo y está en el escudo de Colombia.',
      WATER: 'Vive en los Andes y planea sobre las montañas casi sin aletear.',
    },
    options: ['El cóndor de los Andes', 'El colibrí', 'La guacamaya', 'El tucán'],
    hints: ['Con las alas abiertas puede medir más de tres metros.', 'Es símbolo nacional.'],
    explanation: 'El cóndor de los Andes está en peligro. Cuidar los páramos y las montañas donde vive ayuda a que no desaparezca.',
  },
  // ---- Dos partes ----
  {
    id: 'movilidad',
    level: 'bosque',
    format: 'TWO_PART',
    prompt: 'La ciudad quiere que la gente se mueva sin llenar el aire de humo.',
    parts: {
      FIRE: {
        prompt: '¿Qué transporte eléctrico lleva a muchas personas a la vez, como el de Medellín?',
        options: ['El metro', 'La camioneta a gasolina', 'La moto', 'El avión'],
      },
      WATER: {
        prompt: '¿Qué transporte no usa combustible y se mueve con la fuerza de las piernas?',
        options: ['La bicicleta', 'El bus diésel', 'El taxi', 'El carro particular'],
      },
    },
    hints: ['Una parte es para muchas personas; la otra, para una sola.', 'Ninguno de los dos echa humo.'],
    explanation: 'Combinar transporte masivo eléctrico con ciclorrutas, como en Medellín y Bogotá, reduce el humo y el ruido de la ciudad.',
  },
  {
    id: 'rio-limpio',
    level: 'bosque',
    format: 'TWO_PART',
    prompt: 'El río que atraviesa la ciudad está contaminado. Cada uno propone una solución.',
    parts: {
      FIRE: {
        prompt: '¿Qué limpia el agua sucia de las casas antes de que llegue al río?',
        options: ['Una planta de tratamiento de aguas residuales', 'Más tubos que desemboquen en el río', 'Pintar las orillas', 'Un parqueadero junto al río'],
      },
      WATER: {
        prompt: '¿Qué protege las orillas del río y ayuda a filtrar el agua de lluvia?',
        options: ['Sembrar árboles nativos en la orilla', 'Cubrir las orillas con cemento', 'Poner vallas publicitarias', 'Quitar toda la vegetación'],
      },
    },
    hints: ['Una solución es una obra; la otra es naturaleza.', 'Una actúa antes del río y la otra en su orilla.'],
    explanation: 'Tratar las aguas residuales y recuperar el bosque de las orillas son las dos mitades de la limpieza de ríos como el Bogotá o el Medellín.',
  },
  {
    id: 'energia-limpia',
    level: 'bosque',
    format: 'TWO_PART',
    prompt: 'El colegio quiere funcionar con energía limpia.',
    parts: {
      FIRE: {
        prompt: '¿Qué aprovecha la luz del sol para producir electricidad?',
        options: ['Los paneles solares', 'Una planta de carbón', 'Un generador diésel', 'La leña'],
      },
      WATER: {
        prompt: '¿Qué aprovecha la fuerza del viento, como en La Guajira?',
        options: ['Los aerogeneradores', 'Una planta de carbón', 'Un generador a gasolina', 'Las velas de cera'],
      },
    },
    hints: ['Una fuente viene del cielo de día; la otra sopla.', 'Ninguna se quema.'],
    explanation: 'Colombia tiene mucho sol y, en La Guajira, vientos fuertes y constantes: dos fuentes renovables que no contaminan el aire.',
  },
  // ---- Planta solar ----
  {
    id: 'solar-bateria',
    level: 'solar',
    format: 'MIRROR',
    prompt: 'Una casa con paneles solares quiere tener luz también de noche. ¿Qué parte del sistema guarda la energía del día?',
    options: ['La batería', 'El panel solar', 'El cable', 'El bombillo'],
    hints: ['Es como un tanque, pero de electricidad.', 'Los celulares también tienen una.'],
    explanation: 'Los paneles producen electricidad solo mientras hay sol; la batería guarda la que sobra para usarla de noche o en días nublados.',
  },
  {
    id: 'solar-renovable',
    level: 'solar',
    format: 'MIRROR',
    prompt: '¿Por qué se dice que la energía del sol y del viento es renovable?',
    options: [
      'Porque viene de fuentes que no se agotan al usarlas',
      'Porque se saca de debajo de la tierra',
      'Porque se quema para producir calor',
      'Porque solo funciona en las ciudades',
    ],
    hints: ['Mañana el sol volverá a salir.', 'Lo contrario serían el carbón o el petróleo.'],
    explanation: 'El sol y el viento se renuevan solos. El carbón y el petróleo tardan millones de años en formarse y, al quemarlos, contaminan el aire.',
  },
  {
    id: 'solar-caribe',
    level: 'solar',
    format: 'MIRROR',
    prompt: 'En el Cesar y en La Guajira se construyen parques solares. ¿Por qué esa región es buena para los paneles?',
    options: [
      'Recibe mucho sol durante casi todo el año',
      'Allí llueve casi todos los días',
      'Está cubierta de nieve',
      'Tiene muy poca luz de día',
    ],
    hints: ['Piensa en el clima de la región Caribe.', 'Los paneles necesitan luz.'],
    explanation: 'El norte de Colombia tiene mucha radiación solar, por eso allí funcionan parques solares como El Paso, en el Cesar.',
  },
  {
    id: 'solar-paneles-techo',
    level: 'solar',
    format: 'SPLIT',
    prompt: 'El colegio puso paneles en el techo. ¿Cuánta energía producen en total en un día soleado?',
    clues: {
      FIRE: 'Cada panel produce 2 kWh en un día soleado.',
      WATER: 'En el techo hay 6 paneles.',
    },
    options: ['12 kWh', '8 kWh', '6 kWh', '3 kWh'],
    hints: ['Uno sabe cuánto da cada panel; el otro, cuántos hay.', 'Es una multiplicación.'],
    explanation: '6 paneles × 2 kWh = 12 kWh al día: suficiente para mantener encendidos muchos bombillos LED del colegio.',
  },
  {
    id: 'solar-nevera',
    level: 'solar',
    format: 'SPLIT',
    prompt: '¿Cuántas horas puede funcionar la nevera de la tienda solo con la batería?',
    clues: {
      FIRE: 'La batería guarda 3 kWh de energía.',
      WATER: 'La nevera gasta medio kWh (0,5 kWh) cada hora.',
    },
    options: ['6 horas', '3 horas', '1 hora y media', '12 horas'],
    hints: ['Uno tiene lo que hay guardado; el otro, lo que se gasta por hora.', 'Es una división.'],
    explanation: '3 kWh ÷ 0,5 kWh por hora = 6 horas. Saber cuánto gasta cada aparato ayuda a no desperdiciar energía.',
  },
  {
    id: 'solar-eolica',
    level: 'solar',
    format: 'SPLIT',
    prompt: '¿De qué fuente de energía hablan las dos pistas?',
    clues: {
      FIRE: 'No echa humo y nunca se acaba.',
      WATER: 'Mueve las aspas de unos molinos gigantes en La Guajira.',
    },
    options: ['El viento (energía eólica)', 'El carbón', 'El petróleo', 'La leña'],
    hints: ['Sopla.', 'Los molinos modernos se llaman aerogeneradores.'],
    explanation: 'La Guajira tiene vientos fuertes y constantes; por eso allí se instalan aerogeneradores que convierten el viento en electricidad.',
  },
  {
    id: 'solar-escuela-rural',
    level: 'solar',
    format: 'TWO_PART',
    prompt: 'Una escuela rural no tiene conexión a la red eléctrica y quiere luz todo el día.',
    parts: {
      FIRE: {
        prompt: '¿Qué instalan para producir electricidad con la luz del día?',
        options: ['Paneles solares', 'Un generador de gasolina', 'Una fogata', 'Más ventanas'],
      },
      WATER: {
        prompt: '¿Qué necesitan para tener luz también por la noche?',
        options: ['Baterías que guarden la energía', 'Velas de cera', 'Un espejo grande', 'Cortinas oscuras'],
      },
    },
    hints: ['Una parte produce y la otra guarda.', 'Ninguna de las dos echa humo.'],
    explanation: 'Paneles más baterías: así muchas escuelas rurales de Colombia tienen luz y pueden cargar sus computadores sin contaminar.',
  },
  {
    id: 'solar-ahorro-casa',
    level: 'solar',
    format: 'TWO_PART',
    prompt: 'En casa quieren gastar menos energía.',
    parts: {
      FIRE: {
        prompt: '¿Qué bombillo gasta menos electricidad dando la misma luz?',
        options: ['El bombillo LED', 'El bombillo incandescente', 'El halógeno', 'Todos gastan igual'],
      },
      WATER: {
        prompt: '¿Qué hacer con los aparatos que nadie está usando?',
        options: ['Desconectarlos', 'Dejarlos en espera toda la noche', 'Subirles el volumen', 'Taparlos con una cobija'],
      },
    },
    hints: ['Una parte es cambiar algo; la otra, un hábito.', 'Un aparato en espera sigue gastando.'],
    explanation: 'Un LED gasta mucho menos que un bombillo incandescente, y desconectar lo que no se usa evita el consumo "fantasma" de los aparatos en espera.',
  },
];

export function questionsOf(format: DuoQuestionFormat, level: string): DuoQuestion[] {
  return DUO_QUESTION_BANK.filter((q) => q.format === format && q.level === level);
}

/** Opciones que le tocan a un rol (en TWO_PART cada uno tiene las suyas). */
export function optionsFor(question: DuoQuestion, role: DuoRole): string[] {
  return question.format === 'TWO_PART' ? question.parts[role].options : question.options;
}
