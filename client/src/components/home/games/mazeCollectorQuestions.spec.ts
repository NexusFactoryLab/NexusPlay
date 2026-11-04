import { describe, expect, it } from 'vitest'
import { MAZE_LAYOUT_IDS } from './mazeCollectorTypes'
import {
  BOOK_PDF_OFFSET,
  BOOK_TITLE,
  MAX_OPTION_LENGTH,
  MAX_QUESTION_LENGTH,
  MAX_QUESTION_OPTIONS,
  MIN_MAZE_QUESTIONS,
  MIN_QUESTION_OPTIONS,
  QUESTIONS_BY_MAP,
  SUSTAINABLE_CITY_QUESTIONS,
  bookPdfPage,
  questionsForGame,
} from './mazeCollectorQuestions'

describe('bancos de preguntas por mapa (issue #150)', () => {
  it('cada mapa tiene su propio banco, con al menos 12 preguntas en los mapas temáticos', () => {
    expect(QUESTIONS_BY_MAP.CITY).toBe(SUSTAINABLE_CITY_QUESTIONS)
    for (const name of ['AMAZON', 'OCEAN', 'PARAMO'] as const) {
      expect(QUESTIONS_BY_MAP[name].length).toBeGreaterThanOrEqual(12)
    }
    const banks = new Set(MAZE_LAYOUT_IDS.map((name) => QUESTIONS_BY_MAP[name]))
    expect(banks.size).toBe(4)
  })

  it('todas las preguntas caben en el mapa: largo, número de opciones y respuesta correcta válida', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      const bank = QUESTIONS_BY_MAP[name]
      expect(bank.length).toBeGreaterThanOrEqual(MIN_MAZE_QUESTIONS)
      for (const item of bank) {
        expect(item.question.length, item.question).toBeLessThanOrEqual(MAX_QUESTION_LENGTH)
        expect(item.options.length).toBeGreaterThanOrEqual(MIN_QUESTION_OPTIONS)
        expect(item.options.length).toBeLessThanOrEqual(MAX_QUESTION_OPTIONS)
        for (const option of item.options) expect(option.length, option).toBeLessThanOrEqual(MAX_OPTION_LENGTH)
        expect(new Set(item.options).size).toBe(item.options.length)
        expect(item.correctIndex).toBeGreaterThanOrEqual(0)
        expect(item.correctIndex).toBeLessThan(item.options.length)
      }
    }
  })

  it('sin preguntas propias, el juego usa el banco del mapa elegido', () => {
    expect(questionsForGame(undefined, 'OCEAN')).toBe(QUESTIONS_BY_MAP.OCEAN)
    expect(questionsForGame([], 'PARAMO')).toBe(QUESTIONS_BY_MAP.PARAMO)
    expect(questionsForGame(undefined)).toBe(SUSTAINABLE_CITY_QUESTIONS)
  })

  it('las preguntas que escribe el docente siguen teniendo prioridad sobre el banco del mapa', () => {
    const own = [{ question: '¿Propia?', options: ['Sí', 'No'], correctIndex: 0 }]
    expect(questionsForGame(own, 'AMAZON')).toEqual(own)
  })
})

describe('pista del libro guía (issue #160)', () => {
  it('toda pregunta de un banco fijo indica capítulo y página del libro', () => {
    for (const name of MAZE_LAYOUT_IDS) {
      for (const item of QUESTIONS_BY_MAP[name]) {
        expect(item.book, item.question).toBeDefined()
        // El libro impreso va de la 1 a la 184 (el PDF trae 186 páginas).
        expect(Number.isInteger(item.book!.page), item.question).toBe(true)
        expect(item.book!.page).toBeGreaterThanOrEqual(1)
        expect(item.book!.page).toBeLessThanOrEqual(184)
        expect(item.book!.chapter.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('la página del visor del PDF es la impresa más 2', () => {
    expect(BOOK_PDF_OFFSET).toBe(2)
    expect(bookPdfPage({ page: 22, chapter: 'x' })).toBe(24)
    expect(BOOK_TITLE).toBe('Voces sobre Ciudades Sostenibles y Resilientes')
  })

  it('las preguntas del docente no necesitan la pista y se conservan tal cual', () => {
    const own = [{ question: '¿Propia?', options: ['Sí', 'No'], correctIndex: 0 }]
    expect(questionsForGame(own, 'OCEAN')[0].book).toBeUndefined()
  })
})
