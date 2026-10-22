export const AI_AUDIT_ACTIONS = [
  'provider.create',
  'provider.update',
  'provider.delete',
  'provider.enable',
  'provider.disable',
  'provider.reorder',
  'provider.rotate-key',
  'provider.reencrypt',
  'agent.update',
  'agent.reset',
] as const;
export type AiAuditAction = (typeof AI_AUDIT_ACTIONS)[number];

export type AiAuditTargetType = 'provider' | 'agent';

export interface AiAuditLogProps {
  id: string;
  actorUserId: string;
  /** Copia del nombre al momento del cambio: el registro sigue legible aunque el usuario cambie o se borre. */
  actorName: string;
  action: AiAuditAction;
  targetType: AiAuditTargetType;
  targetId: string;
  /** Nombre legible del proveedor/agente al momento del cambio (el proveedor puede haberse borrado después). */
  targetLabel: string;
  /**
   * Solo NOMBRES de campos cambiados y valores no sensibles. Nunca una API
   * key, ni en claro ni cifrada (ver `AiAuditLogger`).
   */
  details: Record<string, unknown>;
  createdAt: Date;
}

/** Registro inmutable de un cambio hecho desde el panel de administración de IA. */
export class AiAuditLog {
  private constructor(private readonly props: AiAuditLogProps) {}

  static create(props: Omit<AiAuditLogProps, 'id' | 'createdAt'>): AiAuditLog {
    return new AiAuditLog({ ...props, id: crypto.randomUUID(), createdAt: new Date() });
  }

  static fromPersistence(props: AiAuditLogProps): AiAuditLog {
    return new AiAuditLog(props);
  }

  toProps(): AiAuditLogProps {
    return { ...this.props };
  }

  get id(): string { return this.props.id; }
  get actorUserId(): string { return this.props.actorUserId; }
  get actorName(): string { return this.props.actorName; }
  get action(): AiAuditAction { return this.props.action; }
  get targetType(): AiAuditTargetType { return this.props.targetType; }
  get targetId(): string { return this.props.targetId; }
  get targetLabel(): string { return this.props.targetLabel; }
  get details(): Record<string, unknown> { return this.props.details; }
  get createdAt(): Date { return this.props.createdAt; }
}
