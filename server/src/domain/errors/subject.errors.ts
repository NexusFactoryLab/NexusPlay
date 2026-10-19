import { DomainError } from './user.errors.js';

export class InvalidSubjectNameError extends DomainError {
  constructor(reason: string) {
    super(`Nombre de área inválido: ${reason}`);
  }
}

export class InvalidSubjectStatusError extends DomainError {
  constructor(value: string) {
    super(`El estado de área "${value}" no es válido.`);
  }
}

export class InvalidSubjectStateError extends DomainError {
  constructor(reason: string) {
    super(`Operación inválida sobre el área: ${reason}`);
  }
}

/** El árbol del área (ella o alguna sub-área descendiente) tiene juegos asociados. */
export class SubjectHasGamesError extends DomainError {
  constructor() {
    super('No se puede eliminar el área: ella o alguna de sus sub-áreas tiene juegos asociados.');
  }
}
