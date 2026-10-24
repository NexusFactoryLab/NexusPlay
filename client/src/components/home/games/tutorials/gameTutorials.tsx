import type { InstructionKind } from '../gameInstructions'
import { MIN_DISCARDS_TO_ACCUSE } from '../guessWhoTypes'
import { EcoTruckSprite } from '../EcoTruckSprite'
import { PollutionGhostSprite } from '../PollutionGhostSprite'
import { PetSprite, PowerPelletSprite } from '../mazeCollectibleSprites'
import { CITY_MAP_ROWS_ASCII } from '../sostenibleCityMap'
import { spaceshipSpriteUrl } from '../true-false-maze/spaceshipAssets'
import { getCharacterArt } from '../dual-quest-pixi/render/characterArt'
import { DOOR_UNLOCKED_SVG, gemSvg } from '../dual-quest-pixi/render/svgAssets'
import type { Role } from '../dual-quest-pixi/dualQuestPixiTypes'
import type { DominoConcept } from '../dominoTypes'
import type { TutorialStep } from './InteractiveTutorial'
import { GridTutorialBoard } from './GridTutorialBoard'
import type { GridCell, GridDirection, GridPlayerDef } from './GridTutorialBoard'
import { MemoryTutorialBoard } from './MemoryTutorialBoard'
import type { MemoryTutorialCard } from './MemoryTutorialBoard'
import { DominoTutorialBoard } from './DominoTutorialBoard'
import { GuessWhoTutorialBoard } from './GuessWhoTutorialBoard'
import type { GuessWhoTutorialCard, GuessWhoTutorialQuestion } from './GuessWhoTutorialBoard'
import { SnakesLaddersTutorialBoard } from './SnakesLaddersTutorialBoard'

/*
 * Pasos de cada mini tutorial. Cada paso enseña UNA cosa y la persona la
 * hace en un pedazo jugable del juego, armado con sus sprites y piezas
 * reales: los textos dicen qué hacer y el tablero solo deja avanzar cuando
 * lo logra. `tip` es para computador (teclado) y `tipTouch` para celular o
 * tablet (cruceta, deslizar).
 */

function dataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ── MatchMente (parejas y opuestos) ───────────────────────────────────────

function memorySteps(opposites: boolean): TutorialStep[] {
  const pairs: [MemoryTutorialCard, MemoryTutorialCard][] = opposites
    ? [
        [{ id: 'dia', pair: 'dia', title: 'Día', badge: 'positive' }, { id: 'noche', pair: 'dia', title: 'Noche', badge: 'negative' }],
        [{ id: 'alto', pair: 'alto', title: 'Alto', badge: 'positive' }, { id: 'bajo', pair: 'alto', title: 'Bajo', badge: 'negative' }],
      ]
    : [
        [{ id: 'perro-img', pair: 'perro', title: 'Perro', picture: '🐶' }, { id: 'perro-txt', pair: 'perro', title: 'Perro' }],
        [{ id: 'gato-img', pair: 'gato', title: 'Gato', picture: '🐱' }, { id: 'gato-txt', pair: 'gato', title: 'Gato' }],
      ]
  // Orden fijo y mezclado: ninguna pareja queda una al lado de la otra.
  const shuffled = [pairs[0][0], pairs[1][1], pairs[1][0], pairs[0][1]]
  const mismatch = opposites ? 'Esos no son opuestos: se vuelven a tapar. ¡Recuerda dónde estaban!' : 'No son pareja: se vuelven a tapar. ¡Recuerda dónde estaban!'
  return [
    {
      title: 'Destapa una carta',
      tip: 'Todas las cartas empiezan boca abajo. Haz clic en una para darle la vuelta.',
      tipTouch: 'Todas las cartas empiezan boca abajo. Tócala para darle la vuelta.',
      task: 'Destapa cualquier carta.',
      success: '¡Así se destapa una carta!',
      board: (props) => <MemoryTutorialBoard {...props} cards={shuffled} goal="flip" mismatchMessage={mismatch} />,
    },
    {
      title: opposites ? 'Une un concepto con su opuesto' : 'Une una imagen con su nombre',
      tip: opposites ? 'Destapa dos cartas: si son contrarias (como Día y Noche), se quedan arriba.' : 'Destapa dos cartas: si la imagen va con su nombre, se quedan arriba.',
      task: 'Encuentra una pareja.',
      success: '¡Pareja encontrada! Se queda destapada.',
      board: (props) => <MemoryTutorialBoard {...props} cards={shuffled} goal={1} mismatchMessage={mismatch} />,
    },
    {
      title: 'Completa todas las parejas',
      tip: 'En el juego hay más cartas y un reloj: la memoria es tu mejor aliada.',
      task: 'Encuentra las dos parejas.',
      success: '¡Completaste el tablero!',
      board: (props) => <MemoryTutorialBoard {...props} cards={shuffled} goal={2} mismatchMessage={mismatch} />,
    },
  ]
}

