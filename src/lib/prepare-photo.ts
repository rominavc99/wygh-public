// Solo navegador: prepara la foto del formulario diario antes de mandarla
// (ver photoFromFormData en src/lib/response-photos.ts para el porqué del
// base64). Se reduce a lo que de verdad se usa — en el correo se manda a
// 800px y en la web se ve aún más chica — así sube rápido con datos
// móviles y cabe en el borrador guardado en el dispositivo.

const MAX_SIDE_PX = 2000;
const JPEG_QUALITY = 0.85;

export type PreparedPhoto = {
  /** Contenido en base64, sin el prefijo "data:...;base64,". */
  data: string;
  type: string;
  /** data URL para la vista previa (la CSP no deja mostrar blob:). */
  dataUrl: string;
};

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  } catch {
    return null; // formato que el navegador no sabe decodificar: se manda tal cual
  }
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  // Los GIF se mandan tal cual para no perder la animación.
  const shrunk = file.type === "image/gif" ? null : await shrink(file);
  const blob = shrunk && shrunk.size < file.size ? shrunk : file;
  const type = blob === file ? file.type : "image/jpeg";
  const dataUrl = await readAsDataUrl(blob);
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), type, dataUrl };
}
