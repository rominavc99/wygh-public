/**
 * Se corre una sola vez cuando arranca el proceso de Next.js (ver docs de
 * Next: "instrumentation.js"). El import dinámico dentro de la rama
 * "nodejs" (en vez de un `import` normal arriba del archivo) es a
 * propósito: así el analizador de Turbopack no intenta incluir código de
 * Node (fs, path) en el bundle del Edge Runtime, que no lo soporta.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateOldResponsePhotos } = await import("./lib/migrate-response-photos");
    await migrateOldResponsePhotos();
  }
}