// ── Dominexo ──────────────────────────────────────────────────────────────

// Conceptos del tutorial con íconos del mismo catálogo del juego (DOMINO_ICONS).
const DOMINO_CONCEPTS: DominoConcept[] = [
  { conceptId: 'sol', label: 'Paneles solares', icon: 'sun', color: '#f59e0b' },
  { conceptId: 'verde', label: 'Zonas verdes', icon: 'tree', color: '#22c55e' },
  { conceptId: 'agua', label: 'Ahorro de agua', icon: 'droplets', color: '#0ea5e9' },
  { conceptId: 'recicla', label: 'Reciclaje', icon: 'recycle', color: '#10b981' },
  { conceptId: 'bici', label: 'Bicicleta', icon: 'bike', color: '#8b5cf6' },
  { conceptId: 'viento', label: 'Energía eólica', icon: 'wind', color: '#64748b' },
]
const [SOL, VERDE, AGUA, RECICLA, BICI, VIENTO] = [0, 1, 2, 3, 4, 5]
const tile = (id: string, a: number, b: number) => ({ id, a, b })

const DOMINO_STEPS: TutorialStep[] = [
  {
    title: 'Conecta una ficha',
    tip: 'Una ficha se conecta si tiene el mismo concepto que uno de los extremos de la mesa.',
    task: 'Elige la ficha de tu mano que encaja en la mesa.',
    success: '¡Conectada! Los conceptos iguales quedan juntos.',
    board: (props) => (
      <DominoTutorialBoard {...props} concepts={DOMINO_CONCEPTS} goal={1} chain={[tile('mesa', SOL, VERDE)]} hand={[tile('h1', BICI, RECICLA), tile('h2', VERDE, AGUA), tile('h3', VIENTO, BICI)]} />
    ),
  },
  {
    title: 'Usa los dos extremos',
    tip: 'Puedes jugar por la izquierda o por la derecha: la ficha se gira sola.',
    task: 'Conecta dos fichas, una en cada extremo.',
    success: '¡Muy bien! La cadena crece por ambos lados.',
    board: (props) => (
      <DominoTutorialBoard {...props} concepts={DOMINO_CONCEPTS} goal={2} chain={[tile('mesa', SOL, VERDE)]} hand={[tile('h1', RECICLA, SOL), tile('h2', BICI, VIENTO), tile('h3', VERDE, AGUA)]} />
    ),
  },
  {
    title: 'Si no puedes jugar, roba',
    tip: 'Cuando ninguna ficha encaja, robas una del montón y sigues intentando.',
    task: 'Roba una ficha y conéctala.',
    success: '¡Perfecto! Gana quien se queda sin fichas primero.',
    board: (props) => (
      <DominoTutorialBoard {...props} concepts={DOMINO_CONCEPTS} goal={1} chain={[tile('mesa', SOL, VERDE)]} hand={[tile('h1', BICI, RECICLA), tile('h2', VIENTO, AGUA)]} pile={[tile('p1', VERDE, BICI)]} />
    ),
  },
]

