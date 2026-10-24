import type { InstructionKind } from '../gameInstructions'
import { MIN_DISCARDS_TO_ACCUSE } from '../guessWhoTypes'
import { EcoTruckSprite } from '../EcoTruckSprite'
import { PollutionGhostSprite } from '../PollutionGhostSprite'
import { PetSprite, PowerPelletSprite } from '../mazeCollectibleSprites'
import { spaceshipSpriteUrl } from '../true-false-maze/spaceshipAssets'
import { getCharacterArt } from '../dual-quest-pixi/render/characterArt'
import type { Role } from '../dual-quest-pixi/dualQuestPixiTypes'
import type { TutorialStep } from './InteractiveTutorial'
import { GridTutorialBoard } from './GridTutorialBoard'
import type { GridDirection, GridPlayerDef } from './GridTutorialBoard'
import { MemoryTutorialBoard } from './MemoryTutorialBoard'
import type { MemoryTutorialCard } from './MemoryTutorialBoard'
import { DominoTutorialBoard } from './DominoTutorialBoard'
import type { DominoConcept, DominoTutorialTile } from './DominoTutorialBoard'
import { GuessWhoTutorialBoard } from './GuessWhoTutorialBoard'
import type { GuessWhoTutorialCard, GuessWhoTutorialQuestion } from './GuessWhoTutorialBoard'
import { SnakesLaddersTutorialBoard } from './SnakesLaddersTutorialBoard'

/*
 * Pasos de cada mini tutorial. Cada paso enseña UNA cosa y la persona la
 * hace en un pedazo jugable del juego: los textos dicen qué hacer y el
 * tablero solo deja avanzar cuando lo logra.
 */

// ── MatchMente (parejas y opuestos) ───────────────────────────────────────

