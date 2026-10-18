import { DomainError } from './user.errors.js';

export class InvalidSubjectNameError extends DomainError {
  constructor(reason: string) {
    super(`Nombre de Ã¡rea inválido: ${reason}`);
  }
}

export class InvalidSubjectStatusError extends DomainError {
  constructor(value: string) {
    super(`El estado de Ã¡rea "${value}" no es válido.`);
  }
}

export class InvalidSubjectStateError extends DomainError {
  constructor(reason: string) {
    super(`Operación inválida sobre el Ã¡rea: ${reason}`);
  }
}

/** El árbol del Ã¡rea (ella o alguna sub-Ã¡rea descendiente) tiene juegos asociados. */
export class SubjectHasGamesError extends DomainError {
  constructor() {
    super('No se puede eliminar el Ã¡rea: ella o alguna de sus sub-Ã¡reas tiene juegos asociados.');
  }
}