// ── Identidad Oculta ──────────────────────────────────────────────────────

const GW_CARDS: GuessWhoTutorialCard[] = [
  { id: 'buho', name: 'Búho', emoji: '🦉', tint: '#a16207', traits: ['vuela', 'noche'] },
  { id: 'pez', name: 'Pez', emoji: '🐟', tint: '#0284c7', traits: ['agua'] },
  { id: 'aguila', name: 'Águila', emoji: '🦅', tint: '#78716c', traits: ['vuela'] },
  { id: 'pulpo', name: 'Pulpo', emoji: '🐙', tint: '#db2777', traits: ['agua', 'noche'] },
  { id: 'murcielago', name: 'Murciélago', emoji: '🦇', tint: '#4c1d95', traits: ['vuela', 'noche'] },
  { id: 'tortuga', name: 'Tortuga', emoji: '🐢', tint: '#15803d', traits: ['agua'] },
]
const GW_SECRET = 'buho'
const Q_FLY: GuessWhoTutorialQuestion = { id: 'vuela', text: '¿Tu tarjeta vuela?', trait: 'vuela' }
const Q_WATER: GuessWhoTutorialQuestion = { id: 'agua', text: '¿Vive en el agua?', trait: 'agua' }
const Q_NIGHT: GuessWhoTutorialQuestion = { id: 'noche', text: '¿Sale de noche?', trait: 'noche' }

function guessWhoSteps(tournament: boolean): TutorialStep[] {
  return [
    {
      title: 'Hazle una pregunta a tu rival',
      tip: 'Tu rival tiene una tarjeta secreta. Pregúntale cosas que se respondan con Sí o No.',
      task: 'Elige una pregunta.',
      success: '¡Eso es! Cada respuesta te da una pista.',
      board: (props) => <GuessWhoTutorialBoard {...props} mode="ask" cards={GW_CARDS} secretId={GW_SECRET} questions={[Q_FLY, Q_WATER, Q_NIGHT]} />,
    },
    {
      title: 'Descarta las que no encajan',
      tip: 'Tu rival dijo que su tarjeta vuela: las que no vuelan ya no pueden ser.',
      task: 'Descarta las tarjetas que NO vuelan.',
      success: `¡Bien! Necesitas descartar al menos ${MIN_DISCARDS_TO_ACCUSE} para poder adivinar.`,
      board: (props) => <GuessWhoTutorialBoard {...props} mode="discard" cards={GW_CARDS} secretId={GW_SECRET} answered={Q_FLY} />,
    },
    {
      title: 'Afina con otra pregunta',
      tip: 'Ahora preguntaste si sale de noche y la respuesta fue Sí.',
      task: 'Descarta la que no sale de noche.',
      success: '¡Solo quedan dos opciones!',
      board: (props) => (
        <GuessWhoTutorialBoard {...props} mode="discard" cards={GW_CARDS} secretId={GW_SECRET} answered={Q_NIGHT} preDiscarded={['pez', 'pulpo', 'tortuga']} />
      ),
    },
    {
      title: tournament ? 'Adivina y avanza en el torneo' : 'Adivina la tarjeta secreta',
      tip: 'Es de noche y vuela… y tu rival te contó que tiene plumas. ¿Cuál es?',
      task: 'Toca «Adivinar» y elige la tarjeta secreta.',
      success: tournament ? '¡Acertaste! En el torneo, ganar te lleva a la siguiente ronda.' : '¡Acertaste! Gana quien adivina primero.',
      board: (props) => (
        <GuessWhoTutorialBoard {...props} mode="guess" cards={GW_CARDS} secretId={GW_SECRET} preDiscarded={['pez', 'pulpo', 'tortuga', 'aguila']} />
      ),
    },
  ]
}

