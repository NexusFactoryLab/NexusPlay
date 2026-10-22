import { describe, expect, it } from 'vitest'
import { agentLabel, operationLabel } from './aiLogFormat'

describe('aiLogFormat', () => {
  it('muestra el nombre legible del agente', () => {
    expect(agentLabel('GAME_PLAYER')).toBe('Agente Jugador')
    expect(agentLabel('GAME_CONFIGURATOR')).toBe('Agente Configurador')
  })

  it('las filas viejas (null) y las vacías muestran un guion; un agente desconocido, su clave', () => {
    expect(agentLabel(null)).toBe('—')
    expect(agentLabel(undefined)).toBe('—')
    expect(agentLabel('')).toBe('—')
    expect(agentLabel('FUTURO')).toBe('FUTURO')
  })

  it('la operación complete ya no se atribuye al agente Jugador', () => {
    expect(operationLabel('complete')).toBe('Consulta de texto')
    expect(operationLabel('describeImage')).toBe('Describir imagen')
    expect(operationLabel('otra')).toBe('otra')
  })
})
