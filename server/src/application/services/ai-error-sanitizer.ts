const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)\]]+/gi;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g;
// IPv6 (completas o comprimidas); exige al menos dos ":" y un grupo hex para no tocar horas como 10:30.
const IPV6_PATTERN = /(?<![\w:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![\w:])/gi;
const MAX_LENGTH = 200;

/**
 * Los mensajes de error de un proveedor de IA terminan en el panel (historial,
 * "Probar"). Pueden traer la URL consultada o IPs internas (lo que ayudaría a
 * mapear la red desde el panel), así que se quitan URLs e IPs y se recorta.
 */
export function sanitizeProviderMessage(message: string, maxLength = MAX_LENGTH): string {
  const cleaned = message
    .replace(URL_PATTERN, '[url]')
    .replace(IPV4_PATTERN, '[ip]')
    .replace(IPV6_PATTERN, (match) => (/[0-9a-f]/i.test(match) || match.includes('::') ? '[ip]' : match))
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}
