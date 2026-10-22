export const SECRET_CIPHER = Symbol('SECRET_CIPHER');

/** Cifrado reversible de secretos (API keys de terceros) para guardarlos en base de datos. */
export interface SecretCipher {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
  /** `false` si falta la clave maestra: el panel lo avisa en vez de fallar al guardar. */
  isConfigured(): boolean;
  /**
   * ¿Este payload está cifrado con un formato o una clave que no es la
   * vigente? Sirve para re-cifrar tras rotar la clave maestra.
   */
  needsReencryption(payload: string): boolean;
}
