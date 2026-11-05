import { createHash } from 'node:crypto';

/**
 * Texto vigente del acuerdo de confidencialidad y autorización de tratamiento de datos que firma quien entra
 * a un torneo por QR. ES EL ÚNICO LUGAR donde vive el texto: el cliente lo descarga del servidor y la firma
 * guarda la versión y el hash SHA-256 de lo que se mostró.
 *
 * PROPUESTA TÉCNICA: debe ser revisada por un abogado antes de producción. Cada cambio de contenido exige subir
 * `TOURNAMENT_AGREEMENT_VERSION` (ver la sección "Acuerdo de confidencialidad" del README de games).
 */
export const TOURNAMENT_AGREEMENT_VERSION = '2026-11-05.1';

/** TODO(legal): datos que NO se inventan; se completan con los reales antes de producción (y se sube la versión). */
export const AGREEMENT_CONFIG = {
  responsibleNames: 'Juan Camilo Pardo Martínez y Juan Sebastián López Hernández',
  responsibleId: '[POR DEFINIR: cédula/NIT y razón social del responsable]',
  responsibleAddress: '[POR DEFINIR: domicilio del responsable]',
  contactEmail: '[POR DEFINIR: correo para consultas, reclamos y ejercicio de derechos]',
  /** TODO(legal): plazo de conservación de la firma y de sus datos de evidencia. */
  retentionPeriod: '[POR DEFINIR: plazo de conservación]',
  /** TODO(legal): vigencia de la obligación de confidencialidad tras terminar la fase de prueba. */
  confidentialityTerm: '[POR DEFINIR: plazo de vigencia de la confidencialidad]',
  /** TODO(legal): consecuencias por incumplimiento; no se fijan penalidades monetarias sin definición legal. */
  breachConsequences: '[POR DEFINIR por el abogado: consecuencias y acciones por incumplimiento]',
} as const;

export interface AgreementSection {
  id: string;
  title: string;
  paragraphs: string[];
}

const c = AGREEMENT_CONFIG;

