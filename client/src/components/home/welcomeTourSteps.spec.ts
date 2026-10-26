import { describe, expect, it } from 'vitest'
import { getWelcomeSteps, initialWelcomePhase, phaseAfterGreeting } from './welcomeTourSteps'

describe('initialWelcomePhase', () => {
  it('saluda al entrar al inicio, sea la cuenta nueva o antigua, si aún no ha saludado en esta sesión', () => {
    expect(initialWelcomePhase(true, false, false)).toBe('greeting')
    expect(initialWelcomePhase(true, true, false)).toBe('greeting')
  })

  it('no repite el saludo si ya saludó en esta sesión (navegación interna, no recarga)', () => {
    expect(initialWelcomePhase(true, true, true)).toBe('closed')
    expect(initialWelcomePhase(true, false, true)).toBe('invite')
  })

  it('no interrumpe enlaces fuera del inicio: solo queda la invitación de la primera vez', () => {
    expect(initialWelcomePhase(false, true, false)).toBe('closed')
    expect(initialWelcomePhase(false, false, false)).toBe('invite')
    expect(initialWelcomePhase(false, false, true)).toBe('invite')
  })
})

describe('phaseAfterGreeting', () => {
  it('quien ya hizo la guía vuelve directo al inicio', () => {
    expect(phaseAfterGreeting(true)).toBe('closed')
  })

  it('quien nunca la hizo sigue viendo la invitación obligatoria de siempre', () => {
    expect(phaseAfterGreeting(false)).toBe('invite')
  })
})

describe('getWelcomeSteps (recorrido interactivo)', () => {
  const all = [
    getWelcomeSteps('TEACHER', false),
    getWelcomeSteps('ADMIN', false, { canAccessOrganization: true }),
    getWelcomeSteps('STUDENT', false),
    getWelcomeSteps('STUDENT', true),
  ]

  it('cada paso que se hace dice qué hacer; los de solo mirar no piden nada', () => {
    for (const steps of all) {
      for (const step of steps) {
        if (step.kind === 'look') expect(step.task).toBeUndefined()
        else expect(step.task, step.title).toBeTruthy()
      }
    }
  })

  it('los pasos que llevan a otra página explican esa página en la barra de volver', () => {
    const teacher = getWelcomeSteps('TEACHER', false)
    for (const target of ['create', 'nav-subjects', 'nav-classes', 'nav-community', 'nav-own-games']) {
      expect(teacher.find((step) => step.target === target)?.away, target).toBeTruthy()
    }
  })

  it('en Kids siempre está el paso de Volver a los mundos (el primer paso hace entrar a uno)', () => {
    expect(getWelcomeSteps('STUDENT', true).map((step) => step.target)).toEqual(['worlds', 'worlds', 'worlds-back', 'profile'])
  })
})
