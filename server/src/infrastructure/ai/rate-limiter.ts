const DEFAULT_WINDOW_MS = 60_000;

/**
 * Throttle genérico de "máximo N llamadas por minuto", leído de una variable
 * de entorno con default de respaldo. Extraído de `GeminiContentAssistant`
 * (issue #204, fallback de proveedores de IA) para que un adaptador nuevo
 * (Groq, o el que se agregue después) no tenga que reescribir esta lógica —
 * cada proveedor solo instancia `new RateLimiter('SU_ENV_VAR', limiteDefault)`.
 */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    /** `null` = límite fijo, sin leer del entorno (configuración guardada en base de datos). */
    private readonly envVarName: string | null,
    private readonly defaultLimit: number,
    private readonly windowMs = DEFAULT_WINDOW_MS,
  ) {}

  async throttle(): Promise<void> {
    const limitRaw = this.envVarName ? Number(process.env[this.envVarName]) : Number.NaN;
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : this.defaultLimit;

    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < this.windowMs);
      if (this.timestamps.length < limit) {
        this.timestamps.push(now);
        return;
      }
      const waitMs = this.windowMs - (now - this.timestamps[0]) + 250;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