export const TOURNAMENT_AGREEMENT_SECTIONS: readonly AgreementSection[] = [
  {
    id: 'objeto',
    title: '1. Objeto y fase de prueba',
    paragraphs: [
      'NexusPlay se encuentra en FASE DE PRUEBA (beta cerrada). Al entrar a este torneo usted participa como probador y se obliga a lo que dispone este acuerdo.',
      'Este documento se firma electrónicamente (Ley 527 de 1999 y Decreto 2364 de 2012, firma electrónica simple) y reúne dos manifestaciones separadas: (a) el acuerdo de confidencialidad y reserva de derechos, y (b) la autorización para tratar sus datos personales.',
    ],
  },
  {
    id: 'responsable',
    title: '2. Responsable del tratamiento',
    paragraphs: [
      `Responsables y representantes de NexusPlay: ${c.responsibleNames}. Identificación: ${c.responsibleId}. Domicilio: ${c.responsibleAddress}. Contacto: ${c.contactEmail}.`,
    ],
  },
  {
    id: 'confidencialidad',
    title: '3. Confidencialidad y no divulgación',
    paragraphs: [
      'Usted se compromete a no divulgar, contar, publicar ni compartir con terceros nada de la plataforma: funcionalidades, juegos, contenido, diseño, código, marca, preguntas, respuestas, resultados, ni información de otros participantes del torneo, incluidas capturas de pantalla y grabaciones.',
      'Se prohíbe la ingeniería inversa, el scraping, la extracción automatizada de contenido y la publicación de capturas o grabaciones.',
      `Vigencia de la confidencialidad: ${c.confidentialityTerm}.`,
    ],
  },
  {
    id: 'propiedad',
    title: '4. Propiedad intelectual y reserva total de derechos',
    paragraphs: [
      'Todos los derechos sobre NexusPlay quedan reservados por completo a NexusPlay (derechos de autor: Ley 23 de 1982, Decisión Andina 351 de 1993 y Ley 1915 de 2018; marcas y signos distintivos: Decisión Andina 486 de 2000).',
      'Este acuerdo no cede ni licencia a usted derecho alguno sobre la plataforma, más allá del uso personal, limitado y revocable necesario para probarla.',
      'Los comentarios, sugerencias o ideas (feedback) que usted entregue pasan a ser de NexusPlay, que podrá usarlos sin compensación ni atribución.',
    ],
  },
  {
    id: 'incumplimiento',
    title: '5. Incumplimiento',
    paragraphs: [
      `El incumplimiento podrá dar lugar a la exclusión del torneo y de la fase de prueba, y a las acciones legales que correspondan. ${c.breachConsequences}`,
    ],
  },
  {
    id: 'datos-finalidad',
    title: '6. Autorización de tratamiento de datos personales',
    paragraphs: [
      'Conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y las demás normas de protección de datos de Colombia, usted autoriza de manera previa, expresa e informada el tratamiento de los datos que entrega aquí: nombre completo, fecha de nacimiento, documento de identidad (opcional), correo (opcional), la firma y los datos de evidencia.',
      'Finalidades: (i) acreditar que usted aceptó este acuerdo, quién lo hizo y cuándo; (ii) administrar el acceso al torneo; (iii) atender reclamos y requerimientos de autoridad. No se usan para publicidad ni se venden.',
      'Datos de evidencia: al firmar se registran la fecha y hora (UTC), la dirección IP y el agente de usuario del navegador, únicamente como prueba de la firma. No se piden datos sensibles; el documento y el correo son facultativos.',
    ],
  },
  {
    id: 'menores',
    title: '7. Niños, niñas y adolescentes',
    paragraphs: [
      'Según el artículo 7 de la Ley 1581 de 2012, el tratamiento de datos de menores de 18 años exige la autorización de su representante legal y debe respetar su interés superior y sus derechos fundamentales. Si usted es menor de 18 años, debe indicar los datos de su representante legal y este debe aceptar expresamente; sin esa autorización no se puede entrar al torneo.',
    ],
  },
  {
    id: 'derechos',
    title: '8. Derechos del titular',
    paragraphs: [
      `Usted puede conocer, actualizar y rectificar sus datos, solicitar prueba de la autorización, ser informado del uso, presentar quejas ante la Superintendencia de Industria y Comercio (SIC), revocar la autorización y solicitar la supresión cuando proceda, escribiendo a ${c.contactEmail}. La revocatoria o supresión no procede mientras exista un deber legal o contractual de conservar la prueba de la firma.`,
    ],
  },
  {
    id: 'conservacion',
    title: '9. Conservación, transmisión y política de tratamiento',
    paragraphs: [
      `La firma se conserva de forma inmodificable como mensaje de datos (Ley 527 de 1999) durante ${c.retentionPeriod}.`,
      'Los datos pueden ser transmitidos a proveedores de infraestructura (alojamiento y bases de datos) que actúan como encargados bajo nuestras instrucciones. La Política de Privacidad completa está disponible en la plataforma.',
    ],
  },
  {
    id: 'imagen',
    title: '10. Uso de imagen',
    paragraphs: [
      'Este acuerdo no autoriza el uso de su imagen o voz. Si en el futuro se requiere, se pedirá una autorización aparte.',
    ],
  },
];

/** Texto plano canónico (lo que se hashea); cualquier cambio de redacción cambia el hash. */
export function renderAgreementText(sections: readonly AgreementSection[] = TOURNAMENT_AGREEMENT_SECTIONS): string {
  return sections.map((s) => [s.title, ...s.paragraphs].join('\n')).join('\n\n');
}

export function hashAgreementText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export const TOURNAMENT_AGREEMENT_TEXT = renderAgreementText();
export const TOURNAMENT_AGREEMENT_HASH = hashAgreementText(TOURNAMENT_AGREEMENT_TEXT);

export const ADULT_AGE_YEARS = 18;

/** Edad cumplida en `now` (UTC). */
export function ageInYears(birthDate: Date, now: Date): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}
