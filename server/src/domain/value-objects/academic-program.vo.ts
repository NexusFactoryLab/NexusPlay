import { InvalidAcademicProgramError } from '../errors/user.errors.js';

export const ACADEMIC_PROGRAM_MAX_LENGTH = 80;

/**
 * Letras (con tildes), números, espacios y la puntuación que aparece en
 * nombres de programas reales: «Ingeniería de Sistemas», «11°», «Lic. en
 * Música», «Contaduría (nocturna)», «Diseño & Artes», «Grado 9-B». Deja fuera
 * `<`, `>`, comillas dobles, llaves y cualquier otro símbolo: el texto se
 * muestra en una página pública y no necesita marcado.
 */
const ALLOWED = /^[\p{L}\p{M}\p{N} .,'’()&/°º+#:-]+$/u;
// Caracteres de control (saltos de línea, tabuladores): se vuelven espacio.
const CONTROL = /\p{Cc}/gu;
// Caracteres de formato invisibles (p. ej. U+200B, o U+202E, que invierte el
// texto al mostrarlo): se eliminan.
const INVISIBLE_FORMAT = /\p{Cf}/gu;

/**
 * Facultad, carrera o grado que una persona escribe en su perfil. Opcional:
 * vacío o solo espacios equivale a "no lo indicó" (null). Recorta los extremos,
 * quita caracteres invisibles y colapsa espacios repetidos antes de validar.
 */
export function normalizeAcademicProgram(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;

  const cleaned = raw
    .normalize('NFC')
    .replace(INVISIBLE_FORMAT, '')
    .replace(CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return null;

  if (cleaned.length > ACADEMIC_PROGRAM_MAX_LENGTH) {
    throw new InvalidAcademicProgramError(`no puede superar ${ACADEMIC_PROGRAM_MAX_LENGTH} caracteres.`);
  }
  if (!ALLOWED.test(cleaned)) {
    throw new InvalidAcademicProgramError('contiene caracteres no permitidos.');
  }
  return cleaned;
}
