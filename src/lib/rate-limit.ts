type Bucket = { count: number; resetAt: number };

// En globalThis y no a nivel de módulo: Next puede cargar este archivo más
// de una vez en el mismo proceso (p. ej. una copia por ruta), y entonces el
// login y /admin/usuarios verían contadores distintos — resetRateLimit()
// desde el alta de usuarios no desbloquearía el del login.
const store = globalThis as typeof globalThis & { __rateLimitBuckets?: Map<string, Bucket> };
const buckets = store.__rateLimitBuckets ?? new Map<string, Bucket>();
if (!store.__rateLimitBuckets) {
  store.__rateLimitBuckets = buckets;
  // Limpieza periódica para no acumular entradas viejas en memoria.
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 5 * 60 * 1000).unref();
}

/**
 * Limitador en memoria simple. Suficiente para ~20 usuarios en un solo
 * proceso Node; no sirve para despliegues multi-instancia.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/** Olvida un contador (p. ej. al dar de alta un correo que se había bloqueado intentando entrar antes de existir). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Clave del límite de enlaces mágicos por correo — compartida por el login y el alta de usuarios. */
export function loginEmailRateKey(email: string): string {
  return `login:email:${email.trim().toLowerCase()}`;
}

/**
 * IP del cliente detrás de Cloudflare Tunnel: Cloudflare pone la IP real en
 * cf-connecting-ip (y la sobreescribe si el cliente intenta mandarla). Si
 * faltara, todos caerían en "unknown" y compartirían un solo contador.
 */
export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
