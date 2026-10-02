import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { diskPathFor } from "@/lib/response-photos";

// Las fotos subidas por usuarios (ver src/lib/response-photos.ts) NO viven
// dentro de public/ — a propósito: un archivo bajo public/ SIEMPRE se
// sirve como estático antes de que la app pueda intervenir (en cualquier
// modo, dev o producción), sin importar el chequeo de sesión de acá
// abajo. Viven en data/uploads/respuestas y esta ruta las lee de ahí en
// cada request, exigiendo sesión iniciada — son fotos privadas del grupo,
// nunca públicas por más que alguien tenga/adivine la URL exacta. El
// correo real no pasa por aquí: esas fotos van incrustadas como adjunto
// (cid:), ver src/lib/send-newsletter.ts.
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const { filename } = await params;

  // Nunca dejar que el segmento intente escapar de esta carpeta.
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return new NextResponse(null, { status: 400 });
  }

  const mimeType = MIME_TYPES[path.extname(filename).toLowerCase()];
  if (!mimeType) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const buffer = await fs.readFile(diskPathFor(filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