// ── Escaleras y Serpientes ────────────────────────────────────────────────

const SNAKES_STEPS: TutorialStep[] = [
  {
    title: 'Tira el dado',
    tip: 'En tu turno tiras el dado y tu ficha avanza esas casillas. Si caes al pie de una escalera (verde), ¡subes!',
    task: 'Tira el dado.',
    success: '¡Caíste en una escalera y subiste de la 3 a la 9!',
    board: (props) => <SnakesLaddersTutorialBoard {...props} start={1} roll={2} goal="ladder" />,
  },
  {
    title: 'Responde el reto',
    tip: 'Algunas casillas tienen un reto. Respóndelo bien para seguir en carrera.',
    task: 'Tira el dado y responde el reto.',
    success: '¡Correcto! Los retos son la parte de aprender del juego.',
    board: (props) => (
      <SnakesLaddersTutorialBoard
        {...props}
        start={9}
        roll={1}
        goal="challenge"
        challenge={{ text: '¿Qué gas necesitan las plantas para hacer la fotosíntesis?', options: ['Oxígeno', 'Dióxido de carbono', 'Helio'], correct: 1 }}
      />
    ),
  },
  {
    title: 'Llega a la meta',
    tip: 'Cuidado con las serpientes (rojas): si caes en su cabeza, bajas. Gana quien llega primero a la última casilla.',
    task: 'Tira el dado y llega a la casilla 15.',
    success: '¡Llegaste a la meta!',
    board: (props) => <SnakesLaddersTutorialBoard {...props} start={10} roll={5} goal="finish" />,
  },
]

// ── Camión reciclador (Ciudad Sostenible) ─────────────────────────────────

/** Un recorte del mapa real de la ciudad, con marcas encima ('o' botella, 'B' caneca). */
function cityWindow(origin: GridCell, rows: number, cols: number, marks: Record<string, string> = {}) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => marks[`${r}:${c}`] ?? CITY_MAP_ROWS_ASCII[origin.r + r][origin.c + c]).join(''),
  )
}

const truckPlayer = (start: GridCell, goal?: GridCell): GridPlayerDef => ({
  id: 'camion',
  label: 'Camión',
  keys: 'any',
  start,
  goal,
  render: (facing, size) => <EcoTruckSprite facing={facing} size={size * 1.25} />,
})
const flag = (size: number) => (
  <span className="flex items-center justify-center rounded-full bg-white/85 shadow" style={{ width: size * 0.78, height: size * 0.78, fontSize: size * 0.5 }} aria-label="Meta">
    🏁
  </span>
)
const cloud = (frightened: boolean, size: number) => <PollutionGhostSprite personality="CHASER" mode={frightened ? 'FRIGHTENED' : 'NORMAL'} size={size * 1.1} />
const NORTH = { r: 1, c: 0 }
const CENTER = { r: 6, c: 0 }
const city = (origin: GridCell) => ({
  scene: { kind: 'city' as const, origin },
  renderItem: (size: number) => <PetSprite size={size} />,
  renderPower: (size: number) => <PowerPelletSprite size={size} />,
  renderGoal: flag,
  caughtMessage: '¡La nube te alcanzó y perdiste una vida! Vuelves al inicio: inténtalo otra vez.',
})

