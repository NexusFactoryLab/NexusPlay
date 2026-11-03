/**
 * Juegos del Sylabus «El poder de las probabilidades» (FFPO0005, Universidad EAN, 2025):
 * una adaptación por mecánica de NexusPlay, alineada con los tres hitos del curso.
 *
 *  - Hito 1 · Fundamentos: población, muestra, parámetro, estadístico, muestreo, variables.
 *  - Hito 2 · Descripción de datos: frecuencias, gráficos, atípicos, tendencia central, variabilidad, forma.
 *  - Hito 3 · Incertidumbre: reglas básicas, probabilidad condicional, total y teorema de Bayes.
 *
 * Es solo datos (sin tocar la base): `seed-sylabus.ts` los escribe y `sylabus-games.spec.ts` los
 * pasa por los validadores reales de cada tipo de juego. Todos los textos son material de refuerzo
 * y deben ser revisados por el docente antes de usarse con estudiantes; no reemplazan el trabajo
 * con datos reales ni con software estadístico (Excel, R, Python, SPSS, Power BI).
 */

export const SYLABUS_CATEGORY = { name: 'Estadística', slug: 'estadistica' } as const;

/** Claves de las imágenes que sube `scripts/sylabus-upload-images.mjs`. */
export type SylabusImageKey =
  | 'histograma-simetrico'
  | 'histograma-bimodal'
  | 'histograma-multimodal'
  | 'histograma-sesgo-derecha'
  | 'histograma-sesgo-izquierda'
  | 'diagrama-caja-atipicos'
  | 'diagrama-dispersion'
  | 'grafico-circular'
  | 'diagrama-pareto'
  | 'distribucion-normal'
  | 'tallo-y-hojas'
  | 'diagrama-venn'
  | 'arbol-probabilidad'
  | 'teorema-bayes';

export type SylabusImages = Record<SylabusImageKey, { url: string }>;

export interface SylabusGame {
  id: string;
  slug: string;
  title: string;
  description: string;
  gameType: string;
  primaryColor: string;
  coverImageUrl: string | null;
  config: Record<string, unknown>;
  content: unknown[];
}

const SOURCE_NOTE =
  ' Basado en el Sylabus «El poder de las probabilidades» (FFPO0005). Material de refuerzo: no sustituye el análisis de datos reales con software estadístico.';

/* ------------------------------------------------------------------ */
/* MatchMente · opuestos conceptuales (Hito 1)                          */
/* ------------------------------------------------------------------ */

const MATCHMENTE_CONCEPTOS = [
  {
    pairId: 'poblacion-muestra',
    posTitle: 'Población',
    posDescription: 'Conjunto completo de individuos u objetos que se quiere estudiar.',
    negTitle: 'Muestra',
    negDescription: 'Subconjunto de la población que se observa realmente para sacar conclusiones.',
  },
  {
    pairId: 'parametro-estadistico',
    posTitle: 'Parámetro',
    posDescription: 'Valor que describe a toda la población (por ejemplo, la media de todos los estudiantes).',
    negTitle: 'Estadístico',
    negDescription: 'Valor calculado con los datos de una muestra para estimar el parámetro.',
  },
  {
    pairId: 'cualitativa-cuantitativa',
    posTitle: 'Variable cualitativa',
    posDescription: 'Describe una cualidad o categoría: carrera, color de ojos, nivel de satisfacción.',
    negTitle: 'Variable cuantitativa',
    negDescription: 'Se expresa con números sobre los que tiene sentido operar: estatura, edad, ingresos.',
  },
  {
    pairId: 'discreta-continua',
    posTitle: 'Variable discreta',
    posDescription: 'Toma valores que se cuentan, normalmente enteros: número de hermanos, de visitas.',
    negTitle: 'Variable continua',
    negDescription: 'Puede tomar cualquier valor de un intervalo: peso, tiempo, temperatura.',
  },
  {
    pairId: 'probabilistico-no-probabilistico',
    posTitle: 'Muestreo probabilístico',
    posDescription: 'Todos los individuos tienen una probabilidad conocida de ser elegidos (aleatorio simple, estratificado).',
    negTitle: 'Muestreo no probabilístico',
    negDescription: 'Se elige por conveniencia o criterio del investigador; no se puede medir el error de muestreo.',
  },
  {
    pairId: 'observacional-experimental',
    posTitle: 'Estudio observacional',
    posDescription: 'El investigador observa y registra sin modificar las condiciones de los participantes.',
    negTitle: 'Estudio experimental',
    negDescription: 'El investigador asigna tratamientos y controla condiciones para evaluar su efecto.',
  },
  {
    pairId: 'independientes-dependientes',
    posTitle: 'Eventos independientes',
    posDescription: 'Que uno ocurra no cambia la probabilidad del otro: P(A y B) = P(A) · P(B).',
    negTitle: 'Eventos dependientes',
    negDescription: 'Que uno ocurra sí cambia la probabilidad del otro; se usa la probabilidad condicional.',
  },
  {
    pairId: 'priori-posteriori',
    posTitle: 'Probabilidad a priori',
    posDescription: 'Lo que se cree sobre un evento antes de conocer nueva evidencia (por ejemplo, la prevalencia).',
    negTitle: 'Probabilidad a posteriori',
    negDescription: 'La probabilidad actualizada con el teorema de Bayes después de observar la evidencia.',
  },
].map((pair) => ({ mode: 'OPPOSITES' as const, posImageUrl: null, negImageUrl: null, ...pair }));

/* ------------------------------------------------------------------ */
/* MatchMente · reconoce el gráfico (Hito 2)                            */
/* ------------------------------------------------------------------ */

function matchmenteGraficos(images: SylabusImages): unknown[] {
  const pairs: [string, SylabusImageKey, string][] = [
    ['hist-simetrico', 'histograma-simetrico', 'Histograma simétrico (en forma de campana)'],
    ['hist-bimodal', 'histograma-bimodal', 'Histograma bimodal (dos picos)'],
    ['hist-sesgo-der', 'histograma-sesgo-derecha', 'Sesgo a la derecha (cola larga a la derecha)'],
    ['hist-sesgo-izq', 'histograma-sesgo-izquierda', 'Sesgo a la izquierda (cola larga a la izquierda)'],
    ['caja', 'diagrama-caja-atipicos', 'Diagrama de caja con valores atípicos'],
    ['dispersion', 'diagrama-dispersion', 'Diagrama de dispersión (dos variables)'],
    ['circular', 'grafico-circular', 'Gráfico circular (partes de un total)'],
    ['pareto', 'diagrama-pareto', 'Diagrama de Pareto'],
    ['normal', 'distribucion-normal', 'Distribución normal'],
    ['tallo-hojas', 'tallo-y-hojas', 'Diagrama de tallo y hojas'],
  ];
  return pairs.map(([pairId, key, label]) => ({ mode: 'PAIRS', pairId, imageUrl: images[key].url, label }));
}