function memorySteps(opposites: boolean): TutorialStep[] {
  const pairs: [MemoryTutorialCard, MemoryTutorialCard][] = opposites
    ? [
        [{ id: 'dia', pair: 'dia', content: '☀️ Día', isText: true }, { id: 'noche', pair: 'dia', content: '🌙 Noche', isText: true }],
        [{ id: 'alto', pair: 'alto', content: '🦒 Alto', isText: true }, { id: 'bajo', pair: 'alto', content: '🐁 Bajo', isText: true }],
      ]
    : [
        [{ id: 'perro-img', pair: 'perro', content: '🐶' }, { id: 'perro-txt', pair: 'perro', content: 'Perro', isText: true }],
        [{ id: 'gato-img', pair: 'gato', content: '🐱' }, { id: 'gato-txt', pair: 'gato', content: 'Gato', isText: true }],
      ]
  // Orden fijo y mezclado: ninguna pareja queda una al lado de la otra.
  const shuffled = [pairs[0][0], pairs[1][1], pairs[1][0], pairs[0][1]]
  const mismatch = opposites ? 'Esos no son opuestos: se vuelven a tapar. ¡Recuerda dónde estaban!' : 'No son pareja: se vuelven a tapar. ¡Recuerda dónde estaban!'
  return [
    {
      title: 'Destapa una carta',
      tip: 'Todas las cartas empiezan boca abajo.',
      task: 'Toca cualquier carta para darle la vuelta.',
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

const SOL: DominoConcept = { label: 'Paneles solares', emoji: '☀️' }
const VERDE: DominoConcept = { label: 'Zonas verdes', emoji: '🌳' }
const AGUA: DominoConcept = { label: 'Ahorro de agua', emoji: '💧' }
const RECICLA: DominoConcept = { label: 'Reciclaje', emoji: '♻️' }
const BICI: DominoConcept = { label: 'Bicicleta', emoji: '🚲' }
const VIENTO: DominoConcept = { label: 'Energía eólica', emoji: '🌬️' }
const tile = (id: string, a: DominoConcept, b: DominoConcept): DominoTutorialTile => ({ id, a, b })

const DOMINO_STEPS: TutorialStep[] = [
  {
    title: 'Conecta una ficha',
    tip: 'Una ficha se conecta si tiene el mismo concepto que uno de los extremos de la mesa.',
    task: 'Toca la ficha de tu mano que encaja en la mesa.',
    success: '¡Conectada! Los conceptos iguales quedan juntos.',
    board: (props) => (
      <DominoTutorialBoard {...props} goal={1} chain={[tile('mesa', SOL, VERDE)]} hand={[tile('h1', BICI, RECICLA), tile('h2', VERDE, AGUA), tile('h3', VIENTO, BICI)]} />
    ),
  },
  {
    title: 'Usa los dos extremos',
    tip: 'Puedes jugar por la izquierda o por la derecha: la ficha se gira sola.',
    task: 'Conecta dos fichas, una en cada extremo.',
    success: '¡Muy bien! La cadena crece por ambos lados.',
    board: (props) => (
      <DominoTutorialBoard {...props} goal={2} chain={[tile('mesa', SOL, VERDE)]} hand={[tile('h1', RECICLA, SOL), tile('h2', BICI, VIENTO), tile('h3', VERDE, AGUA)]} />
    ),
  },
  {
    title: 'Si no puedes jugar, roba',
    tip: 'Cuando ninguna ficha encaja, robas una del montón y sigues intentando.',
    task: 'Roba una ficha y conéctala.',
    success: '¡Perfecto! Gana quien se queda sin fichas primero.',
    board: (props) => (
      <DominoTutorialBoard {...props} goal={1} chain={[tile('mesa', SOL, VERDE)]} hand={[tile('h1', BICI, RECICLA), tile('h2', VIENTO, AGUA)]} pile={[tile('p1', VERDE, BICI)]} />
    ),
  },
]

// ── Identidad Oculta ──────────────────────────────────────────────────────

const GW_CARDS: GuessWhoTutorialCard[] = [
  { id: 'buho', name: 'Búho', emoji: '🦉', traits: ['vuela', 'noche'] },
  { id: 'pez', name: 'Pez', emoji: '🐟', traits: ['agua'] },
  { id: 'aguila', name: 'Águila', emoji: '🦅', traits: ['vuela'] },
  { id: 'pulpo', name: 'Pulpo', emoji: '🐙', traits: ['agua', 'noche'] },
  { id: 'murcielago', name: 'Murciélago', emoji: '🦇', traits: ['vuela', 'noche'] },
  { id: 'tortuga', name: 'Tortuga', emoji: '🐢', traits: ['agua'] },
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
      task: 'Toca una pregunta.',
      success: '¡Eso es! Cada respuesta te da una pista.',
      board: (props) => <GuessWhoTutorialBoard {...props} mode="ask" cards={GW_CARDS} secretId={GW_SECRET} questions={[Q_FLY, Q_WATER, Q_NIGHT]} />,
    },
    {
      title: 'Descarta las que no encajan',
      tip: 'Tu rival dijo que su tarjeta vuela: las que no vuelan ya no pueden ser.',
      task: 'Toca las tarjetas que NO vuelan para descartarlas.',
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
    tip: 'En tu turno tiras el dado y tu ficha avanza esas casillas. Si caes al pie de una escalera, ¡subes!',
    task: 'Toca el dado.',
    success: '¡Caíste en una escalera y subiste de la 3 a la 8!',
    board: (props) => <SnakesLaddersTutorialBoard {...props} start={1} roll={2} goal="ladder" />,
  },
  {
    title: 'Responde el reto',
    tip: 'Algunas casillas tienen un reto. Respóndelo bien para seguir en carrera.',
    task: 'Tira el dado y responde el reto.',
    success: '¡Correcto! Los retos son la parte de aprender del juego.',
    board: (props) => (
      <SnakesLaddersTutorialBoard {...props} start={8} roll={1} goal="challenge" challenge={{ text: '¿Qué gas necesitan las plantas para hacer la fotosíntesis?', options: ['Oxígeno', 'Dióxido de carbono', 'Helio'], correct: 1 }} />
    ),
  },
  {
    title: 'Llega a la meta',
    tip: 'Cuidado con las serpientes: si caes en su cabeza, bajas. Gana quien llega primero a la última casilla.',
    task: 'Tira el dado y llega al 🏁.',
    success: '¡Llegaste a la meta!',
    board: (props) => <SnakesLaddersTutorialBoard {...props} start={9} roll={3} goal="finish" />,
  },
]

// ── Camión reciclador (laberinto coleccionista) ───────────────────────────

const truckPlayer = (start: { r: number; c: number }, goal?: { r: number; c: number }): GridPlayerDef => ({
  id: 'camion',
  label: 'Camión',
  keys: 'any',
  start,
  goal,
  render: (facing, size) => <EcoTruckSprite facing={facing} size={size * 1.15} />,
})
const flag = (size: number) => <span style={{ fontSize: size * 0.6 }} aria-label="Meta">🏁</span>
const cloud = (frightened: boolean, size: number) => (
  <PollutionGhostSprite personality="CHASER" mode={frightened ? 'FRIGHTENED' : 'NORMAL'} size={size * 0.95} />
)
const cityBase = {
  theme: 'city' as const,
  renderItem: (size: number) => <PetSprite size={size} />,
  renderPower: (size: number) => <PowerPelletSprite size={size} />,
  renderGoal: flag,
  caughtMessage: '¡La nube te alcanzó y perdiste una vida! Vuelves al inicio: inténtalo otra vez.',
}

const MAZE_STEPS: TutorialStep[] = [
  {
    title: 'Mueve el camión',
    tip: 'Usa las flechas del teclado (o W A S D), la cruceta de abajo, o desliza el dedo sobre el mapa.',
    task: 'Lleva el camión hasta la bandera 🏁.',
    success: '¡Así se maneja el camión!',
    board: (props) => (
      <GridTutorialBoard {...props} config={{ ...cityBase, map: ['#######', '#.....#', '#.###.#', '#.....#', '#######'], players: [truckPlayer({ r: 1, c: 1 }, { r: 3, c: 5 })], win: { type: 'reach' } }} />
    ),
  },
  {
    title: 'Recoge las botellas',
    tip: 'Para limpiar la ciudad hay que recoger todas las botellas PET: basta con pasar por encima.',
    task: 'Recoge las 4 botellas.',
    success: '¡Calles limpias!',
    board: (props) => (
      <GridTutorialBoard {...props} config={{ ...cityBase, map: ['#######', '#..o..#', '#.#.#o#', '#o...o#', '#######'], players: [truckPlayer({ r: 1, c: 1 })], win: { type: 'collect' } }} />
    ),
  },
  {
    title: 'Esquiva la nube',
    tip: 'Las nubes de contaminación patrullan las calles. Si te tocan, pierdes una vida.',
    task: 'Recoge las botellas sin que la nube te toque.',
    success: '¡Buen manejo! La esquivaste.',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...cityBase,
          enemyStepMs: 750,
          map: ['#######', '#....o#', '#.###.#', '#o...o#', '#######'],
          players: [truckPlayer({ r: 1, c: 1 })],
          enemies: [{ path: [{ r: 3, c: 2 }, { r: 3, c: 3 }, { r: 3, c: 4 }, { r: 3, c: 3 }], render: cloud }],
          win: { type: 'collect' },
        }}
      />
    ),
  },
  {
    title: 'Usa la caneca de energía',
    tip: 'La caneca de energía ⚡ activa el purificador: por unos segundos las nubes se asustan y puedes atraparlas.',
    task: 'Toma la caneca y luego atrapa la nube.',
    success: '¡Purificaste la nube! Así ganas puntos extra.',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...cityBase,
          enemyStepMs: 800,
          powerMs: 8000,
          map: ['#######', '#B....#', '#.###.#', '#.....#', '#######'],
          players: [truckPlayer({ r: 3, c: 1 })],
          enemies: [{ path: [{ r: 1, c: 5 }, { r: 2, c: 5 }, { r: 3, c: 5 }, { r: 3, c: 4 }, { r: 3, c: 5 }, { r: 2, c: 5 }], render: cloud }],
          win: { type: 'catch' },
        }}
      />
    ),
  },
]

