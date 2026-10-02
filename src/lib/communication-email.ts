import {
  escapeHtml,
  emailThemeHead,
  emailPalette,
  flatBg,
  winButtons,
  FONT_DISPLAY,
  FONT_BODY,
} from "@/lib/email-theme";

/**
 * Correo suelto mandado desde /admin/comunicaciones. A diferencia del
 * boletín diario, el cuerpo es HTML libre escrito por el admin (ya
 * saneado en src/lib/rich-text.ts), así que se inserta tal cual — solo
 * el nombre y el asunto pasan por escapeHtml.
 */
export function communicationEmailHtml({
  name,
  subject,
  bodyHtml,
}: {
  name: string;
  subject: string;
  bodyHtml: string;
}): string {
  const safeName = escapeHtml(name);
  const safeSubject = escapeHtml(subject);
  const l = emailPalette;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${emailThemeHead()}</head>
<body class="bg-page" style="margin:0;padding:0;${flatBg(l.pageFrom)}font-family:${FONT_BODY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-page" style="${flatBg(l.pageFrom)}padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" class="bg-panel border-panel" style="max-width:480px;width:100%;${flatBg(l.panel)}border-radius:14px;overflow:hidden;border:2px solid ${l.panelBorder};">
          <tr>
            <td class="bg-titlebar" style="${flatBg(l.titlebar)}padding:14px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td class="text-white" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;color:${l.white};">📣&nbsp; ${safeSubject}</td>
                <td align="right">${winButtons()}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 30px;">
              <p class="text-ink" style="margin:0 0 16px;color:${l.ink};font-size:14px;line-height:1.6;">Hola ${safeName},</p>
              <div class="text-ink" style="color:${l.ink};font-size:14.5px;line-height:1.65;">${bodyHtml}</div>
              <p class="text-faint" style="margin:26px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">MSN status: 📣 anuncio del sistema</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function communicationEmailText({ name, bodyText }: { name: string; bodyText: string }): string {
  return `Hola ${name},\n\n${bodyText}`;
}
