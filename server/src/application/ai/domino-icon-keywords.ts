import { DOMINO_ICON_CATALOG } from './domino-icon-catalog.js';

/**
 * Pistas por nombre de concepto -> ícono del catálogo. Texto sin tildes y en minúsculas; cada raíz
 * coincide como PREFIJO de palabra ("evapor" cubre evaporación/evaporar); con "$" al final debe ser
 * la palabra completa (para raíces cortas como "sol$" que, si no, casarían con "solución").
 * El orden importa: lo más específico va primero.
 */
const RAW_KEYWORDS: ReadonlyArray<readonly [string, string]> = [
  // Ciclo del agua y clima
  ['cloudRain', 'precipit|lluvi|llovizn|tormenta|granizo|nevada|aguacero|monzon'],
  ['cloud', 'condens|nube|nubos|atmosfer|niebla|vapor$|nimbo|cumulo'],
  ['sun', 'sol$|solar|luz$|luminos|evapor|radiacion|amanecer|fotovolt'],
  ['droplets', 'infiltr|agua$|aguas|acuifer|humedad|gota|hidric|hidrolog|riego|escorrent|escurr|manantial|ciclo del agua|rocio'],
  ['waves', 'ocean|mar$|mares|marea|ola$|olas$|tsunami|costa$|costas|marin|lago|laguna|oleaje|rio$|rios$|cuenca|caudal|afluente'],
  ['thermometer', 'temperat|calor$|calentamiento|fiebre|termic|termo|clima|congel|hielo|solidific|fusion|glaciac|helada'],
  ['wind', 'viento|eolic|huracan|tornado|brisa|aire$|ciclon|presion atmos'],
  // Naturaleza y ecología
  ['leaf', 'hoja|planta|vegetal|fotosint|clorofil|botanic|follaje|hierba|estoma'],
  ['sprout', 'germin|semilla|brote|siembra|plantul|crecimiento de|reforest'],
  ['tree', 'arbol|bosque|selva|deforest|madera|forestal|tronco|amazon'],
  ['flower', 'flor$|flores|polen|polin|petalo|jardin'],
  ['recycle', 'recicl|reutiliz|sostenib|compost|economia circular|reduccion de residuos'],
  ['trash', 'basura|desecho|vertedero|residuo|contaminacion del suelo'],
  ['mountain', 'montan|cordiller|volcan|cumbre|sierra|relieve|meseta|altiplano|andes|erosion|sedimenta|roca|glaci|nevado|placa tectonica|sismo|terremoto'],
  ['pawPrint', 'animal|fauna|mamifer|vertebr|invertebr|depredador|cadena trofic|cadena alimen|ecosistem|biodivers|habitat|reptil|anfibio'],
  ['fish', 'pez$|peces|pesca|acuat|ictio|branquia'],
  ['bird', 'ave$|aves|pajaro|ornit|migracion|pluma'],
  ['cat', 'gato|felin|mascota'],
  ['dog', 'perro|canino'],
  ['bone', 'hueso|esquelet|osea|osteo|fosil|paleont|dinosaur|articulacion'],
  ['egg', 'huevo|ovul|reproduccion|ovipar|embrion|fecund|nido'],
  // Física, química, energía
  ['zap', 'energia|electric|corriente|voltaje|rayo$|trueno|relampag|circuito|electron'],
  ['batteryCharging', 'bateria|pila$|pilas$|acumulador|carga electrica'],
  ['fuel', 'combustible|petroleo|gasolina|diesel|hidrocarb|gas natural|carbon$'],
  ['atom', 'atomo|atomic|molecul|quimic|nuclear|particula|materia|proton|neutron|isotopo|fisica|elemento'],
  ['flaskConical', 'reaccion|experimento|mezcla|solucion|disolucion|acido|laboratorio|sustancia|compuesto'],
  ['testTube', 'ensayo|muestra|hipotesis|probeta'],
  ['microscope', 'celula|celular|bacteria|virus|microb|microscop|tejido|organulo|nucleo|biologia|hongo|protozoo|mitosis|meiosis'],
  ['dna', 'adn$|arn$|gen$|genes|genetic|genom|cromosom|heren|mutacion|evolucion|darwin'],
  ['rocket', 'cohete|espacio|espacial|astronaut|nasa|satelite|galaxia|planeta|sistema solar|universo|cosmos|orbita|astronom|cometa|asteroide|gravedad|mercurio|venus|marte|jupiter|saturno|urano|neptuno'],
  ['moon', 'luna$|lunar|eclipse|noche|nocturn'],
  ['star', 'estrella|constelacion|astro$'],
  ['music', 'musica|musical|melodia|ritmo|cancion|sonido|onda sonora|acustic|tono$|armonia|orquesta|opera$|instrumento|sinfonia|nota musical'],
  // Salud
  ['heartPulse', 'corazon|cardiac|circulacion|sangre|pulso|cardio|arteria|vena$|presion arterial'],
  ['stethoscope', 'medic|diagnost|pulmon|respirac|enfermedad|doctor|clinic|sintoma|hospital|salud'],
  ['pill', 'medicament|farmac|dosis|antibiot|tratamiento|analgesic'],
  ['syringe', 'vacuna|inyecc|inmuniz|anticuerpo|defensas'],
  ['bandage', 'herida|primeros auxilios|cicatriz|fractura|curacion|lesion'],
  ['brain', 'cerebr|mente|memoria|neurona|psicolog|cognit|aprendizaje|pensamiento|inteligencia|nervios|sentidos'],
  ['apple', 'fruta|nutri|aliment|dieta|vitamina|manzana|saludable'],
  ['carrot', 'verdura|hortaliza|zanahoria'],
  ['wheat', 'trigo|cereal|agricult|cosecha|campo$|granja|cultivo|harina|grano|campesin'],
  ['milk', 'leche|lacteo|ganader|calcio'],
  ['coffee', 'cafe$|infusion|desayuno'],
  ['pizza', 'pizza|fraccion|numerador|denominador|mitad|tercio|cuarto|porcion|comida|gastronom|receta|cocina|culinar'],
  ['iceCream', 'helado|postre|dulce|azucar'],
  ['dumbbell', 'deporte|ejercicio|gimnasia|fuerza|entrenamiento|atletismo|musculo|futbol|baloncesto|olimp|resistencia fisica'],
  // Matemáticas y datos
  ['ruler', 'geometr|perimetro|area$|angulo|triangul|cuadrad|rectangul|poligono|escala|centimetro|metro$|medida|medicion|simetr|circunferencia|radio$|diametro|volumen|equivalen|simplific|compar'],
  ['calculator', 'suma|sumar|resta|restar|multiplic|divis|ecuacion|algebra|aritmet|matematic|calculo|porcentaje|decimal|numero|numeric|economia|presupuesto|inflacion|impuesto|ahorro|inversion|mercado|oferta|demanda|precio|comercio|moneda|dinero|salario|empleo|pib$|potenciacion|raiz cuadrada'],
  ['database', 'datos|estadistic|grafico|tabla$|frecuencia|promedio|probabilidad|informacion|registro|censo|encuesta'],
  // Tecnología
  ['cpu', 'computador|procesador|hardware|algoritm|program|inteligencia artificial|robot|codigo|binario|automat'],
  ['laptop', 'software|internet|digital|aplicacion|web$|navegador|virtual|ofimatica'],
  ['smartphone', 'celular|telefon|movil|mensajeria|redes sociales'],
  ['wifi', 'red$|redes|conexion|wifi|inalambric|telecomunic|senal|comunicacion'],
  ['monitor', 'pantalla|monitor|television|video$|pixel'],
  ['camera', 'foto|fotograf|camara|cine$|pelicula|imagen$'],
  // Lenguaje y arte
  ['bookOpen', 'poema|poesia|verso$|versos|estrofa|rima|lirica|soneto|lector|oracion|gramatic|sintaxis|ortograf|verbo|sustantiv|adjetiv|adverbio|pronombre|sujeto|predicado|vocabulario|sinonimo|antonimo|idioma|lengua$|lenguaje|diccionario|signific'],
  ['book', 'libro|literatur|novela|cuento|fabula|lectura|narrativ|texto$|autor$|escritor|biblioteca|leyenda|mito$'],
  ['pencil', 'escritur|redaccion|ensayo|escribir|composicion|caligrafia|dibujo|boceto|apunte|tarea$'],
  ['penTool', 'diseno|ilustracion|trazo|vector|plano$|arquitect|ingenieria'],
  ['palette', 'arte$|pintur|color|pintor|cuadro|acuarela|renacimiento|impresionis|museo|escultur|expresionis|cubismo'],
  ['guitar', 'guitarra|folclor|cuerda|bambuco|vallenato|cumbia|himno'],
  ['mic', 'voz$|discurso|oratoria|entrevista|podcast|radio$|exposicion oral|debate|cantante|microfono|protesta|manifestac|huelga'],
  ['scissors', 'recorte|collage|sastre|costura|confeccion|manualidad|guillotina'],
  // Geografía
  ['compass', 'orientacion|brujula|geografia|cartograf|coordenada|longitud|latitud|punto cardinal|explorador|hemisferio|continente|meridiano|paralelo|mapa'],
  ['mapPin', 'ubicacion|lugar$|region|territorio|pais$|capital$|frontera|localiz'],
  ['tent', 'campamento|acampar|exploracion|nomada|tribu|aldea'],
  ['anchor', 'puerto|ancla|navegac|naufrag|marinero|armada'],
  ['ship', 'barco|nave$|navio|colonia|colonizac|conquista|descubrimiento|carabela|flota|pirata|travesia'],
  ['plane', 'avion|aviacion|aereo|aeropuerto|aeron'],
  ['car', 'auto$|automovil|vehicul|motor$|transito|coche'],
  ['bus', 'bus$|transporte publico|autobus|pasajer'],
  ['bike', 'bicicleta|ciclismo|ciclista|pedal'],
  ['train', 'tren$|ferrocarril|locomotora|riel|ferroviar'],
  // Historia y sociedad
  ['factory', 'industr|fabrica|manufactur|produccion|obrero|proletari|capitalis|maquinaria'],
  ['zap', 'revolucion|rebelion|levantamiento|insurrec|motin'],
  ['building2', 'ciudad|urbano|urbaniz|rascacielo|edificio|metropoli|municipio|alcald'],
  ['building', 'gobierno|palacio|ayuntamiento|bastilla|institu|estado$|congreso|parlamento|asamblea|banco$|catedral|castillo|monarqu|rey$|reino|imperio|trono|nobleza|aristocra|emperador|feudal'],
  ['home', 'hogar|casa$|familia|vivienda|domicil|refugio'],
  ['shieldCheck', 'derecho|ley$|leyes|constitu|justicia|seguridad|declaracion|proteccion|norma$|deber|democracia|ciudadan|soberania|tratado|garantia|igualdad|libertad'],
  ['trophy', 'victoria|campeon|torneo|competencia|triunfo|guerra|batalla|trofeo'],
  ['medal', 'heroe|logro|premio|medalla|merito|procer|libertador|independencia|honor'],
  ['lock', 'contrasena|encript|privad|prision|esclavitud|censura|absolutis|bloqueo'],
  ['key', 'clave$|llave|cifrado|descifr'],
  ['lightbulb', 'idea$|ideas|invento|invencion|innovac|creativ|genio|iluminismo|ilustrado|razon$|ciencia$|edison|descubrimiento cientifico'],
  ['target', 'objetivo|meta$|estrategia|proposito|enfoque|mision'],
  ['graduationCap', 'educacion|escuela|universidad|colegio|estudiante|ensenanza|pedagog|academi|profesor|graduac'],
  ['hammer', 'construccion|herramienta|carpinter|artesan|forja|obra$'],
  ['wrench', 'mecanic|reparac|maquina|engranaje|mantenimiento|tecnica'],
  ['umbrella', 'paraguas|prevencion|cobertura'],
  ['heart', 'amor$|solidaridad|empatia|fraternidad|carino|compasion|valores|respeto|cuidado'],
  ['smile', 'alegria|felicidad|sonrisa|emocion|humor|amistad'],
];

const compile = (roots: string): RegExp =>
  new RegExp(
    `\\b(?:${roots
      .split('|')
      .map((root) => (root.endsWith('$') ? `${root.slice(0, -1)}\\b` : root))
      .join('|')})`,
  );

export const DOMINO_ICON_KEYWORDS: ReadonlyArray<readonly [string, RegExp]> = RAW_KEYWORDS.filter(([icon]) =>
  DOMINO_ICON_CATALOG.includes(icon),
).map(([icon, roots]) => [icon, compile(roots)] as const);

/** Minúsculas y sin tildes/diacríticos. */
export const foldText = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Todos los íconos que casan con el nombre del concepto, en orden de especificidad. */
export function keywordIconsFor(label: string): string[] {
  const text = foldText(label);
  return DOMINO_ICON_KEYWORDS.filter(([, pattern]) => pattern.test(text)).map(([icon]) => icon);
}