/* ------------------------------------------------------------------ */
/* Identidad Oculta · tipos de gráfico (Hitos 1-3)                      */
/* ------------------------------------------------------------------ */

interface CardSeed {
  id: string;
  label: string;
  image: SylabusImageKey;
  info: string;
  /** ids de rasgo que SÍ tiene la tarjeta. */
  traits: string[];
}

const GUESS_WHO_TRAITS: Record<string, { question: string; category: string }> = {
  histograma: { question: '¿Es un histograma?', category: 'Tipo' },
  barras: { question: '¿Está formado por barras?', category: 'Aspecto' },
  campana: { question: '¿Su forma es de campana?', category: 'Forma' },
  'varios-picos': { question: '¿Tiene más de un pico (moda)?', category: 'Forma' },
  sesgo: { question: '¿Es asimétrico (tiene sesgo)?', category: 'Forma' },
  'dos-variables': { question: '¿Relaciona dos variables numéricas?', category: 'Uso' },
  cuartiles: { question: '¿Muestra la mediana y los cuartiles?', category: 'Uso' },
  'partes-total': { question: '¿Representa partes de un total?', category: 'Uso' },
  orden: { question: '¿Ordena las categorías de mayor a menor frecuencia?', category: 'Uso' },
  'datos-originales': { question: '¿Conserva los datos originales en el gráfico?', category: 'Uso' },
  circulos: { question: '¿Usa círculos que se solapan?', category: 'Aspecto' },
  ramas: { question: '¿Tiene ramas que parten de cada evento?', category: 'Aspecto' },
  probabilidad: { question: '¿Se usa para organizar eventos y calcular probabilidades?', category: 'Uso' },
  bayes: { question: '¿Ilustra el teorema de Bayes?', category: 'Uso' },
};

const GUESS_WHO_CARDS: CardSeed[] = [
  {
    id: 'hist-simetrico',
    label: 'Histograma simétrico',
    image: 'histograma-simetrico',
    info: 'Si es simétrico y de un solo pico, la media, la mediana y la moda quedan muy cerca unas de otras.',
    traits: ['histograma', 'barras', 'campana'],
  },
  {
    id: 'hist-bimodal',
    label: 'Histograma bimodal',
    image: 'histograma-bimodal',
    info: 'Dos picos suelen indicar dos subgrupos mezclados (por ejemplo, hombres y mujeres) en una sola variable.',
    traits: ['histograma', 'barras', 'varios-picos'],
  },
  {
    id: 'hist-multimodal',
    label: 'Histograma multimodal',
    image: 'histograma-multimodal',
    info: 'Con varios picos conviene preguntarse si los datos vienen de más de un grupo antes de resumirlos con una sola media.',
    traits: ['histograma', 'barras', 'varios-picos'],
  },
  {
    id: 'hist-sesgo-der',
    label: 'Histograma con sesgo a la derecha',
    image: 'histograma-sesgo-derecha',
    info: 'La cola larga a la derecha arrastra la media por encima de la mediana (ingresos, por ejemplo).',
    traits: ['histograma', 'barras', 'sesgo'],
  },
  {
    id: 'hist-sesgo-izq',
    label: 'Histograma con sesgo a la izquierda',
    image: 'histograma-sesgo-izquierda',
    info: 'La cola larga a la izquierda arrastra la media por debajo de la mediana.',
    traits: ['histograma', 'barras', 'sesgo'],
  },
  {
    id: 'caja',
    label: 'Diagrama de caja con atípicos',
    image: 'diagrama-caja-atipicos',
    info: 'Resume mínimo, Q1, mediana, Q3 y máximo, y marca como atípicos los puntos más allá de 1,5 veces el rango intercuartílico.',
    traits: ['cuartiles'],
  },
  {
    id: 'dispersion',
    label: 'Diagrama de dispersión',
    image: 'diagrama-dispersion',
    info: 'Cada punto es un individuo con dos mediciones; permite ver si hay relación entre las variables.',
    traits: ['dos-variables'],
  },
  {
    id: 'circular',
    label: 'Gráfico circular',
    image: 'grafico-circular',
    info: 'Muestra cómo se reparte un total en categorías; funciona mejor con pocas categorías.',
    traits: ['partes-total'],
  },
  {
    id: 'pareto',
    label: 'Diagrama de Pareto',
    image: 'diagrama-pareto',
    info: 'Combina barras ordenadas de mayor a menor con una línea acumulada para priorizar las pocas causas que explican la mayor parte del problema.',
    traits: ['barras', 'orden'],
  },
  {
    id: 'normal',
    label: 'Distribución normal',
    image: 'distribucion-normal',
    info: 'Curva simétrica en forma de campana; cerca del 95 % de los datos queda a menos de 2 desviaciones estándar de la media.',
    traits: ['campana'],
  },
  {
    id: 'tallo-hojas',
    label: 'Diagrama de tallo y hojas',
    image: 'tallo-y-hojas',
    info: 'Ordena los datos y a la vez muestra su forma, sin perder los valores originales.',
    traits: ['datos-originales'],
  },
  {
    id: 'venn',
    label: 'Diagrama de Venn',
    image: 'diagrama-venn',
    info: 'Los círculos solapados representan eventos; la zona común es la intersección (A y B).',
    traits: ['circulos', 'probabilidad'],
  },
  {
    id: 'arbol',
    label: 'Árbol de probabilidad',
    image: 'arbol-probabilidad',
    info: 'Cada rama lleva una probabilidad; multiplicar a lo largo de las ramas da la probabilidad de cada resultado conjunto.',
    traits: ['ramas', 'probabilidad'],
  },
  {
    id: 'bayes',
    label: 'Diagrama del teorema de Bayes',
    image: 'teorema-bayes',
    info: 'Parte de P(A|B)·P(B) = P(A y B) = P(B|A)·P(A); despejando se llega a Bayes: P(A|B) = P(B|A)·P(A) / P(B).',
    traits: ['probabilidad', 'bayes'],
  },
];

function guessWhoCards(images: SylabusImages): unknown[] {
  return GUESS_WHO_CARDS.map((card) => ({
    cardId: card.id,
    imageUrl: images[card.image].url,
    label: card.label,
    audioUrl: null,
    info: card.info,
    traits: card.traits.map((id) => ({ id, ...GUESS_WHO_TRAITS[id] })),
  }));
}

