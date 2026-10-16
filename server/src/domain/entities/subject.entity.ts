import { InvalidSubjectNameError, InvalidSubjectStateError } from '../errors/subject.errors.js';
import { SubjectStatus } from '../value-objects/subject-status.vo.js';

export interface SubjectProps {
  id: string;
  name: string;
  slug: string;
  /** `null` = Ã¡rea raíz del catálogo. Con valor = sub-Ã¡rea de esa Ã¡rea. */
  parentSubjectId: string | null;
  /** `null` solo en Ã¡reas raíz creadas por un admin sin registrar autoría individual. */
  creatorUserId: string | null;
  status: SubjectStatus;
  createdAt: Date;
}

export interface CreateSubjectProps {
  id: string;
  name: string;
  slug: string;
  parentSubjectId?: string | null;
  creatorUserId: string;
}

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 60;

/**
 * Ãrea raíz (`parentSubjectId: null`): solo la crea un ADMIN, nace pública
 * de una vez (es el esqueleto fijo del catálogo, no contenido de un usuario).
 * Sub-Ã¡rea (`parentSubjectId` con valor): la crea cualquier profesor o
 * admin, nace PRIVATE. Pasar a PUBLIC es irreversible — no hay `unpublish`
 * una vez pública, porque otros usuarios pueden haber publicado juegos bajo
 * ella mientras tanto y quedarían huérfanos. Sí puede eliminarse siendo
 * PUBLIC, pero solo si su árbol completo (ella y sus descendientes, en
 * cualquier estado) sigue sin juegos asociados — ver `canBeDeletedBy`.
 */
export class Subject {
  private props: SubjectProps;

  private constructor(props: SubjectProps) {
    this.props = props;
  }

  static create(props: CreateSubjectProps): Subject {
    const name = props.name.trim();
    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      throw new InvalidSubjectNameError(
        `debe tener entre ${NAME_MIN_LENGTH} y ${NAME_MAX_LENGTH} caracteres.`,
      );
    }

    const parentSubjectId = props.parentSubjectId ?? null;

    return new Subject({
      id: props.id,
      name,
      slug: props.slug,
      parentSubjectId,
      creatorUserId: props.creatorUserId,
      // Un Ã¡rea raíz (sin parent) solo la crea un admin y nace ya pública;
      // una sub-Ã¡rea nace privada hasta que su dueño decida publicarla.
      status: parentSubjectId === null ? SubjectStatus.public_() : SubjectStatus.private_(),
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: SubjectProps): Subject {
    return new Subject(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get parentSubjectId(): string | null {
    return this.props.parentSubjectId;
  }

  get creatorUserId(): string | null {
    return this.props.creatorUserId;
  }

  get status(): SubjectStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isRoot(): boolean {
    return this.props.parentSubjectId === null;
  }

  /** El creador de la sub-Ã¡rea o un admin pueden publicarla; una raíz ya nace pública. */
  canBePublishedBy(requestingUserId: string, isAdmin: boolean): boolean {
    return isAdmin || this.props.creatorUserId === requestingUserId;
  }

  /**
   * `isEmpty` lo calcula el use-case recorriendo recursivamente el árbol
   * (ella y todas sus descendientes, en cualquier estado) contra el
   * repositorio de Game en Mongo — la entidad de dominio no puede consultar
   * Mongo directamente.
   *
   * - Ãrea raíz (`parentSubjectId === null`, siempre PUBLIC): solo un
   *   admin puede borrarla, y solo si el árbol está vacío. Nunca por
   *   "creador": la mayoría de raíces no tienen `creatorUserId`.
   * - Sub-Ã¡rea PRIVATE: regla histórica sin cambios — su creador o un
   *   admin, sin depender de si el árbol está vacío (una PRIVATE no puede
   *   tener descendientes con juegos publicados por otros usuarios).
   * - Sub-Ã¡rea PUBLIC: nueva excepción a la irreversibilidad de
   *   `publish()` — su creador o un admin pueden borrarla, pero SOLO si el
   *   árbol está vacío. Esto no reabre PUBLIC -> PRIVATE, es exclusivamente
   *   una condición de borrado.
   */
  canBeDeletedBy(requestingUserId: string, isAdmin: boolean, isEmpty: boolean): boolean {
    if (this.isRoot()) {
      return isAdmin && isEmpty;
    }

    const isOwnerOrAdmin = isAdmin || this.props.creatorUserId === requestingUserId;
    if (this.props.status.isPrivate()) {
      return isOwnerOrAdmin;
    }
    return isOwnerOrAdmin && isEmpty;
  }

  publish(): void {
    if (this.props.status.isPublic()) {
      throw new InvalidSubjectStateError('el Ã¡rea ya es pública.');
    }
    this.props.status = SubjectStatus.public_();
  }

  toPersistence(): SubjectProps {
    return { ...this.props };
  }
}
