/** Nombres legibles de los agentes (mismos que el catálogo del servidor). */
const AGENT_NAME: Record<string, string> = {
  GAME_PLAYER: 'Agente Jugador',
  GAME_CONFIGURATOR: 'Agente Configurador',
}

const OPERATION_LABEL: Record<string, string> = {
  describeImage: 'Describir imagen',
  generateGameDraft: 'Generar borrador de juego',
  // `complete` lo usa cualquier agente: qué agente fue lo dice la columna "Agente".
  complete: 'Consulta de texto',
}

/** Agente de una llamada del historial. Las filas viejas (sin agente guardado) muestran un guion. */
export function agentLabel(agent: string | null | undefined): string {
  if (!agent) return '—'
  return AGENT_NAME[agent] ?? agent
}

export function operationLabel(operation: string): string {
  return OPERATION_LABEL[operation] ?? operation
}