// ── Laberinto Verdadero o Falso ───────────────────────────────────────────

const ROBOT_FRAME: Record<GridDirection, string> = { UP: 'robot-up-0', DOWN: 'robot-down-0', LEFT: 'robot-left-0', RIGHT: 'robot-right-0' }
const robotPlayer = (start: { r: number; c: number }, goal?: { r: number; c: number }): GridPlayerDef => ({
  id: 'robot',
  label: 'Robot',
  keys: 'any',
  start,
  goal,
  render: (facing, size) => <img src={spaceshipSpriteUrl(`robot/${ROBOT_FRAME[facing]}`)} alt="Robot" style={{ height: size * 1.05 }} className="w-auto drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" draggable={false} />,
})
const jelly = (frightened: boolean, size: number) => (
  <img src={spaceshipSpriteUrl('jellyfish/jelly-down-0')} alt="Medusa" style={{ height: size }} className={`w-auto ${frightened ? 'opacity-60 grayscale' : 'drop-shadow-[0_0_8px_rgba(192,132,252,0.7)]'}`} draggable={false} />
)
const zone = (kind: 'V' | 'F', size: number) => (
  <span
    className={`flex h-full w-full items-center justify-center rounded-md text-[0.7em] font-black text-white ${kind === 'V' ? 'bg-emerald-500/80' : 'bg-rose-500/80'}`}
    style={{ fontSize: size * 0.34 }}
  >
    {kind === 'V' ? '✓ V' : '✕ F'}
  </span>
)
const shipBase = {
  theme: 'ship' as const,
  renderZone: zone,
  renderGoal: (size: number) => <span style={{ fontSize: size * 0.6 }} aria-label="Meta">✨</span>,
  caughtMessage: '¡Una medusa te atrapó y perdiste una batería! Vuelves al inicio.',
  wrongZoneMessage: 'Esa sala es la respuesta equivocada: perderías una batería. Lee otra vez la afirmación.',
}

