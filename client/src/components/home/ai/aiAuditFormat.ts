import type { AiAuditEntry } from '../../../services/ai-audit.service'

const ACTION_LABEL: Record<string, string> = {
  'provider.create': 'Creó el proveedor',
  'provider.update': 'Editó el proveedor',
  'provider.delete': 'Eliminó el proveedor',
  'provider.enable': 'Habilitó el proveedor',
  'provider.disable': 'Deshabilitó el proveedor',
  'provider.reorder': 'Reordenó los proveedores',
  'provider.rotate-key': 'Cambió la API key del proveedor',
  'provider.reencrypt': 'Re-cifró las API keys con la clave vigente',
  'agent.update': 'Editó el agente',
  'agent.reset': 'Restauró de fábrica el agente',
}

const FIELD_LABEL: Record<string, string> = {
  name: 'nombre',
  kind: 'tipo',
  baseUrl: 'URL base',
  textModel: 'modelo de texto',
  visionModel: 'modelo de visión',
  maxRpm: 'llamadas por minuto',
  enabled: 'habilitado',
  instructions: 'instrucciones',
  providerId: 'proveedor',
  modelOverride: 'modelo',
  fallbackToDefault: 'respaldo en la cadena general',
}

/** Qué hizo, en lenguaje de persona (acciones desconocidas se muestran tal cual). */
export function auditActionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action
}

/** Detalle corto y legible: campos cambiados, o el sufijo de la key rotada. Nunca una key. */
export function auditDetailSummary(entry: Pick<AiAuditEntry, 'details'>): string {
  const { details } = entry
  const parts: string[] = []

  const changed = details.changedFields
  if (Array.isArray(changed) && changed.length > 0) {
    parts.push(`Campos: ${changed.map((field) => FIELD_LABEL[String(field)] ?? String(field)).join(', ')}`)
  }
  if (details.apiKeyRotated === true) {
    parts.push(typeof details.apiKeyHint === 'string' ? `Nueva key ${details.apiKeyHint}` : 'Key rotada')
  }
  const order = details.order
  if (Array.isArray(order) && order.length > 0) parts.push(`Orden: ${order.join(' → ')}`)
  if (typeof details.migrated === 'number') {
    parts.push(`${details.migrated} re-cifrada(s), ${typeof details.failed === 'number' ? details.failed : 0} con error`)
  }

  return parts.join(' · ') || '—'
}

export function auditTargetLabel(entry: Pick<AiAuditEntry, 'targetType' | 'targetLabel'>): string {
  return `${entry.targetType === 'agent' ? 'Agente' : 'Proveedor'}: ${entry.targetLabel}`
}
