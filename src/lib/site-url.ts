/** URL pública base de la app (para construir enlaces absolutos, ej. imágenes en correos). */
export function getSiteUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
