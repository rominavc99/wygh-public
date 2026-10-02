import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { pickStable } from "@/lib/pick";
import { displayName } from "@/lib/display-name";
import { previousLocalDate } from "@/lib/date";

const IMG_DIR = "IMG";
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function publicImgDir(): string {
  return path.join(process.cwd(), "public", IMG_DIR);
}

export type HeroPhotoRecord = {
  id: string;
  filename: string;
  description: string | null;
  date: string | null;
  authorName: string | null;
};

/**
 * Escanea public/IMG y sincroniza con la base de datos: agrega las fotos
 * nuevas que encuentre y quita los registros de fotos que ya no están en
 * el disco. Se llama automáticamente cada vez que hace falta la lista
 * (armar el boletín, cargar el panel de fotos), así que basta con soltar
 * archivos en la carpeta para que aparezcan.
 */
export async function syncHeroPhotos(): Promise<HeroPhotoRecord[]> {
  let files: string[] = [];
  try {
    const entries = await fs.readdir(publicImgDir());
    files = entries.filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()));
  } catch {
    files = [];
  }

  const filenames = files.map((f) => `${IMG_DIR}/${f}`);
  const existing = await prisma.heroPhoto.findMany();
  const existingFilenames = new Set(existing.map((p) => p.filename));

  // Las fotos subidas por usuarios viven en IMG/respuestas (ver
  // src/lib/response-photos.ts) y no aparecen en este escaneo plano de
  // IMG/ — hay que excluirlas del cálculo de huérfanos o este sync las
  // borraría cada vez que se arma el boletín.
  const isUserPhoto = (filename: string) => filename.startsWith(`${IMG_DIR}/respuestas/`);

  const toCreate = filenames.filter((f) => !existingFilenames.has(f));
  const toDelete = existing.filter((p) => !isUserPhoto(p.filename) && !filenames.includes(p.filename));

  if (toCreate.length) {
    await prisma.heroPhoto.createMany({ data: toCreate.map((filename) => ({ filename })) });
  }
  if (toDelete.length) {
    await prisma.heroPhoto.deleteMany({ where: { id: { in: toDelete.map((p) => p.id) } } });
  }

  const photos = await prisma.heroPhoto.findMany({
    orderBy: { filename: "asc" },
    include: { author: true },
  });
  return photos.map(toRecord);
}

export function toRecord(p: {
  id: string;
  filename: string;
  description: string | null;
  date: string | null;
  author: { name: string; username: string | null } | null;
}): HeroPhotoRecord {
  return {
    id: p.id,
    filename: p.filename,
    description: p.description,
    date: p.date,
    authorName: p.author ? displayName(p.author) : null,
  };
}

/** El `date` (fecha de origen) de la foto que quedó fija para el día anterior, si hay. */
async function previousPhotoDateTag(date: string): Promise<string | null> {
  const prevPick = await prisma.dailyPick.findUnique({
    where: { date: previousLocalDate(date) },
    include: { heroPhoto: true },
  });
  return prevPick?.heroPhoto?.date ?? null;
}

/** Elige una foto del pool, evitando (si se puede) las que compartan `excludeDateTag`. */
function poolExcluding(photos: HeroPhotoRecord[], excludeDateTag: string | null, excludeId?: string): HeroPhotoRecord[] {
  let pool = photos;
  if (excludeDateTag) {
    const filtered = pool.filter((p) => p.date !== excludeDateTag);
    if (filtered.length > 0) pool = filtered;
  }
  if (excludeId) {
    const filtered = pool.filter((p) => p.id !== excludeId);
    if (filtered.length > 0) pool = filtered;
  }
  return pool;
}

/**
 * Foto para el boletín de `date`. Por prioridad:
 * 1. Elegida a mano por el admin para este día (ver setManualHeroPhoto).
 * 2. La que ya haya quedado fija para este día (resolución automática
 *    previa o re-rolada, ver rerollHeroPhoto) — se respeta aunque después
 *    del primer resuelto aparezca una foto nueva "programada" para hoy
 *    (p. ej. alguien sube una foto en su respuesta ya entrado el día): la
 *    portada no debe cambiar sola a media tarde.
 * 3. Programada: una foto con `date` igual al día del boletín — solo
 *    aplica si todavía no había quedado nada fijo (primera resolución del
 *    día).
 * 4. Nueva selección automática — evitando, si se puede, fotos cuyo `date`
 *    de origen sea el mismo que el de la foto usada el día anterior (para
 *    no repetir fotos del mismo evento dos días seguidos) — y se deja fija
 *    en DailyPick para que la vista previa y el envío real coincidan.
 */
export async function resolveHeroPhotoForDate(
  date: string,
  photos: HeroPhotoRecord[]
): Promise<HeroPhotoRecord | null> {
  if (photos.length === 0) return null;

  const pick = await prisma.dailyPick.findUnique({ where: { date } });

  if (pick?.heroPhotoManual && pick.heroPhotoId) {
    const chosen = photos.find((p) => p.id === pick.heroPhotoId);
    if (chosen) return chosen;
  }

  if (pick?.heroPhotoId) {
    const cached = photos.find((p) => p.id === pick.heroPhotoId);
    if (cached) return cached;
  }

  const scheduled = photos.find((p) => p.date === date);
  if (scheduled) {
    await prisma.dailyPick.upsert({
      where: { date },
      create: { date, heroPhotoId: scheduled.id },
      update: { heroPhotoId: scheduled.id, heroPhotoManual: false },
    });
    return scheduled;
  }

  const excludeDateTag = await previousPhotoDateTag(date);
  const resolved = pickStable(poolExcluding(photos, excludeDateTag), date);
  await prisma.dailyPick.upsert({
    where: { date },
    create: { date, heroPhotoId: resolved.id },
    update: { heroPhotoId: resolved.id, heroPhotoManual: false },
  });
  return resolved;
}

/** Re-corre la selección automática para `date` (de verdad al azar, no determinística) y la deja fija. Ignora/limpia cualquier elección manual previa. */
export async function rerollHeroPhoto(date: string, photos: HeroPhotoRecord[]): Promise<HeroPhotoRecord | null> {
  if (photos.length === 0) return null;

  const pick = await prisma.dailyPick.findUnique({ where: { date } });
  const excludeDateTag = await previousPhotoDateTag(date);
  const pool = poolExcluding(photos, excludeDateTag, pick?.heroPhotoId ?? undefined);
  const resolved = pool[Math.floor(Math.random() * pool.length)];

  await prisma.dailyPick.upsert({
    where: { date },
    create: { date, heroPhotoId: resolved.id },
    update: { heroPhotoId: resolved.id, heroPhotoManual: false },
  });
  return resolved;
}

/** Fija a mano la foto del boletín de `date`. `heroPhotoId: null` vuelve a modo automático. */
export async function setManualHeroPhoto(date: string, heroPhotoId: string | null): Promise<void> {
  await prisma.dailyPick.upsert({
    where: { date },
    create: { date, heroPhotoId, heroPhotoManual: Boolean(heroPhotoId) },
    update: { heroPhotoId, heroPhotoManual: Boolean(heroPhotoId) },
  });
}