const MAZE_STEPS: TutorialStep[] = [
  {
    title: 'Maneja el camión',
    tip: 'Usa las flechas del teclado (o W A S D) para ir por las calles de la ciudad.',
    tipTouch: 'Usa la cruceta de abajo o desliza el dedo sobre el mapa para ir por las calles.',
    task: 'Lleva el camión hasta la bandera 🏁.',
    success: '¡Así se maneja el camión!',
    board: (props) => (
      <GridTutorialBoard {...props} config={{ ...city(NORTH), map: cityWindow(NORTH, 6, 11), players: [truckPlayer({ r: 0, c: 0 }, { r: 5, c: 9 })], win: { type: 'reach' } }} />
    ),
  },
  {
    title: 'Recoge las botellas',
    tip: 'Para limpiar la ciudad hay que recoger todas las botellas PET: basta con pasar por encima.',
    task: 'Recoge las 4 botellas.',
    success: '¡Calles limpias!',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{ ...city(NORTH), map: cityWindow(NORTH, 6, 11, { '0:5': 'o', '3:5': 'o', '5:2': 'o', '5:8': 'o' }), players: [truckPlayer({ r: 0, c: 0 })], win: { type: 'collect' } }}
      />
    ),
  },
  {
    title: 'Esquiva la nube',
    tip: 'Las nubes de contaminación patrullan las calles. Si te tocan, pierdes una vida: busca otro camino.',
    task: 'Recoge las 3 botellas sin que la nube te toque.',
    success: '¡Buen manejo! La esquivaste.',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...city(CENTER),
          enemyStepMs: 700,
          map: cityWindow(CENTER, 5, 12, { '0:11': 'o', '4:11': 'o', '4:0': 'o' }),
          players: [truckPlayer({ r: 0, c: 0 })],
          enemies: [{ path: [3, 4, 5, 6, 7, 8, 7, 6, 5, 4].map((c) => ({ r: 4, c })), render: cloud }],
          win: { type: 'collect' },
        }}
      />
    ),
  },
  {
    title: 'Usa la caneca de energía',
    tip: 'La caneca de energía activa el purificador: por unos segundos las nubes se asustan y puedes atraparlas.',
    task: 'Toma la caneca y luego atrapa la nube.',
    success: '¡Purificaste la nube! Así ganas puntos extra.',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...city(NORTH),
          enemyStepMs: 650,
          powerMs: 12000,
          map: cityWindow(NORTH, 6, 11, { '0:0': 'B' }),
          players: [truckPlayer({ r: 5, c: 0 })],
          enemies: [{ path: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1].map((r) => ({ r, c: 5 })), render: cloud }],
          win: { type: 'catch' },
        }}
      />
    ),
  },
]

// ── Laberinto Verdadero o Falso (la nave) ─────────────────────────────────

const ROBOT_FRAME: Record<GridDirection, string> = { UP: 'robot-up-0', DOWN: 'robot-down-0', LEFT: 'robot-left-0', RIGHT: 'robot-right-0' }
const robotPlayer = (start: GridCell, goal?: GridCell): GridPlayerDef => ({
  id: 'robot',
  label: 'Robot',
  keys: 'any',
  start,
  goal,
  render: (facing, size) => (
    <img
      src={spaceshipSpriteUrl(`robot/${ROBOT_FRAME[facing]}`)}
      alt="Robot"
      style={{ height: size * 1.15 }}
      className="w-auto max-w-none drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
      draggable={false}
    />
  ),
})
const jelly = (frightened: boolean, size: number) => (
  <img
    src={spaceshipSpriteUrl('jellyfish/jelly-down-0')}
    alt="Medusa"
    style={{ height: size * 1.05 }}
    className={`w-auto max-w-none ${frightened ? 'opacity-60 grayscale' : 'drop-shadow-[0_0_8px_rgba(192,132,252,0.7)]'}`}
    draggable={false}
  />
)
const ship = {
  scene: { kind: 'ship' as const },
  renderGoal: (size: number) => (
    <span className="animate-pulse rounded-full bg-cyan-300/40 shadow-[0_0_18px_6px_rgba(34,211,238,0.6)]" style={{ width: size * 0.5, height: size * 0.5 }} aria-label="Meta" />
  ),
  caughtMessage: '¡Una medusa te atrapó y perdiste una batería! Vuelves al inicio.',
  wrongZoneMessage: 'Esa sala es la respuesta equivocada: perderías una batería. Lee otra vez la afirmación.',
}

