import type { ComponentProps } from 'react'
import { Brain, Check, Clock, Eye, Layers, Target, Timer } from 'lucide-react'
import { MemoryMatchGame } from '../MemoryMatchGame'
import type { MemoryMatchTutorialPart } from '../MemoryMatchGame'
import type { MemoryMatchPair } from '../memoryMatchTypes'
import { TutorialRunner } from './TutorialRunner'
import type { TutorialPart } from './TutorialRunner'
import { ArtMemoryPair, ArtMemoryPreview, ArtMemoryZone } from './tutorialArt'

type GameProps = Omit<ComponentProps<typeof MemoryMatchGame>, 'tutorial'>

/** Una ilustración grande y alegre (emoji sobre un fondo de color) como imagen de carta. */
function funImage(emoji: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><circle cx="52" cy="48" r="22" fill="#fff" opacity="0.35"/><circle cx="196" cy="200" r="30" fill="#fff" opacity="0.25"/><text x="120" y="158" font-size="120" text-anchor="middle">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Cartas universales del tutorial (animales y frutas): se entienden sin saber del tema del juego. */
const FUN_PAIRS: MemoryMatchPair[] = [
  { mode: 'PAIRS', pairId: 'perro', imageUrl: funImage('🐶', '#fde68a', '#fb923c'), label: 'Perro' },
  { mode: 'PAIRS', pairId: 'gato', imageUrl: funImage('🐱', '#fbcfe8', '#c084fc'), label: 'Gato' },
  { mode: 'PAIRS', pairId: 'fresa', imageUrl: funImage('🍓', '#fecaca', '#f43f5e'), label: 'Fresa' },
  { mode: 'PAIRS', pairId: 'pez', imageUrl: funImage('🐠', '#bae6fd', '#0ea5e9'), label: 'Pez' },
]

const FUN_OPPOSITES: MemoryMatchPair[] = [
  {
    mode: 'OPPOSITES',
    pairId: 'dia-noche',
    posTitle: 'Día',
    posDescription: 'Cuando sale el Sol y hay luz.',
    posImageUrl: funImage('☀️', '#fef08a', '#f59e0b'),
    negTitle: 'Noche',
    negDescription: 'Cuando sale la Luna y todo se oscurece.',
    negImageUrl: funImage('🌙', '#312e81', '#6d28d9'),
  },
  {
    mode: 'OPPOSITES',
    pairId: 'frio-calor',
    posTitle: 'Calor',
    posDescription: 'Lo que sentimos cuando hace mucho sol.',
    posImageUrl: funImage('🔥', '#fed7aa', '#ef4444'),
    negTitle: 'Frío',
    negDescription: 'Lo que sentimos cuando nieva.',
    negImageUrl: funImage('❄️', '#e0f2fe', '#38bdf8'),
  },
  {
    mode: 'OPPOSITES',
    pairId: 'alto-bajo',
    posTitle: 'Grande',
    posDescription: 'Como un elefante.',
    posImageUrl: funImage('🐘', '#e9d5ff', '#8b5cf6'),
    negTitle: 'Pequeño',
    negDescription: 'Como una hormiga.',
    negImageUrl: funImage('🐜', '#bbf7d0', '#22c55e'),
  },
]

/**
 * Tutorial de MatchMente sobre el tablero real, pero con cartas universales
 * (animales, frutas, día y noche…) en vez del contenido del juego: se
 * entienden al instante y se ven alegres. Tres partes cortas: memorizar,
 * encontrar una pareja y completar una zona a tiempo.
 */
export function MemoryMatchTutorial({ onFinish, ...game }: GameProps & { onFinish: () => void }) {
  const opposites = game.pairs[0]?.mode === 'OPPOSITES'
  // Tres parejas por tablero: pocas para no abrumar, y siempre las mismas (el orden también es fijo).
  const pairs = (opposites ? FUN_OPPOSITES : FUN_PAIRS).slice(0, 3)
  const small = Math.min(3, pairs.length)
  const board = (goal: MemoryMatchTutorialPart['goal'], overrides: Partial<GameProps>): TutorialPart['render'] =>
    function MemoryPart(context) {
      // Mientras se lee la instrucción no se monta el tablero: así la vista previa y el reloj no corren.
      if (!context.active) return <div className="fixed inset-0 z-50 bg-bg" />
      return (
        <MemoryMatchGame
          {...game}
          pairs={pairs}
          pairCount={small}
          perZone={small}
          {...overrides}
          gameId={undefined}
          onExit={context.onExit}
          tutorial={{ goal, focusPairId: pairs[0].pairId, onDone: context.onDone, onFailed: context.onFailed }}
        />
      )
    }

  const parts: TutorialPart[] = [
    {
      title: 'Memoriza las cartas',
      task: 'Mira bien dónde está cada carta: en unos segundos se van a tapar.',
      explain: 'Al empezar cada zona ves todas las cartas destapadas unos segundos. ¡Es tu momento para memorizar!',
      success: '¡Listo! Ahora las cartas están boca abajo.',
      art: <ArtMemoryPreview />,
      points: [
        { icon: <Eye className="h-4 w-4" />, tone: 'violet', text: <>Fíjate <b className="text-white">dónde está cada una</b>.</> },
        { icon: <Timer className="h-4 w-4" />, tone: 'cyan', text: <>¿Ya te las sabes? Toca <b className="text-white">«¡Ya, a jugar!»</b>.</> },
      ],
      render: board('preview', { showPreview: true, difficulty: 'challenging' }),
    },
    {
      title: opposites ? 'Une un concepto con su opuesto' : 'Une una imagen con su nombre',
      task: opposites ? 'Destapa dos cartas que sean opuestas (por ejemplo, Día y Noche).' : 'Destapa una imagen y la carta con su nombre.',
      explain: opposites
        ? 'Destapa dos cartas: si son conceptos opuestos, se quedan arriba. Si no, se vuelven a tapar.'
        : 'Destapa dos cartas: si la imagen va con su nombre, se quedan arriba. Si no, se vuelven a tapar.',
      success: '¡Pareja encontrada!',
      art: <ArtMemoryPair opposites={opposites} />,
      points: [
        { icon: <Target className="h-4 w-4" />, tone: 'emerald', text: <>Toca <b className="text-white">una carta y luego otra</b>.</> },
        { icon: <Check className="h-4 w-4" />, tone: 'emerald', text: <>Si <b className="text-white">hacen pareja</b>, se quedan destapadas.</> },
        { icon: <Brain className="h-4 w-4" />, tone: 'amber', text: <>Si no, recuerda <b className="text-white">dónde estaban</b>.</> },
      ],
      render: board('pair', { showPreview: false, timePerZoneSeconds: 300 }),
    },
    {
      title: 'Completa la zona a tiempo',
      task: 'Encuentra todas las parejas antes de que el reloj llegue a cero.',
      explain: 'Cada zona tiene un reloj. Encuentra todas sus parejas antes de que se acabe el tiempo para pasar a la siguiente.',
      success: '¡Zona superada! Así se gana en MatchMente.',
      art: <ArtMemoryZone />,
      points: [
        { icon: <Layers className="h-4 w-4" />, tone: 'violet', text: <>Completa <b className="text-white">todas las parejas</b> de la zona.</> },
        { icon: <Clock className="h-4 w-4" />, tone: 'rose', text: <>Si se acaba el tiempo, puedes <b className="text-white">reintentar</b>.</> },
      ],
      render: board('zone', { showPreview: true, difficulty: 'challenging', timePerZoneSeconds: 90 }),
    },
  ]

  return <TutorialRunner name="MatchMente" parts={parts} accent="violet" onFinish={onFinish} />
}
