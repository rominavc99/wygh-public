import {
  escapeHtml,
  emailThemeHead,
  emailPalette,
  flatBg,
  winButtons,
  FONT_DISPLAY,
  FONT_BODY,
} from "@/lib/email-theme";

/** Ventanita con barra de título, igual que el recordatorio. */
export function emailWindow({ title, body, width = 440 }: { title: string; body: string; width?: number }): string {
  const l = emailPalette;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${emailThemeHead()}</head>
<body class="bg-page" style="margin:0;padding:0;${flatBg(l.pageFrom)}font-family:${FONT_BODY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-page" style="${flatBg(l.pageFrom)}padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" class="bg-panel border-panel" style="max-width:${width}px;width:100%;${flatBg(l.panel)}border-radius:14px;overflow:hidden;border:2px solid ${l.panelBorder};">
          <tr>
            <td class="bg-titlebar" style="${flatBg(l.titlebar)}padding:14px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td class="text-white" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;color:${l.white};">${title}</td>
                <td align="right">${winButtons()}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 30px;">${body}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function button(href: string, label: string): string {
  const l = emailPalette;
  return `<table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="bg-btn" style="border-radius:18px;${flatBg(l.btn)}">
                    <a href="${escapeHtml(href)}" class="text-btn" style="display:inline-block;padding:12px 26px;color:${l.btnText};text-decoration:none;font-weight:700;font-family:${FONT_DISPLAY};font-size:14px;border-radius:18px;">${label}</a>
                  </td>
                </tr>
              </table>`;
}

/** Sustituye {nombre} y {dias} en los textos del correo de inactividad. */
export function fillNudgeTemplate(template: string, name: string, missedDays: number): string {
  return template.replaceAll("{nombre}", name).replaceAll("{dias}", String(missedDays));
}

export function inactivityNudgeEmailHtml({
  name,
  heading,
  message,
  formUrl,
}: {
  name: string;
  heading: string;
  message: string;
  formUrl: string;
}): string {
  const l = emailPalette;
  return emailWindow({
    title: "🥪&nbsp; Te extrañamos",
    body: `
              <p class="text-ink" style="margin:0 0 14px;color:${l.ink};font-size:14px;line-height:1.6;">Hola ${escapeHtml(name)},</p>
              <p class="text-pink" style="margin:0 0 12px;color:${l.pink};font-family:${FONT_DISPLAY};font-weight:700;font-size:19px;line-height:1.35;">${escapeHtml(heading)}</p>
              <p class="text-ink" style="margin:0 0 20px;color:${l.ink};font-size:15px;line-height:1.6;">${escapeHtml(message)}</p>
              ${button(formUrl, "Responder hoy →")}
              <p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">MSN status: 🔴 desconectado</p>`,
  });
}

export function inactivityNudgeEmailText({
  name,
  heading,
  message,
  formUrl,
}: {
  name: string;
  heading: string;
  message: string;
  formUrl: string;
}): string {
  return `Hola ${name},\n\n${heading}\n\n${message}\n\nResponde hoy: ${formUrl}`;
}