function trueFalseSteps(): TutorialStep[] {
  return [
    {
      title: 'Mueve el robot',
      tip: 'Usa las flechas del teclado (o W A S D) para recorrer los pasillos de la nave.',
      tipTouch: 'Usa la cruceta de abajo o desliza el dedo para recorrer los pasillos de la nave.',
      task: 'Lleva el robot hasta la luz.',
      success: '¡El robot ya responde a tus controles!',
      board: (props) => (
        <GridTutorialBoard {...props} config={{ ...ship, map: ['#######', '#...X.#', '#.#.#.#', '#.Y...#', '#######'], players: [robotPlayer({ r: 1, c: 1 }, { r: 3, c: 5 })], win: { type: 'reach' } }} />
      ),
    },
    {
      title: 'Responde con el robot',
      tip: 'Afirmación: «El Sol es una estrella». Si es verdad, ve a la sala VERDADERO; si no, a FALSO.',
      task: 'Lleva el robot a la sala correcta.',
      success: '¡Correcto! El Sol es una estrella.',
      board: (props) => (
        <GridTutorialBoard {...props} config={{ ...ship, map: ['#######', '#V.Y.F#', '#..#..#', '#.....#', '#######'], players: [robotPlayer({ r: 3, c: 3 })], win: { type: 'zone', correct: 'V' } }} />
      ),
    },
    {
      title: 'Esquiva a la medusa',
      tip: 'Afirmación: «La Luna tiene luz propia». Ojo: una medusa galáctica vigila el pasillo de arriba.',
      task: 'Llega a la sala correcta sin que la medusa te toque.',
      success: '¡Exacto! La Luna solo refleja la luz del Sol.',
      board: (props) => (
        <GridTutorialBoard
          {...props}
          config={{
            ...ship,
            enemyStepMs: 700,
            map: ['#######', '#V...F#', '#.#X#.#', '#.....#', '#######'],
            players: [robotPlayer({ r: 3, c: 3 })],
            enemies: [{ path: [2, 3, 4, 3].map((c) => ({ r: 1, c })), render: jelly }],
            win: { type: 'zone', correct: 'F' },
          }}
        />
      ),
    },
    {
      title: 'Las salas cambian de lugar',
      tip: 'Afirmación: «El agua hierve a 100 °C al nivel del mar». ¡Atención: las salas se cambiaron de lado!',
      task: 'No te guíes por el lado: busca la sala correcta.',
      success: '¡Muy bien! En cada pregunta mira dónde quedó cada sala.',
      board: (props) => (
        <GridTutorialBoard {...props} config={{ ...ship, map: ['#######', '#F.Y.V#', '#..#..#', '#.....#', '#######'], players: [robotPlayer({ r: 3, c: 3 })], win: { type: 'zone', correct: 'V' } }} />
      ),
    },
  ]
}

// ── Dual Quest (Fuego y Agua, el templo) ──────────────────────────────────

const FIRE_GEM = dataUrl(gemSvg('#f97316', '#fdba74'))
const WATER_GEM = dataUrl(gemSvg('#3b82f6', '#93c5fd'))
const elementPlayer = (role: 'FIRE' | 'WATER', keys: GridPlayerDef['keys'], start: GridCell, goal?: GridCell): GridPlayerDef => ({
  id: role === 'FIRE' ? 'fuego' : 'agua',
  label: role === 'FIRE' ? '🔥 Fuego' : '💧 Agua',
  keys,
  start,
  goal,
  render: (_facing, size) => (
    <span
      className={`flex items-center justify-center rounded-full border-2 border-white shadow-[0_4px_10px_rgba(0,0,0,0.45)] ${role === 'FIRE' ? 'bg-orange-500' : 'bg-blue-500'}`}
      style={{ width: size * 0.84, height: size * 0.84, fontSize: size * 0.5 }}
    >
      {role === 'FIRE' ? '🔥' : '💧'}
    </span>
  ),
})
const temple = (gem: string) => ({
  scene: { kind: 'temple' as const },
  renderItem: (size: number) => <img src={gem} alt="Gema" style={{ width: size * 1.1, height: size * 1.1 }} draggable={false} />,
  renderGoal: (size: number) => (
    <span
      className="animate-pulse rotate-45 rounded-md border-2 border-amber-200 bg-amber-400/80 shadow-[0_0_16px_4px_rgba(251,191,36,0.6)]"
      style={{ width: size * 0.55, height: size * 0.55 }}
      aria-label="Núcleo"
    />
  ),
})

