/**
 * El cuerpo de una Communication viene del editor de texto enriquecido de
 * /admin/comunicaciones (contentEditable + document.execCommand), así que
 * llega como HTML de verdad. Solo lo escribe un admin, pero igual se le
 * quita cualquier <script>/<style>/manejador de eventos antes de guardarlo
 * — defensa en profundidad barata, no porque se espere HTML malicioso.
 */
export function sanitizeRichTextHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'");
}

/** Versión texto plano del cuerpo, para el fallback del correo y para saber si quedó vacío. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
