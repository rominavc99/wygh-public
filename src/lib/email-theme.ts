export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const FONT_DISPLAY = "'Comic Sans MS', 'Trebuchet MS', sans-serif";
export const FONT_BODY = "'Trebuchet MS', Verdana, sans-serif";
/** Para el titular de la sección hero — le da el aire "portada de periódico". */
export const FONT_SERIF = "Georgia, 'Times New Roman', Times, serif";

export interface EmailPalette {
  pageFrom: string;
  pageTo: string;
  panel: string;
  panelBorder: string;
  panel2: string;
  titlebar: string;
  bubble: string;
  edge: string;
  ink: string;
  soft: string;
  faint: string;
  white: string;
  pink: string;
  btn: string;
  btnText: string;
  winBtnBg: string;
  winBtnText: string;
  winBtnCloseBg: string;
}

export const emailPalette: EmailPalette = {
  pageFrom: "#ffd6e8",
  pageTo: "#ffeed9",
  panel: "#fffaf0",
  panelBorder: "#0d525c",
  panel2: "#ffe9d6",
  titlebar: "#1a8f95",
  bubble: "#e3f7f4",
  edge: "#f0c9a0",
  ink: "#26313f",
  soft: "#55606e",
  faint: "#8b95a0",
  white: "#ffffff",
  pink: "#c93d82",
  btn: "#5fa93a",
  btnText: "#17330f",
  winBtnBg: "#d6f0ee",
  winBtnText: "#0d525c",
  winBtnCloseBg: "#e14444",
};

/** Los tres botoncitos "_ □ ×" de la barra de título, como cuadraditos de verdad. */
export function winButtons(): string {
  const l = emailPalette;
  const square = (label: string, bg: string, color: string) =>
    `<td width="20" height="20" align="center" valign="middle" style="width:20px;height:20px;${flatBg(bg)}border-radius:4px;font-family:${FONT_BODY};font-size:11px;font-weight:700;color:${color};">${label}</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    ${square("_", l.winBtnBg, l.winBtnText)}
    <td width="4"></td>
    ${square("□", l.winBtnBg, l.winBtnText)}
    <td width="4"></td>
    ${square("×", l.winBtnCloseBg, l.white)}
  </tr></table>`;
}

/**
 * `background-color` + `background-image` con el MISMO color repetido.
 * Gmail (app Android/iOS) y Outlook aplican su propio modo oscuro
 * reescribiendo `background-color`, pero no tocan `background-image` — así
 * que usar un "degradado" de un solo color hace que el correo se vea
 * siempre igual, sin importar el modo del cliente. Es la técnica más
 * confiable conocida para esto (no hay forma estándar de garantizar un
 * modo oscuro personalizado en Gmail/Outlook app).
 */
export function flatBg(hex: string): string {
  return `background-color:${hex};background-image:linear-gradient(0deg,${hex},${hex});`;
}

/**
 * Refuerza que el correo se vea SIEMPRE igual (paleta clara), sin importar
 * el modo oscuro del dispositivo o cliente. `color-scheme`/
 * `supported-color-schemes` en "light" le piden a los clientes que
 * respetan el estándar que no toquen nada; el bloque `@media
 * (prefers-color-scheme: dark)` reafirma los mismos colores con
 * `!important` para los que ignoran esos metadatos; y `flatBg` (aplicado
 * en cada bloque de color) cubre a Gmail/Outlook, que ignoran ambas cosas.
 */
export function emailThemeHead(): string {
  const l = emailPalette;
  const rules = `
    body, .bg-page { background-color: ${l.pageFrom} !important; }
    .bg-panel { background-color: ${l.panel} !important; }
    .border-panel { border-color: ${l.panelBorder} !important; }
    .bg-panel2 { background-color: ${l.panel2} !important; }
    .bg-titlebar { background-color: ${l.titlebar} !important; }
    .bg-bubble { background-color: ${l.bubble} !important; }
    .border-edge { border-color: ${l.edge} !important; }
    .border-pink { border-color: ${l.pink} !important; }
    .bg-btn { background-color: ${l.btn} !important; }
    .text-ink { color: ${l.ink} !important; }
    .text-soft { color: ${l.soft} !important; }
    .text-faint { color: ${l.faint} !important; }
    .text-white { color: ${l.white} !important; }
    .text-pink { color: ${l.pink} !important; }
    .text-btn { color: ${l.btnText} !important; }
  `;
  return `<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  ${rules}
  @media (prefers-color-scheme: dark) { ${rules} }
</style>`;
}

export function magicLinkEmailHtml({
  name,
  url,
  code,
  newsletterName,
}: {
  name: string;
  url: string;
  code: string;
  newsletterName: string;
}): string {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(newsletterName);
  const l = emailPalette;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${emailThemeHead()}</head>
<body class="bg-page" style="margin:0;padding:0;${flatBg(l.pageFrom)}font-family:${FONT_BODY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-page" style="${flatBg(l.pageFrom)}padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="440" cellpadding="0" cellspacing="0" class="bg-panel border-panel" style="max-width:440px;width:100%;${flatBg(l.panel)}border-radius:14px;overflow:hidden;border:2px solid ${l.panelBorder};">
          <tr>
            <td class="bg-titlebar" style="${flatBg(l.titlebar)}padding:14px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td class="text-white" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;color:${l.white};">🔑&nbsp; Iniciar sesión</td>
                <td align="right">${winButtons()}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 30px;">
              <p class="text-ink" style="margin:0 0 6px;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:19px;">${safeTitle}</p>
              <p class="text-ink" style="margin:0 0 18px;color:${l.ink};font-size:14px;line-height:1.6;">Hola ${safeName}, tu código para entrar es:</p>
              <p class="text-ink" style="margin:0 0 8px;color:${l.ink};font-family:${FONT_DISPLAY};font-weight:700;font-size:34px;letter-spacing:8px;">${escapeHtml(code)}</p>
              <p class="text-ink" style="margin:0 0 18px;color:${l.ink};font-size:14px;line-height:1.6;">Escríbelo en la pantalla donde lo pediste, o usa este botón. Es de un solo uso y expira en 15 minutos ✨</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="bg-btn" style="border-radius:18px;${flatBg(l.btn)}">
                    <a href="${url}" class="text-btn" style="display:inline-block;padding:12px 26px;color:${l.btnText};text-decoration:none;font-weight:700;font-family:${FONT_DISPLAY};font-size:14px;border-radius:18px;">Entrar ahora →</a>
                  </td>
                </tr>
              </table>
              <p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">Si no pediste este código, ignora este correo. MSN status: 🟢 en línea</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function magicLinkEmailText({ name, url, code }: { name: string; url: string; code: string }): string {
  return `Hola ${name},\n\nTu código para entrar es: ${code}\n\nEscríbelo en la pantalla donde lo pediste, o usa este enlace (un solo uso, expira en 15 minutos):\n${url}\n\nSi no lo pediste, ignora este correo.`;
}
