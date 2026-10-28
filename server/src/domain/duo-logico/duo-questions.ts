import type { DuoRole } from './shared/duoTypes.js';

/**
 * Preguntas de las Puertas del Saber. Viven solo en el servidor: el cliente
 * recibe las opciones barajadas y nunca cuál es la correcta.
 *
 * Un solo formato: cada personaje tiene SU pregunta (distinta a la del
 * compañero) sobre el mismo concepto, y la puerta se abre solo si aciertan
 * los dos. Ninguno ve la pregunta del otro: pueden ayudarse por el chat.
 *
 * El primer elemento de cada lista de opciones es el correcto (se barajan al mostrarlas).
 */
export interface DuoQuestionPart {
  prompt: string;
  options: string[];
}

export interface DuoQuestion {
  id: string;
  /** Escenario al que pertenece (sus puertas solo sacan preguntas de su tema). */
  level: string;
  /** El concepto que une las dos preguntas (lo ven los dos). */
  concept: string;
  parts: Record<DuoRole, DuoQuestionPart>;
  /** Pistas que se destapan con las fichas recogidas en el tramo. */
  hints: string[];
  /** Se muestra al acertar los dos: lo que se aprende. */
  explanation: string;
}

export const DUO_QUESTION_BANK: readonly DuoQuestion[] = [
  // ---- Bosque ----
  {
    id: 'paramo',
    level: 'bosque',
    concept: 'El páramo',
    parts: {
      FIRE: {
        prompt: '¿Qué ecosistema de alta montaña es una "fábrica de agua" para Bogotá?',
        options: ['El páramo', 'El desierto de la Tatacoa', 'El manglar', 'La sabana de los Llanos'],
      },
      WATER: {
        prompt: '¿Qué planta del páramo atrapa el agua de la niebla con sus hojas peludas?',
        options: ['El frailejón', 'El cactus', 'La palma de cera', 'El girasol'],
      },
    },
    hints: ['Está por encima de los 3.000 metros.', 'Crece muy despacio: un centímetro al año.'],
    explanation: 'Los páramos atrapan el agua de la niebla y la sueltan poco a poco; sus frailejones son esponjas vivas.',
  },
  {
    id: 'humedal-ciudad',
    level: 'bosque',
    concept: 'Naturaleza en la ciudad',
    parts: {
      FIRE: {
        prompt: '¿Para qué sirve un corredor biológico?',
        options: ['Para que los animales se muevan entre zonas verdes', 'Para que los carros lleguen más rápido', 'Para construir centros comerciales', 'Para guardar escombros'],
      },
      WATER: {
        prompt: '¿Por qué son importantes los humedales de Bogotá?',
        options: ['Guardan agua de lluvia y son hogar de aves', 'Sirven para botar basura', 'Son buenos para construir edificios', 'Producen electricidad'],
      },
    },
    hints: ['Piensa en las aves y las abejas.', 'Funcionan como una esponja.'],
    explanation: 'Corredores y humedales permiten que la fauna viva en la ciudad y evitan inundaciones.',
  },
  {
    id: 'movilidad',
    level: 'bosque',
    concept: 'Moverse sin humo',
    parts: {
      FIRE: {
        prompt: '¿Qué transporte eléctrico lleva a muchas personas a la vez?',
        options: ['El metro', 'La camioneta a gasolina', 'La moto', 'El avión'],
      },
      WATER: {
        prompt: '¿Qué transporte se mueve solo con la fuerza de las piernas?',
        options: ['La bicicleta', 'El bus diésel', 'El taxi', 'El carro particular'],
      },
    },
    hints: ['Uno es para muchos; el otro, para uno solo.', 'Ninguno echa humo.'],
    explanation: 'Metro eléctrico y ciclorrutas reducen el humo y el ruido de la ciudad.',
  },
  {
    id: 'rio-limpio',
    level: 'bosque',
    concept: 'Un río limpio',
    parts: {
      FIRE: {
        prompt: '¿Qué limpia el agua sucia de las casas antes de llegar al río?',
        options: ['Una planta de tratamiento', 'Más tubos hacia el río', 'Pintar las orillas', 'Un parqueadero'],
      },
      WATER: {
        prompt: '¿Qué protege las orillas del río y filtra el agua de lluvia?',
        options: ['Árboles nativos en la orilla', 'Cemento en las orillas', 'Vallas publicitarias', 'Quitar la vegetación'],
      },
    },
    hints: ['Una solución es una obra; la otra, naturaleza.', 'Una actúa antes del río y otra en su orilla.'],
    explanation: 'Tratar las aguas residuales y recuperar el bosque de las orillas limpian ríos como el Bogotá.',
  },
  {
    id: 'costa-andes',
    level: 'bosque',
    concept: 'Ecosistemas de Colombia',
    parts: {
      FIRE: {
        prompt: '¿Qué ecosistema de la costa tiene raíces que salen del agua salada?',
        options: ['El manglar', 'El páramo', 'El bosque seco', 'El nevado'],
      },
      WATER: {
        prompt: '¿Qué ave gigante de los Andes está en el escudo de Colombia?',
        options: ['El cóndor', 'El colibrí', 'La guacamaya', 'El tucán'],
      },
    },
    hints: ['Uno está junto al mar; el otro, en las montañas.', 'Las raíces parecen zancos.'],
    explanation: 'Los manglares protegen la costa y el cóndor depende de las montañas: los dos necesitan cuidado.',
  },
  // ---- Planta solar ----
  {
    id: 'solar-sistema',
    level: 'solar',
    concept: 'Luz solar día y noche',
    parts: {
      FIRE: {
        prompt: '¿Qué convierte la luz del sol en electricidad?',
        options: ['El panel solar', 'La batería', 'El cable', 'El bombillo'],
      },
      WATER: {
        prompt: '¿Qué guarda la energía del día para usarla de noche?',
        options: ['La batería', 'El panel solar', 'El interruptor', 'La ventana'],
      },
    },
    hints: ['Una parte produce y la otra guarda.', 'Los celulares también tienen una de las dos.'],
    explanation: 'Paneles más baterías: así una casa o escuela tiene luz aunque no haya sol.',
  },
  {
    id: 'solar-renovable',
    level: 'solar',
    concept: 'Energía renovable',
    parts: {
      FIRE: {
        prompt: '¿Por qué la energía del sol es renovable?',
        options: ['Su fuente no se agota al usarla', 'Se saca de debajo de la tierra', 'Se quema para dar calor', 'Solo funciona en ciudades'],
      },
      WATER: {
        prompt: '¿Cuál de estas fuentes NO es renovable?',
        options: ['El carbón', 'El viento', 'El sol', 'El agua de los ríos'],
      },
    },
    hints: ['Mañana el sol vuelve a salir.', 'Una tarda millones de años en formarse.'],
    explanation: 'Sol y viento se renuevan solos; carbón y petróleo se agotan y contaminan al quemarse.',
  },
  {
    id: 'solar-guajira',
    level: 'solar',
    concept: 'El norte de Colombia',
    parts: {
      FIRE: {
        prompt: '¿Por qué el Cesar y La Guajira son buenos para paneles solares?',
        options: ['Reciben mucho sol todo el año', 'Llueve casi todos los días', 'Están cubiertos de nieve', 'Tienen poca luz'],
      },
      WATER: {
        prompt: '¿Qué aprovechan los molinos gigantes de La Guajira?',
        options: ['El viento', 'El carbón', 'El petróleo', 'La leña'],
      },
    },
    hints: ['Piensa en el clima del Caribe.', 'Los molinos se llaman aerogeneradores.'],
    explanation: 'El norte de Colombia tiene mucho sol y vientos constantes: dos fuentes limpias.',
  },
  {
    id: 'solar-calculo',
    level: 'solar',
    concept: 'Calcular la energía',
    parts: {
      FIRE: {
        prompt: '6 paneles dan 2 kWh cada uno. ¿Cuánto dan en total?',
        options: ['12 kWh', '8 kWh', '6 kWh', '3 kWh'],
      },
      WATER: {
        prompt: 'Una batería de 3 kWh y una nevera que gasta 0,5 kWh por hora. ¿Cuántas horas dura?',
        options: ['6 horas', '3 horas', '1,5 horas', '12 horas'],
      },
    },
    hints: ['Uno multiplica.', 'El otro divide.'],
    explanation: 'Saber cuánto produce y cuánto gasta cada aparato ayuda a no desperdiciar energía.',
  },
  {
    id: 'solar-ahorro',
    level: 'solar',
    concept: 'Ahorrar energía en casa',
    parts: {
      FIRE: {
        prompt: '¿Qué bombillo gasta menos dando la misma luz?',
        options: ['El LED', 'El incandescente', 'El halógeno', 'Todos gastan igual'],
      },
      WATER: {
        prompt: '¿Qué hacer con los aparatos que nadie usa?',
        options: ['Desconectarlos', 'Dejarlos en espera', 'Subirles el volumen', 'Taparlos'],
      },
    },
    hints: ['Uno es cambiar algo; el otro, un hábito.', 'Un aparato en espera sigue gastando.'],
    explanation: 'Un LED gasta mucho menos, y desconectar evita el consumo "fantasma".',
  },
];

export function questionsOf(level: string): DuoQuestion[] {
  return DUO_QUESTION_BANK.filter((q) => q.level === level);
}

/** Opciones que le tocan a un rol (cada uno tiene las suyas). */
export function optionsFor(question: DuoQuestion, role: DuoRole): string[] {
  return question.parts[role].options;
}
