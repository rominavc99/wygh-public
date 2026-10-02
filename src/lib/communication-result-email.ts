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
 * Correo a los admins avisando cómo salió una comunicación PROGRAMADA una
 * vez que worker.ts la procesó — a diferencia de "Enviar ahora", nadie
 * está mirando la pantalla en ese momento, así que es el único aviso que
 * existe del resultado.
 */
export function communicationResultEmailHtml({
  name,
  subject,
  status,
  recipientCount,
  error,
  viewUrl,
}: {
  name: string;
  subject: string;
  status: "sent" | "partial" | "failed";
  recipientCount: number;
  error?: string | null;
  viewUrl: string;
}): string {
  const isSuccess = status === "sent";
  const safeName = escapeHtml(name);
  const safeSubject = escapeHtml(subject);
  const l = emailPalette;

  const headline = isSuccess ? "✅ Comunicación enviada" : "⚠️ Problema al enviar";
  const message = isSuccess
    ? `Se mandó correctamente a ${recipientCount} destinatario${recipientCount === 1 ? "" : "s"}.`
    : status === "partial"
      ? `Se mandó solo a parte de los destinatarios (${recipientCount} en total).`
      : "No se pudo mandar a nadie.";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${emailThemeHead()}</head>
<body class="bg-page" style="margin:0;padding:0;${flatBg(l.pageFrom)}font-family:${FONT_BODY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg-page" style="${flatBg(l.pageFrom)}padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="460" cellpadding="0" cellspacing="0" class="bg-panel border-panel" style="max-width:460px;width:100%;${flatBg(l.panel)}border-radius:14px;overflow:hidden;border:2px solid ${l.panelBorder};">
          <tr>
            <td class="bg-titlebar" style="${flatBg(l.titlebar)}padding:14px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td class="text-white" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:16px;color:${l.white};">${headline}</td>
                <td align="right">${winButtons()}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 30px;">
              <p class="text-ink" style="margin:0 0 14px;color:${l.ink};font-size:14px;line-height:1.6;">Hola ${safeName},</p>
              <p class="text-ink" style="margin:0 0 10px;color:${l.ink};font-size:15px;line-height:1.6;">La comunicación programada <strong>"${safeSubject}"</strong> ya se procesó. ${message}</p>
              ${!isSuccess && error ? `<p class="text-pink" style="margin:0 0 18px;color:${l.pink};font-size:13px;line-height:1.5;">${escapeHtml(error)}</p>` : ""}
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="bg-btn" style="border-radius:18px;${flatBg(l.btn)}">
                    <a href="${viewUrl}" class="text-btn" style="display:inline-block;padding:12px 26px;color:${l.btnText};text-decoration:none;font-weight:700;font-family:${FONT_DISPLAY};font-size:14px;border-radius:18px;">Ver comunicación →</a>
                  </td>
                </tr>
              </table>
              <p class="text-faint" style="margin:22px 0 0;color:${l.faint};font-size:12px;line-height:1.5;">MSN status: 📣 aviso automático del sistema</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function communicationResultEmailText({
  name,
  subject,
  status,
  recipientCount,
  error,
  viewUrl,
}: {
  name: string;
  subject: string;
  status: "sent" | "partial" | "failed";
  recipientCount: number;
  error?: string | null;
  viewUrl: string;
}): string {
  const isSuccess = status === "sent";
  const message = isSuccess
    ? `Se mandó correctamente a ${recipientCount} destinatario${recipientCount === 1 ? "" : "s"}.`
    : status === "partial"
      ? `Se mandó solo a parte de los destinatarios (${recipientCount} en total).`
      : "No se pudo mandar a nadie.";
  return `Hola ${name},\n\nLa comunicación programada "${subject}" ya se procesó. ${message}${
    !isSuccess && error ? `\n\n${error}` : ""
  }\n\n${viewUrl}`;
}
