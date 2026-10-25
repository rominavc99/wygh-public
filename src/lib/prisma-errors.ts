import { Prisma } from "@/generated/prisma/client";

/**
 * true si `error` es un choque de valor único (P2002) en `field`. Con
 * Prisma 7 y el adaptador de SQLite los campos ya no vienen en
 * `meta.target` sino en `meta.driverAdapterError.cause.constraint.fields`:
 * se revisan los dos, porque solo revisar `target` hacía que un nombre o
 * correo repetido tronara como error 500 en vez de avisar.
 */
export function isUniqueViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const meta = error.meta as
    | { target?: string[] | string; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } }
    | undefined;
  const target = meta?.target;
  const fields = [
    ...(Array.isArray(target) ? target : typeof target === "string" ? [target] : []),
    ...(meta?.driverAdapterError?.cause?.constraint?.fields ?? []),
  ];
  return fields.some((f) => f === field || f.endsWith(`_${field}_key`));
}
