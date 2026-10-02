import {
  escapeHtml,
  emailThemeHead,
  emailPalette,
  flatBg,
  winButtons,
  FONT_DISPLAY,
  FONT_BODY,
} from "@/lib/email-theme";

/** Correo avisando que alguien reaccionó o comentó tu respuesta de un día. */
export function interactionEmailHtml({
  name,
  actorName,
  message,
  boletinUrl,
}: {
  name: string;
  actorName: string;
  message: string;
  boletinUrl: string;
}): string {
  const safeName = escapeHtml(name);
  const safeActor = escapeHtml(actorName);
  const safeMessage = escapeHtml(message);
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
                <td class="text-white" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;color:${l.white};">💬&nbsp; Nueva actividad</td>
                <td align="right">${winButtons()}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 30px;">
              <p class="text-ink" style="margin:0 0 14px;color:${l.ink};font-size:14px;line-height:1.6;">Hola ${safeName},</p>
              <p class="text-ink" style="margin:0 0 18px;color:${l.ink};font-size:15px;line-height:1.6;"><strong>${safeActor}</strong> ${safeMessage}</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="bg-btn" style="border-radius:18px;${flatBg(l.btn)}">
                    <a href="${boletinUrl}" class="text-btn" style="display:inline-block;padding:12px 26px;color:${l.btnText};text-decoration:none;font-weight:700;font-family:${FONT_DISPLAY};font-size:14px;border-radius:18px;">Ver boletín →</a>
                  </td>
                </tr>
              </table>
              <p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">MSN status: 💌 tienes un mensaje nuevo</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function interactionEmailText({
  name,
  actorName,
  message,
  boletinUrl,
}: {
  name: string;
  actorName: string;
  message: string;
  boletinUrl: string;
}): string {
  return `Hola ${name},\n\n${actorName} ${message}\n\n${boletinUrl}`;
}
