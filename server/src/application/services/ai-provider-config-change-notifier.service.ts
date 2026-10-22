import { Injectable } from '@nestjs/common';

/**
 * Aviso de "la configuración de proveedores de IA cambió". Los casos de uso
 * de administración lo disparan y quien tenga la cadena de proveedores en
 * caché (ver `ConfiguredAiContentAssistant`) se suscribe para recargarla al
 * instante, sin que la capa de aplicación conozca la infraestructura.
 */
@Injectable()
export class AiProviderConfigChangeNotifier {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): void {
    this.listeners.add(listener);
  }

  notify(): void {
    for (const listener of this.listeners) listener();
  }
}