/* ------------------------------------------------------------------ */
/* Dominexo · ocho conceptos con los tres niveles (Hitos 1-3)           */
/* ------------------------------------------------------------------ */

const DOMINEXO_CONCEPTOS = [
  {
    conceptId: 'poblacion',
    label: 'Población',
    icon: 'building2',
    color: '#2563eb',
    definition: 'Conjunto completo de individuos, objetos o mediciones que interesa estudiar. Su valor resumen se llama parámetro.',
    example: 'Todos los estudiantes de una universidad si se quiere conocer cuánto estudian por semana.',
    application:
      'Una cadena de cafés quiere saber la satisfacción de todos sus clientes de Bogotá en 2026. Los clientes de Bogotá en 2026 son la población; la satisfacción promedio de todos ellos sería el parámetro (casi nunca se conoce, por eso se estima con una muestra).',
    questions: [
      {
        text: 'Una universidad quiere conocer las horas de estudio semanales de sus 12.000 estudiantes. ¿Cómo se llama el grupo completo de 12.000?',
        options: ['Población', 'Muestra', 'Estadístico', 'Variable'],
        correctIndex: 0,
        explanation: 'La población es el conjunto completo de interés; la muestra es solo una parte de ella.',
        levels: ['MEDIUM'],
      },
      {
        text: 'El promedio de horas de estudio de TODOS los 12.000 estudiantes es 14,2 h. ¿Cómo se llama ese valor?',
        options: ['Parámetro', 'Estadístico', 'Muestra', 'Sesgo'],
        correctIndex: 0,
        explanation: 'Un valor que describe a toda la población es un parámetro. Si se calculara con una muestra, sería un estadístico.',
        levels: ['ADVANCED'],
      },
    ],
  },
  {
    conceptId: 'muestra',
    label: 'Muestra',
    icon: 'target',
    color: '#0891b2',
    definition: 'Subconjunto de la población que realmente se observa. Con ella se calculan estadísticos para estimar los parámetros.',
    example: '300 estudiantes elegidos al azar entre los 12.000 de una universidad.',
    application:
      'Para medir el tiempo de espera en urgencias de una ciudad se revisan 500 historias elegidas al azar durante un mes. Si solo se revisaran las de la noche, la muestra estaría sesgada y no representaría a la población.',
    questions: [
      {
        text: 'De 12.000 estudiantes se encuesta a 300 elegidos al azar. Esos 300 son:',
        options: ['Una muestra', 'La población', 'Un parámetro', 'Un censo'],
        correctIndex: 0,
        explanation: 'Una parte de la población observada es una muestra; un censo sí observa a todos.',
        levels: ['MEDIUM'],
      },
      {
        text: 'En esos 300 estudiantes el promedio es 13,8 h de estudio. Ese valor es:',
        options: ['Un estadístico', 'Un parámetro', 'La población', 'Una variable cualitativa'],
        correctIndex: 0,
        explanation: 'Se calculó con datos de la muestra, así que es un estadístico (estima el parámetro, que es desconocido).',
        levels: ['ADVANCED'],
      },
    ],
  },
  {
    conceptId: 'variable-cuantitativa',
    label: 'Variable cuantitativa',
    icon: 'ruler',
    color: '#16a34a',
    definition: 'Variable que se mide con números sobre los que tiene sentido operar. Puede ser discreta (se cuenta) o continua (se mide en un intervalo).',
    example: 'La estatura en centímetros (continua) o el número de hermanos (discreta).',
    application:
      'En una encuesta sobre un servicio de transporte, el tiempo de viaje en minutos es cuantitativa continua, el número de transbordos es cuantitativa discreta y la calificación «mala/regular/buena» es cualitativa ordinal. Saber cuál es cada una define qué gráfico y qué medidas usar.',
    questions: [
      {
        text: '¿Cuál de estas variables es cuantitativa continua?',
        options: ['Estatura en centímetros', 'Número de hermanos', 'Estrato socioeconómico', 'Carrera que estudia'],
        correctIndex: 0,
        explanation: 'La estatura puede tomar cualquier valor de un intervalo. El número de hermanos se cuenta (discreta) y las otras dos son cualitativas.',
        levels: ['MEDIUM'],
      },
      {
        text: 'El estrato socioeconómico (1 a 6) de cada hogar es una variable:',
        options: ['Cualitativa ordinal', 'Cuantitativa continua', 'Cualitativa nominal', 'Cuantitativa discreta'],
        correctIndex: 0,
        explanation: 'Aunque se escriba con números, son categorías con un orden natural; no tiene sentido sumarlas ni promediarlas como cantidades.',
        levels: ['ADVANCED'],
      },
    ],
  },
  {
    conceptId: 'mediana',
    label: 'Mediana',
    icon: 'compass',
    color: '#d97706',
    definition: 'Valor central de los datos ordenados: deja la mitad por debajo y la mitad por encima. No se afecta por valores extremos.',
    example: 'En 2, 3, 5, 8, 9 la mediana es 5.',
    application:
      'Los salarios de una empresa son 2, 2, 3, 3 y 40 millones. La media (10 millones) no describe a nadie; la mediana (3 millones) sí representa el salario típico. Con datos sesgados se prefiere informar la mediana.',
    questions: [
      {
        text: 'Las notas de cinco estudiantes son 2,0; 3,5; 3,8; 4,0 y 4,5. ¿Cuál es la mediana?',
        options: ['3,8', '3,5', '4,0', '3,56'],
        correctIndex: 0,
        explanation: 'Con 5 datos ordenados, la mediana es el tercero: 3,8. (3,56 es la media, no la mediana).',
        levels: ['MEDIUM'],
      },
      {
        text: 'Salarios (millones): 2, 2, 3, 3 y 40. ¿Qué medida resume mejor el salario típico?',
        options: ['La mediana (3 millones)', 'La media (10 millones)', 'El rango (38 millones)', 'El valor máximo (40 millones)'],
        correctIndex: 0,
        explanation: 'El dato extremo de 40 arrastra la media a 10 millones, que no representa a casi nadie. La mediana no se ve afectada.',
        levels: ['ADVANCED'],
      },
    ],
  },
  {
    conceptId: 'desviacion-estandar',
    label: 'Desviación estándar',
    icon: 'waves',
    color: '#7c3aed',
    definition: 'Mide qué tanto se alejan, en promedio, los datos de su media. Se expresa en las mismas unidades que los datos.',
    example: 'Dos cursos con promedio 3,5: uno con notas entre 3,4 y 3,6 (poca dispersión) y otro entre 1,0 y 5,0 (mucha).',
    application:
      'Dos proveedores entregan en promedio en 5 días. El A tiene desviación estándar de 0,5 días y el B de 3 días. Aunque el promedio es igual, el A es mucho más predecible para planear inventarios.',
    questions: [
      {
        text: 'Dos cursos tienen promedio 3,5. En el A las notas van de 3,4 a 3,6; en el B, de 1,0 a 5,0. ¿Cuál tiene mayor desviación estándar?',
        options: ['El curso B', 'El curso A', 'Es igual en ambos', 'No se puede saber'],
        correctIndex: 0,
        explanation: 'El B tiene los datos más alejados de la media, por lo tanto mayor dispersión, aunque el promedio sea el mismo.',
        levels: ['MEDIUM'],
      },
      {
        text: 'Para los datos 2, 4 y 6 (muestra), ¿cuál es la desviación estándar muestral?',
        options: ['2', '1,63', '4', '2,83'],
        correctIndex: 0,
        explanation: 'Media = 4; desviaciones −2, 0, 2; suma de cuadrados = 8; varianza muestral = 8/(3−1) = 4; desviación = 2. (1,63 sería la poblacional, dividiendo entre 3).',
        levels: ['ADVANCED'],
      },
    ],
  },
  {
    conceptId: 'valor-atipico',
    label: 'Valor atípico',
    icon: 'star',
    color: '#dc2626',
    definition: 'Dato muy alejado del resto. En un diagrama de caja se marca si queda fuera de [Q1 − 1,5·RIC, Q3 + 1,5·RIC], con RIC = Q3 − Q1.',
    example: 'Un salario de 40 millones entre salarios de 2 a 3 millones.',
    application:
      'En una base de ventas aparece una compra de 9.000 unidades cuando lo habitual es entre 5 y 40. Antes de borrarla hay que revisar si es un error de digitación o una venta real excepcional: un atípico se investiga, no se elimina por reflejo.',
    questions: [
      {
        text: 'En un diagrama de caja, ¿qué suele marcarse como valor atípico?',
        options: [
          'Puntos más allá de 1,5·RIC de los cuartiles',
          'Cualquier dato mayor que la media',
          'El valor que más se repite',
          'El dato que queda en el centro',
        ],
        correctIndex: 0,
        explanation: 'La regla habitual considera atípicos los datos por debajo de Q1 − 1,5·RIC o por encima de Q3 + 1,5·RIC.',
        levels: ['MEDIUM'],
      },
      {
        text: 'Si Q1 = 10 y Q3 = 20, ¿cuál es el límite superior a partir del cual un dato es atípico?',
        options: ['35', '30', '25', '45'],
        correctIndex: 0,
        explanation: 'RIC = 20 − 10 = 10; límite superior = Q3 + 1,5·RIC = 20 + 15 = 35.',
        levels: ['ADVANCED'],
      },
    ],
  },
  {
    conceptId: 'probabilidad-condicional',
    label: 'Probabilidad condicional',
    icon: 'lightbulb',
    color: '#0d9488',
    definition: 'Probabilidad de que ocurra A sabiendo que ya ocurrió B: P(A|B) = P(A y B) / P(B), con P(B) > 0.',
    example: 'Probabilidad de que una carta sea rey sabiendo que es figura: 4/12 = 1/3.',
    application:
      'En un curso, 60 % aprobó el quiz y 45 % aprobó quiz y parcial. La probabilidad de aprobar el parcial dado que se aprobó el quiz es 0,45/0,60 = 0,75: la información previa cambia la probabilidad.',
    questions: [
      {
        text: 'La expresión P(A|B) se lee:',
        options: [
          'Probabilidad de A dado que ocurrió B',
          'Probabilidad de B dado que ocurrió A',
          'Probabilidad de A y B a la vez',
          'Probabilidad de A o B',
        ],
        correctIndex: 0,
        explanation: 'La barra vertical significa «dado que»: se restringe el espacio muestral al evento B.',
        levels: ['MEDIUM'],
      },
      {
        text: 'El 60 % de un curso aprobó el quiz y el 45 % aprobó quiz y parcial. ¿Cuál es P(aprobó el parcial | aprobó el quiz)?',
        options: ['0,75', '0,45', '0,27', '0,60'],
        correctIndex: 0,
        explanation: 'P(parcial | quiz) = P(quiz y parcial) / P(quiz) = 0,45 / 0,60 = 0,75.',
        levels: ['ADVANCED'],
      },
    ],
  },
  {
    conceptId: 'teorema-bayes',
    label: 'Teorema de Bayes',
    icon: 'brain',
    color: '#be185d',
    definition: 'Actualiza la probabilidad de una causa al conocer un resultado: P(A|B) = P(B|A)·P(A) / P(B), donde P(B) sale de la probabilidad total.',
    example: 'Pasar de «1 % de la población tiene la enfermedad» a «dado que la prueba salió positiva, la probabilidad es otra».',
    application:
      'Una prueba detecta al 90 % de los enfermos y da falso positivo en el 10 % de los sanos; la enfermedad afecta al 1 %. Con Bayes, P(enfermo | positivo) = 0,009 / 0,108 ≈ 8,3 %: aunque la prueba parece buena, la mayoría de los positivos son falsos positivos porque la enfermedad es rara.',
    questions: [
      {
        text: 'El teorema de Bayes sirve principalmente para:',
        options: [
          'Actualizar la probabilidad de una causa al conocer un resultado',
          'Calcular la media de una muestra',
          'Elegir una muestra aleatoria',
          'Ordenar categorías por frecuencia',
        ],
        correctIndex: 0,
        explanation: 'Invierte el condicionamiento: parte de P(resultado | causa) y llega a P(causa | resultado).',
        levels: ['MEDIUM'],
      },
      {
        text: 'Una enfermedad afecta al 1 %. La prueba detecta al 90 % de los enfermos y da positivo en el 10 % de los sanos. Si alguien da positivo, ¿cuál es aproximadamente la probabilidad de que esté enfermo?',
        options: ['8,3 %', '90 %', '9 %', '50 %'],
        correctIndex: 0,
        explanation: 'P(positivo) = 0,9·0,01 + 0,1·0,99 = 0,108. P(enfermo | positivo) = 0,009 / 0,108 ≈ 0,083.',
        levels: ['ADVANCED'],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Laberinto recolector · vocabulario estadístico (Hitos 1-3)           */
/* ------------------------------------------------------------------ */

const MAZE_ITEMS = [
  { itemId: 'poblacion', label: 'Población', icon: 'building2', color: '#2563eb', fact: 'Es el conjunto completo que se quiere estudiar. Su valor resumen se llama parámetro.' },
  { itemId: 'muestra', label: 'Muestra', icon: 'target', color: '#0891b2', fact: 'Es una parte de la población. Con ella se calculan estadísticos para estimar parámetros.' },
  { itemId: 'variable', label: 'Variable', icon: 'ruler', color: '#16a34a', fact: 'Característica que se mide en cada individuo: puede ser cualitativa o cuantitativa.' },
  { itemId: 'frecuencia', label: 'Frecuencia relativa', icon: 'calculator', color: '#84cc16', fact: 'Frecuencia absoluta dividida entre el total de datos. Si 18 de 60 prefieren el bus: 18/60 = 0,30.' },
  { itemId: 'media', label: 'Media', icon: 'database', color: '#eab308', fact: 'Suma de los datos dividida entre cuántos son. Es sensible a los valores extremos.' },
  { itemId: 'mediana', label: 'Mediana', icon: 'compass', color: '#d97706', fact: 'Dato central de los valores ordenados; resiste a los valores atípicos.' },
  { itemId: 'moda', label: 'Moda', icon: 'trophy', color: '#f97316', fact: 'El valor que más se repite. Puede haber una, varias o ninguna.' },
  { itemId: 'desviacion', label: 'Desviación estándar', icon: 'waves', color: '#7c3aed', fact: 'Qué tanto se alejan los datos de su media, en las mismas unidades de los datos.' },
  { itemId: 'atipico', label: 'Valor atípico', icon: 'star', color: '#dc2626', fact: 'Dato muy alejado del resto: se investiga antes de decidir si se conserva o se corrige.' },
  { itemId: 'probabilidad', label: 'Probabilidad', icon: 'lightbulb', color: '#0d9488', fact: 'Número entre 0 y 1 que mide qué tan posible es un evento. Una moneda justa da 0,5 de cara.' },
  { itemId: 'condicional', label: 'Probabilidad condicional', icon: 'lock', color: '#0284c7', fact: 'P(A|B) = P(A y B) / P(B): la probabilidad de A cuando ya se sabe que ocurrió B.' },
  { itemId: 'bayes', label: 'Teorema de Bayes', icon: 'brain', color: '#be185d', fact: 'Actualiza una probabilidad con nueva evidencia: pasa de P(B|A) a P(A|B).' },
];

/* ------------------------------------------------------------------ */
/* Escaleras y serpientes · repaso integral por estaciones              */
/* ------------------------------------------------------------------ */

const SNAKES_CONFIG = {
  boardSize: 30,
  turnDurationSeconds: 60,
  // Escaleras = retos de aplicación (alta dificultad); serpientes = retos de recuperación.
  ladders: [
    { from: 3, to: 12 },
    { from: 8, to: 19 },
    { from: 17, to: 26 },
  ],
  snakes: [
    { from: 15, to: 6 },
    { from: 22, to: 10 },
    { from: 28, to: 13 },
  ],
};

const SNAKES_CONTENT = [
  {
    cellNumber: 3,
    triggerType: 'LADDER',
    difficulty: 'HIGH',
    prompt: 'Se lanza un dado justo. ¿Cuál es la probabilidad de obtener un número par o mayor que 4?',
    options: ['2/3', '1/2', '5/6', '1/3'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 8,
    triggerType: 'LADDER',
    difficulty: 'HIGH',
    prompt: 'A y B son eventos independientes con P(A) = 0,5 y P(B) = 0,4. ¿Cuánto vale P(A y B)?',
    options: ['0,20', '0,90', '0,45', '0,10'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 17,
    triggerType: 'LADDER',
    difficulty: 'HIGH',
    prompt:
      'La máquina A produce el 60 % de las piezas y 2 % salen defectuosas; la B produce el 40 % y 5 % salen defectuosas. Si una pieza es defectuosa, ¿cuál es la probabilidad de que venga de A?',
    options: ['37,5 %', '60 %', '2 %', '62,5 %'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 15,
    triggerType: 'SNAKE',
    difficulty: 'MEDIUM',
    prompt: 'El estrato socioeconómico (1 a 6) de un hogar es una variable:',
    options: ['Cualitativa ordinal', 'Cuantitativa continua', 'Cualitativa nominal', 'Cuantitativa discreta'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 22,
    triggerType: 'SNAKE',
    difficulty: 'MEDIUM',
    prompt: 'Un estadístico es un valor que se calcula con los datos de:',
    options: ['Una muestra', 'Toda la población', 'Una variable cualitativa', 'Un parámetro'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 28,
    triggerType: 'SNAKE',
    difficulty: 'MEDIUM',
    prompt: 'En una distribución con sesgo a la derecha, ¿qué relación suele cumplirse entre la media y la mediana?',
    options: ['La media es mayor que la mediana', 'La media es menor que la mediana', 'Son siempre iguales', 'La media no se puede calcular'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 5,
    triggerType: 'CELL',
    difficulty: 'LOW',
    prompt: 'En una tabla de frecuencias, 18 de 60 estudiantes prefieren el bus. ¿Cuál es la frecuencia relativa del bus?',
    options: ['0,30', '0,18', '3,33', '0,60'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 6,
    triggerType: 'CELL',
    difficulty: 'LOW',
    prompt: '¿Cuál es la moda de los datos 3, 4, 4, 5, 7, 4, 6?',
    options: ['4', '5', '3', '4,71'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 10,
    triggerType: 'CELL',
    difficulty: 'LOW',
    prompt: '¿Cuál es la media de los datos 4, 6, 8 y 10?',
    options: ['7', '8', '6', '28'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 11,
    triggerType: 'CELL',
    difficulty: 'MEDIUM',
    prompt: 'Quieres una muestra en la que cada carrera de la universidad quede representada según su tamaño. ¿Qué muestreo conviene?',
    options: ['Estratificado', 'Por conveniencia', 'Voluntario', 'Un censo parcial'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 20,
    triggerType: 'CELL',
    difficulty: 'MEDIUM',
    prompt: '¿Cuál es el rango de los datos 12, 7, 19, 3 y 15?',
    options: ['16', '19', '12', '9'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 24,
    triggerType: 'CELL',
    difficulty: 'MEDIUM',
    prompt: 'Se saca una carta de una baraja de 52. ¿Cuál es la probabilidad de que sea de corazones?',
    options: ['1/4', '1/13', '1/2', '1/52'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 25,
    triggerType: 'CELL',
    difficulty: 'HIGH',
    prompt: 'A y B son mutuamente excluyentes con P(A) = 0,3 y P(B) = 0,5. ¿Cuánto vale P(A o B)?',
    options: ['0,8', '0,15', '0,2', '0,65'],
    correctOptionIndex: 0,
  },
  {
    cellNumber: 27,
    triggerType: 'CELL',
    difficulty: 'LOW',
    prompt: 'Un censo estudia a:',
    options: ['Toda la población', 'Una muestra al azar', 'Solo a voluntarios', 'Un solo estrato'],
    correctOptionIndex: 0,
  },
];

/* ------------------------------------------------------------------ */
/* Dúo Lógico · cálculo de Bayes en pareja                              */
/* ------------------------------------------------------------------ */

// 0 = libre, 1 = muro, 2 = solo FUEGO, 3 = solo AGUA. Misma geometría del demo de Dúo Lógico.
const DUAL_GRID = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  [1, 3, 3, 3, 3, 3, 3, 0, 3, 3, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const DUAL_CONFIG = {
  coreQuestion:
    'Ordena los pasos para calcular, con el teorema de Bayes, la probabilidad de que una persona esté enferma dado que su prueba salió positiva (prevalencia 1 %, sensibilidad 90 %, falsos positivos 10 %).',
  gridCols: 12,
  gridRows: 6,
  grid: DUAL_GRID,
  fireStart: { row: 1, col: 1 },
  waterStart: { row: 4, col: 1 },
  corePosition: { row: 2, col: 6 },
  gates: [
    { gateId: 'tabla-gate', position: { row: 1, col: 4 } },
    { gateId: 'condicional-gate', position: { row: 4, col: 7 } },
  ],
  triggers: [
    {
      triggerId: 'agua-abre-tabla',
      kind: 'SWITCH',
      activatedByRole: 'WATER',
      switchPosition: { row: 4, col: 3 },
      gateId: 'tabla-gate',
    },
    {
      triggerId: 'fuego-responde-condicional',
      kind: 'QUESTION',
      activatedByRole: 'FIRE',
      switchPosition: { row: 1, col: 3 },
      gateId: 'condicional-gate',
      prompt: 'Si P(A) = 0,6 y P(A y B) = 0,3, ¿cuánto vale P(B | A)?',
      options: ['0,5', '0,3', '0,18', '0,9'],
      correctOptionIndex: 0,
    },
  ],
};

const DUAL_CONTENT = [
  { gemId: 'fuego-eventos', role: 'FIRE', position: { row: 1, col: 2 }, label: 'Define los eventos: E = enfermo, + = prueba positiva', order: 1 },
  { gemId: 'fuego-datos', role: 'FIRE', position: { row: 1, col: 5 }, label: 'Identifica los datos: P(E) = 0,01; P(+|E) = 0,9; P(+|no E) = 0,1', order: 2 },
  { gemId: 'agua-numerador', role: 'WATER', position: { row: 4, col: 2 }, label: 'Calcula el numerador: P(+|E)·P(E) = 0,9·0,01 = 0,009', order: 3 },
  { gemId: 'agua-total', role: 'WATER', position: { row: 4, col: 5 }, label: 'Calcula P(+) con la probabilidad total: 0,009 + 0,1·0,99 = 0,108', order: 4 },
  { gemId: 'agua-division', role: 'WATER', position: { row: 4, col: 9 }, label: 'Divide: P(E|+) = 0,009 / 0,108 ≈ 0,083', order: 5 },
  { gemId: 'fuego-interpreta', role: 'FIRE', position: { row: 1, col: 9 }, label: 'Interpreta: solo ≈ 8,3 % de los positivos están realmente enfermos', order: 6 },
];

/* ------------------------------------------------------------------ */
/* Dúo Lógico Pixi · exploración experimental (Hito 1)                  */
/* ------------------------------------------------------------------ */

const PIXI_CONFIG_BASE = {
  widthPx: 1700,
  heightPx: 1000,
  fireStart: { x: 80, y: 800 },
  waterStart: { x: 170, y: 800 },
  dog: { x: 230, y: 800 },
  platforms: [
    { x: 0, y: 860, width: 300, height: 140, material: 'concrete' },
    { x: 460, y: 860, width: 260, height: 140, material: 'concrete' },
    { x: 560, y: 760, width: 110, height: 40, material: 'metal' },
    { x: 650, y: 660, width: 110, height: 40, material: 'metal' },
    { x: 460, y: 560, width: 400, height: 40, material: 'concrete' },
    { x: 1020, y: 560, width: 260, height: 40, material: 'concrete' },
    { x: 700, y: 420, width: 140, height: 30, material: 'metal' },
    { x: 760, y: 460, width: 90, height: 30, material: 'dirt' },
    { x: 840, y: 360, width: 90, height: 30, material: 'dirt' },
    { x: 1080, y: 420, width: 90, height: 30, material: 'metal' },
    { x: 1160, y: 320, width: 90, height: 30, material: 'metal' },
    { x: 900, y: 260, width: 700, height: 40, material: 'concrete' },
  ],
  liquids: [{ x: 860, y: 560, width: 160, height: 120, kind: 'LAVA' }],
  crates: [{ x: 560, y: 500, size: 48 }],
  buttons: [
    { id: 'dogButton', x: 220, y: 860, momentary: true },
    { id: 'leverFinal', x: 560, y: 860, momentary: false },
  ],
  bridges: [{ id: 'bridge1', x: 380, y: 860, width: 160, height: 30, requires: ['dogButton'], logic: 'AND' }],
  doors: [{ id: 'doorFinal', x: 700, y: 790, width: 30, height: 140, requires: ['leverFinal'], logic: 'AND' }],
  portal: { x: 1500, y: 220, width: 100, height: 120 },
};

const PIXI_CONTENT = [
  {
    id: 'piece-1',
    x: 150,
    y: 800,
    role: null,
    color: '#FFD166',
    glow: '#FACC15',
    concept: {
      title: 'Población y muestra',
      body: 'La población es todo lo que se quiere estudiar; la muestra es la parte que sí se observa. Una buena muestra se elige al azar para que se parezca a la población.',
    },
  },
  {
    id: 'piece-2',
    x: 770,
    y: 390,
    role: null,
    color: '#38BDF8',
    glow: '#38BDF8',
    concept: {
      title: 'Parámetro y estadístico',
      body: 'El parámetro describe a toda la población y casi nunca se conoce; el estadístico se calcula con la muestra y sirve para estimarlo. Como cargar la caja, se necesitan los dos para llegar al resultado.',
    },
  },
  {
    id: 'piece-3',
    x: 940,
    y: 620,
    role: 'FIRE',
    color: '#FDBA74',
    glow: '#F97316',
    concept: {
      title: 'Muestreo probabilístico',
      body: 'Cuando todos los individuos tienen una probabilidad conocida de ser elegidos se puede medir el error de muestreo. Es el camino seguro que cruza la lava.',
    },
  },
  {
    id: 'piece-4',
    x: 885,
    y: 330,
    role: 'WATER',
    color: '#7DD3FC',
    glow: '#38BDF8',
    concept: {
      title: 'Sesgo de selección',
      body: 'Si solo se observa a quienes son fáciles de alcanzar, la muestra deja de representar a la población y las conclusiones se desvían. Siempre hay que buscar una ruta alternativa.',
    },
  },
];

/* ------------------------------------------------------------------ */
/* Laberinto Verdadero o Falso · errores frecuentes (Hitos 1-3)         */
/* ------------------------------------------------------------------ */

const TRUE_FALSE_CONTENT = [
  {
    questionId: 'muestra-parametro',
    statement: 'El promedio calculado con una muestra es un parámetro.',
    answer: false,
    explanation: 'Calculado con una muestra es un estadístico. Parámetro es el valor de toda la población.',
  },
  {
    questionId: 'muestra-aleatoria',
    statement: 'Una muestra elegida al azar tiene más posibilidades de representar a la población.',
    answer: true,
    explanation: 'El azar reduce el sesgo de selección: todos tienen una probabilidad conocida de ser elegidos.',
  },
  {
    questionId: 'estrato-cuantitativa',
    statement: 'El estrato socioeconómico (1 a 6) es una variable cuantitativa continua.',
    answer: false,
    explanation: 'Son categorías ordenadas: es cualitativa ordinal. No tiene sentido promediar estratos como cantidades.',
  },
  {
    questionId: 'discreta-conteo',
    statement: 'El número de hijos por familia es una variable cuantitativa discreta.',
    answer: true,
    explanation: 'Se cuenta con enteros (0, 1, 2…); no puede haber 2,5 hijos.',
  },
  {
    questionId: 'media-atipicos',
    statement: 'La media se ve afectada por los valores atípicos más que la mediana.',
    answer: true,
    explanation: 'Un dato extremo arrastra la media; la mediana solo depende del orden de los datos.',
  },
  {
    questionId: 'moda-unica',
    statement: 'Un conjunto de datos siempre tiene exactamente una moda.',
    answer: false,
    explanation: 'Puede tener una, varias (bimodal, multimodal) o ninguna si ningún valor se repite.',
  },
  {
    questionId: 'frecuencia-relativa',
    statement: 'La suma de las frecuencias relativas de todas las categorías es 1 (o 100 %).',
    answer: true,
    explanation: 'Las frecuencias relativas reparten el total de datos; por eso suman 1.',
  },
  {
    questionId: 'desviacion-negativa',
    statement: 'La desviación estándar puede ser negativa.',
    answer: false,
    explanation: 'Es la raíz cuadrada de la varianza, así que siempre es mayor o igual que cero.',
  },
  {
    questionId: 'atipico-eliminar',
    statement: 'Un valor atípico siempre es un error y debe eliminarse.',
    answer: false,
    explanation: 'Puede ser un error de digitación o un caso real e importante. Primero se investiga, después se decide.',
  },
  {
    questionId: 'caja-mediana',
    statement: 'La línea dentro de la caja de un diagrama de caja marca la mediana.',
    answer: true,
    explanation: 'La caja va de Q1 a Q3 y la línea interior es Q2, es decir, la mediana.',
  },
  {
    questionId: 'probabilidad-rango',
    statement: 'Una probabilidad puede valer 1,3.',
    answer: false,
    explanation: 'Toda probabilidad está entre 0 y 1 (0 % y 100 %).',
  },
  {
    questionId: 'independientes-producto',
    statement: 'Si A y B son independientes, P(A y B) = P(A) · P(B).',
    answer: true,
    explanation: 'Esa es la definición de independencia: saber que ocurre uno no cambia la probabilidad del otro.',
  },
  {
    questionId: 'condicional-simetrica',
    statement: 'P(A|B) siempre es igual a P(B|A).',
    answer: false,
    explanation: 'En general son distintas: P(positivo | enfermo) no es lo mismo que P(enfermo | positivo). Bayes conecta ambas.',
  },
  {
    questionId: 'excluyentes-suma',
    statement: 'Si A y B son mutuamente excluyentes, P(A o B) = P(A) + P(B).',
    answer: true,
    explanation: 'Sin intersección no hay nada que restar; con eventos no excluyentes se resta P(A y B).',
  },
  {
    questionId: 'bayes-prueba',
    statement: 'Si una prueba detecta al 90 % de los enfermos, el 90 % de quienes dan positivo están enfermos.',
    answer: false,
    explanation: 'Depende de la prevalencia: con una enfermedad rara, la mayoría de los positivos pueden ser falsos positivos (Bayes).',
  },
  {
    questionId: 'bayes-evidencia',
    statement: 'El teorema de Bayes permite actualizar una probabilidad cuando aparece nueva evidencia.',
    answer: true,
    explanation: 'Convierte la probabilidad a priori en una a posteriori usando P(evidencia | causa) y la probabilidad total.',
  },
];

/* ------------------------------------------------------------------ */
/* Catálogo                                                             */
/* ------------------------------------------------------------------ */

export function buildSylabusGames(images: SylabusImages): SylabusGame[] {
  return [
    {
      id: 'seed-sylabus-matchmente-conceptos',
      slug: 'sylabus-matchmente-conceptos',
      title: 'Sylabus · MatchMente: conceptos que se oponen',
      description:
        'Voltea las cartas y une cada concepto con su contraparte: población y muestra, parámetro y estadístico, variable discreta y continua, eventos independientes y dependientes. Un precalentamiento para el Hito 1 del curso «El poder de las probabilidades».' +
        SOURCE_NOTE,
      gameType: 'MEMORY_MATCH',
      primaryColor: '#2563eb',
      coverImageUrl: images['histograma-simetrico'].url,
      config: { mode: 'OPPOSITES', perZone: 4, timePerZoneSeconds: 90, previewSeconds: 5 },
      content: MATCHMENTE_CONCEPTOS,
    },
    {
      id: 'seed-sylabus-matchmente-graficos',
      slug: 'sylabus-matchmente-graficos',
      title: 'Sylabus · MatchMente: reconoce el gráfico',
      description:
        'Empareja cada gráfico estadístico con su nombre o su interpretación: histogramas simétricos, bimodales y sesgados, diagrama de caja, dispersión, circular, Pareto y más. Refuerza el Hito 2 (descripción de datos).' +
        SOURCE_NOTE,
      gameType: 'MEMORY_MATCH',
      primaryColor: '#0891b2',
      coverImageUrl: images['diagrama-caja-atipicos'].url,
      config: { mode: 'PAIRS', perZone: 5, timePerZoneSeconds: 120, previewSeconds: 6 },
      content: matchmenteGraficos(images),
    },
    {
      id: 'seed-sylabus-identidad-oculta-graficos',
      slug: 'sylabus-identidad-oculta-graficos',
      title: 'Sylabus · Identidad Oculta: ¿qué gráfico es?',
      description:
        'Descubre el gráfico estadístico secreto de tu rival con preguntas sobre sus propiedades: ¿tiene sesgo?, ¿muestra cuartiles?, ¿relaciona dos variables?, ¿sirve para calcular probabilidades? Clasifica y argumenta, Hitos 1 a 3.' +
        SOURCE_NOTE,
      gameType: 'GUESS_WHO',
      primaryColor: '#7c3aed',
      coverImageUrl: images['diagrama-dispersion'].url,
      config: { maxAccusationCount: 6, turnDurationSeconds: 45 },
      content: guessWhoCards(images),
    },
    {
      id: 'seed-sylabus-dominexo-estadistica',
      slug: 'sylabus-dominexo-estadistica',
      title: 'Sylabus · Dominexo: conceptos de estadística y probabilidad',
      description:
        'Encadena ocho conceptos del curso, de población a Bayes. En Fácil lees definiciones y ejemplos; en Intermedio respondes preguntas conceptuales; en Universitario resuelves cálculos y analizas casos. Hitos 1, 2 y 3.' +
        SOURCE_NOTE,
      gameType: 'DOMINO',
      primaryColor: '#16a34a',
      coverImageUrl: images['distribucion-normal'].url,
      config: { handSize: 7 },
      content: DOMINEXO_CONCEPTOS,
    },
    {
      id: 'seed-sylabus-laberinto-recolector',
      slug: 'sylabus-laberinto-recolector-vocabulario',
      title: 'Sylabus · Laberinto: recolecta el vocabulario estadístico',
      description:
        'Guía al analista de datos por el laberinto, recolecta los doce conceptos del curso y esquiva el sesgo de muestreo. Cada concepto trae un dato para repasar. Calentamiento rápido para los Hitos 1 a 3.' +
        SOURCE_NOTE,
      gameType: 'MAZE_COLLECTOR',
      primaryColor: '#d97706',
      coverImageUrl: null,
      config: {
        layout: 'CITY',
        lives: 3,
        enemySpeed: 2,
        collectorLabel: 'Analista de datos',
        collectorIcon: 'calculator',
        enemyLabel: 'Sesgo de muestreo',
        enemyIcon: 'cloud',
      },
      content: MAZE_ITEMS,
    },
    {
      id: 'seed-sylabus-escaleras-serpientes',
      slug: 'sylabus-escaleras-serpientes-repaso',
      title: 'Sylabus · Escaleras y serpientes: repaso integral',
      description:
        'Avanza por el tablero respondiendo retos de estadística y probabilidad. Las escaleras exigen aplicar probabilidad y Bayes; las serpientes, recuperar fundamentos. Repaso de los tres hitos por estaciones.' +
        SOURCE_NOTE,
      gameType: 'SNAKES_LADDERS',
      primaryColor: '#e11d48',
      coverImageUrl: images['arbol-probabilidad'].url,
      config: SNAKES_CONFIG,
      content: SNAKES_CONTENT,
    },
    {
      id: 'seed-sylabus-duo-logico-bayes',
      slug: 'sylabus-duo-logico-bayes',
      title: 'Sylabus · Dúo Lógico: Bayes en pareja',
      description:
        'Cooperativo de 2 jugadores: Fuego y Agua abren compuertas el uno al otro y ensamblan juntos, en orden, los pasos para resolver un problema con el teorema de Bayes. Hito 3 (incertidumbre) con argumentación en pareja.' +
        SOURCE_NOTE,
      gameType: 'DUAL_QUEST',
      primaryColor: '#f97316',
      coverImageUrl: images['teorema-bayes'].url,
      config: DUAL_CONFIG,
      content: DUAL_CONTENT,
    },
    {
      id: 'seed-sylabus-duo-logico-pixi-muestreo',
      slug: 'sylabus-duo-logico-pixi-muestreo',
      title: 'Sylabus · Dúo Lógico Pixi: del muestreo al sesgo (experimental)',
      description:
        'Versión experimental con física: dos jugadores cruzan lava y agua, mueven una caja y juntan cuatro fichas sobre población, muestra, muestreo y sesgo. Es una demostración de exploración, no una evaluación.' +
        SOURCE_NOTE,
      gameType: 'DUAL_QUEST_PIXI',
      primaryColor: '#1f8a5f',
      coverImageUrl: images['histograma-sesgo-derecha'].url,
      config: {
        ...PIXI_CONFIG_BASE,
        finalReveal: {
          title: 'Muestra representativa frente a muestra sesgada',
          positiveUrl: images['distribucion-normal'].url,
          negativeUrl: images['histograma-sesgo-derecha'].url,
          summary:
            'A la izquierda, datos de una muestra elegida al azar: se parecen a la población y se distribuyen de forma equilibrada. A la derecha, datos de una muestra sesgada: la cola larga distorsiona la media y lleva a conclusiones equivocadas.',
        },
      },
      content: PIXI_CONTENT,
    },
    {
      id: 'seed-sylabus-verdadero-falso',
      slug: 'sylabus-laberinto-verdadero-o-falso',
      title: 'Sylabus · Laberinto Verdadero o Falso: errores frecuentes',
      description:
        'Corre hacia la sala VERDADERO o FALSO, esquiva a las medusas y descubre en cada explicación por qué una afirmación sobre muestreo, gráficos, atípicos o probabilidad es cierta o es un error común. Hitos 1, 2 y 3.' +
        SOURCE_NOTE,
      gameType: 'TRUE_FALSE_MAZE',
      primaryColor: '#8b5cf6',
      coverImageUrl: null,
      config: {
        skin: 'NAVE_ESPACIAL',
        lives: 3,
        enemyCount: 2,
        enemySpeed: 2,
        relocateSeconds: 25,
        shuffleQuestions: true,
        lightsOut: false,
      },
      content: TRUE_FALSE_CONTENT,
    },
  ];
}
