import {
  escapeHtml,
  emailThemeHead,
  emailPalette,
  flatBg,
  winButtons,
  FONT_DISPLAY,
  FONT_BODY,
} from "@/lib/email-theme";
import { getSiteUrl } from "@/lib/site-url";

export function reminderEmailHtml({
  name,
  sendTime,
  newsletterName,
  formUrl,
}: {
  name: string;
  sendTime: string;
  newsletterName: string;
  formUrl: string;
}): string {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(newsletterName);
  const safeTime = escapeHtml(sendTime);
  const safeSiteUrl = escapeHtml(getSiteUrl());
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
                <td class="text-white" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;color:${l.white};">⏰&nbsp; Recordatorio</td>
                <td align="right">${winButtons()}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 30px;">
              <p class="text-ink" style="margin:0 0 14px;color:${l.ink};font-size:14px;line-height:1.6;">Hola ${safeName},</p>
              <p class="text-ink" style="margin:0 0 18px;color:${l.ink};font-size:15px;line-height:1.6;">El boletín "${safeTitle}" de hoy está por cerrar a la <strong>${safeTime}</strong> y aún no recibimos tu respuesta. Todos quieren saber qué vas a hacer hoy, responde antes de que se acabe el tiempo.</p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="bg-btn" style="border-radius:18px;${flatBg(l.btn)}">
                    <a href="${formUrl}" class="text-btn" style="display:inline-block;padding:12px 26px;color:${l.btnText};text-decoration:none;font-weight:700;font-family:${FONT_DISPLAY};font-size:14px;border-radius:18px;">Responder ahora →</a>
                  </td>
                </tr>
              </table>
              <p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">Si ya respondiste, ignora este correo. MSN status: 🟡 ausente</p>
            </td>
          </tr>
          <tr>
            <td class="text-faint" style="padding:12px 26px 20px;text-align:center;border-top:1px solid ${l.faint};">
              <a href="${safeSiteUrl}" class="text-faint" style="color:${l.faint};font-size:11px;text-decoration:none;">Haz clic aquí para acceder al sitio</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function reminderEmailText({
  name,
  sendTime,
  newsletterName,
  formUrl,
}: {
  name: string;
  sendTime: string;
  newsletterName: string;
  formUrl: string;
}): string {
  return `Hola ${name},\n\nEl boletín "${newsletterName}" de hoy está por cerrar a la ${sendTime} y aún no recibimos tu respuesta. Todos quieren saber qué vas a hacer hoy, responde antes de que se acabe el tiempo.\n\n${formUrl}\n\nSi ya respondiste, ignora este correo.`;
}