function trueFalseSteps(): TutorialStep[] {
  return [
    {
      title: 'Mueve el robot',
      tip: 'Flechas o W A S D en el teclado; en el celular, la cruceta o deslizar el dedo.',
      task: 'Lleva el robot hasta la luz ✨.',
      success: '¡El robot ya responde a tus controles!',
      board: (props) => (
        <GridTutorialBoard {...props} config={{ ...shipBase, map: ['#######', '#.....#', '#.#.#.#', '#.....#', '#######'], players: [robotPlayer({ r: 1, c: 1 }, { r: 3, c: 5 })], win: { type: 'reach' } }} />
      ),
    },
    {
      title: 'Responde con el robot',
      tip: 'Afirmación: «El Sol es una estrella». Si es verdad, ve a la sala VERDADERO; si no, a FALSO.',
      task: 'Lleva el robot a la sala correcta.',
      success: '¡Correcto! El Sol es una estrella.',
      board: (props) => (
        <GridTutorialBoard {...props} config={{ ...shipBase, map: ['#######', '#V...F#', '#..#..#', '#.....#', '#######'], players: [robotPlayer({ r: 3, c: 3 })], win: { type: 'zone', correct: 'V' } }} />
      ),
    },
    {
      title: 'Esquiva a la medusa',
      tip: 'Afirmación: «La Luna tiene luz propia». Ojo: una medusa galáctica vigila el pasillo.',
      task: 'Llega a la sala correcta sin que la medusa te toque.',
      success: '¡Exacto! La Luna solo refleja la luz del Sol.',
      board: (props) => (
        <GridTutorialBoard
          {...props}
          config={{
            ...shipBase,
            enemyStepMs: 700,
            map: ['#######', '#V...F#', '#.#.#.#', '#.....#', '#######'],
            players: [robotPlayer({ r: 3, c: 3 })],
            enemies: [{ path: [{ r: 1, c: 2 }, { r: 1, c: 3 }, { r: 1, c: 4 }, { r: 1, c: 3 }], render: jelly }],
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
        <GridTutorialBoard {...props} config={{ ...shipBase, map: ['#######', '#F...V#', '#..#..#', '#.....#', '#######'], players: [robotPlayer({ r: 3, c: 3 })], win: { type: 'zone', correct: 'V' } }} />
      ),
    },
  ]
}

// ── Dual Quest (Fuego y Agua) ─────────────────────────────────────────────

const elementPlayer = (role: 'FIRE' | 'WATER', keys: GridPlayerDef['keys'], start: { r: number; c: number }, goal?: { r: number; c: number }): GridPlayerDef => ({
  id: role === 'FIRE' ? 'fuego' : 'agua',
  label: role === 'FIRE' ? '🔥 Fuego' : '💧 Agua',
  keys,
  start,
  goal,
  render: (_facing, size) => (
    <span
      className={`flex items-center justify-center rounded-full border-2 border-white/80 shadow-md ${role === 'FIRE' ? 'bg-orange-500' : 'bg-sky-500'}`}
      style={{ width: size * 0.82, height: size * 0.82, fontSize: size * 0.48 }}
    >
      {role === 'FIRE' ? '🔥' : '💧'}
    </span>
  ),
})
const templeBase = {
  theme: 'temple' as const,
  renderItem: (size: number) => <span style={{ fontSize: size * 0.9 }}>💎</span>,
  renderGoal: (size: number) => <span style={{ fontSize: size * 0.62 }} aria-label="Núcleo">🔆</span>,
}

const DUAL_QUEST_STEPS: TutorialStep[] = [
  {
    title: 'Recoge las gemas',
    tip: 'Cada quien mueve a su personaje con las flechas, W A S D o la cruceta.',
    task: 'Mueve a Fuego y recoge las 3 gemas 💎.',
    success: '¡Gemas recogidas!',
    board: (props) => (
      <GridTutorialBoard {...props} config={{ ...templeBase, map: ['#######', '#..o..#', '#.#.#.#', '#o...o#', '#######'], players: [elementPlayer('FIRE', 'any', { r: 1, c: 1 })], win: { type: 'collect' } }} />
    ),
  },
  {
    title: 'Activa el mecanismo',
    tip: 'Los mecanismos ❓ hacen una pregunta: si respondes bien, se abre el camino.',
    task: 'Pisa el ❓ y responde la pregunta.',
    success: '¡Mecanismo activado!',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...templeBase,
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
    tip: 'Fuego se mueve con W A S D y Agua con las flechas (en la cruceta, elige a quién mover).',
    task: 'Lleva a Fuego y a Agua a sus núcleos 🔆.',
    success: '¡Equipo reunido! Así se completa el reto.',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...templeBase,
          map: ['#######', '#.....#', '#.#.#.#', '#.....#', '#######'],
          players: [elementPlayer('FIRE', 'wasd', { r: 1, c: 1 }, { r: 3, c: 3 }), elementPlayer('WATER', 'arrows', { r: 1, c: 5 }, { r: 3, c: 4 })],
          win: { type: 'all-reach' },
        }}
      />
    ),
  },
]

