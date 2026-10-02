import fs from "node:fs/promises";
import path from "node:path";

/**
 * Migración de una sola vez: las fotos de respuestas (ver
 * src/lib/response-photos.ts) antes vivían dentro de public/IMG/respuestas
 * — resultó inseguro (un archivo bajo public/ siempre se sirve como
 * estático, sin pasar por el chequeo de sesión de la ruta que las
 * atiende), así que ahora se guardan en data/uploads/respuestas. Esto
 * mueve cualquier foto que haya quedado de antes de ese cambio. Inofensivo
 * correrlo de más: si el origen no existe o ya está vacío, no hace nada.
 */
export async function migrateOldResponsePhotos(): Promise<void> {
  const oldDir = path.join(process.cwd(), "public", "IMG", "respuestas");
  const newDir = path.join(process.cwd(), "data", "uploads", "respuestas");

  let files: string[] = [];
  try {
    files = await fs.readdir(oldDir);
  } catch {
    return; // no existía la carpeta vieja, nada que migrar
  }
  if (files.length === 0) return;

  await fs.mkdir(newDir, { recursive: true });
  for (const file of files) {
    try {
      await fs.rename(path.join(oldDir, file), path.join(newDir, file));
    } catch (error) {
      console.error(`[migrate-response-photos] No se pudo migrar ${file} fuera de public/:`, error);
    }
  }
  console.log(`[migrate-response-photos] Migradas ${files.length} foto(s) de respuestas fuera de public/.`);
}
