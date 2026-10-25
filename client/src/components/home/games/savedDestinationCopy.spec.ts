import { describe, expect, it } from 'vitest'
import { savedDestinationCopy } from './createdGameSummary'

describe('savedDestinationCopy (issue #2)', () => {
  it('usa "juego" para estudiante y "actividad" para el resto de roles', () => {
    expect(savedDestinationCopy('STUDENT', 'private').heading).toBe('Juego guardado en Mis juegos')
    expect(savedDestinationCopy('teacher', 'community').heading).toBe('Actividad guardada en Comunidad')
    expect(savedDestinationCopy('ADMIN', 'private').heading).toBe('Actividad guardada en Mis juegos')
  })

  it('todos los roles ven "Mis juegos" como destino privado, igual que el menú', () => {
    expect(savedDestinationCopy('TEACHER', 'private').destination).toBe('Mis juegos')
    expect(savedDestinationCopy('STUDENT', 'private').destination).toBe('Mis juegos')
  })
})
