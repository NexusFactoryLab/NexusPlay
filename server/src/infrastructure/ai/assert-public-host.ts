import { lookup } from 'node:dns/promises';
import { allowPrivateProviderUrls, isPrivateHostname, isPrivateIp } from '../../application/services/ai-url-safety.js';

/** La URL de un proveedor resuelve a una dirección interna (o es una interna): no se le debe llamar. */
export class PrivateProviderHostError extends Error {
  constructor() {
    super('la dirección del proveedor apunta a una red interna.');
  }
}

export type HostResolver = (hostname: string) => Promise<string[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true });
  return records.map((record) => record.address);
};

/**
 * Anti DNS-rebinding: aunque el nombre de host parezca público al guardarlo,
 * su DNS puede apuntar luego a una IP interna. Se resuelve justo antes de
 * llamar y, si CUALQUIERA de las direcciones es privada, se rechaza.
 *
 * Si el DNS no resuelve, no se bloquea: la llamada fallará sola con su error
 * de red. Límite conocido: entre esta comprobación y la conexión real el DNS
 * podría cambiar; cerrarlo del todo exige fijar la IP en el socket.
 */
export async function assertPublicHost(
  url: string,
  resolver: HostResolver = defaultResolver,
  allowPrivate: boolean = allowPrivateProviderUrls(),
): Promise<void> {
  if (allowPrivate) return;

  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (isPrivateHostname(hostname)) throw new PrivateProviderHostError();

  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    return;
  }
  if (addresses.some((address) => isPrivateIp(address))) throw new PrivateProviderHostError();
}