const DUAL_QUEST_STEPS: TutorialStep[] = [
  {
    title: 'Recoge las gemas',
    tip: 'Cada quien mueve a su personaje con las flechas o W A S D.',
    tipTouch: 'Cada quien mueve a su personaje con la cruceta o deslizando el dedo.',
    task: 'Mueve a Fuego y recoge las 3 gemas.',
    success: '¡Gemas recogidas!',
    board: (props) => (
      <GridTutorialBoard {...props} config={{ ...temple(FIRE_GEM), map: ['#######', '#..o..#', '#.#.#.#', '#o...o#', '#######'], players: [elementPlayer('FIRE', 'any', { r: 1, c: 1 })], win: { type: 'collect' } }} />
    ),
  },
  {
    title: 'Activa el mecanismo',
    tip: 'Los mecanismos hacen una pregunta: si respondes bien, se abre el camino.',
    task: 'Ve hasta el ? y responde la pregunta.',
    success: '¡Mecanismo activado!',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...temple(WATER_GEM),
          map: ['#######', '#.....#', '#.###.#', '#...?.#', '#######'],
          players: [elementPlayer('WATER', 'any', { r: 1, c: 1 })],
          question: { text: '¿Cuántos lados tiene un triángulo?', options: ['Dos', 'Tres', 'Cuatro'], correct: 1 },
          win: { type: 'question' },
        }}
      />
    ),
  },
  {
    title: 'Reúnanse en el núcleo',
    tip: 'Fuego se mueve con W A S D y Agua con las flechas: pueden jugar dos personas en el mismo teclado.',
    tipTouch: 'Elige abajo a quién mueve la cruceta: primero a Fuego y luego a Agua.',
    task: 'Lleva a Fuego y a Agua a sus núcleos.',
    success: '¡Equipo reunido! Así se completa el reto.',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...temple(FIRE_GEM),
          map: ['#######', '#.....#', '#.#.#.#', '#.....#', '#######'],
          players: [elementPlayer('FIRE', 'wasd', { r: 1, c: 1 }, { r: 3, c: 3 }), elementPlayer('WATER', 'arrows', { r: 1, c: 5 }, { r: 3, c: 4 })],
          keyHint: 'Fuego: W A S D · Agua: flechas',
          win: { type: 'all-reach' },
        }}
      />
    ),
  },
]

// ── Lumen y Gota (Dual Quest con PixiJS, vista de lado) ───────────────────

