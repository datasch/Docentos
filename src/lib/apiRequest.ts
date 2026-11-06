export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function retryDelayMs(error: unknown, failures: number, baseMs = 5000): number {
  if (error instanceof ApiRequestError && error.retryAfterSeconds) return Math.max(baseMs, error.retryAfterSeconds * 1000);
  return Math.min(60000, baseMs * 2 ** Math.min(Math.max(0, failures - 1), 4));
}

// No se repiten operaciones de escritura: un reintento podría duplicarlas.
export const apiRequest: typeof globalThis.fetch = async (input, init) => {
  const response = await globalThis.fetch(input, { ...init, credentials: 'include' });
  if (response.status === 429 || response.status === 503) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.code === 'RATE_LIMITED' || body.code === 'RATE_LIMIT_UNAVAILABLE') {
      const retry = Number(response.headers.get('Retry-After') || body.retryAfterSeconds);
      const seconds = Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : undefined;
      throw new ApiRequestError(
        response.status === 429
          ? `Espera un momento antes de reintentar.${seconds ? ` Podrás hacerlo en ${seconds} segundos.` : ''}`
          : 'El servicio está temporalmente ocupado. Inténtalo de nuevo en unos momentos.',
        response.status, seconds,
      );
    }
  }
  return response;
};
