import { MIN_DISCARDS_TO_ACCUSE } from './guessWhoTypes'
import { ArrowUp, ArrowUpDown, Brain, Check, CircleHelp, Copy, Dice5, DoorOpen, Ear, Eye, Flag, Footprints, Hand, Handshake, Layers, Leaf, Link2, MessageCircleQuestion, MoveRight, Search, Shield, SquareMousePointer, Sun, Trophy, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type InstructionKind = 'PAIRS' | 'OPPOSITES' | 'GUESS_WHO' | 'GUESS_WHO_GROUP' | 'DOMINO' | 'MAZE_COLLECTOR' | 'SNAKES_LADDERS' | 'DUAL_QUEST_PIXI' | 'TRUE_FALSE_MAZE'
type Instruction = { text: string; exampleTitle: string; labels: [string, string, string, string]; icons: [LucideIcon, LucideIcon, LucideIcon, LucideIcon]; caption: string }

/** Solo contenido: la presentación y la forma de continuar son comunes. */
export const gameInstructions: Record<InstructionKind, Instruction> = {
  DOMINO: {
    text: 'Conecta una ficha con el mismo concepto en uno de los extremos. Si no puedes jugar, roba una ficha. Gana quien se quede sin fichas primero.',
    exampleTitle: 'Ejemplo de conexión', labels: ['Paneles solares', 'Zonas verdes', 'Zonas verdes', 'Paneles solares'],
    icons: [Sun, Leaf, Leaf, Sun],
    caption: 'El concepto del extremo debe coincidir.',
  },
  PAIRS: {
    text: 'Destapa dos cartas y une cada imagen con la carta de su nombre. Recuerda dónde están y completa las parejas de cada zona antes de que termine el tiempo.',
    exampleTitle: 'Ejemplo de pareja', labels: ['Destapa', 'Mira', 'Recuerda', 'Empareja'],
    icons: [SquareMousePointer, Eye, Brain, Copy],
    caption: 'Una imagen y su nombre forman una pareja.',
  },
  OPPOSITES: {
    text: 'Destapa dos cartas y une cada concepto con su opuesto. Recuerda las posiciones y completa las parejas de cada zona antes de que termine el tiempo.',
    exampleTitle: 'Ejemplo de opuestos', labels: ['Destapa', 'Compara', 'Opuesto', 'Une'],
    icons: [Layers, Search, ArrowUpDown, Link2],
    caption: 'Compara los conceptos y une cada carta con su opuesto.',
  },
  GUESS_WHO: {
    text: `Pregunta a tu rival y descarta las tarjetas que no coincidan con sus respuestas. Tras descartar al menos ${MIN_DISCARDS_TO_ACCUSE}, puedes intentar adivinar su tarjeta secreta. Gana quien acierte.`,
    exampleTitle: 'Ejemplo de una ronda', labels: ['Pregunta', 'Escucha', 'Descarta', 'Adivina'],
    icons: [MessageCircleQuestion, Ear, X, CircleHelp],
    caption: 'Usa las respuestas para reducir las opciones antes de adivinar.',
  },
  GUESS_WHO_GROUP: {
    text: `Es un torneo por puntos: todos juegan todas las rondas y en cada una se sortea uno de los juegos que eligió el administrador. En los duelos (Identidad Oculta: pregunta, descarta y, tras descartar al menos ${MIN_DISCARDS_TO_ACCUSE}, adivina la tarjeta de tu rival) quien gana suma 1 punto; en el Laberinto V/F juegas solo y sumas 1 punto si respondes todo bien. Al final gana quien tenga más puntos.`,
    exampleTitle: 'Ejemplo del torneo', labels: ['Juega', 'Gana', 'Suma', 'Lidera'],
    icons: [Dice5, Check, Trophy, Flag],
    caption: 'Cada ronda ganada suma un punto; al final gana quien más tenga.',
  },
  MAZE_COLLECTOR: {
    text: 'Muévete con las flechas, WASD o los controles de pantalla. Recoge todos los elementos del laberinto y evita a los enemigos: si te alcanzan, pierdes una vida.',
    exampleTitle: 'Ejemplo del recorrido', labels: ['Muévete', 'Recoge', 'Esquiva', 'Completa'],
    icons: [Footprints, Hand, Shield, Flag],
    caption: 'Recoge todos los elementos antes de quedarte sin vidas.',
  },
  SNAKES_LADDERS: {
    text: 'En tu turno, tira el dado para avanzar. Las escaleras te hacen subir y las serpientes bajar. Responde los retos que aparezcan y llega primero a la última casilla.',
    exampleTitle: 'Ejemplo de un turno', labels: ['Tira', 'Avanza', 'Responde', 'Llega'],
    icons: [Dice5, MoveRight, MessageCircleQuestion, Flag],
    caption: 'Tira el dado, resuelve los retos del camino y llega a la última casilla.',
  },
  TRUE_FALSE_MAZE: {
    text: 'Lee la afirmación y lleva al robot a la sala VERDADERO o FALSO con las flechas, WASD o deslizando. Esquiva a las medusas galácticas: los núcleos de energía las aturden y las rejillas te llevan al otro lado de la nave. Si respondes mal o te atrapan, pierdes una batería.',
    exampleTitle: 'Ejemplo de una ronda', labels: ['Lee', 'Corre', 'Esquiva', 'Responde'],
    icons: [Eye, Footprints, Shield, Check],
    caption: 'Llega a la sala correcta antes de quedarte sin baterías.',
  },
  DUAL_QUEST_PIXI: {
    text: 'Juegan en pareja, cada uno desde su dispositivo: Lumen nada en la lava y Gota en el agua. Muévete con las flechas o A/D, salta con ↑, W o espacio (en celular, con los botones). Ayúdense con botones, palancas, cajas, básculas y llaves, y párense juntos en los pedestales de cada Puerta del Saber: solo pasan si los dos responden bien.',
    exampleTitle: 'Ejemplo de cooperación', labels: ['Muévete', 'Salta', 'Coopera', 'Respondan'],
    icons: [Footprints, ArrowUp, Handshake, DoorOpen],
    caption: 'Tres Puertas del Saber, gemas y tres corazones compartidos.',
  },
}

/** Claves de instrucciones que corresponden a un formulario de creación (sin variantes de partida como el torneo). */
export type CreationInstructionKind = Exclude<InstructionKind, 'GUESS_WHO_GROUP'>

/**
 * Versión corta de las instrucciones para la pantalla de éxito tras crear un
 * juego (issue #245): una frase de para qué sirve y otra de cómo se juega,
 * ambas de ≈140 caracteres como máximo para que quepan sin scroll en móvil.
 * Vive junto a `gameInstructions` para que el contenido de cada tipo tenga
 * una sola fuente de verdad: si cambia la mecánica, se ajustan ambos aquí.
 */
export const gameInstructionSummaries: Record<CreationInstructionKind, { purpose: string; howTo: string }> = {
  DOMINO: {
    purpose: 'Une conceptos iguales para vaciar tu mano.',
    howTo: 'Conecta una ficha con el mismo concepto en uno de los extremos. Si no puedes jugar, roba una ficha.',
  },
  GUESS_WHO: {
    purpose: 'Adivina la tarjeta secreta de tu rival por eliminación.',
    howTo: 'Pregunta, descarta tarjetas y adivina tras descartar el mínimo.',
  },
  OPPOSITES: {
    purpose: 'Practica reconocer conceptos contrarios.',
    howTo: 'Destapa dos cartas y une cada concepto con su opuesto antes de que termine el tiempo.',
  },
  PAIRS: {
    purpose: 'Entrena la memoria uniendo imágenes con su nombre.',
    howTo: 'Destapa dos cartas y une cada imagen con su nombre antes de que termine el tiempo.',
  },
  DUAL_QUEST_PIXI: {
    purpose: 'Dos estudiantes superan escenarios en equipo y responden juntos.',
    howTo: 'Lumen y Gota se ayudan con botones, palancas y espejos; en cada Puerta del Saber pasan solo si los dos aciertan.',
  },
  MAZE_COLLECTOR: {
    purpose: 'Recoge todos los elementos y esquiva a los enemigos.',
    howTo: 'Muévete con flechas o WASD. Si un enemigo te alcanza, pierdes una vida.',
  },
  TRUE_FALSE_MAZE: {
    purpose: 'Decide si cada afirmación es verdadera o falsa recorriendo un laberinto.',
    howTo: 'Lleva al robot a la sala VERDADERO o FALSO y esquiva a las medusas galácticas.',
  },
  SNAKES_LADDERS: {
    purpose: 'Avanza por el tablero respondiendo retos.',
    howTo: 'Tira el dado, responde los retos y llega primero a la última casilla.',
  },
}
