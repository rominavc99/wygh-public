import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

// "IMG/respuestas/<archivo>" es el nombre LÓGICO que se guarda en la base
// (Response.photoFilename, HeroPhoto.filename) y con el que se arman las
// URLs (/IMG/respuestas/<archivo>, atendida por
// src/app/IMG/respuestas/[filename]/route.ts) — pero el archivo en sí NO
// vive dentro de public/. Next.js registra como estáticos, al momento del
// build, cualquier archivo que ya esté en public/, y esos SIEMPRE le ganan
// en prioridad a una ruta de la app — así que si esta foto llegara a
// existir bajo public/, cada deploy la "reconocería" como estática de
// nuevo y se serviría sin pasar por la ruta (que es la que exige sesión
// iniciada), sin importar el chequeo de ahí. Por eso el archivo real vive
// en data/uploads/respuestas (fuera de public/, ya cubierto por
// /data/ en .gitignore) y la ruta lo lee de ahí en cada request.
export const RESPONSE_PHOTOS_DIR = "IMG/respuestas";

const STORAGE_DIR = path.join(process.cwd(), "data", "uploads", "respuestas");

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 5 * 1024 * 1024;

/** El nombre lógico ("IMG/respuestas/x.jpg") a la ruta real en disco. */
export function diskPathFor(filename: string): string {
  return path.join(STORAGE_DIR, path.basename(filename));
}

/**
 * Foto que llega del formulario diario como texto base64 (campos photoData
 * + photoType), no como archivo: el WAF de Cloudflare bloqueaba con un 403
 * algunas fotos subidas como binario (multipart) — ciertos bytes de la
 * imagen coinciden por casualidad con firmas de ataque. En base64 solo hay
 * letras, números, "+", "/" y "=", así que eso ya no puede pasar. El
 * navegador además la reduce antes de mandarla (ver
 * src/lib/prepare-photo.ts).
 */
export type IncomingPhoto = { buffer: Buffer; type: string };

/** Decodifica photoData/photoType del FormData. null si no viene foto nueva. */
export function photoFromFormData(formData: FormData): IncomingPhoto | null {
  const data = formData.get("photoData");
  const type = formData.get("photoType");
  if (typeof data !== "string" || !data || typeof type !== "string") return null;
  return { buffer: Buffer.from(data, "base64"), type };
}

/** Valida tipo, tamaño y que de verdad sea una imagen; devuelve un mensaje de error o null si es válida. */
export async function validatePhoto(photo: IncomingPhoto): Promise<string | null> {
  if (!ALLOWED_TYPES[photo.type]) {
    return "Formato de imagen no soportado (usa JPG, PNG, WEBP o GIF).";
  }
  if (photo.buffer.length === 0 || photo.buffer.length > MAX_BYTES) {
    return "La foto no puede pesar más de 5 MB.";
  }
  try {
    const meta = await sharp(photo.buffer).metadata();
    if (!meta.width || !meta.height) throw new Error("sin dimensiones");
  } catch {
    return "No pudimos leer esa imagen. Intenta con otra foto.";
  }
  return null;
}

/** Escribe la foto a data/uploads/respuestas y devuelve el nombre lógico. */
export async function saveResponsePhoto(userId: string, date: string, photo: IncomingPhoto): Promise<string> {
  const ext = ALLOWED_TYPES[photo.type];
  const filename = `${RESPONSE_PHOTOS_DIR}/${date}-${userId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const fullPath = diskPathFor(filename);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, photo.buffer);
  return filename;
}

/** Unlink best-effort — no falla si el archivo ya no existe. */
export async function deleteResponsePhotoFile(filename: string): Promise<void> {
  try {
    await fs.unlink(diskPathFor(filename));
  } catch {
    // Ya no estaba, no pasa nada.
  }
}

/**
 * Da de alta (o actualiza) la foto como HeroPhoto para que entre a la
 * rotación de portada del día correspondiente, ya con descripción — a
 * diferencia de las fotos que sincroniza syncHeroPhotos(), que nacen sin
 * descripción y el admin las completa a mano.
 */
export async function upsertHeroPhotoForResponse(
  filename: string,
  description: string,
  date: string,
  authorId: string
): Promise<void> {
  await prisma.heroPhoto.upsert({
    where: { filename },
    create: { filename, description, date, authorId },
    update: { description, date, authorId },
  });
}

/** Borra el archivo y su fila HeroPhoto asociada (al reemplazar o quitar una foto). */
export async function deleteResponsePhotoAndHeroRow(filename: string): Promise<void> {
  await deleteResponsePhotoFile(filename);
  await prisma.heroPhoto.deleteMany({ where: { filename } }).catch(() => {});
}