// ── Lumen y Gota (Dual Quest con PixiJS) ──────────────────────────────────

function svgUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Lumen o Gota armados con las mismas piezas SVG que usa el juego. */
function PixiCharacter({ role, size, facing }: { role: Role; size: number; facing: GridDirection }) {
  const art = getCharacterArt(role)
  const pieces = [art.legL.svg, art.legR.svg, art.armL.svg, art.armR.svg, art.body]
  return (
    <span className="relative block" style={{ width: size, height: size, transform: facing === 'LEFT' ? 'scaleX(-1)' : undefined }}>
      {pieces.map((svg, i) => (
        <img key={i} src={svgUrl(svg)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
      ))}
    </span>
  )
}

const pixiPlayer = (role: Role, start: { r: number; c: number }, goal?: { r: number; c: number }): GridPlayerDef => ({
  id: role === 'FIRE' ? 'lumen' : 'gota',
  label: role === 'FIRE' ? 'Lumen (A/D)' : 'Gota (← →)',
  keys: role === 'FIRE' ? 'wasd' : 'arrows',
  start,
  goal,
  render: (facing, size) => <PixiCharacter role={role} size={size * 1.05} facing={facing} />,
})
const pixiBase = {
  theme: 'temple' as const,
  renderGoal: (size: number) => <span style={{ fontSize: size * 0.62 }} aria-label="Portal">🌀</span>,
}

const PIXI_STEPS: TutorialStep[] = [
  {
    title: 'Mueve a Lumen',
    tip: 'Lumen se mueve con A y D (W para saltar). En la cruceta, elige a Lumen.',
    task: 'Lleva a Lumen hasta el portal 🌀.',
    success: '¡Lumen llegó!',
    board: (props) => <GridTutorialBoard {...props} config={{ ...pixiBase, map: ['#######', '#.....#', '#######'], players: [pixiPlayer('FIRE', { r: 1, c: 1 }, { r: 1, c: 5 })], win: { type: 'reach' } }} />,
  },
  {
    title: 'Mueve a Gota',
    tip: 'Gota se mueve con las flechas ← → (↑ para saltar o nadar, ↓ para bucear).',
    task: 'Lleva a Gota hasta el portal 🌀.',
    success: '¡Gota llegó!',
    board: (props) => <GridTutorialBoard {...props} config={{ ...pixiBase, map: ['#######', '#.....#', '#######'], players: [pixiPlayer('WATER', { r: 1, c: 5 }, { r: 1, c: 1 })], win: { type: 'reach' } }} />,
  },
  {
    title: 'Cooperen hasta el portal',
    tip: 'El nivel termina cuando los dos personajes llegan al portal.',
    task: 'Lleva a Lumen y a Gota a sus portales.',
    success: '¡Nivel completado en equipo!',
    board: (props) => (
      <GridTutorialBoard
        {...props}
        config={{
          ...pixiBase,
          map: ['#######', '#.....#', '#.###.#', '#.....#', '#######'],
          players: [pixiPlayer('FIRE', { r: 1, c: 1 }, { r: 3, c: 3 }), pixiPlayer('WATER', { r: 1, c: 5 }, { r: 3, c: 4 })],
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
