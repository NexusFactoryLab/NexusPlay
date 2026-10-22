import { isIP } from 'node:net';

/**
 * Defensa contra SSRF en las URLs de proveedores de IA: un administrador
 * (o una cuenta de administrador comprometida) no debe poder hacer que el
 * servidor consulte la red interna, el endpoint de metadatos de la nube u
 * otros servicios que no son un proveedor de IA público.
 */

/** `true` solo con `AI_ALLOW_PRIVATE_PROVIDER_URLS=true`: para Ollama / LM Studio en la misma máquina o red. */
export function allowPrivateProviderUrls(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AI_ALLOW_PRIVATE_PROVIDER_URLS?.trim().toLowerCase() === 'true';
}

export function parseIPv4(value: string): number[] | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isPrivateIPv4(octets: number[]): boolean {
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8 (incluye 0.0.0.0)
    a === 10 || // 10/8
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local y metadatos de nube (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) || // 192.168/16
    (a === 100 && b >= 64 && b <= 127) // CGNAT 100.64/10
  );
}

/** Los 16 bytes de una IPv6 (acepta `::` y un IPv4 incrustado al final). */
export function parseIPv6(value: string): number[] | null {
  if (isIP(value) !== 6) return null;
  let text = value;

  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    text = `${text.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  let groups: string[];
  if (text.includes('::')) {
    const [head, rest] = text.split('::');
    const headGroups = head ? head.split(':') : [];
    const restGroups = rest ? rest.split(':') : [];
    const missing = 8 - headGroups.length - restGroups.length;
    if (missing < 0) return null;
    groups = [...headGroups, ...Array<string>(missing).fill('0'), ...restGroups];
  } else {
    groups = text.split(':');
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    const word = parseInt(group, 16);
    if (Number.isNaN(word) || word < 0 || word > 0xffff) return null;
    bytes.push(word >> 8, word & 0xff);
  }
  return bytes;
}

function isPrivateIPv6(bytes: number[]): boolean {
  const firstTenZero = bytes.slice(0, 10).every((byte) => byte === 0);
  const v4Tail = bytes.slice(12);
  // ::, ::1 y "IPv4 compatible" (::a.b.c.d): el 0/8 de IPv4 ya es privado.
  if (firstTenZero && bytes[10] === 0 && bytes[11] === 0) return isPrivateIPv4(v4Tail);
  // IPv4 mapeada (::ffff:a.b.c.d): vale lo que valga la IPv4.
  if (firstTenZero && bytes[10] === 0xff && bytes[11] === 0xff) return isPrivateIPv4(v4Tail);
  // NAT64 (64:ff9b::/96) con una IPv4 privada dentro.
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && bytes.slice(4, 12).every((b) => b === 0)) {
    return isPrivateIPv4(v4Tail);
  }
  if ((bytes[0] & 0xfe) === 0xfc) return true; // fc00::/7 (ULA)
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // fe80::/10 (link-local)
  return false;
}

/** ¿Es esta dirección IP (v4 o v6) privada, de loopback, link-local o de metadatos? Texto que no es IP: `false`. */
export function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, '');
  const version = isIP(clean);
  if (version === 4) {
    const octets = parseIPv4(clean);
    return octets ? isPrivateIPv4(octets) : false;
  }
  if (version === 6) {
    const bytes = parseIPv6(clean);
    return bytes ? isPrivateIPv6(bytes) : false;
  }
  return false;
}

/** ¿El nombre de host (o IP literal) es interno? No resuelve DNS: eso lo hace la capa de infraestructura. */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return true;
  }
  return isPrivateIp(host);
}
