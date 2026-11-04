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
  // ---- Río ----
  {
    id: 'rio-cuenca',
    level: 'rio',
    concept: 'De dónde viene el agua del río',
    parts: {
      FIRE: {
        prompt: '¿Cómo se llama el territorio cuya agua de lluvia termina en un mismo río?',
        options: ['La cuenca', 'El delta', 'La represa', 'El puerto'],
      },
      WATER: {
        prompt: '¿Qué ecosistema de montaña es el nacimiento de muchos ríos de Colombia?',
        options: ['El páramo', 'El desierto', 'La playa', 'El manglar'],
      },
    },
    hints: ['Piensa en todo el terreno que rodea al río.', 'Allí crecen los frailejones.'],
    explanation: 'Cada río recoge el agua de su cuenca, y muchos nacen en los páramos: cuidarlos es cuidar el agua.',
  },
  {
    id: 'rio-ciclo',
    level: 'rio',
    concept: 'El ciclo del agua',
    parts: {
      FIRE: {
        prompt: '¿Cómo se llama el paso del agua líquida a vapor por el calor del sol?',
        options: ['Evaporación', 'Condensación', 'Precipitación', 'Infiltración'],
      },
      WATER: {
        prompt: '¿Cómo se llama la lluvia, el granizo o la nieve que cae de las nubes?',
        options: ['Precipitación', 'Evaporación', 'Filtración', 'Erosión'],
      },
    },
    hints: ['Uno sube al cielo como vapor.', 'El otro cae de las nubes.'],
    explanation: 'El agua se evapora, forma nubes y vuelve a caer como precipitación: es la misma agua dando vueltas.',
  },
  {
    id: 'rio-limpio',
    level: 'rio',
    concept: 'Un río limpio',
    parts: {
      FIRE: {
        prompt: '¿Qué NO se debe echar por el lavaplatos ni al río?',
        options: ['Aceite de cocina usado', 'Agua de lluvia', 'Agua del grifo', 'Agua con la que se lavaron frutas'],
      },
      WATER: {
        prompt: '¿Qué hace una planta de tratamiento de aguas residuales?',
        options: ['Limpia el agua usada antes de devolverla al río', 'Fabrica botellas', 'Produce gasolina', 'Calienta el agua de las casas'],
      },
    },
    hints: ['Un litro contamina muchísima agua.', 'La planta del final del río pasa de sucia a limpia.'],
    explanation: 'El aceite usado se guarda en una botella y se lleva a un punto de recolección; las plantas de tratamiento limpian el agua antes de devolverla.',
  },
  {
    id: 'rio-ahorro',
    level: 'rio',
    concept: 'Ahorrar agua',
    parts: {
      FIRE: {
        prompt: '¿Qué ahorra más agua al cepillarse los dientes?',
        options: ['Cerrar la llave mientras te cepillas', 'Dejar la llave abierta', 'Usar agua caliente', 'Cepillarte dos veces seguidas'],
      },
      WATER: {
        prompt: 'Una ducha gasta 10 litros por minuto. ¿Cuántos litros ahorras si te bañas 5 minutos en vez de 10?',
        options: ['50 litros', '10 litros', '5 litros', '100 litros'],
      },
    },
    hints: ['Uno es un hábito.', 'El otro se resuelve multiplicando.'],
    explanation: 'Cerrar la llave y bañarse más rápido ahorra decenas de litros cada día.',
  },
  {
    id: 'rio-orilla',
    level: 'rio',
    concept: 'Los árboles de la orilla',
    parts: {
      FIRE: {
        prompt: '¿Para qué sirven los árboles en la orilla de un río?',
        options: ['Sostienen la tierra para que no caiga al agua', 'Calientan el agua', 'Secan el río', 'Atraen basura'],
      },
      WATER: {
        prompt: '¿Qué le pasa a un río si talan el bosque que lo rodea?',
        options: ['Le cae más tierra y en verano lleva menos agua', 'Se vuelve más limpio', 'Tiene más peces', 'No le pasa nada'],
      },
    },
    hints: ['Piensa en las raíces.', 'Sin bosque, la lluvia arrastra la tierra.'],
    explanation: 'Las raíces sostienen las orillas y el bosque guarda agua: sin él, el río se llena de tierra y se seca más.',
  },
  // ---- Reciclaje ----
  {
    id: 'reciclaje-canecas',
    level: 'reciclaje',
    concept: 'Separar en la fuente',
    parts: {
      FIRE: {
        prompt: 'En Colombia, ¿de qué color es la caneca para plástico, vidrio, metal, papel y cartón limpios?',
        options: ['Blanca', 'Negra', 'Verde', 'Roja'],
      },
      WATER: {
        prompt: 'En Colombia, ¿de qué color es la caneca para restos de comida y cáscaras?',
        options: ['Verde', 'Blanca', 'Negra', 'Azul'],
      },
    },
    hints: ['Son tres colores: blanco, verde y negro.', 'Lo orgánico tiene el color de las plantas.'],
    explanation: 'Blanca para lo aprovechable, verde para lo orgánico y negra para lo que no se aprovecha.',
  },
  {
    id: 'reciclaje-negra',
    level: 'reciclaje',
    concept: 'Lo que no se aprovecha',
    parts: {
      FIRE: {
        prompt: '¿En qué caneca va una servilleta usada?',
        options: ['En la negra', 'En la blanca', 'En la verde', 'En cualquiera'],
      },
      WATER: {
        prompt: '¿Por qué hay que vaciar y enjuagar un envase antes de reciclarlo?',
        options: ['Para que no ensucie el resto del material', 'Para que pese más', 'Porque el agua lo derrite', 'No hace falta'],
      },
    },
    hints: ['Lo que está sucio ya no se puede reciclar.', 'Un envase sucio daña todo lo que toca.'],
    explanation: 'Lo sucio o contaminado va a la negra; un envase limpio sí se puede convertir en algo nuevo.',
  },
  {
    id: 'reciclaje-compost',
    level: 'reciclaje',
    concept: 'El compostaje',
    parts: {
      FIRE: {
        prompt: '¿Qué se obtiene al compostar restos de frutas y verduras?',
        options: ['Abono para las plantas', 'Plástico nuevo', 'Gasolina', 'Vidrio'],
      },
      WATER: {
        prompt: '¿Qué NO debe ir a la compostera?',
        options: ['Bolsas plásticas', 'Cáscaras de banano', 'Hojas secas', 'Cuncho de café'],
      },
    },
    hints: ['Las lombrices ayudan.', 'Solo va lo que se pudre solo.'],
    explanation: 'El compost convierte los restos orgánicos en abono; el plástico no se descompone y lo daña.',
  },
  {
    id: 'reciclaje-3r',
    level: 'reciclaje',
    concept: 'Reducir y reutilizar',
    parts: {
      FIRE: {
        prompt: '¿Cuál de estas acciones es REDUCIR?',
        options: ['Llevar tu propia bolsa de tela al mercado', 'Pedir una bolsa nueva cada vez', 'Comprar más empaques', 'Quemar la basura'],
      },
      WATER: {
        prompt: '¿Cuál de estas acciones es REUTILIZAR?',
        options: ['Usar un frasco de vidrio como portalápices', 'Botar el frasco', 'Comprar frascos nuevos cada semana', 'Romper el frasco'],
      },
    },
    hints: ['Reducir es generar menos basura.', 'Reutilizar es darle otro uso a lo mismo.'],
    explanation: 'Lo mejor es no generar basura (reducir); después, darle otro uso (reutilizar) y por último reciclar.',
  },
  {
    id: 'reciclaje-calculo',
    level: 'reciclaje',
    concept: 'Cuánto se tarda y cuánto se junta',
    parts: {
      FIRE: {
        prompt: '¿Qué tarda MÁS en degradarse en la naturaleza?',
        options: ['Una botella de plástico', 'Una cáscara de naranja', 'Una hoja de papel', 'Un corazón de manzana'],
      },
      WATER: {
        prompt: 'Un colegio separa 30 kg de cartón por semana. ¿Cuántos kg separa en 4 semanas?',
        options: ['120 kg', '34 kg', '90 kg', '7,5 kg'],
      },
    },
    hints: ['Uno dura cientos de años.', 'El otro se multiplica.'],
    explanation: 'Una botella puede durar cientos de años; separar cada semana suma mucho material que se recupera.',
  },
  // ---- Ciudad ----
  {
    id: 'ciudad-movilidad',
    level: 'ciudad',
    concept: 'Moverse por la ciudad',
    parts: {
      FIRE: {
        prompt: '¿Qué transporte con cables y cabinas sube a los barrios de montaña, como en Medellín?',
        options: ['El metrocable', 'El avión', 'El barco', 'El tren de vapor'],
      },
      WATER: {
        prompt: '¿Cómo se llama el carril exclusivo para bicicletas?',
        options: ['Ciclorruta', 'Autopista', 'Peaje', 'Bahía'],
      },
    },
    hints: ['Es como el teleférico de este escenario.', 'Mira el piso por el que caminan.'],
    explanation: 'El metrocable y la bicicleta mueven a mucha gente sin llenar la ciudad de humo.',
  },
  {
    id: 'ciudad-semaforo',
    level: 'ciudad',
    concept: 'Cruzar la calle',
    parts: {
      FIRE: {
        prompt: '¿Qué indica el muñeco verde del semáforo peatonal?',
        options: ['Que el peatón puede cruzar', 'Que los carros deben acelerar', 'Que hay que correr', 'Que el semáforo está dañado'],
      },
      WATER: {
        prompt: '¿Por dónde debe cruzar un peatón la calle?',
        options: ['Por la cebra o el paso peatonal', 'Por la mitad de la cuadra', 'Entre los carros', 'Por donde quiera'],
      },
    },
    hints: ['Verde es "siga".', 'Tiene rayas blancas en el piso.'],
    explanation: 'Se cruza por la cebra y con el semáforo peatonal en verde: así los conductores te esperan.',
  },
  {
    id: 'ciudad-verde',
    level: 'ciudad',
    concept: 'Una ciudad con plantas',
    parts: {
      FIRE: {
        prompt: '¿Qué hacen los árboles de la ciudad por el aire?',
        options: ['Lo limpian y dan sombra', 'Lo calientan', 'Lo llenan de humo', 'Nada'],
      },
      WATER: {
        prompt: '¿Cómo se llaman los techos cubiertos de plantas?',
        options: ['Techos verdes', 'Techos de zinc', 'Techos de vidrio', 'Tejados de barro'],
      },
    },
    hints: ['Piensa en la sombra de un parque.', 'Su nombre es su color.'],
    explanation: 'Árboles y techos verdes limpian el aire, refrescan la ciudad y guardan el agua de la lluvia.',
  },
  {
    id: 'ciudad-energia',
    level: 'ciudad',
    concept: 'Iluminar la ciudad',
    parts: {
      FIRE: {
        prompt: '¿Qué bombillo conviene en el alumbrado público para gastar menos energía?',
        options: ['LED', 'Incandescente', 'Halógeno', 'Vela'],
      },
      WATER: {
        prompt: 'Un farol solar se carga de día. ¿Con qué se carga?',
        options: ['Con un panel solar', 'Con gasolina', 'Con leña', 'Con carbón'],
      },
    },
    hints: ['Es el mismo de la casa que ahorra.', 'Mira el poste con el panel del escenario.'],
    explanation: 'Los faroles LED y solares iluminan la ciudad gastando poca energía, y la solar es limpia.',
  },
  {
    id: 'ciudad-calculo',
    level: 'ciudad',
    concept: 'Calcular el viaje',
    parts: {
      FIRE: {
        prompt: 'Una cabina del teleférico lleva 8 personas. ¿Cuántas personas llevan 5 cabinas?',
        options: ['40', '13', '35', '45'],
      },
      WATER: {
        prompt: 'En bicicleta recorres 12 km en 1 hora. ¿Cuántos km recorres en media hora?',
        options: ['6 km', '12 km', '24 km', '3 km'],
      },
    },
    hints: ['Uno multiplica.', 'El otro divide entre 2.'],
    explanation: 'Calcular cuánta gente se mueve y cuánto tarda ayuda a planear una ciudad sin trancones.',
  },
];

export function questionsOf(level: string): DuoQuestion[] {
  return DUO_QUESTION_BANK.filter((q) => q.level === level);
}

/** Opciones que le tocan a un rol (cada uno tiene las suyas). */
export function optionsFor(question: DuoQuestion, role: DuoRole): string[] {
  return question.parts[role].options;
}