/** Lumen o Gota armados con las mismas piezas SVG que usa el juego. */
function PixiCharacter({ role, size, facing }: { role: Role; size: number; facing: GridDirection }) {
  const art = getCharacterArt(role)
  const pieces = [art.legL.svg, art.legR.svg, art.armL.svg, art.armR.svg, art.body]
  return (
    <span className="relative block" style={{ width: size, height: size, transform: facing === 'LEFT' ? 'scaleX(-1)' : undefined }}>
      {pieces.map((svg, i) => (
        <img key={i} src={dataUrl(svg)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
      ))}
    </span>
  )
}

const pixiPlayer = (role: Role, start: GridCell, goal?: GridCell): GridPlayerDef => ({
  id: role === 'FIRE' ? 'lumen' : 'gota',
  label: role === 'FIRE' ? 'Lumen' : 'Gota',
  keys: role === 'FIRE' ? 'wasd' : 'arrows',
  element: role,
  start,
  goal,
  render: (facing, size) => <PixiCharacter role={role} size={size * 1.15} facing={facing} />,
})
const side = {
  scene: { kind: 'side' as const },
  gravity: true,
  renderGoal: (size: number) => <img src={dataUrl(DOOR_UNLOCKED_SVG)} alt="Portal" style={{ height: size * 1.05 }} className="w-auto max-w-none" draggable={false} />,
  liquidMessage: (player: GridPlayerDef) =>
    player.element === 'WATER' ? '¡Gota no puede tocar la lava! Salta por encima: vuelven al inicio.' : '¡Lumen no puede tocar el agua! Salta por encima: vuelven al inicio.',
}

const PIXI_STEPS: TutorialStep[] = [
  {
    title: 'Camina con Lumen',
    tip: 'Lumen camina con A y D.',
    tipTouch: 'Mueve a Lumen con las flechas ← → de la cruceta.',
    task: 'Lleva a Lumen hasta la puerta.',
    success: '¡Lumen llegó!',
    board: (props) => (
      <GridTutorialBoard {...props} config={{ ...side, map: ['.........', '.........', '#########'], players: [pixiPlayer('FIRE', { r: 1, c: 0 }, { r: 1, c: 8 })], keyHint: 'Lumen: A y D para caminar', win: { type: 'reach' } }} />
    ),
  },
  {
    title: 'Salta con Gota',
    tip: 'Gota camina con ← → y salta con ↑. Salta y avanza mientras está en el aire para subir a la caja.',
    tipTouch: 'Toca ↑ para saltar y enseguida → para pasar por encima de la caja.',
    task: 'Lleva a Gota hasta la puerta pasando la caja.',
    success: '¡Buen salto!',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{ ...side, map: ['.........', '.........', '.........', '....C....', '#########'], players: [pixiPlayer('WATER', { r: 3, c: 0 }, { r: 3, c: 8 })], keyHint: 'Gota: ← → para caminar, ↑ para saltar', win: { type: 'reach' } }}
      />
    ),
  },
  {
    title: 'Cada uno en su líquido',
    tip: 'Lumen nada en la lava y Gota en el agua, pero cada uno muere en el líquido del otro: ¡salten por encima!',
    tipTouch: 'Lumen nada en la lava y Gota en el agua; en el del otro, ¡salten! Elige abajo a quién mueve la cruceta.',
    task: 'Lleva a Lumen y a Gota a sus puertas.',
    success: '¡Nivel completado en equipo!',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...side,
          map: ['..........', '..........', '...L..W...', '##########'],
          players: [pixiPlayer('FIRE', { r: 2, c: 0 }, { r: 2, c: 8 }), pixiPlayer('WATER', { r: 2, c: 1 }, { r: 2, c: 9 })],
          keyHint: 'Lumen: A D y W para saltar · Gota: ← → y ↑ para saltar',
          win: { type: 'all-reach' },
        }}
      />
    ),
  },
]

export function tutorialStepsFor(kind: InstructionKind): TutorialStep[] {
  switch (kind) {
    case 'PAIRS':
      return memorySteps(false)
    case 'OPPOSITES':
      return memorySteps(true)
    case 'DOMINO':
      return DOMINO_STEPS
    case 'GUESS_WHO':
      return guessWhoSteps(false)
    case 'GUESS_WHO_GROUP':
      return guessWhoSteps(true)
    case 'SNAKES_LADDERS':
      return SNAKES_STEPS
    case 'MAZE_COLLECTOR':
      return MAZE_STEPS
    case 'TRUE_FALSE_MAZE':
      return trueFalseSteps()
    case 'DUAL_QUEST':
      return DUAL_QUEST_STEPS
    case 'DUAL_QUEST_PIXI':
      return PIXI_STEPS
  }
}
